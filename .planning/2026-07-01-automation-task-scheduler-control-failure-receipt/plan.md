# Task Scheduler control failure receipt

## Target

- Selected feature: `Task Scheduler 状态 API`
- Canonical doc: `docs/features/task_scheduler_api.md`
- Main surface: popup background-task panel

## Current evidence

- `TaskScheduler` already keeps schedule state, run history, refresh receipts, skipped runs, and queue-detail failures structured.
- The popup already shows pending receipts for refresh, enable/disable, manual run, and repair, and manual-run task failures become durable action receipts instead of a global error.
- Remaining UX gap: enable/disable or repair bridge failures still fall back to a global error after the task list refresh. The clicked row returns to the old snapshot, but there is no durable action receipt explaining that this specific click did not change the schedule, execute a task, or clear history.
- Local Reminders were readable, but there is no `Personal AI` list on this Mac, so no Reminder item is in scope.

## External reference signal

- Chrome Alarms requires extension code to treat alarm state as browser-managed and refreshable, so users should not infer an attempted control request changed the alarm until the background confirms it.
- Temporal, Airflow, Power Automate, and Zapier all keep current state, run/action history, and retry/resubmission context visible near failed automation controls.
- Automation-transparency research supports showing what the automation did, why, and what changed or did not change after a control action.

## Plan

1. Add a failed action receipt path for `toggle` and `repair` in the popup.
2. On enable/disable/repair failure, keep the refreshed or previous task snapshot and show a top action receipt with task name, error, and non-effect boundary.
3. Do not change `TaskScheduler` backend semantics, alarm creation, run history, or storage contracts.
4. Extend the existing Task Scheduler popup E2E with mocked toggle and repair failures.
5. Update the Task Scheduler feature doc with the new user-visible failure receipt.

## Verification

1. `npm run verify:task-scheduler-api`
2. `npm run verify:task-scheduler-status-filters`
3. `node --check tools/verify-task-scheduler-popup-filters-e2e.mjs`
4. `npm start -- --progress`, stop after first successful compile
5. `npm run verify:task-scheduler-popup-filters:e2e`
6. Scoped `git diff --check`
