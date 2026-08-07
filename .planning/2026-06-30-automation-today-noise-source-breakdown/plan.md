# Today Pilot noise-source breakdown plan

## Target

- Randomly selected feature: `今天排序与噪声控制` in `docs/index.md`.
- Canonical doc: `docs/features/today_pilot.md`.
- Main surfaces inspected: `memory-service/src/core/DayPilotService.ts`, `src/modals/components/OverviewPage.vue`, `src/popup.tsx`, `tools/verify-day-pilot-home.ts`, `tools/verify-today-pilot-home-e2e.mjs`.

## Reminder check

Local Reminders was readable, but there is no `Personal AI` list on this machine. No Reminder item was incorporated or marked done.

## External scan

- OpenAI ChatGPT Pulse positioned proactive briefings around memory, chat history, app connections, feedback, and sources: https://openai.com/index/introducing-chatgpt-pulse/
- Microsoft Viva Insights daily briefing focuses users on upcoming meetings, commitments, and suggested focus time rather than unbounded notification replay: https://support.microsoft.com/en-us/topic/briefing-email-from-microsoft-viva-4f31174c-99ee-4c12-a5e1-98cbd5ca9807
- Google Gemini Daily Brief relies on Gmail, Calendar, Docs/Drive, and prior Gemini chats, with source availability and personalization boundaries: https://support.google.com/gemini/answer/16312086
- Notification batching research shows attention systems should reduce scattered interruptions and make batching behavior predictable: https://doi.org/10.1145/3173574.3174177

## UX gap

Today Pilot already exposes `候选`, `入选证据`, `候选未入选`, and `前置降噪`. As a user, the weak point is that `前置降噪 3` does not say what kind of noise was suppressed. If the count rises, I cannot tell whether the product is filtering chat noise, old calendar syncs, rehearsal prompts, or system notifications.

## Implementation steps

1. Add a shared sourceStats helper for Today Pilot counts and source-level prefilter noise summaries.
2. Use the helper in the Today Pilot home ranking strip and append a source breakdown to `前置降噪`.
3. Use the same helper in the popup Top 3 scope receipt.
4. Update docs to describe source-level prefilter breakdown.
5. Update focused verifier and E2E fixtures so the test proves visible `消息 2` breakdown.

## Validation plan

1. `npm --prefix memory-service test -- --run src/__tests__/api-day-pilot.test.ts`
2. `npm run verify:day-pilot-home`
3. `npm start -- --progress`, wait for first successful compile, then stop.
4. `npm run verify:today-pilot-home:e2e`
5. Scoped `git diff --check` for touched files.
