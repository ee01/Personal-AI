/**
 * Capability taxonomy shared by the frontend (Chrome extension) and backend
 * (memory-service) usage-analytics instrumentation.
 *
 * IMPORTANT: The frontend worker uses an identical capability key set. These
 * exact string keys must stay in sync across both sides — see
 * `docs/index.md` ("所属能力").
 */

export const CAPABILITY_KEYS = [
  'memory_service',
  'memory_lens',
  'memory_capture',
  'memory_coverage_map',
  'memory_exploring',
  'memory_storyline_builder',
  'ask',
  'compose_assist',
  'today_pilot',
  'meeting_pilot',
  'relationship_radar',
  'project_dashboard',
  'message_analysis',
  'message_reaction',
  'topic_messages',
  'scheduled_messages',
  'task_scheduler',
  'agent_thinking',
  'agent_workflow',
  'notification_center',
  'user_profile',
  'prompt_config',
  'rehearsal',
  'skill_foundry',
  'native_join',
  'google_slides_analyzer',
  'jira_design_links',
  'jira_automation_import',
  'doubao_bridge',
  'personal_ai_ar_data',
  'unknown',
] as const;

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

/**
 * 中文展示名（仅报表展示层使用；打点/存储仍用英文 key）。
 * 术语与 docs/index.md「主功能列表」对齐。
 */
export const CAPABILITY_LABELS_ZH: Record<CapabilityKey, string> = {
  memory_service: '记忆服务（核心平台）',
  memory_lens: '记忆提示',
  memory_capture: '记忆捕捉',
  memory_coverage_map: '记忆覆盖地图',
  memory_exploring: '记忆搜索',
  memory_storyline_builder: '记忆叙事',
  ask: '主动问答',
  compose_assist: '回复助手',
  today_pilot: '今天',
  meeting_pilot: '会议助手',
  relationship_radar: '人脉关系',
  project_dashboard: '项目面板',
  message_analysis: '消息分析',
  message_reaction: '消息联动',
  topic_messages: '主题消息',
  scheduled_messages: '定时消息',
  task_scheduler: '任务调度',
  agent_thinking: 'Agent 思考',
  agent_workflow: 'Agent 工作流',
  notification_center: '通知中心',
  user_profile: '用户画像',
  prompt_config: '提示词配置',
  rehearsal: '场景预演',
  skill_foundry: '技能库',
  native_join: 'NC 加会',
  google_slides_analyzer: 'Slides 分析',
  jira_design_links: 'JIRA 设计稿',
  jira_automation_import: 'Jira 规则导入',
  doubao_bridge: '豆包互联',
  personal_ai_ar_data: 'AR 数据',
  unknown: '未归类',
};

const CAPABILITY_KEY_SET = new Set<string>(CAPABILITY_KEYS);

/**
 * Coerce an arbitrary string into a known CapabilityKey, falling back to
 * 'unknown' for anything unrecognized.
 */
export function normalizeCapability(value: string | null | undefined): CapabilityKey {
  if (value && CAPABILITY_KEY_SET.has(value)) {
    return value as CapabilityKey;
  }
  return 'unknown';
}

/**
 * Route-prefix → capability mapping. Prefixes are matched against the request
 * path with the `/api/v1` group prefix stripped. Longest matching prefix wins.
 *
 * Aligned with docs/index.md "所属能力".
 */
