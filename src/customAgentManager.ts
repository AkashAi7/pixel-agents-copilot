/**
 * customAgentManager.ts
 *
 * Manages user-created custom agent configurations.
 * Custom agents can be local CLI commands launched as VS Code terminals.
 */

import * as vscode from 'vscode';

import { GLOBAL_KEY_CUSTOM_AGENTS, TERMINAL_NAME_PREFIX } from './constants.js';
import type { CustomAgentConfig } from './types.js';

export class CustomAgentManager {
  private configs = new Map<string, CustomAgentConfig>();
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.restore();
  }

  private restore(): void {
    const saved = this.context.globalState.get<CustomAgentConfig[]>(GLOBAL_KEY_CUSTOM_AGENTS, []);
    for (const cfg of saved) {
      this.configs.set(cfg.id, cfg);
    }
  }

  private persist(): void {
    void this.context.globalState.update(
      GLOBAL_KEY_CUSTOM_AGENTS,
      Array.from(this.configs.values()),
    );
  }

  create(
    name: string,
    roomId: string,
    command: string,
    args?: string[],
    color?: string,
    description?: string,
  ): CustomAgentConfig {
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const cfg: CustomAgentConfig = {
      id,
      name,
      roomId,
      command,
      args,
      color,
      description,
      createdAt: Date.now(),
    };
    this.configs.set(id, cfg);
    this.persist();
    return cfg;
  }

  update(id: string, patch: Partial<Omit<CustomAgentConfig, 'id' | 'createdAt'>>): boolean {
    const existing = this.configs.get(id);
    if (!existing) return false;
    this.configs.set(id, { ...existing, ...patch });
    this.persist();
    return true;
  }

  delete(id: string): boolean {
    const deleted = this.configs.delete(id);
    if (deleted) this.persist();
    return deleted;
  }

  getAll(): CustomAgentConfig[] {
    return Array.from(this.configs.values());
  }

  get(id: string): CustomAgentConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * Launch a custom agent by opening a VS Code terminal and running its command.
   * Returns the terminal reference so callers can track it.
   */
  launch(id: string): vscode.Terminal | null {
    const cfg = this.configs.get(id);
    if (!cfg) return null;

    const cmdParts = [cfg.command, ...(cfg.args ?? [])].join(' ');
    const terminal = vscode.window.createTerminal({
      name: `${TERMINAL_NAME_PREFIX} (${cfg.name})`,
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    });
    terminal.show();
    terminal.sendText(cmdParts);
    return terminal;
  }
}
