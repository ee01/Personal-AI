# Jira Design Links Updated Source Receipt

## Goal

Make the Jira Design Links `Updated YYYY-MM-DD` label more trustworthy by exposing which Jira/Figma metadata field supplied the date, without adding a blocking workflow or noisy summary.

## Plan

1. Inspect current docs, implementation, verifier, E2E fixture, automation memory, and Reminder availability. Status: complete.
2. Research comparable Jira/Figma/Zeplin design handoff behavior and artifact traceability guidance. Status: complete.
3. Add a compact updated-date source receipt to the existing design link data flow and UI tooltip / accessibility label. Status: complete.
4. Update focused unit and E2E assertions, then update the feature doc with only the behavior-level summary. Status: complete.
5. Run targeted verifier, `npm start` first compile, Jira design E2E, scoped `git diff --check`, update automation memory, and attempt archive honestly. Status: complete except closeout bookkeeping in automation memory / archive.

## Scope

- Target feature: `设计链接更新时间展示` / Jira Design Links.
- Reminder state: local Reminders is readable, but no `Personal AI` list exists, so no Reminder item is included or completed.
- Existing worktree is very dirty; only touch this plan dir and Jira Design Links related files.

## External Signals

- Figma/Jira treats ready/changed/update state as core handoff metadata.
- Atlassian automation exposes design smart values, so date/status fields are distinct evidence, not just display copy.
- Zeplin/Jira emphasizes attached design resources such as screens, sections, projects, and flows.
- Traceability research supports making cross-artifact links and their provenance understandable to the people acting on them.

## Validation Target

- `npm run verify:jira-design-links`
- `npm start` until first successful compile, then stop
- `npm run verify:jira-design-links:e2e`
- `git diff --check -- src/jiraDesignLinks.ts src/contentScriptJira.ts tools/verify-jira-design-links.ts tools/verify-jira-design-links-e2e.mjs docs/features/jira_design_links.md .planning/2026-06-16-automation-jira-design-updated-source-receipt/task_plan.md .planning/2026-06-16-automation-jira-design-updated-source-receipt/findings.md .planning/2026-06-16-automation-jira-design-updated-source-receipt/progress.md`

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| Initial `npm start` compile emitted an unused helper warning in `src/jiraDesignLinks.ts` | 1 | Removed the replaced `chooseDesignUpdatedAt` helper and reran verifier / compile successfully |
