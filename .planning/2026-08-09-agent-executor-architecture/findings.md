# Findings — Agent Executor Architecture

## Decisions (user 2026-08-09)
- Scope: Block 0, A, B, C, D, F, G, H. **Skip E**.
- Docs: standalone `docs/features/agent_executor_runtime.md` (platform capability, not a user-facing “feature” alone — still belongs in features/ + 平台层能力 index).
- Evals: yes — deterministic suite covering idempotency, async accept, observedFields shape, readiness non-cascade, reconcile semantics. Prefer phase-by-phase cases, final full run.

## Why standalone docs
- This is a **runtime capability** shared by AgentTask, Reflection, Evidence Watch, future A2A — not a single UI feature.
- Merge into `action_readiness_contracts.md` would bury transport/registry/async control-plane.
- Merge into `memory_system.md` would make that file even heavier.
- Keep readiness doc as the **gate** specialty; new doc owns **executor registry + enqueue + reconcile + protocol layering**. Cross-link both.

## Eval suitability
Suitable for deterministic evals (no LLM judge):
1. Idempotent enqueue same taskId → one action
2. execute returns accepted + statusUrl without waiting for OpenClaw
3. observedFields as object still verifies
4. blocked_proof on one task does not block sibling same-scope tasks (or auto TTL recovers)
5. connection drop → reconcile path (mocked gateway) not immediate failed
6. Block 0: claim without confirm must not write final ✅ (Apps Script unit harness)

Not suitable as LLM experience judge for “did the agent do the right business thing” — that stays outside.

## Code anchors (pre-impl)
- Sync execute: `memory-service/src/routes/agentTasks.ts`
- Idempotency Date.now fallback: same file ~415
- Artifact check: `OpenClawDelegationService.hasVerifiableArtifact` + `hasMetadataStringArray`
- Readiness scope block: `ActionReadinessService.recordDelegationOutcome` → `blocked_proof`
- Claim false success: `app-script-template.gs` `markMessageOnFetchIfRequested` + `updateExecutionLog` AgentTask ✅ text
- Jira autoMark: `jira-rule-template.json` `autoMarkOnFetch=api`
- Existing eval pattern: `tools/eval-action-readiness-contracts.ts`

## Block 0 design notes
- Claim state text: `⏳ AgentTask 已领取待确认` / custom API equivalent — NOT final ✅
- New action: `confirmBotMessageTriggered` (or extend mark with `stage=claimed|confirmed|trigger_delivery_failed`)
- AgentTask still needs post-delivery confirm from Jira after Dify/memory-service accept
- Until Block A lands, AgentTask confirm can mean “Jira successfully POSTed Dify and got HTTP success”; later upgrade to accepted receipt
- Compatibility: old Jira rules without confirm keep visible claimed state + reconciliation scan
