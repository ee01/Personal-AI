# Plan: Coverage slice read receipts

## Goal

Improve `覆盖聚合 API` so direct P0 slice consumers can tell what was read, when it was generated, and what the read does not do.

## Target

- Feature: `覆盖聚合 API`
- Docs: `docs/features/memory_coverage_map.md`, `docs/index.md`
- Backend: `memory-service/src/routes/coverage.ts`, `memory-service/src/core/MemoryCoverageService.ts`
- Tests: `memory-service/src/__tests__/api-coverage.test.ts`

## Steps

1. [complete] Read repo guidance, automation memory, feature index, and Reminder state.
2. [complete] Select target feature and inspect docs/code/tests.
3. [complete] Run external product/research scan.
4. [complete] Add read-only slice receipt metadata to P0 coverage slice endpoints.
5. [complete] Update feature docs/index with the new contract.
6. [in_progress] Run targeted unit tests, memory-service build, extension compile, Coverage Map E2E, and diff checks.

## Design Notes

- Keep the main UI contract unchanged; the gap is direct API diagnostics.
- Each slice response should carry generated time, stale window, slice name, source, and a boundary note.
- Do not add writes, settings changes, or new connectors.

## Reminder State

Local Reminders is reachable, but list names do not include `Personal AI`; no Reminder item can be inspected or marked done in this run.

## External Direction

- Microsoft connector tooling surfaces index status, ACLs, partial indexing, crawl failures, and crawl controls.
- Notion Enterprise Search emphasizes permission checks, connector sync state, deletion timelines, failed sync retry, and progress monitoring.
- PIM/data quality research supports making fragmentation, freshness, completeness, and quality limits explicit.
