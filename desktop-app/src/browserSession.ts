import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  chromium,
  type BrowserContext,
  type Locator,
  type Page,
} from 'playwright';

import type { BridgeConfig } from './config.js';

const execFileAsync = promisify(execFile);

export type BrowserTransportMode = 'playwright' | 'webpage_mcp' | 'unknown';

export interface BrowserTransportStatus {
  mode: BrowserTransportMode;
  preferredMode?: BrowserTransportMode;
  fallbackReason?: string;
  fallbackCooldownUntil?: string;
}

export interface BrowserStatus {
  running: boolean;
  currentUrl?: string;
  lastError?: string;
  transport?: BrowserTransportStatus;
}

export interface BrowserThreadSnapshot {
  url?: string;
  title?: string;
  threadId?: string;
}

export interface BrowserConversationMessageSnapshot {
  messageId?: string;
  roleHint?: string;
  content: string;
  timestampLabel?: string;
}

export interface BrowserConversationSnapshot extends BrowserThreadSnapshot {
  conversationId: string;
  updatedLabel?: string;
  messages: BrowserConversationMessageSnapshot[];
}

export interface BrowserSendResult extends BrowserThreadSnapshot {
  sent: boolean;
  error?: string;
  transportUsed?: 'dom';
  transportMode?: BrowserTransportMode;
  transportFallbackReason?: string;
  verified?: boolean;
  challengeDetected?: boolean;
  messageVisible?: boolean;
  observedBodySnippet?: string;
}

export type BrowserInputMode = 'default' | 'paste' | 'type' | 'insert' | 'fill';
export type BrowserSendMode = 'auto' | 'button' | 'enter';

export interface BrowserSendOptions {
  inputMode?: BrowserInputMode;
  sendMode?: BrowserSendMode;
  preSendDelayMs?: number;
  retryInputMode?: BrowserInputMode;
  retryPreSendDelayMs?: number;
}

export interface BrowserSessionAdapter {
  ensureStarted(): Promise<void>;
  openLogin(): Promise<string>;
  openThread(url: string): Promise<BrowserThreadSnapshot>;
  collectConversationSnapshots(): Promise<BrowserConversationSnapshot[]>;
  sendTranscript(
    transcript: string,
    threadUrl?: string,
    options?: BrowserSendOptions,
  ): Promise<BrowserSendResult>;
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
const POST_SEND_VERIFY_TIMEOUT_MS = 8_000;
const POST_SEND_VERIFY_INTERVAL_MS = 500;

const SINGLETON_ARTIFACTS = [
  'SingletonLock',
  'SingletonCookie',
  'SingletonSocket',
] as const;

type PersistentContextLauncher = typeof chromium.launchPersistentContext;

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

function samePageUrl(left?: string, right?: string): boolean {
  if (!left || !right) return false;
  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);
    return (
      leftUrl.origin === rightUrl.origin &&
      leftUrl.pathname === rightUrl.pathname &&
      leftUrl.search === rightUrl.search
    );
  } catch {
    return left === right;
  }
}

function sameThreadTarget(left?: string, right?: string): boolean {
  const leftThreadId = extractThreadId(left);
  const rightThreadId = extractThreadId(right);
  if (leftThreadId && rightThreadId) {
    return leftThreadId === rightThreadId;
  }
  return samePageUrl(left, right);
}

function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

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

function dedupeConversationSnapshots(
  snapshots: BrowserConversationSnapshot[],
): BrowserConversationSnapshot[] {
  const byConversation = new Map<string, BrowserConversationSnapshot>();
  for (const snapshot of snapshots) {
    const existing = byConversation.get(snapshot.conversationId);
    if (!existing || snapshot.messages.length > existing.messages.length) {
      byConversation.set(snapshot.conversationId, snapshot);
    }
  }
  return Array.from(byConversation.values());
}

export class DoubaoBrowserSession implements BrowserSessionAdapter {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private lastError?: string;
  private operationTail: Promise<void> = Promise.resolve();
  private startupPromise: Promise<void> | null = null;

  constructor(
    private readonly config: BridgeConfig,
    private readonly launchPersistentContext: PersistentContextLauncher = chromium.launchPersistentContext.bind(
      chromium,
    ),
  ) {}

