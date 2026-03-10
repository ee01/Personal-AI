-- 001_initial.sql
-- Complete schema for the Personal AI memory service

-- Schema version tracking
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  applied_at INTEGER NOT NULL
);

-- Raw ingested messages
CREATE TABLE IF NOT EXISTS messages_raw (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  summary TEXT,
  source_type TEXT NOT NULL,  -- 'glip', 'jira', 'web', 'manual'
  source_url TEXT,
  source_title TEXT,
  sender TEXT,
  group_id TEXT,
  group_name TEXT,
  timestamp INTEGER NOT NULL,
  entities_json TEXT,         -- extracted entities [{type, name, id}]
  matched_projects_json TEXT, -- matched watched projects
  importance REAL DEFAULT 0.5,
  sentiment TEXT DEFAULT 'neutral',
  metadata_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_msg_timestamp ON messages_raw(timestamp);
CREATE INDEX IF NOT EXISTS idx_msg_source ON messages_raw(source_type);
CREATE INDEX IF NOT EXISTS idx_msg_group ON messages_raw(group_id);
CREATE INDEX IF NOT EXISTS idx_msg_sender ON messages_raw(sender);

-- Markdown chunks for vector search
CREATE TABLE IF NOT EXISTS chunks (
  chunk_id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  line_start INTEGER NOT NULL,
  line_end INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  source_type TEXT,
  related_project TEXT,
  related_entity_id TEXT,
  token_count INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_chunk_file ON chunks(file_path);
CREATE INDEX IF NOT EXISTS idx_chunk_hash ON chunks(content_hash);

-- FTS5 full-text search on chunks
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  content,
  content='chunks',
  content_rowid='chunk_id',
  tokenize='porter unicode61'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, content) VALUES (new.chunk_id, new.content);
END;
CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.chunk_id, old.content);
END;
CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.chunk_id, old.content);
  INSERT INTO chunks_fts(rowid, content) VALUES (new.chunk_id, new.content);
END;

-- Vector index for chunks (384-dim for all-MiniLM-L6-v2)
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
  chunk_id INTEGER PRIMARY KEY,
  embedding float[384]
);

-- Vector index for messages
CREATE VIRTUAL TABLE IF NOT EXISTS messages_vec USING vec0(
  message_id TEXT PRIMARY KEY,
  embedding float[384]
);

-- Knowledge graph entities
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,  -- Person, Project, Task, Organization, Technology, Topic, Document
  name TEXT NOT NULL,
  aliases_json TEXT,   -- ["alias1", "alias2"]
  description TEXT,
  importance REAL DEFAULT 0.5,
  access_count INTEGER DEFAULT 0,
  last_accessed INTEGER,
  first_seen INTEGER,
  last_seen INTEGER,
  mention_count INTEGER DEFAULT 0,
  tags_json TEXT,
  markdown_path TEXT,
  status TEXT DEFAULT 'active',  -- active, archived, merged
  merged_into TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_entity_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entity_name ON entities(name);
CREATE INDEX IF NOT EXISTS idx_entity_status ON entities(status);

-- Bitemporal entity properties (event sourcing)
CREATE TABLE IF NOT EXISTS entity_properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  property_key TEXT NOT NULL,
  property_value TEXT NOT NULL,
  value_type TEXT DEFAULT 'string', -- string, number, boolean, json, date
  source_message_id TEXT,
  source_author TEXT,
  source_authority TEXT,  -- official, team_lead, peer, self, inferred
  source_context TEXT,
  valid_from INTEGER,
  valid_to INTEGER,
  tx_start INTEGER NOT NULL,
  tx_end INTEGER,
  confidence REAL DEFAULT 0.8,
  superseded_by INTEGER,
  supersede_reason TEXT,
  is_final BOOLEAN DEFAULT 0,
  status TEXT DEFAULT 'active', -- active, superseded, retracted
  action_type TEXT,  -- set, update, retract, confirm
  depends_on_json TEXT,
  related_property_ids_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_ep_entity_key ON entity_properties(entity_id, property_key);
CREATE INDEX IF NOT EXISTS idx_ep_active ON entity_properties(entity_id, property_key, status) WHERE status = 'active' AND tx_end IS NULL;
CREATE INDEX IF NOT EXISTS idx_ep_source ON entity_properties(source_message_id);

