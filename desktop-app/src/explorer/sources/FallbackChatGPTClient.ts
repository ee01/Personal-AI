/**
 * FallbackChatGPTClient selects the right transport at call-time:
 *
 *   1. If `transport === 'webpage_mcp'`, try the WebpageMcpChatGPTClient first.
 *      - If the call fails (extension not installed, tab not open, etc.),
 *        automatically fall back to the Playwright client and enter a
 *        10-minute cooldown before retrying webpage-mcp.
 *      - While in cooldown, all requests go straight to Playwright.
 *   2. Otherwise (transport === 'playwright' or unset), use the Playwright client.
 *
 * The transport setting is re-read on every call, so toggling the option from
 * the UI takes effect on the next request without restart.
 */

import type {
  ChatGPTApiClient,
  ChatGPTClientStatus,
  ChatGPTConversationResponse,
  ChatGPTConversationSummary,
} from './ChatGPTSource.js';
import type { TransportMode } from '../transports/types.js';

const FALLBACK_COOLDOWN_MS = 10 * 60 * 1_000; // 10 minutes

export interface FallbackChatGPTClientOptions {
  /** Returns the current transport preference on every call. */
  getTransport: () => TransportMode;
  /** webpage-mcp backed client. */
  webpageMcpClient: ChatGPTApiClient;
  /** Playwright-backed client (bundled Chromium). Always available. */
  playwrightClient: ChatGPTApiClient;
  /** Optional diagnostic logger. */
  log?: (message: string, error?: unknown) => void;
}

export interface FallbackOutcome {
  mode: 'playwright' | 'webpage_mcp' | 'unknown';
  fallbackReason?: string;
  /** True if webpage-mcp was preferred but we silently fell back to Playwright. */
  fellBackFromWebpageMcp: boolean;
}

export class FallbackChatGPTClient implements ChatGPTApiClient {
  private lastOutcome: FallbackOutcome = {
    mode: 'unknown',
    fellBackFromWebpageMcp: false,
  };
  /** Timestamp (ms) after which we may retry webpage-mcp. Zero = no cooldown. */
  private webpageMcpCooldownUntil = 0;

  constructor(private readonly options: FallbackChatGPTClientOptions) {}

  async openLogin(): Promise<string> {
    return this.invoke((client) => client.openLogin());
  }

  async getAccessToken(): Promise<string | undefined> {
    return this.invoke((client) => client.getAccessToken());
  }

  async listConversationsPage(
    accessToken: string | undefined,
    offset: number,
    limit: number,
  ): Promise<ChatGPTConversationSummary[]> {
    return this.invoke((client) =>
      client.listConversationsPage(accessToken, offset, limit),
    );
  }

  async getConversation(
    accessToken: string | undefined,
    conversationId: string,
  ): Promise<ChatGPTConversationResponse> {
    return this.invoke((client) =>
      client.getConversation(accessToken, conversationId),
    );
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

  getClientStatus(): ChatGPTClientStatus {
    return {
      mode: this.lastOutcome.mode,
      fallbackReason: this.lastOutcome.fallbackReason,
    };
  }

  getLastOutcome(): FallbackOutcome {
    return { ...this.lastOutcome };
  }

  private async invoke<T>(
    operation: (client: ChatGPTApiClient) => Promise<T>,
  ): Promise<T> {
    const transport = this.options.getTransport();

    if (transport === 'webpage_mcp' && !this.isInCooldown()) {
      try {
        const result = await operation(this.options.webpageMcpClient);
        this.lastOutcome = {
          mode: 'webpage_mcp',
          fellBackFromWebpageMcp: false,
        };
        return result;
      } catch (error) {
        const reason = formatError(error);
        this.options.log?.(
          `[chatgpt] webpage-mcp transport failed, falling back to Playwright: ${reason}`,
          error,
        );
        this.webpageMcpCooldownUntil = Date.now() + FALLBACK_COOLDOWN_MS;
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
            fallbackReason: `${reason}; Playwright fallback also failed: ${formatError(fallbackError)}`,
          };
          throw fallbackError;
        }
      }
    }

    const result = await operation(this.options.playwrightClient);
    this.lastOutcome = {
      mode: 'playwright',
      fellBackFromWebpageMcp: false,
    };
    return result;
  }

  private isInCooldown(): boolean {
    return this.webpageMcpCooldownUntil > Date.now();
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
