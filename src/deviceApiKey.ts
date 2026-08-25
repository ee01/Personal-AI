/**
 * Per-device tier-2 personal API key for the extension.
 *
 * Issued via BOOTSTRAP_API_KEY for brand-new namespaces (TOFU claim).
 * Already-claimed namespaces require Google verification or an admin-approved
 * requestId. Plaintext is stored only on this device.
 */

import { DEFAULT_MEMORY_SERVICE_BASE_URL } from './memoryServiceConfig';
import {
  getGoogleAuthToken,
  getGoogleAuthTokenSilently,
  GOOGLE_AUTH_SCOPE_SETS,
} from './utils/googleAuth';

export const DEVICE_KEY_STORAGE = 'memoryServiceDeviceKey';
export const DEVICE_ID_STORAGE = 'memoryServiceDeviceId';
export const USER_API_KEY_STORAGE = 'memoryServiceUserApiKey';
export const DEVICE_KEY_STATE_STORAGE = 'memoryServiceDeviceKeyState';

export type StoredDeviceApiKey = {
  userId: string;
  deviceId: string;
  id: string;
  token: string;
  keyPrefix: string;
  label: string;
  createdAt: number;
};

export type DeviceKeyOutcome =
  | { status: 'ok'; token: string }
  | {
      status: 'needs_verification';
      userId: string;
      requestId?: string;
      verifyMethods: string[];
      adminContact?: string;
      googleEmail?: string;
      error?: string;
      message?: string;
    }
  | {
      status: 'pending_approval';
      userId: string;
      requestId: string;
      adminContact?: string;
      googleEmail?: string;
      message?: string;
    }
  | { status: 'unavailable'; reason: string; message?: string };

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

export async function saveDeviceKeyState(
  state: DeviceKeyOutcome,
): Promise<void> {
  await chrome.storage.local.set({ [DEVICE_KEY_STATE_STORAGE]: state });
}

export async function readDeviceKeyState(): Promise<DeviceKeyOutcome | null> {
  const stored = await chrome.storage.local.get([DEVICE_KEY_STATE_STORAGE]);
  const raw = stored[DEVICE_KEY_STATE_STORAGE] as DeviceKeyOutcome | undefined;
  if (!raw || typeof raw !== 'object' || !('status' in raw)) return null;
  return raw;
}

export async function clearDeviceKeyState(): Promise<void> {
  await chrome.storage.local.remove([DEVICE_KEY_STATE_STORAGE]);
}

function deviceLabel(deviceId: string): string {
  const platform =
    typeof navigator !== 'undefined'
      ? navigator.platform || 'browser'
      : 'browser';
  return `Chrome · ${platform} · ${deviceId.slice(-6)}`;
}

/**
 * Ensure this device has a tier-2 key. Uses bootstrap to claim when possible,
 * otherwise Google verification / admin approval. Prefer
 * {@link ensureDeviceApiKeyOutcome} when callers need structured status.
 */
export async function ensureDeviceApiKey(options: {
  baseUrl: string;
  bootstrapKey?: string;
  serviceKey?: string;
  userId: string;
  forceReissue?: boolean;
  googleAccessToken?: string;
  requestId?: string;
  interactiveGoogle?: boolean;
}): Promise<string | null> {
  const outcome = await ensureDeviceApiKeyOutcome(options);
  return outcome.status === 'ok' ? outcome.token : null;
}