  private async withPageLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.operationTail;
    let release: (() => void) | undefined;
    this.operationTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      release?.();
    }
  }

  async ensureStarted(): Promise<void> {
    if (!this.startupPromise) {
      this.startupPromise = this.ensureStartedInternal().finally(() => {
        this.startupPromise = null;
      });
    }
    await this.startupPromise;
  }

  private async ensureStartedInternal(): Promise<void> {
    const existingPage = this.getLivePage();
    if (this.context && existingPage) {
      this.page = existingPage;
      return;
    }

    if (this.context) {
      const reopenedPage = await this.tryOpenPageInExistingContext();
      if (reopenedPage) {
        this.page = reopenedPage;
        return;
      }
      await this.disposeContext();
    }

    const tempDir = await this.ensurePlaywrightTempDir();
    this.context = await this.launchPersistentContextWithRecovery(tempDir);
    await this.grantClipboardPermissions();

    const pages = this.context.pages();
    this.page =
      pages.find((page) => !page.isClosed()) ?? (await this.context.newPage());
  }

  private getLivePage(): Page | null {
    if (this.page && !this.page.isClosed()) {
      return this.page;
    }

    if (!this.context) {
      this.page = null;
      return null;
    }

    try {
      const existingPage =
        this.context.pages().find((page) => !page.isClosed()) ?? null;
      if (!existingPage) {
        this.page = null;
        return null;
      }
      this.page = existingPage;
      return existingPage;
    } catch {
      this.context = null;
      this.page = null;
      return null;
    }
  }

  private async ensurePlaywrightTempDir(): Promise<string> {
    const tempDir = path.join(this.config.dataDir, 'tmp', 'playwright');
    await fs.mkdir(tempDir, { recursive: true });
    process.env.TMPDIR = tempDir;
    process.env.TMP = tempDir;
    process.env.TEMP = tempDir;
    return tempDir;
  }

  status(): BrowserStatus {
    const page = this.getLivePage();
    return {
      running: !!page,
      currentUrl: page?.url(),
      lastError: this.lastError,
      transport: {
        mode: 'playwright',
        preferredMode: 'playwright',
      },
    };
  }

  async openLogin(): Promise<string> {
    return this.withPageLock(async () => {
      await this.ensureStarted();
      if (!this.page) throw new Error('Browser page not available');
      if (!samePageUrl(this.page.url(), this.config.doubaoBaseUrl)) {
        await this.page.goto(this.config.doubaoBaseUrl, {
          waitUntil: 'domcontentloaded',
        });
      }
      return this.page.url();
    });
  }

  async openThread(url: string): Promise<BrowserThreadSnapshot> {
    return this.withPageLock(async () => {
      await this.ensureStarted();
      if (!this.page) throw new Error('Browser page not available');
      if (!samePageUrl(this.page.url(), url)) {
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      }
      await this.page
        .waitForLoadState('networkidle', { timeout: 4_000 })
        .catch(() => undefined);
      return this.captureSnapshot();
    });
  }

  async collectConversationSnapshots(): Promise<BrowserConversationSnapshot[]> {
    return this.withPageLock(async () => {
      await this.ensureStarted();
      if (!this.page) throw new Error('Browser page not available');

      if (!samePageUrl(this.page.url(), this.config.doubaoBaseUrl)) {
        await this.page.goto(this.config.doubaoBaseUrl, {
          waitUntil: 'domcontentloaded',
        });
      }
      await this.page
        .waitForLoadState('networkidle', { timeout: 5_000 })
        .catch(() => undefined);

      const links = await this.extractConversationLinks();
      const snapshots: BrowserConversationSnapshot[] = [];

      for (const link of links) {
        if (!samePageUrl(this.page.url(), link.url)) {
          await this.page.goto(link.url, { waitUntil: 'domcontentloaded' });
        }
        await this.page
          .waitForLoadState('networkidle', { timeout: 4_000 })
          .catch(() => undefined);

        const current = await this.captureSnapshot(link.title);
        const conversationId = current.threadId || link.conversationId;
        if (!conversationId) {
          continue;
        }

        snapshots.push({
          conversationId,
          url: current.url || link.url,
          title: current.title || link.title,
          threadId: current.threadId || link.conversationId,
          updatedLabel: link.updatedLabel,
          messages: await this.extractConversationMessages(),
        });
      }

      if (snapshots.length === 0) {
        const current = await this.captureSnapshot();
        if (current.threadId) {
          snapshots.push({
            conversationId: current.threadId,
            url: current.url,
            title: current.title,
            threadId: current.threadId,
            messages: await this.extractConversationMessages(),
          });
        }
      }

      return dedupeConversationSnapshots(snapshots);
    });
  }

  async sendTranscript(
    transcript: string,
    threadUrl?: string,
    options: BrowserSendOptions = {},
  ): Promise<BrowserSendResult> {
    return this.withPageLock(async () => {
      const explicitMode = options.inputMode;
      if (explicitMode && explicitMode !== 'default') {
        return this.performSendAttempt(
          transcript,
          threadUrl,
          { ...options, inputMode: explicitMode },
          false,
        );
      }

      const firstAttempt = await this.performSendAttempt(
        transcript,
        threadUrl,
        {
          ...options,
          inputMode: 'paste',
        },
        false,
      );
      if (firstAttempt.sent || firstAttempt.challengeDetected) {
        return firstAttempt;
      }

      const fallbackModes: BrowserInputMode[] = options.retryInputMode
        ? [options.retryInputMode, 'type']
        : ['insert', 'type'];
      let lastAttempt = firstAttempt;
      for (const fallbackMode of fallbackModes) {
        const attempt = await this.performSendAttempt(
          transcript,
          threadUrl,
          {
            ...options,
            inputMode: fallbackMode,
            preSendDelayMs:
              options.retryPreSendDelayMs ??
              Math.max(options.preSendDelayMs ?? 1800, 2000),
          },
          true,
        );
        if (attempt.sent || attempt.challengeDetected) {
          return attempt;
        }
        lastAttempt = attempt;
      }

      return lastAttempt;
    });
  }

  private async performSendAttempt(
    transcript: string,
    threadUrl: string | undefined,
    options: BrowserSendOptions,
    skipNavigation: boolean,
  ): Promise<BrowserSendResult> {
    await this.ensureStarted();
    if (!this.page) throw new Error('Browser page not available');

    if (!skipNavigation) {
      if (threadUrl) {
        if (!samePageUrl(this.page.url(), threadUrl)) {
          await this.page.goto(threadUrl, { waitUntil: 'domcontentloaded' });
        }
      } else {
        if (!samePageUrl(this.page.url(), this.config.doubaoBaseUrl)) {
          await this.page.goto(this.config.doubaoBaseUrl, {
            waitUntil: 'domcontentloaded',
          });
        }
        await this.tryOpenNewChat();
      }
    }

    await this.page
      .waitForLoadState('networkidle', { timeout: 5_000 })
      .catch(() => undefined);

    const preSend = await this.inspectPostSend(transcript);
    if (preSend.challengeDetected) {
      const snapshot = await this.captureSnapshot();
      this.lastError = `Doubao challenge detected before send (${preSend.observedBodySnippet || 'unknown'})`;
      return {
        ...snapshot,
        sent: false,
        transportUsed: 'dom',
        transportMode: 'playwright',
        verified: false,
        challengeDetected: true,
        messageVisible: false,
        observedBodySnippet: preSend.observedBodySnippet,
        error: this.lastError,
      };
    }

    const composer = await this.findVisibleLocator(COMPOSER_SELECTORS, 12_000);
    if (composer) {
      try {
        await composer.click({ timeout: 3_000 });
      } catch {
        // Focusing is best-effort; continue with fill fallback.
      }

      const beforeUrl = this.page.url();
      await this.fillComposer(
        composer,
        transcript,
        options.inputMode || 'default',
      );
      await this.page.waitForTimeout(
        options.preSendDelayMs ?? randomDelay(1200, 2100),
      );

      const sendButton = await this.findVisibleLocator(
        SEND_BUTTON_SELECTORS,
        1_500,
      );
      if (options.sendMode === 'button' && sendButton) {
        await sendButton.click({ timeout: 2_000 }).catch(() => undefined);
      } else if (options.sendMode === 'enter') {
        await this.page.keyboard.press('Enter');
      } else if (sendButton) {
        await sendButton.click({ timeout: 2_000 }).catch(() => undefined);
      } else {
        await this.page.keyboard.press('Enter');
      }

      await this.page
        .waitForFunction(
          (previousUrl) =>
            window.location.href !== previousUrl ||
            /\/(?:chat|thread)\//.test(window.location.href),
          beforeUrl,
          { timeout: 6_000 },
        )
        .catch(() => undefined);
      await this.page
        .waitForLoadState('networkidle', { timeout: 4_000 })
        .catch(() => undefined);

      const snapshot = await this.captureSnapshot();
      const postSend = await this.waitForPostSend(
        transcript,
        preSend.visibleMatchCount,
      );
      if (threadUrl && !sameThreadTarget(snapshot.url, threadUrl)) {
        this.lastError = `Transcript was sent to a different thread than requested (${snapshot.url || 'unknown'})`;
        return {
          ...snapshot,
          sent: false,
          transportUsed: 'dom',
          transportMode: 'playwright',
          verified: false,
          challengeDetected: false,
          messageVisible: postSend.messageVisible,
          observedBodySnippet: postSend.observedBodySnippet,
          error: this.lastError,
        };
      }
      if (postSend.challengeDetected) {
        this.lastError = `Doubao challenge detected after send (${postSend.observedBodySnippet || 'unknown'})`;
        return {
          ...snapshot,
          sent: false,
          transportUsed: 'dom',
          transportMode: 'playwright',
          verified: false,
          challengeDetected: true,
          messageVisible: postSend.messageVisible,
          observedBodySnippet: postSend.observedBodySnippet,
          error: this.lastError,
        };
      }
      if (!postSend.messageVisible) {
        this.lastError = `Doubao did not show the message after send (${postSend.observedBodySnippet || 'unknown'})`;
        return {
          ...snapshot,
          sent: false,
          transportUsed: 'dom',
          transportMode: 'playwright',
          verified: false,
          challengeDetected: false,
          messageVisible: false,
          observedBodySnippet: postSend.observedBodySnippet,
          error: this.lastError,
        };
      }
      this.lastError = undefined;
      return {
        ...snapshot,
        sent: true,
        transportUsed: 'dom',
        transportMode: 'playwright',
        verified: postSend.messageVisible,
        challengeDetected: false,
        messageVisible: postSend.messageVisible,
        observedBodySnippet: postSend.observedBodySnippet,
      };
    }

    const snapshot = await this.captureSnapshot();
    const bodySnippet = (
      (await this.page.textContent('body').catch(() => '')) || ''
    )
      .trim()
      .slice(0, 120);
    this.lastError = `No editable element found on the current Doubao page (${snapshot.url || 'unknown'}${bodySnippet ? `; ${bodySnippet}` : ''})`;
    return {
      ...snapshot,
      sent: false,
      error: this.lastError,
      transportUsed: 'dom',
      transportMode: 'playwright',
    };
  }

  async findThreadByTitle(
    title: string,
  ): Promise<BrowserThreadSnapshot | null> {
    return this.withPageLock(async () => {
      await this.ensureStarted();
      if (!this.page) return null;

      const candidateUrls = Array.from(
        new Set([this.page.url(), this.config.doubaoBaseUrl].filter(Boolean)),
      );

      for (const url of candidateUrls) {
        if (url && !samePageUrl(this.page.url(), url)) {
          await this.page.goto(url, { waitUntil: 'domcontentloaded' });
        }

        const anchor = this.page
          .locator('a')
          .filter({ hasText: title })
          .first();
        if (await anchor.count()) {
          const href = await anchor.getAttribute('href');
          return {
            title,
            url: href
              ? normalizeUrl(this.config.doubaoBaseUrl, href)
              : this.page.url(),
            threadId: extractThreadId(
              href
                ? normalizeUrl(this.config.doubaoBaseUrl, href)
                : this.page.url(),
            ),
          };
        }

        const clickable = this.page
          .locator('[role="link"], [role="button"], button')
          .filter({ hasText: title })
          .first();
        if (await clickable.count()) {
          try {
            await clickable.click({ timeout: 3000 });
            await this.page
              .waitForLoadState('domcontentloaded', { timeout: 3000 })
              .catch(() => undefined);
            return this.captureSnapshot(title);
          } catch {
            // Fall through to the next strategy.
          }
        }
      }

      return null;
    });
  }

  async probeAuthStatus(): Promise<'connected' | 'needs_login'> {
    const page = this.getLivePage();
    if (!page) return 'needs_login';

    try {
      const url = page.url();
      const composer = await this.findVisibleLocator(COMPOSER_SELECTORS, 1_500);
      if (composer) {
        return 'connected';
      }

      const bodyText = (await page.textContent('body').catch(() => '')) || '';
      const looksLikeLoginPage =
        /登录|注册|验证码|手机号/.test(bodyText) ||
        /login|signin|passport/.test(url);

      return looksLikeLoginPage ? 'needs_login' : 'connected';
    } catch {
      this.context = null;
      this.page = null;
      return 'needs_login';
    }
  }

  async close(): Promise<void> {
    await this.disposeContext();
  }

  private async captureSnapshot(
    fallbackTitle?: string,
  ): Promise<BrowserThreadSnapshot> {
    if (!this.page) return {};

    const url = this.page.url();
    const pageTitle = await this.page.title().catch(() => undefined);
    return {
      url,
      title: (pageTitle && pageTitle.trim()) || fallbackTitle,
      threadId: extractThreadId(url),
    };
  }

  private async extractConversationLinks(): Promise<
    Array<{
      conversationId: string;
      url: string;
      title?: string;
      updatedLabel?: string;
    }>
  > {
    if (!this.page) {
      return [];
    }

    return this.page.evaluate((baseUrl) => {
      const compact = (value: string): string =>
        value.replace(/\s+/g, ' ').trim();
      const normalize = (href: string): string | undefined => {
        try {
          return new URL(href, baseUrl).toString();
        } catch {
          return undefined;
        }
      };
      const timePattern =
        /刚刚|分钟前|小时前|天前|今天|昨天|前天|\d{1,2}:\d{2}|\d{4}[年\/-]\d{1,2}[月\/-]\d{1,2}|\d{1,2}[\/-]\d{1,2}/;
      const collectUpdatedLabel = (
        container: Element | null,
        title?: string,
      ): string | undefined => {
        if (!container) return undefined;
        const nodes = Array.from(
          container.querySelectorAll('time, small, span, div, p'),
        );
        for (const node of nodes) {
          const text = compact(node.textContent || '');
          if (!text || text === title || text.length > 32) {
            continue;
          }
          if (timePattern.test(text)) {
            return text;
          }
        }
        return undefined;
      };

      const results: Array<{
        conversationId: string;
        url: string;
        title?: string;
        updatedLabel?: string;
      }> = [];
      const seen = new Set<string>();
      const anchors = Array.from(
        document.querySelectorAll('a[href], [role="link"][href]'),
      );

      for (const anchor of anchors) {
        const href = anchor.getAttribute('href') || '';
        const url = normalize(href);
        if (!url) {
          continue;
        }

        let parsed: URL;
        try {
          parsed = new URL(url);
        } catch {
          continue;
        }

        const match = parsed.pathname.match(/\/(?:chat|thread)\/([^/?#]+)/);
        if (!match) {
          continue;
        }

        const conversationId = match[1] || '';
        if (!conversationId || seen.has(conversationId)) {
          continue;
        }

        const title =
          compact(
            anchor.getAttribute('aria-label') ||
              anchor.getAttribute('title') ||
              anchor.textContent ||
              '',
          ) || undefined;

        results.push({
          conversationId,
          url,
          title,
          updatedLabel: collectUpdatedLabel(
            anchor.closest('li, article, section, div'),
            title,
          ),
        });
        seen.add(conversationId);
      }

      return results;
    }, this.config.doubaoBaseUrl);
  }

  private async extractConversationMessages(): Promise<
    BrowserConversationMessageSnapshot[]
  > {
    if (!this.page) {
      return [];
    }

    return this.page.evaluate(() => {
      const compact = (value: string): string =>
        value.replace(/\s+/g, ' ').trim();
      const isVisible = (element: Element): boolean => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0
        );
      };
      const cleanText = (element: Element): string => {
        const clone = element.cloneNode(true) as Element;
        for (const selector of [
          'button',
          'nav',
          'svg',
          'img',
          'video',
          'audio',
          'textarea',
          'input',
          'style',
          'script',
          'noscript',
          '[aria-hidden="true"]',
        ]) {
          clone.querySelectorAll(selector).forEach((node) => node.remove());
        }
        return compact(clone.textContent || '');
      };
      const detectRole = (element: Element): string | undefined => {
        const probes = [
          element,
          element.parentElement,
          element.previousElementSibling,
          element.querySelector('header'),
        ].filter(Boolean) as Element[];
        const haystack = probes
          .map((probe) =>
            [
              probe.getAttribute('data-role') || '',
              probe.getAttribute('aria-label') || '',
              probe.getAttribute('title') || '',
              probe.getAttribute('id') || '',
              probe.className || '',
              probe.textContent || '',
            ].join(' '),
          )
          .join(' ')
          .toLowerCase();
        if (/assistant|doubao|bot|ai|模型/.test(haystack)) {
          return 'assistant';
        }
        if (/user|human|me|我|我的/.test(haystack)) {
          return 'user';
        }
        return undefined;
      };
      const detectTimestamp = (element: Element): string | undefined => {
        const timeNodes = Array.from(
          element.querySelectorAll('time, [datetime], [title]'),
        );
        for (const node of timeNodes) {
          const text = compact(
            node.getAttribute('datetime') ||
              node.getAttribute('title') ||
              node.textContent ||
              '',
          );
          if (
            text &&
            /刚刚|分钟前|小时前|天前|今天|昨天|前天|\d{1,2}:\d{2}|\d{4}[年\/-]\d{1,2}[月\/-]\d{1,2}|\d{1,2}[\/-]\d{1,2}/.test(
              text,
            )
          ) {
            return text;
          }
        }
        return undefined;
      };

      const selectorCandidates = [
        '[data-message-id]',
        '[data-testid*="message"]',
        '[class*="message"]',
        '[class*="Message"]',
        'article',
        '[role="article"]',
        '[role="listitem"]',
      ];
      const elements: Element[] = [];
      const seen = new Set<Element>();
      for (const selector of selectorCandidates) {
        for (const element of Array.from(document.querySelectorAll(selector))) {
          if (!seen.has(element)) {
            seen.add(element);
            elements.push(element);
          }
        }
      }

      const candidates = elements
        .filter((element) => isVisible(element))
        .map((element) => ({
          element,
          messageId:
            element.getAttribute('data-message-id') ||
            element.getAttribute('data-id') ||
            element.getAttribute('id') ||
            undefined,
          roleHint: detectRole(element),
          content: cleanText(element),
          timestampLabel: detectTimestamp(element),
        }))
        .filter((candidate) => candidate.content.length >= 2)
        .filter((candidate) => candidate.content.length <= 10_000);

      return candidates
        .filter((candidate, index) => {
          return !candidates.some((other, otherIndex) => {
            if (index === otherIndex) {
              return false;
            }
            return (
              candidate.element.contains(other.element) &&
              other.content.length >=
                Math.min(80, candidate.content.length * 0.6)
            );
          });
        })
        .map(({ element: _element, ...rest }) => rest);
    });
  }

  private async inspectPostSend(transcript: string): Promise<{
    challengeDetected: boolean;
    messageVisible: boolean;
    observedBodySnippet?: string;
    visibleMatchCount: number;
  }>;
  private async inspectPostSend(
    transcript: string,
    baselineMatchCount: number,
  ): Promise<{
    challengeDetected: boolean;
    messageVisible: boolean;
    observedBodySnippet?: string;
    visibleMatchCount: number;
  }>;
  private async inspectPostSend(
    transcript: string,
    baselineMatchCount = 0,
  ): Promise<{
    challengeDetected: boolean;
    messageVisible: boolean;
    observedBodySnippet?: string;
    visibleMatchCount: number;
  }> {
    if (!this.page) {
      return {
        challengeDetected: false,
        messageVisible: false,
        visibleMatchCount: 0,
      };
    }

    const bodyText = compactText(
      (await this.page
        .evaluate(() => {
          const body = document.body;
          if (!body) return '';
          const clone = body.cloneNode(true) as Element;
          clone
            .querySelectorAll(
              [
                'textarea',
                'input',
                '[contenteditable="true"]',
                '[contenteditable="plaintext-only"]',
                'div[data-lexical-editor="true"]',
              ].join(', '),
            )
            .forEach((node) => node.remove());
          return (
            clone.textContent ||
            (body as HTMLElement).innerText ||
            body.textContent ||
            ''
          );
        })
        .catch(() => '')) || '',
    );
    const transcriptProbe = compactText(transcript).slice(0, 24);
    const observedBodySnippet = bodyText.slice(0, 160);
    const visibleMatchCount = countTextOccurrences(bodyText, transcriptProbe);

    return {
      challengeDetected: CHALLENGE_PATTERNS.some((pattern) =>
        pattern.test(bodyText),
      ),
      messageVisible:
        transcriptProbe.length > 0
          ? visibleMatchCount > baselineMatchCount
          : false,
      observedBodySnippet,
      visibleMatchCount,
    };
  }

  private async waitForPostSend(
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
    let lastInspection = await this.inspectPostSend(
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
      await this.page?.waitForTimeout(POST_SEND_VERIFY_INTERVAL_MS);
      lastInspection = await this.inspectPostSend(
        transcript,
        baselineMatchCount,
      );
    }
    return lastInspection;
  }

  private async tryOpenNewChat(): Promise<void> {
    if (!this.page) return;

    for (const selector of NEW_CHAT_SELECTORS) {
      const locator = this.page.locator(selector).first();
      try {
        if (
          (await locator.count()) > 0 &&
          (await locator.isVisible({ timeout: 500 }).catch(() => false))
        ) {
          await locator.click({ timeout: 2_000 });
          await this.page
            .waitForLoadState('domcontentloaded', { timeout: 3_000 })
            .catch(() => undefined);
          return;
        }
      } catch {
        // Continue scanning alternative selectors.
      }
    }
  }

  private async fillComposer(
    locator: Locator,
    transcript: string,
    inputMode: BrowserInputMode,
  ): Promise<void> {
    if (!this.page) return;

    if (inputMode === 'type') {
      await this.typeComposer(locator, transcript);
      return;
    }

    if (inputMode === 'insert') {
      await this.insertComposer(locator, transcript);
      return;
    }

    if (inputMode === 'fill') {
      await this.fillComposerDirect(locator, transcript);
      return;
    }

    if (await this.tryPasteComposer(locator, transcript)) {
      return;
    }

    throw new Error('Paste mode failed to write transcript into composer.');
  }

  private async tryPasteComposer(
    locator: Locator,
    transcript: string,
  ): Promise<boolean> {
    if (!this.page) return false;

    let clipboardBackup: string | undefined;
    try {
      clipboardBackup = await this.readClipboardText();
      await locator.focus();
      await this.page.waitForTimeout(randomDelay(180, 320));
      await this.page.keyboard
        .press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+A`)
        .catch(() => undefined);
      await this.page.keyboard.press('Backspace').catch(() => undefined);
      await this.page.waitForTimeout(randomDelay(120, 220));

      await this.page.evaluate(async (text) => {
        await navigator.clipboard.writeText(text);
      }, transcript);

      await this.page.waitForTimeout(randomDelay(180, 300));
      await this.page.keyboard.press(
        `${process.platform === 'darwin' ? 'Meta' : 'Control'}+V`,
      );
      await this.page.waitForTimeout(randomDelay(250, 450));

      const currentValue = await locator.evaluate((element) => {
        if ('value' in element) {
          return String(
            (element as HTMLInputElement | HTMLTextAreaElement).value || '',
          );
        }
        return (element.textContent || '').trim();
      });

      return currentValue.includes(transcript.trim().slice(0, 24));
    } catch {
      return false;
    } finally {
      await this.restoreClipboardText(clipboardBackup);
    }
  }

  private async typeComposer(
    locator: Locator,
    transcript: string,
  ): Promise<void> {
    if (!this.page) return;
    await locator.focus();
    await this.page.waitForTimeout(randomDelay(180, 320));
    await this.page.keyboard
      .press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+A`)
      .catch(() => undefined);
    await this.page.keyboard.press('Backspace').catch(() => undefined);
    await this.page.waitForTimeout(randomDelay(160, 280));
    await this.page.keyboard.type(transcript, { delay: randomDelay(26, 54) });
  }

  private async insertComposer(
    locator: Locator,
    transcript: string,
  ): Promise<void> {
    if (!this.page) return;
    try {
      await locator.focus();
    } catch {
      // Best-effort.
    }
    await this.page.keyboard
      .press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+A`)
      .catch(() => undefined);
    await this.page.keyboard.press('Backspace').catch(() => undefined);
    await this.page.waitForTimeout(randomDelay(160, 260));
    await this.page.keyboard.insertText(transcript);
  }

  private async fillComposerDirect(
    locator: Locator,
    transcript: string,
  ): Promise<void> {
    if (!this.page) return;
    await locator.fill('').catch(() => undefined);
    await locator.fill(transcript);
  }

  private async findVisibleLocator(
    selectors: string[],
    timeoutMs: number,
  ): Promise<Locator | null> {
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

  private async readClipboardText(): Promise<string | undefined> {
    if (!this.page) return undefined;
    try {
      return await this.page.evaluate(async () =>
        navigator.clipboard.readText(),
      );
    } catch {
      return undefined;
    }
  }

  private async restoreClipboardText(value: string | undefined): Promise<void> {
    if (!this.page || value === undefined) return;
    await this.page
      .evaluate(async (text) => {
        await navigator.clipboard.writeText(text);
      }, value)
      .catch(() => undefined);
  }

  private async launchPersistentContextWithRecovery(
    tempDir: string,
  ): Promise<BrowserContext> {
    const launchOptions = {
      env: {
        ...process.env,
        TMPDIR: tempDir,
        TMP: tempDir,
        TEMP: tempDir,
      },
      headless: this.config.headless,
      viewport: { width: 1280, height: 900 },
    } as const;

    try {
      return await this.launchPersistentContext(
        this.config.profileDir,
        launchOptions,
      );
    } catch (error) {
      const recovered = await this.recoverProfileDirectoryLock(error);
      if (!recovered) {
        throw error;
      }
      return await this.launchPersistentContext(
        this.config.profileDir,
        launchOptions,
      );
    }
  }

  private async grantClipboardPermissions(): Promise<void> {
    if (!this.context) return;
    try {
      const origin = new URL(this.config.doubaoBaseUrl).origin;
      await this.context.grantPermissions(
        ['clipboard-read', 'clipboard-write'],
        { origin },
      );
    } catch {
      // Permission grant is best-effort. Fallbacks below do not depend on it.
    }
  }

  private async tryOpenPageInExistingContext(): Promise<Page | null> {
    if (!this.context) return null;

    try {
      return await this.context.newPage();
    } catch {
      return null;
    }
  }

  private async disposeContext(): Promise<void> {
    const context = this.context;
    this.context = null;
    this.page = null;
    await context?.close().catch(() => undefined);
  }

  private isProfileInUseError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /ProcessSingleton|SingletonLock|profile is already in use/i.test(
      message,
    );
  }

  private async recoverProfileDirectoryLock(error: unknown): Promise<boolean> {
    if (!this.isProfileInUseError(error)) {
      return false;
    }

    const terminatedPids = await this.terminateProfileProcesses();
    const cleanedArtifacts = await this.cleanupSingletonArtifacts();
    if (terminatedPids.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return terminatedPids.length > 0 || cleanedArtifacts;
  }

  private async terminateProfileProcesses(): Promise<number[]> {
    const pids = await this.findProfileProcessPids();
    const terminated: number[] = [];
    for (const pid of pids) {
      if (await this.terminatePid(pid)) {
        terminated.push(pid);
      }
    }
    return terminated;
  }

  private async findProfileProcessPids(): Promise<number[]> {
    const pids = new Set<number>();
    const singletonPid = await this.readSingletonLockPid();
    if (singletonPid) {
      pids.add(singletonPid);
    }

    try {
      const { stdout } = await execFileAsync(
        '/bin/ps',
        ['-axo', 'pid=,command='],
        { encoding: 'utf8' },
      );
      for (const rawLine of stdout.split('\n')) {
        const line = rawLine.trim();
        if (
          !line ||
          !line.includes(`--user-data-dir=${this.config.profileDir}`)
        )
          continue;

        const match = line.match(/^(\d+)\s+/);
        const pid = match ? Number(match[1]) : NaN;
        if (Number.isFinite(pid) && pid > 0 && pid !== process.pid) {
          pids.add(pid);
        }
      }
    } catch {
      // Best-effort; lock cleanup below still handles stale singleton symlinks.
    }

    return Array.from(pids);
  }

  private async readSingletonLockPid(): Promise<number | undefined> {
    try {
      const linkTarget = await fs.readlink(
        path.join(this.config.profileDir, 'SingletonLock'),
      );
      const match = linkTarget.match(/-(\d+)$/);
      const pid = match ? Number(match[1]) : NaN;
      return Number.isFinite(pid) && pid > 0 ? pid : undefined;
    } catch {
      return undefined;
    }
  }

  private async terminatePid(pid: number): Promise<boolean> {
    if (!pid || pid === process.pid) return false;

    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      return false;
    }

    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (!this.isProcessAlive(pid)) {
        return true;
      }
    }

    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      return !this.isProcessAlive(pid);
    }

    return true;
  }

  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private async cleanupSingletonArtifacts(): Promise<boolean> {
    let cleaned = false;
    for (const name of SINGLETON_ARTIFACTS) {
      const artifactPath = path.join(this.config.profileDir, name);
      try {
        await fs.lstat(artifactPath);
        await fs.rm(artifactPath, { force: true });
        cleaned = true;
      } catch {
        // Ignore filesystem races here; the follow-up launch attempt is authoritative.
      }
    }
    return cleaned;
  }
}
