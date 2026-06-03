-- 032_relationship_radar_compat.sql
-- Compatibility migration for databases where 020_relationship_radar.sql was
-- applied before context card / event index storage was added.

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
