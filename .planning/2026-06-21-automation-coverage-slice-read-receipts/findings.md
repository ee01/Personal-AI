# Findings: Coverage slice read receipts

## Repo Findings

- `GET /api/v1/coverage/map` already returns `generatedAt`, `staleAfterDays`, `summary`, `platforms`, `repairActions`, `priorityFocus`, and `timeline`.
- P0 slice endpoints currently return only `items` or the pressure counters:
  - `/coverage/messages-by-source`
  - `/coverage/provider-jobs/recent`
  - `/coverage/pressure`
  - `/coverage/skills-sync`
- Existing `api-coverage.test.ts` checks the slice data but not generation metadata or read-only boundaries.
- The Coverage Map UI uses the map endpoint only, so this improvement should be backend/test/doc scoped.

## Product / Research Findings

- Microsoft 365 Copilot connector docs expose index browser details including status, last refresh, item properties, and ACLs, and call out partial indexing and permission propagation.
- Microsoft connector management docs distinguish temporary/permanent crawl failures, admin notifications, and on-demand crawl behavior.
- Notion Enterprise Search security docs emphasize query-time permissions, connector sync progress, failed sync retries, and audit trails.
- PIM research frames personal information as fragmented across many tools/forms, which supports explicit per-source coverage diagnostics.
- Data quality research commonly separates completeness, timeliness, accuracy, consistency/relevance/reliability; Coverage Map should continue saying it measures readable coverage/freshness, not factual correctness.

## Selected Improvement

Add a lightweight `receipt` object to every P0 slice response so direct API users do not mistake the slice for a write, sync, repair, or full content-quality audit.
