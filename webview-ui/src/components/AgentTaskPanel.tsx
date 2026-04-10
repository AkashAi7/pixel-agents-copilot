import { useEffect, useState } from 'react';

import type { SubagentCharacter } from '../hooks/useExtensionMessages.js';
import type { ToolActivity } from '../office/types.js';
import { Button } from './ui/Button.js';

interface AgentTaskPanelProps {
  agentId: number | null;
  agentTools: Record<number, ToolActivity[]>;
  agentStatuses: Record<number, string>;
  subagentCharacters: SubagentCharacter[];
  subagentTools: Record<number, Record<string, ToolActivity[]>>;
  onClose: () => void;
  onCloseAgent: (id: number) => void;
}

function StatusDot({ status, isActive }: { status: string; isActive: boolean }) {
  if (status === 'waiting') {
    return (
      <span
        className="w-8 h-8 rounded-full shrink-0 inline-block"
        style={{ background: 'var(--color-status-permission)' }}
        title="Waiting"
      />
    );
  }
  if (isActive) {
    return (
      <span
        className="w-8 h-8 rounded-full shrink-0 inline-block pixel-pulse"
        style={{ background: 'var(--color-status-active)' }}
        title="Active"
      />
    );
  }
  return (
    <span
      className="w-8 h-8 rounded-full shrink-0 inline-block"
      style={{ background: 'var(--color-border)' }}
      title="Idle"
    />
  );
}

function ToolRow({ tool }: { tool: ToolActivity }) {
  const isPending = !tool.done;
  const isPermission = tool.permissionWait && !tool.done;
  const dotColor = isPermission
    ? 'var(--color-status-permission)'
    : isPending
      ? 'var(--color-status-active)'
      : 'var(--color-status-success)';

  return (
    <div
      className="flex items-start gap-6 py-4 px-8"
      style={{ opacity: tool.done ? 0.55 : 1, borderBottom: '1px solid var(--color-border)' }}
    >
      <span
        className={`w-6 h-6 rounded-full shrink-0 mt-3 ${isPending && !isPermission ? 'pixel-pulse' : ''}`}
        style={{ background: dotColor }}
      />
      <div className="flex flex-col gap-1 overflow-hidden">
        <span
          className="text-sm leading-snug overflow-hidden text-ellipsis"
          style={{ color: tool.done ? 'var(--color-text-muted)' : 'var(--color-text)' }}
        >
          {isPermission ? '⚠ Needs approval' : tool.status}
        </span>
        {tool.done && (
          <span className="text-2xs" style={{ color: 'var(--color-status-success)' }}>
            Done
          </span>
        )}
      </div>
    </div>
  );
}

function HandoffRow({
  sub,
  subagentTools,
}: {
  sub: SubagentCharacter;
  subagentTools: Record<number, Record<string, ToolActivity[]>>;
}) {
  // Find tools for this sub-agent by its parentToolId
  const parentTools = subagentTools[sub.parentAgentId];
  const tools: ToolActivity[] = parentTools?.[sub.parentToolId] ?? [];
  const activeTool = tools.find((t) => !t.done);
  const label = sub.label || `Sub-agent #${sub.id}`;

  return (
    <div
      className="ml-14 pl-8 py-4"
      style={{ borderLeft: '2px solid var(--color-accent)', borderBottom: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-5 mb-2">
        <span className="text-2xs" style={{ color: 'var(--color-accent)' }}>
          ↳ handoff
        </span>
        <span className="text-xs font-bold overflow-hidden text-ellipsis">{label}</span>
        {activeTool && (
          <span
            className="w-5 h-5 rounded-full pixel-pulse shrink-0"
            style={{ background: 'var(--color-status-active)' }}
          />
        )}
      </div>
      {activeTool && (
        <span className="text-2xs" style={{ color: 'var(--color-text-muted)' }}>
          {activeTool.status}
        </span>
      )}
    </div>
  );
}

/** Tick every second so relative timestamps stay current */
function useTickEverySecond() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
}

export function AgentTaskPanel({
  agentId,
  agentTools,
  agentStatuses,
  subagentCharacters,
  subagentTools,
  onClose,
  onCloseAgent,
}: AgentTaskPanelProps) {
  useTickEverySecond();

  if (agentId === null) return null;

  const tools = agentTools[agentId] ?? [];
  const status = agentStatuses[agentId];
  const isWaiting = status === 'waiting';
  const isActive = !isWaiting && tools.some((t) => !t.done);
  const mySubagents = subagentCharacters.filter((s) => s.parentAgentId === agentId);

  // Build interleaved list: show tool, then sub-agents spawned by that tool
  const rows: Array<{ kind: 'tool'; tool: ToolActivity } | { kind: 'handoff'; sub: SubagentCharacter }> = [];
  for (const tool of tools) {
    rows.push({ kind: 'tool', tool });
    // Insert handoffs spawned by this tool right after the tool row
    for (const sub of mySubagents) {
      if (sub.parentToolId === tool.toolId) {
        rows.push({ kind: 'handoff', sub });
      }
    }
  }

  const statusLabel = isWaiting ? 'Waiting' : isActive ? 'Working' : 'Idle';

  return (
    <div
      className="absolute right-0 top-0 bottom-0 flex flex-col font-pixel"
      style={{
        width: '280px',
        background: 'var(--color-bg-dark)',
        borderLeft: '2px solid var(--color-border)',
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-12 py-8 shrink-0"
        style={{ borderBottom: '2px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-8">
          <StatusDot status={status} isActive={isActive} />
          <div className="flex flex-col gap-1">
            <span className="text-base leading-none">Agent #{agentId}</span>
            <span className="text-2xs" style={{ color: 'var(--color-text-muted)' }}>
              {statusLabel}
              {mySubagents.length > 0 && ` · ${mySubagents.length} sub-agent${mySubagents.length > 1 ? 's' : ''}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCloseAgent(agentId)}
            title="Close agent"
          >
            ✕ Close
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} title="Hide panel">
            ›
          </Button>
        </div>
      </div>

      {/* Real-time tool feed */}
      <div className="flex-1 overflow-y-auto" style={{ overflowX: 'hidden' }}>
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              No activity yet
            </span>
          </div>
        ) : (
          <div className="flex flex-col">
            {rows.map((row, i) =>
              row.kind === 'tool' ? (
                <ToolRow key={`tool-${row.tool.toolId}-${i}`} tool={row.tool} />
              ) : (
                <HandoffRow
                  key={`handoff-${row.sub.id}`}
                  sub={row.sub}
                  subagentTools={subagentTools}
                />
              ),
            )}
          </div>
        )}
      </div>

      {/* Footer: sub-agent summary if any active */}
      {mySubagents.length > 0 && (
        <div
          className="px-12 py-6 shrink-0 text-2xs"
          style={{
            borderTop: '2px solid var(--color-border)',
            color: 'var(--color-accent)',
          }}
        >
          {mySubagents.length} agent{mySubagents.length > 1 ? 's' : ''} working in parallel
        </div>
      )}
    </div>
  );
}
