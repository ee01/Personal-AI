# Rehearsal List Scope Receipt Plan

## Target

- Feature: `Rehearsal 管理页` from `docs/index.md`
- Surface: `memory-exploring.html#/rehearsals`
- Scope: presentation-layer honesty for the current list/filter view

## Inputs Checked

- `AGENT.md`
- `docs/progressing/to-verify.md`
- `${CODEX_HOME:-$HOME/.codex}/automations/automation/memory.md`
- Local Reminders list names
- `docs/features/rehearsal.md`
- `src/modals/components/RehearsalsPage.vue`
- `tools/verify-rehearsals-page-e2e.mjs`

## External Scan Takeaways

- Microsoft To Do and Todoist make date/location/list filters explicit, which reduces confusion about why an item is visible in a particular view.
- Digital reminder and prospective-memory research repeatedly emphasizes cue-action binding: users need to see both the trigger context and the intended action before trusting a reminder.
- Rehearsal differs from task reminders because list browsing is audit and repair, not task execution or automatic activation.

## User Problem

The Rehearsal page already explains per-card and per-detail prompt eligibility, but the list itself does not summarize why the current batch is visible. This is confusing when:

- `Active` includes legacy rows that are active by status but missing future cues.
- A deep-linked row is pinned outside the selected filter.
- Search/status filters change what the user sees but do not change the rehearsal's prompt eligibility or lifecycle state.

## Implementation Plan

1. Add a computed `列表范围回执` above the Rehearsal list.
2. Include status/search scope, current result count, no-cue audit count, pinned deep-link count, and no-effect boundary.
3. Keep it read-only: no API or lifecycle behavior changes.
4. Extend `tools/verify-rehearsals-page-e2e.mjs` to assert the receipt for deep-linked, All, Active, Stale, and missing-target recovery flows.
5. Update `docs/features/rehearsal.md` with the current behavior and validation note.

## Validation Plan

- `npm start`, stop after first successful compile.
- `node tools/verify-rehearsals-page-e2e.mjs`
- `npm run verify:i18n`
- `git diff --check -- .planning/.active_plan .planning/2026-06-28-automation-rehearsal-list-scope-receipt/plan.md src/modals/components/RehearsalsPage.vue tools/verify-rehearsals-page-e2e.mjs docs/features/rehearsal.md`
