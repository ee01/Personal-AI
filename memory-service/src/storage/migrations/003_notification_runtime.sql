-- 003_notification_runtime.sql
-- Runtime primitives for notification delivery and recurring workers

-- Worker checkpoints keep recurring scanners idempotent across process restarts
CREATE TABLE IF NOT EXISTS worker_checkpoints (
  worker_key TEXT PRIMARY KEY,
  cursor_value TEXT,
  cursor_type TEXT NOT NULL DEFAULT 'timestamp',
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_worker_checkpoints_updated
  ON worker_checkpoints(updated_at DESC);

-- Worker leases are a minimal coordination primitive for future multi-instance runs
CREATE TABLE IF NOT EXISTS worker_leases (
  worker_key TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  lease_until INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_worker_leases_until
  ON worker_leases(lease_until);
