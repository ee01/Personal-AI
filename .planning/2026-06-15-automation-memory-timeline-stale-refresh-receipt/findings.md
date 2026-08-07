# Memory Timeline Stale Refresh Receipt Findings

## Repo Findings

- `docs/progressing/to-verify.md` says `暂无。`, so there is no carry-over verification item.
- Recent automation memory already covered Agent Thinking, Topic Messages, Agent Workflow, Rehearsal, Doubao, Action Queue, Coverage, Relationship Radar, Scheduled Messages, Task Scheduler, Memory Capture, and Message Reaction; this run avoids those exact recent families.
- Random eligible selection chose `记忆时间轴`, with source document `docs/memory_system.md`.
- Local Reminder lists are: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`. No `Personal AI` list is visible.
- The worktree is already broadly dirty. Keep this run scoped to timeline files, docs, and this planning folder.

## Current Timeline Behavior

- `TimelinePage.vue` loads the timeline through `GET_RECENT_TIMELINE`, sends scope/range to the background, and renders `buildTimelineBoundaryReceipt`.
- Source filtering is local-only within the loaded result set and already avoids extra recall requests.
- Focus links can fetch an exact memory and pin it when it falls outside the selected window.
- Link safety and feedback status already have targeted verifier and E2E coverage.
- Current gap: any `loadTimeline` failure clears `timelineEvents` and resets the source filter. That is correct for first-load failure, but poor UX for same-scope refresh failure after a successful list because it hides the last known evidence and looks like the timeline became empty.

## External Reference Findings

- Google My Activity frames personal history as something the user can review and manage, with filters and control boundaries around activity history.
- Google Photos Memories uses AI-curated timelines but still gives users customization/control over visible memories.
- OpenAI's ChatGPT memory documentation separates saved memories and referenced chat history controls, supporting explicit boundary copy around what memory state is being used.
- PIM/refinding research highlights contextual and temporal cues as central to re-finding information; a transient refresh error should not erase the user's current temporal/contextual cue set.
- Long-term agent memory papers on temporal/episodic memory support representing memory freshness and snapshot state explicitly instead of making the UI imply live certainty.
