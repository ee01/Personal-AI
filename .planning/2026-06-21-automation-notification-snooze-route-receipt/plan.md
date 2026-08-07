# Plan: Notification snooze route receipt

## Target

- Random feature: `通知提醒与免打扰路径`
- Source doc: `docs/memory_system.md`
- Main code paths:
  - `memory-service/src/routes/notifications.ts`
  - `memory-service/src/repositories/NotificationRepository.ts`
  - `src/backendNotifications.ts`
  - `src/background.ts`

## Context

- Reminders check: local Reminders is reachable, but there is no `Personal AI` list, so no Reminder item is in scope.
- Industry scan: Slack and Teams keep pause / quiet time separate from the activity feed; notification snooze research treats user-defined deferral as an interruption-control action that should preserve origin and return timing; proactive-agent research warns that proactive systems become intrusive when users cannot tell why and when they are being interrupted again.
- Current Personal AI docs already describe snooze records, scheduled notifications, and Chrome secondary actions, but the user-facing Chrome context only says `稍后提醒` / `第 N 次稍后提醒`. The API response also gives raw ids and times without a reusable action receipt.

## Implementation Steps

1. Improve returned snooze context labels so resurfaced Chrome notifications show the snooze count, last delay, and scheduled return time.
2. Add a structured `actionReceipt` to notification snooze action responses, stating that the action only creates a future notification, marks the current one as snoozed, and does not acknowledge, send, sync, or execute external actions.
3. Update the feature doc at a high level and extend existing notification-center / backend-notification tests.
4. Validate with targeted tests, `npm start` first successful compile, and scoped whitespace checks.
