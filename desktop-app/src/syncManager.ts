import type { BridgeConfig } from './config.js';
import {
  BridgeMemoryServiceClient,
  BridgeMemoryServiceHttpError,
  type ProviderMemoryProduct,
  type RenderContextPackageResponse,
} from './memoryServiceClient.js';
import { BridgeSettingsStore } from './settings.js';
import { DoubaoBridgeService } from './bridgeService.js';
import type {
  AutoSyncKind,
  BridgeSyncAttemptLogEntry,
  BridgeSyncAttemptStatus,
} from './types.js';
import type { ExplorerManager } from './explorer/index.js';
import type { LocalSkillSyncManager } from './skillSync/localSkillSyncManager.js';

interface SyncState {
  stableMemory?: number;
  mobileBriefing?: number;
  reminderSync?: number;
}

export type SyncAttemptStatus = BridgeSyncAttemptStatus;

export interface SyncAttemptResult {
  status: SyncAttemptStatus;
  errorMessage?: string;
}

export interface SyncTaskSnapshot {
  intervalMs: number;
  lastRunAt?: string;
  nextDueAt?: string;
  due: boolean;
}

export interface BridgeSyncManagerSnapshot {
  timerActive: boolean;
  running: boolean;
  autoSyncEnabled: boolean;
  memoryServiceConfigured: boolean;
  pollIntervalMs: number;
  lastErrorAt?: string;
  lastErrorMessage?: string;
  recentAttempts: BridgeSyncAttemptLogEntry[];
  tasks: {
    stableMemory: SyncTaskSnapshot;
    mobileBriefing: SyncTaskSnapshot;
    reminderSync: SyncTaskSnapshot;
  };
}

const MAX_RECENT_ATTEMPTS = 8;

function stripMarkdown(line: string): string {
  return line
    .replace(/^#+\s*/, '')
    .replace(/^>\s*/, '')
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/^_+|_+$/g, '')
    .trim();
}

function isPlaceholderOrMetadataLine(rawLine: string, value: string): boolean {
  const raw = rawLine.trim();
  const normalized = value.toLowerCase();
  if (!value) return true;
  if (raw.startsWith('#')) return true;
  if (/^freshness window\b/i.test(value)) return true;
  if (/watch rules\s*\/\s*concerned items/i.test(value)) return true;
  if (
    /^(no recent|no stable|no pending|no notices?|no data available)\b/i.test(
      value,
    )
  ) {
    return true;
  }
  if (/^暂无/.test(value)) return true;
  if (raw.startsWith('>') && /no recent|no data|暂无/.test(normalized)) {
    return true;
  }
  return false;
}

function extractBullets(pkg: ProviderMemoryProduct, limit = 6): string[] {
  const lines = pkg.bodyMd
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const bullets: string[] = [];

  for (const line of lines) {
    if (line.startsWith('#')) continue;
    if (
      line.startsWith('- ') ||
      line.startsWith('* ') ||
      /^\d+\.\s/.test(line)
    ) {
      const value = stripMarkdown(line);
      if (!isPlaceholderOrMetadataLine(line, value)) {
        bullets.push(value);
      }
      if (bullets.length >= limit) break;
    }
  }

  if (bullets.length > 0) return bullets.slice(0, limit);

  const fallback: string[] = [];
  for (const line of lines) {
    const value = stripMarkdown(line);
    if (!isPlaceholderOrMetadataLine(line, value)) {
      fallback.push(value);
    }
    if (fallback.length >= limit) break;
  }
  return fallback;
}

function packageHasItems(pkg: ProviderMemoryProduct): boolean {
  if (typeof pkg.itemCount === 'number') {
    return pkg.itemCount > 0;
  }
  return Array.isArray(pkg.sourceRefs) && pkg.sourceRefs.length > 0;
}

function actionablePackages(
  rendered: RenderContextPackageResponse,
): ProviderMemoryProduct[] {
  return rendered.packages.filter((pkg) => packageHasItems(pkg));
}

function extractReminders(pkg: ProviderMemoryProduct, limit = 8) {
  return extractBullets(pkg, limit).map((title) => ({
    title,
    severity: 'medium' as const,
  }));
}

