# Scheduled Messages 队列详情快照回执

Created: 2026-07-05T21:05:09+0800

## Target

- Random feature: `队列可视化与改期建议`
- Source doc: `docs/features/scheduled_messages_manager.md`
- Main code: `src/scheduled-messages/ScheduledMessagesManager.tsx`, `src/scheduled-messages/scheduleQueuePressure.ts`

## Plan

1. Inspect current docs, source, E2E, and Reminder feedback.
2. Compare with relevant scheduled-message / automation-monitoring products and trigger-action debugging research.
3. Add a narrow queue-detail snapshot receipt when the user expands the queue card.
4. Update focused unit/E2E coverage and keep scheduling/writeback semantics unchanged.
5. Update `docs/features/scheduled_messages_manager.md` and `docs/index.md` only if needed.
6. Run targeted checks, first successful `npm start` compile, E2E, and scoped diff checks.

## Findings

- `Personal AI` Reminders exist through EventKit, but all 4 items are already completed and unrelated to Scheduled Messages queue suggestions.
- Current queue UI already has compact summary, hidden detail toggle, decision basis, writeback boundary, and success/failure reschedule notices.
- The missing UX receipt is the detail-expansion moment: it does not state the local snapshot time, visible vs hidden slot scope, or that expanding details does not refresh/sync/write/send.
- External references:
  - Slack scheduled message API exposes scheduled message ids, listability, limits, and deletion before send.
  - Twilio scheduled messages expose scheduled status and later status fetches.
  - Power Automate troubleshooting starts from run history and failed-step context.
  - Trigger-action debugging papers emphasize timing/expectation bugs and why/why-not debugging support.

## Verification Checklist

- [ ] `node --check tools/verify-scheduled-messages-crud-focus-e2e.mjs`
- [ ] focused scheduled-messages unit test(s)
- [ ] `npm start -- --progress` first successful compile
- [ ] scheduled messages E2E covering queue detail receipt
- [ ] scoped `git diff --check`
