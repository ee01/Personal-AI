CREATE TABLE IF NOT EXISTS memory_feedback_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feedback_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(feedback_type, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_mfe_target
  ON memory_feedback_events(target_type, target_id);
