# Jira Design Links issue-key recovery filter plan

## Target

- Selected feature: `Jira issue key 解析` in `docs/features/jira_design_links.md`.
- Reason: random sample picked a non-recent Jira Design Links subfeature whose doc/source files were not already dirty in the initial scoped status.
- Reminder check: AppleScript did not list `Personal AI`; EventKit found 4 `Personal AI` reminders, all completed historical Doubao / notification feedback and unrelated to Jira Design Links.

## External scan

- Atlassian Jira remote issue links are a distinct read/write resource, so Personal AI should keep recovered DOM/query candidates separate from actual Jira link mutation: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-remote-links/
- Atlassian Automation documents linked issues as relationships between issues and exposes issue keys for tracking, supporting explicit key-source and relationship boundaries: https://confluence.atlassian.com/automation/jira-smart-values-issue-links-1540234922.html
- Figma for Jira surfaces design status and updates inside Jira, so the panel should stay focused on visible design context and not imply that a recovered key has refreshed or changed Jira/Figma state: https://help.figma.com/hc/en-us/articles/360039827834-Jira-and-Figma
- Trace-link explanation research argues recovered links need explanations for users to judge correctness, supporting a first-screen recovery/filter receipt: https://arxiv.org/pdf/2204.11914

## Plan

1. Track, per recovered UX ticket candidate, how many parsed issue-key candidates were ignored because they did not match `DESIGN_JIRA_PROJECT`.
2. Surface the aggregate ignored-candidate count in the existing `恢复范围` row, with source breakdown in tooltip/ARIA rather than adding another noisy row.
3. Preserve existing behavior: no Jira issue links, design fields, relationships, Figma metadata, or Memory Service state are written.
4. Update the targeted verifier, Jira fixture E2E, and feature doc.
5. Verify with `npm run verify:jira-design-links`, `npm start` first successful compile, `npm run verify:jira-design-links:e2e`, and scoped `git diff --check`.
