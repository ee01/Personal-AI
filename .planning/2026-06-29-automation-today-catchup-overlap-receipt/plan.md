# Today Pilot Catch-up Overlap Receipt Plan

## Target

- Randomly selected feature: `高压后补课` in `docs/index.md`.
- Source of truth: `docs/features/today_pilot.md`.
- Code paths: `src/modals/components/OverviewPage.vue`, `memory-service/src/core/CatchUpService.ts`, `tools/verify-day-pilot-home.ts`, `tools/verify-today-pilot-home-e2e.mjs`.

## Current Findings

- `docs/progressing/to-verify.md` is empty.
- Local Reminders is readable, but there is no `Personal AI` list on this Mac, so no Reminder item can be linked or marked done.
- Prior automation memory just covered Memory Coverage smart import, User Profile evidence, Notification snooze, Decision Center, Doubao/ChatGPT explorer, Project Dashboard search, Memory Capture, Relationship Radar, Topic Messages, and other nearby receipt work; this run should avoid those exact surfaces.
- Today Pilot catch-up already has a read-only receipt, but a single message can appear in both `highPriority` and `waiting`. The UI shows it twice without explaining that the columns can overlap, which can make one source event look like two separate tasks.

## External Scan

- Slack AI recaps and Microsoft 365 Copilot catch-up both frame missed-work recovery as summarized, source-aware catch-up rather than as inbox mutation or automatic action.
- Gemini Daily Brief exposes item sources and supports follow-up actions/feedback, so Personal AI should be explicit about what a catch-up item represents before a user acts on it.
- Notification batching and interruption-recovery research supports a compact recovery snapshot with clear scope, avoiding repeated interruption or ambiguous duplicate signals.

## Implementation Steps

1. Add a derived overlap count and a de-duplicated waiting list in Today Pilot catch-up presentation.
2. Extend the catch-up receipt to say when `高优变化` and `等你回` share the same source signal.
3. Keep the backend contract unchanged: `total`, `highPriority`, and `waiting` still describe the read-only service result.
4. Update focused verifier and E2E fixtures to cover overlapping high/waiting items.
5. Update `docs/features/today_pilot.md` with the current overlap behavior.

## Validation Plan

- `npm --prefix memory-service test -- --run src/__tests__/catchUp.test.ts`
- `npm run verify:day-pilot-home`
- `npm start` until the first successful webpack dev compile, then stop it.
- `npm run verify:today-pilot-home:e2e`
- `npm run verify:i18n`
- `git diff --check -- .planning/.active_plan .planning/2026-06-29-automation-today-catchup-overlap-receipt/plan.md src/modals/components/OverviewPage.vue tools/verify-day-pilot-home.ts tools/verify-today-pilot-home-e2e.mjs docs/features/today_pilot.md`
