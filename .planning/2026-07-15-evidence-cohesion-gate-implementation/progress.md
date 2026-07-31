# Progress

## 2026-07-15

- Read repository agent instructions and the approved Evidence Cohesion Gate plan.
- Confirmed the intended boundary: consume-time candidate filtering, not raw-memory reclassification.
- Inspected worktree state and found extensive unrelated/parallel modifications, including overlapping target files.
- Created an isolated implementation plan without changing `.planning/.active_plan`.
- Read the repo-specific eval-suite workflow and identified deterministic fixture-based judging as the appropriate first proof.
- Began architecture audit: Reflection has a compact evidence boundary; Context Recall already has mature anchor/suppression logic and response receipts.
- Located `/ask` shared preparation and identified it as the common gate boundary for standard and streaming responses.
- Confirmed compatible evidence shapes across Ask, Context Recall, and Composer Assist.
- Added the shared deterministic-first gate and five focused unit scenarios.
- First test run: 3/5 passed; TypeScript build passed. Logged and fixed claim-slot clustering and weak-unanchored preservation defects.
- Second test run: 4/5 passed. Traced the remaining false-positive selection to shared generic filtering for query terms and claim slots; split those normalization paths.
- Core gate now passes 5/5 focused tests and `memory-service` TypeScript build.
- Completed architecture audit and started `/ask` integration.
- Added shared gating to normal and streaming Ask preparation, prompt evidence, response receipts, and clarification short-circuit. First compile found one type-guard-only error; fix applied.
- Ask test run 1: 32/35 passed. The three regressions shared a latent expansion-anchor cause; restricted Cohesion scene anchors to explicit/locked context.
- Ask focused test run 2: scope regressions passed; historical decision chain still lost a secondary change. Tightened unanchored Ask to preserve every candidate.
- Ask now passes its full 30-test API suite plus 6 core Gate tests. Added an API proof that cross-topic evidence is absent from both response evidence and prompt assembly.
- Completed `/ask` integration and started Reflection Worker integration.
- Reflection Worker now gates before both LLM/fallback reflection and action planning, persists a lightweight markdown/result receipt, and attaches only used evidence refs to action proposals.
- Reflection-focused verification passed: 20/20 tests across Gate, Worker, and Thread Service; TypeScript build passed.
- Completed P0 and started the accuracy/improvement eval suite before expanding to P1.
- Added the registry-backed deterministic Cohesion eval runner, six realistic cases, workflow, and rubric.
- Eval validation run 1 reached the new suite but rejected all six cases for missing generic top-level input context; added `query` from the actual Gate request and retained the failure in the plan log.
- Eval validation now passes all 17 registered suites. The Cohesion suite passed 6/6 cases with a 100 average score and a clean Reader Contract.
- Across polluted fixtures, consume-all leaked 2, 2, 1, and 1 evidence items; the production Gate reduced each to zero while retaining 100% of required evidence.
- Completed the accuracy/improvement eval phase and started P1 `context-recall` integration.
- Added Cohesion at both Context Recall final-display branches, before limit slicing, with a response receipt and autopilot quiet reasons. The first compile found one optional-result narrowing error; converted the blocking helper to a type predicate.
- Full Context Recall regression run found one over-filtered Cursor budget association. The receipt showed an inferred expansion topic had been treated as deletion authority; restricted Gate selection to structured explicit anchors and kept inferred locks as ranking hints.
- Follow-up diagnosis found inferred project `entityHints` were copied into `expandedRequest`; split retrieval input from deletion-authority input so Cohesion reads only the original request's explicit anchors.
- The same distinction was required for query text: Cohesion now receives the original normalized query, while Recall Engine continues using the expanded query.
- Fixed the shared `GPT-5`/Jira-key collision with a model-version prefix exclusion and regression test.
- P1 full verification now passes 37/37 tests across Context Recall API and the shared Gate, including the prior Cursor budget regression.
- Completed P1 and started Compose Assist / Context Pack / Web AI boundary audit.
- The first Composer baseline after P1 had 6/24 regressions. All shared free-text `sourceContext.topic` being mistaken for a confirmed subject; removed that field from deletion authority before adding the Compose-specific Gate.
- Recovered the remaining Composer regressions by making scene anchors evidence-backed, tightening repo-slug detection, and preserving undefined scope. The pre-integration Composer baseline returned to 24/24 passing.
- Added a second consumption Gate in Context Assist so change projections and locked-context fallback cannot bypass Context Recall filtering. Web AI prompt compilation, context-pack rendering, deterministic prompt patches, and generated drafts now receive only gated evidence.
- Added an API regression that injects mixed MTR-141852 and NAV-8891 evidence directly after recall; only MTR reaches the Web AI compiler and the response reports one silent exclusion.
- Compose / Context Pack / Web AI verification passes 25/25 tests and the memory-service TypeScript build.
- Completed phase 7 and started canonical documentation and progressing cleanup.
- Cross-entrypoint regression passed 106/106 tests across Gate, Ask, Reflection, Context Recall, and Composer; TypeScript build passed.
- Added `docs/features/evidence_cohesion_gate.md` and linked the contract from Ask, Memory System, Compose Assist, Evidence Watch, and the feature index.
- Documented the consume-time/no-storage-reclassification boundary, silent normal UI behavior, original-request authority rule, entrypoint failure behavior, and Cohesion-before-Authority ordering.
- Moved the approved demo to `docs/demo/evidence-cohesion-gate.html` and removed the completed plan from `docs/progressing`.
- Added a seventh eval regression so `GPT-5.5` and `Dev/QA` cannot silently manufacture false issue/repository identities.
- Completed canonical documentation and started final verification.
- `eval:validate` passed 19 registered suites. The final `evidence-cohesion-gate` run passed 7/7, average score 100: consume-all baseline leaked 6 cross-topic candidates; Gate leaked 0 while every case retained 100% of required evidence and the Reader Contract had 0 issues.
- The required six-ability `/ask` benchmark was started against a branch-local service and a temporary local snapshot. It exited non-zero only because `temporal-cursor-cost` scored 0.67 versus the 1.0 baseline. The snapshot had 21 messages and 0 Cursor cost records, while the current remote user database has 11,387 messages and 36 such records; this is an invalid dataset comparison, not evidence of a Cohesion regression.
- That benchmark also exposed a safety defect: its normal `/ask` calls created four temporary `delegate_openclaw` attempts and one temporary confirm request. All four delegate attempts timed out; no production database was written. Added explicit `evaluationMode: 'read_only'` to `/ask` and `/ask/stream`, plus a default read-only mode in `eval:memory-abilities`; it suppresses actions, Evidence Watch, answer-memory writes, and Online Reflection. The new API test proves a planner-recommended delegation creates no action, no answer-memory observation, and no external fetch.
- Re-ran Ask API tests after the safety fix: 31/31 passed. TypeScript build passed. The final six-ability benchmark remains pending a current-data isolated runtime.

