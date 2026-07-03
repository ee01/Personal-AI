# Notification Digest Manual Push Receipt Plan

## Target

- Feature: `周报与梦境摘要推送`
- Capability: Notification Center
- Source doc: `docs/features/notification_center.md`

## Research Signals

- Microsoft Viva Insights keeps personal digest/insight delivery behind user-visible settings and opt-out controls.
- Apple notification summaries let users choose which app notifications are summarized and when summaries are delivered.
- Slack Activity exposes filters and custom views so notification streams remain scannable instead of becoming opaque pushes.
- Email batching research supports batching as an interruption-control pattern, but the batch still needs enough context for the user to judge whether to act.

## Problem

Options currently turns manual weekly report / Dream Digest push results into a short global status message. As a user, I cannot tell from the local UI whether the click generated content only, created a Notification Center notice, tried Bot delivery to Me or a group, or failed to send Bot while still preserving the generated report/notice. The backend already returns part of this truth, but Dream Digest does not expose the included dream scope and neither Options section keeps a durable per-action receipt.

## Plan

1. Extend manual push results with user-auditable details:
   - Weekly report: include `botError` when Bot delivery fails.
   - Dream Digest: include `notificationCreated`, `dreamCount`, `latestDreamPath`, and `botError`.
2. Add Options section-level receipts after manual push:
   - Show generated/skipped state, target, Notification Center write state, Bot delivery state, path/counts, and scope.
   - State non-effects: no global acknowledge/dismiss, no schedule/config change, no external write when target is `none`.
3. Add E2E coverage for Options:
   - Mock memory-service runtime config, weekly push-now, and dream push-now.
   - Click both buttons and assert the receipts and request payloads.
4. Update canonical docs and index.
5. Verify:
   - Backend route/unit test.
   - `npm start` first successful compile.
   - New Options E2E.
   - Existing weekly report notification and dream replay E2Es for destination integrity.
   - Scoped whitespace check.

