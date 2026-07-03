# Findings

## Repo Findings

- `docs/features/memory_storyline_builder.md` is current on the main Storyline Draft contract: Draft API only supports Today Pilot meeting prep, returns `generationReceipt`, and the page gates copying when gaps, risk notes, or segment grounding issues exist.
- `src/modals/components/StorylineDraftPage.vue` already sanitizes memory routes and http(s) source links through shared Memory Exploring source-link helpers.
- The page displays blocked labels for unsafe evidence links, but safe external source clicks do not leave a visible local receipt. A user can click `打开来源` and return without a page-level statement that nothing was refreshed, written, synced, approved, or copied.
- `tools/verify-storyline-draft-page-e2e.mjs` already mocks safe and unsafe evidence links, making it the right narrow verifier for this UI change.

## External Scan

- Microsoft Teams Intelligent Recap exposes AI notes, tasks, timeline markers, speakers, topics, and chapters through the Recap tab, keeping generated meeting material tied to navigable evidence moments.
- Google Meet AI note-taking has explicit admin and host/share controls for who can access generated notes.
- Evidence-based text generation research frames citation/attribution/quotation as mechanisms for traceability and verifiability.
- PaperTrail's 2026 claim-evidence provenance study suggests granular provenance can calibrate trust, but also warns that extra detail can clutter the interface. For Storyline, a compact post-click receipt is a lower-cognitive-load improvement than another always-visible panel.

## Decision

Add a compact receipt only after the user opens a safe external source. This keeps the normal draft review UI quiet while making the action boundary explicit at the moment of possible confusion.
