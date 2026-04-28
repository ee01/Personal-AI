import path from 'node:path';

const warnedDeprecatedEnvVars = new Set<string>();

export interface BridgeRuntimeSettings {
  memoryServiceBaseUrl?: string;
  memoryServiceApiKey?: string;
  memoryServiceUserId?: string;
  autoSync: boolean;
  pollIntervalMs: number;
  stableMemoryIntervalMs: number;
  mobileBriefingIntervalMs: number;
  reminderSyncIntervalMs: number;
}

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
  defaultSettings: BridgeRuntimeSettings;
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

function warnDeprecatedEnvVar(preferredKey: string, legacyKey: string): void {
  const warningKey = `${preferredKey}:${legacyKey}`;
  if (warnedDeprecatedEnvVars.has(warningKey)) return;
  warnedDeprecatedEnvVars.add(warningKey);
  console.warn(
    `[desktop-app] ${legacyKey} is deprecated and will be removed in a future release. Use ${preferredKey} instead.`,
  );
}

function readDesktopEnv(
  env: NodeJS.ProcessEnv,
  preferredKey: string,
  legacyKey: string,
): string | undefined {
  const preferredValue = env[preferredKey];
  if (preferredValue != null && preferredValue !== '') {
    return preferredValue;
  }

  const legacyValue = env[legacyKey];
  if (legacyValue != null && legacyValue !== '') {
    warnDeprecatedEnvVar(preferredKey, legacyKey);
    return legacyValue;
  }

  return undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  const dataDir = path.resolve(
    readDesktopEnv(env, 'DESKTOP_APP_DATA_DIR', 'DOUBAO_BRIDGE_DATA_DIR') ||
      './data',
  );
  const profileDir = path.resolve(
    readDesktopEnv(
      env,
      'DESKTOP_APP_PROFILE_DIR',
      'DOUBAO_BRIDGE_PROFILE_DIR',
    ) || path.join(dataDir, 'profile'),
  );
  const memoryServiceBaseUrl =
    env.MEMORY_SERVICE_BASE_URL?.trim() || 'http://10.32.56.212:3210';
  const defaultSettings: BridgeRuntimeSettings = {
    memoryServiceBaseUrl: memoryServiceBaseUrl || undefined,
    memoryServiceApiKey: env.MEMORY_SERVICE_API_KEY || undefined,
    memoryServiceUserId:
      readDesktopEnv(env, 'DESKTOP_APP_USER_ID', 'DOUBAO_BRIDGE_USER_ID') ||
      env.MEMORY_SERVICE_USER_ID ||
      undefined,
    autoSync: toBool(
      readDesktopEnv(env, 'DESKTOP_APP_AUTO_SYNC', 'DOUBAO_BRIDGE_AUTO_SYNC'),
      true,
    ),
    pollIntervalMs: toNumber(
      readDesktopEnv(
        env,
        'DESKTOP_APP_POLL_INTERVAL_MS',
        'DOUBAO_BRIDGE_POLL_INTERVAL_MS',
      ),
      5 * 60_000,
    ),
    stableMemoryIntervalMs: toNumber(
      readDesktopEnv(
        env,
        'DESKTOP_APP_STABLE_SYNC_INTERVAL_MS',
        'DOUBAO_BRIDGE_STABLE_SYNC_INTERVAL_MS',
      ),
      12 * 60 * 60_000,
    ),
    mobileBriefingIntervalMs: toNumber(
      readDesktopEnv(
        env,
        'DESKTOP_APP_MOBILE_SYNC_INTERVAL_MS',
        'DOUBAO_BRIDGE_MOBILE_SYNC_INTERVAL_MS',
      ),
      4 * 60 * 60_000,
    ),
    reminderSyncIntervalMs: toNumber(
      readDesktopEnv(
        env,
        'DESKTOP_APP_REMINDER_SYNC_INTERVAL_MS',
        'DOUBAO_BRIDGE_REMINDER_SYNC_INTERVAL_MS',
      ),
      15 * 60_000,
    ),
  };

  return {
    port: toNumber(
      readDesktopEnv(env, 'DESKTOP_APP_PORT', 'DOUBAO_BRIDGE_PORT'),
      46321,
    ),
    host:
      readDesktopEnv(env, 'DESKTOP_APP_HOST', 'DOUBAO_BRIDGE_HOST') ||
      '127.0.0.1',
    dataDir,
    profileDir,
    doubaoBaseUrl: env.DOUBAO_BASE_URL || 'https://www.doubao.com',
    headless: toBool(
      readDesktopEnv(env, 'DESKTOP_APP_HEADLESS', 'DOUBAO_BRIDGE_HEADLESS'),
      false,
    ),
    authToken:
      readDesktopEnv(
        env,
        'DESKTOP_APP_AUTH_TOKEN',
        'DOUBAO_BRIDGE_AUTH_TOKEN',
      ) || undefined,
    provider: env.DOUBAO_BRIDGE_PROVIDER || 'doubao',
    memoryServiceBaseUrl: defaultSettings.memoryServiceBaseUrl,
    memoryServiceApiKey: defaultSettings.memoryServiceApiKey,
    memoryServiceUserId: defaultSettings.memoryServiceUserId,
    autoSync: defaultSettings.autoSync,
    pollIntervalMs: defaultSettings.pollIntervalMs,
    stableMemoryIntervalMs: defaultSettings.stableMemoryIntervalMs,
    mobileBriefingIntervalMs: defaultSettings.mobileBriefingIntervalMs,
    reminderSyncIntervalMs: defaultSettings.reminderSyncIntervalMs,
    defaultSettings,
  };
}