function extractNotices(pkg: ProviderMemoryProduct, limit = 8) {
  return extractBullets(pkg, limit).map((line) => {
    const separator = line.indexOf(' - ');
    if (separator >= 0) {
      return {
        title: line.slice(0, separator).trim(),
        body: line.slice(separator + 3).trim() || undefined,
        priority: 'normal' as const,
      };
    }
    return {
      title: line,
      priority: 'normal' as const,
    };
  });
}

function syncResultToAttempt(result: {
  accepted?: boolean;
  error?: string;
}): SyncAttemptResult {
  if (result.accepted && !result.error) {
    return { status: 'succeeded' };
  }
  return {
    status: 'failed',
    errorMessage: result.error || 'Transcript was not sent',
  };
}

function shouldAdvanceSyncState(result: SyncAttemptResult): boolean {
  return result.status !== 'failed';
}

export class BridgeSyncManager {
  private timer: NodeJS.Timeout | null = null;
  private syncState: SyncState = {};
  private running = false;
  private settingsUnsubscribe: (() => void) | null = null;
  private providerScenariosCache?: { value: Set<string>; fetchedAt: number };
  private lastError?: { message: string; occurredAt: number };
  private recentAttempts: BridgeSyncAttemptLogEntry[] = [];
  private attemptSequence = 0;

  constructor(
    private readonly config: BridgeConfig,
    private readonly settingsStore: BridgeSettingsStore,
    private readonly memoryClient: BridgeMemoryServiceClient,
    private readonly bridgeService: DoubaoBridgeService,
    private readonly explorerManager?: ExplorerManager,
    private readonly localSkillSyncManager?: LocalSkillSyncManager,
  ) {}

  start(): void {
    if (this.settingsUnsubscribe) return;
    this.settingsUnsubscribe = this.settingsStore.subscribe(() => {
      this.reconfigure();
    });
    this.reconfigure();
  }

  stop(): void {
    this.clearTimer();
    this.settingsUnsubscribe?.();
    this.settingsUnsubscribe = null;
  }

  reload(): void {
    if (!this.settingsUnsubscribe) {
      this.start();
      return;
    }
    this.reconfigure();
  }

  getSnapshot(): BridgeSyncManagerSnapshot {
    const settings = this.settingsStore.getSettings();
    return {
      timerActive: !!this.timer,
      running: this.running,
      autoSyncEnabled: settings.autoSync,
      memoryServiceConfigured: Boolean(
        settings.memoryServiceBaseUrl && settings.memoryServiceUserId,
      ),
      pollIntervalMs: settings.pollIntervalMs,
      lastErrorAt: this.lastError
        ? new Date(this.lastError.occurredAt).toISOString()
        : undefined,
      lastErrorMessage: this.lastError?.message,
      recentAttempts: [...this.recentAttempts],
      tasks: {
        stableMemory: this.taskSnapshot(
          this.syncState.stableMemory,
          settings.stableMemoryIntervalMs,
        ),
        mobileBriefing: this.taskSnapshot(
          this.syncState.mobileBriefing,
          settings.mobileBriefingIntervalMs,
        ),
        reminderSync: this.taskSnapshot(
          this.syncState.reminderSync,
          settings.reminderSyncIntervalMs,
        ),
      },
    };
  }

  private reconfigure(): void {
    this.clearTimer();
    const settings = this.settingsStore.getSettings();
    if (!settings.autoSync || !this.memoryClient.isEnabled()) return;

    this.timer = setInterval(() => {
      void this.tick();
    }, settings.pollIntervalMs);

    void this.tick();
  }

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private taskSnapshot(
    lastRunAtMs: number | undefined,
    intervalMs: number,
  ): SyncTaskSnapshot {
    return {
      intervalMs,
      lastRunAt: lastRunAtMs ? new Date(lastRunAtMs).toISOString() : undefined,
      nextDueAt: lastRunAtMs
        ? new Date(lastRunAtMs + intervalMs).toISOString()
        : undefined,
      due: this.due(lastRunAtMs, intervalMs),
    };
  }

  private due(lastRunAt: number | undefined, intervalMs: number): boolean {
    return !lastRunAt || Date.now() - lastRunAt >= intervalMs;
  }

