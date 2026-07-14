# DigestQueue Empty Snapshot Receipt Findings

## Repo Findings

- `docs/progressing/to-verify.md` is empty, so this run can pick a fresh feature.
- Recent automation memory covered Doubao explorer, Outreach, Memory Lens, Project Dashboard, Skill Foundry, Meeting Local ASR, Scheduled Messages, Agent Thinking, Google Slides, and Evidence Watch. `DigestQueueService 本地摘要` is not the freshest exact target.
- `Personal AI` Reminders list is visible through EventKit with 4 completed items and 0 open items. All completed notes are historical Doubao/test feedback, not local digest queue feedback.
- The worktree is broadly dirty before this run. Keep edits scoped to DigestQueue/popup/docs/planning.

## Code Findings

- `DigestQueueService.getQueueStatusSummary()` returns a current local snapshot even when there are no queued items: `totalItems=0`, `dueItems=0`, and `checkedAt`.
- `TaskScheduler.enrichDigestQueueStatus()` attaches this current snapshot to the `digest_queue_process` row and keeps `currentQueueSummary` as the older string fallback.
- `popup.tsx` currently treats `!summary || summary.totalItems <= 0` together. If `summary.totalItems=0` but `lastResultSummary` says "waiting" or "retained", the popup can show the old text as the queue status and only says "last confirmed status".
- UX gap: current snapshot and previous run result are not visually separated in the empty-queue path. That can make a cleared local queue look like it still has pending digest items.

## External Reference Findings

- Apple Scheduled Summary lets users choose notifications to summarize and schedule delivery times, supporting explicit current summary/schedule boundaries rather than implicit immediate sending. Source: https://support.apple.com/guide/iphone/summarize-notifications-reduce-interruptions-iph1fbe7d2b9/ios
- Slack Activity frames notifications as a feed with filters, saved views, read/clear actions, and scan modes, supporting clear inbox-state presentation instead of stale status text. Source: https://slack.com/help/articles/19693583638803-Get-your-work-done-from-the-Activity-view
- Microsoft Research email batching work found batching/interruption patterns relate to perceived productivity and stress, supporting low-interruption digesting but also requiring predictable recovery/status. Source: https://www.microsoft.com/en-us/research/wp-content/uploads/2016/06/Email20Duration20Camera20Ready20submission3-1.pdf
- Research on notification interruptions reports that reducing notification-caused interruptions benefits performance and strain, reinforcing the feature's batching direction while keeping failure and current-state receipts visible. Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC10244611/
