/**
 * v3 UnitEmbeddingWorker (P2 slice 2, plan §4.4/§11.5): fills the
 * unit_views_vec_e5 projection from the projection_outbox.
 *
 * Channel policy (plan §5.5): e5-small is a PREFIX-BOUND configuration —
 * passages embed with `passage: `, queries with `query: `. A vector
 * channel missing its prefixes is a different configuration and never
 * shares thresholds or indexes with anything else.
 *
 * The worker is driven by the heartbeat sweep (bounded per cycle) and is
 * a no-op unless MEMORY_READ_V3_VECTOR=e5 — the projection is only worth
 * building when the read channel is on.
 */

import type Database from 'better-sqlite3';

export type UnitVectorChannel = '' | 'e5';

export function getUnitVectorChannel(): UnitVectorChannel {
  const raw = process.env.MEMORY_READ_V3_VECTOR?.trim().toLowerCase();
  if (raw === 'e5') return 'e5';
  return '';
}

/**
 * Module-cached e5 pipeline (Xenova ONNX, ~120MB quantized). Loaded once
 * per process on first use; load failures are logged and retried on the
 * next call (no permanent-unavailable caching — §9.6).
 */
let e5Pipeline: Awaited<ReturnType<typeof loadE5Pipeline>> | null | undefined;

async function loadE5Pipeline() {
  const { pipeline } = await import('@xenova/transformers');
  return pipeline('feature-extraction', 'Xenova/multilingual-e5-small', {
    quantized: true,
  });
}

async function getE5() {
  if (e5Pipeline !== undefined) return e5Pipeline;
  try {
    e5Pipeline = await loadE5Pipeline();
    console.log('[UnitEmbeddingWorker] multilingual-e5-small loaded');
  } catch (err) {
    e5Pipeline = null;
    console.warn(
      '[UnitEmbeddingWorker] e5 load failed; vector channel unavailable this round:',
      (err as Error).message,
    );
  }
  return e5Pipeline;
}

export async function embedWithE5(text: string, prefix: 'query:' | 'passage:'): Promise<number[]> {
  const extractor = await getE5();
  if (!extractor) throw new Error('e5_pipeline_unavailable');
  const out = await extractor(`${prefix} ${text}`, { pooling: 'mean', normalize: true });
  return out.tolist()[0];
}

/** Test hook: inject a fake pipeline so tests never download the model. */
export function setE5PipelineForTesting(
  fn: ((text: string, opts?: Record<string, unknown>) => Promise<{ tolist(): number[][] }>) | null,
): void {
  e5Pipeline = fn as never;
}

export class UnitEmbeddingWorker {
  constructor(private readonly db: Database.Database) {}

  /** Embed one body view into unit_views_vec_e5 (idempotent per view). */
  async embedUnitBody(unitId: string, revision: number): Promise<boolean> {
    const view = this.db
      .prepare(
        `SELECT view_id, raw_text FROM memory_unit_views
         WHERE unit_id = ? AND view_kind = 'body' AND source_unit_revision = ?`,
      )
      .get(unitId, revision) as { view_id: number; raw_text: string } | undefined;
    if (!view) return false;
    const embedding = await embedWithE5(view.raw_text, 'passage:');
    this.db
      .prepare(
        `INSERT OR REPLACE INTO unit_views_vec_e5 (view_id, embedding)
         VALUES (CAST(? AS INTEGER), ?)`,
      )
      .run(view.view_id, JSON.stringify(embedding));
    return true;
  }

  /**
   * Drain up to `limit` pending outbox entries for the e5 vector projection.
   * Marks them done/stale; failures stay pending with attempts+error.
   */
  async processDueOutbox(limit = 20): Promise<{ done: number; failed: number; skipped: number }> {
    if (getUnitVectorChannel() !== 'e5') return { done: 0, failed: 0, skipped: 0 };
    const pending = this.db
      .prepare(
        `SELECT projection_key, unit_id, source_unit_revision, attempts
         FROM projection_outbox
         WHERE status = 'pending' AND view_kind = 'body'
         ORDER BY created_at ASC LIMIT ?`,
      )
      .all(limit) as Array<{
      projection_key: string;
      unit_id: string;
      source_unit_revision: number;
      attempts: number;
    }>;

    let done = 0;
    let failed = 0;
    for (const task of pending) {
      try {
        const embedded = await this.embedUnitBody(task.unit_id, task.source_unit_revision);
        if (embedded) {
          this.db
            .prepare(
              `UPDATE projection_outbox SET status = 'done', attempts = attempts + 1, updated_at = ?
               WHERE projection_key = ?`,
            )
            .run(Math.floor(Date.now() / 1000), task.projection_key);
          done += 1;
        } else {
          // View missing (e.g. unit superseded): mark stale, never re-embed.
          this.db
            .prepare(
              `UPDATE projection_outbox SET status = 'stale', updated_at = ?
               WHERE projection_key = ?`,
            )
            .run(Math.floor(Date.now() / 1000), task.projection_key);
          failed += 1;
        }
      } catch (err) {
        failed += 1;
        this.db
          .prepare(
            `UPDATE projection_outbox SET attempts = attempts + 1, last_error = ?, updated_at = ?
             WHERE projection_key = ?`,
          )
          .run((err as Error).message.slice(0, 200), Math.floor(Date.now() / 1000), task.projection_key);
      }
    }
    return { done, failed, skipped: 0 };
  }
}