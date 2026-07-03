# Memory Lens Site Control Live Receipt Plan

## Selected Feature

- Feature: `站点静默/屏蔽/白名单`
- Capability: Memory Lens
- Source doc: `docs/features/memory_lens.md`

## Current State

- `docs/progressing/to-verify.md` has no pending carry-over items.
- Local Reminders is readable, but there is no `Personal AI` list, so no Reminder item is incorporated or marked done in this run.
- Current code already stores site controls in local extension storage and syncs changes into open pages through `chrome.storage.onChanged`.
- Suppressed pages clear the passive Lens bubble and page/visual memory-capture candidates, while active Selection Memory Search remains available.

## External Scan

- Chrome extension permission guidance and `activeTab` patterns support clear, user-initiated, site-scoped access expectations.
- Safari and Grammarly expose per-site extension controls, reinforcing that users expect current-site changes to be visibly explained.
- Browser-extension permission research and contextual-integrity work suggest users misunderstand silent permission/state changes unless the UI names the scope and non-effects.

## UX Gap

When Options or another tab changes Memory Lens site controls for an already-open page, the passive Lens and page-capture affordances disappear or return silently. As a user, that looks similar to a recall failure, an empty result, or extension breakage. The Options page has a persistent receipt, and card menu actions have toasts, but the affected page itself lacks a live receipt for externally-applied site-control changes.

## Implementation Plan

1. Add a current-page site-control sync receipt in `src/contentScriptWebIntelligence.ts`.
   - Show it only for storage-driven transitions that affect the current page.
   - Suppress duplicate sync toasts immediately after the same page triggered the control action.
   - On suppress: say which rule blocked the current page and that passive Lens/page recall/page capture stopped.
   - On restore: say passive Lens/page capture will be re-evaluated.
   - Always state active selection search remains available and no memory is deleted, synced, or externally sent.

2. Extend `desktop-app/scripts/webpage-memory-detection-check.mjs`.
   - In the live storage sync E2E, assert a blocking sync toast appears after service-worker storage change.
   - Assert no new passive recall request occurs while blocked.
   - Assert a restore sync toast appears when the site is unblocked and the bubble returns.

3. Update `tools/verify-webpage-memory-detection.ts`.
   - Add source-level assertions for the new live receipt copy and duplicate-toast guard.

4. Update `docs/features/memory_lens.md`.
   - Document that open pages show a live site-control receipt when Options/another page changes the effective control state.

5. Verify.
   - Run syntax/source verifier.
   - Run `npm start` until the first successful compile, then stop it.
   - Run the Memory Lens webpage E2E.
   - Run scoped `git diff --check`.
