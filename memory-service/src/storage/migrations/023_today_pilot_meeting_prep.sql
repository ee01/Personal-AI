-- Today Pilot offline/on-demand meeting preparation cache.
-- This table is a derived layer. It can be rebuilt from calendar events and
-- recalled memory evidence without mutating the long-term memory graph.

CREATE TABLE IF NOT EXISTS today_meeting_preps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  timezone TEXT NOT NULL,
  brief_id TEXT,
  mission_id TEXT,
  event_external_id TEXT NOT NULL,
  event_series_key TEXT,
  event_title TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  goal_hash TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('ready', 'fallback', 'failed', 'stale')),
  generated_mode TEXT NOT NULL CHECK (
    generated_mode IN ('nightly_llm', 'on_demand_llm', 'deterministic_fallback')
  ),
  summary_md TEXT NOT NULL DEFAULT '',
  cue_cards_json TEXT NOT NULL DEFAULT '[]',
  questions_json TEXT NOT NULL DEFAULT '[]',
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  context_pack_md TEXT NOT NULL DEFAULT '',
  redaction_json TEXT NOT NULL DEFAULT '{}',
  llm_usage_json TEXT NOT NULL DEFAULT '{}',
  source_hash TEXT NOT NULL,
  generated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  error TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  UNIQUE(user_id, local_date, event_external_id, goal_hash)
);

CREATE INDEX IF NOT EXISTS idx_today_meeting_preps_user_date_start
  ON today_meeting_preps(user_id, local_date, start_at);

CREATE INDEX IF NOT EXISTS idx_today_meeting_preps_event
  ON today_meeting_preps(user_id, event_external_id, goal_hash);

CREATE INDEX IF NOT EXISTS idx_today_meeting_preps_mission
  ON today_meeting_preps(mission_id);
