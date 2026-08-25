import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { BridgeMemoryServiceClient } from './memoryServiceClient.js';
import type { BridgeSettingsStore, BridgeUserSettings } from './settings.js';

function expandHome(value: string): string {
  if (value.startsWith('~/')) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  return hash.digest('hex');
}

function isDue(settings: BridgeUserSettings['backupPull'], lastSuccessAt?: number, now = new Date()): boolean {
  if (!settings.enabled || !settings.directory) return false;
  if (!lastSuccessAt) return true;
  const last = new Date(lastSuccessAt);
  const next = new Date(last);
  next.setDate(next.getDate() + 1);
  next.setHours(settings.hour, 0, 0, 0);
  return now.getTime() >= next.getTime();
}

export class BackupPuller {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lastSuccessAt?: number;

  constructor(
    private readonly settingsStore: BridgeSettingsStore,
    private readonly memoryClient: BridgeMemoryServiceClient,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, 15 * 60 * 1000);
    void this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(force = false): Promise<{ status: 'success' | 'skipped' | 'failed'; error?: string }> {
    if (this.running) return { status: 'skipped', error: 'already running' };
    const settings = this.settingsStore.get().backupPull;
    if (!force && !isDue(settings, this.lastSuccessAt)) {
      return { status: 'skipped' };
    }
    if (!settings.enabled || !settings.directory) {
      return { status: 'skipped' };
    }
    this.running = true;
    const directory = expandHome(settings.directory);
    try {
      await fs.mkdir(directory, { recursive: true });
      const job = await this.memoryClient.createExportJob({
        encrypt: settings.encrypt,
      });
      const started = Date.now();
      let current = job;
      while (Date.now() - started < 30 * 60 * 1000) {
        current = await this.memoryClient.getExportJob(job.id);
        if (current.status === 'ready') break;
        if (current.status === 'failed') {
          throw new Error(current.error || 'export job failed');
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (current.status !== 'ready') {
        throw new Error('export job timed out');
      }
      const fileName = current.fileName || `personal-ai-memory-${Date.now()}.zip`;
      const target = path.join(directory, fileName);
      const downloaded = await this.memoryClient.downloadExportJobToFile(job.id, target);
      const digest = await sha256File(target);
      if (downloaded.sha256 && downloaded.sha256 !== digest) {
        throw new Error('Downloaded backup sha256 mismatch');
      }
      await this.prune(directory, settings.retentionCount);
      this.lastSuccessAt = Date.now();
      await this.memoryClient.postBackupPullReceipt({
        jobId: job.id,
        deviceName: os.hostname(),
        localPath: target,
        sizeBytes: downloaded.sizeBytes,
        sha256: digest,
        status: 'success',
      });
      return { status: 'success' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        await this.memoryClient.postBackupPullReceipt({
          jobId: 'unknown',
          deviceName: os.hostname(),
          localPath: directory,
          sizeBytes: 0,
          status: 'failed',
          error: message,
        });
      } catch {
        // ignore receipt failure
      }
      return { status: 'failed', error: message };
    } finally {
      this.running = false;
    }
  }

  private async prune(directory: string, keep: number): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.startsWith('personal-ai-memory-'))
        .map(async (entry) => {
          const full = path.join(directory, entry.name);
          const stat = await fs.stat(full);
          return { full, mtime: stat.mtimeMs };
        }),
    );
    files.sort((a, b) => b.mtime - a.mtime);
    for (const extra of files.slice(Math.max(1, keep))) {
      await fs.rm(extra.full, { force: true });
    }
  }
}
