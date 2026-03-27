import { chromium, type BrowserContext, type Locator, type Page } from 'playwright';

import type { BridgeConfig } from './config.js';

export interface BrowserStatus {
  running: boolean;
  currentUrl?: string;
  lastError?: string;
}

export interface BrowserThreadSnapshot {
  url?: string;
  title?: string;
  threadId?: string;
}

export interface BrowserSendResult extends BrowserThreadSnapshot {
  sent: boolean;
  error?: string;
}

export interface BrowserSessionAdapter {
  ensureStarted(): Promise<void>;
  openLogin(): Promise<string>;
  openThread(url: string): Promise<BrowserThreadSnapshot>;
  sendTranscript(transcript: string, threadUrl?: string): Promise<BrowserSendResult>;
  probeAuthStatus(): Promise<'connected' | 'needs_login'>;
  findThreadByTitle(title: string): Promise<BrowserThreadSnapshot | null>;
  status(): BrowserStatus;
  close(): Promise<void>;
}

const COMPOSER_SELECTORS = [
  'textarea:not([disabled]):not([readonly])',
  '[role="textbox"][contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
  '[contenteditable="true"]',
  'div[data-lexical-editor="true"]',
  'input[type="text"]:not([disabled]):not([readonly])',
  'input:not([type]):not([disabled]):not([readonly])',
];

const SEND_BUTTON_SELECTORS = [
  'button[aria-label*="发送"]',
  'button[aria-label*="Send"]',
  'button[title*="发送"]',
  'button[title*="Send"]',
  'button:has-text("发送")',
  'button:has-text("Send")',
  '[role="button"]:has-text("发送")',
  '[role="button"]:has-text("Send")',
  'button[data-testid*="send"]',
];

const NEW_CHAT_SELECTORS = [
  'button:has-text("新对话")',
  'button:has-text("新聊天")',
  'button:has-text("新建对话")',
  '[role="button"]:has-text("新对话")',
  '[role="button"]:has-text("新聊天")',
  '[role="button"]:has-text("新建对话")',
  'a:has-text("新对话")',
  'a:has-text("新聊天")',
];

