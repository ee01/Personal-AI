# Glip AI Marker Tooltip Boundary Plan

Goal: improve the `Glip AI 标注` feature by checking that docs match current code, incorporating relevant external product/research signals and local Reminder feedback, then implementing a focused UX/code improvement with targeted verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read repo workflow, automation memory, feature index, existing plan context, Reminder state, and external references |
| 2 | completed | Inspect Glip AI marker docs, source, current UI behavior, and verification scripts |
| 3 | completed | Decide the smallest low-decision UX/code improvement and document the implementation plan |
| 4 | completed | Implement scoped source, verifier, and docs/index updates without reverting unrelated dirty work |
| 5 | completed | Run targeted static/E2E verification plus `npm start` first successful compile |
| 6 | completed | Update automation memory, close Reminder if applicable, and summarize outcome |

## Decisions

- Selected feature: `Glip AI 标注` under Message Reaction, from randomized `docs/index.md` candidates after skipping fresher exact/family targets.
- Source doc: `docs/features/message_reaction.md`.
- Reminder result so far: AppleScript did not list `Personal AI`, but EventKit found it with 4 total items and 0 incomplete items. No live Reminder item is available to incorporate or mark done.
- Current worktree is broadly dirty from prior runs. This run owns only Glip AI marker tooltip/boundary changes, matching verifier/doc updates, this planning folder, `.planning/.active_plan`, and automation memory.
- Implementation slice: reuse the existing marker receipt model for `follow_thread_original` and `follow_thread_related` special controls so their button `title` / `aria-label` and tooltip carry folded marker scope, status meaning, next step, source, cache refresh, and local-snapshot boundary. Do not change marker sorting, cache generation, background refresh, or any write/action behavior.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `shuf` unavailable | Random feature sample | Used `awk` random score plus `sort -n` instead |
| Skill path from one root missing | Planning skill read | Read the available copy from `/Users/Esone/.agents/skills/planning-with-files/SKILL.md` |
| `verify:glip-ai-markers:e2e` timed out after new receipt text | First rerun | The helper found the first matching hidden tooltip text; changed it to accept any visible matching tooltip |
| `verify:glip-ai-markers:e2e` hit strict locator ambiguity | Second rerun | New Watch aria labels also contained generic receipt labels, so ordinary AI marker assertions now target the `AI 标注` button |
