# Notification Digest Push Pending Receipt Plan

## Target

- Selected feature: `周报与梦境摘要推送` in `docs/features/notification_center.md`.
- Carry-over check: `docs/progressing/to-verify.md` is empty.
- Reminder check: local Reminders is readable, but there is no `Personal AI` list, so no Reminder item is included or completed.

## Current State

- Options already sends the current visible push target to `/weekly-report/push-now` and `/dream-digest/push-now`.
- The result receipt shows generated/not generated, target, Notification Center notice write status, Bot delivery status, and generated content details.
- UX gap: while the request is in flight, the previous result receipt can remain visible and the user cannot tell which target was just submitted.
- The current result receipt already renders the boundary once; this run keeps that intact and adds a separate pending state before the result arrives.

## External Signals

- Apple notification summaries are user-selected and scannable; priority/reduced interruption modes separate immediate attention from lower priority summaries: https://support.apple.com/guide/iphone/summarize-notifications-reduce-interruptions-iph1fbe7d2b9/ios
- Slack Activity emphasizes a clear feed, filters, read/clear state, and dense/detail views for notification triage: https://slack.com/help/articles/19693583638803-Get-your-work-done-from-the-Activity-view
- Slack's 2026 notification rebuild frames the goal as calm, consistent, understandable notification behavior: https://slack.engineering/how-slack-rebuilt-notifications/
- Microsoft Viva Insights explicitly treats personal digest surfaces as private/user-controlled and has paused some digest emails while keeping app access: https://learn.microsoft.com/en-us/viva/insights/personal/overview/privacy-guide-admins
- Iqbal and Bailey's CHI work supports deferring notifications to lower-cost moments and making notification management fit user expectations: https://interruptions.net/literature/Iqbal-CHI08.pdf

## Implementation Steps

1. Add a `pending` phase to the existing digest manual push receipt model.
2. Set a pending receipt immediately after validation and before the fetch for both Dream Digest and Weekly Report.
3. Render pending rows that show submitted target, expected notice/Bot behavior, and no scheduling/acknowledgement side effects.
4. Keep the existing result boundary as a single line and avoid showing stale prior-result text during a new request.
5. Update the existing Options E2E to prove pending receipt appears before the mocked backend returns, then final receipt replaces it.
6. Update `docs/features/notification_center.md` with the current pending-result behavior.
7. Verify with syntax check, dev compile, Options E2E, and scoped whitespace check.
