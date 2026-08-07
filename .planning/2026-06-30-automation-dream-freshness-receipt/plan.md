# Dream Replay Freshness Receipt Plan

## Target

- Feature: 梦境重放
- Source doc: `docs/memory_system.md`
- Main UI: `src/modals/components/DreamInsights.vue`
- Verifier: `tools/verify-memory-dreams-e2e.mjs`

## External Signals

- ChatGPT Memory and Microsoft Recall both make memory/snapshot control and source/freshness state visible near the experience, rather than hiding it behind generated prose.
- Personal information management research around "keeping found things found" emphasizes re-finding context, not just storing a generated artifact.
- Generative Agents shows memory synthesis/reflection can be useful, but its usefulness depends on recency, importance, and retrieval context being handled explicitly.

## Current Gap

Dream Replay already has strong read-only, grounding, notification, and Reflection handoff receipts. The remaining UX gap is freshness: cards mostly expose the filename date, while generated Markdown may contain `_Generated: YYYY-MM-DD_`. If those differ, or if the generated date is missing, the user cannot immediately tell whether a dream is a current digest artifact, an older file, or a historical record with only filename-derived timing.

## Implementation Plan

1. Parse a generated date from dream Markdown and keep filename date separately.
2. Add a compact card-level freshness receipt showing generated date, filename date, date basis, and read-only/staleness boundary.
3. Keep sort/window behavior conservative: the recent-file window still comes from the existing user-file list, while per-card display clarifies the evidence basis.
4. Update the Dream Replay E2E fixture and assertions to cover generated-date and filename-date disclosure, including missing generated-date fallback.
5. Update `docs/memory_system.md` with the new user-visible freshness behavior.

## Validation

1. `node --check tools/verify-memory-dreams-e2e.mjs`
2. `npm start -- --progress` until the first successful compile, then stop the watcher.
3. `npm run verify:memory-dreams:e2e`
4. Scoped `git diff --check`
