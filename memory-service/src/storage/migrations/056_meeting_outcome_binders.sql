-- Meeting outcome lifecycle shared by Today Pilot meeting prep, Meeting Pilot,
-- and read-only Ask consumption. This is derived data and can be rebuilt from
-- calendar prep plus the persisted Meeting Pilot archive.

CREATE TABLE IF NOT EXISTS meeting_outcome_binders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  prep_id TEXT NOT NULL,
  event_external_id TEXT NOT NULL,
  event_series_key TEXT,
  event_title TEXT NOT NULL,
  event_start_at INTEGER NOT NULL,
  meeting_id TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('planned', 'in_meeting', 'post_meeting_pending', 'bound', 'partial', 'blocked')
  ),
  slots_json TEXT NOT NULL DEFAULT '[]',
  source_evidence_json TEXT NOT NULL DEFAULT '[]',
  source_hash TEXT NOT NULL,
  binding_mode TEXT CHECK (
    binding_mode IS NULL OR binding_mode IN ('llm', 'deterministic_fallback')
  ),
  binding_error TEXT,
  generated_at INTEGER NOT NULL,
  bound_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, prep_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_outcome_binders_meeting
  ON meeting_outcome_binders(user_id, meeting_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_meeting_outcome_binders_event
  ON meeting_outcome_binders(user_id, event_external_id, event_start_at DESC);

CREATE INDEX IF NOT EXISTS idx_meeting_outcome_binders_series
  ON meeting_outcome_binders(user_id, event_series_key, event_start_at DESC);

CREATE INDEX IF NOT EXISTS idx_meeting_outcome_binders_recent
  ON meeting_outcome_binders(user_id, status, updated_at DESC);
