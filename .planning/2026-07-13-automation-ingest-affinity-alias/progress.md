# Progress

- 2026-07-13T21:03:56+0800: Read `AGENT.md`, feature index, `to-verify`, automation memory, random-feature-loop memory guidance, and planning-with-files instructions.
- 2026-07-13T21:03:56+0800: Random sample produced several recent exact/family targets; selected `记忆摄入、去重、显著性评估` as a less recent viable feature.
- 2026-07-13T21:03:56+0800: Reminders checked via EventKit after AppleScript probe failed; `Personal AI` has 0 incomplete items.
- 2026-07-13T21:03:56+0800: Identified implementation gap: ingest affinity used entity names but not aliases.
- 2026-07-13T21:05:44+0800: Patched `SalienceScorer.computeEntityAffinityBoost()` to match active entity names and `aliases_json`, updated docs/index, and added tests for alias affinity plus negative-affinity non-blocking.
- 2026-07-13T21:05:44+0800: `npm --prefix memory-service test -- --run src/__tests__/salience.test.ts src/__tests__/api-ingest.test.ts` passed: 2 files, 29 tests.
- 2026-07-13T21:08:52+0800: `npm start -- --progress` compiled successfully in 15305 ms and was stopped after first success.
- 2026-07-13T21:08:52+0800: `npm --prefix memory-service run build` passed.
- 2026-07-13T21:08:52+0800: `npm --prefix memory-service test -- --run src/__tests__/api-extractor.test.ts src/__tests__/recallAffinity.test.ts` passed: 2 files, 6 tests.
- 2026-07-13T21:08:52+0800: Scoped `git diff --check` passed; process check found no remaining webpack watch, vitest, `npm start`, or memory-service test process.
