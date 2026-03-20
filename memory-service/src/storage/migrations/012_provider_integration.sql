-- 012_provider_integration.sql
-- Provider bindings and sync job tracking for external AI bridge integrations.

CREATE TABLE IF NOT EXISTS provider_bindings (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  binding_type TEXT NOT NULL,
  external_thread_id TEXT NOT NULL,
  title TEXT,
  device_id TEXT,
  metadata_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_synced_at INTEGER,
  last_sync_job_id TEXT,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider, binding_type)
);

CREATE INDEX IF NOT EXISTS idx_provider_bindings_provider
  ON provider_bindings(provider);

CREATE INDEX IF NOT EXISTS idx_provider_bindings_provider_binding_type
  ON provider_bindings(provider, binding_type);

CREATE TABLE IF NOT EXISTS provider_sync_jobs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  scenario TEXT NOT NULL,
  binding_type TEXT NOT NULL,
  binding_id TEXT,
  title TEXT,
  status TEXT NOT NULL,
  request_json TEXT NOT NULL,
  response_json TEXT,
  result_json TEXT,
  error_message TEXT,
  dedupe_key TEXT,
  source_refs_json TEXT,
  token_budget INTEGER,
  freshness_window_days INTEGER,
  device_context TEXT,
  external_thread_id TEXT,
  provider_message_id TEXT,
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_sync_jobs_provider_created
  ON provider_sync_jobs(provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_sync_jobs_provider_status_created
  ON provider_sync_jobs(provider, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_sync_jobs_provider_binding_type_created
  ON provider_sync_jobs(provider, binding_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_sync_jobs_dedupe_key
  ON provider_sync_jobs(provider, dedupe_key);