  private async getSupportedScenarios(): Promise<Set<string>> {
    if (
      this.providerScenariosCache &&
      Date.now() - this.providerScenariosCache.fetchedAt < 60_000
    ) {
      return this.providerScenariosCache.value;
    }

    const capabilities = await this.memoryClient.getProviderCapabilities(
      this.config.provider,
    );
    const value = new Set(capabilities.supportedScenarios || []);
    this.providerScenariosCache = {
      value,
      fetchedAt: Date.now(),
    };
    return value;
  }

  private async supportsScenario(scenario: string): Promise<boolean> {
    const supportedScenarios = await this.getSupportedScenarios();
    return supportedScenarios.has(scenario);
  }

  private recordSyncError(error: unknown): void {
    this.lastError = {
      message: error instanceof Error ? error.message : String(error),
      occurredAt: Date.now(),
    };
  }

  private recordSyncAttemptFailure(result: SyncAttemptResult): void {
    this.lastError = {
      message: result.errorMessage || 'Auto sync failed',
      occurredAt: Date.now(),
    };
  }

  private clearSyncError(): void {
    this.lastError = undefined;
  }

  private recordSyncAttempt(input: {
    kind: AutoSyncKind;
    trigger: BridgeSyncAttemptLogEntry['trigger'];
    status: SyncAttemptStatus;
    startedAtMs: number;
    completedAtMs: number;
    errorMessage?: string;
  }): void {
    this.attemptSequence += 1;
    const entry: BridgeSyncAttemptLogEntry = {
      id: `${input.startedAtMs}-${this.attemptSequence}-${input.kind}`,
      kind: input.kind,
      trigger: input.trigger,
      status: input.status,
      startedAt: new Date(input.startedAtMs).toISOString(),
      completedAt: new Date(input.completedAtMs).toISOString(),
      durationMs: Math.max(0, input.completedAtMs - input.startedAtMs),
      errorMessage: input.errorMessage,
    };
    this.recentAttempts = [entry, ...this.recentAttempts].slice(
      0,
      MAX_RECENT_ATTEMPTS,
    );
  }

