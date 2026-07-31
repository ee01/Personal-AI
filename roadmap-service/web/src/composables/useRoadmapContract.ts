import type { JqlHints, RoadmapItem, RoadmapSub } from '../types';

/** Used when talking to a server that predates `team.jqlHints`. */
export const EMPTY_JQL_HINTS: JqlHints = {
  projectKey: null,
  itemType: null,
  subType: null,
  linkField: null,
  confident: false,
};

/**
 * An item is a draft exactly while no Jira issue exists for it.
 *
 * `source` must not be used for this: imported rows carry `source: 'jira'`, and
 * a hand-made row keeps `source: 'manual'` forever — including after its issue
 * has been created and `jiraKey` backfilled.
 */
export function isDraftItem(item: Pick<RoadmapItem, 'jiraKey'>): boolean {
  return !item.jiraKey;
}

/** The synthetic `LOCAL-…` key is an internal handle; show the Jira key once it exists. */
export function itemDisplayKey(item: Pick<RoadmapItem, 'jiraKey' | 'key'>): string {
  return item.jiraKey || item.key;
}

/** Manual items are the only ones the roadmap owns outright. */
export function canDeleteItem(
  item: Pick<RoadmapItem, 'source' | 'jiraKey'>,
): boolean {
  return item.source === 'manual' && !item.jiraKey;
}

export function formatEstimate(estimate: number | null | undefined): string {
  return typeof estimate === 'number' && Number.isFinite(estimate) && estimate > 0
    ? `${estimate}w`
    : '—';
}

/**
 * Badge class + label for an item type. The CSS classes are uppercase
 * (`.type-EPIC`), while the backend returns canonical Jira casing (`Epic`).
 */
export function typeBadge(type: string | null | undefined): {
  cls: string;
  label: string;
} {
  const raw = (type || '').trim();
  if (!raw) return { cls: 'type-TASK', label: '—' };
  const upper = raw.toUpperCase();
  const cls =
    upper === 'EPIC'
      ? 'type-EPIC'
      : upper === 'INITIATIVE' || upper === 'INIT'
        ? 'type-INIT'
        : 'type-TASK';
  const label = upper === 'INITIATIVE' ? 'INIT' : upper;
  return { cls, label };
}

/**
 * Mirrors `resolveSubType` in `roadmap-service/src/core/JqlIntrospect.ts`:
 * Initiative and Epic have a child type we can name up front (Epic / Task),
 * while anything at Task level takes a real sub-task whose name differs per
 * Jira project. For that case the backend deliberately sends `subType: null`
 * and the extension resolves the name from `createmeta`, so an empty sub-type
 * field must not block the create button.
 */
export function subTypeComesFromCreateMeta(
  itemType: string | null | undefined,
): boolean {
  const normalized = (itemType || '').trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized !== 'initiative' && normalized !== 'init' && normalized !== 'epic'
  );
}

/* ------------------------------------------------------------------ *
 * postMessage state contract (consumed by the extension content script)
 * ------------------------------------------------------------------ */

export interface RoadmapStateItem {
  key: string;
  type: string;
  title: string;
  alias: string | null;
  quarter: string;
  targetStart: string | null;
  targetEnd: string | null;
  start: string | null;
  days: number | null;
  isDraft: boolean;
  jiraKey: string | null;
  subActivity: boolean;
}

export interface RoadmapStateMessage {
  type: 'pai-roadmap-state';
  teamId: string | null;
  /** Legacy alias of `teamId`, kept so older extension builds keep working. */
  team: string | null;
  teamName: string | null;
  quarter: string;
  editable: boolean;
  items: RoadmapStateItem[];
}

export function toStateItem(
  item: RoadmapItem,
  fallbackQuarter: string,
): RoadmapStateItem {
  return {
    key: item.key,
    type: item.type,
    title: item.title,
    alias: item.alias ?? null,
    quarter: item.quarter || fallbackQuarter,
    targetStart: item.targetStart ?? null,
    targetEnd: item.targetEnd ?? null,
    start: item.start ?? null,
    days: item.days ?? null,
    isDraft: isDraftItem(item),
    jiraKey: item.jiraKey ?? null,
    subActivity: item.subs.length > 0,
  };
}

export function buildStateMessage(input: {
  teamId: string | null;
  teamName: string | null;
  quarter: string;
  editable: boolean;
  items: RoadmapItem[];
}): RoadmapStateMessage {
  return {
    type: 'pai-roadmap-state',
    teamId: input.teamId,
    team: input.teamId,
    teamName: input.teamName,
    quarter: input.quarter,
    editable: input.editable,
    items: input.items.map((item) => toStateItem(item, input.quarter)),
  };
}

/* ------------------------------------------------------------------ *
 * Two-phase Jira creation contract
 * ------------------------------------------------------------------ */

export interface CreateJiraParent {
  itemKey: string;
  title: string;
  issueType: string;
  projectKey: string;
  targetStart: string | null;
  targetEnd: string | null;
}

export interface CreateJiraChild {
  draftId: string;
  title: string;
  issueType: string;
  projectKey: string;
  parentItemKey: string;
  /** Set when the parent issue already exists, so the extension can link right away. */
  parentJiraKey: string | null;
}

export interface CreateJiraPayload {
  teamId: string;
  token: string | null;
  parent: CreateJiraParent | null;
  children: CreateJiraChild[];
}

export interface CreateJiraResult {
  parent?: { itemKey: string; jiraKey?: string; error?: string };
  children: Array<{ draftId: string; jiraKey?: string; error?: string }>;
}

/** One main item plus the draft children waiting on it. */
export interface DraftGroup {
  item: RoadmapItem;
  subs: RoadmapSub[];
}

/**
 * Group every pending creation by main item: a draft main item (with or without
 * children) or an already-created main item that has draft children left.
 */
export function buildDraftGroups(items: RoadmapItem[]): DraftGroup[] {
  const groups: DraftGroup[] = [];
  for (const item of items) {
    const subs = item.subs.filter((s) => s.temp);
    if (!subs.length && !isDraftItem(item)) continue;
    groups.push({ item, subs });
  }
  return groups;
}

export function buildCreateJiraPayload(
  group: DraftGroup,
  fields: {
    teamId: string;
    token: string | null;
    projectKey: string;
    issueType: string;
    subType: string;
  },
): CreateJiraPayload {
  const parentIsDraft = isDraftItem(group.item);
  return {
    teamId: fields.teamId,
    token: fields.token,
    parent: parentIsDraft
      ? {
          itemKey: group.item.key,
          title: group.item.title,
          issueType: fields.issueType,
          projectKey: fields.projectKey,
          targetStart: group.item.targetStart ?? null,
          targetEnd: group.item.targetEnd ?? null,
        }
      : null,
    children: group.subs.map((sub) => ({
      draftId: sub.id,
      title: sub.title,
      issueType: fields.subType,
      projectKey: fields.projectKey,
      parentItemKey: group.item.key,
      parentJiraKey: group.item.jiraKey ?? null,
    })),
  };
}
