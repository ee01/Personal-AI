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
  SyncResult,
} from './types.js';
import type { ExplorerManager } from './explorer/index.js';
import type { LocalSkillSyncManager } from './skillSync/localSkillSyncManager.js';

interface SyncState {
  stableMemory?: number;
  mobileBriefing?: number;
  reminderSync?: number;
  reminderDailyDigest?: number;
}

type ReminderDeliveryMode = 'new_items' | 'daily_digest' | 'manual';

export type SyncAttemptStatus = BridgeSyncAttemptStatus;

export interface SyncAttemptResult {
  status: SyncAttemptStatus;
  errorMessage?: string;
  externalThreadId?: string;
  packageKinds?: string[];
  packageItemCount?: number;
  sourceRefCount?: number;
  transportUsed?: SyncResult['transportUsed'];
  transportMode?: SyncResult['transportMode'];
  transportFallbackReason?: string;
  verified?: boolean;
  messageVisible?: boolean;
  challengeDetected?: boolean;
  telemetryError?: string;
  reminderDeliveryMode?: ReminderDeliveryMode;
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

export interface BridgeSyncManagerOptions {
  initialAttempts?: BridgeSyncAttemptLogEntry[];
  onRecentAttemptsChanged?: (
    attempts: BridgeSyncAttemptLogEntry[],
  ) => void | Promise<void>;
}

function normalizeRecentAttempts(
  attempts: BridgeSyncAttemptLogEntry[] | undefined,
): BridgeSyncAttemptLogEntry[] {
  if (!Array.isArray(attempts)) return [];
  return attempts
    .filter(
      (attempt) =>
        attempt &&
        typeof attempt.id === 'string' &&
        typeof attempt.kind === 'string' &&
        typeof attempt.startedAt === 'string' &&
        typeof attempt.completedAt === 'string',
    )
    .slice(0, MAX_RECENT_ATTEMPTS);
}

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

function normalizeTextForDedupe(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[.,;:，。；：]+$/g, '')
    .trim()
    .toLowerCase();
}

function uniqueTextItems(items: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const item of items) {
    const key = normalizeTextForDedupe(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
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
  threadId?: string;
  transportUsed?: SyncResult['transportUsed'];
  transportMode?: SyncResult['transportMode'];
  transportFallbackReason?: string;
  verified?: boolean;
  challengeDetected?: boolean;
  messageVisible?: boolean;
}, metadata: SyncAttemptMetadata = {}): SyncAttemptResult {
  const attemptMetadata = cleanAttemptMetadata({
    ...metadata,
    externalThreadId: result.threadId || metadata.externalThreadId,
    transportUsed: result.transportUsed || metadata.transportUsed,
    transportMode: result.transportMode || metadata.transportMode,
    transportFallbackReason:
      result.transportFallbackReason || metadata.transportFallbackReason,
    verified: result.verified ?? metadata.verified,
    challengeDetected: result.challengeDetected ?? metadata.challengeDetected,
    messageVisible: result.messageVisible ?? metadata.messageVisible,
  });
  if (result.accepted && !result.error) {
    return { status: 'succeeded', ...attemptMetadata };
  }
  return {
    status: 'failed',
    errorMessage: result.error || 'Transcript was not sent',
    ...attemptMetadata,
  };
}

function shouldAdvanceSyncState(result: SyncAttemptResult): boolean {
  return result.status !== 'failed';
}

function parseTimeOfDay(value: string | undefined): {
  hours: number;
  minutes: number;
} {
  const match = (value || '09:00').match(/^(\d{1,2}):(\d{2})$/);
  const hours = match ? Number(match[1]) : 9;
  const minutes = match ? Number(match[2]) : 0;
  if (
    Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59
  ) {
    return { hours, minutes };
  }
  return { hours: 9, minutes: 0 };
}

function todayAtMs(timeOfDay: string | undefined): number {
  const { hours, minutes } = parseTimeOfDay(timeOfDay);
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);
  return target.getTime();
}

