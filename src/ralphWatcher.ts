/**
 * ralphWatcher.ts
 *
 * Ralph — autonomous GitHub Issue triage and agent dispatch.
 * Polls `gh issue list` on a configurable interval, emits issue lists to the
 * webview, and supports dispatching agents to rooms for selected issues.
 *
 * Named after Squad's Ralph — the autonomous watch loop agent.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  labels: string[];
  createdAt: string;
  url: string;
  state: string;
  assignees: string[];
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

// ── RalphWatcher ─────────────────────────────────────────────────────────────

export class RalphWatcher {
  private timer: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;
  private round = 0;
  private lastPoll = 0;
  private lastError?: string;
  private intervalMs: number;
  private onIssues: (issues: GitHubIssue[]) => void;
  private onStatus: (status: RalphStatus) => void;

  constructor(
    intervalMinutes: number,
    onIssues: (issues: GitHubIssue[]) => void,
    onStatus: (status: RalphStatus) => void,
  ) {
    this.intervalMs = intervalMinutes * 60 * 1000;
    this.onIssues = onIssues;
    this.onStatus = onStatus;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  start(): void {
    if (this.timer) return;
    this.startedAt = Date.now();
    this.lastError = undefined;
    void this.poll(); // immediate first poll
    this.timer = setInterval(() => void this.poll(), this.intervalMs);
    this.emitStatus();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.emitStatus();
  }

  get running(): boolean {
    return this.timer !== null;
  }

  /** Trigger an immediate poll regardless of timer state. */
  async pollNow(): Promise<void> {
    await this.poll();
  }

  /** Update the polling interval (restarts the timer if running). */
  setIntervalMinutes(minutes: number): void {
    this.intervalMs = minutes * 60 * 1000;
    if (this.timer) {
      this.stop();
      this.start();
    }
  }

  status(): RalphStatus {
    return {
      running: this.running,
      uptime: this.running ? Date.now() - this.startedAt : undefined,
      lastPoll: this.lastPoll || undefined,
      nextPoll: this.running ? this.lastPoll + this.intervalMs : undefined,
      round: this.round,
      intervalMs: this.intervalMs,
      lastError: this.lastError,
    };
  }

  dispose(): void {
    this.stop();
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async poll(): Promise<void> {
    this.lastPoll = Date.now();
    this.round++;
    this.emitStatus();

    try {
      const issues = await this.fetchIssues();
      this.lastError = undefined;
      this.onIssues(issues);
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      console.error('[Ralph] Poll failed:', this.lastError);
      this.emitStatus();
    }
  }

  private async fetchIssues(): Promise<GitHubIssue[]> {
    const { stdout } = await execAsync(
      'gh issue list --limit 30 --state open --json number,title,body,labels,createdAt,url,state,assignees',
      { timeout: 15000 },
    );
    const raw = JSON.parse(stdout) as Array<{
      number: number;
      title: string;
      body: string;
      labels: Array<{ name: string }>;
      createdAt: string;
      url: string;
      state: string;
      assignees: Array<{ login: string }>;
    }>;
    return raw.map((i) => ({
      number: i.number,
      title: i.title,
      body: i.body ?? '',
      labels: i.labels.map((l) => l.name),
      createdAt: i.createdAt,
      url: i.url,
      state: i.state,
      assignees: i.assignees.map((a) => a.login),
    }));
  }

  private emitStatus(): void {
    this.onStatus(this.status());
  }
}
