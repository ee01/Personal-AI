# Action Readiness Contracts Findings

## Starting Context

- The approved artifact pair is `docs/progressing/action-readiness-contracts-plan.md` and `docs/progressing/action-readiness-contracts-demo.html`.
- The worktree contains many unrelated and concurrent changes. Read current file contents and scoped diffs before editing any shared surface.
- Memory from the planning run identifies the capability as pre-dispatch checks for capability, authorization, target clarity, required inputs, approval mode, idempotency, and proof requirements.

## Repository And Approved Scope

- `AGENT.md` requires the first successful `npm start` compile for extension source changes, targeted tests, extension E2E for user-visible extension UI, and an eval suite when a complete feature depends on action gating or judgment quality.
- Approved P0 covers `delegate_openclaw`, `openclaw:global`, `openclaw:<targetSystem>:read/write`, Action Queue summary/card receipts, contract updates for `auth_error`, `capability_missing`, missing proof, and successful artifacts, plus ReflectionWorker suppression for clearly blocked scopes.
- P0 explicitly excludes automatic credential repair, blanket retries of old actions, a full MCP registry, a standalone settings page, and a user-authored readiness matrix.
- The implementation must add an `action-readiness-contracts` eval suite, run validation and the suite, then move durable behavior into `docs/features/memory_system.md`, `docs/features/evidence_watch_contracts.md`, `docs/features/message_reaction.md`, `docs/features/agent_workflow.md`, and `docs/features/index.md` as applicable.
- Once canonical docs are updated, the approved `docs/progressing/action-readiness-contracts-*` artifact pair should be removed to avoid dual-track documentation.

## Existing Architecture Map

- Backend action lifecycle is centered on `memory-service/src/core/actions/ActionExecutor.ts`, `ActionRepository.ts`, `ActionResultRepository.ts`, and `memory-service/src/routes/actions.ts`.
- `delegate_openclaw` is created from Ask, confirm requests, agent tasks, ReflectionWorker, ReflectionThreadService, message rules, outreach, and Evidence Watch paths. The shared dispatch boundary therefore belongs in `ActionExecutor`, while creator-side suppression can be added narrowly to ReflectionWorker.
- Extension API types/client live in `src/services/MemoryServiceClient.ts`; the current queue UI is `src/modals/components/ActionQueue.vue` and already has a focused Playwright verifier at `tools/verify-action-queue-e2e.mjs`.
- Existing code already has post-failure follow-up classification and OpenClaw delegation policy. The new layer must consume those facts before dispatch and expose a durable, scope-based contract rather than duplicating post-failure narration.

## Backend Control-Point Findings

- `ActionExecutor.executeAction()` currently marks an action running before any OpenClaw capability/auth readiness check. Failures therefore increment `retry_count` and can create recovery notifications/confirm requests; readiness blocking must happen before `markRunning()`.
- `ActionRepository` has no blocked queue state or readiness relation. A separate contract/link schema is preferable to overloading action result JSON, but action list responses can enrich records at read time to avoid broad producer changes.
- `runDueActions()` selects only queued auto actions, so a blocked action can remain `queued` if dispatch is refused before `markRunning()`. A linked readiness receipt is then the source of truth for why it did not execute; no retry increment is needed.
- `OpenClawDelegationService` already contains proof-shape validation (`sourceSystem`, entity key, verification, observed fields/operation/timestamp). The new contract should reuse the resulting `capability_missing`/failure outcome instead of implementing a second artifact parser.
- The existing `delegateOpenClawPolicy` already normalizes read/write approval semantics. Readiness evaluation can consume the normalized action record and focus on target/input/auth/capability/proof scope.

## Approved Contract Shape

- Contract identity is a reusable `scope_key`, with global and target/mode examples such as `openclaw:global` and `openclaw:jira:read`.
- Required states are `ready`, `unknown`, `blocked_auth`, `blocked_capability`, `blocked_input`, `blocked_proof`, `degraded`, and `expired`.
- API enrichment should return a per-action `ReadinessReceipt` plus a queue-level `readinessSummary`; repair/recheck must state that probing does not execute the original action.
- P0 decision semantics: blocked contracts stop dispatch; expired or degraded automated work probes first; a never-seen unknown contract may use the original action as first proof for compatibility; ready preserves existing behavior; manual write approval remains independent of readiness.
- Existing Action Queue already has dense OpenClaw preflight, proof, recovery, and control-boundary receipts. The new UI should integrate as one aggregate strip and one contract receipt rather than create another parallel card family.

## Integration Decisions Emerging From Current Code

