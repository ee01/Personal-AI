/**
 * WebpageMcpDoubaoSource implements the DoubaoConversationCollectorClient
 * interface using the webpage-mcp extension to interact with an existing
 * doubao.com tab in the user's daily Chrome browser.
 *
 * It reuses the user's existing login session, avoiding the need for a
 * separate Playwright-driven login flow.
 */

import type {
  BrowserConversationMessageSnapshot,
  BrowserConversationSnapshot,
} from '../../browserSession.js';
import type { DoubaoConversationCollectorClient } from './DoubaoChatSource.js';
import type { WebpageMcpHost } from '../transports/WebpageMcpHost.js';

const DOUBAO_URL_PATTERN = 'doubao.com';
const DOUBAO_LOGIN_URL = 'https://www.doubao.com/chat/';
const DOUBAO_BASE_URL = 'https://www.doubao.com';

function normalizeDoubaoUrl(href?: string): string {
  if (!href) return '';
  try {
    return new URL(href, DOUBAO_BASE_URL).toString();
  } catch {
    return href;
  }
}

export class WebpageMcpDoubaoSource implements DoubaoConversationCollectorClient {
  constructor(private readonly host: WebpageMcpHost) {}

  async openLogin(): Promise<string> {
    const tabId = await this.host.findTabByUrl(DOUBAO_URL_PATTERN);
    await this.host.callTool('chrome_navigate', {
      url: DOUBAO_LOGIN_URL,
      ...(tabId !== undefined ? { tabId } : { openMode: 'new_tab' }),
    }).catch(() => undefined);
    return DOUBAO_LOGIN_URL;
  }

  async probeAuthStatus(): Promise<'connected' | 'needs_login'> {
    try {
      const tabId = await this.host.findTabByUrl(DOUBAO_URL_PATTERN);
      if (tabId === undefined) {
        return 'needs_login';
      }
      const js = `
        (async () => {
          try {
            const isLoggedIn = Boolean(
              document.cookie.includes('sid=') ||
              document.querySelector('[data-testid="user-avatar"]') ||
              document.querySelector('.avatar') ||
              document.querySelector('[class*="userAvatar"]') ||
              document.querySelector('[class*="user-avatar"]')
            );
            return JSON.stringify({ loggedIn: isLoggedIn });
          } catch (e) {
            return JSON.stringify({ loggedIn: false, error: e.message });
          }
        })()
      `;
      const raw = await this.host.evalInTab(tabId, js);
      const result = JSON.parse(raw) as { loggedIn?: boolean };
      return result.loggedIn ? 'connected' : 'needs_login';
    } catch {
      return 'needs_login';
    }
  }

  async collectConversationSnapshots(): Promise<BrowserConversationSnapshot[]> {
    const tabId = await this.requireDoubaoTab();
    const js = `
      (async () => {
        try {
          // Try internal conversation list API first
          const resp = await fetch('/api/v2/conversation/list', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: 100, offset: 0 }),
          });
          if (!resp.ok) return JSON.stringify({ ok: false, error: resp.status });
          const data = await resp.json();
          return JSON.stringify({ ok: true, data });
        } catch (e) {
          return JSON.stringify({ ok: false, error: e.message });
        }
      })()
    `;

    try {
      const raw = await this.host.evalInTab(tabId, js);
      const result = JSON.parse(raw) as {
        ok: boolean;
        data?: unknown;
        error?: unknown;
      };
      if (!result.ok || !result.data) {
        return this.collectSnapshotsByDomScraping(tabId);
      }
      return this.parseApiResponse(result.data);
    } catch {
      return this.collectSnapshotsByDomScraping(tabId);
    }
  }

