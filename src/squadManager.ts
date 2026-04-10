/**
 * squadManager.ts
 *
 * Ports Squad (bradygaster/squad) concepts into the Pixel Agents extension:
 *  - .squad/ folder scaffolding (team.md, routing.md, decisions.md, ceremonies.md)
 *  - Named persistent agent cast (instead of "Agent 1/2/3")
 *  - Per-agent charter.md + history.md files
 *  - Shared decisions log
 *  - Context hygiene / nap (archive old decisions)
 *  - Team roster sync
 */

import * as fs from 'fs';
import * as path from 'path';

import type { AgentType, TeamRoom } from './types.js';

// ── Named cast pool (same thematic approach as Squad) ───────────────────────

const NAMED_CAST = [
  'Keaton', 'McManus', 'Edie', 'Vera', 'Hollis', 'Archer', 'Sloane',
  'Brennan', 'Caine', 'Dexter', 'Fiona', 'Grant', 'Harper', 'Ivan',
  'Jules', 'Kai', 'Luna', 'Miles', 'Nova', 'Oscar', 'Petra', 'Quinn',
  'Rex', 'Sage', 'Tess', 'Uri', 'Vance', 'Wren', 'Xena', 'Yara', 'Zoe',
];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  frontend: 'Frontend Engineer — UI/UX, React, CSS, components',
  backend: 'Backend Engineer — APIs, servers, services, business logic',
  data: 'Data Engineer — databases, migrations, analytics, ML',
  sre: 'SRE / DevOps — infrastructure, CI/CD, Docker, Kubernetes',
  qa: 'QA Engineer — tests, specs, quality, automation',
  general: 'General — multi-purpose, unspecialized',
};

const ROOM_KEYWORDS: Record<string, string[]> = {
  frontend: ['react', 'vue', 'angular', 'svelte', 'css', 'ui', 'ux', 'component', 'styling', 'tailwind'],
  backend: ['api', 'server', 'express', 'fastapi', 'django', 'auth', 'endpoint', 'service', 'database'],
  data: ['postgres', 'mysql', 'sqlite', 'migration', 'schema', 'analytics', 'ml', 'model', 'vector'],
  sre: ['docker', 'kubernetes', 'k8s', 'terraform', 'ci/cd', 'pipeline', 'infra', 'deployment', 'helm'],
  qa: ['test', 'spec', 'jest', 'vitest', 'playwright', 'coverage', 'e2e', 'unit', 'integration'],
};

// ── NapResult ────────────────────────────────────────────────────────────────

export interface NapResult {
  archived: number;
  remaining: number;
}

// ── SquadManager ─────────────────────────────────────────────────────────────

export class SquadManager {
  private squadDir: string;
  private agentsDir: string;
  private assignedNames = new Map<number, string>(); // agentId → name

  constructor(workspaceRoot: string) {
    this.squadDir = path.join(workspaceRoot, '.squad');
    this.agentsDir = path.join(this.squadDir, 'agents');
    this.restoreAssignedNames();
  }

  // ── Initialisation ─────────────────────────────────────────────────────────

  /** Scaffold the .squad/ folder with all required files (idempotent). */
  init(rooms: TeamRoom[]): void {
    fs.mkdirSync(this.squadDir, { recursive: true });
    fs.mkdirSync(this.agentsDir, { recursive: true });
    fs.mkdirSync(path.join(this.squadDir, 'log'), { recursive: true });
    fs.mkdirSync(path.join(this.squadDir, 'skills'), { recursive: true });
    fs.mkdirSync(path.join(this.squadDir, 'identity'), { recursive: true });

    this.writeIfMissing(
      path.join(this.squadDir, 'team.md'),
      this.buildTeamMd(rooms, []),
    );
    this.writeIfMissing(
      path.join(this.squadDir, 'routing.md'),
      this.buildRoutingMd(rooms),
    );
    this.writeIfMissing(
      path.join(this.squadDir, 'decisions.md'),
      '# Decisions\n\n_Shared log — every decision any agent makes is recorded here._\n\n',
    );
    this.writeIfMissing(
      path.join(this.squadDir, 'ceremonies.md'),
      '# Ceremonies\n\n_Sprint ceremonies configuration._\n\n',
    );
    this.writeIfMissing(
      path.join(this.squadDir, 'identity', 'now.md'),
      '# Current Focus\n\n_What the team is working on right now._\n\n',
    );
    this.writeIfMissing(
      path.join(this.squadDir, 'identity', 'wisdom.md'),
      '# Wisdom\n\n_Reusable patterns the team has learned._\n\n',
    );
  }

