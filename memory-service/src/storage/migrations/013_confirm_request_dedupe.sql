ALTER TABLE confirm_requests ADD COLUMN dedupe_key TEXT;

CREATE INDEX IF NOT EXISTS idx_cr_state_dedupe
  ON confirm_requests(state, dedupe_key, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cr_pending_dedupe
  ON confirm_requests(dedupe_key)
  WHERE state = 'pending' AND dedupe_key IS NOT NULL;
