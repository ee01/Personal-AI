CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL,
  external_id TEXT NOT NULL,
  series_key TEXT,
  title TEXT NOT NULL,
  description_preview TEXT,
  start_at INTEGER NOT NULL,
  end_at INTEGER,
  organizer_json TEXT,
  attendees_json TEXT,
  location TEXT,
  join_url TEXT,
  source_url TEXT,
  cancelled INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT NOT NULL,
  metadata_json TEXT,
  last_modified_at INTEGER,
  synced_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(source_system, external_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_source
  ON calendar_events(source_system, external_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_start
  ON calendar_events(start_at);

CREATE INDEX IF NOT EXISTS idx_calendar_events_series
  ON calendar_events(series_key);
