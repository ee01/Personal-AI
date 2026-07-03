# Storyline Draft Generation Receipt Findings

## Initial Findings

- Random accepted target: `Storyline Draft API` from `docs/features/index.md`.
- Feature owner/capability: Memory Storyline Builder.
- Source document: `docs/features/memory_storyline_builder.md`.
- Local Reminders scan returned `NO_PERSONAL_AI_LIST`; no Reminder feedback can be applied or completed in this run.
- Worktree is broadly dirty from prior automation/user work. Keep this run scoped to Storyline API/page/docs/tests plus planning and automation memory.

## Code And UX Findings

- The API already enforces `sourceKind=today_meeting_prep`, blocks missing evidence refs, preserves the user-requested target artifact, and falls back to cue-card segments when the model underuses or invents evidence.
- The page already prevents stale target responses from overwriting a newer target, caches by source/prep/target/audience in `sessionStorage`, gates copy when gaps/risk/grounding issues exist, and exposes evidence links safely.
- UX gap: fallback vs LLM-normalized generation, source evidence count, cited evidence count, missing details, and no-write/no-send boundary are not returned as a stable server-owned receipt. A user can infer fallback only from a risk note, which is easy to miss before reading the generated artifact.
- Implementation target: return a compact `generationReceipt` from `StorylineDraftService.normalizeDraftResponse()` and render it as a first-row `生成范围回执` above coverage metrics.

## External Reference Findings

- Microsoft Teams intelligent recap exposes AI notes/follow-up tasks, share-to-email drafting, and policy/sensitivity constraints; this supports keeping generated narrative output visibly review-before-send.
- Google Meet `take notes for me` requires consent/host controls in some settings and lets hosts configure recipients/sections; this supports explicit generation and sharing boundaries.
- Microsoft PowerPoint Copilot speaker notes requires users to review generated notes and choose keep/discard; this supports manual acceptance for Storyline artifacts.
- Evidence-based text generation surveys emphasize traceability/verifiability through citations and attribution, supporting a server-owned receipt for source refs and fallback mode.
- Recent narrative-structure generation work frames editors as selecting salient moments, verifying claims against evidence, and shaping the narrative, which matches Storyline's role as a grounded draft rather than automatic publication.
