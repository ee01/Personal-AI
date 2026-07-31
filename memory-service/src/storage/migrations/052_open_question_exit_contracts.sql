-- 052_open_question_exit_contracts.sql
-- Persistent lifecycle decisions for reflection questions that should stop,
-- wait on an existing owner, or resume only after new evidence.

CREATE TABLE IF NOT EXISTS open_question_exit_contracts (
  id TEXT PRIMARY KEY,
  question_key TEXT NOT NULL,
  question_text TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_ref_id TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'active',
  reason_code TEXT NOT NULL DEFAULT 'first_seen',
  user_impact TEXT NOT NULL DEFAULT 'useful_later',
  evaluation_count INTEGER NOT NULL DEFAULT 0,
  duplicate_suppressed_count INTEGER NOT NULL DEFAULT 0,
  last_evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  resume_triggers_json TEXT NOT NULL DEFAULT '[]',
  receipt_json TEXT NOT NULL DEFAULT '{}',
  linked_action_id TEXT,
  linked_confirm_request_id TEXT,
  linked_evidence_watch_contract_id TEXT,
  last_evaluated_at INTEGER,
  last_new_evidence_at INTEGER,
  last_resumed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(source_kind, source_ref_id, question_key)
);

CREATE INDEX IF NOT EXISTS idx_open_question_exit_source
  ON open_question_exit_contracts(source_kind, source_ref_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_open_question_exit_state
  ON open_question_exit_contracts(state, user_impact, last_resumed_at DESC);

CREATE INDEX IF NOT EXISTS idx_open_question_exit_action
  ON open_question_exit_contracts(linked_action_id)
  WHERE linked_action_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_open_question_exit_confirm
  ON open_question_exit_contracts(linked_confirm_request_id)
  WHERE linked_confirm_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_open_question_exit_watch
  ON open_question_exit_contracts(linked_evidence_watch_contract_id)
  WHERE linked_evidence_watch_contract_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS open_question_exit_runs (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  run_kind TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  linked_action_id TEXT,
  linked_confirm_request_id TEXT,
  linked_evidence_watch_contract_id TEXT,
  receipt_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY(contract_id) REFERENCES open_question_exit_contracts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_open_question_exit_runs_contract
  ON open_question_exit_runs(contract_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_open_question_exit_runs_state
  ON open_question_exit_runs(to_state, reason_code, created_at DESC);
