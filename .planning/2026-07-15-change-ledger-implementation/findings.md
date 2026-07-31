# Findings & Decisions

## Requirements
- Implement the retained `change-memory-ledger` plan as production code, not another planning-only artifact.
- Broaden the capability from Jira estimate changes to any meaningful state change with a stable subject, before/after state, time, evidence, and authority.
- Cover release-date and Goal changes explicitly; support status, owner, priority, scope, and rollback/reversal patterns.
- Surface the feature contextually as `变化脉络`; do not create a user-maintained review queue.
- Preserve current vs historical vs last-observed vs conflicted boundaries.
- Decide and implement eval coverage under `evals/` when needed, then run and report it.
- Maintain canonical docs under `docs/features/`; after implementation move the demo to `docs/demo/` and remove the progressing plan.

## Research Findings
- The retained plan already defines generic `subjectKey + propertyKey` chains, but its string-only old/new values and Jira Estimate-heavy demo do not support structured Goal scope changes well.
- The existing demo presents a permanent dark Jira side panel, which makes the feature look estimate-specific and audit-console-like. Production UI should use a compact contextual receipt with expandable detail.
- `AGENT.md` requires a new eval suite for complete features whose value depends on recall relevance, temporal reasoning, generated answers, or behavioral drift.
- The worktree contains many unrelated changes and multiple active planning directories; all implementation edits must be path-scoped and preserve existing user work.
- Memory Service used numbered SQL migrations through `051_action_readiness_contracts.sql` at discovery time, but concurrent work later added `052_open_question_exit_contracts.sql` and `053_keystone_memory_briefs.sql`; the final ledger migration is `054_change_memory_ledger.sql`.
- Existing integration seams are `SourceMemoryCaptureService`, `ContextRecallService`, `routes/sourceMemory.ts`, `routes/contextRecall.ts`, `routes/ask.ts`, and `ContextAssistService`/`ComposerAssistService`.
- The repository already has broad API test suites for source memory, context recall, Ask, and Composer Assist, so the feature can extend established harnesses rather than inventing a test runner.
- `ContextAssistService` already converts `ContextRecallMatch` into Compose evidence; a change projection attached to recall matches or response metadata can be consumed without creating a parallel recall stack.
- SQL migrations are applied lexicographically and wrapped in a transaction; a standalone `052_change_memory_ledger.sql` is the repository-native schema path.
- `source_memory_capsules.metadata_json` is already a low-friction place for a non-blocking extraction receipt, while dedicated tables should own queryable event/chain history.
- `SourceMemoryCapsule` is assembled by `SourceMemoryCaptureService`; attaching `changeLedger` there will make create/get/list/note responses immediately useful to the Source Memory UI.
- Source Memory capture already handles duplicate updates and markdown snapshots, so ledger extraction must run after the final capsule text/metadata is known and remain non-blocking.
- Context Recall requests already carry `issueKey`, entity hints, visible fields/facts, source URLs, and interaction-scene data. These are sufficient to query chains for the current subject without broad semantic matching.
- Context Recall has multiple early-return branches for unusable/ambiguous/disabled queries. Change projections should be attached through a single response-finalization helper or independently queried before returns, otherwise the UI would miss changes exactly when no ordinary memory match exists.
- The Context Recall path is latency-sensitive and has a performance test; chain lookup must use indexed `subject_key`/`property_key` reads and avoid LLM work.
- Source Memory create/update/note/dismiss methods all return `getCapsule()`, so enriching `getCapsule()` with ledger data centralizes detail-page API behavior.
- Source Memory duplicate saves can resave dismissed capsules, update notes, or only upgrade metadata. Extraction must be idempotent by source reference and must remove/rebuild that source's events when the stored evidence changes.
- Dismissing a capsule removes its linked recall signal but preserves the capsule. Ledger events from a dismissed capsule should remain auditable yet be excluded from active contextual projection.
- Context Recall already has user-facing cue and Lens presentation contracts. A top-level `changeProjections` response is cleaner than masquerading a change chain as a recalled message, and allows display even when ordinary matches are empty.
- Current context types already include `visibleFields` and `visibleFacts`; authoritative current-page values can be compared to stored chains to label a projection `confirmed_current` or `superseded_on_page` without writing entity truth.
- `ContextRecallResponse` has a stable top-level envelope (`matches`, `topMatch`, receipts, autopilot, weave, debug); adding optional `changeProjections` is backward compatible and avoids polluting ranking counts.
- Source Memory distillation hashes the final evidence text and metadata. Ledger extraction should use its own input hash/receipt to skip unchanged data and should run before/after distillation without feeding its own metadata back into an endless hash loop.
- The context-recall route has timeout/overload/passive guards. Ledger lookup should not compromise route latency; it can be attached inside the service for normal responses and omitted with an explicit absence on overloaded/time-out fallbacks.
- The extension already routes passive Memory Lens through `MemoryServiceClient.contextRecall`; extending that response contract is enough for web/Jira surfaces without a second request.
- `contentScriptWebIntelligence.ts` owns the visible Memory Lens card, styles, receipts, pager, source links, and feedback. The change UI can be a compact section within the existing card rather than a new panel or page.
- The content script currently duplicates context-recall interfaces locally, so backend, client shared types, and local UI contracts must be kept aligned and verified by extension compilation.
- Memory Lens currently refuses to render when there are no displayable ordinary matches. To let a change chain be the only useful context, `showContextBubble` and its call site must accept `changeProjections` as an independent display trigger.
- The card already has compact receipts, expandable details, source links, and a fixed footer. The change section should be inserted after the main content/evidence and before metadata, with one collapsed current-state row and an explicit expand control for history.
- Existing Memory Lens code is already dense; change UI should be implemented with small pure rendering helpers and stable CSS classes rather than further inflating match-view logic.
- `MemoryServiceClient.ts` is the extension-side canonical API type surface and mirrors backend contracts; it needs shared typed values, events, projections, and optional fields on context recall and source-memory capsules.
- The local content-script payload currently normalizes only `matches/topMatch/autopilot`. Its response normalization and all bubble call sites need to preserve `changeProjections`, otherwise backend data will be silently dropped.
- Source Memory client capsules already carry arbitrary metadata, but a first-class `changeLedger` field is preferable for typed UI and avoids forcing the Vue page to parse internal metadata JSON.
- Passive Memory Lens caching currently stores only `match`, `matches`, `autopilot`, and timestamp. To render chain-only context reliably, cache entries must also store projections and the display condition must become `match || changeProjections.length`.
- Selection Search should remain ordinary-memory-only. Change projections are relevant to passive page/Jira context and Compose/Ask, not arbitrary selected-text searches.
- Negative/positive feedback is match-centric; a chain-only card should not expose those controls until a dedicated change-feedback contract exists. It should retain source/open/visibility controls and a read-only boundary instead.
- The Source Memory detail page already prioritizes trust receipts before raw evidence. A new `变化脉络` section should sit after recall/distillation receipts and before note editing, showing extraction status even when no event formed.
- Source Memory dismissal semantics are explicit: the saved evidence remains for review but is excluded from Ask/Memory Lens/timeline recall. The ledger section should mirror this by labeling dismissed-source events historical-only and excluding them from active projections.
- The Vue page imports API types directly from `MemoryServiceClient`, so a typed `changeLedger` capsule field can drive the UI without additional endpoint work.
- Source Memory detail already uses full-width trust panels with compact chips and definition rows. `变化脉络` should follow that visual grammar between distillation and note editing, with one current projection row and native `<details>` history per property.
- The extension and desktop app each mirror context-recall response types. Both need the optional projection contract, but only the extension content script needs rendering behavior.
- Memory Lens currently makes the ordinary match array the card's navigation and feedback identity. A chain-only card should use a local read-only synthetic presentation match while preserving projections as a separate response field; this avoids invasive rewrites of pager and feedback code.
- The Lens renderer already centralizes its HTML in `renderCard()` and CSS in one injected style block. A separate `renderChangeProjectionSection()` can be inserted before source metadata and reused for mixed and chain-only cards.
- The existing cache and dismiss flows accept optional fields safely, but cached display must carry projections explicitly. Otherwise a freshly returned chain appears once and disappears on the next stable-context cache hit.
- Existing Lens feedback handlers query buttons by class after rendering. Omitting the feedback DOM for a synthetic change-only match is compatible as long as the match remains displayable for card layout and source-open behavior.
- Ask centralizes retrieval in `recallForAsk()` and builds `memoryContext` from deterministic recall items plus optional priors. A ledger context block can be appended there for both sync and streaming routes without altering `RecallEngine` ranking.
- Ask already returns structured timelines and evidence, but its system prompt only says to use provided context. Ledger context must explicitly label confirmed current, last observed, historical, conflict, reason evidence, and abstention boundaries so the LLM does not flatten history.
- Because Ask prompt assembly will change, `AGENT.md` requires the memory-abilities regression gate in addition to the new feature eval suite.
- Source Memory routes return service results directly and use shared validation handling; no separate ledger route is required for the first contextual implementation.
- Source Memory API tests clear dependent tables manually. New ledger event/chain tables must be added before capsules in cleanup order to satisfy foreign keys and prevent cross-test state.
- Existing service style keeps typed contracts beside implementation and maps rows explicitly, which is suitable for a standalone `MemoryChangeLedgerService.ts` with exported pure extraction helpers for focused tests.
- Compose Assist receives the full `ContextRecallResponse` but currently converts only `recall.matches` into evidence and returns unavailable when that list is empty. Change projections must be converted into conservative evidence items before filtering/confidence checks.
- Composer recall requests already include issue key and visible fields, so the same context lookup and current-page reconciliation can support Jira comments without a second database query.
- Projection evidence should use existing `context` evidence semantics and a dedicated metadata marker rather than adding a new incompatible evidence type; the snippet can carry a deterministic current/history boundary and source links.
- Compose generation and web-prompt compilation already rely on evidence `snippet`, `whyRelevant`, links, and metadata. A ledger projection represented as a `source_memory` evidence item can flow through current preview/insert boundaries without new UI controls.
- For non-web composers, generated text may be produced by an LLM; projection evidence must be concise and explicitly state that last-observed values are not confirmed current values.
- For web-agent prompts, the existing compiler treats candidate memories as untrusted JSON and preserves preview-only insertion, so change evidence can safely enrich prompts without external writeback.
- Eval registry supports manual deterministic suites with heuristic-only judges and suite-specific tool runners. `change-memory-ledger` should be manual initially because extraction rules are deterministic and source schemas will evolve deliberately.
- The eval should cover at least release-date changes, Goal structured diffs, Jira reversals, conflict/authority handling, UI-noise filtering, adjacent-subject isolation, and Ask/Compose wording boundaries.
- LLM judge is not needed for the initial suite if the runner asserts typed events/projections and required/forbidden answer phrases; this keeps the gate reproducible.
- Existing local eval suites use one JSONL case per line, a suite-specific TypeScript runner that emits normalized JSON, and dispatch branches in `tools/eval-run.mjs`.
- The eval report reader treats numeric score values on a 0-3 scale for proof badges, so the deterministic ledger runner should emit `3` for passed dimensions and `0` for failed dimensions while retaining a 0-100 `overallScore`.
- The suite can directly exercise the exported projection-to-Compose evidence adapter as well as service prompt formatting, avoiding an LLM dependency while still testing the exact boundary strings consumed by Compose and Ask.
- Adding the suite requires four pieces: cases, workflow, registry entry, and `eval-run.mjs` dispatch to a new `tools/eval-change-memory-ledger.ts` runner.
- Reports already normalize status/scores/actualOutput from custom runners, so the new runner can directly exercise `MemoryChangeLedgerService` and Context Recall/Compose helpers against an in-memory migrated DB.
- Several required integration files already contain unrelated in-progress work: persona projection in types/client/Context Assist, action readiness in client/evals, Ask continuity, and trust-boundary copy in Memory Lens/Source Memory. Patches must target current symbols and preserve all existing additions.
- Large new logic should live in new owned files (`MemoryChangeLedgerService`, migration, tests, eval runner, feature doc). Existing dirty files should receive only imports, optional fields, and narrow call-site changes.
- Migration `051_action_readiness_contracts.sql` and later concurrent migrations are untracked; this feature owns only `054_change_memory_ledger.sql` and must not modify the others.
- The desktop daemon has a second context-recall client contract in `desktop-app/src/memoryServiceClient.ts`; its optional response field must stay aligned even though it does not render the extension card.
- The extension cache entry is a local interface and several optimistic feedback paths construct it directly. `changeProjections` must therefore remain optional or receive a default in every construction path.
- The eval dispatcher has a dedicated `scene-memory-autopilot` branch and report labeling hooks. The new deterministic suite can follow that custom-runner path without touching generic LLM judging.
- The shared test database applies every migration in-memory, so a focused service test can validate schema, extraction, chain rebuilds, dismissal, and projection without booting the full API.
- `ContextRecallService.recall()` ends as a single large method but contains many early returns. A public wrapper plus private `recallBase()` is the lowest-risk way to attach ledger projections to every normal response without duplicating lookups at each branch.
- `SourceMemoryCaptureService.getCapsule()` is the central mapper and all create/update/dismiss flows return through it. Adding one ledger service property, a non-blocking refresh call after writes, and one optional response field keeps the integration localized.
- The first persisted schema will keep generic source references rather than foreign-keying only to Source Memory, because later message/Jira/meeting ingestion must use the same event model. Source Memory still supplies the initial ingestion hook and audit UI.
- The persisted chain is an evidence-derived projection, not an authoritative entity record. Current-page visible values are reconciled at read time and must never silently rewrite the chain.
- `ContextRecallCurrentContext.visibleFields` and `interactionScene.visibleFacts` both expose name/value pairs, so reconciliation can normalize aliases and compare typed display values without a new request field.
- The Source Memory service is synchronous and already runs distillation synchronously after writes. Ledger extraction should also be synchronous and deterministic, but wrapped as non-fatal so a ledger failure cannot make memory capture fail.
- The memory-service TypeScript configuration is strict. All row mappers and JSON parsing in the new service need explicit types; tests are excluded from production compilation.
- Reversal detection must seed its seen-value set with the first event's old value; otherwise a two-event `A -> B`, `B -> A` sequence looks like two unrelated new values.
- If dismissing the only source removes the active chain row, Source Memory detail still needs a source-local historical projection built from inactive events. Audit visibility cannot depend on an active projection row.
- Change extraction must normalize one line at a time. Collapsing all whitespace before splitting erases UI-noise boundaries and can also join unrelated field changes.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use typed values plus structured field diffs | Scalar strings are insufficient for Goal target/scope/success-metric changes and set-valued relationships |
| Keep event log separate from current entity projection | Historical evidence must remain auditable and must not silently overwrite confirmed truth |
| Prefer deterministic extraction first | Clear old/new syntax, dates, statuses, and explicit Chinese/English change phrases are cheaply testable and reduce false positives |
| Add LLM extraction only behind a schema/eval gate if existing infrastructure makes it safe | Ambiguous prose needs evidence anchors and quality checks; it must not block the deterministic feature |
| Accept explicit `metadata.changeEvents` before text parsing | Connectors can provide typed field changes with higher confidence and Goal changes can yield several property events |
| Return an extraction receipt even when no event is formed | Users need to distinguish “checked, no stable change” from “feature did not run” on Source Memory detail |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Existing `docs/progressing` plan remains framed as narrow P0 Jira work | Treat it as historical design input; canonical docs and implementation will reflect the user-approved generic boundary |

## Resources
- `AGENT.md`
- `docs/progressing/change-memory-ledger-plan.md`
- `docs/progressing/change-memory-ledger-demo.html`
- `memory-service/src/core/SourceMemoryCaptureService.ts`
- `memory-service/src/core/ContextRecallService.ts`
- `src/contentScriptWebIntelligence.ts`
- `src/modals/components/SourceMemoryDetailPage.vue`
- `evals/registry.yaml`
