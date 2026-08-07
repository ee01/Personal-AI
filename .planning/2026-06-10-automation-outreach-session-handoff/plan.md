# Outreach Session Handoff Receipt

## Target

- Feature index pick: `主动询问会话管理`
- Source doc: `docs/memory_system.md`
- Main UI: `src/modals/components/OutreachSessions.vue`
- Existing proof: `tools/verify-outreach-sessions-e2e.mjs`

## Context

- `docs/progressing/to-verify.md` has no carry-over item.
- Local Reminders is reachable, but there is no `Personal AI` list, so no Reminder feedback can be incorporated or marked done.
- Prior uncommitted Outreach work already added list-page retry for failed / no_reply / escalated sessions. This run should not duplicate that path.

## Research Takeaway

- RingCentral Team Messaging and interactive cards support message delivery and response handling; the trust risk is whether users can see target, state, and recovery before sending or retrying.
- Slack Workflow Builder and Microsoft 365 Copilot Workflows expose trigger/action/input steps, approvals, and button/form boundaries rather than hiding the next step behind a generic status.
- Proactive-agent and HITL research points toward conservative interruption, visible human control points, and clear recovery for high-impact external actions.

## Plan

1. Add a compact `会话推进回执` to Outreach list cards.
2. Make the receipt status-specific:
   - pending approval: target confirmation and no external send before approval
   - scheduled: dispatch timing and engine dependency
   - waiting / deferred: reply polling and follow-up boundary
   - terminal retryable states: retry creates a new session cycle and keeps audit trail
   - resolved / cancelled: no automatic re-send
3. Extend `verify-outreach-sessions-e2e.mjs` to assert waiting, message-reaction, and retry receipts.
4. Update `docs/memory_system.md` with the list receipt behavior.
5. Validate with targeted Outreach E2E, first successful `npm start` compile, and `git diff --check`.
