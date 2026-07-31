-- Focus project sync fields for roadmap-sourced watched projects
ALTER TABLE watched_projects ADD COLUMN source TEXT DEFAULT 'manual';
ALTER TABLE watched_projects ADD COLUMN team_ref TEXT;
ALTER TABLE watched_projects ADD COLUMN external_ref_json TEXT;
ALTER TABLE watched_projects ADD COLUMN tier TEXT DEFAULT 'focus';
ALTER TABLE watched_projects ADD COLUMN display_name TEXT;
ALTER TABLE watched_projects ADD COLUMN last_engaged_at INTEGER;
ALTER TABLE watched_projects ADD COLUMN last_synced_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_watched_projects_team_ref
  ON watched_projects(team_ref);

CREATE INDEX IF NOT EXISTS idx_watched_projects_tier
  ON watched_projects(tier);
