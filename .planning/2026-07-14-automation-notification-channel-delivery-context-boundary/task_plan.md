# Notification Channel Delivery Context Boundary

## Target

- Feature: `渠道投递回执`
- Docs: `docs/features/notification_center.md`
- Runtime surface: Chrome backend notification context labels built in `src/backendNotifications.ts`
- Verification: `src/__tests__/backendNotifications.test.ts`, `tools/verify-notification-channel-delivery-e2e.mjs`

## Reminder Check

- AppleScript listed local Reminders but did not expose `Personal AI`.
- EventKit fallback found `Personal AI` with 4 total items and 0 incomplete items.
- No Reminder feedback was related to Notification Center delivery receipts, channel failures, or Chrome/Doubao/Glip notification handling.

## External Scan

- Slack `chat.postMessage` returns channel/timestamp/message metadata and documents rate-limit/error behavior, which supports treating provider send attempts as channel-specific records rather than user completion.
- Microsoft Graph lifecycle notifications explicitly call out missed/removed/reauthorization states, supporting visible recovery signals for broken notification flows.
- Apple notification guidance frames notifications as glanceable, high-value information, so failure/retry context should stay concise in the first visible context label.
- Intelligent-notification research emphasizes interruptibility, timing, and user receptivity; delivery receipts should reduce duplicate interruptions and clarify whether a reminder is new, retried, or unresolved.

## Plan

1. [x] Add a current-channel context hint only when cross-channel receipts are visible, so `new` reads as `本渠道首次提醒` instead of globally new.
2. [x] Make delivered effective-state wording say it is not user completion.
3. [x] Extend unit tests and the Chrome notification E2E fixture to cover cross-channel receipt text in the actual system-notification context label.
4. [x] Update concise feature docs and the index row.
5. [x] Run targeted tests, `npm start` first compile, E2E, and scoped whitespace checks.

## Boundaries

- Presentation/accessibility-facing wording only.
- No change to `channel_delivery_records`, `NotificationCenterService.listFeed`, delivery filtering, cooldowns, Chrome notification actions, global acknowledge/dismiss behavior, or provider delivery writes.

## Status

- Complete on 2026-07-14.
- Validation evidence is recorded in `progress.md`.
