# Action Queue Execution Scope Plan

## Target

- Random feature: `动作队列` under Memory Service / Memory Exploring.
- Canonical doc: `docs/features/memory_system.md`.
- Main UI: `src/modals/components/ActionQueue.vue`.

## Current Findings

- The Action Queue page already has queue health cards, stale-refresh snapshots, OpenClaw preflight panels, approval checkpoints, operation receipts, and OpenClaw artifact verification.
- The weaker UX path is non-OpenClaw actions. `notify_user`, `ask_external_user`, `create_confirm_request`, and truth/profile writes can still show a generic `执行` / `重试入队` / `取消` row without a first visible explanation of what that operation may do and what it will not prove.
- Local Reminders is reachable, but this machine has no `Personal AI` list, so no Reminder item can be folded into this run.

## External References

- Temporal HITL workflows pause risky agent actions, wait durably for approval, and keep an audit trail before execution: https://docs.temporal.io/ai-cookbook/human-in-the-loop-python
- LangChain HITL middleware frames tool-call approval as explicit decisions such as approve, edit, reject, or respond, with state saved for later resume: https://docs.langchain.com/oss/python/langchain/human-in-the-loop
- Zapier Human in the Loop exposes review content, reviewer decision, timeout, and audit behavior around workflow continuation: https://help.zapier.com/hc/en-us/articles/38731463206029-Request-approval-to-keep-your-workflow-running-with-Human-in-the-Loop
- A 2026 safe-agent framework argues that transparency and accountability are prerequisites as agents move from advice into real-world action: https://arxiv.org/html/2601.06223v1

## Implementation Plan

1. Add an `执行范围` panel for non-OpenClaw Action Queue cards.
2. Make the panel action-type aware:
   - notification actions: request notification delivery, but final delivery still depends on provider/Notification Center receipts.
   - outreach actions: hand off to Outreach, but do not bypass approval or prove a RingCentral message has been sent.
   - confirm-request actions: create/update a Decision Center request, but do not decide for the user.
   - truth/profile updates: write local memory truth/profile state, but do not send externally or sync cross-platform.
   - generic runtime actions: submit to Memory Service runtime, with completion proven only by queue state/result.
3. Preserve the existing OpenClaw preflight/verification UI without duplicating it.
4. Extend `tools/verify-action-queue-e2e.mjs` to assert the new panel on notification, outreach, and filtered failed actions.
5. Update `docs/features/memory_system.md` and `docs/features/index.md`.
6. Verify with targeted Action Queue E2E, first successful `npm start` compile, scoped `git diff --check`, and no lingering watcher process.
