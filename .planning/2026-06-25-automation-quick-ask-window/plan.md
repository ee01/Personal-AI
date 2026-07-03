# Quick Ask Window Improvement Plan

Goal: improve the selected `Quick Ask 小窗` feature by confirming docs against code, incorporating current outside references and local Reminder feedback when available, then implementing a focused low-decision UX/code improvement with verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory state, `AGENT.md`, feature index, existing planning context, and local Reminder list state |
| 2 | completed | Inspect Doubao Bridge / Quick Ask docs, desktop-app code, UI flow, tests, and current dirty worktree scope |
| 3 | completed | Search current product/docs and paper references for quick assistant windows, command palettes, and memory-aware assistant UX |
| 4 | completed | Write the concrete improvement plan and decide the smallest no-extra-decision implementation slice |
| 5 | completed | Implement selected code/docs/UX changes while preserving unrelated dirty files |
| 6 | completed | Run targeted verification and, if UI changes are touched, build/E2E the relevant surface |
| 7 | completed | Update Reminders if applicable, write automation memory, and summarize outcome |

## Decisions

- Random candidate selected after rerolling away from freshly touched exact families: `Quick Ask 小窗` under Doubao Bridge.
- Source doc: `docs/features/doubao_bridge.md`.
- Local Reminders query returned no visible `Personal AI` list, so there are no Reminder items to incorporate or mark done unless another source appears.
- Existing worktree is broadly dirty. Keep current-run edits scoped to Quick Ask / Doubao Bridge docs and planning/automation bookkeeping.
- Existing Quick Ask dirty changes already cover status-card action boundaries, mobile-context send receipts, active-context filtering, and voice receipts. Do not duplicate those.
- Selected implementation slice: add a positive/failure boundary receipt for Quick Ask scope changes, because clicking `工作 / 个人 / 两者` persists `explorer.askDefaultScope` but currently success is silent.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `$CODEX_HOME` was unset for the first automation-memory read | Initial shell read | Re-read from `${CODEX_HOME:-$HOME/.codex}/automations/automation/memory.md` |
| Local `awk` lacks `systime()` | Random feature sampler | Re-ran random sampling with Perl `List::Util::shuffle` |
| No visible `Personal AI` Reminders list | AppleScript list count | Record absence and do not mark any Reminder items done |
