-- 002_profiles.sql
-- Dual Persona system: Human Model (user profile) + Agent Model (AI persona)

-- ============================================================
-- Human Model: User profile items (facts, preferences, habits)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profile_items (
  id TEXT PRIMARY KEY,
  item_type TEXT NOT NULL,                          -- fact / preference / habit / interest / constraint
  item_key TEXT NOT NULL,                           -- e.g. "timezone", "writing_style", "focus_project"
  item_value TEXT NOT NULL,                         -- JSON string or plain text
  evidence_refs TEXT,                               -- JSON array of {message_id, snippet, ts}
  source_kind TEXT NOT NULL DEFAULT 'inferred',     -- explicit / inferred / system
  confidence REAL NOT NULL DEFAULT 0.6,
  user_confirmed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',            -- active / superseded / retracted / archived
  salience_score REAL NOT NULL DEFAULT 0.0,
  mention_count INTEGER NOT NULL DEFAULT 1,
  last_seen INTEGER NOT NULL,
  valid_from INTEGER,
  valid_to INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  fingerprint TEXT NOT NULL                         -- hash(item_key + canonical(item_value))
);

CREATE INDEX IF NOT EXISTS idx_profile_items_type ON user_profile_items(item_type);
CREATE INDEX IF NOT EXISTS idx_profile_items_key ON user_profile_items(item_key);
CREATE INDEX IF NOT EXISTS idx_profile_items_status ON user_profile_items(status);
CREATE INDEX IF NOT EXISTS idx_profile_items_salience ON user_profile_items(salience_score DESC);
CREATE INDEX IF NOT EXISTS idx_profile_items_fingerprint ON user_profile_items(fingerprint);

-- ============================================================
-- Profile sync state (dirty flag for Markdown refresh)
-- ============================================================
CREATE TABLE IF NOT EXISTS profile_sync_state (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  profile_dirty INTEGER NOT NULL DEFAULT 0,
  last_snapshot_at INTEGER NOT NULL DEFAULT 0,
  last_full_rebuild_at INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO profile_sync_state (id, profile_dirty, last_snapshot_at, last_full_rebuild_at)
  VALUES ('singleton', 0, 0, 0);

-- ============================================================
-- Human Model: Social relationship edges
-- ============================================================
CREATE TABLE IF NOT EXISTS social_edges (
  id TEXT PRIMARY KEY,
  from_entity_id TEXT NOT NULL,                     -- typically the user's own entity
  to_entity_id TEXT NOT NULL,                       -- Person entity
  relation_type TEXT NOT NULL,                      -- colleague / manager / report / friend / client / vendor
  strength REAL NOT NULL DEFAULT 0.5,               -- 0.0 to 1.0
  evidence_refs TEXT,                               -- JSON array of {message_id, snippet, ts}
  confidence REAL NOT NULL DEFAULT 0.6,
  user_confirmed INTEGER NOT NULL DEFAULT 0,
  valid_from INTEGER,
  valid_to INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (from_entity_id) REFERENCES entities(id),
  FOREIGN KEY (to_entity_id) REFERENCES entities(id)
);

CREATE INDEX IF NOT EXISTS idx_social_edges_from ON social_edges(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_social_edges_to ON social_edges(to_entity_id);
CREATE INDEX IF NOT EXISTS idx_social_edges_type ON social_edges(relation_type);

-- ============================================================
-- Human Model: Social opinions / attitudes (require user confirm)
-- ============================================================
CREATE TABLE IF NOT EXISTS opinion_items (
  id TEXT PRIMARY KEY,
  target_entity_id TEXT NOT NULL,                   -- Person entity being evaluated
  dimension TEXT NOT NULL,                          -- trust / like / collaboration / competence / risk
  valence REAL NOT NULL,                            -- -1.0 to +1.0
  intensity REAL NOT NULL DEFAULT 0.5,              -- 0.0 to 1.0
  rationale TEXT,
  evidence_refs TEXT,                               -- JSON array of {message_id, snippet, ts}
  confidence REAL NOT NULL DEFAULT 0.5,
  user_confirmed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_confirm',   -- pending_confirm / active / retracted
  valid_from INTEGER,
  valid_to INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (target_entity_id) REFERENCES entities(id)
);

CREATE INDEX IF NOT EXISTS idx_opinion_target ON opinion_items(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_opinion_status ON opinion_items(status);
CREATE INDEX IF NOT EXISTS idx_opinion_dimension ON opinion_items(dimension);

-- ============================================================
-- Agent Model: AI persona versions (IDENTITY / SOUL / POLICY)
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_profile_versions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                               -- identity / soul / policy
  content_md TEXT NOT NULL,                         -- Markdown content
  author TEXT NOT NULL DEFAULT 'system',            -- user / agent / system
  rationale TEXT,                                   -- reason for change
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Only one active version per kind at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_profile_active
  ON agent_profile_versions(kind) WHERE is_active = 1;

CREATE INDEX IF NOT EXISTS idx_agent_profile_kind ON agent_profile_versions(kind);
CREATE INDEX IF NOT EXISTS idx_agent_profile_created ON agent_profile_versions(created_at DESC);
