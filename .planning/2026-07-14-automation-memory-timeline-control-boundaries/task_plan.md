# 2026-07-14 Automation: Memory Timeline Control Boundaries

## Goal

Improve the `记忆时间轴` feature from `docs/features/index.md` by aligning docs with code, scanning adjacent product/research patterns, checking Reminders, and implementing one bounded UX fix with strong verification.

## Selected Feature

- Feature: `记忆时间轴`
- Capability: Memory Exploring
- Source doc: `docs/features/memory_system.md`
- Main surface: `src/modals/components/TimelinePage.vue`
- Existing verifiers: `tools/verify-memory-timeline.ts`, `tools/verify-memory-timeline-e2e.mjs`

## Plan

1. [complete] Read repo workflow, automation memory, feature index, `to-verify`, Reminder state, feature doc, source, and verifiers.
2. [complete] Run a small external product/paper scan for timeline/refinding UX.
3. [complete] Add pre-click hover/ARIA boundaries to timeline range, scope, source filter, source overview chips, refresh, and empty-state recovery controls.
4. [complete] Update timeline docs/index with concise current behavior.
5. [complete] Run targeted unit verifier, first successful `npm start` compile, E2E verifier, and scoped `git diff --check`.
6. [complete] Update automation memory and close out Reminder state honestly.

## Scope Boundary

This run should be presentation/accessibility-only unless a verifier reveals a real behavior bug. It should not change recall ranking, `/recall` payload shape, Memory Service writes, feedback semantics, safe-link allowlists, source URL sanitization, Reminder state, or backend APIs.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| AppleScript did not list `Personal AI` Reminders | `osascript` list names | EventKit fallback found `Personal AI` with 4 total and 0 incomplete items |
| Timeline E2E strict locator matched multiple buttons after new ARIA copy | First E2E rerun | Scoped verifier locators to the range/scope groups and refresh class |
| Source chip ARIA dropped the visible `已隐藏` state | E2E after adding chip `aria-label` | Included `已隐藏` in the chip ARIA boundary when filtered |
| Negative feedback assertion expected a write when fixture was already negative | E2E feedback assertion | Adjusted verifier to assert the already-recorded/no-repeat boundary |
