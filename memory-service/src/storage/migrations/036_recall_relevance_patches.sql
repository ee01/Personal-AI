CREATE TABLE IF NOT EXISTS recall_relevance_patches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL DEFAULT 'feedback_api',
  scene_signature TEXT NOT NULL,
  scene_json TEXT NOT NULL DEFAULT '{}',
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'hide_for_scene',
  scope TEXT NOT NULL DEFAULT 'scene_only',
  auto_applied INTEGER NOT NULL DEFAULT 1,
  user_note TEXT,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_recall_relevance_patches_user_status
  ON recall_relevance_patches(user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_recall_relevance_patches_target
  ON recall_relevance_patches(user_id, target_type, target_id, status);

CREATE INDEX IF NOT EXISTS idx_recall_relevance_patches_scene
  ON recall_relevance_patches(user_id, scene_signature, status);

CREATE TABLE IF NOT EXISTS recall_patch_runs (
  id TEXT PRIMARY KEY,
  patch_id TEXT NOT NULL,
  before_json TEXT NOT NULL DEFAULT '[]',
  after_json TEXT NOT NULL DEFAULT '[]',
  changed INTEGER NOT NULL DEFAULT 0,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (patch_id) REFERENCES recall_relevance_patches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recall_patch_runs_patch
  ON recall_patch_runs(patch_id, created_at DESC);

CREATE TABLE IF NOT EXISTS recall_training_cases (
  id TEXT PRIMARY KEY,
  patch_id TEXT NOT NULL,
  suite TEXT NOT NULL DEFAULT 'memory-relevance-trainer',
  scene_input_json TEXT NOT NULL DEFAULT '{}',
  rejected_target_refs_json TEXT NOT NULL DEFAULT '[]',
  expected_behavior TEXT NOT NULL,
  human_label_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (patch_id) REFERENCES recall_relevance_patches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recall_training_cases_patch
  ON recall_training_cases(patch_id, created_at DESC);
