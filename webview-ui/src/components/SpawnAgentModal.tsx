import { useEffect, useRef, useState } from 'react';

import type { WorkspaceFolder } from '../hooks/useExtensionMessages.js';
import { vscode } from '../vscodeApi.js';
import { Button } from './ui/Button.js';

interface SpawnAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceFolders: WorkspaceFolder[];
}

export function SpawnAgentModal({ isOpen, onClose, workspaceFolders }: SpawnAgentModalProps) {
  const [task, setTask] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<WorkspaceFolder | null>(null);
  const [bypassPermissions, setBypassPermissions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset and focus on open
  useEffect(() => {
    if (isOpen) {
      setTask('');
      setBypassPermissions(false);
      setSelectedFolder(workspaceFolders.length === 1 ? workspaceFolders[0] : null);
      // Focus textarea on next frame
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [isOpen, workspaceFolders]);

  if (!isOpen) return null;

  const hasMultipleFolders = workspaceFolders.length > 1;

  const handleLaunch = () => {
    const folderPath = selectedFolder?.path ?? workspaceFolders[0]?.path;
    vscode.postMessage({
      type: 'openClaude',
      folderPath,
      bypassPermissions,
      initialTask: task.trim() || undefined,
    });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleLaunch();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    /* Backdrop */
    <div
      className="absolute inset-0 flex items-center justify-center bg-black/65"
      style={{ zIndex: 60 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex flex-col pixel-panel font-pixel"
        style={{
          width: '360px',
          background: 'var(--color-bg-dark)',
          border: '2px solid var(--color-border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-16 py-10"
          style={{ borderBottom: '2px solid var(--color-border)' }}
        >
          <span className="text-base">Spawn New Agent</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            ×
          </Button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-10 px-16 py-12">
          {/* Folder picker (only for multi-root workspaces) */}
          {hasMultipleFolders && (
            <div className="flex flex-col gap-4">
              <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Workspace folder
              </label>
              <div className="flex flex-col gap-2">
                {workspaceFolders.map((f) => (
                  <button
                    key={f.path}
                    className="text-left px-8 py-4 text-sm cursor-pointer"
                    style={{
                      background:
                        selectedFolder?.path === f.path
                          ? 'var(--color-active-bg)'
                          : 'var(--color-btn-bg)',
                      border:
                        selectedFolder?.path === f.path
                          ? '2px solid var(--color-accent)'
                          : '2px solid transparent',
                      color: 'var(--color-text)',
                    }}
                    onClick={() => setSelectedFolder(f)}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Task input */}
          <div className="flex flex-col gap-4">
            <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Initial task{' '}
              <span className="text-2xs" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>
                (optional — Ctrl+Enter to launch)
              </span>
            </label>
            <textarea
              ref={textareaRef}
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want the agent to do…"
              rows={4}
              className="w-full resize-none text-sm p-8 font-pixel"
              style={{
                background: 'var(--color-bg)',
                border: '2px solid var(--color-border)',
                color: 'var(--color-text)',
                outline: 'none',
              }}
            />
          </div>

          {/* Bypass permissions toggle */}
          <label
            className="flex items-center gap-8 cursor-pointer select-none"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <input
              type="checkbox"
              checked={bypassPermissions}
              onChange={(e) => setBypassPermissions(e.target.checked)}
              style={{ accentColor: 'var(--color-accent)', width: '14px', height: '14px' }}
            />
            <span className="text-xs">
              Skip permissions mode{' '}
              <span className="text-2xs" style={{ color: 'var(--color-warning)' }}>
                ⚠
              </span>
            </span>
          </label>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-8 px-16 py-10"
          style={{ borderTop: '2px solid var(--color-border)' }}
        >
          <Button variant="default" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            size="md"
            onClick={handleLaunch}
            disabled={hasMultipleFolders && !selectedFolder}
          >
            Launch
          </Button>
        </div>
      </div>
    </div>
  );
}