  // ── Named cast ─────────────────────────────────────────────────────────────

  /** Assign a persistent name to an agent. Returns the name. */
  assignName(agentId: number): string {
    if (this.assignedNames.has(agentId)) {
      return this.assignedNames.get(agentId)!;
    }
    const usedNames = new Set(this.assignedNames.values());
    const available = NAMED_CAST.filter((n) => !usedNames.has(n));
    const name = available[0] ?? `Agent-${agentId}`;
    this.assignedNames.set(agentId, name);
    this.persistNames();
    return name;
  }

  /** Get the name assigned to an agent, or fall back to "Agent-{id}". */
  getName(agentId: number): string {
    return this.assignedNames.get(agentId) ?? `Agent-${agentId}`;
  }

  /** Return all assigned names (agentId → name). */
  getAllNames(): Record<number, string> {
    return Object.fromEntries(this.assignedNames);
  }

  /** Remove name assignment when an agent is removed. */
  releaseName(agentId: number): void {
    this.assignedNames.delete(agentId);
    this.persistNames();
  }

  // ── Per-agent charter / history ────────────────────────────────────────────

  /** Create charter.md and history.md for an agent (idempotent). */
  scaffoldAgent(
    _agentId: number,
    name: string,
    agentType: AgentType,
    roomId: string,
    task?: string,
  ): void {
    const dir = path.join(this.agentsDir, name.toLowerCase());
    fs.mkdirSync(dir, { recursive: true });

    const charterFile = path.join(dir, 'charter.md');
    const historyFile = path.join(dir, 'history.md');
    const roleDesc = ROLE_DESCRIPTIONS[roomId] ?? 'Specialist';

    this.writeIfMissing(
      charterFile,
      [
        `# ${name}`,
        '',
        `**Role:** ${roleDesc}`,
        `**Room:** ${roomId}`,
        `**Agent Type:** ${agentType}`,
        `**Created:** ${new Date().toISOString()}`,
        '',
        '## Identity',
        '',
        `${name} is a specialist in the **${roomId}** domain.`,
        task ? `\n## Initial Task\n\n${task}` : '',
      ].join('\n'),
    );

    this.writeIfMissing(
      historyFile,
      [
        `# ${name} — History`,
        '',
        `_This file records what ${name} has learned about this project across sessions._`,
        '',
        '## Session Log',
        '',
      ].join('\n'),
    );
  }

  /** Append a line to an agent's history.md. */
  appendHistory(agentId: number, entry: string): void {
    const name = this.getName(agentId);
    const historyFile = path.join(this.agentsDir, name.toLowerCase(), 'history.md');
    try {
      fs.appendFileSync(historyFile, `- [${new Date().toISOString()}] ${entry}\n`, 'utf8');
    } catch {
      // ignore — scaffoldAgent may not have been called yet
    }
  }

  /** Read an agent's history.md. */
  readHistory(agentId: number): string {
    const name = this.getName(agentId);
    const historyFile = path.join(this.agentsDir, name.toLowerCase(), 'history.md');
    try {
      return fs.readFileSync(historyFile, 'utf8');
    } catch {
      return '_No history recorded yet._';
    }
  }

  // ── Decisions log ──────────────────────────────────────────────────────────

  /** Append a decision entry to .squad/decisions.md. */
  appendDecision(agentId: number, roomId: string, decision: string): void {
    const name = this.getName(agentId);
    const decisionsFile = path.join(this.squadDir, 'decisions.md');
    const entry = `\n### [${new Date().toISOString()}] ${name} (${roomId})\n\n${decision}\n`;
    try {
      fs.appendFileSync(decisionsFile, entry, 'utf8');
    } catch {
      // ignore
    }
  }

  /** Read current decisions.md content. */
  readDecisions(): string {
    const file = path.join(this.squadDir, 'decisions.md');
    try {
      return fs.readFileSync(file, 'utf8');
    } catch {
      return '_No decisions recorded yet._';
    }
  }

  // ── Nap (context hygiene) ──────────────────────────────────────────────────

