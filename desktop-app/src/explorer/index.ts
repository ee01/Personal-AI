import type { BridgeSettingsStore, ExplorerSettings } from '../settings.js';
import type { BridgeAuthStatus } from '../types.js';
import type { BridgeMemoryServiceClient } from '../memoryServiceClient.js';
import { RawMessageStore } from './cache/RawMessageStore.js';
import { CursorStore } from './CursorStore.js';
import {
  EXPLORER_SOURCE_IDS,
  toExplorerIngestSourceId,
} from './sourceIds.js';
import type {
  ExplorerPreviewResult,
  ExplorerRunSummary,
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
  runNow?: () => Promise<Partial<ExplorerRunSummary> & { implemented?: boolean }>;
  getTransportStatus?: () => ExplorerTransportStatus | undefined;
  close?: () => Promise<void> | void;
}

interface ExplorerRunState {
  running: boolean;
  lastRunAtMs?: number;
  lastRunAt?: string;
  lastRunOutcome: 'idle' | 'success' | 'error' | 'stub';
  lastError?: string;
  lastRunSummary?: ExplorerRunSummary;
}

interface ExplorerManagerOptions {
  settingsStore: Pick<BridgeSettingsStore, 'getSettings'>;
  memoryClient: Pick<BridgeMemoryServiceClient, 'deleteMemoriesBySourceScope'>;
  rawStore: RawMessageStore;
  cursorStore: CursorStore;
  sourceAdapters?: Partial<Record<SourceId, ExplorerSourceAdapter>>;
}

export class ExplorerManager {
  private readonly sourceAdapters: Partial<
    Record<SourceId, ExplorerSourceAdapter>
  >;
  private readonly runState: Record<SourceId, ExplorerRunState> =
    Object.fromEntries(
      EXPLORER_SOURCE_IDS.map((source) => [
        source,
        { running: false, lastRunOutcome: 'idle' },
      ]),
    ) as Record<SourceId, ExplorerRunState>;

  constructor(private readonly options: ExplorerManagerOptions) {
    this.sourceAdapters = options.sourceAdapters ?? {};
  }

  async getStatus(): Promise<ExplorerStatusSnapshot> {
    const settings = this.options.settingsStore.getSettings();
    const sourceStatuses = await Promise.all(
      EXPLORER_SOURCE_IDS.map(async (source) => {
        const sourceSettings = getExplorerSourceSettings(
          settings.explorer,
          source,
        );
        const defaultScope = normalizeExplorerDefaultScope(
          source,
          sourceSettings.defaultScope,
        );
        const authStatus = await this.getAuthStatus(
          source,
          sourceSettings.enabled,
        );
        return [
          source,
          {
            source,
            enabled: sourceSettings.enabled,
            settings: sourceSettings,
            authStatus,
            running: this.runState[source].running,
            lastRunAt: this.runState[source].lastRunAt,
            lastRunOutcome: this.runState[source].lastRunOutcome,
            lastError: this.runState[source].lastError,
            lastRunSummary: this.runState[source].lastRunSummary,
            cache: this.options.rawStore.getStats(source),
            revokePreview: this.options.rawStore.getRevokePreview(
              source,
              defaultScope,
            ),
            transport: this.sourceAdapters[source]?.getTransportStatus?.(),
          },
        ] as const;
      }),
    );

    return {
      updatedAt: new Date().toISOString(),
      askDefaultScope: settings.explorer.askDefaultScope,
      sources: Object.fromEntries(
        sourceStatuses,
      ) as unknown as ExplorerStatusSnapshot['sources'],
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
    extractedConversationCount: number;
    extractedMessageCount: number;
    artifactCount: number;
    skippedConversationCount: number;
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
      const runSummary = normalizeExplorerRunSummary(result);
      state.lastRunAtMs = finishedAtMs;
      state.lastRunAt = finishedAt;
      state.lastRunOutcome = implemented ? 'success' : 'stub';
      state.lastRunSummary = runSummary;
      return {
        source,
        startedAt,
        finishedAt,
        implemented,
        ...runSummary,
      };
    } catch (error) {
      const finishedAtMs = Date.now();
      const finishedAt = new Date(finishedAtMs).toISOString();
      state.lastRunAtMs = finishedAtMs;
      state.lastRunAt = finishedAt;
      state.lastRunOutcome = 'error';
      state.lastError = error instanceof Error ? error.message : String(error);
      state.lastRunSummary = undefined;
      throw error;
    } finally {
      state.running = false;
    }
  }

  async tick(): Promise<void> {
    const explorerSettings = this.options.settingsStore.getSettings().explorer;

    for (const source of EXPLORER_SOURCE_IDS) {
      const sourceSettings = getExplorerSourceSettings(
        explorerSettings,
        source,
      );
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
    deletedCursors: number;
  }> {
    const deletedMessages = this.options.rawStore.reset(source, conversationId);
    const deletedCursors = await this.options.cursorStore.reset(
      source,
      conversationId,
    );
    return {
      source,
      conversationId,
      deletedMessages,
      deletedCursors,
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
    localArtifactsRevoked: number;
    localLegacyArtifactsRevoked: number;
  }> {
    const previewBefore = this.options.rawStore.getRevokePreview(source, scope);
    const result = await this.options.memoryClient.deleteMemoriesBySourceScope(
      toExplorerIngestSourceId(source),
      scope,
    );
    const localArtifactsRevoked = this.options.rawStore.markArtifactsRevoked(
      source,
      scope,
    );
    return {
      ...result,
      source,
      localArtifactsRevoked,
      localLegacyArtifactsRevoked: Math.min(
        previewBefore.legacyUnscopedArtifactCount,
        localArtifactsRevoked,
      ),
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
    enabled: boolean,
  ): Promise<BridgeAuthStatus | 'unsupported'> {
    const adapter = this.sourceAdapters[source];
    if (!adapter?.getAuthStatus) {
      return source === 'chatgpt' ? 'unsupported' : 'unknown';
    }
    if (!enabled) {
      return 'unknown';
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
  ExplorerRunSummary,
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

function normalizeExplorerRunSummary(
  result: (Partial<ExplorerRunSummary> & { implemented?: boolean }) | undefined,
): ExplorerRunSummary {
  return {
    insertedCount: Number(result?.insertedCount ?? 0),
    extractedConversationCount: Number(result?.extractedConversationCount ?? 0),
    extractedMessageCount: Number(result?.extractedMessageCount ?? 0),
    artifactCount: Number(result?.artifactCount ?? 0),
    skippedConversationCount: Number(result?.skippedConversationCount ?? 0),
  };
}

function normalizeExplorerDefaultScope(
  source: SourceId,
  scope: unknown,
): 'work' | 'personal' {
  if (scope === 'work' || scope === 'personal') return scope;
  return source === 'doubao' ? 'personal' : 'work';
}

function getExplorerSourceSettings(
  explorerSettings: ExplorerSettings | Partial<Record<SourceId, unknown>>,
  source: SourceId,
): {
  enabled: boolean;
  intervalMinutes: number;
  defaultScope?: 'work' | 'personal';
} & Record<string, unknown> {
  const settings = explorerSettings[source] as
    | ({ enabled?: boolean; intervalMinutes?: number } & Record<
        string,
        unknown
      >)
    | undefined;
  return {
    enabled: settings?.enabled === true,
    intervalMinutes:
      typeof settings?.intervalMinutes === 'number' && settings.intervalMinutes > 0
        ? settings.intervalMinutes
        : 60,
    ...(settings ?? {}),
  };
}
