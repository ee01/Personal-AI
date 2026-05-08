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
  RecallResult,
  RecallItem,
  Entity,
  EntityType,
  MemoryScope,
  RecallSourceType,
  RecallScope,
  SourceType,
} from '../types/index.js';
import { EmbeddingClient } from '../llm/EmbeddingClient.js';
import { now } from '../utils/time.js';
import { toSlug } from '../utils/slug.js';
import { parseQueryTimeRange } from '../utils/queryTime.js';
import { buildRecallPresentation } from '../utils/recallPresentation.js';
import { buildExploreLink } from '../utils/exploreLink.js';

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
  salience_score: number;
  access_count: number;
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
  if (msg.scope && !metadata.scope) {
    metadata.scope = msg.scope;
  }
  if (msg.source && !metadata.source) {
    metadata.source = msg.source;
  }
  if (msg.sender && !metadata.sender) {
    metadata.sender = msg.sender;
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
  async recall(query: RecallQuery): Promise<RecallResult> {
    const startMs = Date.now();
    const topK = query.topK ?? DEFAULT_TOP_K;
    const activeChannels = query.channels ?? ['vector', 'fts', 'graph', 'time'];
    const usedChannels: string[] = [];

    // Generate query embedding (needed for vector search and MMR diversity)
    let queryEmbedding: number[] | null = null;
    if (activeChannels.includes('vector')) {
      try {
        const client = await EmbeddingClient.getInstance();
        queryEmbedding = await client.embed(query.query);
      } catch (err) {
        console.warn(
          '[RecallEngine] Embedding generation failed, skipping vector channel:',
          err,
        );
      }
    }

    // Run channels in parallel
    const channelPromises: Promise<RecallCandidate[]>[] = [];

    const fetchLimit = topK * VEC_OVER_FETCH_FACTOR;

    if (activeChannels.includes('vector') && queryEmbedding) {
      channelPromises.push(
        this.vectorSearch(queryEmbedding, fetchLimit, query).then((r) => {
          if (r.length > 0) usedChannels.push('vector');
          return r;
        }),
      );
    }

    if (activeChannels.includes('fts')) {
      channelPromises.push(
        this.ftsSearch(query.query, fetchLimit, query).then((r) => {
          if (r.length > 0) usedChannels.push('fts');
          return r;
        }),
      );
    }

    if (activeChannels.includes('graph')) {
      channelPromises.push(
        this.graphSearch(query.query, fetchLimit, query).then((r) => {
          if (r.length > 0) usedChannels.push('graph');
          return r;
        }),
      );
    }

    if (activeChannels.includes('time')) {
      channelPromises.push(
        this.timeWindowSearch(query.query, fetchLimit, query).then((r) => {
          if (r.length > 0) usedChannels.push('time');
          return r;
        }),
      );
    }

    const channelResults = await Promise.all(channelPromises);

    // Merge and deduplicate
    const merged = this.mergeAndDeduplicate(channelResults.flat());

    if (merged.length === 0) {
      return {
        items: [],
        totalFound: 0,
        queryTimeMs: Date.now() - startMs,
        channels: usedChannels,
      };
    }

    // Enrich with salience scores from memory_metadata
    this.enrichWithSalience(merged);

    // Apply optional salience filter
    const filtered =
      query.minSalience != null
        ? merged.filter((c) => (c.salienceScore ?? 0) >= query.minSalience!)
        : merged;

    // MMR reranking
    const ranked = this.mmrRerank(filtered, topK);

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
        scope:
          c.type === 'entity'
            ? undefined
            : (c.metadata?.scope as MemoryScope | undefined),
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
      if (query.includeMetadata && c.metadata) {
        item.metadata = {
          ...c.metadata,
          channels: c.channels,
          recencyScore: c.recencyScore,
          salienceScore: c.salienceScore,
        };
      }
      return item;
    });

    // Reinforce accessed memories (fire-and-forget)
    const accessTargets = items.map((item) => ({
      id: item.id,
      type: item.type,
    }));
    this.reinforceAccessedMemories(accessTargets);

    return {
      items,
      totalFound: merged.length,
      queryTimeMs: Date.now() - startMs,
      channels: usedChannels,
    };
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
            `SELECT id, content, scope, source, source_type, timestamp, sender, group_name,
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
            `SELECT chunk_id, content, file_path, scope, source, source_type, related_project, created_at
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
          candidates.push({
            id: String(chunk.chunk_id),
            type: 'chunk',
            content: chunk.content,
            score,
            timestamp: chunk.created_at,
            source: chunk.source_type ?? undefined,
            channels: ['vector'],
            metadata: {
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
          `SELECT chunk_id, content, file_path, scope, source, source_type, related_project, created_at
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

        candidates.push({
          id: String(chunk.chunk_id),
          type: 'chunk',
          content: chunk.content,
          score,
          timestamp: chunk.created_at,
          source: chunk.source_type ?? undefined,
          channels: ['fts'],
          metadata: {
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

  // =========================================================================
  // Channel 3: Knowledge Graph Search
  // =========================================================================

  private async graphSearch(
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
      );
      if (matchedEntities.length === 0) return candidates;

      const entityIds = matchedEntities.map((e) => e.id);

      // Add entities themselves as candidates
      for (const ent of matchedEntities) {
        candidates.push({
          id: ent.id,
          type: 'entity',
          content: ent.description || `${ent.type}: ${ent.name}`,
          score: ent.importance,
          timestamp: ent.lastSeen,
          channels: ['graph'],
          entity: ent,
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
          if (relEnt) {
            candidates.push({
              id: relEnt.id,
              type: 'entity',
              content: relEnt.description || `${relEnt.type}: ${relEnt.name}`,
              score: rel.strength,
              timestamp: relEnt.lastSeen,
              channels: ['graph'],
              entity: relEnt,
              metadata: {
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
          if (relEnt) {
            candidates.push({
              id: relEnt.id,
              type: 'entity',
              content: relEnt.description || `${relEnt.type}: ${relEnt.name}`,
              score: rel.strength * 0.5, // 2-hop penalty
              timestamp: relEnt.lastSeen,
              channels: ['graph'],
              entity: relEnt,
              metadata: {
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
              `SELECT id, content, scope, source, source_type, timestamp, sender, group_name,
                      source_url, source_title,
                      matched_projects_json,
                      metadata_json, importance, entities_json
               FROM messages_raw
               WHERE entities_json LIKE ?
               ORDER BY timestamp DESC
               LIMIT ?`,
            )
            .all(
              `%"${entId}"%`,
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
          `SELECT id, content, scope, source, source_type, timestamp, sender, group_name,
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
   * Enrich candidates with salience scores from memory_metadata.
   */
  private enrichWithSalience(candidates: RecallCandidate[]): void {
    for (const c of candidates) {
      try {
        const meta = this.db
          .prepare(
            `SELECT salience_score, access_count
             FROM memory_metadata
             WHERE target_id = ? AND target_type = ?`,
          )
          .get(c.id, c.type) as MemoryMetaRow | undefined;

        if (meta) {
          c.salienceScore = meta.salience_score;
        }
      } catch {
        // memory_metadata may not exist yet
      }
    }

    // Also compute normalized recency scores
    const currentTime = now();
    const maxAge = 30 * 86400; // 30 days as normalization window

    for (const c of candidates) {
      if (c.timestamp != null && c.recencyScore == null) {
        const age = Math.max(currentTime - c.timestamp, 0);
        c.recencyScore = Math.max(0, 1 - age / maxAge);
      }
    }
  }

  // =========================================================================
  // MMR Reranking
  // =========================================================================

  /**
   * Apply Maximal Marginal Relevance to balance relevance and diversity.
   *
   * MMR_score = lambda * relevance - (1 - lambda) * max_similarity_to_selected
   */
  private mmrRerank(
    candidates: RecallCandidate[],
    topK: number,
  ): RecallCandidate[] {
    if (candidates.length <= 1) return candidates;

    // Compute composite relevance for each candidate
    const relevanceMap = new Map<string, number>();
    for (const c of candidates) {
      const candidateKey = getRecallCandidateKey(c);
      const recency = c.recencyScore ?? 0;
      const salience = c.salienceScore ?? 0;
      const relevance =
        c.score + RECENCY_WEIGHT * recency + SALIENCE_WEIGHT * salience;
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
        `INSERT INTO memory_metadata (target_type, target_id, salience_score, access_count, last_accessed, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?, ?)
         ON CONFLICT(target_type, target_id) DO UPDATE SET
           access_count = access_count + 1,
           last_accessed = excluded.last_accessed,
           salience_score = salience_score + ?,
           updated_at = excluded.updated_at`,
      );

      const runAll = this.db.transaction(() => {
        for (const target of targets) {
          upsert.run(
            target.type,
            target.id,
            SALIENCE_REINFORCE_BOOST, // initial salience for new entries
            currentTime,
            currentTime,
            currentTime,
            SALIENCE_REINFORCE_BOOST, // boost for existing entries
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
    const queryLower = queryText.toLowerCase();
    const queryTokens = queryLower
      .split(/[^\p{L}\p{N}_-]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length > 1);

    if (queryTokens.length === 0 && queryLower.trim().length === 0) return [];

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

      const matched: Entity[] = [];

      for (const row of entities) {
        const nameLower = row.name.toLowerCase();
        const aliases: string[] = row.aliases_json
          ? (safeJsonParse<string[]>(row.aliases_json) ?? [])
          : [];
        const aliasesLower = aliases.map((a) => a.toLowerCase());

        const directPhraseMatch =
          queryLower.includes(nameLower) ||
          aliasesLower.some((alias) => queryLower.includes(alias));

        const tokenMatch = queryTokens.some(
          (token) =>
            nameLower.includes(token) ||
            token.includes(nameLower) ||
            aliasesLower.some(
              (alias) => alias.includes(token) || token.includes(alias),
            ),
        );

        if (directPhraseMatch || tokenMatch) {
          matched.push(entityRowToEntity(row));
        }
      }

      // Sort by importance descending
      matched.sort((a, b) => b.importance - a.importance);
      return matched;
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
