-- 041_memory_probation.sql (P1-6 slice C: TTL probation)
-- Low-confidence / untrusted auto-captures enter a 72h probation: searchable by
-- active search, but capped at retrieval_tier='weak' so they stay out of passive
-- Lens / notifications until they prove value (recall / positive feedback) or
-- expire (no interaction -> archived, skipping the slow salience decay).
-- probation_until = expiry epoch in seconds (NULL means "not on probation").

ALTER TABLE memory_metadata ADD COLUMN probation_until INTEGER;

CREATE INDEX IF NOT EXISTS idx_mm_probation
  ON memory_metadata(probation_until)
  WHERE probation_until IS NOT NULL;
