# Scheduled Messages Compensation Window Receipt Plan

## Target

- Random feature: `执行匹配与补偿窗口`
- Capability: Scheduled Messages
- Source doc: `docs/features/scheduled_messages_manager.md`

## Current State

- `app-script-template.gs` already matches due executor messages in three phases: current minute, past 2-30 minute compensation, then the no-time `08:00 后队列`.
- `scheduleHealth.ts` correctly keeps explicit executor rows healthy while they are still inside the 30 minute compensation window.
- The management page shows a compensation receipt, but its visible text only says elapsed and remaining minutes. The important path distinction is mostly in hover text, so a user can still wonder whether the row was already sent, needs manual reschedule, or will be claimed before no-time queue rows.

## External Scan

- Slack and Gmail scheduled-message flows treat scheduled items as manageable objects: users can inspect, edit/reschedule, cancel/delete, or send now before delivery.
- Google Apps Script time-driven triggers are cron-like and can run as often as every minute, so slight trigger delay needs a visible tolerance model rather than a promise of exact wall-clock execution.
- Reliable task-scheduler discussions such as Dropbox ATF and durable workflow guidance prefer at-least-once execution with retry/idempotency and observable execution history over pretending every delayed trigger is exactly-once and instantaneous.

## Implementation Plan

1. Update the live compensation receipt copy so the visible row says this is still a future compensation claim, not a send confirmation.
2. Expand the receipt detail / accessibility text to include the three matching phases, the `08:00 后队列` priority boundary, and the `Last_Exec / Exec_Log / Execution_Key` skip guard.
3. Add `aria-label` on the management-page receipt so the full boundary is available without relying on hover title.
4. Update unit and E2E assertions for the new visible / accessible copy.
5. Refresh the Scheduled Messages feature doc and index row with the concise current behavior.

## Verification Plan

- `npm test -- --run src/scheduled-messages/__tests__/scheduleHealth.test.ts`
- `node --check tools/verify-scheduled-messages-health-recovery-e2e.mjs`
- `npm start -- --progress` until first successful compile, then stop
- `npm run verify:scheduled-messages-health-recovery:e2e`
- Scoped `git diff --check`
