# Jira Automation Import Create Scope Receipt

## Target

- Random feature: `Jira 自动化规则导入`
- Source doc: `docs/features/jira_automation_import.md`
- Main implementation: `src/contentScriptJiraAutomation.ts` and `src/jira-automation-import/transform.ts`

## External Signals

- Atlassian Jira Automation import keeps imported rules disabled and requires compatible export versions.
- Power Platform ALM separates environment values, connections, keys, and secrets from moved application components.
- Trigger-action programming research shows users misread rule timing, control flow, and side effects when interfaces only show syntax or scattered details.

## Plan

1. Keep the existing disabled-copy import model and secret scrubbing intact.
2. Add a first-screen create request scope receipt to the import preview.
3. State that preview/cancel has no write, confirm sends one sanitized disabled-copy create request, the source rule is not edited/enabled/run, and embedded environment references remain review-only.
4. Update the canonical feature doc and index.
5. Extend the existing Jira Automation Import E2E to assert the receipt and non-effect boundary.
6. Verify with the targeted transform test, dev webpack compile, E2E, and scoped whitespace checks.
