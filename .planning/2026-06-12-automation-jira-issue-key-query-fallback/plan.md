# Jira Issue Key Query Fallback Plan

## Target

- Feature: `Jira issue key 解析`
- Canonical doc: `docs/features/jira_design_links.md`
- Scope: linked issue key recovery in Jira Design Links only.

## Research Notes

- Atlassian still treats `/browse/<issueKey>` as the stable browser URL shape for Jira issues, while the REST API accepts `{idOrKey}`.
- Jira new-view/plugin surfaces can expose issue keys as plain text or indirect links, so Personal AI should keep conservative fallback parsing for visible Jira references.
- Figma for Jira puts linked design status and updates directly inside Jira, so the panel should preserve traceability from Jira issue references to design handoff state.
- Traceability research supports making recovered artifact links role-readable and source-scoped instead of silently dropping weak-but-visible links.

## Improvement Plan

1. Add a helper that returns Jira key candidates from both URL path and query parameters, preserving whether each key came from a standard issue path or a query fallback.
2. Use those candidates in linked-issue DOM parsing so a non-design path key such as `ABC-123` does not hide a design-project key in `selectedIssue=UX-700`.
3. Keep standard `/browse/UX-123` and `/issues/UX-123` links quiet; show `Key from URL query` only for non-standard query recovery.
4. Extend the targeted verifier and Playwright extension fixture for mixed path/query links.
5. Update the feature doc with the current query fallback behavior and validation evidence.

## Validation

- `npm run verify:jira-design-links`
- `npm start` until first successful webpack compile, then stop
- `npm run verify:jira-design-links:e2e`
- `git diff --check`
