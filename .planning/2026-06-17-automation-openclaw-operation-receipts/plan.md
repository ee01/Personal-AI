# OpenClaw Action Queue Operation Receipts

## Scope

- Selected from `docs/features/index.md`: `OpenClaw 外部委派` / Memory Service / `docs/features/memory_system.md`.
- Main surface: `memory-exploring.html#/actions`, implemented in `src/modals/components/ActionQueue.vue`.
- Keep this run scoped to user-visible operation feedback for existing Action Queue actions. Do not change the OpenClaw delegation protocol, storage schema, or execution policy.

## Current State

- Action Queue already shows health summary, stale snapshot receipt, OpenClaw preflight, approval checkpoint, result artifact summary, transcript, stale running warnings, and failed-result evidence verification.
- The remaining UX gap is after a user clicks `确认并执行`, `执行`, `重试入队`, or `取消`: the page refreshes silently and the user must infer whether the click wrote approval, queued a retry, cancelled only the queue record, or confirmed an external fact.
- Local Reminders was readable, but no `Personal AI` list was visible, so no Reminder item is part of this run.

## External Reference Notes

- OpenAI Agents SDK HITL pauses sensitive tool calls and resumes from saved run state after approval, so the UI should make the approval/write boundary visible.
- LangGraph HITL documents approve / edit / reject decisions, reinforcing that each user decision should map to a specific execution state rather than a generic success toast.
- Zapier activity/audit surfaces emphasize run history and account activity visibility, supporting persistent operation receipts in Action Queue instead of transient feedback.
- Uncertainty-aware HITL research argues for asking humans only at meaningful risk/uncertainty points; concise receipts should reduce uncertainty without adding another review queue.

## Plan

1. Add per-action operation receipts in `ActionQueue.vue`.
   - Store the latest successful execute / retry / cancel operation by action id.
   - Show the receipt inside the action card with title, body, and compact facts.
   - For OpenClaw write or high-risk approval paths, make the receipt warning-toned and explicitly say external facts or side effects are not confirmed.
2. Wire receipts into existing operations.
   - `executeAction`: include returned queue status, approval flag, OpenClaw mode, and whether the result is still pending artifact/transcript verification.
   - `retryAction`: say the action was requeued; for OpenClaw write actions, remind the user to verify external side effects before another run.
   - `cancelAction`: say the queue action was cancelled only; it does not undo external Jira / Drive / deployment changes or delete evidence.
3. Update `tools/verify-action-queue-e2e.mjs`.
   - Assert `确认并执行` still sends `approve: true`.
   - Assert the card shows the new operation receipt and key boundary copy after execution.
4. Update `docs/features/memory_system.md`.
   - Add one concise note under OpenClaw Action Queue behavior; keep docs high level.
5. Verify.
   - Run the Action Queue E2E after rebuilding `dist`.
   - Run `npm start` until first successful compile and stop it.
   - Run scoped `git diff --check` on touched files plus the new planning file.
