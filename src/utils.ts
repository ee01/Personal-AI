export type BotPushTargetMode = 'me' | 'group' | 'none';

export type BotPushScenario =
  | 'message_analysis'
  | 'follow_up'
  | 'dream_insight'
  | 'weekly_report'
  | 'decision_center'
  | 'outreach_result';

export type MeetingTranscribeLanguage = 'auto' | 'zh-CN' | 'en-US';
export type MeetingPrepCalendarSource =
  | 'auto'
  | 'outlook'
  | 'ringcentral_indexeddb';

export interface ResolvedBotPushTarget {
  mode: BotPushTargetMode;
  apiType: 'user' | 'team' | null;
  teamId?: string;
}

// 环境配置类型定义
export interface EnvConfigType {
  MESSAGE_ANALYSIS_INTERVAL: number; // 分析消息的频度（分钟）
  MESSAGE_CONTEXT_WINDOW: number; // 消息上下文窗口：距离此刻的历史消息时间范围（分钟）
  CONCERNED_ITEMS_DIGEST_HOUR: number; // ConcernedItems 摘要推送时间（小时，0-23）
  SCHEDULED_INTERVAL: number; // 已废弃，保留用于向后兼容
  ANALYSIS_TYPE: string;
  ANALYZE_BY_GROUP: boolean;
  LLM_TYPE: string;
  OLLAMA_BASE_URL: string;
  OLLAMA_MODEL: string;
  OLLAMA_REVIEW_MODEL: string;
  OLLAMA_QUERY_MODEL: string;
  DIFY_API_KEY: string;
  DIFY_REVIEW_API_KEY: string;
  DIFY_API_BASE_URL: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  OPENAI_REVIEW_MODEL: string;
  OPENAI_API_BASE_URL: string;
  GROQ_API_KEY: string;
  GROQ_MODEL: string;
  GROQ_REVIEW_MODEL: string;
  BOT_API_BASE_URL: string;
  BOT_TOKEN: string;
  BOT_ID: string;
  BOT_TYPE: string;
  TEAM_ID: string;
  /** @deprecated 使用每个 concernedItem 的 notifyMethod 替代 */
  ENABLE_BOT?: boolean;
  LLM_REVIEW_BEFORE_SEND: boolean;
  ENABLE_CHROMA: boolean;
  CHROMA_API_URL: string; // 保留用于兼容旧配置
  CHROMA_HOST: string; // 新增：Chroma 主机地址
  CHROMA_PORT: number;
  CHROMA_SSL: boolean; // 新增：是否使用 SSL
  CHROMA_COLLECTION_NAME: string;
  // JIRA相关配置
  JIRA_BASE_URL?: string;
  JIRA_USERNAME?: string;
  JIRA_API_TOKEN?: string;
  DESIGN_JIRA_PROJECT?: string; // Jira Design项目前缀（如 UX）
  DESIGN_LINK_DOMAINS?: string; // 额外设计链接域名，逗号/分号/换行分隔
  DEPENDENCIES_JIRA_PROJECT?: string; // Jira外部依赖项目前缀（如 RCV）
  // 消息交互功能开关
  ENABLE_AUTO_REPLY: boolean; // 启用自动答复功能
  ENABLE_SNOOZE: boolean; // 启用稍后处理功能
  ENABLE_FOLLOW_THREAD: boolean; // 启用关注后续功能
  ENABLE_LINKED_ACTION: boolean; // 启用联动操作功能
  // 消息过滤配置
  FILTER_OWN_MESSAGES: boolean; // 是否过滤自己发送的消息
  OWNER_SPEECH_LEARNING_ENABLED: boolean; // 是否自动学习自己的发言以优化输入建议
  // 记忆系统 (Memory Service)
  MEMORY_SERVICE_BASE_URL: string; // 记忆服务 API 地址，如 http://localhost:3210/api/v1
  MEMORY_SERVICE_API_KEY?: string; // 可选，用于认证扩展请求；后端配置 API_KEY 时需匹配
  MEMORY_SERVICE_TIMEOUT?: number; // 请求超时（毫秒），默认 30000
  // 自动周报 (Weekly Report)
  WEEKLY_REPORT_ENABLED: string; // 'true' | 'false'
  WEEKLY_REPORT_CRON: string; // cron 表达式，默认 '0 18 * * 5'（每周五 18:00）
  WEEKLY_REPORT_MIN_MESSAGES: number; // 最少消息数阈值，默认 20
  MESSAGE_ANALYSIS_PUSH_TARGET?: BotPushTargetMode;
  MESSAGE_ANALYSIS_PUSH_GROUP_ID?: string;
  FOLLOW_UP_PUSH_TARGET?: BotPushTargetMode;
  FOLLOW_UP_PUSH_GROUP_ID?: string;
  DREAM_INSIGHT_PUSH_TARGET?: BotPushTargetMode;
  DREAM_INSIGHT_PUSH_GROUP_ID?: string;
  WEEKLY_REPORT_PUSH_TARGET?: BotPushTargetMode;
  WEEKLY_REPORT_PUSH_GROUP_ID?: string;
  DECISION_CENTER_PUSH_TARGET?: BotPushTargetMode;
  DECISION_CENTER_PUSH_GROUP_ID?: string;
  OUTREACH_RESULT_PUSH_TARGET?: BotPushTargetMode;
  OUTREACH_RESULT_PUSH_GROUP_ID?: string;
  DREAM_DIGEST_SCHEDULE_TYPE?: 'weekly' | 'every_x_days' | 'monthly';
  DREAM_DIGEST_INTERVAL_DAYS?: number;
  SELF_REFLECTION_ENABLED: boolean;
  SELF_REFLECTION_HEARTBEAT_MINUTES: number;
  OPENCLAW_ENABLED: boolean;
  OPENCLAW_BASE_URL: string;
  OPENCLAW_TIMEOUT_MS: number;
  OPENCLAW_API_KEY?: string;
  OPENCLAW_CLEAR_API_KEY?: boolean;
  OPENCLAW_API_KEY_CONFIGURED?: boolean;
  OUTREACH_ENABLED: boolean;
  OUTREACH_INTERVAL_MS: number;
  OUTREACH_REQUIRE_APPROVAL_FOR_REFLECTION: boolean;
  OUTREACH_REQUIRE_APPROVAL_FOR_MANUAL: boolean;
  RINGCENTRAL_SERVER_URL: string;
  RINGCENTRAL_CLIENT_ID: string;
  RINGCENTRAL_CLIENT_SECRET?: string;
  RINGCENTRAL_JWT?: string;
  RINGCENTRAL_CLEAR_CLIENT_SECRET?: boolean;
  RINGCENTRAL_CLEAR_JWT?: boolean;
  RINGCENTRAL_CLIENT_SECRET_CONFIGURED?: boolean;
  RINGCENTRAL_JWT_CONFIGURED?: boolean;
  RINGCENTRAL_SENDER_DIFY_API_BASE_URL: string;
  RINGCENTRAL_SENDER_DIFY_API_KEY: string;
  MEETING_PILOT_ENABLED: boolean;
  MEETING_PILOT_FLOATING_ICON_VISIBLE: boolean;
  CONTEXT_ASSIST_ENABLED: boolean;
  COMPOSE_ASSIST_ENABLED: boolean;
  MEETING_PREP_ENABLED: boolean;
  TODAY_PILOT_MEETING_PREP_ENABLED: boolean;
  MEETING_PREP_CALENDAR_SOURCE: MeetingPrepCalendarSource;
  MEETING_NATIVE_CLIENT_JOIN_ENABLED: boolean;
  MS_OUTLOOK_CLIENT_ID: string;
  MS_OUTLOOK_TENANT_ID: string;
  MEETING_MINUTES_API_URL: string;
  MEETING_FEATURE_ENABLED: boolean;
  MEETING_DANMAKU_SPEED: 'fast' | 'medium' | 'slow';
  MEETING_AUTO_DETECT: boolean;
  MEETING_ENTRY_MODE: 'auto' | 'manual';
  MEETING_DIGEST_API_BASE_URL: string;
  MEETING_PROVIDER_BASE_URL: string;
  MEETING_PROVIDER_API_KEY?: string;
  MEETING_TRANSCRIBE_API_STYLE:
    | 'openai_audio_transcriptions'
    | 'openai_chat_completions';
  MEETING_TRANSCRIBE_MODEL: string;
  MEETING_TRANSCRIBE_LANGUAGE: MeetingTranscribeLanguage;
  MEETING_RINGCENTRAL_TRANSCRIPT_ENABLED: boolean;
  MEETING_NAME_ALIASES: string;
  MEETING_HOTWORDS: string;
  MEETING_SUMMARY_INTERVAL_SEC: number;
  MEETING_SCREENSHOT_INTERVAL_SEC: number;
  MEETING_MEMORY_CONTEXT_ENABLED: boolean;
  MEETING_PRIVACY_NOTICE_TEXT: string;
  MEETING_TRANSCRIPTION_MODE?: 'auto' | 'local-only' | 'cloud-only';
}

