-- 064_agent_task_notify_config.sql
-- AgentTask result-notification config, registered directly by the extension on
-- save instead of round-tripping through the Sheet -> deployed Apps Script ->
-- request-body path. That path only carries fields the *deployed* GAS version
-- knows how to read, so it silently drops config added after the last upgrade
-- (e.g. successReceipt/notifyVia shipped in template v2.11 but a Sheet still
-- bound to v2.9.1 never sends them). A request body field always wins when
-- present. this table is the fallback for whatever the caller omitted.
-- success_receipt is 'Y' or 'N'. NULL means no explicit preference is stored,
-- so the caller's own default (currently true) applies instead of this row
-- forcing one.
CREATE TABLE IF NOT EXISTS agent_task_notify_configs (
  sheet_message_id TEXT PRIMARY KEY,
  notify_target_json TEXT,
  success_receipt TEXT,
  notify_via TEXT,
  notify_template TEXT,
  updated_at INTEGER NOT NULL
);
