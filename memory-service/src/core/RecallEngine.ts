/**
 * Multi-channel recall engine with MMR reranking.
 *
 * Phase 2 implementation: 4-channel parallel recall
 *   1. Vector search   -- sqlite-vec on messages_vec + chunks_vec
 *   2. FTS5 search     -- BM25 full-text on chunks_fts
 *   3. Knowledge Graph  -- entity + relationship traversal (1-hop & 2-hop)
 *   4. Time Window      -- recency-based search from parsed time expressions
 *
 * Results are merged, deduplicated, and reranked using Maximal Marginal
 * Relevance (MMR) to balance relevance with diversity.
 */

import type Database from 'better-sqlite3';

import type {
  RecallQuery,
  RecallOptions,
  RecallResult,
  RecallItem,
  RecallChannelDiagnostic,
  RecallChannelName,
  Entity,
  EntityType,
  MemoryScope,
  RecallSourceType,
  RecallScope,
  SourceType,
  MemoryRetrievalTier,
  RecallLifecycleMode,
} from '../types/index.js';
import { EmbeddingClient } from '../llm/EmbeddingClient.js';
import { now } from '../utils/time.js';
import { toSlug } from '../utils/slug.js';
import { parseQueryTimeRange } from '../utils/queryTime.js';
import { buildRecallPresentation } from '../utils/recallPresentation.js';
import { buildExploreLink } from '../utils/exploreLink.js';
import {
  getRecallFeedbackAction,
  isSceneScopedRecallFeedbackDetail,
} from '../utils/recallFeedback.js';
import { buildRecallScopeReceipt } from '../utils/recallScopeReceipt.js';
import { decideMemoryLifecycle } from './MemoryLifecyclePolicy.js';
import { runPersonalizedPageRank, type PprEdge } from './graphPpr.js';
import { BehaviorAffinityService } from './BehaviorAffinityService.js';
import { getConfig } from '../config.js';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface RecallCandidate {
  id: string;
  type: 'message' | 'chunk' | 'entity';
  content: string;
  score: number;
  embedding?: number[];
  timestamp?: number;
  source?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  channels: string[];
  metadata?: Record<string, any>;
  entity?: Entity;
  recencyScore?: number;
  salienceScore?: number;
  effectiveSalience?: number;
  retrievalTier?: MemoryRetrievalTier;
  lifecycleWeight?: number;
  lifecycleReason?: string;
  lifecycleAllowed?: boolean;
}

interface RecallAccessTarget {
  id: string;
  type: RecallCandidate['type'];
}

interface VecSearchRow {
  message_id?: string;
  chunk_id?: number;
  distance: number;
}

interface MessageRow {
  id: string;
  content: string;
  scope: MemoryScope | null;
  source: string | null;
  source_type: SourceType;
  source_url: string | null;
  source_title: string | null;
  timestamp: number;
  sender: string | null;
  group_id: string | null;
  group_name: string | null;
  matched_projects_json: string | null;
  metadata_json: string | null;
  importance: number;
  entities_json: string | null;
}

interface ChunkRow {
  chunk_id: number;
  content: string;
  file_path: string;
  scope: MemoryScope | null;
  source: string | null;
  source_type: RecallSourceType | null;
  related_project: string | null;
  related_entity_id: string | null;
  created_at: number;
}

interface FtsRow {
  rowid: number; // FTS5 content_rowid maps to chunks.chunk_id
  rank: number;
}

interface EntityRow {
  id: string;
  type: EntityType;
  name: string;
  aliases_json: string | null;
  description: string | null;
  importance: number;
  access_count: number;
  last_accessed: number | null;
  first_seen: number | null;
  last_seen: number | null;
  mention_count: number;
  tags_json: string | null;
  markdown_path: string | null;
  status: string;
  merged_into: string | null;
  created_at: number;
  updated_at: number | null;
}

interface RelationshipRow {
  id: number;
  from_entity_id: string;
  to_entity_id: string;
  relation_type: string;
  strength: number;
  co_occurrence_count: number;
  context: string | null;
}

interface MemoryMetaRow {
  target_type: string;
  target_id: string;
  salience_score: number;
  access_count: number;
  retrieval_tier: string | null;
  effective_salience: number | null;
  consolidation_level: string | null;
  last_accessed: number | null;
  created_at: number | null;
  updated_at: number | null;
}

interface MemoryFeedbackRow {
  target_type: string;
  target_id: string;
  action: string;
  detail?: string | null;
  updated_at: number;
}

interface EntityEvidenceRow extends MessageRow {
  scope: MemoryScope | null;
}

interface EntityEvidenceMatch {
  matches: boolean;
  metadata?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MMR_LAMBDA = 0.7;
const RECENCY_WEIGHT = 0.15;
const SALIENCE_WEIGHT = 0.1;
const SALIENCE_REINFORCE_BOOST = 0.02;
const DEFAULT_TOP_K = 10;
const VEC_OVER_FETCH_FACTOR = 3; // fetch more from each channel to allow MMR pruning
const DEFAULT_CHANNELS: RecallChannelName[] = [
  'vector',
  'fts',
  'graph',
  'time',
];
const DEFAULT_RECALL_EMBEDDING_TIMEOUT_MS = 2500;
const MAX_GRAPH_SEED_ENTITIES = 64;
const LOW_SPECIFICITY_GRAPH_TOKENS = new Set([
  'ai',
  'be',
  'fe',
  'ui',
  'ux',
  'qa',
  'pm',
]);
const CHANNEL_ORDER = new Map(
  DEFAULT_CHANNELS.map((channel, index) => [channel, index]),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cosine similarity between two vectors of equal length. */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function tokenizeForSimilarity(value: string): Set<string> {
  const tokens = new Set<string>();
  const words = value.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [];

  for (const word of words) {
    if (word.length > 1) {
      tokens.add(word);
    }

    for (const char of word) {
      if (/[\u3400-\u9fff\uf900-\ufaff]/u.test(char)) {
        tokens.add(char);
      }
    }
  }

  return tokens;
}

function tokenSetSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }

  return intersection / Math.sqrt(a.size * b.size);
}

function tokenizeGraphEntityText(value: string): string[] {
  return (
    value
      .toLowerCase()
      .match(/[\p{L}\p{N}_-]+/gu)
      ?.map((token) => token.trim())
      .filter((token) => token.length > 1) ?? []
  );
}

function getRecallEmbeddingTimeoutMs(): number {
  const parsed = Number.parseInt(
    process.env.RECALL_EMBEDDING_TIMEOUT_MS ||
      process.env.EMBEDDING_REQUEST_TIMEOUT_MS ||
      `${DEFAULT_RECALL_EMBEDDING_TIMEOUT_MS}`,
    10,
  );
  return Number.isFinite(parsed)
    ? Math.max(100, parsed)
    : DEFAULT_RECALL_EMBEDDING_TIMEOUT_MS;
}

function parseOptionalBooleanEnv(name: string): boolean | null {
  const raw = process.env[name];
  if (raw === undefined) return null;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}

function getRecallEmbeddingColdStartAllowed(
  requestedValue: boolean | undefined,
): boolean {
  const envValue = parseOptionalBooleanEnv(
    'RECALL_EMBEDDING_COLD_START_ENABLED',
  );
  if (envValue !== null) return envValue;
  return requestedValue ?? false;
}

function withRecallTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function normalizeGraphPhrase(value: string): string {
  return tokenizeGraphEntityText(value).join(' ');
}

function isSpecificGraphToken(token: string): boolean {
  if (/[\u3400-\u9fff\uf900-\ufaff]/u.test(token)) {
    return token.length >= 2;
  }
  if (token.length >= 3) return true;
  return !LOW_SPECIFICITY_GRAPH_TOKENS.has(token);
}

function tokenMatchesEntityToken(queryToken: string, entityToken: string): boolean {
  if (queryToken === entityToken) return true;
  if (queryToken.length < 3) return false;
  return entityToken.startsWith(queryToken) || queryToken.startsWith(entityToken);
}

/**
 * Sanitize a user query for FTS5 MATCH syntax.
 * Strips characters that are special in FTS5 and wraps each token in quotes.
 */
