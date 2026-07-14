# Scheduled Messages CRUD Improvement Plan

Goal: improve the selected `定时消息创建/编辑/删除` feature by checking docs against current code, incorporating relevant Reminder and external research signals, then implementing one focused low-decision UX/code fix with targeted verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read repo rules, automation memory, feature index, and current planning context |
| 2 | completed | Inspect Scheduled Messages docs, CRUD UI/service code, and existing verifier coverage |
| 3 | completed | Check local `Personal AI` Reminders and current external product/research references |
| 4 | completed | Decide the smallest constructive improvement and document the implementation plan |
| 5 | completed | Implement scoped code/docs/test changes while preserving unrelated dirty worktree state |
| 6 | completed | Run targeted verifier, dev compile, E2E/browser-level check, and scoped diff hygiene |
| 7 | completed | Update Reminder state if applicable, update automation memory, and summarize outcome |

## Decisions

- Selected feature: `定时消息创建/编辑/删除`.
- Source doc: `docs/features/scheduled_messages_manager.md`.
- Index row: Messages 表驱动；行内编辑 / 删除按钮说明本地草稿、确认、写入和历史发送边界.
- Keep the run scoped to Scheduled Messages CRUD, not broader one-click setup, config sync, queue health, or App Script upgrade work.
- Reminder state: EventKit found `Personal AI` with 4 total items and 0 incomplete items; no Reminder item needs incorporation or completion.
- Implementation slice: clarify AI Report custom-output section CRUD inside the create/edit dialog as local form-draft operations. Add hover/reader labels plus an inline draft receipt after add/edit/delete, without changing Sheet writes or existing message CRUD semantics.
- Verification passed: `node --check tools/verify-scheduled-messages-crud-focus-e2e.mjs`; `npm start -- --progress` first successful compile in 15530 ms; `npm run verify:scheduled-messages-crud-focus:e2e`; scoped `git diff --check`; planning trailing-whitespace check; no leftover webpack/E2E processes.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
