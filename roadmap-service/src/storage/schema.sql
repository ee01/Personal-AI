-- Personal Roadmap schema
CREATE TABLE IF NOT EXISTS _migrations (
  id TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  jql TEXT NOT NULL DEFAULT '',
  checked_quarters_json TEXT NOT NULL DEFAULT '[]',
  imported_quarters_json TEXT NOT NULL DEFAULT '[]',
  release_sheet_json TEXT NOT NULL DEFAULT 'null',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  key TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Epic',
  title TEXT NOT NULL,
  alias TEXT,
  quarter TEXT,
  estimate REAL,
  target_start TEXT,
  target_end TEXT,
  scheduled INTEGER NOT NULL DEFAULT 0,
  start_date TEXT,
  days INTEGER,
  lane INTEGER NOT NULL DEFAULT 0,
  expanded INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'jira',
  jira_key TEXT,
  project_key TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(team_id, key),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_items_team ON items(team_id);
CREATE INDEX IF NOT EXISTS idx_items_scheduled ON items(team_id, scheduled);
-- idx_items_jira_key is created by migration 003 instead: this file is executed
-- before the migrations run, so it must not reference columns that an existing
-- deployment has not been migrated to yet.

CREATE TABLE IF NOT EXISTS subs (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  jira_key TEXT,
  title TEXT NOT NULL,
  alias TEXT,
  owner TEXT,
  start_date TEXT,
  days INTEGER,
  is_draft INTEGER NOT NULL DEFAULT 1,
  cleared INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subs_team_item ON subs(team_id, item_key);

CREATE TABLE IF NOT EXISTS item_markers (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  phase_kind TEXT,
  label TEXT NOT NULL,
  date TEXT,
  jira_key TEXT,
  eta_source TEXT,
  created_by TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_item_markers_team_item ON item_markers(team_id, item_key);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#5B8DEF',
  created_at INTEGER NOT NULL,
  UNIQUE(team_id, name),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS share_tokens (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_share_tokens_team ON share_tokens(team_id);

CREATE TABLE IF NOT EXISTS soft_locks (
  team_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_key TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_client_id TEXT NOT NULL,
  locked_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (team_id, target_type, target_key),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  at INTEGER NOT NULL,
  actor_name TEXT NOT NULL,
  actor_client_id TEXT NOT NULL,
  actor_source TEXT NOT NULL DEFAULT 'anonymous',
  op TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_key TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}',
  share_token_id TEXT,
  ip TEXT,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_log_team_at ON activity_log(team_id, at DESC);

CREATE TABLE IF NOT EXISTS presence (
  team_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'anonymous',
  last_seen INTEGER NOT NULL,
  PRIMARY KEY (team_id, client_id),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);
