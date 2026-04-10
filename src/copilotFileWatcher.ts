// copilotFileWatcher.ts
//
// Watches GitHub Copilot Chat session JSONL files and drives AgentState/webview
// messages — the Copilot equivalent of fileWatcher.ts (which does the same for
// Claude Code JSONL transcripts).
//
// File location (per platform):
//   Windows : %APPDATA%\Code\User\workspaceStorage\<hash>\chatSessions\<id>.jsonl
//   macOS   : ~/Library/Application Support/Code/User/workspaceStorage/<hash>/chatSessions/<id>.jsonl
//   Linux   : ~/.config/Code/User/workspaceStorage/<hash>/chatSessions/<id>.jsonl

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { processCopilotLine } from './copilotTranscriptParser.js';
import { inferRoomFromText } from './roomManager.js';
import type { AgentState } from './types.js';

// ── Constants ───────────────────────────────────────────────────────────────

/** Only adopt files modified within this window (avoids re-showing stale old sessions) */
const COPILOT_ACTIVE_THRESHOLD_MS = 30 * 60 * 1_000; // 30 minutes

/** Remove Copilot agents whose file hasn't updated for this long (ms) */
const COPILOT_STALE_TIMEOUT_MS = 10 * 60 * 1_000; // 10 minutes

/** Minimum file size to consider a session worth tracking */
const COPILOT_MIN_SIZE_BYTES = 512;

// ── Platform path helper ───────────────────────────────────────────────────

/**
 * Returns the root workspaceStorage directory for the current VS Code installation.
 * Supports the stable "Code" and Insiders "Code - Insiders" builds.
 */
export function getCopilotChatStorageRoot(): string[] {
  const home = os.homedir();
  const roots: string[] = [];

  if (process.platform === 'win32') {
    const appData = process.env['APPDATA'] ?? path.join(home, 'AppData', 'Roaming');
    roots.push(
      path.join(appData, 'Code', 'User', 'workspaceStorage'),
      path.join(appData, 'Code - Insiders', 'User', 'workspaceStorage'),
    );
  } else if (process.platform === 'darwin') {
    const base = path.join(home, 'Library', 'Application Support');
    roots.push(
      path.join(base, 'Code', 'User', 'workspaceStorage'),
      path.join(base, 'Code - Insiders', 'User', 'workspaceStorage'),
    );
  } else {
    // Linux
    const configDir = process.env['XDG_CONFIG_HOME'] ?? path.join(home, '.config');
    roots.push(
      path.join(configDir, 'Code', 'User', 'workspaceStorage'),
      path.join(configDir, 'Code - Insiders', 'User', 'workspaceStorage'),
    );
  }

  return roots.filter((r) => {
    try {
      return fs.existsSync(r);
    } catch {
      return false;
    }
  });
}

/**
 * Enumerate all *.jsonl files in workspaceStorage\*\chatSessions\ that were
 * recently modified and are large enough to contain real activity.
 */
function scanCopilotSessionFiles(storageRoots: string[]): string[] {
  const results: string[] = [];
  const now = Date.now();

  for (const root of storageRoots) {
    let workspaceDirs: string[];
    try {
      workspaceDirs = fs
        .readdirSync(root, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.join(root, d.name, 'chatSessions'));
    } catch {
      continue;
    }

    for (const sessionDir of workspaceDirs) {
      let files: string[];
      try {
        if (!fs.existsSync(sessionDir)) continue;
        files = fs
          .readdirSync(sessionDir)
          .filter((f) => f.endsWith('.jsonl'))
          .map((f) => path.join(sessionDir, f));
      } catch {
        continue;
      }

      for (const file of files) {
        try {
          const stat = fs.statSync(file);
          if (stat.size < COPILOT_MIN_SIZE_BYTES) continue;
          if (now - stat.mtimeMs > COPILOT_ACTIVE_THRESHOLD_MS) continue;
          results.push(file);
        } catch {
          continue;
        }
      }
    }
  }

  return results;
}

// ── Internal state ─────────────────────────────────────────────────────────

/** Tracks which Copilot session files are already being watched */
const trackedCopilotFiles = new Set<string>();

/** Files the user dismissed via the × button — won't be re-adopted */
export const dismissedCopilotFiles = new Map<string, number>(); // path → timestamp

/** FSWatcher disposables keyed by agentId — replaces the setInterval polling approach */
const copilotFileWatcherDisposables = new Map<number, vscode.Disposable>();

/**
 * When the user opens Copilot Chat from the "+Agent" button with a room selected,
 * the suggested room ID is stored here. The next Copilot session that gets adopted
 * will use this room ID instead of text inference.
 * Cleared after one use so subsequent auto-detections still use keyword inference.
 */
