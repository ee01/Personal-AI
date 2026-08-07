# Outreach Detail Operation Scope Plan

Goal: improve the randomly selected `主动询问` feature by making the Outreach detail page clearer before write-bearing actions, while keeping docs aligned with current code and verifying the user-visible behavior.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, feature index, `to-verify`, automation memory, root planning files, and current worktree state |
| 2 | completed | Confirm Reminders state and target feature selection |
| 3 | completed | Inspect Outreach docs, detail/list UI, routes, engine entry points, and existing E2E verifier |
| 4 | completed | Search current product/research references for proactive messaging, workflows, and HITL controls |
| 5 | completed | Implement the selected UX/code/doc slice |
| 6 | completed | Run targeted Outreach E2E, dev build, whitespace checks, and watcher cleanup |
| 7 | in_progress | Update automation memory and close out archive/reminder status |

## Decisions

- Random target: `主动询问` under Memory Service, source doc `docs/memory_system.md`.
- No `docs/progressing/to-verify.md` carry-over item exists.
- Local Reminders is reachable, but list names do not include `Personal AI`; no Reminder feedback can be included or marked done.
- Existing worktree has many unrelated modified/untracked files. Keep this run scoped to Outreach detail UI, docs, E2E, and this planning directory.
- Implementation slice: add a first-screen `本次操作范围` receipt to `OutreachSessionDetail.vue`, keyed by session status and available actions. It will clarify approval/send, retry, cancel, edit, wait/check, and message-reaction source boundaries without changing backend state machines.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Broad `rg` output for Outreach was too large | Initial source scan | Switched to targeted file reads for routes, detail/list components, and verifier |
| Root `task_plan.md` exists from an older Scheduled Messages run | Planning skill restore step | Treated it as completed prior context; created this isolated planning directory instead of mutating the old root plan |
