# Memory Lens Source Open Receipt Findings

## Repo Findings

- `docs/features/memory_lens.md` already describes Expanded Card source links, source status receipts, feedback confirmation/failure, Autopilot boundary receipts, and source URL safety.
- `src/contentScriptWebIntelligence.ts` builds source links through `buildContextRecallSourceLinks()`, source hidden receipts through `buildContextRecallSourceReceipts()`, and source status chips through `buildContextRecallSourceStatusReceipts()`.
- `submitContextRecallAmbientTrace()` already accepts `action: 'expanded' | 'opened_source'`, but current card click handling only calls it for `expanded`.
- `desktop-app/scripts/webpage-memory-detection-check.mjs` already has fixtures for source URL only, sensitive hidden source URL, current-page source status, stale external source status, positive/negative feedback, and Rehearsal feedback.
- Existing E2E validates that source links render and unsafe URLs are hidden, but it does not click source/detail links or assert a post-click receipt.

## External Reference Findings

- Current AI search/memory products emphasize traceable sources and permissions. Slack AI Search and Notion Enterprise Search both present answers/search results with source/citation affordances rather than only model summaries.
- ChatGPT Memory controls and source memory docs emphasize user control over saved memories and source availability; this supports separating "view source" from "learned/confirmed".
- RAG transparency and source-attribution research supports exposing source provenance and user control at the moment users rely on retrieved evidence.
- Chrome extension `activeTab` guidance frames tab access around user gestures and temporary scope; a source-open receipt should similarly bind the action to the user click and avoid implying broader page access or writeback.

## Improvement Plan

1. Add a local `sourceOpenReceipt` state to the Memory Lens card.
2. On source/detail link click, set a receipt with target label, target kind, source status, and non-effect boundary.
3. Record `opened_source` via the existing ambient trace helper.
4. Render the receipt near the card metadata/footer with a stable class for E2E.
5. Extend the source URL-only E2E case to click the original source and memory-detail link, assert receipt copy, and assert `opened_source` feedback detail.
6. Update `docs/features/memory_lens.md` to describe the new source-open receipt.

## Validation Targets

- `npm run verify:webpage-memory-detection`
- `npm start -- --progress`, stopped after first successful compile
- `npm run verify:webpage-memory-detection:e2e`
- `npm run verify:i18n`
- Scoped `git diff --check`
