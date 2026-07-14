# Jira Automation Import Entry Button Boundary

## Target

- Feature: `高风险导入提示`
- Area: Jira Automation Import
- Source doc: `docs/features/jira_automation_import.md`

## Current State

- `docs/progressing/to-verify.md` is empty.
- EventKit found the local `Personal AI` Reminder list with 4 total items and 0 incomplete items, so no Reminder feedback is available for this run.
- Existing implementation already covers disabled-copy preview, create-stage receipts, secret redaction, credential re-entry queue, pending create receipts, chaining choice, and post-import navigation cancellation.

## External Signals

- Atlassian Jira Automation import/export docs say imported flows are initially disabled and may require reconfiguration after Server/Data Center to Cloud migration.
- Zapier Human in the Loop frames automation approval as a pause point before workflow continuation, which matches the disabled-copy review step.
- Trigger-action debugging research shows users struggle to localize and fix automation misbehavior; entry points should make stage and side effects clear before users enter a high-risk flow.

## Plan

1. Add a precise `title` and `aria-label` to the `Import rule` entry button: opening it only launches a local JSON picker and prepares a disabled-copy preview; it does not create, edit, enable, run automation, activate schedules, or restore secrets.
2. Reuse the same boundary in language refresh so the entry point does not regress after Options language changes.
3. Extend the existing Jira Automation Import E2E to assert English and Chinese entry button boundaries before file selection.
4. Update the feature doc and index row with the new entry-control boundary.
5. Run targeted transform verification, dev compile, E2E, and scoped whitespace checks.

