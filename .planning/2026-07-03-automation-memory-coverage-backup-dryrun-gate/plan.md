# Memory Coverage Backup Dry-run Gate

## Target

- Feature: `备份下载与恢复入口`
- Source doc: `docs/features/memory_coverage_map.md`
- Main UI: `src/modals/components/MemoryCoveragePage.vue`
- Verification: `tools/verify-memory-coverage-e2e.mjs`, `tools/verify-memory-backup.ts`

## Plan

1. Keep the backup/export and restore API semantics unchanged.
2. Add a visible `备份恢复预览门禁` after a backup zip is recognized and before restore dry-run preview exists.
3. Make the gate state explicit: current file, selected merge/replace mode, next click only runs dry-run, and no write/delete/sync/external-send happens before preview confirmation.
4. Extend Coverage Map E2E to prove the gate appears before preview, disappears after dry-run, and returns when replace mode resets preview.
5. Update the canonical feature doc and run targeted backup, dev build, E2E, and scoped diff checks.

## External Context

- Google Takeout and ChatGPT export both keep archive generation/download separate from later use or import.
- OECD data-portability guidance highlights user empowerment but also privacy/security risk from data transfer.
- IETF PDPA draft treats import/export, backup/restore, and transfer as related but distinct states, which supports an explicit preview gate before restore mutation.
