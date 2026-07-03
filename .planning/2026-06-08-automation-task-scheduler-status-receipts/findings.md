# Findings

## Initial Inputs

- `docs/progressing/to-verify.md` says `暂无。`
- Automation memory shows the latest targets through Notification Center channel receipts; selected Task Scheduler to avoid recent exact-feature repetition.
- Local Reminders lists exist, but no `Personal AI` list exists, so no Reminder item can be incorporated or marked done.

## External References

- Chrome alarms docs: alarms can be delayed, browser restart may clear alarms, and extensions should check alarm state on service worker startup. This supports showing alarm reality separately from stored enabled state.
- Airflow task docs: mature schedulers expose lifecycle states such as scheduled, queued, running, success, failed, skipped, retry. This supports preserving skipped as a first-class status rather than folding it into failure.
- Power Automate run-history docs: recovery actions such as resubmit/cancel are bounded by run status, ownership, connector/API limits, and queue state. This supports explicit next-action copy before retry/repair.
- Trigger-action programming research reports user mental-model errors around state/event and action behavior. This supports explaining "why not run" / "what next" inline.

## Code Findings

- `TaskScheduler.buildTaskStatus()` already derives schedule health and warnings from alarm reality, repair errors, period mismatch, overdue, and disabled state.
- Popup currently duplicates reasoning through `formatTaskResult`, `formatTaskActionHint`, `formatTaskSchedulerNextStep`, and attention summary helpers.
- Verification scripts already cover status filters and popup E2E, making a receipt addition testable without a broad new harness.
