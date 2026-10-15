CREATE TABLE IF NOT EXISTS attention_items (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL,
 title TEXT NOT NULL, normalized_title TEXT NOT NULL, due_at INTEGER NOT NULL,
 addressed_to TEXT NOT NULL, source_unit_id TEXT, source_message_id TEXT NOT NULL,
 sender_entity_id TEXT, weight REAL NOT NULL, reasons_json TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'candidate' CHECK(status IN ('candidate','proposed','armed','completed','dismissed','cancelled','expired','done')),
 fire_count INTEGER NOT NULL DEFAULT 0, last_fired_at INTEGER, cooldown_until INTEGER,
 expires_at INTEGER NOT NULL, accepted_action_id TEXT, completed_evidence_id TEXT,
 reminder_plan_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(user_id,kind,normalized_title,due_at)
);
CREATE INDEX IF NOT EXISTS idx_attention_due ON attention_items(user_id,status,due_at);
CREATE TABLE IF NOT EXISTS attention_sources (
 item_id TEXT NOT NULL REFERENCES attention_items(id), message_id TEXT NOT NULL,
 PRIMARY KEY(item_id,message_id)
);
CREATE TABLE IF NOT EXISTS attention_feedback (
 id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES attention_items(id),
 verdict TEXT NOT NULL, at INTEGER NOT NULL
);
-- Task Center terminal decisions take effect immediately, even before heartbeat.
CREATE TRIGGER IF NOT EXISTS attention_task_terminal
AFTER UPDATE OF queue_status ON proposed_actions
WHEN NEW.source_kind='attention' AND NEW.queue_status IN ('cancelled','succeeded')
BEGIN
 UPDATE attention_items SET status=CASE WHEN NEW.queue_status='cancelled' THEN 'cancelled' ELSE 'completed' END,
 updated_at=coalesce(NEW.finished_at,unixepoch())
 WHERE accepted_action_id=NEW.id AND status='armed';
END;
