# Today Pilot Refresh Scope Boundary

## Goal

Improve the randomly selected `今天排序与噪声控制` feature by making the refresh control's effect explicit at the point of action. The refresh path may read or regenerate the derived Today Pilot brief and sibling catch-up/stats snapshots, but it must not be mistaken for marking source messages read, writing feedback, sending, approving, or executing tasks.

## Selected Feature

- Feature: `今天排序与噪声控制`
- Docs: `docs/features/today_pilot.md`, `docs/features/index.md`
- Main UI: `src/modals/components/OverviewPage.vue`, `src/popup.tsx`
- Verifiers: `tools/verify-day-pilot-home.ts`, `tools/verify-today-pilot-home-e2e.mjs`

## Plan

1. Complete code/doc inspection, Reminder check, and external research.
2. Add homepage and popup refresh `title` / `aria-label` boundary copy without changing backend behavior.
3. Extend static and E2E coverage for the refresh-control boundary.
4. Update concise feature docs and index wording.
5. Run targeted verifier, first successful `npm start` compile, Today Pilot E2E, and scoped diff checks.

## Status

- Phase 1: complete
- Phase 2: complete
- Phase 3: complete
- Phase 4: complete
- Phase 5: complete

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| `planning-with-files` skill path under `.codex/skills` missing | Initial skill read | Read the installed skill from `/Users/Esone/.agents/skills/planning-with-files/SKILL.md` |
| AppleScript did not list `Personal AI` Reminders | Reminder probe | Used EventKit fallback, which found the list with 0 incomplete items |