  private async trackSyncAttempt(
    kind: AutoSyncKind,
    trigger: BridgeSyncAttemptLogEntry['trigger'],
    run: () => Promise<SyncAttemptResult>,
  ): Promise<SyncAttemptResult> {
    const startedAtMs = Date.now();
    try {
      const result = await run();
      this.recordSyncAttempt({
        kind,
        trigger,
        status: result.status,
        startedAtMs,
        completedAtMs: Date.now(),
        errorMessage: result.errorMessage,
      });
      return result;
    } catch (error) {
      this.recordSyncAttempt({
        kind,
        trigger,
        status: 'failed',
        startedAtMs,
        completedAtMs: Date.now(),
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private collectSourceRefs(rendered: RenderContextPackageResponse): string[] {
    return Array.from(
      new Set(
        rendered.packages
          .flatMap((pkg) => pkg.sourceRefs || [])
          .filter(Boolean),
      ),
    );
  }

  private async reportDelivery(
    rendered: RenderContextPackageResponse,
    lane: 'todo' | 'notice',
    status: 'delivered' | 'failed',
    error?: string,
  ): Promise<void> {
    const sourceRefs = this.collectSourceRefs(rendered);
    if (sourceRefs.length === 0) return;

    try {
      await this.memoryClient.reportNotificationDelivery(
        sourceRefs.map((sourceRef) => ({
          sourceRef,
          channel: 'doubao',
          lane,
          status,
          error,
        })),
      );
    } catch (deliveryError) {
      if (
        deliveryError instanceof BridgeMemoryServiceHttpError &&
        (deliveryError.status === 404 || deliveryError.status === 501)
      ) {
        console.warn(
          '[doubao-bridge] memory-service does not support notification-center delivery reporting yet',
        );
        return;
      }
      throw deliveryError;
    }
  }

  async tick(): Promise<void> {
    const settings = this.settingsStore.getSettings();
    if (this.running || !settings.autoSync || !this.memoryClient.isEnabled())
      return;
    this.running = true;

    try {
      let attemptedSync = false;
      let failedAttempt: SyncAttemptResult | undefined;
      const status = await this.bridgeService.getStatus();
      if (status.authStatus === 'connected') {
        // 长期记忆同步 - 使用随手记格式
        if (
          status.bindings.memory_sync &&
          this.due(this.syncState.stableMemory, settings.stableMemoryIntervalMs)
        ) {
          const result = await this.trackSyncAttempt(
            'stable_memory',
            'auto',
            () => this.syncStableMemoryAsMemo(),
          );
          attemptedSync = true;
          if (result.status === 'failed' && !failedAttempt) {
            failedAttempt = result;
          }
          if (shouldAdvanceSyncState(result)) {
            this.syncState.stableMemory = Date.now();
          }
        }

        if (
          status.bindings.mobile_context &&
          this.due(
            this.syncState.mobileBriefing,
            settings.mobileBriefingIntervalMs,
          )
        ) {
          const result = await this.trackSyncAttempt(
            'mobile_briefing',
            'auto',
            () => this.syncMobileBriefing(),
          );
          attemptedSync = true;
          if (result.status === 'failed' && !failedAttempt) {
            failedAttempt = result;
          }
          if (shouldAdvanceSyncState(result)) {
            this.syncState.mobileBriefing = Date.now();
          }
        }

        // 待办 / 通知同步
        if (
          status.bindings.mobile_context &&
          this.due(this.syncState.reminderSync, settings.reminderSyncIntervalMs)
        ) {
          const result = await this.trackSyncAttempt(
            'reminder_sync',
            'auto',
            () => this.syncReminderChannels(),
          );
          attemptedSync = true;
          if (result.status === 'failed' && !failedAttempt) {
            failedAttempt = result;
          }
          if (shouldAdvanceSyncState(result)) {
            this.syncState.reminderSync = Date.now();
          }
        }
      }

      if (this.explorerManager) {
        await this.explorerManager.tick();
      }
      await this.localSkillSyncManager?.tick();
      if (failedAttempt) {
        this.recordSyncAttemptFailure(failedAttempt);
      } else if (attemptedSync) {
        this.clearSyncError();
      }
    } catch (error) {
      this.recordSyncError(error);
      console.error('[doubao-bridge] auto-sync tick failed:', error);
    } finally {
      this.running = false;
    }
  }

  async runNow(kind: AutoSyncKind): Promise<SyncAttemptResult> {
    let result: SyncAttemptResult;
    try {
      if (kind === 'stable_memory') {
        result = await this.trackSyncAttempt(kind, 'manual', () =>
          this.syncStableMemoryAsMemo(),
        );
        this.assertSyncAttemptSucceeded(kind, result);
        this.syncState.stableMemory = Date.now();
        this.clearSyncError();
        return result;
      }

      if (kind === 'mobile_briefing') {
        result = await this.trackSyncAttempt(kind, 'manual', () =>
          this.syncMobileBriefing(),
        );
        this.assertSyncAttemptSucceeded(kind, result);
        this.syncState.mobileBriefing = Date.now();
        this.clearSyncError();
        return result;
      }

      result = await this.trackSyncAttempt(kind, 'manual', () =>
        this.syncReminderChannels(),
      );
      this.assertSyncAttemptSucceeded(kind, result);
      this.syncState.reminderSync = Date.now();
      this.clearSyncError();
      return result;
    } catch (error) {
      this.recordSyncError(error);
      throw error;
    }
  }

  private assertSyncAttemptSucceeded(
    kind: AutoSyncKind,
    result: SyncAttemptResult,
  ): void {
    if (result.status !== 'failed') return;
    throw new Error(result.errorMessage || `${kind} sync failed`);
  }

  private async syncStableMemory(): Promise<SyncAttemptResult> {
    const startedAt = Date.now();
    const rendered = await this.memoryClient.renderContextPackage({
      provider: this.config.provider,
      scenario: 'stable_memory',
      deviceContext: 'doubao_bridge_daemon',
    });
    const packages = actionablePackages(rendered);
    if (packages.length === 0) {
      const reason = 'No stable memory items to sync';
      await this.reportSkipped(rendered, startedAt, reason);
      return { status: 'skipped', errorMessage: reason };
    }

    const result = await this.bridgeService.syncStableMemory({
      items: packages.map((pkg) => ({
        title: pkg.title,
        body: pkg.bodyMd,
      })),
    });

    await this.report(
      rendered,
      result.accepted && !result.error ? 'succeeded' : 'failed',
      startedAt,
      result.error,
      result.threadId,
    );

    return syncResultToAttempt(result);
  }

  private async syncMobileBriefing(): Promise<SyncAttemptResult> {
    const startedAt = Date.now();
    const rendered = await this.memoryClient.renderContextPackage({
      provider: this.config.provider,
      scenario: 'mobile_briefing',
      deviceContext: 'doubao_bridge_daemon',
    });
    const packages = actionablePackages(rendered);
    if (packages.length === 0) {
      const reason = 'No recent memory highlights to sync';
      await this.reportSkipped(rendered, startedAt, reason);
      return { status: 'skipped', errorMessage: reason };
    }

    const bullets = packages
      .flatMap((pkg) => extractBullets(pkg, 5))
      .slice(0, 12);
    if (bullets.length === 0) {
      const reason = 'No mobile briefing bullets extracted';
      await this.reportSkipped(rendered, startedAt, reason);
      return { status: 'skipped', errorMessage: reason };
    }

    const result = await this.bridgeService.syncMobileBriefing({
      title: '自动同步的近期记忆重点',
      bullets,
    });

    await this.report(
      rendered,
      result.accepted && !result.error ? 'succeeded' : 'failed',
      startedAt,
      result.error,
      result.threadId,
    );

    return syncResultToAttempt(result);
  }

  private async syncReminders(): Promise<SyncAttemptResult> {
    const startedAt = Date.now();
    const rendered = await this.memoryClient.renderContextPackage({
      provider: this.config.provider,
      scenario: 'reminder_sync',
      deviceContext: 'doubao_bridge_daemon',
    });
    const reminders = rendered.packages
      .flatMap((pkg) => extractReminders(pkg))
      .slice(0, 8);
    if (reminders.length === 0) {
      return { status: 'skipped' };
    }

    const result = await this.bridgeService.syncReminders({
      reminders,
    });

    await this.report(
      rendered,
      result.accepted && !result.error ? 'succeeded' : 'failed',
      startedAt,
      result.error,
      result.threadId,
    );

    return syncResultToAttempt(result);
  }

  /**
   * 使用随手记格式同步长期记忆
   * 自动分类并格式化为豆包随手记
   */
  async syncStableMemoryAsMemo(): Promise<SyncAttemptResult> {
    const startedAt = Date.now();
    const rendered = await this.memoryClient.renderContextPackage({
      provider: this.config.provider,
      scenario: 'stable_memory',
      deviceContext: 'doubao_bridge_daemon',
    });
    const packages = actionablePackages(rendered);
    if (packages.length === 0) {
      const reason = 'No stable memory items to sync';
      await this.reportSkipped(rendered, startedAt, reason);
      return { status: 'skipped', errorMessage: reason };
    }

    const result = await this.bridgeService.syncStableMemoryAsMemo({
      items: packages.map((pkg) => ({
        title: pkg.title,
        body: pkg.bodyMd,
      })),
    });

    await this.report(
      rendered,
      result.accepted && !result.error ? 'succeeded' : 'failed',
      startedAt,
      result.error,
      result.threadId,
    );

    return syncResultToAttempt(result);
  }

  private async syncReminderChannels(): Promise<SyncAttemptResult> {
    const results = [await this.syncTodosAsMemo(), await this.syncNotices()];
    const failed = results.find((result) => result.status === 'failed');
    if (failed) {
      return failed;
    }
    if (results.some((result) => result.status === 'succeeded')) {
      return { status: 'succeeded' };
    }
    const skippedReasons = results
      .map((result) => result.errorMessage)
      .filter((message): message is string => Boolean(message));
    return {
      status: 'skipped',
      errorMessage:
        skippedReasons.join(' / ') || 'No pending todos or notices to sync',
    };
  }

  async syncTodosAsMemo(): Promise<SyncAttemptResult> {
    const startedAt = Date.now();
    const rendered = await this.renderTodoPackage();
    const packages = actionablePackages(rendered);
    if (packages.length === 0) {
      const reason = 'No pending todos to sync';
      await this.reportSkipped(rendered, startedAt, reason);
      return { status: 'skipped', errorMessage: reason };
    }

    const reminders = packages
      .flatMap((pkg) => extractReminders(pkg))
      .slice(0, 8);
    if (reminders.length === 0) {
      const reason = 'No todo titles extracted';
      await this.reportSkipped(rendered, startedAt, reason);
      return { status: 'skipped', errorMessage: reason };
    }

    const result = await this.bridgeService.syncTodosAsMemo({
      reminders,
    });

    const attempt = syncResultToAttempt(result);
    await this.reportDelivery(
      rendered,
      'todo',
      attempt.status === 'succeeded' ? 'delivered' : 'failed',
      attempt.errorMessage,
    );

    await this.report(
      rendered,
      attempt.status === 'succeeded' ? 'succeeded' : 'failed',
      startedAt,
      result.error,
      result.threadId,
    );

    return attempt;
  }

  async syncRemindersAsMemo(): Promise<SyncAttemptResult> {
    return this.syncTodosAsMemo();
  }

  async syncNotices(): Promise<SyncAttemptResult> {
    const startedAt = Date.now();
    const supported = await this.supportsScenario('notice_sync');
    if (!supported) {
      console.warn(
        '[doubao-bridge] memory-service does not support notice_sync yet, skipping notice push',
      );
      return {
        status: 'skipped',
        errorMessage: 'Notice sync is not supported by Memory Service',
      };
    }

    const rendered = await this.memoryClient.renderContextPackage({
      provider: this.config.provider,
      scenario: 'notice_sync',
      deviceContext: 'doubao_bridge_daemon',
    });
    const packages = actionablePackages(rendered);
    if (packages.length === 0) {
      const reason = 'No notices to sync';
      await this.reportSkipped(rendered, startedAt, reason);
      return { status: 'skipped', errorMessage: reason };
    }

    const notices = packages.flatMap((pkg) => extractNotices(pkg)).slice(0, 8);
    if (notices.length === 0) {
      const reason = 'No notice titles extracted';
      await this.reportSkipped(rendered, startedAt, reason);
      return { status: 'skipped', errorMessage: reason };
    }

    const result = await this.bridgeService.syncNotices({
      notices,
    });

    const attempt = syncResultToAttempt(result);
    await this.reportDelivery(
      rendered,
      'notice',
      attempt.status === 'succeeded' ? 'delivered' : 'failed',
      attempt.errorMessage,
    );

    await this.report(
      rendered,
      attempt.status === 'succeeded' ? 'succeeded' : 'failed',
      startedAt,
      result.error,
      result.threadId,
    );

    return attempt;
  }

  private async renderTodoPackage(): Promise<RenderContextPackageResponse> {
    const supported = await this.supportsScenario('todo_sync');
    return this.memoryClient.renderContextPackage({
      provider: this.config.provider,
      scenario: supported ? 'todo_sync' : 'reminder_sync',
      deviceContext: 'doubao_bridge_daemon',
    });
  }

  private async reportSkipped(
    rendered: RenderContextPackageResponse,
    startedAt: number,
    reason: string,
  ): Promise<void> {
    if (!rendered.syncJob?.id) return;

    await this.memoryClient.reportSyncJob(
      rendered.provider,
      rendered.syncJob.id,
      {
        status: 'skipped',
        errorMessage: reason,
        result: {
          packageKinds: rendered.packages.map((pkg) => pkg.kind),
          reason,
        },
        startedAt,
        completedAt: Date.now(),
      },
    );
  }

  private async report(
    rendered: RenderContextPackageResponse,
    status: 'succeeded' | 'failed',
    startedAt: number,
    errorMessage?: string,
    externalThreadId?: string,
  ): Promise<void> {
    if (!rendered.syncJob?.id) return;

    await this.memoryClient.reportSyncJob(
      rendered.provider,
      rendered.syncJob.id,
      {
        status,
        errorMessage,
        externalThreadId,
        result: {
          packageKinds: rendered.packages.map((pkg) => pkg.kind),
        },
        startedAt,
        completedAt: Date.now(),
      },
    );
  }
}
