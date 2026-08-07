# Outreach Send Review Receipt Sweep

## Goal

Improve the `主动询问` user journey from `docs/index.md` by inspecting docs/code, checking Reminders, using a small product/paper scan, implementing one bounded UX/trust fix, updating docs, and running targeted verification plus extension build/E2E.

## Phases

1. Context and target selection - complete
2. Inspect Outreach docs, source, and verifier - complete
3. Check local `Personal AI` Reminders and external references - complete
4. Finalize the concrete improvement plan - complete
5. Implement the scoped change and docs update - complete
6. Run targeted verification, `npm start`, E2E, and scoped diff check - complete
7. Update automation memory and close out - complete

## Selected Feature

- Feature: `主动询问`
- Capability: `Memory Service`
- Source doc: `docs/memory_system.md`
- Primary UI: `src/modals/components/OutreachSessions.vue` and `src/modals/components/OutreachSessionDetail.vue`
- Existing E2E: `tools/verify-outreach-sessions-e2e.mjs`

## Constraints

- Preserve unrelated dirty worktree changes.
- Do not broaden Outreach send/retry/cancel semantics unless verification shows a real bug.
- Prefer visible pending/review/scope receipts over backend rewrites.
- If Reminder items are unrelated or already completed, do not mark anything done.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| Planning skill path first tried under `.codex/skills` | Read planning skill | Re-read the installed skill under `.agents/skills` |
