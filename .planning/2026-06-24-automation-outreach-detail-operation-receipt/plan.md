# Outreach Detail Operation Receipt Plan

## Target

- Random feature: `主动询问` under Memory Service / Outreach.
- Scope: Outreach detail page action feedback for approve, retry, cancel, and draft save.

## Evidence

- `docs/progressing/to-verify.md` has no carry-over item.
- Local Reminders is reachable, but there is no `Personal AI` list.
- Current docs already describe Outreach target resolution, approval, waiting, retry, and list triage receipts.
- Product/research scan points to the same direction: RingCentral can send to users/groups, while Copilot Studio RFI and OpenAI Agents SDK HITL pause/resume patterns require visible approval and recovery boundaries; proactive-agent research warns that proactive messaging feels intrusive without expectation management.

## Plan

1. Add an inline operation result receipt to `OutreachSessionDetail.vue` so approve/retry/cancel/save failures are visible in the page instead of only in console or alerts.
2. On success, show the returned/current status and state that approval/retry/cancel/save does not prove a RingCentral send, reply, profile write, or external sync unless the session status/event shows it.
3. Extend `verify-outreach-sessions-e2e.mjs` with pending-approval detail coverage for approve failure and approve success receipts.
4. Update `docs/memory_system.md` with the concise current behavior.
5. Verify with the targeted Outreach E2E, dev compile, and scoped whitespace check.
