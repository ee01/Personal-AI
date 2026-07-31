# Keystone Memory Briefs Findings

## Requirements
- Implement P0 from `docs/progressing/keystone-memory-briefs-plan.md`.
- Reuse the existing Memory Lens floating icon, Hover Peek, and Expanded Card.
- When a trustworthy ready brief exists, make it the primary first-screen content instead of displaying scattered related memories at equal hierarchy.
- Keep raw related memories available under evidence/related-memory detail.
- Fall back to the current Memory Lens card path when no eligible brief exists.
- Preserve current privacy, source, freshness, feedback, cache, Selection Memory Search, Rehearsal, and read-only contracts.
- Update canonical docs and provide concrete local experience steps.

## Initial Product Findings
- The approved plan already defines KeystoneBrief as a cross-source high-signal object and says Lens should show one brief instead of many raw results.
- The plan wording and standalone demo are ambiguous because they also describe adding a brief chip and show a persistent right-side panel.
- The implementation target is a presentation hierarchy change inside the existing Lens shell, not a parallel surface.

## Technical Findings
- The worktree is heavily dirty (128 tracked files changed plus many untracked task directories); relevant overlapping files include `src/contentScriptWebIntelligence.ts`, `src/services/MemoryServiceClient.ts`, `docs/features/memory_lens.md`, `desktop-app/scripts/webpage-memory-detection-check.mjs`, `evals/registry.yaml`, and `package.json`.
- Existing Memory Lens contracts already support presentation states `ready | partial | blocked` through `LensPresentationCompiler`, preserve current-vs-cache receipts, and keep ordinary candidates intact; Keystone matching should attach an optional presentation object rather than mutate recall ordering.
- Repository policy requires focused service tests, a first successful `npm start` compile for extension changes, Memory Lens E2E, canonical feature-doc updates, and an eval suite when value depends on synthesis/recall quality.
- The existing Source Memory Distiller established a useful precedent: deterministic persisted metadata, Context Recall consumption, and canonical-doc migration after implementation.
- `memory-service/src/routes/contextRecall.ts` owns the passive route response; `ContextRecallService` already compiles `lensPresentation` before display filtering.
- `src/contentScriptWebIntelligence.ts` owns `showContextBubble()` and the Rest/Hover/Expanded Card DOM, while `src/services/MemoryServiceClient.ts` carries the extension response contract.
- Stable verification surfaces are `tools/verify-webpage-memory-detection.ts`, `desktop-app/scripts/webpage-memory-detection-check.mjs`, and `memory-service/src/__tests__/api-context-recall.test.ts`.
- Migrations currently reach `051_action_readiness_contracts.sql`, which is untracked concurrent work; select a later migration number only after checking other untracked migrations to avoid collision.
- The eval registry already has `context-recall` and `scene-memory-autopilot`; Keystone requires its own registered suite because usefulness depends on multi-source synthesis and authority/freshness judgment.
- `contextRecallRoutes` constructs `ContextRecallService` with the current per-user SQLite database, then adds weave provenance after service recall. This is a clean place to attach an optional Keystone presentation after ordinary recall has finished, without changing recall ranking.
- The passive route has timeout/overload/disabled fallbacks that return empty `ContextRecallResponse`; Keystone attachment must stay inside the normal result path and must never make those fallbacks block.
- Memory-service routes are registered directly in `server.ts`; a dedicated Keystone CRUD/event route can follow the same per-user `request.userContext.db` pattern.
- Migrations are filename-sorted and tests apply all SQL files to an in-memory database, so a new migration plus repository/service tests can run without bespoke fixture setup.
- `ContextRecallResponse` currently carries matches, topMatch, scope receipt, autopilot, weave, and debug. A new optional `keystoneBrief` field can preserve ordinary matches exactly while giving the client one promoted object.
- Existing `ContextRecallMatch` already includes source links, summaries, actions, timestamps, authority-like evidence roles, and `lensPresentation`; Keystone source references can point back to these match IDs without duplicating raw content in the response.
- The current dirty diff in `src/contentScriptWebIntelligence.ts` is limited to control-boundary labels around Expanded Card feedback/source actions. Keystone rendering should avoid rewriting those helpers and should wrap only the card body/header/pager selection logic.
- Existing Evidence Watch service/route/migration code confirms the repository convention: service-owned interfaces and SQLite mapping, direct Fastify routes, explicit read/write receipts, and JSON columns for structured contracts.
- The extension defines a separate mirrored Context Recall contract in `src/services/MemoryServiceClient.ts`; backend and extension Keystone types must be updated together.
- `src/contentScriptWebIntelligence.ts` already has a local response payload adapter, cache normalization, and a single `showContextBubble()` renderer. The optional brief must be threaded through those existing calls/cache entries rather than fetched by a second client request.
- Use a new dedicated API test file instead of adding to the already large and concurrently edited `api-context-recall.test.ts`; shared test setup applies all migrations automatically.
- Some concurrently edited files show duplicated in-progress lines in the current working copy. Treat these as external work and avoid broad formatting or cleanup; only address them if they directly prevent required verification after confirming the exact current text.
- Passive responses are cached in `ContextMatchCacheEntry` and replayed without another request. The cache needs to preserve `keystoneBrief`, otherwise a focus/hash revisit would regress from brief-first to raw-card UI.
- `showContextBubble()` receives matches plus an options object containing autopilot, recall basis, and recall context. Add the brief to this options object and keep the first raw match as the feedback/source anchor.
- The background/client path already sends the entire typed `ContextRecallResponse` through `CONTEXT_RECALL_REQUEST`; no new extension message type is required.
- Hiding or negative-feedback on a brief must not masquerade as raw-memory deletion. P0 can write a dedicated brief event while leaving ordinary match feedback attached to individual evidence only when the user explicitly acts on evidence.
- The approved plan's data contract already specifies subject/scope/status, source-as-of, freshness, typed slots, source map, scene anchors, display policy, and non-write receipt. Implement that contract rather than inventing a reduced summary-only shape.
- Existing `anticipation_briefs` are an expiring, consume-once derived cache for likely future questions. Keystone briefs are durable, source-grounded, evolvable assets and therefore should not reuse that table.
- P0 matching can be deterministic against stored scene anchors and brief text; composition/mining can be exposed as an internal upsert endpoint and service method, with readiness enforced by source coverage and authority rules. This delivers a complete trustworthy presentation loop while keeping passive recall free of LLM latency.
- Final presentation state mapping: `ready` is primary; `partial` is primary only with a visible conflict warning and no external-copy affordance; `stale` is a warning above the ordinary raw card; `blocked`, `hidden`, absent, or low-confidence results do not alter current Lens rendering.
- The current Lens renderer is structured enough to add a brief branch without forking the entire dialog: keep `match`/`view` for provenance and source-open controls, derive a `briefView`, substitute Peek/title/body/meta/pager markup when primary, and render a stale notice before the ordinary body when warning-only.
- When a brief is primary, the current raw-match pager should be hidden from the footer and exposed behind an in-card `查看关联记忆 N 条` toggle. This preserves evidence without placing raw cards at equal hierarchy.
- Existing feedback handlers are tightly coupled to raw matches and the negative-feedback drawer. Use dedicated brief controls (`有用`, `不准确`, `隐藏简报`) with dedicated events; retain raw thumbs only when the user opens an individual evidence memory.
- Expanding the existing floating icon is the correct place to record a brief `opened` event. Hiding/not-accurate should remove the brief from the current cache entry and immediately rerender the same Lens shell with ordinary memories, not remove the bubble.
- `src/background.ts` currently whitelists and forwards selected Context Recall fields, so it must explicitly include `keystoneBrief`; it is also the appropriate proxy owner for a new `KEYSTONE_BRIEF_EVENT` message.
- Memory service uses per-user SQLite contexts; Keystone rows do not need a `user_id` column for isolation, but API responses may include `request.userId` when useful.
- Existing `AnticipationService` demonstrates injectable synthesis. Keystone should likewise separate candidate evidence collection from composition so tests can inject deterministic output and passive matching remains synchronous.
- The P0 write boundary can be implemented with explicit create/update and event routes protected by the existing general write guard; context recall matching remains read-only.
- Eval infrastructure dispatches by suite ID and rejects unimplemented suites. Add a narrow `keystone-memory-briefs` branch plus a dedicated TypeScript case runner modeled on Scene Memory Autopilot; avoid touching unrelated runner/report logic.
- Eval validation requires a registered suite, workflow with `Report Requirements`, nonempty JSONL cases, and explicit input/expected behavior. The planned five cases map cleanly to deterministic service-level fixtures.

## Decisions
| Decision | Rationale |
|---|---|
| Keep matching deterministic before any optional composition | Scene identity, freshness, source coverage, and eligibility should be replayable and testable. |
| Do not mutate ordinary recall results | The brief is an optional presentation object layered over existing candidates, allowing exact fallback. |
| Prefer new backend files and a narrow Lens adapter | This minimizes conflict with concurrent dirty changes while preserving existing behavior. |

## Issues Encountered
| Issue | Resolution |
|---|---|
| Existing root planning files and another active plan | Created an isolated `.planning/2026-07-15-keystone-memory-briefs-implementation/` record without changing the active pointer. |
| Relevant runtime and verifier files already modified | Inspect each working diff and merge only around stable contracts; do not revert or rewrite unrelated sections. |

## Resources
- `AGENT.md`
- `docs/features/memory_lens.md`
- `docs/progressing/keystone-memory-briefs-plan.md`
- `docs/progressing/keystone-memory-briefs-demo.html`
