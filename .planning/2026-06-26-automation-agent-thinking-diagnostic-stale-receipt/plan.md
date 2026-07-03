# Agent Thinking Diagnostic Copy Freshness Plan

## Target

- Random feature: `Agent Thinking trace 可视化`
- Feature doc: `docs/features/agent_thinking.md`
- Main surface: Options `AgentVisualizer`

## Context

- `docs/progressing/to-verify.md` has no carry-over items.
- Automation memory says to avoid the freshest Today Pilot / Scheduled Messages / Coverage Map / Skill Foundry / Memory Exploring / Agent Workflow / Meeting Pilot / Project Dashboard / Notification / Jira Design Links / Native Join / Message Analysis / Prompt Config / Relationship Radar / Rehearsal / User Profile / Memory Capture / Topic Messages / Quick Ask / Compose Assist families.
- Local Reminders lists are readable, but there is no list named `Personal AI`; no Reminder item can be included or marked done.
- The worktree is already dirty, so this run stays scoped to Agent Thinking presentation, tests, docs, and this planning note.

## Outside Scan

- LangSmith models a trace as one operation composed of runs/spans and assigns trace identity for correlation: https://docs.langchain.com/langsmith/observability-concepts
- Langfuse frames LLM tracing as complete request lifecycle visibility across LLM calls, retrieval, tool executions, custom logic, timing and metadata: https://langfuse.com/docs/observability/overview
- OpenTelemetry GenAI conventions keep tool/agent/workflow attributes moving toward standard trace semantics while warning that local formats still need explicit exporter boundaries: https://github.com/open-telemetry/semantic-conventions-genai
- AGDebugger research highlights that debugging long agent workflows requires reasoning over history and returning to earlier workflow points: https://arxiv.org/html/2503.02068v1

## UX Problem

The current Agent Thinking diagnostic package already has a local trace id, schema boundary, snapshot boundary, and copy receipt. As a real user, the remaining ambiguity is what happens after I copy while the demo trace is still moving: the UI can quickly move to a newer trace state, while my clipboard still contains the old JSON. A transient "copied" receipt does not keep that boundary visible.

## Implementation Plan

1. Add a copied-snapshot helper that records trace id, checksum, generated time, status label, and span count from the diagnostic packet.
2. Add a freshness receipt that compares the copied snapshot with the current page packet:
   - current: copied JSON still matches the page trace.
   - stale: copied JSON belongs to an older trace, and the user should copy again for troubleshooting or eval.
   - no current trace: copied JSON is old because the page no longer has a matching trace.
3. Render the receipt next to the existing diagnostic copy status and keep it visible instead of clearing the copy result after a short timeout.
4. Update the existing presentation verifier and Options E2E to cover current-to-stale transition while the demo trace appends steps.
5. Update `docs/features/agent_thinking.md` with the new user-visible boundary and validation notes.

## Non-Goals

- Do not change tool execution, approval keys, or approval behavior.
- Do not add a standard OpenTelemetry / LangSmith / Langfuse exporter.
- Do not add persistent checkpoints or recoverable run state.
- Do not copy raw tool results, tool parameters, notification body, external credentials, or approval keys into the diagnostic packet.

## Verification Plan

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts`
- `npm start`, wait for first successful webpack dev compile, then stop watch.
- `node tools/verify-agent-thinking-options-e2e.mjs`
- Scoped `git diff --check` for touched files and this planning file.
