const DEFAULT_BASE_URL = 'http://127.0.0.1:46321';
const DEFAULT_TIMEOUT_MS = 15_000;
const STORAGE_KEY = 'desktopAppConfig';
const LEGACY_STORAGE_KEY = 'doubaoBridgeConfig';

export type DesktopAppBindingType = 'memory_sync' | 'mobile_context';
export type DesktopAppAuthStatus =
  | 'unknown'
  | 'needs_login'
  | 'connected'
  | 'error';
export type DesktopAppSyncKind =
  | 'stable_memory'
  | 'mobile_briefing'
  | 'query_inject'
  | 'reminder_sync';

export interface DesktopAppSettings {
  baseUrl: string;
  bridgeToken?: string;
  autoRefreshMs?: number;
}

export interface DesktopAppRuntimeSettings {
  memoryServiceBaseUrl?: string;
  autoSync: boolean;
  pollIntervalMs: number;
  stableMemoryIntervalMs: number;
  mobileBriefingIntervalMs: number;
  reminderSyncIntervalMs: number;
}

export interface DesktopAppSettingsPayload {
  defaults: DesktopAppRuntimeSettings;
  user: Partial<DesktopAppRuntimeSettings>;
  effective: DesktopAppRuntimeSettings;
}

export interface DesktopAppHealth {
  ok: boolean;
  service?: string;
  version?: string;
  config?: {
    host?: string;
    port?: number;
    headless?: boolean;
  };
}

export interface DesktopAppBinding {
  bindingType: DesktopAppBindingType;
  threadId?: string;
  threadUrl?: string;
  title?: string;
  updatedAt?: string;
}

export interface DesktopAppThread {
  id: string;
  kind: DesktopAppBindingType | 'manual' | 'unknown';
  title: string;
  url?: string;
  bindingType?: DesktopAppBindingType;
  createdAt: string;
  updatedAt: string;
}

export interface DesktopAppPairResult {
  paired: boolean;
  token: string;
  createdAt: string;
}

export interface DesktopAppStatus {
  appVersion?: string;
  paired: boolean;
  authStatus: DesktopAppAuthStatus;
  browserRunning: boolean;
  currentUrl?: string;
  pairToken?: string;
  bindings: Partial<Record<DesktopAppBindingType, DesktopAppBinding>>;
  threads: DesktopAppThread[];
  lastSyncAt?: string;
  lastError?: string;
  memoryServiceConfigured?: boolean;
  autoSyncEnabled?: boolean;
  memoryGrowth?: {
    windowDays: number;
    recentMessageCount: number;
    lowMessageThreshold: number;
    belowThreshold: boolean;
  };
  blockingReasons?: Array<{
    code: string;
    message: string;
    syncKinds?: Array<'stableMemory' | 'mobileBriefing' | 'reminderSync'>;
  }>;
  syncReadiness?: Record<
    'stableMemory' | 'mobileBriefing' | 'reminderSync',
    {
      ready: boolean;
      reasons: Array<{ code: string; message: string }>;
      intervalMs: number;
      lastRunAt?: string;
    }
  >;
  syncState?: {
    timerActive: boolean;
    running: boolean;
    autoSyncEnabled: boolean;
    memoryServiceConfigured: boolean;
    pollIntervalMs: number;
    tasks: Record<
      'stableMemory' | 'mobileBriefing' | 'reminderSync',
      {
        intervalMs: number;
        lastRunAt?: string;
        nextDueAt?: string;
        due: boolean;
      }
    >;
  };
  settings?: DesktopAppRuntimeSettings;
  setupChecklist?: {
    memoryServiceConfigured: boolean;
    autoSyncEnabled: boolean;
    doubaoConnected: boolean;
    memorySyncBound: boolean;
    mobileContextBound: boolean;
  };
}

export interface DesktopAppThreadsResponse {
  threads: DesktopAppThread[];
  bindings: Partial<Record<DesktopAppBindingType, DesktopAppBinding>>;
}

export interface DesktopAppSyncResult {
  accepted: boolean;
  kind: DesktopAppSyncKind;
  targetBindingType: DesktopAppBindingType;
  threadId?: string;
  transcript: string;
  sentAt: string;
  error?: string;
}

export interface DesktopAppSkillSyncResult {
  status: 'succeeded' | 'partial_failed' | 'skipped';
  platforms: Array<{
    platform: string;
    root?: string;
    status: 'succeeded' | 'skipped' | 'failed' | 'partial_failed';
    scanned: number;
    imported: number;
    pulled: number;
    pushed: number;
    skipped: number;
    errors: Array<{ slug?: string; error: string }>;
  }>;
}

