-- Markdown Git Mirror (plan §5): incremental mirror manifest and receipts.
--
-- The projection itself is deterministic and rebuildable from SQLite truth;
-- this table only records what we last pushed to the user's GitHub repo so the
-- next night can (a) skip unchanged files (content hash) and (b) detect remote
-- hand-edits (blob sha drift) without ever force-pushing.

CREATE TABLE IF NOT EXISTS mirror_manifest (
  owner_user_id TEXT NOT NULL,
  path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  remote_sha TEXT,
  last_commit_sha TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (owner_user_id, path)
);

CREATE INDEX IF NOT EXISTS idx_mirror_manifest_owner
  ON mirror_manifest(owner_user_id, updated_at DESC);

-- One row per mirror run for observability and the Options receipt card.
CREATE TABLE IF NOT EXISTS mirror_runs (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'failed', 'skipped')),
  mode TEXT NOT NULL DEFAULT 'markdown'
    CHECK (mode IN ('markdown', 'encrypted')),
  scope TEXT NOT NULL DEFAULT 'all'
    CHECK (scope IN ('all', 'self_only')),
  files_total INTEGER NOT NULL DEFAULT 0,
  files_changed INTEGER NOT NULL DEFAULT 0,
  bytes_total INTEGER NOT NULL DEFAULT 0,
  excluded_by_policy INTEGER NOT NULL DEFAULT 0,
  conflict_paths_json TEXT NOT NULL DEFAULT '[]',
  commit_sha TEXT,
  commit_url TEXT,
  error TEXT,
  trigger TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (trigger IN ('scheduled', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_mirror_runs_owner
  ON mirror_runs(owner_user_id, started_at DESC);
