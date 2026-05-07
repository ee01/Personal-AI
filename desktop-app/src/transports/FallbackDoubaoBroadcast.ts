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
    return this.invoke((client) => client.openLogin());
  }

  openThread(url: string): Promise<BrowserThreadSnapshot> {
    return this.invoke((client) => client.openThread(url));
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
      return this.options.playwrightClient.sendTranscript(
        transcript,
        threadUrl,
        options,
      );
    }

    return this.sendTranscriptWithFallback(transcript, threadUrl, options);
  }

  probeAuthStatus(): Promise<'connected' | 'needs_login'> {
    return this.invoke((client) => client.probeAuthStatus());
  }

  findThreadByTitle(title: string): Promise<BrowserThreadSnapshot | null> {
    return this.invoke((client) => client.findThreadByTitle(title));
  }

  status(): BrowserStatus {
    if (this.shouldUseWebpageMcp()) {
      const status = this.options.webpageMcpClient.status();
      return {
        ...status,
        lastError: status.lastError || this.lastFallbackReason,
      };
    }

    const status = this.options.playwrightClient.status();
    return {
      ...status,
      lastError: status.lastError || this.lastFallbackReason,
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

    return operation(this.options.playwrightClient);
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
      return result;
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
      this.webpageMcpCooldownUntil <= Date.now()
    );
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
      return await this.options.playwrightClient.sendTranscript(
        transcript,
        threadUrl,
        options,
      );
    } catch (fallbackError) {
      this.lastFallbackReason = `${reason}; managed Chromium fallback also failed: ${formatError(fallbackError)}`;
      throw fallbackError;
    }
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
