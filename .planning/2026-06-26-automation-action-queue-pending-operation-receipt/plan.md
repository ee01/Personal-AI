# Action Queue Pending Operation Receipt

## Target

- Random feature: `动作队列` from `docs/index.md`.
- Source of truth: `docs/memory_system.md`.
- Main implementation: `src/modals/components/ActionQueue.vue`.
- Existing browser proof: `tools/verify-action-queue-e2e.mjs`.

## Context Checks

- `docs/progressing/to-verify.md` has no carry-over items.
- Local Reminders list names are readable, but there is no `Personal AI` list, so no Reminder item can be consumed or completed in this run.
- Recent automation memory covered Task Scheduler, Message Reaction, Agent Thinking, Today Pilot, Scheduled Messages, Coverage Map, Skill Foundry, Memory Exploring, Agent Workflow, Meeting Pilot, Project Dashboard, Notification, Jira Design Links, Native Join, Message Analysis, Prompt Config, Relationship Radar, Rehearsal, User Profile, Memory Capture, Topic Messages, Quick Ask, and Compose Assist. Action Queue is outside the freshest exact targets.

## External Scan

- OpenAI Agents SDK HITL pauses sensitive tool calls until a person approves or rejects them, and exposes resumable run state.
- LangGraph HITL documents approve, edit, reject, and respond decisions, with durable pause/resume semantics.
- Zapier Agents activity/status pages make in-progress, needs-action, failed, cancelled, and completed runs visible for troubleshooting.
- Magentic-UI and related HITL agent research point to low-cost human involvement, action guards, and clear runtime control for risky external-tool workflows.

## UX Gap

Action Queue already explains execution scope before a user clicks and keeps success/failure operation receipts after Memory Service responds. During the in-flight request itself, the card mostly relies on a loading button. As a user, that leaves a short but important ambiguity: did the queue already accept the execute/retry/cancel request, did OpenClaw start, or is the page still waiting for Memory Service?

## Plan

1. Add a card-level pending operation receipt while execute, retry, or cancel is in flight.
2. Keep the receipt derived from existing front-end operation state; do not change backend contracts or optimistic queue semantics.
3. For execute, say Memory Service has not confirmed receipt yet and the visible queue badge remains the last snapshot.
4. For retry and cancel, say the requeue/cancel write is not confirmed yet and external side effects or source evidence are not undone.
5. Extend the Action Queue E2E with a delayed execute response so it proves the pending receipt appears before the server reply and disappears into the existing confirmed receipt afterward.
6. Update the feature doc with the pending-operation boundary.
7. Verify with `npm run verify:action-queue:e2e`, `npm start` first successful compile, scoped `git diff --check`, and leftover watcher check.
