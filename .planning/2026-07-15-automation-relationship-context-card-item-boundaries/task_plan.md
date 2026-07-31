# Relationship Context Card Item Boundary Plan

Goal: improve the selected `人脉关系 Context Card` feature by checking docs/code freshness, incorporating current product/research references and local Reminder state, then implementing a narrow UX/code fix with real verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, memory hints, old planning files, and randomized feature candidates |
| 2 | completed | Check local Reminders through AppleScript and EventKit |
| 3 | completed | Inspect Relationship Radar docs, Context Card UI, API-facing fixture, package verifiers, and current docs/index row |
| 4 | completed | Gather current product and paper references for relationship intelligence, evidence, transparency, and AI-mediated communication |
| 5 | completed | Implement the smallest low-decision UX improvement and update canonical docs/index |
| 6 | completed | Run targeted static checks, dev compile, Relationship Radar E2E/API verification, and scoped diff hygiene |
| 7 | completed | Update automation memory and close out Reminder status honestly |

## Selected Feature

- Feature: `人脉关系 Context Card`
- Area: Relationship Radar
- Docs: `docs/features/relationship_radar.md`, `docs/features/index.md`
- Main UI: `src/modals/components/RelationshipRadarPage.vue`
- Main verifier: `tools/verify-relationship-radar-e2e.mjs`

## Plan

1. Add hover/read-screen boundaries to Context Card content items that users naturally inspect before copying: action suggestion cards, known-fact rows, relationship-hint rows, retrieval boost chips, and do-not-assume notes.
2. Keep the change presentation/accessibility-only: no API payload changes, no relationship scoring changes, no sensitive filter changes, no source opening changes, no clipboard/writeback changes.
3. Extend `verify-relationship-radar-e2e.mjs` to assert `title` / `aria-label` or group labels for the new item-level boundaries.
4. Update the canonical Relationship Radar docs and index row with concise behavior, not implementation detail.
5. Run Relationship Radar checks plus `npm start` first successful compile and scoped `git diff --check`.

## Decisions

- AppleScript does not list `Personal AI`, but EventKit does. EventKit found 4 total `Personal AI` reminders and 0 incomplete items; all existing items are completed historical Doubao/notification/test feedback and unrelated to Relationship Radar.
- External scan supports evidence-backed, transparent, low-side-effect relationship context cards. The constructive improvement is not another modal; it is putting inspectable item-level boundaries on the actual facts/suggestions/chips the user reads before copying context to another AI or chat.
- This run intentionally avoids modifying Review Queue, Meeting Brief, Assistant Draft, Relationship Graph, backend consolidation, or `relationship_context` writes.
- Validation passed: `node --check tools/verify-relationship-radar-e2e.mjs`, `npm run verify:relationship-radar`, `npm start -- --progress` first successful compile, `npm run verify:relationship-radar:e2e`, scoped `git diff --check`, and process cleanup check.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `shuf` unavailable | Random feature sampling | Used `awk` random weights plus `sort` and selected the first suitable non-recent target |
| AppleScript did not list `Personal AI` | Reminder list scan | Used EventKit fallback, which found `Personal AI` and confirmed 0 incomplete items |
