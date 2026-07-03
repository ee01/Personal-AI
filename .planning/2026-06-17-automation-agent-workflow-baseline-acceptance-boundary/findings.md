# Agent Workflow Baseline Acceptance Boundary Findings

## Selected Feature

- Randomly selected feature: `Agent Workflow 多 Agent 编排`.
- Source document: `docs/features/agent_workflow.md`.
- Primary implementation files inspected: `src/agentWorkflow.ts`, `src/agentWorkflowDiagnostics.ts`, `src/options.tsx`, `static/options.css`.
- Existing verification files inspected: `tools/verify-agent-workflow-diagnostics.ts`, `tools/verify-agent-workflow-replay.ts`, `tools/verify-agent-workflow-options-e2e.mjs`.

## Local Feedback

- Local Reminders lists visible in this run: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible `Personal AI` list exists, so no Agent Workflow feedback item can be incorporated or completed.

## Code And UX Findings

- The feature doc is broadly current: it describes Agent Workflow as a stable message-processing pipeline, its Options test panel, trace/storageReview diagnostics, saved scenarios, batch regression, export report, and post-writeback receipt.
- Current code already treats Options tests as local previews and keeps Memory Service writes, notifications, and rule automation outside this Options surface.
- UX gap: after batch regression, the `接受 N 个结果为基线` button has a post-click receipt, but the pre-click copy near the button only says results can be written back. As a user, I should see before clicking which local scenarios will be overwritten and which side effects will not happen.
- Low-decision implementation slice: add a compact pre-click boundary in the batch-regression header when acceptable results exist, and assert it in the existing E2E.

## External Reference Findings

- OpenAI Agents SDK tracing treats workflows as traces with agent/tool/guardrail spans for debugging and monitoring, supporting clear user-visible trace boundaries.
- LangSmith evaluations emphasize curated datasets, version comparisons, and regression detection before shipping, supporting explicit baseline update semantics.
- LangGraph persistence/checkpoint docs separate replay/time-travel state from long-term storage, supporting local baseline writeback copy that does not imply durable Memory Service writes.
- `Testing Agentic Workflows with Structural Coverage Criteria` argues final success is not enough; declared agents, tools, restrictions, and delegation paths need structural coverage evidence. Agent Workflow's local saved scenarios and structure coverage are aligned, but baseline-accept actions should preserve that evidence boundary.
