CREATE TABLE IF NOT EXISTS rc_directory_users (
  entity_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT,
  extension_number TEXT,
  search_text TEXT NOT NULL,
  raw_json TEXT,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rc_directory_users_updated
  ON rc_directory_users(updated_at DESC);

CREATE TABLE IF NOT EXISTS rc_directory_teams (
  chat_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  search_text TEXT NOT NULL,
  raw_json TEXT,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rc_directory_teams_updated
  ON rc_directory_teams(updated_at DESC);

CREATE TABLE IF NOT EXISTS rc_directory_sync_state (
  scope TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'idle',
  last_started_at INTEGER,
  last_finished_at INTEGER,
  last_success_at INTEGER,
  record_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

INSERT OR IGNORE INTO rc_directory_sync_state (scope, status, record_count)
VALUES
  ('users', 'idle', 0),
  ('teams', 'idle', 0);
