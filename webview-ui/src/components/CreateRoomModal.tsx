import { useState } from 'react';

import { ROOM_PRESET_COLORS } from '../constants.js';
import { vscode } from '../vscodeApi.js';
import { Button } from './ui/Button.js';
import { Modal } from './ui/Modal.js';

const PRESET_COLORS = ROOM_PRESET_COLORS;

const PRESET_ICONS = ['🏠', '🔬', '📱', '🌐', '🎮', '🔐', '📊', '🚀', '🎨', '🧪'];

interface PersonaTemplate {
  label: string;
  icon: string;
  color: string;
  description: string;
  keywords: string;
}

const PERSONA_TEMPLATES: PersonaTemplate[] = [
  {
    label: 'Frontend',
    icon: '📱',
    color: PRESET_COLORS[0],
    description: 'UI/UX, React, CSS, components',
    keywords: 'react,vue,css,html,component,ui,ux,design,tailwind,nextjs',
  },
  {
    label: 'Backend',
    icon: '⚙️',
    color: PRESET_COLORS[1],
    description: 'APIs, services, business logic',
    keywords: 'api,server,express,rest,graphql,auth,backend,microservice,node',
  },
  {
    label: 'ML / AI',
    icon: '🧠',
    color: PRESET_COLORS[4],
    description: 'Machine learning, AI, data science',
    keywords: 'ml,ai,model,training,dataset,tensorflow,pytorch,embedding,llm,inference',
  },
  {
    label: 'Security',
    icon: '🔐',
    color: PRESET_COLORS[3],
    description: 'Security audits, auth, compliance',
    keywords: 'security,vulnerability,auth,cve,owasp,pentest,encryption,zap,sast',
  },
  {
    label: 'DevOps',
    icon: '🚀',
    color: PRESET_COLORS[6],
    description: 'CI/CD, infra, containers',
    keywords: 'docker,kubernetes,ci,cd,pipeline,terraform,helm,deploy,infra,cloud',
  },
  {
    label: 'QA',
    icon: '✅',
    color: PRESET_COLORS[2],
    description: 'Testing, specs, quality',
    keywords: 'test,spec,jest,cypress,playwright,e2e,coverage,lint,qa,regression',
  },
  {
    label: 'Data',
    icon: '📊',
    color: PRESET_COLORS[9],
    description: 'Databases, analytics, ETL',
    keywords: 'database,sql,postgres,mongodb,query,analytics,etl,pandas,bigquery',
  },
  {
    label: 'Design',
    icon: '🎨',
    color: PRESET_COLORS[8],
    description: 'UI design, accessibility, Figma',
    keywords: 'figma,design,accessibility,a11y,wireframe,prototype,ux,color,typography',
  },
];

interface CreateRoomModalProps {
  onClose: () => void;
}

export function CreateRoomModal({ onClose }: CreateRoomModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState(PRESET_ICONS[0]);
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');

  const applyTemplate = (t: PersonaTemplate) => {
    setName(t.label);
    setIcon(t.icon);
    setColor(t.color);
    setDescription(t.description);
    setKeywords(t.keywords);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    vscode.postMessage({
      type: 'createCustomRoom',
      name: name.trim(),
      color,
      icon,
      description: description.trim() || undefined,
      keywords: keywords.trim()
        ? keywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean)
        : undefined,
    });
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title="Create Team Room">
      <div className="flex flex-col gap-12 p-16" style={{ minWidth: 320, maxWidth: 440 }}>
        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
          Create Team Room
        </h2>

        {/* Persona templates */}
        <div className="flex flex-col gap-4">
          <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Quick Persona
          </label>
          <div className="flex flex-wrap gap-4">
            {PERSONA_TEMPLATES.map((t) => (
              <button
                key={t.label}
                onClick={() => applyTemplate(t)}
                title={t.description}
                style={{
                  padding: '3px 8px',
                  borderRadius: 3,
                  border: `1px solid ${name === t.label ? t.color : 'var(--color-border)'}`,
                  background: name === t.label ? t.color + '33' : 'transparent',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

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

        <div className="flex flex-col gap-4">
          <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Auto-assign keywords (comma-separated)
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="e.g. react, component, tailwind"
            style={{
              background: 'var(--color-panel)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 2,
              padding: '4px 8px',
              fontSize: 12,
            }}
          />
          <span className="text-2xs" style={{ color: 'var(--color-text-muted)' }}>
            Agents are automatically assigned here when their task contains these words.
          </span>
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
