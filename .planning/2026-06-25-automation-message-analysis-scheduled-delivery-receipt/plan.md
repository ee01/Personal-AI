# Message Analysis Scheduled Delivery Receipt Plan

## Target

- Sampled feature: `Message Analysis -> 消息入库与通知分发`.
- User path: background `message_analysis` runs should not look fully successful when only part of memory write, notification, follow-thread, or RuntimeAction delivery succeeded.

## Evidence

- `docs/progressing/to-verify.md` has no carry-over items.
- Local Reminders has no `Personal AI` list in this environment, so no related Reminder item can be completed.
- Existing docs already describe `本轮分发回执` on the rule page, but scheduled task history did not consume that receipt.
- External scan: Slack keyword workflows and Zapier filters expose trigger conditions before actions continue; trigger-action debugging research and attention-sensitive alerting both support visible partial-failure and interruption-cost feedback.

## Implementation Steps

1. Return the finalized `MessageAnalysisDeliveryReceipt` from all Message Analysis run paths.
2. Add a shared summary helper that converts receipt counters into task-result text and partial-failure state.
3. Use that helper in `TaskScheduler.executeMessageAnalysis()` so scheduled runs mark downstream partials as non-success results.
4. Extend verifiers for returned partial receipts and scheduler summary behavior.
5. Update `docs/features/message_analysis.md` and the feature index.

## Validation Plan

- Run `npm run verify:memory-entry-message-flow`.
- Run `npm run verify:task-scheduler-api`.
- Run `npm start` until the first successful dev compile, then stop it.
- Run `npm run verify:message-analysis-rule-diagnostics:e2e` if available directly, otherwise invoke the script.
- Run scoped `git diff --check`.