-- Entity relationships (knowledge graph edges)
CREATE TABLE IF NOT EXISTS relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_entity_id TEXT NOT NULL REFERENCES entities(id),
  to_entity_id TEXT NOT NULL REFERENCES entities(id),
  relation_type TEXT NOT NULL,  -- works_on, reports_to, owns, mentions, etc.
  strength REAL DEFAULT 0.5,
  co_occurrence_count INTEGER DEFAULT 1,
  evidence_message_ids_json TEXT,
  context TEXT,
  valid_from INTEGER,
  valid_to INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_rel_from ON relationships(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_rel_to ON relationships(to_entity_id);
CREATE INDEX IF NOT EXISTS idx_rel_type ON relationships(relation_type);

-- Memory salience metadata
CREATE TABLE IF NOT EXISTS memory_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,  -- message, chunk, entity
  target_id TEXT NOT NULL,
  salience_score REAL DEFAULT 0,
  importance REAL DEFAULT 0.5,
  frequency INTEGER DEFAULT 1,
  recency_boost REAL DEFAULT 1.0,
  surprise_score REAL DEFAULT 0,
  redundancy REAL DEFAULT 0,
  access_count INTEGER DEFAULT 0,
  last_accessed INTEGER,
  decay_rate REAL DEFAULT 1.0,
  half_life_days REAL DEFAULT 30,
  consolidation_level TEXT DEFAULT 'temporary', -- temporary, working, consolidated, core
  next_review_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  UNIQUE(target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_mm_salience ON memory_metadata(salience_score DESC);
CREATE INDEX IF NOT EXISTS idx_mm_consolidation ON memory_metadata(consolidation_level);

-- Watched projects for proactive tracking
CREATE TABLE IF NOT EXISTS watched_projects (
  id TEXT PRIMARY KEY,
  entity_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  aliases_json TEXT,
  auto_capture_rules_json TEXT,
  tracked_properties_json TEXT,
  is_active BOOLEAN DEFAULT 1,
  priority INTEGER DEFAULT 5,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

-- Reflection artifacts from consolidation
CREATE TABLE IF NOT EXISTS reflection_artifacts (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,  -- daily, weekly, project, entity
  scope_ref TEXT,
  summary TEXT NOT NULL,
  lessons_json TEXT,
  open_questions_json TEXT,
  discoveries_json TEXT,
  suggested_action_ids_json TEXT,
  source_message_ids_json TEXT,
  markdown_path TEXT,
  created_at INTEGER NOT NULL
);

-- Proposed actions from proactive engine
CREATE TABLE IF NOT EXISTS proposed_actions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,  -- reminder, follow_up, suggestion, alert
  title TEXT NOT NULL,
  description TEXT,
  params_json TEXT,
  risk_level TEXT DEFAULT 'low',
  confidence REAL DEFAULT 0.5,
  evidence_refs_json TEXT,
  requires_approval BOOLEAN DEFAULT 0,
  state TEXT DEFAULT 'pending', -- pending, approved, executed, dismissed, expired
  approved_at INTEGER,
  executed_at INTEGER,
  source TEXT,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pa_state ON proposed_actions(state);

-- Confirm requests for user decisions
CREATE TABLE IF NOT EXISTS confirm_requests (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  context TEXT,
  options_json TEXT,
  evidence_refs_json TEXT,
  category TEXT,
  related_entity_id TEXT,
  related_property_id INTEGER,
  priority TEXT DEFAULT 'normal',
  state TEXT DEFAULT 'pending',
  user_answer TEXT,
  answered_at INTEGER,
  snooze_until INTEGER,
  snooze_count INTEGER DEFAULT 0,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cr_state ON confirm_requests(state) WHERE state = 'pending';

-- Notification records
CREATE TABLE IF NOT EXISTS notification_records (
  id TEXT PRIMARY KEY,
  channel TEXT DEFAULT 'chrome_notification',
  type TEXT,
  title TEXT NOT NULL,
  body TEXT,
  payload_json TEXT,
  topic_id TEXT,
  related_entity_id TEXT,
  utility_score REAL,
  sent_at INTEGER,
  clicked_at INTEGER,
  dismissed_at INTEGER,
  action_taken TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_topic ON notification_records(topic_id, sent_at);