- The next migration number is `051`; action readiness can be added without modifying the existing action table.
- `OpenClawDelegationService` treats unconfigured runtime as `capability_missing`, maps HTTP 401/403 to `auth_error`, and turns success without a verifiable artifact into `error` with `payload.artifactValidation = missing_verifiable_artifact`. These are sufficient deterministic inputs for contract updates.
- A recheck can safely reuse the delegation transport with an explicit probe-only task and no original action execution. It must be called through a dedicated readiness endpoint and clearly retain the no-side-effect boundary in its receipt.
- First execution behavior should be conservative but usable: persisted unexpired blocked contracts block before attempts; unknown/degraded automatic actions probe first; unknown manual actions can still be explicitly executed with an `allow_manual_only` receipt; approval remains a separate gate.
- The `GET /actions` response is already the single Action Queue fetch. Enriching it with `readinessReceipt` per action and `readinessSummary` avoids a second page-load race and keeps stale-snapshot semantics coherent.

## Compatibility Constraints

- Existing executor tests commonly expect one OpenClaw request for a fresh manual action. P0 can preserve this by allowing a never-seen `unknown` contract and using the original action outcome as first proof; only persisted `blocked` or `expired` contracts must prevent/precede dispatch.
- The current queue UI already catches action-operation errors, reloads a silent snapshot, and keeps local operation receipts. A readiness probe can use the same operation pattern with a new `probe` operation and then refresh the enriched action list.
- `RuntimeActionListResponse` currently has only pagination fields; it is the correct extension point for a top-level summary while `RuntimeAction` receives the per-action receipt.
- The Action Queue E2E already intercepts `/actions` and uses rich OpenClaw fixtures. It can prove aggregate strip, blocked card controls, probe-only request semantics, and the unchanged stale-snapshot boundary without a separate browser harness.

## UI And Reflection Constraints

- The current Action Queue operation model supports one operation per action and centralizes button labels, pending receipts, errors, and accepted state. Add `probe` to that same model so blocked cards remain stable while recheck is pending.
- Blocked readiness must hide the normal execute path and present `修复后重测`; retrying a failed action should remain possible only after readiness is no longer blocked, otherwise it merely recreates queued debt.
- `ReflectionWorker` itself only normalizes draft proposals and has no database/service context. Readiness suppression belongs where `ReflectionThreadService` turns those drafts into persisted actions; generated reflection prose can remain unchanged while links preserve the blocked relationship.
- The backend migration and route style used by Evidence Watch confirms a single service can own persistence, receipt construction, list enrichment, and probe write receipts without introducing a separate repository layer for this P0.

## Backend Implementation Evidence

- Migration 051, `ActionReadinessService`, executor gating, due-queue exclusion, retry/probe routes, list enrichment, and Reflection persistence suppression now compile together.
- Focused tests prove that a persisted gateway auth failure blocks later actions before `markRunning`, leaves `retryCount=0`, creates no attempt, and makes no network call.
- Probe tests prove the request contains a probe-only task, omits the original task payload, leaves the original action queued/unapproved, and changes both global and target contracts to `ready` after a verifiable probe artifact.
- Explicit required-input tests prove missing input is resolved locally with no OpenClaw call. Due-queue tests prove a linked blocked action no longer starves unrelated auto actions.
- Existing executor tests needed readiness-table cleanup between cases. A stale-running fixture also needed 700 seconds instead of its old 400-second constant to match the repository's current 10-minute OpenClaw timeout plus grace period.

## Action Queue Implementation Evidence

- `MemoryServiceClient` now exposes typed per-action readiness receipts, queue-level readiness summaries, execution receipts, and the dedicated probe endpoint.
- Action Queue shows one aggregate readiness strip and one compact per-action contract receipt. Blocked, degraded, or expired actions hide normal execute/retry controls until recheck succeeds.
- The recheck control explicitly says it sends only a capability probe, never the original task, and never proves that the original external work completed.
- The focused Playwright verifier proves blocked counts, scope/status visibility, hidden retry controls, a probe request with no original task payload, a successful no-original-action receipt, restored retry controls, and the updated aggregate count.
- The extension watch build reached its first successful compile after the UI changes, and the focused Action Queue E2E passed.

## Verification And Trust-Boundary Evidence

- The deterministic `action-readiness-contracts` eval suite now covers five real-scenario-derived cases: global auth blocking, probe-only unlock, missing message-rule attachment inputs, missing proof artifacts, and Reflection batch suppression. All five pass and the shared Reader Contract report has no contract warnings.
- Cross-entry regression passed 101 tests across Ask, Agent Tasks, Message Rules, Evidence Watch, Outreach, Reflection, Action Executor, action APIs, and the readiness service.
- The Action Queue E2E now also checks a 390x844 viewport and proves there is no horizontal document overflow after the readiness summary and card receipts render.
- Documentation review exposed that list enrichment previously persisted a static readiness contract while the UI called the aggregate a read-only summary. `checkAction` now derives static blockers without writes by default; dispatch, probe, and Reflection explicitly opt into persistence. A focused test proves read-only check leaves zero contracts and probe materializes one.
- Final receipt review found that `blocked_proof` and some auth/capability blockers can be learned only after an action was already dispatched. Receipts now expose `dispatchState`; Action Queue says either “派发前阻断” or “历史派发后暴露阻断”, and probe receipts say only that the current recheck did not re-execute the original action. This preserves the potential-side-effect warning instead of erasing history.
