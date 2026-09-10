-- P3 (plan §7.8/§11.8): exposure and outcome stores for the v3 plane.
--
-- memory_exposures: raw per-request display records. Retention is 30 days
-- (plan §7.8: "Raw exposure 只保留 30 天并按 request id 采样"). Aggregate
-- daily rollup happens in the consolidation cron.
--
-- memory_outcomes: user/feedback outcomes that CAN affect lifecycle.
-- These are the only signals that pass the FSRS-lite gate (§8.4).

CREATE TABLE IF NOT EXISTS memory_exposures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  unit_id TEXT NOT NULL REFERENCES memory_units(id),
  surface TEXT NOT NULL,
  rank INTEGER NOT NULL,
  shown INTEGER NOT NULL DEFAULT 0,
  quieted INTEGER NOT NULL DEFAULT 0,
  no_result INTEGER NOT NULL DEFAULT 0,
  policy_version TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_exposures_request
  ON memory_exposures(request_id);
CREATE INDEX IF NOT EXISTS idx_memory_exposures_unit
  ON memory_exposures(unit_id, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id TEXT NOT NULL REFERENCES memory_units(id),
  outcome_type TEXT NOT NULL CHECK (outcome_type IN (
    'opened', 'dismissed', 'adopted', 'edited_after_adoption',
    'user_confirmed', 'user_corrected', 'user_rejected',
    'downstream_task_success', 'downstream_task_failure')),
  surface TEXT,
  task_context TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_outcomes_unit
  ON memory_outcomes(unit_id, created_at DESC);

-- Profile slots (P3 D2): low-authority proposals + user confirmation state.
CREATE TABLE IF NOT EXISTS profile_slots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  owner_user_id TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  slot_value TEXT NOT NULL,
  sensitivity TEXT NOT NULL DEFAULT 'normal' CHECK (sensitivity IN
    ('normal', 'durable', 'sensitive')),
  status TEXT NOT NULL DEFAULT 'provisional' CHECK (status IN
    ('provisional', 'active', 'pending_confirmation', 'rejected')),
  confidence REAL NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  source_unit_ids TEXT NOT NULL DEFAULT '[]',
  model TEXT,
  prompt_version TEXT,
  expiry_at INTEGER,
  current_revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (tenant_id, owner_user_id, slot_key, current_revision)
);

CREATE INDEX IF NOT EXISTS idx_profile_slots_owner
  ON profile_slots(tenant_id, owner_user_id, status, updated_at DESC);

-- Unit lifecycle (P3 A): accessibility tier + explicit reinforcement.
CREATE TABLE IF NOT EXISTS unit_lifecycle (
  unit_id TEXT PRIMARY KEY REFERENCES memory_units(id),
  accessibility_tier TEXT NOT NULL DEFAULT 'normal' CHECK (accessibility_tier IN
    ('always_available', 'normal', 'weak', 'archived')),
  stability REAL NOT NULL DEFAULT 1.0,
  last_accessed_at INTEGER,
  access_count INTEGER NOT NULL DEFAULT 0,
  explicit_reinforce_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
