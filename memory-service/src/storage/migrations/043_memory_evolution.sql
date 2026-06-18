-- 043_memory_evolution.sql (P1-6 slice B: memory evolution)
-- A-MEM style re-consolidation. When a new memory relates to older ones, the
-- nightly evolution phase records associative links and an audit trail of any
-- derived-layer (summary/tags) change. Original content is NEVER rewritten.

-- Associative chunk-to-chunk links. Also feed PPR (chunk-level association) and
-- the weave provenance stats. reason is a short machine/LLM tag.
CREATE TABLE IF NOT EXISTS memory_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_chunk_id INTEGER NOT NULL,
  to_chunk_id INTEGER NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(from_chunk_id, to_chunk_id, reason)
);
CREATE INDEX IF NOT EXISTS idx_memory_links_from ON memory_links(from_chunk_id);
CREATE INDEX IF NOT EXISTS idx_memory_links_to ON memory_links(to_chunk_id);

-- Audit trail for derived-layer evolution. The original chunk content is never
-- modified -- only message-level summaries / tags evolve, and every change is
-- recorded here so it can be inspected or reverted.
CREATE TABLE IF NOT EXISTS chunk_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chunk_id INTEGER NOT NULL,
  old_summary TEXT,
  new_summary TEXT,
  reason TEXT,
  evidence_chunk_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunk_revisions_chunk ON chunk_revisions(chunk_id);
