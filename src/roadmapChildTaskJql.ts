import { JIRA_FIELD_PARENT_LINK } from './jiraCreateMeta.js';

/**
 * Link clause for Roadmap 「导入 Task」.
 * Epic Link is the default. Parent Link and the next-gen `parent` field are
 * selected by the page when the team's Jira hierarchy uses them.
 */
export function childLinkClause(linkField: string | null, epicKeys: string[]): string {
  const quoted = epicKeys.map((k) => `"${k.replace(/"/g, '\\"')}"`).join(', ');
  if (linkField === JIRA_FIELD_PARENT_LINK) {
    return `"Parent Link" in (${quoted})`;
  }
  if (linkField === 'parent') {
    return `parent in (${quoted})`;
  }
  return `"Epic Link" in (${quoted})`;
}

/**
 * Child-issue search under scheduled Epics.
 *
 * Keep every issue type. Epic Link children include User Story, QA sub-task,
 * and other types (NOVA-20213 under NOVA-19641 is a User Story). Cancelled
 * and Closed children stay excluded (NOVA-20077).
 */
export function buildChildTaskSearchJql(
  linkField: string | null,
  epicKeys: string[],
): string {
  return (
    `${childLinkClause(linkField, epicKeys)} ` +
    `AND status not in (Cancelled, Closed) ` +
    `ORDER BY key ASC`
  );
}
