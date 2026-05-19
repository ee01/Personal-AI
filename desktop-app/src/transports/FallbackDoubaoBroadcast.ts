/**
 * FallbackDoubaoBroadcast routes outbound Doubao sync at call time.
 *
 * If the user prefers webpage-mcp, we try the daily-Chrome transport first.
 * When webpage-mcp is unavailable or cannot operate, we temporarily fall back
 * to the managed Playwright Chromium profile so reminder/sync jobs are not
 * blocked by a missing connector.
 */

import type {
  BrowserConversationSnapshot,
  BrowserSendOptions,
  BrowserSendResult,
  BrowserSessionAdapter,
  BrowserStatus,
  BrowserTransportMode,
  BrowserThreadSnapshot,
} from '../browserSession.js';
import type { ExplorerTransport } from '../settings.js';

const FALLBACK_COOLDOWN_MS = 10 * 60 * 1_000;

export interface FallbackDoubaoBroadcastOptions {
  getTransport: () => ExplorerTransport | undefined;
  webpageMcpClient: BrowserSessionAdapter;
  playwrightClient: BrowserSessionAdapter;
  log?: (message: string, error?: unknown) => void;
}

export class FallbackDoubaoBroadcast implements BrowserSessionAdapter {
  private webpageMcpCooldownUntil = 0;
  private lastFallbackReason: string | undefined;

  constructor(private readonly options: FallbackDoubaoBroadcastOptions) {}

  ensureStarted(): Promise<void> {
    return this.invoke((client) => client.ensureStarted());
  }

  openLogin(): Promise<string> {
    return this.invokePreferringConfiguredTransport((client) =>
      client.openLogin(),
    );
  }

  openThread(url: string): Promise<BrowserThreadSnapshot> {
    return this.invokePreferringConfiguredTransport((client) =>
      client.openThread(url),
    );
  }

  collectConversationSnapshots(): Promise<BrowserConversationSnapshot[]> {
    return this.invoke((client) => client.collectConversationSnapshots());
  }

  sendTranscript(
    transcript: string,
    threadUrl?: string,
    options?: BrowserSendOptions,
  ): Promise<BrowserSendResult> {
    if (!this.shouldUseWebpageMcp()) {
      return this.options.playwrightClient
        .sendTranscript(transcript, threadUrl, options)
        .then((result) => withTransportResult(result, 'playwright'));
    }

    return this.sendTranscriptWithFallback(transcript, threadUrl, options);
  }

  probeAuthStatus(): Promise<'connected' | 'needs_login'> {
    return this.invoke((client) => client.probeAuthStatus());
  }

  findThreadByTitle(title: string): Promise<BrowserThreadSnapshot | null> {
    return this.invokePreferringConfiguredTransport((client) =>
      client.findThreadByTitle(title),
    );
  }

  status(): BrowserStatus {
    const preferredMode = normalizeTransportMode(this.options.getTransport());
    const inWebpageMcpCooldown =
      preferredMode === 'webpage_mcp' && this.isInWebpageMcpCooldown();

    if (preferredMode === 'webpage_mcp' && !inWebpageMcpCooldown) {
      const status = this.options.webpageMcpClient.status();
      return {
        ...status,
        lastError: status.lastError || this.lastFallbackReason,
        transport: {
          mode: 'webpage_mcp',
          preferredMode,
        },
      };
    }

    const status = this.options.playwrightClient.status();
    return {
      ...status,
      lastError: status.lastError || this.lastFallbackReason,
      transport: {
        mode: 'playwright',
        preferredMode,
        ...(inWebpageMcpCooldown
          ? {
              fallbackReason:
                this.lastFallbackReason ||
                'webpage-mcp transport is cooling down after a recent failure',
              fallbackCooldownUntil: new Date(
                this.webpageMcpCooldownUntil,
              ).toISOString(),
            }
          : {}),
      },
    };
  }

