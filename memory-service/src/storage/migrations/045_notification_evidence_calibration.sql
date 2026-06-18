-- 045_notification_evidence_calibration.sql (P1-8 + weave #5 P1)
-- Notification provenance + cost-asymmetry calibration audit.
-- evidence_refs_json / weave_json let the feed render a "依据：N 条记忆" line
-- (ProAct: notifications with cited evidence are more trusted and closable).
ALTER TABLE notification_records ADD COLUMN evidence_refs_json TEXT;
ALTER TABLE notification_records ADD COLUMN weave_json TEXT;

-- Monthly calibration audit: every COST_MATRIX adjustment is recorded so it is
-- explainable and reversible (no silent drift on the most sensitive surface).
CREATE TABLE IF NOT EXISTS notification_policy_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_type TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value REAL NOT NULL,
  new_value REAL NOT NULL,
  reason TEXT,
  window_days INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_audit_type ON notification_policy_audit(notification_type, created_at);
