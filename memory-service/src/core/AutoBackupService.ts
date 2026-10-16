import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type BetterSqlite3 from 'better-sqlite3';

import { encryptBackupFile, isEncryptedBackupFile } from './backup/backupCrypto.js';
import {
  appendBackupHistory,
  readBackupState,
  type BackupChannel,
} from './backup/backupState.js';
import {
  computeNextBackupAt,
  isBackupDue,
  normalizeIntervalHours,
  normalizePreferredHour,
  type AutoBackupScheduleType,
} from './backup/backupSchedule.js';
import { withUserExportLock } from './backup/exportLock.js';
import {
  createBackupStorageProvider,
  type BackupStorageProvider,
} from '../integrations/backupStorage/index.js';
import { LocalDirProvider } from '../integrations/backupStorage/LocalDirProvider.js';
import { exportMemoryBackupToFile } from './MemoryBackupService.js';
import { runMirrorOnce, type MirrorPusher } from './MirrorService.js';
import type { UserContext } from './UserContextManager.js';
import type { UserContextManager } from './UserContextManager.js';
import type { UserDataManager } from '../storage/UserDataManager.js';

export interface AutoBackupPersistedConfig {
  autoBackupEnabled?: boolean;
  autoBackupScheduleType?: AutoBackupScheduleType;
  autoBackupPreferredHour?: number;
  autoBackupIntervalHours?: number;
  autoBackupProvider?: 'webdav' | 's3' | 'github';
  autoBackupWebdavUrl?: string;
  autoBackupWebdavUsername?: string;
  autoBackupWebdavPassword?: string;
  autoBackupS3Endpoint?: string;
  autoBackupS3Region?: string;
  autoBackupS3Bucket?: string;
  autoBackupS3AccessKeyId?: string;
  autoBackupS3SecretAccessKey?: string;
  autoBackupPrefix?: string;
  autoBackupEncryptionEnabled?: boolean;
  autoBackupEncryptionPassphrase?: string;
  autoBackupRetentionCount?: number;
  autoBackupIncludeDerived?: boolean;
  autoBackupIncludeVectors?: boolean;
  /** @deprecated mirror activation derives from autoBackupEnabled + repo/token; kept for back-compat reads of older config.json */
  autoBackupGithubEnabled?: boolean;
  autoBackupGithubRepo?: string;
  autoBackupGithubBranch?: string;
  autoBackupGithubToken?: string;
  autoBackupGithubMode?: 'markdown' | 'encrypted';
  autoBackupGithubScope?: 'all' | 'self_only';
  autoBackupGithubPrefix?: string;
}

export interface ResolvedGithubMirrorConfig {
  enabled: boolean;
  repo: string;
  branch: string;
  token: string;
  mode: 'markdown' | 'encrypted';
  scope: 'all' | 'self_only';
  prefix: string;
  passphrase: string;
}

export interface TableVolume {
  name: string;
  bytes: number;
}

export interface BackupVolumeBreakdown {
  dbBytes: number;
  tables: TableVolume[];
  vectorBytes: number;
  vectorShare: number;
}

const FAILURE_NOTIFY_THRESHOLD = 3;

export function readAutoBackupConfig(udm: UserDataManager): AutoBackupPersistedConfig {
  try {
    const raw = udm.readFile('config.json');
    if (!raw) return {};
    return JSON.parse(raw) as AutoBackupPersistedConfig;
  } catch {
    return {};
  }
}

