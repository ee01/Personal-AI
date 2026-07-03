# Notification Channel Receipt Context Plan

## Target

- Feature index target: `渠道投递回执`
- Canonical doc: `docs/features/notification_center.md`
- Scope: make channel delivery receipts easier to interpret in the first visible Chrome notification line without changing routing, cooldown, or global handling state.

## Research Signals

- Twilio status callbacks treat outbound delivery as lifecycle events, not a single boolean.
- OneSignal confirmed delivery distinguishes accepted/sent from device receipt.
- FCM delivery data exists for diagnostics and is not complete enough to pretend every path is certain.
- Notification-interruption research supports fewer ambiguous re-alerts and clearer status before interruption.

## Plan

1. Keep the existing `channel_delivery_records` semantics: latest `status`, sticky `effectiveStatus`, and separate global clicked/dismissed state.
2. Add current-channel failure detail to `deliveryContext` so Chrome can explain a retry caused by a failed last attempt.
3. Format Chrome context labels with compact failure reason plus effective-state boundary for current and other channels.
4. Update Notification Center docs and index.
5. Validate with targeted notification tests, memory-service tests, dev compile, and scoped whitespace.

## UX Boundary

The new labels explain delivery receipts only. They do not confirm, dismiss, retry, resend, sync, or mutate source evidence.
