ALTER TABLE messages_raw
  ADD COLUMN claim_attribution_status TEXT NOT NULL DEFAULT 'legacy_unclassified';

ALTER TABLE messages_raw
  ADD COLUMN claim_attribution_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE messages_raw
  ADD COLUMN claim_attributed_at INTEGER;

ALTER TABLE messages_raw
  ADD COLUMN claim_attribution_error TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_claim_attribution_status
  ON messages_raw(claim_attribution_status, timestamp DESC);

CREATE TABLE IF NOT EXISTS memory_claims (
  id TEXT PRIMARY KEY,
  source_message_id TEXT NOT NULL
    REFERENCES messages_raw(id) ON DELETE CASCADE,
  span_start INTEGER NOT NULL,
  span_end INTEGER NOT NULL,
  span_text_hash TEXT NOT NULL,
  source_text TEXT NOT NULL,
  normalized_claim TEXT NOT NULL,
  owner_kind TEXT NOT NULL,
  owner_entity_id TEXT,
  owner_display_name TEXT,
  speech_mode TEXT NOT NULL,
  polarity TEXT NOT NULL,
  time_basis TEXT NOT NULL,
  verification_state TEXT NOT NULL,
  commitment_state TEXT NOT NULL,
  confidence REAL NOT NULL,
  signals_json TEXT NOT NULL DEFAULT '[]',
  profile_candidate INTEGER NOT NULL DEFAULT 0,
  current_truth_candidate INTEGER NOT NULL DEFAULT 0,
  action_candidate INTEGER NOT NULL DEFAULT 0,
  passive_recall TEXT NOT NULL DEFAULT 'background_only',
  revision INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  corrected INTEGER NOT NULL DEFAULT 0,
  resolver_version TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(source_message_id, span_start, span_end, span_text_hash)
);

CREATE INDEX IF NOT EXISTS idx_memory_claims_source
  ON memory_claims(source_message_id, status, span_start);

CREATE INDEX IF NOT EXISTS idx_memory_claims_policy
  ON memory_claims(
    profile_candidate,
    current_truth_candidate,
    action_candidate,
    passive_recall,
    status
  );

CREATE INDEX IF NOT EXISTS idx_memory_claims_owner_mode
  ON memory_claims(owner_kind, speech_mode, status);

CREATE TABLE IF NOT EXISTS memory_claim_revisions (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL
    REFERENCES memory_claims(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  previous_attribution_json TEXT NOT NULL,
  next_attribution_json TEXT NOT NULL,
  correction TEXT NOT NULL,
  correction_source TEXT NOT NULL,
  idempotency_key TEXT,
  invalidated_derived_json TEXT NOT NULL DEFAULT '{}',
  undone_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(claim_id, revision),
  UNIQUE(claim_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_memory_claim_revisions_claim
  ON memory_claim_revisions(claim_id, revision DESC);

CREATE TABLE IF NOT EXISTS memory_claim_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id TEXT NOT NULL
    REFERENCES memory_claims(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  link_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  invalidated_at INTEGER,
  invalidation_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(claim_id, target_type, target_id, link_role)
);

CREATE INDEX IF NOT EXISTS idx_memory_claim_links_claim
  ON memory_claim_links(claim_id, status);

CREATE INDEX IF NOT EXISTS idx_memory_claim_links_target
  ON memory_claim_links(target_type, target_id, status);
