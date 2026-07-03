# Topic Defer / Mute Boundary Receipt Plan

## Goal

Improve the Topic Messages `主题稍后处理 / 主题静音` user path so a user can understand the local-only, unread-preserving, recoverable effect before hiding a topic from the unread queue.

## Selected Feature

- Index row: `主题稍后处理` and `主题静音`
- Capability: Topic Messages
- Source doc: `docs/features/topic_based_messages.md`
- Primary UI: `src/modals/components/TopicDetailPage.vue`
- Store: `src/modals/memory-store.ts`
- Verifiers: `npm run verify:topic-based-messages`, `npm run verify:topic-based-messages:e2e`

## Plan

1. Context and selection - complete
   - Read `AGENT.md`, automation memory, `docs/progressing/to-verify.md`, and `docs/features/index.md`.
   - Checked Reminders list names; `Personal AI` list is absent.
   - Selected Topic Messages defer/mute from the random candidate sample.

2. Research and UX plan - complete
   - Compare Slack/Gmail/Zulip/Teams style triage and notification deferral.
   - Pull one or two research anchors for deferral/notification batching.
   - Lock the implementation shape after research.

3. Implementation - complete
   - Add pre-click boundary receipts inside the detail-page defer and mute menus.
   - Keep behavior unchanged: local state only, unread remains unread, no backend/platform sync.
   - Keep layout stable on compact screens.

4. Documentation - complete
   - Update `docs/features/topic_based_messages.md` with a concise behavior note and research reference note.

5. Verification - complete
   - Run targeted Topic verifier.
   - Run `npm start` until first successful webpack compile, then stop.
   - Run Topic Messages E2E verifier if feasible.
   - Run scoped `git diff --check`.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| Planning skill path under `.codex/skills` did not exist | Read `/Users/Esone/.codex/skills/planning-with-files/SKILL.md` | Read the actual skill file under `/Users/Esone/.agents/skills/planning-with-files/SKILL.md` |
| `Personal AI` Reminders list absent | Bounded `osascript` list-name probe | Recorded absence and stopped Reminder branch |
