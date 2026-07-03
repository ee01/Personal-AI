# DigestQueueService due-release receipt plan

## Target

- Random feature: `DigestQueueService 本地摘要` under Notification Center.
- Source doc: `docs/features/notification_center.md`.
- Main code: `src/services/DigestQueueService.ts`, `src/services/TaskScheduler.ts`, `src/popup.tsx`.
- Reminder state: local Reminders are readable, but there is no `Personal AI` list, so no Reminder item is incorporated or completed.

## External scan

- Apple Scheduled Summary makes notification batching explicitly time-based and user-configured.
- Slack Activity and Microsoft Teams Activity feed keep notification-like work in a readable, filterable feed instead of hiding state behind one-shot alerts.
- Notification interruption research supports batching to reduce disruption, but only when the delayed state is predictable and recoverable.

## Gap

The popup already shows local pending count, due count, source breakdown, and local/no-write boundary. However, when items are already in the release window, the summary still reads mostly like passive queue status. As a user, `1 条已到释放窗口` needs a clearer next-step receipt: these items are ready for the next `digest_queue_process` run, not already sent, not sent by status refresh, and not written to Memory Service.

## Implementation steps

1. Extend the digest queue summary text so any due local digest items append an explicit `释放窗口回执`.
2. Mirror the same user-facing cue in popup structured UI so the visible row and tooltip carry the same state.
3. Add verifier assertions for the due+future queue case and, if needed, status-summary process results.
4. Update the Notification Center feature doc with the new due-state boundary.
5. Verify with the focused digest queue script, `npm start` first compile, and a relevant popup/task scheduler E2E or syntax check.
