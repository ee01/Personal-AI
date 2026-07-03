# Meeting History Completion Receipt Plan

## Target

- Feature: `会议历史归档` under Meeting Pilot.
- Canonical doc: `docs/features/meeting_pilot.md`.
- UI: `memory-exploring.html#/meetings`, implemented by `src/modals/components/MeetingHistoryPage.vue`.

## External Signals

- Teams Intelligent Recap, Zoom AI Companion meeting assets, and Otter Meeting Summary all present meeting outputs as a set of recap materials: recording or transcript, summary, action items, and share/export state.
- Meeting summarization and action-item extraction research points in the same direction: users need to know whether a meeting has reusable outputs and what still needs review before treating the archive as a deliverable.

## UX Problem

The history page already shows per-card Digest/PDF status and safe-open receipts, but the list first screen still makes the user inspect cards one by one to answer: "Which loaded meetings are complete, which need recovery, and which are only archived records?"

## Implementation Plan

1. Add a list-level `归档完整度回执` above the cards.
2. Compute the receipt only from currently displayed meetings so it stays honest for filters and partial pagination.
3. Classify meetings into `完整可交付`, `需复核`, `生成中`, and `仅基础归档` using existing Digest/PDF semantics.
4. Make the copy explicit that the receipt is read-only and does not rerun Minutes API, generate PDF, send minutes, write Memory Service, or mutate action items.
5. Extend `desktop-app/scripts/meeting-pilot-history-check.mjs` with mixed complete / failed / unsafe / processing / archived fixtures and assertions.

## Validation

- `node --check desktop-app/scripts/meeting-pilot-history-check.mjs`
- `npm start -- --progress`, stop after first successful compile
- `node desktop-app/scripts/meeting-pilot-history-check.mjs`
- Scoped `git diff --check`
