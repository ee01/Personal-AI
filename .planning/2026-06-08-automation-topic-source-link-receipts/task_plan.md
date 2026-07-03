# Topic Source Link Receipt Improvement Plan

Goal: improve `Topic 来源链接安全展示` by keeping topic-source traceability safe, visible, and easy to understand without adding user-decision burden.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, feature index, carry-over file, Reminders state, and prior planning files |
| 2 | completed | Inspect Topic Messages doc, source-link code, and existing targeted/E2E verifiers |
| 3 | completed | Research comparable product behavior and URL safety/provenance references |
| 4 | completed | Implement visible source host and hidden-link receipt copy in Topic Detail |
| 5 | completed | Update docs and verification assertions |
| 6 | completed | Run targeted verify, first dev compile, E2E, and diff checks |
| 7 | completed | Update automation memory and summarize outcome |

## Decisions

- Selected feature: `Topic 来源链接安全展示` under Topic Messages.
- Source doc: `docs/features/topic_based_messages.md`.
- Local Reminders lists are visible, but no `Personal AI` list exists, so no reminder item can be incorporated or marked done.
- Worktree is already broadly dirty; keep this run scoped to Topic Messages source/doc/test files and this planning directory.
- Implementation slice: keep the click target safe, but add visible host/origin receipt text so users can judge where a source link will go before clicking.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Existing root `task_plan.md` is a stale Scheduled Messages plan | Planning restore | Created an isolated `.planning/2026-06-08-automation-topic-source-link-receipts/` plan instead of overwriting root files |
| No `Personal AI` Reminders list | AppleScript list scan | Record absence and skip Reminder completion |
| First Topic Messages E2E rerun failed on combined anchor text | `npm run verify:topic-based-messages:e2e` | Asserted source label and host chip separately because adjacent spans concatenate in `textContent` |
