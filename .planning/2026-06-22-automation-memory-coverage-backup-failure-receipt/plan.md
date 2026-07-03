# Memory Coverage Backup Failure Receipt Plan

## Target

- Random feature: `记忆覆盖地图` in `docs/features/memory_coverage_map.md`.
- Scope: Coverage Map backup download receipt path.
- Reminder state: local Reminders is reachable, but there is no `Personal AI` list.

## User-Facing Gap

If a backup download succeeds and the next backup attempt fails, the old success receipt can remain visible beside the new failure state. As a user, that makes the operation boundary ambiguous: the old saved zip can be mistaken for proof that the current click also saved a fresh backup.

## Plan

1. Clear the previous `备份下载回执` whenever the latest backup export fails.
2. Extend the Memory Coverage E2E to cover failure before success and failure after success.
3. Update the feature doc with the concise current behavior.
4. Verify with the Coverage API tests, dev webpack compile, Coverage E2E, and scoped diff checks.

## External Reference Direction

- Microsoft 365 Copilot connector details and errors separate cumulative indexed/failed counts from current crawl failure state.
- Notion Enterprise Search connector docs emphasize permission/sync boundaries for connected sources.
- Data portability and PIM research supports making export/import status visible and avoiding stale or ambiguous control signals.
