# Scheduled Messages Reschedule Lane Receipt Plan

## Target

- Random feature: `执行匹配与补偿窗口`
- Source doc: `docs/features/scheduled_messages_manager.md`
- Main surface: `scheduled-messages.html` health banner, queue banner, add/edit dialog, and reschedule receipts

## Current State

- The executor already distinguishes current-minute explicit slots, the 2-30 minute compensation window, and the no-time `08:00 后队列`.
- Health and queue suggestions already explain why a row should be rescheduled and whether the write is explicit time or empty `Schedule_Time`.
- UX gap: after seeing or applying a suggestion, the user still has to infer whether the new target will be claimed as an explicit-time lane or as the no-time executor queue. That can make a successful write look like a confirmed send or confirmed Jira run.

## External Signals

- Google Apps Script time-driven triggers can run on recurring minute-like schedules, so product UI should tolerate polling jitter and make recovery paths clear: https://developers.google.com/apps-script/guides/triggers/installable
- Slack scheduled messages keep scheduled items as manageable pending objects; update is delete-and-reschedule, reinforcing that schedule mutation is distinct from delivery: https://docs.slack.dev/messaging/sending-and-scheduling-messages
- Quartz documents misfires as an explicit scheduler concept with configurable instructions, supporting visible missed-fire and recovery semantics: https://www.quartz-scheduler.org/documentation/quartz-2.3.0/tutorials/tutorial-lesson-04.html
- Trigger-action debugging research finds that users need help locating why automations did or did not run, so recovery UI should keep the route and next execution semantics visible: https://dl.acm.org/doi/abs/10.1145/3569506

## Implementation Plan

1. Reuse existing `getScheduledMessageExecutionLaneReceipt()` against the suggested post-write message shape.
2. Show "写入后领取口径" in health-banner suggestions and queue-card suggestions before the user clicks.
3. Carry the same lane summary into successful reschedule receipts.
4. Show the same lane summary in the add/edit dialog draft receipt after "使用建议时间".
5. Update E2E assertions and the canonical feature doc.

## Validation Plan

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/scheduled-messages/__tests__/executionRoute.test.ts src/scheduled-messages/__tests__/scheduleHealth.test.ts src/scheduled-messages/__tests__/scheduleQueuePressure.test.ts`
- `node --check tools/verify-scheduled-messages-health-recovery-e2e.mjs`
- `node --check tools/verify-scheduled-messages-queue-suggestion-e2e.mjs`
- `npm start` until the first successful dev compile, then stop the watcher.
- `npm run verify:scheduled-messages-health-recovery:e2e`
- `npm run verify:scheduled-messages-queue-suggestion:e2e`
- Scoped `git diff --check`
