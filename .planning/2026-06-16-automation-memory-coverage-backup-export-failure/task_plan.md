# Memory Coverage Backup Export Failure Plan

Goal: improve Memory Coverage Map by making backup-export failures explicit and persistent, while keeping docs current and proving the behavior with the existing coverage E2E path.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, `docs/progressing/to-verify.md`, feature index, local Reminders list names, and existing planning context |
| 2 | completed | Randomly select Memory Coverage Map and inspect the current feature doc, UI, service aggregation, and E2E coverage |
| 3 | completed | Research comparable product and paper references for source coverage, connector status, memory controls, export, and portability |
| 4 | completed | Implement a persistent backup-export failure receipt in the Coverage Map UI |
| 5 | completed | Update the Memory Coverage Map doc with the new failure boundary |
| 6 | completed | Extend the Coverage Map E2E to prove failed export has no download and leaves a durable receipt before the successful path |
| 7 | completed | Run targeted tests, first webpack dev compile, E2E, and scoped diff checks |
| 8 | completed | Update automation memory, attempt archive, and summarize results |

## Plan

1. Add a `backupDownloadFailureReceipt` state to `MemoryCoveragePage.vue`.
2. Render a persistent `备份下载失败回执` near the existing backup download receipt, saying no backup file was saved and no restore/delete/sync/external write happened.
3. Clear the failure receipt only after a successful backup download, leaving success behavior unchanged.
4. Update `tools/verify-memory-coverage-e2e.mjs` to fail the first `/export` request, assert no download was reported, verify the failure receipt, then run the existing successful backup-download path.
5. Update `docs/features/memory_coverage_map.md` with concise current behavior.

## Decisions

- Selected feature: `记忆覆盖地图` / Memory Coverage Map from `docs/features/index.md`.
- Reminder state: local Reminders is readable, but no list named `Personal AI` is visible, so no item is incorporated or completed.
- Scope: UI/E2E/docs only; do not change backup/export backend semantics.
- Existing worktree is broadly dirty. Keep edits to `MemoryCoveragePage.vue`, `tools/verify-memory-coverage-e2e.mjs`, `docs/features/memory_coverage_map.md`, and this planning directory.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Initial feature sampling script used the wrong table column index | Random feature selection | Re-ran the sampler with the correct Markdown table indexes and selected Memory Coverage Map |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and stop the Reminder branch |
