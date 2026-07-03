# Task Scheduler refresh pending receipt

## Target

- Feature: `Task Scheduler 状态 API`
- Docs: `docs/features/task_scheduler_api.md`
- Main UI: popup background task panel in `src/popup.tsx`

## Plan

1. Keep the panel scoped to status visibility, not scheduler behavior.
2. Change refresh metadata from a generic refreshed timestamp to the last confirmed snapshot time.
3. Add a pending refresh receipt while an explicit status request is in flight, stating that the visible task list is still the last confirmed snapshot.
4. Update the feature doc to describe the pending receipt and confirmation boundary.
5. Extend the popup E2E to cover the pending receipt, successful refresh receipt, failed refresh receipt, and old-snapshot boundary.
6. Run the Task Scheduler targeted verifier, status filter verifier, popup E2E, first successful `npm start` compile, and scoped whitespace checks.

## Research direction

- Chrome alarms are not enough as a hidden truth source; the UI should show when the extension has actually checked alarm state.
- Automation products such as Zapier separate run history, replay, and deletion/cancellation effects; this supports keeping refresh, run, pause, and repair effects separate.
- Automation transparency research supports making responsibilities, current activity, and effects visible, but without implying that an in-flight status check is already confirmed.
