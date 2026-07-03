# Scheduled Messages Queue Folded Summary Plan

## Target

- Feature: `队列可视化与改期建议`
- Source doc: `docs/features/scheduled_messages_manager.md`
- Code surface: `src/scheduled-messages/scheduleQueuePressure.ts` and `src/scheduled-messages/ScheduledMessagesManager.tsx`

## Research Notes

- Slack scheduled-message flows keep schedule editing as a visible managed object.
- Zapier and Power Automate keep run errors, replay/resubmit, and recovery state visible in history surfaces.
- Trigger-action programming research shows users often misread timing and action effects, so recovery controls need cause, timing, and non-effect boundaries near the action.

## Improvement Plan

1. Keep the existing queue calculation and writeback behavior unchanged.
2. Add a compact folded-summary formatter that names total queued messages, congested slots, max same-slot size, max delay, and risk next step.
3. Use that formatter in the Scheduled Messages queue banner so the first screen is informative before details are expanded.
4. Update focused unit and E2E checks, then refresh the feature doc.

## Validation

- Run `scheduleQueuePressure` unit tests.
- Run `npm start -- --progress` until first successful compile, then stop the watcher.
- Run `verify:scheduled-messages-queue-suggestion:e2e`.
- Run scoped `git diff --check`.
