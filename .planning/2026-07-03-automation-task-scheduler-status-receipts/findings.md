# Findings

## Repo Context

- `docs/progressing/to-verify.md` currently says `暂无。`; no carry-over item was selected.
- Automation memory shows recent sweeps covered Task Scheduler refresh-in-flight, queue-detail partial-read receipts, repair pending, and control-failure receipts. This run should avoid repeating those exact fixes.
- AppleScript did not list `Personal AI`, but EventKit did. The `Personal AI` list has 4 items and all are already completed historical Doubao / Weekly Dream Digest / sync feedback, so no open Task Scheduler-related Reminder item is available.

## Selected Feature

- Random sample selected `Task Scheduler 状态 API` from `docs/features/index.md`.
- The feature doc already describes status refresh receipts, control receipts, schedule health, run history, skipped results, failed refresh, and UI sorting.

## External Research

- Chrome Alarms official docs say alarm persistence differs by browser/version and recommend checking that important alarms exist when the service worker starts. This supports making refresh-time alarm reconciliation visible rather than trusting counts alone.
- Chrome MV3 service-worker migration docs say service workers terminate when unused, so state must be persisted instead of held in globals; Task Scheduler already follows that by using storage plus alarm reconciliation.
- Temporal Event History docs frame status as an append-only audit trail of scheduled/started/completed/failed/timed-out events. The useful product lesson is to expose what changed and why, not just the terminal task state.
- GitHub Actions workflow-run API separates queued/in-progress/completed/skipped/failure style states. Task Scheduler should keep execution state, schedule health, skips, failures, and refresh calibration distinct.
- Progress-indicator research warns that misleading progress feedback can hurt user experience. For this feature, a refresh receipt should state only confirmed calibration and preserve that refresh did not run tasks or clear history.

## Code Findings

- `TaskSchedulerStatusRefreshReceipt` already counted created/updated/cleared/failed alarm repairs, but did not identify the task rows behind those counts.
- `src/popup.tsx` rendered the counts and boundaries clearly; adding compact task-level calibration names is presentation and API-contract work, not a scheduler behavior change.
- Existing E2E covers pending refresh, failed refresh, pending run, pending repair, control failures, queue-status partial reads, and English copy, so the new test should only pin the non-duplicative calibration detail line.