export function getMeetingTranscriptionMode(
  envConfig: Pick<EnvConfigType, 'MEETING_TRANSCRIPTION_MODE'>,
): 'auto' | 'local-only' | 'cloud-only' {
  const v = envConfig.MEETING_TRANSCRIPTION_MODE;
  if (v === 'local-only' || v === 'cloud-only') return v;
  return 'auto';
}

export function isMeetingRingCentralTranscriptEnabled(
  envConfig: Pick<EnvConfigType, 'MEETING_RINGCENTRAL_TRANSCRIPT_ENABLED'>,
): boolean {
  return envConfig.MEETING_RINGCENTRAL_TRANSCRIPT_ENABLED !== false;
}

export function normalizeMeetingTranscribeLanguage(
  value: unknown,
): MeetingTranscribeLanguage {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace('_', '-');
  if (raw === 'zh' || raw.startsWith('zh-')) return 'zh-CN';
  if (raw === 'cn' || raw === 'chinese') return 'zh-CN';
  if (raw === 'en' || raw.startsWith('en-')) return 'en-US';
  if (raw === 'english') return 'en-US';
  return 'auto';
}

export function getMeetingTranscribeLanguageCode(
  value: unknown,
): 'zh' | 'en' | undefined {
  const normalized = normalizeMeetingTranscribeLanguage(value);
  if (normalized === 'zh-CN') return 'zh';
  if (normalized === 'en-US') return 'en';
  return undefined;
}

