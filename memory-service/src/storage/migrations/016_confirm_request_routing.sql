ALTER TABLE confirm_requests ADD COLUMN routing TEXT;
ALTER TABLE confirm_requests ADD COLUMN reason_code TEXT;
ALTER TABLE confirm_requests ADD COLUMN source_anchor TEXT;
ALTER TABLE confirm_requests ADD COLUMN gap_type TEXT;
ALTER TABLE confirm_requests ADD COLUMN updated_at INTEGER;

UPDATE confirm_requests
SET updated_at = COALESCE(answered_at, created_at)
WHERE updated_at IS NULL;

UPDATE confirm_requests
SET routing = 'decision'
WHERE routing IS NULL
  AND (
    category IS NULL
    OR category IN ('property_change', 'profile_conflict', 'openclaw_delegation')
  );

CREATE INDEX IF NOT EXISTS idx_confirm_requests_routing_state
  ON confirm_requests(routing, state, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_confirm_requests_source_anchor_gap
  ON confirm_requests(source_anchor, gap_type)
  WHERE source_anchor IS NOT NULL AND gap_type IS NOT NULL;
