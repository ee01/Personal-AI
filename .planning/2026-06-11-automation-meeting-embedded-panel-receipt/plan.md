# Meeting Pilot Embedded Panel Receipt

## Target

Feature index item: `会议页嵌入入口` under `docs/features/meeting_pilot.md`.

## Context

- `docs/progressing/to-verify.md`: `暂无。`
- Reminder list check: local Reminders is readable, but no `Personal AI` list exists, so no Reminder item is included or completed.
- External signal: Teams / Zoom / RingCentral-style meeting assistants make live meeting AI state, transcript prerequisites, participant visibility, and recovery boundaries explicit.

## Plan

1. Add a meeting-page embedded panel receipt that states load status, current-meeting binding, and the capture boundary.
2. Add a parent-shell close control for the embedded panel.
3. Extend the Scene 1 extension E2E to assert the receipt and close behavior on the RingCentral fixture URL.
4. Update the Meeting Pilot feature doc.
5. Verify with focused Meeting Pilot checks, dev compile, Scene 1 E2E, and diff whitespace checks.
