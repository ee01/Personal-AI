# Findings

## Repository

- `NotificationCenterService.listFeedResult()` already produces `meta.snapshotReceipt` with channel, lanes, delivery mode, limit, returned count, `hasMore`, and no-write boundary.
- Empty digest output already explains empty feed success through `buildFeedEmptyDigestLine()`.
- Non-empty digest output lacks the same snapshot-scope receipt unless `hasMore` or token-budget truncation happens.

## External Scan

- Slack Activity presents notifications as a filterable feed with recent notifications, dense/detailed views, saved views, mark-read, and clear controls: https://slack.com/help/articles/19693583638803-Get-your-work-done-from-the-Activity-view
- Microsoft Teams describes Activity feed notifications as a triage surface for changes that need attention: https://learn.microsoft.com/en-us/graph/teams-send-activityfeednotifications
- Apple notification summaries emphasize reducing interruptions and letting users choose which notifications are summarized: https://support.apple.com/guide/iphone/summarize-notifications-reduce-interruptions-iph1fbe7d2b9/ios
- Notification-interruption research reports that reducing notification-caused interruptions can improve performance and reduce strain: https://pmc.ncbi.nlm.nih.gov/articles/PMC10244611/

## UX Conclusion

For Personal AI, digest recipients should see whether a summary is a bounded queue snapshot, which channel/mode it came from, and whether hidden items remain. The safest improvement is a compact receipt in non-empty digest markdown, not a behavior change.