export function normalizeBotPushTarget(
  value: string | undefined | null,
  allowNone = false,
  fallback: BotPushTargetMode = 'me',
): BotPushTargetMode {
  if (value === 'group' || value === 'team') {
    return 'group';
  }
  if (value === 'me' || value === 'user') {
    return 'me';
  }
  if (allowNone && value === 'none') {
    return 'none';
  }
  return fallback;
}

export function normalizeConcernedItemsDigestHour(
  value: number | string | undefined | null,
  fallback = 8,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(23, Math.max(0, Math.floor(parsed)));
}

export function normalizeConcernedItemsDigestDayOfWeek(
  value: number | string | undefined | null,
  fallback = 1,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(6, Math.max(0, Math.floor(parsed)));
}

export function getBotPushTarget(
  config: EnvConfigType,
  scenario?: BotPushScenario,
): ResolvedBotPushTarget {
  const fallbackMode = config.BOT_TYPE === 'team' ? 'group' : 'me';
  const fallbackTeamId = config.TEAM_ID || '';

  const scenarioConfig = (() => {
    switch (scenario) {
      case 'message_analysis':
        return {
          mode: normalizeBotPushTarget(
            config.MESSAGE_ANALYSIS_PUSH_TARGET,
            false,
            fallbackMode,
          ),
          teamId: config.MESSAGE_ANALYSIS_PUSH_GROUP_ID || fallbackTeamId,
        };
      case 'follow_up':
        return {
          mode: normalizeBotPushTarget(
            config.FOLLOW_UP_PUSH_TARGET,
            false,
            fallbackMode,
          ),
          teamId: config.FOLLOW_UP_PUSH_GROUP_ID || fallbackTeamId,
        };
      case 'dream_insight':
        return {
          mode: normalizeBotPushTarget(
            config.DREAM_INSIGHT_PUSH_TARGET,
            true,
            fallbackMode,
          ),
          teamId: config.DREAM_INSIGHT_PUSH_GROUP_ID || fallbackTeamId,
        };
      case 'weekly_report':
        return {
          mode: normalizeBotPushTarget(
            config.WEEKLY_REPORT_PUSH_TARGET,
            true,
            fallbackMode,
          ),
          teamId: config.WEEKLY_REPORT_PUSH_GROUP_ID || fallbackTeamId,
        };
      case 'decision_center':
        return {
          mode: normalizeBotPushTarget(
            config.DECISION_CENTER_PUSH_TARGET,
            false,
            fallbackMode,
          ),
          teamId: config.DECISION_CENTER_PUSH_GROUP_ID || fallbackTeamId,
        };
      case 'outreach_result':
        return {
          mode: normalizeBotPushTarget(
            config.OUTREACH_RESULT_PUSH_TARGET,
            false,
            fallbackMode,
          ),
          teamId: config.OUTREACH_RESULT_PUSH_GROUP_ID || fallbackTeamId,
        };
      default:
        return {
          mode: normalizeBotPushTarget(config.BOT_TYPE, false, fallbackMode),
          teamId: fallbackTeamId,
        };
    }
  })();

  if (scenarioConfig.mode === 'none') {
    return { mode: 'none', apiType: null };
  }

  if (scenarioConfig.mode === 'group') {
    return {
      mode: 'group',
      apiType: 'team',
      teamId: scenarioConfig.teamId,
    };
  }

  return {
    mode: 'me',
    apiType: 'user',
  };
}

