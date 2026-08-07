# Outreach Pre-Approve Review Plan

## Target

- Random feature: `主动询问` / Outreach under `docs/index.md`.
- Source of truth: `docs/memory_system.md`.
- UI surface: `src/modals/components/OutreachSessionDetail.vue`.

## Initial Evidence

- `docs/progressing/to-verify.md` has no carry-over item.
- Automation memory file did not exist at start of run.
- Local Reminders has no `Personal AI` list, so no Reminder feedback can be merged or marked done.
- Existing recent Outreach sweeps already cover list priority, focus lane, empty filters, terminal retry, operation scope, operation result receipts, and unsaved draft receipts.

## External Scan

- RingCentral Team Messaging API supports one-on-one and group/team messages plus bot/webhook workflows, so the risk is not API capability but target, timing, and reply attribution.
- Microsoft Copilot Studio Request for information pauses a flow, collects human reviewer input, and resumes later, which maps to Outreach approval and review checkpoints.
- OpenAI Agents SDK HITL pauses sensitive tool calls, surfaces interruptions, and resumes from saved state after approval or rejection.
- Slack Workflow Builder exposes workflow activity and errors, reinforcing that automated outreach needs visible state and recovery instead of opaque sends.
- Human-centered proactive conversational-agent research warns that proactive systems can feel intrusive without expectation management, so Outreach should show why an external ask is still necessary before approval.

## Improvement Plan

1. Add a `发送前复核` receipt on Outreach session detail for `pending_approval` and `scheduled` sessions.
2. Summarize target readiness, planned send timing, session freshness, existing evidence/reply risk, and external side-effect boundary.
3. Keep approval semantics unchanged: unresolved targets still block via existing `canApprove`; stale/evidence warnings remain visible guidance rather than hidden state changes.
4. Extend `verify-outreach-sessions-e2e.mjs` to assert the pre-approve review on a pending-approval detail, including stale/evidence warnings and approval boundary copy.
5. Update `docs/memory_system.md` concisely.

## Verification Plan

- `node tools/verify-outreach-sessions-e2e.mjs`
- `npm start` until first successful development compile, then stop watcher.
- `git diff --check -- src/modals/components/OutreachSessionDetail.vue tools/verify-outreach-sessions-e2e.mjs docs/memory_system.md .planning/2026-06-29-automation-outreach-preapprove-review/plan.md`
