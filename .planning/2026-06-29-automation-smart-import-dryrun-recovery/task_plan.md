# Smart Import Dry-Run Recovery Plan

Goal: improve the selected `智能资料录入` feature from `docs/features/index.md` by checking docs/code freshness, incorporating current external references, implementing a low-decision UX/code improvement, updating docs, and validating through the repo's preferred proof ladder.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory, `AGENT.md`, feature index, Reminder list state, and current worktree |
| 2 | completed | Inspect Memory Coverage Map smart-import docs, code, tests, and existing verifier paths |
| 3 | completed | Search current product/docs and papers for import dry-run, evidence review, and safe-write patterns |
| 4 | completed | Choose one bounded implementation slice and document the user-facing plan |
| 5 | completed | Implement the selected code/docs/test changes without touching unrelated dirty files |
| 6 | completed | Run targeted verification, first successful `npm start` compile, browser/E2E proof where practical, and scoped `git diff --check` |
| 7 | completed | Update automation memory and close out Reminder status if applicable |

## Decisions

- Selected feature: `智能资料录入` under Memory Coverage Map.
- Source doc: `docs/features/memory_coverage_map.md`.
- Reminder branch: local Reminders is readable, but no list named `Personal AI` is visible, so no Reminder item is available to incorporate or mark done.
- Worktree branch: existing dirty files are broad and unrelated; keep edits scoped to the selected feature, verification helpers, docs, planning, and automation memory.
- Current docs are broadly fresh: they already describe dry-run, high-risk confirmation, duplicate handling, zip precheck limits, external AI history truncation, and backup restore boundaries.
- Selected implementation slice: add a normal-document dry-run recovery receipt in the import drawer. It will explicitly state which entries can be committed now, what blocked/uninspected entries will not be written, and how to recover by fixing blocked files or splitting the archive. This is presentation-layer only; no import parsing, dedupe, commit, or backup restore behavior changes.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Root `task_plan.md` already exists from an older completed run | Planning setup | Use isolated `.planning/2026-06-29-automation-smart-import-dryrun-recovery/` files instead of overwriting root files |
| Repository status check included the external automation memory path | Closeout scope check | Reran repo status without the external path and updated the automation memory separately |
