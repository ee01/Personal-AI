# Meeting Pilot Embedded Frame Boundary Plan

## Target

- Feature: Meeting Pilot / 会议页嵌入入口
- Reminder: local Reminders has no `Personal AI` list, so no Reminder item is in scope.
- External signal: Zoom AI Companion, Teams Facilitator, RingCentral AI Meetings, and meeting-reflection research all point to explicit meeting AI state, user control, and recoverable in-meeting UI boundaries.

## Improvement Plan

1. Keep the existing embedded-panel loading receipt and unavailable fallback.
2. Tighten the parent-page message boundary so only the current controlled `mpSidePanelFrame` can close the embedded panel or request Catch Up.
3. Add an E2E assertion that a separate web-accessible extension iframe cannot spoof the embedded-panel close message.
4. Update `docs/features/meeting_pilot.md` with the current user-visible boundary.
5. Validate with the Meeting Pilot scene helper, dev extension compile, and whitespace checks.