function shouldRunDailyReminderDigest(input: {
  enabled?: boolean;
  timeOfDay?: string;
  lastRunAt?: number;
}): boolean {
  if (input.enabled === false) return false;
  const targetMs = todayAtMs(input.timeOfDay);
  const nowMs = Date.now();
  if (nowMs < targetMs) return false;
  return !input.lastRunAt || input.lastRunAt < targetMs;
}

function latestReminderDailyDigestRun(
  attempts: BridgeSyncAttemptLogEntry[],
): number | undefined {
  for (const attempt of attempts) {
    if (
      attempt.kind !== 'reminder_sync' ||
      attempt.reminderDeliveryMode !== 'daily_digest' ||
      attempt.status === 'failed'
    ) {
      continue;
    }
    const completedAt = Date.parse(attempt.completedAt);
    if (Number.isFinite(completedAt)) return completedAt;
  }
  return undefined;
}

type SyncAttemptMetadata = Omit<
  SyncAttemptResult,
  'status' | 'errorMessage'
>;
type AttemptBooleanMetadataKey =
  | 'verified'
  | 'messageVisible'
  | 'challengeDetected';

function formatTelemetryError(prefix: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${prefix}: ${message}`;
}

function mergeTelemetryErrors(
  ...errors: Array<string | undefined>
): string | undefined {
  const unique = Array.from(
    new Set(errors.map((error) => error?.trim()).filter(Boolean) as string[]),
  );
  return unique.length > 0 ? unique.join(' / ') : undefined;
}

function mergeTextValues(
  ...values: Array<string | undefined>
): string | undefined {
  const unique = Array.from(
    new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
  );
  return unique.length > 0 ? unique.join(' / ') : undefined;
}

function withTelemetryError<T extends SyncAttemptResult>(
  result: T,
  ...errors: Array<string | undefined>
): T {
  const telemetryError = mergeTelemetryErrors(result.telemetryError, ...errors);
  return telemetryError ? { ...result, telemetryError } : result;
}

function cleanAttemptMetadata(
  metadata: SyncAttemptMetadata,
): SyncAttemptMetadata {
  const cleaned: SyncAttemptMetadata = {};
  if (metadata.externalThreadId) {
    cleaned.externalThreadId = metadata.externalThreadId;
  }
  if (metadata.packageKinds?.length) {
    cleaned.packageKinds = metadata.packageKinds;
  }
  if (typeof metadata.packageItemCount === 'number') {
    cleaned.packageItemCount = metadata.packageItemCount;
  }
  if (typeof metadata.sourceRefCount === 'number') {
    cleaned.sourceRefCount = metadata.sourceRefCount;
  }
  if (metadata.transportUsed) {
    cleaned.transportUsed = metadata.transportUsed;
  }
  if (metadata.transportMode) {
    cleaned.transportMode = metadata.transportMode;
  }
  if (metadata.transportFallbackReason) {
    cleaned.transportFallbackReason = metadata.transportFallbackReason;
  }
  if (typeof metadata.verified === 'boolean') {
    cleaned.verified = metadata.verified;
  }
  if (typeof metadata.messageVisible === 'boolean') {
    cleaned.messageVisible = metadata.messageVisible;
  }
  if (typeof metadata.challengeDetected === 'boolean') {
    cleaned.challengeDetected = metadata.challengeDetected;
  }
  if (metadata.telemetryError) {
    cleaned.telemetryError = metadata.telemetryError;
  }
  if (
    metadata.reminderDeliveryMode === 'new_items' ||
    metadata.reminderDeliveryMode === 'daily_digest' ||
    metadata.reminderDeliveryMode === 'manual'
  ) {
    cleaned.reminderDeliveryMode = metadata.reminderDeliveryMode;
  }
  return cleaned;
}

function packageMetadata(
  rendered: RenderContextPackageResponse,
): Pick<
  SyncAttemptResult,
  'packageKinds' | 'packageItemCount' | 'sourceRefCount'
> {
  const packageKinds = Array.from(
    new Set(rendered.packages.map((pkg) => pkg.kind).filter(Boolean)),
  );
  const itemCounts = rendered.packages
    .map((pkg) => pkg.itemCount)
    .filter((value): value is number => typeof value === 'number');
  const sourceRefCount = new Set(
    rendered.packages
      .flatMap((pkg) => pkg.sourceRefs || [])
      .filter(Boolean),
  ).size;

  return {
    packageKinds,
    packageItemCount:
      itemCounts.length > 0
        ? itemCounts.reduce((total, count) => total + count, 0)
        : undefined,
    sourceRefCount,
  };
}

function mergeAttemptMetadata(
  results: SyncAttemptResult[],
): SyncAttemptMetadata {
  const packageKinds = Array.from(
    new Set(results.flatMap((result) => result.packageKinds || [])),
  );
  const sourceRefCount = results.reduce(
    (total, result) => total + (result.sourceRefCount || 0),
    0,
  );
  const itemCounts = results
    .map((result) => result.packageItemCount)
    .filter((value): value is number => typeof value === 'number');
  const delivered = results.filter((result) => result.status === 'succeeded');
  const transportUsed =
    delivered.find((result) => result.transportUsed)?.transportUsed ||
    results.find((result) => result.transportUsed)?.transportUsed;
  const transportMode =
    delivered.find((result) => result.transportMode)?.transportMode ||
    results.find((result) => result.transportMode)?.transportMode;
  const transportFallbackReason = mergeTextValues(
    ...results.map((result) => result.transportFallbackReason),
  );
  const externalThreadId =
    [...delivered].reverse().find((result) => result.externalThreadId)
      ?.externalThreadId ||
    [...results].reverse().find((result) => result.externalThreadId)
      ?.externalThreadId;

  const boolValues = <Key extends AttemptBooleanMetadataKey>(
    key: Key,
  ): boolean[] =>
    results
      .map((result) => result[key])
      .filter((value): value is boolean => typeof value === 'boolean');
  const verifiedValues = boolValues('verified');
  const messageVisibleValues = boolValues('messageVisible');
  const challengeValues = boolValues('challengeDetected');
  const telemetryError = mergeTelemetryErrors(
    ...results.map((result) => result.telemetryError),
  );
  const reminderModes = Array.from(
    new Set(results.map((result) => result.reminderDeliveryMode).filter(Boolean)),
  ) as ReminderDeliveryMode[];

  return cleanAttemptMetadata({
    packageKinds,
    packageItemCount:
      itemCounts.length > 0
        ? itemCounts.reduce((total, count) => total + count, 0)
        : undefined,
    sourceRefCount,
    externalThreadId,
    transportUsed,
    transportMode,
    transportFallbackReason,
    verified:
      verifiedValues.length > 0
        ? verifiedValues.every((value) => value)
        : undefined,
    messageVisible:
      messageVisibleValues.length > 0
        ? messageVisibleValues.every((value) => value)
        : undefined,
    challengeDetected:
      challengeValues.length > 0
        ? challengeValues.some((value) => value)
        : undefined,
    telemetryError,
    reminderDeliveryMode:
      reminderModes.length === 1 ? reminderModes[0] : undefined,
  });
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
  private readonly onRecentAttemptsChanged?: BridgeSyncManagerOptions['onRecentAttemptsChanged'];

  constructor(
    private readonly config: BridgeConfig,
    private readonly settingsStore: BridgeSettingsStore,
    private readonly memoryClient: BridgeMemoryServiceClient,
    private readonly bridgeService: DoubaoBridgeService,
    private readonly explorerManager?: ExplorerManager,
    private readonly localSkillSyncManager?: LocalSkillSyncManager,
    options: BridgeSyncManagerOptions = {},
  ) {
    this.recentAttempts = normalizeRecentAttempts(options.initialAttempts);
    this.syncState.reminderDailyDigest = latestReminderDailyDigestRun(
      this.recentAttempts,
    );
    this.onRecentAttemptsChanged = options.onRecentAttemptsChanged;
  }

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
    externalThreadId?: string;
    packageKinds?: string[];
    packageItemCount?: number;
    sourceRefCount?: number;
    transportUsed?: SyncResult['transportUsed'];
    transportMode?: SyncResult['transportMode'];
    transportFallbackReason?: string;
    verified?: boolean;
    messageVisible?: boolean;
    challengeDetected?: boolean;
    telemetryError?: string;
    reminderDeliveryMode?: ReminderDeliveryMode;
  }): void {
    this.attemptSequence += 1;
    const metadata = cleanAttemptMetadata(input);
    const entry: BridgeSyncAttemptLogEntry = {
      id: `${input.startedAtMs}-${this.attemptSequence}-${input.kind}`,
      kind: input.kind,
      trigger: input.trigger,
      status: input.status,
      startedAt: new Date(input.startedAtMs).toISOString(),
      completedAt: new Date(input.completedAtMs).toISOString(),
      durationMs: Math.max(0, input.completedAtMs - input.startedAtMs),
      errorMessage: input.errorMessage,
      ...metadata,
    };
    this.recentAttempts = [entry, ...this.recentAttempts].slice(
      0,
      MAX_RECENT_ATTEMPTS,
    );
    this.notifyRecentAttemptsChanged();
  }

  private notifyRecentAttemptsChanged(): void {
    if (!this.onRecentAttemptsChanged) return;
    const snapshot = [...this.recentAttempts];
    void Promise.resolve(this.onRecentAttemptsChanged(snapshot)).catch(
      (error) => {
        console.warn(
          '[doubao-bridge] failed to persist sync attempt audit log:',
          error,
        );
      },
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
        externalThreadId: result.externalThreadId,
        packageKinds: result.packageKinds,
        packageItemCount: result.packageItemCount,
        sourceRefCount: result.sourceRefCount,
        transportUsed: result.transportUsed,
        transportMode: result.transportMode,
        transportFallbackReason: result.transportFallbackReason,
        verified: result.verified,
        messageVisible: result.messageVisible,
        challengeDetected: result.challengeDetected,
        telemetryError: result.telemetryError,
        reminderDeliveryMode: result.reminderDeliveryMode,
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
  ): Promise<string | undefined> {
    const sourceRefs = this.collectSourceRefs(rendered);
    if (sourceRefs.length === 0) return undefined;

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
        return undefined;
      }
      const telemetryError = formatTelemetryError(
        'Delivery report failed',
        deliveryError,
      );
      console.warn('[doubao-bridge] delivery report failed:', deliveryError);
      return telemetryError;
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

        // 待办 / 通知同步。15 分钟间隔只负责新待办；历史未完成待办走每日完整摘要。
        if (
          status.bindings.mobile_context &&
          shouldRunDailyReminderDigest({
            enabled: settings.reminderDailyDigestEnabled,
            timeOfDay: settings.reminderDailyDigestTime,
            lastRunAt: this.syncState.reminderDailyDigest,
          })
        ) {
          const result = await this.trackSyncAttempt(
            'reminder_sync',
            'auto',
            () =>
              this.syncReminderChannels({
                deliveryMode: 'daily_digest',
                includeNotices: false,
              }),
          );
          attemptedSync = true;
          if (result.status === 'failed' && !failedAttempt) {
            failedAttempt = result;
          }
          if (shouldAdvanceSyncState(result)) {
            this.syncState.reminderDailyDigest = Date.now();
          }
        } else if (
          status.bindings.mobile_context &&
          this.due(this.syncState.reminderSync, settings.reminderSyncIntervalMs)
        ) {
          const result = await this.trackSyncAttempt(
            'reminder_sync',
            'auto',
            () =>
              this.syncReminderChannels({
                deliveryMode: 'new_items',
                includeNotices: true,
              }),
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
        this.syncReminderChannels({
          deliveryMode: 'manual',
          includeNotices: true,
        }),
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
    const metadata = packageMetadata(rendered);
    if (packages.length === 0) {
      const reason = 'No stable memory items to sync';
      const telemetryError = await this.reportSkipped(
        rendered,
        startedAt,
        reason,
      );
      return withTelemetryError(
        { status: 'skipped', errorMessage: reason, ...metadata },
        telemetryError,
      );
    }

    const result = await this.bridgeService.syncStableMemory({
      items: packages.map((pkg) => ({
        title: pkg.title,
        body: pkg.bodyMd,
      })),
    });

    const telemetryError = await this.report(
      rendered,
      result.accepted && !result.error ? 'succeeded' : 'failed',
      startedAt,
      result.error,
      result.threadId,
    );

    return syncResultToAttempt(result, { ...metadata, telemetryError });
  }

  private async syncMobileBriefing(): Promise<SyncAttemptResult> {
    const startedAt = Date.now();
    const rendered = await this.memoryClient.renderContextPackage({
      provider: this.config.provider,
      scenario: 'mobile_briefing',
      deviceContext: 'doubao_bridge_daemon',
    });
    const packages = actionablePackages(rendered);
    const metadata = packageMetadata(rendered);
    if (packages.length === 0) {
      const reason = 'No recent memory highlights to sync';
      const telemetryError = await this.reportSkipped(
        rendered,
        startedAt,
        reason,
      );
      return withTelemetryError(
        { status: 'skipped', errorMessage: reason, ...metadata },
        telemetryError,
      );
    }

    const bullets = uniqueTextItems(
      packages.flatMap((pkg) => extractBullets(pkg, 5)),
    ).slice(0, 12);
    if (bullets.length === 0) {
      const reason = 'No mobile briefing bullets extracted';
      const telemetryError = await this.reportSkipped(
        rendered,
        startedAt,
        reason,
      );
      return withTelemetryError(
        { status: 'skipped', errorMessage: reason, ...metadata },
        telemetryError,
      );
    }

    const result = await this.bridgeService.syncMobileBriefing({
      title: '自动同步的近期记忆重点',
      bullets,
    });

    const telemetryError = await this.report(
      rendered,
      result.accepted && !result.error ? 'succeeded' : 'failed',
      startedAt,
      result.error,
      result.threadId,
    );

    return syncResultToAttempt(result, { ...metadata, telemetryError });
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
    const metadata = packageMetadata(rendered);
    if (reminders.length === 0) {
      return {
        status: 'skipped',
        errorMessage: 'No reminders to sync',
        ...metadata,
      };
    }

    const result = await this.bridgeService.syncReminders({
      reminders,
    });

    const telemetryError = await this.report(
      rendered,
      result.accepted && !result.error ? 'succeeded' : 'failed',
      startedAt,
      result.error,
      result.threadId,
    );

    return syncResultToAttempt(result, { ...metadata, telemetryError });
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
    const metadata = packageMetadata(rendered);
    if (packages.length === 0) {
      const reason = 'No stable memory items to sync';
      const telemetryError = await this.reportSkipped(
        rendered,
        startedAt,
        reason,
      );
      return withTelemetryError(
        { status: 'skipped', errorMessage: reason, ...metadata },
        telemetryError,
      );
    }

    const result = await this.bridgeService.syncStableMemoryAsMemo({
      items: packages.map((pkg) => ({
        title: pkg.title,
        body: pkg.bodyMd,
      })),
    });

    const telemetryError = await this.report(
      rendered,
      result.accepted && !result.error ? 'succeeded' : 'failed',
      startedAt,
      result.error,
      result.threadId,
    );

    return syncResultToAttempt(result, { ...metadata, telemetryError });
  }

  private async syncReminderChannels(
    options: {
      deliveryMode: ReminderDeliveryMode;
      includeNotices: boolean;
    } = { deliveryMode: 'manual', includeNotices: true },
  ): Promise<SyncAttemptResult> {
    const results: SyncAttemptResult[] = [];

    const todoResult = await this.syncTodosAsMemo({
      deliveryMode: options.deliveryMode,
    });
    results.push(todoResult);
    if (todoResult.status === 'failed') {
      const metadata = mergeAttemptMetadata(results);
      return {
        ...todoResult,
        ...metadata,
        errorMessage: todoResult.errorMessage,
      };
    }

    if (options.includeNotices) {
      results.push(await this.syncNotices());
    }
    const metadata = mergeAttemptMetadata(results);
    const failed = results.find((result) => result.status === 'failed');
    if (failed) {
      return { ...failed, ...metadata, errorMessage: failed.errorMessage };
    }
    if (results.some((result) => result.status === 'succeeded')) {
      return { status: 'succeeded', ...metadata };
    }
    const skippedReasons = results
      .map((result) => result.errorMessage)
      .filter((message): message is string => Boolean(message));
    return {
      status: 'skipped',
      errorMessage:
        skippedReasons.join(' / ') || 'No pending todos or notices to sync',
      ...metadata,
      reminderDeliveryMode: options.deliveryMode,
    };
  }

  async syncTodosAsMemo(
    options: { deliveryMode?: ReminderDeliveryMode } = {},
  ): Promise<SyncAttemptResult> {
    const startedAt = Date.now();
    const deliveryMode = options.deliveryMode ?? 'manual';
    const settings = this.settingsStore.getSettings();
    const rendered = await this.renderTodoPackage(
      deliveryMode,
      deliveryMode !== 'new_items' || settings.reminderDedupSameDay !== false,
    );
    const packages = actionablePackages(rendered);
    const metadata = packageMetadata(rendered);
    const reminderDeliveryMode = { reminderDeliveryMode: deliveryMode };
    if (packages.length === 0) {
      const reason = 'No pending todos to sync';
      const telemetryError = await this.reportSkipped(
        rendered,
        startedAt,
        reason,
      );
      return withTelemetryError(
        {
          status: 'skipped',
          errorMessage: reason,
          ...metadata,
          ...reminderDeliveryMode,
        },
        telemetryError,
      );
    }

    const reminderLimit = deliveryMode === 'daily_digest' ? 50 : 8;
    const reminders = packages
      .flatMap((pkg) => extractReminders(pkg, reminderLimit))
      .slice(0, reminderLimit);
    if (reminders.length === 0) {
      const reason = 'No todo titles extracted';
      const telemetryError = await this.reportSkipped(
        rendered,
        startedAt,
        reason,
      );
      return withTelemetryError(
        {
          status: 'skipped',
          errorMessage: reason,
          ...metadata,
          ...reminderDeliveryMode,
        },
        telemetryError,
      );
    }

    const result = await this.bridgeService.syncTodosAsMemo({
      reminders,
    });

    const attempt = syncResultToAttempt(result, {
      ...metadata,
      ...reminderDeliveryMode,
    });
    const deliveryTelemetryError = await this.reportDelivery(
      rendered,
      'todo',
      attempt.status === 'succeeded' ? 'delivered' : 'failed',
      attempt.errorMessage,
    );

    const syncJobTelemetryError = await this.report(
      rendered,
      attempt.status === 'succeeded' ? 'succeeded' : 'failed',
      startedAt,
      result.error,
      result.threadId,
    );

    return withTelemetryError(
      attempt,
      deliveryTelemetryError,
      syncJobTelemetryError,
    );
  }

  async syncRemindersAsMemo(): Promise<SyncAttemptResult> {
    return this.syncTodosAsMemo({ deliveryMode: 'manual' });
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
    const metadata = packageMetadata(rendered);
    if (packages.length === 0) {
      const reason = 'No notices to sync';
      const telemetryError = await this.reportSkipped(
        rendered,
        startedAt,
        reason,
      );
      return withTelemetryError(
        { status: 'skipped', errorMessage: reason, ...metadata },
        telemetryError,
      );
    }

    const notices = packages.flatMap((pkg) => extractNotices(pkg)).slice(0, 8);
    if (notices.length === 0) {
      const reason = 'No notice titles extracted';
      const telemetryError = await this.reportSkipped(
        rendered,
        startedAt,
        reason,
      );
      return withTelemetryError(
        { status: 'skipped', errorMessage: reason, ...metadata },
        telemetryError,
      );
    }

    const result = await this.bridgeService.syncNotices({
      notices,
    });

    const attempt = syncResultToAttempt(result, metadata);
    const deliveryTelemetryError = await this.reportDelivery(
      rendered,
      'notice',
      attempt.status === 'succeeded' ? 'delivered' : 'failed',
      attempt.errorMessage,
    );

    const syncJobTelemetryError = await this.report(
      rendered,
      attempt.status === 'succeeded' ? 'succeeded' : 'failed',
      startedAt,
      result.error,
      result.threadId,
    );

    return withTelemetryError(
      attempt,
      deliveryTelemetryError,
      syncJobTelemetryError,
    );
  }

  private async renderTodoPackage(
    deliveryMode: ReminderDeliveryMode,
    dedupeNewItems: boolean,
  ): Promise<RenderContextPackageResponse> {
    const supported = await this.supportsScenario('todo_sync');
    return this.memoryClient.renderContextPackage({
      provider: this.config.provider,
      scenario: supported ? 'todo_sync' : 'reminder_sync',
      deviceContext: 'doubao_bridge_daemon',
      deliveryMode:
        deliveryMode === 'daily_digest' || deliveryMode === 'manual'
          ? 'daily_digest'
          : dedupeNewItems
            ? 'incremental'
            : undefined,
    });
  }

  private async reportSkipped(
    rendered: RenderContextPackageResponse,
    startedAt: number,
    reason: string,
  ): Promise<string | undefined> {
    if (!rendered.syncJob?.id) return undefined;

    try {
      await this.memoryClient.reportSyncJob(
        rendered.provider,
        rendered.syncJob.id,
        {
          status: 'skipped',
          errorMessage: reason,
          result: {
            packageKinds: rendered.packages.map((pkg) => pkg.kind),
            packageItemCount: packageMetadata(rendered).packageItemCount,
            reason,
          },
          startedAt,
          completedAt: Date.now(),
        },
      );
      return undefined;
    } catch (error) {
      const telemetryError = formatTelemetryError(
        'Sync job report failed',
        error,
      );
      console.warn('[doubao-bridge] skipped sync job report failed:', error);
      return telemetryError;
    }
  }

  private async report(
    rendered: RenderContextPackageResponse,
    status: 'succeeded' | 'failed',
    startedAt: number,
    errorMessage?: string,
    externalThreadId?: string,
  ): Promise<string | undefined> {
    if (!rendered.syncJob?.id) return undefined;

    try {
      await this.memoryClient.reportSyncJob(
        rendered.provider,
        rendered.syncJob.id,
        {
          status,
          errorMessage,
          externalThreadId,
          result: {
            packageKinds: rendered.packages.map((pkg) => pkg.kind),
            packageItemCount: packageMetadata(rendered).packageItemCount,
          },
          startedAt,
          completedAt: Date.now(),
        },
      );
      return undefined;
    } catch (error) {
      const telemetryError = formatTelemetryError(
        'Sync job report failed',
        error,
      );
      console.warn('[doubao-bridge] sync job report failed:', error);
      return telemetryError;
    }
  }
}
