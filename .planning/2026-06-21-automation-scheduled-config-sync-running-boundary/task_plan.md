# Scheduled Config Sync Running Boundary Plan

## Goal

Improve `定时消息配置同步` so the user can tell, while manual sync is still running, what has and has not happened yet.

## Target

- Feature index item: `定时消息配置同步`
- Feature doc: `docs/features/scheduled_messages_manager.md`
- Primary UI: `src/scheduled-messages/ScheduledMessagesManager.tsx`
- E2E: `tools/verify-scheduled-messages-config-sync-e2e.mjs`

## Plan

1. Inspect current docs, UI, config sync service, and existing E2E coverage. Status: complete.
2. Add a clearer running-state Config sync receipt that says adoption is not decided yet, no message is sent, `Messages` / `Logs` are not mutated by the running state, and a second click does not enqueue another read/refresh/write. Status: complete.
3. Add E2E coverage for a deliberately delayed Sheet Config read so the running receipt is asserted before the final success receipt. Status: complete.
4. Update the feature doc with the narrower running-state contract and current external references. Status: complete.
5. Run targeted config sync checks, first successful dev compile, feature E2E, and scoped whitespace checks. Status: complete.

## Validation Ladder

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/scheduled-messages/__tests__/appScriptConfigSync.test.ts`
- `npm start` until first successful compile, then stop watcher
- `npm run verify:scheduled-messages-config-sync:e2e`
- `git diff --check -- docs/features/scheduled_messages_manager.md src/scheduled-messages/ScheduledMessagesManager.tsx tools/verify-scheduled-messages-config-sync-e2e.mjs .planning/2026-06-21-automation-scheduled-config-sync-running-boundary`

## Risks

- Existing workspace has broad unrelated dirty state; keep changes scoped.
- E2E selectors should assert stable receipt fragments, not fragile full-layout text.
