# Task Scheduler refresh scope receipt plan

## Target

- Feature: `Task Scheduler 状态 API`
- Canonical doc: `docs/features/task_scheduler_api.md`
- Scope: popup/background status refresh only; do not change task execution, toggle, or manual repair semantics.

## Findings

- The current API and popup already separate toggle, manual run, repair, failed refresh, skipped run, and task-row status receipts.
- Status refresh can silently recreate missing Chrome alarms, update interval-mismatched alarms, or clear disabled/orphaned alarms before returning `nextRun`.
- From the user's perspective, a changed `nextRun` after expanding the popup can look like a real task execution unless the refresh scope is explicit.
- Local Reminders is readable, but this machine has no `Personal AI` list, so no Reminder item is linked to this run.

## External references

- Zapier Zap history separates workflow runs, statuses, troubleshooting, and replay from ordinary status viewing.
- Power Automate run history and resubmit docs treat re-run as an explicit action and warn about duplicate side effects.
- Google Apps Script time-driven triggers are future scheduled triggers, not immediate execution.
- TAP debugging research supports visible trigger/action/run state because users struggle to debug automation when trigger, action, and failure states are collapsed.

## Implementation steps

1. Add a structured `TaskSchedulerStatusRefreshReceipt` produced during `getTaskStatusFresh`.
2. Track how many alarms were created, updated, cleared, or failed during automatic status refresh repair.
3. Return that receipt from `GET_TASK_SCHEDULER_STATUS`.
4. Show a compact popup refresh receipt that says refresh only reads status and calibrates Chrome alarms; it does not execute tasks, enable/disable tasks, or clear run history.
5. Update the Task Scheduler doc and E2E assertions.

## Verification plan

1. `npm run verify:task-scheduler-api`
2. `npm run verify:task-scheduler-status-filters`
3. `npm start`, wait for the first successful compile, then stop it.
4. `npm run verify:task-scheduler-popup-filters:e2e`
5. Scoped `git diff --check`
