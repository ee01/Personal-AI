# Coverage Map aggregate receipt plan

## Target

Randomly selected feature: `覆盖聚合 API` in `docs/features/memory_coverage_map.md`.

## Current evidence

- `docs/progressing/to-verify.md` has no carry-over items.
- Local Reminders is readable, but there is no `Personal AI` list, so no Reminder feedback is available to incorporate or mark done.
- Existing slice APIs already return `receipt` with read scope, summary and read-only boundary.
- `/coverage/map` returns the main aggregate snapshot but has no structured response-level receipt. The UI currently builds a local snapshot receipt, and scripts or future clients can still misread the map response as a sync/fix result.

## External scan

- Microsoft 365 Copilot connector docs separate connection state, indexed-content validation, ACL propagation and crawl refresh.
- Notion AI connector docs present connectors as external knowledge access with setup/connection boundaries, not as instant proof that every source is indexed.
- RAG operations literature treats retrieval pipelines as monitored data systems, including data drift and source freshness.
- Data-quality monitoring research highlights completeness, timeliness and observability as separate dimensions.

## Implementation plan

1. Add a response-level `receipt` to `MemoryCoverageMapResponse`.
2. Include generated time, stale window, aggregate source list, summary counts, active/derived platform count, warning/gap count, info-only planning count, latest timeline signal and a read-only boundary.
3. Keep platform, score, repair-action and priority-focus semantics unchanged.
4. Let the Coverage page prefer `coverage.receipt.boundary` in the snapshot receipt while keeping the current fallback for older service responses.
5. Update API tests and the focused Coverage E2E fixture/assertions.
6. Update `docs/features/memory_coverage_map.md` concisely.

## Validation

- Run focused memory-service coverage API tests.
- Run `npm start -- --progress` until the first successful compile, then stop it.
- Run `npm run verify:memory-coverage:e2e`.
- Run scoped `git diff --check`.
