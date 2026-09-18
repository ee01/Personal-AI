/**
 * Per-device tier-2 personal API key for the desktop app.
 *
 * Mirrors the Chrome extension's `src/deviceApiKey.ts` flow: the app mints its
 * own `pak.<base64url(userId)>.<secret>` from an issuer credential (bootstrap
 * key for an unclaimed namespace, or an existing personal/service key) and
 * keeps the plaintext only on this machine. Business requests then use the
 * device key instead of the full-privilege service key.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/** Issued key material. Plaintext never leaves `{dataDir}/device-key.json`. */
export interface StoredDeviceApiKey {
  userId: string;
  deviceId: string;
  id: string;
  token: string;
  keyPrefix: string;
  label: string;
  createdAt: number;
}

export type DeviceKeyOutcome =
  | {
      status: 'ok';
      keyPrefix: string;
      label: string;
      createdAt: number;
    }
  | {
      status: 'needs_verification';
      userId: string;
      requestId?: string;
      verifyMethods: string[];
      adminContact?: string;
      error?: string;
      message?: string;
    }
  | {
      status: 'pending_approval';
      userId: string;
      requestId: string;
      adminContact?: string;
      message?: string;
    }
  | { status: 'unavailable'; reason: string; message?: string };

export interface DeviceKeyStatus {
  outcome: DeviceKeyOutcome;
  hasToken: boolean;
  deviceId: string;
  label: string;
  nextRetryAt?: number;
  checkedAt?: number;
}

interface PersistedDeviceKeyFile {
  deviceId?: string;
  key?: StoredDeviceApiKey;
  state?: DeviceKeyOutcome;
  nextRetryAt?: number;
  checkedAt?: number;
}

export interface DeviceApiKeyIssuerSettings {
  memoryServiceBaseUrl?: string;
  memoryServiceApiKey?: string;
  memoryServiceBootstrapKey?: string;
  memoryServiceUserId?: string;
}

export interface DeviceApiKeyManagerOptions {
  file: string;
  readSettings: () => DeviceApiKeyIssuerSettings;
  fetchImpl?: typeof fetch;
  now?: () => number;
  platform?: string;
  log?: (message: string, error?: unknown) => void;
}

export interface EnsureDeviceKeyOptions {
  /** Mint a new key even when one is cached. */
  forceReissue?: boolean;
  /** Ignore the backoff window set by a previous failure. */
  ignoreBackoff?: boolean;
  /** Consume an admin-approved device key request. */
  requestId?: string;
  /** Google OAuth access token for an already-claimed namespace. */
  googleAccessToken?: string;
}

/** Server error codes that mean the cached key is dead rather than wrong-scoped. */
const STALE_KEY_ERRORS = new Set([
  'invalid_user_api_key',
  'user_key_user_mismatch',
  'user_key_scope_insufficient',
]);

const RETRY_AFTER_RATE_LIMIT_MS = 15 * 60_000;
const RETRY_AFTER_CLAIM_GATE_MS = 10 * 60_000;
const RETRY_AFTER_FAILURE_MS = 5 * 60_000;