  /**
   * Compress decisions.md — archive old entries to .squad/archive/.
   * @param deep If true, keep only 10 entries; otherwise keep 25.
   */
  nap(deep = false): NapResult {
    const decisionsFile = path.join(this.squadDir, 'decisions.md');
    if (!fs.existsSync(decisionsFile)) {
      return { archived: 0, remaining: 0 };
    }

    const content = fs.readFileSync(decisionsFile, 'utf8');
    // Split on ### headings to get individual entries
    const parts = content.split(/\n(?=###\s)/);
    const header = parts[0]; // The "# Decisions" header section
    const entries = parts.slice(1);

    const keepCount = deep ? 10 : 25;
    if (entries.length <= keepCount) {
      return { archived: 0, remaining: entries.length };
    }

    const toArchive = entries.slice(0, entries.length - keepCount);
    const toKeep = entries.slice(entries.length - keepCount);

    // Write archive
    const archiveDir = path.join(this.squadDir, 'archive');
    fs.mkdirSync(archiveDir, { recursive: true });
    const archiveFile = path.join(archiveDir, `decisions-${Date.now()}.md`);
    fs.writeFileSync(archiveFile, `# Archived Decisions\n\n${toArchive.join('\n')}`, 'utf8');

    // Rewrite decisions.md with only recent entries
    fs.writeFileSync(decisionsFile, `${header}\n${toKeep.join('\n')}`, 'utf8');

    return { archived: toArchive.length, remaining: toKeep.length };
  }

  // ── Team roster sync ───────────────────────────────────────────────────────

  /** Rewrite .squad/team.md with current active agent list. */
  syncTeam(
    rooms: TeamRoom[],
    activeAgents: Array<{ id: number; roomId?: string; agentType: AgentType }>,
  ): void {
    const teamFile = path.join(this.squadDir, 'team.md');
    try {
      fs.writeFileSync(teamFile, this.buildTeamMd(rooms, activeAgents), 'utf8');
    } catch {
      // ignore
    }
  }

  // ── Paths ──────────────────────────────────────────────────────────────────

  getSquadDir(): string {
    return this.squadDir;
  }

  isInitialised(): boolean {
    return fs.existsSync(this.squadDir);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private buildTeamMd(
    rooms: TeamRoom[],
    activeAgents: Array<{ id: number; roomId?: string; agentType: AgentType }>,
  ): string {
    const lines = [
      '# Team Roster',
      '',
      `_Auto-managed by Pixel Agents — last synced: ${new Date().toLocaleString()}_`,
      '',
    ];
    for (const room of rooms) {
      const roomAgents = activeAgents.filter(
        (a) => (a.roomId ?? 'general') === room.id,
      );
      lines.push(`\n## ${room.icon} ${room.name} (\`${room.id}\`)`);
      lines.push(`> ${room.description}`);
      if (roomAgents.length === 0) {
        lines.push('\n_No active agents_');
      } else {
        for (const agent of roomAgents) {
          lines.push(`\n- **${this.getName(agent.id)}** (${agent.agentType})`);
        }
      }
    }
    return lines.join('\n') + '\n';
  }

  private buildRoutingMd(rooms: TeamRoom[]): string {
    const lines = [
      '# Routing',
      '',
      '_Auto-managed by Pixel Agents — keyword → room mapping for auto-assignment._',
      '',
    ];
    for (const room of rooms) {
      const kw = ROOM_KEYWORDS[room.id] ?? [];
      lines.push(`\n## ${room.icon} ${room.name} → \`${room.id}\``);
      if (kw.length > 0) {
        lines.push(`**Keywords:** ${kw.join(', ')}`);
      }
    }
    return lines.join('\n') + '\n';
  }

  private persistNames(): void {
    try {
      fs.mkdirSync(this.squadDir, { recursive: true });
      const file = path.join(this.squadDir, '.name-registry.json');
      const data: Record<string, string> = {};
      for (const [id, name] of this.assignedNames) {
        data[String(id)] = name;
      }
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    } catch {
      // ignore
    }
  }

  private restoreAssignedNames(): void {
    const file = path.join(this.squadDir, '.name-registry.json');
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const data = JSON.parse(raw) as Record<string, string>;
      for (const [id, name] of Object.entries(data)) {
        this.assignedNames.set(Number(id), name);
      }
    } catch {
      // ignore — file doesn't exist yet
    }
  }

  private writeIfMissing(filePath: string, content: string): void {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
}
