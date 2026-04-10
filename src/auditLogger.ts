/**
 * auditLogger.ts
 *
 * Per-room ring-buffer audit log of agent activity events.
 * Events are broadcast to the webview incrementally.
 */

import * as vscode from 'vscode';

import { AUDIT_MAX_ENTRIES_PER_ROOM, WORKSPACE_KEY_AUDIT_LOG } from './constants.js';
import type { AgentType, AuditEntry } from './types.js';

export class AuditLogger {
  private entries = new Map<string, AuditEntry[]>(); // roomId → entries ring-buffer
  private webviewRef: (() => vscode.Webview | undefined) | null = null;
  private context: vscode.ExtensionContext | null = null;

  constructor(context: vscode.ExtensionContext, getWebview: () => vscode.Webview | undefined) {
    this.context = context;
    this.webviewRef = getWebview;
    this.restore();
  }

  private restore(): void {
    try {
      const saved = this.context?.workspaceState.get<Record<string, AuditEntry[]>>(
        WORKSPACE_KEY_AUDIT_LOG,
        {},
      );
      if (saved) {
        for (const [roomId, entries] of Object.entries(saved)) {
          this.entries.set(roomId, entries);
        }
      }
    } catch {
      // Ignore restore errors
    }
  }

  private persist(): void {
    try {
      const obj: Record<string, AuditEntry[]> = {};
      for (const [roomId, entries] of this.entries) {
        // Only persist the last N entries to avoid ballooning storage
        obj[roomId] = entries.slice(-50);
      }
      void this.context?.workspaceState.update(WORKSPACE_KEY_AUDIT_LOG, obj);
    } catch {
      // Ignore persist errors
    }
  }

  log(
    roomId: string,
    agentId: number,
    agentType: AgentType,
    agentLabel: string,
    event: AuditEntry['event'],
    detail: string,
  ): AuditEntry {
    const entry: AuditEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      roomId,
      agentId,
      agentType,
      agentLabel,
      event,
      detail,
    };

    const list = this.entries.get(roomId) ?? [];
    list.push(entry);
    // Trim to ring-buffer size
    if (list.length > AUDIT_MAX_ENTRIES_PER_ROOM) {
      list.splice(0, list.length - AUDIT_MAX_ENTRIES_PER_ROOM);
    }
    this.entries.set(roomId, list);

    // Broadcast to webview
    this.webviewRef?.()?.postMessage({ type: 'auditEntry', entry });

    this.persist();
    return entry;
  }

  getEntries(roomId: string): AuditEntry[] {
    return this.entries.get(roomId) ?? [];
  }

  getAllEntries(): AuditEntry[] {
    const all: AuditEntry[] = [];
    for (const entries of this.entries.values()) {
      all.push(...entries);
    }
    return all.sort((a, b) => a.timestamp - b.timestamp);
  }

  clearRoom(roomId: string): void {
    this.entries.delete(roomId);
    this.persist();
  }

  /** Send the full audit log for a specific room to the webview on demand. */
  sendRoomAudit(roomId: string): void {
    const entries = this.getEntries(roomId);
    this.webviewRef?.()?.postMessage({ type: 'auditEntries', roomId, entries });
  }
}
