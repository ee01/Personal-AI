# Relationship Radar Review Queue Draft Receipt Plan

## Target

- Feature: Relationship Radar -> 人脉关系 Review Queue
- Canonical doc: `docs/features/relationship_radar.md`
- Source files: `src/modals/components/RelationshipRadarPage.vue`, `tools/verify-relationship-radar-e2e.mjs`

## External Signals

- Google Contacts `Merge and fix` keeps suggested merges as explicit user-accepted actions and provides an undo path for merged contacts.
- Salesforce Einstein Relationship Insights surfaces evidence for relationship recommendations so users can judge relationship nature before accepting.
- HubSpot task queues treat queues as filterable work organization, not as hidden task completion or deletion.
- Mixed-initiative UI and automation-bias research both argue for direct manipulation, visible uncertainty, and avoiding AI-suggestion rubber-stamping.

## UX Gap

The Review Queue already blocks sidebar one-click profile writes and shows action receipts after success. The remaining user-facing gap was inside the full review card: editing the proposed value and note looked like durable input, but the page did not explicitly say the edits were only a local page draft until confirm/snooze/reject. Action failures also fell back to a generic error, which could leave the user unsure whether a write or queue move happened.

## Implementation Plan

1. Add a compact draft receipt to each full review card.
2. Mark edited value / note as a local page draft that has not written to Memory Service.
3. Make confirm / snooze / reject semantics explicit from the draft receipt.
4. Add a visible failure receipt for confirm / snooze / reject failures.
5. Update the Relationship Radar E2E to simulate a failed confirm before a successful snooze.
6. Update the canonical feature doc and run the Relationship Radar validation ladder.

## Verification Plan

- `npm run verify:relationship-radar`
- `npm start`, wait for first successful compile, then stop the watcher
- `npm run verify:relationship-radar:e2e`
- Scoped `git diff --check`
