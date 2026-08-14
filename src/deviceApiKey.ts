/**
 * Per-device tier-2 personal API key for the extension.
 *
 * Issued via BOOTSTRAP_API_KEY (keys.issue only). Plaintext is stored only on
 * this device; Options lists all devices via GET /users/me/keys metadata.
 */

import { DEFAULT_MEMORY_SERVICE_BASE_URL } from './memoryServiceConfig';

export const DEVICE_KEY_STORAGE = 'memoryServiceDeviceKey';
export const DEVICE_ID_STORAGE = 'memoryServiceDeviceId';
export const USER_API_KEY_STORAGE = 'memoryServiceUserApiKey';

export type StoredDeviceApiKey = {
  userId: string;
  deviceId: string;
  id: string;
  token: string;
  keyPrefix: string;
  label: string;
  createdAt: number;
};

function randomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function resolveUserId(userinfo?: {
  username?: string;
  email?: string;
  userEmail?: string;
}): string | null {
  const username = String(userinfo?.username || '').trim();
  if (username) return username;
  const email = String(userinfo?.userEmail || userinfo?.email || '').trim();
  if (email.includes('@')) return email.split('@')[0] || null;
  return null;
}

export async function getOrCreateDeviceId(): Promise<string> {
  const stored = await chrome.storage.local.get([DEVICE_ID_STORAGE]);
  const existing = String(stored[DEVICE_ID_STORAGE] || '').trim();
  if (existing) return existing;
  const deviceId = `dev_${randomId()}`;
  await chrome.storage.local.set({ [DEVICE_ID_STORAGE]: deviceId });
  return deviceId;
}

function normalizeStoredKey(
  raw: Partial<StoredDeviceApiKey> | undefined,
  userId: string,
): StoredDeviceApiKey | null {
  if (!raw?.token || !raw?.userId) return null;
  if (raw.userId !== userId) return null;
  return {
    userId: raw.userId,
    deviceId: String(raw.deviceId || ''),
    id: String(raw.id || ''),
    token: String(raw.token),
    keyPrefix: String(raw.keyPrefix || raw.token.slice(0, 18)),
    label: String(raw.label || ''),
    createdAt: Number(raw.createdAt) || 0,
  };
}

export async function readStoredDeviceKey(
  userId: string,
): Promise<StoredDeviceApiKey | null> {
  const stored = await chrome.storage.local.get([DEVICE_KEY_STORAGE]);
  return normalizeStoredKey(
    stored[DEVICE_KEY_STORAGE] as Partial<StoredDeviceApiKey> | undefined,
    userId,
  );
}

export async function readStoredHelpCenterKey(
  userId: string,
): Promise<StoredDeviceApiKey | null> {
  const stored = await chrome.storage.local.get([USER_API_KEY_STORAGE]);
  return normalizeStoredKey(
    stored[USER_API_KEY_STORAGE] as Partial<StoredDeviceApiKey> | undefined,
    userId,
  );
}

export async function saveStoredDeviceKey(
  key: StoredDeviceApiKey,
): Promise<void> {
  await chrome.storage.local.set({ [DEVICE_KEY_STORAGE]: key });
}

export async function clearStoredDeviceKey(): Promise<void> {
  await chrome.storage.local.remove([DEVICE_KEY_STORAGE]);
}

export async function clearStoredHelpCenterKey(): Promise<void> {
  await chrome.storage.local.remove([USER_API_KEY_STORAGE]);
}

function deviceLabel(deviceId: string): string {
  const platform =
    typeof navigator !== 'undefined'
      ? navigator.platform || 'browser'
      : 'browser';
  return `Chrome · ${platform} · ${deviceId.slice(-6)}`;
}

/**
 * Ensure this device has a tier-2 key. Uses bootstrap key to mint one when
 * missing. Returns the bearer token, or null if issuance is unavailable.
 */
export async function ensureDeviceApiKey(options: {
  baseUrl: string;
  bootstrapKey?: string;
  serviceKey?: string;
  userId: string;
  forceReissue?: boolean;
}): Promise<string | null> {
  const userId = String(options.userId || '').trim();
  if (!userId || userId === 'default') return null;

  if (!options.forceReissue) {
    const existing = await readStoredDeviceKey(userId);
    if (existing?.token) return existing.token;
  }

  const issuer =
    String(options.bootstrapKey || '').trim() ||
    String(options.serviceKey || '').trim();
  if (issuer) {
    const issued = await issueWritableDeviceKey({
      ...options,
      userId,
      issuer,
    });
    if (issued) return issued;
  }

  // Last resort: keep traffic authenticated. Help-center keys are often
  // read-only, so POST may 403 and then rotate; never send anonymous X-User-Id.
  if (!options.forceReissue) {
    const helpCenter = await readStoredHelpCenterKey(userId);
    if (helpCenter?.token) return helpCenter.token;
  }
  return null;
}

async function issueWritableDeviceKey(options: {
  baseUrl: string;
  userId: string;
  issuer: string;
}): Promise<string | null> {
  const { userId, issuer } = options;
  const deviceId = await getOrCreateDeviceId();
  const label = deviceLabel(deviceId);
  const base = (options.baseUrl || DEFAULT_MEMORY_SERVICE_BASE_URL).replace(
    /\/+$/,
    '',
  );

  try {
    const response = await fetch(`${base}/users/me/keys`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${issuer}`,
        'X-User-Id': userId,
      },
      body: JSON.stringify({
        label,
        scopes: ['memory.read', 'memory.write'],
      }),
    });
    if (!response.ok) {
      console.warn(
        '[device-key] issue failed',
        response.status,
        await response.text().catch(() => ''),
      );
      return null;
    }
    const body = (await response.json()) as {
      token?: string;
      key?: {
        id?: string;
        keyPrefix?: string;
        createdAt?: number;
        label?: string;
      };
    };
    if (!body.token || !body.key?.id) return null;
    const record: StoredDeviceApiKey = {
      userId,
      deviceId,
      id: String(body.key.id),
      token: body.token,
      keyPrefix: String(body.key.keyPrefix || ''),
      label: String(body.key.label || label),
      createdAt: Number(body.key.createdAt) || Math.floor(Date.now() / 1000),
    };
    await saveStoredDeviceKey(record);
    return record.token;
  } catch (error) {
    console.warn('[device-key] issue error', error);
    return null;
  }
}

export async function resolveUserIdFromStorage(): Promise<string | null> {
  const result = await chrome.storage.local.get(['userinfo']);
  return resolveUserId(result.userinfo as any);
}
