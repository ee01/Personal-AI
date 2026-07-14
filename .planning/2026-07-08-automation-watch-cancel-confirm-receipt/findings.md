# Findings

## Reminder

- AppleScript listed local Reminder lists but did not show `Personal AI`.
- EventKit found `Personal AI` with 4 total items and 0 incomplete items.
- All items are completed historical Doubao / Notification / test feedback. No open item is related to Watch, follow threads, message reaction cancellation, notification scope, or follow-thread management, so nothing should be marked done.

## External Scan

- Microsoft Teams Follow Threads exposes automatic/manual following and notification settings for followed threads, which supports keeping follow/unfollow state and notification scope visible instead of treating it as a hidden side effect.
- Slack threads and Save for Later keep follow-up context anchored to the original message or saved item, reinforcing that cancellation should preserve source-message context and make local state transitions clear.
- Microsoft Research work on AI-powered collaborative-task reminders reports that users need reminders to fit workflows and remain understandable, especially when AI extracts or follows up on commitments.
- Multi-party chat thread-detection research frames thread grouping as probabilistic disentanglement; this supports telling users that deleting a local Watch rule does not erase already indexed or historically detected context.

## Code Notes

- `FollowThreads.vue` loads only local `chrome.storage.local.concernedItems`, hides non-manual/system Watch entries, and mutates local storage for extend/cancel.
- `buildFollowThreadCancelReceipt(...)` already explains the post-delete boundary, but the pre-delete browser confirm does not.
- The focused E2E already validates local-only extend/cancel behavior and can be extended to assert the new inline confirmation contract.
