import { useState } from 'react';

import { ROOM_PRESET_COLORS } from '../constants.js';
import { vscode } from '../vscodeApi.js';
import { Button } from './ui/Button.js';
import { Modal } from './ui/Modal.js';

const PRESET_COLORS = ROOM_PRESET_COLORS;

const PRESET_ICONS = ['🏠', '🔬', '📱', '🌐', '🎮', '🔐', '📊', '🚀', '🎨', '🧪'];

interface CreateRoomModalProps {
  onClose: () => void;
}

export function CreateRoomModal({ onClose }: CreateRoomModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState(PRESET_ICONS[0]);
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    vscode.postMessage({
      type: 'createCustomRoom',
      name: name.trim(),
      color,
      icon,
      description: description.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title="Create Team Room">
      <div className="flex flex-col gap-12 p-16" style={{ minWidth: 280, maxWidth: 400 }}>
        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
          Create Team Room
        </h2>

        <div className="flex flex-col gap-4">
          <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Room Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. ML Platform"
            autoFocus
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
            Color
          </label>
          <div className="flex flex-wrap gap-6">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: c,
                  border: color === c ? '2px solid var(--color-text)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Icon
          </label>
          <div className="flex flex-wrap gap-6">
            {PRESET_ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  background: icon === ic ? 'var(--color-border)' : 'transparent',
                  border: `1px solid ${icon === ic ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this team work on?"
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

        <div className="flex justify-end gap-8">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={handleCreate} disabled={!name.trim()}>
            Create Room
          </Button>
        </div>
      </div>
    </Modal>
  );
}
