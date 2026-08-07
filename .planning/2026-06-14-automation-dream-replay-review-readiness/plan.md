# Dream Replay Review Readiness Plan

## Selected feature

- Index row: `梦境重放` / Memory Service / `docs/memory_system.md`
- User-facing surface: `memory-exploring.html#/dreams`

## Current state

- `GenerativeReplay` writes weekly dream markdown files with narrative, insights, risks, low-confidence relationships, and a grounding receipt.
- `DreamInsights.vue` loads recent `dreams/*.md` files, keeps partial failures visible, expands notification deep links, and shows per-dream grounding snippets when available.
- The feature doc already states that Dream output is a low-confidence generative signal and must be reviewed through original memories or reflection before being treated as fact.
- Local Reminders is reachable, but there is no `Personal AI` list on this machine.

## Research signal

- ChatGPT, Claude, Microsoft Copilot, and Letta-style memory products all emphasize inspectable/manageable memory, not invisible conclusions.
- Generative Agents, Reflexion, and MemoryBank support reflection and synthesized long-term memory, but their useful product shape depends on evidence, scope, and review boundaries.

## Gap

The Dreams page shows per-card grounding after expansion, but the list entrance does not summarize how much of the current set is review-ready. A user can see many insights/risks without knowing whether those cards have grounding receipts or are older ungrounded files. If a notification deep link targets a missing dream file, the failed filename should remain visible instead of degrading into a generic partial failure.

## Implementation steps

1. Add overview-level review-readiness counts for grounded dreams and missing/ungrounded receipts.
2. Add a warning banner for loaded dreams that lack grounding or have no recalled evidence, and a targeted warning for a requested dream file that could not be read.
3. Preserve exact failed filenames when `readUserFile` rejects.
4. Add per-card status copy that distinguishes `复核就绪`, `无召回证据`, and `缺证据回执`.
5. Update Dream Replay E2E coverage and the canonical Memory Service feature doc.

## Validation

- `npm run verify:memory-dreams:e2e`
- `npm start` until first successful compile, then stop
- `git diff --check -- src/modals/components/DreamInsights.vue tools/verify-memory-dreams-e2e.mjs docs/memory_system.md .planning/2026-06-14-automation-dream-replay-review-readiness/plan.md`
