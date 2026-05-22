import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium, type BrowserContext, type Page } from 'playwright';

import type { BridgeConfig } from '../../config.js';
import { BridgeMemoryServiceClient } from '../../memoryServiceClient.js';
import type { BridgeSettingsStore } from '../../settings.js';
import type { BridgeAuthStatus } from '../../types.js';
import { RawMessageStore } from '../cache/RawMessageStore.js';
import { CursorStore } from '../CursorStore.js';
import { ExplorerExtractor } from '../extractor.js';
import type {
  ExplorationCursor,
  ExplorerTransportStatus,
  ExplorerRunSummary,
  RawMessageRecord,
} from '../types.js';

const CHATGPT_BASE_URL = 'https://chatgpt.com';
const CHATGPT_LOGIN_URL = `${CHATGPT_BASE_URL}/auth/login`;
const CHATGPT_PAGE_SIZE = 100;
const CHATGPT_REQUEST_INTERVAL_MS = 1_000;

export interface ChatGPTSessionResponse {
  accessToken?: string | null;
}

export interface ChatGPTConversationSummary {
  id: string;
  title?: string;
  update_time?: string | number | null;
  create_time?: string | number | null;
}

export interface ChatGPTConversationListResponse {
  items?: ChatGPTConversationSummary[];
}

export interface ChatGPTConversationMessage {
  id?: string;
  author?: { role?: string | null };
  create_time?: number | string | null;
  status?: string | null;
  end_turn?: boolean | null;
  content?: unknown;
}

export interface ChatGPTConversationNode {
  id?: string;
  parent?: string | null;
  message?: ChatGPTConversationMessage | null;
}

export interface ChatGPTConversationResponse {
  id?: string;
  conversation_id?: string;
  current_node?: string | null;
  mapping?: Record<string, ChatGPTConversationNode>;
}

/**
 * Which underlying browser was actually used for the most recent operation.
 * - `playwright`: launched Playwright's own bundled Chromium
 * - `webpage_mcp`: routed through the user's daily Chrome via webpage-mcp extension
 * - `unknown`: no operation has run yet
 */
export type ChatGPTClientMode = 'playwright' | 'webpage_mcp' | 'unknown';

export interface ChatGPTClientStatus {
  mode: ChatGPTClientMode;
  /** Human-readable reason explaining a fallback or failure, if any. */
  fallbackReason?: string;
}

export interface ChatGPTApiClient {
  openLogin(): Promise<string>;
  probeAuthStatus?(): Promise<BridgeAuthStatus>;
  getAccessToken(): Promise<string | undefined>;
  listConversationsPage(
    accessToken: string | undefined,
    offset: number,
    limit: number,
  ): Promise<ChatGPTConversationSummary[]>;
  getConversation(
    accessToken: string | undefined,
    conversationId: string,
  ): Promise<ChatGPTConversationResponse>;
  close(): Promise<void>;
  /** Reports which transport was actually used most recently. Optional for back-compat. */
  getClientStatus?(): ChatGPTClientStatus;
}

type PersistentContextLauncher = typeof chromium.launchPersistentContext;

function normalizeTimestamp(
  value?: string | number | null,
): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? Math.floor(value / 1000) : value;
  }
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric > 1e12 ? Math.floor(numeric / 1000) : numeric;
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }
  return undefined;
}

function timestampToIsoString(
  value?: string | number | null,
): string | undefined {
  const seconds = normalizeTimestamp(value);
  return typeof seconds === 'number'
    ? new Date(seconds * 1000).toISOString()
    : undefined;
}

function conversationTimestamp(summary: ChatGPTConversationSummary): number {
  return (
    normalizeTimestamp(summary.update_time) ??
    normalizeTimestamp(summary.create_time) ??
    0
  );
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function collectContentText(value: unknown): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectContentText(item));
  }
  if (!isObjectRecord(value)) {
    return [];
  }

  if (Array.isArray(value.parts)) {
    return collectContentText(value.parts);
  }
  if ('text' in value) {
    return collectContentText(value.text);
  }
  if (Array.isArray(value.list)) {
    return collectContentText(value.list);
  }

  return [];
}

function extractMessageContent(content: unknown): string | undefined {
  const combined = collectContentText(content).join('\n').trim();
  return combined || undefined;
}

function hashMessageContent(role: string, content: string): string {
  return crypto
    .createHash('sha256')
    .update(`${role}\n${content}`)
    .digest('hex');
}

