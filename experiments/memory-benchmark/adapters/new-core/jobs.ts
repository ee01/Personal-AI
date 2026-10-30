import type Database from "better-sqlite3";
import { bumpWatermark, getMeta, setMeta } from "./db.js";
import { embedText, serializeVector } from "./embedding.js";
import { monotonicNowMs } from "./clock.js";

export type JobKind = "vec_embed" | "consolidate_receipt";
export type JobStatus = "pending" | "running" | "done" | "failed";

export interface VecEmbedPayload {
  event_id: string;
  source_version: string;
  scope: string;
  text: string;
  observed_at_ms: number;
}

export interface JobHandlers {
  traceIngestVec: (eventId: string, latencyMs: number, atMs: number) => void;
}

export function enqueueVecEmbedJob(db: Database.Database, payload: VecEmbedPayload): void {
  const jobKey = `vec:${payload.event_id}:${payload.source_version}`;
  db.prepare(
    `INSERT OR IGNORE INTO async_jobs (job_key, kind, status, payload_json, created_at_ms, attempt)
     VALUES (?, 'vec_embed', 'pending', ?, ?, 0)`,
  ).run(jobKey, JSON.stringify(payload), payload.observed_at_ms);
}

export async function drainPendingJobs(
  db: Database.Database,
  handlers: JobHandlers,
): Promise<{ processed: number; vec_index_build_ms: number }> {
  let processed = 0;
  let vecBuildMs = 0;
  const rows = db
    .prepare(
      `SELECT job_key, kind, payload_json, attempt FROM async_jobs
       WHERE status IN ('pending','failed') ORDER BY created_at_ms, job_key`,
    )
    .all() as Array<{ job_key: string; kind: string; payload_json: string; attempt: number }>;

  for (const row of rows) {
    db.prepare("UPDATE async_jobs SET status='running', attempt=attempt+1 WHERE job_key=?").run(
      row.job_key,
    );
    const t0 = monotonicNowMs();
    try {
      if (row.kind === "vec_embed") {
        const payload = JSON.parse(row.payload_json) as VecEmbedPayload;
        const vec = await embedText(payload.text);
        db.prepare(
          `INSERT OR REPLACE INTO event_vectors (event_id, source_version, scope, vec)
           VALUES (?,?,?,?)`,
        ).run(payload.event_id, payload.source_version, payload.scope, serializeVector(vec));
        bumpWatermark(db, "vec_index", payload.observed_at_ms);
        handlers.traceIngestVec(payload.event_id, monotonicNowMs() - t0, payload.observed_at_ms);
      }
      db.prepare(
        "UPDATE async_jobs SET status='done', completed_at_ms=? WHERE job_key=?",
      ).run(Date.now(), row.job_key);
      processed += 1;
      if (row.kind === "vec_embed") vecBuildMs += monotonicNowMs() - t0;
    } catch (e) {
      db.prepare(
        "UPDATE async_jobs SET status='failed', error=? WHERE job_key=?",
      ).run(e instanceof Error ? e.message : String(e), row.job_key);
    }
  }

  const prev = Number(getMeta(db, "vec_index_build_ms")) || 0;
  if (vecBuildMs > 0) setMeta(db, "vec_index_build_ms", String(prev + vecBuildMs));
  return { processed, vec_index_build_ms: vecBuildMs };
}

export function listJobs(db: Database.Database): unknown[] {
  return db.prepare("SELECT * FROM async_jobs ORDER BY created_at_ms, job_key").all();
}

export interface OutboxInsert {
  decision_id: string;
  idempotency_key: string;
  scene: string;
  target: string;
  action: string;
  evidence_refs_json: string;
  reason_codes_json: string;
  value_score: number;
  created_at_virtual: string;
  created_at_ms: number;
  scope: string;
  acl_epoch: number;
}

export function enqueueDecisionOutbox(db: Database.Database, row: OutboxInsert): void {
  db.prepare(
    `INSERT OR IGNORE INTO decision_outbox (
      decision_id, idempotency_key, scene, target, action, status,
      evidence_refs_json, reason_codes_json, value_score,
      created_at_virtual, created_at_ms, scope, acl_epoch
    ) VALUES (?,?,?,?,?,'queued',?,?,?,?,?,?,?)`,
  ).run(
    row.decision_id,
    row.idempotency_key,
    row.scene,
    row.target,
    row.action,
    row.evidence_refs_json,
    row.reason_codes_json,
    row.value_score,
    row.created_at_virtual,
    row.created_at_ms,
    row.scope,
    row.acl_epoch,
  );
}

export function cancelOutboxForScope(db: Database.Database, scope: string): void {
  db.prepare(
    `UPDATE decision_outbox SET status='cancelled'
     WHERE scope=? AND status IN ('queued','proposed')`,
  ).run(scope);
}

export function listOutbox(db: Database.Database): unknown[] {
  return db.prepare("SELECT * FROM decision_outbox ORDER BY created_at_ms").all();
}
