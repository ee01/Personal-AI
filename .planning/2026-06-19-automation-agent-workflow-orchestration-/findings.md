# Findings & Decisions

## Requirements
- Random target: `Agent Workflow 多 Agent 编排` from `docs/index.md`.
- User expects docs/code freshness check, product and paper scan, scoped implementation, UX review, strong practical validation, automation memory update, and archive attempt.
- Local Reminders check returned `NO_PERSONAL_AI_LIST`, so there are no target-related Reminder items to merge or complete.

## Research Findings
- Existing docs are current through 2026-06-18 and already describe trace, structural coverage, saved examples, regression baselines, and local-only writeback boundaries.
- Code inspection found the low-confidence `notificationReview` path in `src/agentWorkflow.ts` and presentation helpers in `src/agentWorkflowDiagnostics.ts`; Options currently shows "待复核" but the review boundary is not explicit enough at the exact review banner/action point.
- Product scan: OpenAI Agents SDK, LangGraph/LangChain HITL, Microsoft Copilot Studio generative orchestration, Zapier Agents, and LangSmith all emphasize test-before-activation, trace/activity-map visibility, and human approval as explicit state rather than implied action.
- Paper scan: 2026 structural coverage work argues multi-agent workflow tests should prove declared agents/tools/restrictions are exercised; 2026 execution provenance work argues agent traces should connect evidence, tool outputs, memory, actions, and final claims.
- UX decision: improve the low-confidence review receipt so Options tests say the candidate is local-only and no real review queue item, Memory Service write, notification, or automation has happened.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add the boundary in `agentWorkflowDiagnostics` and the Options banner | These are the shared presentation points used by diagnostics, next actions, and E2E; it avoids changing the runtime processing contract. |
| Avoid implementing a real review queue in this run | It is a broader product flow requiring new decisions about queue owner, acceptance action, and feedback loop. |
| Update the existing Agent Workflow verify scripts | This target already has focused unit-style and E2E checks; extending them is lower risk than adding a new harness. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| First Reminder AppleScript syntax failed | Multiline AppleScript retry confirmed the `Personal AI` list is absent. |

## Resources
- OpenAI Agents SDK docs: https://developers.openai.com/api/docs/guides/agents
- LangChain HITL docs: https://docs.langchain.com/oss/python/langchain/human-in-the-loop
- Microsoft Copilot Studio generative orchestration docs: https://learn.microsoft.com/en-us/microsoft-copilot-studio/advanced-generative-actions
- Zapier Agents docs: https://help.zapier.com/hc/en-us/articles/24393442652557-Build-an-agent-in-Zapier-Agents
- LangSmith Evaluation docs: https://docs.langchain.com/langsmith/evaluation
- Testing Agentic Workflows with Structural Coverage Criteria: https://arxiv.org/abs/2605.26521
- Evidence Tracing and Execution Provenance in LLM Agents: https://arxiv.org/html/2606.04990v1
