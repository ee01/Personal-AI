# Rehearsal Stale Weak Prompt Progress

## 2026-06-15

- Read `AGENT.md`, `docs/features/index.md`, `docs/progressing/to-verify.md`, automation memory, memory registry hints, planning skill guidance, and the Rehearsal feature loop memory skill.
- Checked local Reminders with AppleScript; no visible `Personal AI` list exists, so no Reminder feedback can be incorporated or marked done.
- Randomly selected `场景预演边界` / Rehearsal after filtering recent automation feature families.
- Inspected `docs/features/rehearsal.md`, `memory-service/src/core/RehearsalActivationService.ts`, `memory-service/src/core/RehearsalService.ts`, `memory-service/src/__tests__/api-rehearsals.test.ts`, and `tools/verify-rehearsals-page-e2e.mjs`.
- Reviewed current references for Apple Reminders multi-cue behavior, context-aware reminder authoring, and prospective memory implementation intentions.
- Chosen implementation slice: cap stale Rehearsal matches to weak prompt priority and expose the stale boundary in match reasons.
- Implemented the stale weak-prompt boundary in `memory-service/src/core/RehearsalActivationService.ts`.
- Added an API regression in `memory-service/src/__tests__/api-rehearsals.test.ts` proving a high-score stale Rehearsal still returns `displayPriority='p2'` and records a p2 activation.
- Updated `docs/features/rehearsal.md` to document that stale matches are recoverable weak prompts, not strong p1 interruptions.
- Validation started: `npm --prefix memory-service test -- --run src/__tests__/api-rehearsals.test.ts` passed with 8 tests. First `npm --prefix memory-service run build` failed on display priority type inference, then the code was patched with an explicit `ContextRecallDisplayPriority` annotation.
- Validation completed:
  - `npm --prefix memory-service run build`
  - `npm --prefix memory-service test -- --run src/__tests__/api-context-recall.test.ts src/__tests__/api-composer-assist.test.ts src/__tests__/api-day-pilot.test.ts` passed with 58 tests.
  - `npm start` reached the first successful webpack dev compile, then the watch process was stopped.
  - `node tools/verify-rehearsals-page-e2e.mjs`
  - `git diff --check` scoped to the Rehearsal code/test/doc and this planning directory.
  - Re-ran `npm --prefix memory-service test -- --run src/__tests__/api-rehearsals.test.ts` after the type annotation; 8 tests passed.
- Updated automation memory and archived the current Codex session with `codex archive 019ecaba-f11a-7bf2-8d4b-b311ec5a4114`.
