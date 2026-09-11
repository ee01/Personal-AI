-- F4 fix (reviewed-plan §3.1): unit_views_fts_seg and unit_views_fts_tri
-- use `content` as the FTS column name, but memory_unit_views has
-- raw_text/segmented_text — no matching column. This causes
-- `rebuild` and `integrity-check` to fail on external content tables.
--
-- Fix: add a generated "content" column that COALESCEs segmented_text and
-- raw_text, making the backing table compatible with the FTS column name.

ALTER TABLE memory_unit_views ADD COLUMN content TEXT
  GENERATED ALWAYS AS (COALESCE(segmented_text, raw_text)) STORED;

-- Verify: rebuild both FTS tables from the backing table.
INSERT INTO unit_views_fts_seg(unit_views_fts_seg) VALUES ('rebuild');
INSERT INTO unit_views_fts_tri(unit_views_fts_tri) VALUES ('rebuild');
