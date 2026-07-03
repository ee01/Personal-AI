# Memory Coverage Backup/Restore Receipt Plan

Run: 2026-06-10T20:02:26+08:00

## Goal

Improve `备份下载与恢复入口` in Memory Coverage Map so backup export and restore paths provide persistent, source/boundary-aware receipts instead of relying on transient toasts or raw preview details.

## Plan

- [x] Read automation memory, AGENT.md, feature index, target doc, reminder state, and current code/tests.
- [x] Research comparable export/import/portability flows and user-facing risks.
- [x] Add a visible backup download receipt after `记忆备份` succeeds.
- [x] Add a visible post-restore next-step/boundary receipt after backup restore succeeds.
- [x] Extend the Memory Coverage E2E fixture for backup download and restore receipt assertions.
- [x] Update `docs/features/memory_coverage_map.md`.
- [x] Run focused verification, first successful `npm start` compile, and `git diff --check`.

## Selected Feature

- Feature: `备份下载与恢复入口`
- Capability: Memory Coverage Map
- Doc: `docs/features/memory_coverage_map.md`

## Reminder State

Local Reminders was reachable, but there is no `Personal AI` list on this machine. No Reminder item can be incorporated or marked done in this run.
