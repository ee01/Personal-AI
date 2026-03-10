/**
 * ForgettingEngine — handles memory decay and lifecycle management.
 *
 * Decay formula:
 *   S(t) = S0 * exp(-t / (T * decay_rate))
 * where:
 *   S0         = initial salience score (memory_metadata.salience_score)
 *   t          = hours since last_accessed
 *   T          = base half-life in hours (half_life_days * 24)
 *   decay_rate = individual factor (starts at 1.0, multiplied by 0.9 on each access)
 *
 * Thresholds:
 *   < 0.05  -> forgotten (soft delete)
 *   < 0.15  -> archived
 *   drop > 50% from original -> downgrade consolidation level
 */

import type Database from 'better-sqlite3';
import { now } from '../utils/time.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ForgettingResult {
  forgotten: number;      // salience < 0.05 -> soft delete
  archived: number;       // salience < 0.15 -> archive
  downgraded: number;     // salience dropped > 50% -> downgrade consolidation level
  totalProcessed: number;
}

/**
 * Row shape returned by querying memory_metadata.
 * Uses the column names from the SQLite schema directly.
 */
interface MemoryMetadataRow {
  id: number;
  target_type: string;
  target_id: string;
  salience_score: number;
  importance: number;
  frequency: number;
  recency_boost: number;
  surprise_score: number;
  redundancy: number;
  access_count: number;
  last_accessed: number | null;
  decay_rate: number;
  half_life_days: number;
  consolidation_level: string;
  next_review_at: number | null;
  created_at: number;
  updated_at: number | null;
}

/** Ordered consolidation levels from highest to lowest. */
const CONSOLIDATION_LEVELS = ['core', 'consolidated', 'working', 'temporary'] as const;

/** Levels that are exempt from the forgetting cycle. */
const EXEMPT_LEVELS = new Set(['permanent', 'forgotten', 'archived']);

// ---------------------------------------------------------------------------
// ForgettingEngine
// ---------------------------------------------------------------------------

export class ForgettingEngine {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ---- Decay computation --------------------------------------------------

  /**
   * Compute the current (decayed) salience for a memory metadata record.
   *
   * If the consolidation_level is 'permanent', returns a sentinel value
   * of 999999 so the memory is never forgotten.
   */
  computeCurrentSalience(meta: MemoryMetadataRow): number {
    if (meta.consolidation_level === 'permanent') {
      return 999999;
    }

    const S0 = meta.salience_score;

    // If salience was already 0 or negative, no further decay needed.
    if (S0 <= 0) {
      return 0;
    }

    const currentTime = now();
    const lastAccessed = meta.last_accessed ?? meta.created_at;
    const deltaSeconds = Math.max(0, currentTime - lastAccessed);
    const t = deltaSeconds / 3600; // hours since last accessed

    const T = meta.half_life_days * 24; // base half-life in hours
    const decayRate = Math.max(meta.decay_rate, 0.1); // floor at 0.1

    // Guard against division by zero (should not happen with floor).
    const denominator = T * decayRate;
    if (denominator <= 0) {
      return S0;
    }

    return S0 * Math.exp(-t / denominator);
  }

  // ---- Forgetting cycle ---------------------------------------------------

