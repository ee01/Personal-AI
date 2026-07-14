# Today Pilot Home Snapshot Basis Findings

## Repo Findings

- `docs/progressing/to-verify.md` has no carry-over work.
- `docs/features/today_pilot.md` already describes source stats, candidate counts, selected evidence, prefiltered noise, feedback-after visible snapshots, and popup snapshot basis.
- `src/modals/components/OverviewPage.vue` calls `client.getTodayPilotToday()` and receives `DayPilotTodayResponse.generated` / `stale`, but currently only stores `result.brief`.
- `src/popup.tsx` already uses `generated`, `stale`, `generatedAt`, and `status` to build a Top 3 `快照基准`. The homepage lacks the same first-screen basis.
- `tools/verify-day-pilot-home.ts` and `tools/verify-today-pilot-home-e2e.mjs` are the right validation surfaces for this change.

## External Reference Findings

- Microsoft 365 Copilot's Plan My Day template emphasizes top 3-5 priorities, direct links, actionable context, and a brief that is quickly scannable while still linked to data sources.
- Gemini Daily Brief groups timely actionable items and longer-term goals, requires connected apps / memory, and exposes item source, completion, dismissal, and feedback controls.
- Microsoft Research on AI-powered reminders for collaborative tasks supports reminders that target embedded commitments and requests, not every possible signal.
- Notification batching research supports predictable low-interruption summaries, but also shows that hiding all notifications can create missing-out anxiety. For Today Pilot, that argues for explicit snapshot basis and source counts rather than a silent or opaque daily digest.

## UX Gap

The Today Pilot homepage already shows counts for raw signals, candidates, selected evidence, non-selected candidates, prefiltered noise, and attention budget. However, the homepage does not say whether those numbers came from a newly generated brief, an existing brief, a stale brief, or a feedback-mutated visible slice. Popup already exposes this, so users can get more provenance in the small surface than in the full home page.

## Chosen Fix

Add a compact `首页快照基准` clause to the homepage ranking note. It should state:

- whether the brief was generated in this request or read from an existing brief;
- whether an old brief had gone stale before regeneration, or the current returned brief is stale;
- generated time / age / status;
- that this only explains the current visible Today Pilot brief and does not rescan sources, write feedback, send messages, or execute actions.
