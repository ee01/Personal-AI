CREATE TABLE IF NOT EXISTS relationship_radar_people (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id),
  radar_state TEXT NOT NULL DEFAULT 'watch',
  data_quality TEXT NOT NULL DEFAULT 'indexed',
  projection_source TEXT NOT NULL DEFAULT 'lazy',
  score REAL NOT NULL DEFAULT 0,
  interaction_count INTEGER NOT NULL DEFAULT 0,
  active_days INTEGER NOT NULL DEFAULT 0,
  last_interaction_at INTEGER,
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  summary TEXT,
  dirty_since INTEGER,
  last_consolidated_at INTEGER,
  generated_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_relationship_radar_state_score
  ON relationship_radar_people(radar_state, score DESC);

CREATE INDEX IF NOT EXISTS idx_relationship_radar_last_interaction
  ON relationship_radar_people(last_interaction_at DESC);

CREATE INDEX IF NOT EXISTS idx_relationship_radar_dirty
  ON relationship_radar_people(dirty_since)
  WHERE dirty_since IS NOT NULL;

CREATE TABLE IF NOT EXISTS relationship_context_cards (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id),
  data_quality TEXT NOT NULL DEFAULT 'generated',
  context_json TEXT NOT NULL,
  context_md TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  source_hash TEXT NOT NULL,
  generated_at INTEGER NOT NULL,
  expires_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_relationship_context_cards_quality
  ON relationship_context_cards(data_quality, generated_at DESC);

CREATE TABLE IF NOT EXISTS relationship_event_index (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  source_kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_ts INTEGER,
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  confidence REAL NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_relationship_event_entity_ts
  ON relationship_event_index(entity_id, source_ts DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_relationship_event_source
  ON relationship_event_index(entity_id, event_type, source_kind, source_id);

CREATE TABLE IF NOT EXISTS relationship_review_items (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  item_type TEXT NOT NULL,
  proposed_key TEXT NOT NULL,
  title TEXT NOT NULL,
  proposed_value TEXT NOT NULL,
  reason TEXT,
  confidence REAL NOT NULL DEFAULT 0.5,
  priority TEXT NOT NULL DEFAULT 'normal',
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  user_note TEXT,
  snooze_until INTEGER,
  confirmed_at INTEGER,
  rejected_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_relationship_review_status
  ON relationship_review_items(status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_relationship_review_entity
  ON relationship_review_items(entity_id, status);
