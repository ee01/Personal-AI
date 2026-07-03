# Task Scheduler pending action receipts

## Target

- Feature index pick: `Task Scheduler 状态 API`
- Source doc: `docs/features/task_scheduler_api.md`
- Reminder check: local Reminders was readable, but no `Personal AI` list existed, so no Reminder item was included or completed.

## Research signals

- Airflow and Prefect model task status as explicit lifecycle states with history, not as a single boolean switch.
- Automation transparency research supports showing what an automated system is doing, what it has confirmed, and what control remains with the user.
- For this popup, the useful UX standard is: old confirmed status stays visible while a control action is pending; success copy appears only after the background response and refreshed status confirm the change.

## Plan

1. Inspect Task Scheduler docs, popup presentation, scheduler status contracts, and existing E2E.
2. Keep backend `TaskScheduler` contracts unchanged; fix the presentation-layer gap for pending control actions.
3. Extend row-level pending receipts from `repair` only to `toggle-enable`, `toggle-disable`, and `run`.
4. Stop optimistic row patching for enable/disable and manual run; keep previous schedule/run snapshots until confirmation.
5. Add E2E assertions for slow pause and slow manual run: pending receipt visible, old row state still visible, success receipt absent before release, success shown after confirmed refresh.
6. Update canonical docs and run the focused verification ladder.

## Implementation notes

- `src/popup.tsx` now uses a shared pending action receipt builder for enable, pause, run, and repair.
- Starting a new control action clears the previous action receipt, preventing a stale success receipt from sitting next to a new pending state.
- The task row no longer changes `enabled`, `scheduleHealth`, `nextRun`, `isExecuting`, or run history until `CONTROL_TASK` returns and `GET_TASK_SCHEDULER_STATUS` refreshes.

## Validation checklist

- `node --check tools/verify-task-scheduler-popup-filters-e2e.mjs`
- `npm run verify:task-scheduler-status-filters`
- `npm run verify:task-scheduler-api`
- `npm start` until first successful compile, then stop
- `npm run verify:task-scheduler-popup-filters:e2e`
- scoped `git diff --check`
