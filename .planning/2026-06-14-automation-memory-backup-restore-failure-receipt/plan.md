# Memory Backup Restore Failure Receipt Plan

## Selected feature

- Random feature index pick: `记忆导入/导出/备份`
- Source doc: `docs/features/memory_system.md`
- User-facing surface: Memory Coverage Map import drawer backup-zip restore path

## Context

- `docs/progressing/to-verify.md` has no carry-over item.
- Local Reminders was readable, but there is no list named `Personal AI`; no Reminder item is included in this pass.
- Recent automation memory covered Remind, Rehearsal, Jira Automation Import, and Task Scheduler, so this pass stays on Memory Service backup/restore.

## External reference signal

- Apple restore flows ask the user to choose a backup by date and size before restore, reinforcing that backup identity and freshness should stay visible.
- Google Takeout frames export as a user-controlled archive download, reinforcing that download/restore are separate user actions.
- GDPR data-portability guidance emphasizes reuse and transfer under user control, which maps to explicit restore scope, confirmation, and failure boundaries.

## Gap

Backup restore already has dry-run, replace confirmation, cross-user confirmation, manifest checks, impact paths, and success receipts. The remaining hidden state is failure after the preview: a failed dry-run or failed write currently appears as a generic error string. For a destructive-capable restore path, the UI should explicitly say whether anything was written.

## Implementation plan

1. Add a structured backup restore failure receipt to `MemoryCoveragePage.vue`.
2. Distinguish `dry_run` failure from write failure.
3. Preserve preview context when a write fails after dry-run.
4. State that current Memory Service data remains authoritative and that retry will not silently change merge/replace, delete files, sync external platforms, or send content.
5. Extend `tools/verify-memory-coverage-e2e.mjs` to fail one restore write, assert the failure receipt, then retry successfully.
6. Update `docs/features/memory_system.md` with the failure boundary.

## Validation

- `npm run verify:memory-backup`
- `npm start` first successful compile, then stop watch mode
- `npm run verify:memory-coverage:e2e`
- Scoped `git diff --check`