  /**
   * Process ALL non-permanent memory_metadata records, applying the decay
   * formula and updating consolidation levels as needed.
   *
   * Returns statistics about what was forgotten, archived, or downgraded.
   */
  async runForgettingCycle(): Promise<ForgettingResult> {
    const result: ForgettingResult = {
      forgotten: 0,
      archived: 0,
      downgraded: 0,
      totalProcessed: 0,
    };

    // Fetch all records that are eligible for the forgetting cycle.
    const rows = this.db
      .prepare(
        `SELECT *
         FROM memory_metadata
         WHERE consolidation_level NOT IN ('permanent', 'forgotten', 'archived')`,
      )
      .all() as MemoryMetadataRow[];

    if (rows.length === 0) {
      return result;
    }

    const currentTime = now();

    const updateStmt = this.db.prepare(
      `UPDATE memory_metadata
       SET salience_score = ?,
           consolidation_level = ?,
           updated_at = ?
       WHERE id = ?`,
    );

    for (const row of rows) {
      result.totalProcessed += 1;

      const currentSalience = this.computeCurrentSalience(row);

      let newLevel = row.consolidation_level;
      let counted = false;

      // Priority 1: Forgotten (soft delete)
      if (currentSalience < 0.05) {
        newLevel = 'forgotten';
        result.forgotten += 1;
        counted = true;
      }
      // Priority 2: Archived
      else if (currentSalience < 0.15) {
        newLevel = 'archived';
        result.archived += 1;
        counted = true;
      }

      // Priority 3: Downgrade if salience dropped > 50% from stored value.
      // This can happen alongside archiving (already counted above) but we
      // only count the downgrade if it was not already forgotten/archived.
      const originalSalience = row.salience_score;
      if (
        originalSalience > 0 &&
        currentSalience < originalSalience * 0.5 &&
        !counted
      ) {
        const downgraded = this.getConsolidationDowngrade(row.consolidation_level);
        if (downgraded !== row.consolidation_level) {
          newLevel = downgraded;
          result.downgraded += 1;
        }
      }

      // Persist the updated salience and level.
      updateStmt.run(currentSalience, newLevel, currentTime, row.id);
    }

    return result;
  }

  // ---- Reinforcement ------------------------------------------------------

  /**
   * Reinforce a memory on recall ("recall = reinforce").
   *
   * - Increment salience with diminishing returns: 5 * (1 / (1 + access_count))
   * - Increment access_count
   * - Update last_accessed to now
   * - Slow down future decay: decay_rate *= 0.9 (minimum 0.1)
   * - Extend half-life: half_life_days = min(half_life_days * 1.1, 365)
   *
   * If no existing record is found, a new one is inserted with defaults.
   */
  reinforceMemory(targetType: string, targetId: string): void {
    const currentTime = now();

    const existing = this.db
      .prepare(
        `SELECT *
         FROM memory_metadata
         WHERE target_type = ? AND target_id = ?`,
      )
      .get(targetType, targetId) as MemoryMetadataRow | undefined;

    if (existing) {
      const accessCount = existing.access_count;
      const increment = 5 * (1 / (1 + accessCount));
      const newSalience = existing.salience_score + increment;
      const newAccessCount = accessCount + 1;
      const newDecayRate = Math.max(existing.decay_rate * 0.9, 0.1);
      const newHalfLife = Math.min(existing.half_life_days * 1.1, 365);

      this.db
        .prepare(
          `UPDATE memory_metadata
           SET salience_score = ?,
               access_count = ?,
               last_accessed = ?,
               decay_rate = ?,
               half_life_days = ?,
               updated_at = ?
           WHERE id = ?`,
        )
        .run(
          newSalience,
          newAccessCount,
          currentTime,
          newDecayRate,
          newHalfLife,
          currentTime,
          existing.id,
        );
    } else {
      // No existing record — insert with sensible defaults.
      // Initial reinforcement increment when access_count = 0: 5 * (1 / 1) = 5
      const initialSalience = 5;
      const initialAccessCount = 1;

      this.db
        .prepare(
          `INSERT INTO memory_metadata
            (target_type, target_id, salience_score, importance, frequency,
             recency_boost, surprise_score, redundancy,
             access_count, last_accessed, decay_rate, half_life_days,
             consolidation_level, created_at, updated_at)
           VALUES (?, ?, ?, 0.5, 1, 1.0, 0, 0, ?, ?, 1.0, 30, 'temporary', ?, ?)`,
        )
        .run(
          targetType,
          targetId,
          initialSalience,
          initialAccessCount,
          currentTime,
          currentTime,
          currentTime,
        );
    }
  }

  // ---- Consolidation level helpers ----------------------------------------

  /**
   * Return the next lower consolidation level.
   *
   * Ordering: core -> consolidated -> working -> temporary
   *
   * If the level is already 'temporary' or unrecognised, it is returned
   * unchanged.
   */
  getConsolidationDowngrade(current: string): string {
    const idx = CONSOLIDATION_LEVELS.indexOf(
      current as (typeof CONSOLIDATION_LEVELS)[number],
    );

    // If not found or already at the lowest level, return as-is.
    if (idx === -1 || idx >= CONSOLIDATION_LEVELS.length - 1) {
      return current;
    }

    return CONSOLIDATION_LEVELS[idx + 1];
  }
}
