import type { BridgeSettingsStore } from '../settings.js';
import type { BridgeAuthStatus } from '../types.js';
import type { BridgeMemoryServiceClient } from '../memoryServiceClient.js';
import { RawMessageStore } from './cache/RawMessageStore.js';
import { CursorStore } from './CursorStore.js';
import { toExplorerIngestSourceId } from './sourceIds.js';
import type {
  ExplorerPreviewResult,
  ExplorerStatusSnapshot,
  ExplorerTransportStatus,
  SourceId,
} from './types.js';

interface ExplorerSourceAdapter {
  getAuthStatus?: () => Promise<BridgeAuthStatus>;
  openLogin?: () => Promise<{
    url?: string;
    opened?: boolean;
    implemented?: boolean;
  }>;
  runNow?: () => Promise<{ insertedCount?: number; implemented?: boolean }>;
  getTransportStatus?: () => ExplorerTransportStatus | undefined;
  close?: () => Promise<void> | void;
}

interface ExplorerRunState {
  running: boolean;
  lastRunAtMs?: number;
  lastRunAt?: string;
  lastRunOutcome: 'idle' | 'success' | 'error' | 'stub';
  lastError?: string;
}

interface ExplorerManagerOptions {
  settingsStore: Pick<BridgeSettingsStore, 'getSettings'>;
  memoryClient: Pick<BridgeMemoryServiceClient, 'deleteMemoriesBySourceScope'>;
  rawStore: RawMessageStore;
  cursorStore: CursorStore;
  sourceAdapters?: Partial<Record<SourceId, ExplorerSourceAdapter>>;
}

const SOURCE_IDS: SourceId[] = ['doubao', 'chatgpt'];

export class ExplorerManager {
  private readonly sourceAdapters: Partial<
    Record<SourceId, ExplorerSourceAdapter>
  >;
  private readonly runState: Record<SourceId, ExplorerRunState> = {
    doubao: { running: false, lastRunOutcome: 'idle' },
    chatgpt: { running: false, lastRunOutcome: 'idle' },
  };

  constructor(private readonly options: ExplorerManagerOptions) {
    this.sourceAdapters = options.sourceAdapters ?? {};
  }

  async getStatus(): Promise<ExplorerStatusSnapshot> {
    const settings = this.options.settingsStore.getSettings();
    const doubaoAuthStatus = await this.getAuthStatus('doubao');
    const chatgptAuthStatus = await this.getAuthStatus('chatgpt');

    return {
      updatedAt: new Date().toISOString(),
      askDefaultScope: settings.explorer.askDefaultScope,
      sources: {
        doubao: {
          source: 'doubao',
          enabled: settings.explorer.doubao.enabled,
          settings: settings.explorer.doubao,
          authStatus: doubaoAuthStatus,
          running: this.runState.doubao.running,
          lastRunAt: this.runState.doubao.lastRunAt,
          lastRunOutcome: this.runState.doubao.lastRunOutcome,
          lastError: this.runState.doubao.lastError,
          cache: this.options.rawStore.getStats('doubao'),
        },
        chatgpt: {
          source: 'chatgpt',
          enabled: settings.explorer.chatgpt.enabled,
          settings: settings.explorer.chatgpt,
          authStatus: chatgptAuthStatus,
          running: this.runState.chatgpt.running,
          lastRunAt: this.runState.chatgpt.lastRunAt,
          lastRunOutcome: this.runState.chatgpt.lastRunOutcome,
          lastError: this.runState.chatgpt.lastError,
          cache: this.options.rawStore.getStats('chatgpt'),
          transport: this.sourceAdapters.chatgpt?.getTransportStatus?.(),
        },
      },
    };
  }

  async openLogin(source: SourceId): Promise<{
    source: SourceId;
    url?: string;
    opened: boolean;
    implemented: boolean;
  }> {
    const adapter = this.sourceAdapters[source];
    if (!adapter?.openLogin) {
      return {
        source,
        opened: false,
        implemented: false,
      };
    }

    const result = await adapter.openLogin();
    return {
      source,
      url: result.url,
      opened: result.opened ?? Boolean(result.url),
      implemented: result.implemented ?? true,
    };
  }

  async runNow(source: SourceId): Promise<{
    source: SourceId;
    startedAt: string;
    finishedAt: string;
    implemented: boolean;
    insertedCount: number;
  }> {
    const state = this.runState[source];
    if (state.running) {
      throw new Error(`${source} explorer run already in progress`);
    }

    state.running = true;
    state.lastError = undefined;
    const startedAt = new Date().toISOString();

    try {
      const adapter = this.sourceAdapters[source];
      const result = adapter?.runNow ? await adapter.runNow() : undefined;
      const implemented = result?.implemented ?? false;
      const finishedAtMs = Date.now();
      const finishedAt = new Date(finishedAtMs).toISOString();
      state.lastRunAtMs = finishedAtMs;
      state.lastRunAt = finishedAt;
      state.lastRunOutcome = implemented ? 'success' : 'stub';
      return {
        source,
        startedAt,
        finishedAt,
        implemented,
        insertedCount: Number(result?.insertedCount ?? 0),
      };
    } catch (error) {
      const finishedAtMs = Date.now();
      const finishedAt = new Date(finishedAtMs).toISOString();
      state.lastRunAtMs = finishedAtMs;
      state.lastRunAt = finishedAt;
      state.lastRunOutcome = 'error';
      state.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      state.running = false;
    }
  }