function dedupeMessageIds(messageIds: string[]): string[] {
  return Array.from(
    new Set(messageIds.map((messageId) => messageId.trim()).filter(Boolean)),
  );
}

function isConversationComplete(
  conversation: ChatGPTConversationResponse,
  messages: RawMessageRecord[],
): boolean {
  if (messages.length === 0) {
    return false;
  }

  const currentNodeId = conversation.current_node ?? undefined;
  const currentNode = currentNodeId
    ? conversation.mapping?.[currentNodeId]
    : undefined;
  const currentMessage = currentNode?.message;
  const currentRole = currentMessage?.author?.role?.trim() || 'unknown';
  const currentStatus = currentMessage?.status?.trim();
  const currentContent = extractMessageContent(currentMessage?.content);

  if (currentRole === 'assistant') {
    if (!currentContent || currentMessage?.end_turn === false) {
      return false;
    }
    if (currentStatus && /in_progress|streaming|pending/i.test(currentStatus)) {
      return false;
    }
  }

  if (currentRole === 'user' && messages.length === 1) {
    return false;
  }

  return true;
}

export class PlaywrightChatGPTClient implements ChatGPTApiClient {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private startupPromise: Promise<void> | null = null;
  private operationTail: Promise<void> = Promise.resolve();
  private requestTail: Promise<void> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(
    private readonly config: BridgeConfig,
    private readonly launchPersistentContext: PersistentContextLauncher = chromium.launchPersistentContext.bind(
      chromium,
    ),
  ) {}

  async openLogin(): Promise<string> {
    return this.withPageLock(async () => {
      const page = await this.ensurePage();
      await page.goto(CHATGPT_LOGIN_URL, { waitUntil: 'domcontentloaded' });
      return page.url();
    });
  }

  async getAccessToken(): Promise<string | undefined> {
    const session = await this.requestJson<ChatGPTSessionResponse>(
      '/api/auth/session',
    ).catch(() => undefined);
    const token = session?.accessToken?.trim();
    return token || undefined;
  }

  async listConversationsPage(
    accessToken: string | undefined,
    offset: number,
    limit: number,
  ): Promise<ChatGPTConversationSummary[]> {
    const response = await this.requestJson<ChatGPTConversationListResponse>(
      `/backend-api/conversations?offset=${offset}&limit=${limit}`,
      accessToken,
    );
    return Array.isArray(response.items) ? response.items : [];
  }

  async getConversation(
    accessToken: string | undefined,
    conversationId: string,
  ): Promise<ChatGPTConversationResponse> {
    return this.requestJson<ChatGPTConversationResponse>(
      `/backend-api/conversation/${encodeURIComponent(conversationId)}`,
      accessToken,
    );
  }

  async close(): Promise<void> {
    await this.context?.close();
    this.context = null;
    this.page = null;
  }

  getClientStatus(): ChatGPTClientStatus {
    return { mode: this.context ? 'playwright' : 'unknown' };
  }

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

  private async ensurePage(): Promise<Page> {
    if (!this.startupPromise) {
      this.startupPromise = this.ensurePageInternal().finally(() => {
        this.startupPromise = null;
      });
    }
    await this.startupPromise;
    if (!this.page) {
      throw new Error('ChatGPT browser page not available');
    }
    return this.page;
  }

  private async ensurePageInternal(): Promise<void> {
    const livePage = this.getLivePage();
    if (this.context && livePage) {
      this.page = livePage;
      return;
    }

    if (this.context) {
      await this.context.close().catch(() => undefined);
      this.context = null;
      this.page = null;
    }

    const profileDir = path.join(this.config.profileDir, 'chatgpt');
    await fs.mkdir(profileDir, { recursive: true });
    this.context = await this.launchPersistentContext(profileDir, {
      headless: this.config.headless,
    });
    const existingPages = this.context
      .pages()
      .filter((page) => !page.isClosed());
    this.page = existingPages[0] ?? (await this.context.newPage());
  }

  private getLivePage(): Page | null {
    if (this.page && !this.page.isClosed()) {
      return this.page;
    }
    if (!this.context) {
      this.page = null;
      return null;
    }
    const existingPage =
      this.context.pages().find((page) => !page.isClosed()) ?? null;
    this.page = existingPage;
    return existingPage;
  }

