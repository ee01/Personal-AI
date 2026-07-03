# Scheduled Config Sync Singleflight

## Scope

- Target feature: `定时消息配置同步` in `docs/features/scheduled_messages_manager.md`.
- Main surface: `scheduled-messages.html` manual Sync action.
- Reminder check: local Reminders is reachable, but no visible `Personal AI` list exists on this machine, so no Reminder item is linked or completed.

## External References

- Airtable Sync makes manual versus automatic sync, source fields, deletion behavior, and recovery visible in sync configuration.
- Zapier replay and Power Automate resubmit/cancel flows expose operation state and completion status instead of treating manual recovery as an invisible click.
- Trigger-action debugging research shows users need help moving from unexpected automation behavior to identifying whether an action actually ran and what to do next.

## Improvement Plan

1. Keep the existing Sheet-first Config refresh logic and current conflict handling.
2. Add a manual Sync singleflight guard so rapid repeat clicks do not start concurrent Config reads, Messages refreshes, or worksheet-ID recovery writes.
3. Keep the page visible while sync is running, disable only the Sync button, and show a persistent running receipt with source, boundary, and next step.
4. Update docs to describe the running-state boundary and no-send/no-duplicate guarantee.
5. Extend the config-sync E2E so two same-tick Sync clicks still produce one Config read and one final result receipt.

## Validation Targets

- `npm --prefix memory-service test -- --run src/__tests__/api-health.test.ts` is not required; this change is extension UI only.
- Targeted unit/config checks:
  - `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/scheduled-messages/__tests__/configSyncFreshness.test.ts src/scheduled-messages/__tests__/manualBindConfigDecision.test.ts src/scheduled-messages/__tests__/appScriptConfigSync.test.ts`
- Extension compile:
  - `npm start`, wait for first successful development compile, then stop.
- Browser proof:
  - `npm run verify:scheduled-messages-config-sync:e2e`
- Hygiene:
  - scoped `git diff --check`.
