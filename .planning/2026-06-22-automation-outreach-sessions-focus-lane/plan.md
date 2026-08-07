# Outreach Sessions Focus Lane

## Target

- Feature: `主动询问会话管理`
- Source of truth: `docs/memory_system.md`
- UI surface: `src/modals/components/OutreachSessions.vue`

## Current Finding

The Outreach sessions list already has page-level triage and per-card receipts, but the path from "what should I do first?" to the exact session is still indirect. For example, the page can say failed terminal sessions should be handled first while those cards remain in the history group below waiting and scheduled sessions.

## External Scan

- Microsoft Copilot Studio RFI pauses a workflow, asks designated reviewers for structured input, and resumes only after response.
- OpenAI Agents SDK HITL surfaces pending approvals as explicit interruptions before sensitive tool calls continue.
- Slack Workflow Builder positions automations as inspectable trigger/action flows that can collect information and route responses.
- Proactive-agent research argues that initiative must be paired with expectation management and user control.

## Plan

1. Add a first-screen `本轮处理对象` lane after the page triage receipt.
2. Pick one exact focus object using the same UX priority as the triage receipt: load/config blockers, retriable terminal sessions, pending approval, waiting/deferred, scheduled, then pending templates.
3. Keep the lane read-only. Its primary action navigates to detail or the relevant filtered list and does not approve, send, retry, cancel, write RingCentral, or update Memory Service.
4. Add E2E assertions for initial failed-session focus, post-retry waiting-session focus, and message-reaction filtered focus.
5. Update `docs/memory_system.md` and `docs/index.md`.

## Validation

- `npm start` until first successful compile, then stop the watcher.
- `node tools/verify-outreach-sessions-e2e.mjs`.
- `git diff --check` scoped to touched files and the new plan.