  private async requestJson<T>(
    relativePath: string,
    accessToken?: string,
  ): Promise<T> {
    return this.withRequestLock(async () => {
      await this.ensurePage();
      if (!this.context) {
        throw new Error('ChatGPT browser context not available');
      }

      const now = Date.now();
      const waitMs = Math.max(
        0,
        CHATGPT_REQUEST_INTERVAL_MS - (now - this.lastRequestAt),
      );
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }

      const response = await this.context.request.get(
        `${CHATGPT_BASE_URL}${relativePath}`,
        {
          headers: {
            Accept: 'application/json',
            ...(accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : undefined),
          },
          failOnStatusCode: false,
        },
      );
      this.lastRequestAt = Date.now();

      const text = await response.text();
      if (!response.ok) {
        const suffix = text.trim() ? `: ${text.trim()}` : '';
        throw new Error(
          `ChatGPT request failed: GET ${relativePath} (${response.status()})${suffix}`,
        );
      }

      try {
        return JSON.parse(text) as T;
      } catch (error) {
        throw new Error(
          `ChatGPT returned invalid JSON for ${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  private async withRequestLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.requestTail;
    let release: (() => void) | undefined;
    this.requestTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      release?.();
    }
  }
}

export class ChatGPTSource {
  private readonly extractor: ExplorerExtractor;

  constructor(
    private readonly settingsStore: Pick<BridgeSettingsStore, 'getSettings'>,
    private readonly rawStore: RawMessageStore,
    private readonly cursorStore: CursorStore,
    memoryClient: BridgeMemoryServiceClient,
    private readonly client: ChatGPTApiClient,
  ) {
    this.extractor = new ExplorerExtractor(memoryClient, rawStore);
  }

  async getAuthStatus(): Promise<BridgeAuthStatus> {
    try {
      const probedStatus = await this.client.probeAuthStatus?.();
      if (probedStatus) {
        return probedStatus;
      }
      const token = await this.client.getAccessToken();
      if (token) {
        return 'connected';
      }
      await this.client.listConversationsPage(undefined, 0, 1);
      return 'connected';
    } catch (error) {
      if (looksLikeAuthFailure(error)) {
        return 'needs_login';
      }
      return 'error';
    }
  }

  async openLogin(): Promise<{
    url?: string;
    opened?: boolean;
    implemented?: boolean;
  }> {
    const url = await this.client.openLogin();
    return { url, opened: true, implemented: true };
  }

  async runNow(): Promise<Partial<ExplorerRunSummary> & { implemented?: boolean }> {
    const settings = this.settingsStore.getSettings().explorer;
    const accessToken = await this.client.getAccessToken();
    let conversations: ChatGPTConversationSummary[];
    try {
      conversations = await this.collectConversations(accessToken, settings.chatgpt);
    } catch (error) {
      if (looksLikeAuthFailure(error)) {
        throw new Error(
          'ChatGPT login required before running explorer collection.',
        );
      }
      throw error;
    }
    let insertedCount = 0;
    const processedCursors: ExplorationCursor[] = [];

    for (const conversation of conversations) {
      const cursor = await this.cursorStore.get('chatgpt', conversation.id);
      if (!this.shouldCollectConversation(conversation, cursor)) {
        continue;
      }

      const detail = await this.client.getConversation(
        accessToken,
        conversation.id,
      );
      const messages = this.flattenConversation(conversation.id, detail);
      if (messages.length === 0 || !isConversationComplete(detail, messages)) {
        continue;
      }

      const pendingMessages = this.filterPendingMessages(messages, cursor);
      if (pendingMessages.length > 0) {
        insertedCount += this.rawStore.insertMany(pendingMessages);
      }
      processedCursors.push(
        this.buildCursor(
          conversation.id,
          messages,
          conversation.update_time,
          cursor,
        ),
      );
    }

    const extraction = await this.extractor.extractPendingMessages({
      source: 'chatgpt',
      defaultScope: settings.chatgpt.defaultScope,
      autoClassify: settings.autoClassify,
    });

    for (const cursor of processedCursors) {
      await this.cursorStore.upsert(cursor);
    }

    return {
      insertedCount,
      extractedConversationCount: extraction.conversationCount,
      extractedMessageCount: extraction.messageCount,
      artifactCount: extraction.artifactCount,
      skippedConversationCount: extraction.skippedConversationCount,
      implemented: true,
    };
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  /**
   * Reports which underlying browser the ChatGPT client is currently using.
   * Useful for the UI banner that explains "you enabled user-Chrome but we
   * fell back to Playwright because port 9222 was unreachable".
   */
  getTransportStatus(): ExplorerTransportStatus | undefined {
    if (typeof this.client.getClientStatus !== 'function') {
      return undefined;
    }
    const status = this.client.getClientStatus();
    return {
      mode: status.mode,
      fallbackReason: status.fallbackReason,
    };
  }

  private async collectConversations(
    accessToken: string | undefined,
    settings: ReturnType<
      BridgeSettingsStore['getSettings']
    >['explorer']['chatgpt'],
  ): Promise<ChatGPTConversationSummary[]> {
    const maxConversations = Math.max(0, settings.maxConversations);
    const cutoffSeconds =
      settings.lookbackDays > 0
        ? Math.floor(Date.now() / 1000) - settings.lookbackDays * 24 * 60 * 60
        : 0;
    const results: ChatGPTConversationSummary[] = [];

    for (let offset = 0; ; offset += CHATGPT_PAGE_SIZE) {
      const page = await this.client.listConversationsPage(
        accessToken,
        offset,
        CHATGPT_PAGE_SIZE,
      );
      if (page.length === 0) {
        break;
      }

      let pageHasRecentConversation = false;
      for (const conversation of page) {
        const updatedAt = conversationTimestamp(conversation);
        if (cutoffSeconds > 0 && updatedAt > 0 && updatedAt < cutoffSeconds) {
          continue;
        }
        pageHasRecentConversation = true;
        if (conversation.id) {
          results.push(conversation);
        }
        if (maxConversations > 0 && results.length >= maxConversations) {
          return results.slice(0, maxConversations);
        }
      }

      if (cutoffSeconds > 0 && !pageHasRecentConversation) {
        break;
      }
    }

    return results;
  }

  private flattenConversation(
    conversationId: string,
    conversation: ChatGPTConversationResponse,
  ): RawMessageRecord[] {
    const mapping = conversation.mapping ?? {};
    const chain: ChatGPTConversationNode[] = [];
    const seen = new Set<string>();
    let currentNodeId = conversation.current_node ?? undefined;

    while (currentNodeId && !seen.has(currentNodeId)) {
      seen.add(currentNodeId);
      const node = mapping[currentNodeId];
      if (!node) break;
      chain.push(node);
      currentNodeId = node.parent ?? undefined;
    }

    return chain.reverse().flatMap((node) => {
      const message = node.message;
      const messageId = message?.id ?? node.id;
      const role = message?.author?.role?.trim() || 'unknown';
      const content = extractMessageContent(message?.content);
      if (!messageId || !content) {
        return [];
      }

      return [
        {
          source: 'chatgpt' as const,
          conversationId,
          messageId,
          ts: timestampToIsoString(message?.create_time),
          role,
          contentHash: hashMessageContent(role, content),
          content,
        },
      ];
    });
  }

  private filterPendingMessages(
    messages: RawMessageRecord[],
    cursor?: ExplorationCursor,
  ): RawMessageRecord[] {
    const processedMessageIds = new Set(cursor?.processedMessageIds ?? []);
    if (processedMessageIds.size === 0) {
      return messages;
    }

    return messages.filter(
      (message) => !processedMessageIds.has(message.messageId),
    );
  }

  private shouldCollectConversation(
    conversation: ChatGPTConversationSummary,
    cursor?: ExplorationCursor,
  ): boolean {
    if (!cursor?.lastProcessedUpdateTime) {
      return true;
    }
    const updatedAt = conversationTimestamp(conversation);
    if (updatedAt <= 0) {
      return true;
    }
    return updatedAt * 1000 > Date.parse(cursor.lastProcessedUpdateTime);
  }

  private buildCursor(
    conversationId: string,
    messages: RawMessageRecord[],
    updateTime?: string | number | null,
    previousCursor?: ExplorationCursor,
  ): ExplorationCursor {
    const lastMessage = messages[messages.length - 1]!;
    return {
      source: 'chatgpt',
      conversationId,
      lastMessageId: lastMessage.messageId,
      lastProcessedUpdateTime:
        timestampToIsoString(updateTime) ??
        lastMessage.ts ??
        new Date().toISOString(),
      contentHash: lastMessage.contentHash,
      processedMessageIds: dedupeMessageIds([
        ...(previousCursor?.processedMessageIds ?? []),
        ...messages.map((message) => message.messageId),
      ]),
    };
  }
}

function looksLikeAuthFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(401|403)\b/.test(message) || /login required|unauthorized|forbidden/i.test(message);
}
