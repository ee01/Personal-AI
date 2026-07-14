# Findings

## Reminder

- AppleScript listed reminder lists but did not show `Personal AI`.
- EventKit found `Personal AI` with 4 total items and 0 incomplete items.
- No Reminder item was related to Quick Ask 状态卡, sync issue, pending outreach, runtime state, or status-card row counts; nothing should be marked done.

## External scan

- Raycast Quick AI keeps fast launcher answers in-flow and supports follow-ups / context attachments, reinforcing that a small launcher surface can still carry explicit context and action state.
- OpenAI ChatGPT macOS Chat Bar emphasizes instant access from any screen; this supports keeping the status card glanceable instead of sending users to a separate settings page first.
- ChatGPT Memory and Claude memory/search docs both stress user control and source/reference transparency; Quick Ask status rows should say which runtime source and count they represent before the user acts.
- Mixed-initiative context research argues for user authority over context operations; status-card click-through should pass the visible basis into the follow-up prompt instead of silently compressing it.
- Just-in-time information access research supports surfacing task-relevant context at the moment of action, but only when the context basis is visible enough to avoid overclaiming.

## Code finding

- `desktop-app/src/assistantRuntime.ts` already sets `BridgeAssistantStatusItem.count`.
- `desktop-app/app/quick-ask.js` uses the count only in aggregate composition and optional badge/detail lines, not as a stable per-row receipt or prompt field.
