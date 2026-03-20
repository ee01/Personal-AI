ALTER TABLE outreach_sessions ADD COLUMN target_resolution_status TEXT NOT NULL DEFAULT 'unresolved';
ALTER TABLE outreach_sessions ADD COLUMN target_resolved_type TEXT;
ALTER TABLE outreach_sessions ADD COLUMN target_resolved_id TEXT;
ALTER TABLE outreach_sessions ADD COLUMN target_resolved_label TEXT;
ALTER TABLE outreach_sessions ADD COLUMN target_resolved_chat_id TEXT;
ALTER TABLE outreach_sessions ADD COLUMN target_candidates_json TEXT;

CREATE INDEX IF NOT EXISTS idx_outreach_sessions_target_resolution
  ON outreach_sessions(target_resolution_status, status, updated_at DESC);
