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
import type * as vscode from 'vscode';

import { processCopilotLine } from './copilotTranscriptParser.js';
import type { AgentState } from './types.js';

// ── Constants ───────────────────────────────────────────────────────────────

/** How often to poll each active session file for new lines (ms) */
const COPILOT_POLL_INTERVAL_MS = 500;

/** How often to scan workspaceStorage for new/active session files (ms) */
const COPILOT_SCAN_INTERVAL_MS = 3_000;

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

// ── Per-agent file polling ─────────────────────────────────────────────────

function startCopilotFilePolling(
  agentId: number,
  _jsonlFile: string,
  agents: Map<number, AgentState>,
  copilotPollingTimers: Map<number, ReturnType<typeof setInterval>>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  webview: vscode.Webview | undefined,
): void {
  const interval = setInterval(() => {
    if (!agents.has(agentId)) {
      clearInterval(interval);
      copilotPollingTimers.delete(agentId);
      return;
    }
    readCopilotNewLines(agentId, agents, waitingTimers, webview);
  }, COPILOT_POLL_INTERVAL_MS);

  copilotPollingTimers.set(agentId, interval);
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

  console.log(`[Pixel Agents] Copilot agent ${id} created for ${path.basename(jsonlFile)}`);

  webview?.postMessage({
    type: 'agentCreated',
    id,
    isExternal: true,
    agentSource: 'copilot',
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

  const scanTimer = setInterval(() => {
    const activeFiles = scanCopilotSessionFiles(storageRoots);

    for (const file of activeFiles) {
      const normalizedFile = path.resolve(file);

      if (trackedCopilotFiles.has(normalizedFile)) continue;

      // Skip files dismissed by the user
      const dismissedAt = dismissedCopilotFiles.get(normalizedFile);
      if (dismissedAt) {
        // Expire dismissal after 3 minutes (file might be a genuinely new session)
        if (Date.now() - dismissedAt < 3 * 60 * 1_000) continue;
        dismissedCopilotFiles.delete(normalizedFile);
      }

      // Skip if already tracked by an existing agent
      let alreadyTracked = false;
      for (const agent of agents.values()) {
        if (path.resolve(agent.jsonlFile) === normalizedFile) {
          alreadyTracked = true;
          trackedCopilotFiles.add(normalizedFile); // fix up tracking set
          break;
        }
      }
      if (alreadyTracked) continue;

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

    // Remove stale agents periodically
    removeStaleCopilotAgents(agents, copilotPollingTimers, waitingTimers, webview, persistAgents);
  }, COPILOT_SCAN_INTERVAL_MS);

  return () => {
    clearInterval(scanTimer);
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
