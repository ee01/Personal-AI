# Memory Backup Archive Fingerprint Plan

## Target

- Feature: `记忆导入/导出/备份`
- Source docs: `docs/features/memory_system.md`, with Coverage Map recovery UI in `docs/features/memory_coverage_map.md`
- Runtime surfaces: `/api/v1/export`, `/api/v1/import`, Coverage Map backup download / restore drawer

## Plan

1. Confirm current backup/export behavior and existing docs are current.
2. Check local `Personal AI` Reminders and fold in any related open feedback.
3. Scan comparable products/research for backup, restore, data portability, and destructive import guidance.
4. Add a stable archive fingerprint to export, dry-run preview, commit result, and Coverage Map receipts.
5. Update focused verification scripts and docs.
6. Run targeted backup verification, dev build, Coverage Map E2E, and scoped whitespace checks.

## Scope Guard

- Do not change merge / replace semantics.
- Do not relax manifest validation, checksum validation, path allowlists, or cross-user confirmation.
- Do not add automatic restore or external sync.
