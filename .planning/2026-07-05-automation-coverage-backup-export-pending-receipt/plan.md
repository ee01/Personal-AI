# Coverage Backup Export Pending Receipt

## Target

- Feature: `备份下载与恢复入口`
- Source doc: `docs/features/memory_coverage_map.md`
- Main UI: `src/modals/components/MemoryCoveragePage.vue`
- E2E: `tools/verify-memory-coverage-e2e.mjs`

## Context

- `docs/progressing/to-verify.md` has no carry-over item.
- Recent automation memory covered Task Scheduler, Decision Center, Topic mute, Message Reaction Snooze, Jira Import, Relationship Radar, AR Data, Doubao, Skill Foundry, Compose Assist, Project Dashboard, Meeting Pilot, Message Analysis, User Profile, Outreach, Coverage low-score sort, Reflection, Action Queue, Evidence Watch, Native Join, Ask, Agent Workflow, Notification, Today, Rehearsal, Scheduled Messages, Memory Capture, and Memory Lens. This pass should avoid those exact fresh surfaces.
- AppleScript did not expose `Personal AI`, but Swift/EventKit found the Reminder list with 4 total items and 0 incomplete items. No Reminder item is related or markable.
- External scan signals:
  - Google Takeout separates archive request/download from deletion or later transfer.
  - ChatGPT exported conversation transfer is explicitly not a full account migration or sidebar restore.
  - PDPA/IETF frames archive formats as covering import/export, backup/restore, and transfer but still requiring explicit archive semantics.
  - OECD data-portability research highlights security, privacy, responsibility, and poor-data-quality risks when transferred personal data is unclear.

## Plan

1. Add a visible `备份下载提交中回执` while `POST /export` is pending.
2. Keep existing export success/failure behavior unchanged.
3. Make the pending receipt distinguish a current unconfirmed request from any previous success/failure receipt.
4. Update Coverage Map E2E to assert pending, success, and pending-after-success states.
5. Update `docs/features/memory_coverage_map.md` and `docs/index.md` concisely.
6. Verify with focused backup, Coverage E2E, first `npm start` compile, and scoped whitespace checks.
