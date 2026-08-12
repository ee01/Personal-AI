import { addD, fmtISO, fmtMD, today } from './useGeometry';
import type { RoadmapItem, RoadmapSub, TeamMember, TeamSnapshot } from '../types';

export type AssigneeMap = Record<string, string>;

export interface PersonRow {
  name: string;
  sources: Set<string>;
}

export interface ResolvedAssignee {
  name: string;
  full: string | null;
  user: string | null;
  fallback: boolean;
}

export function looksFullName(name: string | null | undefined): boolean {
  return String(name || '').trim().split(/\s+/).filter(Boolean).length >= 2;
}

export function jiraUsernameFromFull(full: string): string {
  return String(full).trim().toLowerCase().split(/\s+/).filter(Boolean).join('.');
}

export function mapGet(
  map: AssigneeMap | null | undefined,
  name: string | null | undefined,
): string | null {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return null;
  return map?.[key] || null;
}

export function effectiveFullName(
  map: AssigneeMap | null | undefined,
  name: string | null | undefined,
): string | null {
  return mapGet(map, name) || (looksFullName(name) ? String(name).trim() : null);
}

export function dispName(
  map: AssigneeMap | null | undefined,
  name: string | null | undefined,
): string {
  if (!name) return '';
  return mapGet(map, name) || name;
}

export function collectPeople(input: {
  currentUser: string;
  members: TeamMember[];
  items: RoadmapItem[];
}): PersonRow[] {
  const map = new Map<string, PersonRow>();
  const add = (n: string | null | undefined, src: string) => {
    const name = String(n || '').trim();
    if (!name) return;
    const lk = name.toLowerCase();
    if (!map.has(lk)) map.set(lk, { name, sources: new Set() });
    map.get(lk)!.sources.add(src);
  };
  add(input.currentUser, '成员');
  for (const m of input.members) add(m.name, '成员');
  for (const it of input.items) {
    for (const s of it.subs || []) {
      if (s.owner) add(s.owner, '成员');
      if (s.createdBy) add(s.createdBy, '创建过任务');
    }
  }
  return [...map.values()];
}

export function resolveAssignee(input: {
  map: AssigneeMap | null | undefined;
  sub: Pick<RoadmapSub, 'owner' | 'createdBy'>;
  currentUser: string;
}): ResolvedAssignee {
  const fallback = !input.sub.owner;
  const name = input.sub.owner || input.sub.createdBy || input.currentUser;
  const full = effectiveFullName(input.map, name);
  return {
    name,
    fallback,
    full,
    user: full ? jiraUsernameFromFull(full) : null,
  };
}

export function defaultNewSubSpan(tlEnd?: Date | string | null): {
  start: string;
  days: number;
} {
  let start = today;
  const days = 14;
  if (tlEnd) {
    const end = typeof tlEnd === 'string' ? tlEnd : fmtISO(tlEnd);
    const lastStart = addD(end, -(days - 1));
    if (fmtISO(start) > fmtISO(lastStart)) start = lastStart;
  }
  return { start: fmtISO(start), days };
}

export function buildAgentCreatePrompt(input: {
  userPrompt: string;
  projectKey: string;
  itemType: string;
  subType: string;
  fixVersion: string;
  sprint: string;
  map: AssigneeMap;
  currentUser: string;
  members: TeamMember[];
  items: RoadmapItem[];
  drafts: Array<{ item: RoadmapItem; sub: RoadmapSub }>;
}): string {
  const L: string[] = [];
  L.push('【用户 Prompt】', input.userPrompt.trim() || '（空）');
  L.push('', '【字段约束】已填字段为硬约束，其余由你决定');
  const fields: Array<[string, string]> = [
    ['Project', input.projectKey],
    ['主任务类型', input.itemType],
    ['子任务类型', input.subType],
    [
      'fixVersion',
      input.fixVersion || '按发布时间表以任务 Target End 匹配',
    ],
    ['Sprint', input.sprint || '查询并填当前 Sprint'],
  ];
  for (const [k, v] of fields) {
    L.push(`- ${k}: ${v || '（由 Agent 决定）'}`);
  }
  L.push(
    '',
    '【Assignee 规则】任务标注的人即 assignee；没写 Owner 的任务回落到创建人。',
    '按下方名单（系统名 → Jira 实名 Firstname Lastname）在 Jira 用户目录检索账号后填写：',
  );
  for (const pp of collectPeople({
    currentUser: input.currentUser,
    members: input.members,
    items: input.items,
  })) {
    const full = effectiveFullName(input.map, pp.name);
    L.push(`- ${pp.name} → ${full || '（未提供实名，按此名检索确认）'}`);
  }
  L.push('', '【任务清单】');
  input.drafts.forEach(({ item, sub }, i) => {
    const r = resolveAssignee({
      map: input.map,
      sub,
      currentUser: input.currentUser,
    });
    const start = sub.start || '';
    const end =
      sub.start && sub.days ? fmtISO(addD(sub.start, sub.days - 1)) : '';
    L.push(
      `${i + 1}. [父 ${item.jiraKey || item.key}] ${sub.title}` +
        (start && end ? ` · ${fmtMD(start)} → ${fmtMD(end)}` : '') +
        ` · assignee: ${r.full || r.name}${r.fallback ? '（创建人回落）' : ''}`,
    );
  });
  return L.join('\n');
}

export function teamAssigneeMap(
  snapshot: TeamSnapshot | null | undefined,
): AssigneeMap {
  return snapshot?.team.assigneeMap || {};
}
