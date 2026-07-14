# AR Data Session Hide Boundary Plan

## Target

- Feature: `AR 数据网页叠加`
- Source of truth: `docs/features/ar_data_overlay.md`
- Main implementation: `src/contentScriptWebIntelligence.ts`
- Existing verifier: `tools/verify-ar-data-overlay-e2e.mjs`

## Current State

- `docs/progressing/to-verify.md` is empty.
- Automation memory shows the latest exact run covered Skill Foundry platform sync, so this run avoided that family and selected AR Data after recent-family filtering.
- AppleScript did not list `Personal AI`, but EventKit found the list with 4 total items and 0 incomplete items. No Reminder item is related to AR Data.
- External scan:
  - PixieBrix positions browser extensions as in-browser intervention/augmentation with browser-level visibility and controls.
  - BugHerd keeps annotations pinned to page elements so users retain context.
  - PageGuide grounds LLM help in the DOM with visual overlays so users can verify where a result comes from.
  - Web Augmentation research highlights that browser-side DOM augmenters are brittle when third-party pages change, so control boundaries and maintenance paths need to be explicit.

## Gap

The AR badge `x` action currently deletes the local binding from `chrome.storage.local`, then restores the page. For a binding linked to a repeat AgentTask, that bypasses the editor's detach path and can orphan the Scheduled Messages row. The docs describe the badge action as removing this page's replacement, not deleting the durable binding or pausing the repeat task.

## Plan

1. Add a per-page session hidden state for individual AR bindings.
2. Change the badge `x` action to hide only the current page session, restore the presentation, and preserve binding / AgentTask state.
3. Add pre-click `title` and `aria-label` boundaries for the AR toggle, edit icon, refresh, hide action, and visual overlay.
4. Clear the per-session hidden flag when a binding is explicitly saved from the editor so the new local result can show immediately.
5. Update docs/index to state that badge hide is local to the page session and repeat cancellation must use the editor detach path.
6. Extend `tools/verify-ar-data-overlay-e2e.mjs` to prove session hide does not delete the binding or detach its AgentTask.
7. Verify with `npm start` first compile, `npm run verify:ar-data-overlay:e2e`, and scoped `git diff --check`.
