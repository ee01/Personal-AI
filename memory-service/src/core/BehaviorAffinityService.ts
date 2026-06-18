import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';

/**
 * BehaviorAffinityService (P0-4): learns a long-horizon "behavioral intimacy"
 * factor from the user's real interaction behavior — the third of the book's
 * three ranking signals (organizational relationship, information nature,
 * behavioral intimacy). The first two already exist (Relationship Radar /
 * importance); this fills the gap.
 *
 * It rolls up the existing outcome ledger (memory_outcome_events) — no new
 * collection — into per-entity and per-source affinity, then recall reads it to
 * nudge ranking. Boundaries:
 * - Ranking signal only: never written to confirmed profile, never triggers a
 *   side effect (no auto-read / auto-subscribe).
 * - Negative affinity is floored at -0.5: ignoring a topic for a while is not a
 *   permanent mute (that is the outcome policy's explicit suppress).
 * - High-frequency-but-shallow signals (hover/expand) carry tiny weight; strong
 *   weight is reserved for terminal actions (send / click / explicit mark).
 */

export interface AffinityRollupResult {
  subjects: number;
  events: number;
  windowDays: number;
}

interface OutcomeEventRow {
  action: string;
  evidence_refs_json: string;
  metadata_json: string | null;
  created_at: number;
}

const ACTION_WEIGHTS: Record<string, number> = {
  sent_after_insert: 1.0,
  inserted: 0.55,
  marked_relevant: 0.6,
  clicked: 0.4,
  expanded: 0.2,
  hover_only: 0.05,
  sent_without_insert: 0.1,
  dismissed: -0.3,
  marked_irrelevant: -1.0,
  wrong: -1.0,
  deleted_before_send: -0.8,
};

const NEGATIVE_FLOOR = -0.5;
const TANH_SCALE = 5;
const HALF_LIFE_DAYS = 30;

export class BehaviorAffinityService {
  constructor(private db: Database.Database) {}

  /** Parse an evidence ref into a subject, tolerating several shapes. */
  private refToParts(ref: unknown): { kind: string; id: string } | null {
    if (typeof ref === 'string') {
      const idx = ref.indexOf(':');
      if (idx > 0) return { kind: ref.slice(0, idx), id: ref.slice(idx + 1) };
      return { kind: 'unknown', id: ref };
    }
    if (ref && typeof ref === 'object') {
      const r = ref as Record<string, unknown>;
      const id = (r.id ?? r.targetId ?? r.messageId ?? r.entityId) as string | undefined;
      const kind = (r.type ?? r.targetType ?? r.kind) as string | undefined;
      if (id) return { kind: (kind || 'unknown').toString(), id: String(id) };
    }
    return null;
  }

  /** Resolve an event's evidence refs into affinity subjects. */
  private subjectsForRefs(refsJson: string): Array<{ type: 'entity' | 'source'; key: string }> {
    let refs: unknown[] = [];
    try {
      const parsed = JSON.parse(refsJson || '[]');
      if (Array.isArray(parsed)) refs = parsed;
    } catch {
      return [];
    }
    const subjects = new Map<string, { type: 'entity' | 'source'; key: string }>();
    const add = (type: 'entity' | 'source', key: string) => {
      if (key) subjects.set(`${type}:${key}`, { type, key });
    };
    for (const ref of refs) {
      const parts = this.refToParts(ref);
      if (!parts) continue;
      if (parts.kind === 'entity') {
        add('entity', parts.id);
      } else if (parts.kind === 'message' || parts.kind === 'chunk' || parts.kind === 'unknown') {
        // Resolve a message/chunk ref to its source type + mentioned entities.
        const msg = this.db
          .prepare('SELECT source_type, entities_json FROM messages_raw WHERE id = ?')
          .get(parts.id) as { source_type: string | null; entities_json: string | null } | undefined;
        if (msg) {
          if (msg.source_type) add('source', msg.source_type);
          try {
            const ents = JSON.parse(msg.entities_json || '[]');
            if (Array.isArray(ents)) {
              for (const e of ents) {
                const eid = typeof e === 'string' ? e : (e && typeof e === 'object' ? (e.id as string) : null);
                if (eid) add('entity', eid);
              }
            }
          } catch {
            /* ignore */
          }
        }
      }
    }
    return [...subjects.values()];
  }

  /**
   * Full recompute from the outcome ledger within the window. Replaces the
   * behavior_affinity table (window-based, no incremental state).
   */
  recompute(options: { windowDays?: number; nowTs?: number } = {}): AffinityRollupResult {
    const windowDays = options.windowDays ?? 90;
    const nowTs = options.nowTs ?? now();
    const cutoff = nowTs - windowDays * 86400;

    const events = this.db
      .prepare(
        `SELECT action, evidence_refs_json, metadata_json, created_at
         FROM memory_outcome_events
         WHERE created_at >= ?`,
      )
      .all(cutoff) as OutcomeEventRow[];

    interface Acc {
      type: 'entity' | 'source';
      key: string;
      sum: number;
      positive: number;
      negative: number;
      lastAt: number;
    }
    const acc = new Map<string, Acc>();

    for (const ev of events) {
      const baseWeight = ACTION_WEIGHTS[ev.action];
      if (baseWeight === undefined || baseWeight === 0) continue;
      const ageDays = Math.max(0, (nowTs - ev.created_at) / 86400);
      const decay = Math.exp(-ageDays / HALF_LIFE_DAYS);
      const contribution = baseWeight * decay;
      const subjects = this.subjectsForRefs(ev.evidence_refs_json);
      for (const s of subjects) {
        const k = `${s.type}:${s.key}`;
        let a = acc.get(k);
        if (!a) {
          a = { type: s.type, key: s.key, sum: 0, positive: 0, negative: 0, lastAt: 0 };
          acc.set(k, a);
        }
        a.sum += contribution;
        if (baseWeight > 0) a.positive += 1;
        else a.negative += 1;
        a.lastAt = Math.max(a.lastAt, ev.created_at);
      }
    }

    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM behavior_affinity').run();
      const insert = this.db.prepare(
        `INSERT INTO behavior_affinity
           (id, subject_type, subject_key, affinity, positive_events, negative_events, last_event_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const [k, a] of acc) {
        const affinity = Math.min(1, Math.max(NEGATIVE_FLOOR, Math.tanh(a.sum / TANH_SCALE)));
        insert.run(k, a.type, a.key, affinity, a.positive, a.negative, a.lastAt, nowTs);
      }
    });
    tx();

    return { subjects: acc.size, events: events.length, windowDays };
  }

  /** Load all affinities into a Map keyed by `${subject_type}:${subject_key}`. */
  getAffinityMap(): Map<string, number> {
    const rows = this.db
      .prepare('SELECT subject_type, subject_key, affinity FROM behavior_affinity')
      .all() as Array<{ subject_type: string; subject_key: string; affinity: number }>;
    const map = new Map<string, number>();
    for (const r of rows) map.set(`${r.subject_type}:${r.subject_key}`, r.affinity);
    return map;
  }
}