const ROUTE_CAPABILITY_ENTRIES: Array<[string, CapabilityKey]> = [
  ['/ask', 'ask'],

  // Search-result feedback / relevance patches are part of Memory Exploring.
  ['/recall/relevance', 'memory_exploring'],
  ['/feedback', 'memory_exploring'],

  // Core memory service (ingest, recall, lifecycle, evolution, reflection…)
  ['/recall', 'memory_service'],
  ['/context-recall', 'memory_service'],
  ['/ingest', 'memory_service'],
  ['/memories', 'memory_service'],
  ['/entities', 'memory_service'],
  ['/consolidate', 'memory_service'],
  ['/lifecycle', 'memory_service'],
  ['/export', 'memory_service'],
  ['/import', 'memory_service'],
  ['/migrate', 'memory_service'],
  ['/stats', 'memory_service'],
  ['/events', 'memory_service'],
  ['/reflection-threads', 'memory_service'],
  ['/confirm-requests', 'memory_service'],
  ['/actions', 'memory_service'],
  ['/outcomes', 'memory_service'],
  ['/evidence-watch-contracts', 'memory_service'],
  ['/keystone-briefs', 'memory_service'],
  ['/user-files', 'memory_service'],
  ['/extractor', 'memory_service'],
  ['/outreach', 'memory_service'],

  // Compose Assist family (composer, context-assist, ambient calibration)
  ['/composer', 'compose_assist'],
  ['/compose', 'compose_assist'],
  ['/context-assist', 'compose_assist'],
  ['/ambient-calibration', 'compose_assist'],

  // Relationship Radar
  ['/relationships', 'relationship_radar'],

  // Message analysis / reaction
  ['/message-rules', 'message_analysis'],
  ['/concerned-items', 'message_analysis'],
  ['/glip-message-markers', 'message_reaction'],
  ['/follow-thread-hits', 'message_reaction'],

  // Meeting Pilot
  ['/meetings', 'meeting_pilot'],
  ['/meeting-outcomes', 'meeting_pilot'],

  // Storyline builder
  ['/storylines', 'memory_storyline_builder'],

  // Coverage map / provider integration
  ['/coverage', 'memory_coverage_map'],
  ['/providers', 'memory_coverage_map'],

  // Memory Capture (source memory)
  ['/source-memory', 'memory_capture'],

  // Skill Foundry
  ['/skills', 'skill_foundry'],

  // Rehearsal
  ['/rehearsals', 'rehearsal'],

  // User Profile
  ['/profile', 'user_profile'],

  // Prompt / runtime config
  ['/config', 'prompt_config'],

  // Project Dashboard
  ['/projects', 'project_dashboard'],

  // Today Pilot
  ['/day-pilot', 'today_pilot'],
  ['/today-pilot', 'today_pilot'],
  ['/calendar-events', 'today_pilot'],

  // Notification Center (feed, digests, weekly report, dream digest)
  ['/notification-center', 'notification_center'],
  ['/notifications', 'notification_center'],
  ['/dream-digest', 'notification_center'],
  ['/weekly-report', 'notification_center'],

  // Task scheduler (AgentTask execution) vs generic agent loop
  ['/agent-tasks', 'task_scheduler'],
  ['/agent', 'agent_thinking'],
];

// Pre-sort by descending prefix length so the first match is the longest.
const SORTED_ROUTE_ENTRIES = [...ROUTE_CAPABILITY_ENTRIES].sort(
  (a, b) => b[0].length - a[0].length,
);

/**
 * Strip the `/api/v1` group prefix and any query string / trailing slash from
 * a route path, returning a normalized `/segment/...` path.
 */
export function normalizeRoutePath(routePath: string | null | undefined): string {
  if (!routePath) return '';
  let path = routePath;
  const queryIndex = path.indexOf('?');
  if (queryIndex >= 0) {
    path = path.slice(0, queryIndex);
  }
  path = path.replace(/^\/api\/v1/, '');
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  return path;
}

/**
 * Resolve a route path to its capability key via longest-prefix match.
 * Unmapped routes resolve to 'unknown'.
 */
export function capabilityForRoute(routePath: string | null | undefined): CapabilityKey {
  const path = normalizeRoutePath(routePath);
  if (!path || path === '/') return 'unknown';
  for (const [prefix, capability] of SORTED_ROUTE_ENTRIES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return capability;
    }
  }
  return 'unknown';
}
