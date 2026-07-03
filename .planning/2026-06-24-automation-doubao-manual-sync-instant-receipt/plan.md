# Doubao Manual Sync Instant Receipt Plan

## Target

- Random feature: `Persona / 近期重点 / 提醒推送`
- Feature family: Doubao Bridge / Personal AI Desktop App memory broadcast
- Source doc: `docs/features/doubao_bridge.md`

## Context

- `docs/progressing/to-verify.md` has no carry-over work.
- Local Reminders is reachable, but the `Personal AI` list does not exist, so there is no Reminder item to complete.
- External product signals from ChatGPT Memory / Tasks, Gemini Personal Intelligence, Claude memory, and recent long-term memory papers all point to the same UX requirement: proactive memory push is useful only when target, source, control, and delivery proof are visible at the moment of action.

## Improvement Plan

1. Keep the existing stable/mobile thread contracts unchanged.
2. Add per-click audit details to manual sync result copy:
   - package kind
   - item count
   - source reference count
   - reminder delivery mode
   - target thread
   - verification / message visibility / transport
   - telemetry writeback issue
3. Preserve existing skipped and failure boundaries: skipped means nothing was sent; failure means the page must not imply delivery.
4. Extend the existing desktop-app Playwright check so the instant receipt proves the new details for:
   - successful `mobile_briefing`
   - skipped `reminder_sync`
5. Update the Doubao Bridge doc and feature index with concise current behavior.
6. Verify with the desktop-app harness, desktop build, extension dev compile, and scoped whitespace checks.
