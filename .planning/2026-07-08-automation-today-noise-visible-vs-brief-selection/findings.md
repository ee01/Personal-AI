# Findings

## Selected Feature

- Random target: `今天排序与噪声控制` under Today Pilot (`docs/features/today_pilot.md`).
- `docs/progressing/to-verify.md` is empty.
- Recent automation memory showed `项目本地查找`, Skill Foundry decisions, Auto Reply, Agent Thinking approval, Notification digest, User Profile, Storyline, Meeting Pilot, Quick Ask, Watch, Reflection, and Scheduled Messages were fresher exact targets, so this Today Pilot subfeature is acceptable.

## Reminders

- AppleScript listed local Reminder lists but did not expose `Personal AI`.
- EventKit found `Personal AI` with 4 total items and 0 incomplete items.
- No Today Pilot sorting/noise-control Reminder item was available to incorporate or mark done.

## Product / Research Scan

- Microsoft's Plan My Day agent template emphasizes top 3-5 urgent and impactful items, scored by business impact and time sensitivity, which supports compact visible priority slices.
- Gemini Daily Brief pulls from connected Gmail, Calendar, and Gemini chats and exposes item sources, supporting source-visible daily summaries.
- Slack Catch Up/Unreads uses a fresh-batch model where new unread messages require refresh/reopen, supporting explicit snapshot and refresh boundaries.
- Notification and email batching research supports reducing constant interruption and making delayed/non-visible items understandable instead of treating every signal as a push.

## Code Findings

- `OverviewPage.vue` already has `rankingSummary`, `sourceBreakdownReceipt`, source bucket summaries, and post-feedback snapshot copy.
- `hideCardForToday()` replaces `dayBrief` with the service-confirmed visible brief after done/later/mute, then increments feedback count.
- The UI does not preserve the source bucket of the just-hidden card, so the source distribution can only say current selected evidence is lower; it cannot explain that a selected card was hidden by this page action.
- Bounded fix: keep a small local selected-evidence click snapshot for done/later/mute and show it only as receipt copy. Do not change backend ranking or feedback.

