# Jira Design Links Issue-Key Parsing Findings

## Initial Findings

- Randomly selected feature from `docs/features/index.md`: `Jira issue key 解析`.
- Feature owner/capability: Jira Design Links.
- Source document: `docs/features/jira_design_links.md`.
- Local Reminders list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible Reminders list named `Personal AI`; there are no local Reminder items to incorporate or complete for this feature in this run.
- The worktree has many unrelated dirty files from prior automation runs. Treat all pre-existing changes as user/automation-owned and avoid reverting them.

## Code And UX Findings

- `docs/features/jira_design_links.md` already describes raw text fallback, mixed raw keys, and Jira Cloud `/issues/KEY` / `/projects/.../issues/KEY` URL support.
- Shared helpers in `src/jiraDesignLinks.ts` already let `parseJiraIssueKeyFromUrl()` recover keys from broader URL text, but `getLinkedIssueReference()` in `src/contentScriptJira.ts` currently calls only `parseJiraIssueKeyFromIssueUrl(href)` for href candidates.
- That means a Jira board/search URL such as `/jira/software/c/projects/UX/boards/42?selectedIssue=UXQUERY-700` can be missed when anchor text is generic, even though the key is visible in a standard Jira query param.
- Current UI labels all such recovered UX rows as `Linked issue`. It does not tell the user whether the key came from a standard `/browse/KEY` path, a query param, an attribute, aria text, or raw text. A small receipt only for non-standard recovery paths would make the fallback trustworthy without adding a new decision step.

## External Reference Findings

- Atlassian Cloud issue lookup uses issue keys such as `ABC-123` as the API `idOrKey`, and official/developer guidance still composes shareable issue URLs as `/browse/{ISSUE-KEY}`.
- Atlassian remote issue links include object URL/title/status fields and grouping metadata; the existing Design Links panel should keep those as sources, but not expose raw payload details to users.
- Figma Dev Mode treats `Ready for dev`, `Completed`, and `Changed` as handoff state, and notifies developers from design-status changes. That supports keeping state/status visible beside the recovered design link.
- Zeplin's Jira integration attaches screens, sections, projects, flows, components, and related issue details to Jira issues, supporting the current path-level labeling and issue-context scanning.
- OpenReq Issue Link Map research highlights that missing or unknown links in large Jira projects make dependency understanding hard, and text mentions can indicate links that maintainers still need to confirm. This supports parsing non-standard key mentions but showing the recovery source.
- Issue-link prediction research shows Jira repositories differ in link structures and link maintainer behavior, so conservative project-prefix matching and source receipts are preferable to treating every parsed key as equally authoritative.
