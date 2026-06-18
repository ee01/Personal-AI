import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';

/**
 * SkillQualityGateService (P2-11). Procedural memory (Skill Foundry skills) needs
 * a quality gate + retirement, because the Experience-Following effect compounds
 * bad experiences as fast as good ones. This is a SEPARATE layer over
 * skills.status — it records an execution ledger and derives a health/lifecycle
 * gate state, so only validated/positively-reinforced skills are suggested.
 *
 * Lifecycle (skill_health.gate_state):
 *   candidate   — new distilled skill (starting point)
 *   active      — evidence >= 3 AND health >= 0.6 (writing-style dual-threshold)
 *   degraded    — health < 0.4 OR 3 consecutive failures (off suggestions/injection)
 *   retired     — degraded for >= 30 days without recovery (archived, recoverable)
 *   user_pinned — user-pinned: exempt from auto-degrade (user intent is highest)
 */

export type SkillGateState = 'candidate' | 'active' | 'degraded' | 'retired' | 'user_pinned';
export type SkillOutcome = 'success' | 'failure' | 'partial' | 'unknown';

export interface RecordExecutionInput {
  skillId: string;
  outcome: SkillOutcome;
  signalSource: 'binding_sync' | 'user_feedback' | 'action_result' | 'outcome_event';
  version?: string;
  platform?: string;
  detail?: Record<string, unknown>;
}

export interface SkillHealth {
  skillId: string;
  gateState: SkillGateState;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  health: number;
  pinned: boolean;
}

const PROMOTE_MIN_EVIDENCE = 3;
// Wilson lower bound is conservative: 5/5 ~= 0.57, 8/8 ~= 0.67. 0.55 promotes a
// skill with ~5 clean successes (the plan's "5 evidence -> active") while still
// requiring a solid track record.
const PROMOTE_MIN_HEALTH = 0.55;
const DEGRADE_HEALTH = 0.4;
const DEGRADE_CONSECUTIVE = 3;
const RETIRE_AFTER_DAYS = 30;

/** Wilson lower bound (95%) — conservative for small samples. */
function wilsonLowerBound(success: number, total: number): number {
  if (total === 0) return 0;
  const z = 1.96;
  const phat = success / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const centre = phat + z2 / (2 * total);
  const margin = z * Math.sqrt((phat * (1 - phat) + z2 / (4 * total)) / total);
  return Math.max(0, (centre - margin) / denom);
}

export class SkillQualityGateService {
  constructor(private db: Database.Database) {}

  private hasTable(): boolean {
    return !!this.db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='skill_health'`)
      .get();
  }

  recordExecution(input: RecordExecutionInput): SkillHealth | null {
    if (!this.hasTable()) return null;
    const nowTs = now();
    this.db
      .prepare(
        `INSERT INTO skill_executions
           (id, skill_id, version, platform, outcome, signal_source, detail_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        `exec-${nowTs}-${nextExecSeq()}-${Math.abs(hashStr(input.skillId)) % 1000}`,
        input.skillId,
        input.version ?? null,
        input.platform ?? null,
        input.outcome,
        input.signalSource,
        input.detail ? JSON.stringify(input.detail) : null,
        nowTs,
      );
    return this.recompute(input.skillId, nowTs);
  }

