# Watch Button Boundary Plan

## Selected Feature

- Feature: `关注后续 / Watch`
- Capability: Message Reaction
- Source doc: `docs/features/message_reaction.md`
- Index row: `docs/features/index.md`

## Context

- `docs/progressing/to-verify.md` is empty.
- Automation memory shows several recent Message Reaction and adjacent checks, but the Watch toolbar button itself still has a remaining pre-click ambiguity.
- EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items, so there is no Reminder feedback to incorporate or mark done.

## External Scan

- Microsoft Teams Followed threads lets users manually follow a thread, see followed threads in one place, unfollow, mark unread, return to the conversation, and tune automatic follow settings.
- Slack reminders can be created from a message and then managed from Later, where users can complete, reschedule, or delete them.
- Microsoft Research on AI-powered reminders for collaborative tasks stresses that users need to understand what reminder systems are tracking and how those reminders fit asynchronous collaboration.
- Context-aware thread detection research notes that multi-party chat interleaves multiple topics, so follow/watch systems should expose the matching route instead of making thread relevance look certain.

## UX Problem

Watch already has good downstream receipts:

- The config page explains save-before-active behavior.
- The save toast distinguishes indexed vs degraded semantic matching.
- The management page explains local snapshots, filtering, extension, cancellation, and hit notification state.

The remaining gap is the toolbar control point: before clicking `关注后续 / Watch`, `title` and `aria-label` still read like a plain label. A keyboard or hover user cannot tell that the click only opens a configuration draft and does not start listening yet.

## Implementation Plan

1. Add Watch-specific toolbar `title` / `aria-label` copy in `src/message-reaction/MessageReactionUI.ts`.
2. Keep the visible button text and layout unchanged.
3. Assert the new Chinese and English button boundary in `desktop-app/scripts/message-reaction-toolbar-check.mjs`, including own-message toolbar paths.
4. Update `docs/features/message_reaction.md` and the `关注后续 / Watch` index row to mention the button-level boundary.
5. Run focused syntax/unit/E2E/dev compile checks.

## Non-Goals

- No change to `pendingFollowThreadConfig`.
- No change to Watch rule save semantics, original-message indexing, matching routes, notification cadence, marker cache, management page behavior, storage schema, or Reminder state.