let pendingCopilotRoomId: string | null = null;
let pendingRoomIdExpiry = 0;
const PENDING_ROOM_TTL_MS = 5 * 60 * 1_000; // 5 minutes

/** Call this when the user opens Copilot Chat with a room suggestion. */
export function setPendingCopilotRoomId(roomId: string): void {
  pendingCopilotRoomId = roomId;
  pendingRoomIdExpiry = Date.now() + PENDING_ROOM_TTL_MS;
  console.log(`[Pixel Agents] Pending Copilot room ID set: ${roomId}`);
}

function consumePendingRoomId(): string | null {
  if (pendingCopilotRoomId && Date.now() < pendingRoomIdExpiry) {
    const id = pendingCopilotRoomId;
    pendingCopilotRoomId = null;
    return id;
  }
  pendingCopilotRoomId = null;
  return null;
}

/**
 * One-time probe: activate the GitHub.copilot-chat extension and log its exported API surface.
 * When Copilot Chat exposes native tool call events, this is the integration point to replace
 * file-based scraping with zero-latency event subscriptions (full Claude parity).
 */
export async function probeGitHubCopilotChatAPI(): Promise<void> {
  const ext = vscode.extensions.getExtension('GitHub.copilot-chat');
  if (!ext) {
    console.log('[Pixel Agents] GitHub.copilot-chat not installed — file-based fallback active');
    return;
  }
  console.log(`[Pixel Agents] GitHub.copilot-chat v${String(ext.packageJSON.version)} found`);
  try {
    const api = await ext.activate();
    if (api && typeof api === 'object') {
      const keys = Object.keys(api as object);
      console.log(
        `[Pixel Agents] GitHub.copilot-chat API exports: ${
          keys.length > 0 ? keys.join(', ') : '(none — file-based fallback active)'
        }`,
      );
      // Future integration point: if api exposes onToolCallStarted / onDidInvokeTool,
      // subscribe here and replace the FSWatcher approach with native events.
    } else {
      console.log(
        '[Pixel Agents] GitHub.copilot-chat has no exported API — file-based fallback active',
      );
    }
  } catch (e) {
    console.log(`[Pixel Agents] GitHub.copilot-chat probe error: ${e}`);
  }
}

// ── Per-agent file watching ─────────────────────────────────────────────────

function startCopilotFilePolling(
  agentId: number,
  jsonlFile: string,
  agents: Map<number, AgentState>,
  _copilotPollingTimers: Map<number, ReturnType<typeof setInterval>>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  webview: vscode.Webview | undefined,
): void {
  // Use VS Code's FSWatcher for instant OS-level change notification.
  // This replaces the 500ms setInterval poll — reactions are now immediate.
  const dir = vscode.Uri.file(path.dirname(jsonlFile));
  const filename = path.basename(jsonlFile);
  const fsWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(dir, filename),
    true, // ignoreCreateEvents — file already exists when we start watching
    false, // DO react to change events — this is the trigger
    true, // ignoreDeleteEvents
  );
  fsWatcher.onDidChange(() => {
    if (!agents.has(agentId)) {
      fsWatcher.dispose();
      copilotFileWatcherDisposables.delete(agentId);
      return;
    }
    readCopilotNewLines(agentId, agents, waitingTimers, webview);
  });
  copilotFileWatcherDisposables.set(agentId, fsWatcher);
}

function readCopilotNewLines(
  agentId: number,
  agents: Map<number, AgentState>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  webview: vscode.Webview | undefined,
): void {
  const agent = agents.get(agentId);
  if (!agent) return;

  try {
    const stat = fs.statSync(agent.jsonlFile);
    if (stat.size <= agent.fileOffset) return; // no new data

    const fd = fs.openSync(agent.jsonlFile, 'r');
    const length = stat.size - agent.fileOffset;
    const buf = Buffer.alloc(length);
    fs.readSync(fd, buf, 0, length, agent.fileOffset);
    fs.closeSync(fd);

    agent.fileOffset = stat.size;

    // Combine with any partial line buffered from previous read
    const text = agent.lineBuffer + buf.toString('utf-8');
    const lines = text.split('\n');

    // Last element is an incomplete line (or empty) — buffer it
    agent.lineBuffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      processCopilotLine(agentId, line, agents, waitingTimers, webview);
    }
  } catch {
    // File may have been deleted or moved — ignore silently
  }
}

// ── Agent creation ─────────────────────────────────────────────────────────

/**
 * Read the first 8 KB of a Copilot session JSONL and extract any text that can
 * help infer the team room (e.g. first user message content).
 */
