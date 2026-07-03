# Coverage Repair Info Boundary Plan

## Target

- Random feature: `覆盖聚合 API` / Memory Coverage Map.
- Source of truth: `docs/features/memory_coverage_map.md`.
- Main code: `memory-service/src/core/MemoryCoverageService.ts`, `src/modals/components/MemoryCoveragePage.vue`, `tools/verify-memory-coverage-e2e.mjs`.

## Context

- `docs/progressing/to-verify.md` is empty.
- Local Reminders are readable, but there is no `Personal AI` list, so no Reminder item is included.
- Recent automation runs covered Google Slides Analyzer and Reflection Threads; this run stays on Memory Coverage Map.
- External product/research signals point to the same UX rule: connector/search health pages should distinguish indexed/failed/permission errors from optional not-yet-enabled channels, and data quality scores should not imply more authority than they measure.

## Problem

The backend already keeps the important boundary:

- `summary.coverageGaps` counts only warning/critical repair actions.
- inactive optional skill channels can remain info planning actions.

The Coverage Map repair panel still uses the total repair action count in empty states and subtitles. If the only global actions are info planning items, selecting a healthy platform with no actions can still show language like "全局仍有覆盖缺口", even though the overview says there are 0 coverage gaps.

## Implementation Steps

1. Add computed warning/critical counts for selected and global repair actions in `MemoryCoveragePage.vue`.
2. Keep total action badges available, but make empty states and subtitles distinguish "真实覆盖缺口" from "可选规划项".
3. Update the Memory Coverage E2E fixture to include a no-gap info-only planning action and assert the selected healthy platform empty state says planning item instead of coverage gap.
4. Update `docs/features/memory_coverage_map.md` with the repair queue boundary.
5. Validate with the coverage API test, first successful `npm start` compile, Coverage Map E2E, and scoped `git diff --check`.
