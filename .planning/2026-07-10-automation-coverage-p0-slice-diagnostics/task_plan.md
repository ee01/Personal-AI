# Plan: Coverage P0 Slice Diagnostics

## Goal

Improve the `覆盖聚合 API` feature by making the existing P0 read-only diagnostic slices visible from the Coverage Map UI, without changing aggregation/write behavior.

## Selected Feature

- Feature: `覆盖聚合 API`
- Capability: `Memory Coverage Map`
- Source doc: `docs/features/memory_coverage_map.md`
- Main surfaces: `memory-service/src/routes/coverage.ts`, `memory-service/src/core/MemoryCoverageService.ts`, `src/modals/components/MemoryCoveragePage.vue`, `tools/verify-memory-coverage-e2e.mjs`

## Reminder State

- AppleScript listed Reminders lists but did not expose `Personal AI`.
- EventKit found `Personal AI` with 4 total items and 0 incomplete items.
- Completed items are Doubao / notification / test feedback; none match Coverage P0 diagnostics, coverage slices, connector coverage, or read-only API debugging.

## Phases

| Phase | Status | Notes |
|---|---|---|
| 1. Context and research | complete | Read AGENT, automation memory, feature index/doc, source, E2E, Reminders, and external product/paper references. |
| 2. Frontend/client implementation | complete | Added typed slice client calls and a UI panel showing P0 slice read receipts and no-write/no-sync boundaries. |
| 3. Tests and docs | complete | Updated Coverage E2E fixtures/assertions plus concise feature doc/index wording. |
| 4. Validation | complete | Targeted API test, npm start first compile, Coverage E2E, scoped diff check, and process check passed. |
| 5. Closeout | complete | Updated automation memory and will report Reminder outcome. |

## Validation Targets

- `npm --prefix memory-service test -- --run src/__tests__/api-coverage.test.ts`
- `npm start -- --progress` until first successful compile, then stop
- `npm run verify:memory-coverage:e2e`
- `git diff --check -- <touched files>`

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| Planning skill path under `.codex/skills` missing | Read `/Users/Esone/.codex/skills/planning-with-files/SKILL.md` | Re-read from the installed skill path `/Users/Esone/.agents/skills/planning-with-files/SKILL.md`. |
| Coverage E2E strict-mode violation | Asserted repeated no-write/no-sync phrase in the full diagnostics panel | Narrowed the assertion with `.first()` because the boundary intentionally appears in the panel summary and each slice card. |
| Coverage E2E strict-mode violation | Asserted shared phrase `3 总量` | Switched slice-card count assertions to exact full primary summaries. |