function inferRoomIdFromFile(jsonlFile: string): string {
  try {
    const fd = fs.openSync(jsonlFile, 'r');
    const buf = Buffer.alloc(8192);
    const bytesRead = fs.readSync(fd, buf, 0, 8192, 0);
    fs.closeSync(fd);
    const text = buf.slice(0, bytesRead).toString('utf-8');
    return inferRoomFromText(text);
  } catch {
    return 'general';
  }
}

function createCopilotAgent(
  jsonlFile: string,
  nextAgentIdRef: { current: number },
  agents: Map<number, AgentState>,
  copilotPollingTimers: Map<number, ReturnType<typeof setInterval>>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  webview: vscode.Webview | undefined,
  persistAgents: () => void,
  onAgentCreated?: (agent: AgentState) => void,
): void {
  const id = nextAgentIdRef.current++;
  const sessionId = path.basename(jsonlFile, '.jsonl');

  // Start reading from the end of the file (don't replay history)
  let fileOffset = 0;
  try {
    fileOffset = fs.statSync(jsonlFile).size;
  } catch {
    /* use 0 if stat fails */
  }

  const agent: AgentState = {
    id,
    sessionId,
    terminalRef: undefined,
    isExternal: true,
    agentSource: 'copilot',
    agentType: 'copilot-chat',
    roomId: consumePendingRoomId() ?? inferRoomIdFromFile(jsonlFile),
    projectDir: path.dirname(jsonlFile),
    jsonlFile,
    fileOffset,
    lineBuffer: '',
    activeToolIds: new Set(),
    activeToolStatuses: new Map(),
    activeToolNames: new Map(),
    activeSubagentToolIds: new Map(),
    activeSubagentToolNames: new Map(),
    backgroundAgentToolIds: new Set(),
    isWaiting: false,
    permissionSent: false,
    hadToolsInTurn: false,
    hookDelivered: false,
    lastDataAt: Date.now(),
    linesProcessed: 0,
    seenUnknownRecordTypes: new Set(),
    folderName: undefined,
  };

  agents.set(id, agent);
  persistAgents();

  console.log(
    `[Pixel Agents] Copilot agent ${id} created for ${path.basename(jsonlFile)} → room: ${agent.roomId ?? 'general'}`,
  );

  webview?.postMessage({
    type: 'agentCreated',
    id,
    isExternal: true,
    agentSource: 'copilot',
    agentType: 'copilot-chat',
    roomId: agent.roomId ?? 'general',
  });

  onAgentCreated?.(agent);

  startCopilotFilePolling(id, jsonlFile, agents, copilotPollingTimers, waitingTimers, webview);
  readCopilotNewLines(id, agents, waitingTimers, webview);
}

// ── Stale agent removal ────────────────────────────────────────────────────

function removeStaleCopilotAgents(
  agents: Map<number, AgentState>,
  copilotPollingTimers: Map<number, ReturnType<typeof setInterval>>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  webview: vscode.Webview | undefined,
  persistAgents: () => void,
): void {
  const now = Date.now();

  for (const [id, agent] of agents) {
    if (agent.agentSource !== 'copilot') continue;

    // Check if the file has gone stale
    const timeSinceData = now - agent.lastDataAt;
    if (timeSinceData < COPILOT_STALE_TIMEOUT_MS) continue;

    // Also check file mtime to be sure
    try {
      const stat = fs.statSync(agent.jsonlFile);
      if (now - stat.mtimeMs < COPILOT_STALE_TIMEOUT_MS) continue;
    } catch {
      // File deleted — always remove
    }

    console.log(`[Pixel Agents] Removing stale Copilot agent ${id}`);

    // Dispose FSWatcher for this agent
    const fsw = copilotFileWatcherDisposables.get(id);
    if (fsw) {
      fsw.dispose();
      copilotFileWatcherDisposables.delete(id);
    }

    const pt = copilotPollingTimers.get(id);
    if (pt) {
      clearInterval(pt);
      copilotPollingTimers.delete(id);
    }

    const wt = waitingTimers.get(id);
    if (wt) {
      clearTimeout(wt);
      waitingTimers.delete(id);
    }

    trackedCopilotFiles.delete(agent.jsonlFile);
    agents.delete(id);
    persistAgents();
    webview?.postMessage({ type: 'agentClosed', id });
  }
}

// ── Main scanner ───────────────────────────────────────────────────────────

/**
 * Start the periodic scanner that discovers active Copilot Chat sessions and
 * creates Pixel Agents characters for each one.
 *
 * Returns a cleanup function that stops all timers when the extension deactivates.
 */
