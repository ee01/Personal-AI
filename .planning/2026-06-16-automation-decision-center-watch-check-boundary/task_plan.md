# Decision Center Watch Check Boundary Plan

Goal: improve the selected `决策中心` feature by checking that `docs/features/memory_system.md` matches current code, incorporating current product/research references, and implementing a focused UX boundary fix for the watch-lane `立即查证` path.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read repo rules, automation memory, `docs/progressing/to-verify.md`, feature index, planning context, and local Reminders list state |
| 2 | completed | Randomly select a non-fresh exact feature family from `docs/features/index.md` |
| 3 | completed | Inspect Decision Center docs, UI, API route, tests, and existing dirty worktree scope |
| 4 | completed | Search current product/docs and research references for human-in-the-loop approvals and automation-bias risks |
| 5 | completed | Implement the scoped watch-check boundary copy, receipt, docs, and verifier updates without reverting pre-existing changes |
| 6 | completed | Run targeted API/E2E/build validation and scoped whitespace checks |
| 7 | completed | Update automation memory, attempt archive if a real mechanism is available, and summarize outcome |

## Decisions

- Selected feature: `决策中心` / Confirm Requests in Memory Service.
- Source doc: `docs/features/memory_system.md`.
- Reminder result: local Reminders is readable, but there is no visible `Personal AI` list, so no Reminder item can be incorporated or marked done.
- Existing dirty worktree is broad and includes prior Decision Center changes. Keep edits scoped to Decision Center files, docs, and this planning directory.
- Implementation slice: clarify that `待观察` -> `立即查证` creates or reuses a read-only OpenClaw verification action only. It does not confirm evidence, resolve the observation, answer the decision, or send external messages; execution/config failures remain visible in Action Queue.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| No visible `Personal AI` Reminders list | Bounded AppleScript list scan | Record absence and skip Reminder completion |
| Broad dirty worktree | `git status --short` and target file diffs | Treat pre-existing changes as user/automation-owned; edit only the selected feature slice |
