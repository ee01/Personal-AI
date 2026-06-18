-- Behavioral intimacy (P0-4): a long-horizon affinity factor learned from the
-- user real interaction behavior (the third of the book three ranking signals,
-- after organizational relationship and information nature). Rolled up offline
-- from the existing outcome ledger, then read by recall to nudge ranking.
--
-- affinity is in [-1, 1]: positive means the user repeatedly engages well with
-- this subject, negative (floored at -0.5) means repeated ignore/mark-wrong.
-- This is a ranking signal only -- never a confirmed profile fact, and it never
-- triggers a side effect (no auto-read, no auto-subscribe).

CREATE TABLE IF NOT EXISTS behavior_affinity (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,   -- 'entity' | 'source'
  subject_key TEXT NOT NULL,    -- entity id, or source type
  affinity REAL NOT NULL DEFAULT 0,
  positive_events INTEGER NOT NULL DEFAULT 0,
  negative_events INTEGER NOT NULL DEFAULT 0,
  last_event_at INTEGER,
  updated_at INTEGER NOT NULL,
  UNIQUE(subject_type, subject_key)
);

CREATE INDEX IF NOT EXISTS idx_behavior_affinity_subject
  ON behavior_affinity(subject_type, subject_key);
