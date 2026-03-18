CREATE TABLE IF NOT EXISTS action_results (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  run_id TEXT,
  result_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_json TEXT,
  transcript_path TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (action_id) REFERENCES proposed_actions(id)
);

CREATE INDEX IF NOT EXISTS idx_action_results_thread_created
  ON action_results(thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_action_results_action_created
  ON action_results(action_id, created_at DESC);
