# Notification Center Channel Delivery Receipts Findings

## Initial Context

- Selected feature from `docs/index.md`: `渠道投递回执`.
- Capability: Notification Center.
- Source document: `docs/features/notification_center.md`.
- Local Reminders list scan returned visible lists, but none named `Personal AI`.
- `docs/progressing/to-verify.md` currently says `暂无。`.

## Code And UX Findings

- `docs/features/notification_center.md` is largely current: it documents `channel_delivery_records`, `status` vs `effectiveStatus`, todo cooldown, `deliveryContext`, cross-channel `channelReceipts`, digest truncation, and the channel-vs-user-handled boundary.
- Main implementation: `memory-service/src/core/NotificationCenterService.ts`.
- Existing tests already cover feed filtering, sticky effective delivery after later failures, delayed callback ordering, todo cooldown, daily digest, cross-channel receipts, digest truncation, payload details, and API validation.
- UX gap: `formatChannelReceiptsHint()` only renders compact status labels such as `其他渠道：豆包已送达，Glip发送失败`. When one of those channels failed, the digest loses the useful failure reason (`lastError`) and the boundary text that a prior success does not mean the latest send is healthy.
- Chrome system notifications use a similarly compact `contextMessage`; keeping that compact is reasonable because OS notification context is space-constrained. Provider/Doubao markdown digests can afford a short recovery detail.

## External Reference Findings

- Twilio status callbacks model delivery as lifecycle events and include error details for failed/undelivered callbacks, supporting a receipt model that records both latest status and error reason.
- OneSignal separates provider-level `Delivered` from device-level `Confirmed Receipt`; this reinforces the Personal AI boundary that channel delivery is not user handling.
- Firebase Cloud Messaging distinguishes individual BigQuery message logs from aggregate delivery metrics and documents coverage/delay limitations. Diagnostic receipts should be explicit about event source and not overclaim completeness.
- HCI research on interruptive notifications treats notification context, urgency, and task-management cues as important for user value. For Personal AI, concise receipt context should help the user decide whether a repeated notification is a new item, a retry, or a still-unhandled item.
