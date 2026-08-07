# Findings

## Repo State

- `docs/progressing/to-verify.md` says `暂无`, so there is no carry-over item.
- Latest automation memory covered Memory Service multi-user write guard, Topic defer restore, Memory Capture selected-text snapshot, Prompt Config injection draft, Agent Workflow delete receipt, User Profile influence undo, Memory Lens page recall, Action Queue labels, Task Scheduler labels, Notification feed digest, backup fingerprint, and Jira Import chaining; this run avoids those exact targets.
- Worktree was already heavily dirty before this run.
- AppleScript did not list `Personal AI`, but EventKit found it with 4 total items and 0 incomplete items; no Reminder item applies to Coverage quality score.

## Selected Feature

- Selected `Coverage 质量分` from `docs/index.md`.
- Source doc already says quality score covers platform state, freshness, healthy contributions, failure/pressure penalties, and boundaries.
- Backend `MemoryCoverageService` computes `qualityScoreBreakdown` from state base, healthy contribution bonus, freshness bonus, and failing penalty. No backend issue found for this slice.
- UI already has a score breakdown, score boundary receipt, route receipt, low-score sort receipt, and stale snapshot receipt.
- UX gap: inside the selected platform score panel, the score explanation does not restate the score's current `generatedAt` snapshot basis or the fact that selecting/sorting/viewing does not recalculate the score. Users can see the global snapshot receipt, but the local score panel still reads like a live score.

## External Scan

- Microsoft 365 Copilot connector docs expose item index status, last refresh time, properties, ACLs, and error tabs so users can validate whether indexed connector content is complete and accessible.
- Microsoft connector error monitoring separates error codes, counts, downloadable logs, and concrete remediation, supporting explicit failure provenance instead of a bare score.
- dbt source freshness presents freshness as the state of the most recent snapshot and ties it to user-defined SLAs, reinforcing that freshness/quality views need a visible snapshot basis.
- Dashboard provenance research argues dashboards should expose metadata about data sources, agents, activities, and update history so users can evaluate reliability, quality, and consistency.
- Recent data-quality survey work reinforces that quality dimensions such as accuracy, completeness, consistency, and timeliness map imperfectly to implementation checks; Coverage quality score should keep saying what it does and does not measure.

## Implementation Direction

- Add `质量分快照口径` receipt inside the score breakdown panel.
- Show score source snapshot time, freshness window / recent signal ratio, and recalculation boundary.
- Keep it presentation-only and use existing `coverage.generatedAt`, `coverage.staleAfterDays`, `selectedPlatform.lastSeenAt`, and `qualityScoreBreakdown.recentRatio`.
