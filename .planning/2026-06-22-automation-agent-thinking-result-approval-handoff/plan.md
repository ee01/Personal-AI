# Agent Thinking Result Approval Handoff

## Target

- Feature: `Agent Thinking 工具审批`
- Source doc: `docs/features/agent_thinking.md`
- UI surface: `src/agent-visualizer.tsx`
- Verification: `tools/verify-agent-thinking-options-e2e.mjs`

## Context

- `docs/progressing/to-verify.md` is empty.
- Local Reminders is reachable, but there is no `Personal AI` list, so no Reminder feedback item can be included or completed.
- Recent automation already covered approval preflight, retry config receipts, review packets, and trace review lanes. This run avoids persistent checkpoint or backend approval-state changes.
- External references reviewed: OpenAI Agents SDK HITL pauses/resumes from run state, LangGraph interrupts persist graph state for resume, LangChain HITL exposes approve/edit/reject/respond decisions, and AgentTrace emphasizes structured operational/cognitive/contextual accountability.

## Plan

1. Add a compact result-card handoff for pending approvals.
2. State that result-card step navigation only opens the relevant trace step and does not approve, copy, rerun, notify, write, delete, or execute tools.
3. Add per-pending-action step buttons that reuse the existing `agent-thinking:jump-to-step` event.
4. Update the Agent Thinking E2E to prove the result-card handoff and jump path.
5. Update feature docs/index copy without adding implementation detail.
6. Verify with the existing Agent Thinking browser harness, first successful dev compile, scoped whitespace checks, and process cleanup.

## Non-goals

- No durable checkpoint / paused-run store.
- No new approval API.
- No changes to `approvedToolActionKeys` matching or tool safety policy.
