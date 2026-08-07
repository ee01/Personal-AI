# Task Scheduler Status API Findings

## Initial Context

- `docs/progressing/to-verify.md` says there is no carry-over verification work.
- Automation memory shows many fresh 2026-06-29 exact-surface receipt improvements; this run avoids those targets.
- Random target chosen from `docs/index.md`: `Task Scheduler 状态 API`.
- Local Reminders result: no `Personal AI` list is visible, so this run has no Reminder-derived requirement.

## Code And UX Findings

- `docs/features/task_scheduler_api.md` is current for the major Task Scheduler behavior: status receipts, refresh receipts, action receipts, stale snapshot handling, repair confirmation, skip semantics, run history, and digest queue visibility are already documented.
- Current source of truth is `src/services/TaskScheduler.ts`, `src/services/taskSchedulerDefinitions.ts`, `src/services/taskSchedulerStatusFilters.ts`, and the popup renderer in `src/popup.tsx`.
- Existing verification anchors are `npm run verify:task-scheduler-api`, `npm run verify:task-scheduler-status-filters`, and `npm run verify:task-scheduler-popup-filters:e2e`.
- UX gap: `TaskScheduler.enrichDigestQueueStatus()` catches `digestQueueService.getQueueStatusSummary()` failures with `console.warn` only. The API can still return a successful task-status refresh while the digest queue row silently lacks queue detail, so the user sees confirmed scheduler state but not the unconfirmed queue sub-state.
- Low-decision implementation slice: add a structured digest-queue-status-unavailable receipt to the Task Scheduler status payload and popup. The top refresh receipt should say queue details were not confirmed, while the row should explain the failed sub-read and preserve the no-send/no-write/no-confirm boundary.

## External Reference Findings

- Chrome Alarms API docs confirm alarm persistence has explicit browser/session semantics, which supports keeping alarm calibration separate from task execution.
- Temporal docs model workflow progress through event history, reinforcing that scheduler UI should preserve status/history and not collapse partial state into generic success.
- Airflow Grid View is positioned as the primary task-state debugging surface, supporting inline failed/retried/running context rather than hiding it in logs.
- Zapier Zap History shows run logs for troubleshooting and distinguishes unsuccessful run statuses, supporting visible partial/unconfirmed status rather than treating a refresh as fully trustworthy.
- Automation transparency research argues that automation responsibilities, activities, and effects should be observable in the interface; this supports a compact receipt for “scheduler status confirmed, queue detail not confirmed”.
