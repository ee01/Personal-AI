# Dream Replay Visible Review Handoff Plan

## Goal

Improve the `梦境重放` user path so a high-priority dream card does not stop at a triage explanation. The card should expose a visible, low-risk review handoff without changing Dream Replay generation, ranking, writes, or evidence semantics.

## Selected Feature

- Feature index row: `梦境重放`
- Source doc: `docs/memory_system.md`
- Primary UI: `src/modals/components/DreamInsights.vue`
- Existing verifier: `tools/verify-memory-dreams-e2e.mjs`

## Plan

1. Context and selection - complete
   - Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, feature index, memory workflow notes, current worktree status, Reminders, feature doc, UI, and E2E.
2. External scan and UX decision - complete
   - Use product/research references to constrain the improvement around visible source/control/review boundaries.
3. Implement visible review handoff - complete
   - Add a compact always-visible review handoff row next to each dream card's triage receipt.
   - Reuse the existing `reflectionReviewRoute(dream)` route and existing handoff receipt boundary copy.
   - Keep ungrounded dreams explicit: the link opens a filter for review, not proof or writeback.
4. Update docs and verifier - complete
   - Update the dream replay section and feature index line.
   - Extend the existing E2E to assert the visible handoff row and route semantics.
5. Validate - complete
   - Run `node --check tools/verify-memory-dreams-e2e.mjs`.
   - Run `npm start -- --progress` until first successful compile, then stop.
   - Run `npm run verify:memory-dreams:e2e`.
   - Run scoped `git diff --check`.

## Non-Goals

- Do not change `GenerativeReplay`, `dream_runs`, `HeartbeatLoop`, digest push behavior, Memory Service routes, evidence parsing, or Reflection thread filtering logic.
- Do not mark any Reminder done unless an incomplete related `Personal AI` item exists and is actually incorporated.

## Validation Evidence

- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" node --check tools/verify-memory-dreams-e2e.mjs` passed.
- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" npm start -- --progress` compiled successfully in 15647 ms and was stopped after the first successful compile.
- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" npm run verify:memory-dreams:e2e` passed after narrowing the receipt locators.
- `git diff --check -- .planning/.active_plan .planning/2026-07-07-automation-dream-replay-visible-review-handoff src/modals/components/DreamInsights.vue tools/verify-memory-dreams-e2e.mjs docs/memory_system.md docs/index.md` passed.
- Process cleanup check found no remaining webpack watcher, Dream E2E process, temp Dream profile, or Chromium process beyond the current `ps`/`rg` probe.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| `node` missing from default PATH for package-script discovery | Read package scripts | Use `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH"` for Node/npm commands. |
| E2E strict locator matched both visible and expanded handoff boundary copies | First Dream E2E run | Scoped assertions to `梦境可见复核入口` and `梦境复核交接回执`. |
