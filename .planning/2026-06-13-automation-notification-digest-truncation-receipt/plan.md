# Notification Center digest truncation receipt

## Context

- Selected feature: `docs/features/notification_center.md`.
- `docs/progressing/to-verify.md` has no carry-over item.
- Local Reminders is readable, but there is no `Personal AI` list on this Mac, so no Reminder item can be attached or completed.
- External references point toward controllable, explainable notification summaries: Apple notification summaries and Reduce Interruptions, Slack Activity filters and clearing, Viva Insights privacy/opt-out boundaries, and notification batching research.

## Gap

`NotificationCenterService.formatTodoDigest()` and `formatNoticeDigest()` currently slice overlong Markdown directly by character budget. That can leave a provider digest ending in a half item or half receipt, which is especially bad for notification UX because the final visible text may lose the boundary between delivered, failed, still-unfinished, and not-yet-shown items.

## Plan

1. Add a small Markdown clamp helper for Notification Center digests that preserves complete lines where possible and appends an explicit truncation receipt.
2. Apply the helper to todo and notice digest rendering.
3. Add focused service tests that force low token budgets and verify the summary ends with a clear omitted-items note instead of a raw partial line.
4. Update the Notification Center feature doc with the new digest truncation behavior and the product rationale.
5. Verify with the targeted memory-service test, `npm start` first successful compile, and `git diff --check` scoped to touched files.
