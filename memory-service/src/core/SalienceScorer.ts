/**
 * SalienceScorer — computes a salience score for memories.
 *
 * Formula:
 *   S = alpha * importance
 *     + beta  * frequency_norm
 *     + gamma * recency
 *     + eta   * surprise
 *     - delta * max(0, redundancy - 0.7)
 *     + zeta  * userInterestBoost
 *
 * Memories with S < STORAGE_THRESHOLD (0.3) are stored in messages_raw
 * but NOT indexed into chunks/vec.
 */

import type Database from 'better-sqlite3';
import { now } from '../utils/time.js';
import { EmbeddingClient } from '../llm/EmbeddingClient.js';
import { classifyMemoryLifecycle } from './MemoryLifecyclePolicy.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SalienceWeights {
  alpha: number;  // importance
  beta: number;   // frequency
  gamma: number;  // recency
  eta: number;    // surprise
  delta: number;  // redundancy penalty
  zeta: number;   // user interest boost
}

export interface SalienceInput {
  importance: number;    // LLM-judged 0-1
  frequency: number;     // raw count of same-topic occurrences in last 7 days
  recency: number;       // exp(-lambda * delta_t_hours), lambda = 0.01
  surprise: number;      // |sentiment_score| * 0.5 + novelty * 0.5
  redundancy: number;    // max cosine similarity with existing memories, 0-1
  userInterestBoost?: number; // 0-1 boost when content matches user interests
}

export interface SalienceResult {
  score: number;
  shouldIndex: boolean;      // score >= STORAGE_THRESHOLD
  components: SalienceInput; // for debugging
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Memories scoring below this threshold are stored but not indexed. */
const STORAGE_THRESHOLD = 0.3;

/** Recency decay constant (per hour). */
const RECENCY_LAMBDA = 0.01;

/** Maximum raw frequency count before normalisation caps. */
const FREQUENCY_CAP = 5;

const DEFAULT_WEIGHTS: SalienceWeights = {
  alpha: 0.35,   // importance
  beta: 0.20,    // frequency
  gamma: 0.15,   // recency
  eta: 0.10,     // surprise
  delta: 0.05,   // redundancy penalty
  zeta: 0.15,    // user interest boost
};

// ---------------------------------------------------------------------------
// Internal row types for DB queries
// ---------------------------------------------------------------------------

interface VecNeighborRow {
  chunk_id: number;
  distance: number;
}

interface MentionCountRow {
  cnt: number;
}

interface InterestItemRow {
  item_value: string;
}

interface MemoryMetadataExistingRow {
  id: number;
  access_count: number;
  decay_rate: number;
  half_life_days: number;
  consolidation_level: string;
  retrieval_tier?: string | null;
  created_at: number;
}

// ---------------------------------------------------------------------------
// SalienceScorer
// ---------------------------------------------------------------------------

export class SalienceScorer {
  private db: Database.Database;
  private weights: SalienceWeights;
  private memoryMetadataColumns?: Set<string>;

