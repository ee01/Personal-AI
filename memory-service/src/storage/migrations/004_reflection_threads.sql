-- 004_reflection_threads.sql
-- Continuous reflection thread model

CREATE TABLE IF NOT EXISTS reflection_threads (
  id TEXT PRIMARY KEY,
  topic_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  priority INTEGER NOT NULL DEFAULT 5,
  salience REAL NOT NULL DEFAULT 0.5,
  source_type TEXT,
  source_ref_id TEXT,
  current_hypothesis TEXT,
  open_questions_json TEXT,
  latest_summary TEXT,
  latest_markdown_path TEXT,
  next_reflection_at INTEGER,
  last_reflected_at INTEGER,
  reflection_count INTEGER NOT NULL DEFAULT 0,
  continue_reason TEXT,
  closure_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reflection_threads_status
  ON reflection_threads(status, next_reflection_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS reflection_runs (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  run_type TEXT NOT NULL,
  trigger_type TEXT,
  input_refs_json TEXT,
  previous_run_id TEXT,
  summary TEXT NOT NULL,
  hypothesis_before TEXT,
  hypothesis_after TEXT,
  discoveries_json TEXT,
  open_questions_json TEXT,
  actions_json TEXT,
  markdown_snapshot_path TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES reflection_threads(id)
);

CREATE INDEX IF NOT EXISTS idx_reflection_runs_thread_created
  ON reflection_runs(thread_id, created_at DESC);

CREATE TABLE IF NOT EXISTS dream_runs (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_ref_id TEXT,
  thread_ids_json TEXT,
  summary TEXT,
  insights_json TEXT,
  risks_json TEXT,
  relationships_json TEXT,
  markdown_path TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dream_runs_created
  ON dream_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS topic_memory_links (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  role TEXT NOT NULL DEFAULT 'evidence',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES reflection_threads(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_memory_links_unique
  ON topic_memory_links(thread_id, source_kind, source_id, role);

CREATE INDEX IF NOT EXISTS idx_topic_memory_links_thread
  ON topic_memory_links(thread_id, role, created_at DESC);
