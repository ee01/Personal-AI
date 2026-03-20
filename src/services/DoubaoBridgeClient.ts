const DEFAULT_BASE_URL = 'http://127.0.0.1:46321/api/v1';
const DEFAULT_TIMEOUT_MS = 15_000;
const STORAGE_KEY = 'doubaoBridgeConfig';

export type DoubaoBridgeBindingType = 'memory_sync' | 'mobile_context';

export interface DoubaoBridgeSettings {
  baseUrl: string;
  bridgeToken?: string;
  autoRefreshMs?: number;
}

export interface DoubaoBridgeHealth {
  ok: boolean;
  version?: string;
  mode?: 'headless' | 'windowed' | 'service';
  profilePath?: string;
  signedIn?: boolean;
  accountLabel?: string;
  lastLoginAt?: string;
  lastError?: string;
}

export interface DoubaoBridgeBinding {
  bindingType: DoubaoBridgeBindingType;
  threadId?: string;
  threadUrl?: string;
  title?: string;
  updatedAt?: string;
}

export interface DoubaoBridgeStatus {
  ok: boolean;
  bridgeRunning?: boolean;
  authState?: 'signed_in' | 'signed_out' | 'unknown';
  bindings?: DoubaoBridgeBinding[];
  lastSyncAt?: string;
  lastError?: string;
}

export interface DoubaoBridgeCapability {
  name: string;
  enabled: boolean;
  description?: string;
}

export interface DoubaoBridgeSyncResult {
  accepted: boolean;
  jobId?: string;
  message?: string;
  threadId?: string;
  updatedAt?: string;
}

export interface DoubaoBridgeThreadBindingPayload {
  threadId?: string;
  threadUrl?: string;
  title?: string;
  note?: string;
}

export interface DoubaoBridgeStableMemoryPayload {
  title: string;
  body: string;
  stability?: 'stable' | 'rolling';
  sourceRefs?: string[];
  dedupeKey?: string;
}

export interface DoubaoBridgeMobileBriefingPayload {
  title: string;
  body: string;
  sourceRefs?: string[];
  ttlMinutes?: number;
  dedupeKey?: string;
}

export interface DoubaoBridgeQueryCardPayload {
  query: string;
  title: string;
  answer: string;
  evidence?: Array<{ label: string; value: string }>;
}

