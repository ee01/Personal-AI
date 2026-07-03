# Coverage Quality Score Boundary Plan

Goal: improve the selected `Coverage 质量分` feature by making the score explanation honest about what it measures, what it does not prove, and what actions remain user-controlled.

## Plan

1. Complete carry-over, automation-memory, Reminder, feature-index, code, doc, and external research checks.
2. Keep the backend score formula unchanged because it already exposes `qualityScoreBreakdown` and repair hints.
3. Add a visible score-boundary receipt in `MemoryCoveragePage.vue` detail view.
4. Update `docs/features/memory_coverage_map.md` with the current score-boundary behavior.
5. Extend `tools/verify-memory-coverage-e2e.mjs` to assert the new receipt.
6. Run targeted Coverage tests, first successful `npm start` compile, Coverage E2E, and `git diff --check`.

## Current Findings

- `docs/progressing/to-verify.md` says `暂无。`.
- Reminders is readable, but there is no `Personal AI` list; no Reminder item applies or can be marked done.
- `qualityScoreForPlatform()` already computes state baseline, healthy contribution bonus, freshness bonus, failing penalty, reasons, and low-score repair hints.
- The UX gap is that the detail panel explains score math but not score authority: it should say the score is coverage/freshness/failure telemetry, not a content-accuracy, completeness, personalization, or permission guarantee.
- External references support explicit indexing, permission, queue/error, freshness, and privacy boundaries instead of a single overtrusted health number.

## Validation Target

- `npm --prefix memory-service test -- --run src/__tests__/api-coverage.test.ts`
- `npm start` until the first successful compile, then stop the watcher
- `npm run verify:memory-coverage:e2e`
- `git diff --check`

## Result

- Implemented `质量分边界` in the Coverage detail score explanation.
- Updated the Coverage E2E verifier to assert score authority boundaries.
- Updated `docs/features/memory_coverage_map.md`.
- Validation passed:
  - `npm --prefix memory-service test -- --run src/__tests__/api-coverage.test.ts`
  - `npm start` first successful webpack compile, then stopped the watcher
  - `npm run verify:memory-coverage:e2e`
  - `npm --prefix memory-service run build`
  - `git diff --check`
- `pgrep -fl 'webpack --watch|npm start'` returned no running watcher.
- Reminder state: Reminders was readable, but no `Personal AI` list existed, so nothing was incorporated or marked done.
