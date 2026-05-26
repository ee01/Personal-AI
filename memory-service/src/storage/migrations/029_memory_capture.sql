-- 029_memory_capture.sql
-- Source/web memory capture: canonical capsules, evidence anchors, derived
-- takeaways, triggers, links, and behavior events.

CREATE TABLE IF NOT EXISTS source_memory_capsules (
  id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL,
  source_url TEXT,
  source_title TEXT NOT NULL,
  source_host TEXT,
  source_fingerprint TEXT NOT NULL,
  capture_mode TEXT NOT NULL,
  capture_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'saved',
  scope TEXT NOT NULL DEFAULT 'work',
  privacy_level TEXT NOT NULL DEFAULT 'work',
  summary TEXT,
  content_preview TEXT,
  message_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  saved_at INTEGER,
  dismissed_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_source_memory_capsules_fingerprint
  ON source_memory_capsules(source_fingerprint);

CREATE INDEX IF NOT EXISTS idx_source_memory_capsules_status_updated
  ON source_memory_capsules(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_source_memory_capsules_source
  ON source_memory_capsules(source_kind, source_host, updated_at DESC);

CREATE TABLE IF NOT EXISTS source_memory_anchors (
  id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL,
  anchor_kind TEXT NOT NULL,
  locator TEXT,
  quote_or_preview TEXT NOT NULL,
  sensitivity TEXT NOT NULL DEFAULT 'normal',
  confidence REAL NOT NULL DEFAULT 0.7,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (capsule_id) REFERENCES source_memory_capsules(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_source_memory_anchors_capsule
  ON source_memory_anchors(capsule_id);

CREATE TABLE IF NOT EXISTS source_memory_takeaways (
  id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  evidence_anchor_ids_json TEXT NOT NULL DEFAULT '[]',
  confidence REAL NOT NULL DEFAULT 0.6,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (capsule_id) REFERENCES source_memory_capsules(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_source_memory_takeaways_capsule
  ON source_memory_takeaways(capsule_id);

CREATE TABLE IF NOT EXISTS source_memory_triggers (
  id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL,
  trigger_kind TEXT NOT NULL,
  description TEXT NOT NULL,
  matcher_json TEXT NOT NULL DEFAULT '{}',
  default_behavior TEXT NOT NULL DEFAULT 'quiet_match',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (capsule_id) REFERENCES source_memory_capsules(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_source_memory_triggers_capsule
  ON source_memory_triggers(capsule_id);

CREATE TABLE IF NOT EXISTS source_memory_links (
  id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation TEXT NOT NULL DEFAULT 'related',
  confidence REAL NOT NULL DEFAULT 0.5,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (capsule_id) REFERENCES source_memory_capsules(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_source_memory_links_capsule
  ON source_memory_links(capsule_id);

CREATE INDEX IF NOT EXISTS idx_source_memory_links_target
  ON source_memory_links(target_type, target_id);

CREATE TABLE IF NOT EXISTS source_memory_events (
  id TEXT PRIMARY KEY,
  capsule_id TEXT,
  event_type TEXT NOT NULL,
  event_strength TEXT NOT NULL DEFAULT 'medium',
  source_url TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (capsule_id) REFERENCES source_memory_capsules(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_source_memory_events_capsule
  ON source_memory_events(capsule_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_source_memory_events_type_created
  ON source_memory_events(event_type, created_at DESC);
