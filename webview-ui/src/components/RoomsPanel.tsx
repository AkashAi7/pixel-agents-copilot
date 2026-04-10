import { useCallback, useRef, useState } from 'react';

import { COLOR_WHITE, ROOM_COLOR_GENERAL } from '../constants.js';
import type { TeamRoom } from '../hooks/useExtensionMessages.js';
import { vscode } from '../vscodeApi.js';
import { Button } from './ui/Button.js';

interface RoomsPanelProps {
  rooms: TeamRoom[];
  agentCounts: Record<string, number>;
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string | null) => void;
  agentRooms: Record<number, string>;
  onCreateRoom: () => void;
  onSpawnAgentInRoom: (roomId: string) => void;
  onViewRoomLogs: (roomId: string) => void;
  onDeleteRoom: (roomId: string) => void;
}

export function RoomsPanel({
  rooms,
  agentCounts,
  selectedRoomId,
  onSelectRoom,
  onCreateRoom,
  onSpawnAgentInRoom,
  onViewRoomLogs,
  onDeleteRoom,
}: RoomsPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    roomId: string;
    isBuiltIn: boolean;
    x: number;
    y: number;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleRoomContextMenu = useCallback((e: React.MouseEvent, room: TeamRoom) => {
    e.preventDefault();
    e.stopPropagation();
    const panelRect = panelRef.current?.getBoundingClientRect();
    setContextMenu({
      roomId: room.id,
      isBuiltIn: room.isBuiltIn,
      x: e.clientX - (panelRect?.left ?? 0),
      y: e.clientY - (panelRect?.top ?? 0),
    });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleSelectRoom = useCallback(
    (roomId: string) => {
      onSelectRoom(selectedRoomId === roomId ? null : roomId);
      // Request audit entries for this room
      if (selectedRoomId !== roomId) {
        vscode.postMessage({ type: 'requestAudit', roomId });
      }
    },
    [selectedRoomId, onSelectRoom],
  );

  const totalAgents = Object.values(agentCounts).reduce((sum, n) => sum + n, 0);

  if (isCollapsed) {
    return (
      <div
        className="absolute left-0 top-0 bottom-0 z-20 flex flex-col"
        style={{
          width: 28,
          background: 'var(--color-panel)',
          borderRight: '1px solid var(--color-border)',
        }}
      >
        <button
          className="w-full flex items-center justify-center py-6 hover:opacity-80"
          onClick={() => setIsCollapsed(false)}
          title="Expand rooms panel"
          style={{
            color: 'var(--color-text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ▶
        </button>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="absolute left-0 top-0 bottom-0 z-20 flex flex-col overflow-hidden"
      style={{
        width: 160,
        background: 'var(--color-panel)',
        borderRight: '1px solid var(--color-border)',
      }}
      onClick={closeContextMenu}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-8 py-6"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
          TEAMS
        </span>
        <div className="flex items-center gap-4">
          <span
            className="text-2xs px-4 rounded-full"
            style={{ background: 'var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            {totalAgents}
          </span>
          <button
            onClick={() => setIsCollapsed(true)}
            style={{
              color: 'var(--color-text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 10,
            }}
            title="Collapse"
          >
            ◀
          </button>
        </div>
      </div>

      {/* Room list */}
      <div className="flex-1 overflow-y-auto py-4">
        {/* "All" entry */}
        <RoomRow
          name="All Agents"
          color={ROOM_COLOR_GENERAL}
          icon="👥"
          count={totalAgents}
          isSelected={selectedRoomId === null}
          onClick={() => onSelectRoom(null)}
        />

        {rooms.map((room) => (
          <RoomRow
            key={room.id}
            name={room.name}
            color={room.color}
            icon={room.icon}
            count={agentCounts[room.id] ?? 0}
            isSelected={selectedRoomId === room.id}
            onClick={() => handleSelectRoom(room.id)}
            onContextMenu={(e) => handleRoomContextMenu(e, room)}
          />
        ))}
      </div>

      {/* Footer: add room */}
      <div className="px-6 py-6" style={{ borderTop: '1px solid var(--color-border)' }}>
        <Button variant="default" onClick={onCreateRoom} className="w-full text-2xs">
          + Room
        </Button>
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          style={{
            position: 'absolute',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 100,
            background: 'var(--color-panel)',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            boxShadow: 'var(--pixel-shadow)',
            minWidth: 160,
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ContextMenuItem
            label="⊕ Spawn agent here"
            onClick={() => {
              onSpawnAgentInRoom(contextMenu.roomId);
              closeContextMenu();
            }}
          />
          <ContextMenuItem
            label="📋 View logs"
            onClick={() => {
              onViewRoomLogs(contextMenu.roomId);
              closeContextMenu();
            }}
          />
          {!contextMenu.isBuiltIn && (
            <>
              <div style={{ height: 1, background: 'var(--color-border)' }} />
              <ContextMenuItem
                label="🗑 Delete room"
                danger
                onClick={() => {
                  onDeleteRoom(contextMenu.roomId);
                  closeContextMenu();
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ContextMenuItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '6px 12px',
        fontSize: 11,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: danger ? 'var(--color-danger)' : 'var(--color-text)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-border)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'none';
      }}
    >
      {label}
    </button>
  );
}

function RoomRow({
  name,
  color,
  icon,
  count,
  isSelected,
  onClick,
  onContextMenu,
}: {
  name: string;
  color: string;
  icon: string;
  count: number;
  isSelected: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      className="w-full flex items-center gap-6 px-8 py-5 text-left hover:opacity-90 transition-opacity"
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        background: isSelected ? 'var(--color-border)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        borderLeft: isSelected ? `3px solid ${color}` : '3px solid transparent',
      }}
    >
      <span style={{ fontSize: 12, lineHeight: 1 }}>{icon}</span>
      <span
        className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs"
        style={{ color: isSelected ? 'var(--color-text)' : 'var(--color-text-muted)' }}
      >
        {name}
      </span>
      {count > 0 && (
        <span
          className="text-2xs shrink-0 px-3 rounded-full"
          style={{ background: color, color: COLOR_WHITE, opacity: 0.9 }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
