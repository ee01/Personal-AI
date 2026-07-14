# Notification Snooze Evidence Receipt

## Target

- Selected feature: `通知提醒与免打扰路径` in `docs/features/memory_system.md`.
- Reminder state: EventKit found the local `Personal AI` list with 4 total items and 0 incomplete items. All items were completed historical Doubao / notification feedback, so nothing is related to this run and nothing should be marked done.

## Research Notes

- Android notification guidance emphasizes brief, timely, relevant notifications, direct actions, and notification controls: https://developer.android.com/design/ui/mobile/guides/home-screen/notifications
- Apple notification summaries and priority notifications reinforce lower-interruption catch-up while keeping important items visible: https://support.apple.com/guide/iphone/summarize-notifications-reduce-interruptions-iph1fbe7d2b9/ios
- Slack Activity combines DMs, channel notifications, reminders, filtering, and clearing in one activity queue: https://slack.com/help/articles/46751260742035-Introducing-the-new-Activity-view-in-Slack
- Intelligent Notification Systems survey frames interruption management around timing, interpretation, and integration back into the user's primary task: https://arxiv.org/pdf/1711.10171

## Gap

`NotificationRepository.snooze()` creates a future `notification_records` row with the original title/body/payload and `payload.snooze`, but it does not copy `evidence_refs_json` or `weave_json`. That means the due reminder can still say "第 N 次稍后提醒" but loses the evidence receipt explaining why the notification existed.

## Plan

1. Preserve `evidence_refs_json` and `weave_json` when creating the future snoozed notification.
2. Extend the Notification Center API test to assert the copied fields and the due feed/digest evidence receipt.
3. Extend the Chrome notification E2E fixture to assert a snoozed due item displays both snooze and evidence context.
4. Update `docs/features/memory_system.md`, `docs/features/notification_center.md`, and the feature index.
5. Verify with targeted notification tests, first successful `npm start` compile, notification E2E, and scoped `git diff --check`.
