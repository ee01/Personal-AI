import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import { useExtensionUiLanguage, useStaticDomI18n } from '../i18n/react';
import { analyzeMessages } from '../messageDealing';
import {
  getMemoryServiceClient,
  type MessageRuleAutomationPreviewResponse,
  type OutreachTemplateRuntimeStatusItem,
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
import {
  buildAutoReplyContentReadinessReceipt,
  buildAutoReplyModeReceipt,
  buildAutoReplyRuleScopeReceipt,
  buildAutoReplySaveButtonBoundary,
  normalizeAutoReplyDelayHours,
} from '../message-reaction/autoReplyPresentation';
import {
  getTaskEnabled,
  resolveTaskEnabledFromSchedulerStates,
} from '../services/taskSchedulerDefinitions';
import {
  mergeManualConcernedItemsPreservingSystem,
  partitionConcernedItems,
} from '../watchRules';
import {
  buildLinkedActionDraftPrefill,
  buildLinkedActionExecutionPreview,
  buildLinkedActionPreviewReceipt,
  buildLinkedActionSaveReceipt,
  type PendingLinkedActionConfig,
  generateLinkedActionSuggestion,
  getFallbackLinkedActionPrompt,
  getLinkedActionContextLine,
  getLinkedActionTriggerContextItems,
  isPendingLinkedActionConfigFresh,
  shouldAutoRequestLinkedActionSuggestion,
} from './linkedActionHelpers';
import { getSafeExternalUrl } from './topic-link-safety';
import { buildMemoryEntryRulesUrl } from '../utils/memoryEntryRulesNavigation';
import {
  buildMemoryEntryRulesTaskDoneMessage,
  getMemoryEntryRulesIntentCopy,
  readMemoryEntryRulesSurfaceParams,
  type MemoryEntryRulesTaskDoneReason,
} from '../utils/memoryEntryRulesSurface';
import {
  getPendingFollowThreadOriginalDatetime,
  isPendingFollowThreadConfigFresh,
  type PendingFollowThreadConfig,
} from '../message-reaction/followThreadPendingConfig';
import {
  buildFollowThreadDraftBoundaryReceipt,
  buildFollowThreadSaveResultReceipt,
} from '../message-reaction/followThreadPresentation';
import {
  getRuleActionSummaryItems,
  getRuleDeliveryReceipt,
  getRuleEffectBoundaryReceipt,
  getRuleRunPreviewReceipt,
  getRuleSafetySummary,
} from './topic-rule-safety';
import {
  getLatestRuleDiagnostic,
  MESSAGE_ANALYSIS_RULE_DIAGNOSTICS_KEY,
  type MessageAnalysisRuleDiagnostic,
} from '../messageAnalysisRuleDiagnostics';
import {
  MESSAGE_ANALYSIS_DELIVERY_RECEIPT_KEY,
  type MessageAnalysisDeliveryReceipt,
} from '../messageAnalysisDelivery';

// 自动答复配置接口
interface AutoReplyConfig {
  enabled: boolean;
  replyContent: string; // 答复内容模板
  useAIGenerate: boolean; // 每次AI生成类似答复
  reviewMode: 'immediate' | 'delayed' | 'manual'; // 审核模式
  delayHours?: number; // 延迟小时数（仅 delayed 模式使用）
}

interface PendingAutoReplyConfig {
  sender?: string;
  groupName?: string;
  content?: string;
  timestamp?: number;
}

type AutoReplyPrefillStatus = 'idle' | 'loading' | 'ready' | 'failed';

// reviewMode 说明：
// - 'immediate': 直接发送（不审核，立即执行）
// - 'delayed': 延迟可拦截（默认，答复前 X 小时可拦截）
// - 'manual': 仅添加到审核列表（PendingReview 状态，需手动批准）

function AutoReplyModeReceiptPanel({
  config,
  filterSender,
  filterGroup,
}: {
  config: AutoReplyConfig;
  filterSender?: string;
  filterGroup?: string;
}) {
  const receipt = buildAutoReplyModeReceipt(config);
  const readinessReceipt = buildAutoReplyContentReadinessReceipt(config);
  const ruleScopeReceipt = buildAutoReplyRuleScopeReceipt({
    ...config,
    filterSender,
    filterGroup,
  });

  return (
    <>
      <div
        className={`auto-reply-mode-receipt ${receipt.tone}`}
        aria-live="polite"
      >
        <div className="auto-reply-mode-receipt-title">
          <span className="auto-reply-mode-badge">{receipt.title}</span>
          <span>发送口径</span>
        </div>
        <div className="auto-reply-mode-receipt-body">
          <span>{receipt.timingText}</span>
          <span>{receipt.reviewText}</span>
          <span>{receipt.generationText}</span>
          <span>{receipt.fallbackText}</span>
        </div>
      </div>

      <div
        className={`auto-reply-content-readiness ${readinessReceipt.tone}`}
        role="status"
        aria-live="polite"
      >
        <div className="auto-reply-content-readiness-title">
          {readinessReceipt.title}
        </div>
        <div className="auto-reply-content-readiness-body">
          <span>{readinessReceipt.detailText}</span>
          <span>{readinessReceipt.recoveryText}</span>
        </div>
      </div>

      <div
        className={`auto-reply-rule-scope-receipt ${ruleScopeReceipt.tone}`}
        role="note"
      >
        <div className="auto-reply-rule-scope-title">
          {ruleScopeReceipt.title}
        </div>
        <div className="auto-reply-rule-scope-body">
          <span>{ruleScopeReceipt.scopeText}</span>
          <span>{ruleScopeReceipt.activationText}</span>
          <span>{ruleScopeReceipt.queueText}</span>
        </div>
      </div>
    </>
  );
}

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

const splitScopeInputValues = (value?: string): string[] =>
  (normalizeOptionalRuleText(value) || '')
    .split(/[\n,，、;；]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const formatScopeList = (value: string | undefined, fallback: string): string => {
  const values = splitScopeInputValues(value);
  if (values.length === 0) return fallback;
  return values.length === 1 ? values[0] : values.join(' 或 ');
};

const isShortScopeValue = (value?: string): boolean => {
  return splitScopeInputValues(value).some((scopeValue) => {
    const compact = scopeValue.replace(/[\s_-]+/g, '');
    if (
      /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/.test(
        compact,
      )
    ) {
      return compact.length === 1;
    }
    return compact.length > 0 && compact.length <= 2;
  });
};

const GLOBAL_SCOPE_GUIDANCE_TEXT =
  '当前规则会在所有群组和所有发送人中生效。建议先限定群组或发送人，降低误入库和误触发。';

const getScopeGuidanceText = (params: {
  filterSender?: string;
  filterGroup?: string;
}): string => {
  const sender = normalizeOptionalRuleText(params.filterSender);
  const group = normalizeOptionalRuleText(params.filterGroup);
  const senderValues = splitScopeInputValues(sender);
  const groupValues = splitScopeInputValues(group);

  if (!sender && !group) {
    return GLOBAL_SCOPE_GUIDANCE_TEXT;
  }

  const shortScopes = [
    isShortScopeValue(group) ? '群组' : '',
    isShortScopeValue(sender) ? '发送人' : '',
  ].filter(Boolean);

  if (shortScopes.length > 0) {
    return `${shortScopes.join('、')}条件较短；运行时会按完整词、群组 ID 或发送人 ID 匹配，建议写完整名称。`;
  }

  const multiScopes = [
    groupValues.length > 1 ? '群组' : '',
    senderValues.length > 1 ? '发送人' : '',
  ].filter(Boolean);

  if (multiScopes.length > 0) {
    return `${multiScopes.join('、')}已设置多个候选；运行时任一候选命中即可触发，不要求同时命中全部候选。`;
  }

  return '';
};

const getScopeSummaryText = (params: {
  filterSender?: string;
  filterGroup?: string;
}): string => {
  const sender = formatScopeList(params.filterSender, '所有发送人');
  const group = formatScopeList(params.filterGroup, '所有群组');
  return `${group} / ${sender}`;
};

const formatFollowMessageDatetime = (datetime: string | number): string => {
  const parsed = new Date(datetime);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleString();
};

// 原消息仅供参考（运行时匹配依赖保存时写入 ChromaDB 的原消息数据），
// 默认折叠成一行摘要，展开后保留原始换行。
function FollowOriginalMessageSection({
  message,
}: {
  message: FollowThreadConfigType['originalMessage'];
}) {
  const datetimeText = formatFollowMessageDatetime(message.datetime);
  const snippet = (message.content || '').replace(/\s+/g, ' ').trim();
  return (
    <details className="original-message-collapse">
      <summary>
        <span className="disclosure-chevron" aria-hidden="true">
          ▸
        </span>
        <span className="collapse-label">原消息</span>
        <span className="collapse-sender">{message.sender}</span>
        <span className="collapse-snippet">{snippet}</span>
      </summary>
      <div className="original-message-preview">
        <div className="message-meta">
          <span className="sender">{message.sender}</span>
          {datetimeText ? (
            <span className="datetime">{datetimeText}</span>
          ) : null}
        </div>
        <div className="message-content">{message.content}</div>
        <a
          href={message.messageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="message-link"
        >
          🔗 查看原消息
        </a>
      </div>
    </details>
  );
}

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

interface SystemObservationRuntimeState {
  status: 'loading' | 'ready' | 'failed' | 'unconfigured';
  items: OutreachTemplateRuntimeStatusItem[];
  loadedAt?: number;
  failedAt?: number;
  error?: string;
}

const getSystemObservationRefreshBoundary = (
  runtime: SystemObservationRuntimeState,
): string => {
  const prefix =
    runtime.status === 'loading'
      ? '正在重新读取系统观察运行时状态'
      : runtime.status === 'unconfigured'
        ? 'Memory Service 未配置，无法读取系统观察运行时状态'
        : runtime.status === 'failed'
          ? runtime.loadedAt
            ? runtime.items.length > 0
              ? `重新读取系统观察运行时状态；当前未确认，保留上次 ${runtime.items.length} 条快照`
              : '重新读取系统观察运行时状态；当前未确认，保留上次空快照'
            : '重新读取系统观察运行时状态；上次读取未确认'
          : runtime.items.length > 0
            ? `重新读取 ${runtime.items.length} 条系统观察运行时状态`
            : '重新读取系统观察运行时状态；上次快照为空';

  const staleBoundary =
    runtime.status === 'failed' && runtime.loadedAt
      ? '上次快照只用于排障，不证明系统观察仍在运行或已经停止；'
      : '';

  return `${prefix}；${staleBoundary}只请求 Outreach runtime status，不导入、排序或覆盖手动规则，不回扫历史消息、不写入记忆、不发送通知、不生成自动答复、不创建 RuntimeAction、不执行 OpenClaw。`;
};

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

interface RuleOperationToast {
  type: 'success' | 'error';
  message: string;
}

interface RuleTransferMetrics {
  deliveryCounts: {
    silent: number;
    digest: number;
    notify: number;
    followup: number;
  };
  effectCounts: {
    quiet: number;
    review: number;
    active: number;
    danger: number;
  };
  automationCount: number;
  autoReplyCount: number;
  openClawPendingCount: number;
  safetyReviewCount: number;
}

interface RuleImportReceipt extends RuleTransferMetrics {
  fileName: string;
  importedCount: number;
  replacedManualCount: number;
  importedAt: number;
}

interface RuleExportReceipt extends RuleTransferMetrics {
  fileName: string;
  exportedCount: number;
  exportedAt: number;
}

interface RuleOrderReceipt {
  movedRuleName: string;
  fromPosition: number;
  toPosition: number;
  totalCount: number;
  orderedAt: number;
}

interface SilentAnalysisControlReceipt {
  status: 'pending' | 'succeeded' | 'failed';
  source: 'warning' | 'after-save';
  requestedAt: number;
  confirmedAt?: number;
  error?: string;
  message?: string;
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

const SparklesIcon = () => (
  <svg
    aria-hidden="true"
    className="icon-button-svg"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path d="M12 3l1.6 4.8L18 10l-4.4 2.2L12 17l-1.6-4.8L6 10l4.4-2.2L12 3z" />
    <path d="M19 4v4" />
    <path d="M21 6h-4" />
    <path d="M5 16v3" />
    <path d="M6.5 17.5h-3" />
  </svg>
);

const PlayIcon = () => (
  <svg
    aria-hidden="true"
    className="icon-button-svg"
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M8 5.8v12.4c0 .8.9 1.3 1.6.9l9.4-6.2c.6-.4.6-1.3 0-1.7L9.6 4.9C8.9 4.5 8 5 8 5.8z" />
  </svg>
);

const { surface: SURFACE_MODE, intent: SURFACE_INTENT } =
  readMemoryEntryRulesSurfaceParams(window.location.search);
const IS_TASK_SURFACE = SURFACE_MODE === 'task';
const SURFACE_COPY = getMemoryEntryRulesIntentCopy(SURFACE_INTENT);

/**
 * Task surface lives in an iframe inside the memory-exploring shell, which owns
 * the window and performs the actual close.
 */
const finishTaskSurface = (reason: MemoryEntryRulesTaskDoneReason) => {
  if (!IS_TASK_SURFACE) return;
  const message = buildMemoryEntryRulesTaskDoneMessage(reason);
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, window.location.origin);
    return;
  }
  window.close();
};

const TopicModal = () => {
  const { language: uiLanguage } = useExtensionUiLanguage();
  useStaticDomI18n(uiLanguage);
  const addFormRef = useRef<HTMLDivElement | null>(null);
  const operationToastTimerRef = useRef<number | null>(null);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [editingTopic, setEditingTopic] = useState<TopicItem | null>(null);
  const [showAddForm, setShowAddForm] = useState(IS_TASK_SURFACE);
  const [taskSaveReceipt, setTaskSaveReceipt] = useState('');
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
  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [deletingTopicId, setDeletingTopicId] = useState<string | null>(null);
  const [operationToast, setOperationToast] =
    useState<RuleOperationToast | null>(null);
  const [ruleImportReceipt, setRuleImportReceipt] =
    useState<RuleImportReceipt | null>(null);
  const [ruleExportReceipt, setRuleExportReceipt] =
    useState<RuleExportReceipt | null>(null);
  const [ruleOrderReceipt, setRuleOrderReceipt] =
    useState<RuleOrderReceipt | null>(null);
  const [envConfig, setEnvConfig] = useState<EnvConfigType | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<{
    total: number;
    lastAnalyzedIndex: number;
    lastAnalyzedTime: string;
  } | null>(null);
  const [deliveryReceipt, setDeliveryReceipt] =
    useState<MessageAnalysisDeliveryReceipt | null>(null);
  const [isSilentAnalysisEnabled, setIsSilentAnalysisEnabled] = useState(false);
  const [
    silentAnalysisControlReceipt,
    setSilentAnalysisControlReceipt,
  ] = useState<SilentAnalysisControlReceipt | null>(null);
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
  const autoReplyPrefillRequestIdRef = useRef(0);
  const [pendingAutoReplyConfig, setPendingAutoReplyConfig] =
    useState<PendingAutoReplyConfig | null>(null);
  const [autoReplyPrefillStatus, setAutoReplyPrefillStatus] =
    useState<AutoReplyPrefillStatus>('idle');
  const [autoReplyPrefillError, setAutoReplyPrefillError] = useState('');
  const [pendingLinkedActionConfig, setPendingLinkedActionConfig] =
    useState<PendingLinkedActionConfig | null>(null);
  const linkedActionSuggestionRequestIdRef = useRef(0);
  const newAutomationPromptRef = useRef('');
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
  const [isNewAutomationExpanded, setIsNewAutomationExpanded] =
    useState(false);
  const [editingAutomationPreview, setEditingAutomationPreview] =
    useState<AutomationPreviewState>({ status: 'idle' });
  const [isEditingAutomationExpanded, setIsEditingAutomationExpanded] =
    useState(false);
  const [pendingRuleImprovement, setPendingRuleImprovement] =
    useState<PendingMessageRuleImprovement | null>(null);
  const [ruleDiagnostics, setRuleDiagnostics] = useState<
    MessageAnalysisRuleDiagnostic[]
  >([]);
  const [systemObservationRuntime, setSystemObservationRuntime] =
    useState<SystemObservationRuntimeState>({
      status: 'loading',
      items: [],
    });

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
    loadRuleDiagnostics();
    checkSilentAnalysisStatus();
  }, []);

  useEffect(
    () => () => {
      if (operationToastTimerRef.current !== null) {
        window.clearTimeout(operationToastTimerRef.current);
      }
    },
    [],
  );

  // 检查静默消息分析状态
  const checkSilentAnalysisStatus = async () => {
    const isEnabled = await getTaskEnabled('message_analysis');
    setIsSilentAnalysisEnabled(isEnabled);
    return isEnabled;
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
    autoReplyPrefillRequestIdRef.current += 1;
    setPendingAutoReplyConfig(null);
    setAutoReplyPrefillStatus('idle');
    setAutoReplyPrefillError('');
    setPendingLinkedActionConfig(null);
    setLinkedActionSuggestionStatus('idle');
    setLinkedActionSuggestionSource('');
    setLinkedActionSuggestionError('');
    setLinkedActionSuggestionFallback('');
    setNewAutomationPreview({ status: 'idle' });
    setIsNewAutomationExpanded(source === 'linkedAction');
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

  const getTopicLinkedActionContext = (
    topic: TopicItem,
  ): PendingLinkedActionConfig => ({
    sender: topic.filterSender,
    groupName: topic.filterGroup,
    content: topic.text,
  });

  const isPendingMessageRuleImprovementFresh = (
    value: PendingMessageRuleImprovement,
  ) => {
    return !value.timestamp || Date.now() - value.timestamp < 10 * 60 * 1000;
  };

  useEffect(() => {
    newAutomationPromptRef.current = newAutomationPrompt;
  }, [newAutomationPrompt]);

  const requestLinkedActionSuggestion = async (force = false) => {
    const context = getDraftLinkedActionContext();
    if (!context) {
      return;
    }

    if (!force && newAutomationPrompt.trim()) {
      return;
    }

    const requestId = linkedActionSuggestionRequestIdRef.current + 1;
    linkedActionSuggestionRequestIdRef.current = requestId;
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
      if (linkedActionSuggestionRequestIdRef.current !== requestId) {
        return;
      }
      if (force || !newAutomationPromptRef.current.trim()) {
        setNewAutomationPrompt(suggestion.prompt);
        newAutomationPromptRef.current = suggestion.prompt;
      }
      setNewAutomationPreview({ status: 'idle' });
      setLinkedActionSuggestionStatus('ready');
      setLinkedActionSuggestionSource(suggestion.sourceLabel);
      setLinkedActionSuggestionFallback('');
    } catch (error) {
      if (linkedActionSuggestionRequestIdRef.current !== requestId) {
        return;
      }
      console.error('生成联动操作建议失败:', error);
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

  const requestAutoReplyPrefillDraft = async (
    config: PendingAutoReplyConfig,
  ) => {
    const requestId = autoReplyPrefillRequestIdRef.current + 1;
    autoReplyPrefillRequestIdRef.current = requestId;
    setPendingAutoReplyConfig(config);
    setAutoReplyPrefillStatus('loading');
    setAutoReplyPrefillError('');

    try {
      const reply = await generateAutoReply({
        messageContent: config.content || '发送的消息',
        sender: config.sender || '未知发送者',
        groupName: config.groupName || '未知群组',
        summary: config.content
          ? `原始消息：${config.content}`
          : '从消息工具栏打开的自动答复配置',
      });
      if (autoReplyPrefillRequestIdRef.current !== requestId) {
        return;
      }
      setNewAutoReplyConfig((prev) => ({
        ...prev,
        replyContent: reply,
      }));
      setAutoReplyPrefillStatus('ready');
      setAutoReplyPrefillError('');
    } catch (error) {
      if (autoReplyPrefillRequestIdRef.current !== requestId) {
        return;
      }
      console.error('自动生成答复失败:', error);
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : '未知错误';
      setAutoReplyPrefillStatus('failed');
      setAutoReplyPrefillError(message);
    }
  };

  const clearAutoReplyPrefillReceipt = () => {
    autoReplyPrefillRequestIdRef.current += 1;
    setAutoReplyPrefillStatus('idle');
    setAutoReplyPrefillError('');
  };

  // 检查是否有从消息悬浮菜单传来的自动答复配置请求
  useEffect(() => {
    (async () => {
      const result = await chrome.storage.local.get('pendingAutoReplyConfig');
      if (result.pendingAutoReplyConfig) {
        const config: PendingAutoReplyConfig = result.pendingAutoReplyConfig;
        // 检查是否是最近5分钟内的请求
        if (!config.timestamp || Date.now() - config.timestamp < 5 * 60 * 1000) {
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
          void requestAutoReplyPrefillDraft(config);
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
        const config =
          result.pendingFollowThreadConfig as PendingFollowThreadConfig;
        if (isPendingFollowThreadConfigFresh(config)) {
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
              datetime: getPendingFollowThreadOriginalDatetime(config),
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
            setIsEditingAutomationExpanded(true);
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
    chrome.storage.local.get(
      ['ollamaAnalysisProgress', MESSAGE_ANALYSIS_DELIVERY_RECEIPT_KEY],
      (result) => {
        console.log('ollamaAnalysisProgress:', result.ollamaAnalysisProgress);
        if (result.ollamaAnalysisProgress) {
          setAnalysisProgress(result.ollamaAnalysisProgress);
          setIsLoading(
            result.ollamaAnalysisProgress &&
              result.ollamaAnalysisProgress.lastAnalyzedIndex <
                result.ollamaAnalysisProgress.total,
          );
        }
        setDeliveryReceipt(
          result[MESSAGE_ANALYSIS_DELIVERY_RECEIPT_KEY] || null,
        );
      },
    );

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
      if (changes.taskSchedulerStates || changes.taskStates) {
        const taskStates =
          changes.taskSchedulerStates?.newValue ||
          changes.taskStates?.newValue;
        setIsSilentAnalysisEnabled(
          resolveTaskEnabledFromSchedulerStates('message_analysis', taskStates),
        );
      }

      // 监听配置变化
      if (changes.envConfig) {
        setEnvConfig(changes.envConfig.newValue);
      }

      if (changes[MESSAGE_ANALYSIS_RULE_DIAGNOSTICS_KEY]) {
        setRuleDiagnostics(
          Array.isArray(
            changes[MESSAGE_ANALYSIS_RULE_DIAGNOSTICS_KEY].newValue,
          )
            ? changes[MESSAGE_ANALYSIS_RULE_DIAGNOSTICS_KEY].newValue
            : [],
        );
      }

      if (changes[MESSAGE_ANALYSIS_DELIVERY_RECEIPT_KEY]) {
        setDeliveryReceipt(
          changes[MESSAGE_ANALYSIS_DELIVERY_RECEIPT_KEY].newValue || null,
        );
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

  const loadRuleDiagnostics = async () => {
    const result = await chrome.storage.local.get(
      MESSAGE_ANALYSIS_RULE_DIAGNOSTICS_KEY,
    );
    const value = result[MESSAGE_ANALYSIS_RULE_DIAGNOSTICS_KEY];
    setRuleDiagnostics(Array.isArray(value) ? value : []);
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

  const showOperationToast = (
    toast: RuleOperationToast,
    autoDismissMs = 3600,
  ) => {
    if (operationToastTimerRef.current !== null) {
      window.clearTimeout(operationToastTimerRef.current);
      operationToastTimerRef.current = null;
    }
    setOperationToast(toast);
    if (autoDismissMs > 0) {
      operationToastTimerRef.current = window.setTimeout(() => {
        setOperationToast(null);
        operationToastTimerRef.current = null;
      }, autoDismissMs);
    }
  };

  const formatRuleToastName = (topic: TopicItem) => {
    const text = topic.text.trim();
    return text.length > 22 ? `${text.slice(0, 22)}...` : text;
  };

  const handleDelete = async (index: number) => {
    const topicToDelete = topics[index];
    if (!topicToDelete || deletingTopicId) return;
    setDeletingTopicId(topicToDelete.id);
    const newTopics = topics.filter((_, i) => i !== index);
    try {
      await saveTopics(newTopics);
      setRuleImportReceipt(null);
      setRuleOrderReceipt(null);
      showOperationToast({
        type: 'success',
        message: `已删除规则「${formatRuleToastName(topicToDelete)}」`,
      });
    } catch (error) {
      console.error('删除记忆入口规则失败:', error);
      showOperationToast({
        type: 'error',
        message: '删除失败，请稍后重试。',
      });
    } finally {
      setDeletingTopicId(null);
    }
  };

  const handleEdit = (topic: TopicItem) => {
    setEditingAutomationPreview({ status: 'idle' });
    setIsEditingAutomationExpanded(false);
    setEditingTopic(topic);
  };

  const handleSaveEdit = async () => {
    if (!editingTopic) return;

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
    setRuleImportReceipt(null);
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
    setIsEditingAutomationExpanded(false);

    promptEnableSilentAnalysisAfterRuleSave('这条记忆入口规则');
  };

  const handleAdd = async () => {
    const topicText = newTopic.trim();
    if (!topicText || isAddingTopic) return;
    setIsAddingTopic(true);

    try {
      const isLinkedActionDraft =
        newRuleSource === 'linkedAction' && Boolean(newAutomationPrompt.trim());
      const linkedActionSaveReceipt = isLinkedActionDraft
        ? buildLinkedActionSaveReceipt({
            context: pendingLinkedActionConfig,
            openClawConfigured,
            requiresApproval: newAutomationRequiresApproval,
          })
        : '';
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
              preferredHour: normalizeConcernedItemsDigestHour(
                newDigestHour,
                8,
              ),
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
      setRuleImportReceipt(null);
      setRuleOrderReceipt(null);

      let followThreadOriginalIndexed = false;

      // 如果启用了关注后续，存储原消息到 Memory Service，供语义匹配使用
      if (newFollowThread && newFollowConfig) {
        try {
          const storeResponse = await chrome.runtime.sendMessage({
            type: 'STORE_FOLLOWED_MESSAGE',
            data: {
              followItemId: newTopicItem.id,
              message: newFollowConfig.originalMessage,
              isOriginal: true,
            },
          });
          followThreadOriginalIndexed = storeResponse?.success === true;
          if (followThreadOriginalIndexed) {
            console.log('✅ 原消息已存储到 Memory Service');
          } else {
            console.warn(
              '⚠️ 原消息索引未确认:',
              storeResponse?.error || storeResponse,
            );
          }
        } catch (error) {
          console.error('❌ 存储原消息失败:', error);
        }
      }

      const followThreadSaveReceipt =
        newFollowThread && newFollowConfig && !linkedActionSaveReceipt
          ? buildFollowThreadSaveResultReceipt({
              ruleName: formatRuleToastName(newTopicItem),
              indexedOriginal: followThreadOriginalIndexed,
              notifyMethod: newNotifyMethod,
              notifyFrequency: newNotifyFrequency,
              expiryDays: newExpiry,
            })
          : '';

      const saveMessage =
        linkedActionSaveReceipt ||
        followThreadSaveReceipt ||
        `已添加规则「${formatRuleToastName(newTopicItem)}」`;

      // 重置表单
      resetNewRuleForm();
      setShowAddForm(false);
      showOperationToast(
        {
          type: 'success',
          message: saveMessage,
        },
        linkedActionSaveReceipt || followThreadSaveReceipt ? 9000 : 3600,
      );

      promptEnableSilentAnalysisAfterRuleSave('这条记忆入口规则');

      // 任务态不自动关窗，先让用户读完保存回执再自己选择出口
      if (IS_TASK_SURFACE) {
        setTaskSaveReceipt(saveMessage);
      }
    } catch (error) {
      console.error('添加记忆入口规则失败:', error);
      showOperationToast({
        type: 'error',
        message: '添加失败，请稍后重试。',
      });
    } finally {
      setIsAddingTopic(false);
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

    const fromPosition = draggedItem + 1;
    const toPosition = dragOverItem + 1;

    // 创建新的排序后的列表
    const newTopicList = [...topics];
    const draggedTopic = newTopicList[draggedItem];
    if (!draggedTopic) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    // 从原位置删除
    newTopicList.splice(draggedItem, 1);
    // 在新位置插入
    newTopicList.splice(dragOverItem, 0, draggedTopic);

    try {
      // 保存新排序
      await saveTopics(newTopicList);
      setRuleImportReceipt(null);
      setRuleExportReceipt(null);
      setRuleOrderReceipt({
        movedRuleName: formatRuleToastName(draggedTopic),
        fromPosition,
        toPosition,
        totalCount: newTopicList.length,
        orderedAt: Date.now(),
      });
    } catch (error) {
      console.error('保存记忆入口规则排序失败:', error);
      showOperationToast({
        type: 'error',
        message: '规则排序未保存，请稍后重试。',
      });
    } finally {
      // 重置拖拽状态
      setDraggedItem(null);
      setDragOverItem(null);
    }
  };

  const isTopicExpanded = (topicId: string) => expandedTopicIds.has(topicId);

  const toggleTopicExpanded = (topicId: string) => {
    setExpandedTopicIds((current) => {
      const next = new Set(current);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  const handleTopicSummaryKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    topicId: string,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleTopicExpanded(topicId);
  };

  const exportToXML = () => {
    if (topics.length === 0) {
      setRuleImportReceipt(null);
      setRuleExportReceipt(buildRuleExportReceipt([], '未生成 XML 文件'));
      showOperationToast(
        {
          type: 'success',
          message:
            '导出已检查：本机没有可导出的手动规则，未生成 XML 文件。',
        },
        8000,
      );
      return;
    }

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
    setRuleExportReceipt(buildRuleExportReceipt(topics, fileName));
  };

  const importFromXML = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const xml = e.target?.result as string;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, 'text/xml');

      if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        showOperationToast(
          {
            type: 'error',
            message: '导入未完成：XML 格式无法解析，请检查导出的规则文件。',
          },
          8000,
        );
        event.target.value = '';
        return;
      }

      const topicElements = xmlDoc.getElementsByTagName('topic');
      const importedTopics: TopicItem[] = [];

      for (let i = 0; i < topicElements.length; i++) {
        const topicEl = topicElements[i];
        const id =
          normalizeOptionalRuleText(
            topicEl.getElementsByTagName('id')[0]?.textContent || '',
          ) ||
          Math.random().toString(36).substr(2, 9);
        const text =
          normalizeOptionalRuleText(
            topicEl.getElementsByTagName('text')[0]?.textContent || '',
          ) || '';
        const expiredAtStr =
          normalizeOptionalRuleText(
            topicEl.getElementsByTagName('expiredAt')[0]?.textContent || '',
          ) || '0';
        const expiredAt = parseInt(expiredAtStr, 10);

        // 🆕 支持新的 notifyMethod 格式，同时兼容旧的 pushToGlip
        let notifyMethod =
          normalizeOptionalRuleText(
            topicEl.getElementsByTagName('notifyMethod')[0]?.textContent || '',
          ) || '';
        const notifyFrequency =
          normalizeOptionalRuleText(
            topicEl.getElementsByTagName('notifyFrequency')[0]?.textContent ||
              '',
          ) || '';
        const pushToGlipStr =
          normalizeOptionalRuleText(
            topicEl.getElementsByTagName('pushToGlip')[0]?.textContent || '',
          ) || 'false';
        // 如果没有 notifyMethod 但有 pushToGlip，进行迁移
        if (!notifyMethod && pushToGlipStr === 'true') {
          notifyMethod = 'bot';
        }

        const mentionMeStr =
          normalizeOptionalRuleText(
            topicEl.getElementsByTagName('mentionMe')[0]?.textContent || '',
          ) || 'false';
        const mentionMe = mentionMeStr === 'true';
        const filterSender = normalizeOptionalRuleText(
          topicEl.getElementsByTagName('filterSender')[0]?.textContent || '',
        );
        const filterGroup = normalizeOptionalRuleText(
          topicEl.getElementsByTagName('filterGroup')[0]?.textContent || '',
        );
        const automationPrompt = normalizeOptionalRuleText(
          topicEl.getElementsByTagName('automationPrompt')[0]?.textContent ||
            '',
        );
        const automationRequiresApprovalStr =
          normalizeOptionalRuleText(
            topicEl.getElementsByTagName('automationRequiresApproval')[0]
              ?.textContent || '',
          ) || 'false';
        const automationRequiresApproval =
          automationRequiresApprovalStr === 'true';
        const followThreadStr =
          normalizeOptionalRuleText(
            topicEl.getElementsByTagName('followThread')[0]?.textContent || '',
          ) || 'false';
        const followThread = followThreadStr === 'true';
        const followConfigStr = normalizeOptionalRuleText(
          topicEl.getElementsByTagName('followConfig')[0]?.textContent || '',
        );
        let followConfig: FollowThreadConfigType | undefined;
        if (followConfigStr) {
          try {
            followConfig = JSON.parse(followConfigStr);
          } catch (e) {
            console.warn('Failed to parse followConfig:', e);
          }
        }
        const digestConfigStr = normalizeOptionalRuleText(
          topicEl.getElementsByTagName('digestConfig')[0]?.textContent || '',
        );
        let digestConfig: DigestConfigType | undefined;
        if (digestConfigStr) {
          try {
            digestConfig = JSON.parse(digestConfigStr);
          } catch (e) {
            console.warn('Failed to parse digestConfig:', e);
          }
        }
        const autoReplyStr =
          normalizeOptionalRuleText(
            topicEl.getElementsByTagName('autoReply')[0]?.textContent || '',
          ) || 'false';
        const autoReply = autoReplyStr === 'true';
        const autoReplyConfigStr = normalizeOptionalRuleText(
          topicEl.getElementsByTagName('autoReplyConfig')[0]?.textContent || '',
        );
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
            filterSender,
            filterGroup,
            automationPrompt,
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
        const replacedManualCount = topics.length;
        await saveTopics(importedTopics);
        setRuleExportReceipt(null);
        setRuleOrderReceipt(null);
        setRuleImportReceipt(
          buildRuleImportReceipt(
            importedTopics,
            replacedManualCount,
            file.name,
          ),
        );
        showOperationToast(
          {
            type: 'success',
            message: `已导入 ${importedTopics.length} 条手动规则；系统观察规则未被导入或覆盖。`,
          },
          8000,
        );
        promptEnableSilentAnalysisAfterRuleSave(
          `${importedTopics.length} 条记忆入口规则`,
        );
      } else {
        showOperationToast(
          {
            type: 'error',
            message: '导入未完成：XML 中没有可用的记忆入口规则。',
          },
          8000,
        );
      }
      event.target.value = '';
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
      const contextWindow = Number(envConfig?.MESSAGE_CONTEXT_WINDOW) || 125;
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
      const analysisResponse = (await analyzeMessages(
        userData,
        userinfo.fullName,
      )) as { success?: boolean; message?: string } | undefined;
      if (!analysisResponse || analysisResponse.success === false) {
        throw new Error(
          analysisResponse?.message || '分析没有返回完成确认',
        );
      }
      showOperationToast(
        {
          type: 'success',
          message:
            '立即分析完成：已读取 RingCentral 最近消息；本轮写入、通知、摘要、自动答复、关注后续和 RuntimeAction 以分发回执与各队列状态为准。',
        },
        8000,
      );
    } catch (error) {
      console.error('Error sending data to Ollama:', error);
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : '无法读取 RingCentral 页面或最近消息。';
      showOperationToast(
        {
          type: 'error',
          message: `立即分析失败：${errorMessage} 请确认 RingCentral PWA 已打开并刷新后重试。`,
        },
        8000,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getIntervalHours = () => {
    return manualAnalysisIntervalHours;
  };

  // AI 生成答复建议（新增表单）
  const handleGenerateReplyForNew = async () => {
    if (!newTopic) {
      alert('请先输入规则条件');
      return;
    }
    clearAutoReplyPrefillReceipt();
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
  const enableSilentAnalysis = async (
    source: SilentAnalysisControlReceipt['source'] = 'warning',
  ) => {
    if (silentAnalysisControlReceipt?.status === 'pending') return;

    const requestedAt = Date.now();
    setSilentAnalysisControlReceipt({
      status: 'pending',
      source,
      requestedAt,
    });

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'CONTROL_TASK',
        taskId: 'message_analysis',
        action: 'toggle',
        enabled: true,
      })) as
        | { success?: boolean; error?: string; message?: string }
        | undefined;

      if (!response?.success) {
        throw new Error(response?.error || response?.message || '任务控制失败');
      }

      const confirmedEnabled = await checkSilentAnalysisStatus();
      if (!confirmedEnabled) {
        throw new Error('任务控制返回成功，但本机状态尚未确认开启');
      }

      setSilentAnalysisControlReceipt({
        status: 'succeeded',
        source,
        requestedAt,
        confirmedAt: Date.now(),
        message: response.message,
      });
      showOperationToast(
        {
          type: 'success',
          message:
            '后台记忆采集已确认开启；后续新消息会按当前规则观察。',
        },
        8000,
      );
    } catch (error) {
      await checkSilentAnalysisStatus();
      const message =
        error instanceof Error && error.message
          ? error.message
          : '任务控制失败';
      setSilentAnalysisControlReceipt({
        status: 'failed',
        source,
        requestedAt,
        confirmedAt: Date.now(),
        error: message,
      });
      showOperationToast(
        {
          type: 'error',
          message: `后台记忆采集未确认开启：${message}`,
        },
        8000,
      );
    }
  };

  const promptEnableSilentAnalysisAfterRuleSave = (ruleLabel: string) => {
    if (isSilentAnalysisEnabled) return;

    const shouldEnable = confirm(
      `✅ 保存成功！\n\n⚠️ 检测到您尚未开启"静默消息分析"功能。\n\n如果不开启，${ruleLabel}只能保存在列表里，无法自动捕获新消息、写入记忆，或触发通知、摘要、自动答复、关注后续和联动操作。\n\n是否立即开启静默消息分析？`,
    );
    if (shouldEnable) {
      void enableSilentAnalysis('after-save');
    }
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
  const manualAnalysisWindowMinutes =
    Number(envConfig?.MESSAGE_CONTEXT_WINDOW) || 125;
  const manualAnalysisIntervalHours = (
    manualAnalysisWindowMinutes / 60
  ).toFixed(1);

  const loadSystemObservationRuntime = async () => {
    if (!memoryServiceConfigured) {
      setSystemObservationRuntime({
        status: 'unconfigured',
        items: [],
      });
      return;
    }

    setSystemObservationRuntime((current) => ({
      status: 'loading',
      items: current.items,
      loadedAt: current.loadedAt,
      failedAt: undefined,
    }));

    try {
      const response =
        await getMemoryServiceClient().getOutreachTemplateRuntimeStatus(
          undefined,
          100,
        );
      setSystemObservationRuntime({
        status: 'ready',
        items: Array.isArray(response.items) ? response.items : [],
        loadedAt: Date.now(),
        failedAt: undefined,
      });
    } catch (error) {
      console.warn('加载系统观察规则运行时状态失败:', error);
      const failedAt = Date.now();
      setSystemObservationRuntime((current) => ({
        status: 'failed',
        items: current.loadedAt ? current.items : [],
        loadedAt: current.loadedAt,
        failedAt,
        error:
          error instanceof Error && error.message
            ? error.message
            : '未知错误',
      }));
    }
  };

  useEffect(() => {
    void loadSystemObservationRuntime();
  }, [memoryServiceConfigured]);

  const buildRuleTransferMetrics = (
    ruleTopics: TopicItem[],
  ): RuleTransferMetrics => {
    const metrics: RuleTransferMetrics = {
      deliveryCounts: {
        silent: 0,
        digest: 0,
        notify: 0,
        followup: 0,
      },
      effectCounts: {
        quiet: 0,
        review: 0,
        active: 0,
        danger: 0,
      },
      automationCount: 0,
      autoReplyCount: 0,
      openClawPendingCount: 0,
      safetyReviewCount: 0,
    };

    ruleTopics.forEach((topic) => {
      const summaryInput = {
        notifyMethod: topic.notifyMethod || '',
        mentionMe: Boolean(topic.mentionMe),
        digestEnabled:
          Boolean(topic.digestConfig?.enabled) && !topic.followThread,
        digestFrequency: topic.digestConfig?.frequency || 'daily',
        followThread: Boolean(topic.followThread),
        autoReply: Boolean(topic.autoReply),
        autoReplyMode: topic.autoReplyConfig?.reviewMode || 'delayed',
        automationPrompt: topic.automationPrompt,
        automationRequiresApproval: topic.automationRequiresApproval === true,
        openClawConfigured,
      };
      const deliveryReceipt = getRuleDeliveryReceipt(summaryInput);
      const effectReceipt = getRuleEffectBoundaryReceipt(summaryInput);
      const safetySummary = getRuleSafetySummary({
        filterSender: topic.filterSender,
        filterGroup: topic.filterGroup,
        notifyMethod: topic.notifyMethod,
        digestEnabled:
          Boolean(topic.digestConfig?.enabled) && !topic.followThread,
        followThread: Boolean(topic.followThread),
        automationPrompt: topic.automationPrompt,
        automationRequiresApproval: topic.automationRequiresApproval,
      });

      metrics.deliveryCounts[deliveryReceipt.tone] += 1;
      metrics.effectCounts[effectReceipt.tone] += 1;
      if (topic.automationPrompt?.trim()) {
        metrics.automationCount += 1;
        if (!openClawConfigured) {
          metrics.openClawPendingCount += 1;
        }
      }
      if (topic.autoReply) {
        metrics.autoReplyCount += 1;
      }
      if (safetySummary.tone !== 'ok') {
        metrics.safetyReviewCount += 1;
      }
    });

    return metrics;
  };

  const buildRuleImportReceipt = (
    importedTopics: TopicItem[],
    replacedManualCount: number,
    fileName: string,
  ): RuleImportReceipt => {
    const receipt: RuleImportReceipt = {
      fileName,
      importedCount: importedTopics.length,
      replacedManualCount,
      importedAt: Date.now(),
      ...buildRuleTransferMetrics(importedTopics),
    };

    return receipt;
  };

  const buildRuleExportReceipt = (
    exportedTopics: TopicItem[],
    fileName: string,
  ): RuleExportReceipt => ({
    fileName,
    exportedCount: exportedTopics.length,
    exportedAt: Date.now(),
    ...buildRuleTransferMetrics(exportedTopics),
  });

  useEffect(() => {
    if (
      shouldAutoRequestLinkedActionSuggestion({
        showAddForm,
        newRuleSource,
        linkedActionSuggestionStatus,
        newAutomationPrompt,
      })
    ) {
      void requestLinkedActionSuggestion(false);
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
    // 任务态里表单就是全部内容，滚动只会把标题和原消息预览推出视口
    if (IS_TASK_SURFACE) return;
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

  const renderSilentAnalysisControlReceipt = () => {
    if (!silentAnalysisControlReceipt) return null;

    const receipt = silentAnalysisControlReceipt;
    const sourceText =
      receipt.source === 'after-save'
        ? '规则保存后的开启建议'
        : '页面顶部立即启用';
    const title =
      receipt.status === 'pending'
        ? '后台采集开启回执 · 提交中'
        : receipt.status === 'succeeded'
          ? '后台采集开启回执 · 已确认'
          : '后台采集开启回执 · 未确认';
    const resultText =
      receipt.status === 'pending'
        ? '正在提交到 Task Scheduler；状态确认前，不把这批手动规则当作已经自动运行。'
        : receipt.status === 'succeeded'
          ? `Task Scheduler 已确认开启${receipt.message ? `：${receipt.message}` : ''}。`
          : `开启失败或未确认：${receipt.error || '任务控制失败'}。当前仍以状态条为准。`;
    const boundaryText =
      receipt.status === 'succeeded'
        ? '边界：只影响后续新消息的后台观察；不会回扫历史消息、发送通知、写入记忆、创建 RuntimeAction 或执行 OpenClaw。历史消息仍需手动点「立即分析最近」。'
        : '边界：本次只是切换后台采集任务；不会回扫历史消息、发送通知、写入记忆、创建 RuntimeAction 或执行 OpenClaw。';

    return (
      <div
        className={`silent-analysis-control-receipt ${receipt.status}`}
        role="status"
        aria-live="polite"
      >
        <div className="silent-analysis-control-title">{title}</div>
        <div className="silent-analysis-control-grid">
          <span>来源：{sourceText}</span>
          <span>提交：{formatDateTime(receipt.requestedAt)}</span>
          {receipt.confirmedAt ? (
            <span>确认：{formatDateTime(receipt.confirmedAt)}</span>
          ) : null}
          <span>{resultText}</span>
          <span>{boundaryText}</span>
        </div>
      </div>
    );
  };

  const getDeliveryRunModeLabel = (
    receipt: MessageAnalysisDeliveryReceipt,
  ) => {
    const modeLabel =
      receipt.runMode === 'agentThinking'
        ? 'Agent Thinking'
        : receipt.runMode === 'agentWorkflow'
          ? 'Agent Workflow'
          : '普通 filter';
    return `${receipt.source === 'scheduled' ? '后台定时' : '手动'} · ${modeLabel}`;
  };

  const getDeliveryReceiptStatusLabel = (
    receipt: MessageAnalysisDeliveryReceipt,
  ) => (receipt.status === 'partial' ? '部分完成' : '已完成');

  const renderMessageAnalysisDeliveryReceipt = () => {
    if (!deliveryReceipt) return null;

    const counters = deliveryReceipt.counters;
    const scopeRejectedDiagnostics = ruleDiagnostics
      .filter((item) => item.status === 'scope_rejected')
      .sort((a, b) => b.capturedAt - a.capturedAt);
    const latestScopeRejectedDiagnostic = scopeRejectedDiagnostics[0];
    const autoReplyHandled = counters.autoReplyHandled || 0;
    const autoReplySkipped = counters.autoReplySkipped || 0;
    const failedCount =
      counters.memoryWriteFailures +
      counters.immediateNotificationFailures +
      counters.followThreadFailures +
      counters.automationPlanFailures;

    return (
      <div
        className={`message-analysis-delivery-receipt ${deliveryReceipt.status}`}
        role="status"
        aria-live="polite"
      >
        <div className="message-analysis-delivery-head">
          <div>
            <div className="message-analysis-delivery-title">
              本轮分发统计
            </div>
            <div className="message-analysis-delivery-subtitle">
              {getDeliveryRunModeLabel(deliveryReceipt)} ·{' '}
              {formatDateTime(deliveryReceipt.capturedAt)}
            </div>
          </div>
          <span>{getDeliveryReceiptStatusLabel(deliveryReceipt)}</span>
        </div>
        <div className="message-analysis-delivery-grid">
          <span>分析消息 {counters.analyzedMessages}</span>
          <span>写入请求 {counters.memoryWriteRequests}</span>
          <span>已接收写入 {counters.memoryWritesAccepted}</span>
          <span>重复跳过 {counters.memoryDuplicateSkips}</span>
          <span>即时通知 {counters.immediateNotificationAttempts}</span>
          <span>摘要入队 {counters.digestQueueEntries}</span>
          <span>关注后续 {counters.followThreadUpdates}</span>
          <span>自动答复入队 {autoReplyHandled}</span>
          <span>自动答复未入队 {autoReplySkipped}</span>
          <span>联动规划 {counters.automationPlanRequests}</span>
          <span>范围拦截 {counters.scopeRejected}</span>
          <span>下游失败 {failedCount}</span>
        </div>
        {counters.scopeRejected > 0 && (
          <div
            className="message-analysis-scope-gate-receipt"
            role="note"
            aria-label="本轮范围门禁回执"
          >
            <div className="message-analysis-scope-gate-title">
              范围门禁 · 已拦截 {counters.scopeRejected} 条
            </div>
            <div className="message-analysis-scope-gate-list">
              <span>
                含义：LLM 返回了规则命中，但最终发送人 / 群组范围未通过。
              </span>
              <span>
                依据：本机最近保留 {scopeRejectedDiagnostics.length}{' '}
                条范围诊断
                {latestScopeRejectedDiagnostic
                  ? `；最新为 ${formatRuleDiagnosticContext(
                      latestScopeRejectedDiagnostic,
                    )}`
                  : '；当前还没有可展开的最近拦截证据'}
                。
              </span>
              <span>
                边界：被拦截消息没有写入记忆、发送通知、进入摘要 / 自动答复 /
                关注后续 / 联动规划，也没有执行外部动作。
              </span>
              <span>
                下一步：展开带「最近拦截」的规则，核对发送人 / 群组范围或调整规则。
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSystemObservationRuntimeReceipt = () => {
    const items = systemObservationRuntime.items || [];
    const activeStatuses = new Set([
      'pending_approval',
      'scheduled',
      'waiting_reply',
      'deferred',
    ]);
    const activeSessionCount = items.filter((item) =>
      activeStatuses.has(item.latestSession?.status || ''),
    ).length;
    const waitingReplyCount = items.filter(
      (item) => item.latestSession?.status === 'waiting_reply',
    ).length;
    const enabledTemplateCount = items.filter(
      (item) => item.template.enabled !== false,
    ).length;
    const syncIssueCount = items.filter(
      (item) =>
        Boolean(item.template.lastSyncError) ||
        item.template.syncState === 'failed',
    ).length;
    const sourceKinds = Array.from(
      new Set(
        items
          .map((item) => item.template.sourceKind || 'runtime')
          .filter(Boolean),
      ),
    );
    const sampleTargets = items
      .map(
        (item) =>
          item.latestSession?.targetResolvedLabel ||
          item.template.targetRef ||
          item.template.title,
      )
      .filter(Boolean)
      .slice(0, 3);
    const isReady = systemObservationRuntime.status === 'ready';
    const hasLastSnapshot =
      systemObservationRuntime.status === 'failed' &&
      typeof systemObservationRuntime.loadedAt === 'number';
    const hasMetricSnapshot = isReady || hasLastSnapshot;
    const metricSuffix = hasLastSnapshot ? '（上次）' : '';
    const title =
      systemObservationRuntime.status === 'unconfigured'
        ? '系统观察规则回执 · 未连接'
        : systemObservationRuntime.status === 'failed'
          ? hasLastSnapshot
            ? items.length > 0
              ? '系统观察规则回执 · 刷新失败 · 上次快照'
              : '系统观察规则回执 · 刷新失败 · 上次空状态'
            : '系统观察规则回执 · 读取未确认'
          : systemObservationRuntime.status === 'loading'
            ? '系统观察规则回执 · 正在读取'
            : items.length > 0
              ? '系统观察规则回执 · 运行时只读'
              : '系统观察规则回执 · 当前为空';
    const subtitle =
      systemObservationRuntime.status === 'unconfigured'
        ? 'Memory Service 未配置，无法读取 Outreach / 自我反思等运行时观察状态。'
        : systemObservationRuntime.status === 'failed'
          ? hasLastSnapshot
            ? `本次没有确认系统观察状态：${systemObservationRuntime.error || '读取失败'}。保留 ${formatDateTime(
                systemObservationRuntime.loadedAt,
              )} 的上次${
                items.length > 0 ? `快照 ${items.length} 条` : '空状态'
              }；它不证明当前仍在运行或已经停止。`
            : `本次没有确认系统观察状态：${systemObservationRuntime.error || '读取失败'}。`
          : systemObservationRuntime.status === 'loading'
            ? '正在从 Memory Service 读取 Outreach 模板与会话观察状态。'
            : items.length > 0
              ? `读取到 ${items.length} 条 Outreach 模板观察，${activeSessionCount} 条有进行中的系统观察会话。`
              : '当前没有可展示的 Outreach 系统观察模板；手动规则列表仍按本机配置运行。';
    const refreshBoundary = getSystemObservationRefreshBoundary(
      systemObservationRuntime,
    );

    return (
      <div
        className={`system-observation-receipt ${systemObservationRuntime.status}${hasLastSnapshot ? ' snapshot-stale' : ''}`}
        role="status"
        aria-live="polite"
      >
        <div className="system-observation-head">
          <div>
            <div className="system-observation-title">{title}</div>
            <div className="system-observation-subtitle">{subtitle}</div>
          </div>
          <button
            type="button"
            className="system-observation-refresh"
            onClick={() => void loadSystemObservationRuntime()}
            disabled={systemObservationRuntime.status === 'loading'}
            title={refreshBoundary}
            aria-label={refreshBoundary}
          >
            刷新
          </button>
        </div>
        <div className="system-observation-grid">
          <span>手动规则 {topics.length}</span>
          <span>
            运行时观察{' '}
            {hasMetricSnapshot ? `${items.length}${metricSuffix}` : '未确认'}
          </span>
          <span>
            启用模板{' '}
            {hasMetricSnapshot
              ? `${enabledTemplateCount}${metricSuffix}`
              : '未确认'}
          </span>
          <span>
            等待回复{' '}
            {hasMetricSnapshot
              ? `${waitingReplyCount}${metricSuffix}`
              : '未确认'}
          </span>
          <span>
            同步异常{' '}
            {hasMetricSnapshot
              ? `${syncIssueCount}${metricSuffix}`
              : '未确认'}
          </span>
          <span>
            来源{' '}
            {hasMetricSnapshot && sourceKinds.length > 0
              ? `${sourceKinds.join(' / ')}${metricSuffix}`
              : '未确认'}
          </span>
        </div>
        {hasLastSnapshot && (
          <div className="system-observation-stale">
            当前状态未确认：上次读取{' '}
            {formatDateTime(systemObservationRuntime.loadedAt)}，本次失败{' '}
            {formatDateTime(systemObservationRuntime.failedAt)}；上次快照只用于排障。
          </div>
        )}
        {sampleTargets.length > 0 && (
          <div className="system-observation-targets">
            观察目标：{sampleTargets.join(' / ')}
          </div>
        )}
        <div className="system-observation-boundary">
          <span>
            这只是读取运行时系统观察状态；不会把 Outreach 会话、自我反思临时观察导入手动规则，也不会参与拖拽排序、导入或导出。
          </span>
          <span>
            查看或刷新不会回扫历史消息、写入记忆、发送通知、生成自动答复、创建 RuntimeAction 或执行外部动作。
          </span>
          {hasLastSnapshot && (
            <span>
              上次快照不作为当前运行状态证明；它不代表系统观察仍在运行，也不代表已经停止。
            </span>
          )}
        </div>
      </div>
    );
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

  const getRuleInactiveReceipt = (topic: TopicItem) => {
    if (!topic.expiredAt || topic.expiredAt > Date.now()) return null;

    return {
      title: '已过期规则',
      detail:
        '这条手动规则只保留用于复核、导出或编辑后重新启用；不会继续自动捕获新消息。',
      boundary:
        '过期后不会写入记忆、发送通知、进入摘要、生成自动答复、关注后续或创建联动操作。',
    };
  };

  const getScopeChips = (topic: TopicItem) => {
    const hasGroupScope = Boolean(normalizeOptionalRuleText(topic.filterGroup));
    const hasSenderScope = Boolean(
      normalizeOptionalRuleText(topic.filterSender),
    );
    const globalScopeTitle =
      !hasGroupScope && !hasSenderScope
        ? GLOBAL_SCOPE_GUIDANCE_TEXT
        : undefined;

    return [
      {
        key: 'group',
        text: `群组：${formatScopeList(topic.filterGroup, '不限')}`,
        title: !hasGroupScope ? globalScopeTitle : undefined,
      },
      {
        key: 'sender',
        text: `发送人：${formatScopeList(topic.filterSender, '不限')}`,
        title: !hasSenderScope ? globalScopeTitle : undefined,
      },
    ];
  };

  const getTopicScopeGuidanceText = (topic: TopicItem) =>
    getScopeGuidanceText({
      filterSender: topic.filterSender,
      filterGroup: topic.filterGroup,
    });

  const getTopicSafetySummary = (topic: TopicItem) =>
    getRuleSafetySummary({
      filterSender: topic.filterSender,
      filterGroup: topic.filterGroup,
      notifyMethod: topic.notifyMethod,
      digestEnabled: Boolean(topic.digestConfig?.enabled),
      followThread: Boolean(topic.followThread),
      automationPrompt: topic.automationPrompt,
      automationRequiresApproval: topic.automationRequiresApproval,
    });

  const getTopicActionSummaryItems = (topic: TopicItem) =>
    getRuleActionSummaryItems({
      notifyMethod: topic.notifyMethod || '',
      mentionMe: Boolean(topic.mentionMe),
      digestEnabled: Boolean(topic.digestConfig?.enabled) && !topic.followThread,
      digestFrequency: topic.digestConfig?.frequency || 'daily',
      autoReply: Boolean(topic.autoReply),
      autoReplyMode: topic.autoReplyConfig?.reviewMode || 'delayed',
      followThread: Boolean(topic.followThread),
      automationPrompt: topic.automationPrompt,
      automationRequiresApproval: topic.automationRequiresApproval === true,
      openClawConfigured,
    });

  const getTopicDeliveryReceipt = (topic: TopicItem) =>
    getRuleDeliveryReceipt({
      notifyMethod: topic.notifyMethod || '',
      mentionMe: Boolean(topic.mentionMe),
      digestEnabled: Boolean(topic.digestConfig?.enabled) && !topic.followThread,
      digestFrequency: topic.digestConfig?.frequency || 'daily',
      followThread: Boolean(topic.followThread),
      autoReply: Boolean(topic.autoReply),
      autoReplyMode: topic.autoReplyConfig?.reviewMode || 'delayed',
      automationPrompt: topic.automationPrompt,
      automationRequiresApproval: topic.automationRequiresApproval === true,
      openClawConfigured,
    });

  const getTopicEffectBoundaryReceipt = (topic: TopicItem) =>
    getRuleEffectBoundaryReceipt({
      notifyMethod: topic.notifyMethod || '',
      mentionMe: Boolean(topic.mentionMe),
      digestEnabled: Boolean(topic.digestConfig?.enabled) && !topic.followThread,
      digestFrequency: topic.digestConfig?.frequency || 'daily',
      followThread: Boolean(topic.followThread),
      autoReply: Boolean(topic.autoReply),
      autoReplyMode: topic.autoReplyConfig?.reviewMode || 'delayed',
      automationPrompt: topic.automationPrompt,
      automationRequiresApproval: topic.automationRequiresApproval === true,
      openClawConfigured,
    });

  const getTopicRunPreviewReceipt = (topic: TopicItem) =>
    getRuleRunPreviewReceipt({
      notifyMethod: topic.notifyMethod || '',
      mentionMe: Boolean(topic.mentionMe),
      digestEnabled: Boolean(topic.digestConfig?.enabled) && !topic.followThread,
      digestFrequency: topic.digestConfig?.frequency || 'daily',
      followThread: Boolean(topic.followThread),
      autoReply: Boolean(topic.autoReply),
      autoReplyMode: topic.autoReplyConfig?.reviewMode || 'delayed',
      automationPrompt: topic.automationPrompt,
      automationRequiresApproval: topic.automationRequiresApproval === true,
      openClawConfigured,
      isSilentAnalysisEnabled,
      inactive: Boolean(topic.expiredAt && topic.expiredAt <= Date.now()),
    });

  const getTopicAutoReplySaveButtonBoundary = (
    topic: TopicItem,
    action: 'create' | 'edit',
  ) =>
    topic.autoReply && topic.autoReplyConfig
      ? buildAutoReplySaveButtonBoundary({
          ...topic.autoReplyConfig,
          action,
          filterSender: topic.filterSender,
          filterGroup: topic.filterGroup,
          isSilentAnalysisEnabled,
        })
      : undefined;

  const buildManualRuleSaveButtonBoundary = (
    receipt: ReturnType<typeof getRuleRunPreviewReceipt>,
    action: 'create' | 'edit',
    ruleText: string,
  ) => {
    const normalizedRuleText = normalizeOptionalRuleText(ruleText);
    const actionText =
      action === 'create'
        ? normalizedRuleText
          ? `确认保存「${normalizedRuleText}」手动记忆入口规则`
          : '确认保存新的手动记忆入口规则'
        : `保存「${normalizedRuleText || '这条'}」手动记忆入口规则的编辑`;

    return `${actionText}：${receipt.triggerText} ${receipt.matchText} ${receipt.outcomeText} ${receipt.boundaryText}`;
  };

  const getTopicSaveButtonBoundary = (
    topic: TopicItem,
    action: 'create' | 'edit',
  ) =>
    getTopicAutoReplySaveButtonBoundary(topic, action) ||
    buildManualRuleSaveButtonBoundary(
      getTopicRunPreviewReceipt(topic),
      action,
      topic.text,
    );

  const shouldShowSavedRunPreview = (topic: TopicItem) =>
    !isSilentAnalysisEnabled ||
    Boolean(topic.expiredAt && topic.expiredAt <= Date.now());

  const renderDeliveryReceipt = (
    receipt: ReturnType<typeof getRuleDeliveryReceipt>,
  ) => (
    <div
      className={`rule-delivery-receipt ${receipt.tone}`}
      aria-label="规则命中后的分发路径"
    >
      <span className="rule-delivery-title">
        分发路径 · {receipt.label}
      </span>
      <span>{receipt.detail}</span>
    </div>
  );

  const renderEffectBoundaryReceipt = (
    receipt: ReturnType<typeof getRuleEffectBoundaryReceipt>,
  ) => (
    <div
      className={`rule-effect-boundary ${receipt.tone}`}
      aria-label="规则命中后的副作用边界"
    >
      <div className="rule-effect-boundary-title">{receipt.label}</div>
      <div className="rule-effect-boundary-list">
        {receipt.items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  );

  const renderRuleRunPreviewReceipt = (
    receipt: ReturnType<typeof getRuleRunPreviewReceipt>,
    mode: 'draft' | 'saved' = 'draft',
  ) => {
    const title =
      mode === 'saved'
        ? receipt.title.replace('保存前运行路径', '已保存运行状态')
        : receipt.title;

    return (
      <div
        className={`rule-run-preview ${receipt.tone}`}
        aria-label={mode === 'saved' ? '已保存规则运行状态' : '规则保存前运行路径'}
      >
        <div className="rule-run-preview-title">{title}</div>
        <div className="rule-run-preview-grid">
          <span>{receipt.triggerText}</span>
          <span>{receipt.matchText}</span>
          <span>{receipt.outcomeText}</span>
          <span>{receipt.boundaryText}</span>
        </div>
      </div>
    );
  };

  // 分发路径 + 副作用边界统一以"弱化脚注"形式呈现（create/edit/list 一致）。
  // effect 传 null 时只显示分发路径（列表视图不展示副作用边界）。
  const renderRuleReceiptFootnotes = (
    delivery: ReturnType<typeof getRuleDeliveryReceipt>,
    effect: ReturnType<typeof getRuleEffectBoundaryReceipt> | null,
  ) => (
    <div className="rule-receipt-footnote">
      {renderDeliveryReceipt(delivery)}
      {effect ? renderEffectBoundaryReceipt(effect) : null}
    </div>
  );

  // 联动操作（OpenClaw）配置块——作为"则"动作的一部分，嵌在 new-rule-receipt 内部渲染。
  const renderNewAutomationConfig = () => (
    <div
      className={`automation-config compact-disclosure nested ${
        isNewAutomationExpanded ? 'expanded' : 'collapsed'
      }`}
    >
      <button
        type="button"
        className="automation-disclosure-btn"
        onClick={() => setIsNewAutomationExpanded(!isNewAutomationExpanded)}
        aria-expanded={isNewAutomationExpanded}
      >
        <span className="automation-disclosure-copy">
          <span className="config-title">联动操作（OpenClaw）</span>
          <span className="hint-text">
            {newAutomationPrompt.trim()
              ? '已填写，命中后会生成 RuntimeAction'
              : '可选，需要外部执行时再展开填写'}
          </span>
        </span>
        <span className="automation-disclosure-state">
          {newAutomationPrompt.trim() ? (
            <span
              className={`rule-badge ${openClawConfigured ? 'info' : 'warn'}`}
            >
              {openClawConfigured ? '已激活' : '待激活'}
            </span>
          ) : (
            <span className="rule-badge muted">未启用</span>
          )}
          <span className="disclosure-chevron" aria-hidden="true">
            {isNewAutomationExpanded ? '收起' : '展开'}
          </span>
        </span>
      </button>
      {isNewAutomationExpanded && (
        <div className="config-section automation-config-body">
          <div className="config-title-row automation-body-head">
            <div className="hint-text">自然语言动作描述</div>
            <div className="config-icon-actions" aria-label="联动操作快捷操作">
              <button
                type="button"
                className="icon-action-btn"
                onClick={() => void requestLinkedActionSuggestion(true)}
                disabled={linkedActionSuggestionStatus === 'loading'}
                title={
                  linkedActionSuggestionStatus === 'loading'
                    ? '正在生成联动操作建议'
                    : linkedActionSuggestionStatus === 'ready'
                      ? '重新生成联动操作建议'
                      : '生成联动操作建议'
                }
                aria-label={
                  linkedActionSuggestionStatus === 'loading'
                    ? '正在生成联动操作建议'
                    : linkedActionSuggestionStatus === 'ready'
                      ? '重新生成联动操作建议'
                      : '生成联动操作建议'
                }
              >
                {linkedActionSuggestionStatus === 'loading' ? (
                  <span className="icon-button-spinner" aria-hidden="true" />
                ) : (
                  <SparklesIcon />
                )}
              </button>
              <button
                type="button"
                className="icon-action-btn"
                onClick={() => void requestAutomationPreview('new')}
                disabled={
                  !newAutomationPrompt.trim() ||
                  newAutomationPreview.status === 'loading'
                }
                title={
                  newAutomationPreview.status === 'loading'
                    ? '正在预演联动操作'
                    : '预演并改进'
                }
                aria-label={
                  newAutomationPreview.status === 'loading'
                    ? '正在预演联动操作'
                    : '预演并改进'
                }
              >
                {newAutomationPreview.status === 'loading' ? (
                  <span className="icon-button-spinner" aria-hidden="true" />
                ) : (
                  <PlayIcon />
                )}
              </button>
            </div>
          </div>
          {renderLinkedActionTriggerContextPanel()}
          <div className="automation-input-shell">
            <textarea
              className="reply-content-input"
              placeholder="例如：从消息中提取日期和对象，生成一个 future RuntimeAction，在指定时间执行后续动作。留空表示不创建联动操作。"
              value={newAutomationPrompt}
              onChange={(e) => {
                linkedActionSuggestionRequestIdRef.current += 1;
                setNewAutomationPrompt(e.target.value);
                newAutomationPromptRef.current = e.target.value;
                setNewAutomationPreview({ status: 'idle' });
                setLinkedActionSuggestionStatus('idle');
                setLinkedActionSuggestionSource('');
                setLinkedActionSuggestionError('');
                setLinkedActionSuggestionFallback('');
              }}
              rows={4}
            />
          </div>
          {renderOpenClawDraftNotice()}
          {linkedActionSuggestionSource ? (
            <div className="automation-meta-row">
              <span className="hint-text suggestion-source-text">
                来源：{linkedActionSuggestionSource}
              </span>
            </div>
          ) : null}
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
                      setNewAutomationPrompt(linkedActionSuggestionFallback);
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
          }, {
            context: getDraftLinkedActionContext(),
            requiresApproval: newAutomationRequiresApproval,
          })}
          <label className="checkbox-container">
            <input
              type="checkbox"
              checked={!newAutomationRequiresApproval}
              onChange={(e) => setNewAutomationRequiresApproval(!e.target.checked)}
              disabled={!newAutomationPrompt.trim()}
            />
            操作无需批准
          </label>
          <div className="hint-text">
            这里保存的是手动规则的自然语言联动操作。命中后仍默认写入记忆；如果
            OpenClaw 还没配置，则会以待激活状态保存。
          </div>
          {renderLinkedActionExecutionPreview({
            prompt: newAutomationPrompt,
            context: getDraftLinkedActionContext(),
            requiresApproval: newAutomationRequiresApproval,
          })}
        </div>
      )}
    </div>
  );

  const renderRuleExportReceipt = () => {
    if (!ruleExportReceipt) return null;
    const hasExportedRules = ruleExportReceipt.exportedCount > 0;

    return (
      <div className="rule-transfer-receipt rule-export-receipt" role="status" aria-live="polite">
        <div className="rule-transfer-receipt-head">
          <div>
            <div className="rule-transfer-receipt-title">
              {hasExportedRules
                ? '导出规则回执'
                : '导出规则回执 · 无手动规则'}
            </div>
            <div className="rule-transfer-receipt-subtitle">
              {hasExportedRules
                ? `已导出 ${ruleExportReceipt.exportedCount} 条本机手动规则`
                : '未生成 XML 文件 · 本机当前没有可导出的手动规则'}{' '}
              · {formatDateTime(ruleExportReceipt.exportedAt)}
            </div>
          </div>
          <button
            type="button"
            className="rule-transfer-clear"
            onClick={() => setRuleExportReceipt(null)}
            aria-label="清除导出规则回执"
          >
            清除
          </button>
        </div>
        <div className="rule-transfer-file">
          {hasExportedRules
            ? ruleExportReceipt.fileName
            : '没有下载 XML 文件'}
        </div>
        <div className="rule-transfer-metrics">
          <span>静默入库 {ruleExportReceipt.deliveryCounts.silent}</span>
          <span>摘要 {ruleExportReceipt.deliveryCounts.digest}</span>
          <span>即时通知 {ruleExportReceipt.deliveryCounts.notify}</span>
          <span>关注后续 {ruleExportReceipt.deliveryCounts.followup}</span>
          <span>自动答复 {ruleExportReceipt.autoReplyCount}</span>
          <span>联动操作 {ruleExportReceipt.automationCount}</span>
        </div>
        <div className="rule-transfer-boundaries">
          <span>
            {hasExportedRules
              ? '导出文件只包含你手动维护的记忆入口规则；系统观察规则、Outreach 会话和自我反思临时观察不会进入 XML。'
              : '本机手动规则列表为空；系统观察规则、Outreach 会话和自我反思临时观察不会为了导出生成 XML。'}
          </span>
          <span>
            {hasExportedRules
              ? '导出只读取本机 Chrome storage，不会自动分析历史消息、发送通知、创建 RuntimeAction 或执行外部写操作。'
              : '这次只确认本机 Chrome storage 没有可导出的手动规则；没有下载文件，也不会自动分析历史消息、发送通知、创建 RuntimeAction 或执行外部写操作。'}
          </span>
          <span>
            {isSilentAnalysisEnabled
              ? '后台记忆采集仍按当前本机规则继续运行；导出不会暂停或重启采集。'
              : '后台记忆采集未开启；导出的规则文件也不会让新消息自动捕获。'}
          </span>
          <span>
            {ruleExportReceipt.openClawPendingCount > 0
              ? `OpenClaw 未连接：导出中有 ${ruleExportReceipt.openClawPendingCount} 条联动操作在本机仍是待激活。`
              : ruleExportReceipt.automationCount > 0
                ? '导出的联动操作只是规则描述；实际执行仍以 Action Queue 审批和运行结果为准。'
                : hasExportedRules
                  ? '导出文件中没有联动操作。'
                  : '没有手动联动操作需要导出。'}
          </span>
          <span>
            {ruleExportReceipt.safetyReviewCount > 0
              ? `${ruleExportReceipt.safetyReviewCount} 条规则带全局范围、短范围词或自动执行风险提示；导入到其他环境前需要复核。`
              : hasExportedRules
                ? '导出时没有发现需要重点复核的范围安全提示。'
                : '没有手动规则需要安全复核；先创建或导入规则后才会生成 XML。'}
          </span>
          <span>
            {memoryServiceConfigured
              ? 'Memory Service 已配置，但导出不会同步、删除、恢复或覆盖 Memory Service 里的记忆。'
              : 'Memory Service 未配置；导出仍只来自本机规则列表。'}
          </span>
        </div>
      </div>
    );
  };

  const renderRuleImportReceipt = () => {
    if (!ruleImportReceipt) return null;

    return (
      <div className="rule-transfer-receipt rule-import-receipt" role="status" aria-live="polite">
        <div className="rule-transfer-receipt-head">
          <div>
            <div className="rule-transfer-receipt-title">导入规则回执</div>
            <div className="rule-transfer-receipt-subtitle">
              从 XML 导入 {ruleImportReceipt.importedCount} 条手动规则 ·{' '}
              已替换 {ruleImportReceipt.replacedManualCount} 条本机手动规则 ·{' '}
              {formatDateTime(ruleImportReceipt.importedAt)}
            </div>
          </div>
          <button
            type="button"
            className="rule-transfer-clear"
            onClick={() => setRuleImportReceipt(null)}
            aria-label="清除导入规则回执"
          >
            清除
          </button>
        </div>
        <div className="rule-transfer-file">{ruleImportReceipt.fileName}</div>
        <div className="rule-transfer-metrics">
          <span>静默入库 {ruleImportReceipt.deliveryCounts.silent}</span>
          <span>摘要 {ruleImportReceipt.deliveryCounts.digest}</span>
          <span>即时通知 {ruleImportReceipt.deliveryCounts.notify}</span>
          <span>关注后续 {ruleImportReceipt.deliveryCounts.followup}</span>
          <span>自动答复 {ruleImportReceipt.autoReplyCount}</span>
          <span>联动操作 {ruleImportReceipt.automationCount}</span>
        </div>
        <div className="rule-transfer-boundaries">
          <span>
            系统观察规则没有导入或覆盖；Outreach / 自我反思观察仍按运行时状态只读展示。
          </span>
          <span>
            导入只替换手动规则列表，不会自动分析历史消息、发送通知、创建 RuntimeAction 或执行外部写操作。
          </span>
          <span>
            {isSilentAnalysisEnabled
              ? '后台记忆采集运行中：后续新消息会按导入后的规则继续观察。'
              : '后台记忆采集未开启：规则已保存，但不会自动捕获新消息。'}
          </span>
          <span>
            {ruleImportReceipt.openClawPendingCount > 0
              ? `OpenClaw 未连接：${ruleImportReceipt.openClawPendingCount} 条联动操作先保存为待激活。`
              : ruleImportReceipt.automationCount > 0
                ? '联动操作已导入；实际执行仍以 Action Queue 审批和运行结果为准。'
                : '没有导入联动操作。'}
          </span>
          <span>
            {ruleImportReceipt.safetyReviewCount > 0
              ? `${ruleImportReceipt.safetyReviewCount} 条规则带全局范围、短范围词或自动执行风险提示。`
              : '导入规则的范围安全摘要已重新计算。'}
          </span>
          <span>
            {memoryServiceConfigured
              ? 'Memory Service 已配置；导入本身只写本机规则，后续同步沿用现有 snapshot 机制。'
              : 'Memory Service 未配置；导入只保存在本机 Chrome storage。'}
          </span>
        </div>
      </div>
    );
  };

  const renderRuleOrderReceipt = () => {
    if (!ruleOrderReceipt) return null;

    return (
      <div
        className="rule-transfer-receipt rule-order-receipt"
        role="status"
        aria-live="polite"
      >
        <div className="rule-transfer-receipt-head">
          <div>
            <div className="rule-transfer-receipt-title">规则排序回执</div>
            <div className="rule-transfer-receipt-subtitle">
              已保存「{ruleOrderReceipt.movedRuleName}」从第{' '}
              {ruleOrderReceipt.fromPosition} 位到第{' '}
              {ruleOrderReceipt.toPosition} 位 ·{' '}
              {formatDateTime(ruleOrderReceipt.orderedAt)}
            </div>
          </div>
          <button
            type="button"
            className="rule-transfer-clear"
            onClick={() => setRuleOrderReceipt(null)}
            aria-label="清除规则排序回执"
          >
            清除
          </button>
        </div>
        <div className="rule-transfer-metrics">
          <span>手动规则 {ruleOrderReceipt.totalCount}</span>
          <span>新位置 第 {ruleOrderReceipt.toPosition} 位</span>
          <span>本机排序已保存</span>
        </div>
        <div className="rule-transfer-boundaries">
          <span>
            排序只改写本机手动记忆入口规则列表；系统观察规则、Outreach
            会话和自我反思临时观察不参与排序，也不会被覆盖。
          </span>
          <span>
            新顺序只影响后续分析的提示顺序，以及同一消息命中多条规则时的优先分发口径。
          </span>
          <span>
            本次拖拽不会回扫历史消息、立即写入记忆、发送通知、创建 RuntimeAction
            或执行 OpenClaw。
          </span>
          <span>
            Memory Service snapshot 同步仍沿用现有机制；这次排序本身不直接同步、删除或恢复后端记忆。
          </span>
        </div>
      </div>
    );
  };

  const getLatestDiagnosticForTopic = (topic: TopicItem) =>
    getLatestRuleDiagnostic(ruleDiagnostics, getRuleRef(topic));

  const formatRuleDiagnosticTime = (
    diagnostic: MessageAnalysisRuleDiagnostic,
  ) => formatDateTime(diagnostic.datetime || diagnostic.capturedAt);

  const formatRuleDiagnosticContext = (
    diagnostic: MessageAnalysisRuleDiagnostic,
  ) => {
    const parts = [
      diagnostic.groupName || diagnostic.groupId
        ? `群组 ${diagnostic.groupName || diagnostic.groupId}`
        : '',
      diagnostic.sender ? `发送人 ${diagnostic.sender}` : '',
      diagnostic.postId ? `消息 ${diagnostic.postId}` : '',
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : '没有可用消息上下文';
  };

  const renderRuleDiagnostic = (topic: TopicItem) => {
    const diagnostic = getLatestDiagnosticForTopic(topic);
    if (!diagnostic) return null;

    return (
      <div className="rule-diagnostic scope-rejected" aria-label="最近规则拦截">
        <div className="rule-diagnostic-head">
          <span className="rule-badge safety-warn">最近拦截</span>
          <span>{formatRuleDiagnosticTime(diagnostic)}</span>
        </div>
        <div className="rule-diagnostic-reason">{diagnostic.reason}</div>
        <div className="rule-diagnostic-context">
          {formatRuleDiagnosticContext(diagnostic)}
        </div>
      </div>
    );
  };

  const getRuleDiagnosticSummaryBoundary = (topic: TopicItem) => {
    const diagnostic = getLatestDiagnosticForTopic(topic);
    if (!diagnostic) return undefined;

    return `最近范围拦截：${diagnostic.reason}；${formatRuleDiagnosticContext(
      diagnostic,
    )}；${formatRuleDiagnosticTime(
      diagnostic,
    )}。点击展开只查看这条规则的范围诊断，不会重新分析历史消息、写入记忆、发送通知或执行外部动作。`;
  };

  const getTopicSummaryAriaLabel = (topic: TopicItem) => {
    const diagnosticBoundary = getRuleDiagnosticSummaryBoundary(topic);
    return diagnosticBoundary
      ? `展开规则：${topic.text}。${diagnosticBoundary}`
      : `展开规则：${topic.text}`;
  };

  const renderRuleInactiveReceipt = (topic: TopicItem) => {
    const receipt = getRuleInactiveReceipt(topic);
    if (!receipt) return null;

    return (
      <div className="rule-inactive-receipt expired" aria-label="过期规则边界">
        <span>{receipt.title}</span>
        <p>{receipt.detail}</p>
        <p>{receipt.boundary}</p>
      </div>
    );
  };

  const formatDigestScheduleChip = (
    digestConfig: DigestConfigType,
    options?: { suppressImmediate?: boolean },
  ) => {
    const hour = normalizeConcernedItemsDigestHour(
      digestConfig.preferredHour,
      8,
    );
    const suffix = options?.suppressImmediate ? '（不即时推送）' : '';
    if (digestConfig.frequency === 'weekly') {
      const weekday = getDigestWeekdayLabel(
        normalizeConcernedItemsDigestDayOfWeek(
          digestConfig.preferredDayOfWeek,
          1,
        ),
      );
      return `✓ 每${weekday} ${hour}:00 摘要${suffix}`;
    }
    return `✓ 每日 ${hour}:00 摘要${suffix}`;
  };

  const getCapabilityChips = (topic: TopicItem) => {
    const chips = ['✓ 写入记忆'];
    if (topic.digestConfig?.enabled) {
      chips.push(
        formatDigestScheduleChip(topic.digestConfig, {
          suppressImmediate: true,
        }),
      );
    } else {
      if ((topic.notifyMethod || '').includes('bot')) {
        chips.push(topic.mentionMe ? '✓ Glip 推送 + @提醒' : '✓ Glip 推送');
      }
      if ((topic.notifyMethod || '').includes('chrome')) {
        chips.push('✓ Chrome 通知');
      }
    }
    if (topic.autoReply) {
      chips.push('✓ 自动答复');
    }
    if (topic.followThread) {
      chips.push('✓ 关注后续');
    }
    if (topic.automationPrompt?.trim()) {
      chips.push('✓ 联动操作');
    }
    return chips;
  };

  const getAutomationStatusText = (topic: TopicItem) => {
    if (!topic.automationPrompt?.trim()) return '';
    const requiresApproval = topic.automationRequiresApproval === true;
    return openClawConfigured
      ? requiresApproval
        ? 'OpenClaw 已连接；这条联动操作命中后会生成 RuntimeAction，但执行外部写操作前仍需你批准。'
        : 'OpenClaw 已连接；这条联动操作命中后会生成 RuntimeAction，并按计划自动执行外部写操作。'
      : 'OpenClaw 未配置；这条联动操作会先跟规则一起保存为待激活，连接前不会执行外部写操作。';
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
    const requiresApproval = topic.automationRequiresApproval === true;
    return openClawConfigured
      ? requiresApproval
        ? '尚未看到这条规则创建的 RuntimeAction。首次命中后会进入动作队列，外部写操作会等待你批准。'
        : '尚未看到这条规则创建的 RuntimeAction。首次命中后会进入动作队列，并按这条规则自动执行可执行动作。'
      : requiresApproval
        ? 'OpenClaw 未配置。首次命中后可以先生成需批准的动作计划，但连接前无法执行外部写动作。'
        : 'OpenClaw 未配置。首次命中后可以先生成免批准的动作计划，但连接前无法执行外部写动作。';
  };

  const openOptionsPage = () => {
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('options.html#OPENCLAW_ENABLED')
      : 'options.html#OPENCLAW_ENABLED';
    window.open(url, '_blank');
  };

  const openMemoryEntryRulesHub = () => {
    const url = buildMemoryEntryRulesUrl();
    if (chrome?.tabs?.create) {
      void chrome.tabs.create({ url, active: true });
      return;
    }
    window.open(url, '_blank');
  };

  const renderOpenClawDraftNotice = () => {
    if (openClawConfigured) return null;
    return (
      <div className="automation-offline-note" role="status">
        <span>
          OpenClaw 未连接；你仍可先保存联动操作描述。命中后会保留为待激活动作计划，连接前不会执行外部写操作。
        </span>
        <button
          type="button"
          className="secondary-btn automation-offline-btn"
          onClick={openOptionsPage}
        >
          连接 OpenClaw
        </button>
      </div>
    );
  };

  const renderLinkedActionExecutionPreview = (input: {
    prompt?: string;
    context?: PendingLinkedActionConfig | null;
    requiresApproval: boolean;
  }) => {
    if (!input.prompt?.trim()) return null;

    const preview = buildLinkedActionExecutionPreview({
      context: input.context,
      openClawConfigured,
      requiresApproval: input.requiresApproval,
    });
    const badgeClass =
      preview.tone === 'auto'
        ? 'safety-danger'
        : preview.tone === 'review'
          ? 'safety-ok'
          : 'safety-warn';

    return (
      <div
        className={`linked-action-execution-preview ${preview.tone}`}
        aria-label="联动操作保存前执行预览"
      >
        <div className="linked-action-execution-head">
          <span className="linked-action-execution-title">
            {preview.headline}
          </span>
          <span className={`rule-badge ${badgeClass}`}>{preview.label}</span>
        </div>
        <div className="linked-action-execution-context">
          触发：{preview.contextLine}
        </div>
        <div className="linked-action-execution-list">
          {preview.items.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>
    );
  };

  const renderLinkedActionTriggerContextPanel = () => {
    if (newRuleSource !== 'linkedAction' || !pendingLinkedActionConfig) {
      return null;
    }

    const contextItems = getLinkedActionTriggerContextItems(
      pendingLinkedActionConfig,
      {
        formatDate: (date) => date.toLocaleString(),
      },
    );
    const safeMessageLink = getSafeExternalUrl(
      pendingLinkedActionConfig.messageLink,
    );

    return (
      <div className="supporting-panel linked-action-trigger-panel">
        <div className="supporting-title">触发消息</div>
        <div className="supporting-text">
          {getLinkedActionContextLine(pendingLinkedActionConfig)}
        </div>
        {contextItems.length > 0 && (
          <div className="scope-chip-row">
            {contextItems.map((item) => (
              <span key={`${item.label}:${item.value}`} className="scope-chip">
                {item.label}: {item.value}
              </span>
            ))}
          </div>
        )}
        {safeMessageLink && (
          <div className="supporting-actions">
            <a
              href={safeMessageLink}
              target="_blank"
              rel="noopener noreferrer"
              className="message-link"
            >
              打开原消息
            </a>
          </div>
        )}
      </div>
    );
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
    options: {
      context?: PendingLinkedActionConfig | null;
      requiresApproval?: boolean;
    } = {},
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
    const receipt = buildLinkedActionPreviewReceipt({
      context: options.context,
      canPlan: result.canPlan,
      skippedReason: result.skippedReason,
      actionFamily: result.actionFamily,
      actions: result.actions,
      warnings: result.warnings,
      suggestedPrompt: result.suggestedPrompt,
      requiresApproval: options.requiresApproval,
    });

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
        <div
          className={`automation-preview-receipt ${receipt.tone}`}
          aria-label="联动操作预演结果回执"
        >
          <div className="automation-preview-receipt-title">
            {receipt.title}
          </div>
          <div className="automation-preview-receipt-summary">
            {receipt.summary}
          </div>
          <div className="automation-preview-receipt-items">
            {receipt.items.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
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

  const newRuleActionItems = getRuleActionSummaryItems({
    notifyMethod: newNotifyMethod || '',
    mentionMe: newMentionMe,
    digestEnabled: newDigestEnabled && !newFollowThread,
    digestFrequency: newDigestFrequency,
    autoReply: newAutoReply,
    autoReplyMode: newAutoReplyConfig.reviewMode,
    followThread: newFollowThread,
    automationPrompt: newAutomationPrompt,
    automationRequiresApproval: newAutomationRequiresApproval,
    openClawConfigured,
  });
  const newRuleDeliveryReceipt = getRuleDeliveryReceipt({
    notifyMethod: newNotifyMethod || '',
    mentionMe: newMentionMe,
    digestEnabled: newDigestEnabled && !newFollowThread,
    digestFrequency: newDigestFrequency,
    autoReply: newAutoReply,
    autoReplyMode: newAutoReplyConfig.reviewMode,
    followThread: newFollowThread,
    automationPrompt: newAutomationPrompt,
    automationRequiresApproval: newAutomationRequiresApproval,
    openClawConfigured,
  });
  const newRuleEffectBoundaryReceipt = getRuleEffectBoundaryReceipt({
    notifyMethod: newNotifyMethod || '',
    mentionMe: newMentionMe,
    digestEnabled: newDigestEnabled && !newFollowThread,
    digestFrequency: newDigestFrequency,
    autoReply: newAutoReply,
    autoReplyMode: newAutoReplyConfig.reviewMode,
    followThread: newFollowThread,
    automationPrompt: newAutomationPrompt,
    automationRequiresApproval: newAutomationRequiresApproval,
    openClawConfigured,
  });
  const newRuleRunPreviewReceipt = getRuleRunPreviewReceipt({
    notifyMethod: newNotifyMethod || '',
    mentionMe: newMentionMe,
    digestEnabled: newDigestEnabled && !newFollowThread,
    digestFrequency: newDigestFrequency,
    autoReply: newAutoReply,
    autoReplyMode: newAutoReplyConfig.reviewMode,
    followThread: newFollowThread,
    automationPrompt: newAutomationPrompt,
    automationRequiresApproval: newAutomationRequiresApproval,
    openClawConfigured,
    isSilentAnalysisEnabled,
  });
  const newRuleSafetySummary = getRuleSafetySummary({
    filterSender: newFilterSender,
    filterGroup: newFilterGroup,
    notifyMethod: newNotifyMethod,
    digestEnabled: newDigestEnabled && !newFollowThread,
    followThread: newFollowThread,
    automationPrompt: newAutomationPrompt,
    automationRequiresApproval: newAutomationRequiresApproval,
  });
  const newAutoReplySaveButtonBoundary = newAutoReply
    ? buildAutoReplySaveButtonBoundary({
        ...newAutoReplyConfig,
        action: 'create',
        filterSender: newFilterSender,
        filterGroup: newFilterGroup,
        isSilentAnalysisEnabled,
      })
    : undefined;
  const newManualRuleSaveButtonBoundary = buildManualRuleSaveButtonBoundary(
    newRuleRunPreviewReceipt,
    'create',
    newTopic,
  );
  const newRuleSaveButtonBoundary =
    newAutoReplySaveButtonBoundary || newManualRuleSaveButtonBoundary;
  const newFollowThreadBoundaryReceipt =
    newFollowThread && newFollowConfig
      ? buildFollowThreadDraftBoundaryReceipt({
          groupName:
            newFilterGroup || newFollowConfig.originalMessage.teamName || '',
          filterSender: newFilterSender,
          expiryDays: newExpiry,
          notifyMethod: newNotifyMethod,
          notifyFrequency: newNotifyFrequency,
        })
      : null;
  const renderAutoReplyPrefillReceipt = () => {
    if (
      newRuleSource !== 'autoReply' ||
      !pendingAutoReplyConfig ||
      autoReplyPrefillStatus === 'idle'
    ) {
      return null;
    }

    const sender = pendingAutoReplyConfig.sender?.trim() || '未知发送者';
    const group = pendingAutoReplyConfig.groupName?.trim() || '未知会话';
    const baseBoundary =
      '这里只是在准备一条可编辑规则草稿；尚未保存规则、不会插入 RingCentral 输入框、不会发送消息，也不会创建定时消息队列行。';

    if (autoReplyPrefillStatus === 'loading') {
      return (
        <div className="auto-reply-prefill-receipt loading" aria-live="polite">
          <div className="auto-reply-prefill-title">正在准备自动答复草稿</div>
          <div className="auto-reply-prefill-body">
            <span>
              来源：{group} / {sender} 的消息入口。
            </span>
            <span>{baseBoundary}</span>
            <span>AI 建议返回前，回复内容为空不代表规则已经可发送。</span>
          </div>
        </div>
      );
    }

    if (autoReplyPrefillStatus === 'failed') {
      return (
        <div className="auto-reply-prefill-receipt failed" aria-live="polite">
          <div className="auto-reply-prefill-title">草稿建议未生成</div>
          <div className="auto-reply-prefill-body">
            <span>{baseBoundary}</span>
            <span>
              你可以手动填写固定回复，或重试 AI 建议；保存前不会影响后续消息。
            </span>
            {autoReplyPrefillError ? (
              <span>失败原因：{autoReplyPrefillError}</span>
            ) : null}
          </div>
          <button
            type="button"
            className="secondary-btn auto-reply-prefill-retry"
            onClick={() =>
              void requestAutoReplyPrefillDraft(pendingAutoReplyConfig)
            }
          >
            重试生成草稿
          </button>
        </div>
      );
    }

    return (
      <div className="auto-reply-prefill-receipt ready" aria-live="polite">
        <div className="auto-reply-prefill-title">草稿建议已填入</div>
        <div className="auto-reply-prefill-body">
          <span>
            来源：{group} / {sender} 的消息入口；请先复核文本和发送口径。
          </span>
          <span>{baseBoundary}</span>
        </div>
      </div>
    );
  };
  return (
    <div className={`topic-modal${IS_TASK_SURFACE ? ' task-surface' : ''}`}>
      {/* 任务态的标题、边界口径和出口由外层 memory-exploring 任务头承担 */}
      {!IS_TASK_SURFACE && (
        <div className="page-header">
          <div className="page-copy">
            <div className="page-eyebrow">Manual memory rules</div>
            <h2>记忆入口规则</h2>
            <p>
              配置你希望系统持续观察并写入记忆的消息模式。
            </p>
          </div>
          <div className="page-actions">
            <button
              type="button"
              className="header-secondary-btn"
              onClick={openPromptConfigWindow}
              title="配置自定义提示词和用户上下文"
            >
              ⚙️ 自定义提示词与上下文
            </button>
          </div>
        </div>
      )}

      {!IS_TASK_SURFACE && (
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
      )}

      {!IS_TASK_SURFACE && hasAutomationRules && !openClawConfigured && (
        <div className="warning-banner automation-banner">
          <div className="warning-content">
            <span className="warning-icon">⚡</span>
            <span className="warning-text">
              当前有规则配置了联动操作，但 OpenClaw
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
              静默消息分析未启用！记忆入口规则会先保存，但需要开启后台记忆采集后，才会自动捕获新消息并触发写入记忆、摘要、通知、自动答复、关注后续或联动操作。
            </span>
            <button
              className="warning-action-btn"
              onClick={() => void enableSilentAnalysis('warning')}
              disabled={silentAnalysisControlReceipt?.status === 'pending'}
              title={
                silentAnalysisControlReceipt?.status === 'pending'
                  ? '正在提交开启请求；等待 Task Scheduler 确认'
                  : '开启后台记忆采集；只影响后续新消息'
              }
              aria-label={
                silentAnalysisControlReceipt?.status === 'pending'
                  ? '正在提交开启后台记忆采集请求'
                  : '立即启用后台记忆采集'
              }
            >
              {silentAnalysisControlReceipt?.status === 'pending'
                ? '启用中'
                : '立即启用'}
            </button>
          </div>
        </div>
      )}

      {renderSilentAnalysisControlReceipt()}

      {/* 列表管理动作只属于 hub 形态：任务态里它们既无关，也可能覆盖预填草稿 */}
      {!IS_TASK_SURFACE && (
        <>
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

          {renderSystemObservationRuntimeReceipt()}
          {renderRuleExportReceipt()}
          {renderRuleImportReceipt()}
          {renderRuleOrderReceipt()}
          {renderMessageAnalysisDeliveryReceipt()}

          <div className="section-head">
            <div>
              <h3>我的规则</h3>
            </div>
            <span className="section-count">{topics.length}</span>
          </div>

          {topics.length === 0 && !showAddForm && (
            <div className="empty-state-card">
              <div className="empty-state-title">还没有手动记忆入口规则</div>
              <div className="empty-state-text">
                从一条你想持续观察的消息模式开始。命中后消息会默认写入记忆，你也可以叠加
                Glip 推送、摘要、自动答复、关注后续或联动操作。
              </div>
            </div>
          )}
        </>
      )}

      <div className="rules-stack">
      <div className="topic-list">
        {(IS_TASK_SURFACE ? [] : topics).map((topic, index) => (
          <div
            key={topic.id}
            className={`topic-item ${editingTopic?.id === topic.id ? 'editing' : ''} ${dragOverItem === index ? 'drag-over' : ''}`}
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
                      placeholder="留空表示不限发送人；多个用逗号分隔"
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
                      placeholder="留空表示不限群组；多个用逗号分隔"
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
                                normalizeAutoReplyDelayHours(
                                  editingTopic.autoReplyConfig?.delayHours,
                                )
                              }
                              onChange={(e) =>
                                setEditingTopic({
                                  ...editingTopic,
                                  autoReplyConfig: {
                                    ...editingTopic.autoReplyConfig!,
                                    delayHours: normalizeAutoReplyDelayHours(
                                      e.target.value,
                                    ),
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
                      {editingTopic.autoReplyConfig && (
                        <AutoReplyModeReceiptPanel
                          config={editingTopic.autoReplyConfig}
                          filterSender={editingTopic.filterSender}
                          filterGroup={editingTopic.filterGroup}
                        />
                      )}
                    </div>
                  </div>
                )}

                <div
                  className={`automation-config compact-disclosure ${
                    isEditingAutomationExpanded ? 'expanded' : 'collapsed'
                  }`}
                >
                  <button
                    type="button"
                    className="automation-disclosure-btn"
                    onClick={() =>
                      setIsEditingAutomationExpanded(
                        !isEditingAutomationExpanded,
                      )
                    }
                    aria-expanded={isEditingAutomationExpanded}
                  >
                    <span className="automation-disclosure-copy">
                      <span className="config-title">
                        联动操作（OpenClaw）
                      </span>
                      <span className="hint-text">
                        {editingTopic.automationPrompt?.trim()
                          ? '已填写，命中后会生成 RuntimeAction'
                          : '可选，需要外部执行时再展开填写'}
                      </span>
                    </span>
                    <span className="automation-disclosure-state">
                      {editingTopic.automationPrompt?.trim() ? (
                        <span
                          className={`rule-badge ${
                            openClawConfigured ? 'info' : 'warn'
                          }`}
                        >
                          {openClawConfigured ? '已激活' : '待激活'}
                        </span>
                      ) : (
                        <span className="rule-badge muted">未启用</span>
                      )}
                      <span className="disclosure-chevron" aria-hidden="true">
                        {isEditingAutomationExpanded ? '收起' : '展开'}
                      </span>
                    </span>
                  </button>
                  {isEditingAutomationExpanded && (
                    <div className="config-section automation-config-body">
                      <div className="config-title-row automation-body-head">
                        <div className="hint-text">自然语言动作描述</div>
                        <div
                          className="config-icon-actions"
                          aria-label="联动操作快捷操作"
                        >
                          <button
                            type="button"
                            className="icon-action-btn"
                            onClick={() =>
                              void requestAutomationPreview('edit')
                            }
                            disabled={
                              !editingTopic.automationPrompt?.trim() ||
                              editingAutomationPreview.status === 'loading'
                            }
                            title={
                              editingAutomationPreview.status === 'loading'
                                ? '正在预演联动操作'
                                : '预演并改进'
                            }
                            aria-label={
                              editingAutomationPreview.status === 'loading'
                                ? '正在预演联动操作'
                                : '预演并改进'
                            }
                          >
                            {editingAutomationPreview.status === 'loading' ? (
                              <span
                                className="icon-button-spinner"
                                aria-hidden="true"
                              />
                            ) : (
                              <PlayIcon />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="automation-input-shell">
                        <textarea
                          className="reply-content-input"
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
                        />
                      </div>
                      {renderOpenClawDraftNotice()}
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
                      {renderLinkedActionExecutionPreview({
                        prompt: editingTopic.automationPrompt,
                        context: getTopicLinkedActionContext(editingTopic),
                        requiresApproval:
                          editingTopic.automationRequiresApproval === true,
                      })}
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
                      {renderAutomationPreview(
                        editingAutomationPreview,
                        (suggestedPrompt) => {
                          setEditingTopic({
                            ...editingTopic,
                            automationPrompt: suggestedPrompt,
                          });
                          setEditingAutomationPreview({ status: 'idle' });
                        },
                        {
                          context: getTopicLinkedActionContext(editingTopic),
                          requiresApproval:
                            editingTopic.automationRequiresApproval === true,
                        },
                      )}
                    </div>
                  )}
                </div>

                {/* 编辑时的摘要配置区域 */}
                {!editingTopic.followThread && (
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
                    {/* 原消息（默认折叠，仅供参考） */}
                    <div className="config-section">
                      <FollowOriginalMessageSection
                        message={editingTopic.followConfig.originalMessage}
                      />
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

                    {/* 通知频率（推送渠道由上方勾选决定） */}
                    <div className="config-section">
                      <div className="config-title">通知频率：</div>
                      <div className="radio-group inline">
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
                      <div className="hint-text">
                        推送渠道由上方「Glip推送 / Chrome通知」勾选决定
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

                <div className="new-rule-receipt" aria-label="编辑规则保存摘要">
                  <div className="new-rule-receipt-main">
                    <span className="rule-path-label then">则</span>
                    <div className="rule-action-chip-row compact">
                      {getTopicActionSummaryItems(editingTopic).map((item) => (
                        <span className="rule-badge muted" key={item}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="new-rule-receipt-meta">
                    <span>
                      范围：
                      {getScopeSummaryText({
                        filterSender: editingTopic.filterSender,
                        filterGroup: editingTopic.filterGroup,
                      })}
                    </span>
                    <span
                      className={`rule-safety-inline ${
                        getTopicSafetySummary(editingTopic).tone
                      }`}
                    >
                      <span
                        className={`rule-badge safety-${
                          getTopicSafetySummary(editingTopic).tone
                        }`}
                      >
                        {getTopicSafetySummary(editingTopic).label}
                      </span>
                      {getTopicSafetySummary(editingTopic).reasons.join(' / ')}
                    </span>
                  </div>
                  {renderRuleRunPreviewReceipt(
                    getTopicRunPreviewReceipt(editingTopic),
                  )}
                </div>

                {/* 分发路径 + 副作用边界 · 弱化脚注 */}
                {renderRuleReceiptFootnotes(
                  getTopicDeliveryReceipt(editingTopic),
                  getTopicEffectBoundaryReceipt(editingTopic),
                )}

                <div className="form-buttons">
                  <button
                    onClick={handleSaveEdit}
                    title={getTopicSaveButtonBoundary(editingTopic, 'edit')}
                    aria-label={getTopicSaveButtonBoundary(
                      editingTopic,
                      'edit',
                    )}
                  >
                    保存
                  </button>
                  <button
                    onClick={() => {
                      setEditingTopic(null);
                      setEditingAutomationPreview({ status: 'idle' });
                      setIsEditingAutomationExpanded(false);
                      setPendingRuleImprovement(null);
                    }}
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`topic-display ${
                  isTopicExpanded(topic.id) ? 'expanded' : 'collapsed'
                }`}
              >
                {!isTopicExpanded(topic.id) ? (
                  <div
                    className="topic-summary-row"
                    role="button"
                    tabIndex={0}
                    aria-expanded="false"
                    aria-label={getTopicSummaryAriaLabel(topic)}
                    title={getRuleDiagnosticSummaryBoundary(topic)}
                    onClick={() => toggleTopicExpanded(topic.id)}
                    onKeyDown={(event) =>
                      handleTopicSummaryKeyDown(event, topic.id)
                    }
                  >
                    <span className="drag-handle topic-summary-drag">⋮⋮</span>
                    <span className="topic-summary-content" title={topic.text}>
                      {topic.text}
                    </span>
                    <span
                      className="topic-summary-capabilities"
                      aria-label="规则动作"
                    >
                      {getCapabilityChips(topic).map((chip) => (
                        <span
                          key={chip}
                          className="capability-chip topic-summary-chip"
                        >
                          {chip}
                        </span>
                      ))}
                      {getRuleDiagnosticSummaryBoundary(topic) && (
                        <span
                          className="rule-badge safety-warn topic-summary-diagnostic"
                          title={getRuleDiagnosticSummaryBoundary(topic)}
                        >
                          最近拦截
                        </span>
                      )}
                    </span>
                    <span className="topic-summary-chevron" aria-hidden="true">
                      ›
                    </span>
                  </div>
                ) : (
                  <>
                <div
                  className="rule-card-top"
                  role="button"
                  tabIndex={0}
                  aria-expanded="true"
                  title="点击收起"
                  onClick={() => toggleTopicExpanded(topic.id)}
                  onKeyDown={(event) =>
                    handleTopicSummaryKeyDown(event, topic.id)
                  }
                >
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
                  <span
                    className={`rule-badge safety-${getTopicSafetySummary(topic).tone}`}
                    title={getTopicSafetySummary(topic).reasons.join(' / ')}
                  >
                    {getTopicSafetySummary(topic).label}
                  </span>
                  <span className="rule-ref">{getRuleRef(topic)}</span>
                </div>
                {renderRuleInactiveReceipt(topic)}

                <div className="rule-block when-block">
                  <span className="block-label when-label">当</span>
                  <div className="block-body">
                    <div className="topic-text" title={topic.text}>
                      {topic.text}
                    </div>
                    <div className="scope-chip-row">
                      {getScopeChips(topic).map((chip) => (
                        <span
                          key={chip.key}
                          className="scope-chip"
                          title={chip.title}
                        >
                          {chip.text}
                        </span>
                      ))}
                    </div>
                    {renderRuleDiagnostic(topic)}
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
                    {/* 列表里：分发路径弱化展示，副作用边界不展示 */}
                    {renderRuleReceiptFootnotes(
                      getTopicDeliveryReceipt(topic),
                      null,
                    )}
                    {shouldShowSavedRunPreview(topic) &&
                      renderRuleRunPreviewReceipt(
                        getTopicRunPreviewReceipt(topic),
                        'saved',
                      )}
                    {topic.followThread && topic.followConfig && (
                      <div className="supporting-panel">
                        <div className="supporting-title">关注后续上下文</div>
                        <FollowOriginalMessageSection
                          message={topic.followConfig.originalMessage}
                        />
                        <div className="supporting-text">
                          来自 {topic.followConfig.originalMessage.teamName} ·{' '}
                          {getFollowThreadSummary(topic)}
                        </div>
                        <div className="supporting-text muted-copy follow-thread-boundary-note">
                          只统计这条手动关注；内部观察不计入这里，也不触发此规则通知/回复/联动。
                        </div>
                      </div>
                    )}
                    {topic.autoReply && topic.autoReplyConfig && (
                      <div className="supporting-panel">
                        {(() => {
                          const readiness =
                            buildAutoReplyContentReadinessReceipt(
                              topic.autoReplyConfig,
                            );
                          return (
                            <>
                              <div className="supporting-title">
                                {readiness.listTitle}
                                <span
                                  className={`rule-badge ${readiness.tone === 'safe' ? 'info' : readiness.tone === 'warning' ? 'warn' : 'danger'}`}
                                  style={{ marginLeft: 8 }}
                                >
                                  {readiness.title}
                                </span>
                              </div>
                              <div className="supporting-text">
                                {readiness.listSummary}
                              </div>
                              {readiness.tone !== 'safe' && (
                                <div className="supporting-text muted-copy">
                                  {readiness.recoveryText}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                    {topic.automationPrompt?.trim() && (
                      <div className="supporting-panel">
                        <div className="automation-panel-head">
                          <div className="supporting-title">
                            联动操作
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
                    disabled={deletingTopicId === topic.id}
                    onClick={() => handleDelete(topics.indexOf(topic))}
                  >
                    {deletingTopicId === topic.id ? '删除中...' : '🗑 删除'}
                  </button>
                </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {IS_TASK_SURFACE && taskSaveReceipt ? (
        <div className="task-complete-panel" role="status" aria-live="polite">
          <div className="task-complete-title">已保存</div>
          <div className="task-complete-text">{taskSaveReceipt}</div>
          <div className="form-buttons">
            <button onClick={() => finishTaskSurface('saved')}>
              完成并关闭
            </button>
            <button onClick={openMemoryEntryRulesHub}>查看全部规则</button>
          </div>
        </div>
      ) : showAddForm ? (
        <div className="add-topic-form" ref={addFormRef}>
          <div className="form-title-row">
            <div>
              <h4>{SURFACE_COPY.formTitle}</h4>
              <p>{SURFACE_COPY.formHint}</p>
            </div>
          </div>
          <div className="add-text-field">
            <textarea
              className="text-input rule-prompt-input"
              placeholder="例如：Standup 里有人提到 blocker；或 Leave Chat 里出现与我相关的请假消息"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              rows={2}
            />
          </div>

          {/* 原消息（仅在从"关注后续"进入时出现，默认收起，作为匹配输入的上下文） */}
          {newFollowThread && newFollowConfig && (
            <>
              <FollowOriginalMessageSection
                message={newFollowConfig.originalMessage}
              />
              {newFollowThreadBoundaryReceipt && (
                <section
                  className="supporting-panel follow-thread-boundary-receipt"
                  role="note"
                  aria-label={newFollowThreadBoundaryReceipt.title}
                >
                  <div className="supporting-title">
                    {newFollowThreadBoundaryReceipt.title}
                  </div>
                  <div className="supporting-text">
                    {newFollowThreadBoundaryReceipt.scopeText}
                  </div>
                  <div className="supporting-text">
                    {newFollowThreadBoundaryReceipt.lifetimeText}
                  </div>
                  <div className="supporting-text">
                    {newFollowThreadBoundaryReceipt.matchingText}
                  </div>
                  <div className="supporting-text">
                    {newFollowThreadBoundaryReceipt.activationText}
                  </div>
                  <div className="supporting-text">
                    {newFollowThreadBoundaryReceipt.deliveryText}
                  </div>
                  <div className="supporting-text muted-copy">
                    {newFollowThreadBoundaryReceipt.boundaryText}
                  </div>
                </section>
              )}
            </>
          )}
          {/* 通用匹配条件（紧贴匹配输入下方） */}
          <div className="filter-conditions">
            <div className="filter-item">
              <label htmlFor="new-filter-sender">匹配发送人:</label>
              <input
                type="text"
                id="new-filter-sender"
                placeholder="留空表示不限发送人；多个用逗号分隔"
                value={newFilterSender}
                onChange={(e) => setNewFilterSender(e.target.value)}
              />
            </div>
            <div className="filter-item">
              <label htmlFor="new-filter-group">匹配群组:</label>
              <input
                type="text"
                id="new-filter-group"
                placeholder="留空表示不限群组；多个用逗号分隔"
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

          <div className="new-rule-receipt" aria-label="新规则保存摘要">
            <div className="new-rule-receipt-main">
              <span className="rule-path-label then">则</span>
              <div className="rule-action-chip-row compact">
                {newRuleActionItems.map((item) => (
                  <span className="rule-badge muted" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="new-rule-receipt-meta">
              <span>
                范围：
                {getScopeSummaryText({
                  filterSender: newFilterSender,
                  filterGroup: newFilterGroup,
                })}
              </span>
              <span className={`rule-safety-inline ${newRuleSafetySummary.tone}`}>
                <span
                  className={`rule-badge safety-${newRuleSafetySummary.tone}`}
                >
                  {newRuleSafetySummary.label}
                </span>
                {newRuleSafetySummary.reasons.join(' / ')}
              </span>
            </div>
            {renderNewAutomationConfig()}
            {renderRuleRunPreviewReceipt(newRuleRunPreviewReceipt)}
          </div>

		          {/* 摘要配置区域（非关注后续模式时显示） */}
          {!newFollowThread && (
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
                  onChange={(e) => {
                    clearAutoReplyPrefillReceipt();
                    setNewAutoReplyConfig({
                      ...newAutoReplyConfig,
                      replyContent: e.target.value,
                    });
                  }}
                  rows={3}
                />
                {renderAutoReplyPrefillReceipt()}
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
                        value={normalizeAutoReplyDelayHours(
                          newAutoReplyConfig.delayHours,
                        )}
                        onChange={(e) =>
                          setNewAutoReplyConfig({
                            ...newAutoReplyConfig,
                            delayHours: normalizeAutoReplyDelayHours(
                              e.target.value,
                            ),
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
                <AutoReplyModeReceiptPanel
                  config={newAutoReplyConfig}
                  filterSender={newFilterSender}
                  filterGroup={newFilterGroup}
                />
              </div>
            </div>
          )}

          {/* 分发路径 + 副作用边界 · 说明性提示，置于底部并弱化呈现 */}
          {renderRuleReceiptFootnotes(
            newRuleDeliveryReceipt,
            newRuleEffectBoundaryReceipt,
          )}

          <div className="form-buttons">
            <button
              onClick={handleAdd}
              disabled={isAddingTopic || !newTopic.trim()}
              title={newRuleSaveButtonBoundary}
              aria-label={newRuleSaveButtonBoundary}
            >
              {isAddingTopic ? (
                <>
                  <span className="button-inline-spinner" aria-hidden="true" />
                  添加中...
                </>
              ) : (
                '确认'
              )}
            </button>
            <button
              disabled={isAddingTopic}
              title={
                IS_TASK_SURFACE
                  ? '关闭这个配置窗口；不会创建规则、通知或动作'
                  : undefined
              }
              onClick={() => {
                resetNewRuleForm();
                setShowAddForm(false);
                finishTaskSurface('cancelled');
              }}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}
      </div>

      {operationToast ? (
        <div
          className={`rule-operation-toast ${operationToast.type}`}
          role="status"
          aria-live="polite"
        >
          {operationToast.message}
        </div>
      ) : null}

      <style>{`
                .topic-modal {
                    padding: 16px;
                }

                .topic-modal.task-surface {
                    padding: 14px 16px 18px;
                }

                .topic-modal.task-surface .add-topic-form {
                    margin-top: 0;
                    border-left-width: 1px;
                    box-shadow: none;
                }

                .task-complete-panel {
                    box-sizing: border-box;
                    padding: 18px;
                    border-radius: 18px;
                    border: 1px solid rgba(34, 197, 94, 0.32);
                    background: rgba(15, 23, 42, 0.78);
                }

                .task-complete-title {
                    font-size: 15px;
                    font-weight: 700;
                    color: #86efac;
                    margin-bottom: 8px;
                }

                .task-complete-text {
                    font-size: 13px;
                    line-height: 1.6;
                    color: #cbd5e1;
                    margin-bottom: 4px;
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

                .auto-reply-mode-receipt {
                    margin-top: 10px;
                    padding: 10px 12px;
                    background-color: #ffffff;
                    border: 1px solid #d9e2ec;
                    border-left-width: 4px;
                    border-radius: 4px;
                }

                .auto-reply-mode-receipt.danger {
                    border-left-color: #d73a49;
                }

                .auto-reply-mode-receipt.warning {
                    border-left-color: #b7791f;
                }

                .auto-reply-mode-receipt.safe {
                    border-left-color: #2f855a;
                }

                .auto-reply-content-readiness {
                    margin-top: 8px;
                    padding: 10px 12px;
                    border: 1px solid #d9e2ec;
                    border-left-width: 4px;
                    border-radius: 4px;
                    background-color: #ffffff;
                    color: #334e68;
                }

                .auto-reply-content-readiness.danger {
                    border-left-color: #d73a49;
                }

                .auto-reply-content-readiness.warning {
                    border-left-color: #b7791f;
                }

                .auto-reply-content-readiness.safe {
                    border-left-color: #2f855a;
                }

                .auto-reply-prefill-receipt {
                    margin-top: 8px;
                    padding: 10px 12px;
                    border: 1px solid #d9e2ec;
                    border-left-width: 4px;
                    border-radius: 4px;
                    background-color: #ffffff;
                    color: #334e68;
                }

                .auto-reply-prefill-receipt.loading {
                    border-left-color: #2b6cb0;
                }

                .auto-reply-prefill-receipt.ready {
                    border-left-color: #2f855a;
                }

                .auto-reply-prefill-receipt.failed {
                    border-left-color: #d73a49;
                }

                .auto-reply-prefill-title {
                    margin-bottom: 6px;
                    color: #243b53;
                    font-size: 12px;
                    font-weight: 600;
                }

                .auto-reply-prefill-body {
                    display: grid;
                    gap: 4px;
                    font-size: 12px;
                    line-height: 1.5;
                }

                .auto-reply-prefill-retry {
                    margin-top: 8px;
                }

                .auto-reply-content-readiness-title {
                    margin-bottom: 6px;
                    color: #243b53;
                    font-size: 12px;
                    font-weight: 600;
                }

                .auto-reply-content-readiness-body {
                    display: grid;
                    gap: 4px;
                    font-size: 12px;
                    line-height: 1.5;
                }

                .auto-reply-mode-receipt-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 6px;
                    color: #243b53;
                    font-size: 12px;
                    font-weight: 600;
                }

                .auto-reply-mode-badge {
                    display: inline-flex;
                    max-width: 100%;
                    padding: 2px 6px;
                    border-radius: 4px;
                    background-color: #edf2f7;
                    color: #1a202c;
                    line-height: 1.4;
                }

                .auto-reply-mode-receipt-body {
                    display: grid;
                    gap: 4px;
                    color: #334e68;
                    font-size: 12px;
                    line-height: 1.5;
                }

                .auto-reply-rule-scope-receipt {
                    margin-top: 8px;
                    padding: 10px 12px;
                    border: 1px solid #d9e2ec;
                    border-left-width: 4px;
                    border-radius: 4px;
                    background-color: #fbfdff;
                    color: #334e68;
                }

                .auto-reply-rule-scope-receipt.danger {
                    border-left-color: #d73a49;
                }

                .auto-reply-rule-scope-receipt.warning {
                    border-left-color: #b7791f;
                }

                .auto-reply-rule-scope-receipt.safe {
                    border-left-color: #2f855a;
                }

                .auto-reply-rule-scope-title {
                    margin-bottom: 6px;
                    color: #243b53;
                    font-size: 12px;
                    font-weight: 600;
                }

                .auto-reply-rule-scope-body {
                    display: grid;
                    gap: 4px;
                    font-size: 12px;
                    line-height: 1.5;
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

                .original-message-collapse summary {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    min-width: 0;
                    cursor: pointer;
                    list-style: none;
                    font-size: 12px;
                }

                .original-message-collapse summary::-webkit-details-marker {
                    display: none;
                }

                .original-message-collapse summary .disclosure-chevron {
                    flex: 0 0 auto;
                    transition: transform 0.15s ease;
                }

                .original-message-collapse[open] summary .disclosure-chevron {
                    transform: rotate(90deg);
                }

                .original-message-collapse .collapse-label {
                    flex: 0 0 auto;
                    font-weight: 500;
                    color: #333;
                    font-size: 13px;
                }

                .original-message-collapse .collapse-sender {
                    flex: 0 0 auto;
                    font-weight: 600;
                    color: #9c27b0;
                }

                .original-message-collapse .collapse-snippet {
                    flex: 1 1 auto;
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: #666;
                }

                .original-message-collapse .original-message-preview {
                    margin-top: 8px;
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
                    max-height: 180px;
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

                .config-title-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    margin-bottom: 6px;
                }

                .config-title-row .config-title {
                    margin-bottom: 0;
                }

                .config-icon-actions {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    flex: 0 0 auto;
                }

                .icon-action-btn {
                    width: 30px;
                    height: 30px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    border-radius: 999px;
                    border: 1px solid rgba(148, 163, 184, 0.22);
                    background: rgba(15, 23, 42, 0.58);
                    color: #dbeafe;
                    cursor: pointer;
                }

                .icon-action-btn:hover:not(:disabled),
                .icon-action-btn:focus-visible {
                    border-color: rgba(96, 165, 250, 0.54);
                    color: #bfdbfe;
                    background: rgba(30, 41, 59, 0.86);
                }

                .icon-action-btn:disabled {
                    opacity: 0.42;
                    cursor: not-allowed;
                }

                .icon-button-svg {
                    width: 15px;
                    height: 15px;
                }

                .icon-button-spinner,
                .button-inline-spinner {
                    display: inline-block;
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(226, 232, 240, 0.35);
                    border-top-color: #dbeafe;
                    border-radius: 999px;
                    animation: spin 0.8s linear infinite;
                }

                .button-inline-spinner {
                    margin-right: 6px;
                    vertical-align: -2px;
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

                .automation-offline-note {
                    margin-top: 10px;
                    display: flex;
                    gap: 10px;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 12px;
                    border: 1px solid rgba(245, 158, 11, 0.22);
                    border-radius: 10px;
                    background: rgba(245, 158, 11, 0.1);
                    color: #92400e;
                    font-size: 12px;
                    line-height: 1.45;
                }

                .automation-offline-btn {
                    flex: 0 0 auto;
                    white-space: nowrap;
                }

                .linked-action-execution-preview {
                    display: grid;
                    gap: 8px;
                    margin-top: 10px;
                    padding: 10px 12px;
                    border: 1px solid rgba(148, 163, 184, 0.18);
                    border-radius: 10px;
                    background: rgba(15, 23, 42, 0.5);
                    color: #cbd5e1;
                    font-size: 12px;
                    line-height: 1.45;
                }

                .linked-action-execution-preview.pending {
                    border-color: rgba(245, 158, 11, 0.28);
                    background: rgba(245, 158, 11, 0.08);
                    color: #fde68a;
                }

                .linked-action-execution-preview.review {
                    border-color: rgba(20, 184, 166, 0.24);
                    background: rgba(20, 184, 166, 0.08);
                    color: #ccfbf1;
                }

                .linked-action-execution-preview.auto {
                    border-color: rgba(244, 63, 94, 0.28);
                    background: rgba(244, 63, 94, 0.08);
                    color: #fecdd3;
                }

                .linked-action-execution-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    min-width: 0;
                }

                .linked-action-execution-title {
                    min-width: 0;
                    color: #f8fbff;
                    font-weight: 800;
                    overflow-wrap: anywhere;
                }

                .linked-action-execution-context {
                    color: #cbd5e1;
                    overflow-wrap: anywhere;
                }

                .linked-action-execution-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 6px 12px;
                }

                .linked-action-execution-list span {
                    min-width: 0;
                    overflow-wrap: anywhere;
                }

                .suggestion-source-text {
                    margin-top: 0;
                }

                .automation-meta-row {
                    margin-top: 8px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
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

                .automation-preview-receipt {
                    display: grid;
                    gap: 7px;
                    margin-top: 10px;
                    padding: 10px 12px;
                    border-radius: 8px;
                    border: 1px solid rgba(20, 184, 166, 0.22);
                    background: rgba(20, 184, 166, 0.08);
                    color: #d1fae5;
                    font-size: 12px;
                    line-height: 1.45;
                }

                .automation-preview-receipt.warning {
                    border-color: rgba(245, 158, 11, 0.28);
                    background: rgba(245, 158, 11, 0.08);
                    color: #fde68a;
                }

                .automation-preview-receipt-title {
                    color: #f8fbff;
                    font-weight: 800;
                }

                .automation-preview-receipt-summary,
                .automation-preview-receipt-items span {
                    overflow-wrap: anywhere;
                }

                .automation-preview-receipt-items {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 6px 12px;
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

                @keyframes spin {
                    to {
                        transform: rotate(360deg);
                    }
                }

                .radio-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .radio-group.inline {
                    flex-direction: row;
                    flex-wrap: wrap;
                    gap: 8px 16px;
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
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 16px;
                    margin-bottom: 14px;
                }

                .page-copy {
                    min-width: 0;
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

                .page-actions {
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    padding-top: 2px;
                }

                .header-secondary-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 38px;
                    padding: 9px 14px;
                    border: 1px solid rgba(148, 163, 184, 0.26);
                    border-radius: 12px;
                    background: rgba(15, 23, 42, 0.72);
                    color: #dbeafe;
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                    box-shadow: 0 10px 28px rgba(2, 6, 23, 0.18);
                    white-space: nowrap;
                    transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
                }

                .header-secondary-btn:hover {
                    border-color: rgba(96, 165, 250, 0.48);
                    background: rgba(30, 41, 59, 0.82);
                    transform: translateY(-1px);
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

                .system-observation-receipt {
                    display: grid;
                    gap: 9px;
                    margin: -6px 0 14px;
                    padding: 11px 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(45, 212, 191, 0.24);
                    background: rgba(20, 184, 166, 0.07);
                    color: #ccfbf1;
                }

                .system-observation-receipt.failed,
                .system-observation-receipt.unconfigured {
                    border-color: rgba(245, 158, 11, 0.26);
                    background: rgba(245, 158, 11, 0.07);
                    color: #fde68a;
                }

                .system-observation-receipt.snapshot-stale {
                    border-color: rgba(251, 191, 36, 0.32);
                    background: rgba(251, 191, 36, 0.08);
                }

                .system-observation-receipt.loading {
                    border-color: rgba(96, 165, 250, 0.24);
                    background: rgba(37, 99, 235, 0.07);
                    color: #dbeafe;
                }

                .system-observation-head {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 12px;
                    min-width: 0;
                }

                .system-observation-head > div {
                    min-width: 0;
                }

                .system-observation-title {
                    color: #f0fdfa;
                    font-size: 13px;
                    font-weight: 800;
                    line-height: 1.35;
                }

                .system-observation-receipt.failed .system-observation-title,
                .system-observation-receipt.unconfigured .system-observation-title {
                    color: #fef3c7;
                }

                .system-observation-receipt.loading .system-observation-title {
                    color: #eff6ff;
                }

                .system-observation-subtitle,
                .system-observation-targets,
                .system-observation-stale,
                .system-observation-boundary {
                    color: currentColor;
                    font-size: 12px;
                    line-height: 1.45;
                    overflow-wrap: anywhere;
                }

                .system-observation-stale {
                    padding: 7px 8px;
                    border-radius: 7px;
                    background: rgba(15, 23, 42, 0.22);
                    border: 1px solid rgba(251, 191, 36, 0.18);
                }

                .system-observation-refresh {
                    flex: 0 0 auto;
                    padding: 6px 10px;
                    border-radius: 8px;
                    border: 1px solid rgba(45, 212, 191, 0.32);
                    background: rgba(15, 23, 42, 0.46);
                    color: currentColor;
                    font-size: 12px;
                    font-weight: 700;
                    cursor: pointer;
                }

                .system-observation-refresh:disabled {
                    cursor: wait;
                    opacity: 0.68;
                }

                .system-observation-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(116px, 1fr));
                    gap: 6px;
                }

                .system-observation-grid span {
                    min-width: 0;
                    padding: 5px 7px;
                    border-radius: 7px;
                    background: rgba(15, 23, 42, 0.26);
                    color: currentColor;
                    font-size: 11px;
                    font-weight: 700;
                    line-height: 1.35;
                    overflow-wrap: anywhere;
                }

                .system-observation-boundary {
                    display: grid;
                    gap: 4px;
                }

                .message-analysis-delivery-receipt {
                    display: grid;
                    gap: 8px;
                    margin: -6px 0 14px;
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(148, 163, 184, 0.14);
                    background: rgba(15, 23, 42, 0.28);
                    color: #cbd5e1;
                }

                .message-analysis-delivery-receipt.partial {
                    border-color: rgba(245, 158, 11, 0.22);
                    background: rgba(245, 158, 11, 0.06);
                    color: #f8e5a6;
                }

                .message-analysis-delivery-head {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 12px;
                    min-width: 0;
                }

                .message-analysis-delivery-head > div {
                    min-width: 0;
                }

                .message-analysis-delivery-head > span {
                    flex: 0 0 auto;
                    display: inline-flex;
                    align-items: center;
                    min-height: 24px;
                    padding: 4px 8px;
                    border-radius: 999px;
                    background: rgba(15, 23, 42, 0.42);
                    color: #cbd5e1;
                    font-size: 11px;
                    font-weight: 700;
                    white-space: nowrap;
                }

                .message-analysis-delivery-receipt.partial .message-analysis-delivery-head > span {
                    color: #fde68a;
                }

                .message-analysis-delivery-title {
                    color: #dbe4f3;
                    font-size: 12px;
                    font-weight: 700;
                    line-height: 1.35;
                }

                .message-analysis-delivery-subtitle {
                    margin-top: 3px;
                    color: #94a3b8;
                    font-size: 11px;
                    line-height: 1.4;
                    overflow-wrap: anywhere;
                }

                .message-analysis-delivery-receipt.partial .message-analysis-delivery-subtitle {
                    color: #fde68a;
                }

                .message-analysis-delivery-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(108px, 1fr));
                    gap: 6px;
                }

                .message-analysis-delivery-grid span {
                    min-width: 0;
                    padding: 5px 7px;
                    border-radius: 7px;
                    background: rgba(15, 23, 42, 0.24);
                    color: #cbd5e1;
                    font-size: 11px;
                    font-weight: 650;
                    line-height: 1.35;
                    overflow-wrap: anywhere;
                }

                .message-analysis-delivery-receipt.partial .message-analysis-delivery-grid span {
                    color: #fde68a;
                }

                .message-analysis-scope-gate-receipt {
                    display: grid;
                    gap: 6px;
                    padding-top: 8px;
                    border-top: 1px solid rgba(245, 158, 11, 0.18);
                    color: #fde68a;
                    font-size: 11px;
                    line-height: 1.45;
                }

                .message-analysis-scope-gate-title {
                    color: #fef3c7;
                    font-size: 12px;
                    font-weight: 800;
                    line-height: 1.35;
                }

                .message-analysis-scope-gate-list {
                    display: grid;
                    gap: 4px;
                }

                .message-analysis-scope-gate-list span {
                    min-width: 0;
                    overflow-wrap: anywhere;
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

                .rule-transfer-receipt {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    margin: -4px 0 18px;
                    padding: 14px 16px;
                    border-radius: 14px;
                    border: 1px solid rgba(20, 184, 166, 0.28);
                    background: rgba(20, 184, 166, 0.08);
                    color: #d1fae5;
                    box-shadow: 0 16px 34px rgba(2, 8, 23, 0.18);
                }

                .rule-export-receipt {
                    border-color: rgba(96, 165, 250, 0.28);
                    background: rgba(37, 99, 235, 0.08);
                    color: #dbeafe;
                }

                .rule-order-receipt {
                    border-color: rgba(168, 85, 247, 0.3);
                    background: rgba(88, 28, 135, 0.18);
                    color: #ede9fe;
                }

                .rule-transfer-receipt-head {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 12px;
                }

                .rule-transfer-receipt-title {
                    color: #f0fdfa;
                    font-size: 14px;
                    font-weight: 800;
                }

                .rule-transfer-receipt-subtitle,
                .rule-transfer-file,
                .rule-transfer-boundaries {
                    color: #a7f3d0;
                    font-size: 12px;
                    line-height: 1.5;
                }

                .rule-export-receipt .rule-transfer-receipt-title {
                    color: #eff6ff;
                }

                .rule-order-receipt .rule-transfer-receipt-title {
                    color: #f5f3ff;
                }

                .rule-export-receipt .rule-transfer-receipt-subtitle,
                .rule-export-receipt .rule-transfer-file,
                .rule-export-receipt .rule-transfer-boundaries {
                    color: #bfdbfe;
                }

                .rule-order-receipt .rule-transfer-receipt-subtitle,
                .rule-order-receipt .rule-transfer-boundaries {
                    color: #ddd6fe;
                }

                .rule-transfer-file {
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    overflow-wrap: anywhere;
                }

                .rule-transfer-clear {
                    flex: 0 0 auto;
                    padding: 6px 10px;
                    border-radius: 10px;
                    border: 1px solid rgba(45, 212, 191, 0.32);
                    background: rgba(15, 23, 42, 0.5);
                    color: #ccfbf1;
                    font-size: 12px;
                    font-weight: 700;
                    cursor: pointer;
                }

                .rule-export-receipt .rule-transfer-clear {
                    border-color: rgba(147, 197, 253, 0.36);
                    color: #dbeafe;
                }

                .rule-order-receipt .rule-transfer-clear {
                    border-color: rgba(196, 181, 253, 0.38);
                    color: #ede9fe;
                }

                .rule-transfer-metrics {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .rule-transfer-metrics span {
                    display: inline-flex;
                    align-items: center;
                    min-height: 24px;
                    padding: 4px 9px;
                    border-radius: 999px;
                    background: rgba(15, 23, 42, 0.44);
                    color: #ccfbf1;
                    font-size: 12px;
                    font-weight: 700;
                }

                .rule-export-receipt .rule-transfer-metrics span {
                    color: #dbeafe;
                }

                .rule-order-receipt .rule-transfer-metrics span {
                    color: #ede9fe;
                }

                .rule-transfer-boundaries {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
                    gap: 6px 14px;
                }

                .rule-transfer-boundaries span {
                    min-width: 0;
                    overflow-wrap: anywhere;
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
                    gap: 8px;
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

                .topic-display.collapsed {
                    display: block;
                }

                .topic-summary-row {
                    display: grid;
                    grid-template-columns: auto minmax(0, 1fr) auto auto;
                    align-items: center;
                    gap: 10px;
                    min-height: 48px;
                    width: 100%;
                    padding: 9px 14px;
                    box-sizing: border-box;
                    cursor: pointer;
                    outline: none;
                }

                .topic-summary-row:hover,
                .topic-summary-row:focus-visible {
                    align-items: flex-start;
                    background: rgba(30, 41, 59, 0.62);
                }

                .topic-summary-drag {
                    margin-right: 0;
                    align-self: center;
                    cursor: grab;
                }

                .topic-summary-row:hover .topic-summary-drag,
                .topic-summary-row:focus-visible .topic-summary-drag {
                    align-self: flex-start;
                    padding-top: 2px;
                }

                .topic-summary-content {
                    min-width: 0;
                    color: #f8fbff;
                    font-size: 14px;
                    font-weight: 650;
                    line-height: 1.4;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .topic-summary-row:hover .topic-summary-content,
                .topic-summary-row:focus-visible .topic-summary-content {
                    overflow: visible;
                    text-overflow: clip;
                    white-space: normal;
                }

                .topic-summary-capabilities {
                    min-width: 0;
                    display: flex;
                    flex-wrap: nowrap;
                    gap: 6px;
                    align-items: center;
                    justify-content: flex-end;
                    overflow: hidden;
                }

                .topic-summary-row:hover .topic-summary-capabilities,
                .topic-summary-row:focus-visible .topic-summary-capabilities {
                    align-self: flex-start;
                    padding-top: 1px;
                }

                .topic-summary-chip {
                    flex: 0 0 auto;
                    padding: 3px 8px;
                    font-size: 11px;
                    white-space: nowrap;
                }

                .topic-summary-diagnostic {
                    flex: 0 0 auto;
                    border: 1px solid rgba(245, 158, 11, 0.36);
                    background: rgba(245, 158, 11, 0.14);
                    white-space: nowrap;
                }

                .topic-summary-chevron {
                    color: #64748b;
                    font-size: 18px;
                    line-height: 1;
                }

                .rule-card-top[role='button'] {
                    cursor: pointer;
                    outline: none;
                }

                .rule-card-top[role='button']:focus-visible {
                    box-shadow: inset 0 0 0 2px rgba(125, 211, 252, 0.32);
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

                .rule-badge.safety-ok {
                    background: rgba(20, 184, 166, 0.18);
                    color: #99f6e4;
                }

                .rule-badge.safety-warn {
                    background: rgba(245, 158, 11, 0.18);
                    color: #fde68a;
                }

                .rule-badge.safety-danger {
                    background: rgba(244, 63, 94, 0.18);
                    color: #fecdd3;
                }

                .rule-badge.info {
                    background: rgba(14, 165, 233, 0.16);
                    color: #bae6fd;
                }

                .rule-badge.warn {
                    background: rgba(245, 158, 11, 0.18);
                    color: #fde68a;
                }

                .rule-badge.danger {
                    background: rgba(244, 63, 94, 0.18);
                    color: #fecdd3;
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
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    overflow-wrap: anywhere;
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

                .rule-diagnostic {
                    margin-top: 10px;
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(245, 158, 11, 0.24);
                    background: rgba(245, 158, 11, 0.08);
                    color: #fde68a;
                    font-size: 12px;
                    line-height: 1.5;
                }

                .rule-diagnostic-head {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 8px;
                    color: #fcd34d;
                }

                .rule-diagnostic-reason {
                    margin-top: 6px;
                    color: #fff7ed;
                    overflow-wrap: anywhere;
                }

                .rule-diagnostic-context {
                    margin-top: 4px;
                    color: #fbbf24;
                    overflow-wrap: anywhere;
                }

                .rule-inactive-receipt {
                    display: grid;
                    gap: 4px;
                    margin: 0 16px 4px;
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(248, 113, 113, 0.26);
                    background: rgba(127, 29, 29, 0.22);
                    color: #fecaca;
                    font-size: 12px;
                    line-height: 1.45;
                }

                .rule-inactive-receipt span {
                    color: #fca5a5;
                    font-weight: 800;
                }

                .rule-inactive-receipt p {
                    margin: 0;
                    overflow-wrap: anywhere;
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

                .new-rule-receipt {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-top: 2px;
                    padding: 10px 12px;
                    border-radius: 12px;
                    border: 1px solid rgba(125, 211, 252, 0.14);
                    background: rgba(15, 23, 42, 0.42);
                }

                .new-rule-receipt-main {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    min-width: 0;
                }

                .new-rule-receipt-meta {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 8px 14px;
                    color: #94a3b8;
                    font-size: 12px;
                    line-height: 1.45;
                }

                .rule-safety-inline {
                    display: inline-flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 6px;
                }

                .rule-safety-inline.warn {
                    color: #fde68a;
                }

                .rule-safety-inline.danger {
                    color: #fecdd3;
                }

                .rule-delivery-receipt {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 6px 10px;
                    margin-top: 10px;
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(148, 163, 184, 0.16);
                    background: rgba(15, 23, 42, 0.5);
                    color: #cbd5e1;
                    font-size: 12px;
                    line-height: 1.45;
                }

                .new-rule-receipt .rule-delivery-receipt {
                    margin-top: 0;
                }

                .rule-delivery-title {
                    color: #f8fbff;
                    font-weight: 800;
                }

                .rule-delivery-receipt.silent {
                    border-color: rgba(148, 163, 184, 0.2);
                }

                .rule-delivery-receipt.digest {
                    border-color: rgba(20, 184, 166, 0.24);
                    background: rgba(20, 184, 166, 0.08);
                    color: #ccfbf1;
                }

                .rule-delivery-receipt.notify {
                    border-color: rgba(59, 130, 246, 0.26);
                    background: rgba(37, 99, 235, 0.1);
                    color: #bfdbfe;
                }

                .rule-delivery-receipt.followup {
                    border-color: rgba(168, 85, 247, 0.26);
                    background: rgba(126, 34, 206, 0.1);
                    color: #e9d5ff;
                }

                .rule-effect-boundary {
                    display: grid;
                    gap: 8px;
                    margin-top: 10px;
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(148, 163, 184, 0.16);
                    background: rgba(15, 23, 42, 0.46);
                    color: #cbd5e1;
                    font-size: 12px;
                    line-height: 1.45;
                }

                .new-rule-receipt .rule-effect-boundary {
                    margin-top: 0;
                }

                .rule-effect-boundary-title {
                    color: #f8fbff;
                    font-weight: 800;
                }

                .rule-effect-boundary-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 6px 12px;
                }

                .rule-effect-boundary-list span {
                    min-width: 0;
                    overflow-wrap: anywhere;
                }

                .rule-effect-boundary.quiet {
                    border-color: rgba(148, 163, 184, 0.18);
                }

                .rule-effect-boundary.active {
                    border-color: rgba(59, 130, 246, 0.24);
                    background: rgba(37, 99, 235, 0.08);
                    color: #bfdbfe;
                }

                .rule-effect-boundary.review {
                    border-color: rgba(245, 158, 11, 0.26);
                    background: rgba(245, 158, 11, 0.08);
                    color: #fde68a;
                }

                .rule-effect-boundary.danger {
                    border-color: rgba(244, 63, 94, 0.28);
                    background: rgba(244, 63, 94, 0.08);
                    color: #fecdd3;
                }

                .rule-run-preview {
                    display: grid;
                    gap: 8px;
                    margin-top: 10px;
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(148, 163, 184, 0.16);
                    background: rgba(15, 23, 42, 0.48);
                    color: #cbd5e1;
                    font-size: 12px;
                    line-height: 1.45;
                }

                .new-rule-receipt .rule-run-preview {
                    margin-top: 8px;
                }

                .rule-run-preview-title {
                    color: #f8fbff;
                    font-weight: 800;
                }

                .rule-run-preview-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 6px 12px;
                }

                .rule-run-preview-grid span {
                    min-width: 0;
                    overflow-wrap: anywhere;
                }

                .rule-run-preview.ready {
                    border-color: rgba(34, 197, 94, 0.24);
                    background: rgba(22, 163, 74, 0.08);
                    color: #bbf7d0;
                }

                .rule-run-preview.paused {
                    border-color: rgba(245, 158, 11, 0.26);
                    background: rgba(245, 158, 11, 0.08);
                    color: #fde68a;
                }

                .rule-run-preview.review {
                    border-color: rgba(59, 130, 246, 0.24);
                    background: rgba(37, 99, 235, 0.08);
                    color: #bfdbfe;
                }

                .rule-run-preview.danger {
                    border-color: rgba(244, 63, 94, 0.28);
                    background: rgba(244, 63, 94, 0.08);
                    color: #fecdd3;
                }

                .silent-analysis-control-receipt {
                    display: grid;
                    gap: 8px;
                    margin: 12px 0 18px;
                    padding: 12px 14px;
                    border-radius: 10px;
                    border: 1px solid rgba(148, 163, 184, 0.18);
                    background: rgba(15, 23, 42, 0.58);
                    color: #dbeafe;
                    font-size: 12px;
                    line-height: 1.45;
                }

                .silent-analysis-control-receipt.pending {
                    border-color: rgba(59, 130, 246, 0.26);
                    background: rgba(37, 99, 235, 0.1);
                    color: #bfdbfe;
                }

                .silent-analysis-control-receipt.succeeded {
                    border-color: rgba(34, 197, 94, 0.24);
                    background: rgba(22, 163, 74, 0.08);
                    color: #bbf7d0;
                }

                .silent-analysis-control-receipt.failed {
                    border-color: rgba(244, 63, 94, 0.3);
                    background: rgba(244, 63, 94, 0.08);
                    color: #fecdd3;
                }

                .silent-analysis-control-title {
                    color: #f8fbff;
                    font-weight: 800;
                }

                .silent-analysis-control-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 6px 12px;
                }

                .silent-analysis-control-grid span {
                    min-width: 0;
                    overflow-wrap: anywhere;
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

                .rule-path-label.then {
                    background: rgba(34, 197, 94, 0.14);
                    color: #86efac;
                }

                .rule-action-chip-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 8px;
                }

                .rule-action-chip-row.compact {
                    margin-top: 0;
                }

                .rule-safety-strip {
                    grid-column: 1 / -1;
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 8px;
                    margin-top: 2px;
                    padding-top: 10px;
                    border-top: 1px solid rgba(148, 163, 184, 0.14);
                    color: #cbd5e1;
                    font-size: 12px;
                    line-height: 1.45;
                }

                .rule-safety-strip.warn {
                    color: #fde68a;
                }

                .rule-safety-strip.danger {
                    color: #fecdd3;
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

                .follow-thread-boundary-note {
                    margin-top: 6px;
                    font-size: 11px;
                    line-height: 1.4;
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

                .card-actions button:disabled,
                .form-buttons button:disabled {
                    opacity: 0.55;
                    cursor: not-allowed;
                }

                .danger-btn {
                    background: rgba(239, 68, 68, 0.18) !important;
                    color: #fca5a5 !important;
                }

                .rule-operation-toast {
                    position: fixed;
                    right: 20px;
                    bottom: 20px;
                    z-index: 10000;
                    max-width: min(360px, calc(100vw - 40px));
                    padding: 12px 14px;
                    border-radius: 12px;
                    border: 1px solid rgba(148, 163, 184, 0.18);
                    background: rgba(15, 23, 42, 0.96);
                    color: #e2e8f0;
                    box-shadow: 0 18px 42px rgba(15, 23, 42, 0.36);
                    font-size: 13px;
                    line-height: 1.45;
                }

                .rule-operation-toast.success {
                    border-color: rgba(34, 197, 94, 0.35);
                    color: #bbf7d0;
                }

                .rule-operation-toast.error {
                    border-color: rgba(248, 113, 113, 0.38);
                    color: #fecaca;
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

                /* 让"新建规则"表单始终浮到列表最前面 */
                .rules-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                /* 新建表单：蓝色左侧强调条 + 更明显的浮层阴影，和列表项区分开 */
                .add-topic-form {
                    order: -1;
                    border-left: 3px solid rgba(96, 165, 250, 0.85);
                    box-shadow: 0 22px 48px rgba(2, 8, 23, 0.4);
                }

                /* 编辑中的列表项：琥珀色描边强调，区别于普通列表项和新建表单 */
                .topic-item.editing {
                    border-color: rgba(251, 191, 36, 0.5);
                    box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.32),
                        0 18px 40px rgba(2, 8, 23, 0.28);
                }

                .topic-item.editing .topic-edit-form {
                    border: none;
                    border-left: 3px solid rgba(251, 191, 36, 0.7);
                    border-radius: 0;
                    background: transparent;
                    box-shadow: none;
                }

                /* 匹配内容输入：默认两行高度，允许用户纵向拉伸 */
                .rule-prompt-input {
                    min-height: 3.4em;
                    line-height: 1.5;
                    resize: vertical;
                }

                /* 联动操作嵌入"则"卡片内部：去掉独立卡片底色，用分隔线衔接 */
                .new-rule-receipt .automation-config.nested {
                    margin-top: 2px;
                    background: transparent;
                    border: none;
                    border-top: 1px solid rgba(148, 163, 184, 0.16);
                    border-radius: 0;
                    padding: 8px 0 0;
                }

                /* 分发路径 + 副作用边界：说明性脚注，统一弱化呈现 */
                .rule-receipt-footnote {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    margin-top: 4px;
                    padding-top: 8px;
                    border-top: 1px dashed rgba(148, 163, 184, 0.2);
                    opacity: 0.7;
                }

                .rule-receipt-footnote .rule-delivery-receipt,
                .rule-receipt-footnote .rule-delivery-receipt.silent,
                .rule-receipt-footnote .rule-delivery-receipt.digest,
                .rule-receipt-footnote .rule-delivery-receipt.notify,
                .rule-receipt-footnote .rule-delivery-receipt.followup,
                .rule-receipt-footnote .rule-effect-boundary,
                .rule-receipt-footnote .rule-effect-boundary.active,
                .rule-receipt-footnote .rule-effect-boundary.review,
                .rule-receipt-footnote .rule-effect-boundary.danger,
                .rule-receipt-footnote .rule-effect-boundary.quiet {
                    background: transparent;
                    border: none;
                    border-radius: 0;
                    margin: 0;
                    padding: 0;
                    color: #94a3b8;
                    font-size: 11px;
                }

                .rule-receipt-footnote .rule-delivery-title,
                .rule-receipt-footnote .rule-effect-boundary-title {
                    color: #94a3b8;
                    font-weight: 600;
                    font-size: 11px;
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

                .automation-config.compact-disclosure {
                    padding: 0;
                    overflow: hidden;
                }

                .automation-disclosure-btn {
                    width: 100%;
                    margin: 0;
                    padding: 12px 14px;
                    border: none;
                    background: transparent;
                    color: inherit;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    text-align: left;
                    border-radius: 14px;
                }

                .automation-disclosure-btn:hover,
                .automation-disclosure-btn:focus-visible {
                    background: rgba(15, 23, 42, 0.36);
                    outline: none;
                }

                .automation-disclosure-copy {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    min-width: 0;
                }

                .automation-disclosure-copy .config-title {
                    margin: 0;
                    color: #dbeafe;
                }

                .automation-disclosure-state {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    flex: 0 0 auto;
                }

                .disclosure-chevron {
                    color: #94a3b8;
                    font-size: 12px;
                    font-weight: 700;
                }

                .automation-config-body {
                    padding: 12px 14px 14px;
                    border-top: 1px solid rgba(148, 163, 184, 0.12);
                }

                .automation-body-head {
                    margin-bottom: 8px;
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

                .original-message-collapse .collapse-label {
                    color: #dbe4f3;
                }

                .original-message-collapse .collapse-sender {
                    color: #c4b5fd;
                }

                .original-message-collapse .collapse-snippet {
                    color: #94a3b8;
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

	                @media (max-width: 799px) {
	                    .page-header {
	                        flex-direction: column;
	                    }

	                    .page-actions,
	                    .header-secondary-btn {
	                        width: 100%;
	                    }

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

	                    .new-rule-receipt-main,
	                    .automation-disclosure-btn {
	                        align-items: flex-start;
	                        flex-direction: column;
	                    }

	                    .automation-disclosure-state {
	                        flex-wrap: wrap;
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
