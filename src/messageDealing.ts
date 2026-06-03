import { callLLMJsonAPI } from './llm';
import {
  EnvConfigType,
  getEnvConfig,
  normalizeBotPushTarget,
  showToast,
} from './utils';
import { extractEntitiesFromMessage } from './services/entityExtraction';
import { processNewMessage } from './agentWorkflow';
import { IntelligentAgent } from './agentThinking';
import { MessageAnalysisResult } from './types';
import {
  getMemoryServiceClient,
  type MessageRuleAutomationPlanRequest,
} from './services/MemoryServiceClient';
import {
  getTaskEnabled,
  onTaskEnabledChanged,
} from './services/taskSchedulerDefinitions';
import {
  handleAutoReplyRules,
  TopicItemWithAutoReply,
  formatAutoReplyTime,
} from './message-reaction';
import {
  updateRelatedMessages,
  storeRelatedMessage,
} from './message-reaction/FollowThreadHandler';
import { RelatedMessageMeta } from './types/followThread';
import {
  notificationService,
  NotificationData,
  hasNotifyMethod,
} from './services/NotificationService';
import { buildMessageFilterSystemPrompt } from './prompts';
import { enqueueConcernedItemDigest } from './services/DigestQueueService';
import {
  getDigestDeliveryItems,
  getImmediateNotificationItem,
  shouldQueueRuleDigest,
} from './messageAnalysisDelivery';
import {
  extractRuleIdsFromMatchedRule,
  filterWatchRulesForMessageContext,
  filterWatchRulesForMessageGroups,
  getManualItemsFromMatchedRules,
  isManualConcernedItem,
  loadRuntimeWatchRules,
  resolveMatchedWatchRules,
  type WatchRule,
} from './watchRules';

type PushTargetConfigKey =
  | 'MESSAGE_ANALYSIS_PUSH_TARGET'
  | 'FOLLOW_UP_PUSH_TARGET'
  | 'DREAM_INSIGHT_PUSH_TARGET'
  | 'WEEKLY_REPORT_PUSH_TARGET'
  | 'DECISION_CENTER_PUSH_TARGET';

type PushGroupConfigKey =
  | 'MESSAGE_ANALYSIS_PUSH_GROUP_ID'
  | 'FOLLOW_UP_PUSH_GROUP_ID'
  | 'DREAM_INSIGHT_PUSH_GROUP_ID'
  | 'WEEKLY_REPORT_PUSH_GROUP_ID'
  | 'DECISION_CENTER_PUSH_GROUP_ID';

const ANALYSIS_EXCLUDED_PUSH_GROUP_CONFIGS: Array<{
  label: string;
  targetKey: PushTargetConfigKey;
  groupKey: PushGroupConfigKey;
  allowNone?: boolean;
}> = [
  {
    label: '消息分析推送',
    targetKey: 'MESSAGE_ANALYSIS_PUSH_TARGET',
    groupKey: 'MESSAGE_ANALYSIS_PUSH_GROUP_ID',
  },
  {
    label: '关注后续推送',
    targetKey: 'FOLLOW_UP_PUSH_TARGET',
    groupKey: 'FOLLOW_UP_PUSH_GROUP_ID',
  },
  {
    label: '决策中心推送',
    targetKey: 'DECISION_CENTER_PUSH_TARGET',
    groupKey: 'DECISION_CENTER_PUSH_GROUP_ID',
  },
  {
    label: '梦境重放报表推送',
    targetKey: 'DREAM_INSIGHT_PUSH_TARGET',
    groupKey: 'DREAM_INSIGHT_PUSH_GROUP_ID',
    allowNone: true,
  },
  {
    label: '周报推送',
    targetKey: 'WEEKLY_REPORT_PUSH_TARGET',
    groupKey: 'WEEKLY_REPORT_PUSH_GROUP_ID',
    allowNone: true,
  },
];

function getExcludedPushGroupIds(envConfig: EnvConfigType): string[] {
  const excludedGroupIds = new Set<string>();
  const configuredPushGroups: string[] = [];

  for (const rule of ANALYSIS_EXCLUDED_PUSH_GROUP_CONFIGS) {
    const targetMode = normalizeBotPushTarget(
      envConfig[rule.targetKey],
      Boolean(rule.allowNone),
      'me',
    );
    const groupId = String(envConfig[rule.groupKey] || '').trim();

    if (targetMode === 'group' && groupId) {
      excludedGroupIds.add(groupId);
      configuredPushGroups.push(`${rule.label}:${groupId}`);
    }
  }

  if (configuredPushGroups.length > 0) {
    console.log(
      '检测到以下推送群组，将在消息分析时自动跳过以避免重复推送:',
      configuredPushGroups,
    );
  }

  return Array.from(excludedGroupIds);
}

type MessageRuleAutomationMessage =
  MessageRuleAutomationPlanRequest['message'];
type MessageRuleAutomationEvent = NonNullable<
  MessageRuleAutomationMessage['event']
>;