  /** Recompute health + lifecycle for a skill from its ledger. */
  recompute(skillId: string, nowTs: number = now()): SkillHealth {
    // unknown outcomes do not count in the health denominator (sparse signals).
    const rows = this.db
      .prepare(
        `SELECT outcome FROM skill_executions WHERE skill_id = ? ORDER BY created_at ASC`,
      )
      .all(skillId) as Array<{ outcome: SkillOutcome }>;
    let success = 0;
    let failure = 0;
    let consecutive = 0;
    for (const r of rows) {
      if (r.outcome === 'success') {
        success += 1;
        consecutive = 0;
      } else if (r.outcome === 'failure') {
        failure += 1;
        consecutive += 1;
      } else if (r.outcome === 'partial') {
        // partial counts as a half-failure for consecutive tracking only.
        consecutive = 0;
      }
    }
    const total = success + failure;
    const health = wilsonLowerBound(success, total);

    const existing = this.db
      .prepare(`SELECT gate_state, pinned, degraded_at FROM skill_health WHERE skill_id = ?`)
      .get(skillId) as { gate_state: SkillGateState; pinned: number; degraded_at: number | null } | undefined;
    const pinned = existing?.pinned === 1;

    let gateState: SkillGateState;
    let degradedAt: number | null = existing?.degraded_at ?? null;
    if (pinned) {
      gateState = 'user_pinned';
    } else if (consecutive >= DEGRADE_CONSECUTIVE || (failure >= 1 && total >= 3 && health < DEGRADE_HEALTH)) {
      gateState = 'degraded';
      degradedAt = degradedAt ?? nowTs;
      // Retire if it has been degraded long enough without recovery.
      if (existing?.gate_state === 'degraded' && degradedAt && nowTs - degradedAt >= RETIRE_AFTER_DAYS * 86400) {
        gateState = 'retired';
      }
    } else if (total >= PROMOTE_MIN_EVIDENCE && health >= PROMOTE_MIN_HEALTH) {
      gateState = 'active';
      degradedAt = null;
    } else {
      gateState = existing?.gate_state === 'active' ? 'active' : 'candidate';
      degradedAt = null;
    }

    this.db
      .prepare(
        `INSERT INTO skill_health
           (skill_id, gate_state, success_count, failure_count, consecutive_failures, health,
            pinned, degraded_at, last_outcome_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(skill_id) DO UPDATE SET
           gate_state = excluded.gate_state,
           success_count = excluded.success_count,
           failure_count = excluded.failure_count,
           consecutive_failures = excluded.consecutive_failures,
           health = excluded.health,
           degraded_at = excluded.degraded_at,
           last_outcome_at = excluded.last_outcome_at,
           updated_at = excluded.updated_at`,
      )
      .run(skillId, gateState, success, failure, consecutive, health, pinned ? 1 : 0, degradedAt, nowTs, nowTs);

    return {
      skillId,
      gateState,
      successCount: success,
      failureCount: failure,
      consecutiveFailures: consecutive,
      health,
      pinned,
    };
  }

  getHealth(skillId: string): SkillHealth | null {
    if (!this.hasTable()) return null;
    const row = this.db
      .prepare(
        `SELECT skill_id, gate_state, success_count, failure_count, consecutive_failures, health, pinned
           FROM skill_health WHERE skill_id = ?`,
      )
      .get(skillId) as
      | {
          skill_id: string;
          gate_state: SkillGateState;
          success_count: number;
          failure_count: number;
          consecutive_failures: number;
          health: number;
          pinned: number;
        }
      | undefined;
    if (!row) return null;
    return {
      skillId: row.skill_id,
      gateState: row.gate_state,
      successCount: row.success_count,
      failureCount: row.failure_count,
      consecutiveFailures: row.consecutive_failures,
      health: row.health,
      pinned: row.pinned === 1,
    };
  }

  /** Pin/unpin a skill (user intent exempts it from auto-degrade). */
  setPinned(skillId: string, pinned: boolean): SkillHealth | null {
    if (!this.hasTable()) return null;
    const nowTs = now();
    this.db
      .prepare(
        `INSERT INTO skill_health (skill_id, gate_state, pinned, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(skill_id) DO UPDATE SET pinned = excluded.pinned, updated_at = excluded.updated_at`,
      )
      .run(skillId, pinned ? 'user_pinned' : 'candidate', pinned ? 1 : 0, nowTs);
    return this.recompute(skillId, nowTs);
  }

  /** Skill ids that are eligible for suggestions / injection (active|user_pinned). */
  suggestibleSkillIds(): Set<string> {
    if (!this.hasTable()) return new Set();
    const rows = this.db
      .prepare(`SELECT skill_id FROM skill_health WHERE gate_state IN ('active', 'user_pinned')`)
      .all() as Array<{ skill_id: string }>;
    return new Set(rows.map((r) => r.skill_id));
  }

  /** True when a skill must be hidden from suggestions (degraded|retired). */
  isSuppressed(skillId: string): boolean {
    const h = this.getHealth(skillId);
    return !!h && (h.gateState === 'degraded' || h.gateState === 'retired');
  }
}

let _execSeq = 0;
function nextExecSeq(): number {
  _execSeq = (_execSeq + 1) % 1_000_000;
  return _execSeq;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}