export function formatDate(dateString: string | number) {
  const date = new Date(dateString);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function uniqBy(array: any[], key: string) {
  const seen = new Set();
  return array.filter((item) => {
    const keyValue = item[key];
    if (seen.has(keyValue)) {
      return false;
    }
    seen.add(keyValue);
    return true;
  });
}

export function showToast(message: string, type: string, onClose?: () => void) {
  // 获取或创建容器元素
  const container = document.getElementById('radar-poc-result');
  if (!container) return;

  // 移除现有的 Toast 元素
  const existingToast = container.querySelector('.radar-poc-toast');
  if (existingToast) {
    container.removeChild(existingToast);
  }

  // 创建新的 Toast 元素
  const toast = document.createElement('div');
  toast.className = `radar-poc-toast radar-poc-toast-${type}`;

  const toastInner = document.createElement('div');
  toastInner.className = 'radar-poc-toast-inner';
  toastInner.textContent = message;

  toast.appendChild(toastInner);
  container.appendChild(toast);

  // 设置定时器在 3 秒后关闭 Toast
  const timer = setTimeout(() => {
    if (container.contains(toast)) {
      container.removeChild(toast);
    }
    if (onClose) {
      onClose();
    }
  }, 3000);

  // 返回一个函数以便手动关闭 Toast
  return () => {
    clearTimeout(timer);
    if (container.contains(toast)) {
      container.removeChild(toast);
    }
    if (onClose) {
      onClose();
    }
  };
}

export function transformGroupLinks(inputString: string) {
  const groupLinkPattern = /\[group:(.+):(\d+)\]/g;
  const transformedString = inputString.replace(
    groupLinkPattern,
    (match, groupName, groupId) => {
      return `[${groupName}](/messages/${groupId})`;
    },
  );
  return transformedString;
}

export function transformPostLinks(inputString: string) {
  const postLinkPattern = /\[post:(\d+)\]/g;
  let index = 1;
  const transformedString = inputString.replace(
    postLinkPattern,
    (match, postId) => {
      return `[[${index++}]](/l${window.location.pathname}/${postId})`;
    },
  );
  return transformedString;
}

export function normalizeEnvConfigShape(
  config: Partial<EnvConfigType>,
): EnvConfigType {
  const normalizedFollowThreadEnabled =
    typeof config.ENABLE_FOLLOW_THREAD === 'boolean'
      ? config.ENABLE_FOLLOW_THREAD
      : defaultEnvConfig.ENABLE_FOLLOW_THREAD;
  const normalizedLinkedActionEnabled =
    typeof config.ENABLE_LINKED_ACTION === 'boolean'
      ? config.ENABLE_LINKED_ACTION
      : defaultEnvConfig.ENABLE_LINKED_ACTION;
  const normalizedMeetingPilotEnabled =
    typeof config.MEETING_PILOT_ENABLED === 'boolean'
      ? config.MEETING_PILOT_ENABLED
      : typeof config.MEETING_FEATURE_ENABLED === 'boolean'
      ? config.MEETING_FEATURE_ENABLED
      : defaultEnvConfig.MEETING_PILOT_ENABLED;
  const normalizedMeetingPilotFloatingIconVisible =
    typeof config.MEETING_PILOT_FLOATING_ICON_VISIBLE === 'boolean'
      ? config.MEETING_PILOT_FLOATING_ICON_VISIBLE
      : defaultEnvConfig.MEETING_PILOT_FLOATING_ICON_VISIBLE;
  const normalizedMeetingPrepCalendarSource: MeetingPrepCalendarSource =
    config.MEETING_PREP_CALENDAR_SOURCE === 'outlook' ||
    config.MEETING_PREP_CALENDAR_SOURCE === 'ringcentral_indexeddb'
      ? config.MEETING_PREP_CALENDAR_SOURCE
      : 'auto';

  const normalizedMinutesApiUrl =
    String(
      config.MEETING_MINUTES_API_URL ||
        config.MEETING_DIGEST_API_BASE_URL ||
        '',
    ).trim() || defaultEnvConfig.MEETING_MINUTES_API_URL;
  const normalizedMeetingTranscribeApiStyle =
    config.MEETING_TRANSCRIBE_API_STYLE === 'openai_chat_completions'
      ? 'openai_chat_completions'
      : defaultEnvConfig.MEETING_TRANSCRIBE_API_STYLE;
  const normalizedMeetingTranscribeLanguage: MeetingTranscribeLanguage = 'auto';

  return {
    ...defaultEnvConfig,
    ...config,
    ENABLE_FOLLOW_THREAD: normalizedFollowThreadEnabled,
    ENABLE_LINKED_ACTION: normalizedLinkedActionEnabled,
    MEETING_PILOT_ENABLED: normalizedMeetingPilotEnabled,
    MEETING_PILOT_FLOATING_ICON_VISIBLE:
      normalizedMeetingPilotFloatingIconVisible,
    CONTEXT_ASSIST_ENABLED: config.CONTEXT_ASSIST_ENABLED !== false,
    COMPOSE_ASSIST_ENABLED:
      config.COMPOSE_ASSIST_ENABLED !== false &&
      config.CONTEXT_ASSIST_ENABLED !== false,
    OWNER_SPEECH_LEARNING_ENABLED:
      config.OWNER_SPEECH_LEARNING_ENABLED !== false,
    MEETING_PREP_ENABLED: config.MEETING_PREP_ENABLED !== false,
    TODAY_PILOT_MEETING_PREP_ENABLED:
      config.TODAY_PILOT_MEETING_PREP_ENABLED !== false &&
      config.MEETING_PREP_ENABLED !== false,
    MEETING_PREP_CALENDAR_SOURCE: normalizedMeetingPrepCalendarSource,
    MEETING_NATIVE_CLIENT_JOIN_ENABLED:
      config.MEETING_NATIVE_CLIENT_JOIN_ENABLED !== false,
    MS_OUTLOOK_CLIENT_ID: String(config.MS_OUTLOOK_CLIENT_ID || '').trim(),
    MS_OUTLOOK_TENANT_ID:
      String(config.MS_OUTLOOK_TENANT_ID || '').trim() || 'common',
    MEETING_FEATURE_ENABLED: normalizedMeetingPilotEnabled,
    MEETING_MINUTES_API_URL: normalizedMinutesApiUrl,
    MEETING_DIGEST_API_BASE_URL: normalizedMinutesApiUrl,
    MEETING_TRANSCRIBE_API_STYLE: normalizedMeetingTranscribeApiStyle,
    MEETING_TRANSCRIBE_LANGUAGE: normalizedMeetingTranscribeLanguage,
    MEETING_RINGCENTRAL_TRANSCRIPT_ENABLED:
      config.MEETING_RINGCENTRAL_TRANSCRIPT_ENABLED !== false,
  };
}

// 默认环境配置
export const defaultEnvConfig: EnvConfigType = {
  MESSAGE_ANALYSIS_INTERVAL:
    Number(process.env.MESSAGE_ANALYSIS_INTERVAL) ||
    Number(process.env.SCHEDULED_INTERVAL) ||
    120,
  MESSAGE_CONTEXT_WINDOW: Number(process.env.MESSAGE_CONTEXT_WINDOW) || 125,
  CONCERNED_ITEMS_DIGEST_HOUR: normalizeConcernedItemsDigestHour(
    process.env.CONCERNED_ITEMS_DIGEST_HOUR,
    8,
  ),
  SCHEDULED_INTERVAL: Number(process.env.SCHEDULED_INTERVAL) || 120, // 保留用于向后兼容
  ANALYSIS_TYPE: process.env.ANALYSIS_TYPE || 'filter',
  LLM_TYPE: process.env.LLM_TYPE || 'dify',
  ANALYZE_BY_GROUP: process.env.ANALYZE_BY_GROUP === 'true',
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'deepseek-r1',
  OLLAMA_REVIEW_MODEL: process.env.OLLAMA_REVIEW_MODEL || 'llama3.1',
  OLLAMA_QUERY_MODEL: process.env.OLLAMA_QUERY_MODEL || 'llama3.1',
  DIFY_API_KEY: process.env.DIFY_API_KEY || '',
  DIFY_REVIEW_API_KEY: process.env.DIFY_REVIEW_API_KEY || '',
  DIFY_API_BASE_URL: process.env.DIFY_API_BASE_URL || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || '',
  OPENAI_REVIEW_MODEL: process.env.OPENAI_REVIEW_MODEL || '',
  OPENAI_API_BASE_URL: process.env.OPENAI_API_BASE_URL || '',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_MODEL: process.env.GROQ_MODEL || '',
  GROQ_REVIEW_MODEL: process.env.GROQ_REVIEW_MODEL || '',
  BOT_API_BASE_URL:
    process.env.BOT_API_BASE_URL || 'https://botman.int.rclabenv.com/v2',
  BOT_TOKEN: process.env.BOT_TOKEN || '',
  BOT_ID: process.env.BOT_ID || '4700372020@37439510.bot.glip.net',
  BOT_TYPE: process.env.BOT_TYPE || 'user',
  TEAM_ID: process.env.TEAM_ID || '',
  // ENABLE_BOT 已废弃，使用每个 concernedItem 的 notifyMethod 替代
  ENABLE_BOT: undefined,
  LLM_REVIEW_BEFORE_SEND: process.env.LLM_REVIEW_BEFORE_SEND === 'true',
  ENABLE_CHROMA: process.env.ENABLE_CHROMA === 'true',
  CHROMA_API_URL: process.env.CHROMA_API_URL || 'http://localhost:8000', // 保留用于兼容
  CHROMA_HOST: process.env.CHROMA_HOST || 'localhost',
  CHROMA_PORT: Number(process.env.CHROMA_PORT) || 8000,
  CHROMA_SSL: process.env.CHROMA_SSL === 'true',
  CHROMA_COLLECTION_NAME: process.env.CHROMA_COLLECTION_NAME || '',
  JIRA_BASE_URL: process.env.JIRA_BASE_URL || 'https://jira.ringcentral.com',
  JIRA_USERNAME: process.env.JIRA_USERNAME || '',
  JIRA_API_TOKEN: process.env.JIRA_API_TOKEN || '',
  DESIGN_JIRA_PROJECT: process.env.DESIGN_JIRA_PROJECT || 'UX*',
  DESIGN_LINK_DOMAINS: process.env.DESIGN_LINK_DOMAINS || '',
  DEPENDENCIES_JIRA_PROJECT: process.env.DEPENDENCIES_JIRA_PROJECT || 'RCV',
  // 消息交互功能开关（默认全部启用）
  ENABLE_AUTO_REPLY: process.env.ENABLE_AUTO_REPLY !== 'false',
  ENABLE_SNOOZE: process.env.ENABLE_SNOOZE !== 'false',
  ENABLE_FOLLOW_THREAD: process.env.ENABLE_FOLLOW_THREAD !== 'false',
  ENABLE_LINKED_ACTION: process.env.ENABLE_LINKED_ACTION !== 'false',
  // 消息过滤配置（默认开启过滤）
  FILTER_OWN_MESSAGES: process.env.FILTER_OWN_MESSAGES !== 'false',
  OWNER_SPEECH_LEARNING_ENABLED:
    process.env.OWNER_SPEECH_LEARNING_ENABLED !== 'false',
  // 记忆系统 (Memory Service)
  MEMORY_SERVICE_BASE_URL:
    process.env.MEMORY_SERVICE_BASE_URL || 'http://localhost:3210/api/v1',
  MEMORY_SERVICE_API_KEY: process.env.MEMORY_SERVICE_API_KEY || '',
  MEMORY_SERVICE_TIMEOUT: Number(process.env.MEMORY_SERVICE_TIMEOUT) || 30_000,
  // 自动周报 (Weekly Report)
  WEEKLY_REPORT_ENABLED: process.env.WEEKLY_REPORT_ENABLED || 'true',
  WEEKLY_REPORT_CRON: process.env.WEEKLY_REPORT_CRON || '0 18 * * 5',
  WEEKLY_REPORT_MIN_MESSAGES:
    Number(process.env.WEEKLY_REPORT_MIN_MESSAGES) || 20,
  MESSAGE_ANALYSIS_PUSH_TARGET: 'me',
  MESSAGE_ANALYSIS_PUSH_GROUP_ID: '',
  FOLLOW_UP_PUSH_TARGET: 'me',
  FOLLOW_UP_PUSH_GROUP_ID: '',
  DREAM_INSIGHT_PUSH_TARGET: 'me',
  DREAM_INSIGHT_PUSH_GROUP_ID: '',
  WEEKLY_REPORT_PUSH_TARGET: 'me',
  WEEKLY_REPORT_PUSH_GROUP_ID: '',
  DECISION_CENTER_PUSH_TARGET: 'me',
  DECISION_CENTER_PUSH_GROUP_ID: '',
  OUTREACH_RESULT_PUSH_TARGET: 'me',
  OUTREACH_RESULT_PUSH_GROUP_ID: '',
  DREAM_DIGEST_SCHEDULE_TYPE:
    process.env.DREAM_DIGEST_SCHEDULE_TYPE === 'every_x_days' ||
    process.env.DREAM_DIGEST_SCHEDULE_TYPE === 'monthly'
      ? process.env.DREAM_DIGEST_SCHEDULE_TYPE
      : 'every_x_days',
  DREAM_DIGEST_INTERVAL_DAYS: Math.max(
    1,
    Number(process.env.DREAM_DIGEST_INTERVAL_DAYS) || 1,
  ),
  SELF_REFLECTION_ENABLED: process.env.REFLECTION_ENABLED === 'true',
  SELF_REFLECTION_HEARTBEAT_MINUTES: Math.max(
    1,
    Number(process.env.REFLECTION_HEARTBEAT_MINUTES) || 15,
  ),
  OPENCLAW_ENABLED: process.env.OPENCLAW_ENABLED === 'true',
  OPENCLAW_BASE_URL: process.env.OPENCLAW_BASE_URL || '',
  OPENCLAW_TIMEOUT_MS: Math.max(
    1000,
    Number(process.env.OPENCLAW_TIMEOUT_MS) || 600000,
  ),
  OPENCLAW_API_KEY: '',
  OPENCLAW_CLEAR_API_KEY: false,
  OPENCLAW_API_KEY_CONFIGURED: Boolean(process.env.OPENCLAW_API_KEY),
  OUTREACH_ENABLED: process.env.OUTREACH_ENABLED === 'true',
  OUTREACH_INTERVAL_MS: Math.max(
    1000,
    Number(process.env.OUTREACH_INTERVAL_MS) || 60000,
  ),
  OUTREACH_REQUIRE_APPROVAL_FOR_REFLECTION:
    process.env.OUTREACH_REQUIRE_APPROVAL_FOR_REFLECTION !== 'false',
  OUTREACH_REQUIRE_APPROVAL_FOR_MANUAL:
    process.env.OUTREACH_REQUIRE_APPROVAL_FOR_MANUAL === 'true',
  RINGCENTRAL_SERVER_URL: process.env.RINGCENTRAL_SERVER_URL || '',
  RINGCENTRAL_CLIENT_ID: process.env.RINGCENTRAL_CLIENT_ID || '',
  RINGCENTRAL_CLIENT_SECRET: '',
  RINGCENTRAL_JWT: '',
  RINGCENTRAL_CLEAR_CLIENT_SECRET: false,
  RINGCENTRAL_CLEAR_JWT: false,
  RINGCENTRAL_CLIENT_SECRET_CONFIGURED: Boolean(
    process.env.RINGCENTRAL_CLIENT_SECRET,
  ),
  RINGCENTRAL_JWT_CONFIGURED: Boolean(process.env.RINGCENTRAL_JWT),
  RINGCENTRAL_SENDER_DIFY_API_BASE_URL:
    process.env.RINGCENTRAL_SENDER_DIFY_API_BASE_URL ||
    'https://dify.int.rclabenv.com/v1',
  RINGCENTRAL_SENDER_DIFY_API_KEY:
    process.env.RINGCENTRAL_SENDER_DIFY_API_KEY || '',
  MEETING_PILOT_ENABLED:
    process.env.MEETING_PILOT_ENABLED !== 'false' &&
    process.env.MEETING_FEATURE_ENABLED !== 'false',
  MEETING_PILOT_FLOATING_ICON_VISIBLE:
    process.env.MEETING_PILOT_FLOATING_ICON_VISIBLE !== 'false',
  CONTEXT_ASSIST_ENABLED: process.env.CONTEXT_ASSIST_ENABLED !== 'false',
  COMPOSE_ASSIST_ENABLED:
    process.env.COMPOSE_ASSIST_ENABLED !== 'false' &&
    process.env.CONTEXT_ASSIST_ENABLED !== 'false',
  MEETING_PREP_ENABLED: process.env.MEETING_PREP_ENABLED !== 'false',
  TODAY_PILOT_MEETING_PREP_ENABLED:
    process.env.TODAY_PILOT_MEETING_PREP_ENABLED !== 'false' &&
    process.env.MEETING_PREP_ENABLED !== 'false',
  MEETING_PREP_CALENDAR_SOURCE:
    process.env.MEETING_PREP_CALENDAR_SOURCE === 'outlook' ||
    process.env.MEETING_PREP_CALENDAR_SOURCE === 'ringcentral_indexeddb'
      ? process.env.MEETING_PREP_CALENDAR_SOURCE
      : 'auto',
  MEETING_NATIVE_CLIENT_JOIN_ENABLED:
    process.env.MEETING_NATIVE_CLIENT_JOIN_ENABLED !== 'false',
  MS_OUTLOOK_CLIENT_ID: process.env.MS_OUTLOOK_CLIENT_ID || '',
  MS_OUTLOOK_TENANT_ID: process.env.MS_OUTLOOK_TENANT_ID || 'common',
  MEETING_MINUTES_API_URL:
    process.env.MEETING_MINUTES_API_URL ||
    process.env.MEETING_DIGEST_API_BASE_URL ||
    'https://10.32.45.219:9527',
  MEETING_FEATURE_ENABLED: process.env.MEETING_FEATURE_ENABLED !== 'false',
  MEETING_AUTO_DETECT: process.env.MEETING_AUTO_DETECT !== 'false',
  MEETING_ENTRY_MODE:
    process.env.MEETING_ENTRY_MODE === 'manual' ? 'manual' : 'auto',
  MEETING_DIGEST_API_BASE_URL:
    process.env.MEETING_DIGEST_API_BASE_URL || 'https://10.32.45.219:9527',
  MEETING_PROVIDER_BASE_URL:
    process.env.MEETING_PROVIDER_BASE_URL ||
    process.env.OPENAI_API_BASE_URL ||
    '',
  MEETING_PROVIDER_API_KEY:
    process.env.MEETING_PROVIDER_API_KEY || process.env.OPENAI_API_KEY || '',
  MEETING_TRANSCRIBE_API_STYLE:
    process.env.MEETING_TRANSCRIBE_API_STYLE === 'openai_chat_completions'
      ? 'openai_chat_completions'
      : 'openai_audio_transcriptions',
  MEETING_TRANSCRIBE_MODEL: process.env.MEETING_TRANSCRIBE_MODEL || 'whisper-1',
  MEETING_TRANSCRIBE_LANGUAGE: 'auto',
  MEETING_RINGCENTRAL_TRANSCRIPT_ENABLED:
    process.env.MEETING_RINGCENTRAL_TRANSCRIPT_ENABLED !== 'false',
  MEETING_NAME_ALIASES: process.env.MEETING_NAME_ALIASES || '',
  MEETING_HOTWORDS: process.env.MEETING_HOTWORDS || '',
  MEETING_DANMAKU_SPEED:
    process.env.MEETING_DANMAKU_SPEED === 'fast' ||
    process.env.MEETING_DANMAKU_SPEED === 'slow'
      ? process.env.MEETING_DANMAKU_SPEED
      : 'medium',
  MEETING_SUMMARY_INTERVAL_SEC: Math.max(
    15,
    Number(process.env.MEETING_SUMMARY_INTERVAL_SEC) || 45,
  ),
  MEETING_SCREENSHOT_INTERVAL_SEC: Math.max(
    10,
    Number(process.env.MEETING_SCREENSHOT_INTERVAL_SEC) || 18,
  ),
  MEETING_MEMORY_CONTEXT_ENABLED:
    process.env.MEETING_MEMORY_CONTEXT_ENABLED !== 'false',
  MEETING_PRIVACY_NOTICE_TEXT:
    process.env.MEETING_PRIVACY_NOTICE_TEXT ||
    'Meeting Pilot 正在录制、转写并生成会中提醒。',
};

const GET_ENV_CONFIG_MESSAGE = 'PERSONAL_AI_GET_ENV_CONFIG' as const;
const GET_ENV_CONFIG_BACKGROUND_TIMEOUT_MS = 800;

/**
 * Offscreen documents and a few other extension contexts do not expose
 * `chrome.storage` (see chrome.storage is undefined). Ask the service worker
 * for the same envConfig the rest of the extension uses.
 */
async function getEnvConfigViaBackground(): Promise<EnvConfigType | null> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return null;
  }
  try {
    const response = await Promise.race([
      new Promise<{
        success?: boolean;
        envConfig?: EnvConfigType;
      }>((resolve, reject) => {
        chrome.runtime.sendMessage({ type: GET_ENV_CONFIG_MESSAGE }, (res) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(
            (res || {}) as { success?: boolean; envConfig?: EnvConfigType },
          );
        });
      }),
      new Promise<{
        success?: boolean;
        envConfig?: EnvConfigType;
      }>((resolve) => {
        setTimeout(() => resolve({}), GET_ENV_CONFIG_BACKGROUND_TIMEOUT_MS);
      }),
    ]);
    if (response?.envConfig) {
      return normalizeEnvConfigShape(response.envConfig);
    }
  } catch (error) {
    console.warn('getEnvConfig via background failed:', error);
  }
  return null;
}

