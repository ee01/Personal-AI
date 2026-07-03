# Automation memory: 轮询检查改进每个功能

## 2026-07-02T04:06:40+0800

- Random pick from `docs/features/index.md`: `Jira issue key 解析` under Jira Design Links (`docs/features/jira_design_links.md`).
- Prior automation memory file was missing at start of run, so this file was created.
- Reminders check: local Reminders did not contain a `Personal AI` list (`NO_PERSONAL_AI_LIST`), so no Reminder item was marked done.
- Industry/research scan: checked Atlassian/Figma docs and traceability/design-handoff research. Constructive takeaway: recover visible Jira issue context as read-only candidates, keep source/boundary visible, and avoid creating Jira links or claiming design review completion from weak URL/DOM evidence.
- Implemented: `src/jiraDesignLinks.ts` now parses concrete issue keys inside Jira URL `jql` query parameters as `jira_query` candidates, while `jql=project%3DUX` remains ignored because it contains no concrete issue key.
- Updated tests/docs: `tools/verify-jira-design-links.ts`, `tools/verify-jira-design-links-e2e.mjs`, and `docs/features/jira_design_links.md` cover JQL query recovery with existing `Key from URL query` / `Read-only recovered` presentation.
- Validation passed: `npm run verify:jira-design-links`; `npm start` first successful compile; `npm run verify:jira-design-links:e2e`; `git diff --check -- src/jiraDesignLinks.ts tools/verify-jira-design-links.ts tools/verify-jira-design-links-e2e.mjs docs/features/jira_design_links.md`; `npm run verify:i18n`.
- Note: repo had extensive pre-existing dirty worktree changes before this run. This run intentionally touched only Jira Design Links helper, verifier/E2E, and feature doc.
