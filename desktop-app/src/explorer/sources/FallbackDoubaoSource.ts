/**
 * FallbackDoubaoSource routes Doubao explorer reads at call time.
 *
 * Daily Chrome via webpage-mcp is preferred when configured, but a missing
 * connector or missing Doubao tab should not permanently block ingestion when
 * the managed Chromium profile is available.
 */

import type { BrowserConversationSnapshot } from '../../browserSession.js';
import type { ExplorerTransport } from '../../settings.js';
import type { ExplorerTransportMode, ExplorerTransportStatus } from '../types.js';
import type { DoubaoConversationCollectorClient } from './DoubaoChatSource.js';

const FALLBACK_COOLDOWN_MS = 10 * 60 * 1_000;

export interface FallbackDoubaoSourceOptions {
  getTransport: () => ExplorerTransport | undefined;
  webpageMcpClient: DoubaoConversationCollectorClient;
  playwrightClient: DoubaoConversationCollectorClient;
  log?: (message: string, error?: unknown) => void;
}

export interface FallbackDoubaoSourceOutcome extends ExplorerTransportStatus {
  fellBackFromWebpageMcp: boolean;
}

export class FallbackDoubaoSource implements DoubaoConversationCollectorClient {
  private webpageMcpCooldownUntil = 0;
  private lastOutcome: FallbackDoubaoSourceOutcome = {
    mode: 'unknown',
    fellBackFromWebpageMcp: false,
  };

  constructor(private readonly options: FallbackDoubaoSourceOptions) {}

  openLogin(): Promise<string> {
    return this.invokePreferringConfiguredTransport((client) =>
      client.openLogin(),
    );
  }

  probeAuthStatus(): Promise<'connected' | 'needs_login'> {
    return this.invoke((client) => client.probeAuthStatus());
  }

  collectConversationSnapshots(): Promise<BrowserConversationSnapshot[]> {
    return this.invoke((client) => client.collectConversationSnapshots());
  }

  getClientStatus(): ExplorerTransportStatus {
    const fallbackCooldownUntil = this.isInCooldown()
      ? new Date(this.webpageMcpCooldownUntil).toISOString()
      : undefined;
    const status: ExplorerTransportStatus = {
      mode: this.lastOutcome.mode,
      fallbackReason: this.lastOutcome.fallbackReason,
    };
    if (fallbackCooldownUntil) {
      status.fallbackCooldownUntil = fallbackCooldownUntil;
    }
    return status;
  }

  private async invoke<T>(
    operation: (client: DoubaoConversationCollectorClient) => Promise<T>,
  ): Promise<T> {
    const preferredTransport = this.options.getTransport();
    if (preferredTransport === 'webpage_mcp') {
      if (this.isInCooldown()) {
        const result = await operation(this.options.playwrightClient);
        this.lastOutcome = {
          mode: 'playwright',
          fellBackFromWebpageMcp: true,
          fallbackReason:
            this.lastOutcome.fallbackReason ??
            'webpage-mcp transport is cooling down after a recent failure',
          fallbackCooldownUntil: new Date(
            this.webpageMcpCooldownUntil,
          ).toISOString(),
        };
        return result;
      }

      return this.tryWebpageMcpThenFallback(operation);
    }

    const result = await operation(this.options.playwrightClient);
    this.lastOutcome = {
      mode: normalizeTransportMode(preferredTransport),
      fellBackFromWebpageMcp: false,
    };
    return result;
  }

  private async invokePreferringConfiguredTransport<T>(
    operation: (client: DoubaoConversationCollectorClient) => Promise<T>,
  ): Promise<T> {
    const preferredTransport = this.options.getTransport();
    if (preferredTransport === 'webpage_mcp') {
      return this.tryWebpageMcpThenFallback(operation);
    }

    const result = await operation(this.options.playwrightClient);
    this.lastOutcome = {
      mode: normalizeTransportMode(preferredTransport),
      fellBackFromWebpageMcp: false,
    };
    return result;
  }

  private async tryWebpageMcpThenFallback<T>(
    operation: (client: DoubaoConversationCollectorClient) => Promise<T>,
  ): Promise<T> {
    try {
      const result = await operation(this.options.webpageMcpClient);
      this.webpageMcpCooldownUntil = 0;
      this.lastOutcome = {
        mode: 'webpage_mcp',
        fellBackFromWebpageMcp: false,
      };
      return result;
    } catch (error) {
      const reason = formatError(error);
      this.webpageMcpCooldownUntil = Date.now() + FALLBACK_COOLDOWN_MS;
      this.options.log?.(
        `[doubao-source] webpage-mcp transport failed, falling back to managed Chromium: ${reason}`,
        error,
      );
      try {
        const result = await operation(this.options.playwrightClient);
        this.lastOutcome = {
          mode: 'playwright',
          fellBackFromWebpageMcp: true,
          fallbackReason: reason,
        };
        return result;
      } catch (fallbackError) {
        this.lastOutcome = {
          mode: 'playwright',
          fellBackFromWebpageMcp: true,
          fallbackReason: `${reason}; managed Chromium fallback also failed: ${formatError(fallbackError)}`,
        };
        throw fallbackError;
      }
    }
  }

  private isInCooldown(): boolean {
    return this.webpageMcpCooldownUntil > Date.now();
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeTransportMode(
  transport: ExplorerTransport | undefined,
): ExplorerTransportMode {
  return transport === 'webpage_mcp' ? 'webpage_mcp' : 'playwright';
}
