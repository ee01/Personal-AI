# Memory Lens Selection Query Receipt Plan

## Goal
Improve `划词查找关联记忆` by tightening the visible boundary between a user-selected text query, already-matched recall candidates, and non-mutating UI actions.

## Current Phase
Complete

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | complete | Read AGENT workflow, feature index, automation memory, root planning context, and local Reminders |
| 2 | complete | Inspect Memory Lens selection docs, content-script implementation, verifier coverage, and dirty worktree scope |
| 3 | complete | Search current product and research references for browser context, permissioned search, citations, and RAG transparency |
| 4 | complete | Implement a small UI receipt improvement and update feature docs/index |
| 5 | complete | Run targeted static verifier, dev extension compile, focused E2E, and scoped diff check |
| 6 | complete | Update automation memory and close out Reminder status honestly |

## Decisions

- Selected feature: `划词查找关联记忆` under Memory Lens.
- Source doc: `docs/features/memory_lens.md`; index row: `docs/features/index.md`.
- Reminder state: EventKit found the local `Personal AI` list with 4 total items and 0 incomplete items; no open item is related to Memory Lens or selection search.
- Implementation slice: add an in-card `打开/候选` receipt for Selection Memory Search results. It will state that the click only opens already matched `selected_text` candidates, does not perform a second recall, and does not save, insert, send, or call external AI.
- Keep the change presentation-only. Do not alter `/context-recall`, selection eligibility, site controls, memory capture, feedback writes, source-memory APIs, passive Lens, or Compose Assist mutual exclusion.
- The worktree is broadly dirty from prior automation runs. This run owns only the Memory Lens selection receipt change, focused verifier assertions, concise docs/index edits, this planning directory, and automation-memory update.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `node` missing from PATH | Baseline check | Use `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH"` per `AGENT.md` |
| First E2E assertion assumed one selection candidate | E2E run | Real fixture produced 2 strong candidates; updated assertion to check candidate count/current position instead of hard-coded `1` |
