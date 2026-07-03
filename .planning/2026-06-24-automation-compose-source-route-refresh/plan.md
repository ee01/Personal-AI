# Compose Assist Source Route Refresh Plan

## Target

- Feature index row: `回复助手来源适配`
- Capability: Compose Assist
- Source doc: `docs/features/compose_assist.md`

## Context Checked

- `AGENT.md`
- `docs/progressing/to-verify.md` (`暂无。`)
- Automation memory, recent target history, and random-loop memory guidance
- Local Reminders list names: Reminders is reachable, but there is no `Personal AI` list on this Mac
- Current Compose Assist docs, source-route presentation helper, site context adapters, and direct-insert E2E
- External scan: Gmail Smart Compose, Copilot in Outlook, Smart Reply research

## UX Gap

The source-route receipt already tells the user whether the current editor is RingCentral, Jira, or Web AI and which sources may be recalled. It does not yet say when that route is recomputed. A user switching from main chat to thread, changing Jira issue/comment context, or rewriting a Web AI prompt can mistake an old route as a current-context promise.

## Plan

1. Add a compact `刷新口径` row to the Compose Assist source-route receipt.
2. Split RingCentral main conversation and thread route boundaries so the receipt explicitly says which context is not mixed in.
3. Update the direct-insert E2E fixture to assert the new Web AI route refresh copy.
4. Update `docs/features/compose_assist.md` and `docs/features/index.md` with current behavior.
5. Verify with script syntax check, first successful dev compile, Compose Assist E2E, scoped whitespace check, and process cleanup.

## Non-goals

- No backend recall/ranking changes.
- No changes to insert, send, submit, calibration, feedback, or Memory Service writes.
- No new source browser or evidence expansion UI.
