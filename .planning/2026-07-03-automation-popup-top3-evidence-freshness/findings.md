# Popup Top 3 Evidence Freshness Findings

## Requirements

- User asked to choose a random feature from `docs/features/index.md`, check docs/code, research similar products and papers, inspect Reminders, plan first, implement, update docs, and run strong verification.
- `docs/progressing/to-verify.md` has no carry-over items.
- Existing worktree is broadly dirty; keep edits scoped to Popup Top 3 source/docs/E2E plus this plan.

## Selected Feature

- Feature: `Popup Top 3`
- Capability: Today Pilot
- Source doc: `docs/features/today_pilot.md`
- Main source: `src/popup.tsx`
- Existing verifier/E2E: `tools/verify-day-pilot-home.ts`, `tools/verify-today-pilot-home-e2e.mjs`, package scripts `verify:day-pilot-home` and `verify:today-pilot-home:e2e`

## Reminder Findings

- AppleScript Reminders list enumeration did not include `Personal AI`.
- EventKit fallback did find `Personal AI` with 4 items.
- All 4 items are already completed and concern historical Doubao sync, Weekly Dream Digest, or a test item. None are related to Today Pilot Popup Top 3, so no item should be marked done in this run.

## Research Findings

- Microsoft 365 Copilot's Plan My Day agent template emphasizes top 3-5 priorities, direct links, and scannability in about 30 seconds; this supports keeping the popup compact but source/basis-rich. Source: https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/agent-template-plan-my-day
- Gemini Daily Brief is generated once per morning, pulls from Gmail/Calendar/Gemini chats, and exposes item sources; this supports making snapshot timing and source basis visible for a daily brief surface. Source: https://gemini.google/overview/daily-brief/
- Microsoft Research / arXiv work on Viva Daily Briefing shows users benefit from AI reminders when they can understand and interact with surfaced tasks, and that current reminder actions can be ambiguous; this supports explicit local action boundaries in the popup. Source: https://arxiv.org/html/2403.01365v1
- Adaptive notification and proactive assistant research points toward predictable, low-interruption reminders rather than noisy real-time streams; this supports labeling Popup Top 3 as a bounded snapshot rather than implying continuous freshness.

## UX / Code Findings

- `buildTodayPilotPopupScopeReceipt()` currently summarizes displayed/visible counts, raw signals, candidates, selected evidence, filtered noise, and attention budget.
- The receipt says it is only a Top 3 snapshot and will not execute automatically, but it does not expose `brief.generatedAt`, `brief.status`, or whether `/today-pilot/today?autoGenerate=true` generated a new brief or read an existing one.
- When refresh fails after cards already exist, `buildTodayPilotPopupRefreshFailureReceipt()` preserves the previous receipt. If the previous receipt contains snapshot basis, refresh-failure mode can remain honest without new state.

## Implementation Plan

- Extend popup scope receipt detail with `快照基准`: generated/read time, relative age, brief status, and generated-vs-read mode.
- Keep the existing count phrases stable so current E2E assertions remain meaningful.
- Update `tools/verify-today-pilot-home-e2e.mjs` to assert the new snapshot-basis receipt.
- Update `docs/features/today_pilot.md` Popup Top 3 section with the new behavior.
