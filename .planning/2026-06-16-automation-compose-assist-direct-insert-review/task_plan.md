# Compose Assist Direct Insert Improvement Plan

Goal: improve the selected `回复助手直接插入` feature by checking documentation, code, comparable product/research context, local Reminder feedback availability, and the actual user journey, then implementing one focused low-decision UX/code improvement with verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory, `AGENT.md`, feature index, carry-over verification notes, memory hints, root planning context, worktree status, and local Reminder list state |
| 2 | completed | Inspect Compose Assist docs, direct-insert code, presentation helpers, and targeted verification scripts |
| 3 | completed | Search current product references and research for similar compose-assist preview/insert control patterns |
| 4 | completed | Decide and write the smallest constructive implementation slice |
| 5 | completed | Implement scoped code/docs/test changes without touching unrelated dirty worktree files |
| 6 | completed | Run targeted validation, dev extension build, E2E where practical, and scoped whitespace checks |
| 7 | completed | Update automation memory, handle Reminder/archive bookkeeping honestly, and summarize outcome |

## Decisions

- Selected feature: `回复助手直接插入`.
- Source doc: `docs/features/compose_assist.md`.
- Reminder scan result: visible Reminders lists do not include `Personal AI`; no Reminder item can be incorporated or marked complete in this run.
- Existing worktree is very broad and dirty. Keep changes scoped to Compose Assist and this planning directory.
- Avoid recent exact automation families from today where practical; this run selected Compose Assist from the remaining candidates.
- Selected implementation slice: make review cancel/Escape reversible by collapsing the locked review back to the lightweight preview, while keeping thumb-down as the explicit hide-and-learn action.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Initial Reminder AppleScript wrapper had quoting syntax error | First `osascript` probe | Retried with direct Ruby `system` arguments; list scan succeeded |
| No visible `Personal AI` Reminders list | Reminder list scan | Record absence and stop Reminder branch |
