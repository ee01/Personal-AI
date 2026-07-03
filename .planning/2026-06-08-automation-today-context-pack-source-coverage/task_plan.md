# Today Pilot Context Pack Source Coverage Plan

Goal: improve the selected `Context Pack` feature under Today Pilot by making copied context packs and UI receipts honest about source coverage, especially when token-budget truncation leaves evidence outside the copied body.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory, AGENT.md, feature index, carry-over queue, existing planning context, and Reminder list names |
| 2 | completed | Inspect Today Pilot docs, Context Pack service code, home/popup UI, client types, and existing verify/E2E scripts |
| 3 | completed | Check current product and paper references for grounded context, source limits, and attribution trust |
| 4 | completed | Implement source-coverage metadata, visible receipts, docs, and focused assertions |
| 5 | completed | Run targeted tests, dev compile, E2E/browser-level proof, and diff whitespace checks |
| 6 | completed | Update automation memory and close Reminder branch honestly |

## Decisions

- Selected feature: `Context Pack` in `docs/features/today_pilot.md`.
- The first random draw was Jira secret redaction, but that exact family was recently covered; this run uses the next suitable random draw to avoid repeating fresh work.
- Local Reminders lists are visible, but no list named `Personal AI` exists, so there are no Reminder items to incorporate or mark done.
- Implementation slice: add source-coverage metadata that distinguishes total evidence from evidence rendered inside the copied markdown, then surface that receipt on Today Pilot Home and popup copy feedback.
- Keep the body boundary: Context Pack remains context only, never execution authorization.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and skip Reminder completion |
