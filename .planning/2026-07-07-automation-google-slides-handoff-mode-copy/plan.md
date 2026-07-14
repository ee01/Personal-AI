# Google Slides 跳过接管清单复制回执

## Target

- Feature: `Slides partial success skipped reasons`
- Source doc: `docs/features/google_slides_analyzer.md`
- Main UI: `src/modals/slides-analysis.tsx`
- E2E: `tools/verify-google-slides-analyzer-e2e.mjs`

## Context

- `docs/progressing/to-verify.md` is empty.
- Automation memory shows recent runs covered Compose Assist, Ask topic locking, Memory Timeline, Meeting Pilot, User Profile, Doubao, and several trust-boundary surfaces; this run should avoid repeating those.
- AppleScript did not list `Personal AI`, but EventKit found it with 4 total items and 0 incomplete items. No Reminder item is related to Google Slides Analyzer.
- Product / research scan:
  - Google Slides `batchUpdate` validates each request before applying and fails atomically if any request is invalid.
  - Gemini in Slides and Copilot in PowerPoint keep generated slide content reviewable before insertion/use.
  - NB2Slides / Slide4N-style research supports human-AI collaboration over full slide automation.

## Improvement Plan

1. Preserve current writeback semantics and only improve the handoff copy path.
2. Add per-item handling mode to copied skipped handoff packets:
   - `可重选`: this field can be restored to the local selection, without retrying automatically.
   - `人工核对`: the reason was not uniquely matched to a submitted field, so the user must inspect Slides manually.
3. Add per-item non-confirmed status to copied full-failure packets.
4. Extend the existing Google Slides analyzer E2E to assert copied checklist text, not only on-page badges.
5. Update the feature doc and index line with the concise behavior boundary.
6. Verify with targeted analyzer checks, first successful dev compile, E2E, and scoped whitespace checks.
