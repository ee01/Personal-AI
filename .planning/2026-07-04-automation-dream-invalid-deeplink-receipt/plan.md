# Dream Replay invalid deep-link receipt

## Target

- Feature: `梦境重放` (`docs/memory_system.md`)
- UI: `src/modals/components/DreamInsights.vue`
- Verifier: `tools/verify-memory-dreams-e2e.mjs`

## Current Gap

`#/dreams?file=...` already supports safe notification deep links, targeted expansion, missing-file warnings, grounding receipts, and review handoff receipts. The remaining gap is invalid `file` parameters: path traversal, nested paths, empty values, and non-Markdown files are safely ignored by normalization, but the page currently reads that as "no requested file." A user coming from a notification cannot tell whether the notification had no target or whether Personal AI rejected an unsafe/malformed target.

## External Signals

- OpenAI Dreaming frames background memory updates as useful only when they remain current and tied to user controls.
- Claude chat search and memory exposes retrieval as visible tool calls and keeps search scoped to projects or all non-project chats.
- Generative Agents and replay research support offline synthesis, but the product surface still needs reflection/retrieval provenance before synthesized memory becomes actionable.

## Plan

1. Track whether a raw `file` query parameter was present separately from the normalized safe dream filename.
2. Show a first-screen `深链已忽略` receipt when the raw query exists but does not normalize to a safe single `.md` dream filename.
3. Keep invalid deep links read-only: do not request the invalid file, do not re-run Dream Replay, do not update digest state, and do not confirm or write memory.
4. Extend the existing Dream Replay E2E to load an invalid deep link and assert the receipt plus non-effect boundary.
5. Update the Dream Replay section in `docs/memory_system.md`.

## Validation

- `node --check tools/verify-memory-dreams-e2e.mjs`
- `npm start -- --progress` until first successful compile, then stop
- `npm run verify:memory-dreams:e2e`
- scoped `git diff --check`