export function startCopilotSessionScanning(
  nextAgentIdRef: { current: number },
  agents: Map<number, AgentState>,
  copilotPollingTimers: Map<number, ReturnType<typeof setInterval>>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  webview: vscode.Webview | undefined,
  persistAgents: () => void,
  onAgentCreated?: (agent: AgentState) => void,
): () => void {
  const storageRoots = getCopilotChatStorageRoot();

  if (storageRoots.length === 0) {
    console.log('[Pixel Agents] No VS Code workspaceStorage directories found for Copilot adapter');
    return () => {
      /* nothing to clean up */
    };
  }

  console.log(`[Pixel Agents] Copilot adapter watching: ${storageRoots.join(', ')}`);

  // Helper: try to adopt a single candidate .jsonl file as a Copilot agent
  function tryAdoptFile(file: string): void {
    const normalizedFile = path.resolve(file);
    if (trackedCopilotFiles.has(normalizedFile)) return;

    const dismissedAt = dismissedCopilotFiles.get(normalizedFile);
    if (dismissedAt) {
      if (Date.now() - dismissedAt < 3 * 60 * 1_000) return;
      dismissedCopilotFiles.delete(normalizedFile);
    }

    for (const agent of agents.values()) {
      if (path.resolve(agent.jsonlFile) === normalizedFile) {
        trackedCopilotFiles.add(normalizedFile);
        return;
      }
    }

    // Validate the file is active enough to adopt before creating an agent
    try {
      const stat = fs.statSync(normalizedFile);
      if (stat.size < COPILOT_MIN_SIZE_BYTES) return;
      if (Date.now() - stat.mtimeMs > COPILOT_ACTIVE_THRESHOLD_MS) return;
    } catch {
      return;
    }

    trackedCopilotFiles.add(normalizedFile);
    createCopilotAgent(
      normalizedFile,
      nextAgentIdRef,
      agents,
      copilotPollingTimers,
      waitingTimers,
      webview,
      persistAgents,
      onAgentCreated,
    );
  }

  // 1. Initial scan: adopt any .jsonl files already active when the extension loads
  for (const file of scanCopilotSessionFiles(storageRoots)) {
    tryAdoptFile(file);
  }

  // 2. FSWatcher discovery: fires instantly (OS inotify/FSEvents/ReadDirectoryChanges)
  //    when Copilot Chat creates a new session file — replaces the 3-second scan interval
  const discoveryDisposables: vscode.Disposable[] = [];
  for (const root of storageRoots) {
    const fsw = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(root), '**/chatSessions/*.jsonl'),
      false, // react to create events — new Copilot Chat sessions
      true, // ignore change events — per-file FSWatcher handles those
      true, // ignore delete events
    );
    fsw.onDidCreate((uri) => {
      // Brief delay to let VS Code flush the initial snapshot before we read the file size
      setTimeout(() => tryAdoptFile(uri.fsPath), 1_000);
    });
    discoveryDisposables.push(fsw);
  }

  // 3. Stale cleanup — 60 s interval (was an implicit side-effect of the 3 s scan)
  const staleTimer = setInterval(() => {
    removeStaleCopilotAgents(agents, copilotPollingTimers, waitingTimers, webview, persistAgents);
  }, 60_000);

  return () => {
    for (const d of discoveryDisposables) d.dispose();
    clearInterval(staleTimer);
  };
}

/**
 * Dismiss a Copilot agent (user closed it via ×).
 * Stops polling and prevents the file from being re-adopted.
 */
export function dismissCopilotAgent(
  agentId: number,
  agents: Map<number, AgentState>,
  copilotPollingTimers: Map<number, ReturnType<typeof setInterval>>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  persistAgents: () => void,
  webview: vscode.Webview | undefined,
): void {
  const agent = agents.get(agentId);
  if (!agent || agent.agentSource !== 'copilot') return;

  dismissedCopilotFiles.set(path.resolve(agent.jsonlFile), Date.now());
  trackedCopilotFiles.delete(path.resolve(agent.jsonlFile));

  // Dispose FSWatcher for this agent
  const fsw = copilotFileWatcherDisposables.get(agentId);
  if (fsw) {
    fsw.dispose();
    copilotFileWatcherDisposables.delete(agentId);
  }

  const pt = copilotPollingTimers.get(agentId);
  if (pt) {
    clearInterval(pt);
    copilotPollingTimers.delete(agentId);
  }
  const wt = waitingTimers.get(agentId);
  if (wt) {
    clearTimeout(wt);
    waitingTimers.delete(agentId);
  }

  agents.delete(agentId);
  persistAgents();
  webview?.postMessage({ type: 'agentClosed', id: agentId });
}
