/**
 * v3 UnitRecallReader (memory-foundation plan §7/§11.7, P2 slice 1):
 * reads the v3 truth plane (memory_units + projections) for dual-read
 * shadow comparison against the legacy chunk/message recall.
 *
 * Hard invariants encoded here (plan §4.2/§7.2/§7.5):
 *   I6  retracted/quarantined/deletion_pending/archived units never return
 *       (status gate via JOIN — a projection row alone is not enough).
 *   I8  results are unit-deduplicated by construction (one row per unit).
 *   I11 reader is SHADOW-only: no access reinforcement, no exposure records.
 *
 * Channels (P0.5 adjudicated):
 *   - lexical-segment (porter, unit_views_fts_seg over segmented text)
 *   - lexical-trigram (unit_views_fts_tri, CJK substring recall; +5.2pp CI)
 *   - vector deferred: units corpus is still small (P1 shadow); e5-small is
 *     the adjudicated candidate (§11.5) and joins as a channel when
 *     unit_views_vec lands.
 */

import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';

export interface UnitRecallCandidate {
  unitId: string;
  kind: string;
  text: string;
  language: string | null;
  observedAt: number | null;
  status: string;
  /** Channels that surfaced this unit (per-unit best rank per channel). */
  channels: string[];
  score: number;
}

export interface UnitRecallResult {
  candidates: UnitRecallCandidate[];
  channelStats: { channel: string; candidateCount: number }[];
  queryTimeMs: number;
}

/** Statuses that may participate in recall (§4.3). */
const RECALLABLE_STATUSES = "('provisional', 'active', 'disputed')";

/**
 * F5 fix (reviewed-plan §3.1): server-side policy context that the reader
 * must receive before being wired into user-visible paths.
 */
export interface ReadPolicyContext {
  /** Restrict to specific scope locator (e.g. 'work'). Null = no scope filter. */
  scopeLocator?: string | null;
  /** Maximum sensitivity the caller may see. Higher levels are filtered. */
  maxSensitivity?: 'public' | 'internal' | 'private' | 'restricted';
  /** Only return units with at least one source in these evidence classes. */
  allowedEvidenceClasses?: string[] | null;
  /** Temporal query mode: current facts vs historical vs audit. */
  temporalMode?: 'current' | 'historical' | 'audit';
  /** For historical/audit: return facts valid at this epoch time. */
  asOfValid?: number | null;
}

const SENSITIVITY_RANK = { public: 0, internal: 1, private: 2, restricted: 3 };

export class UnitRecallReader {
  constructor(private readonly db: Database.Database) {}

  /**
   * Async read: lexical channels + the e5 vector channel when enabled.
   * Same fusion/dedup/status rules as recall().
   */
  async recallAsync(queryText: string, limit = 20): Promise<UnitRecallResult> {
    const { getUnitVectorChannel, embedWithE5 } = await import(
      './UnitEmbeddingWorker.js'
    );
    if (getUnitVectorChannel() === 'e5') {
      try {
        const started = Date.now();
        const embedding = await embedWithE5(queryText, 'query:');
        const rows = this.db
          .prepare(
            `SELECT v.view_id, v.unit_id
             FROM unit_views_vec_e5 vec
             JOIN memory_unit_views v ON v.view_id = vec.view_id
             JOIN memory_units u ON u.id = v.unit_id
             WHERE u.status IN ${RECALLABLE_STATUSES}
             ORDER BY vec_distance_cosine(vec.embedding, ?)
             LIMIT 50`,
          )
          .all(JSON.stringify(embedding)) as Array<{ view_id: number; unit_id: string }>;
        const map = new Map<string, number>();
        rows.forEach((r, idx) => {
          if (!map.has(r.unit_id)) map.set(r.unit_id, idx);
        });
        if (map.size > 0) {
          const precomputed = new Map<string, Map<string, number>>([
            ['vector_e5', map],
          ]);
          return this.recall(queryText, limit, precomputed);
        }
      } catch (err) {
        console.warn(
          '[UnitRecallReader] vector_e5 channel failed (degrading to lexical-only):',
          (err as Error).message,
        );
      }
    }
    return this.recall(queryText, limit);
  }