export async function ensureDeviceApiKeyOutcome(options: {
  baseUrl: string;
  bootstrapKey?: string;
  serviceKey?: string;
  userId: string;
  forceReissue?: boolean;
  googleAccessToken?: string;
  requestId?: string;
  interactiveGoogle?: boolean;
}): Promise<DeviceKeyOutcome> {
  const userId = String(options.userId || '').trim();
  if (!userId || userId === 'default') {
    const outcome: DeviceKeyOutcome = {
      status: 'unavailable',
      reason: 'user_id_missing',
      message: 'Resolve your user identity before issuing a device key.',
    };
    await saveDeviceKeyState(outcome);
    return outcome;
  }

  if (!options.forceReissue && !options.requestId && !options.googleAccessToken) {
    const existing = await readStoredDeviceKey(userId);
    if (existing?.token) {
      const ok: DeviceKeyOutcome = { status: 'ok', token: existing.token };
      await saveDeviceKeyState(ok);
      return ok;
    }
  }

  const issuer =
    String(options.bootstrapKey || '').trim() ||
    String(options.serviceKey || '').trim();
  if (!issuer && !options.requestId) {
    const helpCenter = !options.forceReissue
      ? await readStoredHelpCenterKey(userId)
      : null;
    if (helpCenter?.token) {
      const ok: DeviceKeyOutcome = { status: 'ok', token: helpCenter.token };
      await saveDeviceKeyState(ok);
      return ok;
    }
    const outcome: DeviceKeyOutcome = {
      status: 'unavailable',
      reason: 'bootstrap_missing',
      message: 'No bootstrap key available to issue a device key.',
    };
    await saveDeviceKeyState(outcome);
    return outcome;
  }

  const googleAccessToken = String(options.googleAccessToken || '').trim();
  if (!googleAccessToken && options.interactiveGoogle !== false) {
    // First attempt may already know we need verification; callers can pass
    // interactiveGoogle=true on retry. Default path tries silent then falls back.
  }

  const issued = await issueWritableDeviceKey({
    baseUrl: options.baseUrl,
    userId,
    issuer: issuer || String(options.bootstrapKey || options.serviceKey || ''),
    googleAccessToken: googleAccessToken || undefined,
    requestId: options.requestId,
  });

  if (issued.status === 'ok') {
    await saveDeviceKeyState(issued);
    return issued;
  }

  // If claim gate asked for Google and we have no token yet, try to obtain one.
  if (
    issued.status === 'needs_verification' &&
    (issued.verifyMethods || []).includes('google') &&
    !googleAccessToken
  ) {
    const token = await obtainGoogleAccessToken(
      options.interactiveGoogle === true,
    );
    if (token) {
      const retried = await issueWritableDeviceKey({
        baseUrl: options.baseUrl,
        userId,
        issuer,
        googleAccessToken: token,
        requestId: issued.requestId,
      });
      await saveDeviceKeyState(retried);
      return retried;
    }
  }

  await saveDeviceKeyState(issued);
  return issued;
}

async function obtainGoogleAccessToken(
  interactive: boolean,
): Promise<string | null> {
  try {
    if (!interactive) {
      const silent = await getGoogleAuthTokenSilently({
        caller: 'deviceApiKey.verify',
        scopes: GOOGLE_AUTH_SCOPE_SETS.IDENTITY,
      });
      if (silent) return silent;
    }
    return await getGoogleAuthToken({
      caller: 'deviceApiKey.verify',
      scopes: GOOGLE_AUTH_SCOPE_SETS.IDENTITY,
    });
  } catch (error) {
    console.warn('[device-key] google auth failed', error);
    return null;
  }
}

/** Interactive Google verify + reissue for Options / banner actions. */
export async function verifyDeviceKeyWithGoogle(options: {
  baseUrl: string;
  bootstrapKey?: string;
  serviceKey?: string;
  userId: string;
  requestId?: string;
}): Promise<DeviceKeyOutcome> {
  return ensureDeviceApiKeyOutcome({
    ...options,
    forceReissue: true,
    interactiveGoogle: true,
  });
}

/** Poll an admin-approved request and finish issuance. */
export async function completeApprovedDeviceKeyRequest(options: {
  baseUrl: string;
  bootstrapKey?: string;
  serviceKey?: string;
  userId: string;
  requestId: string;
}): Promise<DeviceKeyOutcome> {
  return ensureDeviceApiKeyOutcome({
    ...options,
    forceReissue: true,
    requestId: options.requestId,
    interactiveGoogle: false,
  });
}

