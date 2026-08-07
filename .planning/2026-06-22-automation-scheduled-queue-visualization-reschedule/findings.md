# Findings

## Initial Selection

- Selected feature: `队列可视化与改期建议`
- Capability: Scheduled Messages
- Canonical doc: `docs/features/scheduled_messages_manager.md`
- Index source: `docs/index.md`

## Reminder Result

- `osascript` could read Reminders list names.
- The available lists did not include `Personal AI`, so no item-level Reminder inspection or completion applies.

## Research Notes

- Slack Scheduled messages are managed from a dedicated Scheduled tab and expose edit/reschedule/send/cancel/delete actions, reinforcing that scheduled sends should remain visibly manageable before delivery.
- Power Automate run-history guidance emphasizes selecting concrete runs, understanding bulk limits, and refreshing history after resubmit/cancel; its troubleshooting page also pushes custom columns and concrete error/fix details for faster debugging.
- Trigger-action programming research repeatedly points to timing, control flow, and inaccurate user expectations as common bug sources; queue recovery UI should therefore explain why the recommendation exists and what the click will not execute.

## Code Notes

- `scheduleQueuePressure.ts` already computes `blockingCount`, `blockingTopics`, `suggestion.reason`, hidden slot count, 08:00-after queue semantics, and queue-preserving recovery.
- `ScheduledMessagesManager.tsx` renders the queue banner, per-slot risk/action/blocking/suggestion/sample lines, and persistent success/failure receipts.
- Gap: the per-slot card still scatters action basis across several lines; there is no single scan row that says slot type, blocker count, shown blocker samples, hidden blocker count, target, and non-effects before the buttons.
