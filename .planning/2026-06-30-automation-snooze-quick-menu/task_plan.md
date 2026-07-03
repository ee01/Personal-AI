# Snooze Quick Menu Improvement Plan

Goal: improve the `Snooze 快速时间菜单` feature by checking code and docs, scanning comparable product/research patterns, incorporating local Reminder feedback when available, implementing one focused low-decision UX/code fix, and verifying it through the repo harness.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, memory guidance, `to-verify.md`, feature index, Reminders list state, and current dirty worktree state |
| 2 | completed | Inspect Message Reaction docs, Snooze quick-menu code, tests, and existing E2E/verify scripts |
| 3 | completed | Search current product and paper references for snooze/reminder scheduling UX and interruption management |
| 4 | completed | Write the concrete improvement plan and choose the smallest no-extra-decision implementation slice |
| 5 | completed | Implement scoped code/docs/test changes while preserving unrelated dirty files |
| 6 | completed | Run targeted verification, first successful `npm start` compile, relevant E2E/browser proof, and scoped diff checks |
| 7 | completed | Update automation memory and summarize Reminder closeout state |

## Decisions

- Selected feature: `Snooze 快速时间菜单` from `docs/features/index.md`.
- Source doc: `docs/features/message_reaction.md`.
- Reminder state: local Reminders lists are readable, but no list named `Personal AI` exists, so there are no Reminder items to incorporate or mark done.
- Worktree state: broad unrelated dirty changes already exist. Keep this run scoped to Snooze quick-menu files plus this planning directory and automation memory.
- Implementation slice: localize the existing Snooze marker label shown in the quick-menu reschedule receipt for English UI, matching the already-localized Glip marker badge contract.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Missing `$CODEX_HOME/automations/automation/memory.md` | Initial automation-memory read | Treat as no existing automation memory and create/update the normal fallback path before final response |
| No `Personal AI` Reminders list | Bounded AppleScript list scan | Record absence and stop Reminder branch |
| `verify:message-reaction` failed on no-time `稍后处理` marker label | First targeted test run | Changed label formatting to detect the Snooze prefix before stripping, so no-time legacy labels become `Remind` in English UI |
