# Relationship Review Queue Return Receipt Plan

## Target

- Feature: `人脉关系 Review Queue`
- Source doc: `docs/features/relationship_radar.md`
- Main UI: `src/modals/components/RelationshipRadarPage.vue`
- Verification: `npm run verify:relationship-radar`, first successful `npm start` compile, `npm run verify:relationship-radar:e2e`

## Reminder State

Local Reminders were readable, but the `Personal AI` list is absent. Present lists: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`.

No Reminder item is incorporated or marked complete.

## Research Notes

- Google Contacts `Merge & fix` and similar contact-cleanup surfaces keep suggested identity/profile changes as user-reviewed suggestions rather than silent writes.
- Salesforce / Microsoft relationship-intelligence patterns frame relationship context as evidence-backed guidance that should stay reviewable before it enters CRM or communication workflows.
- Mixed-initiative UI and automation-bias research support keeping AI suggestions explicit, reversible, and source-visible because users can otherwise rubber-stamp generated recommendations.
- Reminder and snooze research supports concrete return-time feedback and a visible recovery path; a deferred item should feel queued for later, not deleted or confirmed.

Useful links:

- https://support.google.com/contacts/answer/7078226
- https://www.salesforce.com/news/stories/salesforces-new-ai-agent-identifies-business-connections-to-build-relationships-for-salespeople/
- https://learn.microsoft.com/en-us/dynamics365/sales/relationship-analytics
- https://www.microsoft.com/en-us/research/publication/principles-of-mixed-initiative-user-interfaces/

## Current Behavior

- Full Review Queue cards correctly require opening the full review card before confirm/reject writes.
- Side panel only allows `进入复核` and `稍后 7 天`, which is acceptable because snooze does not write profile facts.
- Failure receipts explain non-effects and preserve local drafts.
- Successful snooze receipts include a date and next actions, but the compact side receipt omits the actual return state and the full receipt only shows a broad date line. As a user, after an item disappears I still want a durable "return ticket" saying exactly when it comes back, what status it now has, and whether my edited draft/note is preserved.

## Plan

1. Add a client-side review return receipt model that derives rows from `RelationshipReviewActionReceipt`.
2. For successful `snooze`, show a dedicated `稍后回队列凭证` block with exact return time, status after action, preserved evidence/draft/note state, and no-write boundary.
3. In the compact side receipt, show the same return time/status summary so the receipt remains useful after the full card disappears.
4. Keep confirm and reject receipts unchanged except for harmless generic action rows where useful; do not change backend writes or review action payloads.
5. Update the Relationship Radar E2E to assert the return receipt and side receipt.
6. Update the feature doc with the new Review Queue behavior.

## Non-Goals

- No change to `relationship_review_items` schema.
- No change to confirm/reject/snooze backend semantics.
- No new auto-confirmation, auto-send, task creation, or external sync.

## Validation Ladder

1. `npm run verify:relationship-radar`
2. `npm start -- --progress`, wait for first successful compile, then stop
3. `npm run verify:relationship-radar:e2e`
4. `git diff --check -- src/modals/components/RelationshipRadarPage.vue tools/verify-relationship-radar-e2e.mjs docs/features/relationship_radar.md .planning/2026-06-30-automation-relationship-review-return-receipt/plan.md`
