# Coverage Quality Score Snapshot Plan

Started: 2026-07-09T20:04:50+0800

## Goal

Improve the Memory Coverage Map `Coverage 质量分` UX so the platform score panel clearly shows the score's snapshot basis and recalculation boundary, without changing scoring semantics or backend writes.

## Scope

- Target feature: `Coverage 质量分` in `docs/features/memory_coverage_map.md`.
- Main UI: `src/modals/components/MemoryCoveragePage.vue`.
- Existing browser proof: `tools/verify-memory-coverage-e2e.mjs`.
- Docs/index: concise docs update only.

## Plan

1. [complete] Read repo workflow, automation memory, feature index, Reminders state, docs, source, and verifier.
2. [complete] Do a small product/paper scan for connector status, data freshness, data quality, and dashboard provenance.
3. [complete] Add a platform score snapshot-basis receipt to the selected platform score panel.
4. [complete] Update the Coverage Map feature doc and index row concisely.
5. [complete] Extend the existing Coverage E2E to assert the new score snapshot receipt.
6. [complete] Run targeted checks, first successful `npm start` compile, Coverage E2E, scoped diff checks, and update automation memory.

## Constraints

- Presentation-only: do not change `qualityScore` calculation, platform grouping, priority selection, import/export behavior, provider sync, or Memory Service writes.
- Worktree is broadly dirty from prior runs; treat this run as owning only the planning directory, active-plan pointer, Coverage quality score UI/E2E/docs/index slice, and automation memory closeout.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| Coverage E2E strict locator matched the old score reason and the new snapshot receipt for `近 7 天信号占比 25%` | First E2E run | Tightened the old score-factor assertion to exact `近 7 天信号占比 25%：+2 分` and reran E2E |