export interface DesktopAppThreadBindingPayload {
  threadId?: string;
  threadUrl?: string;
  title?: string;
}

export interface DesktopAppStableMemoryPayload {
  items: Array<{
    title: string;
    body: string;
  }>;
  threadId?: string;
  dryRun?: boolean;
}

export interface DesktopAppMobileBriefingPayload {
  title: string;
  bullets: string[];
  threadId?: string;
  dryRun?: boolean;
}

export interface DesktopAppQueryCardPayload {
  query: string;
  answer: string;
  evidence?: Array<{ title?: string; snippet?: string; source?: string }>;
  threadId?: string;
  dryRun?: boolean;
}

export interface DesktopAppReminderPayload {
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

export class DesktopAppClient {
  private baseUrl: string;
  private bridgeToken?: string;
  private timeoutMs: number;

  constructor(config?: Partial<DesktopAppSettings>) {
    this.baseUrl = config?.baseUrl ?? DEFAULT_BASE_URL;
    this.bridgeToken = config?.bridgeToken;
    this.timeoutMs = DEFAULT_TIMEOUT_MS;
  }

  async loadSettings(): Promise<DesktopAppSettings> {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
      return { baseUrl: this.baseUrl, bridgeToken: this.bridgeToken };
    }

    const result = (await chrome.storage.local.get(STORAGE_KEY)) as {
      [STORAGE_KEY]?: DesktopAppSettings;
    };
    let stored = result[STORAGE_KEY];

