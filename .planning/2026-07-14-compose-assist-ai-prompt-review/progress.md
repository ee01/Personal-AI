# Progress

## 2026-07-14

- Recovered the original prompt from the current Codex task's prompt history after the initial turn was interrupted.
- Started a read-only Compose Assist AI prompt-enrichment review.
- Completed canonical document scan and identified the frontend/backend implementation path.
- Traced the 700ms input debounce and confirmed Web AI prompt patches/context packs bypass the general composer LLM generation path.
- Inspected the referenced `早晚入园分析` ChatGPT conversation in the existing browser tab and extracted the intended meta-prompt workflow.
- Extracted the full generated research prompt and compared its structure with the current deterministic prompt-patch implementation.
- Ran `npm --prefix memory-service test -- --run src/__tests__/api-composer-assist.test.ts`: 17/17 tests passed.
- Completed a read-only product/code review with a proposed compiler contract, system prompt, privacy boundary, trigger strategy, and validation cases.

## 2026-07-15

- User approved the complete implementation plan.
- Re-read `AGENT.md`, restored the isolated planning files, and checked relevant Compose Assist rollout memory.
- Audited the dirty worktree and confirmed only `src/services/MemoryServiceClient.ts` overlaps this task; its unrelated existing change is isolated and will be preserved.
- Started backend Prompt Compiler and evidence-governance implementation.
- Added the shared `rewrite_prompt` / `insertMode` response contract without disturbing the unrelated Provider feed change in `MemoryServiceClient.ts`.
- Split Web AI assistance from the legacy evidence gate, added an English structured Prompt Compiler contract, language/goal/length validation, optional-memory behavior, and mode-derived insertion semantics.
- Added Web AI evidence placeholder rejection, relevance filtering, id/content deduplication, three-item cap, and draft/page-sensitive high-risk classification.
- Replaced the old user-facing context-pack boilerplate with a concise directly relevant context block; tool-fit and source diagnostics remain debug-only.
- Added locked Context Match evidence-id resolution, then reused the same Web relevance/deduplication cap; locked context does not bypass disabled or absent recall.
- Added the GPT-5-compatible low-reasoning compiler call, compact output contract, strict language/goal/evidence validation, default-on kill switch, and server-owned mode-to-insert-mode mapping.
- Preserved the three deterministic prompt patches and added evidence-only mode normalization for already-explicit non-research deliverables.
- Reworked the frontend lifecycle to real blur only, including send suppression, internal focus boundaries, rich iframe bridging, one-request-per-revision, retained post-blur anchoring, and stale-response rejection.
- Added complete-draft replacement for textarea, input, contenteditable, and rich iframe; snapshots now restore value/HTML/selection exactly, while append mode retains selection semantics.
- Added mode-specific preview, confirmation, success, failure, and undo copy while preserving the hard “never send or submit” boundary.
- Added Chinese childcare and English prompt-rewrite eval cases; updated the legacy context-pack case and banned placeholder/tool/Jira boilerplate in the judge.
- Verified backend API/LLM tests: 29/29 passed; frontend unit tests: 19/19 passed; direct-insert, draft-staleness, and ambient-calibration E2Es all passed.
- Verified `memory-service` build, the first successful `npm start` watch compile, `eval:validate`, and the full `compose-assist --no-repair` suite. Final report: `.eval-runs/20260715T043458Z-compose-assist-9quphb/report.html`.
- Updated `docs/features/compose_assist.md` with the blur trigger, rewrite/append modes, language contract, evidence governance, latency controls, risk boundary, normalization rule, evals, and acceptance cases.
- Retried the Chrome browser binding and ran the prescribed diagnostics. Chrome is running and the native host is valid, but the ChatGPT Chrome Extension is not installed in the selected profile; real-page automation remains the only unfinished acceptance step.
- Re-ran the final Compose Assist API/LLM, frontend unit, and three E2E checks successfully. A later repo-wide `eval:validate` now fails only on five missing-context cases in concurrent untracked `action-readiness-contracts` fixtures; no Compose files or cases are implicated, so those edits were left untouched.
