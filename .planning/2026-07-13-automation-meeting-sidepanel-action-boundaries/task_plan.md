# Meeting Pilot Side Panel Action Boundaries

## Target

- Feature: `会中 side panel` in `docs/features/index.md`
- Canonical doc: `docs/features/meeting_pilot.md`
- Main surface: `src/meeting-shell/meetingSidePanel.tsx`

## Reminder Check

- AppleScript did not list a `Personal AI` Reminders list.
- EventKit found `Personal AI` with 4 total items and 0 incomplete items.
- All items were completed historical Doubao / notification feedback, so no Meeting Pilot side panel Reminder item was incorporated or marked done.

## External Scan

- Microsoft Teams Recap and Facilitator expose recording/transcript/notes/follow-up tasks as visible meeting assets and keep tasks editable/reviewable.
- Zoom AI Companion and RingCentral AI Meetings keep meeting AI state, notes, transcripts, and action items visible as meeting artifacts.
- CHI 2025 work on in-meeting goal reflection favors low-interruption prompts with user control.
- Action-item extraction research stresses transcript context and review, so Meeting Pilot should avoid turning AI suggestions into external tasks without explicit confirmation.

## Plan

1. Add reusable button-boundary helpers for Meeting Pilot side panel tabs, action filters, action toolbar buttons, meeting-prep cue actions, manual action drafts, and per-action item controls.
2. Mirror those boundaries into `title` and `aria-label` on the actual controls without changing existing click handlers or backend state transitions.
3. Extend existing Meeting Pilot Scene 1 and Scene 2 Playwright checks to assert the new control-level boundaries.
4. Update `docs/features/meeting_pilot.md` and the `会中 side panel` row in `docs/features/index.md`.
5. Validate with syntax checks, the dev webpack compile, relevant Meeting Pilot E2E, and scoped `git diff --check`.

## Scope Boundary

This run is presentation/accessibility only. It must not change Meeting Pilot capture startup, ASR selection, action item extraction, review-state persistence, timeline anchoring, meeting archiving, external task writeback, Reminder state, or Memory Service deployment.
