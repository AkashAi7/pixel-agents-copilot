import { useCallback, useState } from 'react';

import { vscode } from '../vscodeApi.js';

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  labels: Array<{ name: string }>;
  createdAt: string;
  url: string;
  state: string;
  assignees: Array<{ login: string }>;
}

export interface RalphStatus {
  running: boolean;
  uptime?: number;
  lastPoll?: number;
  nextPoll?: number;
  round: number;
  intervalMs: number;
  lastError?: string;
}

export interface SquadState {
  decisions: string;
  agentNames: Record<number, string>;
  squadDir: string;
  isInitialised: boolean;
}

export interface TeamRoom {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  isBuiltIn: boolean;
}

interface SquadPanelProps {
  squadState: SquadState | null;
  ralphIssues: GitHubIssue[];
  ralphStatus: RalphStatus | null;
  rooms: TeamRoom[];
  onClose: () => void;
}

type TabId = 'team' | 'decisions' | 'ralph';

export function SquadPanel({ squadState, ralphIssues, ralphStatus, rooms, onClose }: SquadPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('team');
  const [intervalInput, setIntervalInput] = useState('');
  const [dispatchTarget, setDispatchTarget] = useState<Record<number, string>>({});

  const handleSquadInit = useCallback(() => {
    vscode.postMessage({ type: 'squadInit' });
  }, []);

  const handleNap = useCallback((deep: boolean) => {
    vscode.postMessage({ type: 'squadNap', deep });
  }, []);

  const handleRalphStart = useCallback(() => {
    vscode.postMessage({ type: 'ralphStart' });
  }, []);

  const handleRalphStop = useCallback(() => {
    vscode.postMessage({ type: 'ralphStop' });
  }, []);

  const handleRalphPollNow = useCallback(() => {
    vscode.postMessage({ type: 'ralphPollNow' });
  }, []);

  const handleSetInterval = useCallback(() => {
    const n = parseInt(intervalInput, 10);
    if (!isNaN(n) && n > 0) {
      vscode.postMessage({ type: 'ralphSetInterval', minutes: n });
      setIntervalInput('');
    }
  }, [intervalInput]);

  const handleDispatch = useCallback((issue: GitHubIssue) => {
    const roomId = dispatchTarget[issue.number] ?? rooms[0]?.id;
    if (!roomId) return;
    vscode.postMessage({ type: 'dispatchIssueToRoom', issue, roomId });
  }, [dispatchTarget, rooms]);

  // formatMs / formatDate / formatRelative are defined at module scope (below)

  const tabStyle = (t: TabId): React.CSSProperties => ({
    padding: '6px 14px',
    cursor: 'pointer',
    color: activeTab === t ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)',
    background: 'none',
    border: 'none',
    borderBottom: activeTab === t ? '2px solid var(--vscode-focusBorder)' : '2px solid transparent',
    fontSize: '12px',
    fontFamily: '"FS Pixel Sans", monospace',
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: 40,
        right: 0,
        width: 340,
        maxHeight: 'calc(100vh - 80px)',
        background: 'var(--vscode-sideBar-background)',
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: 6,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        overflow: 'hidden',
        boxShadow: 'var(--pixel-shadow)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid var(--vscode-panel-border)',
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>⚡ Squad</span>
        {!squadState?.isInitialised && (
          <button
            onClick={handleSquadInit}
            style={{
              padding: '3px 10px',
              fontSize: 11,
              cursor: 'pointer',
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
              borderRadius: 3,
            }}
          >
            Init
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--vscode-foreground)',
            fontSize: 16,
            lineHeight: 1,
            padding: '0 2px',
          }}
          title="Close Squad panel"
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--vscode-panel-border)' }}>
        <button style={tabStyle('team')} onClick={() => setActiveTab('team')}>Team</button>
        <button style={tabStyle('decisions')} onClick={() => setActiveTab('decisions')}>Decisions</button>
        <button style={tabStyle('ralph')} onClick={() => setActiveTab('ralph')}>
          Ralph {ralphStatus?.running ? '🟢' : '⚫'}
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {/* ── Team tab ── */}
        {activeTab === 'team' && (
          <div>
            {!squadState?.isInitialised ? (
              <p style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12 }}>
                Squad not initialised. Click <strong>Init</strong> above to scaffold the <code>.squad/</code> folder.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginBottom: 8 }}>
                  Squad folder: <code>{squadState.squadDir}</code>
                </p>
                {Object.keys(squadState.agentNames).length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)' }}>
                    No agents running. Spawn an agent to assign it a name.
                  </p>
                ) : (
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: 'var(--vscode-descriptionForeground)' }}>
                        <th style={{ textAlign: 'left', padding: '3px 6px' }}>ID</th>
                        <th style={{ textAlign: 'left', padding: '3px 6px' }}>Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(squadState.agentNames).map(([id, name]) => (
                        <tr key={id} style={{ borderTop: '1px solid var(--vscode-panel-border)' }}>
                          <td style={{ padding: '4px 6px', color: 'var(--vscode-descriptionForeground)' }}>
                            {id}
                          </td>
                          <td style={{ padding: '4px 6px', fontWeight: 500 }}>{name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Decisions tab ── */}
        {activeTab === 'decisions' && (
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <button
                onClick={() => handleNap(false)}
                title="Archive old decisions, keep last 25"
                style={btnStyle}
              >
                Nap
              </button>
              <button
                onClick={() => handleNap(true)}
                title="Deep nap: keep only last 10 decisions"
                style={btnStyle}
              >
                Deep Nap
              </button>
            </div>
            {!squadState?.decisions ? (
              <p style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)' }}>
                No decisions logged yet.
              </p>
            ) : (
              <pre
                style={{
                  fontSize: 11,
                  whiteSpace: 'pre-wrap',
                  color: 'var(--vscode-foreground)',
                  background: 'var(--vscode-editor-background)',
                  padding: 8,
                  borderRadius: 4,
                  border: '1px solid var(--vscode-panel-border)',
                  maxHeight: 380,
                  overflow: 'auto',
                }}
              >
                {squadState.decisions}
              </pre>
            )}
          </div>
        )}

        {/* ── Ralph tab ── */}
        {activeTab === 'ralph' && (
          <div>
            {/* Status bar */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                <button onClick={handleRalphStart} disabled={ralphStatus?.running} style={btnStyle}>
                  Start
                </button>
                <button onClick={handleRalphStop} disabled={!ralphStatus?.running} style={btnStyle}>
                  Stop
                </button>
                <button onClick={handleRalphPollNow} style={btnStyle}>
                  Poll Now
                </button>
              </div>
              {ralphStatus && (
                <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', lineHeight: 1.6 }}>
                  <div>Status: <strong>{ralphStatus.running ? 'Running' : 'Stopped'}</strong></div>
                  <div>Interval: <strong>{formatMs(ralphStatus.intervalMs)}</strong></div>
                  <div>Round: <strong>{ralphStatus.round}</strong></div>
                  {ralphStatus.lastPoll && <div>Last poll: {formatRelative(ralphStatus.lastPoll)}</div>}
                  {ralphStatus.lastError && (
                    <div style={{ color: 'var(--vscode-errorForeground)' }}>
                      Error: {ralphStatus.lastError}
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: 4, marginTop: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  min={1}
                  value={intervalInput}
                  onChange={(e) => setIntervalInput(e.target.value)}
                  placeholder="Interval (min)"
                  style={{
                    width: 100,
                    padding: '3px 6px',
                    fontSize: 11,
                    background: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: 3,
                  }}
                />
                <button onClick={handleSetInterval} style={btnStyle}>Set</button>
              </div>
            </div>

            <hr style={{ borderColor: 'var(--vscode-panel-border)', margin: '8px 0' }} />

            {/* Issues list */}
            {ralphIssues.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)' }}>
                No open issues found. Start Ralph and poll to fetch issues.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ralphIssues.map((issue) => (
                  <div
                    key={issue.number}
                    style={{
                      background: 'var(--vscode-editor-background)',
                      border: '1px solid var(--vscode-panel-border)',
                      borderRadius: 4,
                      padding: 8,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>
                        <a
                          onClick={() => vscode.postMessage({ type: 'openIssueUrl', url: issue.url })}
                          style={{ cursor: 'pointer', color: 'var(--vscode-textLink-foreground)' }}
                          title={issue.url}
                        >
                          #{issue.number}
                        </a>{' '}
                        {issue.title}
                      </span>
                      <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 11, whiteSpace: 'nowrap', marginLeft: 8 }}>
                        {formatDate(issue.createdAt)}
                      </span>
                    </div>
                    {issue.labels.length > 0 && (
                      <div style={{ marginBottom: 4, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {issue.labels.map((l) => (
                          <span
                            key={l.name}
                            style={{
                              fontSize: 10,
                              padding: '1px 5px',
                              borderRadius: 8,
                              background: 'var(--vscode-badge-background)',
                              color: 'var(--vscode-badge-foreground)',
                            }}
                          >
                            {l.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                      <select
                        value={dispatchTarget[issue.number] ?? rooms[0]?.id ?? ''}
                        onChange={(e) => setDispatchTarget((prev) => ({ ...prev, [issue.number]: e.target.value }))}
                        style={{
                          flex: 1,
                          fontSize: 11,
                          padding: '2px 4px',
                          background: 'var(--vscode-dropdown-background)',
                          color: 'var(--vscode-dropdown-foreground)',
                          border: '1px solid var(--vscode-dropdown-border)',
                          borderRadius: 3,
                        }}
                      >
                        {rooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.icon} {r.name}
                          </option>
                        ))}
                      </select>
                      <button onClick={() => handleDispatch(issue)} style={btnStyle}>
                        Dispatch
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '3px 10px',
  fontSize: 11,
  cursor: 'pointer',
  background: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  border: '1px solid var(--vscode-button-border, transparent)',
  borderRadius: 3,
  fontFamily: '"FS Pixel Sans", monospace',
};

function formatMs(ms: number): string {
  return `${Math.round(ms / 60000)}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatRelative(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  return `${Math.round(diff / 3600000)}h ago`;
}
