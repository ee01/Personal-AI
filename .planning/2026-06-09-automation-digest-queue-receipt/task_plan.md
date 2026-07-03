# Plan: DigestQueueService 本地摘要回执

## Context

- Selected feature: `DigestQueueService 本地摘要` from `docs/features/index.md`.
- Carry-over: `docs/progressing/to-verify.md` says `暂无。`.
- Reminders: local Reminders is accessible, but there is no `Personal AI` list, so no reminder item can be incorporated or marked done.
- Research: Slack Later/Gmail Snooze/Teams Activity emphasize recoverable queues and source/processing status; notification batching research supports predictable batches and warns against opaque delay/failure.

## Plan

1. Keep scope to extension local digest queue, not memory-service Notification Center feed.
2. Add a compact receipt to Concerned Items digest messages that exposes release schedule and recovery boundary.
3. Extend the existing digest verifier to assert the receipt without relying on live Bot credentials.
4. Update `docs/features/notification_center.md` with the current user-facing behavior.
5. Run targeted digest verification, dev extension compile, and diff checks.
