/**
 * The Roadmap page → extension → memory-service contract for focus projects.
 *
 * Lives apart from `contentScriptRoadmap.ts` because that module talks to
 * `chrome.*` and mounts a bridge on import; this half is pure so both the
 * content script and the seam test can use it. The producing end is
 * `buildStateMessage()` in `roadmap-service/web/src/composables/useRoadmapContract.ts`,
 * the consuming end is `FocusSyncItem` in
 * `memory-service/src/core/FocusProjectSyncService.ts`.
 */

export type RoadmapFocusItem = {
  key: string;
  type?: string;
  title: string;
  alias?: string | null;
  displayName?: string;
  quarter?: string | null;
  targetStart?: string | null;
  targetEnd?: string | null;
  /** ISO date (`YYYY-MM-DD`), never a timestamp — nothing does arithmetic on it. */
  start?: string | null;
  days?: number | null;
  /** Absent on page bundles that predate manual backlog items. */
  isDraft?: boolean;
  jiraKey?: string | null;
  subActivity?: boolean;
  keywords?: string[];
  /** Draft / Jira description mirror. Paragraph material only — never a watch-rule keyword. */
  description?: string | null;
  priorityHints?: Record<string, boolean>;
};

export type RoadmapStateMessage = {
  type: 'pai-roadmap-state';
  teamId?: string;
  /** Legacy field name; older page bundles only ever sent this one. */
  team?: string;
  teamName?: string;
  quarter?: string;
  quarters?: string[];
  editable?: boolean;
  items?: RoadmapFocusItem[];
};

/** The page sent `team` alone until the field was renamed; both must be read. */
export function readTeamId(state: RoadmapStateMessage): string {
  return String(state.teamId || state.team || '').trim();
}

/** Manual backlog rows carry a synthetic key until their Jira issue exists. */
export function isSyntheticItemKey(key: string): boolean {
  return /^LOCAL-/i.test(String(key || ''));
}

/**
 * A row is a draft exactly while it has no Jira issue — `jiraKey === null`.
 * `source` says nothing about it: an imported row is `'jira'`, and a hand-made
 * row stays `'manual'` forever, including after its issue has been created.
 *
 * Page bundles that predate manual items omit `jiraKey` entirely; there every
 * row's key *is* its Jira key, so only a synthetic key marks a draft.
 */
export function toFocusSyncItem(
  item: RoadmapFocusItem,
): Record<string, unknown> {
  const sentJiraKey = item.jiraKey === undefined ? undefined : item.jiraKey || null;
  const isDraft =
    sentJiraKey === undefined ? isSyntheticItemKey(item.key) : sentJiraKey === null;
  // memory-service reads sub-task activity out of priorityHints; the page sends
  // it top-level because that is where the rest of the item fields live.
  const priorityHints = {
    ...(item.priorityHints || {}),
    ...(item.subActivity === undefined ? {} : { subActivity: item.subActivity }),
  };
  return {
    key: item.key,
    type: item.type,
    title: item.title,
    alias: item.alias,
    displayName: item.displayName || item.alias || item.title,
    isDraft,
    jiraKey: isDraft ? null : (sentJiraKey ?? undefined),
    quarter: item.quarter,
    targetStart: item.targetStart,
    targetEnd: item.targetEnd,
    start: item.start,
    days: item.days,
    keywords: item.keywords,
    description: item.description ?? null,
    priorityHints,
  };
}
