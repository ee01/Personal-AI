-- 065_task_center.sql
-- Task Center: one ledger for scheduled pushes, agent tasks, reminders, dev
-- delegations and reflection candidates. Everything lands in proposed_actions
-- so all five sources share the existing queue states, idempotency keys,
-- attempt log, readiness gate and confirm-request handoff.
--
-- Only the columns below are new. depends_on_json already exists (migration
-- 005) but has never had a consumer; Task Center is what finally reads it.

-- Subtask tree. A parent completes when every child has succeeded; children
-- are ordinary rows, so they keep their own retries, gates and artifacts.
ALTER TABLE proposed_actions ADD COLUMN parent_action_id TEXT;

-- Recurrence. scheduled_at stays a one-shot timestamp; when a run finishes and
-- this column is set, the next occurrence is cloned with a fresh scheduled_at
-- and a time-sliced idempotency key. Format is the same scheduleSpec shape
-- OutreachEngine already interprets (repeatEvery/repeatUnit/repeatDays/endDate/
-- timezone), plus an optional timeline milestone trigger.
ALTER TABLE proposed_actions ADD COLUMN recurrence_spec TEXT;

-- Which scheduler owns the trigger. 'memory_cron' = this service's due-scan.
-- 'jira_sheet' = a mirrored Sheet row picked up by Jira Automation; the row is
-- still tracked here so both lanes share one ledger, but the due-scan skips it.
-- NULL is treated as memory_cron for rows predating Task Center.
ALTER TABLE proposed_actions ADD COLUMN lane TEXT;

-- Which editor/semantics this row uses: push | agent | remind | dev | reflection.
ALTER TABLE proposed_actions ADD COLUMN task_kind TEXT;

-- For lane='jira_sheet': the mirrored Sheet row id (msg_*) and sync state, so a
-- lane switch knows which row to add or drop. The extension owns the actual
-- Sheet write (the Google token lives there, not in this service).
ALTER TABLE proposed_actions ADD COLUMN mirror_ref_json TEXT;

-- Parent aggregation and child listing.
CREATE INDEX IF NOT EXISTS idx_proposed_actions_parent
  ON proposed_actions(parent_action_id, queue_status);

-- Due-scan filters on lane, and the Task Center list groups by kind.
CREATE INDEX IF NOT EXISTS idx_proposed_actions_lane_kind
  ON proposed_actions(lane, task_kind, queue_status);

-- Recurrence rollover looks for finished rows that still owe a next occurrence.
CREATE INDEX IF NOT EXISTS idx_proposed_actions_recurrence
  ON proposed_actions(queue_status, recurrence_spec)
  WHERE recurrence_spec IS NOT NULL;
