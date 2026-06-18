CREATE TABLE IF NOT EXISTS memory_outcome_events (
  id TEXT PRIMARY KEY,
  source_trace_id TEXT,
  surface TEXT NOT NULL,
  scene_key TEXT NOT NULL,
  cue_id TEXT,
  cue_key TEXT,
  action TEXT NOT NULL,
  polarity TEXT NOT NULL,
  strength TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_outcome_events_cue_key_created
  ON memory_outcome_events(cue_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memory_outcome_events_scene_surface_created
  ON memory_outcome_events(scene_key, surface, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_outcome_policy_patches (
  id TEXT PRIMARY KEY,
  cue_key TEXT NOT NULL,
  scene_key TEXT NOT NULL,
  surface TEXT NOT NULL,
  patch_scope TEXT NOT NULL DEFAULT 'cue',
  action TEXT NOT NULL,
  reason_codes_json TEXT NOT NULL DEFAULT '[]',
  strength REAL NOT NULL DEFAULT 0.5,
  positive_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  signal_count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_outcome_policy_unique
  ON memory_outcome_policy_patches(cue_key, scene_key, surface, action);

CREATE INDEX IF NOT EXISTS idx_memory_outcome_policy_lookup
  ON memory_outcome_policy_patches(cue_key, surface, scene_key, revoked_at, expires_at);
