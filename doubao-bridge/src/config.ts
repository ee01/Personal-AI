import path from 'node:path';

export interface BridgeConfig {
  port: number;
  host: string;
  dataDir: string;
  profileDir: string;
  doubaoBaseUrl: string;
  headless: boolean;
  authToken?: string;
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

  return {
    port: toNumber(env.DOUBAO_BRIDGE_PORT, 46321),
    host: env.DOUBAO_BRIDGE_HOST || '127.0.0.1',
    dataDir,
    profileDir,
    doubaoBaseUrl: env.DOUBAO_BASE_URL || 'https://www.doubao.com',
    headless: toBool(env.DOUBAO_BRIDGE_HEADLESS, false),
    authToken: env.DOUBAO_BRIDGE_AUTH_TOKEN || undefined,
  };
}
