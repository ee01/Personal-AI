# Scheduled Messages queue health failure receipt plan

- Selected feature: `队列健康提示` under `docs/features/scheduled_messages_manager.md`.
- Carry-over: `docs/progressing/to-verify.md` is empty.
- Reminder branch: no local `Personal AI` Reminders list exists, so no reminder item is incorporated or marked done.
- External grounding: Slack keeps scheduled messages manageable; Zapier and Power Automate expose run/replay status; trigger-action debugging research emphasizes visible recovery context.

## Plan

1. Inspect current queue health and reschedule behavior; confirm docs match implementation.
2. Replace transient alert-only one-click reschedule failure states with persistent in-page receipts for missing target, missing suggestion, and Sheet update failure.
3. Update the Scheduled Messages feature doc with the failure-receipt boundary.
4. Extend targeted E2E to prove the failure receipt and absence of blocking dialog regressions.
5. Run focused tests, first successful dev compile, E2E verification, and diff checks.
