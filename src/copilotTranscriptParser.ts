/**
 * copilotTranscriptParser.ts
 *
 * Parses GitHub Copilot Chat session JSONL files written by the VS Code Copilot
 * Chat extension under:
 *   %APPDATA%\Code\User\workspaceStorage\<hash>\chatSessions\<session-id>.jsonl
 *
 * The format is a delta-patch log:
 *   kind 0 = initial state snapshot
 *   kind 1 = set value at key path
 *   kind 2 = append items to array at key path
 *
 * We watch for:
 *   - kind 2, k: ["requests", N, "response"] with toolInvocationSerialized items  → tool activity
 *   - kind 1, k: ["requests", N, "modelState"], v.value === 1                      → turn complete (waiting)
 *   - kind 2, k: ["requests"]                                                       → new request started
 */

import type * as vscode from 'vscode';

import { cancelWaitingTimer, startWaitingTimer } from './timerManager.js';
import type { AgentState } from './types.js';

// ── Tool ID → display status ────────────────────────────────────────────────

const TOOL_STATUS_MAP: Record<string, string> = {
  copilot_readFile: 'Reading file',
  copilot_listDirectory: 'Searching files',
  copilot_createFile: 'Creating file',
  copilot_editFile: 'Editing file',
  copilot_replaceString: 'Editing file',
  copilot_runInTerminal: 'Running command',
  copilot_searchCode: 'Searching code',
  copilot_semanticSearch: 'Searching code',
  copilot_grepSearch: 'Searching code',
  copilot_fileSearch: 'Searching files',
  copilot_getErrors: 'Checking errors',
  copilot_runTests: 'Running tests',
  copilot_renameSymbol: 'Renaming symbol',
  copilot_findReferences: 'Finding references',
  copilot_gotoDefinition: 'Reading definition',
  copilot_insertEditIntoFile: 'Editing file',
  copilot_applyPatch: 'Applying changes',
  copilot_deleteFile: 'Deleting file',
  copilot_moveFile: 'Moving file',
  copilot_installExtension: 'Installing extension',
  copilot_openFile: 'Opening file',
  copilot_newFile: 'Creating file',
  copilot_saveFile: 'Saving file',
};

/**
 * Extract a human-readable status from a tool ID and optional invocationMessage.
 * The invocationMessage in the raw JSONL is an object like { value: "Reading file.ts..." }.
 */