export interface DoubaoBridgeReminderPayload {
  title: string;
  body: string;
  dueAt?: string;
  sourceRefs?: string[];
  dedupeKey?: string;
}

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function readTextResponse(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function mergeUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export class DoubaoBridgeClient {
  private baseUrl: string;
  private bridgeToken?: string;
  private timeoutMs: number;

  constructor(config?: Partial<DoubaoBridgeSettings>) {
    this.baseUrl = config?.baseUrl ?? DEFAULT_BASE_URL;
    this.bridgeToken = config?.bridgeToken;
    this.timeoutMs = DEFAULT_TIMEOUT_MS;
  }

  async loadSettings(): Promise<DoubaoBridgeSettings> {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
      return { baseUrl: this.baseUrl, bridgeToken: this.bridgeToken };
    }

    const result = await chrome.storage.local.get(STORAGE_KEY) as {
      [STORAGE_KEY]?: DoubaoBridgeSettings;
    };
    const stored = result[STORAGE_KEY];
    if (stored?.baseUrl) {
      this.baseUrl = stored.baseUrl;
    }
    if (stored?.bridgeToken !== undefined) {
      this.bridgeToken = stored.bridgeToken || undefined;
    }
    return {
      baseUrl: this.baseUrl,
      bridgeToken: this.bridgeToken,
      autoRefreshMs: stored?.autoRefreshMs,
    };
  }

  async saveSettings(settings: Partial<DoubaoBridgeSettings>): Promise<DoubaoBridgeSettings> {
    const next: DoubaoBridgeSettings = {
      baseUrl: settings.baseUrl?.trim() || this.baseUrl || DEFAULT_BASE_URL,
      bridgeToken: settings.bridgeToken !== undefined ? settings.bridgeToken || undefined : this.bridgeToken,
      autoRefreshMs: settings.autoRefreshMs,
    };

    this.baseUrl = next.baseUrl;
    this.bridgeToken = next.bridgeToken;

    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: next });
    }

    return next;
  }

  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl.trim() || DEFAULT_BASE_URL;
  }

  setBridgeToken(token?: string): void {
    this.bridgeToken = token?.trim() || undefined;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getBridgeToken(): string | undefined {
    return this.bridgeToken;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.bridgeToken) {
      headers.Authorization = `Bearer ${this.bridgeToken}`;
    }

    const response = await fetch(mergeUrl(this.baseUrl, path), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timer);
    });

    if (!response.ok) {
      const errorText = await readTextResponse(response);
      throw new Error(
        errorText ||
          `Doubao Bridge request failed: ${method} ${path} (${response.status} ${response.statusText})`,
      );
    }

    const text = await readTextResponse(response);
    if (!text) {
      return {} as T;
    }

    const parsed = safeJsonParse<T>(text);
    return (parsed ?? (text as unknown as T));
  }

  getHealth(): Promise<DoubaoBridgeHealth> {
    return this.request<DoubaoBridgeHealth>('GET', '/health');
  }

  getStatus(): Promise<DoubaoBridgeStatus> {
    return this.request<DoubaoBridgeStatus>('GET', '/status');
  }

  getCapabilities(): Promise<{ capabilities: DoubaoBridgeCapability[] }> {
    return this.request<{ capabilities: DoubaoBridgeCapability[] }>('GET', '/capabilities');
  }

  openLogin(): Promise<{ opened: boolean; message?: string }> {
    return this.request<{ opened: boolean; message?: string }>('POST', '/auth/open-login');
  }

  requestReauth(): Promise<{ opened: boolean; message?: string }> {
    return this.request<{ opened: boolean; message?: string }>('POST', '/auth/request-login');
  }

  getBindings(): Promise<{ bindings: DoubaoBridgeBinding[] }> {
    return this.request<{ bindings: DoubaoBridgeBinding[] }>('GET', '/bindings');
  }

  bindThread(
    bindingType: DoubaoBridgeBindingType,
    payload: DoubaoBridgeThreadBindingPayload,
  ): Promise<{ binding: DoubaoBridgeBinding; message?: string }> {
    return this.request<{ binding: DoubaoBridgeBinding; message?: string }>('POST', '/bindings', {
      bindingType,
      ...payload,
    });
  }

  bindMemorySyncThread(payload: DoubaoBridgeThreadBindingPayload): Promise<{ binding: DoubaoBridgeBinding; message?: string }> {
    return this.bindThread('memory_sync', payload);
  }

  bindMobileContextThread(payload: DoubaoBridgeThreadBindingPayload): Promise<{ binding: DoubaoBridgeBinding; message?: string }> {
    return this.bindThread('mobile_context', payload);
  }

  syncStableMemory(payload: DoubaoBridgeStableMemoryPayload): Promise<DoubaoBridgeSyncResult> {
    return this.request<DoubaoBridgeSyncResult>('POST', '/sync/stable-memory', payload);
  }

  syncMobileBriefing(payload: DoubaoBridgeMobileBriefingPayload): Promise<DoubaoBridgeSyncResult> {
    return this.request<DoubaoBridgeSyncResult>('POST', '/sync/mobile-briefing', payload);
  }

  syncQueryCard(payload: DoubaoBridgeQueryCardPayload): Promise<DoubaoBridgeSyncResult> {
    return this.request<DoubaoBridgeSyncResult>('POST', '/sync/query-card', payload);
  }

  syncReminderDigest(payload: DoubaoBridgeReminderPayload): Promise<DoubaoBridgeSyncResult> {
    return this.request<DoubaoBridgeSyncResult>('POST', '/sync/reminders', payload);
  }
}
