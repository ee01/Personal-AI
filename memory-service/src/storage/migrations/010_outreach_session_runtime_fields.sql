ALTER TABLE outreach_sessions ADD COLUMN followup_interval_seconds INTEGER NOT NULL DEFAULT 86400;
ALTER TABLE outreach_sessions ADD COLUMN sent_chat_id TEXT;
ALTER TABLE outreach_sessions ADD COLUMN last_poll_at INTEGER;
ALTER TABLE outreach_sessions ADD COLUMN terminal_synced_at INTEGER;
ALTER TABLE outreach_sessions ADD COLUMN action_result_id TEXT;

CREATE INDEX IF NOT EXISTS idx_outreach_sessions_terminal_sync
  ON outreach_sessions(origin_kind, status, terminal_synced_at, updated_at DESC);
