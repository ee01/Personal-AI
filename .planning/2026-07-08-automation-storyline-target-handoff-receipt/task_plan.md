# Storyline target handoff receipt plan

## Target

- Feature: `Storyline Draft 页面` in `docs/features/memory_storyline_builder.md`.
- Surface: `memory-exploring.html#/storylines/draft`.
- Reminder state: EventKit found the `Personal AI` list with 4 total items and 0 incomplete items, so no Storyline-related Reminder item needs implementation or completion.

## External signals

- Microsoft Teams recap exposes AI summaries, follow-up tasks, copy/share limits, sensitivity labels, and recipient editing before sending recap email.
- Google Meet `take notes for me` exposes eligibility, consent, Drive/Calendar ownership, organizer email, sharing defaults, language limitations, and host/admin controls.
- Evidence-based text-generation research emphasizes traceability and verifiability for generated outputs.
- Author-centric storytelling research argues that generative narrative workflows should preserve author intent and structured constraints.

## Improvement

Add a first-screen `输出目标回执` to the Storyline Draft workbench after the generation/cache receipts and before coverage metrics.

The receipt should:

1. Name the selected output artifact and audience.
2. Explain the intended handoff path for the selected target.
3. State that changing target only regenerates this page's draft and resets review/copy state.
4. Repeat the no-write/no-send/no-history boundary so the segmented control is not mistaken for a platform writeback selector.

## Implementation scope

- `src/modals/components/StorylineDraftPage.vue`: add computed target receipt metadata, render the receipt, and style it.
- `tools/verify-storyline-draft-page-e2e.mjs`: assert the receipt appears for Slides and RingCentral post target changes.
- `docs/features/memory_storyline_builder.md`: document the output target receipt in the Draft page section.
- `docs/index.md`: keep the feature row concise and current.

## Verification

1. `node --check tools/verify-storyline-draft-page-e2e.mjs`
2. `npm start -- --progress` until first successful compile, then stop.
3. `node tools/verify-storyline-draft-page-e2e.mjs`
4. Scoped `git diff --check` for touched files.
