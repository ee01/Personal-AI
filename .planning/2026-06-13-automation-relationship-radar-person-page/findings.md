# Relationship Radar Person Page Findings

## Initial Context

- `docs/progressing/to-verify.md` says `暂无。`, so there is no carry-over item to continue.
- Random selector candidates included Digest Queue, Jira Automation Import, Meeting Pilot, Today Pilot, Scheduled Messages, and Relationship Radar; the selected non-recent target is `人脉关系人物雷达`.
- Local Reminders lists: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No local Reminders list named `Personal AI` is visible.
- The worktree is broadly dirty from prior unrelated work; this run should avoid reverting or staging unrelated files.

## Inspection Notes

- `docs/features/relationship_radar.md` is broadly current: it documents the hybrid lazy/background/user-confirmed projection model, data-quality receipts, privacy defaults, context card / meeting brief / assistant draft / review queue boundaries, safe evidence links, and recommended verification commands.
- Main UI: `src/modals/components/RelationshipRadarPage.vue`.
- Main API/service: `memory-service/src/routes/relationships.ts` and `memory-service/src/core/RelationshipRadarService.ts`.
- Existing verification: `npm run verify:relationship-radar` and `npm run verify:relationship-radar:e2e`.
- Concrete defect: generated artifacts in the detail page are scoped to a person, but `loadPeople()` can change `selectedPersonId` indirectly after search/filter/refresh without clearing old `meetingBrief`, `assistantDraft`, or `assistantDraftCopyReceipt`. This can show Alice's generated draft/meeting result under Bob's selected detail when the selected person changes through filtering rather than a direct person-card click.
- UX improvement target: clear person-scoped generated artifacts when the selected person changes indirectly, and show a small receipt that says which person is now active and what was reset.

## External Reference Notes

- Salesforce Einstein Relationship Insights positions relationship AI as a virtual agent that scans sources, recommends related people/companies, and works alongside sales reps rather than replacing them. It also highlights in-workflow evidence and one-click CRM enrichment as the action boundary.
- Clay for Teams emphasizes a unified relationship timeline, whole-network search, "who knows who best", and an AI navigator for asking relationship questions. TechCrunch's Clay Nexus coverage also calls out privacy and using only the data needed for a specific question.
- Vtiger's 2026 personal CRM guide frames personal CRM around continuity: relationships unfold naturally, interaction timelines restore context, and reminders should support judgment rather than force pipeline movement.
- Horvitz's mixed-initiative UI principles support coupling automated services with direct manipulation, which maps to clearing stale AI-generated outputs while leaving the user in control of regeneration.
- Human-centered XAI review findings support explanations that are meaningful in the user's task context; for Relationship Radar this means visible source/scope/reset receipts, not just hidden state cleanup.
