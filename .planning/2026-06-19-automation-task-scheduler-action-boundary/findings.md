# Findings

## Repo State

- `docs/progressing/to-verify.md` says there are no pending verification items.
- Automation memory shows recent runs covered Agent Workflow, Native Join, Memory Capture, Decision Center, Jira Automation Import, Memory Coverage, Jira Design Links, Relationship Radar, Memory Lens, Skill Foundry, Quick Ask, Project Dashboard, Rehearsal, Scheduled Messages, Meeting Pilot, Compose Assist, Google Slides Analyzer, and Notification Center. Task Scheduler is a reasonable random target.
- Reminders list names were readable, but `Personal AI` was absent, so no Reminder item can be completed.
- Existing Task Scheduler docs and code already describe refresh receipts, status receipts, action receipts, failure/run history, refresh failure old snapshot boundary, and task sorting.

## External References

- Chrome Alarms docs: alarms can use `persistAcrossSessions`, but earlier Chrome/other browser behavior can be unpredictable; important alarms should be checked when the service worker starts. This supports the current refresh/calibration model and makes explicit alarm-only repair boundaries important.
- Datadog Monitor Status Page: alert status surfaces should preserve context, show why the alert is happening, and give quick actions toward resolution. This supports putting next action and action scope in the same task row.
- Microsoft Power Automate run resubmission: resubmit/cancel actions have limits and delayed state transitions; bulk cancel can suspend queued runs and may take time. This supports clear pre-click copy about what an action will and will not change.
- Zapier Zap history: run history shows statuses and notes that deleting records may not undo completed actions, while in-progress deletion prevents completion. This supports visible distinctions between task action and history deletion.
- Automation transparency research: transparency can improve appropriate reliance, understanding, and satisfaction, but too much or misplaced information can increase bias or cognitive load. The improvement should be compact and action-bound, not a long explanation block.

## UX Gap

The popup has good post-action receipts, but the row-level controls rely on tooltip/title copy before the click. As a user, I can see `暂停`, `重排`, or `立即执行`, but I should not have to hover to learn whether the click will clear history, repair the alarm, enable the schedule, or run a task once.

## Chosen Improvement

Add one compact visible action-scope line per task row:

- Warning schedule: repair only recreates Chrome alarm; run once does not repair schedule or clear history.
- Repeated failure: pause only stops automatic schedule and keeps history; run once only retries once.
- Disabled: manual run only runs once and keeps the task disabled.
- Recent skip: retry waits for condition/current run and does not overwrite the last successful result.
- Normal enabled: toggle changes schedule and run is one-time; neither clears history.
