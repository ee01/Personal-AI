import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import { analyzeMessages } from '../messageDealing';
import {
  getMemoryServiceClient,
  type MessageRuleAutomationPreviewResponse,
  type RuntimeAction,
} from '../services/MemoryServiceClient';
import {
  findRingCentralTab,
  createRingCentralTab,
  waitForTabLoad,
  sendMessageWithRetry,
} from '../utils/tabHelpers';
import {
  getEnvConfig,
  normalizeConcernedItemsDigestDayOfWeek,
  normalizeConcernedItemsDigestHour,
  type EnvConfigType,
} from '../utils';
import { generateAutoReply } from '../llm';
import { getTaskEnabled } from '../services/taskSchedulerDefinitions';
import {
  mergeManualConcernedItemsPreservingSystem,
  partitionConcernedItems,
} from '../watchRules';
import {
  buildLinkedActionDraftPrefill,
  type PendingLinkedActionConfig,
  generateLinkedActionSuggestion,
  getFallbackLinkedActionPrompt,
  isPendingLinkedActionConfigFresh,
  shouldAutoRequestLinkedActionSuggestion,
} from './linkedActionHelpers';

// 自动答复配置接口
interface AutoReplyConfig {
  enabled: boolean;
  replyContent: string; // 答复内容模板
  useAIGenerate: boolean; // 每次AI生成类似答复
  reviewMode: 'immediate' | 'delayed' | 'manual'; // 审核模式
  delayHours?: number; // 延迟小时数（仅 delayed 模式使用）
}

// reviewMode 说明：
// - 'immediate': 直接发送（不审核，立即执行）
// - 'delayed': 延迟可拦截（默认，答复前 X 小时可拦截）
// - 'manual': 仅添加到审核列表（PendingReview 状态，需手动批准）

interface FollowThreadConfigType {
  originalMessage: {
    postId: string;
    teamId: string;
    teamName: string;
    sender: string;
    content: string;
    datetime: string | number;
    messageUrl: string;
  };
  createdAt: string;
  // 🆕 移除 expiresAt，使用 TopicItem.expiredAt
  // 🆕 移除 notifyMethod/notifyFrequency，移到 TopicItem 外层
  keywordFilter?: string[];
  relatedMessages: RelatedMessage[];
  lastCheckedAt?: string;
  lastNotifiedAt?: string;
}

interface RelatedMessage {
  postId: string;
  sender: string;
  datetime: string;
  relationType: 'thread_reply' | 'mention' | 'quote' | 'semantic';
  notifiedAt?: string;
  summary?: string;
}

interface DigestConfigType {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  preferredHour?: number;
  preferredDayOfWeek?: number;
}

interface TopicItem {
  id: string;
  text: string;
  expiredAt: number;
  /** @deprecated 使用 notifyMethod 替代 */
  pushToGlip?: boolean;
  mentionMe?: boolean;
  // 通用匹配条件（可编辑）
  filterSender?: string; // 匹配的发送者（可编辑）
  filterGroup?: string; // 匹配的群组名（可编辑）
  // 🆕 通用通知配置（适用于所有类型）
  // notifyMethod 使用逗号分隔格式，如 'bot,chrome'
  notifyMethod?: string;
  notifyFrequency?: 'immediate' | 'merged';
  // 🆕 每日/每周摘要配置
  digestConfig?: DigestConfigType;
  // 🆕 手动自动化动作描述（供 RuntimeAction/OpenClaw 使用）
  automationPrompt?: string;
  automationRequiresApproval?: boolean;
  // 自动答复相关字段
  autoReply?: boolean; // 是否启用自动答复
  autoReplyConfig?: AutoReplyConfig;
  // 关注后续相关字段
  followThread?: boolean; // 是否启用关注后续
  followConfig?: FollowThreadConfigType;
}

const normalizeOptionalRuleText = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const isShortScopeValue = (value?: string): boolean => {
  const normalized = normalizeOptionalRuleText(value);
  if (!normalized) return false;
  const compact = normalized.replace(/[\s_-]+/g, '');
  return compact.length > 0 && compact.length <= 2;
};

const getScopeGuidanceText = (params: {
  filterSender?: string;
  filterGroup?: string;
}): string => {
  const sender = normalizeOptionalRuleText(params.filterSender);
  const group = normalizeOptionalRuleText(params.filterGroup);

  if (!sender && !group) {
    return '当前规则会在所有群组和所有发送人中生效。建议先限定群组或发送人，降低误入库和误触发。';
  }

  const shortScopes = [
    isShortScopeValue(group) ? '群组' : '',
    isShortScopeValue(sender) ? '发送人' : '',
  ].filter(Boolean);

  if (shortScopes.length > 0) {
    return `${shortScopes.join('、')}条件较短；运行时会按完整词、群组 ID 或发送人 ID 匹配，建议写完整名称。`;
  }

  return '';
};

const getScopeSummaryText = (params: {
  filterSender?: string;
  filterGroup?: string;
}): string => {
  const sender = normalizeOptionalRuleText(params.filterSender) || '所有发送人';
  const group = normalizeOptionalRuleText(params.filterGroup) || '所有群组';
  return `${group} / ${sender}`;
};

const hasNotifyMethod = (notifyMethod: string, method: string): boolean =>
  notifyMethod
    .split(',')
    .map((value) => value.trim())
    .includes(method);

const buildActionSummaryItems = (params: {
  notifyMethod: string;
  mentionMe: boolean;
  digestEnabled: boolean;
  digestFrequency: 'daily' | 'weekly';
  autoReply: boolean;
  autoReplyMode: AutoReplyConfig['reviewMode'];
  followThread: boolean;
  automationPrompt?: string;
  automationRequiresApproval: boolean;
}): string[] => {
  const items = ['写入记忆'];

  if (hasNotifyMethod(params.notifyMethod, 'bot')) {
    items.push(params.digestEnabled ? `${params.digestFrequency === 'weekly' ? '每周' : '每日'}摘要` : 'Glip 推送');
  }
  if (hasNotifyMethod(params.notifyMethod, 'chrome')) {
    items.push('Chrome 通知');
  }
  if (params.mentionMe && hasNotifyMethod(params.notifyMethod, 'bot')) {
    items.push('@我');
  }
  if (params.autoReply) {
    const modeLabel =
      params.autoReplyMode === 'manual'
        ? '手动审核'
        : params.autoReplyMode === 'delayed'
          ? '延迟可拦截'
          : '直接发送';
    items.push(`自动答复：${modeLabel}`);
  }
  if (params.followThread) {
    items.push('关注后续');
  }
  if (normalizeOptionalRuleText(params.automationPrompt)) {
    items.push(
      params.automationRequiresApproval
        ? '联动操作：需批准'
        : '联动操作：自动执行',
    );
  }

  return items;
};

interface TabResponse {
  success: boolean;
  error?: string;
  data?: unknown;
  config?: unknown;
}

interface AutomationActionSummary {
  total: number;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  latestScheduledAt?: number;
  latestFinishedAt?: number;
  loadError?: boolean;
}

const DIGEST_WEEKDAY_OPTIONS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 0, label: '周日' },
];

const getDigestWeekdayLabel = (dayOfWeek: number): string =>
  DIGEST_WEEKDAY_OPTIONS.find(option => option.value === dayOfWeek)?.label ||
  '周一';

