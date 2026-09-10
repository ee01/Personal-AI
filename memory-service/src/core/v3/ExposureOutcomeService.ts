/**
 * P3 ExposureOutcomeService (plan §7.8/§8.4/§11.8): records exposures and
 * outcomes, and applies the FSRS-lite lifecycle rules. Hard invariants:
 *   I9  shown/opened never changes confidence or stability
 *   §8.4 only confirmation/correction/reliable-outcome update stability
 */

import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

import {
  classifyOutcomeImpact,
  computeStability,
  type ExposureRecord,
  type OutcomeRecord,
} from './ConsolidationPhases.js';

export const EXPOSURE_RETENTION_DAYS = 30;

export class ExposureOutcomeService {
  constructor(private readonly db: Database.Database) {}

  /** Record a raw exposure batch (per-request). No lifecycle impact (I9). */
  recordExposures(requestId: string, records: ExposureRecord[]): number {
    if (records.length === 0) return 0;
    const nowSec = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(
      `INSERT INTO memory_exposures
        (request_id, unit_id, surface, rank, shown, quieted, no_result, policy_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const tx = this.db.transaction(() => {
      for (const r of records) {
        stmt.run(
          requestId,
          r.unitId,
          r.surface,
          r.rank,
          r.shown ? 1 : 0,
          r.quieted ? 1 : 0,
          r.noResult ? 1 : 0,
          null,
          nowSec,
        );
      }
    });
    tx();
    return records.length;
  }

  /**
   * Record an outcome and apply the lifecycle impact. Returns the impact
   * classification so callers know whether TruthMaintainer needs to run.
   */
  recordOutcome(outcome: OutcomeRecord & { surface?: string; taskContext?: string }): {
    impact: string;
    newStability: number;
  } {
    const nowSec = Math.floor(Date.now() / 1000);
    this.db
      .prepare(
        `INSERT INTO memory_outcomes (unit_id, outcome_type, surface, task_context, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(outcome.unitId, outcome.outcomeType, outcome.surface ?? null, outcome.taskContext ?? null, nowSec);

    const impact = classifyOutcomeImpact(outcome);
    // I9 guard: 'none' impact never writes lifecycle state.
    if (impact === 'none') return { impact, newStability: 0 };

    // Read current stability (default 1.0 for first access).
    const existing = this.db
      .prepare(`SELECT stability FROM unit_lifecycle WHERE unit_id = ?`)
      .get(outcome.unitId) as { stability: number } | undefined;
    const currentStability = existing?.stability ?? 1.0;
    const newStability = computeStability(currentStability, impact);

    // Upsert the lifecycle row.
    const upsert = this.db.prepare(
      `INSERT INTO unit_lifecycle
        (unit_id, accessibility_tier, stability, last_accessed_at, access_count,
         explicit_reinforce_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)
       ON CONFLICT(unit_id) DO UPDATE SET
         stability = excluded.stability,
         last_accessed_at = excluded.last_accessed_at,
         access_count = unit_lifecycle.access_count + 1,
         explicit_reinforce_count = unit_lifecycle.explicit_reinforce_count + ?,
         updated_at = excluded.updated_at`,
    );
    const tier =
      newStability >= 5 ? 'always_available' :
      newStability >= 1.5 ? 'normal' :
      newStability >= 0.5 ? 'weak' : 'archived';
    const reinforceCount = impact === 'confirmation' || impact === 'utility_bump' ? 1 : 0;
    upsert.run(outcome.unitId, tier, newStability, nowSec, reinforceCount, nowSec, nowSec, reinforceCount);

    return { impact, newStability };
  }

  /** Prune raw exposures older than the retention window (30 days). */
  pruneStaleExposures(): number {
    const cutoff = Math.floor(Date.now() / 1000) - EXPOSURE_RETENTION_DAYS * 86400;
    const result = this.db
      .prepare(`DELETE FROM memory_exposures WHERE created_at < ?`)
      .run(cutoff);
    return result.changes;
  }

  /**
   * Daily aggregate rollup for long-term storage (plan §7.8: "长期只保存
   * 不含正文的日聚合"). Returns per-unit daily exposure counts.
   */
  aggregateDailyExposures(dayStartEpoch: number): Array<{
    unitId: string;
    surface: string;
    exposureCount: number;
  }> {
    const dayEnd = dayStartEpoch + 86400;
    return this.db
      .prepare(
        `SELECT unit_id AS unitId, surface, COUNT(*) AS exposureCount
         FROM memory_exposures
         WHERE created_at >= ? AND created_at < ?
         GROUP BY unit_id, surface`,
      )
      .all(dayStartEpoch, dayEnd) as Array<{
      unitId: string;
      surface: string;
      exposureCount: number;
    }>;
  }
}
