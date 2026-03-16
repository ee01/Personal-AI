-- 005_action_runtime.sql
-- Upgrade proposed_actions into a queue-like runtime

ALTER TABLE proposed_actions ADD COLUMN thread_id TEXT;
ALTER TABLE proposed_actions ADD COLUMN run_id TEXT;
ALTER TABLE proposed_actions ADD COLUMN action_type TEXT;
ALTER TABLE proposed_actions ADD COLUMN execution_mode TEXT DEFAULT 'manual';
ALTER TABLE proposed_actions ADD COLUMN priority INTEGER DEFAULT 5;
ALTER TABLE proposed_actions ADD COLUMN idempotency_key TEXT;
ALTER TABLE proposed_actions ADD COLUMN depends_on_json TEXT;
ALTER TABLE proposed_actions ADD COLUMN scheduled_at INTEGER;
ALTER TABLE proposed_actions ADD COLUMN started_at INTEGER;
ALTER TABLE proposed_actions ADD COLUMN finished_at INTEGER;
ALTER TABLE proposed_actions ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE proposed_actions ADD COLUMN last_error TEXT;
ALTER TABLE proposed_actions ADD COLUMN result_json TEXT;
ALTER TABLE proposed_actions ADD COLUMN source_kind TEXT;
ALTER TABLE proposed_actions ADD COLUMN source_ref_id TEXT;
ALTER TABLE proposed_actions ADD COLUMN queue_status TEXT DEFAULT 'queued';
ALTER TABLE proposed_actions ADD COLUMN utility_score REAL;
ALTER TABLE proposed_actions ADD COLUMN urgency_score REAL;

UPDATE proposed_actions
SET action_type = COALESCE(action_type, type)
WHERE action_type IS NULL OR action_type = '';

UPDATE proposed_actions
SET queue_status = CASE state
  WHEN 'executed' THEN 'succeeded'
  WHEN 'dismissed' THEN 'cancelled'
  WHEN 'expired' THEN 'dead_letter'
  ELSE 'queued'
END
WHERE queue_status IS NULL OR queue_status = '';

CREATE INDEX IF NOT EXISTS idx_proposed_actions_queue
  ON proposed_actions(queue_status, scheduled_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_proposed_actions_thread
  ON proposed_actions(thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_proposed_actions_idempotency
  ON proposed_actions(idempotency_key);

CREATE TABLE IF NOT EXISTS proposed_action_attempts (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  result_json TEXT,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  FOREIGN KEY (action_id) REFERENCES proposed_actions(id)
);

CREATE INDEX IF NOT EXISTS idx_proposed_action_attempts_action
  ON proposed_action_attempts(action_id, started_at DESC);
