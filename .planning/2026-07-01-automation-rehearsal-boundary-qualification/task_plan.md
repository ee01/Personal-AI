# Rehearsal Boundary Qualification Improvement Plan

Goal: improve the randomly selected `场景预演边界` feature by confirming docs/code freshness, incorporating current product/research references and local Reminder state, then implementing a bounded UX/code improvement with focused verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read AGENT workflow, automation memory, feature index, to-verify file, prior planning context, and Reminders state |
| 2 | completed | Inspect Rehearsal docs, source files, and existing verification scripts |
| 3 | completed | Research comparable product and paper patterns for scene/future-cue reminders |
| 4 | completed | Write the concrete implementation slice and UX plan |
| 5 | completed | Implement code and docs changes without touching unrelated dirty work |
| 6 | completed | Run targeted tests, first successful `npm start` compile, feature E2E, and scoped diff check |
| 7 | completed | Update automation memory and summarize Reminder handling plus validation evidence |

## Decisions

- Selected feature: `场景预演边界` under Rehearsal.
- Source doc: `docs/features/rehearsal.md`.
- Reminder state: AppleScript list enumeration missed `Personal AI`, EventKit found it with 4 completed Doubao/notification items; no open or Rehearsal-related Reminder is incorporated.
- Worktree is broadly dirty from previous/user work; this run will keep edits scoped to Rehearsal files, verification scripts, docs, and this planning folder.
- Implementation slice: classify Rehearsal `activationCues` as anchored / weak-only / missing in the management page. Show weak-only Active items as warning-tone review targets in list scope, list cards, and detail readiness without changing backend activation semantics.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `shuf` missing | Random feature selection | Used a Node parser over `docs/features/index.md` with recent-doc filtering |
| AppleScript Reminders list scan missed `Personal AI` | Initial Reminder check | Confirmed via EventKit; all items completed and unrelated |
| E2E strict locator collision on `有锚定线索` | First E2E run | Tightened the detail-panel assertion to exact text because the same label also appears in the cue summary |
| E2E strict locator collision on repeated `0 条` | Second E2E run | Switched that check to receipt text regex scoped by row labels |
