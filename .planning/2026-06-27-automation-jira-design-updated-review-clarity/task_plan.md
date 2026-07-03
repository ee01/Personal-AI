# Jira Design Links Updated Review Clarity Plan

Goal: improve the selected `设计链接更新时间展示` feature by checking current docs/code, incorporating current product and research signals, then implementing a focused UX/code fix with validation.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read workflow, automation memory, feature index, local Reminder state, and current Jira Design Links docs/code/tests |
| 2 | completed | Search current Jira/Figma/Atlassian product docs and traceability research for design update handoff patterns |
| 3 | completed | Pick the smallest no-decision implementation slice and update code/docs |
| 4 | completed | Run targeted verifier, extension compile, E2E where practical, and scoped diff checks |
| 5 | completed | Update automation memory and summarize Reminder status |

## Decisions

- Selected feature: `设计链接更新时间展示`.
- Source doc: `docs/features/jira_design_links.md`.
- Primary code: `src/jiraDesignLinks.ts` and `src/contentScriptJira.ts`.
- Targeted verifiers: `tools/verify-jira-design-links.ts` and `tools/verify-jira-design-links-e2e.mjs`.
- Local Reminders scan returned `NO_PERSONAL_AI_LIST`; no Reminder item can be incorporated or marked done.
- The worktree is broadly dirty. Preserve unrelated changes and keep this run scoped to Jira Design Links plus planning/automation memory.
- Implementation slice: `复查范围` now surfaces the latest updated-date metadata basis/source as a visible chip, so users can see whether the latest date came from status, object, or remote-link metadata without row-by-row hover.

## Verification

- `npm run verify:jira-design-links`
- `npm start` first successful webpack dev compile, then stopped
- `npm run verify:jira-design-links:e2e`
- `git diff --check -- src/jiraDesignLinks.ts src/contentScriptJira.ts src/i18n/staticTranslations.ts tools/verify-jira-design-links.ts tools/verify-jira-design-links-e2e.mjs docs/features/jira_design_links.md .planning/.active_plan .planning/2026-06-27-automation-jira-design-updated-review-clarity/task_plan.md .planning/2026-06-27-automation-jira-design-updated-review-clarity/findings.md .planning/2026-06-27-automation-jira-design-updated-review-clarity/progress.md`
- No leftover `webpack --watch --config webpack.dev.cjs` process found.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Root planning files belong to an older Scheduled Messages run | Initial restore | Use this isolated `.planning/2026-06-27-automation-jira-design-updated-review-clarity/` plan |
| Local Reminders list `Personal AI` absent | AppleScript list scan | Record absence and stop Reminder branch |
| First Jira Design Links E2E loaded stale `dist` output | E2E before rebuild | Ran `npm start` to the first successful compile, stopped watcher, then reran E2E |
| E2E latest-source assertion was too whitespace-sensitive | First rerun after rebuild | Changed assertion to match semantic label and basis across spacing/localization |
