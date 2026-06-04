# Storyline Draft Grounding Improvement Plan

Goal: improve the selected `Storyline Draft 页面` feature by keeping docs current, folding in relevant product/research references, fixing a focused evidence-grounding UX gap, and validating the API/page flow.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory, `AGENT.md`, feature index, Storyline docs, current worktree state, and local Reminders list state |
| 2 | completed | Inspect Storyline Draft page, draft API/service, router/client, and existing Storyline E2E/test coverage |
| 3 | completed | Review external product and paper references for grounded narrative/meeting-draft behavior |
| 4 | completed | Implement selected low-decision UX/code improvement |
| 5 | completed | Update feature documentation |
| 6 | completed | Run targeted Storyline API, E2E, and extension compile verification |
| 7 | in_progress | Update automation memory and summarize outcome |

## Decisions

- Selected feature: `Storyline Draft 页面`.
- Source doc: `docs/features/memory_storyline_builder.md`.
- Reminder branch: macOS Reminders exposes no list named `Personal AI`; no Reminder items can be incorporated or completed in this run.
- Avoid repeating the previous run's `Storyline 会前提示` server opportunity gating work.
- Implementation slice: add selected-segment grounding visibility and regression coverage for draft responses that lack usable evidence/segments.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `$CODEX_HOME` memory path appeared empty | Initial automation-memory read | Read the known fallback `/Users/Esone/.codex/automations/automation/memory.md` |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and do not mark unrelated Reminder items done |
| Reminder pending-count AppleScript hung | Per-list reminder count probe | Killed only the stuck read-only `osascript` process and relied on the successful list-name scan |