  async tick(): Promise<void> {
    const explorerSettings = this.options.settingsStore.getSettings().explorer;

    for (const source of SOURCE_IDS) {
      const sourceSettings = explorerSettings[source];
      const state = this.runState[source];
      const intervalMs = sourceSettings.intervalMinutes * 60_000;

      if (!sourceSettings.enabled || state.running) {
        continue;
      }

      if (!this.due(state.lastRunAtMs, intervalMs)) {
        continue;
      }

      try {
        await this.runNow(source);
      } catch (error) {
        console.error(
          `[desktop-app] explorer scheduled tick failed for ${source}:`,
          error,
        );
      }
    }
  }

  async resetCache(
    source: SourceId,
    conversationId?: string,
  ): Promise<{
    source: SourceId;
    conversationId?: string;
    deletedMessages: number;
  }> {
    const deletedMessages = this.options.rawStore.reset(source, conversationId);
    await this.options.cursorStore.reset(source, conversationId);
    return {
      source,
      conversationId,
      deletedMessages,
    };
  }

  /**
   * Returns a flat, paginated list of artifacts (extracted facts /
   * preferences / events / plans) across all explorer sources. Powers
   * the "Explored Memories" window which is the user's main daily view
   * of what has been ingested.
   */
  listExploredMemories(options: {
    source?: SourceId;
    query?: string;
    limit?: number;
    offset?: number;
  } = {}): {
    items: Array<
      ReturnType<RawMessageStore['listConversationArtifacts']>[number] & {
        ingestSource: string;
      }
    >;
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  } {
    const limit = Math.max(1, Math.min(options.limit ?? 50, 500));
    const offset = Math.max(0, options.offset ?? 0);
    const items = this.options.rawStore
      .listAllArtifacts({
        source: options.source,
        query: options.query,
        limit,
        offset,
      })
      .map((artifact) => ({
        ...artifact,
        ingestSource: toExplorerIngestSourceId(artifact.source),
      }));
    const total = this.options.rawStore.countAllArtifacts({
      source: options.source,
      query: options.query,
    });
    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  async preview(options: {
    source: SourceId;
    conversationId?: string;
    limit?: number;
  }): Promise<ExplorerPreviewResult> {
    const source = options.source;
    const limit = Math.max(1, options.limit ?? 50);
    const messages = this.options.rawStore.listMessages({
      source,
      conversationId: options.conversationId,
      limit: options.limit,
    });
    const conversationId =
      options.conversationId ?? messages[0]?.conversationId ?? undefined;
    return {
      source,
      conversationId,
      limit,
      cache: this.options.rawStore.getStats(source),
      conversations: this.options.rawStore.listConversations({
        source,
        limit: 100,
      }),
      messages,
      cleanedMessages: messages.map((message) => ({
        source: message.source,
        conversationId: message.conversationId,
        messageId: message.messageId,
        role: message.role,
        ts: message.ts,
        content: cleanPreviewMessageContent(message.content),
        extracted: Boolean(message.extractedAt),
      })),
      artifacts: this.options.rawStore.listConversationArtifacts({
        source,
        conversationId,
        limit,
      }),
      cursor: conversationId
        ? await this.options.cursorStore.get(source, conversationId)
        : undefined,
    };
  }

  async revokeIngestedMemories(
    source: SourceId,
    scope: 'work' | 'personal',
  ): Promise<{
    source: string;
    scope: 'work' | 'personal';
    deletedMessages: number;
    deletedChunks: number;
  }> {
    const result = await this.options.memoryClient.deleteMemoriesBySourceScope(
      toExplorerIngestSourceId(source),
      scope,
    );
    return {
      ...result,
      source,
    };
  }

  async close(): Promise<void> {
    for (const adapter of Object.values(this.sourceAdapters)) {
      await adapter?.close?.();
    }
    this.options.rawStore.close();
  }

  private async getAuthStatus(
    source: SourceId,
  ): Promise<BridgeAuthStatus | 'unsupported'> {
    const adapter = this.sourceAdapters[source];
    if (!adapter?.getAuthStatus) {
      return source === 'chatgpt' ? 'unsupported' : 'unknown';
    }
    return adapter.getAuthStatus();
  }

  private due(lastRunAtMs: number | undefined, intervalMs: number): boolean {
    return !lastRunAtMs || Date.now() - lastRunAtMs >= intervalMs;
  }
}

export { RawMessageStore } from './cache/RawMessageStore.js';
export { CursorStore } from './CursorStore.js';
export type {
  Artifact,
  ExplorationCursor,
  ExplorerPreviewResult,
  ExplorerSourceStatus,
  ExplorerStatusSnapshot,
  RawMessageRecord,
  RawMessageStoreStats,
  SourceId,
} from './types.js';

function cleanPreviewMessageContent(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line, index, lines) =>
        line.length > 0 || index === 0 || index === lines.length - 1,
    )
    .join('\n')
    .trim();
}
