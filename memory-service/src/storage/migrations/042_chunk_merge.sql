-- 042_chunk_merge.sql (P1-6 slice A: chunk-level merge decision)
-- When a new chunk is a near-duplicate of existing memory, an LLM decides
-- ADD / UPDATE / MERGE / NOOP instead of unconditionally piling up versions.
-- These columns track the resulting links. Physical rows are never deleted
-- (UPDATE/MERGE only move retrieval tiers and record provenance).
-- superseded_by  = chunk_id of the newer version that replaced this chunk
-- merged_into    = chunk_id of the merged chunk this one was folded into
-- merge_reason   = short LLM rationale for the decision

ALTER TABLE chunks ADD COLUMN superseded_by INTEGER;
ALTER TABLE chunks ADD COLUMN merged_into INTEGER;
ALTER TABLE chunks ADD COLUMN merge_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_chunks_superseded_by ON chunks(superseded_by) WHERE superseded_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chunks_merged_into ON chunks(merged_into) WHERE merged_into IS NOT NULL;
