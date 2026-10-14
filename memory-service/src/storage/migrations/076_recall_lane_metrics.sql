CREATE TABLE recall_lane_metrics (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 owner_user_id TEXT NOT NULL,
 tenant_id TEXT NOT NULL,
 surface TEXT NOT NULL CHECK(surface IN ('active','passive')),
 lane TEXT NOT NULL CHECK(lane IN ('fast','deep')),
 elapsed_ms INTEGER NOT NULL,
 candidate_count INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX idx_recall_lane_metrics_owner ON recall_lane_metrics(owner_user_id,created_at);

CREATE TABLE reconcile_nightly_runs (
 night TEXT PRIMARY KEY,
 started_at INTEGER NOT NULL,
 finished_at INTEGER,
 result_json TEXT
);
