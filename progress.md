# Scene Memory Autopilot Progress

## 2026-06-03

- Started implementation from the accepted Scene Memory Autopilot direction.
- Read `AGENT.md` and `docs/features/memory_system.md`.
- Confirmed existing docs have RecallEngine and reflection decision-flow diagrams.
- Created planning files for this multi-step refactor.
- Added `ContextRecallAutopilotDecision` to the `/context-recall` contract and wired it into normal, ambiguous, unusable-query, and low-information-meeting paths.
- Added Autopilot counts and quiet reasons for hidden matches, low-information candidates, source/self-echo exclusions, and duplicate source clusters.
- Updated client-side TypeScript contracts in extension and desktop clients; kept Lens UI entry model unchanged for this slice.
- Updated `docs/features/memory_system.md` with the Scene Memory Autopilot insertion diagram and `docs/features/memory_lens.md` to move the old client-side overlap audit from primary strategy to defensive fallback.
- Added `scene-memory-autopilot` eval suite with three synthetic cases and a local runner that executes `ContextRecallService` against an in-memory DB.
- Validation passed:
  - `npm --prefix memory-service test -- --run src/__tests__/api-context-recall.test.ts`
  - `npm --prefix memory-service run build`
  - `npm run eval:validate`
  - `npm run eval:run -- --suite scene-memory-autopilot --no-repair`
  - `git diff --check`
  - `node --check tools/eval-run.mjs`
- Latest eval report: `.eval-runs/20260603T030424Z-scene-memory-autopilot-mtgkg6/report.html`.
