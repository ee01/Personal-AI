# Agent Workflow Placeholder Diagnostics Findings

## Current State

- `docs/progressing/to-verify.md` says there are no pending carry-over items.
- Existing automation memory has very recent exact targets in Meeting History, Watch, Selection Memory Search, Project Dashboard, Doubao revoke, Decision Center, Action Queue, Notification Digest, and Prompt Config. `Agent Workflow 运行诊断` is not one of the freshest exact targets.
- The repo worktree is already broadly dirty. Treat unrelated modified files as pre-existing and keep this run scoped.

## Code Findings

- `src/options.tsx` renders Agent Workflow run diagnostics through `buildAgentWorkflowResultDiagnostics()`, next actions through `buildAgentWorkflowRecommendedActions()`, readiness checks through `buildAgentWorkflowReadinessChecks()`, and orchestration through `buildAgentWorkflowOrchestrationReceipt()`.
- `buildAgentWorkflowReadinessChecks()` and `buildAgentWorkflowOrchestrationReceipt()` already use `storageReview.toolPlaceholderCount` as a fallback.
- `buildAgentWorkflowResultDiagnostics()` only reports placeholder runtime diagnostics when `getTraceIssueSummary()` can identify concrete external placeholder labels from trace tool entries.
- `buildAgentWorkflowRecommendedActions()` only adds the external adapter next action when the runtime placeholder diagnostic exists.
- Therefore sanitized/older results with `storageReview.toolPlaceholderCount > 0` but no detailed placeholder trace label can show a review state in orchestration/readiness while the run diagnostics block says no issue and the next actions omit the adapter fix.

## Research Findings

- OpenAI Agents SDK tracing supports comprehensive traces for workflow debugging and monitoring.
- LangGraph checkpointers persist graph state for thread-scoped memory, HITL workflows, time travel, and fault tolerance.
- OpenTelemetry's GenAI attribute registry includes agent, conversation, data source, evaluation, tool, and workflow attributes, reinforcing structured labels over unstructured log text.
- The structural coverage paper shows that explicit agent/tool coverage is a useful adequacy layer because final task success alone can miss workflow structure regressions.

## UX Decision

- Fix the diagnosis surface, not the data contract. The user already has the right count in `storageReview`; the UI helper should carry that fallback into the visible diagnostic and next action.
- Keep wording honest when labels are absent: show the placeholder count and say the exact Agent / Tool label was not in the current trace snapshot.
