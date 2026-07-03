# Notification Center Feed Retry Receipt Plan

Goal: improve the randomly selected `Notification Center feed` feature by keeping docs, implementation, and visible user-facing retry reasons aligned.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | complete | Read AGENT.md, automation memory, to-verify, feature index, Reminders state, and current dirty worktree |
| 2 | complete | Inspect Notification Center docs, service code, route, Chrome notification helpers, and tests |
| 3 | complete | Review current product references and notification/interruption research |
| 4 | complete | Implement focused feed delivery-context fix and doc/test sync |
| 5 | complete | Run focused memory-service tests, extension compile, and diff checks |
| 6 | in_progress | Update automation memory and close the run |

## Selected Feature

- Feature index row: `Notification Center feed`
- Capability: Notification Center
- Source doc: `docs/features/notification_center.md`
- Main implementation: `memory-service/src/core/NotificationCenterService.ts`

## Improvement Plan

1. Treat a latest failed delivery receipt as `previous_delivery_failed` even when an older successful todo delivery has already cooled down.
2. Keep daily digest semantics explicit: failed retries should sort before ordinary new or already-delivered-unfinished items.
3. Update tests so the regression is locked at service level.
4. Update the feature doc with the latest feed reason precedence.
5. Verify with the focused notification-center test suite, first successful `npm start` compile, and diff checks.

## Notes

- `docs/progressing/to-verify.md` says `暂无。`.
- Local Reminders has no `Personal AI` list, so no Reminder item can be incorporated or completed.
- The repo was already broadly dirty before this run. Keep edits scoped to Notification Center files plus this planning folder and automation memory.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `node` missing from default shell PATH | Random feature selection | Added `$HOME/.nvm/versions/node/v24.13.0/bin` per AGENT.md and continued |
| `node --test src/__tests__/backendNotifications.test.ts` could not resolve TS `.js` imports | Adjacent Chrome helper test | Reran with `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test ...` |
