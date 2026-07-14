# Notification Center feed limit receipt plan

## Target

- Randomly selected feature: `Notification Center feed`
- Source doc: `docs/features/notification_center.md`
- Main implementation: `memory-service/src/core/NotificationCenterService.ts`

## Current findings

- `docs/progressing/to-verify.md` has no carry-over item.
- AppleScript did not list `Personal AI`, but EventKit found it. It has 4 total items and 0 incomplete items.
- One completed Reminder is related to Notification Center / Doubao digest detail, and its notes say the Weekly Dream Digest empty-shell sync issue was already fixed on 2026-05-12.
- Current feed already exposes snapshot, empty, delivery-context, evidence, snooze, channel, and `hasMore` receipts.
- Remaining UX/debug gap: `limit` is silently defaulted or clamped to `1..100`. The response shows the applied `meta.limit`, but not the requested value or why the server changed it.

## External scan

- Slack Activity treats notifications as a triage inbox with filters, custom views, clearing, and dense/detail layouts.
- Microsoft Teams Activity feed emphasizes a cross-work summary plus filtering by activity type.
- Android notification channels make notification grouping and intrusiveness user-visible and user-controllable.
- Intelligent notification research emphasizes interruptibility, receptivity, and explicit policies for when notifications should be delivered or deferred.
- Iqbal and Bailey's OASIS work supports defer-to-breakpoint notification policies; timing and delivery policy should be explicit, not hidden.

## Plan

1. Add a feed `limitReceipt` to `NotificationCenterService` meta.
2. Sanitize direct service `limit` input so `NaN`, fractional, zero, and out-of-range values cannot leak into SQL `LIMIT`.
3. Update the extension client type for the new meta receipt.
4. Add targeted backend tests for default, exact, upper-clamped, lower-clamped, and non-finite direct-service limits.
5. Update `docs/features/notification_center.md` and the `docs/features/index.md` row concisely.
6. Verify with the Notification Center test file, `npm start` first compile, notification E2E, and scoped diff checks.