const isSameCalendarDate = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatDigestNextDeliveryText = (
  digestConfig: Pick<
    DigestConfigType,
    'frequency' | 'preferredHour' | 'preferredDayOfWeek'
  >,
): string => {
  const now = new Date();
  const hour = normalizeConcernedItemsDigestHour(
    digestConfig.preferredHour,
    8,
  );
  const nextDelivery = new Date(now);
  nextDelivery.setHours(hour, 0, 0, 0);

  if (digestConfig.frequency === 'weekly') {
    const targetDay = normalizeConcernedItemsDigestDayOfWeek(
      digestConfig.preferredDayOfWeek,
      1,
    );
    const daysUntilTarget = (targetDay - nextDelivery.getDay() + 7) % 7;
    nextDelivery.setDate(nextDelivery.getDate() + daysUntilTarget);
    if (now.getTime() >= nextDelivery.getTime()) {
      nextDelivery.setDate(nextDelivery.getDate() + 7);
    }
  } else if (now.getTime() >= nextDelivery.getTime()) {
    nextDelivery.setDate(nextDelivery.getDate() + 1);
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayLabel = isSameCalendarDate(nextDelivery, now)
    ? '今天'
    : isSameCalendarDate(nextDelivery, tomorrow)
      ? '明天'
      : nextDelivery.toLocaleDateString('zh-CN', {
          month: 'numeric',
          day: 'numeric',
          weekday: 'short',
        });

  return `下一次摘要：${dayLabel} ${hour}:00`;
};

interface AutomationPreviewState {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  result?: MessageRuleAutomationPreviewResponse;
  error?: string;
}

interface PendingMessageRuleImprovement {
  schema: 'message_rule_improvement.v1';
  requestId?: string;
  ruleRef: string;
  ruleText?: string;
  currentPrompt: string;
  proposedPrompt: string;
  reason: string;
  summary: string;
  sourceActionId?: string;
  sourceActionTitle?: string;
  sourceMessage?: string;
  outcomeStatus?: string;
  outcomeSummary?: string;
  targetSystem?: string;
  createdAt?: number;
  timestamp?: number;
}

const TopicModal = () => {
  const addFormRef = useRef<HTMLDivElement | null>(null);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [editingTopic, setEditingTopic] = useState<TopicItem | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [newExpiry, setNewExpiry] = useState('30');
  const [newMentionMe, setNewMentionMe] = useState(false);
  // 自动答复相关状态
  const [newAutoReply, setNewAutoReply] = useState(false);
  const [newAutoReplyConfig, setNewAutoReplyConfig] = useState<AutoReplyConfig>(
    {
      enabled: false,
      replyContent: '',
      useAIGenerate: true,
      reviewMode: 'delayed', // 默认延迟可拦截
      delayHours: 1,
    },
  );
  // 关注后续相关状态
  const [newFollowThread, setNewFollowThread] = useState(false);
  const [newFollowConfig, setNewFollowConfig] =
    useState<FollowThreadConfigType | null>(null);
  // 🆕 通用通知配置状态（适用于所有类型）
  // notifyMethod 使用逗号分隔格式，如 'bot,chrome'
  const [newNotifyMethod, setNewNotifyMethod] = useState<string>('bot');
  const [newNotifyFrequency, setNewNotifyFrequency] = useState<
    'immediate' | 'merged'
  >('immediate');
  // 🆕 每日摘要配置状态
  const [newDigestEnabled, setNewDigestEnabled] = useState(false);
  const [newDigestFrequency, setNewDigestFrequency] = useState<
    'daily' | 'weekly'
  >('daily');
  const [newDigestHour, setNewDigestHour] = useState(8);
  const [newDigestDayOfWeek, setNewDigestDayOfWeek] = useState(1);
  const [newAutomationPrompt, setNewAutomationPrompt] = useState('');
  const [newAutomationRequiresApproval, setNewAutomationRequiresApproval] =
    useState(false);
  // 新增：通用匹配条件状态
  const [newFilterSender, setNewFilterSender] = useState('');
  const [newFilterGroup, setNewFilterGroup] = useState('');
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [envConfig, setEnvConfig] = useState<EnvConfigType | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<{
    total: number;
    lastAnalyzedIndex: number;
    lastAnalyzedTime: string;
  } | null>(null);
  const [isSilentAnalysisEnabled, setIsSilentAnalysisEnabled] = useState(false);
  const [
    automationActionSummaryByRuleRef,
    setAutomationActionSummaryByRuleRef,
  ] = useState<Record<string, AutomationActionSummary>>({});
  const [
    isAutomationActionSummaryLoading,
    setIsAutomationActionSummaryLoading,
  ] = useState(false);
  const [newRuleSource, setNewRuleSource] = useState<
    'manual' | 'autoReply' | 'followThread' | 'linkedAction'
  >('manual');
  const [pendingLinkedActionConfig, setPendingLinkedActionConfig] =
    useState<PendingLinkedActionConfig | null>(null);
  const [linkedActionSuggestionStatus, setLinkedActionSuggestionStatus] =
    useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [linkedActionSuggestionSource, setLinkedActionSuggestionSource] =
    useState('');
  const [linkedActionSuggestionError, setLinkedActionSuggestionError] =
    useState('');
  const [linkedActionSuggestionFallback, setLinkedActionSuggestionFallback] =
    useState('');
  const [newAutomationPreview, setNewAutomationPreview] =
    useState<AutomationPreviewState>({ status: 'idle' });
  const [editingAutomationPreview, setEditingAutomationPreview] =
    useState<AutomationPreviewState>({ status: 'idle' });
  const [pendingRuleImprovement, setPendingRuleImprovement] =
    useState<PendingMessageRuleImprovement | null>(null);

  const linkedActionConfigSignals = {
    openClawEnabled: Boolean(
      envConfig?.OPENCLAW_ENABLED && envConfig?.OPENCLAW_BASE_URL?.trim(),
    ),
    jiraConfigured: Boolean(
      envConfig?.JIRA_BASE_URL?.trim() &&
      envConfig?.JIRA_USERNAME?.trim() &&
      envConfig?.JIRA_API_TOKEN?.trim(),
    ),
    memoryServiceAvailable: Boolean(envConfig?.MEMORY_SERVICE_BASE_URL?.trim()),
  };

  useEffect(() => {
    loadTopics();
    checkSilentAnalysisStatus();
  }, []);

  // 检查静默消息分析状态
  const checkSilentAnalysisStatus = async () => {
    const isEnabled = await getTaskEnabled('message_analysis');
    setIsSilentAnalysisEnabled(isEnabled);
  };

  useEffect(() => {
    (async () => {
      const envConfigData = await getEnvConfig();
      setEnvConfig(envConfigData);
    })();
  }, []);

  const resetNewRuleForm = (
    source: 'manual' | 'autoReply' | 'followThread' | 'linkedAction' = 'manual',
  ) => {
    setNewRuleSource(source);
    setPendingLinkedActionConfig(null);
    setLinkedActionSuggestionStatus('idle');
    setLinkedActionSuggestionSource('');
    setLinkedActionSuggestionError('');
    setLinkedActionSuggestionFallback('');
    setNewAutomationPreview({ status: 'idle' });
    setNewTopic('');
    setNewExpiry('30');
    setNewMentionMe(false);
    setNewFilterSender('');
    setNewFilterGroup('');
    setNewNotifyMethod('bot');
    setNewNotifyFrequency('immediate');
    setNewDigestEnabled(false);
    setNewDigestFrequency('daily');
    setNewDigestHour(8);
    setNewDigestDayOfWeek(1);
    setNewAutomationPrompt('');
    setNewAutomationRequiresApproval(false);
    setNewAutoReply(false);
    setNewAutoReplyConfig({
      enabled: false,
      replyContent: '',
      useAIGenerate: true,
      reviewMode: 'delayed',
      delayHours: 1,
    });
    setNewFollowThread(false);
    setNewFollowConfig(null);
  };

  const loadLinkedActionHistory = async (): Promise<TopicItem[]> => {
    const result = await chrome.storage.local.get('concernedItems');
    const storedItems: any[] = Array.isArray(result.concernedItems)
      ? (result.concernedItems as any[])
      : [];
    const { manualItems } = partitionConcernedItems(storedItems);

    return [...(manualItems as TopicItem[])]
      .filter((topic) => Boolean(topic.automationPrompt?.trim()))
      .reverse();
  };

  const getDraftLinkedActionContext = (): PendingLinkedActionConfig | null => {
    if (pendingLinkedActionConfig) {
      return pendingLinkedActionConfig;
    }

    const content = newTopic.trim();
    if (!content && !newFilterSender.trim() && !newFilterGroup.trim()) {
      return null;
    }

    return {
      sender: newFilterSender.trim() || undefined,
      groupName: newFilterGroup.trim() || undefined,
      content,
    };
  };

  const isPendingMessageRuleImprovementFresh = (
    value: PendingMessageRuleImprovement,
  ) => {
    return !value.timestamp || Date.now() - value.timestamp < 10 * 60 * 1000;
  };

  const requestLinkedActionSuggestion = async (force = false) => {
    const context = getDraftLinkedActionContext();
    if (!context) {
      return;
    }

    if (!force && newAutomationPrompt.trim()) {
      return;
    }

    setLinkedActionSuggestionStatus('loading');
    setLinkedActionSuggestionSource('');
    setLinkedActionSuggestionError('');
    setLinkedActionSuggestionFallback('');

    try {
      const suggestion = await generateLinkedActionSuggestion({
        context,
        historyTopics: await loadLinkedActionHistory(),
        configSignals: linkedActionConfigSignals,
      });
      setNewAutomationPrompt(suggestion.prompt);
      setNewAutomationPreview({ status: 'idle' });
      setLinkedActionSuggestionStatus('ready');
      setLinkedActionSuggestionSource(suggestion.sourceLabel);
      setLinkedActionSuggestionFallback('');
    } catch (error) {
      console.error('生成关联操作建议失败:', error);
      setLinkedActionSuggestionStatus('failed');
      setLinkedActionSuggestionSource('');
      setLinkedActionSuggestionError(
        '建议生成失败，请稍后重试，或先使用兜底样例。',
      );
      setLinkedActionSuggestionFallback(
        getFallbackLinkedActionPrompt(context, linkedActionConfigSignals),
      );
    }
  };

  // 检查是否有从消息悬浮菜单传来的自动答复配置请求
  useEffect(() => {
    (async () => {
      const result = await chrome.storage.local.get('pendingAutoReplyConfig');
      if (result.pendingAutoReplyConfig) {
        const config = result.pendingAutoReplyConfig;
        // 检查是否是最近5分钟内的请求
        if (Date.now() - config.timestamp < 5 * 60 * 1000) {
          console.log('🤖 检测到自动答复配置请求:', config);
          resetNewRuleForm('autoReply');

          // 自动填充表单 - 使用新的数据结构
          // text 存储内容描述，filterSender/filterGroup 存储匹配条件
          setNewTopic(
            config.content
              ? `发送了内容与以下语义相似："${config.content}"`
              : '发送的消息',
          );
          setNewFilterSender(config.sender || '');
          setNewFilterGroup(config.groupName || '');
          setNewAutoReply(true);
          setNewAutoReplyConfig({
            enabled: true,
            replyContent: '',
            useAIGenerate: true,
            reviewMode: 'delayed', // 默认延迟可拦截
            delayHours: 1,
          });
          setShowAddForm(true);

          // 尝试自动生成答复建议
          try {
            const reply = await generateAutoReply({
              messageContent: config.content,
              sender: config.sender,
              groupName: config.groupName,
              summary: `原始消息：${config.content}`,
            });
            setNewAutoReplyConfig((prev) => ({
              ...prev,
              replyContent: reply,
            }));
          } catch (error) {
            console.error('自动生成答复失败:', error);
          }
        }

        // 清除 pending 配置
        await chrome.storage.local.remove('pendingAutoReplyConfig');
      }
    })();
  }, []);

  // 检查是否有从消息悬浮菜单传来的关注后续配置请求
  useEffect(() => {
    (async () => {
      const result = await chrome.storage.local.get(
        'pendingFollowThreadConfig',
      );
      if (result.pendingFollowThreadConfig) {
        const config = result.pendingFollowThreadConfig;
        // 检查是否是最近5分钟内的请求
        if (Date.now() - config.timestamp < 5 * 60 * 1000) {
          console.log('👁 检测到关注后续配置请求:', config);
          resetNewRuleForm('followThread');

          // 自动填充表单
          // 🆕 预先生成规则主体文本，类似自动答复的做法
          setNewTopic(`关于以下内容的后续讨论："${config.content}"`);
          // 🔧 关注后续应该捕获所有人的讨论，所以发送人留空（允许用户自定义）
          setNewFilterSender('');
          setNewFilterGroup(config.groupName || '');
          setNewFollowThread(true);
          // 🆕 设置通用通知配置（外层）
          setNewNotifyMethod('bot');
          setNewNotifyFrequency('immediate');
          // 🆕 followConfig 只保留原消息和关键词等特有配置
          setNewFollowConfig({
            originalMessage: {
              postId: config.postId,
              teamId: config.groupId,
              teamName: config.groupName,
              sender: config.sender,
              content: config.content,
              datetime: config.timestamp,
              messageUrl: config.messageLink,
            },
            createdAt: new Date().toISOString(),
            keywordFilter: [],
            relatedMessages: [],
          });
          setShowAddForm(true);
        }

        // 清除 pending 配置
        await chrome.storage.local.remove('pendingFollowThreadConfig');
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const result = await chrome.storage.local.get(
        'pendingLinkedActionConfig',
      );
      if (result.pendingLinkedActionConfig) {
        const config =
          result.pendingLinkedActionConfig as PendingLinkedActionConfig & {
            timestamp?: number;
          };
        if (isPendingLinkedActionConfigFresh(config)) {
          console.log('🔗 检测到联动操作配置请求:', config);
          resetNewRuleForm('linkedAction');
          setPendingLinkedActionConfig(config);
          const prefill = buildLinkedActionDraftPrefill(config);
          setNewTopic(prefill.topicText);
          setNewFilterSender(prefill.filterSender);
          setNewFilterGroup(prefill.filterGroup);
          setNewNotifyMethod(prefill.notifyMethod);
          setNewMentionMe(prefill.mentionMe);
          setNewAutoReply(prefill.autoReply);
          setNewFollowThread(prefill.followThread);
          setNewDigestEnabled(prefill.digestEnabled);
          setShowAddForm(true);
        }

        await chrome.storage.local.remove('pendingLinkedActionConfig');
      }
    })();
  }, [envConfig]);

  useEffect(() => {
    (async () => {
      const result = await chrome.storage.local.get(
        'pendingMessageRuleImprovement',
      );
      const config = result.pendingMessageRuleImprovement as
        | PendingMessageRuleImprovement
        | undefined;
      if (!config) return;

      try {
        if (
          config.schema === 'message_rule_improvement.v1' &&
          config.ruleRef &&
          config.proposedPrompt &&
          isPendingMessageRuleImprovementFresh(config)
        ) {
          const storage = await chrome.storage.local.get('concernedItems');
          const storedItems: any[] = Array.isArray(storage.concernedItems)
            ? storage.concernedItems
            : [];
          const { manualItems } = partitionConcernedItems(storedItems);
          const manualTopics = (manualItems as TopicItem[]).map((item) => ({
            ...item,
            id: item.id || Math.random().toString(36).substr(2, 9),
            mentionMe: item.mentionMe || false,
            automationPrompt: item.automationPrompt || undefined,
            automationRequiresApproval: item.automationPrompt
              ? item.automationRequiresApproval === true
              : undefined,
            autoReply: item.autoReply || false,
            autoReplyConfig: item.autoReplyConfig || undefined,
          }));
          setTopics(manualTopics);
          const ruleId = config.ruleRef.replace(/^manual:/, '');
          const topic = manualTopics.find(
            (item) =>
              item.id === ruleId || `manual:${item.id}` === config.ruleRef,
          );

          if (topic) {
            setPendingRuleImprovement(config);
            setEditingAutomationPreview({ status: 'idle' });
            setEditingTopic({
              ...topic,
              automationPrompt: config.proposedPrompt,
              automationRequiresApproval: topic.automationPrompt
                ? topic.automationRequiresApproval === true
                : false,
            });
          } else {
            alert(`未找到要改进的记忆入口规则：${config.ruleRef}`);
          }
        }
      } finally {
        await chrome.storage.local.remove('pendingMessageRuleImprovement');
      }
    })();
  }, []);

  useEffect(() => {
    // 初始化时获取进度
    chrome.storage.local.get('ollamaAnalysisProgress', (result) => {
      console.log('ollamaAnalysisProgress:', result.ollamaAnalysisProgress);
      if (result.ollamaAnalysisProgress) {
        setAnalysisProgress(result.ollamaAnalysisProgress);
        setIsLoading(
          result.ollamaAnalysisProgress &&
            result.ollamaAnalysisProgress.lastAnalyzedIndex <
              result.ollamaAnalysisProgress.total,
        );
      }
    });

    // 监听 storage 变化
    const handleStorageChange = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      if (changes.ollamaAnalysisProgress) {
        setAnalysisProgress(changes.ollamaAnalysisProgress.newValue);
        setIsLoading(
          changes.ollamaAnalysisProgress.newValue &&
            changes.ollamaAnalysisProgress.newValue.lastAnalyzedIndex <
              changes.ollamaAnalysisProgress.newValue.total,
        );
        if (
          changes.ollamaAnalysisProgress.newValue &&
          changes.ollamaAnalysisProgress.newValue.lastAnalyzedIndex >=
            changes.ollamaAnalysisProgress.newValue.total
        ) {
          chrome.storage.local.remove('ollamaAnalysisProgress');
        }
      }

      // 监听任务状态变化
      if (changes.taskStates) {
        const taskStates = changes.taskStates.newValue;
        if (taskStates && taskStates.message_analysis) {
          setIsSilentAnalysisEnabled(taskStates.message_analysis.enabled);
        }
      }

      // 监听配置变化
      if (changes.envConfig) {
        setEnvConfig(changes.envConfig.newValue);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const loadTopics = async () => {
    const result = await chrome.storage.local.get('concernedItems');
    if (result.concernedItems) {
      let needsMigration = false;
      const storedItems: any[] = Array.isArray(result.concernedItems)
        ? (result.concernedItems as any[])
        : [];
      const { manualItems: manualTopics, systemItems } =
        partitionConcernedItems(storedItems);
      const topicsWithIds = manualTopics.map((topic: TopicItem) => {
        const migrated: TopicItem & { pushToGlip?: boolean } = {
          ...topic,
          id: topic.id || Math.random().toString(36).substr(2, 9),
          mentionMe: topic.mentionMe || false,
          automationPrompt: topic.automationPrompt || undefined,
          automationRequiresApproval: topic.automationPrompt
            ? topic.automationRequiresApproval === true
            : undefined,
          // 兼容旧数据：自动答复相关字段
          autoReply: topic.autoReply || false,
          autoReplyConfig: topic.autoReplyConfig || undefined,
        };

        if (
          topic.automationPrompt &&
          topic.automationRequiresApproval === undefined
        ) {
          needsMigration = true;
        }

        // 🆕 迁移 pushToGlip 到 notifyMethod
        if (topic.pushToGlip !== undefined && !topic.notifyMethod) {
          migrated.notifyMethod = topic.pushToGlip ? 'bot' : '';
          needsMigration = true;
        }

        const { pushToGlip: _deprecatedPushToGlip, ...normalizedTopic } =
          migrated;
        return normalizedTopic;
      });
      setTopics(topicsWithIds);

      // 如果有数据需要迁移，自动保存
      if (needsMigration) {
        await chrome.storage.local.set({
          concernedItems: [...topicsWithIds, ...systemItems],
        });
        console.log('✅ 已迁移 pushToGlip 到 notifyMethod');
      }
    }
  };

  const saveTopics = async (newTopics: TopicItem[]) => {
    const result = await chrome.storage.local.get('concernedItems');
    const storedItems: any[] = Array.isArray(result.concernedItems)
      ? (result.concernedItems as any[])
      : [];
    await chrome.storage.local.set({
      concernedItems: mergeManualConcernedItemsPreservingSystem(
        storedItems,
        newTopics,
      ),
    });
    setTopics(newTopics);
  };

  const handleDelete = async (index: number) => {
    const newTopics = topics.filter((_, i) => i !== index);
    await saveTopics(newTopics);
  };

  const handleEdit = (topic: TopicItem) => {
    setEditingAutomationPreview({ status: 'idle' });
    setEditingTopic(topic);
  };

  const handleSaveEdit = async () => {
    if (!editingTopic) return;

    // 🔧 在保存之前，保存需要检查的状态
    const savedAutoReply = editingTopic.autoReply;
    const savedFollowThread = editingTopic.followThread;
    const normalizedEditingTopic: TopicItem = {
      ...editingTopic,
      filterSender: normalizeOptionalRuleText(editingTopic.filterSender),
      filterGroup: normalizeOptionalRuleText(editingTopic.filterGroup),
      automationPrompt: editingTopic.automationPrompt?.trim() || undefined,
      automationRequiresApproval: editingTopic.automationPrompt?.trim()
        ? editingTopic.automationRequiresApproval === true
        : undefined,
    };

    // 🆕 直接保存，不再需要同步 expiresAt（已移除）
    const newTopics = topics.map((t) =>
      t.id === normalizedEditingTopic.id ? normalizedEditingTopic : t,
    );
    await saveTopics(newTopics);
    if (
      pendingRuleImprovement?.requestId &&
      pendingRuleImprovement.ruleRef === getRuleRef(normalizedEditingTopic)
    ) {
      try {
        await getMemoryServiceClient().answerConfirmRequest(
          pendingRuleImprovement.requestId,
          'applied',
          '已将建议文案应用到记忆入口规则。',
        );
      } catch (error) {
        console.warn('规则改进确认项回写失败:', error);
      }
      setPendingRuleImprovement(null);
    }
    setEditingTopic(null);
    setEditingAutomationPreview({ status: 'idle' });

    // 如果保存的是自动答复或关注后续，检查静默消息分析是否启用
    if ((savedAutoReply || savedFollowThread) && !isSilentAnalysisEnabled) {
      const shouldEnable = confirm(
        '✅ 保存成功！\n\n⚠️ 检测到您尚未开启"静默消息分析"功能。\n\n如果不开启此功能，系统将无法捕获消息并触发自动答复或关注后续。\n\n是否立即开启静默消息分析？',
      );
      if (shouldEnable) {
        chrome.runtime.sendMessage({
          type: 'CONTROL_TASK',
          taskId: 'message_analysis',
          action: 'toggle',
          enabled: true,
        });
        setIsSilentAnalysisEnabled(true);
      }
    }
  };

  const handleAdd = async () => {
    const topicText = newTopic.trim();
    if (!topicText) return;

    const newTopicItem: TopicItem = {
      id: Math.random().toString(36).substr(2, 9),
      text: topicText,
      expiredAt: newExpiry
        ? Date.now() + parseInt(newExpiry) * 24 * 60 * 60 * 1000
        : 0,
      mentionMe: newMentionMe,
      // 新增：通用匹配条件
      filterSender: normalizeOptionalRuleText(newFilterSender),
      filterGroup: normalizeOptionalRuleText(newFilterGroup),
      // 🆕 通用通知配置（notifyMethod 使用逗号分隔格式）
      notifyMethod: newNotifyMethod || undefined,
      notifyFrequency:
        newFollowThread || newAutoReply ? newNotifyFrequency : undefined,
      // 🆕 每日摘要配置
      digestConfig: newDigestEnabled
        ? {
            enabled: true,
            frequency: newDigestFrequency,
            preferredHour: normalizeConcernedItemsDigestHour(newDigestHour, 8),
            preferredDayOfWeek: normalizeConcernedItemsDigestDayOfWeek(
              newDigestDayOfWeek,
              1,
            ),
          }
        : undefined,
      automationPrompt: newAutomationPrompt.trim() || undefined,
      automationRequiresApproval: newAutomationPrompt.trim()
        ? newAutomationRequiresApproval
        : undefined,
      // 自动答复配置
      autoReply: newAutoReply,
      autoReplyConfig: newAutoReply
        ? { ...newAutoReplyConfig, enabled: true }
        : undefined,
      // 关注后续配置
      followThread: newFollowThread,
      followConfig:
        newFollowThread && newFollowConfig
          ? {
              ...newFollowConfig,
              createdAt: new Date().toISOString(),
              // 🆕 移除 expiresAt，使用外层 expiredAt
            }
          : undefined,
    };

    await saveTopics([...topics, newTopicItem]);

    // 如果启用了关注后续，存储原消息到 ChromaDB
    if (newFollowThread && newFollowConfig) {
      try {
        await chrome.runtime.sendMessage({
          type: 'STORE_FOLLOWED_MESSAGE',
          data: {
            followItemId: newTopicItem.id,
            message: newFollowConfig.originalMessage,
            isOriginal: true,
          },
        });
        console.log('✅ 原消息已存储到 ChromaDB');
      } catch (error) {
        console.error('❌ 存储原消息失败:', error);
      }
    }

    // 🔧 在重置表单之前，保存需要检查的状态
    const savedAutoReply = newAutoReply;
    const savedFollowThread = newFollowThread;

    // 重置表单
    resetNewRuleForm();
    setShowAddForm(false);

    // 如果保存的是自动答复或关注后续，检查静默消息分析是否启用
    if ((savedAutoReply || savedFollowThread) && !isSilentAnalysisEnabled) {
      const shouldEnable = confirm(
        '✅ 保存成功！\n\n⚠️ 检测到您尚未开启"静默消息分析"功能。\n\n如果不开启此功能，系统将无法捕获消息并触发自动答复或关注后续。\n\n是否立即开启静默消息分析？',
      );
      if (shouldEnable) {
        chrome.runtime.sendMessage({
          type: 'CONTROL_TASK',
          taskId: 'message_analysis',
          action: 'toggle',
          enabled: true,
        });
        setIsSilentAnalysisEnabled(true);
      }
    }
  };

  const getDaysRemaining = (expiredAt: number) => {
    const days = Math.ceil((expiredAt - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  // 拖拽相关函数
  const handleDragStart = (index: number) => {
    setDraggedItem(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverItem(index);
  };

  const handleDragEnd = async () => {
    if (
      draggedItem === null ||
      dragOverItem === null ||
      draggedItem === dragOverItem
    ) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    // 创建新的排序后的列表
    const newTopicList = [...topics];
    const draggedTopic = newTopicList[draggedItem];

    // 从原位置删除
    newTopicList.splice(draggedItem, 1);
    // 在新位置插入
    newTopicList.splice(dragOverItem, 0, draggedTopic);

    // 保存新排序
    await saveTopics(newTopicList);

    // 重置拖拽状态
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const exportToXML = () => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<topics>\n';
    topics.forEach((topic) => {
      xml += `  <topic>\n`;
      xml += `    <id>${topic.id}</id>\n`;
      xml += `    <text>${encodeXML(topic.text)}</text>\n`;
      xml += `    <expiredAt>${topic.expiredAt}</expiredAt>\n`;
      xml += `    <notifyMethod>${topic.notifyMethod || ''}</notifyMethod>\n`;
      xml += `    <notifyFrequency>${topic.notifyFrequency || ''}</notifyFrequency>\n`;
      xml += `    <mentionMe>${topic.mentionMe || false}</mentionMe>\n`;
      xml += `    <filterSender>${encodeXML(topic.filterSender || '')}</filterSender>\n`;
      xml += `    <filterGroup>${encodeXML(topic.filterGroup || '')}</filterGroup>\n`;
      xml += `    <automationPrompt>${encodeXML(topic.automationPrompt || '')}</automationPrompt>\n`;
      xml += `    <automationRequiresApproval>${topic.automationRequiresApproval || false}</automationRequiresApproval>\n`;
      xml += `    <followThread>${topic.followThread || false}</followThread>\n`;
      if (topic.followConfig) {
        xml += `    <followConfig>${encodeXML(JSON.stringify(topic.followConfig))}</followConfig>\n`;
      }
      if (topic.digestConfig) {
        xml += `    <digestConfig>${encodeXML(JSON.stringify(topic.digestConfig))}</digestConfig>\n`;
      }
      xml += `    <autoReply>${topic.autoReply || false}</autoReply>\n`;
      if (topic.autoReplyConfig) {
        xml += `    <autoReplyConfig>${encodeXML(JSON.stringify(topic.autoReplyConfig))}</autoReplyConfig>\n`;
      }
      xml += `  </topic>\n`;
    });
    xml += '</topics>';

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    const fileName = `Personal AI - memory-entry-rules ${dateString}.xml`;

    const blob = new Blob([xml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFromXML = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const xml = e.target?.result as string;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, 'text/xml');

      const topicElements = xmlDoc.getElementsByTagName('topic');
      const importedTopics: TopicItem[] = [];

      for (let i = 0; i < topicElements.length; i++) {
        const topicEl = topicElements[i];
        const id =
          topicEl.getElementsByTagName('id')[0]?.textContent ||
          Math.random().toString(36).substr(2, 9);
        const text = topicEl.getElementsByTagName('text')[0]?.textContent || '';
        const expiredAtStr =
          topicEl.getElementsByTagName('expiredAt')[0]?.textContent || '0';
        const expiredAt = parseInt(expiredAtStr);

        // 🆕 支持新的 notifyMethod 格式，同时兼容旧的 pushToGlip
        let notifyMethod =
          topicEl.getElementsByTagName('notifyMethod')[0]?.textContent || '';
        const notifyFrequency =
          topicEl.getElementsByTagName('notifyFrequency')[0]?.textContent || '';
        const pushToGlipStr =
          topicEl.getElementsByTagName('pushToGlip')[0]?.textContent || 'false';
        // 如果没有 notifyMethod 但有 pushToGlip，进行迁移
        if (!notifyMethod && pushToGlipStr === 'true') {
          notifyMethod = 'bot';
        }

        const mentionMeStr =
          topicEl.getElementsByTagName('mentionMe')[0]?.textContent || 'false';
        const mentionMe = mentionMeStr === 'true';
        const filterSender =
          topicEl.getElementsByTagName('filterSender')[0]?.textContent || '';
        const filterGroup =
          topicEl.getElementsByTagName('filterGroup')[0]?.textContent || '';
        const automationPrompt =
          topicEl.getElementsByTagName('automationPrompt')[0]?.textContent ||
          '';
        const automationRequiresApprovalStr =
          topicEl.getElementsByTagName('automationRequiresApproval')[0]
            ?.textContent || 'false';
        const automationRequiresApproval =
          automationRequiresApprovalStr === 'true';
        const followThreadStr =
          topicEl.getElementsByTagName('followThread')[0]?.textContent ||
          'false';
        const followThread = followThreadStr === 'true';
        const followConfigStr =
          topicEl.getElementsByTagName('followConfig')[0]?.textContent || '';
        let followConfig: FollowThreadConfigType | undefined;
        if (followConfigStr) {
          try {
            followConfig = JSON.parse(followConfigStr);
          } catch (e) {
            console.warn('Failed to parse followConfig:', e);
          }
        }
        const digestConfigStr =
          topicEl.getElementsByTagName('digestConfig')[0]?.textContent || '';
        let digestConfig: DigestConfigType | undefined;
        if (digestConfigStr) {
          try {
            digestConfig = JSON.parse(digestConfigStr);
          } catch (e) {
            console.warn('Failed to parse digestConfig:', e);
          }
        }
        const autoReplyStr =
          topicEl.getElementsByTagName('autoReply')[0]?.textContent || 'false';
        const autoReply = autoReplyStr === 'true';
        const autoReplyConfigStr =
          topicEl.getElementsByTagName('autoReplyConfig')[0]?.textContent || '';
        let autoReplyConfig: AutoReplyConfig | undefined;
        if (autoReplyConfigStr) {
          try {
            autoReplyConfig = JSON.parse(autoReplyConfigStr);
          } catch (e) {
            console.warn('Failed to parse autoReplyConfig:', e);
          }
        }

        if (text) {
          importedTopics.push({
            id,
            text,
            expiredAt,
            notifyMethod,
            notifyFrequency:
              notifyFrequency === 'immediate' || notifyFrequency === 'merged'
                ? notifyFrequency
                : undefined,
            mentionMe,
            filterSender: filterSender || undefined,
            filterGroup: filterGroup || undefined,
            automationPrompt: automationPrompt || undefined,
            automationRequiresApproval: automationPrompt
              ? automationRequiresApproval
              : undefined,
            followThread,
            followConfig,
            digestConfig,
            autoReply,
            autoReplyConfig,
          });
        }
      }

      if (importedTopics.length > 0) {
        await saveTopics(importedTopics);
      }
    };
    reader.readAsText(file);
  };

  const encodeXML = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const handleSendToLLM = async () => {
    setIsLoading(true);
    try {
      // 直接调用 analyzeMessages 方法
      let rcTab = await findRingCentralTab();
      if (!rcTab) {
        rcTab = await createRingCentralTab();
        if (!rcTab.id) {
          throw new Error('Tab ID is undefined');
        }
        // 等待页面加载完成
        await waitForTabLoad(rcTab.id);
      }

      if (!rcTab.id) {
        throw new Error('Tab ID is undefined');
      }

      // 获取页面配置
      let { userinfo } = await chrome.storage.local.get(['userinfo']);
      if (!userinfo || userinfo.fullName === '') {
        const userInfoResponse = (await sendMessageWithRetry(rcTab.id, {
          type: 'GET_USER_INFO',
        })) as unknown as TabResponse;
        userinfo = userInfoResponse.data;
      }
      if (!userinfo || !userinfo.fullName) {
        throw new Error('Failed to get page config');
      }

      // MESSAGE_CONTEXT_WINDOW 是从此刻往前推的绝对时间窗口
      const contextWindow = envConfig
        ? Number(envConfig.MESSAGE_CONTEXT_WINDOW)
        : 125;
      const startTime = new Date(Date.now() - contextWindow * 60 * 1000);

      // 获取用户数据
      const response = (await sendMessageWithRetry(rcTab.id, {
        type: 'FETCH_USER_MESSAGES',
        startTime,
      })) as unknown as TabResponse;

      if (!response || !response.success) {
        throw new Error(response?.error || 'Unknown error');
      }

      const userData = Array.isArray(response.data) ? response.data : [];
      await analyzeMessages(userData, userinfo.fullName);
    } catch (error) {
      console.error('Error sending data to Ollama:', error);
      setIsLoading(false);
    }
  };

  const getIntervalHours = () => {
    if (envConfig) {
      return (Number(envConfig.MESSAGE_CONTEXT_WINDOW) / 60).toFixed(1);
    }
    return '2.1'; // 默认 125 分钟 ≈ 2.1 小时
  };

  // AI 生成答复建议（新增表单）
  const handleGenerateReplyForNew = async () => {
    if (!newTopic) {
      alert('请先输入规则条件');
      return;
    }
    setIsGeneratingReply(true);
    try {
      const reply = await generateAutoReply({
        messageContent: newTopic,
        sender: newFilterSender || '未知发送者',
        groupName: newFilterGroup || '未知群组',
        summary: `用户关注的话题：${newTopic}`,
        replyTemplate: newAutoReplyConfig.replyContent, // 传递现有模板作为参考
      });
      setNewAutoReplyConfig({
        ...newAutoReplyConfig,
        replyContent: reply,
      });
    } catch (error) {
      console.error('生成答复失败:', error);
      alert('生成答复失败，请稍后重试');
    } finally {
      setIsGeneratingReply(false);
    }
  };

  // AI 生成答复建议（编辑表单）
  const handleGenerateReplyForEdit = async () => {
    if (!editingTopic) return;
    setIsGeneratingReply(true);
    try {
      const reply = await generateAutoReply({
        messageContent: editingTopic.text,
        sender: editingTopic.filterSender || '未知发送者',
        groupName: editingTopic.filterGroup || '未知群组',
        summary: `用户关注的话题：${editingTopic.text}`,
        replyTemplate: editingTopic.autoReplyConfig?.replyContent, // 传递现有模板作为参考
      });
      setEditingTopic({
        ...editingTopic,
        autoReplyConfig: {
          ...editingTopic.autoReplyConfig!,
          replyContent: reply,
        },
      });
    } catch (error) {
      console.error('生成答复失败:', error);
      alert('生成答复失败，请稍后重试');
    } finally {
      setIsGeneratingReply(false);
    }
  };

  // 启用静默消息分析
  const enableSilentAnalysis = () => {
    chrome.runtime.sendMessage({
      type: 'CONTROL_TASK',
      taskId: 'message_analysis',
      action: 'toggle',
      enabled: true,
    });
    setIsSilentAnalysisEnabled(true);
  };

  const memoryServiceConfigured = Boolean(
    envConfig?.MEMORY_SERVICE_BASE_URL?.trim(),
  );
  const openClawConfigured = Boolean(
    envConfig?.OPENCLAW_ENABLED && envConfig?.OPENCLAW_BASE_URL?.trim(),
  );
  const hasAutomationRules = topics.some((topic) =>
    Boolean(topic.automationPrompt?.trim()),
  );

  useEffect(() => {
    if (
      shouldAutoRequestLinkedActionSuggestion({
        showAddForm,
        newRuleSource,
        linkedActionSuggestionStatus,
        newAutomationPrompt,
      })
    ) {
      void requestLinkedActionSuggestion(true);
    }
  }, [
    linkedActionSuggestionStatus,
    newAutomationPrompt,
    newRuleSource,
    openClawConfigured,
    pendingLinkedActionConfig,
    showAddForm,
  ]);

  const summarizeRuntimeActions = (
    actions: RuntimeAction[],
    total: number,
  ): AutomationActionSummary => {
    const summary: AutomationActionSummary = {
      total,
      queued: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      cancelled: 0,
    };

    actions.forEach((action) => {
      switch (action.queueStatus) {
        case 'queued':
          summary.queued += 1;
          break;
        case 'running':
          summary.running += 1;
          break;
        case 'succeeded':
          summary.succeeded += 1;
          break;
        case 'failed':
          summary.failed += 1;
          break;
        case 'cancelled':
        case 'dead_letter':
          summary.cancelled += 1;
          break;
        default:
          break;
      }

      if (
        typeof action.scheduledAt === 'number' &&
        (!summary.latestScheduledAt ||
          action.scheduledAt > summary.latestScheduledAt)
      ) {
        summary.latestScheduledAt = action.scheduledAt;
      }

      const finishedAt = action.finishedAt || action.executedAt;
      if (
        typeof finishedAt === 'number' &&
        (!summary.latestFinishedAt || finishedAt > summary.latestFinishedAt)
      ) {
        summary.latestFinishedAt = finishedAt;
      }
    });

    return summary;
  };

  const loadAutomationActionSummaries = async (items: TopicItem[]) => {
    const automationTopics = items.filter((topic) =>
      Boolean(topic.automationPrompt?.trim()),
    );

    if (!memoryServiceConfigured || automationTopics.length === 0) {
      setAutomationActionSummaryByRuleRef({});
      return;
    }

    setIsAutomationActionSummaryLoading(true);
    try {
      const client = getMemoryServiceClient();
      const summaries = await Promise.all(
        automationTopics.map(async (topic) => {
          const ruleRef = `manual:${topic.id}`;
          try {
            const response = await client.getActions({
              sourceRefId: ruleRef,
              limit: 25,
            });
            return [
              ruleRef,
              summarizeRuntimeActions(
                response.items || [],
                response.total || 0,
              ),
            ] as const;
          } catch (error) {
            console.warn(
              `Failed to load action summary for ${ruleRef}:`,
              error,
            );
            return [
              ruleRef,
              {
                total: 0,
                queued: 0,
                running: 0,
                succeeded: 0,
                failed: 0,
                cancelled: 0,
                loadError: true,
              } satisfies AutomationActionSummary,
            ] as const;
          }
        }),
      );
      setAutomationActionSummaryByRuleRef(Object.fromEntries(summaries));
    } finally {
      setIsAutomationActionSummaryLoading(false);
    }
  };

  useEffect(() => {
    void loadAutomationActionSummaries(topics);
  }, [topics, memoryServiceConfigured]);

  useEffect(() => {
    if (!showAddForm) return;
    window.requestAnimationFrame(() => {
      addFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, [showAddForm]);

  const formatDateTime = (value?: string | number) => {
    if (!value) return '未知时间';
    const normalizedValue =
      typeof value === 'number' && value < 1_000_000_000_000
        ? value * 1000
        : value;
    const parsed = new Date(normalizedValue);
    return Number.isNaN(parsed.getTime())
      ? '未知时间'
      : parsed.toLocaleString('zh-CN');
  };

  const formatAnalysisStatus = () => {
    if (analysisProgress?.lastAnalyzedTime) {
      return `上次分析 ${formatDateTime(analysisProgress.lastAnalyzedTime)}`;
    }
    return '尚未记录分析时间';
  };

  const getRuleRef = (topic: TopicItem) => `manual:${topic.id}`;

  const getRuleStatus = (topic: TopicItem) => {
    if (!topic.expiredAt) {
      return { tone: 'neutral', text: '长期有效' };
    }
    if (topic.expiredAt <= Date.now()) {
      return { tone: 'expired', text: '已过期' };
    }
    return { tone: 'active', text: '进行中' };
  };

  const getRuleExpiryText = (topic: TopicItem) => {
    if (!topic.expiredAt) return '手动结束';
    if (topic.expiredAt <= Date.now()) return '已过期';
    return `${getDaysRemaining(topic.expiredAt)} 天后过期`;
  };

  const getScopeChips = (topic: TopicItem) => [
    `群组：${topic.filterGroup || '不限'}`,
    `发送人：${topic.filterSender || '不限'}`,
  ];

  const getTopicScopeGuidanceText = (topic: TopicItem) =>
    getScopeGuidanceText({
      filterSender: topic.filterSender,
      filterGroup: topic.filterGroup,
    });

  const formatDigestScheduleChip = (digestConfig: DigestConfigType) => {
    const hour = normalizeConcernedItemsDigestHour(
      digestConfig.preferredHour,
      8,
    );
    if (digestConfig.frequency === 'weekly') {
      const weekday = getDigestWeekdayLabel(
        normalizeConcernedItemsDigestDayOfWeek(
          digestConfig.preferredDayOfWeek,
          1,
        ),
      );
      return `✓ 每${weekday} ${hour}:00 摘要`;
    }
    return `✓ 每日 ${hour}:00 摘要`;
  };

  const getCapabilityChips = (topic: TopicItem) => {
    const chips = ['✓ 写入记忆'];
    if ((topic.notifyMethod || '').includes('bot')) {
      chips.push(topic.mentionMe ? '✓ Glip 推送 + @提醒' : '✓ Glip 推送');
    }
    if ((topic.notifyMethod || '').includes('chrome')) {
      chips.push('✓ Chrome 通知');
    }
    if (topic.digestConfig?.enabled) {
      chips.push(formatDigestScheduleChip(topic.digestConfig));
    }
    if (topic.autoReply) {
      chips.push('✓ 自动答复');
    }
    if (topic.followThread) {
      chips.push('✓ 关注后续');
    }
    if (topic.automationPrompt?.trim()) {
      chips.push('✓ 关联操作');
    }
    return chips;
  };

  const getAutomationStatusText = (topic: TopicItem) => {
    if (!topic.automationPrompt?.trim()) return '';
    const requiresApproval = topic.automationRequiresApproval === true;
    return openClawConfigured
      ? requiresApproval
        ? 'OpenClaw 已连接；这条关联操作命中后会生成 RuntimeAction，但执行外部写操作前仍需你批准。'
        : 'OpenClaw 已连接；这条关联操作命中后会生成 RuntimeAction，并按计划自动执行外部写操作。'
      : requiresApproval
        ? 'OpenClaw 未配置；这条关联操作会先跟规则一起保存，但当前无法进入需批准的外部执行。'
        : 'OpenClaw 未配置；这条关联操作会先跟规则一起保存，外部写操作当前无法自动执行。';
  };

  const getAutomationActionSummary = (topic: TopicItem) =>
    automationActionSummaryByRuleRef[getRuleRef(topic)];

  const getAutomationActionSummaryText = (topic: TopicItem) => {
    const summary = getAutomationActionSummary(topic);
    if (summary?.loadError) {
      return '还没能从 Memory Service 拉到这条规则的动作状态。';
    }
    if (summary) {
      const activeCount = summary.queued + summary.running;
      if (activeCount > 0) {
        return `${summary.total} 个 RuntimeAction 已生成，当前 ${activeCount} 个待执行。`;
      }
      if (summary.failed > 0) {
        return `${summary.total} 个 RuntimeAction 已生成，其中 ${summary.failed} 个执行失败。`;
      }
      if (summary.succeeded > 0) {
        return `${summary.total} 个 RuntimeAction 已生成，最近一次执行成功。`;
      }
      if (summary.cancelled > 0) {
        return `${summary.total} 个 RuntimeAction 已生成，最近状态包含取消或死信。`;
      }
      if (summary.total > 0) {
        return `${summary.total} 个 RuntimeAction 已生成。`;
      }
    }
    if (isAutomationActionSummaryLoading) {
      return '正在查询该规则关联的 RuntimeAction 状态…';
    }
    return openClawConfigured
      ? '尚未看到这条规则创建的 RuntimeAction。首次命中后会出现在动作队列；外部写动作默认仍需审批。'
      : 'OpenClaw 未配置。首次命中后可以先生成动作计划，但连接前无法执行外部写动作。';
  };

  const openOptionsPage = () => {
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('options.html#OPENCLAW_ENABLED')
      : 'options.html#OPENCLAW_ENABLED';
    window.open(url, '_blank');
  };

  const openPromptConfigWindow = () => {
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('prompt-config.html')
      : 'prompt-config.html';

    if (chrome?.windows?.create) {
      chrome.windows.create({
        url,
        type: 'popup',
        width: 900,
        height: 800,
        focused: true,
      });
      return;
    }

    window.open(url, '_blank', 'noopener');
  };

  const openActionQueueForRule = (topic: TopicItem) => {
    const baseUrl = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('memory-exploring.html')
      : 'memory-exploring.html';
    const sourceRefId = encodeURIComponent(getRuleRef(topic));
    const sourceTitle = encodeURIComponent(topic.text);
    window.open(
      `${baseUrl}#/actions?sourceRefId=${sourceRefId}&sourceTitle=${sourceTitle}`,
      '_blank',
    );
  };

  const getLocalTimeZone = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return undefined;
    }
  };

  const requestAutomationPreview = async (mode: 'new' | 'edit') => {
    const isEdit = mode === 'edit';
    const targetTopic = isEdit ? editingTopic : null;
    const prompt = isEdit
      ? targetTopic?.automationPrompt?.trim() || ''
      : newAutomationPrompt.trim();
    const setPreview = isEdit
      ? setEditingAutomationPreview
      : setNewAutomationPreview;

    if (!prompt) {
      setPreview({ status: 'idle' });
      return;
    }

    if (!memoryServiceConfigured) {
      setPreview({
        status: 'failed',
        error: 'Memory Service 未配置，无法预演联动操作。',
      });
      return;
    }

    setPreview({ status: 'loading' });
    try {
      const client = getMemoryServiceClient();
      const content = isEdit
        ? pendingRuleImprovement?.sourceMessage ||
          targetTopic?.text ||
          prompt
        : pendingLinkedActionConfig?.content || newTopic.trim() || prompt;
      const response = await client.previewMessageRuleAutomation({
        ruleRef: targetTopic ? getRuleRef(targetTopic) : 'manual:draft',
        ruleText: targetTopic?.text || newTopic.trim() || undefined,
        automationPrompt: prompt,
        requiresApproval: isEdit
          ? targetTopic?.automationRequiresApproval === true
          : newAutomationRequiresApproval,
        message: {
          content,
          sender: isEdit
            ? targetTopic?.filterSender || undefined
            : newFilterSender.trim() || undefined,
          groupName: isEdit
            ? targetTopic?.filterGroup || undefined
            : newFilterGroup.trim() || undefined,
          timestamp: Date.now(),
          timezone: getLocalTimeZone(),
        },
      });
      setPreview({ status: 'ready', result: response });
    } catch (error: any) {
      console.error('预演联动操作失败:', error);
      setPreview({
        status: 'failed',
        error: error?.message || '预演失败，请稍后重试。',
      });
    }
  };

  const renderAutomationPreview = (
    preview: AutomationPreviewState,
    onApplySuggestion: (suggestedPrompt: string) => void,
  ) => {
    if (preview.status === 'idle') return null;
    if (preview.status === 'loading') {
      return (
        <div className="supporting-panel automation-preview-panel">
          <div className="supporting-title">正在预演联动操作</div>
          <div className="supporting-text muted-copy">
            只做 dry-run，不会创建 RuntimeAction，也不会调用 OpenClaw。
          </div>
        </div>
      );
    }
    if (preview.status === 'failed') {
      return (
        <div className="supporting-panel automation-preview-panel warning">
          <div className="supporting-title">预演失败</div>
          <div className="supporting-text muted-copy">{preview.error}</div>
        </div>
      );
    }

    const result = preview.result;
    if (!result) return null;

    return (
      <div className="supporting-panel automation-preview-panel">
        <div className="automation-panel-head">
          <div className="supporting-title">联动操作预演</div>
          <span
            className={`rule-badge ${result.canPlan ? 'info' : 'warn'}`}
          >
            {result.canPlan ? '可生成动作' : '需要改写'}
          </span>
        </div>
        <div className="supporting-text">
          动作族：{result.actionFamily}
          {result.detectedWindow
            ? `，时间窗口 ${formatDateTime(result.detectedWindow.startAt)} - ${formatDateTime(result.detectedWindow.endAt)}`
            : ''}
        </div>
        {result.actions.length > 0 && (
          <div className="automation-preview-actions">
            {result.actions.map((action, index) => (
              <div
                key={`${action.actionType}-${action.title}-${index}`}
                className="automation-preview-action"
              >
                <span>{action.actionType === 'delegate_openclaw' ? '⚡' : '🔔'}</span>
                <span>
                  {action.title}
                  {action.targetSystem ? ` / ${action.targetSystem}` : ''}
                  {action.scheduledAt
                    ? ` / ${formatDateTime(action.scheduledAt)}`
                    : ''}
                </span>
              </div>
            ))}
          </div>
        )}
        {result.warnings.length > 0 && (
          <div className="automation-preview-warnings">
            {result.warnings.map((warning) => (
              <div
                key={`${warning.code}-${warning.message}`}
                className={`automation-preview-warning ${warning.severity}`}
              >
                {warning.message}
              </div>
            ))}
          </div>
        )}
        {result.suggestedPrompt && (
          <div className="automation-suggestion-box">
            <div className="supporting-title">建议改写</div>
            <div className="supporting-text">{result.suggestedPrompt}</div>
            {result.suggestionReason && (
              <div className="hint-text">{result.suggestionReason}</div>
            )}
            <button
              type="button"
              className="secondary-btn"
              onClick={() => onApplySuggestion(result.suggestedPrompt!)}
            >
              应用建议文案
            </button>
          </div>
        )}
      </div>
    );
  };

  const getFollowThreadSummary = (topic: TopicItem) => {
    if (!topic.followThread || !topic.followConfig) return '';
    const relatedMessages = topic.followConfig.relatedMessages;
    const latestRelated = relatedMessages[relatedMessages.length - 1];
    if (latestRelated?.summary) {
      return latestRelated.summary;
    }
    return `已捕获 ${relatedMessages.length} 条关联消息`;
  };

  const newRuleActionItems = buildActionSummaryItems({
    notifyMethod: newNotifyMethod || '',
    mentionMe: newMentionMe,
    digestEnabled: newDigestEnabled && !newFollowThread,
    digestFrequency: newDigestFrequency,
    autoReply: newAutoReply,
    autoReplyMode: newAutoReplyConfig.reviewMode,
    followThread: newFollowThread,
    automationPrompt: newAutomationPrompt,
    automationRequiresApproval: newAutomationRequiresApproval,
  });

  return (
    <div className="topic-modal">
      <div className="page-header">
        <div className="page-copy">
          <div className="page-eyebrow">Manual memory rules</div>
          <h2>记忆入口规则</h2>
          <p>
            配置你希望系统持续观察并写入记忆的消息模式。这里只展示你手动创建的规则；系统内部观察规则会继续运行，但不会出现在这里。
          </p>
        </div>
      </div>

      <div className="status-strip">
        <span
          className={`status-pill ${isSilentAnalysisEnabled ? 'ok' : 'warn'}`}
        >
          {isSilentAnalysisEnabled
            ? '后台记忆采集运行中'
            : '后台记忆采集未开启'}
        </span>
        <span
          className={`status-pill ${memoryServiceConfigured ? 'ok' : 'muted'}`}
        >
          {memoryServiceConfigured
            ? 'Memory Service 已连接'
            : 'Memory Service 未配置'}
        </span>
        <span
          className={`status-pill ${openClawConfigured ? 'info' : 'muted'}`}
        >
          {openClawConfigured ? 'OpenClaw 已连接' : 'OpenClaw 待配置'}
        </span>
        <span className="status-pill muted">{formatAnalysisStatus()}</span>
      </div>

      <div className="info-banner manual-banner">
        <strong>只显示你定义的记忆入口规则。</strong>
        <span>
          帮我问 /
          自我反思等系统功能可能会临时挂内部观察规则，用于证据采集与入库；这些内部规则不会写入
          concernedItems，也不会出现在这里。
        </span>
      </div>

      {hasAutomationRules && !openClawConfigured && (
        <div className="warning-banner automation-banner">
          <div className="warning-content">
            <span className="warning-icon">⚡</span>
            <span className="warning-text">
              当前有规则配置了关联操作，但 OpenClaw
              还没连接。动作描述会先和规则一起保存；连接后才具备被后端自动化规划器消费的前提。
            </span>
            <button className="warning-action-btn" onClick={openOptionsPage}>
              前往连接 OpenClaw
            </button>
          </div>
        </div>
      )}

      {/* 静默消息分析警告横幅 */}
      {!isSilentAnalysisEnabled && (
        <div className="warning-banner">
          <div className="warning-content">
            <span className="warning-icon">⚠️</span>
            <span className="warning-text">
              静默消息分析未启用！自动答复和关注后续功能需要开启此功能才能正常工作。
            </span>
            <button
              className="warning-action-btn"
              onClick={enableSilentAnalysis}
            >
              立即启用
            </button>
          </div>
        </div>
      )}

      <div className="toolbar">
        <button
          className="primary-btn"
          onClick={() => {
            resetNewRuleForm();
            setShowAddForm(true);
          }}
        >
          ＋ 添加规则
        </button>
        <button
          type="button"
          className="toolbar-button"
          onClick={openPromptConfigWindow}
          title="配置自定义提示词和用户上下文"
        >
          ⚙️ 自定义提示词与上下文
        </button>
        <button onClick={exportToXML}>📤 导出规则</button>
        <label className="import-button toolbar-button">
          📥 导入规则
          <input
            type="file"
            accept=".xml"
            style={{ display: 'none' }}
            onChange={importFromXML}
          />
        </label>
        <button onClick={handleSendToLLM} disabled={isLoading}>
          {isLoading
            ? `正在分析 ${(analysisProgress?.lastAnalyzedIndex || 0) + 1}/${analysisProgress?.total || 1}`
            : `▶ 立即分析最近 ${getIntervalHours()} 小时消息`}
        </button>
      </div>

      <div className="section-head">
        <div>
          <h3>我的规则</h3>
          <p>系统内部观察规则不会计入这里，也不会计入 FollowThreads 统计。</p>
        </div>
        <span className="section-count">{topics.length}</span>
      </div>

      {topics.length === 0 && !showAddForm && (
        <div className="empty-state-card">
          <div className="empty-state-title">还没有手动记忆入口规则</div>
          <div className="empty-state-text">
            从一条你想持续观察的消息模式开始。命中后消息会默认写入记忆，你也可以叠加
            Glip 推送、摘要、自动答复、关注后续或关联操作。
          </div>
        </div>
      )}

      <div className="topic-list">
        {topics.map((topic, index) => (
          <div
            key={topic.id}
            className={`topic-item ${dragOverItem === index ? 'drag-over' : ''}`}
            draggable={editingTopic?.id !== topic.id}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
          >
            {editingTopic?.id === topic.id ? (
              <div className="topic-edit-form">
                <div className="edit-text-field">
                  <input
                    className="text-input"
                    value={editingTopic.text}
                    onChange={(e) =>
                      setEditingTopic({
                        ...editingTopic,
                        text: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="edit-controls">
                  <div className="expiry-field">
                    <input
                      type="number"
                      className="expiry-input"
                      value={
                        editingTopic.expiredAt
                          ? Math.ceil(
                              (editingTopic.expiredAt - Date.now()) /
                                (1000 * 60 * 60 * 24),
                            )
                          : ''
                      }
                      onChange={(e) =>
                        setEditingTopic({
                          ...editingTopic,
                          expiredAt: e.target.value
                            ? Date.now() +
                              parseInt(e.target.value) * 24 * 60 * 60 * 1000
                            : 0,
                        })
                      }
                      min="1"
                      placeholder="天数"
                    />
                    <div className="tooltip-container">
                      <span className="info-icon">i</span>
                      <span className="tooltip-text">不自动过期请留空</span>
                    </div>
                  </div>
                  <div className="checkbox-container">
                    <input
                      type="checkbox"
                      id={`notify-bot-${topic.id}`}
                      checked={(editingTopic.notifyMethod || '').includes(
                        'bot',
                      )}
                      onChange={(e) => {
                        const methods = (editingTopic.notifyMethod || '')
                          .split(',')
                          .filter((m) => m);
                        if (e.target.checked) {
                          if (!methods.includes('bot')) methods.push('bot');
                        } else {
                          const idx = methods.indexOf('bot');
                          if (idx > -1) methods.splice(idx, 1);
                        }
                        setEditingTopic({
                          ...editingTopic,
                          notifyMethod: methods.join(','),
                          mentionMe: methods.includes('bot')
                            ? editingTopic.mentionMe || false
                            : false,
                        });
                      }}
                    />
                    <label htmlFor={`notify-bot-${topic.id}`}>Glip推送</label>
                  </div>
                  <div className="checkbox-container">
                    <input
                      type="checkbox"
                      id={`notify-chrome-${topic.id}`}
                      checked={(editingTopic.notifyMethod || '').includes(
                        'chrome',
                      )}
                      onChange={(e) => {
                        const methods = (editingTopic.notifyMethod || '')
                          .split(',')
                          .filter((m) => m);
                        if (e.target.checked) {
                          if (!methods.includes('chrome'))
                            methods.push('chrome');
                        } else {
                          const idx = methods.indexOf('chrome');
                          if (idx > -1) methods.splice(idx, 1);
                        }
                        setEditingTopic({
                          ...editingTopic,
                          notifyMethod: methods.join(','),
                        });
                      }}
                    />
                    <label htmlFor={`notify-chrome-${topic.id}`}>
                      Chrome通知
                    </label>
                  </div>
                  <div className="checkbox-container">
                    <input
                      type="checkbox"
                      id={`mention-me-${topic.id}`}
                      checked={editingTopic.mentionMe || false}
                      disabled={
                        !(editingTopic.notifyMethod || '').includes('bot')
                      }
                      onChange={(e) =>
                        setEditingTopic({
                          ...editingTopic,
                          mentionMe: e.target.checked,
                        })
                      }
                    />
                    <label htmlFor={`mention-me-${topic.id}`}>@我</label>
                  </div>
                  <div className="checkbox-container">
                    <input
                      type="checkbox"
                      id={`auto-reply-${topic.id}`}
                      checked={editingTopic.autoReply || false}
                      onChange={(e) =>
                        setEditingTopic({
                          ...editingTopic,
                          autoReply: e.target.checked,
                          autoReplyConfig: e.target.checked
                            ? editingTopic.autoReplyConfig || {
                                enabled: true,
                                replyContent: '',
                                useAIGenerate: true,
                                reviewMode: 'delayed',
                                delayHours: 1,
                              }
                            : undefined,
                        })
                      }
                    />
                    <label htmlFor={`auto-reply-${topic.id}`}>自动答复</label>
                  </div>
                  <div className="checkbox-container">
                    <input
                      type="checkbox"
                      id={`follow-thread-${topic.id}`}
                      checked={editingTopic.followThread || false}
                      onChange={(e) =>
                        setEditingTopic({
                          ...editingTopic,
                          followThread: e.target.checked,
                        })
                      }
                    />
                    <label htmlFor={`follow-thread-${topic.id}`}>
                      关注后续
                    </label>
                  </div>
                </div>

                {/* 通用匹配条件（可编辑） */}
	                <div className="filter-conditions">
	                  <div className="filter-item">
                    <label htmlFor={`filter-sender-${topic.id}`}>
                      匹配发送人:
                    </label>
                    <input
                      type="text"
                      id={`filter-sender-${topic.id}`}
                      placeholder="留空表示不限发送人"
                      value={editingTopic.filterSender || ''}
                      onChange={(e) =>
                        setEditingTopic({
                          ...editingTopic,
                          filterSender: e.target.value || undefined,
                        })
                      }
                    />
                  </div>
                  <div className="filter-item">
                    <label htmlFor={`filter-group-${topic.id}`}>
                      匹配群组:
                    </label>
                    <input
                      type="text"
                      id={`filter-group-${topic.id}`}
                      placeholder="留空表示不限群组"
                      value={editingTopic.filterGroup || ''}
                      onChange={(e) =>
                        setEditingTopic({
                          ...editingTopic,
                          filterGroup: e.target.value || undefined,
                        })
                      }
	                    />
	                  </div>
	                </div>
	                {getTopicScopeGuidanceText(editingTopic) && (
	                  <div className="scope-guidance">
	                    {getTopicScopeGuidanceText(editingTopic)}
	                  </div>
	                )}

	                {/* 编辑时的自动答复配置区域 */}
                {editingTopic.autoReply && (
                  <div className="auto-reply-config">
                    <div className="config-section">
                      <div className="config-title">回复内容：</div>
                      <textarea
                        className="reply-content-input"
                        placeholder="输入回复内容模板"
                        value={editingTopic.autoReplyConfig?.replyContent || ''}
                        onChange={(e) =>
                          setEditingTopic({
                            ...editingTopic,
                            autoReplyConfig: {
                              ...editingTopic.autoReplyConfig!,
                              replyContent: e.target.value,
                            },
                          })
                        }
                        rows={3}
                      />
                      <div className="reply-options">
                        <button
                          type="button"
                          className="ai-generate-btn"
                          onClick={handleGenerateReplyForEdit}
                          disabled={isGeneratingReply}
                        >
                          {isGeneratingReply ? '生成中...' : '🤖 AI 生成建议'}
                        </button>
                        <div className="checkbox-container">
                          <input
                            type="checkbox"
                            id={`use-ai-${topic.id}`}
                            checked={
                              editingTopic.autoReplyConfig?.useAIGenerate ||
                              false
                            }
                            onChange={(e) =>
                              setEditingTopic({
                                ...editingTopic,
                                autoReplyConfig: {
                                  ...editingTopic.autoReplyConfig!,
                                  useAIGenerate: e.target.checked,
                                },
                              })
                            }
                          />
                          <label htmlFor={`use-ai-${topic.id}`}>
                            每次AI生成类似答复
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="config-section">
                      <div className="config-title">答复模式：</div>
                      <div className="radio-group">
                        <div className="radio-option">
                          <input
                            type="radio"
                            id={`review-immediate-${topic.id}`}
                            name={`review-mode-${topic.id}`}
                            checked={
                              editingTopic.autoReplyConfig?.reviewMode ===
                              'immediate'
                            }
                            onChange={() =>
                              setEditingTopic({
                                ...editingTopic,
                                autoReplyConfig: {
                                  ...editingTopic.autoReplyConfig!,
                                  reviewMode: 'immediate',
                                },
                              })
                            }
                          />
                          <label htmlFor={`review-immediate-${topic.id}`}>
                            直接发送（不审核）
                          </label>
                        </div>
                        <div className="radio-option">
                          <input
                            type="radio"
                            id={`review-delayed-${topic.id}`}
                            name={`review-mode-${topic.id}`}
                            checked={
                              editingTopic.autoReplyConfig?.reviewMode ===
                              'delayed'
                            }
                            onChange={() =>
                              setEditingTopic({
                                ...editingTopic,
                                autoReplyConfig: {
                                  ...editingTopic.autoReplyConfig!,
                                  reviewMode: 'delayed',
                                },
                              })
                            }
                          />
                          <label htmlFor={`review-delayed-${topic.id}`}>
                            答复前
                            <input
                              type="number"
                              className="delay-hours-input"
                              value={
                                editingTopic.autoReplyConfig?.delayHours || 1
                              }
                              onChange={(e) =>
                                setEditingTopic({
                                  ...editingTopic,
                                  autoReplyConfig: {
                                    ...editingTopic.autoReplyConfig!,
                                    delayHours: parseInt(e.target.value) || 1,
                                  },
                                })
                              }
                              min="1"
                              max="72"
                            />
                            小时可拦截
                          </label>
                        </div>
                        <div className="radio-option">
                          <input
                            type="radio"
                            id={`review-manual-${topic.id}`}
                            name={`review-mode-${topic.id}`}
                            checked={
                              editingTopic.autoReplyConfig?.reviewMode ===
                              'manual'
                            }
                            onChange={() =>
                              setEditingTopic({
                                ...editingTopic,
                                autoReplyConfig: {
                                  ...editingTopic.autoReplyConfig!,
                                  reviewMode: 'manual',
                                },
                              })
                            }
                          />
                          <label htmlFor={`review-manual-${topic.id}`}>
                            仅添加到审核列表（需手动确认）
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="automation-config">
                  <div className="config-section">
                    <div className="config-title">联动操作（OpenClaw）</div>
                    <div className="automation-input-shell">
                      <textarea
                        className={`reply-content-input ${!openClawConfigured ? 'masked-textarea' : ''}`}
                        placeholder="例如：从消息里提取日期和对象，生成一个 future RuntimeAction，在指定时间执行后续操作。"
                        value={editingTopic.automationPrompt || ''}
                        onChange={(e) => {
                          setEditingTopic({
                            ...editingTopic,
                            automationPrompt: e.target.value || undefined,
                          });
                          setEditingAutomationPreview({ status: 'idle' });
                        }}
                        rows={4}
                        readOnly={!openClawConfigured}
                        aria-disabled={!openClawConfigured}
                      />
                      {!openClawConfigured && (
                        <div className="automation-mask">
                          <button
                            type="button"
                            className="secondary-btn automation-mask-btn"
                            onClick={openOptionsPage}
                          >
                            启用 OpenClaw 以开启联动操作
                          </button>
                        </div>
                      )}
                    </div>
                    <label className="checkbox-container">
                      <input
                        type="checkbox"
                        checked={
                          editingTopic.automationRequiresApproval !== true
                        }
                        onChange={(e) =>
                          setEditingTopic({
                            ...editingTopic,
                            automationRequiresApproval: !e.target.checked,
                          })
                        }
                        disabled={!editingTopic.automationPrompt?.trim()}
                      />
                      操作无需批准
                    </label>
                    <div className="hint-text">
                      这里填写的是你定义的自然语言联动操作。命中后消息仍默认写入记忆；后续动作会由
                      RuntimeAction / OpenClaw 能力消费。
                    </div>
                    {pendingRuleImprovement?.ruleRef ===
                      getRuleRef(editingTopic) && (
                      <div className="supporting-panel automation-preview-panel">
                        <div className="supporting-title">
                          来自决策中心的改进建议
                        </div>
                        <div className="supporting-text">
                          {pendingRuleImprovement.reason}
                        </div>
                        <div className="hint-text">
                          保存后会更新原规则，并把对应确认项标记为已应用。
                        </div>
                      </div>
                    )}
                    <div className="reply-options">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => void requestAutomationPreview('edit')}
                        disabled={!editingTopic.automationPrompt?.trim()}
                      >
                        {editingAutomationPreview.status === 'loading'
                          ? '预演中...'
                          : '预演并改进'}
                      </button>
                    </div>
                    {renderAutomationPreview(
                      editingAutomationPreview,
                      (suggestedPrompt) => {
                        setEditingTopic({
                          ...editingTopic,
                          automationPrompt: suggestedPrompt,
                        });
                        setEditingAutomationPreview({ status: 'idle' });
                      },
                    )}
                    {editingTopic.automationPrompt?.trim() && (
                      <div className="automation-status-row">
                        <span
                          className={`rule-badge ${openClawConfigured ? 'info' : 'warn'}`}
                        >
                          {openClawConfigured ? '已激活' : '待激活'}
                        </span>
                        <span className="hint-text">
                          {getAutomationStatusText(editingTopic)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 编辑时的每日摘要配置区域 */}
                {(editingTopic.notifyMethod || '').includes('bot') &&
                  !editingTopic.followThread && (
                    <div className="digest-config">
                      <div className="config-section">
                        <div className="checkbox-container">
                          <input
                            type="checkbox"
                            id={`digest-enabled-${topic.id}`}
                            checked={
                              editingTopic.digestConfig?.enabled || false
                            }
                            onChange={(e) =>
                              setEditingTopic({
                                ...editingTopic,
                                digestConfig: e.target.checked
                                  ? {
                                      enabled: true,
                                      frequency:
                                        editingTopic.digestConfig?.frequency ||
                                        'daily',
                                      preferredHour:
                                        editingTopic.digestConfig
                                          ?.preferredHour ?? 8,
                                      preferredDayOfWeek:
                                        editingTopic.digestConfig
                                          ?.preferredDayOfWeek ?? 1,
                                    }
                                  : undefined,
                              })
                            }
                          />
                          <label htmlFor={`digest-enabled-${topic.id}`}>
                            使用定时摘要推送（替代即时通知）
                          </label>
                        </div>
                      </div>
                      {editingTopic.digestConfig?.enabled && (
                        <div className="digest-options">
                          <div className="config-section">
                            <div className="config-title">推送频率：</div>
                            <div className="radio-group horizontal">
                              <div className="radio-option">
                                <input
                                  type="radio"
                                  id={`digest-daily-${topic.id}`}
                                  name={`digest-freq-${topic.id}`}
                                  checked={
                                    editingTopic.digestConfig?.frequency ===
                                    'daily'
                                  }
                                  onChange={() =>
                                    setEditingTopic({
                                      ...editingTopic,
                                      digestConfig: {
                                        ...editingTopic.digestConfig!,
                                        frequency: 'daily',
                                      },
                                    })
                                  }
                                />
                                <label htmlFor={`digest-daily-${topic.id}`}>
                                  每日
                                </label>
                              </div>
                              <div className="radio-option">
                                <input
                                  type="radio"
                                  id={`digest-weekly-${topic.id}`}
                                  name={`digest-freq-${topic.id}`}
                                  checked={
                                    editingTopic.digestConfig?.frequency ===
                                    'weekly'
                                  }
                                  onChange={() =>
                                    setEditingTopic({
                                      ...editingTopic,
                                      digestConfig: {
                                        ...editingTopic.digestConfig!,
                                        frequency: 'weekly',
                                      },
                                    })
                                  }
                                />
                                <label htmlFor={`digest-weekly-${topic.id}`}>
                                  每周
                                </label>
                              </div>
                              {editingTopic.digestConfig?.frequency ===
                                'weekly' && (
                                <div className="radio-option digest-weekday-option">
                                  <label
                                    htmlFor={`digest-weekday-${topic.id}`}
                                  >
                                    发送日：
                                  </label>
                                  <select
                                    id={`digest-weekday-${topic.id}`}
                                    value={normalizeConcernedItemsDigestDayOfWeek(
                                      editingTopic.digestConfig
                                        ?.preferredDayOfWeek,
                                      1,
                                    )}
                                    onChange={(e) =>
                                      setEditingTopic({
                                        ...editingTopic,
                                        digestConfig: {
                                          ...editingTopic.digestConfig!,
                                          preferredDayOfWeek:
                                            normalizeConcernedItemsDigestDayOfWeek(
                                              e.target.value,
                                              1,
                                            ),
                                        },
                                      })
                                    }
                                  >
                                    {DIGEST_WEEKDAY_OPTIONS.map(option => (
                                      <option
                                        key={option.value}
                                        value={option.value}
                                      >
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              <div className="radio-option digest-time-option">
                                <label htmlFor={`digest-hour-${topic.id}`}>
                                  推送时间：
                                </label>
                                <input
                                  id={`digest-hour-${topic.id}`}
                                  type="number"
                                  className="delay-hours-input"
                                  value={normalizeConcernedItemsDigestHour(
                                    editingTopic.digestConfig?.preferredHour,
                                    8,
                                  )}
                                  onChange={(e) =>
                                    setEditingTopic({
                                      ...editingTopic,
                                      digestConfig: {
                                        ...editingTopic.digestConfig!,
                                        preferredHour:
                                          normalizeConcernedItemsDigestHour(
                                            e.target.value,
                                            8,
                                          ),
                                      },
                                    })
                                  }
                                  min="0"
                                  max="23"
                                />
                                <span>:00</span>
                              </div>
                            </div>
                          </div>
                          <div className="hint-text">
                            匹配消息会按这条规则自己的时间汇总推送 ·{' '}
                            {formatDigestNextDeliveryText(
                              editingTopic.digestConfig,
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                {/* 编辑时的关注后续配置区域 */}
                {editingTopic.followThread && editingTopic.followConfig && (
                  <div className="follow-thread-config">
                    {/* 原消息预览卡片 */}
                    <div className="config-section">
                      <div className="config-title">原消息：</div>
                      <div className="original-message-preview">
                        <div className="message-meta">
                          <span className="sender">
                            {editingTopic.followConfig.originalMessage.sender}
                          </span>
                          <span className="datetime">
                            {new Date(
                              editingTopic.followConfig.originalMessage
                                .datetime,
                            ).toLocaleString()}
                          </span>
                        </div>
                        <div className="message-content">
                          {editingTopic.followConfig.originalMessage.content}
                        </div>
                        <a
                          href={
                            editingTopic.followConfig.originalMessage.messageUrl
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="message-link"
                        >
                          🔗 查看原消息
                        </a>
                      </div>
                    </div>

                    {/* 过期时间提示（使用外层 expiredAt） */}
                    <div className="config-section">
                      <div className="config-title">过期时间：</div>
                      <div className="hint-text">
                        剩余{' '}
                        {editingTopic.expiredAt
                          ? Math.ceil(
                              (editingTopic.expiredAt - Date.now()) /
                                (1000 * 60 * 60 * 24),
                            )
                          : 0}{' '}
                        天（修改上方"天数"可调整）
                      </div>
                    </div>

                    {/* 🆕 通知方式（使用外层字段，多选） */}
                    <div className="config-section">
                      <div className="config-title">通知方式：</div>
                      <div className="checkbox-group">
                        <div className="checkbox-option">
                          <input
                            type="checkbox"
                            id={`edit-notify-bot-followthread-${topic.id}`}
                            checked={(editingTopic.notifyMethod || '').includes(
                              'bot',
                            )}
                            onChange={(e) => {
                              const methods = (editingTopic.notifyMethod || '')
                                .split(',')
                                .filter((m) => m);
                              if (e.target.checked) {
                                if (!methods.includes('bot'))
                                  methods.push('bot');
                              } else {
                                const idx = methods.indexOf('bot');
                                if (idx > -1) methods.splice(idx, 1);
                              }
                              setEditingTopic({
                                ...editingTopic,
                                notifyMethod: methods.join(','),
                              });
                            }}
                          />
                          <label
                            htmlFor={`edit-notify-bot-followthread-${topic.id}`}
                          >
                            Glip推送
                          </label>
                        </div>
                        <div className="checkbox-option">
                          <input
                            type="checkbox"
                            id={`edit-notify-chrome-followthread-${topic.id}`}
                            checked={(editingTopic.notifyMethod || '').includes(
                              'chrome',
                            )}
                            onChange={(e) => {
                              const methods = (editingTopic.notifyMethod || '')
                                .split(',')
                                .filter((m) => m);
                              if (e.target.checked) {
                                if (!methods.includes('chrome'))
                                  methods.push('chrome');
                              } else {
                                const idx = methods.indexOf('chrome');
                                if (idx > -1) methods.splice(idx, 1);
                              }
                              setEditingTopic({
                                ...editingTopic,
                                notifyMethod: methods.join(','),
                              });
                            }}
                          />
                          <label
                            htmlFor={`edit-notify-chrome-followthread-${topic.id}`}
                          >
                            Chrome通知
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* 🆕 通知频率（使用外层字段） */}
                    <div className="config-section">
                      <div className="config-title">通知频率：</div>
                      <div className="radio-group">
                        <div className="radio-option">
                          <input
                            type="radio"
                            id={`edit-freq-immediate-${topic.id}`}
                            name={`edit-notify-frequency-${topic.id}`}
                            checked={
                              editingTopic.notifyFrequency === 'immediate'
                            }
                            onChange={() =>
                              setEditingTopic({
                                ...editingTopic,
                                notifyFrequency: 'immediate',
                              })
                            }
                          />
                          <label htmlFor={`edit-freq-immediate-${topic.id}`}>
                            立即通知（每条新消息）
                          </label>
                        </div>
                        <div className="radio-option">
                          <input
                            type="radio"
                            id={`edit-freq-merged-${topic.id}`}
                            name={`edit-notify-frequency-${topic.id}`}
                            checked={editingTopic.notifyFrequency === 'merged'}
                            onChange={() =>
                              setEditingTopic({
                                ...editingTopic,
                                notifyFrequency: 'merged',
                              })
                            }
                          />
                          <label htmlFor={`edit-freq-merged-${topic.id}`}>
                            合并通知（定期汇总）
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* 关键词过滤（可选） */}
                    <div className="config-section">
                      <div className="config-title">关键词过滤（可选）：</div>
                      <input
                        type="text"
                        className="keyword-filter-input"
                        placeholder="输入关键词，用逗号分隔（留空表示不过滤）"
                        value={
                          editingTopic.followConfig.keywordFilter?.join(', ') ||
                          ''
                        }
                        onChange={(e) =>
                          setEditingTopic({
                            ...editingTopic,
                            followConfig: {
                              ...editingTopic.followConfig!,
                              keywordFilter: e.target.value
                                .split(',')
                                .map((k) => k.trim())
                                .filter((k) => k.length > 0),
                            },
                          })
                        }
                      />
                      <div className="hint-text">
                        只有包含这些关键词的回复才会触发通知
                      </div>
                    </div>

                    {/* 关联消息统计 */}
                    {editingTopic.followConfig.relatedMessages &&
                      editingTopic.followConfig.relatedMessages.length > 0 && (
                        <div className="config-section">
                          <div className="config-title">关联消息：</div>
                          <div className="hint-text">
                            已捕获{' '}
                            {editingTopic.followConfig.relatedMessages.length}{' '}
                            条关联消息
                          </div>
                        </div>
                      )}
                  </div>
                )}

                <div className="form-buttons">
                  <button onClick={handleSaveEdit}>保存</button>
                  <button
                    onClick={() => {
                      setEditingTopic(null);
                      setEditingAutomationPreview({ status: 'idle' });
                      setPendingRuleImprovement(null);
                    }}
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="topic-display">
                <div className="rule-card-top">
                  <div className="drag-handle">⋮⋮</div>
                  <span className={`rule-badge ${getRuleStatus(topic).tone}`}>
                    {getRuleStatus(topic).text}
                  </span>
                  <span className="rule-badge muted">
                    {getRuleExpiryText(topic)}
                  </span>
                  {topic.automationPrompt?.trim() && (
                    <span className="rule-badge muted">
                      {topic.automationRequiresApproval === true
                        ? '需批准'
                        : '免批准'}
                    </span>
                  )}
                  <span className="rule-ref">{getRuleRef(topic)}</span>
                </div>

                <div className="rule-block when-block">
                  <span className="block-label when-label">当</span>
                  <div className="block-body">
                    <div className="topic-text">{topic.text}</div>
	                    <div className="scope-chip-row">
	                      {getScopeChips(topic).map((chip) => (
	                        <span key={chip} className="scope-chip">
	                          {chip}
	                        </span>
	                      ))}
	                    </div>
	                    {getTopicScopeGuidanceText(topic) && (
	                      <div className="scope-guidance compact">
	                        {getTopicScopeGuidanceText(topic)}
	                      </div>
	                    )}
	                  </div>
	                </div>

                <div className="rule-block then-block">
                  <span className="block-label then-label">则</span>
                  <div className="block-body">
                    <div className="capability-row">
                      {getCapabilityChips(topic).map((chip) => (
                        <span key={chip} className="capability-chip">
                          {chip}
                        </span>
                      ))}
                    </div>
                    {topic.followThread && topic.followConfig && (
                      <div className="supporting-panel">
                        <div className="supporting-title">关注后续上下文</div>
                        <div className="supporting-text">
                          原消息来自 {topic.followConfig.originalMessage.sender}{' '}
                          · {topic.followConfig.originalMessage.teamName}
                        </div>
                        <div className="supporting-text">
                          {getFollowThreadSummary(topic)}
                        </div>
                      </div>
                    )}
                    {topic.autoReply && topic.autoReplyConfig?.replyContent && (
                      <div className="supporting-panel">
                        <div className="supporting-title">自动答复草稿</div>
                        <div className="supporting-text">
                          {topic.autoReplyConfig.replyContent}
                        </div>
                      </div>
                    )}
                    {topic.automationPrompt?.trim() && (
                      <div className="supporting-panel">
                        <div className="automation-panel-head">
                          <div className="supporting-title">
                            关联操作
                            <span
                              className={`rule-badge ${openClawConfigured ? 'info' : 'warn'}`}
                              style={{ marginLeft: 8 }}
                            >
                              {openClawConfigured ? 'OpenClaw' : '待激活'}
                            </span>
                            <span
                              className="rule-badge muted"
                              style={{ marginLeft: 8 }}
                            >
                              {topic.automationRequiresApproval === true
                                ? '需批准'
                                : '免批准'}
                            </span>
                          </div>
                          {getAutomationActionSummary(topic)?.total ? (
                            <span className="automation-summary-badge">
                              {getAutomationActionSummary(topic)!.total} 个动作
                            </span>
                          ) : null}
                        </div>
                        <div className="supporting-text">
                          {topic.automationPrompt}
                        </div>
                        <div className="supporting-text muted-copy">
                          {getAutomationStatusText(topic)}
                        </div>
                        <div className="supporting-text muted-copy">
                          {getAutomationActionSummaryText(topic)}
                        </div>
                        <div className="supporting-actions">
                          <button
                            className="secondary-btn"
                            onClick={() => openActionQueueForRule(topic)}
                          >
                            📋 查看动作队列
                          </button>
                          {!openClawConfigured && (
                            <button
                              className="secondary-btn"
                              onClick={openOptionsPage}
                            >
                              连接 OpenClaw
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-actions">
                  <button onClick={() => handleEdit(topic)}>✏️ 编辑</button>
                  <button
                    className="danger-btn"
                    onClick={() => handleDelete(topics.indexOf(topic))}
                  >
                    🗑 删除
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showAddForm ? (
        <div className="add-topic-form" ref={addFormRef}>
          <div className="form-title-row">
            <div>
              <h4>新建记忆入口规则</h4>
              <p>命中后默认写入记忆，下面勾选的是可叠加的用户动作。</p>
            </div>
          </div>
          <div className="add-text-field">
            <input
              className="text-input"
              placeholder="例如：Standup 里有人提到 blocker；或 Leave Chat 里出现与我相关的请假消息"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
            />
          </div>
          <div className="add-controls">
            <div className="expiry-field">
              <input
                type="number"
                className="expiry-input"
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
                min="1"
                placeholder="过期天数"
              />
              <div className="tooltip-container">
                <span className="info-icon">i</span>
                <span className="tooltip-text">不自动过期请留空</span>
              </div>
            </div>
            <div className="checkbox-container">
              <input
                type="checkbox"
                id="new-notify-bot"
                checked={(newNotifyMethod || '').includes('bot')}
                onChange={(e) => {
                  const methods = (newNotifyMethod || '')
                    .split(',')
                    .filter((m) => m);
                  if (e.target.checked) {
                    if (!methods.includes('bot')) methods.push('bot');
                  } else {
                    const idx = methods.indexOf('bot');
                    if (idx > -1) methods.splice(idx, 1);
                    setNewMentionMe(false);
                  }
                  setNewNotifyMethod(methods.join(','));
                }}
              />
              <label htmlFor="new-notify-bot">Glip推送</label>
            </div>
            <div className="checkbox-container">
              <input
                type="checkbox"
                id="new-notify-chrome"
                checked={(newNotifyMethod || '').includes('chrome')}
                onChange={(e) => {
                  const methods = (newNotifyMethod || '')
                    .split(',')
                    .filter((m) => m);
                  if (e.target.checked) {
                    if (!methods.includes('chrome')) methods.push('chrome');
                  } else {
                    const idx = methods.indexOf('chrome');
                    if (idx > -1) methods.splice(idx, 1);
                  }
                  setNewNotifyMethod(methods.join(','));
                }}
              />
              <label htmlFor="new-notify-chrome">Chrome通知</label>
            </div>
            <div className="checkbox-container">
              <input
                type="checkbox"
                id="new-mention-me"
                checked={newMentionMe}
                disabled={!(newNotifyMethod || '').includes('bot')}
                onChange={(e) => setNewMentionMe(e.target.checked)}
              />
              <label htmlFor="new-mention-me">@我</label>
            </div>
            <div className="checkbox-container">
              <input
                type="checkbox"
                id="new-auto-reply"
                checked={newAutoReply}
                onChange={(e) => setNewAutoReply(e.target.checked)}
              />
              <label htmlFor="new-auto-reply">自动答复</label>
            </div>
            <div className="checkbox-container">
              <input
                type="checkbox"
                id="new-follow-thread"
                checked={newFollowThread}
                onChange={(e) => setNewFollowThread(e.target.checked)}
              />
              <label htmlFor="new-follow-thread">关注后续</label>
            </div>
          </div>

          {/* 通用匹配条件（可编辑） */}
	          <div className="filter-conditions">
            <div className="filter-item">
              <label htmlFor="new-filter-sender">匹配发送人:</label>
              <input
                type="text"
                id="new-filter-sender"
                placeholder="留空表示不限发送人"
                value={newFilterSender}
                onChange={(e) => setNewFilterSender(e.target.value)}
              />
            </div>
            <div className="filter-item">
              <label htmlFor="new-filter-group">匹配群组:</label>
              <input
                type="text"
                id="new-filter-group"
                placeholder="留空表示不限群组"
                value={newFilterGroup}
                onChange={(e) => setNewFilterGroup(e.target.value)}
              />
	            </div>
	          </div>
	          {getScopeGuidanceText({
	            filterSender: newFilterSender,
	            filterGroup: newFilterGroup,
	          }) && (
	            <div className="scope-guidance">
	              {getScopeGuidanceText({
	                filterSender: newFilterSender,
	                filterGroup: newFilterGroup,
	              })}
	            </div>
	          )}

          <div className="rule-path-preview" aria-label="新规则触发与动作预览">
            <div className="rule-path-step">
              <span className="rule-path-label">当</span>
              <strong>{newTopic.trim() || '未填写消息模式'}</strong>
              <p>{getScopeSummaryText({
                filterSender: newFilterSender,
                filterGroup: newFilterGroup,
              })}</p>
            </div>
            <div className="rule-path-step then">
              <span className="rule-path-label">则</span>
              <div className="rule-action-chip-row">
                {newRuleActionItems.map((item) => (
                  <span className="rule-badge muted" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

	          {/* 每日摘要配置区域（仅在启用 Glip 推送且非关注后续模式时显示） */}
          {(newNotifyMethod || '').includes('bot') && !newFollowThread && (
            <div className="digest-config">
              <div className="config-section">
                <div className="checkbox-container">
                  <input
                    type="checkbox"
                    id="new-digest-enabled"
                    checked={newDigestEnabled}
                    onChange={(e) => setNewDigestEnabled(e.target.checked)}
                  />
                  <label htmlFor="new-digest-enabled">
                    使用定时摘要推送（替代即时通知）
                  </label>
                </div>
              </div>
              {newDigestEnabled && (
                <div className="digest-options">
                  <div className="config-section">
                    <div className="config-title">推送频率：</div>
                    <div className="radio-group horizontal">
                      <div className="radio-option">
                        <input
                          type="radio"
                          id="new-digest-daily"
                          name="new-digest-freq"
                          checked={newDigestFrequency === 'daily'}
                          onChange={() => setNewDigestFrequency('daily')}
                        />
                        <label htmlFor="new-digest-daily">每日</label>
                      </div>
                      <div className="radio-option">
                        <input
                          type="radio"
                          id="new-digest-weekly"
                          name="new-digest-freq"
                          checked={newDigestFrequency === 'weekly'}
                          onChange={() => setNewDigestFrequency('weekly')}
                        />
                        <label htmlFor="new-digest-weekly">每周</label>
                      </div>
                      {newDigestFrequency === 'weekly' && (
                        <div className="radio-option digest-weekday-option">
                          <label htmlFor="new-digest-weekday">发送日：</label>
                          <select
                            id="new-digest-weekday"
                            value={newDigestDayOfWeek}
                            onChange={(e) =>
                              setNewDigestDayOfWeek(
                                normalizeConcernedItemsDigestDayOfWeek(
                                  e.target.value,
                                  1,
                                ),
                              )
                            }
                          >
                            {DIGEST_WEEKDAY_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="radio-option digest-time-option">
                        <label htmlFor="new-digest-hour">推送时间：</label>
                        <input
                          id="new-digest-hour"
                          type="number"
                          className="delay-hours-input"
                          value={newDigestHour}
                          onChange={(e) =>
                            setNewDigestHour(
                              normalizeConcernedItemsDigestHour(
                                e.target.value,
                                8,
                              ),
                            )
                          }
                          min="0"
                          max="23"
                        />
                        <span>:00</span>
                      </div>
                    </div>
                  </div>
                  <div className="hint-text">
                    匹配消息会按这条规则自己的时间汇总推送 ·{' '}
                    {formatDigestNextDeliveryText({
                      frequency: newDigestFrequency,
                      preferredHour: newDigestHour,
                      preferredDayOfWeek: newDigestDayOfWeek,
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 自动答复配置区域 */}
          {newAutoReply && (
            <div className="auto-reply-config">
              <div className="config-section">
                <div className="config-title">回复内容：</div>
                <textarea
                  className="reply-content-input"
                  placeholder="输入回复内容模板，或点击AI生成"
                  value={newAutoReplyConfig.replyContent}
                  onChange={(e) =>
                    setNewAutoReplyConfig({
                      ...newAutoReplyConfig,
                      replyContent: e.target.value,
                    })
                  }
                  rows={3}
                />
                <div className="reply-options">
                  <button
                    type="button"
                    className="ai-generate-btn"
                    onClick={handleGenerateReplyForNew}
                    disabled={isGeneratingReply}
                  >
                    {isGeneratingReply ? '生成中...' : '🤖 AI 生成建议'}
                  </button>
                  <div className="checkbox-container">
                    <input
                      type="checkbox"
                      id="new-use-ai"
                      checked={newAutoReplyConfig.useAIGenerate}
                      onChange={(e) =>
                        setNewAutoReplyConfig({
                          ...newAutoReplyConfig,
                          useAIGenerate: e.target.checked,
                        })
                      }
                    />
                    <label htmlFor="new-use-ai">每次AI生成类似答复</label>
                  </div>
                </div>
              </div>

              <div className="config-section">
                <div className="config-title">答复模式：</div>
                <div className="radio-group">
                  <div className="radio-option">
                    <input
                      type="radio"
                      id="new-review-immediate"
                      name="new-review-mode"
                      checked={newAutoReplyConfig.reviewMode === 'immediate'}
                      onChange={() =>
                        setNewAutoReplyConfig({
                          ...newAutoReplyConfig,
                          reviewMode: 'immediate',
                        })
                      }
                    />
                    <label htmlFor="new-review-immediate">
                      直接发送（不审核）
                    </label>
                  </div>
                  <div className="radio-option">
                    <input
                      type="radio"
                      id="new-review-delayed"
                      name="new-review-mode"
                      checked={newAutoReplyConfig.reviewMode === 'delayed'}
                      onChange={() =>
                        setNewAutoReplyConfig({
                          ...newAutoReplyConfig,
                          reviewMode: 'delayed',
                        })
                      }
                    />
                    <label htmlFor="new-review-delayed">
                      答复前
                      <input
                        type="number"
                        className="delay-hours-input"
                        value={newAutoReplyConfig.delayHours || 1}
                        onChange={(e) =>
                          setNewAutoReplyConfig({
                            ...newAutoReplyConfig,
                            delayHours: parseInt(e.target.value) || 1,
                          })
                        }
                        min="1"
                        max="72"
                      />
                      小时可拦截
                    </label>
                  </div>
                  <div className="radio-option">
                    <input
                      type="radio"
                      id="new-review-manual"
                      name="new-review-mode"
                      checked={newAutoReplyConfig.reviewMode === 'manual'}
                      onChange={() =>
                        setNewAutoReplyConfig({
                          ...newAutoReplyConfig,
                          reviewMode: 'manual',
                        })
                      }
                    />
                    <label htmlFor="new-review-manual">
                      仅添加到审核列表（需手动确认）
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="automation-config">
            <div className="config-section">
              <div className="config-title">联动操作（OpenClaw）</div>
              <div className="automation-input-shell">
                <textarea
                  className={`reply-content-input ${!openClawConfigured ? 'masked-textarea' : ''}`}
                  placeholder="例如：从消息中提取日期和对象，生成一个 future RuntimeAction，在指定时间执行后续动作。留空表示不创建联动操作。"
                  value={newAutomationPrompt}
                  onChange={(e) => {
                    setNewAutomationPrompt(e.target.value);
                    setNewAutomationPreview({ status: 'idle' });
                  }}
                  rows={4}
                  readOnly={!openClawConfigured}
                  aria-disabled={!openClawConfigured}
                />
                {!openClawConfigured && (
                  <div className="automation-mask">
                    <button
                      type="button"
                      className="secondary-btn automation-mask-btn"
                      onClick={openOptionsPage}
                    >
                      启用 OpenClaw 以开启联动操作
                    </button>
                  </div>
                )}
              </div>
              <div className="reply-options">
                <button
                  type="button"
                  className="ai-generate-btn"
                  onClick={() => void requestLinkedActionSuggestion(true)}
                  disabled={linkedActionSuggestionStatus === 'loading'}
                >
                  {linkedActionSuggestionStatus === 'loading'
                    ? '生成中...'
                    : linkedActionSuggestionStatus === 'ready'
                      ? '🔄 重新建议'
                      : '✨ 生成联动操作建议'}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => void requestAutomationPreview('new')}
                  disabled={!newAutomationPrompt.trim()}
                >
                  {newAutomationPreview.status === 'loading'
                    ? '预演中...'
                    : '预演并改进'}
                </button>
                {linkedActionSuggestionSource ? (
                  <span className="hint-text suggestion-source-text">
                    来源：{linkedActionSuggestionSource}
                  </span>
                ) : null}
              </div>
              {linkedActionSuggestionStatus === 'loading' && (
                <div className="hint-text">
                  正在优先参考你已有的联动操作历史；如果没有合适历史，会自动回退到内置样例目录。
                </div>
              )}
              {linkedActionSuggestionStatus === 'failed' && (
                <div className="supporting-panel linked-action-feedback-panel">
                  <div className="supporting-title">建议生成失败</div>
                  <div className="supporting-text muted-copy">
                    {linkedActionSuggestionError}
                  </div>
                  <div className="supporting-actions">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => void requestLinkedActionSuggestion(true)}
                    >
                      重试
                    </button>
                    {linkedActionSuggestionFallback ? (
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => {
                          setNewAutomationPrompt(
                            linkedActionSuggestionFallback,
                          );
                          setNewAutomationPreview({ status: 'idle' });
                          setLinkedActionSuggestionStatus('ready');
                          setLinkedActionSuggestionSource('内置兜底样例');
                          setLinkedActionSuggestionError('');
                        }}
                      >
                        使用兜底样例
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
              {renderAutomationPreview(newAutomationPreview, (suggestedPrompt) => {
                setNewAutomationPrompt(suggestedPrompt);
                setNewAutomationPreview({ status: 'idle' });
              })}
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={!newAutomationRequiresApproval}
                  onChange={(e) =>
                    setNewAutomationRequiresApproval(!e.target.checked)
                  }
                  disabled={!newAutomationPrompt.trim()}
                />
                操作无需批准
              </label>
              <div className="hint-text">
                这里保存的是手动规则的自然语言联动操作。命中后仍默认写入记忆；如果
                OpenClaw 还没配置，则会以待激活状态保存。
              </div>
              {newAutomationPrompt.trim() && (
                <div className="automation-status-row">
                  <span
                    className={`rule-badge ${openClawConfigured ? 'info' : 'warn'}`}
                  >
                    {openClawConfigured ? '已激活' : '待激活'}
                  </span>
                  <span className="hint-text">
                    {openClawConfigured
                      ? newAutomationRequiresApproval
                        ? 'OpenClaw 已连接；这条关联操作会生成 RuntimeAction，但执行外部写操作前仍需你批准。'
                        : 'OpenClaw 已连接；这条关联操作会生成 RuntimeAction，并按计划自动执行外部写操作。'
                      : newAutomationRequiresApproval
                        ? 'OpenClaw 未配置 — 关联操作描述会先保存，但当前无法进入需批准的外部执行。'
                        : 'OpenClaw 未配置 — 关联操作描述会先保存，等待后续激活自动执行。'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 关注后续配置区域 */}
          {newFollowThread && newFollowConfig && (
            <div className="follow-thread-config">
              {/* 原消息预览卡片 */}
              <div className="config-section">
                <div className="config-title">原消息：</div>
                <div className="original-message-preview">
                  <div className="message-meta">
                    <span className="sender">
                      {newFollowConfig.originalMessage.sender}
                    </span>
                    <span className="datetime">
                      {new Date(
                        newFollowConfig.originalMessage.datetime,
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="message-content">
                    {newFollowConfig.originalMessage.content}
                  </div>
                  <a
                    href={newFollowConfig.originalMessage.messageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="message-link"
                  >
                    🔗 查看原消息
                  </a>
                </div>
              </div>

              {/* 🆕 通知方式（使用外层状态） */}
              <div className="config-section">
                <div className="config-title">通知方式：</div>
                <div className="radio-group">
                  <div className="radio-option">
                    <input
                      type="radio"
                      id="notify-bot"
                      name="notify-method"
                      checked={newNotifyMethod === 'bot'}
                      onChange={() => setNewNotifyMethod('bot')}
                    />
                    <label htmlFor="notify-bot">Glip推送</label>
                  </div>
                  <div className="radio-option">
                    <input
                      type="radio"
                      id="notify-chrome"
                      name="notify-method"
                      checked={newNotifyMethod === 'chrome'}
                      onChange={() => setNewNotifyMethod('chrome')}
                    />
                    <label htmlFor="notify-chrome">Chrome通知</label>
                  </div>
                  <div className="radio-option">
                    <input
                      type="radio"
                      id="notify-both"
                      name="notify-method"
                      checked={newNotifyMethod === 'bot,chrome'}
                      onChange={() => setNewNotifyMethod('bot,chrome')}
                    />
                    <label htmlFor="notify-both">两者都推送</label>
                  </div>
                </div>
              </div>

              {/* 🆕 通知频率（使用外层状态） */}
              <div className="config-section">
                <div className="config-title">通知频率：</div>
                <div className="radio-group">
                  <div className="radio-option">
                    <input
                      type="radio"
                      id="freq-immediate"
                      name="notify-frequency"
                      checked={newNotifyFrequency === 'immediate'}
                      onChange={() => setNewNotifyFrequency('immediate')}
                    />
                    <label htmlFor="freq-immediate">
                      立即通知（每条新消息）
                    </label>
                  </div>
                  <div className="radio-option">
                    <input
                      type="radio"
                      id="freq-merged"
                      name="notify-frequency"
                      checked={newNotifyFrequency === 'merged'}
                      onChange={() => setNewNotifyFrequency('merged')}
                    />
                    <label htmlFor="freq-merged">合并通知（定期汇总）</label>
                  </div>
                </div>
              </div>

              {/* 关键词过滤（可选） */}
              <div className="config-section">
                <div className="config-title">关键词过滤（可选）：</div>
                <input
                  type="text"
                  className="keyword-filter-input"
                  placeholder="输入关键词，用逗号分隔（留空表示不过滤）"
                  value={newFollowConfig.keywordFilter?.join(', ') || ''}
                  onChange={(e) =>
                    setNewFollowConfig({
                      ...newFollowConfig,
                      keywordFilter: e.target.value
                        .split(',')
                        .map((k) => k.trim())
                        .filter((k) => k.length > 0),
                    })
                  }
                />
                <div className="hint-text">
                  只有包含这些关键词的回复才会触发通知
                </div>
              </div>
            </div>
          )}

          <div className="form-buttons">
            <button onClick={handleAdd}>确认</button>
            <button
              onClick={() => {
                resetNewRuleForm();
                setShowAddForm(false);
              }}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}

      <style>{`
                .topic-modal {
                    padding: 16px;
                }

                .warning-banner {
                    background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
                    border: 2px solid #ffc107;
                    border-radius: 8px;
                    padding: 12px 16px;
                    margin-bottom: 16px;
                    box-shadow: 0 2px 8px rgba(255, 193, 7, 0.2);
                }

                .warning-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .warning-icon {
                    font-size: 24px;
                    flex-shrink: 0;
                }

                .warning-text {
                    flex: 1;
                    color: #856404;
                    font-size: 14px;
                    font-weight: 500;
                    line-height: 1.5;
                }

                .warning-action-btn {
                    background-color: #ff9800;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 8px 16px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                    box-shadow: 0 2px 4px rgba(255, 152, 0, 0.3);
                }

                .warning-action-btn:hover {
                    background-color: #f57c00;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(255, 152, 0, 0.4);
                }

                .warning-action-btn:active {
                    transform: translateY(0);
                    box-shadow: 0 2px 4px rgba(255, 152, 0, 0.3);
                }
                
                .topic-list {
                    margin-bottom: 16px;
                }
                
                .topic-item {
                    display: flex;
                    padding: 8px;
                    border-bottom: 1px solid #eee;
                    cursor: grab;
                    transition: background-color 0.2s;
                }
                
                .topic-item.drag-over {
                    background-color: #f0f0f0;
                    border: 1px dashed #aaa;
                }
                
                .topic-display {
                    display: flex;
                    width: 100%;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .drag-handle {
                    color: #999;
                    margin-right: 8px;
                    cursor: grab;
                    font-size: 16px;
                    user-select: none;
                }
                
                .topic-edit-form {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    gap: 8px;
                }
                
                .edit-text-field, .add-text-field {
                    width: 100%;
                }
                
                .text-input {
                    width: 100%;
                    box-sizing: border-box;
                }
                
                .edit-controls, .add-controls {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                    flex-wrap: wrap;
                }
                
                .expiry-field {
                    display: flex;
                    align-items: center;
                    position: relative;
                }
                
                .expiry-input {
                    width: 60px;
                    text-align: center;
                }
                
                .tooltip-container {
                    position: relative;
                    display: inline-block;
                    margin-left: 5px;
                }
                
                .info-icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background-color: #ccc;
                    color: white;
                    font-size: 12px;
                    font-style: italic;
                    cursor: help;
                }
                
                .tooltip-text {
                    visibility: hidden;
                    width: 120px;
                    background-color: #555;
                    color: #fff;
                    text-align: center;
                    border-radius: 6px;
                    padding: 5px;
                    position: absolute;
                    z-index: 1;
                    bottom: 125%;
                    left: 50%;
                    margin-left: -60px;
                    opacity: 0;
                    transition: opacity 0.3s;
                    font-size: 12px;
                }
                
                .tooltip-text::after {
                    content: "";
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    margin-left: -5px;
                    border-width: 5px;
                    border-style: solid;
                    border-color: #555 transparent transparent transparent;
                }
                
                .tooltip-container:hover .tooltip-text {
                    visibility: visible;
                    opacity: 1;
                }
                
                .topic-text {
                    flex: 1;
                }
                
                .topic-expiry {
                    margin: 0 16px;
                    color: #666;
                }

                .glip-indicator {
                    color: #4CAF50;
                    font-weight: bold;
                    font-size: 0.9em;
                }

                .mention-indicator {
                    color: #f44336;
                    font-weight: bold;
                }
                
                button {
                    margin: 0 4px;
                    padding: 4px 8px;
                    cursor: pointer;
                }
                
                input {
                    padding: 4px 8px;
                }
                
                .add-topic-form {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-top: 16px;
                    width: 100%;
                }

                .checkbox-container {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .import-export-buttons {
                    margin-top: 16px;
                    display: flex;
                    gap: 8px;
                }

                .import-button {
                    display: inline-block;
                    padding: 4px 8px;
                    background-color: #f1f1f1;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    cursor: pointer;
                }

                .import-button:hover {
                    background-color: #e8e8e8;
                }

                /* 通用匹配条件样式 */
                .filter-conditions {
                    margin-top: 12px;
                    padding: 10px 12px;
                    background-color: #f5f5f5;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .filter-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .filter-item label {
                    font-size: 13px;
                    color: #555;
                    min-width: 80px;
                    white-space: nowrap;
                }

                .filter-item input[type="text"] {
                    flex: 1;
                    padding: 6px 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 13px;
                }

                .filter-item input[type="text"]:focus {
                    border-color: #4CAF50;
                    outline: none;
                }

                /* 自动答复配置样式 */
                .auto-reply-config {
                    margin-top: 12px;
                    padding: 12px;
                    background-color: #f9f9f9;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                }

                .follow-thread-config {
                    margin-top: 12px;
                    padding: 12px;
                    background-color: #faf5ff;
                    border: 1px solid #e1bee7;
                    border-radius: 6px;
                }

                .original-message-preview {
                    padding: 10px;
                    background-color: white;
                    border: 1px solid #e1bee7;
                    border-radius: 4px;
                    font-size: 12px;
                }

                .message-meta {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    padding-bottom: 6px;
                    border-bottom: 1px solid #f0f0f0;
                }

                .message-meta .sender {
                    font-weight: 600;
                    color: #9c27b0;
                }

                .message-meta .datetime {
                    color: #666;
                    font-size: 11px;
                }

                .message-content {
                    color: #333;
                    line-height: 1.4;
                    margin-bottom: 8px;
                    max-height: 80px;
                    overflow-y: auto;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }

                .message-link {
                    color: #9c27b0;
                    text-decoration: none;
                    font-size: 11px;
                }

                .message-link:hover {
                    text-decoration: underline;
                }

                .keyword-filter-input {
                    width: 100%;
                    box-sizing: border-box;
                    padding: 6px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-family: inherit;
                    font-size: 12px;
                }

                .hint-text {
                    margin-top: 4px;
                    font-size: 11px;
                    color: #666;
                    font-style: italic;
                }

                .config-section {
                    margin-bottom: 12px;
                }

                .config-section:last-child {
                    margin-bottom: 0;
                }

                .config-title {
                    font-weight: 500;
                    margin-bottom: 6px;
                    color: #333;
                    font-size: 13px;
                }

                .config-options {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .reply-content-input {
                    width: 100%;
                    box-sizing: border-box;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-family: inherit;
                    font-size: 13px;
                    resize: vertical;
                }

                .reply-content-input:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }

                .automation-input-shell {
                    position: relative;
                    overflow: hidden;
                    border-radius: 12px;
                }

                .masked-textarea {
                    filter: blur(1px);
                    opacity: 0.86;
                    user-select: none;
                    pointer-events: none;
                }

                .automation-mask {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 14px;
                    border-radius: inherit;
                    background: rgba(15, 23, 42, 0.22);
                }

                .automation-mask-btn {
                    backdrop-filter: blur(10px);
                    background: rgba(15, 23, 42, 0.72);
                }

                .suggestion-source-text {
                    margin-top: 0;
                }

                .linked-action-feedback-panel {
                    margin-top: 12px;
                }

                .automation-preview-panel {
                    margin-top: 12px;
                }

                .automation-preview-panel.warning {
                    border-color: rgba(245, 158, 11, 0.28);
                    background: rgba(120, 53, 15, 0.18);
                }

                .automation-preview-actions,
                .automation-preview-warnings {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-top: 10px;
                }

                .automation-preview-action {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                    padding: 8px 10px;
                    border-radius: 10px;
                    background: rgba(15, 23, 42, 0.38);
                    color: #dbeafe;
                    font-size: 13px;
                }

                .automation-preview-warning {
                    padding: 8px 10px;
                    border-radius: 10px;
                    font-size: 13px;
                    line-height: 1.45;
                    color: #fde68a;
                    background: rgba(245, 158, 11, 0.12);
                    border: 1px solid rgba(245, 158, 11, 0.18);
                }

                .automation-preview-warning.critical {
                    color: #fecaca;
                    background: rgba(239, 68, 68, 0.12);
                    border-color: rgba(239, 68, 68, 0.24);
                }

                .automation-preview-warning.info {
                    color: #bae6fd;
                    background: rgba(14, 165, 233, 0.12);
                    border-color: rgba(14, 165, 233, 0.2);
                }

                .automation-suggestion-box {
                    margin-top: 12px;
                    padding: 12px;
                    border-radius: 12px;
                    background: rgba(8, 47, 73, 0.28);
                    border: 1px solid rgba(125, 211, 252, 0.18);
                }

                .automation-suggestion-box .secondary-btn {
                    margin-top: 10px;
                }

                .reply-options {
                    margin-top: 8px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .ai-generate-btn {
                    padding: 4px 12px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }

                .ai-generate-btn:hover {
                    background-color: #45a049;
                }

                .ai-generate-btn:disabled {
                    background-color: #ccc;
                    cursor: not-allowed;
                }

                .radio-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .radio-option {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .radio-option input[type="radio"] {
                    margin: 0;
                }

                .delay-hours-input {
                    width: 50px;
                    text-align: center;
                    margin: 0 4px;
                    padding: 2px 4px;
                }

                .digest-weekday-option select {
                    min-width: 82px;
                    padding: 4px 8px;
                }

                .digest-time-option span {
                    color: inherit;
                }

                .form-buttons {
                    margin-top: 12px;
                    display: flex;
                    gap: 8px;
                }

                .auto-reply-indicator {
                    color: #2196F3;
                    font-weight: bold;
                    font-size: 0.9em;
                    margin-left: 8px;
                }

                .follow-thread-indicator {
                    color: #9c27b0;
                    font-weight: bold;
                    font-size: 0.9em;
                    margin-left: 8px;
                }

                .triggered-by-info {
                    font-size: 11px;
                    color: #666;
                    margin-top: 4px;
                    padding: 4px 8px;
                    background-color: #f5f5f5;
                    border-radius: 4px;
                }

                /* 每日摘要配置样式 */
                .digest-config {
                    margin-top: 12px;
                    padding: 12px;
                    background-color: #f0f7ff;
                    border: 1px solid #b3d4fc;
                    border-radius: 6px;
                }

                .digest-options {
                    margin-top: 8px;
                }

                .digest-indicator {
                    color: #1976d2;
                    font-weight: bold;
                    font-size: 0.9em;
                    margin-left: 8px;
                }

                .radio-group.horizontal {
                    flex-direction: row;
                    flex-wrap: wrap;
                    gap: 16px;
                }

                .topic-modal {
                    padding: 20px;
                    background: linear-gradient(135deg, #0b1020 0%, #111827 52%, #0f172a 100%);
                    color: #e5eefb;
                    min-height: 100vh;
                    box-sizing: border-box;
                    overflow-x: hidden;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }

                .page-header {
                    margin-bottom: 14px;
                }

                .page-eyebrow {
                    display: inline-flex;
                    padding: 4px 10px;
                    border-radius: 999px;
                    background: rgba(34, 211, 238, 0.12);
                    color: #67e8f9;
                    font-size: 12px;
                    font-weight: 700;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                    margin-bottom: 10px;
                }

                .page-copy h2 {
                    margin: 0 0 8px;
                    font-size: 28px;
                    color: #f8fbff;
                }

                .page-copy p {
                    margin: 0;
                    color: #b6c2d8;
                    line-height: 1.65;
                }

                .status-strip {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-bottom: 14px;
                }

                .status-pill {
                    display: inline-flex;
                    align-items: center;
                    padding: 6px 12px;
                    border-radius: 999px;
                    font-size: 12px;
                    font-weight: 600;
                    background: rgba(148, 163, 184, 0.16);
                    color: #cbd5e1;
                }

                .status-pill.ok {
                    background: rgba(34, 197, 94, 0.16);
                    color: #86efac;
                }

                .status-pill.warn {
                    background: rgba(245, 158, 11, 0.16);
                    color: #fde68a;
                }

                .status-pill.info {
                    background: rgba(59, 130, 246, 0.16);
                    color: #93c5fd;
                }

                .status-pill.muted {
                    background: rgba(15, 23, 42, 0.72);
                    color: #94a3b8;
                }

                .info-banner {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    padding: 14px 16px;
                    border-radius: 16px;
                    margin-bottom: 16px;
                    border: 1px solid rgba(59, 130, 246, 0.24);
                    background: rgba(59, 130, 246, 0.1);
                    color: #dbeafe;
                    line-height: 1.6;
                }

                .manual-banner strong {
                    color: #f8fbff;
                }

                .warning-banner {
                    background: rgba(245, 158, 11, 0.14);
                    border: 1px solid rgba(245, 158, 11, 0.32);
                    border-radius: 16px;
                    padding: 14px 16px;
                    margin-bottom: 16px;
                    box-shadow: none;
                }

                .warning-text {
                    color: #fde68a;
                }

                .warning-action-btn {
                    background: #f59e0b;
                    box-shadow: none;
                }

                .toolbar {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-bottom: 18px;
                }

                .toolbar button,
                .toolbar .toolbar-button {
                    margin: 0;
                    width: auto;
                    min-width: 0;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 10px 14px;
                    border-radius: 12px;
                    border: 1px solid rgba(148, 163, 184, 0.18);
                    background: rgba(15, 23, 42, 0.72);
                    color: #dbeafe;
                    font-size: 13px;
                    font-weight: 600;
                    box-sizing: border-box;
                }

                .toolbar .primary-btn {
                    background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%);
                    border-color: rgba(96, 165, 250, 0.4);
                    color: #eff6ff;
                }

                .toolbar-button {
                    cursor: pointer;
                }

                .section-head {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 12px;
                    margin-bottom: 12px;
                }

                .section-head h3 {
                    margin: 0 0 4px;
                    font-size: 18px;
                    color: #f8fbff;
                }

                .section-head p {
                    margin: 0;
                    color: #94a3b8;
                    font-size: 13px;
                }

                .section-count {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 30px;
                    height: 30px;
                    padding: 0 10px;
                    border-radius: 999px;
                    background: rgba(59, 130, 246, 0.16);
                    color: #93c5fd;
                    font-weight: 700;
                }

                .topic-list {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    margin-bottom: 16px;
                }

                .empty-state-card {
                    padding: 18px;
                    border-radius: 18px;
                    border: 1px dashed rgba(148, 163, 184, 0.28);
                    background: rgba(15, 23, 42, 0.58);
                    margin-bottom: 16px;
                }

                .empty-state-title {
                    font-size: 16px;
                    font-weight: 700;
                    color: #f8fbff;
                    margin-bottom: 6px;
                }

                .empty-state-text {
                    color: #94a3b8;
                    line-height: 1.6;
                }

                .topic-item {
                    display: block;
                    padding: 0;
                    border: 1px solid rgba(148, 163, 184, 0.14);
                    border-radius: 18px;
                    background: rgba(15, 23, 42, 0.74);
                    box-shadow: 0 18px 40px rgba(2, 8, 23, 0.24);
                    cursor: grab;
                    overflow: hidden;
                }

                .topic-item.drag-over {
                    background: rgba(30, 41, 59, 0.9);
                    border: 1px dashed rgba(125, 211, 252, 0.6);
                }

                .topic-display {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    gap: 0;
                    align-items: stretch;
                }

                .rule-card-top {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 16px;
                    background: rgba(30, 41, 59, 0.74);
                    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
                    width: 100%;
                    box-sizing: border-box;
                }

                .drag-handle {
                    color: #64748b;
                    margin-right: 4px;
                }

                .rule-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 4px 10px;
                    border-radius: 999px;
                    font-size: 12px;
                    font-weight: 700;
                }

                .rule-badge.active {
                    background: rgba(34, 197, 94, 0.16);
                    color: #86efac;
                }

                .rule-badge.expired {
                    background: rgba(239, 68, 68, 0.16);
                    color: #fca5a5;
                }

                .rule-badge.neutral,
                .rule-badge.muted {
                    background: rgba(148, 163, 184, 0.16);
                    color: #cbd5e1;
                }

                .rule-ref {
                    margin-left: auto;
                    color: #7dd3fc;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 12px;
                }

                .rule-block {
                    display: flex;
                    gap: 12px;
                    padding: 16px;
                    width: 100%;
                    box-sizing: border-box;
                }

                .then-block {
                    padding-top: 8px;
                }

                .block-label {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    height: fit-content;
                    padding: 4px 10px;
                    border-radius: 10px;
                    font-size: 11px;
                    font-weight: 800;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }

                .when-label {
                    background: rgba(34, 211, 238, 0.14);
                    color: #67e8f9;
                }

                .then-label {
                    background: rgba(34, 197, 94, 0.14);
                    color: #86efac;
                }

                .block-body {
                    flex: 1;
                    min-width: 0;
                }

                .topic-text {
                    font-size: 16px;
                    font-weight: 600;
                    line-height: 1.6;
                    color: #f8fbff;
                }

                .scope-chip-row,
                .capability-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 10px;
                }

                .scope-chip,
                .capability-chip {
                    display: inline-flex;
                    align-items: center;
                    padding: 4px 10px;
                    border-radius: 999px;
                    font-size: 12px;
                }

                .scope-chip {
                    background: rgba(148, 163, 184, 0.12);
                    color: #cbd5e1;
                }

                .scope-guidance {
                    margin: 8px 0 0;
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(250, 204, 21, 0.22);
                    background: rgba(250, 204, 21, 0.08);
                    color: #fde68a;
                    font-size: 12px;
                    line-height: 1.5;
                }

                .scope-guidance.compact {
                    margin-top: 10px;
                }

                .rule-path-preview {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                    gap: 12px;
                    margin-top: 12px;
                    padding: 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(125, 211, 252, 0.16);
                    background: rgba(15, 23, 42, 0.52);
                }

                .rule-path-step {
                    min-width: 0;
                }

                .rule-path-step strong {
                    display: block;
                    margin-top: 6px;
                    color: #f8fbff;
                    font-size: 14px;
                    line-height: 1.5;
                    overflow-wrap: anywhere;
                }

                .rule-path-step p {
                    margin: 4px 0 0;
                    color: #94a3b8;
                    font-size: 12px;
                    line-height: 1.4;
                    overflow-wrap: anywhere;
                }

                .rule-path-label {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 28px;
                    height: 24px;
                    padding: 0 8px;
                    border-radius: 999px;
                    background: rgba(34, 211, 238, 0.14);
                    color: #67e8f9;
                    font-size: 12px;
                    font-weight: 800;
                }

                .rule-path-step.then .rule-path-label {
                    background: rgba(34, 197, 94, 0.14);
                    color: #86efac;
                }

                .rule-action-chip-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 8px;
                }

                .capability-chip {
                    background: rgba(34, 197, 94, 0.14);
                    color: #bbf7d0;
                }

                .supporting-panel {
                    margin-top: 12px;
                    padding: 12px 14px;
                    border-radius: 14px;
                    background: rgba(30, 41, 59, 0.56);
                    border: 1px solid rgba(148, 163, 184, 0.12);
                }

                .automation-panel-head {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    margin-bottom: 6px;
                }

                .supporting-title {
                    font-size: 12px;
                    font-weight: 700;
                    color: #c4b5fd;
                    margin-bottom: 6px;
                }

                .supporting-text {
                    color: #cbd5e1;
                    line-height: 1.55;
                    font-size: 13px;
                }

                .automation-summary-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 4px 10px;
                    border-radius: 999px;
                    background: rgba(59, 130, 246, 0.16);
                    color: #93c5fd;
                    font-size: 12px;
                    font-weight: 700;
                }

                .muted-copy {
                    color: #94a3b8;
                }

                .supporting-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-top: 12px;
                }

                .secondary-btn {
                    margin: 0;
                    width: auto;
                    padding: 9px 12px;
                    border-radius: 12px;
                    border: 1px solid rgba(148, 163, 184, 0.18);
                    background: rgba(15, 23, 42, 0.72);
                    color: #dbeafe;
                    font-weight: 600;
                }

                .card-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    padding: 0 16px 16px;
                    width: 100%;
                    box-sizing: border-box;
                }

                .card-actions button,
                .form-buttons button {
                    margin: 0;
                    width: auto;
                    padding: 10px 14px;
                    border-radius: 12px;
                    border: 1px solid rgba(148, 163, 184, 0.18);
                    background: rgba(15, 23, 42, 0.72);
                    color: #e2e8f0;
                    font-weight: 600;
                }

                .danger-btn {
                    background: rgba(239, 68, 68, 0.18) !important;
                    color: #fca5a5 !important;
                }

                .add-topic-form,
                .topic-edit-form {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    width: 100%;
                    box-sizing: border-box;
                    padding: 18px;
                    background: rgba(15, 23, 42, 0.78);
                    border-radius: 18px;
                    border: 1px solid rgba(96, 165, 250, 0.18);
                    overflow: hidden;
                }

                .form-title-row h4 {
                    margin: 0 0 4px;
                    font-size: 18px;
                    color: #f8fbff;
                }

                .form-title-row p {
                    margin: 0;
                    color: #94a3b8;
                    line-height: 1.55;
                }

                .text-input,
                input,
                .reply-content-input,
                .keyword-filter-input,
                textarea,
                select {
                    background: rgba(30, 41, 59, 0.72);
                    color: #f8fafc;
                    border: 1px solid rgba(148, 163, 184, 0.22);
                    border-radius: 12px;
                    padding: 10px 12px;
                }

                textarea::placeholder,
                input::placeholder {
                    color: #64748b;
                }

                .filter-conditions,
                .automation-config,
                .auto-reply-config,
                .follow-thread-config,
                .digest-config {
                    background: rgba(30, 41, 59, 0.42);
                    border: 1px solid rgba(148, 163, 184, 0.14);
                    border-radius: 14px;
                    padding: 14px;
                }

                .filter-item label,
                .config-title,
                .hint-text,
                .message-meta .datetime {
                    color: #94a3b8;
                }

                .original-message-preview {
                    background: rgba(15, 23, 42, 0.74);
                    border: 1px solid rgba(167, 139, 250, 0.18);
                    border-radius: 14px;
                }

                .message-meta .sender,
                .message-link {
                    color: #c4b5fd;
                }

                .message-content {
                    color: #e2e8f0;
                }

                .checkbox-container,
                .radio-option {
                    color: #dbe4f3;
                }

	                @media (max-width: 880px) {
	                    .warning-content,
	                    .section-head,
	                    .rule-card-top,
	                    .rule-block {
	                        flex-direction: column;
	                        align-items: flex-start;
	                    }

	                    .rule-path-preview {
	                        grid-template-columns: 1fr;
	                    }

	                    .rule-ref {
	                        margin-left: 0;
	                    }
                }
            `}</style>
    </div>
  );
};

ReactDOM.render(<TopicModal />, document.getElementById('topic-modal-root'));
