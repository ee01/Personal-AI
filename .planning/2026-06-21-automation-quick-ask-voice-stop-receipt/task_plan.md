# Quick Ask Voice Stop Receipt Plan

Goal: improve `Quick Ask 语音输入` by checking current docs/code, incorporating current product and research references, then shipping a focused UX fix that clarifies voice stop and empty-transcript boundaries.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, feature index, local planning context, and Reminders list state |
| 2 | completed | Select a non-fresh exact feature target from `docs/features/index.md` and inspect Quick Ask voice docs/code/tests |
| 3 | completed | Search current product/docs and paper references for voice dictation, permissions, and correction/review patterns |
| 4 | completed | Implement the smallest no-decision UX fix: explicit stopped/empty voice receipts |
| 5 | completed | Update feature docs and index |
| 6 | completed | Run targeted Quick Ask E2E, desktop build, and scoped diff checks |
| 7 | in_progress | Update automation memory, report Reminder state, and archive the thread if the app tool is exposed |

## Decisions

- Selected feature: `Quick Ask 语音输入` under Doubao Bridge.
- Source doc: `docs/features/doubao_bridge.md`.
- Local Reminders was reachable, but no list named `Personal AI` exists, so no Reminder item can be incorporated or completed in this run.
- Existing worktree is broadly dirty. Keep edits scoped to `desktop-app/app/quick-ask.js`, `desktop-app/app/i18n.js`, `desktop-app/scripts/quick-ask-status-card-check.mjs`, `docs/features/doubao_bridge.md`, `docs/features/index.md`, and this planning directory.
- Product direction: voice input should make stop, review, cancel, submit, audio retention, and Ask/memory-write boundaries explicit in the same sheet.
- Implemented slice: stopped-with-draft and stopped-empty receipts reuse the existing voice sheet and do not change helper transport or `/ask` request payloads.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| No `Personal AI` Reminders list | AppleScript list scan | Record absence and skip Reminder completion |
