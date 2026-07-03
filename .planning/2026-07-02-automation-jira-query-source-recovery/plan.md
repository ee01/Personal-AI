# Jira issue key query-source recovery plan

## Target

- Feature: `Jira issue key 解析`
- Canonical doc: `docs/features/jira_design_links.md`
- Primary code: `src/jiraDesignLinks.ts`, `src/contentScriptJira.ts`

## External signals

- Figma / Jira and Atlassian Smart Links emphasize bringing design context directly into Jira instead of making developers chase raw URLs.
- Traceability-link recovery research supports showing recovered artifact links as useful but lower-authority candidates.
- Information-scent UX guidance supports exposing the specific clue that led to a link so users can decide whether to trust or inspect it.

## Improvement

Non-standard Jira query recovery currently collapses `selectedIssue`, `issueKey`, and `jql` into one `URL query` receipt. That is directionally honest, but not precise enough for users trying to understand whether the key came from a selected board row, an explicit issue key parameter, or a JQL filter.

Implement a small presentation/data-contract refinement:

1. Keep standard `/browse/KEY` and `/issues/KEY` as quiet canonical paths.
2. Split recovered query candidates into `selectedIssue query`, `issueKey query`, and `JQL query`.
3. Show the precise source in row-level `Key from ...` tags, recovery-scope breakdown, tooltip, accessibility summary, and tests.
4. Preserve the existing read-only boundary: no Jira issue link, design field, relationship, Figma refresh, or Memory Service write is created.
5. Update the feature doc without expanding it into implementation minutiae.

## Validation

- `npm run verify:jira-design-links`
- `node --check tools/verify-jira-design-links-e2e.mjs`
- `npm start -- --progress`, stop after first successful compile
- `npm run verify:jira-design-links:e2e`
- scoped `git diff --check`
