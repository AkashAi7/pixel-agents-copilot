import { useCallback, useState } from 'react';

import type { TeamRoom } from '../hooks/useExtensionMessages.js';
import { vscode } from '../vscodeApi.js';
import { Button } from './ui/Button.js';
import { Modal } from './ui/Modal.js';

type AgentLaunchTarget = 'copilot' | 'claude' | 'custom';

interface CreateAgentModalProps {
  rooms: TeamRoom[];
  onClose: () => void;
  selectedRoomId: string | null;
}

const LAUNCH_OPTIONS: { value: AgentLaunchTarget; label: string; description: string; icon: string }[] = [
  {
    value: 'copilot',
    label: 'GitHub Copilot Chat',
    description: 'Opens Copilot Chat in agent mode. Activity auto-detected.',
    icon: '🐙',
  },
  {
    value: 'claude',
    label: 'Claude Code (CLI)',
    description: 'Spawns a new Claude Code terminal session.',
    icon: '🤖',
  },
  {
    value: 'custom',
    label: 'Custom Agent',
    description: 'Run any CLI command as a trackable agent.',
    icon: '⚡',
  },
];

export function CreateAgentModal({ rooms, onClose, selectedRoomId }: CreateAgentModalProps) {
  const [launchTarget, setLaunchTarget] = useState<AgentLaunchTarget>('copilot');
  const [roomId, setRoomId] = useState(selectedRoomId ?? 'general');
  const [agentName, setAgentName] = useState('');
  const [command, setCommand] = useState('');
  const [initialTask, setInitialTask] = useState('');

  const handleLaunch = useCallback(() => {
    if (launchTarget === 'copilot') {
      vscode.postMessage({
        type: 'openClaude', // existing message — opens Copilot Chat
        initialTask: initialTask.trim() || undefined,
        suggestedRoomId: roomId,
      });
    } else if (launchTarget === 'claude') {
      vscode.postMessage({
        type: 'spawnAgent',
        initialTask: initialTask.trim() || undefined,
        roomId,
      });
    } else if (launchTarget === 'custom') {
      if (!agentName.trim() || !command.trim()) return;
      vscode.postMessage({
        type: 'createCustomAgent',
        name: agentName.trim(),
        roomId,
        command: command.trim(),
        description: initialTask.trim() || undefined,
      });
      // Also launch it immediately
      // The extension will auto-launch after creation if launchNow is set
      vscode.postMessage({
        type: 'launchAndCreateCustomAgent',
        name: agentName.trim(),
        roomId,
        command: command.trim(),
      });
    }
    onClose();
  }, [launchTarget, roomId, agentName, command, initialTask, onClose]);

  const isValid =
    launchTarget !== 'custom' ||
    (agentName.trim().length > 0 && command.trim().length > 0);

  return (
    <Modal isOpen onClose={onClose} title="Spawn Agent">
      <div
        className="flex flex-col gap-12 p-16"
        style={{ minWidth: 320, maxWidth: 480 }}
      >
        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
          Spawn Agent
        </h2>

        {/* Agent type */}
        <div className="flex flex-col gap-6">
          <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Agent Type
          </label>
          <div className="flex flex-col gap-6">
            {LAUNCH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className="flex items-start gap-8 p-8 rounded text-left"
                onClick={() => setLaunchTarget(opt.value)}
                style={{
                  background: launchTarget === opt.value ? 'var(--color-border)' : 'transparent',
                  border: `1px solid ${launchTarget === opt.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1, marginTop: 2 }}>{opt.icon}</span>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                    {opt.label}
                  </span>
                  <span className="text-2xs" style={{ color: 'var(--color-text-muted)' }}>
                    {opt.description}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Team room */}
        <div className="flex flex-col gap-6">
          <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Team Room
          </label>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            style={{
              background: 'var(--color-panel)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 2,
              padding: '4px 8px',
              fontSize: 12,
            }}
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.icon} {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Custom agent fields */}
        {launchTarget === 'custom' && (
          <>
            <div className="flex flex-col gap-4">
              <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Agent Name
              </label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="e.g. Data Pipeline Runner"
                style={{
                  background: 'var(--color-panel)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 2,
                  padding: '4px 8px',
                  fontSize: 12,
                }}
              />
            </div>
            <div className="flex flex-col gap-4">
              <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Command
              </label>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="e.g. python scripts/pipeline.py"
                style={{
                  background: 'var(--color-panel)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 2,
                  padding: '4px 8px',
                  fontSize: 12,
                }}
              />
            </div>
          </>
        )}

        {/* Initial task */}
        {launchTarget !== 'custom' && (
          <div className="flex flex-col gap-4">
            <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Initial Task (optional)
            </label>
            <textarea
              value={initialTask}
              onChange={(e) => setInitialTask(e.target.value)}
              placeholder="Describe what this agent should do..."
              rows={3}
              style={{
                background: 'var(--color-panel)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 2,
                padding: '4px 8px',
                fontSize: 12,
                resize: 'vertical',
                minHeight: 56,
              }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-8">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={handleLaunch} disabled={!isValid}>
            Launch Agent
          </Button>
        </div>
      </div>
    </Modal>
  );
}
