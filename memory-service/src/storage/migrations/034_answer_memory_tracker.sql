-- Answer memory tracker.
--
-- Observations are lightweight Ask outcomes used to detect repeated questions.
-- Threads/versions are only promoted for durable answer needs.

CREATE TABLE IF NOT EXISTS answer_memory_observations (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  canonical_key TEXT NOT NULL,
  canonical_question TEXT NOT NULL,
  topic_label TEXT NOT NULL,
  topic_id TEXT,
  intent TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  answer_hash TEXT NOT NULL,
  evidence_hash TEXT,
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  context_match_json TEXT NOT NULL DEFAULT '{}',
  recall_diagnostics_json TEXT NOT NULL DEFAULT '[]',
  promoted_thread_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_answer_memory_observations_key_time
  ON answer_memory_observations(canonical_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_answer_memory_observations_request
  ON answer_memory_observations(request_id);

CREATE TABLE IF NOT EXISTS answer_memory_threads (
  id TEXT PRIMARY KEY,
  canonical_key TEXT NOT NULL UNIQUE,
  canonical_question TEXT NOT NULL,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  topic_label TEXT NOT NULL,
  topic_id TEXT,
  intent TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  ask_count INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  current_version_id TEXT,
  evidence_hash TEXT,
  unknowns_json TEXT NOT NULL DEFAULT '[]',
  change_conditions_json TEXT NOT NULL DEFAULT '[]',
  last_asked_at INTEGER,
  last_verified_at INTEGER,
  stale_after INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_answer_memory_threads_status
  ON answer_memory_threads(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_answer_memory_threads_updated
  ON answer_memory_threads(updated_at DESC);

CREATE TABLE IF NOT EXISTS answer_memory_versions (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  answer_md TEXT NOT NULL,
  stance TEXT NOT NULL DEFAULT 'unknown',
  confidence REAL NOT NULL DEFAULT 0,
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  missing_evidence_json TEXT NOT NULL DEFAULT '[]',
  recall_diagnostics_json TEXT NOT NULL DEFAULT '[]',
  answer_hash TEXT NOT NULL,
  evidence_hash TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES answer_memory_threads(id)
);

CREATE INDEX IF NOT EXISTS idx_answer_memory_versions_thread_time
  ON answer_memory_versions(thread_id, created_at DESC);
