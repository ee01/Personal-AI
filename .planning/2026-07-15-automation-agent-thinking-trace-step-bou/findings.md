# Findings & Decisions

## Requirements
- Randomly select one feature from `docs/index.md`, avoid very recent repeats where practical, inspect docs/code, research comparable products/papers, make a constructive improvement, update docs, verify thoroughly, and close Reminder/automation memory.
- Selected feature: `Agent Thinking 分析编排` in `docs/features/agent_thinking.md`.
- Reminder state: AppleScript did not list `Personal AI`; EventKit did list it with 4 total items and 0 incomplete items. No Reminder item is related or available to complete.

## Research Findings
- LangSmith and Langfuse position agent observability around execution traces that reveal tool calls, failures, latency/cost, and debugging context. That supports keeping trace navigation problem-oriented instead of a raw log-only view.
- OpenTelemetry GenAI semantic conventions expose agent/tool attributes and operation names such as tool calls as structured telemetry. This supports keeping local trace buttons tied to step/span meaning and explicit local-only boundaries.
- OpenAI Agents SDK, LangGraph, and LangChain HITL docs model sensitive tool calls as pause/interruption states with resumable run/checkpoint semantics. Personal AI does not have that persistent checkpoint yet, so UI copy must not imply that local step navigation or copied text resumes or approves a run.
- AgentTrace (arXiv 2602.10133) argues agent observability needs operational, cognitive, and contextual telemetry for accountability. The practical UI lesson here is to make problem-step navigation auditable and non-effectful.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use existing `buildAgentTraceStepButtonBoundary()` in `src/agent-visualizer.tsx` | It already encodes the desired no-effect boundary and is used by `Trace 复核路线` / `当前 trace 导航` buttons. |
| Cover `结果整理终止步骤`, `Trace span 构成`, `运行检查涉及步骤`, `待确认队列对应步骤`, and result-card `定位步骤` buttons | These controls all trigger the same local `jumpToStep` behavior but lacked consistent title/ARIA boundary copy. |
| Keep helper local to the visualizer | The gap is presentation-only; moving the helper into presentation logic would widen the change without new behavior. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Worktree is already broadly dirty from previous automation runs | Keep edits scoped to Agent Thinking files plus this planning directory and automation memory. |

## Resources
- https://docs.langchain.com/langsmith/observability
- https://langfuse.com/docs
- https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/
- https://openai.github.io/openai-agents-python/human_in_the_loop/
- https://docs.langchain.com/oss/python/langgraph/interrupts
- https://docs.langchain.com/oss/python/langchain/human-in-the-loop
- https://arxiv.org/abs/2602.10133