  constructor(db: Database.Database, weights?: Partial<SalienceWeights>) {
    this.db = db;
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  // ---- Pure computation --------------------------------------------------

  /**
   * Compute the final salience score from pre-computed sub-scores.
   */
  score(input: SalienceInput): SalienceResult {
    const { alpha, beta, gamma, eta, delta, zeta } = this.weights;

    // Normalise frequency: cap at FREQUENCY_CAP, then scale to 0-1.
    const frequencyNorm = Math.min(input.frequency, FREQUENCY_CAP) / FREQUENCY_CAP;

    let raw =
      alpha * input.importance +
      beta * frequencyNorm +
      gamma * input.recency +
      eta * input.surprise -
      delta * Math.max(0, input.redundancy - 0.7);

    // Add user interest boost when available
    raw += zeta * (input.userInterestBoost ?? 0);

    // Clamp to [0, 1]
    const score = Math.max(0, Math.min(1, raw));

    return {
      score,
      shouldIndex: score >= STORAGE_THRESHOLD,
      components: input,
    };
  }

  // ---- Sub-score helpers -------------------------------------------------

  /**
   * Compute the recency sub-score for a given timestamp.
   *
   * recency = exp(-lambda * hours_ago)
   * where lambda = 0.01
   */
  computeRecency(timestampSeconds: number): number {
    const currentTime = now();
    const deltaSeconds = Math.max(0, currentTime - timestampSeconds);
    const hoursAgo = deltaSeconds / 3600;
    return Math.exp(-RECENCY_LAMBDA * hoursAgo);
  }

  /**
   * Compute the redundancy sub-score by querying chunks_vec for the
   * nearest neighbours of the given embedding.
   *
   * Returns the maximum cosine similarity found (0-1). If the vec
   * extension is not available or no results are found, returns 0.
   */
  async computeRedundancy(embedding: number[], topK: number = 5): Promise<number> {
    try {
      const rows = this.db
        .prepare(
          `SELECT chunk_id, distance
           FROM chunks_vec
           WHERE embedding MATCH ?
           ORDER BY distance
           LIMIT ?`,
        )
        .all(JSON.stringify(embedding), topK) as VecNeighborRow[];

      if (rows.length === 0) {
        return 0;
      }

      // sqlite-vec returns L2 distance by default.
      // Convert to a cosine-similarity-like score: sim = 1 / (1 + distance).
      // For normalised embeddings (which we use), this is a reasonable proxy.
      const maxSimilarity = Math.max(
        ...rows.map((r) => 1 / (1 + r.distance)),
      );

      return maxSimilarity;
    } catch {
      // Vec extension not loaded, table missing, or other error.
      return 0;
    }
  }

  /**
   * Compute the frequency sub-score by counting how many messages
   * mention any of the given entity names within the last `windowDays`.
   *
   * The raw count is capped at FREQUENCY_CAP (5) and returned as-is;
   * normalisation happens in `score()`.
   */
  computeFrequency(entityNames: string[], windowDays: number = 7): number {
    if (entityNames.length === 0) {
      return 0;
    }

    const cutoff = now() - windowDays * 86_400;

    // Build a LIKE-based query for each entity name.
    // This is intentionally simple; a more advanced implementation
    // might use FTS or pre-computed entity mention counts.
    const conditions = entityNames.map(() => 'content LIKE ?').join(' OR ');
    const params = entityNames.map((name) => `%${name}%`);

    try {
      const row = this.db
        .prepare(
          `SELECT COUNT(*) AS cnt
           FROM messages_raw
           WHERE timestamp >= ? AND (${conditions})`,
        )
        .get(cutoff, ...params) as MentionCountRow | undefined;

      const count = row?.cnt ?? 0;
      return Math.min(count, FREQUENCY_CAP);
    } catch {
      return 0;
    }
  }

  /**
   * Compute a user interest boost (0-1) by checking how many active
   * interest items from user_profile_items appear in the given content.
   *
   * @param content  The text to match against user interests.
   * @param db       Optional database handle. If not provided, returns 0.
   * @returns A value between 0.0 and 1.0 (each match adds 0.3, capped at 1.0).
   */
  computeUserInterestBoost(content: string, db?: Database.Database): number {
    const database = db ?? this.db;
    if (!database) {
      return 0;
    }

    try {
      const interestRows = database
        .prepare(
          `SELECT item_value FROM user_profile_items
           WHERE status = 'active' AND item_type = 'interest'
           ORDER BY salience_score DESC
           LIMIT 30`,
        )
        .all() as InterestItemRow[];

      if (interestRows.length === 0) {
        return 0;
      }

      const lowerContent = content.toLowerCase();
      let matchCount = 0;

      for (const row of interestRows) {
        if (lowerContent.includes(row.item_value.toLowerCase())) {
          matchCount++;
        }
      }

      return Math.min(matchCount * 0.3, 1.0);
    } catch {
      return 0;
    }
  }

  // ---- High-level scoring ------------------------------------------------

  /**
   * Compute the full salience score for a message, including all
   * sub-scores (recency, redundancy via embedding, frequency, surprise).
   *
   * @param content     The message text (used for embedding / redundancy).
   * @param importance  LLM-judged importance (0-1).
   * @param sentiment   Sentiment label or numeric string (e.g. "positive", "-0.3").
   * @param timestamp   Unix timestamp in seconds.
   */
  async scoreMessage(
    content: string,
    importance: number,
    sentiment: string,
    timestamp: number,
  ): Promise<SalienceResult> {
    // --- Recency ---
    const recency = this.computeRecency(timestamp);

    // --- Surprise ---
    // Parse sentiment into a numeric value.  If it's a known label we
    // map it; if it looks numeric we parse it directly.
    const sentimentValue = parseSentiment(sentiment);
    // Surprise = |sentiment| * 0.5 + novelty * 0.5
    // Without a dedicated novelty model we approximate novelty from
    // inverse redundancy (computed below).
    const sentimentComponent = Math.abs(sentimentValue) * 0.5;

    // --- Redundancy ---
    let redundancy = 0;
    try {
      const client = await EmbeddingClient.getInstance();
      const embedding = await client.embed(content);
      redundancy = await this.computeRedundancy(embedding);
    } catch {
      // Embedding unavailable — treat as fully novel.
      redundancy = 0;
    }

    // Novelty is the inverse of redundancy.
    const novelty = 1 - redundancy;
    const surprise = sentimentComponent + novelty * 0.5;

    // --- Frequency ---
    // Extract rough entity names from the content (simple heuristic:
    // capitalised multi-word sequences).  A production implementation
    // would use the entities already extracted by the ingestion pipeline.
    const entityNames = extractNameCandidates(content);
    const frequency = this.computeFrequency(entityNames);

    // --- User interest boost ---
    const userInterestBoost = this.computeUserInterestBoost(content);

    // --- Final score ---
    const input: SalienceInput = {
      importance,
      frequency,
      recency,
      surprise,
      redundancy,
      userInterestBoost,
    };

    return this.score(input);
  }

  // ---- Metadata persistence -----------------------------------------------

  /**
   * Ensure a memory_metadata row exists for the given target and update
   * the salience score plus debug components while preserving access stats.
   */
  ensureMetadata(
    targetType: string,
    targetId: string,
    score: number,
    components?: SalienceInput,
  ): void {
    const currentTime = now();
    const columns = this.getMemoryMetadataColumns();

    // Check if a row already exists so we can preserve access_count, etc.
    const selectColumns = [
      'id',
      'access_count',
      'decay_rate',
      'half_life_days',
      'consolidation_level',
      'created_at',
    ];
    if (columns.has('retrieval_tier')) {
      selectColumns.push('retrieval_tier');
    }

    const existing = this.db
      .prepare(
        `SELECT ${selectColumns.join(', ')}
         FROM memory_metadata
         WHERE target_type = ? AND target_id = ?`,
      )
      .get(targetType, targetId) as MemoryMetadataExistingRow | undefined;

    const metadataComponents = {
      importance: 0.5,
      frequency: 1,
      recency: 1.0,
      surprise: 0,
      redundancy: 0,
      ...components,
    } satisfies SalienceInput;
    const lifecycle = classifyMemoryLifecycle({
      salienceScore: score,
      effectiveSalience: score,
      retrievalTier: existing?.retrieval_tier,
      consolidationLevel: existing?.consolidation_level ?? 'temporary',
      createdAt: existing?.created_at ?? currentTime,
      currentTime,
    });

    if (existing) {
      const updates = [
        'salience_score = ?',
        'importance = ?',
        'frequency = ?',
        'recency_boost = ?',
        'surprise_score = ?',
        'redundancy = ?',
      ];
      const params: unknown[] = [
        score,
        metadataComponents.importance,
        metadataComponents.frequency,
        metadataComponents.recency,
        metadataComponents.surprise,
        metadataComponents.redundancy,
      ];
      if (columns.has('effective_salience')) {
        updates.push('effective_salience = ?');
        params.push(lifecycle.effectiveSalience);
      }
      if (columns.has('retrieval_tier')) {
        updates.push('retrieval_tier = ?');
        params.push(lifecycle.tier);
      }
      if (columns.has('lifecycle_updated_at')) {
        updates.push('lifecycle_updated_at = ?');
        params.push(currentTime);
      }
      updates.push('updated_at = ?');
      params.push(currentTime, existing.id);

      this.db
        .prepare(
          `UPDATE memory_metadata
           SET ${updates.join(', ')}
           WHERE id = ?`,
        )
        .run(...params);
    } else {
      const insertColumns = [
        'target_type',
        'target_id',
        'salience_score',
        'importance',
        'frequency',
        'recency_boost',
        'surprise_score',
        'redundancy',
        'access_count',
        'decay_rate',
        'half_life_days',
        'consolidation_level',
        'created_at',
        'updated_at',
      ];
      const values: unknown[] = [
        targetType,
        targetId,
        score,
        metadataComponents.importance,
        metadataComponents.frequency,
        metadataComponents.recency,
        metadataComponents.surprise,
        metadataComponents.redundancy,
        0,
        1.0,
        30,
        'temporary',
        currentTime,
        currentTime,
      ];
      if (columns.has('effective_salience')) {
        insertColumns.push('effective_salience');
        values.push(lifecycle.effectiveSalience);
      }
      if (columns.has('retrieval_tier')) {
        insertColumns.push('retrieval_tier');
        values.push(lifecycle.tier);
      }
      if (columns.has('lifecycle_updated_at')) {
        insertColumns.push('lifecycle_updated_at');
        values.push(currentTime);
      }

      this.db
        .prepare(
          `INSERT INTO memory_metadata
            (${insertColumns.join(', ')})
           VALUES (${insertColumns.map(() => '?').join(', ')})`,
        )
        .run(...values);
    }
  }

  private getMemoryMetadataColumns(): Set<string> {
    if (!this.memoryMetadataColumns) {
      const rows = this.db
        .prepare(`PRAGMA table_info(memory_metadata)`)
        .all() as Array<{ name: string }>;
      this.memoryMetadataColumns = new Set(rows.map((row) => row.name));
    }
    return this.memoryMetadataColumns;
  }
}

// ---------------------------------------------------------------------------
// Helpers (module-private)
// ---------------------------------------------------------------------------

/**
 * Parse a sentiment string into a numeric value in roughly [-1, 1].
 */
function parseSentiment(sentiment: string): number {
  const num = Number(sentiment);
  if (!Number.isNaN(num)) {
    return Math.max(-1, Math.min(1, num));
  }

  const lower = sentiment.toLowerCase().trim();
  switch (lower) {
    case 'positive':
      return 0.5;
    case 'very_positive':
    case 'very positive':
      return 0.9;
    case 'negative':
      return -0.5;
    case 'very_negative':
    case 'very negative':
      return -0.9;
    case 'neutral':
    default:
      return 0;
  }
}

/**
 * Very simple heuristic to extract potential entity-name candidates
 * from free text.  Returns capitalised multi-word sequences of 1-4
 * words (e.g. "John Smith", "Project Alpha").  This is intentionally
 * coarse — the real entity list should come from the ingestion pipeline.
 */
function extractNameCandidates(content: string): string[] {
  const matches = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\b/g);
  if (!matches) {
    return [];
  }
  // Deduplicate
  return [...new Set(matches)];
}
