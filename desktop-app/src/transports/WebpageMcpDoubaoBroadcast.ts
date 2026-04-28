/**
 * WebpageMcpDoubaoBroadcast implements BrowserSessionAdapter for Doubao
 * broadcasting (sending memory transcripts to a Doubao conversation) using
 * the webpage-mcp Chrome extension instead of Playwright.
 *
 * This allows reusing the user's existing Doubao login session in their
 * daily Chrome browser.
 */

import type {
  BrowserConversationSnapshot,
  BrowserSendOptions,
  BrowserSendResult,
  BrowserSessionAdapter,
  BrowserStatus,
  BrowserThreadSnapshot,
} from '../browserSession.js';
import type { WebpageMcpHost } from '../explorer/transports/WebpageMcpHost.js';

const DOUBAO_BASE_URL = 'https://www.doubao.com';
const DOUBAO_LOGIN_URL = `${DOUBAO_BASE_URL}/chat/`;
const DOUBAO_URL_PATTERN = 'doubao.com';

export class WebpageMcpDoubaoBroadcast implements BrowserSessionAdapter {
  private started = false;

  constructor(private readonly host: WebpageMcpHost) {}

  async ensureStarted(): Promise<void> {
    if (!this.started) {
      await this.host.start();
      this.started = true;
    }
  }

  async openLogin(): Promise<string> {
    await this.host.callTool('chrome_navigate', {
      url: DOUBAO_LOGIN_URL,
      openMode: 'new_tab',
    }).catch(() => undefined);
    return DOUBAO_LOGIN_URL;
  }

  async openThread(url: string): Promise<BrowserThreadSnapshot> {
    const tabId = await this.host.findTabByUrl(DOUBAO_URL_PATTERN);
    const navArgs: Record<string, unknown> = { url };
    if (tabId !== undefined) navArgs.tabId = tabId;
    await this.host.callTool('chrome_navigate', navArgs);
    await this.wait(1000);
    const title = await this.host.evalInTab(tabId, `document.title`);
    const urlStr = await this.host.evalInTab(tabId, `window.location.href`);
    const idMatch = urlStr.match(/\/chat\/(\d+)/);
    return {
      url: urlStr || url,
      title: title || '',
      threadId: idMatch?.[1] ?? undefined,
    };
  }

  async collectConversationSnapshots(): Promise<BrowserConversationSnapshot[]> {
    // Not needed for broadcasting; return empty.
    return [];
  }

  async sendTranscript(
    transcript: string,
    threadUrl?: string,
    _options?: BrowserSendOptions,
  ): Promise<BrowserSendResult> {
    await this.ensureStarted();

    const tabId = await this.host.findTabByUrl(DOUBAO_URL_PATTERN);

    if (threadUrl) {
      const navArgs: Record<string, unknown> = { url: threadUrl };
      if (tabId !== undefined) navArgs.tabId = tabId;
      await this.host.callTool('chrome_navigate', navArgs);
      await this.wait(1500);
    }

    const sent = await this.typeAndSend(tabId, transcript);
    const urlStr = await this.host
      .evalInTab(tabId, `window.location.href`)
      .catch(() => threadUrl ?? '');
    const idMatch = urlStr.match(/\/chat\/(\d+)/);

    return {
      sent,
      url: urlStr,
      threadId: idMatch?.[1] ?? undefined,
      transportUsed: 'dom',
    };
  }

  async probeAuthStatus(): Promise<'connected' | 'needs_login'> {
    try {
      const tabId = await this.host.findTabByUrl(DOUBAO_URL_PATTERN);
      const js = `
        (async () => {
          try {
            const isLoggedIn = Boolean(
              document.cookie.includes('sid=') ||
              document.querySelector('[data-testid="user-avatar"]') ||
              document.querySelector('[class*="userAvatar"]')
            );
            return JSON.stringify({ loggedIn: isLoggedIn });
          } catch(e) {
            return JSON.stringify({ loggedIn: false });
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

  async findThreadByTitle(title: string): Promise<BrowserThreadSnapshot | null> {
    const tabId = await this.host.findTabByUrl(DOUBAO_URL_PATTERN);
    const js = `
      (async () => {
        const items = Array.from(
          document.querySelectorAll('[data-testid^="conversation-item"], [class*="conversationItem"]')
        );
        const match = items.find(el => el.textContent?.includes(${JSON.stringify(title)}));
        if (!match) return JSON.stringify(null);
        const link = match.querySelector('a') || match.closest('a');
        const href = link?.getAttribute('href') || '';
        const idMatch = href.match(/\\/chat\\/(\\d+)/);
        return JSON.stringify({
          title: match.textContent?.trim(),
          url: href ? 'https://www.doubao.com' + href : '',
          threadId: idMatch?.[1] ?? null,
        });
      })()
    `;
    try {
      const raw = await this.host.evalInTab(tabId, js);
      return JSON.parse(raw) as BrowserThreadSnapshot | null;
    } catch {
      return null;
    }
  }

  status(): BrowserStatus {
    const mcpStatus = this.host.getStatus();
    return {
      running: mcpStatus.running,
      lastError: mcpStatus.lastError,
    };
  }

  async close(): Promise<void> {
    this.started = false;
    // Host lifecycle is managed globally — don't stop it here.
  }

  private async typeAndSend(
    tabId: number | undefined,
    text: string,
  ): Promise<boolean> {
    try {
      const composerSelectors = [
        'textarea:not([disabled]):not([readonly])',
        '[role="textbox"][contenteditable="true"]',
        '[contenteditable="plaintext-only"]',
        'div[data-lexical-editor="true"]',
      ];

      // Try fill via webpage-mcp's fill_or_select
      for (const selector of composerSelectors) {
        try {
          const fillArgs: Record<string, unknown> = { selector, value: text };
          if (tabId !== undefined) fillArgs.tabId = tabId;
          await this.host.callTool('chrome_fill_or_select', fillArgs);
          break;
        } catch {
          continue;
        }
      }

      await this.wait(300);

      // Send with Enter key via chrome_keyboard
      try {
        const kbArgs: Record<string, unknown> = { keys: 'Return' };
        if (tabId !== undefined) kbArgs.tabId = tabId;
        await this.host.callTool('chrome_keyboard', kbArgs);
        return true;
      } catch {
        // Try send button as fallback
        const sendSelectors = [
          'button[aria-label*="发送"]',
          'button[aria-label*="Send"]',
          'button[data-testid*="send"]',
        ];
        for (const sel of sendSelectors) {
          try {
            const clickArgs: Record<string, unknown> = { selector: sel };
            if (tabId !== undefined) clickArgs.tabId = tabId;
            await this.host.callTool('chrome_click_element', clickArgs);
            return true;
          } catch {
            continue;
          }
        }
        return false;
      }
    } catch {
      return false;
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
