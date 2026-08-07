# Outreach list operation receipts

## Selected feature

- Feature: `主动询问会话管理`
- Source docs: `docs/index.md` -> `docs/memory_system.md`
- Runtime surface: `src/modals/components/OutreachSessions.vue`
- Verifier: `tools/verify-outreach-sessions-e2e.mjs`

## Reminder check

EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items. All items were already completed and related to historical Doubao / Notification / test feedback, not Outreach sessions, approvals, external questions, retry, cancellation, or RingCentral send boundaries.

## External scan

- OpenAI Agents SDK human-in-the-loop and LangGraph interrupt patterns separate requested tool actions from approved execution.
- Zapier approval steps and Copilot-style workflow controls reinforce that approval/retry/cancel states need visible user-facing feedback.
- Human-centered proactive-agent and HITL research supports making high-impact external actions resumable, auditable, and explicit before users trust that anything was sent or stopped.

## Plan

1. Keep backend semantics unchanged: do not alter Outreach API routes, session sorting, target resolution, approval guard, retry state machine, or RingCentral delivery.
2. Add a per-session list operation receipt for `批准发送`, `取消`, and `重试`.
3. Show `提交中`, `已处理`, and `失败未确认` states on the card so disabled buttons are not mistaken for confirmed sends, cancellations, or retries.
4. Preserve receipts when a successful retry/approval moves the session into the scheduled group.
5. Update the focused E2E to cover one list retry failure followed by success.
6. Update canonical docs and run focused verification.

