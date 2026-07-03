# Google Slides filter empty-state guidance plan

## Scope

Randomly selected feature: `Google Slides 项目分析器`.

This run stays in the result-page review/writeback path. It does not change the Google Slides API payload builder, Jira lookup, Memory Service integration, or the toolbar single-flight flow.

## External reference signals

- Google Workspace Gemini sources make source scope user-visible and warn that generated answers still need checking, so filtered views should preserve source/writeback boundaries instead of showing a generic empty state.
- Google Slides `batchUpdate` validates subrequests before applying them atomically, so the UI should keep "no selected fields" and "no matching filter" separate from writeback execution.
- Copilot in PowerPoint positions generated presentations as drafts that users review and edit, reinforcing that the page should guide the next review action rather than implying automation is finished.
- Slide4N and NB2Slides both support human-AI collaboration over fully automatic slide creation; the result page should reduce review friction while keeping user control over writeback.

## Problem

The Slides Analyzer already has strong writeback receipts, partial-success handoff, source evidence, and hidden-selection warnings. The weaker path is when a user switches filters after clearing selections or when a filter has no matching suggestions. The page currently shows a generic `当前视图没有匹配的更新建议。`, which does not say whether analysis failed, whether anything was written, or what the fastest next action is.

## Plan

1. Add a filter-specific empty-state helper in `src/modals/slides-analysis.tsx`.
2. Show the helper inside the suggestions list when the current filter has no matching suggestions.
3. Include concise next-step buttons for likely recovery paths: restore high-confidence defaults, view all, view review fields, view risk, or view blocked fields.
4. Keep action boundaries explicit: no empty filtered view reanalyzes the deck, writes Slides, writes Jira, or writes Memory Service.
5. Extend `tools/verify-google-slides-analyzer-e2e.mjs` to cover the selected-filter empty state after clearing choices.
6. Update `docs/features/google_slides_analyzer.md` with a concise current-behavior note.

## Verification

- `npm run verify:google-slides-analyzer`
- `npm start` first successful compile, then stop watch
- `npm run verify:google-slides-analyzer:e2e`
- Scoped `git diff --check`
