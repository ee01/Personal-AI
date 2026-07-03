# Jira Design Links Issue-Key Parsing Progress

## 2026-06-09

- Read `AGENT.md`, `docs/features/index.md`, `docs/progressing/to-verify.md`, automation memory tail, memory registry hints, and existing root planning files.
- Checked local Reminders with AppleScript; no visible `Personal AI` list was found, so no reminder items can be incorporated or completed.
- Randomly selected `Jira issue key 解析` under Jira Design Links after excluding the freshest automation target documents.
- Created this isolated planning set under `.planning/2026-06-09-automation-jira-issue-key-parsing/`.
- Inspected Jira Design Links docs, parser helpers, content-script extraction/rendering, unit verifier, E2E fixture, and scoped existing diffs.
- Researched Atlassian issue-key/remote-link docs, Figma Dev Mode status behavior, Zeplin Jira integration, and Jira issue-link traceability papers.
- Improvement plan: support known Jira query-param issue keys in linked-issue anchors, propagate recovery source, show a compact receipt for non-standard key recovery, and update unit/E2E/docs.
- Implemented query-param issue-key parsing for known Jira params such as `selectedIssue` / `issueKey`.
- Propagated linked-issue key recovery source into UX ticket rows and rendered `Key from ...` receipts only for non-standard URL query / data attribute / ARIA / text recovery paths.
- Updated `tools/verify-jira-design-links.ts`, `tools/verify-jira-design-links-e2e.mjs`, and `docs/features/jira_design_links.md`.
- First `npm run verify:jira-design-links` failed because `for...of URLSearchParams.entries()` did not iterate under the verifier's ts-node transpilation path; fixed by using `URLSearchParams.forEach`.
- Validation passed:
  - `npm run verify:jira-design-links`
  - `npm start` first successful webpack dev compile, watcher stopped with Ctrl-C; only unrelated `src/popup.tsx` unused-variable warnings were reported
  - `npm run verify:jira-design-links:e2e`
  - scoped `git diff --check`
  - full `git diff --check`
- No `Personal AI` Reminders list exists locally, so no Reminder item was marked done.
