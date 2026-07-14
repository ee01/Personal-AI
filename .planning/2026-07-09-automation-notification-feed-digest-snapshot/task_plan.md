# Notification Center Feed Digest Snapshot Plan

## Target

- Feature: `Notification Center feed`
- Source doc: `docs/features/notification_center.md`
- Core code: `memory-service/src/core/NotificationCenterService.ts`

## Context

- `docs/progressing/to-verify.md` has no carry-over work.
- `Personal AI` Reminders list exists through EventKit, but all 4 items are completed historical Doubao / Notification / test feedback; no open item applies to this feature.
- The existing feed API already returns `meta.snapshotReceipt`, but non-empty Provider / Doubao digest markdown only shows item rows plus optional truncation / has-more receipts.

## Plan

1. Add a compact digest-visible snapshot receipt for non-empty todo and notice digest outputs.
2. Keep it read-only: no changes to feed filtering, delivery receipts, global clicked/dismissed handling, sourceRefs, dedupe, or channel writeback.
3. Extend `notificationCenter.test.ts` to prove non-empty todo and notice digests expose the snapshot scope.
4. Update canonical docs and the feature index concisely.
5. Verify with the notification-center unit test, dev extension compile, relevant notification E2E, and scoped diff checks.