function sanitizeFtsQuery(query: string): string {
  // Remove FTS5 special characters, keep alphanumeric and spaces
  const cleaned = query.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  if (!cleaned) return '';

  // Split into tokens and wrap each in double quotes for exact token matching
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '';

  // Join with OR so partial matches still surface results
  return tokens.map((t) => `"${t}"`).join(' OR ');
}

/**
 * Convert an EntityRow from the DB into the Entity interface.
 */
function entityRowToEntity(row: EntityRow): Entity {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    aliases: row.aliases_json
      ? safeJsonParse<string[]>(row.aliases_json)
      : undefined,
    description: row.description ?? undefined,
    importance: row.importance,
    accessCount: row.access_count,
    lastAccessed: row.last_accessed ?? undefined,
    firstSeen: row.first_seen ?? undefined,
    lastSeen: row.last_seen ?? undefined,
    mentionCount: row.mention_count,
    tags: row.tags_json ? safeJsonParse<string[]>(row.tags_json) : undefined,
    markdownPath: row.markdown_path ?? undefined,
    status: row.status as Entity['status'],
    mergedInto: row.merged_into ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

function safeJsonParse<T>(json: string): T | undefined {
  try {
    return JSON.parse(json) as T;
  } catch {
    return undefined;
  }
}

function getErrorReason(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 160);
  }
  return 'channel_failed';
}

