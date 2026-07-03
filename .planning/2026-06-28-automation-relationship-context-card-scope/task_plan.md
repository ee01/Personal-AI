# Relationship Context Card Improvement Plan

Goal: improve the `人脉关系 Context Card` feature from `docs/features/index.md` by checking current docs against code, using current product/research references, applying a narrow low-decision UX/code fix, updating docs, and validating the result.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory, repo workflow, carry-over docs, Reminder list state, and select a non-duplicate random feature |
| 2 | completed | Inspect Relationship Radar docs, context-card code, tests, and current UI path |
| 3 | completed | Search current industry products and research for relationship context / people intelligence cards |
| 4 | completed | Decide the smallest useful improvement plan and record rationale |
| 5 | completed | Implement scoped code/docs updates without touching unrelated dirty files |
| 6 | completed | Run targeted verification, extension compile/E2E when relevant, i18n, and scoped diff checks |
| 7 | completed | Update automation memory and Reminder state if applicable |

## Decisions

- Selected target: `人脉关系 Context Card` under Relationship Radar.
- Source doc: `docs/features/relationship_radar.md`.
- Reminder branch: local Reminders list is readable, but there is no visible `Personal AI` list, so no Reminder item can be incorporated or marked done.
- Avoided random candidate `Persona / 近期重点 / 提醒推送` because it overlaps too closely with recent Doubao manual-push automation memory.
- Current worktree has broad pre-existing dirty changes. Keep this run scoped to Relationship Context Card files, tests, docs, planning, and automation memory only.
- Current docs are mostly current: they already describe Context Card privacy defaults, receipt rows, stale stored cards, failure retention, and copy boundaries.
- UX gap selected for implementation: while a new Context Card privacy scope is being requested, the UI only shows a generic loading line and hides the current card. Users cannot tell whether the previous card is still the last confirmed display, whether the sensitive-scope request has succeeded, or whether copying/writeback has happened.
- Implementation slice: show a `上下文卡请求回执` when a same-person card refresh starts with an existing snapshot. Keep the old snapshot visible, disable copy/privacy actions while loading, and label requested scope, current displayed scope, replacement state, and no-write/no-send/no-task boundary.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `timeout` command missing | First Reminder probe | Re-ran the Reminders list scan with `perl alarm`; Personal AI list is absent |
