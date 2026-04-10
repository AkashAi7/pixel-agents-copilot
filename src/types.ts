import type * as vscode from 'vscode';

export type AgentType = 'claude-cli' | 'copilot-chat' | 'local-cli' | 'custom';

export interface AgentState {
  id: number;
  sessionId: string;
  /** Terminal reference — undefined for extension panel sessions */
  terminalRef?: vscode.Terminal;
  /** Whether this agent was detected from an external source (VS Code extension panel, etc.) */
  isExternal: boolean;
  /** Which agent runtime produced this session's JSONL file */
  agentSource?: 'claude' | 'copilot';
  /** Orchestrator agent type classification */
  agentType?: AgentType;
  /** Team room this agent is assigned to */
  roomId?: string;
  projectDir: string;
  jsonlFile: string;
  fileOffset: number;
  lineBuffer: string;
  activeToolIds: Set<string>;
  activeToolStatuses: Map<string, string>;
  activeToolNames: Map<string, string>;
  activeSubagentToolIds: Map<string, Set<string>>; // parentToolId → active sub-tool IDs
  activeSubagentToolNames: Map<string, Map<string, string>>; // parentToolId → (subToolId → toolName)
  backgroundAgentToolIds: Set<string>; // tool IDs for run_in_background Agent calls (stay alive until queue-operation)
  isWaiting: boolean;
  permissionSent: boolean;
  hadToolsInTurn: boolean;
  /** Workspace folder name (only set for multi-root workspaces) */
  folderName?: string;
  /** Timestamp of last JSONL data received (ms since epoch) */
  lastDataAt: number;
  /** Total JSONL lines processed for this agent */
  linesProcessed: number;
  /** Set of record.type values we've already warned about (prevents log spam) */
  seenUnknownRecordTypes: Set<string>;
  /** Whether a hook event has been delivered for this agent (suppresses heuristic timers) */
  hookDelivered: boolean;
}

export interface PersistedAgent {
  id: number;
  sessionId?: string;
  /** Terminal name — empty string for extension panel sessions */
  terminalName: string;
  /** Whether this agent was detected from an external source */
  isExternal?: boolean;
  /** Which agent runtime produced this session's JSONL file */
  agentSource?: 'claude' | 'copilot';
  /** Orchestrator agent type */
  agentType?: AgentType;
  /** Team room assignment */
  roomId?: string;
  jsonlFile: string;
  projectDir: string;
  /** Workspace folder name (only set for multi-root workspaces) */
  folderName?: string;
}

// ── Orchestrator Types ──────────────────────────────────────────────────────

export interface TeamRoom {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
  isBuiltIn: boolean;
  createdAt?: number;
}

export interface AuditEntry {
  id: string;
  timestamp: number;
  roomId: string;
  agentId: number;
  agentType: AgentType;
  agentLabel: string;
  event: 'tool_start' | 'tool_done' | 'agent_created' | 'agent_removed' | 'message' | 'subagent_spawn';
  detail: string;
}

export interface CustomAgentConfig {
  id: string;
  name: string;
  roomId: string;
  command: string;
  args?: string[];
  color?: string;
  description?: string;
  createdAt: number;
}

// ── Squad Types ──────────────────────────────────────────────────────────────

/** GitHub Issue as returned by `gh issue list --json`. */
export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  labels: string[];
  createdAt: string;
  url: string;
  state: string;
  assignees: string[];
}

/** Status of the Ralph watch loop. */
export interface RalphStatus {
  running: boolean;
  uptime?: number;
  lastPoll?: number;
  nextPoll?: number;
  round: number;
  intervalMs: number;
  lastError?: string;
}
