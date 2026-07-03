# Agent Workflow Evidence Qualification Plan

## Target

- Feature: `Agent Workflow 运行诊断`
- Source doc: `docs/features/agent_workflow.md`
- Main code: `src/agentWorkflowDiagnostics.ts`, `src/options.tsx`
- Verification: `npm run verify:agent-workflow`, `npm start` first compile, `npm run verify:agent-workflow:e2e`

## Current Finding

The Options test surface already shows run scope, orchestration receipt, structural coverage, readiness checks, recommended actions, and a copyable single-run evidence packet. The remaining UX gap is narrower: the evidence packet says `当前结果` or `旧快照`, but it does not explicitly say whether the packet is eligible as local regression evidence, only a one-off debug snapshot, or requires a rerun because input/config changed.

As a user, this is a handoff problem. I can copy a convincing packet, but the receiver still has to infer whether it is publish-gate evidence or stale troubleshooting evidence.

## External Scan

- OpenAI Agents SDK tracing models agent/tool/workflow execution as traceable spans, so a copied packet should preserve trace status without leaking sensitive input.
- OpenAI Agents SDK HITL patterns emphasize clear interrupt/review/resume boundaries, matching the need to say whether the packet is current or needs rerun.
- LangGraph persistence/durable execution frames workflow state as checkpointed and resumable, which supports making stale vs current snapshot status explicit.
- OpenTelemetry GenAI agent spans treat agent/tool execution as observability objects, reinforcing structured qualification over raw log copying.
- Agent workflow structural-coverage research supports separating a single run from regression evidence built from saved cases and stable coverage criteria.

## Improvement Plan

1. Add an evidence qualification field to the Agent Workflow evidence packet model.
2. Surface the qualification in the card, chips, and copied text:
   - `可作本地回归证据` when the result is current, matches a saved scenario, and the saved baseline/config gate is satisfied.
   - `单次调试证据` when the result is current but not bound to a saved baseline.
   - `证据需重跑` when the result is stale because input or Agent config changed.
3. Pass the current UI state into the packet builder from Options:
   - stale reason
   - saved scenario match
   - baseline/config state
   - replay/source type
4. Update the diagnostic verifier and Options E2E assertions so the contract is covered in both pure builder output and browser-level UI/clipboard behavior.
5. Update `docs/features/agent_workflow.md` with the new user-visible evidence qualification behavior.

## Non-Goals

- Do not change Agent execution order or storage/notification behavior.
- Do not create a real review queue for low-confidence notifications in this pass.
- Do not export raw message content or tool parameters in copied evidence packets.