/** Offscreen 常读到空 envConfig；用 SW 的 storage 作权威源需要 Meeting Pilot / Whisper 字段。 */
function isMissingMeetingProvider(c: EnvConfigType): boolean {
  return (
    !String(c.MEETING_PROVIDER_BASE_URL || '').trim() ||
    !String(c.MEETING_PROVIDER_API_KEY || '').trim()
  );
}

// 获取环境配置，如果可能的话从 storage 获取，否则从 process.env 获取
export async function getEnvConfig(): Promise<EnvConfigType> {
  const storageApi =
    typeof chrome !== 'undefined' ? chrome.storage?.local : undefined;
  let fromStorage: EnvConfigType | null = null;
  if (storageApi) {
    try {
      const { envConfig } = await storageApi.get(['envConfig']);
      if (envConfig) {
        fromStorage = normalizeEnvConfigShape(envConfig);
      }
    } catch (error) {
      console.error('获取配置失败:', error);
    }
  }

  // Offscreen 等上下文常能读到 storage 但 env 为空/缺项；只在这种情况下再问 SW（避免热路径多一次消息）
  let fromBg: EnvConfigType | null = null;
  if (!fromStorage || isMissingMeetingProvider(fromStorage)) {
    fromBg = await getEnvConfigViaBackground();
  }

  if (fromStorage && !isMissingMeetingProvider(fromStorage)) {
    return fromStorage;
  }
  if (fromBg && !isMissingMeetingProvider(fromBg)) {
    return fromBg;
  }
  if (fromBg) {
    return fromBg;
  }
  if (fromStorage) {
    return fromStorage;
  }

  return normalizeEnvConfigShape(defaultEnvConfig);
}

