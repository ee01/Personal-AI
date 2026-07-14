# Dream Replay Review Filter Plan

## Target

- Selected feature: `梦境重放` from `docs/features/index.md`.
- Source doc: `docs/features/memory_system.md`.
- Primary UI: `src/modals/components/DreamInsights.vue`.
- Verifier: `tools/verify-memory-dreams-e2e.mjs`.

## Selection Notes

- `docs/progressing/to-verify.md` is empty.
- Randomized candidate list first hit `今天排序与噪声控制`, but Today Pilot is a fresh automation family today, so the run moved to the next viable target.
- Dream Replay is not a backend rewrite target here; the improvement is the review path after low-confidence dreams are already loaded.
- EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items, so no Reminder item is incorporated or marked done.

## External Scan

- OpenAI's 2026 Dreaming update frames memory synthesis around freshness, continuity, relevance, and background consolidation.
- Generative Agents uses reflection to synthesize experiences into higher-level inferences that later guide behavior.
- Brain-inspired replay literature supports offline replay for consolidation, but it also argues against treating replayed output as direct current truth.
- Human-AI review-bias research shows that review workflows should make correction effort and verification paths explicit, or users may over-accept AI suggestions.

## UX Gap

Dream Replay already displays counts for priority review, evidence-ready dreams, and missing-evidence dreams, but the list remains an all-card scan. A user who wants to act on "优先复核" or "缺证据" must manually inspect every card. That weakens the review path without changing any backend logic.

## Implementation Plan

1. Add a local review-view filter with `全部`, `优先复核`, `可带证据`, and `缺证据`.
2. Show a compact filter receipt with visible/total counts and a no-side-effect boundary.
3. Render the dream list from the filtered set and provide an empty filtered-state recovery button.
4. Extend the Dream Replay E2E to assert filter switching and no-write boundary copy.
5. Update canonical docs and index row.
6. Run `node --check`, `npm start` to first successful compile, Dream E2E, and scoped `git diff --check`.

## Non-Goals

- Do not change `GenerativeReplay`, `dream_runs`, digest scheduling, notification payloads, grounding parsing, Reflection filtering, profile writes, Rehearsal creation, actions, or external sends.
