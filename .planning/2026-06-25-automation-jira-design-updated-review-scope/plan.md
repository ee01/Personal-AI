# Jira Design Links Updated Review Scope

## Target

- Feature: `Jira Design Links -> 设计链接更新时间展示`
- Source of truth: `docs/features/jira_design_links.md`
- Reminder input: local Reminders did not contain a `Personal AI` list, so no Reminder item was used or completed.

## External Signals

- Atlassian JQL design search exposes `design[status]`, `design[type]`, `design[lastUpdated]`, and `design[totalCount]`, so update time is a first-class design handoff signal.
- Figma Dev Mode treats status and notifications as the coordination layer for developer handoff.
- Figma for Jira reflects linked-file design updates and Dev Mode status in Jira, including `Design updated` and `Ready for dev`.
- Requirements traceability research says links are only valuable when the link context and auxiliary metadata are reliable enough for practitioners to judge.

## Plan

1. Keep the existing row-level `Updated YYYY-MM-DD` and source-basis chips.
2. Add a visible `复查范围` row above design entries when the panel contains updated-date signals or `Design updated` rows with missing timestamps.
3. Show the count of update signals, latest usable update date, missing-time count, and a read-only boundary.
4. Do not refresh Figma, edit Jira, add automations, change sorting, or mark review as complete.
5. Update the focused verifier, extension E2E fixture, and feature documentation.

## Verification

- `npm run verify:jira-design-links`
- `npm start` until first successful development compile, then stop
- `npm run verify:jira-design-links:e2e`
- Scoped `git diff --check`
