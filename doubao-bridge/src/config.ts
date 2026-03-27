import path from 'node:path';

export interface BridgeConfig {
  port: number;
  host: string;
  dataDir: string;
  profileDir: string;
  doubaoBaseUrl: string;
  headless: boolean;
  authToken?: string;
  provider: string;
  memoryServiceBaseUrl?: string;
  memoryServiceApiKey?: string;
  memoryServiceUserId?: string;
  autoSync: boolean;
  pollIntervalMs: number;
  stableMemoryIntervalMs: number;
  mobileBriefingIntervalMs: number;
  reminderSyncIntervalMs: number;
}

function toBool(value: string | undefined, fallback = false): boolean {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function toNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  const dataDir = path.resolve(env.DOUBAO_BRIDGE_DATA_DIR || './data');
  const profileDir = path.resolve(env.DOUBAO_BRIDGE_PROFILE_DIR || path.join(dataDir, 'profile'));
  const memoryServiceBaseUrl = env.MEMORY_SERVICE_BASE_URL?.trim();

  return {
    port: toNumber(env.DOUBAO_BRIDGE_PORT, 46321),
    host: env.DOUBAO_BRIDGE_HOST || '127.0.0.1',
    dataDir,
    profileDir,
    doubaoBaseUrl: env.DOUBAO_BASE_URL || 'https://www.doubao.com',
    headless: toBool(env.DOUBAO_BRIDGE_HEADLESS, false),
    authToken: env.DOUBAO_BRIDGE_AUTH_TOKEN || undefined,
    provider: env.DOUBAO_BRIDGE_PROVIDER || 'doubao',
    memoryServiceBaseUrl: memoryServiceBaseUrl || undefined,
    memoryServiceApiKey: env.MEMORY_SERVICE_API_KEY || undefined,
    memoryServiceUserId: env.MEMORY_SERVICE_USER_ID || env.DOUBAO_BRIDGE_USER_ID || undefined,
    autoSync: toBool(env.DOUBAO_BRIDGE_AUTO_SYNC, Boolean(memoryServiceBaseUrl)),
    pollIntervalMs: toNumber(env.DOUBAO_BRIDGE_POLL_INTERVAL_MS, 5 * 60_000),
    stableMemoryIntervalMs: toNumber(env.DOUBAO_BRIDGE_STABLE_SYNC_INTERVAL_MS, 12 * 60 * 60_000),
    mobileBriefingIntervalMs: toNumber(env.DOUBAO_BRIDGE_MOBILE_SYNC_INTERVAL_MS, 4 * 60 * 60_000),
    reminderSyncIntervalMs: toNumber(env.DOUBAO_BRIDGE_REMINDER_SYNC_INTERVAL_MS, 15 * 60_000),
  };
}
