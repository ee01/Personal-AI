-- 028_reflection_research_attempts.sql
-- Audit local memory lookups performed inside reflection runs.

CREATE TABLE IF NOT EXISTS reflection_research_attempts (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  run_id TEXT,
  query TEXT NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  source_types_json TEXT,
  project_filter TEXT,
  sender_filter_json TEXT,
  group_filter_json TEXT,
  error_message TEXT,
  evidence_refs_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES reflection_threads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reflection_research_attempts_thread_created
  ON reflection_research_attempts(thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reflection_research_attempts_run
  ON reflection_research_attempts(run_id);
