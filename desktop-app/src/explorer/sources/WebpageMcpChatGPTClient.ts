/**
 * WebpageMcpChatGPTClient implements ChatGPTApiClient using the webpage-mcp
 * extension to run fetch() calls inside an existing chatgpt.com tab in the
 * user's daily Chrome browser. The cookies/session are already present in
 * that tab, so no separate login is required and Cloudflare challenges are
 * bypassed naturally.
 *
 * Requires: WebpageMcpHost to be started, and the "Webpage MCP Connector"
 * Chrome extension to be installed and connected.
 */

import type {
  ChatGPTApiClient,
  ChatGPTClientStatus,
  ChatGPTConversationListResponse,
  ChatGPTConversationResponse,
  ChatGPTConversationSummary,
  ChatGPTSessionResponse,
} from './ChatGPTSource.js';
import type { WebpageMcpHost } from '../transports/WebpageMcpHost.js';

const CHATGPT_URL_PATTERN = 'chatgpt.com';
const REQUEST_INTERVAL_MS = 1_000;

interface FetchResult<T> {
  ok: boolean;
  status: number;
  body: T | null;
  errorText?: string;
}

export class WebpageMcpChatGPTClient implements ChatGPTApiClient {
  private lastRequestAt = 0;

  constructor(private readonly host: WebpageMcpHost) {}

  async openLogin(): Promise<string> {
    const tabId = await this.host.findTabByUrl(CHATGPT_URL_PATTERN);
    await this.host.callTool('chrome_navigate', {
      url: 'https://chatgpt.com/auth/login',
      ...(tabId !== undefined ? { tabId } : { openMode: 'new_tab' }),
    });
    return 'https://chatgpt.com/auth/login';
  }

  async getAccessToken(): Promise<string | undefined> {
    const result = await this.fetchInChatGPTTab<ChatGPTSessionResponse>(
      '/api/auth/session',
    );
    if (!result.ok || !result.body) return undefined;
    const token = result.body.accessToken?.toString().trim();
    return token || undefined;
  }

  async listConversationsPage(
    accessToken: string | undefined,
    offset: number,
    limit: number,
  ): Promise<ChatGPTConversationSummary[]> {
    const result = await this.fetchInChatGPTTab<ChatGPTConversationListResponse>(
      `/backend-api/conversations?offset=${offset}&limit=${limit}`,
      accessToken,
    );
    if (!result.ok || !result.body) {
      throw new Error(
        `ChatGPT (webpage-mcp) GET /backend-api/conversations failed: ${result.status}${result.errorText ? ' — ' + result.errorText.slice(0, 200) : ''}`,
      );
    }
    return Array.isArray(result.body.items) ? result.body.items : [];
  }

  async getConversation(
    accessToken: string | undefined,
    conversationId: string,
  ): Promise<ChatGPTConversationResponse> {
    const path = `/backend-api/conversation/${encodeURIComponent(conversationId)}`;
    const result = await this.fetchInChatGPTTab<ChatGPTConversationResponse>(
      path,
      accessToken,
    );
    if (!result.ok || !result.body) {
      throw new Error(
        `ChatGPT (webpage-mcp) GET ${path} failed: ${result.status}${result.errorText ? ' — ' + result.errorText.slice(0, 200) : ''}`,
      );
    }
    return result.body;
  }

  async close(): Promise<void> {
    // No persistent resources to close — the host is managed separately.
  }

  getClientStatus(): ChatGPTClientStatus {
    return { mode: 'webpage_mcp' };
  }

  private async fetchInChatGPTTab<T>(
    apiPath: string,
    accessToken?: string,
  ): Promise<FetchResult<T>> {
    await this.respectRequestInterval();
    const authHeader = accessToken
      ? `, headers: { Authorization: 'Bearer ' + ${JSON.stringify(accessToken)} }`
      : '';
    const js = `
      (async () => {
        const r = await fetch(${JSON.stringify(apiPath)}, { credentials: 'include'${authHeader} });
        const text = await r.text();
        let body = null;
        try { body = text ? JSON.parse(text) : null; } catch {}
        return JSON.stringify({ ok: r.ok, status: r.status, body, errorText: r.ok ? undefined : text });
      })()
    `;
    const tabId = await this.requireChatGptTab();
    const raw = await this.host.evalInTab(tabId, js);
    this.lastRequestAt = Date.now();
    try {
      return JSON.parse(raw) as FetchResult<T>;
    } catch {
      return { ok: false, status: 0, body: null, errorText: raw };
    }
  }

  private async respectRequestInterval(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    const waitMs = Math.max(0, REQUEST_INTERVAL_MS - elapsed);
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  private async requireChatGptTab(): Promise<number> {
    const tabId = await this.host.findTabByUrl(CHATGPT_URL_PATTERN);
    if (tabId === undefined) {
      throw new Error(
        'No existing chatgpt.com tab found in Chrome. Open ChatGPT in your daily browser first.',
      );
    }
    return tabId;
  }
}