  /**
   * Fallback: scrape the conversation list from the DOM when the API is
   * unavailable or returns no data.
   */
  private async collectSnapshotsByDomScraping(
    tabId: number | undefined,
  ): Promise<BrowserConversationSnapshot[]> {
    const js = `
      (async () => {
        try {
          // Collect conversation items from the sidebar
          const items = Array.from(
            document.querySelectorAll('[data-testid^="conversation-item"], [class*="conversationItem"], [class*="conversation-item"], li[class*="item"]')
          );
          const conversations = items.slice(0, 50).map((el) => {
            const link = el.querySelector('a') || el.closest('a') || el;
            const href = link?.getAttribute('href') || '';
            const url = href
              ? new URL(href, 'https://www.doubao.com').toString()
              : '';
            const idMatch = url.match(/\\/(?:chat|thread)\\/([^/?#]+)/);
            const conversationId = idMatch?.[1] || el.getAttribute('data-id') || el.id || '';
            const title =
              el.querySelector('[class*="title"], [class*="name"], p, span')?.textContent?.trim() || '';
            const timeEl = el.querySelector('[class*="time"], time, [class*="date"]');
            const updatedLabel = timeEl?.textContent?.trim() || timeEl?.getAttribute('datetime') || '';
            return { conversationId, title, updatedLabel, url };
          }).filter(c => c.conversationId);
          return JSON.stringify({ conversations });
        } catch(e) {
          return JSON.stringify({ conversations: [], error: e.message });
        }
      })()
    `;

    let convInfoList: Array<{
      conversationId: string;
      title: string;
      updatedLabel: string;
      url: string;
    }> = [];

    try {
      const raw = await this.host.evalInTab(tabId, js);
      const parsed = JSON.parse(raw) as {
        conversations?: typeof convInfoList;
      };
      convInfoList = parsed.conversations ?? [];
    } catch {
      return [];
    }

    const snapshots: BrowserConversationSnapshot[] = [];
    for (const conv of convInfoList) {
      const url = normalizeDoubaoUrl(conv.url);
      if (url) {
        try {
          const navTabId = tabId;
          const navArgs: Record<string, unknown> = {
            url,
          };
          if (navTabId !== undefined) navArgs.tabId = navTabId;
          await this.host.callTool('chrome_navigate', navArgs);
          await new Promise((r) => setTimeout(r, 1500));
        } catch {
          // continue
        }
      }

      const messages = await this.scrapeMessages(tabId);
      snapshots.push({
        conversationId: conv.conversationId,
        url,
        title: conv.title,
        updatedLabel: conv.updatedLabel,
        messages,
      });
    }
    return snapshots;
  }

  private async scrapeMessages(
    tabId: number | undefined,
  ): Promise<BrowserConversationMessageSnapshot[]> {
    const js = `
      (async () => {
        try {
          const msgs = Array.from(
            document.querySelectorAll('[data-testid^="message"], [class*="messageItem"], [class*="message-item"], [class*="chatItem"]')
          );
          return JSON.stringify(msgs.map((el) => {
            const roleEl = el.querySelector('[class*="role"], [class*="avatar"], [data-testid*="avatar"]');
            const roleHint = roleEl?.getAttribute('aria-label') || roleEl?.textContent?.trim() || '';
            const contentEl = el.querySelector('[class*="content"], [class*="text"], p, div > span');
            const content = contentEl?.textContent?.trim() || el.textContent?.trim() || '';
            const timeEl = el.querySelector('time, [class*="time"]');
            const timestampLabel = timeEl?.textContent?.trim() || timeEl?.getAttribute('datetime') || '';
            return { roleHint, content, timestampLabel };
          }).filter(m => m.content));
        } catch(e) {
          return JSON.stringify([]);
        }
      })()
    `;
    try {
      const raw = await this.host.evalInTab(tabId, js);
      return JSON.parse(raw) as BrowserConversationMessageSnapshot[];
    } catch {
      return [];
    }
  }

  private parseApiResponse(data: unknown): BrowserConversationSnapshot[] {
    if (!data || typeof data !== 'object') return [];
    const list = (data as Record<string, unknown>)['list'] as unknown[];
    if (!Array.isArray(list)) return [];
    return list.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const conv = item as Record<string, unknown>;
      const conversationId = String(conv['conversation_id'] ?? conv['id'] ?? '');
      if (!conversationId) return [];
      const title = String(conv['title'] ?? '');
      const updatedLabel = String(conv['update_time'] ?? conv['updated_at'] ?? '');
      const url = normalizeDoubaoUrl(String(conv['url'] ?? conv['link'] ?? ''));
      const rawMessages = (conv['messages'] ?? conv['message_list']) as unknown[];
      const messages: BrowserConversationMessageSnapshot[] = Array.isArray(rawMessages)
        ? rawMessages.flatMap((m) => {
            if (!m || typeof m !== 'object') return [];
            const msg = m as Record<string, unknown>;
            const content = String(msg['content'] ?? msg['text'] ?? '');
            if (!content) return [];
            return [{
              messageId: String(msg['message_id'] ?? msg['id'] ?? ''),
              roleHint: String(msg['role'] ?? msg['author'] ?? ''),
              content,
              timestampLabel: String(msg['create_time'] ?? msg['timestamp'] ?? ''),
            }];
          })
        : [];
      return [{ conversationId, title, updatedLabel, url, messages }];
    });
  }

  private async requireDoubaoTab(): Promise<number> {
    const tabId = await this.host.findTabByUrl(DOUBAO_URL_PATTERN);
    if (tabId === undefined) {
      throw new Error(
        'No existing doubao.com tab found in Chrome. Open Doubao in your daily browser first.',
      );
    }
    return tabId;
  }
}
