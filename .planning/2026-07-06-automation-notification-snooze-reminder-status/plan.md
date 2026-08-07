# Notification Snooze Reminder Status Plan

## Target

- Selected feature: `通知提醒与免打扰路径` in `docs/memory_system.md`.
- Scope: make due snoozed notifications visibly read as old unresolved reminders, not fresh notifications or completed work.

## Context

- `Personal AI` Reminders: EventKit found 4 total items and 0 incomplete items. Existing items are completed historical Doubao / Notification feedback, with no open item to incorporate or mark done for this target.
- External scan: Slack DND / notification schedules, Microsoft Teams quiet time / Viva quiet time, and notification-deferral research all point to the same UX rule: deferred notifications must preserve their origin and unresolved status when they come back.

## Improvement Plan

1. Update the Chrome backend notification context helper so any `snoozeReceipt` or legacy `payload.snooze` reminder explicitly includes `仍未处理`.
2. Keep retry / failed-delivery semantics intact; avoid duplicate unresolved wording for the already-delivered-unfinished path.
3. Extend focused unit coverage for `buildBackendNotificationContextMessage`.
4. Extend the notification channel E2E fixture so a due snoozed feed item reaches `chrome.notifications.create` with the unresolved reminder context.
5. Update `docs/memory_system.md` and `docs/index.md` concisely.

## Validation

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/__tests__/backendNotifications.test.ts`
- `node --check tools/verify-notification-channel-delivery-e2e.mjs`
- `npm start -- --progress` until first successful dev compile, then stop.
- `node tools/verify-notification-channel-delivery-e2e.mjs`
- Scoped `git diff --check`.