export function resolveAutoBackupConfig(raw: AutoBackupPersistedConfig): {
  enabled: boolean;
  scheduleType: AutoBackupScheduleType;
  preferredHour: number;
  intervalHours: number;
  provider: 'webdav' | 's3' | 'github';
  prefix: string;
  encryptionEnabled: boolean;
  passphrase: string;
  retentionCount: number;
  includeDerived: boolean;
  includeVectors: boolean;
  github: ResolvedGithubMirrorConfig;
} {
  const scheduleType: AutoBackupScheduleType =
    raw.autoBackupScheduleType === 'every_x_hours' ||
    raw.autoBackupScheduleType === 'weekly'
      ? raw.autoBackupScheduleType
      : 'daily';
  return {
    enabled: raw.autoBackupEnabled === true,
    scheduleType,
    preferredHour: normalizePreferredHour(raw.autoBackupPreferredHour, 3),
    intervalHours: normalizeIntervalHours(raw.autoBackupIntervalHours, 24),
    provider:
      raw.autoBackupProvider === 's3'
        ? 's3'
        : raw.autoBackupProvider === 'github'
          ? 'github'
          : 'webdav',
    prefix: (raw.autoBackupPrefix || 'personal-ai-backups').replace(/\/+$/, ''),
    encryptionEnabled: raw.autoBackupEncryptionEnabled !== false,
    passphrase:
      typeof raw.autoBackupEncryptionPassphrase === 'string'
        ? raw.autoBackupEncryptionPassphrase
        : '',
    retentionCount: Math.max(1, Math.floor(Number(raw.autoBackupRetentionCount) || 7)),
    includeDerived: raw.autoBackupIncludeDerived !== false,
    includeVectors: raw.autoBackupIncludeVectors !== false,
    github: (() => {
      // One master switch: the mirror channel rides the global autoBackupEnabled
      // flag (Options exposes no per-channel mirror toggle). It is active when
      // backup is on AND a repo + token are configured.
      const repo =
        typeof raw.autoBackupGithubRepo === 'string' ? raw.autoBackupGithubRepo.trim() : '';
      const token =
        typeof raw.autoBackupGithubToken === 'string' ? raw.autoBackupGithubToken : '';
      return {
        enabled: raw.autoBackupEnabled === true && Boolean(repo) && Boolean(token),
        repo,
        branch:
          typeof raw.autoBackupGithubBranch === 'string' && raw.autoBackupGithubBranch.trim()
            ? raw.autoBackupGithubBranch.trim()
            : 'main',
        token,
        mode: raw.autoBackupGithubMode === 'encrypted' ? 'encrypted' : 'markdown',
        scope: raw.autoBackupGithubScope === 'self_only' ? 'self_only' : 'all',
        prefix: (raw.autoBackupGithubPrefix || '').replace(/^\/+|\/+$/g, ''),
        passphrase:
          typeof raw.autoBackupEncryptionPassphrase === 'string'
            ? raw.autoBackupEncryptionPassphrase
            : '',
      };
    })(),
  };
}

export function createProviderFromConfig(
  raw: AutoBackupPersistedConfig,
  testRootDir?: string,
): BackupStorageProvider {
  if (testRootDir) {
    return new LocalDirProvider(testRootDir);
  }
  const resolved = resolveAutoBackupConfig(raw);
  return createBackupStorageProvider({
    provider: resolved.provider,
    webdav: {
      baseUrl: raw.autoBackupWebdavUrl || '',
      username: raw.autoBackupWebdavUsername || '',
      password: raw.autoBackupWebdavPassword || '',
    },
    s3: {
      endpoint: raw.autoBackupS3Endpoint || '',
      region: raw.autoBackupS3Region || 'auto',
      bucket: raw.autoBackupS3Bucket || '',
      accessKeyId: raw.autoBackupS3AccessKeyId || '',
      secretAccessKey: raw.autoBackupS3SecretAccessKey || '',
    },
    github: {
      repo: resolved.github.repo,
      branch: resolved.github.branch,
      token: resolved.github.token,
    },
  });
}

function quoteSqliteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function collectDbVolume(db: BetterSqlite3.Database): BackupVolumeBreakdown {
  let tables: TableVolume[] = [];
  try {
    tables = db
      .prepare(
        `SELECT name, SUM(pgsize) AS bytes
         FROM dbstat
         GROUP BY name
         ORDER BY bytes DESC
         LIMIT 24`,
      )
      .all() as TableVolume[];
  } catch {
    const pageSize = Number(db.pragma('page_size', { simple: true }) || 4096);
    const pageCount = Number(db.pragma('page_count', { simple: true }) || 0);
    const names = db
      .prepare(`SELECT name FROM sqlite_master WHERE type IN ('table', 'index')`)
      .all() as Array<{ name: string }>;
    const estimatedDbBytes = pageCount * pageSize;
    tables = names.map((row) => {
      try {
        const count = (
          db.prepare(`SELECT COUNT(*) AS c FROM ${quoteSqliteIdent(row.name)}`).get() as {
            c: number;
          }
        ).c;
        return { name: row.name, bytes: count * 64 };
      } catch {
        return { name: row.name, bytes: 0 };
      }
    });
    if (estimatedDbBytes > 0) {
      const vectorBytes = tables
        .filter((item) => /vec|fts/i.test(item.name))
        .reduce((sum, item) => sum + (Number(item.bytes) || 0), 0);
      return {
        dbBytes: estimatedDbBytes,
        tables,
        vectorBytes,
        vectorShare: vectorBytes / estimatedDbBytes,
      };
    }
  }

  const dbBytes = tables.reduce((sum, item) => sum + (Number(item.bytes) || 0), 0);
  const vectorBytes = tables
    .filter((item) => /vec|fts/i.test(item.name))
    .reduce((sum, item) => sum + (Number(item.bytes) || 0), 0);
  return {
    dbBytes,
    tables,
    vectorBytes,
    vectorShare: dbBytes > 0 ? vectorBytes / dbBytes : 0,
  };
}

