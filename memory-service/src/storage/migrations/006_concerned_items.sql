-- 006_concerned_items.sql
-- Snapshot sync for concernedItems and cross-device follow-thread hit events

CREATE TABLE IF NOT EXISTS concerned_items_state (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  items_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  updated_by_device TEXT
);

CREATE TABLE IF NOT EXISTS follow_thread_hits (
  id TEXT PRIMARY KEY,
  follow_item_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  datetime TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  summary TEXT,
  team_id TEXT,
  created_at INTEGER NOT NULL,
  source_device TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_follow_thread_hits_unique
  ON follow_thread_hits(follow_item_id, post_id);

CREATE INDEX IF NOT EXISTS idx_follow_thread_hits_created
  ON follow_thread_hits(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_follow_thread_hits_follow_item_created
  ON follow_thread_hits(follow_item_id, created_at DESC);
