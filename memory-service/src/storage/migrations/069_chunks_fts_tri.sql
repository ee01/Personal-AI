-- P0c (memory-foundation plan §11.4): trigram shadow index for CJK /
-- mixed-language recall (chunks_fts_tri).
--
-- The legacy chunks_fts uses the porter unicode61 tokenizer: contiguous CJK
-- text collapses into single long tokens, so Chinese queries only match when
-- the word boundaries align exactly — the observed cross-language gap in the
-- knowledge_update eval regression. A trigram index matches any 3+ character
-- substring.
--
-- This is a SHADOW baseline: nothing in the live ranking reads this table
-- until P0.5/P2 evaluation decides whether it joins the RRF. Only the
-- MEMORY_FTS_TRI_SHADOW probe (RecallEngine) records candidate stats.

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts_tri USING fts5(
  content,
  content='chunks',
  content_rowid='chunk_id',
  tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS chunks_tri_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts_tri(rowid, content) VALUES (new.chunk_id, new.content);
END;
CREATE TRIGGER IF NOT EXISTS chunks_tri_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts_tri(chunks_fts_tri, rowid, content) VALUES('delete', old.chunk_id, old.content);
END;
CREATE TRIGGER IF NOT EXISTS chunks_tri_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts_tri(chunks_fts_tri, rowid, content) VALUES('delete', old.chunk_id, old.content);
  INSERT INTO chunks_fts_tri(rowid, content) VALUES (new.chunk_id, new.content);
END;

-- Initial population of the external-content index.
INSERT INTO chunks_fts_tri(chunks_fts_tri) VALUES ('rebuild');