  async close(): Promise<void> {
    const errors: unknown[] = [];
    for (const client of [
      this.options.webpageMcpClient,
      this.options.playwrightClient,
    ]) {
      try {
        await client.close();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw errors[0];
    }
  }

  private async invoke<T>(
    operation: (client: BrowserSessionAdapter) => Promise<T>,
  ): Promise<T> {
    if (this.shouldUseWebpageMcp()) {
      return this.tryWebpageMcpThenFallback(operation);
    }

    return operation(this.options.playwrightClient);
  }

  private async invokePreferringConfiguredTransport<T>(
    operation: (client: BrowserSessionAdapter) => Promise<T>,
  ): Promise<T> {
    if (this.options.getTransport() === 'webpage_mcp') {
      return this.tryWebpageMcpThenFallback(operation);
    }

    return operation(this.options.playwrightClient);
  }

  private async tryWebpageMcpThenFallback<T>(
    operation: (client: BrowserSessionAdapter) => Promise<T>,
  ): Promise<T> {
    try {
      const result = await operation(this.options.webpageMcpClient);
      this.webpageMcpCooldownUntil = 0;
      this.lastFallbackReason = undefined;
      return result;
    } catch (error) {
      const reason = formatError(error);
      this.rememberWebpageMcpFailure(reason, error);
      try {
        return await operation(this.options.playwrightClient);
      } catch (fallbackError) {
        this.lastFallbackReason = `${reason}; managed Chromium fallback also failed: ${formatError(fallbackError)}`;
        throw fallbackError;
      }
    }
  }

  private async sendTranscriptWithFallback(
    transcript: string,
    threadUrl?: string,
    options?: BrowserSendOptions,
  ): Promise<BrowserSendResult> {
    let result: BrowserSendResult;
    try {
      result = await this.options.webpageMcpClient.sendTranscript(
        transcript,
        threadUrl,
        options,
      );
    } catch (error) {
      const reason = formatError(error);
      this.rememberWebpageMcpFailure(reason, error);
      return this.sendTranscriptWithPlaywrightAfterFailure(
        reason,
        transcript,
        threadUrl,
        options,
      );
    }

    if (result.sent) {
      this.webpageMcpCooldownUntil = 0;
      this.lastFallbackReason = undefined;
      return withTransportResult(result, 'webpage_mcp');
    }

    const reason =
      result.error || 'webpage-mcp transport returned an unsent transcript';
    this.rememberWebpageMcpFailure(reason);
    return this.sendTranscriptWithPlaywrightAfterFailure(
      reason,
      transcript,
      threadUrl,
      options,
    );
  }

  private shouldUseWebpageMcp(): boolean {
    return (
      this.options.getTransport() === 'webpage_mcp' &&
      !this.isInWebpageMcpCooldown()
    );
  }

  private isInWebpageMcpCooldown(): boolean {
    return this.webpageMcpCooldownUntil > Date.now();
  }

  private rememberWebpageMcpFailure(reason: string, error?: unknown): void {
    this.webpageMcpCooldownUntil = Date.now() + FALLBACK_COOLDOWN_MS;
    this.lastFallbackReason = reason;
    this.options.log?.(
      `[doubao-broadcast] webpage-mcp transport failed, falling back to managed Chromium: ${reason}`,
      error,
    );
  }

  private async sendTranscriptWithPlaywrightAfterFailure(
    reason: string,
    transcript: string,
    threadUrl?: string,
    options?: BrowserSendOptions,
  ): Promise<BrowserSendResult> {
    try {
      const result = await this.options.playwrightClient.sendTranscript(
        transcript,
        threadUrl,
        options,
      );
      return withTransportResult(result, 'playwright', reason);
    } catch (fallbackError) {
      this.lastFallbackReason = `${reason}; managed Chromium fallback also failed: ${formatError(fallbackError)}`;
      throw fallbackError;
    }
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function withTransportResult(
  result: BrowserSendResult,
  mode: BrowserTransportMode,
  fallbackReason?: string,
): BrowserSendResult {
  return {
    ...result,
    transportMode: result.transportMode || mode,
    transportFallbackReason:
      result.transportFallbackReason || fallbackReason || undefined,
  };
}

function normalizeTransportMode(
  transport: ExplorerTransport | undefined,
): 'playwright' | 'webpage_mcp' {
  return transport === 'webpage_mcp' ? 'webpage_mcp' : 'playwright';
}
