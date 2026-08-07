# Message Analysis system observation runtime receipt

## Context

- Selected feature: `系统观察规则` under Message Analysis.
- Recent automation runs covered Memory Lens, Agent Thinking, Jira Design Links, Source Memory, OpenClaw, external AI import, DigestQueue, Today Pilot, Agent Workflow, and nearby Message Reaction surfaces, so this pass avoids those exact targets.
- `docs/progressing/to-verify.md` has no carry-over.
- EventKit found the `Personal AI` Reminders list with 4 total items, all completed and unrelated to Message Analysis or system observation rules.

## Research

- Webex Real-time Assist shows a pattern of runtime assistance that monitors active interactions and keeps suggestions/actions visible in context.
- AI transparency research supports transparency that helps a specific user understand current capability, limitation, and control state.
- Trigger-action debugging research supports exposing why automation rules are active, inactive, or producing side effects.

## Plan

1. Add a first-screen `系统观察规则回执` to the Message Analysis rule page.
2. Read the existing Memory Service Outreach template runtime-status endpoint; do not add a new backend contract.
3. Show runtime observation count, enabled templates, waiting-reply sessions, sync issues, source kinds, and sample targets.
4. Keep the receipt explicitly read-only: no importing, sorting, exporting, history replay, memory write, notification, auto-reply, RuntimeAction creation, or external execution.
5. Extend the existing Message Analysis E2E verifier to assert the receipt against the runtime-status fixture.
6. Update `docs/features/message_analysis.md` and `docs/index.md`.
7. Run focused checks, dev compile, E2E, and scoped diff checks.

## Non-goals

- Do not change watch rule matching, Outreach session generation, self-reflection rules, manual rule storage, imports, exports, sorting, notifications, memory writes, or action planning.
- Do not add a new management surface for system rules.
