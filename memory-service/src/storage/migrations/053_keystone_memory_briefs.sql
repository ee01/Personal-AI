CREATE TABLE IF NOT EXISTS keystone_briefs (
  id TEXT PRIMARY KEY,
  brief_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'work',
  status TEXT NOT NULL DEFAULT 'candidate',
  summary TEXT NOT NULL,
  external_summary TEXT,
  source_as_of INTEGER,
  freshness_json TEXT NOT NULL DEFAULT '{}',
  slots_json TEXT NOT NULL DEFAULT '{}',
  scene_anchors_json TEXT NOT NULL DEFAULT '{}',
  display_policy_json TEXT NOT NULL DEFAULT '{}',
  write_receipt_json TEXT NOT NULL DEFAULT '{}',
  repair_state TEXT NOT NULL DEFAULT 'clean',
  blocked_reason TEXT,
  composition_version TEXT NOT NULL DEFAULT 'v1',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_keystone_briefs_status_updated
  ON keystone_briefs(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_keystone_briefs_subject
  ON keystone_briefs(subject_type, updated_at DESC);

CREATE TABLE IF NOT EXISTS keystone_brief_sources (
  brief_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_role TEXT NOT NULL DEFAULT 'supporting',
  title TEXT,
  url TEXT,
  source_timestamp INTEGER,
  authority TEXT NOT NULL DEFAULT 'supporting',
  projection TEXT NOT NULL DEFAULT 'local_only',
  hidden INTEGER NOT NULL DEFAULT 0,
  snippet TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (brief_id, source_type, source_id),
  FOREIGN KEY (brief_id) REFERENCES keystone_briefs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_keystone_brief_sources_source
  ON keystone_brief_sources(source_type, source_id);

CREATE TABLE IF NOT EXISTS keystone_brief_events (
  id TEXT PRIMARY KEY,
  brief_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  surface TEXT,
  context_json TEXT NOT NULL DEFAULT '{}',
  reason TEXT,
  detail TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (brief_id) REFERENCES keystone_briefs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_keystone_brief_events_brief
  ON keystone_brief_events(brief_id, created_at DESC);

CREATE TABLE IF NOT EXISTS keystone_brief_candidate_runs (
  id TEXT PRIMARY KEY,
  brief_id TEXT,
  brief_key TEXT NOT NULL,
  input_summary TEXT,
  input_schema_version TEXT NOT NULL DEFAULT 'v1',
  result_status TEXT NOT NULL,
  blocked_reason TEXT,
  evaluation_tags_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (brief_id) REFERENCES keystone_briefs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_keystone_brief_candidate_runs_key
  ON keystone_brief_candidate_runs(brief_key, created_at DESC);
