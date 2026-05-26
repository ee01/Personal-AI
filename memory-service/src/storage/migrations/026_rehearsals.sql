-- 026_rehearsals.sql
-- Future-scene rehearsal memory and activation audit trail

CREATE TABLE IF NOT EXISTS rehearsals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  scenario_type TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'candidate',
  summary TEXT,
  content TEXT NOT NULL,
  activation_cues_json TEXT,
  evidence_refs_json TEXT,
  source_kind TEXT NOT NULL DEFAULT 'manual',
  source_ref_id TEXT,
  confidence REAL NOT NULL DEFAULT 0.5,
  priority INTEGER NOT NULL DEFAULT 5,
  valid_from INTEGER,
  valid_until INTEGER,
  last_activated_at INTEGER,
  last_used_at INTEGER,
  activation_count INTEGER NOT NULL DEFAULT 0,
  used_count INTEGER NOT NULL DEFAULT 0,
  dismissed_count INTEGER NOT NULL DEFAULT 0,
  stale_reason TEXT,
  markdown_path TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rehearsals_status
  ON rehearsals(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rehearsals_validity
  ON rehearsals(status, valid_from, valid_until);

CREATE INDEX IF NOT EXISTS idx_rehearsals_source
  ON rehearsals(source_kind, source_ref_id);

CREATE TABLE IF NOT EXISTS rehearsal_activations (
  id TEXT PRIMARY KEY,
  rehearsal_id TEXT NOT NULL,
  surface TEXT NOT NULL,
  context_type TEXT,
  scene_key TEXT,
  score REAL NOT NULL,
  display_priority TEXT NOT NULL,
  matched_cues_json TEXT,
  outcome TEXT NOT NULL DEFAULT 'matched',
  feedback_note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (rehearsal_id) REFERENCES rehearsals(id)
);

CREATE INDEX IF NOT EXISTS idx_rehearsal_activations_rehearsal
  ON rehearsal_activations(rehearsal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rehearsal_activations_scene
  ON rehearsal_activations(surface, context_type, created_at DESC);