function buildMessageMetadata(
  msg: MessageRow,
): Record<string, any> | undefined {
  const metadata = msg.metadata_json
    ? (safeJsonParse<Record<string, any>>(msg.metadata_json) ?? {})
    : {};
  if (msg.source_url && !metadata.sourceUrl) {
    metadata.sourceUrl = msg.source_url;
  }
  if (msg.source_title && !metadata.sourceTitle) {
    metadata.sourceTitle = msg.source_title;
  }
  metadata.scope = normalizeStoredScope(msg.scope);
  if (msg.source && !metadata.source) {
    metadata.source = msg.source;
  }
  if (msg.sender && !metadata.sender) {
    metadata.sender = msg.sender;
  }
  if (msg.group_id) {
    if (!metadata.groupId) {
      metadata.groupId = msg.group_id;
    }
    if (!metadata.group_id) {
      metadata.group_id = msg.group_id;
    }
  }
  if (msg.group_name) {
    if (!metadata.groupName) {
      metadata.groupName = msg.group_name;
    }
    if (!metadata.group_name) {
      metadata.group_name = msg.group_name;
    }
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function getChunkMessageRefCandidates(chunk: ChunkRow): string[] {
  const candidates = new Set<string>();
  const add = (value: string | null | undefined): void => {
    const trimmed = value?.trim();
    if (trimmed) candidates.add(trimmed);
  };

  add(chunk.related_entity_id);

  const filePath = chunk.file_path.trim();
  if (filePath.startsWith('messages/')) {
    add(stripKnownChunkPathExtension(filePath.slice('messages/'.length)));
  }
  if (filePath.startsWith('calendar/')) {
    add(stripKnownChunkPathExtension(filePath.slice('calendar/'.length)));
  }

  return Array.from(candidates);
}

function getChunkSourceMemoryCapsuleId(chunk: ChunkRow): string | null {
  const sourceMatch = chunk.source
    ?.trim()
    .match(/^source-memory:([A-Za-z0-9][A-Za-z0-9._-]{0,127})$/i);
  if (sourceMatch?.[1]) return sourceMatch[1];

  const pathMatch = chunk.file_path
    .trim()
    .match(/^source-memory\/([A-Za-z0-9][A-Za-z0-9._-]{0,127})\.(?:md|txt|json)$/i);
  return pathMatch?.[1] ?? null;
}

function stripKnownChunkPathExtension(value: string): string {
  return value.replace(/\.(md|txt|json)$/i, '');
}

function normalizeStoredScope(
  scope: MemoryScope | null | undefined,
): MemoryScope {
  return scope === 'personal' ? 'personal' : 'work';
}

function normalizeRequestedScope(
  scope: RecallScope | undefined,
): MemoryScope | 'both' {
  if (scope === 'all') return 'both';
  return scope ?? 'work';
}

function matchesScope(
  storedScope: MemoryScope | null | undefined,
  queryScope: RecallScope | undefined,
): boolean {
  const requestedScope = normalizeRequestedScope(queryScope);
  if (requestedScope === 'both') {
    return true;
  }

  return normalizeStoredScope(storedScope) === requestedScope;
}

function getSpecificRequestedScope(
  scope: RecallScope | undefined,
): MemoryScope | undefined {
  const requestedScope = normalizeRequestedScope(scope);
  return requestedScope === 'both' ? undefined : requestedScope;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function matchesTextFilter(value: string | null, filters?: string[]): boolean {
  if (!filters || filters.length === 0) return true;
  if (!value) return false;

  const normalized = value.toLowerCase();
  return filters.some((filter) => normalized.includes(filter.toLowerCase()));
}

function normalizeProjectKey(value: string | null | undefined): string {
  if (!value) return '';
  const normalized = value.trim().toLowerCase();
  return toSlug(normalized) || normalized.replace(/\s+/g, ' ');
}

function matchesProjectFilter(
  projectFilter: string | undefined,
  rawProjectValues: string[],
): boolean {
  if (!projectFilter) return true;
  const normalizedFilter = normalizeProjectKey(projectFilter);
  if (!normalizedFilter) return true;

  return rawProjectValues.some(
    (value) => normalizeProjectKey(value) === normalizedFilter,
  );
}

function getRecallCandidateKey(candidate: RecallAccessTarget): string {
  return `${candidate.type}:${candidate.id}`;
}

// ---------------------------------------------------------------------------
// RecallEngine
// ---------------------------------------------------------------------------

export class RecallEngine {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Execute a multi-channel recall query and return MMR-reranked results.
   */
  async recall(
    query: RecallQuery,
    options: RecallOptions = {},
  ): Promise<RecallResult> {
    const startMs = Date.now();
    const topK = query.topK ?? DEFAULT_TOP_K;
    const activeChannels: RecallChannelName[] =
      query.channels ?? DEFAULT_CHANNELS;
    const skippedDiagnostics: RecallChannelDiagnostic[] = [];

    // Generate query embedding (needed for vector search and MMR diversity)
    let queryEmbedding: number[] | null = null;
    if (activeChannels.includes('vector')) {
      try {
        const allowEmbeddingColdStart = getRecallEmbeddingColdStartAllowed(
          options.allowEmbeddingColdStart,
        );
        if (!EmbeddingClient.isLoaded() && !allowEmbeddingColdStart) {
          skippedDiagnostics.push({
            channel: 'vector',
            status: 'skipped',
            candidateCount: 0,
            reason: 'embedding_unavailable',
          });
        } else {
          const embeddingTimeoutMs = getRecallEmbeddingTimeoutMs();
          const client = await withRecallTimeout(
            EmbeddingClient.getInstance(),
            embeddingTimeoutMs,
            'EmbeddingClient.getInstance',
          );
          queryEmbedding = await withRecallTimeout(
            client.embed(query.query),
            embeddingTimeoutMs,
            'EmbeddingClient.embed',
          );
        }
      } catch (err) {
        console.warn(
          '[RecallEngine] Embedding generation failed, skipping vector channel:',
          err,
        );
        skippedDiagnostics.push({
          channel: 'vector',
          status: 'skipped',
          candidateCount: 0,
          reason: 'embedding_unavailable',
        });
      }
    }

    // Run channels in parallel
    const channelPromises: Promise<{
      channel: RecallChannelName;
      candidates: RecallCandidate[];
      diagnostic: RecallChannelDiagnostic;
    }>[] = [];

    const fetchLimit = topK * VEC_OVER_FETCH_FACTOR;

    if (activeChannels.includes('vector') && queryEmbedding) {
      channelPromises.push(
        this.runChannel('vector', () =>
          this.vectorSearch(queryEmbedding!, fetchLimit, query),
        ),
      );
    }

    if (activeChannels.includes('fts')) {
      channelPromises.push(
        this.runChannel('fts', () =>
          this.ftsSearch(query.query, fetchLimit, query),
        ),
      );
    }

    if (activeChannels.includes('graph')) {
      channelPromises.push(
        this.runChannel('graph', () =>
          this.graphSearch(query.query, fetchLimit, query),
        ),
      );
    }

    if (activeChannels.includes('time')) {
      channelPromises.push(
        this.runChannel('time', () =>
          this.timeWindowSearch(query.query, fetchLimit, query),
        ),
      );
    }

    const channelResults = await Promise.all(channelPromises);
    const channelDiagnostics = [
      ...skippedDiagnostics,
      ...channelResults.map((result) => result.diagnostic),
    ].sort(
      (a, b) =>
        (CHANNEL_ORDER.get(a.channel) ?? 99) -
        (CHANNEL_ORDER.get(b.channel) ?? 99),
    );
    const usedChannels = channelDiagnostics
      .filter((diagnostic) => diagnostic.status === 'hit')
      .map((diagnostic) => diagnostic.channel);

    // Merge and deduplicate
    const merged = this.mergeAndDeduplicate(
      channelResults.flatMap((result) => result.candidates),
    );

    if (merged.length === 0) {
      return {
        items: [],
        totalFound: 0,
        queryTimeMs: Date.now() - startMs,
        channels: usedChannels,
        channelDiagnostics,
        scopeReceipt: buildRecallScopeReceipt({
          scope: query.scope,
          returnedItems: [],
          candidateItems: [],
        }),
      };
    }

    // Enrich with lifecycle metadata and suppress archived/forgotten items
    // before ranking so every caller gets the same ambient forgetting behavior.
    this.enrichWithLifecycle(
      merged,
      query.lifecycleMode ?? 'active_default',
    );
    const lifecycleFiltered = merged.filter(
      (c) => c.lifecycleAllowed !== false,
    );

    // Apply optional salience filter
    const filtered =
      query.minSalience != null
        ? lifecycleFiltered.filter(
            (c) =>
              (c.effectiveSalience ?? c.salienceScore ?? 0) >=
              query.minSalience!,
          )
        : lifecycleFiltered;

    // MMR reranking (P0-4: nudged by behavioral-intimacy affinity)
    const affinityMap = this.loadAffinityMap();
    const ranked = this.mmrRerank(filtered, topK, affinityMap);

    // Build final RecallItems
    const items: RecallItem[] = ranked.map((c) => {
      const presentation = buildRecallPresentation({
        content: c.content,
        query: query.query,
        source: c.source,
        sourceTitle: c.sourceTitle,
        presentationHint: query.presentationHint,
        previewMaxLength: query.previewMaxLength,
      });
      const conversationId =
        (c.metadata?.conversationId as string | undefined) ||
        (c.metadata?.conversation_id as string | undefined);
      const exploreLink = buildExploreLink({
        type: c.type,
        id: c.id,
        conversationId,
        entityType: c.entity?.type,
        entity: c.entity,
      });
      const item: RecallItem = {
        id: c.id,
        type: c.type,
        content: c.content,
        scope: c.metadata?.scope as MemoryScope | undefined,
        displayTitle: presentation.displayTitle,
        displayText: presentation.displayText,
        previewText: presentation.previewText,
        score: c.score,
        source: c.source,
        sourceUrl: c.sourceUrl,
        sourceTitle: c.sourceTitle,
        exploreLink,
        timestamp: c.timestamp,
        entity: c.entity,
      };
      if (query.includeMetadata) {
        const recallFeedback = getRecallFeedbackAction(this.db, c.type, c.id);
        item.metadata = {
          ...(c.metadata ?? {}),
          channels: c.channels,
          recencyScore: c.recencyScore,
          salienceScore: c.salienceScore,
          effectiveSalience: c.effectiveSalience,
          retrievalTier: c.retrievalTier,
          lifecycleWeight: c.lifecycleWeight,
          lifecycleReason: c.lifecycleReason,
        };
        if (recallFeedback) {
          item.metadata.recallFeedback = recallFeedback;
        }
      }
      return item;
    });

    // Reinforce accessed memories (fire-and-forget)
    const accessTargets = ranked
      .filter((candidate) => candidate.retrievalTier !== 'archive_only')
      .filter((candidate) => candidate.retrievalTier !== 'forgotten')
      .map((candidate) => ({
        id: candidate.id,
        type: candidate.type,
      }));
    if (options.reinforceAccess ?? true) {
      this.reinforceAccessedMemories(accessTargets);
    }

    return {
      items,
      totalFound: lifecycleFiltered.length,
      queryTimeMs: Date.now() - startMs,
      channels: usedChannels,
      channelDiagnostics,
      scopeReceipt: buildRecallScopeReceipt({
        scope: query.scope,
        returnedItems: ranked,
        candidateItems: filtered,
      }),
    };
  }

  private async runChannel(
    channel: RecallChannelName,
    search: () => Promise<RecallCandidate[]>,
  ): Promise<{
    channel: RecallChannelName;
    candidates: RecallCandidate[];
    diagnostic: RecallChannelDiagnostic;
  }> {
    try {
      const candidates = await search();
      return {
        channel,
        candidates,
        diagnostic: {
          channel,
          status: candidates.length > 0 ? 'hit' : 'empty',
          candidateCount: candidates.length,
        },
      };
    } catch (err) {
      console.warn(`[RecallEngine] ${channel} channel failed:`, err);
      return {
        channel,
        candidates: [],
        diagnostic: {
          channel,
          status: 'failed',
          candidateCount: 0,
          reason: getErrorReason(err),
        },
      };
    }
  }

  // =========================================================================
  // Channel 1: Vector Search
  // =========================================================================

  private async vectorSearch(
    queryEmbedding: number[],
    limit: number,
    query: RecallQuery,
  ): Promise<RecallCandidate[]> {
    const candidates: RecallCandidate[] = [];
    const embJson = JSON.stringify(queryEmbedding);

    // --- Search messages_vec ---
    try {
      const msgVecRows = this.db
        .prepare(
          `SELECT message_id, distance
           FROM messages_vec
           WHERE embedding MATCH ?
           ORDER BY distance
           LIMIT ?`,
        )
        .all(embJson, limit) as Array<{ message_id: string; distance: number }>;

      if (msgVecRows.length > 0) {
        const ids = msgVecRows.map((r) => r.message_id);
        const ph = ids.map(() => '?').join(', ');
        const msgs = this.db
          .prepare(
            `SELECT id, content, scope, source, source_type, timestamp, sender, group_id, group_name,
                    source_url, source_title,
                    matched_projects_json,
                    metadata_json, importance, entities_json
             FROM messages_raw
             WHERE id IN (${ph})`,
          )
          .all(...ids) as MessageRow[];

        const msgMap = new Map(msgs.map((m) => [m.id, m]));

        for (const row of msgVecRows) {
          const msg = msgMap.get(row.message_id);
          if (!msg) continue;
          if (!this.passesFilters(msg, query)) continue;

          const score = 1 / (1 + row.distance);
          candidates.push({
            id: msg.id,
            type: 'message',
            content: msg.content,
            score,
            timestamp: msg.timestamp,
            source: msg.source_type,
            sourceUrl: msg.source_url ?? undefined,
            sourceTitle: msg.source_title ?? undefined,
            channels: ['vector'],
            metadata: buildMessageMetadata(msg),
          });
        }
      }
    } catch (err) {
      console.warn('[RecallEngine] messages_vec search failed:', err);
    }

    // --- Search chunks_vec ---
    try {
      const chunkVecRows = this.db
        .prepare(
          `SELECT chunk_id, distance
           FROM chunks_vec
           WHERE embedding MATCH ?
           ORDER BY distance
           LIMIT ?`,
        )
        .all(embJson, limit) as Array<{ chunk_id: number; distance: number }>;

      if (chunkVecRows.length > 0) {
        const chunkIds = chunkVecRows.map((r) => r.chunk_id);
        const ph = chunkIds.map(() => '?').join(', ');
        const chunks = this.db
          .prepare(
            `SELECT chunk_id, content, file_path, scope, source, source_type,
                    related_project, related_entity_id, created_at
             FROM chunks
             WHERE chunk_id IN (${ph})`,
          )
          .all(...chunkIds) as ChunkRow[];

        const chunkMap = new Map(chunks.map((c) => [c.chunk_id, c]));

        for (const row of chunkVecRows) {
          const chunk = chunkMap.get(row.chunk_id);
          if (!chunk) continue;

          if (!matchesScope(chunk.scope, query.scope)) continue;
          if (
            !matchesProjectFilter(query.projectFilter, [
              chunk.related_project ?? '',
            ])
          )
            continue;
          if (query.sourceTypes?.length && !chunk.source_type) continue;
          if (
            query.sourceTypes?.length &&
            !query.sourceTypes.includes(chunk.source_type!)
          )
            continue;

          const score = 1 / (1 + row.distance);
          const sourceRef = this.resolveChunkSourceRef(chunk);
          candidates.push({
            id: String(chunk.chunk_id),
            type: 'chunk',
            content: chunk.content,
            score,
            timestamp: chunk.created_at,
            source: chunk.source_type ?? undefined,
            sourceUrl: sourceRef.sourceUrl,
            sourceTitle: sourceRef.sourceTitle,
            channels: ['vector'],
            metadata: {
              ...(sourceRef.metadata ?? {}),
              filePath: chunk.file_path,
              scope: normalizeStoredScope(chunk.scope),
              source: chunk.source ?? undefined,
              relatedProject: chunk.related_project,
            },
          });
        }
      }
    } catch (err) {
      console.warn('[RecallEngine] chunks_vec search failed:', err);
    }

    return candidates;
  }

  // =========================================================================
  // Channel 2: FTS5 Full-Text Search
  // =========================================================================

  private async ftsSearch(
    queryText: string,
    limit: number,
    query: RecallQuery,
  ): Promise<RecallCandidate[]> {
    const candidates: RecallCandidate[] = [];
    const ftsQuery = sanitizeFtsQuery(queryText);
    if (!ftsQuery) return candidates;

    try {
      const ftsRows = this.db
        .prepare(
          `SELECT rowid, rank
           FROM chunks_fts
           WHERE chunks_fts MATCH ?
           ORDER BY rank
           LIMIT ?`,
        )
        .all(ftsQuery, limit) as FtsRow[];

      if (ftsRows.length === 0) return candidates;

      const chunkIds = ftsRows.map((r) => r.rowid);
      const ph = chunkIds.map(() => '?').join(', ');
      const chunks = this.db
        .prepare(
          `SELECT chunk_id, content, file_path, scope, source, source_type,
                  related_project, related_entity_id, created_at
           FROM chunks
           WHERE chunk_id IN (${ph})`,
        )
        .all(...chunkIds) as ChunkRow[];

      const chunkMap = new Map(chunks.map((c) => [c.chunk_id, c]));

      // FTS5 rank is negative (more negative = better), convert to positive 0..1
      const maxAbsRank = Math.max(...ftsRows.map((r) => Math.abs(r.rank)), 1);

      for (const row of ftsRows) {
        const chunk = chunkMap.get(row.rowid);
        if (!chunk) continue;

        if (!matchesScope(chunk.scope, query.scope)) continue;
        if (
          !matchesProjectFilter(query.projectFilter, [
            chunk.related_project ?? '',
          ])
        )
          continue;
        if (query.sourceTypes?.length && !chunk.source_type) continue;
        if (
          query.sourceTypes?.length &&
          !query.sourceTypes.includes(chunk.source_type!)
        )
          continue;

        // Normalize: best rank -> score ~1, worst -> score ~0
        const score = Math.abs(row.rank) / maxAbsRank;
        const sourceRef = this.resolveChunkSourceRef(chunk);

        candidates.push({
          id: String(chunk.chunk_id),
          type: 'chunk',
          content: chunk.content,
          score,
          timestamp: chunk.created_at,
          source: chunk.source_type ?? undefined,
          sourceUrl: sourceRef.sourceUrl,
          sourceTitle: sourceRef.sourceTitle,
          channels: ['fts'],
          metadata: {
            ...(sourceRef.metadata ?? {}),
            filePath: chunk.file_path,
            scope: normalizeStoredScope(chunk.scope),
            source: chunk.source ?? undefined,
            relatedProject: chunk.related_project,
          },
        });
      }
    } catch (err) {
      console.warn('[RecallEngine] FTS5 search failed:', err);
    }

    return candidates;
  }

  private resolveChunkSourceRef(
    chunk: ChunkRow,
  ): {
    sourceUrl?: string;
    sourceTitle?: string;
    metadata?: Record<string, any>;
  } {
    const messageIds = getChunkMessageRefCandidates(chunk);
    let messageSourceRef: {
      sourceUrl?: string;
      sourceTitle?: string;
      metadata?: Record<string, any>;
    } | null = null;
    if (messageIds.length > 0) {
      try {
        const placeholders = messageIds.map(() => '?').join(', ');
        const rows = this.db
          .prepare(
            `SELECT id, source_url, source_title, group_id, group_name, metadata_json
             FROM messages_raw
             WHERE id IN (${placeholders})`,
          )
          .all(...messageIds) as Array<{
          id: string;
          source_url: string | null;
          source_title: string | null;
          group_id: string | null;
          group_name: string | null;
          metadata_json: string | null;
        }>;
        const byId = new Map(rows.map((row) => [row.id, row]));
        for (const id of messageIds) {
          const row = byId.get(id);
          if (!row) continue;
          const metadata = row.metadata_json
            ? (safeJsonParse<Record<string, any>>(row.metadata_json) ?? {})
            : {};
          if (row.group_id) {
            metadata.groupId = metadata.groupId ?? row.group_id;
            metadata.group_id = metadata.group_id ?? row.group_id;
          }
          if (row.group_name) {
            metadata.groupName = metadata.groupName ?? row.group_name;
            metadata.group_name = metadata.group_name ?? row.group_name;
          }
          messageSourceRef = {
            sourceUrl: row.source_url ?? undefined,
            sourceTitle: row.source_title ?? undefined,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          };
          break;
        }
      } catch {
        // Legacy Source Memory chunks can outlive their linked message row.
        // Fall through to the capsule lookup below instead of dropping provenance.
      }
    }

    const sourceMemoryCapsuleId = getChunkSourceMemoryCapsuleId(chunk);
    if (!sourceMemoryCapsuleId) return messageSourceRef ?? {};

    try {
      const row = this.db
        .prepare(
          `SELECT source_url, source_title, source_kind, capture_mode
           FROM source_memory_capsules
           WHERE id = ? AND status = 'saved'
           LIMIT 1`,
        )
        .get(sourceMemoryCapsuleId) as
        | {
            source_url: string | null;
            source_title: string | null;
            source_kind: string | null;
            capture_mode: string | null;
          }
        | undefined;
      if (!row) return messageSourceRef ?? {};

      const metadata = {
        ...(messageSourceRef?.metadata ?? {}),
      };
      metadata.sourceMemoryCapsuleId = sourceMemoryCapsuleId;
      if (row.source_kind) {
        metadata.sourceKind = metadata.sourceKind ?? row.source_kind;
      }
      if (row.capture_mode) {
        metadata.captureMode = metadata.captureMode ?? row.capture_mode;
      }
      return {
        sourceUrl: messageSourceRef?.sourceUrl ?? row.source_url ?? undefined,
        sourceTitle:
          messageSourceRef?.sourceTitle ?? row.source_title ?? undefined,
        metadata,
      };
    } catch {
      return messageSourceRef ?? {};
    }
  }

  // =========================================================================
  // Channel 3: Knowledge Graph Search
  // =========================================================================

  private async graphSearch(
    queryText: string,
    limit: number,
    query: RecallQuery,
  ): Promise<RecallCandidate[]> {
    // P0-3: Personalized PageRank associative recall (HippoRAG-style). Gated by
    // config so it can be reverted to the legacy hop-walk; PPR failures fall
    // back to hops automatically.
    const algorithm = getConfig().recallGraphAlgorithm;
    if (algorithm === 'ppr') {
      try {
        const ppr = await this.graphSearchPpr(queryText, limit, query);
        if (ppr) return ppr;
      } catch (err) {
        console.warn('[RecallEngine] PPR graph search failed, falling back to hops:', err);
      }
    }
    return this.graphSearchHops(queryText, limit, query);
  }

  /**
   * PPR-based graph recall: seed on query-matched entities, run Personalized
   * PageRank over a bounded subgraph, surface the highest-activation entities
   * (and the messages that mention seeds + top entities). Returns null to defer
   * to the hop-walk when there is no usable graph (no seeds / no edges).
   */
  private async graphSearchPpr(
    queryText: string,
    limit: number,
    query: RecallQuery,
  ): Promise<RecallCandidate[] | null> {
    const config = getConfig();
    const maxNodes = config.recallGraphPprMaxNodes;
    const maxHops = config.recallGraphPprMaxHops;

    const seeds = this.findMatchingEntities(queryText, query.entityTypes)
      .map((entity) => ({ entity, evidence: this.getEntityEvidenceMatch(entity.id, query) }))
      .filter(({ evidence }) => evidence.matches);
    if (seeds.length === 0) return null;

    const seedIds = seeds.map(({ entity }) => entity.id);
    const candidates: RecallCandidate[] = [];

    // Seeds are always candidates (same as the hop-walk).
    for (const { entity: ent, evidence } of seeds) {
      candidates.push({
        id: ent.id,
        type: 'entity',
        content: ent.description || `${ent.type}: ${ent.name}`,
        score: ent.importance,
        timestamp: ent.lastSeen,
        channels: ['graph'],
        entity: ent,
        metadata: { ...(evidence.metadata ?? {}), graphAlgorithm: 'ppr', isSeed: true },
      });
    }

    // BFS-expand a bounded subgraph around the seeds, collecting weighted edges.
    const edges: PprEdge[] = [];
    const visited = new Set<string>(seedIds);
    let frontier = [...seedIds];
    for (let hop = 0; hop < maxHops && frontier.length > 0 && visited.size < maxNodes; hop++) {
      const ph = frontier.map(() => '?').join(', ');
      const rels = this.db
        .prepare(
          `SELECT id, from_entity_id, to_entity_id, relation_type, strength,
                  co_occurrence_count, context
           FROM relationships
           WHERE from_entity_id IN (${ph}) OR to_entity_id IN (${ph})`,
        )
        .all(...frontier, ...frontier) as RelationshipRow[];

      const next = new Set<string>();
      for (const rel of rels) {
        const w = Math.max(0.05, rel.strength) * Math.log(1 + (rel.co_occurrence_count || 1));
        // Undirected approximation.
        edges.push({ from: rel.from_entity_id, to: rel.to_entity_id, weight: w });
        edges.push({ from: rel.to_entity_id, to: rel.from_entity_id, weight: w });
        for (const id of [rel.from_entity_id, rel.to_entity_id]) {
          if (!visited.has(id) && visited.size < maxNodes) {
            visited.add(id);
            next.add(id);
          }
        }
      }
      frontier = [...next];
    }

    if (edges.length === 0) return null; // no graph structure — defer to hops

    // Restart on seeds, down-weighting generic (high-mention) seed entities.
    const seedWeights = new Map<string, number>();
    const specificity = new Map<string, number>();
    for (const { entity } of seeds) {
      seedWeights.set(entity.id, 1);
      specificity.set(entity.id, 1 / Math.log(2 + (entity.mentionCount || 0)));
    }

    const pageRank = runPersonalizedPageRank(edges, seedWeights, {
      nodeSpecificity: specificity,
    });

    // Rank non-seed entities by activation.
    const seedIdSet = new Set(seedIds);
    const ranked = [...pageRank.entries()]
      .filter(([id]) => !seedIdSet.has(id))
      .sort((a, b) => b[1] - a[1]);
    const maxPpr = ranked.length > 0 ? ranked[0][1] : 0;

    const topEntityIds: string[] = [];
    for (const [entityId, score] of ranked) {
      if (topEntityIds.length >= limit) break;
      if (score <= 0) break;
      const relEnt = this.loadEntity(entityId);
      if (!relEnt) continue;
      const evidence = this.getEntityEvidenceMatch(relEnt.id, query);
      if (!evidence.matches) continue;
      topEntityIds.push(entityId);
      candidates.push({
        id: relEnt.id,
        type: 'entity',
        content: relEnt.description || `${relEnt.type}: ${relEnt.name}`,
        score: maxPpr > 0 ? score / maxPpr : 0,
        timestamp: relEnt.lastSeen,
        channels: ['graph'],
        entity: relEnt,
        metadata: {
          ...(evidence.metadata ?? {}),
          graphAlgorithm: 'ppr',
          pprScore: Number(score.toFixed(6)),
        },
      });
    }

    // Surface messages mentioning seeds + top PPR entities (the real evidence).
    const mentionEntityIds = [...seedIds, ...topEntityIds];
    this.appendEntityMentionMessages(mentionEntityIds, limit, query, candidates);

    return candidates.slice(0, limit);
  }

  /** Append messages mentioning the given entities to the candidate list. */
  private appendEntityMentionMessages(
    entityIds: string[],
    limit: number,
    query: RecallQuery,
    candidates: RecallCandidate[],
  ): void {
    if (entityIds.length === 0) return;
    const perEntity = Math.max(1, Math.ceil(limit / entityIds.length));
    for (const entId of entityIds) {
      try {
        const mentionMsgs = this.db
          .prepare(
            `SELECT id, content, scope, source, source_type, timestamp, sender, group_id, group_name,
                    source_url, source_title,
                    matched_projects_json,
                    metadata_json, importance, entities_json
             FROM messages_raw
             WHERE entities_json LIKE ? ESCAPE '\\'
             ORDER BY timestamp DESC
             LIMIT ?`,
          )
          .all(`%"${escapeLikePattern(entId)}"%`, perEntity) as MessageRow[];
        for (const msg of mentionMsgs) {
          if (!this.passesFilters(msg, query)) continue;
          candidates.push({
            id: msg.id,
            type: 'message',
            content: msg.content,
            score: msg.importance * 0.8,
            timestamp: msg.timestamp,
            source: msg.source_type,
            sourceUrl: msg.source_url ?? undefined,
            sourceTitle: msg.source_title ?? undefined,
            channels: ['graph'],
            metadata: buildMessageMetadata(msg),
          });
        }
      } catch {
        // Skip individual entity search failures.
      }
    }
  }

  private async graphSearchHops(
    queryText: string,
    limit: number,
    query: RecallQuery,
  ): Promise<RecallCandidate[]> {
    const candidates: RecallCandidate[] = [];

    try {
      // Step 1: Find matching entities via keyword matching
      const matchedEntities = this.findMatchingEntities(
        queryText,
        query.entityTypes,
      )
        .map((entity) => ({
          entity,
          evidence: this.getEntityEvidenceMatch(entity.id, query),
        }))
        .filter(({ evidence }) => evidence.matches);
      if (matchedEntities.length === 0) return candidates;

      const entityIds = matchedEntities.map(({ entity }) => entity.id);

      // Add entities themselves as candidates
      for (const { entity: ent, evidence } of matchedEntities) {
        candidates.push({
          id: ent.id,
          type: 'entity',
          content: ent.description || `${ent.type}: ${ent.name}`,
          score: ent.importance,
          timestamp: ent.lastSeen,
          channels: ['graph'],
          entity: ent,
          metadata: evidence.metadata,
        });
      }

      // Step 2: 1-hop relationships
      const oneHopEntityIds = new Set<string>();
      if (entityIds.length > 0) {
        const ph = entityIds.map(() => '?').join(', ');
        const rels = this.db
          .prepare(
            `SELECT id, from_entity_id, to_entity_id, relation_type, strength,
                    co_occurrence_count, context
             FROM relationships
             WHERE from_entity_id IN (${ph}) OR to_entity_id IN (${ph})`,
          )
          .all(...entityIds, ...entityIds) as RelationshipRow[];

        for (const rel of rels) {
          const otherEntityId = entityIds.includes(rel.from_entity_id)
            ? rel.to_entity_id
            : rel.from_entity_id;
          oneHopEntityIds.add(otherEntityId);

          // Load the related entity
          const relEnt = this.loadEntity(otherEntityId);
          const evidence = relEnt
            ? this.getEntityEvidenceMatch(relEnt.id, query)
            : undefined;
          if (relEnt && evidence?.matches) {
            candidates.push({
              id: relEnt.id,
              type: 'entity',
              content: relEnt.description || `${relEnt.type}: ${relEnt.name}`,
              score: rel.strength,
              timestamp: relEnt.lastSeen,
              channels: ['graph'],
              entity: relEnt,
              metadata: {
                ...(evidence.metadata ?? {}),
                relationType: rel.relation_type,
                hopDistance: 1,
                relationshipStrength: rel.strength,
              },
            });
          }
        }
      }

      // Step 3: 2-hop relationships
      const oneHopIds = Array.from(oneHopEntityIds).filter(
        (id) => !entityIds.includes(id),
      );
      if (oneHopIds.length > 0) {
        const ph = oneHopIds.map(() => '?').join(', ');
        const rels2 = this.db
          .prepare(
            `SELECT id, from_entity_id, to_entity_id, relation_type, strength,
                    co_occurrence_count, context
             FROM relationships
             WHERE (from_entity_id IN (${ph}) OR to_entity_id IN (${ph}))
             LIMIT ?`,
          )
          .all(...oneHopIds, ...oneHopIds, limit) as RelationshipRow[];

        for (const rel of rels2) {
          const otherEntityId = oneHopIds.includes(rel.from_entity_id)
            ? rel.to_entity_id
            : rel.from_entity_id;

          // Skip if already included as a seed or 1-hop entity
          if (
            entityIds.includes(otherEntityId) ||
            oneHopEntityIds.has(otherEntityId)
          )
            continue;

          const relEnt = this.loadEntity(otherEntityId);
          const evidence = relEnt
            ? this.getEntityEvidenceMatch(relEnt.id, query)
            : undefined;
          if (relEnt && evidence?.matches) {
            candidates.push({
              id: relEnt.id,
              type: 'entity',
              content: relEnt.description || `${relEnt.type}: ${relEnt.name}`,
              score: rel.strength * 0.5, // 2-hop penalty
              timestamp: relEnt.lastSeen,
              channels: ['graph'],
              entity: relEnt,
              metadata: {
                ...(evidence.metadata ?? {}),
                relationType: rel.relation_type,
                hopDistance: 2,
                relationshipStrength: rel.strength,
              },
            });
          }
        }
      }

      // Step 4: Find messages mentioning matched entities
      for (const entId of entityIds) {
        try {
          const mentionMsgs = this.db
            .prepare(
              `SELECT id, content, scope, source, source_type, timestamp, sender, group_id, group_name,
                      source_url, source_title,
                      matched_projects_json,
                      metadata_json, importance, entities_json
               FROM messages_raw
               WHERE entities_json LIKE ? ESCAPE '\\'
               ORDER BY timestamp DESC
               LIMIT ?`,
            )
            .all(
              `%"${escapeLikePattern(entId)}"%`,
              Math.ceil(limit / entityIds.length),
            ) as MessageRow[];

          for (const msg of mentionMsgs) {
            if (!this.passesFilters(msg, query)) continue;

            candidates.push({
              id: msg.id,
              type: 'message',
              content: msg.content,
              score: msg.importance * 0.8, // slightly discount graph-sourced messages
              timestamp: msg.timestamp,
              source: msg.source_type,
              sourceUrl: msg.source_url ?? undefined,
              sourceTitle: msg.source_title ?? undefined,
              channels: ['graph'],
              metadata: buildMessageMetadata(msg),
            });
          }
        } catch {
          // Skip individual entity search failures
        }
      }
    } catch (err) {
      console.warn('[RecallEngine] Graph search failed:', err);
    }

    return candidates.slice(0, limit);
  }

  // =========================================================================
  // Channel 4: Time Window Search
  // =========================================================================

  private async timeWindowSearch(
    queryText: string,
    limit: number,
    query: RecallQuery,
  ): Promise<RecallCandidate[]> {
    const candidates: RecallCandidate[] = [];

    // Use explicit time range from query, or parse from query text
    const range =
      query.timeRange?.start != null || query.timeRange?.end != null
        ? {
            start: query.timeRange!.start ?? 0,
            end: query.timeRange!.end ?? now(),
          }
        : parseQueryTimeRange(queryText);

    if (!range) return candidates;

    try {
      const msgs = this.db
        .prepare(
          `SELECT id, content, scope, source, source_type, timestamp, sender, group_id, group_name,
                  source_url, source_title,
                  matched_projects_json,
                  metadata_json, importance, entities_json
           FROM messages_raw
           WHERE timestamp BETWEEN ? AND ?
           ORDER BY timestamp DESC
           LIMIT ?`,
        )
        .all(range.start, range.end, limit) as MessageRow[];

      if (msgs.length === 0) return candidates;

      // Score based on recency within the window
      const windowSpan = Math.max(range.end - range.start, 1);

      for (const msg of msgs) {
        if (!this.passesFilters(msg, query)) continue;

        // More recent within the window -> higher score
        const recencyInWindow = (msg.timestamp - range.start) / windowSpan;
        const score = 0.5 + 0.5 * recencyInWindow; // range [0.5, 1.0]

        candidates.push({
          id: msg.id,
          type: 'message',
          content: msg.content,
          score,
          timestamp: msg.timestamp,
          source: msg.source_type,
          sourceUrl: msg.source_url ?? undefined,
          sourceTitle: msg.source_title ?? undefined,
          channels: ['time'],
          metadata: buildMessageMetadata(msg),
          recencyScore: recencyInWindow,
        });
      }
    } catch (err) {
      console.warn('[RecallEngine] Time window search failed:', err);
    }

    return candidates;
  }

  // =========================================================================
  // Merge, Deduplicate, Enrich
  // =========================================================================

  /**
   * Merge candidates from all channels. When duplicates exist (same type + id),
   * keep the highest score and accumulate channel attributions.
   */
  private mergeAndDeduplicate(
    candidates: RecallCandidate[],
  ): RecallCandidate[] {
    const map = new Map<string, RecallCandidate>();

    for (const c of candidates) {
      const candidateKey = getRecallCandidateKey(c);
      const existing = map.get(candidateKey);
      if (!existing) {
        map.set(candidateKey, { ...c, channels: [...c.channels] });
      } else {
        // Merge channels
        for (const ch of c.channels) {
          if (!existing.channels.includes(ch)) {
            existing.channels.push(ch);
          }
        }
        // Boost score slightly for multi-channel hits
        if (c.score > existing.score) {
          existing.score = c.score;
        }
        // Give a bonus for appearing in multiple channels
        existing.score = Math.min(
          1.0,
          existing.score + 0.05 * (existing.channels.length - 1),
        );
        // Preserve embedding if newly available
        if (c.embedding && !existing.embedding) {
          existing.embedding = c.embedding;
        }
        // Preserve entity if available
        if (c.entity && !existing.entity) {
          existing.entity = c.entity;
        }
        // Keep best recencyScore
        if (
          c.recencyScore != null &&
          (existing.recencyScore == null ||
            c.recencyScore > existing.recencyScore)
        ) {
          existing.recencyScore = c.recencyScore;
        }
      }
    }

    return Array.from(map.values());
  }

  /**
   * Enrich candidates with lifecycle metadata from memory_metadata.
   */
  private enrichWithLifecycle(
    candidates: RecallCandidate[],
    lifecycleMode: RecallLifecycleMode,
  ): void {
    const currentTime = now();
    const maxAge = 30 * 86400; // 30 days as normalization window

    for (const c of candidates) {
      if (c.timestamp != null && c.recencyScore == null) {
        const age = Math.max(currentTime - c.timestamp, 0);
        c.recencyScore = Math.max(0, 1 - age / maxAge);
      }
    }

    const metadataByKey = this.loadLifecycleMetadata(candidates);
    const feedbackByKey = this.loadRecallFeedback(candidates);

    for (const c of candidates) {
      const key = getRecallCandidateKey(c);
      const meta = metadataByKey.get(key);
      const feedback = feedbackByKey.get(key);
      if (meta) {
        c.salienceScore = meta.salience_score;
      }

      const decision = decideMemoryLifecycle(
        {
          salienceScore: meta?.salience_score,
          effectiveSalience: meta?.effective_salience,
          retrievalTier: meta?.retrieval_tier,
          consolidationLevel: meta?.consolidation_level,
          lastAccessed: meta?.last_accessed,
          createdAt: meta?.created_at ?? c.timestamp,
          timestamp: c.timestamp,
          feedbackAction: feedback?.action,
          feedbackUpdatedAt: feedback?.updated_at,
          currentTime,
        },
        lifecycleMode,
      );

      c.retrievalTier = decision.tier;
      c.effectiveSalience = decision.effectiveSalience;
      c.lifecycleWeight = decision.weight;
      c.lifecycleReason = decision.reason;
      c.lifecycleAllowed = decision.allowed;
    }
  }

  private loadLifecycleMetadata(
    candidates: RecallCandidate[],
  ): Map<string, MemoryMetaRow> {
    const result = new Map<string, MemoryMetaRow>();
    const grouped = this.groupCandidateIdsByType(candidates);

    try {
      for (const [type, ids] of grouped) {
        if (ids.length === 0) continue;
        const placeholders = ids.map(() => '?').join(',');
        const rows = this.db
          .prepare(
            `SELECT target_type, target_id, salience_score, access_count,
                    retrieval_tier, effective_salience, consolidation_level,
                    last_accessed, created_at, updated_at
             FROM memory_metadata
             WHERE target_type = ? AND target_id IN (${placeholders})`,
          )
          .all(type, ...ids) as MemoryMetaRow[];
        for (const row of rows) {
          result.set(`${row.target_type}:${row.target_id}`, row);
        }
      }
    } catch {
      // Older databases without lifecycle columns fall back to virtual tiers.
    }

    return result;
  }

  private loadRecallFeedback(
    candidates: RecallCandidate[],
  ): Map<string, MemoryFeedbackRow> {
    const result = new Map<string, MemoryFeedbackRow>();
    const grouped = this.groupCandidateIdsByType(candidates);

    try {
      for (const [type, ids] of grouped) {
        if (ids.length === 0) continue;
        const placeholders = ids.map(() => '?').join(',');
        const rows = this.db
          .prepare(
            `SELECT target_type, target_id, action, detail, updated_at
             FROM memory_feedback_events
             WHERE feedback_type = 'recall_quality'
               AND target_type = ?
               AND target_id IN (${placeholders})`,
          )
          .all(type, ...ids) as MemoryFeedbackRow[];
        for (const row of rows) {
          if (
            row.action === 'negative' &&
            isSceneScopedRecallFeedbackDetail(row.detail)
          ) {
            continue;
          }
          result.set(`${row.target_type}:${row.target_id}`, row);
        }
      }
    } catch {
      // Feedback is optional for recall.
    }

    return result;
  }

  private groupCandidateIdsByType(
    candidates: RecallCandidate[],
  ): Map<RecallCandidate['type'], string[]> {
    const grouped = new Map<RecallCandidate['type'], Set<string>>();
    for (const candidate of candidates) {
      const values = grouped.get(candidate.type) ?? new Set<string>();
      values.add(candidate.id);
      grouped.set(candidate.type, values);
    }

    return new Map(
      Array.from(grouped.entries()).map(([type, ids]) => [
        type,
        Array.from(ids),
      ]),
    );
  }

  // =========================================================================
  // MMR Reranking
  // =========================================================================

  /**
   * Apply Maximal Marginal Relevance to balance relevance and diversity.
   *
   * MMR_score = lambda * relevance - (1 - lambda) * max_similarity_to_selected
   */
  /**
   * Load the behavioral-intimacy affinity map for the current user (P0-4).
   * Returns an empty map when disabled or unavailable — recall then behaves
   * exactly as before.
   */
  private loadAffinityMap(): Map<string, number> {
    if (!getConfig().recallAffinityEnabled) return new Map();
    try {
      return new BehaviorAffinityService(this.db).getAffinityMap();
    } catch {
      return new Map();
    }
  }

  /** Affinity for a candidate: entity items by id, others by source type. */
  private affinityForCandidate(
    c: RecallCandidate,
    affinityMap: Map<string, number>,
  ): number {
    if (affinityMap.size === 0) return 0;
    if (c.type === 'entity') return affinityMap.get(`entity:${c.id}`) ?? 0;
    if (c.source) return affinityMap.get(`source:${c.source}`) ?? 0;
    return 0;
  }

  private mmrRerank(
    candidates: RecallCandidate[],
    topK: number,
    affinityMap: Map<string, number> = new Map(),
  ): RecallCandidate[] {
    if (candidates.length <= 1) return candidates;

    const affinityWeight = getConfig().recallAffinityWeight;

    // Compute composite relevance for each candidate
    const relevanceMap = new Map<string, number>();
    for (const c of candidates) {
      const candidateKey = getRecallCandidateKey(c);
      const recency = c.recencyScore ?? 0;
      const salience = c.effectiveSalience ?? c.salienceScore ?? 0;
      const lifecycleWeight = c.lifecycleWeight ?? 1;
      const affinity = this.affinityForCandidate(c, affinityMap);
      const relevance =
        (c.score +
          RECENCY_WEIGHT * recency +
          SALIENCE_WEIGHT * salience +
          affinityWeight * affinity) *
        lifecycleWeight;
      relevanceMap.set(candidateKey, relevance);
    }

    const selected: RecallCandidate[] = [];
    const remaining = new Set(candidates.map(getRecallCandidateKey));
    const candidateMap = new Map(
      candidates.map((c) => [getRecallCandidateKey(c), c]),
    );
    const textTokenCache = new Map<string, Set<string>>();
    const getTextTokens = (candidate: RecallCandidate) => {
      const cacheKey = `${candidate.type}:${candidate.id}`;
      const cached = textTokenCache.get(cacheKey);
      if (cached) return cached;
      const tokens = tokenizeForSimilarity(candidate.content);
      textTokenCache.set(cacheKey, tokens);
      return tokens;
    };
    const getCandidateSimilarity = (
      a: RecallCandidate,
      b: RecallCandidate,
    ) => {
      if (a.embedding && b.embedding) {
        return cosineSimilarity(a.embedding, b.embedding);
      }
      return tokenSetSimilarity(getTextTokens(a), getTextTokens(b));
    };

    while (selected.length < topK && remaining.size > 0) {
      let bestId: string | null = null;
      let bestMmrScore = -Infinity;

      for (const candidateId of remaining) {
        const candidate = candidateMap.get(candidateId)!;
        const relevance = relevanceMap.get(candidateId)!;

        // Compute max similarity to already selected items
        let maxSimToSelected = 0;
        if (selected.length > 0) {
          for (const sel of selected) {
            const sim = getCandidateSimilarity(candidate, sel);
            if (sim > maxSimToSelected) {
              maxSimToSelected = sim;
            }
          }
        }

        const mmrScore =
          MMR_LAMBDA * relevance - (1 - MMR_LAMBDA) * maxSimToSelected;

        if (mmrScore > bestMmrScore) {
          bestMmrScore = mmrScore;
          bestId = candidateId;
        }
      }

      if (bestId == null) break;

      const bestCandidate = candidateMap.get(bestId)!;
      bestCandidate.score = Math.max(0, Math.min(1, bestMmrScore));
      selected.push(bestCandidate);
      remaining.delete(bestId);
    }

    return selected;
  }

  // =========================================================================
  // Reinforce on Recall
  // =========================================================================

  /**
   * After recall, reinforce accessed memories by incrementing access_count
   * and boosting salience. This strengthens memories that are actually used.
   */
  private reinforceAccessedMemories(targets: RecallAccessTarget[]): void {
    if (targets.length === 0) return;

    const currentTime = now();

    try {
      const upsert = this.db.prepare(
        `INSERT INTO memory_metadata
           (target_type, target_id, salience_score, access_count, last_accessed,
            retrieval_tier, effective_salience, lifecycle_updated_at,
            created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, 'active', ?, ?, ?, ?)
         ON CONFLICT(target_type, target_id) DO UPDATE SET
           access_count = access_count + 1,
           last_accessed = excluded.last_accessed,
           salience_score = salience_score + ?,
           retrieval_tier = CASE
             WHEN memory_metadata.consolidation_level = 'forgotten' THEN memory_metadata.retrieval_tier
             ELSE 'active'
           END,
           effective_salience = CASE
             WHEN memory_metadata.consolidation_level = 'forgotten' THEN memory_metadata.effective_salience
             ELSE MAX(COALESCE(memory_metadata.effective_salience, 0) + ?, 0.4)
           END,
           lifecycle_updated_at = excluded.lifecycle_updated_at,
           updated_at = excluded.updated_at`,
      );

      const runAll = this.db.transaction(() => {
        for (const target of targets) {
          upsert.run(
            target.type,
            target.id,
            SALIENCE_REINFORCE_BOOST, // initial salience for new entries
            currentTime,
            Math.max(SALIENCE_REINFORCE_BOOST, 0.4),
            currentTime,
            currentTime,
            currentTime,
            SALIENCE_REINFORCE_BOOST, // boost for existing entries
            SALIENCE_REINFORCE_BOOST,
          );
        }
      });

      runAll();
    } catch (err) {
      // Non-critical: log but do not throw
      console.warn(
        '[RecallEngine] Failed to reinforce accessed memories:',
        err,
      );
    }
  }

  // =========================================================================
  // Internal Helpers
  // =========================================================================

  /**
   * Match entities by name/alias keyword overlap with the query.
   * Phase 2 uses simple keyword matching; Phase 3 will use LLM extraction.
   */
  private findMatchingEntities(
    queryText: string,
    entityTypes?: EntityType[],
  ): Entity[] {
    const queryTokens = Array.from(new Set(tokenizeGraphEntityText(queryText)));
    const specificQueryTokens = queryTokens.filter(isSpecificGraphToken);
    const normalizedQueryPhrase = normalizeGraphPhrase(queryText);

    if (queryTokens.length === 0 && normalizedQueryPhrase.length === 0)
      return [];

    try {
      // Build type filter
      let typeClause = '';
      const params: unknown[] = [];

      if (entityTypes && entityTypes.length > 0) {
        const ph = entityTypes.map(() => '?').join(', ');
        typeClause = `AND type IN (${ph})`;
        params.push(...entityTypes);
      }

      const entities = this.db
        .prepare(
          `SELECT id, type, name, aliases_json, description, importance,
                  access_count, last_accessed, first_seen, last_seen,
                  mention_count, tags_json, markdown_path, status,
                  merged_into, created_at, updated_at
           FROM entities
           WHERE status = 'active' ${typeClause}`,
        )
        .all(...params) as EntityRow[];

      const matched: Array<{ entity: Entity; score: number }> = [];

      for (const row of entities) {
        const aliases: string[] = row.aliases_json
          ? (safeJsonParse<unknown[]>(row.aliases_json) ?? []).filter(
              (alias): alias is string => typeof alias === 'string',
            )
          : [];
        const terms = [row.name, ...aliases]
          .map((term) => String(term).trim())
          .filter(Boolean);
        const entityTokenList = Array.from(
          new Set(terms.flatMap((term) => tokenizeGraphEntityText(term))),
        );
        const matchedTokens = queryTokens.filter((queryToken) =>
          entityTokenList.some((entityToken) =>
            tokenMatchesEntityToken(queryToken, entityToken),
          ),
        );
        const specificMatches = matchedTokens.filter(isSpecificGraphToken);
        const phraseMatch = terms.some((term) => {
          const normalizedTerm = normalizeGraphPhrase(term);
          if (!normalizedTerm) return false;
          const termTokens = tokenizeGraphEntityText(term);
          const hasShortOnlyTerm =
            termTokens.length === 1 && termTokens[0].length < 3;
          if (hasShortOnlyTerm) {
            return queryTokens.includes(termTokens[0]);
          }
          if (queryTokens.length === 1 && queryTokens[0].length < 3) {
            return false;
          }
          return (
            normalizedQueryPhrase.includes(normalizedTerm) ||
            (normalizedQueryPhrase.length >= 4 &&
              normalizedTerm.includes(normalizedQueryPhrase))
          );
        });

        const hasSpecificMatch =
          specificMatches.length > 0 ||
          (phraseMatch &&
            specificQueryTokens.some((queryToken) =>
              entityTokenList.some((entityToken) =>
                tokenMatchesEntityToken(queryToken, entityToken),
              ),
            ));
        const hasAnyMatch = matchedTokens.length > 0 || phraseMatch;

        if (!hasAnyMatch) continue;
        if (specificQueryTokens.length > 0 && !hasSpecificMatch) continue;

        const typeBoost =
          row.type === 'Project' ? 0.2 : row.type === 'Topic' ? 0.1 : 0;
        const score =
          row.importance +
          typeBoost +
          specificMatches.length * 3 +
          matchedTokens.length * 0.25 +
          (phraseMatch ? 1 : 0);
        matched.push({
          entity: entityRowToEntity(row),
          score,
        });
      }

      matched.sort(
        (a, b) =>
          b.score - a.score || b.entity.importance - a.entity.importance,
      );
      return matched
        .slice(0, MAX_GRAPH_SEED_ENTITIES)
        .map((item) => item.entity);
    } catch (err) {
      console.warn('[RecallEngine] Entity matching failed:', err);
      return [];
    }
  }

  /**
   * Load a single entity by id.
   */
  private loadEntity(id: string): Entity | null {
    try {
      const row = this.db
        .prepare(
          `SELECT id, type, name, aliases_json, description, importance,
                  access_count, last_accessed, first_seen, last_seen,
                  mention_count, tags_json, markdown_path, status,
                  merged_into, created_at, updated_at
           FROM entities
           WHERE id = ?`,
        )
        .get(id) as EntityRow | undefined;

      return row ? entityRowToEntity(row) : null;
    } catch {
      return null;
    }
  }

  private getEntityEvidenceMatch(
    entityId: string,
    query: RecallQuery,
  ): EntityEvidenceMatch {
    const requestedScope = getSpecificRequestedScope(query.scope);

    try {
      const rows = this.db
        .prepare(
          `SELECT id, content, scope, source, source_type, timestamp, sender, group_id, group_name,
                  source_url, source_title,
                  matched_projects_json,
                  metadata_json, importance, entities_json
           FROM messages_raw
           WHERE entities_json LIKE ? ESCAPE '\\'
           ORDER BY timestamp DESC
           LIMIT 200`,
        )
        .all(`%"${escapeLikePattern(entityId)}"%`) as EntityEvidenceRow[];

      if (rows.length === 0) {
        return {
          matches: requestedScope !== 'personal',
          metadata:
            requestedScope === 'work'
              ? { scope: 'work', scopeEvidenceCount: 0 }
              : undefined,
        };
      }

      const matchingRows = rows.filter((row) => this.passesFilters(row, query));
      if (matchingRows.length === 0) {
        return { matches: false };
      }

      const scopes = new Set(
        matchingRows.map((row) => normalizeStoredScope(row.scope)),
      );
      const scope =
        scopes.size === 1 ? Array.from(scopes)[0] : requestedScope;

      return {
        matches: true,
        metadata: {
          ...(scope ? { scope } : {}),
          scopeEvidenceCount: matchingRows.length,
          scopeEvidenceTotal: rows.length,
        },
      };
    } catch (err) {
      console.warn('[RecallEngine] Entity scope evidence lookup failed:', err);
      return {
        matches: requestedScope !== 'personal',
        metadata:
          requestedScope === 'work'
            ? { scope: 'work', scopeEvidenceCount: 0 }
            : undefined,
      };
    }
  }

  /**
   * Check whether a message passes the optional query filters
   * (time range, project filter).
   */
  private passesFilters(msg: MessageRow, query: RecallQuery): boolean {
    // Time range filter
    if (query.timeRange) {
      if (
        query.timeRange.start != null &&
        msg.timestamp < query.timeRange.start
      )
        return false;
      if (query.timeRange.end != null && msg.timestamp > query.timeRange.end)
        return false;
    }

    if (!matchesTextFilter(msg.sender, query.senderFilter)) return false;
    if (!matchesTextFilter(msg.group_name, query.groupFilter)) return false;

    if (query.minImportance != null && msg.importance < query.minImportance)
      return false;

    if (!matchesScope(msg.scope, query.scope)) return false;

    if (
      query.sourceTypes?.length &&
      !query.sourceTypes.includes(msg.source_type)
    )
      return false;

    if (query.projectFilter) {
      const matchedProjects =
        safeJsonParse<string[]>(msg.matched_projects_json ?? '') ?? [];
      const entityMatches =
        safeJsonParse<Array<{ name?: string; id?: string }>>(
          msg.entities_json ?? '',
        ) ?? [];
      const projectCandidates = [
        ...matchedProjects,
        ...entityMatches.flatMap((entity) => [
          entity.name ?? '',
          entity.id ?? '',
        ]),
      ];

      if (!matchesProjectFilter(query.projectFilter, projectCandidates)) {
        return false;
      }
    }

    return true;
  }
}