    if (!stored) {
      const legacyResult = (await chrome.storage.local.get(
        LEGACY_STORAGE_KEY,
      )) as {
        [LEGACY_STORAGE_KEY]?: DesktopAppSettings;
      };
      stored = legacyResult[LEGACY_STORAGE_KEY];
      if (stored) {
        await chrome.storage.local.set({ [STORAGE_KEY]: stored });
        await chrome.storage.local.remove(LEGACY_STORAGE_KEY);
      }
    }

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
      } satisfies DesktopAppSettings,
    });
  }

  async saveSettings(
    settings: Partial<DesktopAppSettings>,
  ): Promise<DesktopAppSettings> {
    const next: DesktopAppSettings = {
      baseUrl: settings.baseUrl?.trim() || this.baseUrl || DEFAULT_BASE_URL,
      bridgeToken:
        settings.bridgeToken !== undefined
          ? settings.bridgeToken || undefined
          : this.bridgeToken,
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
      if (
        response.status === 401 &&
        options?.retryOnUnauthorized !== false &&
        path !== '/pair'
      ) {
        await this.pair();
        return this.request<T>(method, path, body, {
          skipAuth: false,
          retryOnUnauthorized: false,
        });
      }

      const errorText = await readTextResponse(response);
      throw new Error(
        errorText ||
          `Desktop App request failed: ${method} ${path} (${response.status} ${response.statusText})`,
      );
    }

    const text = await readTextResponse(response);
    if (!text) {
      return {} as T;
    }

    const parsed = safeJsonParse<T>(text);
    return parsed ?? (text as unknown as T);
  }

  async pair(): Promise<DesktopAppPairResult> {
    const result = await this.request<DesktopAppPairResult>(
      'POST',
      '/pair',
      {},
      {
        skipAuth: true,
        retryOnUnauthorized: false,
      },
    );
    if (result.token) {
      this.bridgeToken = result.token;
      await this.persistSettings();
    }
    return result;
  }

  getHealth(): Promise<DesktopAppHealth> {
    return this.request<DesktopAppHealth>('GET', '/health', undefined, {
      skipAuth: true,
      retryOnUnauthorized: false,
    });
  }

  getStatus(): Promise<DesktopAppStatus> {
    return this.request<DesktopAppStatus>('GET', '/auth/status');
  }

  getRuntimeSettings(): Promise<DesktopAppSettingsPayload> {
    return this.request<DesktopAppSettingsPayload>('GET', '/settings');
  }

  updateRuntimeSettings(
    settings: Partial<DesktopAppRuntimeSettings>,
  ): Promise<DesktopAppSettingsPayload> {
    return this.request<DesktopAppSettingsPayload>(
      'PUT',
      '/settings',
      settings,
    );
  }

  testMemoryServiceConnection(): Promise<{
    ok: boolean;
    baseUrl?: string;
    error?: string;
    health?: Record<string, unknown>;
  }> {
    return this.request<{
      ok: boolean;
      baseUrl?: string;
      error?: string;
      health?: Record<string, unknown>;
    }>('POST', '/settings/test-memory-service', {});
  }

  openLogin(): Promise<{ url: string }> {
    return this.request<{ url: string }>('POST', '/auth/open-login', {});
  }

  getThreads(): Promise<DesktopAppThreadsResponse> {
    return this.request<DesktopAppThreadsResponse>('GET', '/threads');
  }

  createMemorySyncThread(): Promise<DesktopAppThread> {
    return this.request<DesktopAppThread>(
      'POST',
      '/threads/create-memory-sync',
      {},
    );
  }

  autoBindMobileContextThread(
    title = '手机版对话',
  ): Promise<DesktopAppBinding> {
    return this.request<DesktopAppBinding>(
      'POST',
      '/threads/auto-bind-mobile',
      { title },
    );
  }

  bindThread(
    bindingType: DesktopAppBindingType,
    payload: DesktopAppThreadBindingPayload,
  ): Promise<DesktopAppBinding> {
    return this.request<DesktopAppBinding>('POST', '/threads/bind', {
      bindingType,
      threadId: payload.threadId,
      threadUrl: payload.threadUrl,
      title: payload.title,
    });
  }

  bindMemorySyncThread(
    payload: DesktopAppThreadBindingPayload,
  ): Promise<DesktopAppBinding> {
    return this.bindThread('memory_sync', payload);
  }

  bindMobileContextThread(
    payload: DesktopAppThreadBindingPayload,
  ): Promise<DesktopAppBinding> {
    return this.bindThread('mobile_context', payload);
  }

  syncStableMemory(
    payload: DesktopAppStableMemoryPayload,
  ): Promise<DesktopAppSyncResult> {
    return this.request<DesktopAppSyncResult>(
      'POST',
      '/sync/stable-memory',
      payload,
    );
  }

  syncMobileBriefing(
    payload: DesktopAppMobileBriefingPayload,
  ): Promise<DesktopAppSyncResult> {
    return this.request<DesktopAppSyncResult>(
      'POST',
      '/sync/mobile-briefing',
      payload,
    );
  }

  injectQuery(
    payload: DesktopAppQueryCardPayload,
  ): Promise<DesktopAppSyncResult> {
    return this.request<DesktopAppSyncResult>('POST', '/inject/query', payload);
  }

  syncReminders(
    payload: DesktopAppReminderPayload,
  ): Promise<DesktopAppSyncResult> {
    return this.request<DesktopAppSyncResult>(
      'POST',
      '/reminders/sync',
      payload,
    );
  }

  syncSkills(platform?: string): Promise<DesktopAppSkillSyncResult> {
    return this.request<DesktopAppSkillSyncResult>('POST', '/skills/sync/run', {
      platform,
    });
  }
}

export type DoubaoBridgeBindingType = DesktopAppBindingType;
export type DoubaoBridgeAuthStatus = DesktopAppAuthStatus;
export type DoubaoBridgeSyncKind = DesktopAppSyncKind;
export type DoubaoBridgeSettings = DesktopAppSettings;
export type DoubaoBridgeRuntimeSettings = DesktopAppRuntimeSettings;
export type DoubaoBridgeSettingsPayload = DesktopAppSettingsPayload;
export type DoubaoBridgeHealth = DesktopAppHealth;
export type DoubaoBridgeBinding = DesktopAppBinding;
export type DoubaoBridgeThread = DesktopAppThread;
export type DoubaoBridgePairResult = DesktopAppPairResult;
export type DoubaoBridgeStatus = DesktopAppStatus;
export type DoubaoBridgeThreadsResponse = DesktopAppThreadsResponse;
export type DoubaoBridgeSyncResult = DesktopAppSyncResult;
export type DoubaoBridgeSkillSyncResult = DesktopAppSkillSyncResult;
export type DoubaoBridgeThreadBindingPayload = DesktopAppThreadBindingPayload;
export type DoubaoBridgeStableMemoryPayload = DesktopAppStableMemoryPayload;
export type DoubaoBridgeMobileBriefingPayload = DesktopAppMobileBriefingPayload;
export type DoubaoBridgeQueryCardPayload = DesktopAppQueryCardPayload;
export type DoubaoBridgeReminderPayload = DesktopAppReminderPayload;

export { DesktopAppClient as DoubaoBridgeClient };
