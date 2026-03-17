-- 007_concerned_items_content_updated_at.sql
-- Track logical edit time for concernedItems snapshots (ms precision).

ALTER TABLE concerned_items_state
ADD COLUMN content_updated_at INTEGER;

UPDATE concerned_items_state
SET content_updated_at = updated_at * 1000
WHERE content_updated_at IS NULL
  AND updated_at IS NOT NULL;
