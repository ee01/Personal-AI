# Action Queue Deep-Link Locator Plan

## Goal

Improve `动作队列` from `docs/index.md` by making action deep links trustworthy when the target action is outside the first visible list slice.

## Context

- Source doc: `docs/memory_system.md`.
- Code surface: `src/modals/components/ActionQueue.vue`, `src/services/MemoryServiceClient.ts`, `memory-service/src/routes/actions.ts`, `memory-service/src/repositories/ActionRepository.ts`.
- Existing verifier: `tools/verify-action-queue-e2e.mjs`.
- Reminder check: EventKit found `Personal AI` with 4 items, all already completed and Doubao/Notification-related; none apply to Action Queue.
- External scan: OpenAI Agents SDK and LangGraph both model high-risk tool calls as persisted approval interruptions/resume state; Zapier keeps run-history filters, run details, replay, and error logs; HITL research supports asking humans only at high-risk/low-confidence points while preserving transparency and accountability.

## Findings

- Docs are broadly current for Action Queue: queue health, stale snapshots, approval boundary, operation pending receipts, OpenClaw result/recovery receipts, and generic action scope receipts all exist in the UI.
- UX defect: `ActionQueue.vue` reads `route.query.actionId` but still requests `/actions?limit=50` and filters the target on the client. A deep link from Notification Center or a recovery action can show an empty state if the target action is not in the first server page.
- The empty state mentions `动作 ID` but does not prove whether the backend searched by ID or only the current visible slice was scanned.

## Plan

| Phase | Status | Work |
| --- | --- | --- |
| 1 | complete | Read repo workflow, automation memory, feature index, docs, Reminders, Action Queue code, tests, and outside references. |
| 2 | complete | Add backend/client support for `actionId` on `GET /actions` so direct links can locate one action outside normal pagination. |
| 3 | complete | Add a visible `定位请求回执` on Action Queue when `actionId` is present, including found/not-found state and no-side-effect boundary. |
| 4 | complete | Update `docs/memory_system.md` with the direct-link behavior and receipt boundary. |
| 5 | complete | Extend API and extension E2E verification for action-id lookup outside the first visible slice. |
| 6 | complete | Run targeted memory-service test, `npm start` first compile, Action Queue E2E, scoped `git diff --check`, then update automation memory. |

## Non-Goals

- Do not change action execution, approval, retry, cancellation, OpenClaw delegation, or Notification Center routing semantics.
- Do not mark any Reminder item done because no related open Reminder exists.

## Errors Encountered

| Error | Resolution |
| --- | --- |
| AppleScript did not show `Personal AI` Reminders | EventKit confirmed the list and all items; none were relevant. |
| `.planning/.active_plan` pointed to an older Notification Center run | Create a new isolated plan directory for this sweep. |
| `node` / `npm` were missing from shell PATH | Used `$HOME/.nvm/versions/node/v24.13.0/bin` for all Node verification. |
