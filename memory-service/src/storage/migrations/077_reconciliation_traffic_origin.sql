ALTER TABLE recall_lane_metrics ADD COLUMN traffic_class TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE reconcile_nightly_runs ADD COLUMN trigger_kind TEXT NOT NULL DEFAULT 'unknown';
