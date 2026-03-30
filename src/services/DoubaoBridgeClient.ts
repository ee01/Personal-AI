const DEFAULT_BASE_URL = 'http://127.0.0.1:46321';
const DEFAULT_TIMEOUT_MS = 15_000;
const STORAGE_KEY = 'doubaoBridgeConfig';

export type DoubaoBridgeBindingType = 'memory_sync' | 'mobile_context';
export type DoubaoBridgeAuthStatus = 'unknown' | 'needs_login' | 'connected' | 'error';
export type DoubaoBridgeSyncKind = 'stable_memory' | 'mobile_briefing' | 'query_inject' | 'reminder_sync';

export interface DoubaoBridgeSettings {
  baseUrl: string;
  bridgeToken?: string;
  autoRefreshMs?: number;
}

export interface DoubaoBridgeRuntimeSettings {
  memoryServiceBaseUrl?: string;
  autoSync: boolean;
  pollIntervalMs: number;
  stableMemoryIntervalMs: number;
  mobileBriefingIntervalMs: number;
  reminderSyncIntervalMs: number;
}

export interface DoubaoBridgeSettingsPayload {
  defaults: DoubaoBridgeRuntimeSettings;
  user: Partial<DoubaoBridgeRuntimeSettings>;
  effective: DoubaoBridgeRuntimeSettings;
}

export interface DoubaoBridgeHealth {
  ok: boolean;
  service?: string;
  version?: string;
  config?: {
    host?: string;
    port?: number;
    headless?: boolean;
  };
}

export interface DoubaoBridgeBinding {
  bindingType: DoubaoBridgeBindingType;
  threadId?: string;
  threadUrl?: string;
  title?: string;
  updatedAt?: string;
}

export interface DoubaoBridgeThread {
  id: string;
  kind: DoubaoBridgeBindingType | 'manual' | 'unknown';
  title: string;
  url?: string;
  bindingType?: DoubaoBridgeBindingType;
  createdAt: string;
  updatedAt: string;
}

export interface DoubaoBridgePairResult {
  paired: boolean;
  token: string;
  createdAt: string;
}

export interface DoubaoBridgeStatus {
  appVersion?: string;
  paired: boolean;
  authStatus: DoubaoBridgeAuthStatus;
  browserRunning: boolean;
  currentUrl?: string;
  pairToken?: string;
  bindings: Partial<Record<DoubaoBridgeBindingType, DoubaoBridgeBinding>>;
  threads: DoubaoBridgeThread[];
  lastSyncAt?: string;
  lastError?: string;
  memoryServiceConfigured?: boolean;
  autoSyncEnabled?: boolean;
  blockingReasons?: Array<{
    code: string;
    message: string;
    syncKinds?: Array<'stableMemory' | 'mobileBriefing' | 'reminderSync'>;
  }>;
  syncReadiness?: Record<'stableMemory' | 'mobileBriefing' | 'reminderSync', {
    ready: boolean;
    reasons: Array<{ code: string; message: string }>;
    intervalMs: number;
    lastRunAt?: string;
  }>;
  syncState?: {
    timerActive: boolean;
    running: boolean;
    autoSyncEnabled: boolean;
    memoryServiceConfigured: boolean;
    pollIntervalMs: number;
    tasks: Record<'stableMemory' | 'mobileBriefing' | 'reminderSync', {
      intervalMs: number;
      lastRunAt?: string;
      nextDueAt?: string;
      due: boolean;
    }>;
  };
  settings?: DoubaoBridgeRuntimeSettings;
  setupChecklist?: {
    memoryServiceConfigured: boolean;
    autoSyncEnabled: boolean;
    doubaoConnected: boolean;
    memorySyncBound: boolean;
    mobileContextBound: boolean;
  };
}

export interface DoubaoBridgeThreadsResponse {
  threads: DoubaoBridgeThread[];
  bindings: Partial<Record<DoubaoBridgeBindingType, DoubaoBridgeBinding>>;
}

export interface DoubaoBridgeSyncResult {
  accepted: boolean;
  kind: DoubaoBridgeSyncKind;
  targetBindingType: DoubaoBridgeBindingType;
  threadId?: string;
  transcript: string;
  sentAt: string;
  error?: string;
}

export interface DoubaoBridgeThreadBindingPayload {
  threadId?: string;
  threadUrl?: string;
  title?: string;
}

export interface DoubaoBridgeStableMemoryPayload {
  items: Array<{
    title: string;
    body: string;
  }>;
  threadId?: string;
  dryRun?: boolean;
}

export interface DoubaoBridgeMobileBriefingPayload {
  title: string;
  bullets: string[];
  threadId?: string;
  dryRun?: boolean;
}

export interface DoubaoBridgeQueryCardPayload {
  query: string;
  answer: string;
  evidence?: Array<{ title?: string; snippet?: string; source?: string }>;
  threadId?: string;
  dryRun?: boolean;
}

export interface DoubaoBridgeReminderPayload {
  reminders: Array<{
    title: string;
    dueAt?: string;
    note?: string;
    severity?: 'low' | 'medium' | 'high';
  }>;
  threadId?: string;
  dryRun?: boolean;
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