export async function fetchDeviceKeyRequestStatus(options: {
  baseUrl: string;
  bootstrapKey?: string;
  serviceKey?: string;
  userId: string;
  requestId: string;
}): Promise<{ status: string; requestId: string } | null> {
  const issuer =
    String(options.bootstrapKey || '').trim() ||
    String(options.serviceKey || '').trim();
  if (!issuer) return null;
  const base = (options.baseUrl || DEFAULT_MEMORY_SERVICE_BASE_URL).replace(
    /\/+$/,
    '',
  );
  try {
    const response = await fetch(
      `${base}/users/me/key-requests/${encodeURIComponent(options.requestId)}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${issuer}`,
          'X-User-Id': options.userId,
        },
      },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as {
      request?: { id?: string; status?: string };
    };
    if (!body.request?.status) return null;
    return {
      status: String(body.request.status),
      requestId: String(body.request.id || options.requestId),
    };
  } catch {
    return null;
  }
}

async function issueWritableDeviceKey(options: {
  baseUrl: string;
  userId: string;
  issuer: string;
  googleAccessToken?: string;
  requestId?: string;
}): Promise<DeviceKeyOutcome> {
  const { userId, issuer } = options;
  const deviceId = await getOrCreateDeviceId();
  const label = deviceLabel(deviceId);
  const base = (options.baseUrl || DEFAULT_MEMORY_SERVICE_BASE_URL).replace(
    /\/+$/,
    '',
  );

  if (!issuer && !options.requestId) {
    return {
      status: 'unavailable',
      reason: 'bootstrap_missing',
      message: 'No issuer credential for device key POST.',
    };
  }

  try {
    const body: Record<string, unknown> = {
      label,
      scopes: ['memory.read', 'memory.write'],
    };
    if (options.requestId) body.requestId = options.requestId;
    if (options.googleAccessToken) {
      body.verification = {
        provider: 'google',
        accessToken: options.googleAccessToken,
      };
    }

    const response = await fetch(`${base}/users/me/keys`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${issuer}`,
        'X-User-Id': userId,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text().catch(() => '');
    let parsed: Record<string, any> = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {};
    }

    if (response.ok) {
      if (!parsed.token || !parsed.key?.id) {
        return {
          status: 'unavailable',
          reason: 'malformed_issue_response',
          message: 'Server returned an incomplete key payload.',
        };
      }
      const record: StoredDeviceApiKey = {
        userId,
        deviceId,
        id: String(parsed.key.id),
        token: String(parsed.token),
        keyPrefix: String(parsed.key.keyPrefix || ''),
        label: String(parsed.key.label || label),
        createdAt: Number(parsed.key.createdAt) || Math.floor(Date.now() / 1000),
      };
      await saveStoredDeviceKey(record);
      return { status: 'ok', token: record.token };
    }

    const errorCode = String(parsed.error || '');
    const requestId = parsed.requestId
      ? String(parsed.requestId)
      : undefined;
    const verifyMethods = Array.isArray(parsed.verifyMethods)
      ? parsed.verifyMethods.map(String)
      : [];
    const adminContact = parsed.adminContact
      ? String(parsed.adminContact)
      : undefined;
    const googleEmail = parsed.googleEmail
      ? String(parsed.googleEmail)
      : undefined;
    const message = parsed.message ? String(parsed.message) : text;

    if (
      response.status === 409 &&
      (errorCode === 'user_already_claimed' ||
        errorCode === 'google_email_mismatch')
    ) {
      if (errorCode === 'google_email_mismatch' && requestId) {
        return {
          status: 'pending_approval',
          userId,
          requestId,
          adminContact,
          googleEmail,
          message,
        };
      }
      return {
        status: 'needs_verification',
        userId,
        requestId,
        verifyMethods,
        adminContact,
        googleEmail,
        error: errorCode,
        message,
      };
    }

    if (response.status === 409 && errorCode === 'request_not_approved') {
      return {
        status: 'pending_approval',
        userId,
        requestId: requestId || String(options.requestId || ''),
        adminContact,
        message,
      };
    }

    console.warn('[device-key] issue failed', response.status, text);
    return {
      status: 'unavailable',
      reason: errorCode || `http_${response.status}`,
      message: message || `Device key issue failed (${response.status})`,
    };
  } catch (error) {
    console.warn('[device-key] issue error', error);
    return {
      status: 'unavailable',
      reason: 'network_error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function resolveUserIdFromStorage(): Promise<string | null> {
  const result = await chrome.storage.local.get(['userinfo']);
  return resolveUserId(result.userinfo as any);
}
