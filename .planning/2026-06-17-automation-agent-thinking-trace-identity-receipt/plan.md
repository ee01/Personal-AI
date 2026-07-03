# Agent Thinking trace identity receipt

## Target

- Feature index pick: `Agent Thinking trace 可视化` in `docs/features/agent_thinking.md`.
- Code surface: `src/agentVisualizerPresentation.ts`, `src/agent-visualizer.tsx`, focused verifiers, and the Options E2E.
- Reminder status: local Reminders was readable, but no `Personal AI` list was visible, so no Reminder item is linked or completed.

## External scan

- OpenAI Agents SDK tracing models traces as workflow-level containers with `trace_id`, parented spans, tool calls, handoffs, guardrails, and sensitive-data controls.
- LangSmith and Langfuse both treat traces as end-to-end request containers with nested tool/model observations, which makes stable identity and scope boundaries important when copied out of the product UI.
- OpenTelemetry GenAI conventions include well-known operation names such as `execute_tool` and warn that message attributes can contain sensitive data, supporting the current privacy-preserving local packet shape.
- AgentTrace argues for structured, schema-consistent, multi-surface agent telemetry; this supports strengthening the local packet as a matchable diagnostic artifact before building a standard exporter.

## UX gap

The Options page already explains that the diagnostic packet is a local snapshot and not a standard exporter. As a user copying the JSON into an eval or support thread, there is still no compact identifier to match the copied packet back to the visible page snapshot. That makes repeated copies, failed clipboard fallback, and support handoffs harder to verify.

## Plan

1. Add a privacy-preserving `traceIdentity` to the diagnostic packet with a local checksum over sanitized summary/span/boundary fields.
2. Show the local trace id/checksum in the running summary, diagnostic scope receipt, copy-success receipt, and manual-copy fallback payload.
3. State the boundary explicitly: the id is only for matching this JSON to this page snapshot, not for OpenTelemetry/LangSmith/Langfuse correlation, run resume, approval, or execution proof.
4. Extend unit-style verifier and Options E2E to cover packet fields, receipt copy, visible scope text, summary chip, and clipboard-failure manual copy.
5. Update the canonical feature doc and run targeted verification plus first successful dev extension compile.

## Validation targets

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts`
- `npm start` until first successful webpack development compile, then stop the watcher.
- `node tools/verify-agent-thinking-options-e2e.mjs`
- Scoped `git diff --check` on touched files.
