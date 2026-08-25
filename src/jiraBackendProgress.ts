import {
  isCancelledJiraStatus,
  isClosedJiraStatus,
  isSameJiraProject,
  JIRA_CONTEXT_PANEL_ITEM_LIMIT,
} from './jiraDesignLinks';

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

export type BackendProgressRankItem = {
  dependencyTicketKey: string;
  source: string;
  issueStatus?: string | null;
};

export function getBackendChannelPriority(source: string): number {
  // linked / story > epic > parent impact layers > parent sub issues
  if (source.includes('parent_impact_layer')) return 2;
  if (source.includes('parent_')) return 3;
  if (source.includes('epic')) return 1;
  if (source.includes('linked_issues') || source.includes('user_story')) return 0;
  return 1;
}

export function sortBackendProgressItems<T extends BackendProgressRankItem>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aChannel = getBackendChannelPriority(a.item.source);
      const bChannel = getBackendChannelPriority(b.item.source);
      const channelDiff = aChannel - bChannel;
      if (channelDiff !== 0) return channelDiff;

      // Prefer closed/done for parent impact layers and parent sub-issue channels.
      if (aChannel >= 2) {
        const aClosed = isClosedJiraStatus(a.item.issueStatus) ? 0 : 1;
        const bClosed = isClosedJiraStatus(b.item.issueStatus) ? 0 : 1;
        if (aClosed !== bClosed) return aClosed - bClosed;
      }

      return a.index - b.index;
    })
    .map(entry => entry.item);
}

export function prepareBackendProgressItems<T extends BackendProgressRankItem>(
  items: T[],
  currentTicketKey: string,
  limit: number = JIRA_CONTEXT_PANEL_ITEM_LIMIT,
): T[] {
  const filtered = items.filter(item => (
    !isSameJiraIssue(currentTicketKey, item.dependencyTicketKey)
    && !isCancelledJiraStatus(item.issueStatus)
  ));
  return sortBackendProgressItems(filtered).slice(0, Math.max(0, limit));
}
