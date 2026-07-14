# Glip AI Marker Cache Age Flag Plan

## Target

- Selected feature: `Glip AI 标注` in `docs/features/message_reaction.md`.
- Scope: make stale or unrefreshed local marker cache visible on the compact badge, not only inside tooltip / aria text.
- Non-goals: no marker refresh schedule changes, no remote query from RingCentral content pages, no Snooze / Outreach / Sheet execution changes, no queue mutation.

## Current State

- `docs/progressing/to-verify.md` has no carry-over work.
- EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items; no open Reminder feedback was related to Glip AI markers.
- The July 4 Glip marker pass already added badge-scope text for multi-marker folding, plus status meaning, source, cache refresh time, and next-step tooltip rows.
- Gap: when `glipMessageMarkers.updatedAt` is missing or older than 30 minutes, the compact badge still looks like a current state until hover/focus reveals the boundary.

## External Reference Scan

- Slack Later centralizes saved items/reminders in a Later view and keeps them personally visible: https://slack.com/help/articles/360042650274-Save-messages-and-files-for-later
- Gmail Snooze temporarily removes mail and returns it at the chosen time: https://support.google.com/mail/answer/7622010
- Microsoft Teams Recap can summarize and generate follow-up tasks in the recap surface: https://support.microsoft.com/en-us/teams/meetings/recap-in-microsoft-teams
- Weber et al., MobileHCI 2018, studied user-defined notification deferral with custom durations and target times: https://dl.acm.org/doi/10.1145/3229434.3229436
- Microsoft Human-AI guidelines emphasize showing why an AI behaved as it did and conveying consequences/status over time: https://www.microsoft.com/en-us/research/blog/guidelines-for-human-ai-interaction-design/

Design implication: original-message markers are useful as a return path, but stale snapshot state should be visible before hover/focus so users do not treat old local cache as a live remote check.

## Plan

1. Add cache-state helpers for fresh, stale, and unrefreshed marker cache.
2. Keep fresh badges unchanged; add compact `旧` / `old` and `待刷` / `sync?` flags only when the cache is stale or unrefreshed.
3. Preserve existing tooltip and `aria-label` boundary copy as the detailed explanation.
4. Update the Glip marker source-contract verifier and the real extension toolbar E2E fixture.
5. Update `docs/features/message_reaction.md` and `docs/features/index.md`.
6. Verify with focused marker checks, first successful `npm start` compile, and scoped `git diff --check`.
