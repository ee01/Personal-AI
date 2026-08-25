-- 063_device_key_requests.sql
-- Pending / decided requests for new-device key issuance when bootstrap
-- cannot claim an already-owned namespace.
CREATE TABLE IF NOT EXISTS device_key_requests (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending | approved | denied | consumed
  requested_at INTEGER NOT NULL,
  decided_at INTEGER,
  decided_by TEXT,
  device_label TEXT,
  ip TEXT,
  ua TEXT,
  google_email TEXT,
  mismatch_reason TEXT,
  issued_key_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_device_key_requests_status
  ON device_key_requests(status, requested_at DESC);
