# Glip AI Marker Next-Step Receipt Plan

- Random target: `Glip AI 标注` under Message Reaction.
- Reminder check: local Reminders is reachable, but there is no `Personal AI` list, so no Reminder item can be included or completed.
- Current doc/code state: Glip markers already show marker source, cache freshness, local-snapshot boundary, and marker-type status meanings. The remaining UX gap is that a user can understand the marker state but still not know where to manage or verify it next.
- External scan: Slack reminders/Later, Gmail Snooze, and Microsoft Teams thread follow/recap patterns all keep deferred or followed work recoverable from an explicit management surface. Notification-snooze research also reinforces that deferral must keep return timing and recovery visible.

## Implementation Steps

1. Add a compact next-step summary for Glip AI marker groups in `src/contentScriptGlip.tsx`.
2. Render the next-step line in the badge `aria-label` and tooltip receipt beside status, source, cache, and snapshot boundary.
3. Keep marker storage, sorting, refresh cadence, and remote synchronization unchanged.
4. Extend `tools/verify-glip-ai-markers-e2e.mjs` and `desktop-app/scripts/message-reaction-toolbar-check.mjs` so keyboard focus proves the next-step line is visible.
5. Update `docs/features/message_reaction.md` with the new user-visible behavior.
6. Verify with focused marker checks, Message Reaction checks, first successful dev compile, and scoped `git diff --check`.

## Non-goals

- No new remote polling from the content script.
- No change to Snooze, Outreach, Watch, or Scheduled Messages write paths.
- No interactive link/button inside the marker tooltip in this pass.
