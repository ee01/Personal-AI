-- Conversation-local context frames for resolving short/deictic recall queries.
--
-- These frames intentionally store compact anchors, not full transcript copies.
-- They let Ask / Context Recall understand phrases such as "那个 BE" from the
-- current RingCentral group or meeting context.

CREATE TABLE IF NOT EXISTS conversation_context_frames (
  id TEXT PRIMARY KEY,
  surface TEXT NOT NULL,
  source_type TEXT,
  conversation_id TEXT,
  group_id TEXT,
  meeting_id TEXT,
  issue_key TEXT,
  title TEXT,
  summary TEXT,
  dominant_entities_json TEXT,
  dominant_projects_json TEXT,
  topics_json TEXT,
  acronym_aliases_json TEXT,
  role_terms_json TEXT,
  source_anchors_json TEXT,
  confidence REAL DEFAULT 0.5,
  window_start INTEGER,
  window_end INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_context_frames_group
  ON conversation_context_frames(group_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_context_frames_conversation
  ON conversation_context_frames(conversation_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_context_frames_meeting
  ON conversation_context_frames(meeting_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_context_frames_updated
  ON conversation_context_frames(updated_at DESC);
