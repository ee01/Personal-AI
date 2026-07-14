# Scheduled Messages Filter Background Snapshot Plan

## Target

- Feature: `定时消息列表筛选`
- Source doc: `docs/features/scheduled_messages_manager.md`
- Code: `src/scheduled-messages/scheduledMessagesFilters.ts`, `src/scheduled-messages/ScheduledMessagesManager.tsx`

## Findings

- The manager renders base `Messages` rows first, then completes Jira Automation status sync, Outreach runtime overlay, and Done backfill in the background.
- Filter receipts already explain selected conditions, hidden counts, self-only identity matching, overlapping filters, and no-write boundaries.
- During background enrichment, those counts can still look final. A user can misread the currently filtered slice as a confirmed full-state list.

## External Scan

- Slack exposes scheduled message listing as a bounded pending-message query with explicit time and pagination parameters: https://docs.slack.dev/reference/methods/chat.scheduledMessages.list/
- Zapier shows run-history filters as removable filter buttons and keeps run status/details separate from the filtered list: https://help.zapier.com/hc/en-us/articles/8496291148685-View-and-manage-your-Zap-history
- Airtable run history supports status filters and drilling into run details, reinforcing that filtered automation views should keep status evidence visible: https://support.airtable.com/docs/getting-started-with-airtable-automations
- TAP research shows timing and user-interpretation bugs are common in end-user automations, so pending-vs-confirmed state should be made explicit: https://hewj.info/papers/chi19-ifttt-cameraready.pdf

## Plan

1. Extend the filter receipt builder with a background-enrichment option.
2. When background enrichment is active, render the receipt as a current Messages snapshot, not a confirmed final list.
3. Update unit and E2E assertions to cover the visible snapshot receipt.
4. Update the feature doc with the user-facing behavior.
5. Run scheduled-messages filter tests, first successful dev webpack compile, CRUD-focus E2E, and scoped `git diff --check`.
