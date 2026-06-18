-- 044_anticipation_briefs.sql (P1-7: sleep-time compute / anticipation)
-- Nightly-precomputed answers to tomorrow's likely questions. A derived cache
-- (never a fact layer): each brief expires (valid_until) and is consumed once.
-- kind: 'meeting' | 'topic' | 'project' | 'deadline'
-- subject_key: the entity/topic/meeting key a question would match on
-- brief_md: the precomputed answer + evidence summary
-- weave_json: optional weave provenance stats for the brief's evidence
CREATE TABLE IF NOT EXISTS anticipation_briefs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  brief_md TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  weave_json TEXT,
  valid_until INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_anticipation_subject ON anticipation_briefs(subject_key, valid_until);
CREATE INDEX IF NOT EXISTS idx_anticipation_valid ON anticipation_briefs(valid_until);
