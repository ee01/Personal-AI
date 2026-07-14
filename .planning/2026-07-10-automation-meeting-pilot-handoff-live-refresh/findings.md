# Findings

- The selected feature is `Meeting Pilot handoff` from `docs/features/index.md`.
- The current implementation already ranks handoff candidates conservatively: exact RingCentral meeting id first, then title + plausible time window, then weak title-token fallback.
- The UX gap was not the matching algorithm. It was freshness after the panel is already open: the panel reads `meetingPrepHandoffs` on mount but only listened to `meetingPrepHandoff` changes afterward.
- The fix is deliberately narrow: listen for both storage keys and rerun the same existing candidate selection path.
- Reminder branch: no active related `Personal AI` Reminder exists; nothing was marked done.

## Research Signals

- Teams Copilot / Facilitator and Zoom AI Companion both keep meeting assistance scoped to current meeting state, questions, summaries, agenda, and action items.
- The action-item detection paper supports preserving relevant meeting context around action guidance.
- The CHI 2025 goal-reflection paper supports adaptive, user-controlled interventions instead of hidden automation.
