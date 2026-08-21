-- 061_agent_workers.sql
-- Reverse worker registry (channel, not an executor type) + remote task parking.

CREATE TABLE IF NOT EXISTS agent_workers (
  id TEXT PRIMARY KEY,
  label TEXT,
  hostname TEXT,
  host_kind TEXT NOT NULL DEFAULT 'headless',
  status TEXT NOT NULL DEFAULT 'pairing',
  protocol_version INTEGER NOT NULL DEFAULT 1,
  capabilities_json TEXT,
  credential_hash TEXT,
  credential_prefix TEXT,
  last_heartbeat_at INTEGER,
  current_task_count INTEGER NOT NULL DEFAULT 0,
  lease_epoch INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_agent_workers_status
  ON agent_workers(status, last_heartbeat_at);

CREATE TABLE IF NOT EXISTS agent_worker_pairing_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_worker_pairing_expires
  ON agent_worker_pairing_tokens(expires_at);

CREATE TABLE IF NOT EXISTS agent_worker_commands (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  result_json TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  finished_at INTEGER,
  FOREIGN KEY (worker_id) REFERENCES agent_workers(id)
);

CREATE INDEX IF NOT EXISTS idx_agent_worker_commands_pending
  ON agent_worker_commands(worker_id, status, created_at);

CREATE TABLE IF NOT EXISTS agent_worker_leases (
  action_id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  fence_token INTEGER NOT NULL,
  lease_until INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_worker_leases_until
  ON agent_worker_leases(lease_until);

ALTER TABLE proposed_actions ADD COLUMN target_worker_id TEXT;

CREATE INDEX IF NOT EXISTS idx_proposed_actions_target_worker
  ON proposed_actions(target_worker_id, queue_status);