  recall(
    queryText: string,
    limit = 20,
    precomputedChannels?: Map<string, Map<string, number>>,
    policy?: ReadPolicyContext,
  ): UnitRecallResult {
    const policyGate = policy ?? {};
    const started = Date.now();
    const perChannel = new Map<string, Map<string, number>>(); // channel → unitId → rank

    this.lexicalChannel(
      'lexical_seg',
      'unit_views_fts_seg',
      sanitizeSegQuery(queryText),
      perChannel,
    );
    this.lexicalChannel(
      'lexical_tri',
      'unit_views_fts_tri',
      buildTriFtsQuery(queryText),
      perChannel,
    );
    // e5 vector channel (P2 slice 2): prefetched by recallAsync (async embed),
    // passed in as unit-id → rank. I6 status gate was applied in SQL there
    // and is re-applied at hydration below.
    if (precomputedChannels) {
      for (const [channel, map] of precomputedChannels) {
        if (map.size > 0) perChannel.set(channel, map);
      }
    }

    // RRF across channels; per-unit dedup is inherent (unit-keyed).
    const rrfK = 60;
    const fused = new Map<string, { channels: string[]; score: number }>();
    for (const [channel, units] of perChannel) {
      for (const [unitId, rank] of units) {
        const entry = fused.get(unitId) ?? { channels: [], score: 0 };
        entry.channels.push(channel);
        entry.score += 1 / (rrfK + rank + 1);
        fused.set(unitId, entry);
      }
    }

    const top = [...fused.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, limit);

    const metaStmt = this.db.prepare(
      `SELECT kind, text, language, observed_at, status, scope_locator, sensitivity,
              valid_from, valid_to
       FROM memory_units WHERE id = ?`,
    );
    const candidates: UnitRecallCandidate[] = [];
    for (const [unitId, entry] of top) {
      const row = metaStmt.get(unitId) as
        | {
            kind: string; text: string; language: string | null;
            observed_at: number | null; status: string;
            scope_locator: string | null; sensitivity: string;
            valid_from: number | null; valid_to: number | null;
          }
        | undefined;
      if (!row) continue;
      // Re-verify status at read time (I6: projection can lag truth).
      if (!['provisional', 'active', 'disputed'].includes(row.status)) continue;

      // F5 fix: scope gate — filter by scope_locator when policy specifies it.
      if (policyGate.scopeLocator != null && row.scope_locator !== policyGate.scopeLocator) {
        continue;
      }

      // F5 fix: sensitivity gate — filter out more-sensitive-than-allowed items.
      if (
        policyGate.maxSensitivity &&
        SENSITIVITY_RANK[(row.sensitivity as keyof typeof SENSITIVITY_RANK) ?? 'internal']
          > SENSITIVITY_RANK[policyGate.maxSensitivity]
      ) {
        continue;
      }

      // F5 fix: temporal gate — current mode checks valid_from/to is active now.
      if (policyGate.temporalMode === 'current') {
        const nowSec = Math.floor(Date.now() / 1000);
        if (row.valid_from != null && row.valid_from > nowSec) continue;
        if (row.valid_to != null && row.valid_to <= nowSec) continue;
      } else if (policyGate.temporalMode === 'historical' && policyGate.asOfValid != null) {
        const t = policyGate.asOfValid;
        if (row.valid_from != null && row.valid_from > t) continue;
        if (row.valid_to != null && row.valid_to <= t) continue;
      }
      candidates.push({
        unitId,
        kind: row.kind,
        text: row.text,
        language: row.language,
        observedAt: row.observed_at,
        status: row.status,
        channels: entry.channels,
        score: Number(entry.score.toFixed(6)),
      });
    }

    return {
      candidates,
      channelStats: [...perChannel.entries()].map(([channel, units]) => ({
        channel,
        candidateCount: units.size,
      })),
      queryTimeMs: Date.now() - started,
    };
  }

  /**
   * Lexical channel over a unit-views FTS table. External content joins back
   * through memory_unit_views → memory_units; the status gate happens in SQL
   * (§5.4: FTS joins to the truth table for status filtering) and again at
   * hydration time.
   */
  private lexicalChannel(
    channel: string,
    table: string,
    ftsQuery: string,
    perChannel: Map<string, Map<string, number>>,
  ): void {
    if (!ftsQuery) return;
    let rows: Array<{ unit_id: string }> = [];
    try {
      rows = this.db
        .prepare(
          `SELECT v.unit_id
           FROM ${table} f
           JOIN memory_unit_views v ON v.view_id = f.rowid
           JOIN memory_units u ON u.id = v.unit_id
           WHERE ${table} MATCH ?
             AND u.status IN ${RECALLABLE_STATUSES}
           ORDER BY rank
           LIMIT 50`,
        )
        .all(ftsQuery) as Array<{ unit_id: string }>;
    } catch (err) {
      // Missing table/tokenizer must degrade, never break the shadow probe.
      console.warn(`[UnitRecallReader] ${channel} failed:`, (err as Error).message);
      return;
    }
    const map = perChannel.get(channel) ?? new Map<string, number>();
    rows.forEach((row, idx) => {
      if (!map.has(row.unit_id)) map.set(row.unit_id, idx);
    });
    perChannel.set(channel, map);
  }
}

function sanitizeSegQuery(query: string): string {
  const cleaned = query.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  if (!cleaned) return '';
  return cleaned.split(/\s+/).map((t) => `"${t}"`).join(' OR ');
}

/** CJK 4-gram sliding windows + latin fragments, OR-joined (same as shadow). */
function buildTriFtsQuery(queryText: string): string {
  const cleaned = queryText.replace(/["'^\-:()\[\]{}*+]/g, ' ').trim();
  if (!cleaned.length) return '';
  const fragments: string[] = [];
  for (const token of cleaned.match(/[\u3400-\u9fff]{3,}|[a-zA-Z0-9][a-zA-Z0-9._:-]{2,}/gu) ?? []) {
    if (!/[\u3400-\u9fff]/.test(token) || token.length <= 6) {
      fragments.push(token);
      continue;
    }
    for (let i = 0; i + 4 <= token.length && fragments.length < 10; i += 1) {
      fragments.push(token.slice(i, i + 4));
    }
  }
  if (fragments.length === 0) return '';
  return fragments.slice(0, 10).map((f) => JSON.stringify(f)).join(' OR ');
}

/** Deterministic request id for shadow diff correlation. */
export function shadowRequestId(query: string, ts = Date.now()): string {
  return createHash('sha256').update(`${ts}:${query}`).digest('hex').slice(0, 16);
}