# Rehearsal List Card Selection Boundary

## Context

- Automation: `轮询检查改进每个功能`
- Selected feature: `未来场景预演记忆` / Rehearsal
- Feature docs: `docs/features/rehearsal.md`, `docs/features/index.md`
- Main surface: `src/modals/components/RehearsalsPage.vue`
- Verifier: `tools/verify-rehearsals-page-e2e.mjs`

## Reminder Check

- AppleScript listed local Reminder lists but did not expose `Personal AI`.
- EventKit found `Personal AI` with 4 total reminders and 0 incomplete reminders.
- No Reminder item is related to this run, so no Reminder will be marked done.

## External Scan

- Apple Reminders supports time, location, messaging-person, Calendar, URL/app return, and Apple Intelligence reminder suggestions; this reinforces that cue and reminder context should be visible before the user acts.
- ChatGPT Scheduled Tasks exposes a dedicated management page, pause/resume/edit/delete controls, task limits, monitoring behavior, and paused-state reasons; this reinforces management controls that distinguish read/navigation from mutation.
- 2026 context-aware reminder authoring research shows natural-language reminder intent is diverse and ambiguous, and benefits from structured cue/state representations.
- Prospective-memory / implementation-intention research supports the same cue-action binding: the user needs to know which future cue and action are being managed.

Sources:

- https://support.apple.com/en-us/102484
- https://help.openai.com/en/articles/10291617-tasks-in-chatgpt
- https://arxiv.org/abs/2605.23085
- https://pmc.ncbi.nlm.nih.gov/articles/PMC4500900/

## Gap

The Rehearsal management list already shows status, cue strength, prompt eligibility, and non-execution text inside each card. However, each list card is itself a clickable `<button>` that selects a detail record. Before click, hover and screen reader users cannot tell that selecting the card only changes the local/detail focus and does not activate, pause, archive, mark feedback, patch cues, write external systems, or execute the rehearsal script.

## Plan

1. Add a shared card selection boundary helper in `RehearsalsPage.vue`.
2. Mirror that helper into `title` and `aria-label` for every `.rehearsal-card`.
3. Keep the helper derived from existing title, status, prompt eligibility, cue summary, and selection state.
4. Extend `tools/verify-rehearsals-page-e2e.mjs` to assert active, stale, cue-less, and weak-cue card boundaries.
5. Update `docs/features/rehearsal.md` and `docs/features/index.md` concisely.
6. Verify with syntax check, first successful dev compile, Rehearsals E2E, and scoped diff checks.

## Boundary

This is presentation/accessibility-only. It must not change Rehearsal API calls, lifecycle writes, activation matching, cue scoring, list pagination, deep-link focus, action handling, Memory Service state, external systems, or Reminder state.
