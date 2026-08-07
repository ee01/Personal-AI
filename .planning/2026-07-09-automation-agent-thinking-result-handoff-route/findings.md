# Findings

## Repository Context

- `AGENT.md` requires reading `docs/progressing/to-verify.md`, checking automation memory, checking the local `Personal AI` Reminders list, then doing a bounded implementation with the repo's real verifier and `npm start` first compile for runtime source changes.
- `docs/progressing/to-verify.md` currently says `暂无`.
- The worktree is broadly dirty from previous automation runs; this run should own only the new Agent Thinking result-handoff route changes, matching verifiers/docs, the new planning directory, and the active plan pointer.

## Feature Context

- `docs/index.md` lists `Agent Thinking 分析编排` as the Agent Thinking feature for the shared tool/thinking loop and the handoff between terminal trace state and result cards.
- Current implementation already has `resultHandoffReceipt` in `src/agentVisualizerPresentation.ts`, rendered by `src/agent-visualizer.tsx` as `结果整理中` while `isProcessing` is true after a terminal action appears.
- Existing E2E already confirms `结果整理中` appears, disappears when `.agent-result-summary` appears, and does not leave ordinary `处理中` visible.
- Gap: the receipt states that the trace reached a terminal step, but the receipt itself does not expose a terminal-step button or summarize unresolved issue counts. Users must infer from adjacent navigation/review sections.

## External Scan

- LangSmith docs describe observability as tracing runs for an operation and using traces to debug failures, which supports keeping status and failure routes visible in the same operation surface.
- LangGraph HITL docs say interrupts pause execution and require saved/persistent graph state to resume. Personal AI does not have that durable checkpoint here, so the UI must not imply resume/recovery.
- OpenTelemetry GenAI conventions include tool-call and generation telemetry fields; this repo's local diagnostic packet should keep calling itself local-only unless a real exporter is added.
- AgentOps research argues agent observability should trace artifacts/data across lifecycle to detect anomalies and failures. A terminal-step route and unresolved issue summary is consistent with this without widening runtime behavior.

## Proposed UX Change

- Add `terminalStepNumber` and `unresolvedIssueSummary` to `AgentResultHandoffReceipt`.
- Render a `终止步骤 #N` button inside `.agent-result-handoff-receipt` that calls the existing `jumpToStep` helper.
- Keep the button boundary copy explicit: it only expands/focuses the current page timeline step and does not approve, recover, rerun, send, write, delete, or execute external actions.
- Add verifier assertions that the button appears during finalizing, focuses the terminal step, and disappears with the handoff receipt after the result card renders.
