# Notification Center Feed Meta Receipt Findings

## Repository Findings

- `docs/progressing/to-verify.md` currently says `暂无。`, so there is no carry-over verification item.
- Recent automation memory covered Ask, Prompt Config, Meeting Pilot ASR, Message Analysis, Skill Foundry, Message Reaction Followup, Storyline, Project Dashboard, User Profile, Native Join, Memory Timeline, Agent Thinking, Topic Messages, Agent Workflow, Rehearsal, Doubao Quick Ask, Action Queue, and Memory Coverage. Notification Center feed is less fresh than those runs.
- Local Reminders lists visible from AppleScript: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`. No `Personal AI` list is visible.
- `docs/features/notification_center.md` is current for the major feed semantics: lane routing, per-channel delivery receipts, todo cooldown, `daily_digest`, cross-channel receipts, and digest truncation boundaries.

## Code And UX Findings

- `NotificationCenterService.listFeed()` currently returns only an array of feed items. The route wraps it as `{ items, total: items.length }`.
- For a limited feed request, consumers can see `total: 20` but cannot tell whether 20 is all available items or just the requested page size. This is a weak receipt for a triage feed because the user/operator cannot distinguish "empty/complete" from "more exists, fetch another pass".
- The service currently queries notifications and proposed actions separately with the same `limit`, merges, sorts, and slices. Overfetching by one per source can produce a bounded, non-expensive `hasMore` signal without changing item ordering or delivery semantics.
- Extension consumers currently read `feed.items`; adding a compatible `meta` object should not break existing behavior.

## External Reference Findings

- Slack Activity view frames notifications as a filterable triage feed with saved/custom views, supporting explicit filter/selection receipts.
- Microsoft Teams Activity feed presents a timeline of notifications and updates with filters for unread, mentions, replies, and related activity; this supports exposing applied feed scope rather than a raw item array only.
- Android notification guidance emphasizes categories/channels and action clarity, which maps to Personal AI's channel/lane/mode receipt.
- Notification batching/interruption research supports reducing interruption load but also preserving awareness; feed APIs should clarify when a response is capped so low-interruption delivery does not silently hide pending work.