function normalizeBaseUrl(value?: string): string | undefined {
  const normalized = value?.trim().replace(/\/$/, '') || undefined;
  if (!normalized) return undefined;
  return normalized.replace(/\/api\/v1$/i, '');
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

/**
 * Owns this machine's device key: persistence, issuance, claim-gate state and
 * rotation after the server rejects a stale key.
 */
export class DeviceApiKeyManager {
  private loaded = false;
  private data: PersistedDeviceKeyFile = {};
  private inFlight: Promise<DeviceKeyOutcome> | null = null;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly platform: string;
  private readonly log: (message: string, error?: unknown) => void;

  constructor(private readonly options: DeviceApiKeyManagerOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => Date.now());
    this.platform = options.platform ?? process.platform;
    this.log =
      options.log ??
      ((message, error) =>
        error === undefined
          ? console.warn(message)
          : console.warn(message, error));
  }

  async init(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.options.file, 'utf8');
      this.data = JSON.parse(raw) as PersistedDeviceKeyFile;
    } catch {
      this.data = {};
    }
    if (!this.data.deviceId) {
      this.data.deviceId = `dev_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      await this.persist();
    }
    this.loaded = true;
  }

  /** Cached token for the currently configured user, if any. */
  getToken(): string | undefined {
    const userId = this.userId();
    if (!userId) return undefined;
    const key = normalizeStoredKey(this.data.key, userId);
    return key?.token;
  }

  getStatus(): DeviceKeyStatus {
    return {
      outcome: this.data.state ?? {
        status: 'unavailable',
        reason: 'not_issued',
      },
      hasToken: Boolean(this.getToken()),
      deviceId: this.data.deviceId || '',
      label: this.label(),
      nextRetryAt: this.data.nextRetryAt,
      checkedAt: this.data.checkedAt,
    };
  }

  /** Drop the cached key so the next `ensure()` mints a fresh one. */
  async invalidate(): Promise<void> {
    await this.init();
    if (!this.data.key) return;
    delete this.data.key;
    await this.persist();
  }

  /**
   * Rotate after the server rejected the credential we just sent. Returns true
   * when a different token is now available, i.e. the caller should retry.
   */
  async handleAuthFailure(
    usedToken: string | undefined,
    payload: unknown,
  ): Promise<boolean> {
    const errorCode =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error?: unknown }).error || '')
        : '';

    // `authentication_required` means we sent no credential at all, so there is
    // nothing stale to drop — just try to issue one.
    if (usedToken && STALE_KEY_ERRORS.has(errorCode)) {
      await this.invalidate();
    } else if (errorCode !== 'authentication_required' && usedToken) {
      return false;
    }

    const outcome = await this.ensure({
      forceReissue: false,
      ignoreBackoff: true,
    });
    if (outcome.status !== 'ok') return false;
    const token = this.getToken();
    return Boolean(token) && token !== usedToken;
  }

  /**
   * Make sure this device holds a usable key, minting one when needed.
   * Concurrent callers share a single issuance attempt.
   */
  async ensure(options: EnsureDeviceKeyOptions = {}): Promise<DeviceKeyOutcome> {
    await this.init();
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.ensureOnce(options).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async ensureOnce(
    options: EnsureDeviceKeyOptions,
  ): Promise<DeviceKeyOutcome> {
    const userId = this.userId();
    if (!userId) {
      return this.record({
        status: 'unavailable',
        reason: 'user_id_missing',
        message: '请先在设置里填写 Memory Service User ID。',
      });
    }

    const baseUrl = normalizeBaseUrl(
      this.options.readSettings().memoryServiceBaseUrl,
    );
    if (!baseUrl) {
      return this.record({
        status: 'unavailable',
        reason: 'base_url_missing',
        message: '请先在设置里填写 Memory Service Base URL。',
      });
    }

    const explicitRequest = Boolean(
      options.requestId || options.googleAccessToken,
    );

    if (!options.forceReissue && !explicitRequest) {
      const existing = normalizeStoredKey(this.data.key, userId);
      if (existing?.token) {
        return this.record(
          {
            status: 'ok',
            keyPrefix: existing.keyPrefix,
            label: existing.label,
            createdAt: existing.createdAt,
          },
          { clearRetry: true },
        );
      }
    }

    if (
      !options.ignoreBackoff &&
      !explicitRequest &&
      this.data.nextRetryAt &&
      this.now() < this.data.nextRetryAt
    ) {
      return (
        this.data.state ?? { status: 'unavailable', reason: 'backoff_pending' }
      );
    }

    const issuer = this.issuerCredential();
    if (!issuer) {
      return this.record(
        {
          status: 'unavailable',
          reason: 'issuer_missing',
          message:
            '没有可用于签发设备密钥的凭据。请在设置里填入 bootstrap key、服务密钥或已有的个人 key。',
        },
        { retryAfterMs: RETRY_AFTER_FAILURE_MS },
      );
    }

    const outcome = await this.issue({
      baseUrl,
      userId,
      issuer,
      requestId: options.requestId,
      googleAccessToken: options.googleAccessToken,
    });

    if (outcome.status === 'ok') {
      return this.record(outcome, { clearRetry: true });
    }
    if (outcome.status === 'unavailable') {
      return this.record(outcome, {
        retryAfterMs:
          outcome.reason === 'key_issue_rate_limited'
            ? RETRY_AFTER_RATE_LIMIT_MS
            : RETRY_AFTER_FAILURE_MS,
      });
    }
    // Claim gate: retry on the same stable label so an admin approval is picked
    // up automatically without the user pasting a requestId.
    return this.record(outcome, { retryAfterMs: RETRY_AFTER_CLAIM_GATE_MS });
  }

  private async issue(input: {
    baseUrl: string;
    userId: string;
    issuer: string;
    requestId?: string;
    googleAccessToken?: string;
  }): Promise<DeviceKeyOutcome> {
    const label = this.label();
    const body: Record<string, unknown> = {
      label,
      scopes: ['memory.read', 'memory.write'],
    };
    if (input.requestId) body.requestId = input.requestId;
    if (input.googleAccessToken) {
      body.verification = {
        provider: 'google',
        accessToken: input.googleAccessToken,
      };
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${input.baseUrl}/api/v1/users/me/keys`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${input.issuer}`,
          'X-User-Id': input.userId,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      this.log('[desktop-app] device key issue request failed', error);
      return {
        status: 'unavailable',
        reason: 'network_error',
        message: error instanceof Error ? error.message : String(error),
      };
    }

    const text = await response.text().catch(() => '');
    let parsed: Record<string, unknown> = {};
    try {
      parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      parsed = {};
    }

    if (response.ok) {
      const key = parsed.key as Record<string, unknown> | undefined;
      const token = String(parsed.token || '');
      if (!token || !key?.id) {
        return {
          status: 'unavailable',
          reason: 'malformed_issue_response',
          message: '服务端返回的密钥内容不完整。',
        };
      }
      const record: StoredDeviceApiKey = {
        userId: input.userId,
        deviceId: this.data.deviceId || '',
        id: String(key.id),
        token,
        keyPrefix: String(key.keyPrefix || token.slice(0, 18)),
        label: String(key.label || label),
        createdAt: Number(key.createdAt) || Math.floor(this.now() / 1000),
      };
      this.data.key = record;
      return {
        status: 'ok',
        keyPrefix: record.keyPrefix,
        label: record.label,
        createdAt: record.createdAt,
      };
    }

    const errorCode = String(parsed.error || '');
    const message = parsed.message ? String(parsed.message) : text;
    const requestId = parsed.requestId ? String(parsed.requestId) : undefined;
    const adminContact = parsed.adminContact
      ? String(parsed.adminContact)
      : undefined;
    const verifyMethods = Array.isArray(parsed.verifyMethods)
      ? parsed.verifyMethods.map(String)
      : [];

    if (response.status === 409 && errorCode === 'request_not_approved') {
      return {
        status: 'pending_approval',
        userId: input.userId,
        requestId: requestId || String(input.requestId || ''),
        adminContact,
        message,
      };
    }

    if (
      response.status === 409 &&
      (errorCode === 'user_already_claimed' ||
        errorCode === 'google_email_mismatch')
    ) {
      if (errorCode === 'google_email_mismatch' && requestId) {
        return {
          status: 'pending_approval',
          userId: input.userId,
          requestId,
          adminContact,
          message,
        };
      }
      return {
        status: 'needs_verification',
        userId: input.userId,
        requestId,
        verifyMethods,
        adminContact,
        error: errorCode,
        message,
      };
    }

    this.log(
      `[desktop-app] device key issue failed (${response.status} ${errorCode || 'unknown'})`,
    );
    return {
      status: 'unavailable',
      reason: errorCode || `http_${response.status}`,
      message: message || `设备密钥签发失败（HTTP ${response.status}）`,
    };
  }

  /** Poll an admin-approved request without consuming it. */
  async fetchRequestStatus(
    requestId: string,
  ): Promise<{ status: string; requestId: string } | null> {
    await this.init();
    const userId = this.userId();
    const baseUrl = normalizeBaseUrl(
      this.options.readSettings().memoryServiceBaseUrl,
    );
    const issuer = this.issuerCredential();
    if (!userId || !baseUrl || !issuer) return null;

    try {
      const response = await this.fetchImpl(
        `${baseUrl}/api/v1/users/me/key-requests/${encodeURIComponent(requestId)}`,
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${issuer}`,
            'X-User-Id': userId,
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
        requestId: String(body.request.id || requestId),
      };
    } catch (error) {
      this.log('[desktop-app] device key request status failed', error);
      return null;
    }
  }

  private userId(): string | undefined {
    const userId = this.options.readSettings().memoryServiceUserId?.trim();
    if (!userId || userId === 'default') return undefined;
    return userId;
  }

  /**
   * Credential used to mint the device key. A bootstrap key only works on an
   * unclaimed namespace, so an already-working personal/service key wins.
   */
  private issuerCredential(): string | undefined {
    const settings = this.options.readSettings();
    return (
      settings.memoryServiceApiKey?.trim() ||
      settings.memoryServiceBootstrapKey?.trim() ||
      undefined
    );
  }

  /** Stable across restarts so the server can match an approved request. */
  private label(): string {
    const suffix = (this.data.deviceId || '').slice(-6) || 'unknown';
    return `Desktop · ${this.platform} · ${suffix}`;
  }

  private async record(
    outcome: DeviceKeyOutcome,
    options: { retryAfterMs?: number; clearRetry?: boolean } = {},
  ): Promise<DeviceKeyOutcome> {
    this.data.state = outcome;
    this.data.checkedAt = this.now();
    if (options.clearRetry) {
      delete this.data.nextRetryAt;
    } else if (options.retryAfterMs) {
      this.data.nextRetryAt = this.now() + options.retryAfterMs;
    }
    await this.persist();
    return outcome;
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.options.file), { recursive: true });
    await fs.writeFile(
      this.options.file,
      `${JSON.stringify(this.data, null, 2)}\n`,
      { mode: 0o600 },
    );
  }
}
