# Findings

## Initial context

- The approved plan defines Evidence Cohesion Gate as a consumption-time cross-cutting service, not a storage taxonomy.
- The repository is heavily dirty from parallel work. Relevant files under `memory-service/src/routes`, `memory-service/src/core`, `evals`, and feature docs already contain uncommitted changes.
- The implementation must be additive and path-scoped, with overlapping diffs reviewed before edits.
- `AGENT.md` requires the memory-abilities regression gate for `/ask` prompt assembly or recall-path changes.

## Research log

- `ReflectionWorker` already receives a compact `ReflectionEvidenceItem[]`, plans evidence resolution, and normalizes external actions. The gate can run before evidence enters the reflection prompt and again before actionable proposals are returned, without changing stored thread evidence.
- `ContextRecallService` already has extensive scene-anchor, issue-key, source-cluster, suppression, autopilot, and display filtering logic. The shared gate should consume its normalized `ContextRecallMatch[]` near the final ranking/display boundary rather than reimplement recall itself.
- `ContextRecallResponse` already carries receipts/debug/autopilot metadata, making an additive `cohesionReceipt` feasible without a new storage table.
- Relevant target files contain parallel uncommitted edits. Edits must be inserted around stable symbols and reviewed as scoped diffs.
- The eval workflow should use a deterministic judge because the core question is candidate inclusion/exclusion and state selection. A generated-answer check can remain a separate integration assertion.
- `/ask` has a shared `prepareAskContext` path used to assemble recalled evidence before both prompt generation and response shaping. This is the safest place to gate once for normal and streaming answers.
- Ask already has topic locking (`MemoryContextMatchResult`), parsed project/entity filters, context anchors, and scope receipts. These can seed the gate and avoid inventing a second topic resolver.
- `ContextRecallMatch` and `ComposerAssistEvidence` both expose title/snippet/source metadata/matched anchors. A shared candidate adapter can preserve the entrypoint-specific response types while the gate operates on a small neutral contract.
- The current `ContextRecallResponse` can add an optional cohesion receipt alongside scope/autopilot; no UI-visible banner is required for the normal `cohesive` state.
- Reflection action proposals already carry `evidenceRefs`; gating must filter the evidence before the reflection prompt and suppress external proposals when the result is split/insufficient/blocked.
- `ReflectionWorker.generate()` is the common boundary for LLM and fallback reflection. Running Cohesion there guarantees that prompt, discoveries, action planning, and markdown all consume the same filtered set.
- Reflection research evidence uses the research purpose as its title, so title alone is not a trustworthy subject key. The Gate must match the thread topic against actual candidate terms/identifiers and avoid treating every research title as a durable subject.
- `ReflectionThreadService` already applies Action Readiness after proposals. Cohesion belongs one level earlier in `ReflectionWorker`: first decide whether evidence is one problem, then let readiness decide whether a coherent action is executable.
- The eval harness already supports registry-backed deterministic suites with JSONL cases, workflow/judge documentation, and the common report contract. Cohesion can therefore compare a naive consume-all baseline against the real Gate without introducing an LLM judge.
- The useful eval dimensions are exact state selection, exact evidence inclusion/exclusion, cross-topic leakage, required-evidence retention, and blocking accuracy. These expose selection defects that answer-text-only grading can hide.
- `evals/registry.yaml` and `tools/eval-run.mjs` both contain unrelated parallel edits, so suite registration and dispatch must be added narrowly around existing stable custom-suite symbols.
- Context Recall's `contextMatch.state=locked` is a useful query-expansion hint but is not always a user-confirmed subject. In associative tool/budget scenes it may lock a neighboring tool; only structured issue/project/source-topic/group/meeting anchors are strong enough to authorize Cohesion deletion.
- `applyContextExpansion()` also injects inferred `entityHints` into the expanded request. Cohesion deletion authority must read the original request, while retrieval/ranking may continue using the expanded request; otherwise inferred hints masquerade as caller-provided anchors.
- The expanded query can also contain inferred source terms and identifiers. Context Recall must pass the original normalized query to Cohesion while retaining the expanded query for retrieval/ranking.
- The generic Jira-style identifier regex also matches AI model versions such as `GPT-5`. Shared identifier extraction needs a model-prefix exclusion so tool/version language cannot trigger fail-closed entity matching.
- `sourceContext.topic` is not reliably structured: Composer fills it with an entire draft or primary text. It can guide retrieval, but Cohesion must not treat it as deletion authority.
- Group/conversation/meeting anchors are associative context, not universal same-source requirements. They should authorize deletion only when at least one candidate actually carries the same source anchor; otherwise topic relevance remains valid across groups.
- Composer recall has already applied the requested work scope. A candidate without an explicit scope must remain unspecified at Cohesion rather than being coerced to `unknown` and then rejected by `allowedScopes=['work']`.
