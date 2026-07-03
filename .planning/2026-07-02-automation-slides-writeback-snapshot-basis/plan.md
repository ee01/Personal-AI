# Google Slides Writeback Snapshot Basis Plan

## Scope

- Selected feature: `Slides 写回预览` under Google Slides Analyzer.
- Source doc: `docs/features/google_slides_analyzer.md`.
- Runtime surfaces: `src/modals/slides-analysis.tsx` and `tools/verify-google-slides-analyzer-e2e.mjs`.

## Current Findings

- `docs/progressing/to-verify.md` has no carry-over item.
- AppleScript can enumerate Reminders but does not show `Personal AI`; Swift/EventKit does show `Personal AI` with 4 items, all completed and focused on Doubao / notification sync rather than Google Slides.
- The current feature already has strong field-level receipts: source evidence, hidden selections, atomic batch, partial success handoff, failure handoff, and copyable review packets.
- Remaining UX gap: the top-level analysis snapshot receipt says the data is not live, but the apply area and copied review packet do not keep the snapshot basis adjacent to the final writeback decision.

## External References

- Google Gemini in Slides supports drafting/editing and referencing Drive/Gmail sources, reinforcing that source and review context should stay visible before insertion/writeback.
- Google Slides API `batchUpdate` validates requests before applying and applies subrequests atomically, so snapshot and target confidence should be visible near the submit action.
- Copilot in PowerPoint treats AI output as an editable draft, supporting a review-first flow rather than direct overwrite.
- NB2Slides and Slide4N research both support human-AI collaboration for slide creation, with source linkage and human refinement rather than full automation.

## Implementation Plan

1. Add a reusable writeback snapshot-basis receipt helper.
2. Include the snapshot-basis line in the apply decision receipt, copied review packet, and pending submission receipt.
3. Keep existing writeback payload and Google Slides API semantics unchanged.
4. Update Google Slides Analyzer docs to describe the apply-area snapshot basis.
5. Verify with targeted analyzer tests, dev compile, E2E, and scoped diff check.

