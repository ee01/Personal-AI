# Relationship Radar Spotlight Action Receipt Plan

Goal: improve `人脉关系人物雷达` by tightening the first-screen user path from priority person to next action, while keeping Relationship Radar read-only until explicit Review Queue confirmation.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read repo rules, stale root planning files, automation memory, feature index, worktree state, and Reminders list names |
| 2 | completed | Select the random target and inspect Relationship Radar docs, UI, routes, and E2E coverage |
| 3 | completed | Scan adjacent products and AI-mediated communication research for relationship-prioritization UX constraints |
| 4 | completed | Implement a spotlight action receipt that states why this person is next, what to do first, and what will not happen |
| 5 | completed | Update feature docs and E2E assertions for the new visible contract |
| 6 | completed | Run targeted relationship verification, first webpack compile, E2E, and scoped diff checks |
| 7 | completed | Update automation memory and close out Reminder status honestly |

## Decisions

- Selected feature: `人脉关系人物雷达` under Relationship Radar.
- Source doc: `docs/features/relationship_radar.md`.
- Primary implementation: `src/modals/components/RelationshipRadarPage.vue`.
- Primary verifier: `tools/verify-relationship-radar-e2e.mjs`; targeted backend compatibility remains `npm run verify:relationship-radar`.
- Reminder state: local Reminders is reachable, but no `Personal AI` list exists, so no Reminder item can be incorporated, completed, or annotated.
- Current slice: add a first-screen `行动前回执` inside the spotlight card. It should make the action path visible where the user clicks, without changing ranking, backend write semantics, or Review Queue confirmation rules.

## External Direction

- Microsoft Dynamics relationship intelligence emphasizes relationship health, who-knows-whom, and explicit monitoring/consent cautions.
- Affinity relationship intelligence uses recency/frequency-based relationship strength and follow-up triggers.
- Salesforce Einstein Relationship Insights positions relationship evidence and recommended relationships as assistant input, not invisible user action.
- AI-mediated communication research flags agency, disclosure, and interpersonal perception risks when AI modifies or suggests relationship communication.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Existing root `task_plan.md` describes an old Scheduled Messages run | Planning-file restore | Treat root files as stale history and use this dated planning directory |
| No `Personal AI` Reminders list | Bounded AppleScript list scan | Stop Reminder branch; do not invent item completion |
| Broad existing dirty worktree | `git status --short` | Keep edits scoped to Relationship Radar, its verifier, docs, this plan, and automation memory |
