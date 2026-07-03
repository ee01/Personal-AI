# Task Scheduler refresh failure receipt

## User lens

I am checking background tasks from the popup after a failed refresh. I care whether the list is current or only the last known snapshot, because clicking run, pause, or repair based on stale alarm state can be misleading.

## Plan

1. Keep the existing successful refresh receipt for normal status loads.
2. When `GET_TASK_SCHEDULER_STATUS` fails, clear the previous successful refresh receipt.
3. Show a `刷新未确认` receipt that names the failed read, the snapshot boundary, and the non-effects: no task ran, no schedule changed, no repair happened, and history was not cleared.
4. Extend the popup E2E to assert the failure receipt appears and the stale success receipt is gone.
5. Update `docs/features/task_scheduler_api.md` and run the Task Scheduler verification ladder.

## Verification target

- `npm run verify:task-scheduler-api`
- `npm run verify:task-scheduler-status-filters`
- `npm start` first successful compile, then stop watch mode
- `npm run verify:task-scheduler-popup-filters:e2e`
- Scoped `git diff --check`
