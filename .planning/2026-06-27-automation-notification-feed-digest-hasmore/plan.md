# Notification feed digest has-more plan

## Target

Random feature: `Notification Center feed` in `docs/index.md`.

## Current gap

`GET /notification-center/feed` already returns `meta.hasMore`, but Provider/Doubao digest generation calls `listFeed()` and drops that meta. When the feed has more items than the digest page limit, the digest looks complete even though additional unshown items remain in the feed and are not marked delivered.

## External signals

- Slack Activity and Teams Activity frame notifications as filterable feeds where users can tell they are looking at a scoped view.
- Apple Scheduled Summary supports batching, but the summary should not hide that more notifications may remain.
- Notification/interruption research supports batching to reduce interruptions, while still preserving awareness and recoverability.

## Implementation steps

1. Add a compact feed-limit receipt helper in `NotificationCenterService`.
2. Make `formatTodoDigest()` and `formatNoticeDigest()` call `listFeedResult()` so they can append a visible receipt when `meta.hasMore=true`.
3. Keep delivery semantics unchanged: only visible `sourceRefs` are returned for delivery writeback.
4. Add focused unit coverage for todo and notice digest feed-limit receipts.
5. Update `docs/features/notification_center.md` with the current user-facing boundary.

## Validation plan

1. `npm --prefix memory-service test -- --run src/__tests__/notificationCenter.test.ts`
2. `npm start` until first successful compile, then stop the watcher.
3. `node tools/verify-weekly-report-notification-e2e.mjs`
4. `git diff --check -- .planning/2026-06-27-automation-notification-feed-digest-hasmore/plan.md docs/features/notification_center.md memory-service/src/core/NotificationCenterService.ts memory-service/src/__tests__/notificationCenter.test.ts`
