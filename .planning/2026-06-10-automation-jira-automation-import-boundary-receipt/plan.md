# Jira Automation Import boundary receipt

## Target

- Random feature: `高风险导入确认` under Jira Automation Import.
- Source doc: `docs/features/jira_automation_import.md`.
- Code surface: `src/contentScriptJiraAutomation.ts`, `tools/verify-jira-automation-import-e2e.mjs`.

## Current finding

- The import preview already detects high-risk bindings, sanitizes secrets, writes a review note, blocks chained triggers by default, and gates import behind a high-risk checkbox.
- The remaining UX gap is pre-click comprehension: the checklist is detailed, but users still need a compact receipt that says what clicking import does and does not do.

## External grounding

- Atlassian import docs state imported Jira automation flows start disabled and must be enabled later.
- Zapier Human in the Loop frames high-risk automation as a pause point where reviewers get context before the workflow continues.
- Trigger-action programming research shows automations span many services and users can misjudge triggers, actions, and interactions, so review context should stay near the action.

## Plan

1. Add an `Import boundary receipt` near the top of the preview.
2. Make the receipt state: disabled copy target, no auto-enable/run/schedule/secret restoration, sanitized review note persistence, and first Jira-side next step.
3. Tighten the high-risk checkbox copy to confirm the disabled-copy boundary rather than a vague review statement.
4. Update the E2E verifier and feature doc.
5. Run targeted transform tests, first successful dev compile, E2E verifier, and diff checks.
