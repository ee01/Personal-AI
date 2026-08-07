# Dream Replay Deep-Link Handoff Plan

## Goal

Improve the Dream Replay page so a user arriving from a Dream Digest notification can immediately see which dream was referenced, what evidence state it has, and what the next review action will and will not do.

## Target

- Feature index row: `梦境重放`
- Source doc: `docs/memory_system.md`
- Main UI: `src/modals/components/DreamInsights.vue`
- Existing proof: `npm run verify:memory-dreams:e2e`

## Plan

1. Context and research - complete
   - Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, feature index, Dream Replay docs, Vue page, and E2E.
   - Checked Reminders: local `Personal AI` list is absent.
   - External scan points toward transparent source/evidence boundaries for generated memory summaries.
2. UX implementation - complete
   - Put explicit notification deep-link targets first in the loaded dream list.
   - Add a card-level notification handoff receipt before the generic triage receipt.
   - Keep the action boundary read-only and review-only.
3. Docs and tests - complete
   - Update Dream Replay docs with the new card-level handoff behavior.
   - Extend `verify-memory-dreams-e2e` assertions.
4. Validation - complete
   - Run targeted E2E.
   - Run `npm start` until first successful compile, then stop it.
   - Run scoped `git diff --check`.

## Risks

- Worktree is already dirty. Only touch the selected feature files and this planning directory.
- The page already has many receipts, so the new receipt must reduce ambiguity without becoming another noisy card.

## Validation

- `npm start` first successful compile completed after the final source edit, then the watch process was stopped.
- `npm run verify:memory-dreams:e2e` passed after the final build.
- `git diff --check` passed for the touched files.
- No `webpack --watch` process remained after closeout.
