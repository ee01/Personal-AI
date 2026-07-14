# Agent Workflow Next Action Boundary Findings

## Selection And Reminder Findings

- `docs/progressing/to-verify.md` currently says `暂无。`, so there is no carry-over verification item.
- Random sample from `docs/features/index.md` produced several recent near-neighbors; selected `Agent Workflow 运行诊断` as the first viable less-recent target with a bounded verifier path.
- `Personal AI` Reminders: EventKit found 4 total items, all completed. They are historical Doubao / notification feedback and do not relate to Agent Workflow diagnostics, trace, saved scenarios, or local regression evidence.
- Worktree is broadly dirty from prior runs. This run should only own the new planning directory, `.planning/.active_plan`, Agent Workflow Options UI/verification changes, and concise docs/index updates.

## Code And UX Findings

- `docs/features/agent_workflow.md` is current and already documents local test scope, trace health, storageReview, evidence packets, saved baselines, and batch regression.
- `src/options.tsx` renders `workflowRecommendedActions` as visible cards under `下一步`. The text is useful, but the section has no explicit section-level boundary and each card has no hover/screen-reader summary of non-effects.
- `buildAgentWorkflowRecommendedActions()` already distinguishes review, fix, optimize, verify, and done actions. The low-risk improvement is presentation/accessibility only: keep the same data contract and render a clearer local-troubleshooting boundary at the control point.
- Existing E2E already exercises the partial trace case with skipped tools, placeholder external query, notification review, storage verification, evidence packet copy, and baseline/report flows, so it is the right proof path.

## External Reference Findings

- OpenAI Agents SDK guidance frames SDK ownership around tool implementations, state storage, approval decisions, tracing, guardrails, and resumable approval flows: https://developers.openai.com/api/docs/guides/agents
- LangChain / LangGraph HITL docs emphasize pausing risky tool calls through interrupts and resuming after explicit human decisions, reinforcing that diagnostic guidance should not look like approval or execution: https://docs.langchain.com/oss/python/langchain/human-in-the-loop
- LangGraph persistence docs emphasize resuming and recovering after interruptions, which supports keeping Personal AI's current `下一步` cards as guidance until a real durable checkpoint/resume model exists: https://docs.langchain.com/oss/python/langgraph/persistence
- OpenTelemetry GenAI conventions include agent, workflow, tool call, retrieval, and evaluation attributes, reinforcing compact structured trace metadata over raw message copying: https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/
- `Testing Agentic Workflows with Structural Coverage Criteria` (arXiv:2605.26521, submitted 2026-05-26) argues structural coverage reveals whether declared agents, tool access, restrictions, and delegation paths were exercised. This supports making structural diagnostics actionable while keeping side effects separate: https://arxiv.org/abs/2605.26521

## Planned Improvement

- Add a compact `下一步动作边界` line above the recommended action cards.
- Add per-card `title` and `aria-label` text that includes status, title, summary, and local-only boundary.
- Extend `tools/verify-agent-workflow-options-e2e.mjs` to assert the section boundary and at least one action card tooltip / reader label.
- Update `docs/features/agent_workflow.md` and the feature index row to mention the `下一步` hover / reader boundary.