export function formatCopilotToolStatus(
  toolId: string,
  invocationMessage?: Record<string, unknown>,
): string {
  if (TOOL_STATUS_MAP[toolId]) {
    // Enrich with filename if available from invocationMessage.value
    const msgValue =
      typeof invocationMessage?.value === 'string' ? invocationMessage.value : undefined;
    if (msgValue) {
      // Extract the readable portion (strip markdown link syntax if present)
      const cleaned = msgValue
        .replace(/\[.*?\]\(.*?\)/g, (match) => {
          // Extract link text, fallback to URL basename
          const text = match.match(/\[(.*?)\]/)?.[1];
          return text ?? match;
        })
        .replace(/\s+/g, ' ')
        .trim();
      if (cleaned.length > 0 && cleaned.length <= 60) {
        return cleaned;
      }
    }
    return TOOL_STATUS_MAP[toolId];
  }

  // Generic readable fallback: "copilot_runInTerminal" → "Run In Terminal"
  const name = toolId.replace(/^copilot_/, '').replace(/([A-Z])/g, ' $1');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ── JSONL line parser ───────────────────────────────────────────────────────

export type CopilotLineResult =
  | { type: 'new_request'; requestIndex: number }
  | { type: 'tool_start'; toolId: string; toolCallId: string; status: string; requestIndex: number }
  | { type: 'tool_done'; toolId: string; toolCallId: string; status: string; requestIndex: number }
  | { type: 'turn_complete'; requestIndex: number }
  | { type: 'unknown' };

export function parseCopilotLine(line: string): CopilotLineResult {
  try {
    const record = JSON.parse(line) as Record<string, unknown>;
    const kind = record.kind as number | undefined;
    const k = record.k as unknown[] | undefined;
    const v = record.v;

    // ── kind 1: set value at key path ────────────────────────────────────
    if (kind === 1 && Array.isArray(k)) {
      // ["requests", N, "modelState"] with value === 1 → turn complete
      if (k.length === 3 && k[0] === 'requests' && k[2] === 'modelState') {
        const modelState = v as Record<string, unknown> | undefined;
        if (modelState?.value === 1) {
          return { type: 'turn_complete', requestIndex: k[1] as number };
        }
      }
    }

    // ── kind 2: append items to array ────────────────────────────────────
    if (kind === 2 && Array.isArray(k) && Array.isArray(v)) {
      // ["requests"] — a new conversation request was added
      if (k.length === 1 && k[0] === 'requests') {
        // The first item in v has the requestId at v[0].requestId (check positively)
        const requestIndex = 0; // new request is always appended; exact index not critical here
        return { type: 'new_request', requestIndex };
      }

      // ["requests", N, "response"] — response items (may contain tool calls)
      if (k.length === 3 && k[0] === 'requests' && k[2] === 'response') {
        const requestIndex = k[1] as number;
        const items = v as Record<string, unknown>[];

        for (const item of items) {
          if (item?.kind === 'toolInvocationSerialized') {
            const toolId = item.toolId as string | undefined;
            const toolCallId = (item.toolCallId as string | undefined) ?? '';
            const isComplete = item.isComplete === true;
            const invocationMessage = item.invocationMessage as Record<string, unknown> | undefined;

            if (toolId) {
              const status = formatCopilotToolStatus(toolId, invocationMessage);
              return {
                type: isComplete ? 'tool_done' : 'tool_start',
                toolId,
                toolCallId,
                status,
                requestIndex,
              };
            }
          }
        }
      }
    }

    return { type: 'unknown' };
  } catch {
    return { type: 'unknown' };
  }
}

// ── Line processor (drives AgentState and webview messages) ────────────────

/**
 * Fallback delay before marking a Copilot agent as "waiting" when no tool records arrive.
 * This only fires if turn_complete never arrives (e.g. extension reload mid-session).
 * Copilot's "Evaluating" phase (model thinking between/after tools) writes nothing to JSONL,
 * so the timer must be long enough to cover the full evaluation window — not just tool gaps.
 */
const COPILOT_IDLE_WAIT_MS = 60_000;

/**
 * Process one new JSONL line from a Copilot Chat session file.
 * Updates the AgentState and posts messages to the webview.
 */
export function processCopilotLine(
  agentId: number,
  line: string,
  agents: Map<number, AgentState>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  webview: vscode.Webview | undefined,
): void {
  const agent = agents.get(agentId);
  if (!agent) return;

  agent.lastDataAt = Date.now();
  agent.linesProcessed++;

  const result = parseCopilotLine(line);

  switch (result.type) {
    case 'new_request': {
      // A new user message was sent — agent is now active
      cancelWaitingTimer(agentId, waitingTimers);
      agent.isWaiting = false;
      agent.hadToolsInTurn = false;
      webview?.postMessage({ type: 'agentStatus', id: agentId, status: 'active' });
      break;
    }

    case 'tool_start': {
      cancelWaitingTimer(agentId, waitingTimers);
      agent.isWaiting = false;
      agent.hadToolsInTurn = true;
      agent.activeToolIds.add(result.toolCallId);
      agent.activeToolStatuses.set(result.toolCallId, result.status);
      agent.activeToolNames.set(result.toolCallId, result.toolId);

      webview?.postMessage({ type: 'agentStatus', id: agentId, status: 'active' });
      webview?.postMessage({
        type: 'agentToolStart',
        id: agentId,
        toolId: result.toolCallId,
        status: result.status,
        toolName: result.toolId,
        permissionActive: false,
      });
      break;
    }

    case 'tool_done': {
      // Copilot flushes completed tool records — mark active then schedule clear
      cancelWaitingTimer(agentId, waitingTimers);
      agent.isWaiting = false;
      agent.hadToolsInTurn = true;

      const callId = result.toolCallId;

      // Ensure a tool_start is visible in the webview before marking done
      agent.activeToolIds.add(callId);
      agent.activeToolStatuses.set(callId, result.status);
      agent.activeToolNames.set(callId, result.toolId);

      webview?.postMessage({ type: 'agentStatus', id: agentId, status: 'active' });
      webview?.postMessage({
        type: 'agentToolStart',
        id: agentId,
        toolId: callId,
        status: result.status,
        toolName: result.toolId,
        permissionActive: false,
      });

      // Brief delay so the tool is visible before it disappears
      setTimeout(() => {
        agent.activeToolIds.delete(callId);
        agent.activeToolStatuses.delete(callId);
        agent.activeToolNames.delete(callId);
        webview?.postMessage({ type: 'agentToolDone', id: agentId, toolId: callId });
      }, 300);

      // Keep agent active through the "Evaluating" gap between tools.
      // turn_complete is the authoritative idle signal; this long fallback only fires
      // if turn_complete never arrives (e.g. extension reload mid-session).
      startWaitingTimer(agentId, COPILOT_IDLE_WAIT_MS, agents, waitingTimers, webview);
      break;
    }

    case 'turn_complete': {
      // Authoritative: the model finished its turn, waiting for the user
      agent.activeToolIds.clear();
      agent.activeToolStatuses.clear();
      agent.activeToolNames.clear();
      agent.isWaiting = true;
      agent.hadToolsInTurn = false;

      cancelWaitingTimer(agentId, waitingTimers);
      webview?.postMessage({ type: 'agentToolsClear', id: agentId });
      webview?.postMessage({ type: 'agentStatus', id: agentId, status: 'waiting' });
      break;
    }

    default:
      break;
  }
}
