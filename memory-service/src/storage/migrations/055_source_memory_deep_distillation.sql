-- 055_source_memory_deep_distillation.sql
-- Restart-safe deep distillation jobs and evidence-grounded candidate artifacts.

CREATE TABLE IF NOT EXISTS source_memory_distillation_jobs (
  id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL UNIQUE,
  input_hash TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'post_save',
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  lease_expires_at INTEGER,
  last_error TEXT,
  queued_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (capsule_id) REFERENCES source_memory_capsules(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_source_memory_distillation_jobs_due
  ON source_memory_distillation_jobs(status, next_attempt_at, updated_at);

CREATE TABLE IF NOT EXISTS source_memory_evidence_spans (
  id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  span_index INTEGER NOT NULL,
  span_kind TEXT NOT NULL,
  locator TEXT,
  text TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.7,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (capsule_id) REFERENCES source_memory_capsules(id) ON DELETE CASCADE,
  UNIQUE (capsule_id, input_hash, span_index)
);

CREATE INDEX IF NOT EXISTS idx_source_memory_evidence_spans_capsule
  ON source_memory_evidence_spans(capsule_id, input_hash, span_index);

CREATE TABLE IF NOT EXISTS source_memory_distilled_artifacts (
  id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  confidence REAL NOT NULL DEFAULT 0.6,
  evidence_span_ids_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'candidate',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (capsule_id) REFERENCES source_memory_capsules(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_source_memory_distilled_artifacts_capsule
  ON source_memory_distilled_artifacts(capsule_id, input_hash, artifact_type);

ALTER TABLE source_memory_takeaways
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'capture_seed';

ALTER TABLE source_memory_takeaways
  ADD COLUMN distillation_input_hash TEXT;

ALTER TABLE source_memory_triggers
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'capture_seed';

ALTER TABLE source_memory_triggers
  ADD COLUMN distillation_input_hash TEXT;
