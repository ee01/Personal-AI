# 2026-06-26 Automation - Meeting History Open Receipt

## Target

- Random feature: `Meeting Pilot / 会议历史归档`
- Feature doc: `docs/features/meeting_pilot.md`
- Main UI: `src/modals/components/MeetingHistoryPage.vue`
- Existing proof: `npm run test:meeting-pilot-history`

## Research Signals

- Microsoft Teams Recap groups recording, transcript, shared files, notes, agenda, AI summary and follow-up tasks, while keeping share/delete/access rules explicit.
- Webex meeting recap separates meeting-summary viewing, editing, copying, downloading and sharing, and gives each action a different consequence.
- MeetingBank and action-item-driven meeting summarization papers reinforce that long meeting archives need structured review paths, not just a single PDF link.

## Plan

1. Add a card-level open receipt after `打开 Panorama` and `打开 PDF`.
2. Keep current PDF URL safety gates unchanged; only successful safe-PDF clicks get a PDF open receipt.
3. State the no-share/no-send/no-regenerate/no-write/no-action-modification boundary in the receipt.
4. Update the Meeting Pilot feature doc with the new click-after-action behavior.
5. Extend the Meeting Pilot history E2E to assert Panorama and PDF open receipts plus unsafe PDF protection.
6. Verify with targeted E2E, first successful `npm start` compile, and scoped whitespace checks.
