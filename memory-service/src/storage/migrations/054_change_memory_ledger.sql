CREATE TABLE IF NOT EXISTS memory_change_extractions (
  source_ref_type TEXT NOT NULL,
  source_ref_id TEXT NOT NULL,
  status TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  subject_key TEXT,
  extracted_count INTEGER NOT NULL DEFAULT 0,
  excluded_noise_count INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  receipt_json TEXT NOT NULL DEFAULT '{}',
  extracted_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (source_ref_type, source_ref_id)
);

CREATE TABLE IF NOT EXISTS memory_change_events (
  id TEXT PRIMARY KEY,
  chain_key TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  subject_label TEXT NOT NULL,
  subject_kind TEXT NOT NULL,
  property_key TEXT NOT NULL,
  property_label TEXT NOT NULL,
  old_value_json TEXT,
  new_value_json TEXT NOT NULL,
  event_kind TEXT NOT NULL,
  authority_role TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.7,
  source_ref_type TEXT NOT NULL,
  source_ref_id TEXT NOT NULL,
  source_title TEXT,
  source_url TEXT,
  actor TEXT,
  reason TEXT,
  evidence_quote TEXT,
  observed_at INTEGER NOT NULL,
  captured_at INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  is_reversal INTEGER NOT NULL DEFAULT 0,
  input_hash TEXT NOT NULL,
  event_fingerprint TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (source_ref_type, source_ref_id, event_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_memory_change_events_source
  ON memory_change_events(source_ref_type, source_ref_id);
CREATE INDEX IF NOT EXISTS idx_memory_change_events_subject
  ON memory_change_events(subject_key, property_key, active, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_change_events_chain
  ON memory_change_events(chain_key, active, observed_at ASC, captured_at ASC);

CREATE TABLE IF NOT EXISTS memory_change_chains (
  chain_key TEXT PRIMARY KEY,
  subject_key TEXT NOT NULL,
  subject_label TEXT NOT NULL,
  subject_kind TEXT NOT NULL,
  property_key TEXT NOT NULL,
  property_label TEXT NOT NULL,
  current_value_json TEXT,
  previous_value_json TEXT,
  projection_status TEXT NOT NULL,
  current_event_id TEXT,
  event_count INTEGER NOT NULL DEFAULT 0,
  reversal_count INTEGER NOT NULL DEFAULT 0,
  conflict_count INTEGER NOT NULL DEFAULT 0,
  projection_receipt_json TEXT NOT NULL DEFAULT '{}',
  first_observed_at INTEGER,
  last_observed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_change_chains_subject
  ON memory_change_chains(subject_key, last_observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_change_chains_recent
  ON memory_change_chains(last_observed_at DESC);
