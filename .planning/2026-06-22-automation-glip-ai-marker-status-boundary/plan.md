# Glip AI Marker Status Boundary Plan

- Random target: `Glip AI 标注` under Message Reaction (`docs/features/message_reaction.md`).
- Reminder check: local Reminders is reachable, but there is no `Personal AI` list, so no Reminder item can be included or completed.
- Current user gap: the message badge already shows marker source and cache freshness, but mixed marker groups can still blur very different states: pending Snooze, waiting Outreach, sent follow-up event, and successful Scheduled Message log.
- External scan: Slack Later and Gmail Snooze keep deferred items recoverable from a central later/snoozed path; Teams Recap anchors AI follow-up tasks to recap/chat; Snooze research supports explicit deferral timing and recovery. The badge should therefore say whether the marker is pending, waiting, or an execution log before the user treats it as live state.

## Implementation Steps

1. Add a compact status-boundary summary for Glip AI marker groups in `src/contentScriptGlip.tsx`.
2. Keep storage, refresh cadence, marker sorting, and service-worker writes unchanged.
3. Render the status boundary in the badge `aria-label` and tooltip receipt, near source/cache freshness.
4. Extend `tools/verify-glip-ai-markers-e2e.mjs` and `desktop-app/scripts/message-reaction-toolbar-check.mjs` so keyboard focus proves the new status text is visible.
5. Update `docs/features/message_reaction.md` with the current behavior and research-backed UX direction.
6. Verify with focused marker E2E, Message Reaction E2E, dev extension compile, and scoped `git diff --check`.

## Non-goals

- No change to Snooze creation, Outreach session creation, Scheduled Message execution, or marker cache merging.
- No new review queue or remote status polling from the content script.
