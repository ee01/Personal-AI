/**
 * 用量分析 - 能力（capability）口径（前后端共用）
 *
 * 这里的字符串键必须与后端 memory-service 的 capabilityMap 完全一致，
 * 作为跨仓库（Chrome 扩展前端 / memory-service 后端）的统一契约。
 * 对齐 docs/features/index.md 的「所属能力」分类。
 *
 * ⚠️ 修改任何键之前，必须同步更新后端的能力枚举，否则打点归类会错位。
 */

/**
 * 全部合法能力键（顺序无意义，仅用于校验与枚举）。
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

/**
 * 能力键联合类型。
 */
export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

/**
 * 兜底能力：未标注 / 非法值统一归到 `unknown`。
 */
export const UNKNOWN_CAPABILITY: CapabilityKey = 'unknown';

/**
 * 枚举风格的常量表，便于调用方以命名成员引用（值即契约字符串）。
 */
export const CAPABILITIES = {
  MEMORY_SERVICE: 'memory_service',
  MEMORY_LENS: 'memory_lens',
  MEMORY_CAPTURE: 'memory_capture',
  MEMORY_COVERAGE_MAP: 'memory_coverage_map',
  MEMORY_EXPLORING: 'memory_exploring',
  MEMORY_STORYLINE_BUILDER: 'memory_storyline_builder',
  ASK: 'ask',
  COMPOSE_ASSIST: 'compose_assist',
  TODAY_PILOT: 'today_pilot',
  MEETING_PILOT: 'meeting_pilot',
  RELATIONSHIP_RADAR: 'relationship_radar',
  PROJECT_DASHBOARD: 'project_dashboard',
  MESSAGE_ANALYSIS: 'message_analysis',
  MESSAGE_REACTION: 'message_reaction',
  TOPIC_MESSAGES: 'topic_messages',
  SCHEDULED_MESSAGES: 'scheduled_messages',
  TASK_SCHEDULER: 'task_scheduler',
  AGENT_THINKING: 'agent_thinking',
  AGENT_WORKFLOW: 'agent_workflow',
  NOTIFICATION_CENTER: 'notification_center',
  USER_PROFILE: 'user_profile',
  PROMPT_CONFIG: 'prompt_config',
  REHEARSAL: 'rehearsal',
  SKILL_FOUNDRY: 'skill_foundry',
  NATIVE_JOIN: 'native_join',
  GOOGLE_SLIDES_ANALYZER: 'google_slides_analyzer',
  JIRA_DESIGN_LINKS: 'jira_design_links',
  JIRA_AUTOMATION_IMPORT: 'jira_automation_import',
  DOUBAO_BRIDGE: 'doubao_bridge',
  PERSONAL_AI_AR_DATA: 'personal_ai_ar_data',
  UNKNOWN: 'unknown',
} as const satisfies Record<string, CapabilityKey>;

const CAPABILITY_KEY_SET = new Set<string>(CAPABILITY_KEYS);

/**
 * 判断任意值是否是合法能力键。
 */
export function isCapabilityKey(value: unknown): value is CapabilityKey {
  return typeof value === 'string' && CAPABILITY_KEY_SET.has(value);
}

/**
 * 归一化能力键：合法则原样返回，否则回退到 `unknown`。
 */
export function normalizeCapability(value: unknown): CapabilityKey {
  return isCapabilityKey(value) ? value : UNKNOWN_CAPABILITY;
}
