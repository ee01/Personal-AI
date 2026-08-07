# Coverage Slice Receipt Summary Plan

## Target

- Feature: `覆盖聚合 API` in `docs/index.md`
- Scope: Memory Coverage Map P0 aggregate slice endpoints under `/api/v1/coverage/*`
- Reminder state: local Reminders list `Personal AI` is absent on this Mac, so no Reminder item is linked or completed.

## Research Signals

- Microsoft 365 Copilot connector docs expose indexed content validation, connection errors, crawl timing, and permission/ACL caveats separately.
- Notion and Slack enterprise search describe cross-app search as permission-bound, so connector health should not be presented as content authority.
- PIM and data-quality research frame coverage as fragmented sources plus multidimensional quality; LongMemEval separates memory indexing/retrieval/reading.

## UX Gap

The P0 slice endpoints already state that they are read-only diagnostics, but the receipt does not summarize the slice payload itself. A user or verifier still has to inspect `items` or endpoint-specific fields to know whether the slice was empty, how many rows were sampled, which freshness window applies, or whether failures/items were present.

## Implementation Steps

1. Extend `MemoryCoverageSliceReceipt` with a structured summary: item count, total/recent/failure/enabled counts where relevant, latest observed timestamp, diagnostic window, and an empty-state interpretation.
2. Populate that summary in each slice route without changing the underlying SQL aggregation.
3. Tighten `api-coverage.test.ts` to assert the summary contract for message, provider job, pressure, and skills sync slices.
4. Update `docs/features/memory_coverage_map.md` with the new API receipt behavior.
5. Verify with memory-service targeted tests, dev extension compile, Coverage E2E, and scoped `git diff --check`.
