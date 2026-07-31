# Agent Workflow tool error diagnostics

## Target

- Feature: `Agent Workflow 运行诊断`
- Docs: `docs/features/agent_workflow.md`, `docs/features/index.md`
- Main code: `src/agentWorkflowDiagnostics.ts`, `src/options.tsx`
- Verification: `npm run verify:agent-workflow`, `node tools/verify-agent-workflow-options-e2e.mjs`, dev build via `npm start`

## Context

- `docs/progressing/to-verify.md` is empty.
- Automation memory shows recent exact or adjacent sweeps for Topic Messages, Scheduled Messages, Project Dashboard, Doubao Bridge, Native Join, Notification Center, Message Reaction, Message Analysis, Memory Capture, Jira Design Links, Google Slides Analyzer, Memory Service, Agent Thinking, Relationship Radar, Meeting Pilot, Today Pilot, and Skill Foundry. The random candidate list selected Agent Workflow as the first viable target outside those freshest families.
- EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items. Existing items are completed historical Doubao / Notification feedback, so no Agent Workflow Reminder item is being incorporated or marked done.

## External scan

- OpenAI Agents SDK frames agent runs as a loop with tracing, guardrails, sessions, and resumable approvals, which supports keeping tool-call failures explicit before any human trust or approval path.
- LangGraph persistence / durable execution emphasizes resumable workflow state and replay boundaries; Agent Workflow should therefore make the failed step/tool visible before users rerun or accept local baselines.
- OpenTelemetry GenAI conventions and current agent observability writing separate agent/workflow/tool spans, matching the repo's direction of showing `Agent / Tool` instead of only a generic partial trace.
- `Testing Agentic Workflows with Structural Coverage Criteria` argues that declared agent/tool edges must be exercised and checked, not just final output success.
- TRAIL / AgentTrace papers emphasize trace-level failure localization and structured logs for trust calibration; a trace tool error should become a concrete diagnostic and next action even if older `storageReview.traceStatus` metadata is missing or stale.

## Gap

The feature doc says trace tool errors should directly drive running diagnostics and next actions, but `buildAgentWorkflowResultDiagnostics` currently emits the `partial-trace` diagnostic only when `storageReview.traceStatus === 'partial'`. A real-time trace can contain a failed tool while `storageReview` is absent, stale, or not marked partial; in that case readiness blocks but the visible "运行诊断" and "下一步" may omit the specific repair action.

## Plan

1. Update `buildAgentWorkflowResultDiagnostics` so any observed trace tool error, storage review tool error count, or failed trace status produces the existing `partial-trace` diagnostic with the most specific `Agent / Tool` labels available.
2. Add a regression case where a tool fails in `agentWorkflowTrace` while `storageReview.traceStatus` is not partial, proving diagnostics and recommended actions still surface `fix-tool-errors`.
3. Update Agent Workflow docs and the feature index row concisely to state that live trace tool errors override stale/missing `storageReview.traceStatus` for diagnostics and next actions.
4. Verify with the repo's targeted Agent Workflow checks, dev webpack compile, Agent Workflow Options E2E, and scoped whitespace checks.