function objectPrefix(prefix: string, userId: string): string {
  return `${prefix}/${userId}`;
}

function objectKey(prefix: string, userId: string, fileName: string): string {
  return `${objectPrefix(prefix, userId)}/${fileName}`;
}

async function pruneRetention(
  provider: BackupStorageProvider,
  prefix: string,
  keep: number,
): Promise<number> {
  const objects = await provider.list(prefix);
  const sorted = [...objects].sort((a, b) => {
    const left = a.lastModified ? Date.parse(a.lastModified) : 0;
    const right = b.lastModified ? Date.parse(b.lastModified) : 0;
    return right - left;
  });
  const extra = sorted.slice(keep);
  for (const item of extra) {
    await provider.delete(item.key);
  }
  return extra.length;
}

function insertFailureNotification(
  db: BetterSqlite3.Database,
  consecutiveFailures: number,
  error: string,
): void {
  if (consecutiveFailures < FAILURE_NOTIFY_THRESHOLD) return;
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO notification_records
      (id, channel, type, title, body, payload_json, topic_id, sent_at, created_at)
     VALUES (?, 'chrome_notification', 'auto_backup_failed', ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    '记忆自动备份连续失败',
    `已连续失败 ${consecutiveFailures} 次：${error}`,
    JSON.stringify({ consecutiveFailures, error }),
    'auto_backup',
    now,
    now,
  );
}

export async function runAutoBackupOnce(
  userContext: UserContext,
  options: { trigger?: 'scheduled' | 'manual'; testProvider?: BackupStorageProvider } = {},
): Promise<{
  status: 'success' | 'failed' | 'skipped';
  objectKey?: string;
  sizeBytes?: number;
  durationMs: number;
  error?: string;
}> {
  const started = Date.now();
  const raw = readAutoBackupConfig(userContext.userDataManager);
  const config = resolveAutoBackupConfig(raw);
  if (!config.enabled && options.trigger !== 'manual') {
    return { status: 'skipped', durationMs: 0 };
  }

  return withUserExportLock(userContext.userId, async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'personal-ai-autobackup-'));
    const zipPath = path.join(tempDir, 'archive.zip');
    const channel: BackupChannel =
      config.provider === 'github' ? 'manual_export' : config.provider;
    try {
      const exported = await exportMemoryBackupToFile(userContext, zipPath, {
        includeDerived: config.includeDerived,
        includeVectors: config.includeVectors,
      });

      let uploadPath = zipPath;
      let fileName = exported.fileName;
      if (config.encryptionEnabled) {
        if (!config.passphrase) {
          throw new Error('自动备份已开启加密，但尚未配置口令');
        }
        const encPath = path.join(tempDir, 'archive.zip.enc');
        await encryptBackupFile(zipPath, encPath, config.passphrase);
        uploadPath = encPath;
        fileName = `${exported.fileName}.enc`;
        const magicOk = await isEncryptedBackupFile(encPath);
        if (!magicOk) {
          throw new Error('Encrypted backup is missing PABK1 magic header');
        }
      }

      const provider =
        options.testProvider || createProviderFromConfig(raw);
      const key = objectKey(config.prefix, userContext.userId, fileName);
      const sizeBytes = (await fs.stat(uploadPath)).size;
      await provider.put({
        key,
        filePath: uploadPath,
        sizeBytes,
        contentType: config.encryptionEnabled
          ? 'application/octet-stream'
          : 'application/zip',
      });
      const verified = await provider.head(key);
      if (verified.sizeBytes !== sizeBytes) {
        throw new Error(
          `Remote size mismatch: local ${sizeBytes}, remote ${verified.sizeBytes}`,
        );
      }
      const pruned = await pruneRetention(
        provider,
        objectPrefix(config.prefix, userContext.userId),
        config.retentionCount,
      );
      void pruned;

      const durationMs = Date.now() - started;
      await appendBackupHistory(userContext.userDataManager.rootDir, {
        at: new Date().toISOString(),
        channel,
        status: 'success',
        durationMs,
        sizeBytes,
        objectKey: key,
        trigger: options.trigger || 'scheduled',
      });
      return { status: 'success', objectKey: key, sizeBytes, durationMs };
    } catch (error) {
      const durationMs = Date.now() - started;
      const message = error instanceof Error ? error.message : String(error);
      const next = await appendBackupHistory(userContext.userDataManager.rootDir, {
        at: new Date().toISOString(),
        channel,
        status: 'failed',
        durationMs,
        error: message,
        trigger: options.trigger || 'scheduled',
      });
      try {
        insertFailureNotification(
          userContext.db,
          next.consecutiveFailures,
          message,
        );
      } catch {
        // notification insert is best-effort
      }
      return { status: 'failed', durationMs, error: message };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
}

