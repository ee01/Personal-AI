-- Personal Skill Library / Skill Foundry MVP

CREATE TABLE IF NOT EXISTS personal_skills (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT 'work',
  risk TEXT NOT NULL DEFAULT 'medium',
  trigger_text TEXT,
  not_use_text TEXT,
  status TEXT NOT NULL CHECK (status IN ('suggestion', 'active', 'dismissed')),
  owner TEXT,
  source_kinds_json TEXT NOT NULL DEFAULT '[]',
  repetition TEXT,
  risk_brief TEXT,
  suggested_from TEXT,
  suggested_at INTEGER,
  notified_at INTEGER,
  snoozed_until INTEGER,
  dismissed_at INTEGER,
  dismiss_reason TEXT,
  suggestion_cluster_key TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_personal_skills_status_updated
  ON personal_skills(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_personal_skills_scope
  ON personal_skills(scope);
CREATE INDEX IF NOT EXISTS idx_personal_skills_cluster
  ON personal_skills(suggestion_cluster_key);

CREATE TABLE IF NOT EXISTS skill_versions (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  version TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  skill_md TEXT NOT NULL DEFAULT '',
  package_json TEXT NOT NULL DEFAULT '{}',
  workflow_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  source_episodes_json TEXT NOT NULL DEFAULT '[]',
  files_json TEXT NOT NULL DEFAULT '[]',
  sha256 TEXT NOT NULL,
  changelog TEXT,
  created_from TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (skill_id) REFERENCES personal_skills(id) ON DELETE CASCADE,
  UNIQUE (skill_id, version)
);

CREATE INDEX IF NOT EXISTS idx_skill_versions_skill_active
  ON skill_versions(skill_id, is_active);

CREATE TABLE IF NOT EXISTS skill_platform_bindings (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('installed', 'outdated', 'not_installed', 'blocked', 'unknown')),
  installed_version TEXT,
  installed_sha256 TEXT,
  remote_mtime INTEGER,
  last_synced_at INTEGER,
  last_error TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (skill_id) REFERENCES personal_skills(id) ON DELETE CASCADE,
  UNIQUE (skill_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_skill_bindings_platform_state
  ON skill_platform_bindings(platform, state);

CREATE TABLE IF NOT EXISTS skill_platform_sync_settings (
  platform TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL,
  capability TEXT NOT NULL CHECK (capability IN ('internal', 'api', 'fs_via_desktop_app', 'manual_only')),
  mode TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  last_probe_at INTEGER,
  last_error TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_share_links (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (skill_id) REFERENCES personal_skills(id) ON DELETE CASCADE,
  FOREIGN KEY (version_id) REFERENCES skill_versions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_skill_share_links_skill_version
  ON skill_share_links(skill_id, version_id);
