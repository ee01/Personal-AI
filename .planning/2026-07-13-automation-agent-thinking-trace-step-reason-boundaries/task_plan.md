# Agent Thinking Trace Step Reason Boundary Plan

Goal: improve the randomly selected `Agent Thinking trace 可视化` feature by checking that docs match code, incorporating current product/research references and local Reminder feedback, then implementing one bounded UX/accessibility fix with verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, memory guidance, existing planning files, `docs/progressing/to-verify.md`, feature index, and current worktree state |
| 2 | completed | Randomly select and inspect `Agent Thinking trace 可视化`, its feature doc, source, and existing verifier/E2E |
| 3 | completed | Check local Reminders using AppleScript plus EventKit fallback |
| 4 | completed | Research current agent trace / observability products and papers |
| 5 | completed | Implement the selected button-level route-reason boundary and update docs/tests |
| 6 | completed | Run targeted verifier, dev compile, E2E, and scoped diff check |
| 7 | completed | Update automation memory and close out Reminder state |

## Decisions

- Selected feature: `Agent Thinking trace 可视化` from `docs/features/index.md`.
- Main doc: `docs/features/agent_thinking.md`.
- Main implementation files: `src/agent-visualizer.tsx` and `src/agentVisualizerPresentation.ts`.
- Main verifiers: `tools/verify-memory-entry-agent-thinking.ts` and `tools/verify-agent-thinking-options-e2e.mjs`.
- Reminder state: AppleScript did not list `Personal AI`; EventKit did find it with 4 total items and 0 incomplete items, so there is no related open Reminder item to incorporate or mark done.
- Scope: presentation/accessibility only. Put the existing route reason and no-effect boundary directly on trace navigation / review-lane step buttons through `title` and richer `aria-label`.

## Improvement Slice

The first-screen `当前 trace 导航` and `Trace 复核路线` already render the reason beside each step button, but the button control itself only exposes "jump to step N" to hover/reader users. This leaves the actual click target weaker than the surrounding receipt.

Fix:

- Add a small helper in `AgentVisualizer` to build route button title/ARIA copy.
- Include the destination step, visible route reason, and the no-effect boundary.
- Use it for `当前 trace 导航` buttons and `Trace 复核路线` item buttons.
- Keep all trace packet, tool execution, approval, diagnostic copy, and jump behavior unchanged.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Root `task_plan.md` is stale from a June Scheduled Messages run | planning-with-files restore | Created this isolated planning directory and updated `.planning/.active_plan` |
| AppleScript did not list `Personal AI` | Reminder list probe | Used EventKit fallback, which found the list and confirmed 0 incomplete items |
| First Options E2E rerun failed on the new navigation-button assertion | Expected the default review-lane boundary text for the current-trace navigation button | Matched the actual `当前 trace 导航` receipt boundary: `点击步骤定位只展开当前页面时间线` |
