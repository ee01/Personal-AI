# Scheduled Messages One-Click Init Improvement Plan

Goal: improve the selected `定时消息一键初始化` feature by checking that docs match current code, incorporating relevant outside references and local Reminder feedback when available, then implementing a focused low-decision UX/code improvement with verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory state, `AGENT.md`, feature index, existing planning files, and local Reminder list state |
| 2 | completed | Inspect Scheduled Messages docs, initialization code, UI flow, tests, and current dirty worktree scope |
| 3 | completed | Search current product/docs and paper references for scheduled-message initialization, queues, and recovery patterns |
| 4 | completed | Write the concrete improvement plan and decide the smallest no-extra-decision implementation slice |
| 5 | completed | Implement the selected code/docs/UX changes while preserving unrelated dirty files |
| 6 | completed | Run targeted verification and, if UI changes are touched, build/E2E the relevant extension surface |
| 7 | completed | Update Reminders if applicable, write automation memory, and summarize outcome |

## Decisions

- Selected feature: `定时消息一键初始化` in Scheduled Messages.
- Source doc: `docs/features/scheduled_messages_manager.md`.
- The local Reminders app does not expose a list named `Personal AI`; no Reminder feedback can be incorporated or marked done unless another data source appears during this run.
- Existing dirty worktree is broad and mostly unrelated. Keep edits scoped to Scheduled Messages plus planning/automation bookkeeping.
- The selected implementation slice is a one-time post-reload setup receipt banner, using existing notice UI and `chrome.storage.local`, not a new review page or modal.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Missing `$CODEX_HOME/automations/automation/memory.md` | Initial automation-memory read | Treat this as first automation-memory run and create/update the file before final response |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and do not mark any Reminder items done |
| `CODEX_HOME` unset expanded automation memory path to `/automations/...` | First memory directory create | Created memory at `/Users/Esone/.codex/automations/automation/memory.md`, the normal Codex home fallback |
