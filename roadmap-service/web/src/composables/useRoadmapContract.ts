import type {
  ActivityEntry,
  JqlHints,
  PhaseKind,
  RoadmapItem,
  RoadmapMarker,
  RoadmapSub,
} from '../types';
import { addD, fmtISO, parseDate } from './useGeometry';

/** ticker 忽略的低信息量操作（含已废弃的 expand/collapse） */
export const TICKER_NOISE_OPS = new Set([
  'lock',
  'unlock',
  'expand',
  'collapse',
]);

/**
 * 取最新一条「其他人」的有效日志；没有则 null（ticker 隐藏）。
 * `activity` 假定按时间倒序（最新在前）。
 */
export function pickTickerEntry(
  activity: ActivityEntry[],
  selfClientId: string,
): ActivityEntry | null {
  for (const entry of activity) {
    if (entry.actorClientId === selfClientId) continue;
    if (TICKER_NOISE_OPS.has(entry.op)) continue;
    return entry;
  }
  return null;
}

/**
 * ticker 动作文案：去掉后端 text 里重复的 actor 名前缀，超长截断。
 * 主任务缩写已由服务端 `renderActivityText`（alias || title）写进 text。
 */
export function tickerLabel(entry: ActivityEntry, maxLen = 72): string {
  const who = String(entry.actorName || '').trim();
  let action = String(entry.text || '').trim();
  if (who && action.startsWith(who)) {
    action = action.slice(who.length).trimStart();
  }
  if (action.length <= maxLen) return action;
  return `${action.slice(0, Math.max(0, maxLen - 1))}…`;
}

/** Used when talking to a server that predates `team.jqlHints`. */
export const EMPTY_JQL_HINTS: JqlHints = {
  projectKey: null,
  itemType: null,
  subType: null,
  linkField: null,
  confident: false,
};

export const PHASE_DEFS: Record<
  PhaseKind,
  { label: string | null; glyph: string; color: string }
> = {
  design: { label: 'Design', glyph: 'D', color: '#6D4FA3' },
  stage: { label: 'Stage', glyph: 'S', color: '#0684BC' },
  production: { label: 'Production', glyph: 'P', color: '#2E8540' },
  custom: { label: null, glyph: '★', color: '#8B93A0' },
};

/** 缺 ETA 的依赖数（角标是否红色脉动） */
export function pendingDepCount(
  item: Pick<RoadmapItem, 'markers'>,
): number {
  return (item.markers || []).filter((m) => m.kind === 'dep' && !m.date).length;
}

/** 全部外部依赖（含无 ETA） */
export function depMarkers(item: Pick<RoadmapItem, 'markers'>): RoadmapMarker[] {
  return (item.markers || []).filter((m) => m.kind === 'dep');
}

/** 标记轨上可渲染的 markers（phase 全部 + 有 date 的 dep），按 date 升序 */
export function trackMarkers(
  item: Pick<RoadmapItem, 'markers'>,
): RoadmapMarker[] {
  return (item.markers || [])
    .filter((m) => m.kind === 'phase' || Boolean(m.date))
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** 新 phase 的默认日期：bar end + 7 + phases.length*7（与 demo 一致） */
export function defaultPhaseDate(
  item: Pick<RoadmapItem, 'start' | 'days' | 'markers'>,
): string {
  const start = item.start ? parseDate(item.start) : new Date();
  const days = item.days || 1;
  const base = addD(start, days - 1);
  const phaseCount = (item.markers || []).filter((m) => m.kind === 'phase').length;
  return fmtISO(addD(base, 7 + phaseCount * 7));
}

export function phaseGlyph(marker: RoadmapMarker): string {
  if (marker.phaseKind === 'custom') {
    return (marker.label.trim()[0] || '★').toUpperCase();
  }
  return PHASE_DEFS[marker.phaseKind || 'custom']?.glyph || '★';
}

export function phaseColor(marker: RoadmapMarker): string {
  return PHASE_DEFS[marker.phaseKind || 'custom']?.color || '#8B93A0';
}

export function jiraBrowseUrl(jiraKey: string, base = 'https://jira.ringcentral.com'): string {
  return `${base.replace(/\/$/, '')}/browse/${encodeURIComponent(jiraKey)}`;
}

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
    const subs = item.subs.filter((s) => s.temp && !s.cleared);
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
