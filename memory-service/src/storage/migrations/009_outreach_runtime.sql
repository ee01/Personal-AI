CREATE TABLE IF NOT EXISTS outreach_templates (
  id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL,
  source_ref_id TEXT,
  sheet_message_id TEXT,
  title TEXT NOT NULL,
  question_template TEXT NOT NULL,
  context_template TEXT,
  target_type TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  schedule_spec_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  approval_policy TEXT NOT NULL DEFAULT 'manual_direct',
  max_followup INTEGER NOT NULL DEFAULT 1,
  followup_interval_seconds INTEGER NOT NULL DEFAULT 86400,
  sync_state TEXT NOT NULL DEFAULT 'synced',
  last_sync_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outreach_templates_sheet_message
  ON outreach_templates(sheet_message_id);

CREATE INDEX IF NOT EXISTS idx_outreach_templates_enabled_updated
  ON outreach_templates(enabled, updated_at DESC);

CREATE TABLE IF NOT EXISTS outreach_sessions (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  origin_kind TEXT NOT NULL,
  thread_id TEXT,
  run_id TEXT,
  action_id TEXT,
  channel TEXT NOT NULL DEFAULT 'ringcentral',
  target_type TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  rendered_question TEXT NOT NULL,
  rendered_context TEXT,
  status TEXT NOT NULL,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  followup_count INTEGER NOT NULL DEFAULT 0,
  max_followup INTEGER NOT NULL DEFAULT 1,
  wait_until INTEGER,
  next_check_at INTEGER,
  sent_post_id TEXT,
  reply_post_id TEXT,
  reply_sender TEXT,
  reply_raw_text TEXT,
  reply_classification TEXT,
  reply_confidence REAL,
  outcome_json TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  resolved_at INTEGER,
  FOREIGN KEY (template_id) REFERENCES outreach_templates(id),
  FOREIGN KEY (action_id) REFERENCES proposed_actions(id)
);

CREATE INDEX IF NOT EXISTS idx_outreach_sessions_status_next_check
  ON outreach_sessions(status, next_check_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outreach_sessions_template_created
  ON outreach_sessions(template_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outreach_sessions_thread_created
  ON outreach_sessions(thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outreach_sessions_action_created
  ON outreach_sessions(action_id, created_at DESC);

CREATE TABLE IF NOT EXISTS outreach_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES outreach_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_outreach_events_session_created
  ON outreach_events(session_id, created_at ASC);
