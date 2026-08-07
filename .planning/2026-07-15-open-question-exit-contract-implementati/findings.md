# Findings & Decisions

## Requirements
- Implement the approved `Open Question Exit Contract` plan, adjusted so Today Pilot is the proactive presentation surface.
- Most behavior must live below the UI: question identity, lifecycle state, duplicate suppression, owner handoff, resume triggers, and auditability.
- Do not add a top-level page, retirement dashboard, daily inbox, or default Quick Ask status block.
- Today Pilot may show only resumed questions with new evidence and concrete relevance to today, presented as normal missions with a concise reason.
- Existing Reflection/Action surfaces may expose small receipts for auditability, but should not become management screens.
- Preserve unrelated user changes in the dirty worktree.

## Research Findings
- `AGENT.md` explicitly prefers autonomous internal reflection mechanisms and reversible receipts over new user review queues; this supports a backend-first lifecycle contract.
- Complete features whose value depends on ranking or LLM judgment require a registered `evals/` suite, one real run/report, and iteration until passing.
- Pure Memory Service changes should start with service-local tests; branch validation may then promote to a deployed or local live service check.
- The prior capability plan and rollout record define the feature as an embedded lifecycle protocol, not a governance page.
- Canonical Today Pilot behavior already treats the surface as a daily attention filter, making it the correct proactive consumer for evidence-driven resumptions.
- The existing plan still contains obsolete Quick Ask aggregate/status presentation language that must be removed during the docs/demo handoff.
- The worktree contains broad, unrelated in-progress changes. Critical overlapping files include `ReflectionThreadService.ts`, its tests, `ActionRepository.ts`, Evidence Watch code/tests/docs, Today Pilot docs/verifiers, and `evals/registry.yaml`.
- Migration `051_action_readiness_contracts.sql` is already present as untracked work; the next migration for this task must avoid `051` and be checked again immediately before creation.
- Root package scripts expose focused Today Pilot and Action Queue verifiers; Memory Service uses Vitest and a direct TypeScript build.
- `ReflectionWorker.generate()` returns `openQuestions` and plans actions from the first question; action params preserve evidence-resolution metadata such as `sourceAnchor`, `gapType`, and `reasonCode`.
- `ReflectionThreadService.runReflection()` currently writes the run with all generated questions, creates/reuses proposed actions, then permanently merges all questions into the thread. The exit decision must occur before those writes if it is to prevent question/action debt rather than annotate it afterward.
- Existing Action Readiness work already adds a pre-create gate for `delegate_openclaw`; the new exit contract should compose before or alongside that gate without replacing readiness checks.
- Existing Evidence Watch preparation provides stable dedupe/idempotency for source-bound checks, but non-watch questions still use run-specific action keys and can grow repeatedly.
- `DayPilotService.scanReflections()` currently admits every active high-priority/due reflection thread. Managed questions therefore need a contract-aware filter: legacy unmanaged threads keep current behavior, while managed threads enter Today Pilot only after a new-evidence resume and only when their impact is `blocking_today`.
- Today Pilot cards already render backend-provided `whyNow`, `nextBestAction`, and an extensible `contextPack`; the approved UX can be implemented without adding or changing a Quick Ask surface and without introducing a new root UI component.
- Replacing rather than merging the managed thread's active question list is necessary after lifecycle evaluation; otherwise a parked question is immediately reintroduced by `updateThreadAfterRun()`.
- The eval runner supports suite-specific deterministic executors; Open Question Exit Contract can follow `evidence-watch-contracts` with a local test DB, avoiding remote/LLM nondeterminism while still producing a standard report.
- Stable action idempotency must include a contract evaluation/resume epoch. A key stable forever would incorrectly suppress legitimate work after new evidence, while the current run-id key permits duplicate growth.
- `checked_changed` must wake the linked reflection thread immediately; merely noticing `authority_changed` during a later reflection leaves recovery dependent on an unrelated heartbeat.
- A worker run with no open questions must not suppress an independently valid action, and multi-question runs must attach the action receipt to the first active question rather than blindly using the first generated question.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Start deterministic-first | Duplicate action/confirm ownership and evidence freshness are replayable facts; LLM output should not be the sole gate. |
| Treat retirement as eligibility, not deletion | Keeps evidence, history, and recovery triggers intact. |
| Reuse repository-native verification | The repo has surface-specific service tests and E2E harnesses that should remain authoritative. |
| Evaluate before run/thread/action persistence | This is the only point that can stop stale questions from being re-added and suppress derived actions before queue creation. |
| Compose with Action Readiness and Evidence Watch | Exit decides whether the question may proceed; readiness decides whether an allowed action can execute; Evidence Watch owns source verification. |
| Preserve legacy Today Pilot behavior for unmanaged threads | Existing data has no exit-contract rows; fail-open compatibility avoids silently hiding all current reflection missions. |
| Carry the receipt through Today Pilot's existing card fields | `whyNow`, `nextBestAction`, and `contextPack` provide enough explainability without a new visual surface. |
| Make lifecycle evaluation deterministic | Action/confirm/watch ownership and unseen evidence refs are database facts and can be replayed in tests/evals. |
| Use a per-evaluation action epoch | Suppress reruns without evidence while allowing exactly one new action after an evidence-driven resume. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Initial broad `rg --files` included nonexistent `memory-service/test` and `memory-service/tests` paths | Use the actual `memory-service/src/__tests__` directory discovered in the output. |
| Large overlapping dirty worktree | Treat current file contents as the base, inspect diffs before editing, and keep validation/diff review path-scoped. |
| Full Memory Service build currently fails in unrelated `SourceMemoryCaptureService.ts:1161` | Do not alter concurrent work; use focused test compilation now and rerun the full build during final verification. |

## Resources
- `docs/demo/open-question-exit-contract.html`
- `docs/memory_system.md`
- `docs/features/evidence_watch_contracts.md`
- `docs/features/today_pilot.md`
- `AGENT.md`
- `/Users/Esone/.codex/memories/MEMORY.md` task entry for the original docs-first ideation
- `/Users/Esone/.codex/memories/skills/personal-ai-random-feature-loop/SKILL.md` for repo-native verification ordering

The original `docs/progressing/open-question-exit-contract-plan.md` and demo were retired after implementation; canonical behavior now lives in the feature docs above.
