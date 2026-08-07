# Agent Workflow Next Action Boundary Plan

Goal: improve the randomly selected `Agent Workflow 运行诊断` feature by checking the current docs/code, incorporating relevant product and research references, and implementing one low-decision UX improvement with verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, memory guidance, feature index, `to-verify`, worktree state, and stale root planning files |
| 2 | completed | Randomly select a viable feature and inspect Agent Workflow docs, code, and existing verifiers |
| 3 | completed | Check local Reminders with AppleScript and EventKit and record whether related open feedback exists |
| 4 | completed | Search current product docs and recent research for agent workflow trace / HITL / structural coverage guidance |
| 5 | completed | Implement a focused UX/code improvement for the selected feature |
| 6 | completed | Update canonical docs and feature index |
| 7 | completed | Run targeted verification, dev compile, E2E, and scoped diff checks |
| 8 | completed | Update automation memory and close out Reminder state |

## Decisions

- Selected feature: `Agent Workflow 运行诊断`.
- Source doc: `docs/features/message_analysis.md`.
- Main implementation surface: `src/options.tsx` with diagnostics helpers in `src/agentWorkflowDiagnostics.ts`.
- Existing verifier surface: `npm run verify:agent-workflow`, `tools/verify-agent-workflow-options-e2e.mjs`, and `npm start` first successful compile.
- Reminder result: EventKit found `Personal AI`, but all 4 items are completed historical Doubao/notification items and unrelated to Agent Workflow diagnostics.
- Implementation slice: add a local troubleshooting boundary to the `下一步` section and mirror each recommended action into `title` / `aria-label`, clarifying that the cards are guidance only and do not rerun tests, write Memory Service, send notifications, execute automation, approve review candidates, or change baselines.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Root `task_plan.md` was stale Scheduled Messages context | Planning restore step | Created a dedicated `.planning/2026-07-11-automation-agent-workflow-next-action-boundary/` plan and switched `.planning/.active_plan` |
| AppleScript did not list `Personal AI` | Reminder list scan | Used EventKit fallback, which found the list and confirmed all items completed/unrelated |
| Long Agent Workflow doc paragraph made the first docs patch miss | Initial docs update | Retried with narrower context and updated only the date, relevant sentence, and index row |
| E2E expected `不会写入 Memory Service`, but copy only said `不会自动重跑测试、写入 Memory Service` | First Options E2E | Made every no-effect clause explicit with its own `不会` |
