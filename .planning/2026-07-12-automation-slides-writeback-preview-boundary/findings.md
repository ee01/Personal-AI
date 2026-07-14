# Findings

## Selection

- Randomized `docs/features/index.md` sample produced `Slides 写回预览` among eligible non-recent feature families.
- `docs/progressing/to-verify.md` is empty.

## Reminders

- AppleScript listed Reminder lists but did not expose `Personal AI`.
- EventKit found `Personal AI` with 4 total items.
- All 4 items are completed historical Doubao / notification / test feedback, unrelated to Google Slides Analyzer or writeback preview.

## External Research

- Google Workspace positions Gemini in Slides as a thought partner for creating, summarizing, and refining slides, and explicitly says users should fact-check/edit generated output and keep control through feedback.
- Google Slides API `batchUpdate` validates requests before applying them atomically; one invalid subrequest can make the whole update fail.
- Microsoft Copilot in PowerPoint similarly frames slide generation as drafting from a prompt/source context, not silent writeback.
- NB2Slides reports that users wanted a human-AI collaboration paradigm rather than full automation for slide generation.
- Microsoft Human-AI Interaction guidance reinforces making system capability and failure likelihood clear during interaction.

## Code And Doc Notes

- `docs/features/google_slides_analyzer.md` already documents the right high-level writeback model: selected fields only, snapshot basis/age, atomic batch, field targets, and skipped/failure handoff.
- `src/modals/slides-analysis.tsx` already gives checkbox-level boundaries, but several action buttons still expose only visible labels without button-level `title` / `aria-label`.
- Best bounded improvement: mirror writeback consequences onto the actual controls for review filters, bulk selection, empty-state actions, hidden-selection actions, review-copy, apply, skipped reselect/copy, and failure-copy.
