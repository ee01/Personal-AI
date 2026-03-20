/**
 * ProactiveScheduler -- dual-loop scheduler that orchestrates heartbeat
 * and cron-based consolidation tasks for ALL registered users.
 *
 * Loops:
 *   1. Heartbeat (setInterval):  micro-consolidation + notification checks
 *   2. Daily cron:               full consolidation sweep
 *   3. Weekly cron:              generative replay / dreaming
 *
 * All async errors are caught and logged so the scheduler never crashes
 * the host process.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
import cron from 'node-cron';
import { getConfig } from '../config.js';
import { HeartbeatLoop } from './HeartbeatLoop.js';
import { ConsolidationEngine } from './ConsolidationEngine.js';
import { GenerativeReplay } from './GenerativeReplay.js';
import { WeeklyReporter } from './WeeklyReporter.js';
import { OutreachEngine } from './OutreachEngine.js';
import { UserContextManager } from './UserContextManager.js';

// ---------------------------------------------------------------------------
// ProactiveScheduler
// ---------------------------------------------------------------------------

export class ProactiveScheduler {
  private ucm: UserContextManager;

  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private outreachIntervalId: ReturnType<typeof setInterval> | null = null;
  private dailyTask: ReturnType<typeof cron.schedule> | null = null;
  private weeklyTask: ReturnType<typeof cron.schedule> | null = null;
  private weeklyReportTask: ReturnType<typeof cron.schedule> | null = null;
  private running = false;

  constructor(ucm: UserContextManager) {
    this.ucm = ucm;
  }

  // ---- Lifecycle ----------------------------------------------------------

  /**
   * Start all scheduler loops. Safe to call multiple times; subsequent
   * calls are no-ops if already running.
   */
  start(): void {
    if (this.running) {
      console.warn('[ProactiveScheduler] Already running, ignoring start()');
      return;
    }

    const config = getConfig();

    // 1. Heartbeat loop
    this.heartbeatIntervalId = setInterval(() => {
      this.safeRun('heartbeat', () => this.runHeartbeat());
    }, config.heartbeatIntervalMs);

    this.outreachIntervalId = setInterval(() => {
      this.safeRun('outreach', () => this.runOutreachCycle());
    }, config.outreachIntervalMs);

    // 2. Daily consolidation cron
    this.dailyTask = cron.schedule(config.dailyCron, () => {
      this.safeRun('dailyConsolidation', () => this.runDailyConsolidation());
    });

    // 3. Weekly dreaming cron
    this.weeklyTask = cron.schedule(config.weeklyCron, () => {
      this.safeRun('weeklyDreaming', () => this.runWeeklyDreaming());
    });

    // 4. Weekly report cron
    this.weeklyReportTask = cron.schedule(config.weeklyReportCron, () => {
      this.safeRun('weeklyReport', () => this.runWeeklyReport());
    });

    this.running = true;

    console.log(
      `[ProactiveScheduler] Started — heartbeat every ${config.heartbeatIntervalMs}ms, ` +
        `outreach every ${config.outreachIntervalMs}ms, ` +
        `daily cron "${config.dailyCron}", weekly cron "${config.weeklyCron}", ` +
        `weekly report cron "${config.weeklyReportCron}"`,
    );
  }

  /**
   * Stop all scheduler loops, clear the interval, and destroy cron tasks.
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    if (this.heartbeatIntervalId !== null) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }

    if (this.outreachIntervalId !== null) {
      clearInterval(this.outreachIntervalId);
      this.outreachIntervalId = null;
    }

    if (this.dailyTask) {
      this.dailyTask.stop();
      this.dailyTask = null;
    }

    if (this.weeklyTask) {
      this.weeklyTask.stop();
      this.weeklyTask = null;
    }

    if (this.weeklyReportTask) {
      this.weeklyReportTask.stop();
      this.weeklyReportTask = null;
    }

    this.running = false;
    console.log('[ProactiveScheduler] Stopped');
  }

  /** Whether the scheduler is currently running. */
  get isRunning(): boolean {
    return this.running;
  }

  // ---- Heartbeat (all users) ---------------------------------------------

  private async runHeartbeat(): Promise<void> {
    const userIds = this.ucm.getRegisteredUserIds();
    for (const userId of userIds) {
      try {
        const ctx = this.ucm.getContext(userId);
        const heartbeat = new HeartbeatLoop(ctx.db, ctx.userDataManager, userId);
        await heartbeat.run();
      } catch (err) {
        console.error(
          `[ProactiveScheduler] Heartbeat error for user ${userId}:`,
          (err as Error).message,
        );
      }
    }
  }

  private async runOutreachCycle(): Promise<void> {
    const userIds = this.ucm.getRegisteredUserIds();
    for (const userId of userIds) {
      try {
        const ctx = this.ucm.getContext(userId);
        const engine = new OutreachEngine(ctx.db, ctx.userDataManager, userId);
        await engine.runSchedulerCycle();
      } catch (err) {
        console.error(
          `[ProactiveScheduler] Outreach cycle error for user ${userId}:`,
          (err as Error).message,
        );
      }
    }
  }

  // ---- Daily consolidation (all users) -----------------------------------

  private async runDailyConsolidation(): Promise<void> {
    console.log('[ProactiveScheduler] Starting daily consolidation...');
    const startMs = Date.now();

    const userIds = this.ucm.getRegisteredUserIds();
    for (const userId of userIds) {
      try {
        const ctx = this.ucm.getContext(userId);
        const engine = new ConsolidationEngine(ctx.db, ctx.userDataManager);
        const result = await engine.runDailyConsolidation();
        console.log(
          `[ProactiveScheduler] Daily consolidation for user ${userId}:`,
          JSON.stringify(result),
        );
      } catch (err) {
        console.error(
          `[ProactiveScheduler] Daily consolidation error for user ${userId}:`,
          (err as Error).message,
        );
      }
    }

    const elapsedMs = Date.now() - startMs;
    console.log(
      `[ProactiveScheduler] Daily consolidation complete for ${userIds.length} user(s) in ${elapsedMs}ms`,
    );
  }

  // ---- Weekly dreaming (all users) ---------------------------------------

  private async runWeeklyDreaming(): Promise<void> {
    console.log('[ProactiveScheduler] Starting weekly dreaming...');
    const startMs = Date.now();

    const userIds = this.ucm.getRegisteredUserIds();
    for (const userId of userIds) {
      try {
        const ctx = this.ucm.getContext(userId);
        const replay = new GenerativeReplay(ctx.db, ctx.userDataManager);
        const result = await replay.runWeeklyDreaming();
        console.log(
          `[ProactiveScheduler] Weekly dreaming for user ${userId}:`,
          JSON.stringify(result),
        );
      } catch (err) {
        console.error(
          `[ProactiveScheduler] Weekly dreaming error for user ${userId}:`,
          (err as Error).message,
        );
      }
    }

    const elapsedMs = Date.now() - startMs;
    console.log(
      `[ProactiveScheduler] Weekly dreaming complete for ${userIds.length} user(s) in ${elapsedMs}ms`,
    );
  }

  // ---- Weekly report (all users) ------------------------------------------

  private async runWeeklyReport(): Promise<void> {
    console.log('[ProactiveScheduler] Starting weekly report...');
    const startMs = Date.now();

    const userIds = this.ucm.getRegisteredUserIds();
    for (const userId of userIds) {
      try {
        const ctx = this.ucm.getContext(userId);
        const reporter = new WeeklyReporter(ctx.db, ctx.userDataManager, userId);
        const result = await reporter.generateWeeklyReport();
        console.log(
          `[ProactiveScheduler] Weekly report for user ${userId}:`,
          JSON.stringify(result),
        );
      } catch (err) {
        console.error(
          `[ProactiveScheduler] Weekly report error for user ${userId}:`,
          (err as Error).message,
        );
      }
    }

    const elapsedMs = Date.now() - startMs;
    console.log(
      `[ProactiveScheduler] Weekly report complete for ${userIds.length} user(s) in ${elapsedMs}ms`,
    );
  }

  // ---- Error wrapper ------------------------------------------------------

  /**
   * Execute an async task, catching and logging any errors so the
   * scheduler loop is never broken by an unhandled rejection.
   */
  private async safeRun(label: string, fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      console.error(
        `[ProactiveScheduler] Error in ${label}:`,
        err instanceof Error ? err.stack ?? err.message : String(err),
      );
    }
  }
}
