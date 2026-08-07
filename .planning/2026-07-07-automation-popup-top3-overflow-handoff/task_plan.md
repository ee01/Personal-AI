# Popup Top 3 Overflow Handoff Plan

## Goal

Improve Today Pilot popup Top 3 so a user can recover the missions hidden by the compact Top 3 slice without mistaking the popup for the full queue.

## Target

- Feature: `Popup Top 3`
- Capability: Today Pilot
- Docs: `docs/features/today_pilot.md`, `docs/index.md`
- Main UI: `src/popup.tsx`
- Verification: `tools/verify-day-pilot-home.ts`, `tools/verify-today-pilot-home-e2e.mjs`

## Plan

1. Completed - Read workflow docs, automation memory, feature index, worktree state, to-verify list, and Reminder state.
2. Completed - Randomly selected `Popup Top 3`; inspected Today Pilot docs, popup implementation, targeted verifier, and E2E.
3. Completed - Add a compact popup overflow handoff when more visible missions exist beyond Top 3.
4. Completed - Update focused static and E2E assertions plus concise feature docs/index wording.
5. Completed - Run targeted verify, `npm start` first successful compile, Today Pilot E2E, scoped `git diff --check`, and update automation memory.

## Constraints

- Do not change Today Pilot ranking, filtering, feedback semantics, context pack rendering, Memory Service APIs, or source-system writes.
- Keep changes scoped despite broad unrelated dirty state.
- Reminder list has no incomplete items, so no Reminder item should be marked done.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| `node` missing from shell PATH | package script inspection | Use `$HOME/.nvm/versions/node/v24.13.0/bin` prefix |

## Verification

- Passed: `node --check tools/verify-today-pilot-home-e2e.mjs`
- Passed: `npm run verify:day-pilot-home`
- Passed: `npm start -- --progress` first successful compile, then watch stopped
- Passed: `npm run verify:today-pilot-home:e2e`
- Passed: scoped `git diff --check`
- Passed: cleanup check found no remaining webpack, Today Pilot E2E, Playwright, or Chromium process