## 2026-07-16

- Applied the interim user-facing rename from `证据同场门` to `证据同题校验` across canonical feature documentation and the interactive demo; this wording was later superseded by `证据对齐`. Internal API/type identifiers intentionally remain unchanged for compatibility.
- Final cross-entrypoint verification after the read-only safety fix passed 107/107 tests across Gate, Ask, Reflection, Context Recall, and Composer. `eval:validate` passed with 20 registered suites, and the final `evidence-cohesion-gate` run again passed 7/7 with average score 100 and no report-contract issues.
- `git diff --check` passed for the implementation, evaluation, documentation, demo, and planning files.
- Created a fresh read-only local runtime from the current online `esone.qiu` snapshot (11,387 messages and 10,191 chunks); the temporary remote export and local copy were used only for validation and never wrote to the production database.
- The strict six-ability benchmark now passes 6/6 with overall score 1.0: `.eval-runs/memory-abilities/mem-abilities-cohesion-current-exact-20260716/reader-report.json`. The `temporal-cursor-cost` case now requires `Cursor`, the literal `30%`, and the actual `2026-04` formation time, so it cannot pass on an unrelated generic cost answer.
- Diagnosed and fixed the remaining real-data recall gap: an old unchunked raw message held the direct Cursor conclusion, but context locking, archive weighting, MMR, and Active Recall overfetch truncation could hide it. Active historical Ask now permits a bounded raw-message lexical fallback, preserves a direct subject-led claim through both caps, and treats explicit time questions as historical; passive Context Recall and Composer never use that fallback.
- Final verification passed: focused regression 52/52; cross-entrypoint regression 121/121; `memory-service` build; `eval:validate` (20 registered suites); and `evidence-cohesion-gate` 7/7, average score 100. Final specialized report: `.eval-runs/20260716T061233Z-evidence-cohesion-gate-5yvy9b/report.html`.
- Implementation and validation are complete. The temporary evaluation runtime/export must be cleaned up after this record is written; no production deployment is part of this task.
- Renamed the user-facing capability to `证据对齐`. Updated runtime receipts, canonical feature docs, entrypoint references, eval copy, and the demo; internal `EvidenceCohesionGate` / `cohesionReceipt` contracts remain unchanged.
