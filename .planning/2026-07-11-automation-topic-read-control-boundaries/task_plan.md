# Topic read control boundaries

## Target

- Feature: `主题式未读阅读` in `docs/features/topic_based_messages.md`
- Source index row: `主题式未读阅读 | Topic Messages`
- Scope: presentation/accessibility boundaries for read-affecting controls in `TopicDetailPage.vue`

## Context checked

- `AGENT.md` confirms the random feature loop should plan first, inspect docs/code/Reminders, update docs, run targeted verification, run `npm start` to first successful compile, then run feature E2E.
- `docs/progressing/to-verify.md` has no carry-over item.
- Automation memory shows many recent Project Dashboard, Scheduled Messages, Doubao, Jira Design Links, Native Join, Ask, and Message Reaction runs, so this run skipped fresher repeated candidates and chose Topic Messages from the random sample.
- Reminders: AppleScript did not list `Personal AI`, but Swift/EventKit found it. The list has 4 total items, all completed historical Doubao/test feedback and unrelated to Topic Messages.
- External scan: Slack Unreads separates scanning, mark-as-read, undo, and skip/later; Microsoft Teams exposes channel activity and quick views for attention triage; Slack threads keep topic context and unread replies together; EmailSum and inbox-prioritization research both reinforce that thread catch-up needs clear action boundaries and recoverability.

## Improvement plan

1. Add a dynamic pre-click boundary for `查看上下文`.
   - When the conversation has explicit unread items, the button should state that expanding context marks known unread items read through the current entity cache path, keeps the item temporarily visible in unread mode, and can be undone.
   - When there is no explicit unread item, the button should say it only expands loaded context and does not mark read.
2. Add a dynamic pre-click boundary for `全部已阅`.
   - The button should name the current topic, known unread count, current visible batch, cache-write path, undo window, and no external-platform write/send/delete/history-pull boundary.
3. Update targeted verifier and E2E assertions so the boundary exists at the actual controls, not only in the surrounding receipt.
4. Update `docs/features/topic_based_messages.md` and `docs/features/index.md` concisely.
5. Verify with `npm run verify:topic-based-messages`, `npm start -- --progress` to first compile, `npm run verify:topic-based-messages:e2e`, and scoped `git diff --check`.

## Non-goals

- No backend read-status API work.
- No change to read/unread sync semantics, routing, sorting, sticky unread behavior, local defer/mute state, source-link safety, or Reminder state.
