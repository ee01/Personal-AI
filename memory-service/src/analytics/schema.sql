-- Standalone analytics database schema for the usage-analytics system.
--
-- This database is NOT part of the per-user numbered migration system. It is
-- a single centralized SQLite file (${DATA_DIR}/analytics/usage.db) whose
-- schema is initialized directly by AnalyticsStore on startup.
--
-- Timestamps (ts) are stored as Unix epoch MILLISECONDS.

-- Raw per-call LLM token usage events (frontend + backend).
CREATE TABLE IF NOT EXISTS usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  side TEXT NOT NULL,               -- 'frontend' | 'backend'
  capability TEXT NOT NULL,
  feature TEXT,
  route TEXT,
  model TEXT,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  est_cost_usd REAL NOT NULL DEFAULT 0,
  cost_flagged INTEGER NOT NULL DEFAULT 0,  -- 1 when model was un-priced
  status TEXT NOT NULL DEFAULT 'ok',       -- 'ok' | 'error'
  error_kind TEXT,
  request_id TEXT,
  meta_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_usage_events_ts ON usage_events (ts);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_ts ON usage_events (user_id, ts);
CREATE INDEX IF NOT EXISTS idx_usage_events_capability_ts ON usage_events (capability, ts);
CREATE INDEX IF NOT EXISTS idx_usage_events_side_ts ON usage_events (side, ts);
-- idx_usage_events_status_ts is created in ensureSchemaMigrations() after the
-- status column is guaranteed to exist on upgraded databases.

-- Cached daily aggregation of usage_events (written by rollup cron).
CREATE TABLE IF NOT EXISTS usage_rollup_daily (
  day TEXT NOT NULL,                -- 'YYYY-MM-DD' (UTC)
  user_id TEXT NOT NULL,
  side TEXT NOT NULL,
  capability TEXT NOT NULL,
  model TEXT NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  est_cost_usd REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (day, user_id, side, capability, model)
);

CREATE INDEX IF NOT EXISTS idx_usage_rollup_day ON usage_rollup_daily (day);

-- Non-LLM API call frequency (every /api/v1/* request, excluding health/docs/usage).
CREATE TABLE IF NOT EXISTS api_call_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  capability TEXT,
  route TEXT NOT NULL,
  method TEXT NOT NULL,
  status INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_call_events_ts ON api_call_events (ts);
CREATE INDEX IF NOT EXISTS idx_api_call_events_user_ts ON api_call_events (user_id, ts);
CREATE INDEX IF NOT EXISTS idx_api_call_events_route_ts ON api_call_events (route, ts);

-- Runtime-editable model price table (USD per 1M tokens). Rows here override
-- the source-compiled seed table in pricing.ts; admins manage this via
-- GET/PUT /api/v1/usage/pricing instead of a redeploy.
CREATE TABLE IF NOT EXISTS model_pricing (
  model TEXT PRIMARY KEY,           -- lower-cased, matches usage_events.model
  input_per_1m REAL NOT NULL,
  output_per_1m REAL NOT NULL,
  cache_read_per_1m REAL,
  cache_write_per_1m REAL,
  note TEXT,
  updated_at INTEGER NOT NULL
);
