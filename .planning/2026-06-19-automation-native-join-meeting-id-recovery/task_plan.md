# Native Join Meeting ID Recovery Plan

## Goal

Improve `NC 加会` / RingCentral Native Join so app handoff recovery includes a safe manual Meeting ID path without weakening existing validated-link, passcode-hidden, or browser fallback boundaries.

## Plan

- [x] Read repo workflow, automation memory, feature index, Native Join docs/code/tests, and Reminders state.
- [x] Scan comparable product and research references for app/browser fallback, manual ID join, and deep-link safety.
- [x] Add Meeting ID recovery UI/copy receipt to the Native Join fallback panel.
- [x] Update `docs/features/meeting_native_join.md` with current behavior and research judgment.
- [x] Run targeted unit, dev build, Native Join E2E, and path-scoped diff checks.
- [in_progress] Update automation memory and archive the Codex session if the app tool is available.

## Decisions

- Keep the change scoped to a recovery affordance; do not redesign Native Join or parse/expose passcodes separately.
- Copying Meeting ID should be explicit: it does not join the meeting, does not copy the full invite/passcode, and does not change future join preference.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| RingCentral support article URL opened to a removed-page shell | Product research | Used current RingCentral browser-join product blog plus Zoom/Teams docs and deep-link security references instead. |
