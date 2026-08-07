# Today Pilot Meeting Handoff Plan

## Scope

Randomly selected feature: `Meeting Pilot handoff` in `docs/index.md`.

This run focuses on the handoff from RingCentral Video Home / Today Pilot meeting prep into Meeting Pilot side panel.

## Findings

- Reminder check: Apple Reminders is accessible, but there is no visible `Personal AI` list on this machine.
- Code already keeps a bounded multi-meeting handoff cache and Meeting Pilot selects the most relevant handoff by meeting id/title/time.
- The handoff payload currently stores `goal: ''`, so Meeting Pilot often shows cue cards without the explicit "what this meeting is trying to accomplish" thread.
- External references support the same improvement direction: Teams Facilitator and Zoom AI Companion organize meeting help around catch-up, action items, decisions, agenda/time, and user-visible AI state; Microsoft Research meeting-intentionality work argues for explicit prospective goals and low-disruption in-meeting reflection.

## Plan

1. Extract a concise handoff goal from Today Pilot meeting prep cue cards / summary before writing `meetingPrepHandoff`.
2. Make Meeting Pilot normalize legacy handoffs by deriving the same goal when the stored payload is blank.
3. Improve the side panel handoff card so the goal is a first-scan line, not hidden in optional subtext.
4. Update source-of-truth feature docs with the goal-continuity behavior.
5. Extend focused verification to assert the goal extraction and side-panel rendering contract.
6. Run focused Today Pilot/Meeting Pilot verification, dev compile, and diff checks.
