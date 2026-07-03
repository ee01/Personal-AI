# Today Mission feedback receipt plan

## Target

- Feature: Today Pilot / 今日 Mission.
- Scope: make card feedback actions visibly bounded after the click.
- Reminder check: local Reminders is readable, but no `Personal AI` list exists, so no Reminder item is included or completed.

## External reference signal

- Gemini Daily Brief lets users mark items complete, dismiss them, inspect sources, and provide helpful/not-helpful feedback. This supports keeping daily-brief actions distinct from the original source systems.
- Microsoft Planner My Day clears itself nightly while unfinished tasks remain available in their original plans. This supports stating that a Today Pilot hide action only changes the daily view.
- Microsoft Viva Daily Briefing research frames AI reminders as support for commitments, requests, and follow-ups, not as proof that work was completed.
- Notification batching research supports predictable "later" windows as a low-disruption scheduling aid, but the UI should make clear that snooze is not source task rescheduling.

## User problem

Today Mission cards already hide on `完成`, `稍后 6h`, and `不再提醒同类`, but the only confirmation is a short toast. As a user, I can misread `完成` as completing the underlying action, outreach, decision, or source task. This is especially risky for OpenClaw/action-derived cards where the real execution path lives elsewhere.

## Implementation steps

1. Add a persistent inline `Mission 反馈回执` panel on the Today Pilot home page.
2. Build per-action copy for `done`, `later`, `mute`, `useful`, and `wrong`.
3. Keep failed feedback behavior unchanged: restore hidden cards and show failure.
4. Update the Today Pilot feature doc with the feedback boundary.
5. Extend the targeted verifier and E2E to assert the new receipt.

## Validation

1. `npm run verify:day-pilot-home`
2. `npm start` until the first successful webpack compile, then stop it.
3. `npm run verify:today-pilot-home:e2e`
4. `git diff --check -- src/modals/components/OverviewPage.vue tools/verify-day-pilot-home.ts tools/verify-today-pilot-home-e2e.mjs docs/features/today_pilot.md .planning/2026-06-16-automation-today-mission-feedback-receipt/plan.md`
