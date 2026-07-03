# Memory Scope Semantics Improvement Plan

Goal: improve the randomly selected `工作/个人/全部范围语义` feature by checking docs against current code, grounding the UX change in related product/research signals, implementing a focused low-decision improvement, and validating it through the repo harness.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory, `AGENT.md`, feature index, carry-over, reminders, and existing planning context |
| 2 | completed | Inspect Memory Service scope docs, routes, UI clients, tests, and current dirty worktree scope |
| 3 | completed | Search current product/docs and paper references for scoped memory/search/personalization controls |
| 4 | completed | Write the concrete implementation plan and choose the smallest no-extra-decision slice |
| 5 | completed | Implement scoped code/docs/UX changes while preserving unrelated dirty files |
| 6 | completed | Run targeted verification, first successful dev build, and any matching E2E check |
| 7 | completed | Update automation memory and summarize Reminder/archive status |

## Decisions

- Selected feature: `工作/个人/全部范围语义`.
- Source doc: `docs/features/memory_system.md`.
- Local Reminders list scan succeeded, but no visible list named `Personal AI` exists, so there are no Reminder items to incorporate or mark done in this run.
- Existing dirty worktree is broad and mostly unrelated. Keep edits scoped to Memory Service scope semantics plus planning/automation bookkeeping.
- Implementation target: add a scope-boundary receipt and broaden action for successful non-`all` search results, so partial in-scope hits do not imply cross-scope completeness.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and do not mark any Reminder items done |
| `verify:memory-search-scope:e2e` did not see the new boundary receipt | First E2E run before rebuilding `dist/` | Run `npm start` to first successful compile, then rerun E2E against the fresh extension bundle |
