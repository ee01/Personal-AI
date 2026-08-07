# Automation Plan: Storyline Draft Review Boundary

Goal: Improve the Memory Storyline Builder draft review experience from the feature index, keeping docs current, using product/research context, implementing a scoped UX/code fix, and validating it end to end.

## Phases

1. Context and current behavior - complete
   - Read feature docs, source files, tests, and Reminders state.
   - Identify one scoped user-facing gap.
2. External scan - complete
   - Compare similar product patterns and research around source-grounded narrative drafts/review.
3. Plan lock - complete
   - Record the improvement plan and exact implementation scope.
4. Implement - complete
   - Make narrowly scoped code/doc/test updates.
5. Validate - complete
   - Run targeted tests, dev build, E2E where available, and whitespace checks.
6. Closeout - in progress
   - Update automation memory, mark applicable Reminder done if any, attempt thread archive.

## Decisions

- Avoid recent exact automation-memory targets where practical.
- Selected Memory Storyline Builder draft page/API from docs/index.md after rerolling away from fresh Memory Capture/Memory Lens overlap.
- Use .planning/2026-06-18-automation-storyline-draft-review-boundary for this run.
- Locked scoped implementation: add a draft-level segment grounding review receipt, require copy acknowledgement to cover that receipt, update Storyline docs, and extend the existing Storyline draft page E2E.
- Reminder branch: local Reminders was readable, but no `Personal AI` list was visible.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| `npm` not found in Codex shell | `npm --prefix memory-service test ...` | Rerun with `$HOME/.nvm/versions/node/v24.13.0/bin` prepended to PATH per `AGENT.md`. |
