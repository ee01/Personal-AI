-- F4 fix (reviewed-plan §3.1): unit_views_fts_seg/tri declare `content` as
-- the FTS column, but memory_unit_views has raw_text/segmented_text — no
-- matching column. SQLite FTS5 external-content requires the backing table
-- column name to match the FTS column name for rebuild/integrity-check.
--
-- SQLite cannot ALTER TABLE ADD COLUMN ... STORED, so we drop and recreate
-- the FTS tables with column names matching the backing table, then rebuild.
-- The triggers in migration 070 are also updated (drop+recreate with correct
-- column names).

DROP TRIGGER IF EXISTS unit_views_fts_seg_ai;
DROP TRIGGER IF EXISTS unit_views_fts_seg_ad;
DROP TRIGGER IF EXISTS unit_views_fts_seg_au;
DROP TRIGGER IF EXISTS unit_views_fts_tri_ai;
DROP TRIGGER IF EXISTS unit_views_fts_tri_ad;
DROP TRIGGER IF EXISTS unit_views_fts_tri_au;
DROP TABLE IF EXISTS unit_views_fts_seg;
DROP TABLE IF EXISTS unit_views_fts_tri;

-- Lexical projection using segmented_text (matches backing table column).
CREATE VIRTUAL TABLE IF NOT EXISTS unit_views_fts_seg USING fts5(
  segmented_text,
  content='memory_unit_views',
  content_rowid='view_id',
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS unit_views_fts_seg_ai AFTER INSERT ON memory_unit_views BEGIN
  INSERT INTO unit_views_fts_seg(rowid, segmented_text) VALUES (new.view_id, new.segmented_text);
END;
CREATE TRIGGER IF NOT EXISTS unit_views_fts_seg_ad AFTER DELETE ON memory_unit_views BEGIN
  INSERT INTO unit_views_fts_seg(unit_views_fts_seg, rowid, segmented_text) VALUES('delete', old.view_id, old.segmented_text);
END;
CREATE TRIGGER IF NOT EXISTS unit_views_fts_seg_au AFTER UPDATE ON memory_unit_views BEGIN
  INSERT INTO unit_views_fts_seg(unit_views_fts_seg, rowid, segmented_text) VALUES('delete', old.view_id, old.segmented_text);
  INSERT INTO unit_views_fts_seg(rowid, segmented_text) VALUES (new.view_id, new.segmented_text);
END;

-- Trigram projection using raw_text (matches backing table column).
CREATE VIRTUAL TABLE IF NOT EXISTS unit_views_fts_tri USING fts5(
  raw_text,
  content='memory_unit_views',
  content_rowid='view_id',
  tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS unit_views_fts_tri_ai AFTER INSERT ON memory_unit_views BEGIN
  INSERT INTO unit_views_fts_tri(rowid, raw_text) VALUES (new.view_id, new.raw_text);
END;
CREATE TRIGGER IF NOT EXISTS unit_views_fts_tri_ad AFTER DELETE ON memory_unit_views BEGIN
  INSERT INTO unit_views_fts_tri(unit_views_fts_tri, rowid, raw_text) VALUES('delete', old.view_id, old.raw_text);
END;
CREATE TRIGGER IF NOT EXISTS unit_views_fts_tri_au AFTER UPDATE ON memory_unit_views BEGIN
  INSERT INTO unit_views_fts_tri(unit_views_fts_tri, rowid, raw_text) VALUES('delete', old.view_id, old.raw_text);
  INSERT INTO unit_views_fts_tri(rowid, raw_text) VALUES (new.view_id, new.raw_text);
END;

-- Rebuild both from the backing table.
INSERT INTO unit_views_fts_seg(unit_views_fts_seg) VALUES ('rebuild');
INSERT INTO unit_views_fts_tri(unit_views_fts_tri) VALUES ('rebuild');