export async function tickAutoBackups(ucm: UserContextManager): Promise<void> {
  const now = new Date();
  for (const userId of ucm.getRegisteredUserIds()) {
    try {
      const ctx = ucm.getContext(userId);
      const raw = readAutoBackupConfig(ctx.userDataManager);
      const config = resolveAutoBackupConfig(raw);
      if (!config.enabled) continue;
      const state = await readBackupState(ctx.userDataManager.rootDir);
      if (
        !isBackupDue(
          {
            enabled: config.enabled,
            scheduleType: config.scheduleType,
            preferredHour: config.preferredHour,
            intervalHours: config.intervalHours,
          },
          state.lastSuccessAt,
          now,
        )
      ) {
        continue;
      }
      await runAutoBackupOnce(ctx, { trigger: 'scheduled' });
    } catch (error) {
      console.error(
        `[AutoBackup] tick failed for ${userId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

export async function runGithubMirrorOnce(
  userContext: UserContext,
  options: {
    trigger?: 'scheduled' | 'manual';
    pusher?: MirrorPusher;
    now?: Date;
  } = {},
): Promise<Awaited<ReturnType<typeof runMirrorOnce>>> {
  const raw = readAutoBackupConfig(userContext.userDataManager);
  const config = resolveAutoBackupConfig(raw);
  if (!config.github.enabled && options.trigger !== 'manual') {
    return {
      status: 'skipped',
      filesTotal: 0,
      filesChanged: 0,
      excludedByPolicy: 0,
      conflictPaths: [],
      durationMs: 0,
    };
  }
  const result = await runMirrorOnce(userContext, config.github, options);
  if (result.status === 'failed') {
    try {
      const state = await readBackupState(userContext.userDataManager.rootDir);
      insertFailureNotification(
        userContext.db,
        state.consecutiveFailures,
        result.error || 'GitHub mirror failed',
      );
    } catch {
      // notification insert is best-effort
    }
  }
  return result;
}

export async function tickMirrors(ucm: UserContextManager): Promise<void> {
  const now = new Date();
  for (const userId of ucm.getRegisteredUserIds()) {
    try {
      const ctx = ucm.getContext(userId);
      const raw = readAutoBackupConfig(ctx.userDataManager);
      const config = resolveAutoBackupConfig(raw);
      if (!config.github.enabled) continue;
      if (!config.github.repo || !config.github.token) continue;
      const state = await readBackupState(ctx.userDataManager.rootDir);
      const lastMirrorSuccess = [...state.history]
        .filter((entry) => entry.channel === 'github_mirror' && entry.status === 'success')
        .map((entry) => entry.at)
        .sort()
        .pop();
      if (
        !isBackupDue(
          {
            enabled: true,
            scheduleType: config.scheduleType,
            preferredHour: config.preferredHour,
            intervalHours: config.intervalHours,
          },
          lastMirrorSuccess,
          now,
        )
      ) {
        continue;
      }
      await runGithubMirrorOnce(ctx, { trigger: 'scheduled' });
    } catch (error) {
      console.error(
        `[Mirror] tick failed for ${userId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

export function nextBackupIso(
  raw: AutoBackupPersistedConfig,
  lastSuccessAt?: string,
  now = new Date(),
): string | null {
  const config = resolveAutoBackupConfig(raw);
  const next = computeNextBackupAt(
    {
      enabled: config.enabled,
      scheduleType: config.scheduleType,
      preferredHour: config.preferredHour,
      intervalHours: config.intervalHours,
    },
    lastSuccessAt,
    now,
  );
  return next ? next.toISOString() : null;
}

export function formatBackupObjectFileName(userId: string, exportedAt: string, encrypted: boolean): string {
  const stamp = exportedAt.replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
  return `personal-ai-memory-${userId}-${stamp}.zip${encrypted ? '.enc' : ''}`;
}
