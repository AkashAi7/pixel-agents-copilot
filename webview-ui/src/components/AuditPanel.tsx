import { useCallback, useEffect, useRef } from 'react';

import {
  AUDIT_COLOR_AGENT_CREATED,
  AUDIT_COLOR_MESSAGE,
  AUDIT_COLOR_SUBAGENT,
} from '../constants.js';
import type { AuditEntry, TeamRoom } from '../hooks/useExtensionMessages.js';
import { vscode } from '../vscodeApi.js';
import { Button } from './ui/Button.js';

const EVENT_ICONS: Record<string, string> = {
  tool_start: '▶',
  tool_done: '✓',
  agent_created: '⊕',
  agent_removed: '⊖',
  message: '💬',
  subagent_spawn: '⬡',
};

const EVENT_COLORS: Record<string, string> = {
  tool_start: 'var(--color-status-active)',
  tool_done: 'var(--color-status-success)',
  agent_created: AUDIT_COLOR_AGENT_CREATED,
  agent_removed: 'var(--color-text-muted)',
  message: AUDIT_COLOR_MESSAGE,
  subagent_spawn: AUDIT_COLOR_SUBAGENT,
};

const AGENT_TYPE_LABELS: Record<string, string> = {
  'claude-cli': 'Claude',
  'copilot-chat': 'Copilot',
  'local-cli': 'CLI',
  'custom': 'Custom',
};

interface AuditPanelProps {
  room: TeamRoom | null;
  entries: AuditEntry[];
  onClose: () => void;
  onClear: () => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function AuditPanel({ room, entries, onClose, onClear }: AuditPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  const handleClear = useCallback(() => {
    if (room) {
      vscode.postMessage({ type: 'clearRoomAudit', roomId: room.id });
      onClear();
    }
  }, [room, onClear]);

  return (
    <div
      className="absolute right-0 top-0 bottom-0 z-20 flex flex-col"
      style={{
        width: 280,
        background: 'var(--color-panel)',
        borderLeft: '1px solid var(--color-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-10 py-8"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-6">
          {room && (
            <span
              className="w-8 h-8 rounded-full shrink-0"
              style={{ background: room.color }}
            />
          )}
          <div className="flex flex-col">
            <span className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
              {room ? `${room.icon} ${room.name}` : 'All Teams'} — Audit
            </span>
            <span className="text-2xs" style={{ color: 'var(--color-text-muted)' }}>
              {entries.length} event{entries.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="default" onClick={handleClear} className="text-2xs">
            Clear
          </Button>
          <button
            onClick={onClose}
            className="text-sm"
            style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full gap-8 px-16"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span style={{ fontSize: 28 }}>📋</span>
            <span className="text-xs text-center">
              No activity recorded yet. Agent actions will appear here in real time.
            </span>
          </div>
        ) : (
          entries.map((entry) => (
            <AuditRow key={entry.id} entry={entry} />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const icon = EVENT_ICONS[entry.event] ?? '•';
  const color = EVENT_COLORS[entry.event] ?? 'var(--color-text-muted)';
  const typeLabel = AGENT_TYPE_LABELS[entry.agentType] ?? entry.agentType;

  return (
    <div
      className="flex items-start gap-6 px-10 py-5"
      style={{ borderBottom: '1px solid var(--color-border)' }}
    >
      <span
        className="shrink-0 text-xs mt-1 w-12 text-center"
        style={{ color }}
      >
        {icon}
      </span>
      <div className="flex-1 flex flex-col gap-1 overflow-hidden">
        <div className="flex items-center justify-between gap-4">
          <span
            className="text-2xs px-4 rounded"
            style={{ background: 'var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            {typeLabel} #{entry.agentId}
          </span>
          <span className="text-2xs" style={{ color: 'var(--color-text-muted)' }}>
            {formatTime(entry.timestamp)}
          </span>
        </div>
        <span
          className="text-xs leading-snug overflow-hidden text-ellipsis"
          style={{ color: 'var(--color-text)' }}
          title={entry.detail}
        >
          {entry.detail}
        </span>
      </div>
    </div>
  );
}
