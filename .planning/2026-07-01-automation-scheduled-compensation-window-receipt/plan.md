# Scheduled Messages Compensation Window Receipt Plan

## Target

- Feature: `执行匹配与补偿窗口` in `docs/features/scheduled_messages_manager.md`.
- Scope: make the row-level Scheduled Messages manager UI explicitly show when an Active executor-driven message is currently inside the 2-30 minute compensation window.

## Current Finding

- The Apps Script executor already matches current-minute explicit messages, then past 2-30 minute compensation, then the no-time 08:00-after queue.
- The manager already warns after a message is beyond the compensation window and already explains congested same-minute queues.
- A single explicit-time Bot / AI / managed JiraAutomation row that is late but still inside the compensation window has no first-line receipt. Users can see only the abstract lane, so the state can be misread as already sent, permanently missed, or just waiting without a time boundary.

## External References

- Slack scheduled messages keep pending messages manageable through edit, reschedule, send, cancel, and delete actions.
- EventBridge Scheduler exposes flexible time windows, retry policy, and DLQ concepts instead of hiding delayed execution behind one status.
- Temporal durable timers separate persisted wake-up from worker-side execution, reinforcing that a timer firing is not the same as the side effect completing.
- Notification and reminder research supports reducing ambiguity by batching/deferring with visible timing and recovery boundaries.

## Implementation Plan

1. Add a pure helper in Scheduled Messages health logic that detects the in-window compensation state.
2. Render a compact row-level `补偿窗口回执` under the existing execution lane summary.
3. Keep the helper read-only: no changes to Apps Script matching, Sheet writes, Logs, Last_Exec, or queue ordering.
4. Update feature docs and tests.

## Verification

- Run focused Scheduled Messages unit tests for health/queue/execution route.
- Run `npm start -- --progress` until the first successful compile and stop it.
- Run a Scheduled Messages E2E that covers manager row rendering.
- Run scoped `git diff --check`.
