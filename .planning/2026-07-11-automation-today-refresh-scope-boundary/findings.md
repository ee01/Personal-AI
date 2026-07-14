# Findings

## Repo Context

- `docs/progressing/to-verify.md` is empty, so this is a fresh random feature pass.
- Random selection chose `今天排序与噪声控制` from `docs/features/index.md`.
- The worktree was already broadly dirty before this run. Scope this run to Today Pilot refresh-boundary changes plus planning/memory updates.
- Today Pilot already has source-breakdown, snapshot-basis, hidden-selected-evidence, mission action, catch-up, context-pack failure, and popup overflow receipts from prior work.

## Reminder Check

- AppleScript listed local Reminders lists but did not expose `Personal AI`.
- EventKit fallback found `Personal AI` with 4 total items and 0 incomplete items.
- All items were completed historical Doubao/test feedback, unrelated to Today Pilot sorting/noise/refresh scope.

## External Scan

- Microsoft 365 Copilot Plan My Day frames daily briefing as scannable priority ranking across work data, with top priorities, pending decisions, and source-linked actions.
- Gemini Daily Brief frames the product as a daily prioritized snapshot from Gmail, Calendar, tasks, and Gemini chats, with source viewing and source controls.
- Microsoft Research on AI-powered reminders highlights commitments and requests embedded in collaboration streams, plus workflow fit for reminder interaction.
- Notification batching/adaptive-notification research supports low-interruption, predictable delivery rather than constant reactive refresh.
- Context-engineering and provenance-grounded memory papers support showing source, sufficiency, freshness, and provenance boundaries near the control that changes an AI brief.

## Implementation Decision

- Add a refresh-control boundary rather than changing ranking logic. The selected feature already computes the right data; the remaining UX risk is the refresh button not saying what it will or will not change.
