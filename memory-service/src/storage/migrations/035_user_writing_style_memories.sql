CREATE TABLE IF NOT EXISTS user_writing_style_memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  scope_level TEXT NOT NULL,
  surface TEXT,
  audience_type TEXT,
  person_ids_json TEXT NOT NULL DEFAULT '[]',
  group_ids_json TEXT NOT NULL DEFAULT '[]',
  task_kind TEXT,
  language TEXT,
  preference_kind TEXT NOT NULL,
  positive_rules_json TEXT NOT NULL DEFAULT '[]',
  negative_rules_json TEXT NOT NULL DEFAULT '[]',
  examples_redacted_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  feature_counts_json TEXT NOT NULL DEFAULT '{}',
  confidence REAL NOT NULL DEFAULT 0.5,
  half_life_days INTEGER NOT NULL DEFAULT 45,
  status TEXT NOT NULL DEFAULT 'candidate',
  promoted_profile_item_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_writing_style_memories_user_scope_kind
  ON user_writing_style_memories(user_id, scope_key, preference_kind);

CREATE INDEX IF NOT EXISTS idx_user_writing_style_memories_status_updated
  ON user_writing_style_memories(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_writing_style_memories_surface_scope
  ON user_writing_style_memories(surface, audience_type, task_kind, language);
