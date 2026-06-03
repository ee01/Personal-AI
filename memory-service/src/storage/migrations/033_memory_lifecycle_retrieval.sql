-- 033_memory_lifecycle_retrieval.sql
-- Logical retrieval lifecycle for ambient forgetting. Raw memory stays in DB;
-- default recall behavior is controlled by retrieval_tier/effective_salience.

ALTER TABLE memory_metadata ADD COLUMN retrieval_tier TEXT NOT NULL DEFAULT 'active';
ALTER TABLE memory_metadata ADD COLUMN effective_salience REAL NOT NULL DEFAULT 0;
ALTER TABLE memory_metadata ADD COLUMN archived_at INTEGER;
ALTER TABLE memory_metadata ADD COLUMN archive_reason TEXT;
ALTER TABLE memory_metadata ADD COLUMN archive_ref TEXT;
ALTER TABLE memory_metadata ADD COLUMN lifecycle_updated_at INTEGER;

UPDATE memory_metadata
SET
  retrieval_tier = CASE
    WHEN consolidation_level = 'permanent' OR consolidation_level = 'core' THEN 'core'
    WHEN consolidation_level = 'forgotten' THEN 'forgotten'
    WHEN consolidation_level = 'archived' THEN 'archive_only'
    WHEN salience_score < 0.05 THEN 'forgotten'
    WHEN salience_score < 0.15 THEN 'archive_only'
    WHEN salience_score < 0.35 THEN 'weak'
    ELSE 'active'
  END,
  effective_salience = CASE
    WHEN effective_salience > 0 THEN effective_salience
    ELSE salience_score
  END,
  archived_at = CASE
    WHEN consolidation_level IN ('forgotten', 'archived') OR salience_score < 0.15 THEN COALESCE(updated_at, created_at)
    ELSE archived_at
  END,
  archive_reason = CASE
    WHEN consolidation_level = 'forgotten' OR salience_score < 0.05 THEN 'salience_below_forgotten_threshold'
    WHEN consolidation_level = 'archived' OR salience_score < 0.15 THEN 'salience_below_archive_threshold'
    ELSE archive_reason
  END,
  lifecycle_updated_at = COALESCE(updated_at, created_at);

CREATE INDEX IF NOT EXISTS idx_mm_retrieval_tier_target
  ON memory_metadata(retrieval_tier, target_type);

CREATE INDEX IF NOT EXISTS idx_mm_retrieval_tier_salience
  ON memory_metadata(retrieval_tier, effective_salience DESC);
