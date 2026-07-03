# Jira Automation chained-trigger acknowledgement reset

## Selected feature

- Feature doc: `docs/features/jira_automation_import.md`
- User persona: a Jira project admin importing exported automation rules who wants a disabled copy but needs review gates to stay honest after changing import safety options.

## Experience finding

The import preview correctly requires a high-risk acknowledgement before creating a disabled copy. However, after the user checks that acknowledgement, changing the chained-trigger safeguard can make the selected import behavior riskier or different while leaving the old acknowledgement in place. As a user, that makes the checkbox feel like a generic unlock instead of a receipt for the current preview state.

## Implementation plan

1. Reset the high-risk acknowledgement whenever the chained-trigger safeguard changes.
2. Keep both header and footer import buttons disabled again until the user acknowledges the updated preview.
3. Extend the Jira Automation Import E2E to verify this interaction.
4. Update the feature doc so the canonical behavior says safety-option changes invalidate the acknowledgement.

## Verification plan

- `npm run verify:jira-automation-import`
- `npm start` until first successful webpack compile, then stop
- `npm run verify:jira-automation-import:e2e`
- `git diff --check` scoped to touched files
