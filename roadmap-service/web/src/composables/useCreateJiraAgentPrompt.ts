import { addD, fmtISO, fmtMD } from './useGeometry';
import type { RoadmapItem, RoadmapSub, TeamMember } from '../types';
import {
  collectPeople,
  effectiveFullName,
  resolveAssignee,
  type AssigneeMap,
} from './useAssigneeMap';

/** Fixed system instructions prepended to every Agent create-Jira submission. */
export const ROADMAP_CREATE_JIRA_SYSTEM_PROMPT = [
  '你是 Personal Roadmap 的 Jira 创建助手。按用户 Prompt 与下方硬性约束在 Jira 中创建 issue，并把结果回写成可验证 artifact。',
  '不要向用户索要 Jira token；使用你自己的 Jira 技能完成创建与检索。',
  '',
  '【子任务 Description 生成规则 — 必须遵守】',
  '1. 每条新建的子任务必须填写 Jira description 字段，不能留空。',
  '2. Description 综合三类输入生成：「父 Epic 的 description」「本子任务的标题」以及「该子任务用户填写的描述」（如有）。理解 Epic 目标/范围后写出交付内容与验收要点；不要整段复制任何一段输入，不要编造事实。',
  '3. 子任务带用户描述时：其中的约束、范围与事实必须保留进最终 description；允许改写措辞、补充结构与验收标准——最终创建的 summary/description 不必与用户输入逐字一致。',
  '4. 若请求附带父 Epic 描述摘录则优先使用；否则先读取父 issue 的 description。',
  '5. 父 issue 也是本批 draft、尚无 description 时：以父标题 + 父条目的用户描述（如有）+ 子标题生成简短 description。',
  '6. 主任务未要求 description 时可省略；带用户描述的 draft 主任务以用户描述为基础润色。子任务不可省略。',
].join('\n');

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
  /** Optional pre-fetched Epic descriptions keyed by Jira key. */
  epicDescriptions?: Record<string, string | null | undefined>;
}): string {
  const L: string[] = [];
  L.push('【System Prompt】', ROADMAP_CREATE_JIRA_SYSTEM_PROMPT);
  L.push('', '【用户 Prompt】', input.userPrompt.trim() || '（空）');
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
    const parentKey = item.jiraKey || item.key;
    const userDesc = String(sub.description || '').trim();
    const parentDesc = String(item.description || '').trim();
    L.push(
      `${i + 1}. [父 ${parentKey}] ${sub.title}` +
        (start && end ? ` · ${fmtMD(start)} → ${fmtMD(end)}` : '') +
        ` · assignee: ${r.full || r.name}${r.fallback ? '（创建人回落）' : ''}` +
        ` · description: ${
          userDesc
            ? '综合父 Epic 描述 + 本标题 + 下行用户描述生成（可改写，勿丢约束）'
            : '按 System Prompt 规则，用父 Epic 描述 + 本标题生成'
        }`,
    );
    if (userDesc) {
      L.push(`   用户描述：${userDesc}`);
    }
    const epicDesc =
      (item.jiraKey && input.epicDescriptions?.[item.jiraKey]) || null;
    if (epicDesc && String(epicDesc).trim()) {
      L.push(`   父 Epic 描述（摘录）：${truncateEpicDesc(String(epicDesc))}`);
    } else if (item.jiraKey) {
      L.push(
        `   父 Epic 描述：未预取，创建前请读取 ${item.jiraKey} 的 description`,
      );
    } else {
      L.push(
        `   父条目仍为 draft（${item.key} / ${item.title}），无 Epic 描述时按父标题+子标题生成`,
      );
      if (parentDesc) {
        L.push(`   父用户描述：${parentDesc}`);
      }
    }
  });
  return L.join('\n');
}

function truncateEpicDesc(text: string, max = 1200): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max)}…`;
}
