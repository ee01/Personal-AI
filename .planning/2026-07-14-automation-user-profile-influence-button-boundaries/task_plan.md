# User Profile Influence Button Boundaries

## Scope

- Selected feature: `画像快速增强/降低影响` from `docs/features/index.md`.
- Source document: `docs/features/user_profile_system.md`.
- Runtime surface: `src/modals/components/UserProfilePage.vue`.
- Verifier: `tools/verify-user-profile-export-e2e.mjs`.

## Current State

- `docs/progressing/to-verify.md` is empty.
- Automation memory shows recent sweeps focused on other nearby trust-boundary surfaces; this run avoids the freshest Reflection, Coverage, Meeting ASR, Snooze, Timeline, and similar targets.
- AppleScript did not expose the `Personal AI` Reminders list. EventKit did find the list with 4 total items and 0 incomplete items. The completed items are historical Doubao / notification / test feedback, unrelated to User Profile influence calibration.
- The User Profile page already shows a nearby `校准影响` receipt and post-click calibration receipts for pending, success, partial-confirm failure, failure, and undo states.
- UX gap: the actual `设为重点`, `降低影响`, and `撤销影响力调整` controls do not carry the same pre-click boundary in `title` / `aria-label`, so hover and screen-reader users still have to infer write scope from surrounding text.

## External Scan

- ChatGPT memory controls expose memory summary editing, source inspection, relevance feedback, prioritization/deprioritization, deletion, and history restore. The important product pattern is direct control over remembered facts and priority, with clear distinction between reducing mention/use and deleting source data.
- Claude memory emphasizes project-scoped memory, user control to view/edit remembered content, and import/export for backup or migration. This supports keeping profile adjustments inspectable and reversible rather than hidden in a generic toast.
- Gemini Enterprise personalization exposes a user personalization profile, connected-source controls, saved-memory management, and notes that source changes can take time to apply. This maps to Personal AI needing service-confirmation language before a profile calibration click is treated as active truth.
- `Response-Aware User Memory Selection for LLM Personalization` argues memory selection should consider response utility, not only semantic similarity. This supports importance controls as a quality lever, while making clear that lowering influence is not the same as deleting evidence or old answers.

## Improvement Plan

1. Add a shared helper that builds per-control influence boundary text for:
   - `设为重点`: write `confidence/salience` to 95%, then confirm when needed.
   - `降低影响`: write `confidence/salience` to 25%, without auto-confirming unconfirmed items.
   - pending state: no duplicate submit while the service request is in flight.
2. Attach the helper to both row and prediction queue influence buttons as `title` and `aria-label`.
3. Add a dedicated undo button boundary for `撤销影响力调整`, including pending copy.
4. Update the existing User Profile E2E to assert `title` / `aria-label` parity and key boundary fragments for boost, lower, prediction lower, and undo controls.
5. Update `docs/features/user_profile_system.md` and the matching `docs/features/index.md` row concisely.
6. Verify with:
   - `node --check tools/verify-user-profile-export-e2e.mjs`
   - `npm start -- --progress` until first successful compile, then stop
   - `node tools/verify-user-profile-export-e2e.mjs`
   - scoped `git diff --check`

## Non-Goals

- No backend API changes.
- No changes to profile item update/confirm/delete/restore semantics.
- No changes to `USER_CORE`, provider context, export, evidence refresh, Memory Service writes, or Reminder state.
