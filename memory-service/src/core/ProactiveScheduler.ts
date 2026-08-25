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
import { RelationshipRadarService } from './RelationshipRadarService.js';
import { TodayPilotMeetingPrepService } from './TodayPilotMeetingPrepService.js';
import { UserContextManager } from './UserContextManager.js';
import { getAnalyticsStore } from '../analytics/AnalyticsStore.js';
import { runWithUsageContext } from '../analytics/usageContext.js';
import { KeystoneBriefComposerService } from './KeystoneBriefComposerService.js';
import { tickAutoBackups } from './AutoBackupService.js';
import { sweepExpiredExportJobs } from './ExportJobService.js';

// Usage-analytics rollup cron schedules (independent of proactive features).
const USAGE_ROLLUP_HOURLY_CRON = '0 * * * *';
const USAGE_ROLLUP_DAILY_CRON = '20 0 * * *';
const DEFAULT_KEYSTONE_COMPOSER_INTERVAL_MS = 15 * 60 * 1000;
const AUTO_BACKUP_INTERVAL_MS = 15 * 60 * 1000;

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
  private todayPilotPrepTask: ReturnType<typeof cron.schedule> | null = null;
  private usageRollupHourlyTask: ReturnType<typeof cron.schedule> | null = null;
  private usageRollupDailyTask: ReturnType<typeof cron.schedule> | null = null;
  private keystoneComposerIntervalId: ReturnType<typeof setInterval> | null = null;
  private autoBackupIntervalId: ReturnType<typeof setInterval> | null = null;
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

    // Usage-analytics rollup runs regardless of the proactive scheduler flag,
    // so reports have cached daily aggregates even when background features off.
    this.scheduleUsageRollup();
    this.scheduleKeystoneBriefComposer();

    const config = getConfig();
    const startedLoops: string[] = [];

    // Outreach scheduling is independent of the full proactive scheduler.
    // Per-user enablement is enforced inside OutreachEngine.runSchedulerCycle().
    if (process.env.OUTREACH_SCHEDULER_ENABLED !== 'false') {
      this.outreachIntervalId = setInterval(() => {
        this.safeRun('outreach', () => this.runOutreachCycle());
      }, config.outreachIntervalMs);
      startedLoops.push(`outreach every ${config.outreachIntervalMs}ms`);
    } else {
      console.log('[ProactiveScheduler] Outreach scheduler disabled');
    }

    if (process.env.AUTO_BACKUP_SCHEDULER_ENABLED !== 'false') {
      this.autoBackupIntervalId = setInterval(() => {
        this.safeRun('autoBackup', () => this.runAutoBackupCycle());
      }, AUTO_BACKUP_INTERVAL_MS);
      startedLoops.push(`autoBackup every ${AUTO_BACKUP_INTERVAL_MS}ms`);
    } else {
      console.log('[ProactiveScheduler] Auto backup scheduler disabled');
    }

    if (!config.proactiveSchedulerEnabled) {
      console.log(
        '[ProactiveScheduler] Background scheduler disabled; set PROACTIVE_SCHEDULER_ENABLED=true to enable heartbeat and cron jobs',
      );
      if (startedLoops.length > 0) {
        this.running = true;
        console.log(`[ProactiveScheduler] Started - ${startedLoops.join(', ')}`);
      }
      return;
    }

    // 1. Heartbeat loop
    this.heartbeatIntervalId = setInterval(() => {
      this.safeRun('heartbeat', () => this.runHeartbeat());
    }, config.heartbeatIntervalMs);
    startedLoops.push(`heartbeat every ${config.heartbeatIntervalMs}ms`);

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

    if (config.todayPilotMeetingPrepEnabled) {
      this.todayPilotPrepTask = cron.schedule(config.todayPilotPrepCron, () => {
        this.safeRun('todayPilotMeetingPrep', () =>
          this.runTodayPilotMeetingPrep(),
        );
      });
    }

    this.running = true;

    console.log(
      `[ProactiveScheduler] Started - ${startedLoops.join(', ')}, ` +
        `daily cron "${config.dailyCron}", weekly cron "${config.weeklyCron}", ` +
        `weekly report cron "${config.weeklyReportCron}", ` +
        `today pilot prep cron "${config.todayPilotPrepCron}"`,
    );
  }

  /**
   * Stop all scheduler loops, clear the interval, and destroy cron tasks.
   */
  stop(): void {
    // Usage rollup crons run independently of `running`, so stop them first.
    this.stopUsageRollup();
    if (this.keystoneComposerIntervalId !== null) {
      clearInterval(this.keystoneComposerIntervalId);
      this.keystoneComposerIntervalId = null;
    }

    if (this.heartbeatIntervalId !== null) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }

    if (this.outreachIntervalId !== null) {
      clearInterval(this.outreachIntervalId);
      this.outreachIntervalId = null;
    }

    if (this.autoBackupIntervalId !== null) {
      clearInterval(this.autoBackupIntervalId);
      this.autoBackupIntervalId = null;
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

    if (this.todayPilotPrepTask) {
      this.todayPilotPrepTask.stop();
      this.todayPilotPrepTask = null;
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
        const heartbeat = new HeartbeatLoop(
          ctx.db,
          ctx.userDataManager,
          userId,
        );
        await runWithUsageContext(
          { side: 'backend', userId, capability: 'memory_service', feature: 'heartbeat' },
          () => heartbeat.run(),
        );
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
        await runWithUsageContext(
          { side: 'backend', userId, capability: 'memory_service', feature: 'outreach' },
          () => engine.runSchedulerCycle(),
        );
      } catch (err) {
        console.error(
          `[ProactiveScheduler] Outreach cycle error for user ${userId}:`,
          (err as Error).message,
        );
      }
    }
  }

  private async runAutoBackupCycle(): Promise<void> {
    await sweepExpiredExportJobs();
    await tickAutoBackups(this.ucm);
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
        const result = await runWithUsageContext(
          { side: 'backend', userId, capability: 'memory_service', feature: 'daily_consolidation' },
          () => engine.runDailyConsolidation(),
        );
        console.log(
          `[ProactiveScheduler] Daily consolidation for user ${userId}:`,
          JSON.stringify(result),
        );
        const relationshipRadar = new RelationshipRadarService(ctx.db);
        const radarResult = runWithUsageContext(
          { side: 'backend', userId, capability: 'relationship_radar', feature: 'radar_consolidation' },
          () => relationshipRadar.consolidatePeople({ limit: 40 }),
        );
        console.log(
          `[ProactiveScheduler] Relationship radar consolidation for user ${userId}:`,
          JSON.stringify(radarResult),
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
        const result = await runWithUsageContext(
          { side: 'backend', userId, capability: 'memory_service', feature: 'weekly_dreaming' },
          () => replay.runWeeklyDreaming(),
        );
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
        const reporter = new WeeklyReporter(
          ctx.db,
          ctx.userDataManager,
          userId,
        );
        const result = await runWithUsageContext(
          { side: 'backend', userId, capability: 'notification_center', feature: 'weekly_report' },
          () => reporter.generateWeeklyReport(),
        );
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

  private async runTodayPilotMeetingPrep(): Promise<void> {
    const config = getConfig();
    console.log('[ProactiveScheduler] Starting Today Pilot meeting prep...');
    const startMs = Date.now();

    const userIds = this.ucm.getRegisteredUserIds();
    for (const userId of userIds) {
      try {
        const ctx = this.ucm.getContext(userId);
        const service = new TodayPilotMeetingPrepService(ctx.db, userId);
        const result = await runWithUsageContext(
          { side: 'backend', userId, capability: 'today_pilot', feature: 'meeting_prep' },
          () =>
            service.prepare({
              timezone: config.todayPilotTimezone,
              horizonHours: 36,
              maxMeetings: config.todayPilotMeetingPrepMax,
              mode: 'nightly_llm',
            }),
        );
        console.log(
          `[ProactiveScheduler] Today Pilot meeting prep for user ${userId}:`,
          JSON.stringify(result),
        );
      } catch (err) {
        console.error(
          `[ProactiveScheduler] Today Pilot meeting prep error for user ${userId}:`,
          (err as Error).message,
        );
      }
    }

    const elapsedMs = Date.now() - startMs;
    console.log(
      `[ProactiveScheduler] Today Pilot meeting prep complete for ${userIds.length} user(s) in ${elapsedMs}ms`,
    );
  }

  // ---- Usage-analytics rollup --------------------------------------------

  /**
   * Schedule hourly + daily rollup of usage_events into usage_rollup_daily.
   * Runs an immediate rollup on start so reports have data without waiting.
   */
  private scheduleUsageRollup(): void {
    if (!getAnalyticsStore()) {
      return;
    }

    // Immediate rollup (yesterday + today) so the report cache is warm.
    this.safeRun('usageRollupStartup', async () => this.runUsageRollup(2));

    this.usageRollupHourlyTask = cron.schedule(USAGE_ROLLUP_HOURLY_CRON, () => {
      this.safeRun('usageRollupHourly', async () => this.runUsageRollup(1));
    });
    this.usageRollupDailyTask = cron.schedule(USAGE_ROLLUP_DAILY_CRON, () => {
      this.safeRun('usageRollupDaily', async () => this.runUsageRollup(2));
    });

    console.log(
      `[ProactiveScheduler] Usage rollup scheduled - hourly "${USAGE_ROLLUP_HOURLY_CRON}", daily "${USAGE_ROLLUP_DAILY_CRON}"`,
    );
  }

  private stopUsageRollup(): void {
    if (this.usageRollupHourlyTask) {
      this.usageRollupHourlyTask.stop();
      this.usageRollupHourlyTask = null;
    }
    if (this.usageRollupDailyTask) {
      this.usageRollupDailyTask.stop();
      this.usageRollupDailyTask = null;
    }
  }

  private runUsageRollup(days: number): void {
    const store = getAnalyticsStore();
    if (!store) return;
    const rolled = store.rollupRecentDays(days);
    console.log(
      `[ProactiveScheduler] Usage rollup complete for ${rolled.length} day(s): ${rolled.join(', ')}`,
    );
  }

  private scheduleKeystoneBriefComposer(): void {
    const enabled = process.env.KEYSTONE_BRIEF_COMPOSER_ENABLED?.trim().toLowerCase();
    if (enabled && ['0', 'false', 'no', 'off'].includes(enabled)) {
      console.log('[ProactiveScheduler] Keystone brief composer disabled');
      return;
    }
    const configuredInterval = Number.parseInt(
      process.env.KEYSTONE_BRIEF_COMPOSER_INTERVAL_MS || '',
      10,
    );
    const intervalMs = Number.isFinite(configuredInterval)
      ? Math.max(60_000, configuredInterval)
      : DEFAULT_KEYSTONE_COMPOSER_INTERVAL_MS;

    this.safeRun('keystoneBriefComposerStartup', () =>
      this.runKeystoneBriefComposer(),
    );
    this.keystoneComposerIntervalId = setInterval(() => {
      this.safeRun('keystoneBriefComposer', () => this.runKeystoneBriefComposer());
    }, intervalMs);
    this.keystoneComposerIntervalId.unref?.();
    console.log(
      `[ProactiveScheduler] Keystone brief composer scheduled every ${intervalMs}ms`,
    );
  }

  private async runKeystoneBriefComposer(): Promise<void> {
    const userIds = this.ucm.getRegisteredUserIds();
    for (const userId of userIds) {
      const context = this.ucm.getContext(userId);
      const result = await new KeystoneBriefComposerService(context.db).run({
        maxBriefs: 2,
      });
      if (result.composed > 0 || result.failed > 0) {
        console.log(
          `[ProactiveScheduler] Keystone briefs for ${userId}: composed=${result.composed}, ready=${result.ready}, partial=${result.partial}, stale=${result.stale}, failed=${result.failed}`,
        );
      }
    }
  }

  // ---- Error wrapper ------------------------------------------------------

  /**
   * Execute an async task, catching and logging any errors so the
   * scheduler loop is never broken by an unhandled rejection.
   */
  private async safeRun(
    label: string,
    fn: () => Promise<unknown>,
  ): Promise<void> {
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
