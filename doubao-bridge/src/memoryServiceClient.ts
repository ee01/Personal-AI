import type { BridgeConfig } from './config.js';

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
  constructor(private readonly config: BridgeConfig) {}

  isEnabled(): boolean {
    return Boolean(this.config.memoryServiceBaseUrl);
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    if (this.config.memoryServiceUserId) {
      headers['X-User-Id'] = this.config.memoryServiceUserId;
    }
    if (this.config.memoryServiceApiKey) {
      headers.Authorization = `Bearer ${this.config.memoryServiceApiKey}`;
    }

    return headers;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.config.memoryServiceBaseUrl) {
      throw new Error('MEMORY_SERVICE_BASE_URL is not configured for Doubao Bridge');
    }

    const normalizedBaseUrl = this.config.memoryServiceBaseUrl.replace(/\/$/, '');
    const response = await fetch(`${normalizedBaseUrl}${path}`, {
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

  async renderContextPackage(input: {
    provider: string;
    scenario: 'stable_memory' | 'mobile_briefing' | 'reminder_sync';
    deviceContext?: string;
  }): Promise<RenderContextPackageResponse> {
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
    await this.request('POST', `/api/v1/providers/${encodeURIComponent(provider)}/sync-jobs/${encodeURIComponent(id)}/report`, payload);
  }
}
