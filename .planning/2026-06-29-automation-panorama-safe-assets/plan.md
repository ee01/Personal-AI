# 2026-06-29 Automation: Panorama Safe Asset Links

## Target

- Feature index item: `会后 Panorama` under Meeting Pilot.
- Source doc: `docs/features/meeting_pilot.md`.
- Main surface: `src/meeting-shell/meetingPanorama.tsx`.

## External Signals

- Zoom, Teams, Otter, Granola, and Read AI all present recap assets, transcripts, recordings, exports, and follow-up tasks as explicit user actions instead of hidden side effects.
- Meeting assistant governance and action-item research support making provenance, consent, and artifact scope visible before users share or reuse meeting outputs.
- The useful product pattern for Panorama is not more automation here; it is safer output handling and clearer blocked/recoverable states.

## Improvement Plan

1. Normalize Panorama PDF and recording material links through the existing external URL safety gate.
2. Make `输出范围回执` report blocked PDF / recording assets as hidden with a concise reason.
3. Keep unsafe assets out of iframe previews, tab opens, downloads, copy actions, and replay controls.
4. Add E2E coverage for a history Panorama opened with unsafe PDF and recording links.
5. Update the Meeting Pilot feature doc with the current safe-link behavior.
6. Verify with the existing Panorama harness, first successful webpack compile, the Panorama E2E, i18n, and scoped diff checks.

## Reminder Branch

- Local Reminders was readable, but there is no `Personal AI` list on this machine.
- No Reminder item is linked to this run and none can be marked done.