function getLocalTimeZone(): string | undefined {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof timezone === 'string' && timezone.trim().length > 0
      ? timezone.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

function extractEventPayload(sourcePost: any): MessageRuleAutomationEvent | undefined {
  const event = sourcePost?.event;
  if (!event || typeof event !== 'object') {
    return undefined;
  }

  const normalized: MessageRuleAutomationEvent = {};
  if (typeof event.title === 'string' && event.title.trim()) {
    normalized.title = event.title.trim();
  }
  if (typeof event.start === 'string' && event.start.trim()) {
    normalized.start = event.start.trim();
  }
  if (typeof event.end === 'string' && event.end.trim()) {
    normalized.end = event.end.trim();
  }
  if (typeof event.timeRange === 'string' && event.timeRange.trim()) {
    normalized.timeRange = event.timeRange.trim();
  }
  if (typeof event.location === 'string' && event.location.trim()) {
    normalized.location = event.location.trim();
  }
  if (typeof event.startAtMs === 'number' && Number.isFinite(event.startAtMs)) {
    normalized.startAtMs = event.startAtMs;
  }
  if (typeof event.endAtMs === 'number' && Number.isFinite(event.endAtMs)) {
    normalized.endAtMs = event.endAtMs;
  }
  if (event.allDay === true) {
    normalized.allDay = true;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeHttpUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : '';
  } catch {
    return '';
  }
}

function buildRingCentralMessageUrl(groupId: unknown, postId: unknown): string {
  const normalizedGroupId = String(groupId || '').trim();
  const normalizedPostId = String(postId || '').trim();
  if (!normalizedGroupId) {
    return '';
  }

  return normalizedPostId
    ? `https://app.ringcentral.com/messages/${encodeURIComponent(normalizedGroupId)}/${encodeURIComponent(normalizedPostId)}`
    : `https://app.ringcentral.com/messages/${encodeURIComponent(normalizedGroupId)}`;
}

function normalizeAutomationAttachment(
  attachment: any,
): NonNullable<MessageRuleAutomationMessage['attachments']>[number] | null {
  if (!attachment || typeof attachment !== 'object') {
    return null;
  }

  const normalized: NonNullable<MessageRuleAutomationMessage['attachments']>[number] =
    {};
  const id = attachment.id ?? attachment.fileId ?? attachment.file_id;
  if (id !== null && id !== undefined && id !== '') {
    normalized.id = id;
  }
  for (const key of ['name', 'type', 'mimeType', 'category'] as const) {
    if (typeof attachment[key] === 'string' && attachment[key].trim()) {
      normalized[key] = attachment[key].trim();
    }
  }
  if (typeof attachment.mime_type === 'string' && attachment.mime_type.trim()) {
    normalized.mimeType = attachment.mime_type.trim();
  }
  const size = Number(attachment.size ?? attachment.__size);
  if (Number.isFinite(size)) {
    normalized.size = size;
  }
  for (const key of [
    'sourceUrl',
    'messageUrl',
    'downloadUrl',
    'previewUrl',
  ] as const) {
    const url =
      normalizeHttpUrl(attachment[key]) ||
      normalizeHttpUrl(attachment[key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)]);
    if (url) {
      normalized[key] = url;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function extractAutomationAttachments(
  ...sources: any[]
): MessageRuleAutomationMessage['attachments'] {
  const attachments: NonNullable<MessageRuleAutomationMessage['attachments']> = [];
  const seen = new Set<string>();

  for (const source of sources) {
    const sourceAttachments = Array.isArray(source?.attachments)
      ? source.attachments
      : [];
    for (const attachment of sourceAttachments) {
      const normalized = normalizeAutomationAttachment(attachment);
      if (!normalized) continue;
      const dedupeKey = String(
        normalized.id ||
          normalized.sourceUrl ||
          normalized.messageUrl ||
          normalized.downloadUrl ||
          normalized.name ||
          '',
      );
      if (dedupeKey && seen.has(dedupeKey)) continue;
      if (dedupeKey) seen.add(dedupeKey);
      attachments.push(normalized);
    }
  }

  return attachments.length > 0 ? attachments : undefined;
}

function mergeMatchedRuleIds(...sources: Array<number[] | undefined>): number[] {
  return Array.from(
    new Set(
      sources
        .flatMap((source) => source || [])
        .filter((id) => Number.isInteger(id) && id >= 0),
    ),
  );
}

function addSourcePostToIndex(index: Map<string, any>, post: any) {
  if (!post) return;
  const sourcePost = post?.raw ?? post;
  const postId = String(
    post?.post_id ??
      post?.id ??
      post?.raw?.post_id ??
      post?.raw?.id ??
      sourcePost?.post_id ??
      sourcePost?.id ??
      '',
  ).trim();
  if (!postId) return;
  index.set(postId, sourcePost);
}

function addMessageGroupToSourcePostIndex(index: Map<string, any>, group: any) {
  for (const post of group?.posts || []) {
    addSourcePostToIndex(index, post);
  }
  for (const post of group?.standalone || []) {
    addSourcePostToIndex(index, post);
  }
  for (const thread of group?.threads || []) {
    addSourcePostToIndex(index, thread?.rootPost);
    for (const reply of thread?.replies || []) {
      addSourcePostToIndex(index, reply);
    }
  }
}

function buildSourcePostIndex(messageGroups: any[]): Map<string, any> {
  const index = new Map<string, any>();
  for (const group of messageGroups || []) {
    addMessageGroupToSourcePostIndex(index, group);
  }
  return index;
}

function addPostTimeCandidates(candidates: unknown[], post: any) {
  if (!post) return;
  const sourcePost = post?.raw ?? post;
  candidates.push(
    post?.time,
    post?.datetime,
    post?.timestamp,
    post?.createdAt,
    sourcePost?.time,
    sourcePost?.datetime,
    sourcePost?.timestamp,
    sourcePost?.createdAt,
  );
}

function getMessageGroupRuleContext(group: any) {
  const timestamps: unknown[] = [];
  for (const post of group?.posts || []) {
    addPostTimeCandidates(timestamps, post);
  }
  for (const post of group?.standalone || []) {
    addPostTimeCandidates(timestamps, post);
  }
  for (const thread of group?.threads || []) {
    addPostTimeCandidates(timestamps, thread?.rootPost);
    for (const reply of thread?.replies || []) {
      addPostTimeCandidates(timestamps, reply);
    }
  }

  return {
    groupId: group?.groupId,
    groupName: group?.groupName,
    timestamps,
  };
}

function normalizeAgentWorkflowPost(post: any) {
  if (!post) return null;
  const sourcePost = post?.raw ?? post;
  const id = String(
    post?.id ??
      post?.post_id ??
      post?.postId ??
      sourcePost?.id ??
      sourcePost?.post_id ??
      sourcePost?.postId ??
      '',
  ).trim();
  const creator =
    post?.creator ??
    post?.sender ??
    sourcePost?.creator ??
    sourcePost?.sender ??
    '';
  const time =
    post?.time ??
    post?.datetime ??
    sourcePost?.time ??
    sourcePost?.datetime ??
    '';
  const text =
    post?.text ??
    post?.content ??
    sourcePost?.text ??
    sourcePost?.content ??
    '';
  const attachments = Array.isArray(post?.attachments)
    ? post.attachments
    : Array.isArray(sourcePost?.attachments)
      ? sourcePost.attachments
      : [];

  return {
    id,
    creator,
    time,
    text,
    attachments,
    raw: sourcePost,
  };
}

function getAgentWorkflowPostsForGroup(group: any) {
  const posts: Array<{
    id: string;
    creator: string;
    time: string;
    text: string;
    attachments?: any[];
    raw: any;
  }> = [];
  const seen = new Set<string>();
  const add = (post: any) => {
    const normalized = normalizeAgentWorkflowPost(post);
    if (!normalized) return;
    const dedupeKey =
      normalized.id ||
      [normalized.creator, normalized.time, normalized.text].join('\n');
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    posts.push(normalized);
  };

  for (const post of group?.posts || []) {
    add(post);
  }
  for (const post of group?.standalone || []) {
    add(post);
  }
  for (const thread of group?.threads || []) {
    add(thread?.rootPost);
    for (const reply of thread?.replies || []) {
      add(reply);
    }
  }

  return posts;
}

function parseMessageTimestamp(value: unknown): number {
  const timestamp = new Date(String(value || '')).getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function normalizeIdentityValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replace(/\s+/g, ' ').trim().toLowerCase();
}

function getThreadRootPostId(post: any): string {
  return String(
    post?.threadRootPostId || post?.rootPostId || post?.parentId || post?.id || '',
  );
}

function getOwnerSpeechPosts(messageGroups: any[], username?: string) {
  const normalizedUsername = normalizeIdentityValue(username);
  return (messageGroups || []).flatMap((group) =>
    getAgentWorkflowPostsForGroup(group)
      .filter(
        (post: any) =>
          post?.raw?.authorRole === 'owner' ||
          post?.raw?.isSelf === true ||
          (normalizedUsername &&
            normalizeIdentityValue(post?.creator || post?.raw?.sender) ===
              normalizedUsername),
      )
      .map((post: any) => ({
        group,
        post,
      })),
  );
}

async function ingestOwnerSpeechForLearning(
  messageGroups: any[],
  envConfig: EnvConfigType,
  username?: string,
) {
  if (envConfig.OWNER_SPEECH_LEARNING_ENABLED === false) {
    return;
  }

  const ownerPosts = getOwnerSpeechPosts(messageGroups, username).filter(
    ({ post }) => Boolean(String(post?.text || post?.content || '').trim()),
  );
  if (ownerPosts.length === 0) {
    return;
  }

  try {
    const client = getMemoryServiceClient();
    await client.ingestBatch(
      ownerPosts.map(({ group, post }) => {
        const content = String(post.text || post.content || '').trim();
        const sourcePost = post.raw ?? post;
        const postId = String(
          post.id || sourcePost.postId || sourcePost.post_id || '',
        );
        const groupId = String(sourcePost.groupId || group.groupId || '');
        const threadRootPostId = getThreadRootPostId(sourcePost) || post.id;

        return {
          content,
          sourceType: 'glip' as const,
          sender: post.creator || post.sender || 'owner',
          groupId,
          groupName: sourcePost.groupName || group.groupName || '',
          timestamp: parseMessageTimestamp(post.time || post.datetime),
          metadata: {
            authorRole: 'owner',
            isSelf: true,
            learningPurposes: ['owner_speech_style', 'input_suggestion'],
            postId,
            groupId,
            threadRootPostId,
            parentId: sourcePost.parentId,
            creatorId: sourcePost.creatorId,
            creatorUsername: sourcePost.creatorUsername,
            captureReason: 'owner_speech_learning',
          },
        };
      }),
    );
    console.log(`✅ 已捕获 ${ownerPosts.length} 条 owner 发言用于输入建议学习`);
  } catch (error) {
    console.warn('⚠️ owner 发言学习链路 ingest 失败:', error);
  }
}

async function queueMatchedRuleAutomations(params: {
  manualItems: TopicItemWithAutoReply[];
  matchedRule?: string;
  summary?: string;
  confidence?: number;
  pausedReason?: string;
  message: MessageRuleAutomationMessage;
}) {
  const automationItems = params.manualItems.filter((item) =>
    Boolean(item.automationPrompt?.trim()),
  );
  if (automationItems.length === 0) return;

  if (params.pausedReason) {
    console.log(
      `⏸️ 已暂停 ${automationItems.length} 条规则自动化: ${params.pausedReason}`,
      {
        postId: params.message.postId,
        matchedRule: params.matchedRule,
      },
    );
    return;
  }

  try {
    const client = getMemoryServiceClient();
    await Promise.all(
      automationItems.map(async (item) => {
        const response = await client.planMessageRuleAutomation({
          ruleRef: `manual:${item.id}`,
          ruleText: item.text,
          automationPrompt: item.automationPrompt!.trim(),
          requiresApproval: item.automationRequiresApproval === true,
          message: params.message,
          match: {
            matchedRule: params.matchedRule,
            summary: params.summary,
            confidence: params.confidence,
          },
        });
        if (response.skippedReason) {
          console.log(
            `⏭️ 跳过自动化规则 ${item.id}: ${response.skippedReason}`,
          );
          return;
        }
        console.log(
          `⚡ 已为规则 ${item.id} 创建 ${response.actions.length} 个 RuntimeAction`,
          response.detectedWindow,
        );
      }),
    );
  } catch (error) {
    console.warn('⚠️ 规则自动化规划失败:', error);
  }
}

async function queueMatchedRuleDigest(params: {
  item?: TopicItemWithAutoReply;
  matchedRule?: string;
  sender?: string;
  teamName?: string;
  teamId?: string;
  messageContent?: string;
  summary?: string;
  datetime?: string;
  postId?: string;
}): Promise<boolean> {
  if (!shouldQueueRuleDigest(params.item)) {
    return false;
  }

  await enqueueConcernedItemDigest({
    matchedRule: params.matchedRule || params.item.text || '',
    sender: params.sender || '',
    teamName: params.teamName || '',
    teamId: params.teamId || '',
    messageContent: params.messageContent || '',
    summary: params.summary || '',
    datetime: params.datetime || '',
    postId: params.postId,
    ruleId: params.item.id,
    digestConfig: params.item.digestConfig,
  });
  console.log('📥 消息已加入摘要队列（非即时推送）');
  return true;
}

async function queueMatchedRuleDigests(params: {
  items: TopicItemWithAutoReply[];
  matchedRule?: string;
  sender?: string;
  teamName?: string;
  teamId?: string;
  messageContent?: string;
  summary?: string;
  datetime?: string;
  postId?: string;
}): Promise<boolean> {
  const digestItems = getDigestDeliveryItems(params.items);
  if (digestItems.length === 0) {
    return false;
  }

  await Promise.all(
    digestItems.map((item) =>
      queueMatchedRuleDigest({
        ...params,
        item,
      }),
    ),
  );
  return true;
}

// 整理所有消息，发送给 LLM 分析，然后推送给 bot
export async function analyzeMessages(
  data: any[],
  username: string,
  isScheduledTask = false,
) {
  try {
    // 检查是否在 background script 环境中
    const serviceWorkerScope = (globalThis as any).ServiceWorkerGlobalScope;
    const isBackground =
      typeof serviceWorkerScope !== 'undefined' &&
      self instanceof serviceWorkerScope;
    if (isBackground) {
      // 在 background script 中直接调用处理函数
      const response = await analyzeMessagesInBackground(
        data,
        username,
        isScheduledTask,
      );
      return response;
    } else {
      // 在 content script 或其他环境中使用 message passing
      const response = await chrome.runtime.sendMessage({
        type: 'MESSAGE_DEALING',
        data: {
          body: {
            data,
            username,
            isScheduledTask,
          },
        },
      });

      // 检查响应格式 - 支持新的统一响应格式
      if (response && response.success) {
        console.log("LLM's response:", response, { data, isScheduledTask });
        // Todo: Toast 方法在 popup 中无法调用
        // showToast(response.message || 'Analysis complete', 'success');
        return response;
      } else {
        const error = new Error(response.message || 'Analysis failed');
        // showToast(error.message, 'error');
        throw error;
      }
    }
  } catch (error) {
    console.error('Error in sendMessageToLLM:', error);
    showToast(`Error: ${error.message}`, 'error');
  }
}

// 统一使用 background script 处理，防止跨域和权限问题
export async function analyzeMessagesInBackground(
  data: any[],
  username: string,
  isScheduledTask = false,
) {
  // 获取环境配置
  const envConfig = await getEnvConfig();
  const excludedPushGroupIds = new Set(getExcludedPushGroupIds(envConfig));

  // 检查是否定时任务被终止 - 使用辅助函数
  const messageAnalysisEnabled = await getTaskEnabled('message_analysis');
  if (!messageAnalysisEnabled && isScheduledTask) {
    console.log('定时分析任务已被终止，跳过处理');
    chrome.storage.local.remove('ollamaAnalysisProgress');
    return {
      success: false,
      message: '定时分析任务已被终止',
      data: [] as any[],
    };
  }

  // concernedItems 使用 TopicItemWithAutoReply 类型，notifyMethod 使用逗号分隔格式如 'bot,chrome'
  const concernedItems: TopicItemWithAutoReply[] = (
    await chrome.storage.local.get('concernedItems')
  ).concernedItems?.filter(isManualConcernedItem) || [
    {
      id: '1',
      text: 'recording 项目在 RCV mobile 中的相关信息，特别是 BE 依赖部分的完成情况',
      expiredAt: 0,
      notifyMethod: 'bot',
    },
    {
      id: '2',
      text: '聊到关于公司政策，也可以是政策相关的八卦消息',
      expiredAt: 0,
      notifyMethod: 'bot',
    },
    {
      id: '3',
      text: 'Sophia (Jinmei) Lin 发送的所有消息（只需要检查发送者是否完全匹配）',
      expiredAt: 0,
      notifyMethod: 'bot',
    },
    {
      id: '4',
      text: '任何明确 @我 的消息，或者提到我的名字的消息',
      expiredAt: 0,
      notifyMethod: 'bot',
    },
  ];
  const runtimeWatchRules = await loadRuntimeWatchRules(concernedItems);

  const skippedTypeCounts = data.reduce(
    (acc, item) => {
      const itemType = String(item?.type || 'unknown');
      if (itemType !== 'message') {
        acc[itemType] = (acc[itemType] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );
  if (Object.keys(skippedTypeCounts).length > 0) {
    console.log(
      '消息分析当前仅处理 type=message 的群组；以下顶层数据源已跳过:',
      skippedTypeCounts,
    );
  }

  const messageItems = data.filter((item) => item.type === 'message');
  await ingestOwnerSpeechForLearning(messageItems, envConfig, username);
  const excludedItems =
    excludedPushGroupIds.size === 0
      ? []
      : messageItems.filter((item) =>
          excludedPushGroupIds.has(String(item.groupId || '').trim()),
        );
  if (excludedItems.length > 0) {
    console.log(
      `已过滤 ${excludedItems.length} 个推送落地群组，避免 bot 回流消息被重复分析:`,
      excludedItems.map((item) => ({
        groupId: item.groupId,
        groupName: item.groupName,
      })),
    );
  }
  data =
    excludedPushGroupIds.size === 0
      ? messageItems
      : messageItems.filter(
          (item) =>
            !excludedPushGroupIds.has(String(item.groupId || '').trim()),
        );
  // 插入调试数据
  // data.unshift({
  //   groupName: 'Recording Test',
  //   groupId: '123',
  //   posts: [
  //     { id: '1231', creator: 'Ada', time: '2025-02-13 00:00:00', text: 'Share recording 的 backend 完成怎么样了？' },
  //     { id: '1232', creator: 'Sophia (Jinmei) Lin', time: '2025-02-13 00:00:00', text: 'Recording project BE dependencies completed' }
  //   ]
  // });
  // data.unshift({
  //   groupName: '大群',
  //   groupId: '2578219014',
  //   posts: [
  //     { id: '25782190141', creator: 'Colin Liu', time: '2025-02-14 00:00:00', text: '@Team 应要求，大家注意一下到公司时候的上下班时间，至少保持8个小时在公司的时间，无特殊情况不要中场离开，谢谢各位 。详细信息大家请翻看我之前发的消息' },
  //     { id: '25782190142', creator: 'Ruphi', time: '2025-02-14 00:01:00', text: '详细信息可以查看：MTR-128732' }
  //   ]
  // });
  // data.unshift({
  //   groupName: '小群',
  //   groupId: '321',
  //   posts: [
  //     { id: '3211', creator: 'Fred', time: '2025-02-14 00:00:00', text: '没事' }
  //   ]
  // });
  // data.unshift({
  //   groupName: 'esone.qiu+sync.service',
  //   groupId: '1463750737922',
  //   posts: [
  //     { id: '1111', creator: 'AI Service', time: '2025-02-14 00:00:00', text: '已经发送了' }
  //   ]
  // });
  // data.splice(1);
  console.log(data, concernedItems, username);
  if (data.length === 0) {
    console.log('没有消息数据，跳过处理');
    return {
      success: true,
      message: '没有消息数据需要处理',
      data: [] as any[],
    };
  }
  const sourcePostIndex = buildSourcePostIndex(data);

  // 根据配置选择处理方式
  if (envConfig.ANALYSIS_TYPE === 'agentThinking') {
    // 使用智能 Agent 处理
    console.log('Using Intelligent Agent to process messages');
    console.log(
      '使用智能Agent系统直接批量处理消息，支持消息降噪和上下文分析...',
    );

    // 获取用户信息
    const { userinfo } = await chrome.storage.local.get('userinfo');

    try {
      // 设置初始进度信息
      chrome.storage.local.set({
        ollamaAnalysisProgress: {
          total: data.length,
          lastAnalyzedIndex: 0,
          lastAnalyzedTime: new Date().toISOString(),
        },
      });

      // 构造消息组格式（包含 parentId 和 thread 结构）
      const messageGroups = data.map((item) => ({
        groupName: item.groupName,
        groupId: item.groupId,
        posts: getAgentWorkflowPostsForGroup(item).map((post) => ({
          sender: post.creator,
          datetime: post.time,
          post_id: post.id || '',
          parent_id: (post.raw as any)?.parentId || (post.raw as any)?.parent_id || undefined,
          content: post.text,
          attachments: post.attachments || [],
          raw: post.raw,
        })),
        // 新增：Thread 结构化数据
        threads: item.threads || [],
        standalone: item.standalone || [],
      }));
      // 🆕 关注后续检测已移至 LLM 分析中统一处理（方案 B）
      // 通过 buildRuleText 生成专门的"关注后续"规则，让 LLM 识别语义相关的消息

      // 一次性传递所有消息组给processMessage处理
      console.log(`开始批量处理 ${messageGroups.length} 个群组的所有消息...`);

      // 直接将所有messageGroups传递给processMessage，让它内部决定如何处理
      const agent = new IntelligentAgent();
      // 监听任务状态变化，如果任务被禁用则停止分析 - 使用辅助函数
      if (isScheduledTask) {
        onTaskEnabledChanged('message_analysis', (enabled) => {
          if (!enabled) agent.stop();
          chrome.storage.local.remove('ollamaAnalysisProgress');
        });
      }
      const allResults = (await agent.analyze(
        messageGroups,
        { type: 'message' },
        { concernedRules: runtimeWatchRules },
        (results) => {
          console.log(
            '已分析',
            results[0].groupIndex + 1,
            '/',
            data.length,
            '，当前群组 [',
            results[0].messageContext?.groupName,
            '] 处理结果:',
            results,
          );
          chrome.storage.local.set({
            ollamaAnalysisProgress: {
              total: data.length,
              lastAnalyzedIndex: results[0].groupIndex + 1,
              lastAnalyzedTime: new Date().toISOString(),
            },
          });
        },
      )) as MessageAnalysisResult[];

      // 转换结果为数组格式，便于统计
      const resultsArray = Array.isArray(allResults)
        ? allResults
        : [allResults];

      // 计算处理统计信息
      const storedCount = resultsArray.filter((r) => r.shouldStore).length;
      const notifiedCount = resultsArray.filter((r) => r.shouldNotify).length;
      const importantCount = resultsArray.filter((r) => r.isImportant).length;
      const noisyCount = resultsArray.filter(
        (r) => !r.shouldStore && !r.shouldNotify && !r.isImportant,
      ).length;

      console.log(
        `所有群组消息处理完成: 共 ${resultsArray.length} 条消息, ${importantCount} 条重要, ${storedCount} 条已存储, ${notifiedCount} 条已通知, ${noisyCount} 条被降噪过滤。结果细节：`,
        resultsArray,
      );

      // 更新进度为完成
      chrome.storage.local.set({
        ollamaAnalysisProgress: {
          total: data.length,
          lastAnalyzedIndex: data.length,
          lastAnalyzedTime: new Date().toISOString(),
          processingStats: {
            total: resultsArray.length,
            important: importantCount,
            stored: storedCount,
            notified: notifiedCount,
            filtered: noisyCount,
          },
        },
      });

      // 处理 shouldNotify、自动答复和 shouldStore 标志
      // 处理顺序：1.自动答复 1.5.关注后续（只更新数据） 2.统一通知 3.存储
      for (const result of resultsArray) {
        const originalMessage = result.messageContext || {};
        const postId =
          (originalMessage as any).postId ||
          (originalMessage as any).post_id ||
          (originalMessage as any).raw?.id ||
          '';

        // 1️⃣ 处理自动答复规则（最先处理，以便在通知中包含自动答复信息）
        let autoReplyResult: {
          handled: boolean;
          replyInfo?: {
            content: string;
            scheduleTime: Date;
            status: string;
            messageId?: string;
          };
        } = { handled: false };
        if (result.matchedRule) {
          // 从 matchedRule 中提取规则 ID（如果可用）
          const matchedRuleIds = mergeMatchedRuleIds(
            result.matchedRuleIds,
            extractRuleIdsFromMatchedRule(result.matchedRule),
          );

          autoReplyResult = await handleAutoReplyRules(
            {
              matchedRule: result.matchedRule,
              matchedRuleRefs: result.matchedRuleRefs,
              matchedRuleIds, // 传入提取的规则 ID 数组
              messageContext: {
                sender: originalMessage.sender || '',
                groupId: originalMessage.groupId || '',
                groupName: originalMessage.groupName || '',
                messageContent: originalMessage.messageContent || '',
                summary: result.summary || '',
                datetime: originalMessage.datetime || '',
                postId,
              },
            },
            concernedItems as TopicItemWithAutoReply[],
          );
        }

        // 1.5️⃣ 处理关注后续（只更新数据，不推送通知）
        let followThreadItem: TopicItemWithAutoReply | undefined;
        if (result.followThreadInfo && result.followThreadInfo.originalPostId) {
          try {
            followThreadItem = (
              concernedItems as TopicItemWithAutoReply[]
            ).find(
              (item) =>
                item.followThread &&
                item.followConfig?.originalMessage?.postId ===
                  result.followThreadInfo?.originalPostId,
            );

            if (followThreadItem && followThreadItem.followConfig) {
              console.log(
                `📌 关注后续匹配成功 [agentThinking-LLM识别]: ${originalMessage.sender} 的消息与 "${followThreadItem.followConfig.originalMessage.content?.substring(0, 30)}..." 相关`,
              );

              // 只更新关联消息数据，不推送通知（通知在下方统一处理）
              const relatedMsg: RelatedMessageMeta = {
                postId,
                sender: originalMessage.sender || '',
                datetime: originalMessage.datetime || '',
                relationType:
                  result.followThreadInfo.relationType || 'semantic_related',
                notifiedAt: new Date().toISOString(),
                summary: result.summary || '',
              };
              await updateRelatedMessages(followThreadItem.id, relatedMsg);

              // 存储关联消息到 ChromaDB
              await storeRelatedMessage({
                followItemId: followThreadItem.id,
                message: {
                  postId,
                  teamId: followThreadItem.followConfig.originalMessage.teamId,
                  sender: originalMessage.sender || '',
                  content: originalMessage.messageContent || '',
                  datetime: originalMessage.datetime || '',
                },
                isOriginal: false,
                relationType:
                  result.followThreadInfo.relationType || 'semantic_related',
              });
            }
          } catch (followThreadError) {
            console.error('❌ 关注后续数据处理失败:', followThreadError);
          }
        }

        // 2️⃣ 统一通知推送（合并关注后续和普通推送）
        // 查找匹配的关注项
        const matchedRuleIds = mergeMatchedRuleIds(
          result.matchedRuleIds,
          extractRuleIdsFromMatchedRule(result.matchedRule || ''),
        );
        const resolvedMatchedRules = resolveMatchedWatchRules({
          watchRules: runtimeWatchRules,
          matchedRule: result.matchedRule,
          matchedRuleRefs: result.matchedRuleRefs,
          matchedRuleIds,
          messageContext: {
            sender: originalMessage.sender || '',
            groupId: originalMessage.groupId || '',
            groupName: originalMessage.groupName || '',
            datetime: originalMessage.datetime || '',
          },
        });
        const matchedManualItems = getManualItemsFromMatchedRules(
          resolvedMatchedRules.watchRules,
        );
        const matchedConcernedItem = getImmediateNotificationItem({
          manualItems: matchedManualItems,
          followThreadItem,
        });

        // 获取通知方式
        const notifyMethod = matchedConcernedItem?.notifyMethod || '';
        const shouldMention = matchedConcernedItem?.mentionMe || false;
        await queueMatchedRuleDigests({
          items: matchedManualItems,
          matchedRule: result.matchedRule,
          sender: originalMessage.sender || '',
          teamName: originalMessage.groupName || '',
          teamId: originalMessage.groupId || '',
          messageContent: originalMessage.messageContent || '',
          summary: result.summary || '',
          datetime: originalMessage.datetime || '',
          postId,
        });

        // 如果需要通知且有配置通知方式，则发送通知
        if ((result.shouldNotify || followThreadItem) && notifyMethod) {
          // 构建自动答复信息（如果有）
          const autoReplyInfo =
            autoReplyResult.handled && autoReplyResult.replyInfo
              ? {
                  hasAutoReply: true,
                  replyContent: autoReplyResult.replyInfo.content,
                  scheduleTime: formatAutoReplyTime(
                    autoReplyResult.replyInfo.scheduleTime,
                  ),
                  messageId: autoReplyResult.replyInfo.messageId,
                }
              : undefined;

          // 构建通知数据
          const notificationData: NotificationData = {
            teamId: originalMessage.groupId || '',
            teamName: originalMessage.groupName || '',
            sender: originalMessage.sender || '',
            messageContent: originalMessage.messageContent || '',
            summary: result.summary || '',
            datetime: originalMessage.datetime || '',
            postId,
            matchedRule:
              result.matchedRule ||
              (followThreadItem
                ? `关注后续：${followThreadItem.followConfig?.originalMessage.content?.substring(0, 50)}...`
                : ''),
            replyAdvice: result.replyAdvice || '',
            mention: shouldMention,
            pushScenario: followThreadItem ? 'follow_up' : 'message_analysis',
            autoReplyInfo,
            // 如果是关注后续，添加原消息信息
            originalMessageInfo: followThreadItem?.followConfig
              ? {
                  sender: followThreadItem.followConfig.originalMessage.sender,
                  content: followThreadItem.followConfig.originalMessage.content,
                  datetime: String(
                    followThreadItem.followConfig.originalMessage.datetime,
                  ),
                  messageUrl:
                    followThreadItem.followConfig.originalMessage.messageUrl,
                }
              : undefined,
          };

          // 使用 NotificationService 发送通知
          await notificationService
            .sendNotification(
              notificationData,
              { notifyMethod },
              // LLM 审核配置（只对 bot 通知生效）
              {
                enabled: hasNotifyMethod(notifyMethod, 'bot'),
                userName: userinfo.fullName,
                concernedItems: concernedItems,
              },
            )
            .catch(console.error);
        }

        // 3️⃣ 处理 shouldStore 标志 - 使用统一存储接口（后于自动答复）
        if (result.shouldStore) {
          try {
            // 构建消息元数据
            const messageMetadata = {
              sender: originalMessage.sender || 'unknown',
              datetime:
                new Date(originalMessage.datetime).getTime() || Date.now(),
              matchedRules: result.matchedRule
                ? [result.matchedRule]
                : result.reasonsToStore || [],
              summary: result.summary || '',
              groupName: originalMessage.groupName || '',
              groupId: originalMessage.groupId || '',
              groupUrl:
                'https://app.ringcentral.com/messages/' +
                originalMessage.groupId,
              // 基于智能分析结果推断用户关系类型
              user_relation_type:
                result.user_relation_type || 'general_interest',
              contextMessages: [] as any[], // Todo: 暂时设为空数组，稍后从其他地方获取
              entities: result.enrichedData?.entities || {},
              metadata: {
                sentiment: result.enrichedData?.sentiment || 'neutral',
                priority: result.notificationPriority || 'low',
                category: result.enrichedData?.category || [],
                tags: result.enrichedData?.tags || [],
              },
              actions: result.enrichedData?.actions || [],
              replyAdvice: result.replyAdvice || '',
            };

            // 使用 MemoryServiceClient HTTP 后端存储
            try {
              const client = getMemoryServiceClient();
              const ingestResult = await client.ingest({
                content: originalMessage.messageContent || '',
                sourceType: 'glip',
                sender: originalMessage.sender || 'unknown',
                groupId: originalMessage.groupId || '',
                groupName: originalMessage.groupName || '',
                timestamp:
                  new Date(originalMessage.datetime).getTime() || Date.now(),
                metadata: {
                  ...messageMetadata,
                },
              });

              console.log(`✅ 消息完整存储完成: ${ingestResult.id}`, {
                status: ingestResult.status,
                entitiesExtracted: ingestResult.entitiesExtracted,
                matchedProjects: ingestResult.matchedProjects,
              });
            } catch (unifiedError) {
              console.error('🚨 统一存储系统失败', unifiedError);
            }
          } catch (error) {
            console.error('存储消息失败:', error);
          }
        }

        if (matchedManualItems.length > 0) {
          const sourcePost = sourcePostIndex.get(String(postId));
          const messageUrl = buildRingCentralMessageUrl(
            originalMessage.groupId,
            postId,
          );
          await queueMatchedRuleAutomations({
            manualItems: matchedManualItems,
            matchedRule: result.matchedRule,
            summary: result.summary || '',
            confidence:
              typeof (result as { confidence?: number }).confidence === 'number'
                ? (result as { confidence?: number }).confidence
                : undefined,
            message: {
              postId,
              sender: originalMessage.sender || '',
              groupId: originalMessage.groupId || '',
              groupName: originalMessage.groupName || '',
              content: originalMessage.messageContent || '',
              sourceUrl: messageUrl,
              messageUrl,
              attachments: extractAutomationAttachments(
                sourcePost,
                originalMessage,
              ),
              timestamp:
                new Date(originalMessage.datetime).getTime() || Date.now(),
              timezone: getLocalTimeZone(),
              event: extractEventPayload(sourcePost),
            },
          });
        }
      }

      // 返回处理结果
      return {
        success: true,
        message: `agentThinking处理完成: ${resultsArray.length} 条消息, ${storedCount} 条已存储, ${notifiedCount} 条已通知`,
        data: resultsArray,
        stats: {
          total: resultsArray.length,
          important: importantCount,
          stored: storedCount,
          notified: notifiedCount,
          filtered: noisyCount,
        },
      };
    } catch (error) {
      console.error('批量处理消息失败:', error);
      return {
        success: false,
        message: `agentThinking处理失败: ${error.message}`,
        data: [] as any[],
        error: error.message,
      };
    }
  } else if (envConfig.ANALYSIS_TYPE === 'agentWorkflow') {
    // 使用智能 Agent 系统处理
    console.log('Using Intelligent Agent Workflow to process messages');

    // 获取用户信息
    const { userinfo } = await chrome.storage.local.get('userinfo');

    // agentWorkflow 模式需要逐个处理每个群组的消息
    for (let index = 0; index < data.length; index++) {
      const item = data[index];
      console.log(
        `--开始使用 Agent Workflow 分析第 ${index + 1}/${data.length} 个群组的消息--`,
      );

      // 检查是否需要继续分析 - 使用辅助函数
      const messageAnalysisEnabled = await getTaskEnabled('message_analysis');
      if (!messageAnalysisEnabled && isScheduledTask) {
        console.log('分析任务已被终止');
        chrome.storage.local.remove('ollamaAnalysisProgress');
        break;
      }

      const agentWorkflowPosts = getAgentWorkflowPostsForGroup(item);
      if (agentWorkflowPosts.length === 0) {
        console.log('agentWorkflow 未发现可分析消息，跳过群组:', {
          groupId: item.groupId,
          groupName: item.groupName,
        });
      }

      // 处理该群组的每条消息
      for (const post of agentWorkflowPosts) {
        const messageData = {
          post_id: post.id,
          team_id: item.groupId,
          team_name: item.groupName,
          message_content: post.text,
          attachments: post.attachments || [],
          sender: post.creator,
          datetime: post.time,
          username: username, // 传递用户名用于匹配关注项
        };

        // 使用Agent系统处理单条消息
        const processResult = await processNewMessage(messageData);
        console.log(`Agent处理消息结果:`, processResult);

        const matchedRuleIds = mergeMatchedRuleIds(
          processResult.matchedRuleIds,
          extractRuleIdsFromMatchedRule(processResult.matchedRule || ''),
        );
        const resolvedMatchedRules = resolveMatchedWatchRules({
          watchRules: runtimeWatchRules,
          matchedRule: processResult.matchedRule,
          matchedRuleRefs: processResult.matchedRuleRefs,
          matchedRuleIds,
          messageContext: {
            sender: processResult.messageContext?.sender || post.creator || '',
            groupId: processResult.messageContext?.groupId || item.groupId || '',
            groupName:
              processResult.messageContext?.groupName || item.groupName || '',
            datetime: processResult.messageContext?.datetime || post.time || '',
          },
        });
        const matchedManualItems = getManualItemsFromMatchedRules(
          resolvedMatchedRules.watchRules,
        );
        const matchedConcernedItem = getImmediateNotificationItem({
          manualItems: matchedManualItems,
        });
        await queueMatchedRuleDigests({
          items: matchedManualItems,
          matchedRule: processResult.matchedRule,
          sender: processResult.messageContext?.sender || '',
          teamName: processResult.messageContext?.groupName || '',
          teamId: processResult.messageContext?.groupId || '',
          messageContent: processResult.messageContext?.messageContent || '',
          summary: processResult.summary || '',
          datetime: processResult.messageContext?.datetime || '',
          postId: post.id || '',
        });

        // 如果需要发送通知
        if (processResult.shouldNotify) {
          // 获取通知方式
          const notifyMethod = matchedConcernedItem?.notifyMethod || '';
          const shouldMention = matchedConcernedItem?.mentionMe || false;

          // 如果有配置通知方式，则发送通知
          if (notifyMethod) {
            const notificationData: NotificationData = {
              teamId: processResult.messageContext?.groupId || '',
              teamName: processResult.messageContext?.groupName || '',
              sender: processResult.messageContext?.sender || '',
              messageContent:
                processResult.messageContext?.messageContent || '',
              summary: processResult.summary || '',
              datetime: processResult.messageContext?.datetime || '',
              postId: post.id || '',
              matchedRule: processResult.matchedRule || '',
              replyAdvice: processResult.replyAdvice || '',
              mention: shouldMention,
              pushScenario: 'message_analysis',
            };

            await notificationService
              .sendNotification(
                notificationData,
                { notifyMethod },
                {
                  enabled: hasNotifyMethod(notifyMethod, 'bot'),
                  userName: userinfo.fullName,
                  concernedItems: concernedItems,
                },
            )
              .catch(console.error);
          }
        }

        if (matchedManualItems.length > 0) {
          const sourcePost = post.raw ?? post;
          const automationGroupId =
            processResult.messageContext?.groupId || item.groupId || '';
          const automationGroupName =
            processResult.messageContext?.groupName || item.groupName || '';
          const messageUrl = buildRingCentralMessageUrl(
            automationGroupId,
            post.id,
          );
          await queueMatchedRuleAutomations({
            manualItems: matchedManualItems,
            matchedRule: processResult.matchedRule,
            summary: processResult.summary || '',
            confidence:
              typeof processResult.confidence === 'number'
                ? processResult.confidence
                : undefined,
            pausedReason: processResult.notificationReview?.required
              ? processResult.notificationReview.message ||
                'Agent Workflow notification review is required'
              : undefined,
            message: {
              postId: post.id || '',
              sender: processResult.messageContext?.sender || '',
              groupId: automationGroupId,
              groupName: automationGroupName,
              content: processResult.messageContext?.messageContent || '',
              sourceUrl: messageUrl,
              messageUrl,
              attachments: extractAutomationAttachments(sourcePost, post),
              timestamp:
                new Date(processResult.messageContext?.datetime || '').getTime() ||
                Date.now(),
              timezone: getLocalTimeZone(),
              event: extractEventPayload(sourcePost),
            },
          });
        }
      }
    }

    // agentWorkflow 处理完成
    return {
      success: true,
      message: `agentWorkflow处理完成: 共处理 ${data.length} 个群组`,
      data: [] as any[],
      stats: {
        total: data.length,
        processed: data.length,
      },
    };
  } else {
    // 使用普通模式处理
    console.log('Using filter mode to process messages');
    return await processMessageFilterByConcernedItems(
      data,
      concernedItems,
      runtimeWatchRules,
      username,
      isScheduledTask,
      sourcePostIndex,
    );
  }
}
async function processMessageFilterByConcernedItems(
  data: any[],
  concernedItems: { text: string }[],
  runtimeWatchRules: WatchRule[],
  username: string,
  isScheduledTask: boolean,
  sourcePostIndex: Map<string, any>,
) {
  const envConfig = await getEnvConfig();

  // 以下是原有的LLM处理逻辑，当未启用智能Agent时使用
  if (envConfig.ANALYZE_BY_GROUP) {
    // 拆分单条发送 LLM
    let countAnalyzed = 0;
    chrome.storage.local.set({
      ollamaAnalysisProgress: {
        total: data.length,
        lastAnalyzedIndex: countAnalyzed,
        lastAnalyzedTime: new Date().toISOString(),
      },
    });
    // 获取初始任务状态 - 使用辅助函数
    let messageAnalysisEnabled = await getTaskEnabled('message_analysis');

    // 监听任务状态变化 - 使用辅助函数
    if (isScheduledTask) {
      onTaskEnabledChanged('message_analysis', (enabled) => {
        messageAnalysisEnabled = enabled;
      });
    }

    for (let index = 0; index < data.length; index++) {
      const item = data[index];
      console.log(`--开始分析第 ${index + 1}/${data.length} 个群组的消息--`);
      // 检查是否需要继续分析
      if (!messageAnalysisEnabled && isScheduledTask) {
        console.log('分析任务已被终止');
        chrome.storage.local.remove('ollamaAnalysisProgress');
        break;
      }
      // 使用新的 Thread 结构化格式构建消息
      const message = formatMessageGroupWithThreads(item);
      const scopedWatchRules = filterWatchRulesForMessageContext(
        runtimeWatchRules,
        getMessageGroupRuleContext(item),
      );
      const system_prompt = buildMessageFilterSystemPrompt({
        concernedItems: scopedWatchRules,
        username,
        envConfig,
      });
      const user_prompt = `
我的名字是：<current_user_name>${username}</current_user_name> （如果过滤规则中消息的内容 message_content 有提到我，可作为判断消息是否有@我，即便是不带姓氏@名字部分 也视为提及，排除 sender 是我的消息）

---- 这是我收到的最近聊条消息开始 ----
${message}
---- 这是我收到的最近聊条消息结束 ----
`;

      await reviewMessageByLLMAndSendToBot({
        user_prompt,
        system_prompt,
        messageData: item,
        sourcePostIndex,
      });
      chrome.storage.local.set({
        ollamaAnalysisProgress: {
          total: data.length,
          lastAnalyzedIndex: ++countAnalyzed,
          lastAnalyzedTime: new Date().toISOString(),
        },
      });
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          (envConfig.LLM_TYPE === 'local' ? 3 * 60 : 10) * 1000,
        ),
      );
    }
    return {
      success: true,
      message: '消息过滤完成: 共处理 ' + data.length + ' 个群组',
    };
  } else {
    // 合并发送 LLM - 使用 Thread 结构化格式
    const messages =
      '<messages>\n' +
      data.map((item) => formatMessageGroupWithThreads(item)).join('\n') +
      '\n</messages>';
    const scopedWatchRules = filterWatchRulesForMessageGroups(
      runtimeWatchRules,
      data.map((item) => getMessageGroupRuleContext(item)),
    );
    const system_prompt = buildMessageFilterSystemPrompt({
      concernedItems: scopedWatchRules,
      username,
      envConfig,
    });

    const user_prompt = `
我的名字是：<current_user_name>${username}</current_user_name> （如果过滤规则中消息的内容 message_content 有提到我，可作为判断消息是否有@我，即便是不带姓氏@名字部分 也视为提及，排除 sender 是我的消息）

---- 这是我收到的最近聊条消息开始 ----
${messages}
---- 这是我收到的最近聊条消息结束 ----
`;
    chrome.storage.local.set({
      ollamaAnalysisProgress: {
        total: 1,
        lastAnalyzedIndex: 0,
        lastAnalyzedTime: new Date().toISOString(),
      },
    });
    const dealResponse = await reviewMessageByLLMAndSendToBot({
      user_prompt,
      system_prompt,
      sourcePostIndex,
    });
    console.log('MessageDealing response:', dealResponse);
    chrome.storage.local.set({
      ollamaAnalysisProgress: {
        total: 1,
        lastAnalyzedIndex: 1,
        lastAnalyzedTime: new Date().toISOString(),
      },
    });
    return dealResponse;
  }
}
// 整合处理请求以及推送 bot 消息
async function reviewMessageByLLMAndSendToBot(body: any) {
  const envConfig = await getEnvConfig();
  try {
    const { concernedItems } = await chrome.storage.local.get('concernedItems');
    const manualConcernedItems = (concernedItems || []).filter(
      isManualConcernedItem,
    );
    const runtimeWatchRules = await loadRuntimeWatchRules(manualConcernedItems);
    const { userinfo } = await chrome.storage.local.get('userinfo');
    const sourcePostIndex =
      body.sourcePostIndex instanceof Map
        ? new Map<string, any>(body.sourcePostIndex)
        : new Map<string, any>();
    if (body.messageData) {
      addMessageGroupToSourcePostIndex(sourcePostIndex, body.messageData);
    }
    if (!body.prompt)
      body.prompt = body.user_prompt + '\n\n' + body.system_prompt;
    const dealResponse = await callLLMJsonAPI(body);
    console.log('MessageDealing response:', dealResponse, body);

    if (dealResponse && dealResponse.data && dealResponse.data.length > 0) {
      for (const json of dealResponse.data) {
        // 排除 SM AI 的私人消息和自己发送的消息
        if (
          body.messageData &&
          (body.messageData.groupName.includes('4700372020') ||
            body.messageData.groupName == 'SM AI')
        )
          continue;
        if (json.team_name.includes('4700372020') || json.team_name == 'SM AI')
          continue;
        // 根据配置决定是否过滤自己发送的消息
        if (json.sender == 'SM AI undefined') continue;
        if (envConfig.FILTER_OWN_MESSAGES && json.sender == userinfo.fullName)
          continue;

        const matched_rule = json.matched_rule;
        const messageRuleContext = {
          sender: json.sender,
          groupId: body.messageData ? body.messageData.groupId : json.team_id,
          groupName: body.messageData
            ? body.messageData.groupName
            : json.team_name,
          datetime: json.datetime,
        };
        const resolvedMatchedRules = resolveMatchedWatchRules({
          watchRules: runtimeWatchRules,
          matchedRule: matched_rule,
          matchedRuleRefs: json.matched_rule_refs,
          matchedRuleIds: json.matched_rule_ids,
          messageContext: messageRuleContext,
        });
        const matchedManualItems = getManualItemsFromMatchedRules(
          resolvedMatchedRules.watchRules,
        );

        let followThreadItem: TopicItemWithAutoReply | undefined;
        if (
          json.follow_thread_info &&
          json.follow_thread_info.original_post_id
        ) {
          followThreadItem = manualConcernedItems.find(
            (item: TopicItemWithAutoReply) =>
              item.followThread &&
              item.followConfig?.originalMessage?.postId ===
                json.follow_thread_info.original_post_id,
          );
        }

        if (
          resolvedMatchedRules.watchRules.length === 0 &&
          !followThreadItem
        ) {
          console.warn(
            '跳过未通过最终规则范围校验的消息分析结果:',
            {
              postId: json.post_id,
              sender: json.sender,
              groupId: messageRuleContext.groupId,
              groupName: messageRuleContext.groupName,
              matchedRuleRefs: json.matched_rule_refs,
              matchedRuleIds: json.matched_rule_ids,
              matchedRule: matched_rule,
            },
          );
          continue;
        }

        // 0️⃣ 先 ingest，由后端去重。若为重复消息则跳过后续推送/通知等操作
        const extractedEntities = await extractEntitiesFromMessage(
          json.message_content,
          json,
        );
        const contextMessages = body.messageData
          ? getAgentWorkflowPostsForGroup(body.messageData).map((post) => ({
              id: post.id,
              sender: post.creator,
              content: post.text,
              datetime: post.time,
              isMainMessage: post.id == json.post_id,
            }))
          : json.contextMessages;
        const messageMetadata = {
          sender: json.sender || 'unknown',
          datetime: new Date(json.datetime).getTime() || Date.now(),
          postId: json.post_id,
          matchedRules: matched_rule
            ? matched_rule.split('\n').map((rule: string) => rule.trim())
            : [],
          summary: json.summary || '',
          groupName: json.team_name,
          groupId: json.team_id,
          groupUrl:
            json.team_url ||
            `https://app.ringcentral.com/messages/${json.team_id}`,
          user_relation_type: json.user_relation_type || 'general_interest',
          contextMessages: contextMessages,
          messagePosition: contextMessages.findIndex(
            (post: any) => post.id === json.post_id,
          ),
          actions: extractedEntities.actions,
          replyAdvice: json.reply_advice,
          entities: extractedEntities.entities,
          metadata: {
            sentiment: extractedEntities.metadata.sentiment,
            priority: extractedEntities.metadata.priority,
            category: extractedEntities.metadata.category,
            tags: extractedEntities.metadata.tags,
          },
        };

        let ingestResult: { id?: string; status: string } | null = null;
        try {
          const client = getMemoryServiceClient();
          ingestResult = await client.ingest({
            content: json.message_content,
            sourceType: 'glip',
            sender: json.sender || 'unknown',
            groupId: json.team_id,
            groupName: json.team_name,
            timestamp: new Date(json.datetime).getTime() || Date.now(),
            metadata: { ...messageMetadata },
          });
          if (ingestResult.status === 'duplicate') {
            console.log(`⏭️ 跳过重复消息 [post_id=${json.post_id}]`, {
              decision: (ingestResult as any).decision,
            });
            continue;
          }
          console.log(
            `✅ 消息完整存储完成 [统一接口]: ${ingestResult.id?.slice(0, 8)}`,
            {
              status: ingestResult.status,
              entitiesExtracted: (ingestResult as any).entitiesExtracted,
              matchedProjects: (ingestResult as any).matchedProjects,
              decision: (ingestResult as any).decision,
            },
          );
        } catch (memoryError) {
          console.error('🚨 统一存储系统失败', memoryError);
          // 存储失败仍继续执行推送等，避免漏通知
        }

        // 处理顺序：1.自动答复 1.5.关注后续（只更新数据） 2.统一通知（存储已在上面完成）

        // 1️⃣ 处理自动答复规则（最先处理，以便在通知中包含自动答复信息）
        let autoReplyResult: {
          handled: boolean;
          replyInfo?: {
            content: string;
            scheduleTime: Date;
            status: string;
            messageId?: string;
          };
        } = { handled: false };
        if (
          matched_rule ||
          (json.matched_rule_refs && json.matched_rule_refs.length > 0) ||
          (json.matched_rule_ids && json.matched_rule_ids.length > 0)
        ) {
          autoReplyResult = await handleAutoReplyRules(
            {
              matchedRule: matched_rule,
              matchedRuleRefs: json.matched_rule_refs,
              matchedRuleIds: json.matched_rule_ids,
              messageContext: {
                sender: json.sender,
                groupId: json.team_id,
                groupName: json.team_name,
                messageContent: json.message_content,
                summary: json.summary,
                datetime: json.datetime,
                postId: json.post_id,
              },
            },
            manualConcernedItems,
          );
        }

        // 1.5️⃣ 处理关注后续（只更新数据，不推送通知）
        if (
          json.follow_thread_info &&
          json.follow_thread_info.original_post_id
        ) {
          try {
            if (followThreadItem && followThreadItem.followConfig) {
              console.log(
                `📌 关注后续匹配成功 [LLM识别]: ${json.sender} 的消息与 "${followThreadItem.followConfig.originalMessage.content.substring(0, 30)}..." 相关`,
              );

              // 只更新关联消息数据，不推送通知（通知在下方统一处理）
              const relatedMsg: RelatedMessageMeta = {
                postId: json.post_id,
                sender: json.sender,
                datetime: json.datetime,
                relationType:
                  json.follow_thread_info.relation_type || 'semantic_related',
                notifiedAt: new Date().toISOString(),
                summary: json.summary || '',
              };
              await updateRelatedMessages(followThreadItem.id, relatedMsg);

              // 存储关联消息到 ChromaDB
              await storeRelatedMessage({
                followItemId: followThreadItem.id,
                message: {
                  postId: json.post_id,
                  teamId: followThreadItem.followConfig.originalMessage.teamId,
                  sender: json.sender,
                  content: json.message_content,
                  datetime: json.datetime,
                },
                isOriginal: false,
                relationType:
                  json.follow_thread_info.relation_type || 'semantic_related',
              });
            }
          } catch (followThreadError) {
            console.error('❌ 关注后续数据处理失败:', followThreadError);
          }
        }

        // 2️⃣ 统一通知推送（合并关注后续和普通推送）
        // 查找匹配的关注项
        const matchedConcernedItem = getImmediateNotificationItem({
          manualItems: matchedManualItems,
          followThreadItem,
        });

        // 获取通知方式
        const notifyMethod = matchedConcernedItem?.notifyMethod || '';
        const shouldMention = matchedConcernedItem?.mentionMe || false;
        await queueMatchedRuleDigests({
          items: matchedManualItems,
          matchedRule: matched_rule,
          sender: json.sender,
          teamName: body.messageData ? body.messageData.groupName : json.team_name,
          teamId: body.messageData ? body.messageData.groupId : json.team_id,
          messageContent: json.message_content,
          summary: json.summary || '',
          datetime: json.datetime,
          postId: json.post_id,
        });

        // 如果有配置通知方式，则发送通知
        if (notifyMethod) {
          // 构建自动答复信息（如果有）
          const autoReplyInfo =
            autoReplyResult.handled && autoReplyResult.replyInfo
              ? {
                  hasAutoReply: true,
                  replyContent: autoReplyResult.replyInfo.content,
                  scheduleTime: formatAutoReplyTime(
                    autoReplyResult.replyInfo.scheduleTime,
                  ),
                  messageId: autoReplyResult.replyInfo.messageId,
                }
              : undefined;

          // 构建通知数据
          const notificationData: NotificationData = {
            teamId: body.messageData ? body.messageData.groupId : json.team_id,
            teamName: body.messageData
              ? body.messageData.groupName
              : json.team_name,
            sender: json.sender,
            messageContent: json.message_content,
            summary: json.summary || '',
            datetime: json.datetime,
            postId: json.post_id,
            matchedRule:
              matched_rule ||
              (followThreadItem
                ? `关注后续：${followThreadItem.followConfig?.originalMessage.content?.substring(0, 50)}...`
                : ''),
            replyAdvice: json.reply_advice,
            mention: shouldMention,
            pushScenario: followThreadItem ? 'follow_up' : 'message_analysis',
            autoReplyInfo,
            // 如果是关注后续，添加原消息信息
            originalMessageInfo: followThreadItem?.followConfig
              ? {
                  sender: followThreadItem.followConfig.originalMessage.sender,
                  content: followThreadItem.followConfig.originalMessage.content,
                  datetime: String(
                    followThreadItem.followConfig.originalMessage.datetime,
                  ),
                  messageUrl:
                    followThreadItem.followConfig.originalMessage.messageUrl,
                }
              : undefined,
          };

          // 使用 NotificationService 发送通知
          await notificationService
            .sendNotification(
              notificationData,
              { notifyMethod },
              // LLM 审核配置（只对 bot 通知生效）
              {
                enabled: hasNotifyMethod(notifyMethod, 'bot'),
                userName: userinfo.fullName,
                concernedItems: concernedItems,
              },
            )
            .catch(console.error);
        }

        if (matchedManualItems.length > 0) {
          const sourcePost = sourcePostIndex.get(String(json.post_id));
          const automationGroupId = body.messageData
            ? body.messageData.groupId
            : json.team_id;
          const automationGroupName = body.messageData
            ? body.messageData.groupName
            : json.team_name;
          const messageUrl = buildRingCentralMessageUrl(
            automationGroupId,
            json.post_id,
          );
          await queueMatchedRuleAutomations({
            manualItems: matchedManualItems,
            matchedRule: matched_rule,
            summary: json.summary || '',
            confidence:
              typeof json.confidence === 'number' ? json.confidence : undefined,
            message: {
              postId: json.post_id,
              sender: json.sender,
              groupId: automationGroupId,
              groupName: automationGroupName,
              content: json.message_content,
              sourceUrl: messageUrl,
              messageUrl,
              attachments: extractAutomationAttachments(
                sourcePost,
                json,
                body.messageData,
              ),
              timestamp: new Date(json.datetime).getTime() || Date.now(),
              timezone: getLocalTimeZone(),
              event: extractEventPayload(sourcePost),
            },
          });
        }
      }
    }
    return dealResponse;
  } catch (error) {
    console.error('LLM error:', error);
    return {
      error: error.message,
      details: `Failed to connect to ${envConfig.LLM_TYPE} service`,
    };
  }
}

// 自动答复处理逻辑已抽取到 message-reaction/AutoReplyHandler.ts

/**
 * 使用 Thread 结构化格式构建消息组
 * 优化 LLM 分析的上下文理解能力
 *
 * @param item 消息组数据（包含 threads 和 standalone）
 * @returns 格式化的 XML 字符串
 */
function formatMessageGroupWithThreads(item: any): string {
  const threads = item.threads || [];
  const standalone = item.standalone || [];
  const posts = item.posts || [];

  // 如果没有 thread 结构化数据，回退到旧的扁平格式
  if (threads.length === 0 && standalone.length === 0) {
    return formatMessageGroupFlat(item);
  }

  let output = `<message_group team_name="${item.groupName}" team_id="${item.groupId}">`;

  // 1. 输出对话线程（有明确回复关系的消息）
  if (threads.length > 0) {
    output += `\n  <!-- 对话线程：有明确回复关系的消息 -->`;

    for (const thread of threads) {
      const replyCount = thread.replies?.length || 0;
      output += `\n  <thread root_id="${thread.rootPostId}" reply_count="${replyCount}">`;

      // 根消息
      if (thread.rootPost) {
        const root = thread.rootPost;
        output += `\n    <root sender="${root.creator || root.sender || 'Unknown'}" datetime="${root.time || root.datetime}" post_id="${root.id}">${escapeXml(root.text || root.content || '')}</root>`;
      } else {
        // 根消息不在时间窗口内
        output += `\n    <root post_id="${thread.rootPostId}">[原消息不在当前时间窗口内]</root>`;
      }

      // 回复消息
      for (const reply of thread.replies || []) {
        output += `\n    <reply sender="${reply.creator || reply.sender}" datetime="${reply.time || reply.datetime}" post_id="${reply.id}" reply_to="${reply.parentId}">${escapeXml(reply.text || reply.content || '')}</reply>`;
      }

      output += `\n  </thread>`;
    }
  }

  // 2. 输出独立消息（没有明确回复关系）
  if (standalone.length > 0) {
    output += `\n  <!-- 独立消息：没有明确回复关系 -->`;
    output += `\n  <standalone>`;

    standalone.forEach((msg: any) => {
      output += `\n    <message sender="${msg.creator || msg.sender}" datetime="${msg.time || msg.datetime}" post_id="${msg.id}">${escapeXml(msg.text || msg.content || '')}</message>`;
    });

    output += `\n  </standalone>`;
  }

  // 3. 如果既没有 threads 也没有 standalone，但有 posts（兼容旧数据）
  if (threads.length === 0 && standalone.length === 0 && posts.length > 0) {
    output += `\n  <!-- 消息列表 -->`;
    posts.forEach((post: any) => {
      const parentInfo = post.parentId ? ` reply_to="${post.parentId}"` : '';
      output += `\n  <message sender="${post.creator}" datetime="${post.time}" post_id="${post.id}"${parentInfo}>${escapeXml(post.text)}</message>`;
    });
  }

  output += `\n</message_group>`;
  return output;
}

/**
 * 旧的扁平格式（兼容回退）
 */
function formatMessageGroupFlat(item: any): string {
  return `<message_group team_name="${item.groupName}" team_id="${item.groupId}">${(
    item.posts || []
  )
    .map(
      (post: any) => `
  <message_content sender="${post.creator}" datetime="${post.time}" post_id="${post.id}"${post.parentId ? ` parent_id="${post.parentId}"` : ''}>${escapeXml(post.text)}</message_content>`,
    )
    .join('')}
</message_group>`;
}

/**
 * 转义 XML 特殊字符
 */
function escapeXml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
