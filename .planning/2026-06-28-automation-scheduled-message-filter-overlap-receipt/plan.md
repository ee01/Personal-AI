# Scheduled Messages Filter Overlap Receipt Plan

## Target

- Feature: `定时消息列表筛选`
- Source doc: `docs/features/scheduled_messages_manager.md`
- Main code: `src/scheduled-messages/scheduledMessagesFilters.ts`, `src/scheduled-messages/ScheduledMessagesManager.tsx`

## External scan

- Slack keeps scheduled messages in a dedicated Scheduled tab with direct edit, reschedule, cancel, and delete actions.
- Gmail keeps scheduled emails recoverable through the Scheduled folder; canceling a scheduled email returns it to Drafts instead of silently deleting the content.
- Zapier Zap History shows selected filters as visible chips, lets users remove filters, and separates filtering/replay from whether a run has already executed.
- Trigger-action debugging research repeatedly points to why/why-not visibility: users need to see which condition prevented an automation from appearing or running, especially when multiple conditions overlap.

## Current gap

The current Scheduled Messages list filter receipt reports hidden rows using the first rejection reason only. When a row is simultaneously non-pending, self-only, and outside the selected category, the receipt credits only the first matching guard. That keeps the actual list correct, but makes the explanation misleading: a user may think a category or pending-review filter had no effect even though it also excludes the same row.

## Plan

1. Keep `filterScheduledMessagesForView` behavior unchanged.
2. Add condition-level diagnostics that count each active filter independently.
3. Update `buildScheduledMessagesFilterReceipt` so the visible receipt explains per-condition counts and adds an overlap note when hidden rows match more than one active condition.
4. Extend unit tests with an overlapping-filter case and keep the first-reason helper covered.
5. Update the Scheduled Messages feature doc with the new explanation boundary.
6. Verify with the scheduled-message filter tests, the existing CRUD/filter E2E, `npm start` first successful compile, and scoped whitespace checks.

## Reminder status

The local Reminders lists were inspected. There is no `Personal AI` list on this machine, so no Reminder item is linked or marked done for this run.
