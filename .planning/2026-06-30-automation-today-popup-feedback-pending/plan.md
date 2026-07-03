# Today Pilot Popup Feedback Pending Plan

## Scope

- Selected feature: `Popup Top 3` in `docs/features/today_pilot.md`.
- Code surface: Chrome extension popup Today Pilot card actions in `src/popup.tsx`.
- Validation surface: `tools/verify-day-pilot-home.ts`, `tools/verify-today-pilot-home-e2e.mjs`, `npm start`.
- Reminder state: local Reminders was readable, but no `Personal AI` list exists.

## Current Gap

Popup Top 3 already shows action, why-now, evidence/confidence metadata, scope receipt, refresh-failure stale-snapshot receipt, context-pack copy receipt, and external-execution guard.

The weak point is feedback submission. Clicking `完成` or `稍后` removes the card before Memory Service confirms the feedback write. If the request is slow, the user sees the mission disappear and can reasonably infer that Today Pilot has already accepted the action. This conflicts with the broader Today Pilot feedback contract, where pending feedback should keep the card visible and explain that nothing has been written yet.

## External Scan

- OpenAI ChatGPT Pulse used quickly scannable daily update cards based on chats, feedback, and connected apps, and its Help Center now routes daily updates toward scheduled tasks rather than a live stream: https://openai.com/index/introducing-chatgpt-pulse/ and https://help.openai.com/en/articles/12293630-chatgpt-pulse
- Gemini Daily Brief describes proactive, personalized daily items from connected apps such as Gmail and Calendar, which supports a bounded daily brief rather than an unbounded queue: https://support.google.com/gemini/answer/17077455
- Microsoft Copilot meeting prep puts preparation content at the top of an Outlook meeting and lets the user expand for more insight, supporting compact summaries with a deeper review path: https://support.microsoft.com/en-us/outlook/prepare-for-your-meeting-with-copilot
- Human-AI Interaction guidelines emphasize clear system status, uncertainty/error handling, and user control when an AI system acts on inferred relevance: https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/
- Notification batching research supports low-frequency, user-controlled attention surfaces over immediate disruptive state changes: https://scholars.duke.edu/display/pub1402953

## Implementation Plan

1. Add a popup feedback pending receipt builder that states the card is still visible, no Today Pilot feedback has been written yet, and source tasks/messages/calendar/external systems are unchanged.
2. Change `sendTodayPilotPopupFeedback` so it locks the specific action button and shows the pending receipt without optimistically removing the card.
3. On success, refresh Top 3 from the Memory Service response and show a success receipt that clarifies the write only affects Today Pilot display/ranking feedback.
4. On failure, keep the original card list visible and show an explicit no-write/no-source-mutation failure receipt.
5. Extend Today Pilot source assertions and Playwright E2E to cover pending state during a delayed feedback response.
6. Update `docs/features/today_pilot.md` with the popup-specific pending feedback contract.

## Validation Plan

- `npm run verify:day-pilot-home`
- `npm start -- --progress`, wait for the first successful compile, then stop it
- `npm run verify:today-pilot-home:e2e`
- `git diff --check -- src/popup.tsx tools/verify-day-pilot-home.ts tools/verify-today-pilot-home-e2e.mjs docs/features/today_pilot.md .planning/2026-06-30-automation-today-popup-feedback-pending/plan.md`
