# Meeting Pilot 会中提醒可见口径

## Target

- Feature: `会中提醒` in `docs/features/meeting_pilot.md`.
- Current carry-over: `docs/progressing/to-verify.md` is empty.
- Reminder state: EventKit found `Personal AI` with 4 total items and 0 incomplete items, so no Reminder feedback is included or marked done.

## External Signals

- Zoom AI Companion exposes in-meeting questions such as catch-up, name mentions, and action items, but keeps host enablement and data scope visible.
- Microsoft Teams Facilitator treats meeting assistance as a visible meeting agent with agenda/timer/Q&A/task boundaries and separates public meeting output from private Copilot prompts.
- CHI 2025 goal-reflection research supports passive, non-intrusive prompts for maintaining meeting focus, while warning that active interventions can interrupt conversation flow.
- LLM meeting recap research highlights action item usefulness but also mis-attribution and personal relevance limits, so Meeting Pilot should keep alert scope and filtering visible.

## Plan

1. Align Live Map alert rendering with the existing side-panel surfaced-alert filter so pure context-refresh alerts are not shown as actionable reminders.
2. Add a shared alert visibility receipt summarizing surfaced alerts, de-noised context refreshes, promoted memory cues, and hidden low-explanation memories.
3. Show that receipt in Side Panel live view and Live Map `Alerts and Context`.
4. Update Meeting Pilot docs and the feature index with the visible-slice boundary.
5. Verify with Meeting Pilot unit tests, first successful `npm start` compile, Live Map Playwright E2E, and scoped `git diff --check`.
