import { isSameJiraProject } from './jiraDesignLinks';

export type BackendDependencyDiscoveryScope = 'issue_links' | 'init_parent';

type JiraIssueLinkRelationship = {
  type?: {
    outward?: unknown;
    inward?: unknown;
  };
  outwardIssue?: unknown;
  inwardIssue?: unknown;
};

export function isSameJiraIssue(leftKey?: string | null, rightKey?: string | null): boolean {
  const left = String(leftKey || '').trim().toUpperCase();
  const right = String(rightKey || '').trim().toUpperCase();
  return Boolean(left && right && left === right);
}

/**
 * Same-project suppression is limited to tickets discovered by traversing an INIT/Parent.
 * Direct Linked Issues and Epic Issue Links remain eligible even when they share the
 * current issue's Jira project.
 */
export function shouldIncludeBackendDependency(
  currentTicketKey: string,
  dependencyTicketKey: string,
  scope: BackendDependencyDiscoveryScope,
): boolean {
  if (!dependencyTicketKey || isSameJiraIssue(currentTicketKey, dependencyTicketKey)) {
    return false;
  }
  return scope !== 'init_parent'
    || !isSameJiraProject(currentTicketKey, dependencyTicketKey);
}

export function getJiraIssueLinkRelationship(link: JiraIssueLinkRelationship): string | null {
  const value = link.outwardIssue
    ? link.type?.outward
    : link.inwardIssue
      ? link.type?.inward
      : null;
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized || null;
}

export function formatBackendProgressSource(source: string, relationship?: string | null): string {
  const normalizedRelationship = String(relationship || '').replace(/\s+/g, ' ').trim();
  return source === 'epic' && normalizedRelationship
    ? `${source}:${normalizedRelationship}`
    : source;
}
