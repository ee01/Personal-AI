CREATE TABLE unit_reconcile_decisions (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 owner_user_id TEXT NOT NULL,
 phase TEXT NOT NULL CHECK(phase IN ('B','C')),
 unit_id TEXT NOT NULL REFERENCES memory_units(id),
 candidate_unit_id TEXT NOT NULL REFERENCES memory_units(id),
 evidence_digest TEXT NOT NULL,
 evidence_keys_json TEXT NOT NULL,
 decision TEXT CHECK(decision IN ('corroborate','refine','supersede','dispute','noop')),
 reason TEXT,
 model_version TEXT,
 state TEXT NOT NULL DEFAULT 'deferred' CHECK(state IN ('deferred','judging','shadow','applied','stale','failed','reverted')),
 leased_until INTEGER,
 lease_token TEXT,
 expected_revisions_json TEXT NOT NULL,
 before_snapshots_json TEXT,
 before_sources_json TEXT,
 after_revisions_json TEXT,
 decided_at INTEGER,
 cooldown_until INTEGER,
 created_at INTEGER NOT NULL,
 UNIQUE(phase,unit_id,candidate_unit_id,evidence_digest)
);
CREATE INDEX idx_reconcile_pending ON unit_reconcile_decisions(owner_user_id,state,created_at);
CREATE TABLE reconcile_nightly_budgets (
 tenant_id TEXT NOT NULL,
 owner_user_id TEXT NOT NULL,
 night TEXT NOT NULL,
 phase TEXT NOT NULL,
 calls INTEGER NOT NULL DEFAULT 0,
 reserved_tokens INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(tenant_id,owner_user_id,night,phase)
);
CREATE TABLE reconcile_shadow_reviews (
 decision_id TEXT PRIMARY KEY REFERENCES unit_reconcile_decisions(id),
 expected_decision TEXT NOT NULL CHECK(expected_decision IN ('corroborate','refine','supersede','dispute','noop')),
 reviewed_by TEXT NOT NULL,
 reviewed_at INTEGER NOT NULL
);
CREATE TABLE reconcile_artifacts (
 artifact_key TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 owner_user_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('one_pager','insight','attention')),
 content TEXT NOT NULL,
 source_unit_ids_json TEXT NOT NULL,
 scope_locator TEXT,
 sensitivity TEXT NOT NULL,
 egress_policy TEXT NOT NULL DEFAULT 'local_only',
 expiry_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE TABLE reconcile_entity_aliases (
 alias_entity_id TEXT PRIMARY KEY REFERENCES entities(id),
 canonical_entity_id TEXT NOT NULL REFERENCES entities(id)
);
CREATE TABLE reconcile_subject_aliases (
 alias_key TEXT PRIMARY KEY,
 canonical_entity_id TEXT NOT NULL REFERENCES entities(id)
);
CREATE TABLE reconcile_scan_state (phase TEXT PRIMARY KEY, last_created_at INTEGER NOT NULL);
CREATE TABLE reconcile_online_sampling (id INTEGER PRIMARY KEY CHECK(id=1), interactions INTEGER NOT NULL);
CREATE TABLE reconcile_confirm_links (
 confirm_id TEXT PRIMARY KEY REFERENCES confirm_requests(id),
 decision_id TEXT NOT NULL UNIQUE REFERENCES unit_reconcile_decisions(id),
 expected_revisions_json TEXT NOT NULL
);