export function getDefaultEnvConfig(): EnvConfigType {
  return normalizeEnvConfigShape(defaultEnvConfig);
}

export async function getUserInfo() {
  const { userinfo } = await chrome.storage.local.get(['userinfo']);
  return userinfo;
}

/**
 * 解析 ChromaDB 连接参数，支持新旧配置格式的兼容
 */
export function parseChromaConfig(config: EnvConfigType) {
  // 如果有新的 host 配置，直接使用
  if (config.CHROMA_HOST && config.CHROMA_HOST !== 'localhost') {
    return {
      host: config.CHROMA_HOST,
      port: config.CHROMA_PORT,
      ssl: config.CHROMA_SSL,
    };
  }

  // 如果没有配置新的 host，尝试从旧的 CHROMA_API_URL 解析
  if (config.CHROMA_API_URL) {
    try {
      const url = new URL(config.CHROMA_API_URL);
      return {
        host: url.hostname,
        port: url.port
          ? parseInt(url.port)
          : url.protocol === 'https:'
          ? 443
          : 8000,
        ssl: url.protocol === 'https:',
      };
    } catch (error) {
      console.warn('解析 CHROMA_API_URL 失败:', error);
      // 回退到默认值
      return {
        host: 'localhost',
        port: config.CHROMA_PORT || 8000,
        ssl: false,
      };
    }
  }

  // 都没有配置，使用默认值
  return {
    host: config.CHROMA_HOST || 'localhost',
    port: config.CHROMA_PORT || 8000,
    ssl: config.CHROMA_SSL || false,
  };
}
