-- 047_skill_quality_gate.sql (P2-11: skill & experience quality gate)
-- Execution ledger + derived health/lifecycle for procedural memory. Bad
-- experiences compound as fast as good ones (Experience-Following), so skills
-- must earn promotion and auto-degrade on repeated failure. This is a separate
-- layer over skills.status -- it never mutates the existing enum.

CREATE TABLE IF NOT EXISTS skill_executions (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  version TEXT,
  platform TEXT,                  -- codex / claude-code / cursor / internal
  outcome TEXT NOT NULL,          -- success | failure | partial | unknown
  signal_source TEXT NOT NULL,    -- binding_sync | user_feedback | action_result | outcome_event
  detail_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_skill_exec_skill ON skill_executions(skill_id, created_at);

-- Derived health + lifecycle state per skill.
-- gate_state: candidate | active | degraded | retired | user_pinned
CREATE TABLE IF NOT EXISTS skill_health (
  skill_id TEXT PRIMARY KEY,
  gate_state TEXT NOT NULL DEFAULT 'candidate',
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  health REAL NOT NULL DEFAULT 0,
  pinned INTEGER NOT NULL DEFAULT 0,
  degraded_at INTEGER,
  last_outcome_at INTEGER,
  updated_at INTEGER NOT NULL
);
