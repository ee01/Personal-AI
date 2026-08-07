# OpenClaw Recovery Path Receipt Plan

## Target

- Random feature: `OpenClaw 外部委派` from `docs/index.md`.
- Canonical doc: `docs/memory_system.md`.
- Main UI: `memory-exploring.html#/actions` / `ActionQueue.vue`.

## Product Scan

- OpenAI Agents SDK HITL pauses sensitive tool calls and resumes from stored run state after approval.
- LangGraph HITL exposes approve / edit / reject decisions around tool calls before resuming.
- Zapier Agents exposes activity statuses such as needs action, failed, completed, and uses activity dashboards for recovery.
- HITL research supports showing the smallest actionable recovery context around high-risk actions instead of forcing users through raw logs.

## Problem

OpenClaw failures already create recovery actions for notification, decision-center confirmation, or rule improvement. The failed action result keeps `followUpActionIds`, but the Action Queue card only showed a count. As a user, I could not tell whether the next step was a notification, a decision request, or a rule-improvement handoff without inspecting raw JSON or searching the queue manually.

## Plan

1. Extend OpenClaw failure results with `followUpActions` summaries while keeping `followUpActionIds` for compatibility.
2. Add an Action Queue `恢复路径回执` for `delegate_openclaw` cards with follow-ups.
3. Link each follow-up summary to the same Action Queue page filtered by `actionId`.
4. Keep the boundary explicit: recovery entries do not mean the original OpenClaw action retried, external facts were confirmed, messages were sent, or write side effects were undone.
5. Cover the path in `tools/verify-action-queue-e2e.mjs` with a `capability_missing` fixture.

## Verification

- `npm --prefix memory-service test -- --run src/__tests__/actionExecutor.test.ts`
- `npm start` until first successful dev compile, then stop.
- `node tools/verify-action-queue-e2e.mjs`
- Scoped `git diff --check`.
