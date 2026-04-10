// ── User-Level Layout Persistence ─────────────────────────────
export const LAYOUT_FILE_DIR = '.pixel-agents';
export const LAYOUT_FILE_NAME = 'layout.json';
export const CONFIG_FILE_NAME = 'config.json';
export const LAYOUT_FILE_POLL_INTERVAL_MS = 2000;
export const LAYOUT_REVISION_KEY = 'layoutRevision';

// ── Settings Persistence (VS Code globalState keys) ─────────
export const GLOBAL_KEY_SOUND_ENABLED = 'pixel-agents.soundEnabled';
export const GLOBAL_KEY_LAST_SEEN_VERSION = 'pixel-agents.lastSeenVersion';
export const GLOBAL_KEY_ALWAYS_SHOW_LABELS = 'pixel-agents.alwaysShowLabels';
export const GLOBAL_KEY_WATCH_ALL_SESSIONS = 'pixel-agents.watchAllSessions';
export const GLOBAL_KEY_HOOKS_ENABLED = 'pixel-agents.hooksEnabled';
export const GLOBAL_KEY_HOOKS_INFO_SHOWN = 'pixel-agents.hooksInfoShown';
export const GLOBAL_KEY_CUSTOM_AGENTS = 'pixel-agents.customAgents';
export const GLOBAL_KEY_CUSTOM_ROOMS = 'pixel-agents.customRooms';

// ── VS Code Identifiers ─────────────────────────────────────
export const VIEW_ID = 'pixel-agents.panelView';
export const COMMAND_SHOW_PANEL = 'pixel-agents.showPanel';
export const COMMAND_EXPORT_DEFAULT_LAYOUT = 'pixel-agents.exportDefaultLayout';
export const WORKSPACE_KEY_AGENTS = 'pixel-agents.agents';
export const WORKSPACE_KEY_AGENT_SEATS = 'pixel-agents.agentSeats';
export const WORKSPACE_KEY_LAYOUT = 'pixel-agents.layout';
export const WORKSPACE_KEY_AUDIT_LOG = 'pixel-agents.auditLog';
export const TERMINAL_NAME_PREFIX = 'Claude Code';

// ── Orchestrator ────────────────────────────────────────────
export const AUDIT_MAX_ENTRIES_PER_ROOM = 200;
export const ACTIVITY_FEED_MAX_EVENTS = 100;
export const DEFAULT_ROOM_COLOR = '#90A4AE';
export const ROOM_COLOR_FRONTEND = '#4FC3F7';
export const ROOM_COLOR_BACKEND = '#81C784';
export const ROOM_COLOR_DATA = '#FFB74D';
export const ROOM_COLOR_SRE = '#F06292';
export const ROOM_COLOR_QA = '#CE93D8';
export const ROOM_COLOR_GENERAL = '#90A4AE';
