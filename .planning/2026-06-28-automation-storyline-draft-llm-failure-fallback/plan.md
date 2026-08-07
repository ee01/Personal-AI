# Storyline Draft LLM Failure Fallback Plan

## Target

- Random feature: `Storyline Draft API` from `docs/index.md`
- Canonical doc: `docs/features/memory_storyline_builder.md`
- Reminder check: local Reminders is readable, but the `Personal AI` list is absent; no Reminder item is linked to this run.

## Code And UX Finding

Storyline Draft already has strong evidence-bound fallback behavior when model output underuses or fabricates evidence. A separate failure path remains too blocking: if the LLM call itself rejects, `POST /api/v1/storylines/draft` returns `502`, leaving the user on a dead error state even though the source meeting prep, cue cards, evidence refs, and deterministic fallback renderer are available.

As a user, this is confusing because the page has enough grounded material to produce a reviewable internal draft. The safer behavior is not optimistic success; it is a visible fallback draft with a receipt that says the model generation failed, the service used cue cards/evidence refs, and the result is still manual-copy only.

## Industry And Paper Scan

- Microsoft Teams Intelligent Recap separates generated notes, recommended tasks, speakers, topics, and recap availability by policy/prerequisite state, which supports making generation mode and degraded availability explicit instead of presenting a blank failure.
- Google Meet "take notes for me" documents consent, host controls, sharing settings, and reasons summaries can be incomplete or not generated, which supports a visible fallback/recovery state when generation is partial.
- Evidence-based generation surveys emphasize traceability and verifiability; Storyline should keep fallback drafts tied to refs and Evidence key rather than using model artifact text when generation fails.
- Source-attribution evaluation research shows citations need factual verification, not just visible links; this supports preserving the existing review gate and no-write boundary for fallback drafts.

## Implementation Steps

1. Add an explicit `llm_generation_failed` fallback reason to Storyline draft receipt types.
2. Catch only the draft LLM call failure inside `StorylineDraftService.createDraft`, then normalize an empty response through the existing cue-card fallback path.
3. Add a fallback risk note that explains model generation failed and Evidence key review is required before external sharing.
4. Update the Draft page fallback warning copy so `llm_generation_failed` is distinct from invalid/under-cited model output.
5. Update API and E2E checks to cover the new fallback receipt and visible warning.
6. Update `docs/features/memory_storyline_builder.md` with the current fallback contract.

## Validation Plan

- `npm --prefix memory-service test -- --run src/__tests__/api-storylines.test.ts`
- `npm start` until the first successful compile, then stop the watcher
- `node tools/verify-storyline-draft-page-e2e.mjs`
- `npm run verify:i18n`
- Scoped `git diff --check`
