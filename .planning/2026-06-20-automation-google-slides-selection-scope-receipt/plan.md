# Google Slides Analyzer selection scope receipt

## Context

- Automation: `真实体验官` / `automation-3`
- Selected feature: `docs/features/google_slides_analyzer.md`
- User persona: a project status deck owner reviewing AI-suggested updates before touching a shared weekly Google Slides deck.
- Browser path: direct webpage-mcp control is not exposed in this session and `mcporter` is not on PATH, so validation will use the repo's unpacked-extension Playwright harness for the Google Slides fixture.

## UX gap

The result page already explains the writeback batch before `应用到 Slides`, but bulk selection actions still rely on transient toast copy:

- `清空选择`
- `恢复高可信默认`
- `仅保留当前视图`

These actions change what will be submitted later. A cautious user moving across filters can lose the toast and wonder whether the deck was re-analyzed, whether hidden fields were still queued, or whether anything was written.

## Plan

1. Add a persistent `选择范围回执` on the analysis result page after bulk selection actions.
2. Make the receipt explicit that the action only changes local result-page selection and does not re-analyze the deck, write Google Slides, or update Jira / Memory Service.
3. Clear the receipt when the user manually toggles individual fields or project-level select-all, so stale bulk-action copy does not describe a newer manual selection.
4. Cover `清空选择`, empty selected view restore, and hidden-selection narrowing in `tools/verify-google-slides-analyzer-e2e.mjs`.
5. Update the canonical feature doc with the selection-scope receipt contract.
