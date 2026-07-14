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

## 2026-07-11T23:08:46+0800

- Random pick from `docs/features/index.md`: `今天 Mission` under Today Pilot (`docs/features/today_pilot.md`), after rerolling away from the freshest exact Jira Design Links surface.
- `docs/progressing/to-verify.md` had no carry-over items. Worktree was already extensively dirty before this run, so this run used a dedicated `.planning/2026-07-11-automation-today-mission-action-button-boundaries/task_plan.md` and scoped edits.
- Reminders check: AppleScript missed `Personal AI`, EventKit found the list and reported no incomplete items, so no Reminder item was completed or annotated.
- Industry/research scan: checked Microsoft Plan My Day, Reclaim AI Tasks, Motion AI Task Planner, Microsoft Research AI-powered reminders, IBM proactive notification work, and proactive-agent satisfaction research. Constructive takeaway: proactive daily priorities are useful, but control-point copy must preserve user agency and clarify that Today Mission actions are display/ranking feedback, clipboard handoff, or navigation rather than source-system execution.
- Implemented: `src/modals/components/OverviewPage.vue` now gives every Today Mission action button a `title` and `aria-label` boundary for `完成/从首页移除`, `稍后 6h`, `有用`, `不准确`, `复制上下文包`, `打开详情`, and `不再提醒同类`; OpenClaw cards explicitly say removal does not approve, reject, retry, or execute OpenClaw.
- Updated tests/docs: `tools/verify-day-pilot-home.ts`, `tools/verify-today-pilot-home-e2e.mjs`, `docs/features/today_pilot.md`, and `docs/features/index.md` cover the button-level hover/reader boundary.
- Validation passed: `npm run verify:day-pilot-home`; `npm start` first successful compile; `npm run verify:today-pilot-home:e2e`; scoped `git diff --check`; `npm run verify:i18n`.
