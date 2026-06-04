# Storyline Draft Grounding Findings

## 2026-06-04 Initial Findings

- Randomly selected feature from `docs/features/index.md`: `Storyline Draft 页面`.
- Feature owner/capability: Memory Storyline Builder.
- Source document: `docs/features/memory_storyline_builder.md`.
- Local Reminders list scan returned no list named `Personal AI`; no relevant Reminder feedback is available for this run.
- The worktree has broad pre-existing dirty changes. Treat them as user/automation-owned and keep edits scoped to Storyline Draft files plus this isolated plan.
- Previous automation memory shows the adjacent `Storyline 会前提示` feature was just improved with service-side opportunity gating, so this run should not repeat that slice.

## Code And UX Findings

- `StorylineDraftPage.vue` already supports target-specific session cache, stale-request protection, safe evidence links, review-before-copy gating, and clipboard fallback.
- Existing E2E covers stale request protection, evidence link safety, review gate, and copy fallback.
- UX gap: the Inspector lists selected evidence cards, but the top-level scoring does not tell the user whether the selected segment is strongly grounded, thinly grounded, or missing detailed evidence. Users have to count cards and infer source spread manually.
- Service risk: if a future regression returns a draft with no usable evidence-backed segments, the UI could look like a generated draft instead of a blocked/empty grounded output. Add explicit regression coverage.

## External Reference Findings

- NotebookLM Audio Overviews are positioned as source-grounded artifacts with citations/quotes available while users continue working, supporting visible source traceability in draft surfaces.
- Microsoft 365 Copilot meeting features require transcript/chat availability for after-meeting answers and cite which sources were used, supporting clear source-dependency boundaries.
- Narrative-generation research highlights entity coherence as a known long-form generation weakness, which supports per-segment grounding visibility rather than only whole-draft scoring.
- Reflective storytelling-agent research uses structured user models, hallucination-risk indicators, and inspection mechanisms for personalized narratives, supporting explicit risk/grounding indicators in Storyline Draft.
- Collective narrative grounding work argues for provenance-visible, retrieval-first narrative systems, aligning with evidence keys and segment-level grounding summaries.
