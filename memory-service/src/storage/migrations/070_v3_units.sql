-- P1 (memory-foundation plan §5.2/§5.3): v3 truth core — memory units with
-- normalized lineage, append-only revisions, idempotent integration
-- receipts, projection outbox, and the shadow extraction job state.
--
-- Scope of this slice (dual-write shadow, §11.6):
--   memory_units / memory_unit_sources / memory_unit_revisions
--   memory_unit_views (+ FTS projections) / projection_outbox
--   ingest_jobs / ingest_extraction_results
--   truth_integrations / truth_policies
-- Entities, edges, profiles, lifecycle, exposures follow in later P1 slices.
--
-- Invariants encoded here (plan §4.2 / §5.3):
--   I2  every active unit has ≥1 normalized source row (enforced by the
--       TruthMaintainer transaction; sources are FK-checked to episodes)
--   I4  projections are rebuildable (outbox receipts; FTS external content)
--   I5  replay of the same work_unit_key cannot re-integrate (unique receipt)
--   I7  unknown observed_at stays NULL — no epoch-0 fallbacks
--   I11 this schema is written only in shadow until P2 flags flip

CREATE TABLE IF NOT EXISTS memory_units (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  owner_user_id TEXT NOT NULL,
  memory_form TEXT NOT NULL CHECK (memory_form IN ('semantic', 'episodic', 'procedural')),
  kind TEXT NOT NULL CHECK (kind IN (
    'note', 'fact', 'preference', 'decision', 'action_item', 'event',
    'risk', 'open_question', 'opinion', 'procedure', 'insight', 'brief')),
  status TEXT NOT NULL DEFAULT 'provisional' CHECK (status IN (
    'provisional', 'active', 'disputed', 'superseded', 'retracted',
    'archived', 'quarantined', 'deletion_pending')),
  subject_key TEXT,
  predicate_key TEXT,
  text TEXT NOT NULL,
  normalized_text TEXT,
  language TEXT,
  observed_at INTEGER,
  observed_at_quality TEXT CHECK (observed_at_quality IS NULL OR observed_at_quality IN
    ('unknown', 'source_timestamp', 'recovered')),
  observed_at_precision TEXT CHECK (observed_at_precision IS NULL OR observed_at_precision IN
    ('second', 'minute', 'hour', 'day', 'month')),
  valid_from INTEGER,
  valid_to INTEGER,
  tx_start INTEGER NOT NULL,
  tx_end INTEGER,
  confirmation_state TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (confirmation_state IN
    ('unconfirmed', 'user_confirmed', 'user_rejected')),
  confidence REAL NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  scope_locator TEXT,
  sensitivity TEXT NOT NULL DEFAULT 'internal' CHECK (sensitivity IN
    ('public', 'internal', 'private', 'restricted')),
  egress_policy TEXT NOT NULL DEFAULT 'approved_destinations' CHECK (egress_policy IN
    ('local_only', 'approved_destinations', 'user_selected')),
  source_independence_count_cached INTEGER NOT NULL DEFAULT 1,
  evidence_class_set_cached TEXT,
  superseded_by TEXT REFERENCES memory_units(id),
  current_revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_units_subject
  ON memory_units(tenant_id, owner_user_id, subject_key, predicate_key);
CREATE INDEX IF NOT EXISTS idx_memory_units_status
  ON memory_units(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_units_episode_lookup
  ON memory_units(id) WHERE status IN ('provisional', 'active', 'disputed');

CREATE TABLE IF NOT EXISTS memory_unit_sources (
  unit_id TEXT NOT NULL REFERENCES memory_units(id),
  episode_id TEXT NOT NULL REFERENCES messages_raw(id),
  span_start_byte INTEGER NOT NULL,
  span_end_byte INTEGER NOT NULL,
  span_text_hash TEXT NOT NULL,
  source_role TEXT NOT NULL,
  evidence_key TEXT NOT NULL,
  provenance_family TEXT NOT NULL,
  origin_type TEXT,
  evidence_class TEXT NOT NULL CHECK (evidence_class IN (
    'self_statement', 'first_party_record', 'official_source',
    'third_party_report', 'system_inference')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (unit_id, episode_id, span_start_byte, span_end_byte, source_role)
);

CREATE INDEX IF NOT EXISTS idx_memory_unit_sources_episode
  ON memory_unit_sources(episode_id);

CREATE TABLE IF NOT EXISTS memory_unit_revisions (
  unit_id TEXT NOT NULL REFERENCES memory_units(id),
  revision INTEGER NOT NULL,
  operation TEXT NOT NULL,
  before_snapshot_json TEXT,
  after_snapshot_json TEXT NOT NULL,
  reason TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'llm', 'adapter')),
  actor_id TEXT,
  request_id TEXT,
  truth_policy_version TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (unit_id, revision)
);

CREATE TABLE IF NOT EXISTS memory_unit_views (
  view_id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id TEXT NOT NULL REFERENCES memory_units(id),
  view_kind TEXT NOT NULL CHECK (view_kind IN ('body', 'summary', 'keywords', 'trigger_question')),
  raw_text TEXT NOT NULL,
  segmented_text TEXT,
  language TEXT,
  source_unit_revision INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  model TEXT,
  prompt_version TEXT,
  embedding_model TEXT,
  embedding TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (unit_id, view_kind, source_unit_revision)
);

CREATE INDEX IF NOT EXISTS idx_memory_unit_views_unit
  ON memory_unit_views(unit_id, view_kind);

-- Lexical projection over unit views (segmented). External content keeps it
-- rebuildable (I4); the outbox drives sync + replay tests.
CREATE VIRTUAL TABLE IF NOT EXISTS unit_views_fts_seg USING fts5(
  content,
  content='memory_unit_views',
  content_rowid='view_id',
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS unit_views_fts_seg_ai AFTER INSERT ON memory_unit_views BEGIN
  INSERT INTO unit_views_fts_seg(rowid, content) VALUES (new.view_id, COALESCE(new.segmented_text, new.raw_text));
END;
CREATE TRIGGER IF NOT EXISTS unit_views_fts_seg_ad AFTER DELETE ON memory_unit_views BEGIN
  INSERT INTO unit_views_fts_seg(unit_views_fts_seg, rowid, content) VALUES('delete', old.view_id, COALESCE(old.segmented_text, old.raw_text));
END;
CREATE TRIGGER IF NOT EXISTS unit_views_fts_seg_au AFTER UPDATE ON memory_unit_views BEGIN
  INSERT INTO unit_views_fts_seg(unit_views_fts_seg, rowid, content) VALUES('delete', old.view_id, COALESCE(old.segmented_text, old.raw_text));
  INSERT INTO unit_views_fts_seg(rowid, content) VALUES (new.view_id, COALESCE(new.segmented_text, new.raw_text));
END;

-- Trigram fallback projection over raw text (CJK substring recall).
CREATE VIRTUAL TABLE IF NOT EXISTS unit_views_fts_tri USING fts5(
  content,
  content='memory_unit_views',
  content_rowid='view_id',
  tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS unit_views_fts_tri_ai AFTER INSERT ON memory_unit_views BEGIN
  INSERT INTO unit_views_fts_tri(rowid, content) VALUES (new.view_id, new.raw_text);
END;
CREATE TRIGGER IF NOT EXISTS unit_views_fts_tri_ad AFTER DELETE ON memory_unit_views BEGIN
  INSERT INTO unit_views_fts_tri(unit_views_fts_tri, rowid, content) VALUES('delete', old.view_id, old.raw_text);
END;
CREATE TRIGGER IF NOT EXISTS unit_views_fts_tri_au AFTER UPDATE ON memory_unit_views BEGIN
  INSERT INTO unit_views_fts_tri(unit_views_fts_tri, rowid, content) VALUES('delete', old.view_id, old.raw_text);
  INSERT INTO unit_views_fts_tri(rowid, content) VALUES (new.view_id, new.raw_text);
END;

CREATE TABLE IF NOT EXISTS projection_outbox (
  projection_key TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES memory_units(id),
  view_kind TEXT NOT NULL,
  source_unit_revision INTEGER NOT NULL,
  projection_config_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'stale', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projection_outbox_status
  ON projection_outbox(status, updated_at);

CREATE TABLE IF NOT EXISTS ingest_jobs (
  job_id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL REFERENCES messages_raw(id),
  contract_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN
    ('queued', 'claimed', 'extracted', 'extracted_zero', 'integrated', 'needs_extraction',
     'dead_letter', 'failed_retryable')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER,
  leased_by TEXT,
  leased_until INTEGER,
  last_error_class TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ingest_jobs_status
  ON ingest_jobs(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS ingest_extraction_results (
  job_id TEXT NOT NULL REFERENCES ingest_jobs(job_id),
  result_hash TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  candidate_batch_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (job_id, result_hash)
);

CREATE TABLE IF NOT EXISTS truth_integrations (
  work_unit_key TEXT PRIMARY KEY,
  candidate_hash TEXT NOT NULL,
  truth_policy_version TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN
    ('created', 'corroborated', 'refined', 'disputed', 'superseded', 'rejected', 'pending_user_confirmation')),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_revision INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS truth_policies (
  policy_key TEXT PRIMARY KEY,
  predicate_key TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  policy_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
