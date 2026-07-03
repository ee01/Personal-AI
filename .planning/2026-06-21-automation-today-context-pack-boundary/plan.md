# Today Pilot Context Pack Improvement Plan

Goal: improve the randomly selected `Context Pack` feature by checking docs and code freshness, researching comparable product/research patterns, making one scoped UX/code improvement, updating docs, and verifying the user-visible contract.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | complete | Read repo instructions, automation memory, feature index, Reminders list state, and create this isolated plan |
| 2 | complete | Inspect Today Pilot docs, Context Pack source paths, existing tests, and current dirty worktree overlap |
| 3 | complete | Search current product and paper references for shareable/copied AI context packages |
| 4 | complete | Write the concrete implementation plan before code edits |
| 5 | complete | Implement the selected code/docs/UX change without touching unrelated dirty files |
| 6 | complete | Run targeted verification, first successful `npm start` compile, relevant E2E, and scoped diff checks |
| 7 | pending | Update automation memory, handle Reminder completion if applicable, and archive the Codex thread if a tool is available |

## Decisions

- Selected feature: `Context Pack` under Today Pilot.
- Source doc: `docs/features/today_pilot.md`.
- Reminder check: local Reminders lists do not include `Personal AI`; no Reminder item can be incorporated or marked done in this run.
- Recent automation targets avoided where practical: Quick Ask voice, multi-user identity, Scheduled Config sync, Jira timestamp basis, Reflection local research, Project Dashboard burndown, Message Analysis scope, notification snooze, Relationship Radar route, Topic mute, Agent Workflow concern test, recall channel, Watch, Agent Thinking approval, Memory Lens hover, Mobile Context, Native Join browser fallback, and search feedback.
- Implementation slice: add a pre-action `上下文包范围` receipt to Today Pilot home cards before provider/sensitive controls. It should say provider/toggle changes only local render/copy settings, pack generation uses current mission evidence, and copy does not send to external AI, approve, execute, or write back to source systems. Keep backend generation, post-copy receipt, source summary, truncation warning, and calibration trace unchanged.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and stop Reminder branch |
| `verify:today-pilot-home:e2e` timed out on the new receipt text | First E2E run | The pre-action receipt read `card.evidenceRefs`, but the UI view model only keeps rendered `card.evidence`; switched to `card.evidence.length`, rebuilt, and reran E2E successfully |
