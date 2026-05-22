ALTER TABLE outreach_sessions ADD COLUMN scheduled_for INTEGER;
ALTER TABLE outreach_sessions ADD COLUMN occurrence_key TEXT;
ALTER TABLE outreach_sessions ADD COLUMN occurrence_start_at INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_sessions_template_occurrence
  ON outreach_sessions(template_id, occurrence_key)
  WHERE template_id IS NOT NULL AND occurrence_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_sessions_scheduled_for
  ON outreach_sessions(template_id, scheduled_for DESC);
