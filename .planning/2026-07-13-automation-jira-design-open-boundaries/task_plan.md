# Jira Design Links Open Boundaries Plan

## Goal

Improve the `Figma/Zeplin 保守分类` slice of Jira Design Links by making the pre-click consequence of opening design, UX ticket, and UX Epic links explicit at the actual link controls.

## Selected Feature

- Feature index row: `Figma/Zeplin 保守分类`
- Canonical doc: `docs/features/jira_design_links.md`
- Primary source: `src/contentScriptJira.ts`, `src/jiraDesignLinks.ts`
- Verification: `tools/verify-jira-design-links.ts`, `tools/verify-jira-design-links-e2e.mjs`, `npm start`, scoped `git diff --check`

## Plan

1. [complete] Gather repo context, automation memory, worktree state, Reminders state, and random-feature selection.
2. [complete] Inspect Jira Design Links docs/source/verifier and identify the current user-facing gap.
3. [complete] Implement link-level `title` / `aria-label` boundary text for design, UX ticket, and UX Epic open controls without changing scan/classification/write behavior.
4. [complete] Update Jira Design Links docs and feature index with the concise current behavior.
5. [complete] Run targeted verifier, first successful dev compile, Jira Design Links E2E, and scoped whitespace checks.
6. [complete] Update automation memory with this run's outcome.

## Constraints

- Preserve existing conservative Figma/Zeplin classification logic.
- Do not change Jira REST calls, Figma/Zeplin refresh behavior, Jira write behavior, or Memory Service writes.
- Keep this run scoped despite broad pre-existing dirty worktree state.

## Errors Encountered

| Error | Resolution |
|---|---|
| AppleScript Reminders list probe did not show `Personal AI`. | EventKit fallback found `Personal AI` with 4 total and 0 incomplete items. |
| Initial planning-with-files skill path under `.codex/skills` did not exist. | Read the installed skill from `/Users/Esone/.agents/skills/planning-with-files/SKILL.md`. |
| E2E title assertions first failed on localized Chinese boundary text. | Broadened the assertions to match the bilingual runtime strings. |
