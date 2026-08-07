# 2026-07-13 Automation: Rehearsal Control Boundaries

## Goal

Improve one randomly selected feature from `docs/index.md`: `Rehearsal 管理页`.

Scope is intentionally narrow: make the actual Rehearsal management controls state their read/write/execution boundary before the user clicks, without changing Rehearsal matching, API contracts, lifecycle semantics, or external integrations.

## Plan

1. [complete] Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, feature index, existing Rehearsal doc, implementation, verifier, worktree state, and Reminders.
2. [complete] Research comparable reminder/task/prospective-memory products and papers.
3. [complete] Add control-level `title` and `aria-label` boundaries to Rehearsals page filter/search/refresh/load-more/recovery/cue-editor controls.
4. [complete] Extend `tools/verify-rehearsals-page-e2e.mjs` to assert the new pre-click boundaries.
5. [complete] Update `docs/features/rehearsal.md` and the `Rehearsal 管理页` row in `docs/index.md`.
6. [complete] Run targeted verification: Rehearsals E2E, `npm start` first successful compile, scoped `git diff --check`.
7. [complete] Update automation memory with the selected feature, Reminder result, implementation, docs, and verification.

## Notes

- Existing worktree is broadly dirty from prior automation runs. Only this planning directory plus explicit Rehearsal control-boundary changes are owned by this run.
- Reminder result: AppleScript did not list `Personal AI`; Swift/EventKit found `Personal AI` with 4 total items and 0 incomplete items, all completed historical Doubao/Notification feedback.
- External research signal: products and papers consistently support exposing filter/read scope, pause/resume/delete boundaries, cue-action binding, and reminder source/trigger semantics at the actual control point.
- Verification: `node --check tools/verify-rehearsals-page-e2e.mjs` passed; `npm start -- --progress` compiled successfully after each source adjustment and final compile succeeded in 15894 ms; `node tools/verify-rehearsals-page-e2e.mjs` passed; scoped `git diff --check` passed; process check found no leftover webpack watcher or Rehearsal E2E/browser process.
