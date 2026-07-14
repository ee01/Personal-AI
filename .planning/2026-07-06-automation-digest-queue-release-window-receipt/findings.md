# DigestQueueService Findings

## Initial Context

- Random sample included `DigestQueueService 本地摘要` under Notification Center.
- AppleScript did not list `Personal AI`, but EventKit did; the list has 4 completed historical Doubao / Notification items and 0 incomplete items.
- No Reminder item is open or specifically related to DigestQueueService local summaries, release windows, batching, or popup queue status.

## Code And UX Findings

- `docs/features/notification_center.md` already describes the two-layer model: Memory Service Notification Center vs extension-local DigestQueueService.
- Current code already exposes `currentQueueStatus` / `currentQueueSummary` on the `digest_queue_process` task and renders a structured popup `task-queue-summary`.
- Existing E2E covers pending count, release-window count, next release, source/schedule breakdown, Chinese/English copy, unavailable queue state, and no-side-effect boundaries.
- Remaining UX gap: the popup shows the current local queue block next to the latest run result. If the latest run says `无到期摘要` but the queue has since reached a release window, the UI does not explicitly say the queue block is a fresh queue snapshot independent of the last background-run result.

## External Reference Findings

- Apple notification summaries let users choose which notifications are summarized and present priority notifications at the top, reinforcing explicit summary scope and timing.
- Slack Later keeps saved/reminded items visible in one place and private to the user, reinforcing a recoverable personal queue.
- Microsoft Viva Briefing settings let users choose receipt time and priorities, reinforcing user-controlled digest timing.
- Notification-interruption and bounded-deferral research support batching to reduce interruption, but only when users can understand the delay and current state.
