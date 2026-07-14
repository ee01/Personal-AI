# Relationship Review Queue Button Boundary Plan

Run time: 2026-07-11T09:04:14+0800

## Selected Feature

- Index row: `人脉关系 Review Queue`
- Canonical doc: `docs/features/relationship_radar.md`
- Main UI/API/code: `src/modals/components/RelationshipRadarPage.vue`, `memory-service/src/routes/relationships.ts`, `memory-service/src/core/RelationshipRadarService.ts`
- Verifier: `tools/verify-relationship-radar-e2e.mjs`, package scripts `verify:relationship-radar` and `verify:relationship-radar:e2e`

## Repo And Reminder Baseline

- `docs/progressing/to-verify.md` is empty.
- Automation memory shows today's freshest exact targets are Notification snooze evidence, Auto Reply save boundary, Jira Design Links recovered open receipt, Memory Lens hover slice, Meeting Pilot alert scope, Agent Workflow next-action boundary, Scheduled Messages, Quick Ask, and Topic Messages. This run avoids those exact targets.
- EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items. No open Relationship Radar / Review Queue / person-fact review feedback exists to incorporate or mark done.
- The worktree already has broad unrelated dirty state. This plan owns only the Relationship Review Queue button-boundary change, matching E2E/doc/index updates, and this planning directory.

## External Scan

- Microsoft Dynamics 365 Relationship Intelligence exposes relationship health and "who knows whom" based on communication and meeting patterns, with visible source/data timing and connection-strength concepts.
  - https://learn.microsoft.com/en-us/dynamics365/sales/ri-overview
  - https://learn.microsoft.com/en-us/dynamics365/sales/who-knows-whom
  - https://learn.microsoft.com/en-us/dynamics365/sales/faq-relationship-intelligence
- Affinity frames relationship intelligence as AI-driven capture and scoring of contact/activity data; its support docs make recency/frequency-derived relationship strength explicit.
  - https://www.affinity.co/why-affinity/what-is-relationship-intelligence
  - https://support.affinity.co/s/article/Leveraging-your-Connections-and-Relationship-Strengths
- Salesforce Einstein Relationship Insights positions relationship recommendations as a way to discover networks and act inside CRM, which makes the handoff from suggestion to durable CRM record important.
  - https://trailhead.salesforce.com/content/learn/modules/einstein-relationship-insights-basics/get-started-with-einstein-relationship-insights
  - https://www.salesforce.com/sales/einstein-relationship-insights-pricing/
- AI-mediated communication research shows generated suggestions can change language and interpersonal perception, and suspected AI use can affect how people are judged. Relationship-fact writeback should therefore preserve user agency and make confirmation boundaries visible at the control point.
  - https://arxiv.org/abs/2102.05756
  - https://arxiv.org/abs/2210.06470
- Human-AI transparency and agency work reinforces that critical suggestions should expose what the AI is doing and leave the final decision with the human.
  - https://www.sciencedirect.com/science/article/pii/S2543925124000147
  - https://arxiv.org/abs/2403.15919

## Diagnosis

The Review Queue already has strong surrounding receipts:

- Full cards show impact preview and draft receipt.
- Success/failure receipts distinguish confirm, reject, and snooze.
- Side rail quick snooze has a no-write receipt.
- Side rail no longer supports one-click confirm.

The remaining UX gap is at the actual click controls. The full-card `确认`, `稍后 7 天`, and `驳回` buttons and side-rail quick `稍后 7 天` button only expose their short visual labels to hover and screen-reader users. In a relationship-fact workflow, the consequence difference matters:

- `确认` writes the edited value into the person profile and changes downstream context cards, meeting briefs, and assistant drafts.
- `稍后` preserves the candidate/draft/note/evidence and returns the item later without writing the profile.
- `驳回` saves the note and keeps evidence, but does not write or delete source evidence.
- Side-rail quick snooze intentionally bypasses editing and full evidence review, so it needs a button-level warning that it uses current candidate text and existing notes.

## Implementation Plan

1. Add small presentation helpers in `RelationshipRadarPage.vue`:
   - `reviewActionBoundaryText(item, action, options?)`
   - `reviewFocusButtonBoundaryText(item)`
   - The helper should include person, field, evidence count, dirty draft/note state, and action-specific side effects.
2. Bind the helper output to `title` and `aria-label` on:
   - Full-card confirm button.
   - Full-card snooze button.
   - Full-card reject button.
   - Side-rail `进入复核`.
   - Side-rail quick snooze.
3. Extend `tools/verify-relationship-radar-e2e.mjs` to assert:
   - Full-card confirm title/aria mentions profile write and downstream relationship surfaces.
   - Full-card snooze title/aria mentions 7-day return and no profile write.
   - Full-card reject title/aria mentions no profile write and evidence retention.
   - Side-rail quick snooze title/aria mentions current candidate/existing note and no full-card review.
4. Update `docs/features/relationship_radar.md` Review Queue section and the matching `docs/features/index.md` row.

## Non-Goals

- No backend behavior changes.
- No change to `relationship_review_items` schema.
- No change to confirm / reject / snooze action payloads.
- No change to relationship scoring, consolidation, context cards, meeting briefs, assistant draft generation, or evidence link handling.
- No Reminder item completion because no related open Reminder exists.

## Verification Plan

1. `npm run verify:relationship-radar`
2. `node --check tools/verify-relationship-radar-e2e.mjs`
3. `npm start -- --progress`, wait for first successful compile, then stop the watcher.
4. `npm run verify:relationship-radar:e2e`
5. Scoped `git diff --check` for the files owned by this run.
