import type { UserDataManager } from '../storage/UserDataManager.js';
import { getUserRuntimeConfig } from '../runtimeConfig.js';

export interface OpenClawRequest {
  path?: string;
  method?: string;
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  headers?: Record<string, string>;
}

export class OpenClawClient {
  constructor(private readonly userDataManager?: UserDataManager) {}

  private getRuntimeConfig() {
    return getUserRuntimeConfig(this.userDataManager);
  }

  isConfigured(): boolean {
    const config = this.getRuntimeConfig();
    return config.openClawEnabled && Boolean(config.openClawBaseUrl);
  }

  async request(input: OpenClawRequest): Promise<{
    status: number;
    ok: boolean;
    data?: unknown;
    text?: string;
  }> {
    const config = this.getRuntimeConfig();
    if (!this.isConfigured()) {
      throw new Error('OpenClaw is not configured');
    }

    const url = new URL(input.path ?? '', config.openClawBaseUrl);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      url.searchParams.set(key, String(value));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.openClawTimeoutMs);

    try {
      const response = await fetch(url, {
        method: input.method ?? 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.openClawApiKey
            ? {
                Authorization: `Bearer ${config.openClawApiKey}`,
                'x-api-key': config.openClawApiKey,
              }
            : {}),
          ...(input.headers ?? {}),
        },
        body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      try {
        return {
          status: response.status,
          ok: response.ok,
          data: text ? JSON.parse(text) : undefined,
        };
      } catch {
        return {
          status: response.status,
          ok: response.ok,
          text,
        };
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
