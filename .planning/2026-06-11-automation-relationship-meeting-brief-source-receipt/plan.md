# Relationship Meeting Brief Source Receipt Plan

## Target

Feature: `人脉关系 Meeting Brief` in `docs/features/relationship_radar.md`.

The current source receipt says `日历事件` whenever `eventId` is present. That is misleading when the event lookup fails, or when the caller provides manual title / start time / attendees that override the stored calendar event.

## Plan

1. Make `RelationshipRadarService.buildMeetingBrief()` classify the input source as:
   - calendar event
   - manual input
   - calendar event with manual overrides
   - calendar event missing with manual fallback
2. Render that source state in `sourceReceipt.rows` and keep the existing privacy/evidence boundary.
3. Add API tests for missing calendar event fallback and manual attendee overrides.
4. Update `docs/features/relationship_radar.md` to document the source receipt behavior.
5. Run focused Relationship Radar tests, dev compile, E2E verifier if practical, and `git diff --check`.

