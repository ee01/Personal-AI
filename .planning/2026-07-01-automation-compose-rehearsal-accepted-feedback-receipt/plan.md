# Compose Rehearsal Accepted Feedback Receipt

## Target

- Random feature: `回复助手预演提醒`
- Canonical docs: `docs/features/rehearsal.md`, with Compose Assist boundary mirrored in `docs/features/compose_assist.md`
- Reminder state: local Reminders lists are readable, but there is no `Personal AI` list on this Mac, so no Reminder item is incorporated or completed.

## External Scan

- [Gmail Smart Compose](https://research.google/pubs/gmail-smart-compose-real-time-assisted-writing/) keeps assisted writing inline and low-friction, but the user remains the final actor.
- [Copilot in Outlook](https://support.microsoft.com/en-US/Outlook/copilot-pages/draft-an-email-message-with-copilot-in-outlook) drafts email for review and edit before sending, reinforcing that draft insertion and actual send are separate states.
- Prospective-memory and implementation-intention research supports explicit cue-action binding: the user should see whether this Rehearsal cue was accepted or rejected for this scene.
- [Apple Reminders](https://support.apple.com/en-us/102484) supports time, location, app-link, and messaging-person cues, which reinforces treating Rehearsal feedback as scene/cue feedback rather than generic draft feedback.
- [Context-aware reminder authoring research](https://arxiv.org/abs/2605.23085) shows natural reminder intent needs structured trigger logic; accepted feedback should therefore be attached to the activation/cue, not only to generic writing calibration.

## Gap

Rehearsal-backed Compose Assist already forces a review before insertion and shows negative `irrelevant` writeback state after thumb-down. The accepted path does submit structured feedback after the undo window, but the visible completion receipt only reports ambient calibration. As a user, I cannot tell whether the Rehearsal activation was marked accepted, failed to write, or only the local draft was kept.

## Plan

1. Extend the insertion-complete receipt to include Rehearsal accepted-feedback state when the inserted suggestion used Rehearsal evidence.
2. Reuse the existing structured feedback pipeline instead of adding a new backend route.
3. Keep wording clear: draft remains unsent/unsubmitted; Rehearsal accepted feedback only affects future matching for the same cue/scene.
4. Update the Compose Assist direct-insert E2E to assert the accepted feedback receipt, not just the hidden runtime payload.
5. Update feature docs at a summary level only.
6. Verify with targeted Compose Assist E2E, first successful `npm start` compile, and scoped whitespace checks.
