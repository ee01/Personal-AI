# OpenClaw Execute Request Boundary Plan

## Target

- Random feature: `OpenClaw 外部委派`
- Source doc: `docs/memory_system.md`
- Primary UI: `src/modals/components/ActionQueue.vue`
- Main verifier: `tools/verify-action-queue-e2e.mjs`

## Context

- `docs/progressing/to-verify.md` has no carry-over items.
- Local Reminders is reachable, but there is no `Personal AI` list, so no Reminder item can be incorporated or marked done.
- A 2026-06-21 sweep already added OpenClaw-specific approval copy. This run should not repeat that work.
- Current external references reinforce the same product direction: HITL agent systems should distinguish pending approval, accepted execution requests, completion proof, and auditability. Relevant references checked: OpenAI Agents SDK HITL, LangChain / LangGraph HITL decisions, Microsoft Copilot Studio approvals/RFI, Magentic-UI, and uncertainty-aware HITL research.

## Finding

`ActionQueue.vue` marks an action as `running` before the execute API request is accepted. If an OpenClaw execute request fails and the follow-up silent refresh also fails, the page can preserve a false running snapshot. For write-mode delegation this is a trust bug: the UI may imply OpenClaw has started even when Memory Service never accepted the request.

## Implementation Plan

1. Move Action Queue optimistic state updates so `running` / final status is applied only after the execute API returns successfully.
2. Add an operation-error receipt for OpenClaw execute failures that says the execute request was not accepted, approval was not recorded unless the server says so later, and external completion is still unproven.
3. Extend `tools/verify-action-queue-e2e.mjs` with a failing write-mode OpenClaw action where the execute request returns 503 and the following list refresh also fails; assert the card remains queued and shows the no-submit boundary instead of running.
4. Update `docs/memory_system.md` with the current execute-request failure boundary.
5. Validate with the Action Queue E2E, first successful `npm start` compile, and scoped `git diff --check`.
