# Scene Memory Autopilot Implementation Plan

Goal: implement the first production slice of Scene Memory Autopilot so Memory Lens and related context-recall consumers get better scene-aware filtering, duplicate suppression, quiet reasons, documentation, and eval coverage.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Inspect existing memory-system docs, ContextRecallService, Lens UI, and eval harness |
| 2 | completed | Define insertion point and visual flow based on current docs |
| 3 | completed | Implement backend scene filtering/quiet-reason layer for `/context-recall` |
| 4 | completed | Surface useful diagnostics in the `/context-recall` contract while reusing existing Lens UI |
| 5 | completed | Add eval suite proving weak-anchor and duplicate noise are reduced |
| 6 | completed | Update `docs/features/` with concise key behavior and logic |
| 7 | completed | Run targeted tests/builds and record evidence |

## Decisions

- First implementation slice targets `/context-recall`, because Memory Lens and Compose Assist already consume it and the user specifically called out Lens noise.
- The feature should not create a new review queue or standalone dashboard.
- UI should reuse current Lens entry points; any UI changes should improve explanation of why a card appears or stays quiet.
- Keep high-responsibility user confirmation only for outbound/destructive/privacy/profile boundaries.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Empty meeting shell eval expected `quietedCount >= 1`, but the service correctly early-returned before fetching candidates | First `scene-memory-autopilot` run failed one synthetic case | Kept `mode=silent` and `low_information_meeting_context` as required assertions; removed candidate quieted-count expectation for no-candidate early rejection |
