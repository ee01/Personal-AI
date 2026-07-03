# Findings

## Repo Context

- `docs/progressing/to-verify.md` currently says `暂无。`; no carry-over verification item blocks this run.
- Automation memory shows very recent work on Storyline, Doubao, Message Reaction, Agent Thinking, Message Analysis, Memory Coverage, User Profile, Memory Service, Google Slides, Skill Foundry, Meeting Pilot, Native Join, Ask, Prompt Config, and Project Dashboard.
- Local Reminders is readable, but there is no visible `Personal AI` list, so no Reminder item is incorporated or completed.

## Initial Code Findings

- `docs/features/topic_based_messages.md` already documents that topic defer and mute are local browser state, do not mark topics as read, and have recovery/undo paths.
- `TopicDetailPage.vue` already supports detail-page defer/mute actions and short undo toasts.
- The detail-page menus currently list time/reason choices directly. They do not show a pre-click receipt explaining that the action hides the topic from the unread queue locally, preserves unread state, avoids backend/original-platform sync, and can be restored.

## Research Findings

- Slack Save for Later keeps saved items/reminders private, centralizes them in Later, and supports completing/editing/removing reminders. Product cue: deferred items should have a visible recovery/work queue, not disappear as if read.
- Gmail Snooze lets users pick a later time for an email to return. Product cue: defer means "bring back later" rather than "mark handled."
- Zulip muted topics are hidden from main feeds/inbox unless explicitly included, and muted-topic unread messages stop contributing to unread counts. Product cue: mute is a personal attention filter with an explicit include/recovery path.
- Microsoft Research email deferral work finds users defer messages when handling requires replying, careful reading, links/attachments, workload context, and sender importance. Product cue: defer is a first-class triage decision and should explain what signal is preserved for later.
- Notification deferral research frames bounded deferral as a tradeoff between awareness and interruption. Product cue: the UI should disclose the boundary before applying a delay/hide rule.

## Locked UX Direction

- Add a compact pre-click receipt in the Topic detail defer menu and mute menu.
- Receipt must state: local browser state, unread state preserved, removed from current unread queue, no Memory Service/original chat writeback, restore path exists.
- Do not change read-state behavior, backend contracts, storage keys, or list-page triage logic in this run.
