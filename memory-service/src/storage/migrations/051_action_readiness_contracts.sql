-- 051_action_readiness_contracts.sql
-- Reusable pre-dispatch capability contracts for external actions.

CREATE TABLE IF NOT EXISTS action_readiness_contracts (
  id TEXT PRIMARY KEY,
  scope_key TEXT NOT NULL UNIQUE,
  action_family TEXT NOT NULL,
  target_system TEXT,
  capability TEXT,
  status TEXT NOT NULL,
  status_reason TEXT,
  required_inputs_json TEXT NOT NULL DEFAULT '[]',
  required_approvals_json TEXT NOT NULL DEFAULT '[]',
  proof_requirements_json TEXT NOT NULL DEFAULT '[]',
  last_probe_at INTEGER,
  last_probe_result_json TEXT,
  expires_at INTEGER,
  blocked_since INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_action_readiness_status
  ON action_readiness_contracts(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_action_readiness_target
  ON action_readiness_contracts(action_family, target_system, capability);

CREATE TABLE IF NOT EXISTS action_readiness_links (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_ref_id TEXT NOT NULL,
  link_reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(contract_id) REFERENCES action_readiness_contracts(id) ON DELETE CASCADE,
  UNIQUE(contract_id, source_kind, source_ref_id, link_reason)
);

CREATE INDEX IF NOT EXISTS idx_action_readiness_links_source
  ON action_readiness_links(source_kind, source_ref_id);

CREATE INDEX IF NOT EXISTS idx_action_readiness_links_contract
  ON action_readiness_links(contract_id, link_reason, created_at DESC);

