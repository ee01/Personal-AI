CREATE TABLE IF NOT EXISTS day_briefs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  timezone TEXT NOT NULL,
  generated_at INTEGER NOT NULL,
  horizon_from INTEGER NOT NULL,
  horizon_to INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  summary TEXT,
  attention_budget_json TEXT NOT NULL DEFAULT '{}',
  source_stats_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, local_date)
);

CREATE INDEX IF NOT EXISTS idx_day_briefs_user_date
  ON day_briefs(user_id, local_date);

CREATE TABLE IF NOT EXISTS day_missions (
  id TEXT PRIMARY KEY,
  brief_id TEXT NOT NULL,
  mission_key TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  source_kinds_json TEXT NOT NULL DEFAULT '[]',
  time_window_json TEXT NOT NULL DEFAULT '{}',
  related_refs_json TEXT NOT NULL DEFAULT '{}',
  current_state TEXT,
  desired_outcome TEXT,
  next_actions_json TEXT NOT NULL DEFAULT '[]',
  score REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (brief_id) REFERENCES day_briefs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_day_missions_brief_score
  ON day_missions(brief_id, score DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_day_missions_brief_key
  ON day_missions(brief_id, mission_key);

CREATE TABLE IF NOT EXISTS day_brief_cards (
  id TEXT PRIMARY KEY,
  brief_id TEXT NOT NULL,
  mission_id TEXT,
  card_type TEXT NOT NULL,
  title TEXT NOT NULL,
  priority TEXT NOT NULL,
  state TEXT NOT NULL,
  why_now TEXT NOT NULL,
  next_best_action TEXT NOT NULL,
  due_at INTEGER,
  people_json TEXT NOT NULL DEFAULT '[]',
  projects_json TEXT NOT NULL DEFAULT '[]',
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  open_questions_json TEXT NOT NULL DEFAULT '[]',
  trust_json TEXT NOT NULL DEFAULT '{}',
  context_pack_json TEXT NOT NULL DEFAULT '{}',
  source_hash TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (brief_id) REFERENCES day_briefs(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_id) REFERENCES day_missions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_day_brief_cards_brief_score
  ON day_brief_cards(brief_id, score DESC);

CREATE INDEX IF NOT EXISTS idx_day_brief_cards_state
  ON day_brief_cards(state, score DESC);

CREATE TABLE IF NOT EXISTS day_brief_feedback (
  id TEXT PRIMARY KEY,
  brief_id TEXT NOT NULL,
  card_id TEXT,
  mission_id TEXT,
  action TEXT NOT NULL,
  reason TEXT,
  note TEXT,
  snooze_until INTEGER,
  mute_key TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (brief_id) REFERENCES day_briefs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_day_brief_feedback_card_created
  ON day_brief_feedback(card_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_day_brief_feedback_mute
  ON day_brief_feedback(mute_key, created_at DESC)
  WHERE mute_key IS NOT NULL;
