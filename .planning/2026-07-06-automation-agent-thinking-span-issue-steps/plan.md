# Agent Thinking trace problem-span step routing plan

## Target

Random feature point: `Agent Thinking 分析编排` in `docs/features/agent_thinking.md`.

This run stays in the presentation and diagnostic-payload layer. The current Options page already shows `Trace span 构成`, but the issue-span item only reports a count. Users can tell that there are problem spans, but not which timeline steps produced them unless they cross-read `当前 trace 导航`.

## External reference

- LangGraph / LangChain HITL docs model interrupts as persisted, reviewable actions with explicit approve/edit/reject/respond decisions.
- OpenAI Agents SDK HITL docs surface pending approvals as run interruptions and serialize `RunState` for resume.
- LangSmith and Langfuse trace UX emphasize finding failures from trace/run views instead of reading raw logs.
- OpenTelemetry GenAI conventions moved to a dedicated repository and continue to treat agent/tool spans as structured diagnostic signals; Personal AI should keep its payload local-only while making problem spans computable and navigable.

## Plan

1. Add `stepNumbers` to the local `traceSpanComposition` issue item so copied diagnostics preserve which steps produced failure/approval/blocked/empty-evidence spans.
2. Render those step numbers as same-page buttons in the `Trace span 构成` card.
3. Keep the no-effect boundary explicit: clicking problem-span steps only expands/focuses the current Options timeline and does not approve, copy, resume, rerun, write, delete, notify, or execute tools.
4. Extend the focused Agent Thinking presentation verifier and Options E2E to assert the issue-step payload and UI.
5. Update the feature doc and index with a concise current-behavior note.

## Non-goals

- No persistent checkpoint or resumable run state.
- No standard OpenTelemetry / LangSmith / Langfuse exporter.
- No changes to tool execution, approval key generation, guardrails, LLM prompts, or final analysis decisions.
