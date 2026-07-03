-- 050_evidence_watch_contracts.sql
-- Persistent contracts and receipts for long-running evidence verification.

CREATE TABLE IF NOT EXISTS evidence_watch_contracts (
  id TEXT PRIMARY KEY,
  subject_key TEXT NOT NULL,
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  canonical_claim_json TEXT,
  authority_sources_json TEXT NOT NULL DEFAULT '[]',
  verifier_json TEXT NOT NULL DEFAULT '{}',
  cadence TEXT NOT NULL DEFAULT 'on_revisit',
  state TEXT NOT NULL DEFAULT 'active',
  stop_conditions_json TEXT NOT NULL DEFAULT '[]',
  impact_targets_json TEXT NOT NULL DEFAULT '[]',
  privacy_boundary TEXT NOT NULL DEFAULT 'local_only',
  last_checked_at INTEGER,
  next_check_at INTEGER,
  last_receipt_id TEXT,
  created_from_kind TEXT NOT NULL,
  created_from_ref_id TEXT NOT NULL,
  confirm_request_id TEXT,
  dedupe_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_evidence_watch_subject
  ON evidence_watch_contracts(subject_key, state, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_watch_state_next_check
  ON evidence_watch_contracts(state, next_check_at);

CREATE INDEX IF NOT EXISTS idx_evidence_watch_confirm_request
  ON evidence_watch_contracts(confirm_request_id)
  WHERE confirm_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS evidence_watch_runs (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  run_state TEXT NOT NULL,
  summary TEXT NOT NULL,
  checked_sources_json TEXT NOT NULL DEFAULT '[]',
  suppressed_action_ids_json TEXT NOT NULL DEFAULT '[]',
  created_patch_ids_json TEXT NOT NULL DEFAULT '[]',
  user_visible INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(contract_id) REFERENCES evidence_watch_contracts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evidence_watch_runs_contract
  ON evidence_watch_runs(contract_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_watch_runs_state
  ON evidence_watch_runs(run_state, created_at DESC);

CREATE TABLE IF NOT EXISTS evidence_watch_links (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(contract_id) REFERENCES evidence_watch_contracts(id) ON DELETE CASCADE,
  UNIQUE(contract_id, target_kind, target_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_evidence_watch_links_target
  ON evidence_watch_links(target_kind, target_id);
