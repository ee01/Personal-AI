-- 067_agent_task_notify_when_empty.sql
-- Whether a run that matched nothing should still push its result notice.
-- A write task that changed 0 rows is usually noise in the target chat, while a
-- read/scan task returning 0 hits is still information. NULL means no explicit
-- preference is stored, so the delivery layer derives the default from the task
-- mode (write -> stay quiet, read -> still push).
ALTER TABLE agent_task_notify_configs ADD COLUMN notify_when_empty TEXT;
