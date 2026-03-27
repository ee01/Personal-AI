import type { BridgeConfig } from './config.js';
import { BridgeMemoryServiceClient, type ProviderMemoryProduct, type RenderContextPackageResponse } from './memoryServiceClient.js';
import { DoubaoBridgeService } from './bridgeService.js';

interface SyncState {
  stableMemory?: number;
  mobileBriefing?: number;
  reminderSync?: number;
}

function stripMarkdown(line: string): string {
  return line
    .replace(/^#+\s*/, '')
    .replace(/^>\s*/, '')
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .trim();
}

function extractBullets(pkg: ProviderMemoryProduct, limit = 6): string[] {
  const lines = pkg.bodyMd
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const bullets: string[] = [];
  let section = pkg.title;

  for (const line of lines) {
    if (line.startsWith('#')) {
      const heading = stripMarkdown(line);
      if (heading) section = heading;
      continue;
    }
    if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
      const value = stripMarkdown(line);
      if (value) {
        bullets.push(section && section !== pkg.title ? `${section}: ${value}` : value);
      }
      if (bullets.length >= limit) break;
    }
  }

  if (bullets.length > 0) return bullets.slice(0, limit);

  return lines
    .map((line) => stripMarkdown(line))
    .filter(Boolean)
    .slice(0, limit)
    .map((line) => `${pkg.title}: ${line}`);
}

function extractReminders(pkg: ProviderMemoryProduct, limit = 8) {
  return extractBullets(pkg, limit).map((title) => ({
    title,
    severity: 'medium' as const,
  }));
}

export class BridgeSyncManager {
  private timer: NodeJS.Timeout | null = null;
  private syncState: SyncState = {};
  private running = false;

  constructor(
    private readonly config: BridgeConfig,
    private readonly memoryClient: BridgeMemoryServiceClient,
    private readonly bridgeService: DoubaoBridgeService,
  ) {}

  start(): void {
    if (!this.config.autoSync || !this.memoryClient.isEnabled()) return;
    if (this.timer) return;

    this.timer = setInterval(() => {
      void this.tick();
    }, this.config.pollIntervalMs);

    void this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private due(lastRunAt: number | undefined, intervalMs: number): boolean {
    return !lastRunAt || Date.now() - lastRunAt >= intervalMs;
  }

  async tick(): Promise<void> {
    if (this.running || !this.config.autoSync || !this.memoryClient.isEnabled()) return;
    this.running = true;

    try {
      const status = await this.bridgeService.getStatus();
      if (status.authStatus !== 'connected') return;

      if (status.bindings.memory_sync && this.due(this.syncState.stableMemory, this.config.stableMemoryIntervalMs)) {
        await this.syncStableMemory();
        this.syncState.stableMemory = Date.now();
      }

      if (status.bindings.mobile_context && this.due(this.syncState.mobileBriefing, this.config.mobileBriefingIntervalMs)) {
        await this.syncMobileBriefing();
        this.syncState.mobileBriefing = Date.now();
      }

      if (status.bindings.mobile_context && this.due(this.syncState.reminderSync, this.config.reminderSyncIntervalMs)) {
        await this.syncReminders();
        this.syncState.reminderSync = Date.now();
      }
    } catch (error) {
      console.error('[doubao-bridge] auto-sync tick failed:', error);
    } finally {
      this.running = false;
    }
  }

  private async syncStableMemory(): Promise<void> {
    const startedAt = Date.now();
    const rendered = await this.memoryClient.renderContextPackage({
      provider: this.config.provider,
      scenario: 'stable_memory',
      deviceContext: 'doubao_bridge_daemon',
    });
    if (rendered.packages.length === 0) return;

    const result = await this.bridgeService.syncStableMemory({
      items: rendered.packages.map((pkg) => ({
        title: pkg.title,
        body: pkg.bodyMd,
      })),
    });

    await this.report(rendered, result.accepted && !result.error ? 'succeeded' : 'failed', startedAt, result.error, result.threadId);
  }

  private async syncMobileBriefing(): Promise<void> {
    const startedAt = Date.now();
    const rendered = await this.memoryClient.renderContextPackage({
      provider: this.config.provider,
      scenario: 'mobile_briefing',
      deviceContext: 'doubao_bridge_daemon',
    });
    const bullets = rendered.packages.flatMap((pkg) => extractBullets(pkg, 5)).slice(0, 12);
    if (bullets.length === 0) return;

    const result = await this.bridgeService.syncMobileBriefing({
      title: '自动同步的近期重点',
      bullets,
    });

    await this.report(rendered, result.accepted && !result.error ? 'succeeded' : 'failed', startedAt, result.error, result.threadId);
  }

  private async syncReminders(): Promise<void> {
    const startedAt = Date.now();
    const rendered = await this.memoryClient.renderContextPackage({
      provider: this.config.provider,
      scenario: 'reminder_sync',
      deviceContext: 'doubao_bridge_daemon',
    });
    const reminders = rendered.packages.flatMap((pkg) => extractReminders(pkg)).slice(0, 8);
    if (reminders.length === 0) return;

    const result = await this.bridgeService.syncReminders({
      reminders,
    });

    await this.report(rendered, result.accepted && !result.error ? 'succeeded' : 'failed', startedAt, result.error, result.threadId);
  }

  private async report(
    rendered: RenderContextPackageResponse,
    status: 'succeeded' | 'failed',
    startedAt: number,
    errorMessage?: string,
    externalThreadId?: string,
  ): Promise<void> {
    if (!rendered.syncJob?.id) return;

    await this.memoryClient.reportSyncJob(rendered.provider, rendered.syncJob.id, {
      status,
      errorMessage,
      externalThreadId,
      result: {
        packageKinds: rendered.packages.map((pkg) => pkg.kind),
      },
      startedAt,
      completedAt: Date.now(),
    });
  }
}
