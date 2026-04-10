import { useEffect, useRef } from 'react';

import {
  ACTIVITY_FEED_BG,
  ACTIVITY_TEXT_DIM,
  ACTIVITY_TEXT_FAINT,
  ROOM_COLOR_GENERAL,
  ROOM_COLORS,
} from '../constants.js';

export interface ActivityEvent {
  id: string;
  agentId: number;
  roomId: string;
  agentType: string;
  event: string;
  detail: string;
  timestamp: number;
}

const AGENT_TYPE_ICONS: Record<string, string> = {
  'claude-cli': '🤖',
  'copilot-chat': '🐙',
  'local-cli': '💻',
  'custom': '⚡',
};

const EVENT_VERBS: Record<string, string> = {
  tool_start: '▶',
  tool_done: '✓',
  agent_created: '⊕',
  agent_removed: '⊖',
  subagent_spawn: '⬡',
};

interface ActivityFeedProps {
  events: ActivityEvent[];
  selectedRoomId: string | null;
}

export function ActivityFeed({ events, selectedRoomId }: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to right when new events arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [events.length]);

  const filtered = selectedRoomId
    ? events.filter((e) => e.roomId === selectedRoomId)
    : events;

  if (filtered.length === 0) return null;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-10 flex items-center overflow-hidden"
      style={{
        height: 28,
        background: ACTIVITY_FEED_BG,
        borderTop: '1px solid var(--color-border)',
      }}
    >
      <div
        ref={scrollRef}
        className="flex items-center gap-12 px-8 overflow-x-auto"
        style={{ scrollBehavior: 'smooth', msOverflowStyle: 'none', scrollbarWidth: 'none' }}
      >
        {filtered.slice(-30).map((evt) => {
          const roomColor = ROOM_COLORS[evt.roomId] ?? ROOM_COLOR_GENERAL;
          const agentIcon = AGENT_TYPE_ICONS[evt.agentType] ?? '•';
          const verb = EVENT_VERBS[evt.event] ?? '•';
          return (
            <span
              key={evt.id}
              className="flex items-center gap-4 whitespace-nowrap text-2xs shrink-0"
              style={{ color: ACTIVITY_TEXT_DIM, opacity: 0.85 }}
            >
              <span style={{ color: roomColor }}>{agentIcon}</span>
              <span style={{ color: roomColor, opacity: 0.7 }}>#{evt.agentId}</span>
              <span style={{ color: ACTIVITY_TEXT_FAINT }}>{verb}</span>
              <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {evt.detail}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
