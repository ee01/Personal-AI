# Scheduled Messages Execution Lane Receipt Plan

## Target

- Random feature: `执行匹配与补偿窗口`
- Capability: Scheduled Messages
- Source doc: `docs/features/scheduled_messages_manager.md`

## Context

- Reminder check: local Reminders is reachable, but no `Personal AI` list exists, so there are no related Reminder items to inspect, complete, or annotate.
- Current code already implements and documents the three-stage executor order: current minute, past 30-minute compensation, and no-time `08:00` queue.
- UX gap: the list and create/edit dialogs show execution engine, but users still need a row-level explanation of which lane a message will use and what proves execution.

## External Scan

- Google Apps Script installable triggers: time-driven triggers can run automatically but are not a precise visible delivery proof by themselves. Product UI should expose compensation and follow-up state. https://developers.google.com/apps-script/guides/triggers/installable
- Slack scheduled messages: scheduled/draft/sent messages are managed in one visible place, supporting editable scheduled state before send. https://slack.com/help/articles/201457107-Send-and-read-messages
- Twilio Message Scheduling: scheduled messages have explicit status transitions and cancel/update APIs, reinforcing the need to separate scheduled, queued, sent, failed, and canceled state. https://www.twilio.com/docs/messaging/features/message-scheduling
- Quartz misfire docs: mature schedulers model missed fire behavior explicitly, so Personal AI should name its compensation window rather than hiding it behind generic "scheduled" text. https://www.quartz-scheduler.org/documentation/quartz-2.3.0/tutorials/tutorial-lesson-04.html
- Trigger-action programming research: timing and inaccurate expectation bugs are common for user-facing automation, so the UI should make execution lane and recovery semantics visible near the schedule. https://dl.acm.org/doi/fullHtml/10.1145/3290605.3300782

## Plan

1. Add a shared execution-lane receipt helper in `src/scheduled-messages/executionRoute.ts`.
2. Render the receipt under the frequency/engine line in the table and inside create/edit schedule sections.
3. Keep the algorithm unchanged unless tests expose a concrete defect.
4. Extend `src/scheduled-messages/__tests__/executionRoute.test.ts` and `tools/verify-scheduled-messages-execution-route-e2e.mjs`.
5. Update `docs/features/scheduled_messages_manager.md` with the new UX contract.
6. Run targeted Scheduled Messages verification, dev compile, E2E, and scoped whitespace checks.
