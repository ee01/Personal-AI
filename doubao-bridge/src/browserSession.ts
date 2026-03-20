import { chromium, type BrowserContext, type Page } from 'playwright';

import type { BridgeConfig } from './config.js';

export interface BrowserStatus {
  running: boolean;
  currentUrl?: string;
  lastError?: string;
}

export interface BrowserSessionAdapter {
  ensureStarted(): Promise<void>;
  openLogin(): Promise<string>;
  openThread(url: string): Promise<string>;
  sendTranscript(transcript: string, threadUrl?: string): Promise<{ url?: string; sent: boolean }>;
  status(): BrowserStatus;
  close(): Promise<void>;
}

function findEditableSelector(): string {
  return [
    'textarea',
    '[contenteditable="true"]',
    'input[type="text"]',
    'input:not([type])',
  ].join(', ');
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

  async openThread(url: string): Promise<string> {
    await this.ensureStarted();
    if (!this.page) throw new Error('Browser page not available');
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    return this.page.url();
  }

  async sendTranscript(transcript: string, threadUrl?: string): Promise<{ url?: string; sent: boolean }> {
    await this.ensureStarted();
    if (!this.page) throw new Error('Browser page not available');

    if (threadUrl) {
      await this.page.goto(threadUrl, { waitUntil: 'domcontentloaded' });
    }

    const selector = findEditableSelector();
    const input = this.page.locator(selector).first();

    if (await input.count()) {
      await input.click({ timeout: 3000 });
      await input.fill(transcript);
      await this.page.keyboard.press('Enter');
      return { url: this.page.url(), sent: true };
    }

    this.lastError = 'No editable element found on current page';
    return { url: this.page.url(), sent: false };
  }

  async close(): Promise<void> {
    await this.context?.close();
    this.context = null;
    this.page = null;
  }
}
