# Findings

## Repo Context

- `docs/progressing/to-verify.md` is empty.
- Recent automation memory focused on Today Pilot, Agent Thinking, Ask, Memory scope, Rehearsal, Jira Import, User Profile, Coverage, Relationship Radar, Scheduled Messages, Project Dashboard, Doubao, Native Join, Agent Workflow, and Topic.
- Random sample included recent adjacent families first, so this run selected `Notification Center feed`.

## Reminder State

- AppleScript listed local Reminders but did not show `Personal AI`.
- EventKit read succeeded: `Personal AI` exists, total 4 items, incomplete 0.
- No Reminder feedback is related or needs completion.

## External Research

- Slack Activity 2.0 centralizes notifications/messages/actions into a single triage feed with filters and saved views.
- Microsoft Teams Activity feed exposes unread, mentions, replies, likes, and filters.
- Apple notification summaries prioritize glanceable, low-interruption grouped notification review.
- Notification research supports batching/deferral only when users can still understand status, timing, and whether items remain pending.

## Code Findings

- `NotificationCenterService.listFeedResult()` already returns `meta.limit`, `meta.returned`, `meta.hasMore`, `limitReceipt`, `snapshotReceipt`, and `emptyReceipt`.
- `formatTodoDigest()` and `formatNoticeDigest()` include snapshot/hasMore receipts in markdown and return `feedHasMore` / `feedLimit`.
- `ProviderContextService.renderTodoDigest()` and `renderNoticeDigest()` currently drop that feed metadata when creating `ProviderMemoryProduct`.
- `desktop-app/src/syncManager.ts` records package kinds, item count, and `sourceRefCount`, but cannot preserve whether the package represented a limited feed slice.

## Improvement

Carry feed slice metadata through provider packages into desktop sync attempt logs so the user's status surface can distinguish "this sync sent the visible feed slice" from "the feed is exhausted".
