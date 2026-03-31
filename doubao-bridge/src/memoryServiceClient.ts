import type { BridgeRuntimeSettings } from './config.js';

function normalizeBaseUrl(value?: string): string | undefined {
  const normalized = value?.trim().replace(/\/$/, '') || undefined;
  if (!normalized) return undefined;
  return normalized.replace(/\/api\/v1$/i, '');
}

export interface ProviderSyncJobRecord {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'skipped';
}

export interface ProviderMemoryProduct {
  title: string;
  kind: string;
  bodyMd: string;
  sourceRefs: string[];
}

export interface RenderContextPackageResponse {
  provider: string;
  scenario: string;
  packages: ProviderMemoryProduct[];
  syncJob?: ProviderSyncJobRecord;
}

export class BridgeMemoryServiceClient {
  constructor(private readonly readSettings: () => BridgeRuntimeSettings) {}

  private getSettings(): BridgeRuntimeSettings {
    return this.readSettings();
  }

  isEnabled(): boolean {
    const settings = this.getSettings();
    return Boolean(normalizeBaseUrl(settings.memoryServiceBaseUrl) && settings.memoryServiceUserId);
  }

  private buildHeaders(): Record<string, string> {
    const settings = this.getSettings();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    if (settings.memoryServiceUserId) {
      headers['X-User-Id'] = settings.memoryServiceUserId;
    }
    if (settings.memoryServiceApiKey) {
      headers.Authorization = `Bearer ${settings.memoryServiceApiKey}`;
    }

    return headers;
  }

  private ensureWriteIdentity(): void {
    if (!this.getSettings().memoryServiceUserId) {
      throw new Error('Memory Service User ID is required for sync operations.');
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const baseUrl = normalizeBaseUrl(this.getSettings().memoryServiceBaseUrl);
    if (!baseUrl) {
      throw new Error('MEMORY_SERVICE_BASE_URL is not configured for Doubao Bridge');
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: this.buildHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Memory service request failed: ${method} ${path} (${response.status})`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  async testConnection(): Promise<Record<string, unknown>> {
    const health = await this.request<Record<string, unknown>>('GET', '/api/v1/health');
    return {
      ok: true,
      baseUrl: normalizeBaseUrl(this.getSettings().memoryServiceBaseUrl),
      health,
    };
  }

  async renderContextPackage(input: {
    provider: string;
    scenario: 'stable_memory' | 'mobile_briefing' | 'reminder_sync';
    deviceContext?: string;
  }): Promise<RenderContextPackageResponse> {
    this.ensureWriteIdentity();
    return this.request<RenderContextPackageResponse>('POST', '/api/v1/providers/context-packages/render', {
      provider: input.provider,
      scenario: input.scenario,
      deviceContext: input.deviceContext ?? 'doubao_bridge_daemon',
      createSyncJob: true,
    });
  }

  async reportSyncJob(
    provider: string,
    id: string,
    payload: {
      status: ProviderSyncJobRecord['status'];
      result?: Record<string, unknown>;
      errorMessage?: string;
      externalThreadId?: string;
      startedAt?: number;
      completedAt?: number;
    },
  ): Promise<void> {
    this.ensureWriteIdentity();
    await this.request('POST', `/api/v1/providers/${encodeURIComponent(provider)}/sync-jobs/${encodeURIComponent(id)}/report`, payload);
  }
}
