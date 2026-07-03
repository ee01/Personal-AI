# Meeting Pilot Side Panel State Source Plan

## Target

- Feature index target: `会中 side panel` in `docs/features/meeting_pilot.md`.
- User problem: a side panel opened as an independent window can look like a live meeting surface even when it is reading demo data, an active-session fallback, or a stale requested `tabId`.

## External Signals

- Zoom AI Companion exposes in-meeting question availability, host start/stop control, source scope, preset questions, and follow-up actions inside its meeting panel.
- Microsoft Teams Facilitator exposes live notes, agenda/timer state, open questions, and task sync as visible meeting-state surfaces.
- Meeting reflection research favors low-interruption meeting prompts with user control over when an intervention becomes action.
- AI meeting assistant governance discussions emphasize transparency, consent, limitations, and immediate review before relying on generated output.

## Plan

1. Add a compact side-panel state source receipt under the header.
2. Distinguish four user-visible states: exact `tabId` binding, no-`tabId` active-session fallback, local `demo=1`, and missing/stale requested `tabId`.
3. Fix stale requested `tabId` selection so it stays unbound instead of falling back to another active meeting.
4. Extend the existing Scene 1 E2E to cover real binding, stale requested tab, and demo source receipts.
5. Update the Meeting Pilot feature doc and run targeted validation plus the first successful `npm start` compile.

## Non-Goals

- No changes to capture, ASR, transcript, memory recall, action item update protocol, or backend session registry.
- No new external writeback or meeting recording behavior.

