# Topic Messages Empty Batch Recovery

## Target

- Feature: `主题式未读阅读` / Topic Messages
- Source doc: `docs/features/topic_based_messages.md`
- Entry points: `memory-exploring.html#/entity/Topic` and `memory-exploring.html#/topic/:id`

## User Problem

When a user enters a topic from the unread queue and then narrows the detail page with search, read-state, or group filters, the chat batch can become empty even though the topic still has unread signals. The current receipt explains the batch scope, but the empty state itself is terse and does not provide an in-place way to recover the unread batch.

## Product And Research Scan

- Slack Unreads keeps sorting/filtering, mark-read undo, skip/later, and refresh in the unread catch-up surface, which supports recovery controls near the empty or changed batch state.
- Zulip mutes topics out of primary unread counts while keeping explicit include/search and unmute routes, which supports making hidden unread state recoverable from the same context.
- Email deferral research frames unread handling as triage and re-entry, not just a binary read flag.
- Conversation-curation research emphasizes choosing which discussion threads to bring back to a user's attention, so an empty filtered batch should explain the selection boundary and provide a route back.

## Implementation Plan

1. Add a computed empty-batch recovery receipt in `TopicDetailPage.vue` that appears only when the loaded detail has conversations but the current local filters hide them.
2. Surface direct actions to clear local search, reset group filtering, and return to the unread batch when unread signals still exist.
3. Keep read-state semantics unchanged: filtering and recovery actions do not mark read, write to Memory Service, sync external platforms, send, delete, or change defer/mute state.
4. Extend the existing Topic Messages E2E verifier to assert the empty-batch receipt and recovery action.
5. Update `docs/features/topic_based_messages.md` with the new user-facing contract and current scan note.

## Validation Plan

- `npm run verify:topic-based-messages`
- `npm start` until the first successful compile, then stop
- `npm run verify:topic-based-messages:e2e`
- `npm run verify:i18n`
- Scoped `git diff --check`
