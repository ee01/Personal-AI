CREATE TABLE IF NOT EXISTS bot_delivery_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_ref TEXT NOT NULL,
  target_chat_id TEXT,
  queue_id TEXT,
  post_id TEXT,
  http_status INTEGER,
  response_json TEXT,
  stage TEXT NOT NULL,
  error TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bot_delivery_attempt_source ON bot_delivery_attempts(source_ref, id DESC);
