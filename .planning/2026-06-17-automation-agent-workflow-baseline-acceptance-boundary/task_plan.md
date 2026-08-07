# Agent Workflow Baseline Acceptance Boundary Plan

Goal: improve the randomly selected `Agent Workflow 多 Agent 编排` feature by confirming docs/code currency, checking external references and local Reminders, then implementing a scoped UX boundary for accepting batch-regression results as local baselines.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, memory hints, `docs/progressing/to-verify.md`, current worktree status, Reminders list names, and `docs/index.md` |
| 2 | completed | Randomly select a non-recent feature and inspect its feature doc, source, and verification scripts |
| 3 | completed | Search current product/paper references for agent workflow tracing, evals, persistence, and structural coverage |
| 4 | completed | Implement a focused UX/doc/test improvement for the selected feature |
| 5 | completed | Run targeted verification, dev compile, E2E, and scoped whitespace checks |
| 6 | completed | Update automation memory, attempt archive, and summarize outcome |

## Decisions

- Selected feature: `Agent Workflow 多 Agent 编排`.
- Source doc: `docs/features/message_analysis.md`.
- Implementation slice: add a visible pre-click boundary near the batch-regression `接受结果为基线` action, clarifying that only changed/no-baseline saved scenarios will have local baselines updated; failed items are not overwritten; no Memory Service write, notification, rule automation, export, or raw message body copy happens.
- Reminders: the Reminders app is readable, but no visible list named `Personal AI` exists, so no Reminder item can be incorporated or marked complete.
- Worktree: very broad pre-existing dirty state. Keep edits scoped to Agent Workflow files and this planning directory.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record list absence and skip Reminder item-level work |
| Existing root planning files are stale | Initial planning restore | Use a fresh dated `.planning` directory for this run |
