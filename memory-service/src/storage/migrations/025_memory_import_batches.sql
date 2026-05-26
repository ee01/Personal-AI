CREATE TABLE IF NOT EXISTS memory_import_batches (
  id TEXT PRIMARY KEY,
  input_kind TEXT NOT NULL,
  detected_kind TEXT NOT NULL,
  source_name TEXT,
  source_hash TEXT NOT NULL,
  source_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  summary_json TEXT NOT NULL DEFAULT '{}',
  warnings_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  committed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_memory_import_batches_hash
  ON memory_import_batches(source_hash, status);

CREATE INDEX IF NOT EXISTS idx_memory_import_batches_created
  ON memory_import_batches(created_at DESC);
