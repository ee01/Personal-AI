# Agent Thinking Trace Review Lane Plan

## Target

- Random feature: `Agent Thinking trace 可视化`
- Source docs: `docs/features/agent_thinking.md` and `docs/features/index.md`
- Runtime surface: Options Agent Thinking demo, especially `AgentVisualizer`

## Current Findings

- The trace UI already has run checks, local diagnostic packets, trace identity, pending-approval cards, copy receipts, and timeline/flow-step jump links.
- The first visible summary still makes users combine several separate receipts to answer: should I approve an action, fix a tool issue, inspect evidence, or only copy a local debug snapshot?
- Local Reminders is reachable, but there is no `Personal AI` list, so no Reminder item can be merged or completed in this run.

## External Scan Judgment

- LangSmith and Langfuse emphasize traces that expose run status, tool spans, and failure/debugging context in one inspectable view.
- OpenTelemetry GenAI conventions keep tool execution and agent/run metadata as structured spans, but Personal AI still correctly treats its packet as a local schema rather than a standard export.
- AgentTrace and AgentOps research both reinforce that agent traces need operational/accountability surfaces, not only raw logs.

## Implementation Steps

1. Add a presentation helper that derives a compact `Trace 复核路线` from the existing sanitized diagnostic packet.
2. Render the route as the first row in `运行检查`, before diagnostic-copy actions and the detailed copy-scope receipt.
3. Style it as a dense, responsive status strip with stable text wrapping and no layout shift on long labels.
4. Extend the focused Agent Thinking verifier and Options E2E to assert the new route, local-diagnostic boundary, pending-approval boundary, and tool-issue counts.
5. Update `agent_thinking.md` and the feature index row with current behavior and validation notes.

## Verification Plan

- Run the focused TypeScript verifier: `tools/verify-memory-entry-agent-thinking.ts`.
- Run `npm start`, wait for the first successful webpack compile, then stop the watcher.
- Run the extension E2E: `node tools/verify-agent-thinking-options-e2e.mjs`.
- Run scoped `git diff --check` for touched files and confirm no lingering webpack watcher.
