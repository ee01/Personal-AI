import { generateLinkedActionSuggestionText } from '../llm';

export interface PendingLinkedActionConfig {
  sender?: string;
  groupId?: string;
  groupName?: string;
  content?: string;
  messageId?: string;
  timestamp?: string | number;
  messageLink?: string;
}

export interface LinkedActionSample {
  sampleId: string;
  actionFamily: string;
  targetSystem: string;
  canSchedule: boolean;
  examplePrompt: string;
  matchKeywords: string[];
}

export interface LinkedActionSuggestionResult {
  prompt: string;
  sourceType: 'history' | 'sample';
  sourceLabel: string;
  sampleId?: string;
}

export interface LinkedActionConfigSignals {
  openClawEnabled: boolean;
  jiraConfigured: boolean;
  memoryServiceAvailable: boolean;
}

export interface LinkedActionHistoryEntry {
  text: string;
  automationPrompt?: string;
}

export interface LinkedActionDraftPrefill {
  topicText: string;
  filterSender: string;
  filterGroup: string;
  notifyMethod: string;
  mentionMe: boolean;
  autoReply: boolean;
  followThread: boolean;
  digestEnabled: boolean;
}

export const LINKED_ACTION_SAMPLE_CATALOG: LinkedActionSample[] = [
  {
    sampleId: 'forward-message',
    actionFamily: 'forward_message',
    targetSystem: 'RingCentral',
    canSchedule: false,
    examplePrompt:
      '把当前消息整理成一句简短摘要并转发给指定同事；如果消息里已经点名负责人，优先转发给那个人，并附上原消息链接。',
    matchKeywords: ['转发', '同步', '告知', 'follow up', 'forward'],
  },
  {
    sampleId: 'jira-comment',
    actionFamily: 'jira_comment',
    targetSystem: 'Jira',
    canSchedule: false,
    examplePrompt:
      '从当前消息中识别 Jira / ticket 编号，把关键信息整理成 comment 追加到对应工单；若没有识别到工单编号，就先不要执行。',
    matchKeywords: ['jira', 'ticket', 'bug', '工单', 'story'],
  },
  {
    sampleId: 'spreadsheet-write',
    actionFamily: 'spreadsheet_write',
    targetSystem: 'Google Sheets',
    canSchedule: false,
    examplePrompt:
      '从当前消息提取日期、负责人和状态，写入指定表格的新一行；字段缺失时保留空列，并附上原消息链接。',
    matchKeywords: ['sheet', '表格', 'spreadsheet', '记录', '更新表'],
  },
  {
    sampleId: 'glip-status',
    actionFamily: 'glip_status',
    targetSystem: 'Glip',
    canSchedule: true,
    examplePrompt:
      '根据当前消息里的开会、外出、忙碌或专注状态，更新我的 Glip status，并写入合适的状态文案和结束时间。',
    matchKeywords: ['status', '外出', '开会', '忙碌', 'busy', 'focus'],
  },
  {
    sampleId: 'schedule-reminder',
    actionFamily: 'schedule_reminder',
    targetSystem: 'Calendar / Reminder',
    canSchedule: true,
    examplePrompt:
      '从当前消息提取时间和行动项，创建日程或提醒；如果时间不明确，就先生成一条待确认提醒而不是立即执行。',
    matchKeywords: ['提醒', 'remind', 'schedule', 'meeting', '明天', '下周'],
  },
];

export const normalizeLinkedActionSnippet = (value?: string) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

export const buildLinkedActionRuleText = (value?: string) => {
  const snippet = normalizeLinkedActionSnippet(value);
  return snippet
    ? `发送了内容与以下语义相似：${snippet}`
    : '发送了内容与以下语义相似的消息';
};

export function buildLinkedActionDraftPrefill(
  config: PendingLinkedActionConfig,
): LinkedActionDraftPrefill {
  return {
    topicText: buildLinkedActionRuleText(config.content),
    filterSender: config.sender || '',
    filterGroup: config.groupName || '',
    notifyMethod: '',
    mentionMe: false,
    autoReply: false,
    followThread: false,
    digestEnabled: false,
  };
}

export function isPendingLinkedActionConfigFresh(
  config: PendingLinkedActionConfig & { timestamp?: string | number },
  nowMs = Date.now(),
  maxAgeMs = 5 * 60 * 1000,
): boolean {
  const timestamp =
    typeof config.timestamp === 'number'
      ? config.timestamp
      : Number(config.timestamp);

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return true;
  }

  return nowMs - timestamp < maxAgeMs;
}

export function shouldAutoRequestLinkedActionSuggestion(input: {
  showAddForm: boolean;
  newRuleSource: 'manual' | 'autoReply' | 'followThread' | 'linkedAction';
  linkedActionSuggestionStatus: 'idle' | 'loading' | 'ready' | 'failed';
  newAutomationPrompt: string;
}): boolean {
  return (
    input.showAddForm &&
    input.newRuleSource === 'linkedAction' &&
    input.linkedActionSuggestionStatus === 'idle' &&
    !input.newAutomationPrompt.trim()
  );
}

