export interface PendingLinkedActionConfig {
  sender?: string;
  groupId?: string;
  groupName?: string;
  content?: string;
  messageId?: string;
  messageTimestamp?: string | number;
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
  fallback?: boolean;
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

export interface LinkedActionTriggerContextItem {
  label: string;
  value: string;
}

export interface LinkedActionSaveReceiptInput {
  context?: PendingLinkedActionConfig | null;
  openClawConfigured: boolean;
  requiresApproval: boolean;
}

export type LinkedActionExecutionPreviewTone = 'pending' | 'review' | 'auto';

export interface LinkedActionExecutionPreviewInput {
  context?: PendingLinkedActionConfig | null;
  openClawConfigured: boolean;
  requiresApproval: boolean;
}

export interface LinkedActionExecutionPreview {
  tone: LinkedActionExecutionPreviewTone;
  label: string;
  headline: string;
  contextLine: string;
  items: string[];
}

export type LinkedActionPreviewReceiptTone = 'ready' | 'warning';

export interface LinkedActionPreviewReceiptInput {
  context?: PendingLinkedActionConfig | null;
  canPlan: boolean;
  skippedReason?: string;
  actionFamily?: string;
  actions?: Array<{
    actionType?: string;
    title?: string;
    targetSystem?: string;
    executionMode?: string;
    requiresApproval?: boolean;
  }>;
  warnings?: Array<{
    code?: string;
    severity?: 'info' | 'warning' | 'critical' | string;
    message?: string;
  }>;
  suggestedPrompt?: string;
  requiresApproval?: boolean;
}

export interface LinkedActionPreviewReceipt {
  tone: LinkedActionPreviewReceiptTone;
  title: string;
  summary: string;
  items: string[];
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
  {
    sampleId: 'openclaw-general-delegation',
    actionFamily: 'openclaw_delegation',
    targetSystem: 'OpenClaw',
    canSchedule: false,
    fallback: true,
    examplePrompt:
      '根据当前消息整理一条最小可执行的 OpenClaw 委派：先确认目标系统、对象、动作、所需权限和成功回执；如果缺少关键字段、账号授权或执行能力，就停止并返回 need_human_decision / capability_missing，而不是自动猜测。',
    matchKeywords: [],
  },
  {
    sampleId: 'openclaw-file-delegation',
    actionFamily: 'openclaw_delegation',
    targetSystem: 'OpenClaw / Google Drive',
    canSchedule: false,
    examplePrompt:
      '把当前消息里的附件或视频按要求下载、重命名并上传到指定目标；完成后在执行结果里返回可访问链接。如果缺少附件链接、权限或目标目录访问能力，就停止并报告具体 blocker。',
    matchKeywords: ['附件', '视频', '文件', '下载', '上传', 'drive', 'link'],
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

export function buildLinkedActionSaveReceipt(
  input: LinkedActionSaveReceiptInput,
): string {
  const contextLine = input.context
    ? getLinkedActionContextLine(input.context)
    : '这条联动操作规则';
  const executionBoundary = input.openClawConfigured
    ? input.requiresApproval
      ? '后续新消息命中后才会生成需批准的 RuntimeAction，外部写操作前仍要你批准。'
      : '后续新消息命中后才会生成 RuntimeAction，并按免批准设置执行可执行动作。'
    : 'OpenClaw 未连接，已先保存为待激活；连接前不会执行外部写操作。';

  return [
    `已保存联动操作草稿：${contextLine}。`,
    '当前没有回扫历史消息、没有创建 RuntimeAction，也没有调用 OpenClaw。',
    executionBoundary,
  ].join('');
}

export function buildLinkedActionExecutionPreview(
  input: LinkedActionExecutionPreviewInput,
): LinkedActionExecutionPreview {
  const contextLine = input.context
    ? getLinkedActionContextLine(input.context)
    : '这条联动操作规则';
  const saveBoundary =
    '保存只写本机手动规则；不会回扫历史消息、不会立即创建 RuntimeAction，也不会立刻调用 OpenClaw。';

  if (!input.openClawConfigured) {
    return {
      tone: 'pending',
      label: '待激活',
      headline: '保存后：待激活动作计划',
      contextLine,
      items: [
        saveBoundary,
        '后续新消息命中后可形成待激活动作计划；连接 OpenClaw 前不会执行外部写操作。',
        '恢复路径：先连接 OpenClaw，再到 Action Queue 核对目标系统、对象、权限和执行结果。',
      ],
    };
  }

  if (input.requiresApproval) {
    return {
      tone: 'review',
      label: '需批准',
      headline: '保存后：命中进入批准队列',
      contextLine,
      items: [
        saveBoundary,
        '后续新消息命中后才会生成需批准的 RuntimeAction。',
        '外部写操作前仍要你在 Action Queue 批准；拒绝或取消不会改动原消息。',
      ],
    };
  }

  return {
    tone: 'auto',
    label: '自动执行',
    headline: '保存后：命中可自动执行',
    contextLine,
    items: [
      saveBoundary,
      '后续新消息命中后可生成 RuntimeAction，并按免批准设置执行可执行动作。',
      '建议只用于窄范围、低风险动作；执行结果仍回到 Action Queue 审计。',
    ],
  };
}

export function buildLinkedActionPreviewReceipt(
  input: LinkedActionPreviewReceiptInput,
): LinkedActionPreviewReceipt {
  const actions = input.actions || [];
  const warnings = input.warnings || [];
  const actionCount = actions.length;
  const warningCount = warnings.length;
  const hasBlockingWarning = warnings.some((warning) =>
    ['warning', 'critical'].includes(String(warning.severity || '')),
  );
  const actionFamily = input.actionFamily || 'unknown';
  const contextLine = input.context
    ? getLinkedActionContextLine(input.context)
    : '当前预演样本';
  const executionLane = input.requiresApproval
    ? 'Action Queue 批准'
    : '免批准设置';
  const tone: LinkedActionPreviewReceiptTone =
    input.canPlan && !hasBlockingWarning ? 'ready' : 'warning';
  const summary = input.canPlan
    ? `dry-run 可规划 ${actionCount} 个候选动作；动作族 ${actionFamily}。`
    : `dry-run 暂不能稳定规划；原因 ${input.skippedReason || '需要改写动作描述'}。`;

  const items = [
    `样本：${contextLine}`,
    `结果：${input.canPlan ? `候选动作 ${actionCount} 个` : '未生成候选动作'}，警告 ${warningCount} 条`,
    '边界：这次只是 Memory Service dry-run；不会保存规则、不会创建 RuntimeAction、不会调用 OpenClaw、不会发送消息，也不会写外部系统。',
    input.canPlan
      ? `下一步：保存后仍要等后续新消息命中；执行路径继续按 ${executionLane} 和 OpenClaw 连接状态处理。`
      : '下一步：先应用建议文案或手动补足目标系统、对象、权限和成功回执。',
  ];

  if (input.suggestedPrompt) {
    items.push('改写建议：可先应用建议文案，不会自动覆盖当前输入。');
  }

  return {
    tone,
    title: '预演结果回执',
    summary,
    items,
  };
}

export function parseLinkedActionMessageTimestamp(
  value?: string | number,
): Date | null {
  if (typeof value === 'number') {
    const epochMs = value < 100000000000 ? value * 1000 : value;
    const date = new Date(epochMs);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value.trim());
    if (Number.isFinite(parsed)) {
      return new Date(parsed);
    }

    const numeric = Number(value.trim());
    if (Number.isFinite(numeric)) {
      return parseLinkedActionMessageTimestamp(numeric);
    }
  }

  return null;
}

export function getLinkedActionTriggerContextItems(
  context: PendingLinkedActionConfig,
  options: { formatDate?: (date: Date) => string } = {},
): LinkedActionTriggerContextItem[] {
  const items: LinkedActionTriggerContextItem[] = [];
  if (context.groupName?.trim()) {
    items.push({ label: '会话', value: context.groupName.trim() });
  }
  if (context.sender?.trim()) {
    items.push({ label: '发送人', value: context.sender.trim() });
  }

  const originalTime = parseLinkedActionMessageTimestamp(
    context.messageTimestamp,
  );
  if (originalTime) {
    items.push({
      label: '原消息时间',
      value: options.formatDate
        ? options.formatDate(originalTime)
        : originalTime.toLocaleString(),
    });
  }

  if (context.messageId?.trim()) {
    items.push({ label: '消息 ID', value: context.messageId.trim() });
  }

  return items;
}

export const getFallbackLinkedActionPrompt = (
  context: PendingLinkedActionConfig,
  configSignals?: LinkedActionConfigSignals,
) =>
  [
    '参考当前消息整理一条可执行的联动操作；优先提取消息里的对象、时间和目标系统，必要时附上原消息链接。',
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
    0,
  );
};

export function selectLinkedActionSampleForMessage(
  samples: LinkedActionSample[],
  messageContent: string,
): LinkedActionSample {
  const scoredSamples = samples
    .map((sample, index) => ({
      sample,
      index,
      score: scoreSampleForMessage(sample, messageContent),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.index - right.index;
    });

  const matchedSample = scoredSamples.find((item) => item.score > 0)?.sample;
  if (matchedSample) {
    return matchedSample;
  }

  return (
    samples.find((sample) => sample.fallback) ||
    samples.find(
      (sample) => sample.sampleId === 'openclaw-general-delegation',
    ) ||
    samples[0]
  );
}

export const buildHistoryLinkedActionSuggestion = (
  topic: LinkedActionHistoryEntry,
  context: PendingLinkedActionConfig,
  configSignals: LinkedActionConfigSignals,
) => {
  const existingPrompt = topic.automationPrompt?.trim() || '';
  return [
    existingPrompt,
    '请把上面的联动操作风格应用到当前触发消息；优先提取消息里的对象、时间和目标系统，再决定是否执行外部写入。',
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
  const { generateLinkedActionSuggestionText } = await import('../llm');
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
  const matchedSample = selectLinkedActionSampleForMessage(
    LINKED_ACTION_SAMPLE_CATALOG,
    messageContent,
  );

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
