-- 067_agent_task_notify_when_empty.sql
-- Whether a run that matched nothing should still push its result notice.
-- NULL means no explicit preference is stored; the delivery layer then stays
-- quiet for both read and write. Set Y to still push empty results.
ALTER TABLE agent_task_notify_configs ADD COLUMN notify_when_empty TEXT;
