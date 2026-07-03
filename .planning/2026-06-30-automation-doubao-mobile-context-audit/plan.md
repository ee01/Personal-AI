# Doubao Mobile Context Send Audit Plan

## Target

- Random feature: `Persona / 近期重点 / 提醒推送`
- Feature family: Doubao Bridge / Personal AI Desktop App memory broadcast
- Source doc: `docs/features/doubao_bridge.md`

## Context

- `docs/progressing/to-verify.md` has no carry-over work.
- Local Reminders lists are readable, but there is no `Personal AI` list, so no Reminder item is incorporated or completed in this run.
- Recent automation runs already covered Snooze, Agent Thinking, Glip marker, Topic Messages, and Meeting Pilot ASR, so this pass stays on Doubao Bridge.
- Existing Doubao docs and code already cover pre-click receipts, in-flight receipts, skipped runs, and inline post-click audit details.

## External Signals

- ChatGPT Tasks keeps proactive work reviewable through task confirmations, notifications, and task management surfaces: https://help.openai.com/en/articles/10291617-tasks-in-chatgpt
- ChatGPT Memory explains saved-memory/source controls as user-visible context, which supports showing source and effect boundaries near personalization actions: https://help.openai.com/en/articles/8590148-memory-faq
- Digital reminder-system research treats reminders as a mix of future intention, past context, and conversational cues, so the UI should preserve delivery state and recovery paths near the reminder surface: https://cs.stanford.edu/~merrie/papers/memory_imwut2017.pdf
- Proactive assistant research and benchmarks emphasize long-term user context plus transparent intervention timing, which maps to showing target thread, evidence count, and verification state for each push.

## Findings

- The long-term memory thread card already shows `最近同步审计` with package, item count, source references, target thread, transport, verification, and telemetry issues.
- The mobile context card only shows `最近手机上下文发送` plus a message. For `mobile_briefing` and `reminder_sync`, a user still has to scroll to the full sync audit list to know which package was sent, how many items/sources were included, which thread received it, whether the page saw the message, and whether state writeback failed.
- This is a UX trust gap rather than a transport bug: the data already exists in `recentAttempts`, but the mobile context panel hides it from the place where the user decides whether the phone conversation is healthy.

## Plan

1. Keep provider bindings, send logic, skipped handling, and sync job telemetry unchanged.
2. In `renderMobileThreadDetail`, add a `最近手机上下文审计` line using the same `formatAttemptDetails` contract as the long-term memory thread.
3. When the latest mobile attempt has a telemetry writeback issue but no send failure, show the mobile thread card as `手机上下文通道回写需检查` with a `回写异常` badge.
4. Extend the existing desktop Playwright check so it proves the mobile thread card now exposes package, item count, source references, target thread, verification/transport, and telemetry details.
5. Update `docs/features/doubao_bridge.md` with a concise current-behavior note.
6. Verify with `npm --prefix desktop-app run test:source-toggle-gating`, first successful `npm start` compile, and scoped `git diff --check`.
