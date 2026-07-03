# Relationship Radar Meeting Brief Focus Plan

## Target

- Randomly selected feature: `人脉关系 Meeting Brief` in `docs/features/relationship_radar.md`.
- Reminder check: local Reminders is reachable, but there is no `Personal AI` list on this machine.

## External Signals

- Microsoft Copilot for Sales meeting preparation cards emphasize high-value highlights, risks, talking points, and CRM-linked recent interactions.
- Salesforce Einstein Relationship Insights frames relationship intelligence as evidence-backed preparation, not a replacement for the salesperson.
- Meeting-summary research points to action items and conversational structure as the parts users need before and after meetings.

## Implementation Steps

1. Add a service-level `focus` section to `POST /api/v1/relationships/meeting-brief`.
2. Generate focus items from weak identity matches, open loops, missing/omitted attendees, evidence availability, thin context, and post-meeting writeback boundaries.
3. Display the focus section in the Relationship Radar meeting tab.
4. Preserve the focus section in copied meeting briefs.
5. Update the feature docs and Relationship Radar verification coverage.

## Validation Plan

- `npm run verify:relationship-radar`
- `npm start` until first successful compile, then stop it.
- `npm run verify:relationship-radar:e2e`
- Path-scoped `git diff --check`