function buildLinkedActionConfigSignalLine(
  configSignals: LinkedActionConfigSignals,
): string {
  return `当前配置状态：OpenClaw=${configSignals.openClawEnabled ? 'enabled' : 'disabled'}；Jira=${configSignals.jiraConfigured ? 'configured' : 'unconfigured'}；MemoryService=${configSignals.memoryServiceAvailable ? 'available' : 'unavailable'}`;
}

export const getLinkedActionContextLine = (
  context: PendingLinkedActionConfig,
) => {
  const parts = [context.groupName, context.sender].filter(Boolean);
  const scope =
    parts.length > 0 ? `来自 ${parts.join(' / ')} 的消息` : '来自当前消息';
  const snippet = normalizeLinkedActionSnippet(context.content);
  return snippet ? `${scope}：${snippet}` : scope;
};

export const getFallbackLinkedActionPrompt = (
  context: PendingLinkedActionConfig,
  configSignals?: LinkedActionConfigSignals,
) =>
  [
    '参考当前消息整理一条可执行的关联操作；优先提取消息里的对象、时间和目标系统，必要时附上原消息链接。',
    getLinkedActionContextLine(context),
    configSignals ? buildLinkedActionConfigSignalLine(configSignals) : '',
  ]
    .filter(Boolean)
    .join('\n\n');

export const scoreSampleForMessage = (
  sample: LinkedActionSample,
  messageContent: string,
) => {
  const normalizedContent = messageContent.toLowerCase();
  return sample.matchKeywords.reduce(
    (score, keyword) => {
      return normalizedContent.includes(keyword.toLowerCase())
        ? score + 2
        : score;
    },
    sample.canSchedule ? 1 : 0,
  );
};

export const buildHistoryLinkedActionSuggestion = (
  topic: LinkedActionHistoryEntry,
  context: PendingLinkedActionConfig,
  configSignals: LinkedActionConfigSignals,
) => {
  const existingPrompt = topic.automationPrompt?.trim() || '';
  return [
    existingPrompt,
    '请把上面的关联操作风格应用到当前触发消息；优先提取消息里的对象、时间和目标系统，再决定是否执行外部写入。',
    getLinkedActionContextLine(context),
    buildLinkedActionConfigSignalLine(configSignals),
  ].join('\n\n');
};

export const buildSampleLinkedActionSuggestion = (
  sample: LinkedActionSample,
  context: PendingLinkedActionConfig,
  configSignals: LinkedActionConfigSignals,
) => {
  return [
    sample.examplePrompt,
    getLinkedActionContextLine(context),
    buildLinkedActionConfigSignalLine(configSignals),
  ].join('\n\n');
};

export async function generateLinkedActionSuggestion(params: {
  context: PendingLinkedActionConfig;
  historyTopics: LinkedActionHistoryEntry[];
  configSignals: LinkedActionConfigSignals;
}): Promise<LinkedActionSuggestionResult> {
  const bestHistoryTopic = params.historyTopics[0];
  if (bestHistoryTopic?.automationPrompt?.trim()) {
    return {
      prompt: await generateLinkedActionSuggestionText({
        seedPrompt: buildHistoryLinkedActionSuggestion(
          bestHistoryTopic,
          params.context,
          params.configSignals,
        ),
        sourceType: 'history',
        sourceLabel: `已保存规则：${bestHistoryTopic.text}`,
        contextLine: getLinkedActionContextLine(params.context),
        configSignalLine: buildLinkedActionConfigSignalLine(
          params.configSignals,
        ),
      }),
      sourceType: 'history',
      sourceLabel: `已保存规则：${bestHistoryTopic.text}`,
    };
  }

  const messageContent = String(params.context.content || '');
  const matchedSample = [...LINKED_ACTION_SAMPLE_CATALOG].sort(
    (left, right) =>
      scoreSampleForMessage(right, messageContent) -
      scoreSampleForMessage(left, messageContent),
  )[0];

  return {
    prompt: await generateLinkedActionSuggestionText({
      seedPrompt: buildSampleLinkedActionSuggestion(
        matchedSample,
        params.context,
        params.configSignals,
      ),
      sourceType: 'sample',
      sourceLabel: `${matchedSample.targetSystem} / ${matchedSample.actionFamily}`,
      contextLine: getLinkedActionContextLine(params.context),
      configSignalLine: buildLinkedActionConfigSignalLine(
        params.configSignals,
      ),
    }),
    sourceType: 'sample',
    sourceLabel: `${matchedSample.targetSystem} / ${matchedSample.actionFamily}`,
    sampleId: matchedSample.sampleId,
  };
}
