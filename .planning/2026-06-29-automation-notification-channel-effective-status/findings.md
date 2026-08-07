# Notification Channel Effective Status Findings

## Initial Findings

- Randomly selected feature from `docs/index.md`: `渠道投递回执`.
- Capability: Notification Center.
- Source document: `docs/features/notification_center.md`.
- Implementation anchors found so far:
  - `memory-service/src/core/NotificationCenterService.ts`
  - `memory-service/src/repositories/ChannelDeliveryRepository.ts`
  - `memory-service/src/routes/notificationCenter.ts`
  - `memory-service/src/__tests__/notificationCenter.test.ts`
  - `tools/verify-notification-digest-push-options-e2e.mjs`
- Existing docs already state the central contract: `status` is the last channel event, while `effectiveStatus` preserves meaningful delivered/clicked/dismissed state even after a later failed attempt.
- Local Reminders list names were readable, but no list named `Personal AI` exists in this macOS Reminders account.
- The worktree is already broadly dirty across many unrelated files; this run must use scoped diffs and not revert anything pre-existing.

## External Reference Findings

- Twilio outbound messaging docs model delivery as lifecycle status callbacks that can progress through sending, delivery, failure, and read receipt states; this supports treating Chrome display failure as a real channel event, not an absence of evidence.
- Twilio delivery-status logging guidance also recommends reconciliation because callbacks can be missed; Personal AI's feed retry path needs explicit failed receipts when the local client knows a display attempt failed.
- Firebase Cloud Messaging documents BigQuery delivery export for accepted/delivered/latency analysis, reinforcing that delivery metadata should be stored for later diagnosis instead of only driving immediate UI.
- Apple notification guidance says Time Sensitive / interruption levels should match current relevance; this supports keeping failed/non-delivered channels diagnosable so retries and user interruption remain intentional.
- Notification research, including attention-sensitive alerting and intelligent notification-system surveys, argues for balancing interruption cost with deferral/missed-alert cost; reliable channel-failure receipts are the signal needed to make that tradeoff without silently dropping reminders.

## Improvement Candidate

- Current service-side `effectiveStatus` handling is strong: `ChannelDeliveryRepository` preserves delivered/clicked/dismissed state across later failures, and `NotificationCenterService` exposes cross-channel receipt summaries.
- Gap found in Chrome poller: `pollBackendNotifications()` records `delivered` after `chrome.notifications.create()` succeeds, but if create throws, the outer feed try/catch can abort without writing a `failed` Chrome delivery receipt. The backend then cannot show `previous_delivery_failed`, and later items in the same feed may be skipped.
- Planned fix: wrap each item creation separately, report failed delivery with a compact create error, clear the local notification metadata, and continue to the next feed item.