function normalizeUrl(baseUrl: string, href: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
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

export class DoubaoBrowserSession implements BrowserSessionAdapter {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private lastError?: string;

  constructor(private readonly config: BridgeConfig) {}

  async ensureStarted(): Promise<void> {
    if (this.context) return;

    this.context = await chromium.launchPersistentContext(this.config.profileDir, {
      headless: this.config.headless,
      viewport: { width: 1280, height: 900 },
    });

    const pages = this.context.pages();
    this.page = pages[0] ?? (await this.context.newPage());
  }

  status(): BrowserStatus {
    return {
      running: !!this.context,
      currentUrl: this.page?.url(),
      lastError: this.lastError,
    };
  }

  async openLogin(): Promise<string> {
    await this.ensureStarted();
    if (!this.page) throw new Error('Browser page not available');
    await this.page.goto(this.config.doubaoBaseUrl, { waitUntil: 'domcontentloaded' });
    return this.page.url();
  }

  async openThread(url: string): Promise<BrowserThreadSnapshot> {
    await this.ensureStarted();
    if (!this.page) throw new Error('Browser page not available');
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle', { timeout: 4_000 }).catch(() => undefined);
    return this.captureSnapshot();
  }

  async sendTranscript(transcript: string, threadUrl?: string): Promise<BrowserSendResult> {
    await this.ensureStarted();
    if (!this.page) throw new Error('Browser page not available');

    if (threadUrl) {
      await this.page.goto(threadUrl, { waitUntil: 'domcontentloaded' });
    } else {
      await this.page.goto(this.config.doubaoBaseUrl, { waitUntil: 'domcontentloaded' });
      await this.tryOpenNewChat();
    }

    await this.page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    const composer = await this.findVisibleLocator(COMPOSER_SELECTORS, 12_000);
    if (composer) {
      try {
        await composer.click({ timeout: 3_000 });
      } catch {
        // Focusing is best-effort; continue with fill fallback.
      }

      const beforeUrl = this.page.url();
      await this.fillComposer(composer, transcript);

      const sendButton = await this.findVisibleLocator(SEND_BUTTON_SELECTORS, 1_500);
      if (sendButton) {
        await sendButton.click({ timeout: 2_000 }).catch(() => undefined);
      } else {
        await this.page.keyboard.press('Enter');
      }

      await this.page
        .waitForFunction(
          (previousUrl) => window.location.href !== previousUrl || /\/(?:chat|thread)\//.test(window.location.href),
          beforeUrl,
          { timeout: 6_000 },
        )
        .catch(() => undefined);
      await this.page.waitForLoadState('networkidle', { timeout: 4_000 }).catch(() => undefined);

      const snapshot = await this.captureSnapshot();
      this.lastError = undefined;
      return { ...snapshot, sent: true };
    }

    const snapshot = await this.captureSnapshot();
    const bodySnippet = (((await this.page.textContent('body').catch(() => '')) || '').trim()).slice(0, 120);
    this.lastError = `No editable element found on the current Doubao page (${snapshot.url || 'unknown'}${bodySnippet ? `; ${bodySnippet}` : ''})`;
    return { ...snapshot, sent: false, error: this.lastError };
  }

  async findThreadByTitle(title: string): Promise<BrowserThreadSnapshot | null> {
    await this.ensureStarted();
    if (!this.page) return null;

    const candidateUrls = Array.from(
      new Set([this.page.url(), this.config.doubaoBaseUrl].filter(Boolean)),
    );

    for (const url of candidateUrls) {
      if (url && this.page.url() !== url) {
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      }

      const anchor = this.page.locator('a').filter({ hasText: title }).first();
      if (await anchor.count()) {
        const href = await anchor.getAttribute('href');
        return {
          title,
          url: href ? normalizeUrl(this.config.doubaoBaseUrl, href) : this.page.url(),
          threadId: extractThreadId(href ? normalizeUrl(this.config.doubaoBaseUrl, href) : this.page.url()),
        };
      }

      const clickable = this.page
        .locator('[role="link"], [role="button"], button')
        .filter({ hasText: title })
        .first();
      if (await clickable.count()) {
        try {
          await clickable.click({ timeout: 3000 });
          await this.page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => undefined);
          return this.captureSnapshot(title);
        } catch {
          // Fall through to the next strategy.
        }
      }
    }

    return null;
  }

  async probeAuthStatus(): Promise<'connected' | 'needs_login'> {
    await this.ensureStarted();
    if (!this.page) return 'needs_login';

    const url = this.page.url();
    const composer = await this.findVisibleLocator(COMPOSER_SELECTORS, 1_500);
    if (composer) {
      return 'connected';
    }

    const bodyText = (await this.page.textContent('body').catch(() => '')) || '';
    const looksLikeLoginPage =
      /登录|注册|验证码|手机号/.test(bodyText) ||
      /login|signin|passport/.test(url);

    return looksLikeLoginPage ? 'needs_login' : 'connected';
  }

  async close(): Promise<void> {
    await this.context?.close();
    this.context = null;
    this.page = null;
  }

  private async captureSnapshot(fallbackTitle?: string): Promise<BrowserThreadSnapshot> {
    if (!this.page) return {};

    const url = this.page.url();
    const pageTitle = await this.page.title().catch(() => undefined);
    return {
      url,
      title: (pageTitle && pageTitle.trim()) || fallbackTitle,
      threadId: extractThreadId(url),
    };
  }

  private async tryOpenNewChat(): Promise<void> {
    if (!this.page) return;

    for (const selector of NEW_CHAT_SELECTORS) {
      const locator = this.page.locator(selector).first();
      try {
        if ((await locator.count()) > 0 && (await locator.isVisible({ timeout: 500 }).catch(() => false))) {
          await locator.click({ timeout: 2_000 });
          await this.page.waitForLoadState('domcontentloaded', { timeout: 3_000 }).catch(() => undefined);
          return;
        }
      } catch {
        // Continue scanning alternative selectors.
      }
    }
  }

  private async fillComposer(locator: Locator, transcript: string): Promise<void> {
    if (!this.page) return;

    try {
      await locator.fill(transcript, { timeout: 3_000 });
      return;
    } catch {
      // Fallback to keyboard insertion for custom editors.
    }

    try {
      await locator.focus();
    } catch {
      // Best-effort.
    }

    await this.page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+A`).catch(() => undefined);
    await this.page.keyboard.press('Backspace').catch(() => undefined);
    await this.page.keyboard.insertText(transcript);
  }

  private async findVisibleLocator(selectors: string[], timeoutMs: number): Promise<Locator | null> {
    if (!this.page) return null;

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      for (const frame of this.page.frames()) {
        for (const selector of selectors) {
          const locator = frame.locator(selector).first();
          try {
            if ((await locator.count()) === 0) continue;
            if (await locator.isVisible({ timeout: 250 }).catch(() => false)) {
              return locator;
            }
          } catch {
            // Ignore detached/hidden nodes while the page is hydrating.
          }
        }
      }

      await this.page.waitForTimeout(300);
    }

    return null;
  }
}
