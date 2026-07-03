# Coverage Quality Focus Receipt Plan

## Target

- Random feature: `Coverage 质量分` in `docs/features/memory_coverage_map.md`.
- Scope: keep the existing quality score model, and improve the first-screen handoff from low score to evidence and next action.

## Context Checked

- `AGENT.md`
- `docs/progressing/to-verify.md` (`暂无。`)
- automation memory for recent feature-family rerolls
- `docs/features/index.md`
- local Reminders list names; `Personal AI` list is absent on this machine
- `docs/features/memory_coverage_map.md`
- `src/modals/components/MemoryCoveragePage.vue`
- `memory-service/src/core/MemoryCoverageService.ts`
- `tools/verify-memory-coverage-e2e.mjs`

## External Scan

- Microsoft 365 Copilot connector docs separate connection state, last sync freshness, crawl failure, and indexed-item validation.
- Notion Enterprise Search connector docs emphasize permission sync, query-time filtering, retry/progress monitoring, and audit trails.
- Data quality literature separates completeness, timeliness, accuracy, consistency, relevance, and reliability; Coverage Map should not imply one score proves all of them.
- PIM research frames fragmentation across apps/devices as the problem Coverage Map is meant to make visible.

## Improvement Plan

1. Add a compact `质量分焦点回执` inside the top quality focus banner.
2. Include whether the focus came from service-side `priorityFocus` or the local low-score fallback.
3. Show the evidence source used for the focus so the user can inspect the right contribution without opening every card.
4. State that `查看平台` only selects the current snapshot and repair queue; it does not rerun sync, change settings, write memories, mark messages read, or send externally.
5. Update the Coverage E2E to assert the receipt.
6. Update the feature doc with this first-screen handoff behavior.
7. Verify with targeted tests, dev compile, E2E, and scoped whitespace checks.
