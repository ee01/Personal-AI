# Findings

## Selection

Selected `Notification Center feed` from `docs/features/index.md` random sample because fresher exact targets in the sample were skipped.

## Reminder State

AppleScript listed local Reminder lists without `Personal AI`. EventKit found `Personal AI` and 4 completed items:

- Doubao recent-focus sync issue, completed with notes.
- `测试`, completed.
- Doubao local app log / sync issue, completed with notes.
- Weekly Dream Digest details sync issue, completed with notes.

No open or Notification Center feed-related Reminder item was incorporated.

## External Scan

- Slack Activity presents recent messages/notifications as a feed with dense/detail scan modes, type filters, saved views, and mark-read/clear actions. This supports making a feed response explain the current visible slice instead of implying all work is done.
- Microsoft Teams Activity feed similarly frames notifications as a timeline with quick views/filtering, so API consumers need current view/scope metadata.
- Apple Scheduled Summary groups notifications at chosen times and separately prioritizes important items, supporting explicit delivery mode and timing boundaries.
- Notification batching/interruption research supports lower-interruption summaries, but only when users retain awareness of what was delayed, shown, or still pending.

## Code/UX Notes

- `NotificationCenterService.listFeedResult()` already returns `meta.channel`, `lanes`, `deliveryMode`, `limit`, `returned`, `hasMore`, and empty-result receipts.
- Missing first-screen/API receipt: non-empty feed responses do not explicitly say this is a point-in-time read snapshot. `hasMore=false` or `total=0` can be misread as global future truth or processing confirmation.
- Bounded improvement: add a `meta.snapshotReceipt` for every feed response. It should name the read time, channel/mode/lane/limit/returned/hasMore and state that no confirmation, dismissal, resend, or channel write happened.