    const result = (await chrome.storage.local.get(STORAGE_KEY)) as {
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

  private async persistSettings(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) return;

    await chrome.storage.local.set({
      [STORAGE_KEY]: {
        baseUrl: this.baseUrl,
        bridgeToken: this.bridgeToken,
      } satisfies DoubaoBridgeSettings,
    });
  }

  async saveSettings(settings: Partial<DoubaoBridgeSettings>): Promise<DoubaoBridgeSettings> {
    const next: DoubaoBridgeSettings = {
      baseUrl: settings.baseUrl?.trim() || this.baseUrl || DEFAULT_BASE_URL,
      bridgeToken: settings.bridgeToken !== undefined ? settings.bridgeToken || undefined : this.bridgeToken,
      autoRefreshMs: settings.autoRefreshMs,
    };

    this.baseUrl = next.baseUrl;
    this.bridgeToken = next.bridgeToken;
    await this.persistSettings();
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
    options?: {
      skipAuth?: boolean;
      retryOnUnauthorized?: boolean;
    },
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (!options?.skipAuth && this.bridgeToken) {
      headers['x-bridge-token'] = this.bridgeToken;
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
      if (response.status === 401 && options?.retryOnUnauthorized !== false && path !== '/pair') {
        await this.pair();
        return this.request<T>(method, path, body, {
          skipAuth: false,
          retryOnUnauthorized: false,
        });
      }

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
    return parsed ?? (text as unknown as T);
  }

  async pair(): Promise<DoubaoBridgePairResult> {
    const result = await this.request<DoubaoBridgePairResult>('POST', '/pair', {}, {
      skipAuth: true,
      retryOnUnauthorized: false,
    });
    if (result.token) {
      this.bridgeToken = result.token;
      await this.persistSettings();
    }
    return result;
  }

  getHealth(): Promise<DoubaoBridgeHealth> {
    return this.request<DoubaoBridgeHealth>('GET', '/health', undefined, {
      skipAuth: true,
      retryOnUnauthorized: false,
    });
  }

  getStatus(): Promise<DoubaoBridgeStatus> {
    return this.request<DoubaoBridgeStatus>('GET', '/auth/status');
  }

  getRuntimeSettings(): Promise<DoubaoBridgeSettingsPayload> {
    return this.request<DoubaoBridgeSettingsPayload>('GET', '/settings');
  }

  updateRuntimeSettings(settings: Partial<DoubaoBridgeRuntimeSettings>): Promise<DoubaoBridgeSettingsPayload> {
    return this.request<DoubaoBridgeSettingsPayload>('PUT', '/settings', settings);
  }

  testMemoryServiceConnection(): Promise<{ ok: boolean; baseUrl?: string; error?: string; health?: Record<string, unknown> }> {
    return this.request<{ ok: boolean; baseUrl?: string; error?: string; health?: Record<string, unknown> }>(
      'POST',
      '/settings/test-memory-service',
      {},
    );
  }

  openLogin(): Promise<{ url: string }> {
    return this.request<{ url: string }>('POST', '/auth/open-login', {});
  }

  getThreads(): Promise<DoubaoBridgeThreadsResponse> {
    return this.request<DoubaoBridgeThreadsResponse>('GET', '/threads');
  }

  createMemorySyncThread(): Promise<DoubaoBridgeThread> {
    return this.request<DoubaoBridgeThread>('POST', '/threads/create-memory-sync', {});
  }

  autoBindMobileContextThread(title = '手机版对话'): Promise<DoubaoBridgeBinding> {
    return this.request<DoubaoBridgeBinding>('POST', '/threads/auto-bind-mobile', { title });
  }

  bindThread(
    bindingType: DoubaoBridgeBindingType,
    payload: DoubaoBridgeThreadBindingPayload,
  ): Promise<DoubaoBridgeBinding> {
    return this.request<DoubaoBridgeBinding>('POST', '/threads/bind', {
      bindingType,
      threadId: payload.threadId,
      threadUrl: payload.threadUrl,
      title: payload.title,
    });
  }

  bindMemorySyncThread(payload: DoubaoBridgeThreadBindingPayload): Promise<DoubaoBridgeBinding> {
    return this.bindThread('memory_sync', payload);
  }

  bindMobileContextThread(payload: DoubaoBridgeThreadBindingPayload): Promise<DoubaoBridgeBinding> {
    return this.bindThread('mobile_context', payload);
  }

  syncStableMemory(payload: DoubaoBridgeStableMemoryPayload): Promise<DoubaoBridgeSyncResult> {
    return this.request<DoubaoBridgeSyncResult>('POST', '/sync/stable-memory', payload);
  }

  syncMobileBriefing(payload: DoubaoBridgeMobileBriefingPayload): Promise<DoubaoBridgeSyncResult> {
    return this.request<DoubaoBridgeSyncResult>('POST', '/sync/mobile-briefing', payload);
  }

  injectQuery(payload: DoubaoBridgeQueryCardPayload): Promise<DoubaoBridgeSyncResult> {
    return this.request<DoubaoBridgeSyncResult>('POST', '/inject/query', payload);
  }

  syncReminders(payload: DoubaoBridgeReminderPayload): Promise<DoubaoBridgeSyncResult> {
    return this.request<DoubaoBridgeSyncResult>('POST', '/reminders/sync', payload);
  }
}
