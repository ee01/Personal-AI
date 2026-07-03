# Notification Center Feed Retry Receipt Findings

## Repository Findings

- `NotificationCenterService.listFeed()` builds per-item `deliveryContext.reason` values used by Chrome notifications and Provider digest.
- Current `buildDeliveryContext()` checks todo cooldown before checking a latest failed status when the record already has a successful delivery. A todo that was delivered long ago and then failed recently can therefore show `retry_after_cooldown` / `再次提醒` instead of `previous_delivery_failed` / `上次发送失败`.
- `deliveryContextSortWeight()` already prioritizes `previous_delivery_failed` ahead of `new`, `retry_after_cooldown`, and `already_delivered_unfinished`; fixing the reason unlocks the existing triage order.
- `src/backendNotifications.ts` already has visible Chrome context labels for `previous_delivery_failed`, so the smallest user-visible fix is service-side reason precedence plus tests.

## External Reference Findings

- Slack Activity and Microsoft Teams Activity Feed both frame notifications as triage queues with filters and action context, not just one-off alerts.
- Apple notification summaries / Reduce Interruptions emphasize reducing interruption while preserving scan-friendly priority.
- Notification batching and interruption research supports batching/deferral, but only when users can still understand why an item appears now and whether something failed.

## Decision

Implement the service-level reason precedence fix. Do not add a new UI panel or backend contract because the feed item already carries the receipt shape and Chrome/Doubao surfaces already display the reason.
