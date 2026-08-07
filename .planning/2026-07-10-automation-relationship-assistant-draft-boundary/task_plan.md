# Relationship Assistant Draft Boundary Plan

Goal: improve `人脉关系 Assistant Draft` by checking docs and code, incorporating current product/research references plus local Reminder feedback, then implementing a focused UX/accessibility fix with targeted verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, `docs/progressing/to-verify.md`, feature index, memory hints, root planning files, and current worktree state |
| 2 | completed | Check local Reminders `Personal AI` list and external product/research references for relationship-aware draft assistance |
| 3 | completed | Inspect Relationship Radar docs, Assistant Draft service/UI path, and existing API/E2E verifier coverage |
| 4 | completed | Implement button-level generate/copy preflight boundaries and update E2E assertions |
| 5 | completed | Update `docs/features/relationship_radar.md` and the Assistant Draft row in `docs/index.md` |
| 6 | completed | Run targeted API tests, webpack dev compile, E2E, and scoped diff checks |
| 7 | completed | Update automation memory and close out Reminder state honestly |

## Decisions

- Selected feature: `人脉关系 Assistant Draft` under Relationship Radar.
- Source doc: `docs/features/relationship_radar.md`.
- Code anchors: `src/modals/components/RelationshipRadarPage.vue`, `memory-service/src/core/RelationshipRadarService.ts`, `memory-service/src/routes/relationships.ts`, and `tools/verify-relationship-radar-e2e.mjs`.
- Reminder state: EventKit found `Personal AI` with 4 total items and 0 incomplete items; completed Doubao/log/digest items are unrelated, so no Reminder item should be marked done.
- Improvement slice: presentation/accessibility only. Add dynamic `title` and `aria-label` copy to Assistant Draft generate/copy buttons so pending, stale-goal, privacy, no-send, no-write, no-task, and clipboard-only boundaries are visible before click.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Initial random sampler included glossary rows | First index sampling command | Reran against only the `小功能点索引` table and selected a viable non-fresh Relationship Radar slice |
| AppleScript-style Reminder access can miss `Personal AI` | Reminder branch | Used EventKit Swift probe, which found the list and confirmed 0 incomplete items |
