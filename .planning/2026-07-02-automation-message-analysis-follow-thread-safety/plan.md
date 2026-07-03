# Message Analysis Follow-Thread Safety Summary Plan

## Target

- Random feature: `手动关注项规则` under Message Analysis.
- Feature doc: `docs/features/message_analysis.md`.
- Reminder check: AppleScript missed `Personal AI`; EventKit found it, but all four items were already completed and unrelated to Message Analysis.

## External Signals

- Slack keyword workflows require explicit message trigger channels and keyword conditions.
- Zapier filters and paths make conditions explicit before later actions run.
- Trigger-action programming research highlights user confusion around hidden timing, control flow, and unexpected rule outcomes.
- Attention-sensitive alerting research supports separating immediate interruption, delayed summaries, and later follow-up notifications.

## Improvement Plan

1. Inspect the existing rule safety / delivery presentation for manual rules.
2. Fix the follow-thread path so stale `digestConfig` cannot hide Glip / Chrome follow-up notification risk in the card safety summary.
3. Keep runtime message analysis behavior unchanged; this is a presentation and documentation correction.
4. Add unit and extension-page E2E coverage for `followThread + notifyMethod + stale digestConfig`.
5. Update the feature doc and run targeted verification, dev compile, E2E, and scoped whitespace checks.
