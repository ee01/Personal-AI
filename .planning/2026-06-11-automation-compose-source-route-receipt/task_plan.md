# Compose Assist Source Route Receipt Plan

## Goal

Improve `回复助手来源适配` so users can see which source route Compose Assist used before inserting a RingCentral/Jira reply or Web AI context pack.

## Phases

| Phase | Status | Notes |
| --- | --- | --- |
| Inspect repo rules, automation memory, feature index, Reminders | complete | `Personal AI` Reminder list was absent; no reminder item was incorporated or marked done. |
| Research adjacent products and papers | complete | RingCentral, Atlassian, Smart Compose, GhostWriter, and interaction-required suggestions all support inline, user-controlled writing help with visible boundaries. |
| Identify bounded improvement | complete | Existing `草稿回执` covered insertion/review/evidence, but source-adapter routing stayed implicit. |
| Implement receipt | complete | Added `来源路由` helper and popover rendering with route, current context, allowed sources, and boundary. |
| Update docs and tests | complete | Updated `docs/features/compose_assist.md`, unit tests, and direct-insert E2E assertions. |
| Validate | complete | Focused TS tests, `npm start` compile, direct-insert E2E, `git diff --check`, and watcher check passed. |

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| E2E read the source-route receipt as `草稿回执` | First direct-insert E2E rerun | Scoped the draft receipt selector to `aria-label="草稿回执"`. |
| E2E strict locator matched both receipt blocks | Second direct-insert E2E rerun | Scoped the high-risk receipt locator to `aria-label="草稿回执"`. |
