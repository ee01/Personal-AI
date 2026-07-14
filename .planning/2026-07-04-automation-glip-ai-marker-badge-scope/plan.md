# Glip AI Marker Badge Scope Plan

## Target

- Selected feature: `Glip AI 标注` in `docs/features/message_reaction.md`.
- Scope: make multi-marker badges more honest when one visible badge label hides other states behind `+N`.
- Non-goals: no marker refresh changes, no new remote query, no writeback, no Snooze / Outreach / Sheet execution changes.

## Current State

- `docs/progressing/to-verify.md` has no carry-over work.
- AppleScript did not list `Personal AI`; EventKit found it with 4 completed historical items. None are open or related to Glip AI markers.
- Existing UI already exposes marker source, cache refresh time, status meaning, next step, stale-cache boundary, and keyboard focus tooltips.
- Gap: for multi-marker messages, the compact badge shows one primary label plus `+N`, but the receipt does not explicitly say which states are folded or that folded states are not complete/dismissed.

## External Reference Scan

- Slack Later keeps saved messages/files in a Later view and supports reminders on saved items: https://slack.com/help/articles/360042650274-Save-messages-and-files-for-later
- Gmail Snooze lets a message return at a chosen later time: https://support.google.com/mail/answer/7622010
- Microsoft Teams Recap groups recording, transcript, notes, summary, agenda, and follow-up tasks in the recap surface: https://support.microsoft.com/en-us/teams/meetings/recap-in-microsoft-teams
- Weber et al., MobileHCI 2018, studied user-defined notification deferral and history-based redelivery: https://dl.acm.org/doi/10.1145/3229434.3229436

Design implication: the original message context should show that the item is managed, but compact states need a clear path back to the owning queue and should not imply that hidden folded items are already resolved.

## Plan

1. Add a presentation helper that summarizes badge display scope for one or multiple markers.
2. Include that summary in the ordinary AI marker `aria-label`.
3. Add a tooltip receipt row for `角标显示 / Badge scope`.
4. Update the Glip AI marker E2E script to assert source-code contract and keyboard-visible tooltip text in Chinese and English.
5. Update the feature doc with a concise behavior note.
6. Verify with `npm run verify:glip-ai-markers:e2e`, `npm start` first compile, a second E2E run, and scoped `git diff --check`.
