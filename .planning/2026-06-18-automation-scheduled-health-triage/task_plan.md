# Scheduled Messages Queue Health Triage Plan

## Goal

Improve `Scheduled Messages / 队列健康提示` so a real user can quickly see which blocked scheduled messages need action, what can be fixed with one click, and what boundary the action has.

## Scope

- Target feature: `队列健康提示` in `docs/features/scheduled_messages_manager.md`
- Main source: `src/scheduled-messages/scheduleHealth.ts`
- UI source: `src/scheduled-messages/ScheduledMessagesManager.tsx`
- Verification: `scheduleHealth.test.ts`, `verify-scheduled-messages-health-recovery-e2e.mjs`, `npm start`, `git diff --check`

## Plan

1. Inspect current docs, queue health code, and recovery E2E.
2. Capture external research findings for automation monitoring and reminder UX.
3. Add a pure triage summary helper for schedule health issues and recovery suggestions.
4. Render the triage summary in the top health banner without changing write behavior.
5. Update docs and tests.
6. Run targeted unit/E2E/build validation.
7. Update automation memory and archive the thread.

## Status

- Step 1: complete
- Step 2: complete
- Step 3: complete
- Step 4: complete
- Step 5: complete
- Step 6: complete
- Step 7: complete

## Errors Encountered

- `node` is not on the default shell `PATH`; use `$HOME/.nvm/versions/node/v24.13.0/bin`.
