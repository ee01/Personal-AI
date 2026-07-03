# Topic Unread Hidden Receipt Plan

## Goal

Fix the Topic Messages unread-list UX so the empty unread view does not claim all topics are read when unread topics are only hidden by local Later or Mute state.

## Selected Feature

- Feature: `主题式未读阅读`
- Capability: Topic Messages
- Source doc: `docs/features/topic_based_messages.md`

## Plan

1. Context and research - complete
   - Read automation memory, `AGENT.md`, feature index, and Topic Messages doc/source.
   - Checked Reminders: lists are readable, but no `Personal AI` list exists.
   - Research signals: Slack Unreads supports undo/skip, Zulip muted topics are hidden from main feeds and counters, email deferral research treats later handling as a distinct triage state.
2. Implementation - complete
   - Add a persistent Topic list receipt that names active unread, Later-hidden unread, and Muted-hidden unread counts.
   - Add an honest unread-empty state with direct Later/Muted view buttons when hidden unread topics exist.
3. Docs and verification - complete
   - Update `docs/features/topic_based_messages.md`.
   - Extend targeted source assertions and Playwright E2E.
4. Validation - complete
   - `npm run verify:topic-based-messages`
   - `npm start` first successful compile, then stop watcher.
   - `npm run verify:topic-based-messages:e2e`
   - `git diff --check`

## Risks

- The repo is broadly dirty from earlier automation work. Keep changes scoped to Topic Messages files and this planning directory.
- The Topic list already has several local-only states; receipt copy must stay compact and not look like a backend sync promise.

## Validation Results

- Passed: `npm run verify:topic-based-messages`
- Passed: `npm start` first webpack dev compile; watcher stopped.
- Passed: `npm run verify:topic-based-messages:e2e`
- Passed: `git diff --check`
- Confirmed: no `webpack --watch` / `npm start` watcher remained.
