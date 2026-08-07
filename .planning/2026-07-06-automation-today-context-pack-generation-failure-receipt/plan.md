# Today Pilot Context Pack generation-failure receipt

## Selected feature

- Feature: `Context Pack`
- Capability: Today Pilot
- Source doc: `docs/features/today_pilot.md`
- Selection note: chosen from a random `docs/index.md` shortlist after avoiding the freshest exact Topic / Outreach / Prompt Config / Project Dashboard / Storyline / Action Queue targets.

## Reminder check

EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items. All items were already completed historical Doubao / Notification / test feedback, so no Reminder item was related to Today Pilot Context Pack and none should be marked done.

## External scan

- ChatGPT Projects keeps files, chats, instructions and app links together as a bounded context workspace, which supports making Context Pack target/source scope explicit before handoff.
- Anthropic context-engineering guidance treats context as a finite resource that must be curated, not dumped, which supports showing generated-vs-not-generated state instead of falling back to a rough preview.
- Google Research sufficient-context work highlights that relevant context is not always sufficient context, which supports telling users when a current pack body does not exist.
- Microsoft Teams Copilot meeting guidance separates AI availability, transcription, organizer control and retained history, which supports clear handoff and non-execution boundaries.

## Plan

1. Inspect Today Pilot Context Pack docs, UI and verifier coverage.
2. Fix the generation-failure path so expanded Context Pack does not display card preview or stale provider body as the current generated pack.
3. Add E2E coverage for a failed target-provider render and static verifier checks for the receipt / no-preview fallback.
4. Update `docs/features/today_pilot.md` and `docs/index.md` with the concise current behavior.
5. Run `verify:day-pilot-home`, dev compile via `npm start`, `verify:today-pilot-home:e2e`, and scoped whitespace checks.

## Implementation notes

- Added a persistent `contextPackFailures` receipt map in `OverviewPage.vue`.
- `currentPackText()` now returns only generated context pack body; `card.pack` preview is no longer rendered as a generated body.
- The expanded panel now shows pending and failure receipts with clipboard / external-send / approve / execute / writeback non-effects.
- The failure receipt is cleared on retry or when the requested provider/sensitive cache has a generated pack.
