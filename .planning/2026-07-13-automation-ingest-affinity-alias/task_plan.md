# Memory ingest affinity alias plan

## Goal

Improve the randomly selected `记忆摄入、去重、显著性评估` feature so ingest-side salience affinity honors entity aliases, not only canonical entity names.

## Plan

1. Confirm current docs, code, automation memory, and Reminder state.
2. Compare current ingest/salience behavior with external product and research signals.
3. Patch `SalienceScorer.computeEntityAffinityBoost()` to match active entity names and `aliases_json`.
4. Add focused tests for name match, alias match, and negative-affinity non-blocking.
5. Update concise feature docs and index wording.
6. Verify with focused memory-service tests, dev compile, and scoped whitespace checks.

## Status

- [x] Context and Reminder checks complete.
- [x] Target feature selected.
- [x] Research and implementation plan drafted.
- [x] Code and docs patched.
- [x] Verification complete.

## Verification

- `npm --prefix memory-service test -- --run src/__tests__/salience.test.ts src/__tests__/api-ingest.test.ts` passed: 2 files, 29 tests.
- `npm start -- --progress` compiled successfully, then the watch process was stopped.
- `npm --prefix memory-service run build` passed.
- `npm --prefix memory-service test -- --run src/__tests__/api-extractor.test.ts src/__tests__/recallAffinity.test.ts` passed: 2 files, 6 tests.
- Scoped `git diff --check` passed.
- Process check found no remaining webpack watch, vitest, `npm start`, or memory-service test process.

## Non-blocking Errors

- AppleScript Reminder probe returned syntax error `-2741`; EventKit fallback found `Personal AI` and confirmed there were no incomplete items.
- `git status` cannot include the automation memory file because it is outside the repository; repo-local status was rerun for touched paths only.
