import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';
import type { TrustClass } from './injectionScreen.js';

/**
 * ProbationService (P1-6 slice C): a 72h TTL "probation" for low-confidence and
 * untrusted auto-captures, the product form of Gemini Temporary Chats' TTL and
 * the book's "不立刻点开消息，是给自己留处理的余地".
 *
 * Mechanics — all on memory_metadata, no content mutation:
 *  - On ingest, a qualifying capture is capped to retrieval_tier='weak' and given
 *    probation_until = now + 72h. The lifecycle policy honors an explicit 'weak'
 *    tier, so the item is reachable by active search (/recall, /ask) but excluded
 *    from passive surfaces (Lens, notifications) which only allow core/active.
 *  - Nightly, probation items that were recalled or got positive feedback
 *    graduate (probation cleared, tier recomputed). Items that expire with no
 *    interaction are archived directly (skipping the months-long decay).
 *
 * Boundaries:
 *  - user_manual / trusted sources never enter probation (explicit user action is
 *    the highest trust).
 *  - Original content (messages_raw) is never touched — only the derived
 *    retrieval tier moves.
 */

const PROBATION_WINDOW_SECONDS = 72 * 3600;
const PROBATION_SALIENCE_LOW = 0.3;
const PROBATION_SALIENCE_HIGH = 0.45;

export interface ProbationProcessResult {
  graduated: number;
  expired: number;
}

export class ProbationService {
  constructor(private db: Database.Database) {}

  /** Decide whether a freshly-indexed capture should enter probation. */
  static shouldProbate(salience: number, trustClass: TrustClass | undefined): boolean {
    // Explicit user action (user_manual etc. -> 'trusted') is never probationary.
    if (trustClass === 'trusted') return false;
    if (trustClass === 'untrusted') return true;
    return salience >= PROBATION_SALIENCE_LOW && salience < PROBATION_SALIENCE_HIGH;
  }

  private hasColumn(table: string, column: string): boolean {
    try {
      const cols = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      return cols.some((c) => c.name === column);
    } catch {
      return false;
    }
  }

  /**
   * Apply probation to a message and its chunks after indexing. Caps the
   * retrieval_tier to 'weak' and stamps probation_until. Idempotent.
   */
  applyOnIngest(
    messageId: string,
    salience: number,
    trustClass: TrustClass | undefined,
    nowTs: number = now(),
  ): boolean {
    if (!ProbationService.shouldProbate(salience, trustClass)) return false;
    if (!this.hasColumn('memory_metadata', 'probation_until')) return false;

    const until = nowTs + PROBATION_WINDOW_SECONDS;
    const targets: Array<{ type: string; id: string }> = [{ type: 'message', id: messageId }];

    // Cap the message's chunks too — passive recall surfaces chunks via vector.
    try {
      const chunkRows = this.db
        .prepare(`SELECT chunk_id AS id FROM chunks WHERE related_entity_id = ?`)
        .all(messageId) as Array<{ id: number | string }>;
      for (const row of chunkRows) targets.push({ type: 'chunk', id: String(row.id) });
    } catch {
      /* chunks table shape differences — message-level cap still applies */
    }

    const upsert = this.db.prepare(
      `INSERT INTO memory_metadata
         (target_type, target_id, salience_score, retrieval_tier, effective_salience,
          probation_until, created_at, updated_at, lifecycle_updated_at)
       VALUES (?, ?, ?, 'weak', ?, ?, ?, ?, ?)
       ON CONFLICT(target_type, target_id) DO UPDATE SET
         retrieval_tier = 'weak',
         probation_until = excluded.probation_until,
         updated_at = excluded.updated_at,
         lifecycle_updated_at = excluded.lifecycle_updated_at`,
    );
    const tx = this.db.transaction(() => {
      for (const t of targets) {
        const eff = Math.min(salience, 0.34); // keep within the weak band
        upsert.run(t.type, t.id, salience, eff, until, nowTs, nowTs, nowTs);
      }
    });
    tx();
    return true;
  }

  /**
   * Nightly graduation / expiry pass. A probation row graduates if it was
   * accessed (access_count > 0) — clearing probation and lifting the cap so the
   * normal lifecycle takes over; otherwise, once expired, it is archived.
   */
  processProbation(nowTs: number = now()): ProbationProcessResult {
    const result: ProbationProcessResult = { graduated: 0, expired: 0 };
    if (!this.hasColumn('memory_metadata', 'probation_until')) return result;

    const rows = this.db
      .prepare(
        `SELECT target_type, target_id, salience_score, access_count, probation_until
           FROM memory_metadata
          WHERE probation_until IS NOT NULL`,
      )
      .all() as Array<{
      target_type: string;
      target_id: string;
      salience_score: number | null;
      access_count: number | null;
      probation_until: number;
    }>;

    const graduate = this.db.prepare(
      `UPDATE memory_metadata
          SET probation_until = NULL,
              retrieval_tier = CASE WHEN COALESCE(salience_score, 0) >= 0.35 THEN 'active' ELSE 'weak' END,
              effective_salience = MAX(COALESCE(effective_salience, 0), COALESCE(salience_score, 0)),
              lifecycle_updated_at = ?
        WHERE target_type = ? AND target_id = ?`,
    );
    const expire = this.db.prepare(
      `UPDATE memory_metadata
          SET probation_until = NULL,
              retrieval_tier = 'archive_only',
              consolidation_level = 'archived',
              archived_at = ?,
              archive_reason = 'probation_expired_no_interaction',
              lifecycle_updated_at = ?
        WHERE target_type = ? AND target_id = ?`,
    );

    const tx = this.db.transaction(() => {
      for (const row of rows) {
        const accessed = (row.access_count ?? 0) > 0;
        if (accessed) {
          graduate.run(nowTs, row.target_type, row.target_id);
          result.graduated += 1;
        } else if (row.probation_until <= nowTs) {
          expire.run(nowTs, nowTs, row.target_type, row.target_id);
          result.expired += 1;
        }
        // Not accessed and not yet expired: leave on probation.
      }
    });
    tx();
    return result;
  }
}
