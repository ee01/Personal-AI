# Coverage Quality Route Receipt Plan

## Target

- Feature: `Coverage 质量分` in `docs/features/index.md`.
- Canonical doc: `docs/features/memory_coverage_map.md`.
- Main code: `memory-service/src/core/MemoryCoverageService.ts` and `src/modals/components/MemoryCoveragePage.vue`.

## User Problem

As a user opening Coverage Map, a low platform score is visible, but the product still makes me assemble the answer from several places: why this platform is the focus, why optional inactive channels are not treated as faults, and what clicking the suggested path will or will not do.

## Research Signals

- Microsoft 365 Copilot connectors expose indexed-content validation, metadata, ACLs, and connector error counts separately instead of collapsing everything into one health value.
- Notion Enterprise Search and AI connectors keep permission boundaries visible for connected sources.
- Data-quality research treats completeness, timeliness/freshness, consistency, relevance, and accuracy as separate dimensions; Coverage Map should keep `qualityScore` scoped to readable coverage health and not imply factual correctness.
- PIM research frames personal information as fragmented across sources/devices, so the UI should help users choose the next repair path without pretending all sources are already unified.

## Implementation Plan

1. Add structured priority-focus route metadata from Coverage API: candidate count, ignored info-only planning actions, selection basis, and no-side-effect boundary.
2. Render a visible `质量分修复路线` receipt beside the existing first-screen priority focus and in the selected platform score panel.
3. Keep the score formula unchanged; this is a presentation/contract improvement, not a ranking rewrite.
4. Update API unit expectations, extension E2E assertions, and the feature doc.
5. Verify with targeted Coverage API tests, `npm start` first compile, Coverage Map E2E, and scoped whitespace checks.
