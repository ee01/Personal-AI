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
const POST_SEND_VERIFY_TIMEOUT_MS = 8_000;
const POST_SEND_VERIFY_INTERVAL_MS = 500;
const CHALLENGE_PATTERNS = [
  /请完成(?:安全)?验证/,
  /请先完成(?:安全)?验证/,
  /安全验证/,
  /行为异常/,
  /操作过于频繁/,
  /真人验证/,
  /风险验证/,
  /继续使用前请验证/,
];

function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function countTextOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while (offset < haystack.length) {
    const index = haystack.indexOf(needle, offset);
    if (index < 0) break;
    count += 1;
    offset = index + needle.length;
  }
  return count;
}

function extractThreadId(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/(?:chat|thread)\/([^/?#]+)/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

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
    await this.ensureStarted();
    await this.host.callTool('chrome_navigate', {
      url: DOUBAO_LOGIN_URL,
      openMode: 'new_tab',
    }).catch(() => undefined);
    return DOUBAO_LOGIN_URL;
  }

  async openThread(url: string): Promise<BrowserThreadSnapshot> {
    await this.ensureStarted();
    let tabId = await this.host.findTabByUrl(DOUBAO_URL_PATTERN);
    const navArgs: Record<string, unknown> = { url };
    if (tabId !== undefined) navArgs.tabId = tabId;
    else navArgs.openMode = 'new_tab';
    await this.host.callTool('chrome_navigate', navArgs);
    await this.wait(1000);
    tabId = await this.host.findTabByUrl(DOUBAO_URL_PATTERN);
    if (tabId === undefined) {
      throw new Error(
        'No doubao.com tab is available after navigation. Open Doubao in Chrome and try again.',
      );
    }
    const title = await this.host.evalInTab(tabId, `document.title`);
    const urlStr = await this.host.evalInTab(tabId, `window.location.href`);
    return {
      url: urlStr || url,
      title: title || '',
      threadId: extractThreadId(urlStr || url),
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

    let tabId = await this.host.findTabByUrl(DOUBAO_URL_PATTERN);

    if (threadUrl) {
      const navArgs: Record<string, unknown> = { url: threadUrl };
      if (tabId !== undefined) navArgs.tabId = tabId;
      else navArgs.openMode = 'new_tab';
      await this.host.callTool('chrome_navigate', navArgs);
      await this.wait(1500);
      tabId = await this.host.findTabByUrl(DOUBAO_URL_PATTERN);
    } else if (tabId === undefined) {
      await this.host.callTool('chrome_navigate', {
        url: DOUBAO_LOGIN_URL,
        openMode: 'new_tab',
      });
      await this.wait(1500);
      tabId = await this.host.findTabByUrl(DOUBAO_URL_PATTERN);
    }

    if (tabId === undefined) {
      return {
        sent: false,
        url: threadUrl ?? '',
        threadId: extractThreadId(threadUrl),
        transportUsed: 'dom',
        transportMode: 'webpage_mcp',
        verified: false,
        challengeDetected: false,
        messageVisible: false,
        error:
          'No doubao.com tab is available in Chrome. Open Doubao or let the managed Chromium fallback handle this sync.',
      };
    }

    const preSend = await this.inspectPage(tabId, transcript);
    const urlStr = await this.host
      .evalInTab(tabId, `window.location.href`)
      .catch(() => threadUrl ?? '');
    if (preSend.challengeDetected) {
      return {
        sent: false,
        url: urlStr,
        threadId: extractThreadId(urlStr),
        transportUsed: 'dom',
        transportMode: 'webpage_mcp',
        verified: false,
        challengeDetected: true,
        messageVisible: false,
        observedBodySnippet: preSend.observedBodySnippet,
        error: `Doubao challenge detected before send (${preSend.observedBodySnippet || 'unknown'})`,
      };
    }

    const attempt = await this.typeAndSend(tabId, transcript);
    const finalUrlStr = await this.host
      .evalInTab(tabId, `window.location.href`)
      .catch(() => threadUrl ?? '');
    const postSend = attempt.submitted
      ? await this.waitForPostSend(
          tabId,
          transcript,
          preSend.visibleMatchCount,
        )
      : await this.inspectPage(tabId, transcript, preSend.visibleMatchCount);
    const sent =
      attempt.submitted &&
      !postSend.challengeDetected &&
      postSend.messageVisible;
    const error = sent
      ? undefined
      : !attempt.filled
        ? 'No editable element found in the current Doubao tab'
        : !attempt.submitted
          ? 'Unable to submit the transcript in the current Doubao tab'
          : postSend.challengeDetected
            ? `Doubao challenge detected after send (${postSend.observedBodySnippet || 'unknown'})`
            : `Doubao did not show the message after send (${postSend.observedBodySnippet || 'unknown'})`;

    return {
      sent,
      url: finalUrlStr,
      threadId: extractThreadId(finalUrlStr),
      transportUsed: 'dom',
      transportMode: 'webpage_mcp',
      verified: sent,
      challengeDetected: postSend.challengeDetected,
      messageVisible: postSend.messageVisible,
      observedBodySnippet: postSend.observedBodySnippet,
      error,
    };
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
    if (tabId === undefined) {
      return null;
    }
    const js = `
      (async () => {
        const items = Array.from(
          document.querySelectorAll('[data-testid^="conversation-item"], [class*="conversationItem"]')
        );
        const match = items.find(el => el.textContent?.includes(${JSON.stringify(title)}));
        if (!match) return JSON.stringify(null);
        const link = match.querySelector('a') || match.closest('a');
        const href = link?.getAttribute('href') || '';
        const url = href ? new URL(href, 'https://www.doubao.com').toString() : '';
        const idMatch = url.match(/\\/(?:chat|thread)\\/([^/?#]+)/);
        return JSON.stringify({
          title: match.textContent?.trim(),
          url,
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
  ): Promise<{ filled: boolean; submitted: boolean }> {
    try {
      const composerSelectors = [
        'textarea:not([disabled]):not([readonly])',
        '[role="textbox"][contenteditable="true"]',
        '[contenteditable="plaintext-only"]',
        'div[data-lexical-editor="true"]',
      ];

      // Try fill via webpage-mcp's fill_or_select
      let filled = false;
      for (const selector of composerSelectors) {
        try {
          const fillArgs: Record<string, unknown> = { selector, value: text };
          if (tabId !== undefined) fillArgs.tabId = tabId;
          await this.host.callTool('chrome_fill_or_select', fillArgs);
          filled = true;
          break;
        } catch {
          continue;
        }
      }

      if (!filled) {
        return { filled: false, submitted: false };
      }

      await this.wait(300);

      // Send with Enter key via chrome_keyboard
      try {
        const kbArgs: Record<string, unknown> = { keys: 'Return' };
        if (tabId !== undefined) kbArgs.tabId = tabId;
        await this.host.callTool('chrome_keyboard', kbArgs);
        return { filled: true, submitted: true };
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
            return { filled: true, submitted: true };
          } catch {
            continue;
          }
        }
        return { filled: true, submitted: false };
      }
    } catch {
      return { filled: false, submitted: false };
    }
  }

  private async waitForPostSend(
    tabId: number | undefined,
    transcript: string,
    baselineMatchCount: number,
  ): Promise<{
    challengeDetected: boolean;
    messageVisible: boolean;
    observedBodySnippet?: string;
    visibleMatchCount: number;
  }> {
    const maxAttempts = Math.max(
      1,
      Math.ceil(POST_SEND_VERIFY_TIMEOUT_MS / POST_SEND_VERIFY_INTERVAL_MS),
    );
    let lastInspection = await this.inspectPage(
      tabId,
      transcript,
      baselineMatchCount,
    );
    for (
      let attempt = 0;
      attempt < maxAttempts &&
      !lastInspection.challengeDetected &&
      !lastInspection.messageVisible;
      attempt += 1
    ) {
      await this.wait(POST_SEND_VERIFY_INTERVAL_MS);
      lastInspection = await this.inspectPage(
        tabId,
        transcript,
        baselineMatchCount,
      );
    }
    return lastInspection;
  }

  private async inspectPage(
    tabId: number | undefined,
    transcript: string,
    baselineMatchCount = 0,
  ): Promise<{
    challengeDetected: boolean;
    messageVisible: boolean;
    observedBodySnippet?: string;
    visibleMatchCount: number;
  }> {
    const bodyText = compactText(
      await this.host
        .evalInTab(
          tabId,
          `
            (() => {
              const body = document.body;
              if (!body) return '';
              const clone = body.cloneNode(true);
              clone
                .querySelectorAll('textarea, input, [contenteditable="true"], [contenteditable="plaintext-only"], div[data-lexical-editor="true"]')
                .forEach((node) => node.remove());
              return clone.innerText || body.innerText || '';
            })()
          `,
        )
        .catch(() => ''),
    );
    const transcriptProbe = compactText(transcript).slice(0, 24);
    const visibleMatchCount = countTextOccurrences(bodyText, transcriptProbe);
    return {
      challengeDetected: CHALLENGE_PATTERNS.some((pattern) =>
        pattern.test(bodyText),
      ),
      messageVisible:
        transcriptProbe.length > 0
          ? visibleMatchCount > baselineMatchCount
          : false,
      observedBodySnippet: bodyText.slice(0, 160),
      visibleMatchCount,
    };
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
