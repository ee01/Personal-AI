import fs from 'node:fs/promises';
import path from 'node:path';

export type BackupChannel = 'webdav' | 's3' | 'desktop_pull' | 'manual_export';
export type BackupRunStatus = 'success' | 'failed';

export interface BackupHistoryEntry {
  at: string;
  channel: BackupChannel;
  status: BackupRunStatus;
  durationMs?: number;
  sizeBytes?: number;
  objectKey?: string;
  localPath?: string;
  deviceName?: string;
  jobId?: string;
  error?: string;
  trigger?: 'scheduled' | 'manual' | 'pull';
}

export interface BackupState {
  lastSuccessAt?: string;
  lastAttemptAt?: string;
  lastStatus?: BackupRunStatus;
  lastChannel?: BackupChannel;
  lastSizeBytes?: number;
  lastObjectKey?: string;
  consecutiveFailures: number;
  history: BackupHistoryEntry[];
}

const MAX_HISTORY = 50;

export function backupStatePath(userRootDir: string): string {
  return path.join(userRootDir, 'backups', 'state.json');
}

export function emptyBackupState(): BackupState {
  return {
    consecutiveFailures: 0,
    history: [],
  };
}

export async function readBackupState(userRootDir: string): Promise<BackupState> {
  const filePath = backupStatePath(userRootDir);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<BackupState>;
    return {
      lastSuccessAt:
        typeof parsed.lastSuccessAt === 'string' ? parsed.lastSuccessAt : undefined,
      lastAttemptAt:
        typeof parsed.lastAttemptAt === 'string' ? parsed.lastAttemptAt : undefined,
      lastStatus:
        parsed.lastStatus === 'success' || parsed.lastStatus === 'failed'
          ? parsed.lastStatus
          : undefined,
      lastChannel: isChannel(parsed.lastChannel) ? parsed.lastChannel : undefined,
      lastSizeBytes:
        typeof parsed.lastSizeBytes === 'number' ? parsed.lastSizeBytes : undefined,
      lastObjectKey:
        typeof parsed.lastObjectKey === 'string' ? parsed.lastObjectKey : undefined,
      consecutiveFailures:
        typeof parsed.consecutiveFailures === 'number' && parsed.consecutiveFailures >= 0
          ? parsed.consecutiveFailures
          : 0,
      history: Array.isArray(parsed.history)
        ? parsed.history.filter(isHistoryEntry)
        : [],
    };
  } catch {
    return emptyBackupState();
  }
}

export async function writeBackupState(
  userRootDir: string,
  state: BackupState,
): Promise<void> {
  const filePath = backupStatePath(userRootDir);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  const payload: BackupState = {
    ...state,
    history: state.history.slice(0, MAX_HISTORY),
  };
  await fs.writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  await fs.rename(tmpPath, filePath);
}

export async function appendBackupHistory(
  userRootDir: string,
  entry: BackupHistoryEntry,
): Promise<BackupState> {
  const state = await readBackupState(userRootDir);
  const next: BackupState = {
    ...state,
    lastAttemptAt: entry.at,
    lastStatus: entry.status,
    lastChannel: entry.channel,
    lastSizeBytes: entry.sizeBytes,
    lastObjectKey: entry.objectKey,
    consecutiveFailures:
      entry.status === 'success' ? 0 : state.consecutiveFailures + 1,
    lastSuccessAt: entry.status === 'success' ? entry.at : state.lastSuccessAt,
    history: [entry, ...state.history].slice(0, MAX_HISTORY),
  };
  await writeBackupState(userRootDir, next);
  return next;
}

function isChannel(value: unknown): value is BackupChannel {
  return (
    value === 'webdav' ||
    value === 's3' ||
    value === 'desktop_pull' ||
    value === 'manual_export'
  );
}

function isHistoryEntry(value: unknown): value is BackupHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as BackupHistoryEntry;
  return (
    typeof entry.at === 'string' &&
    isChannel(entry.channel) &&
    (entry.status === 'success' || entry.status === 'failed')
  );
}
