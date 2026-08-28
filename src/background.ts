import { analyzeMessagesInBackground } from './messageDealing';
// embeddings.ts 已废弃 — 后端 memory-service 处理嵌入生成
import {
  DEFAULT_RECALL_SOURCE_TYPES_WITHOUT_REHEARSAL,
  filterSceneRehearsalSourceTypes,
  getEnvConfig,
  normalizeConcernedItemsDigestHour,
} from './utils';
import { syncRoadmapContentScript } from './roadmapContentScriptRegistry';
import {
  ROADMAP_MEMORY_REQUEST,
  type RoadmapMemoryMethod,
} from './roadmapMemoryBridge';
import {
  FETCH_JIRA_TICKETS,
  JIRA_COOKIE_AUTH_GUARD_MESSAGE,
  JIRA_PROXY_FETCH_MESSAGE,
  JIRA_SYNC_XSRF_TOKEN_ALL_MESSAGE,
  assertJiraCookieAuthAllowed,
  handleJiraProxyFetch,
  notifyJiraIssuePagesToSyncXsrf,
} from './jira';
import {
  GOOGLE_AUTH_SCOPE_SETS,
  getGoogleAuthToken,
  getGoogleAuthTokenSilently,
} from './utils/googleAuth';
import { IntelligentAgent } from './agentThinking';
import { ProjectAnalysisResult } from './interfaces/analysisInterfaces';
import {
  getMemoryServiceClient,
  type IngestPayload,
} from './services/MemoryServiceClient';
import { readExtensionUiPreferences } from './i18n';
import {
  buildBackendNotificationButtons,
  buildBackendNotificationContextMessage,
  buildBackendNotificationId,
  buildBackendNotificationMessage,
  getBackendNotificationClosedDeliveryStatus,
  getBackendNotificationMetaStorageKey,
  getBackendTargetHash,
  inferLegacyLane,
  normalizeBackendNotificationMeta,
  performBackendNotificationSecondaryAction,
  type BackendNotificationMeta,
} from './backendNotifications';
import { handleMemoryMessage } from './modals/memory-exploring-messageHandler';
// 旧的存储健康监控器已删除，使用新的系统维护工具
import { getWebIntelligenceIntegrator } from './web-intelligence/WebIntelligenceIntegrator';
import {
  buildPassiveWebpageAnalysisKey,
  normalizePassiveWebpageAnalysisResult,
  PASSIVE_WEBPAGE_ANALYSIS_PROMPT_VERSION,
  type PassiveWebpageAnalysisResult,
} from './web-intelligence/passiveWebpageAnalysis';
import {
  buildSessionRequestCacheKey,
  SessionRequestCache,
} from './web-intelligence/sessionRequestCache';
import {
  classifyWebpageAnalysisFailure,
  WebpageAnalysisFailureBackoff,
} from './web-intelligence/webpageAnalysisBackoff';
import {
  DashboardMessageHandler,
  buildProjectDashboardLaunchPath,
} from './utils/dashboardIntegration';
import { taskScheduler, TaskScheduler } from './services/TaskScheduler';
import { UserProfileMessageHandler } from './services/UserProfileMessageHandler';
import {
  findRingCentralTab,
  createRingCentralTab,
  waitForTabLoad,
  sendMessageWithRetry,
} from './utils/tabHelpers';
import { AppScriptUpdater } from './scheduled-messages/AppScriptUpdater';
import { ConfigSyncService } from './scheduled-messages/ConfigSyncService';
import { JiraRuleUpdater } from './scheduled-messages/JiraRuleUpdater';
import { SheetSchemaUpdater } from './scheduled-messages/SheetSchemaUpdater';
import { ScheduledMessageService } from './scheduled-messages/ScheduledMessageService';
import { JiraAutomationService } from './scheduled-messages/JiraAutomationService';
import {
  getAgentTaskWebhookConfig,
  hasRingCentralSenderCredentials,
  normalizeSheetConfig,
  withAgentTaskWebhook,
} from './scheduled-messages/botAutomationConfig';
import {
  formatLocalScheduleDateTime,
  normalizeLocalScheduleTime,
} from './scheduled-messages/scheduleDateTime';
import {
  buildAgentTaskWebhookUrlFromMemoryBase,
  normalizeAgentTaskUserId,
  resolveAgentTaskWebhookConfig,
} from './scheduled-messages/agentTaskWebhookConfig';
import { calculateScheduledMessageNextExecution } from './scheduled-messages/scheduleNextExecution';
import type {
  CreateMessageFormData,
  PushLog,
  ScheduledMessage,
  SheetConfig,
} from './scheduled-messages/types';
import {
  getCurrentUser,
  getProjectByKey,
  getJiraMemoryFreshnessFields,
  jiraFetch,
  getTicketDetail,
} from './jira';
import { handleLLMRequest } from './llm';
import { CAPABILITIES } from './analytics/capabilities';
import { concernedItemsSyncService } from './services/ConcernedItemsSyncService';
import { isManualConcernedItem, partitionConcernedItems } from './watchRules';

import { Logger } from './utils/logger';
import { UsageTracker } from './analytics/UsageTracker';
import {
  cleanupExpiredFollowThreads,
  getNextCleanupTime,
  storeRelatedMessage,
  registerFollowThreadDigestTask,
} from './message-reaction/FollowThreadHandler';
import { buildPendingFollowThreadConfig } from './message-reaction/followThreadPendingConfig';
import {
  buildFollowupAskSetupToast,
  isRingCentralOutreachReady,
  resolveFollowupAskSetupState,
  type FollowupAskSetupState,
} from './message-reaction/followupAskPresentation';
import { buildPendingLinkedActionConfig } from './message-reaction/linkedActionEntry';
import {
  MEMORY_ENTRY_RULES_TASK_POPUP_SIZE,
  openMemoryEntryRules,
} from './utils/memoryEntryRulesNavigation';
import {
  doesSnoozeReminderMatchSchedule,
  findOpenSnoozeReminderForMessage,
  getSnoozeReminderSourceKey,
  isOpenSnoozeReminder,
} from './message-reaction/snoozeDeduplication';
import {
  registerConcernedItemsDigestTask,
  updateConcernedItemsDigestTaskSchedule,
} from './services/DigestQueueService';
import {
  buildFollowThreadMarkers,
  buildScheduledPushLogMarkers,
  buildScheduledSnoozeMarkers,
  mergeMarkerIndexes,
  upsertGlipPendingScheduledMessage,
  writeGlipMessageMarkersCache,
} from './services/GlipMessageMarkerService';
import {
  syncStoredUserIdentityToMemory,
  syncUserIdentityToMemory,
} from './services/UserIdentitySyncService';
import { runPersistentlyThrottledTask } from './services/PersistentTaskThrottle';
import { initMeetingPilotBackgroundRuntime } from './meeting-shell/background';
import {
  connectOutlookCalendar,
  disconnectOutlookCalendar,
  getOutlookCalendarStatus,
  syncCalendarEventsToMemoryService,
  syncOutlookCalendarToMemoryService,
} from './context-assist/outlookCalendar';
import { isComposerAssistEnabledFromConfig, isComposerAssistIntentEnabledFromConfig } from './composer-guard/assistConfig';

console.log('Background script loaded');
const PERSONAL_AI_AR_CONTEXT_MENU_ID = 'personal-ai-ar-data';
const PERSONAL_AI_AR_BINDINGS_KEY = 'personalAiArBindings';
const personalAiArExecutionInFlight = new Map<string, Promise<{
  replacementText: string;
  response: Record<string, any>;
}>>();
void initMeetingPilotBackgroundRuntime().catch((error) => {
  console.error('Meeting Pilot runtime failed to initialize:', error);
});
void concernedItemsSyncService.initialize();
registerPersonalAiArContextMenu();

// Map to track backend notification metadata for click handling
const backendNotificationMeta = new Map<string, BackendNotificationMeta>();
const pendingSnoozeReminderKeys = new Set<string>();
const GLIP_POPUP_DEFAULT_WIDTH = 1100;
const GLIP_POPUP_DEFAULT_HEIGHT = 900;
const CONTEXT_RECALL_BACKGROUND_CACHE_STORAGE_KEY =
  'context_recall_background_cache_v1';
const WEBPAGE_ANALYSIS_BACKGROUND_CACHE_STORAGE_KEY =
  'webpage_analysis_background_cache_v2';
const WEBPAGE_ANALYSIS_FAILURE_BACKOFF_STORAGE_KEY =
  'webpage_analysis_failure_backoff_v1';
const CONTEXT_RECALL_BACKGROUND_CACHE_TTL_MS = 5 * 60 * 1000;
const WEBPAGE_ANALYSIS_SKIP_CACHE_TTL_MS = 20 * 60 * 1000;
const WEBPAGE_ANALYSIS_RESULT_CACHE_TTL_MS = 45 * 60 * 1000;
const contextRecallBackgroundCache = new SessionRequestCache<any>(
  CONTEXT_RECALL_BACKGROUND_CACHE_TTL_MS,
  40,
);
const webpageAnalysisBackgroundCache =
  new SessionRequestCache<PassiveWebpageAnalysisResult>(
    WEBPAGE_ANALYSIS_RESULT_CACHE_TTL_MS,
    80,
  );
const webpageAnalysisFailureBackoff = new WebpageAnalysisFailureBackoff();
const contextRecallBackgroundInFlight = new Map<string, Promise<any>>();
const webpageAnalysisBackgroundInFlight = new Map<
  string,
  Promise<PassiveWebpageAnalysisResult>
>();
let contextRecallBackgroundCacheLoadPromise: Promise<void> | null = null;
let webpageAnalysisBackgroundCacheLoadPromise: Promise<void> | null = null;
let webpageAnalysisFailureBackoffLoadPromise: Promise<void> | null = null;

function getSessionStorageArea(): any | null {
  return (chrome.storage as any)?.session || null;
}

async function loadBackgroundSessionCache<T>(
  storageKey: string,
  cache: SessionRequestCache<T>,
): Promise<void> {
  const storageArea = getSessionStorageArea();
  if (!storageArea) return;
  try {
    const stored = await storageArea.get(storageKey);
    cache.hydrate(stored?.[storageKey]);
  } catch (error) {
    console.debug(`[background] failed to load ${storageKey}:`, error);
  }
}

async function persistBackgroundSessionCache<T>(
  storageKey: string,
  cache: SessionRequestCache<T>,
): Promise<void> {
  const storageArea = getSessionStorageArea();
  if (!storageArea) return;
  try {
    await storageArea.set({ [storageKey]: cache.snapshot() });
  } catch (error) {
    console.debug(`[background] failed to persist ${storageKey}:`, error);
  }
}

function ensureContextRecallBackgroundCacheLoaded(): Promise<void> {
  if (!contextRecallBackgroundCacheLoadPromise) {
    contextRecallBackgroundCacheLoadPromise = loadBackgroundSessionCache(
      CONTEXT_RECALL_BACKGROUND_CACHE_STORAGE_KEY,
      contextRecallBackgroundCache,
    );
  }
  return contextRecallBackgroundCacheLoadPromise;
}

function ensureWebpageAnalysisBackgroundCacheLoaded(): Promise<void> {
  if (!webpageAnalysisBackgroundCacheLoadPromise) {
    webpageAnalysisBackgroundCacheLoadPromise = loadBackgroundSessionCache(
      WEBPAGE_ANALYSIS_BACKGROUND_CACHE_STORAGE_KEY,
      webpageAnalysisBackgroundCache,
    );
  }
  return webpageAnalysisBackgroundCacheLoadPromise;
}

function ensureWebpageAnalysisFailureBackoffLoaded(): Promise<void> {
  if (!webpageAnalysisFailureBackoffLoadPromise) {
    webpageAnalysisFailureBackoffLoadPromise = (async () => {
      const storageArea = getSessionStorageArea();
      if (!storageArea) return;
      try {
        const stored = await storageArea.get(
          WEBPAGE_ANALYSIS_FAILURE_BACKOFF_STORAGE_KEY,
        );
        webpageAnalysisFailureBackoff.hydrate(
          stored?.[WEBPAGE_ANALYSIS_FAILURE_BACKOFF_STORAGE_KEY],
        );
      } catch (error) {
        console.debug('[background] failed to load webpage analysis backoff:', error);
      }
    })();
  }
  return webpageAnalysisFailureBackoffLoadPromise;
}

async function persistWebpageAnalysisFailureBackoff(): Promise<void> {
  const storageArea = getSessionStorageArea();
  if (!storageArea) return;
  try {
    await storageArea.set({
      [WEBPAGE_ANALYSIS_FAILURE_BACKOFF_STORAGE_KEY]:
        webpageAnalysisFailureBackoff.snapshot(),
    });
  } catch (error) {
    console.debug('[background] failed to persist webpage analysis backoff:', error);
  }
}

function buildComposerAssistDisabledResponse(debug = false) {
  return {
    available: false,
    suggestionType: 'none',
    title: '写作护航已关闭',
    summary: 'Compose Assist 当前被配置关闭，不展示输入框提示。',
    evidence: [],
    riskLevel: 'low',
    previewRequired: false,
    confidence: 0,
    queryTimeMs: 0,
    debug: debug ? { rejectedReason: 'composer_assist_disabled' } : undefined,
  };
}

async function ensureAgentTaskWebhookConfigForBackground(token: string): Promise<void> {
  const storage = await chrome.storage.local.get(['scheduledMessagesConfig', 'userinfo']);
  const config = storage.scheduledMessagesConfig
    ? normalizeSheetConfig(storage.scheduledMessagesConfig) as SheetConfig
    : null;
  if (!config?.sheetId) {
    throw new Error('缺少 Scheduled Messages 配置，无法写入 AgentTask webhook');
  }

  const existingWebhook = getAgentTaskWebhookConfig(config);
  const envConfig = await getEnvConfig();
  const resolvedWebhook = resolveAgentTaskWebhookConfig({
    existingWebhook,
    memoryServiceBaseUrl: envConfig.MEMORY_SERVICE_BASE_URL,
    memoryServiceApiKey: envConfig.MEMORY_SERVICE_API_KEY,
    userIdCandidates: [storage.userinfo?.username, storage.userinfo?.email],
    requireUserId: true,
  });
  if (!resolvedWebhook.webhook) {
    if (resolvedWebhook.missingReason === '缺少 memory-service 用户身份') {
      throw new Error('缺少 memory-service 用户身份，无法创建重复 AR AgentTask');
    }
    throw new Error('缺少 memory-service webhook，无法创建重复 AR AgentTask');
  }

  if (!resolvedWebhook.changed) {
    return;
  }

  const syncService = new ConfigSyncService(token);
  await syncService.syncConfig(withAgentTaskWebhook(config, resolvedWebhook.webhook), {
    syncAction: 'agent_task_webhook_auto_config',
  });
}

function nonEmptyArString(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || undefined;
}

function arScalarToText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const text = value.trim();
    return text || undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

function compactArText(value: unknown, maxLength = 400): string {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!text) return '';
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3).trim()}...`;
}

function extractPersonalAiArJql(userPrompt: string): string | undefined {
  const normalized = userPrompt.replace(/\r\n/g, '\n').trim();
  if (!normalized) return undefined;

  const fenced = normalized.match(/```(?:jql)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim()) {
    return fenced[1].trim();
  }

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const firstJqlLine = lines.findIndex((line) =>
    /(issueFunction\s+in|portfolioChildrenOf\s*\(|issuetype\s*=|project\s*=|status\s+(?:not\s+)?in\s*\(|filter\s*=|ORDER\s+BY)/i.test(line),
  );
  if (firstJqlLine >= 0) {
    return lines.slice(firstJqlLine).join('\n').trim();
  }

  const markerMatch = normalized.match(/\bJQL\b[^\n]*\n([\s\S]+)/i);
  return markerMatch?.[1]?.trim() || undefined;
}

function inferPersonalAiArExecutionHints(data: Record<string, any>): {
  taskKind: string;
  targetSystem: string;
  exactJql?: string;
  expectedOutput?: string;
} {
  const userPrompt = String(data.agentTaskPrompt || data.taskPrompt || '').trim();
  const exactJql = extractPersonalAiArJql(userPrompt);
  const asksForCount = /(总数|数量|issue\s*total|issues?\s*total|\bcount\b)/i.test(userPrompt);
  if (exactJql && asksForCount) {
    return {
      taskKind: 'jira_jql_count',
      targetSystem: 'jira',
      exactJql,
      expectedOutput: 'single_number',
    };
  }
  if (exactJql) {
    return {
      taskKind: 'jira_jql',
      targetSystem: 'jira',
      exactJql,
    };
  }
  return {
    taskKind: 'ar_dom_replacement',
    targetSystem: 'personal_ai_ar',
  };
}

function buildPersonalAiArExecutionTask(
  data: Record<string, any>,
  hints: ReturnType<typeof inferPersonalAiArExecutionHints>,
): string {
  const userPrompt = String(data.agentTaskPrompt || data.taskPrompt || '').trim();
  const oldValue = compactArText(data.oldValue, 200);
  const sectionLabel = compactArText(data.sectionLabel, 200);
  const nearbyText = compactArText(data.nearbyText, 600);

  return [
    '你正在为 Personal AI AR 数据生成网页 DOM 替换文本。',
    '请执行用户给出的任务，最终返回 OpenClaw JSON envelope。',
    hints.taskKind === 'jira_jql_count'
      ? [
          '',
          '这是 Jira JQL count 类型的 AR 数据任务。',
          '必须使用下方 Exact JQL 原文执行 Jira search/count，结果只取 issue 总数。',
          '不要使用页面旧值、附近文本、历史 HTML 报表、缓存结果或相似脚本推断结果。',
          '如果通过辅助脚本查询，必须确认该脚本实际执行的 JQL 与 Exact JQL 等价；不能确认则返回 capability_missing 或 error。',
          '成功时 envelope.summary 只能是 issue 总数的数字字符串；payload.issueTotal 必须是 number。',
          '成功 artifact 的 metadata.sourceSystem 必须是 jira，并写入 metadata.exactJql、metadata.verification、metadata.observedFields。',
          '',
          'Exact JQL:',
          '```jql',
          hints.exactJql,
          '```',
        ].filter(Boolean).join('\n')
      : undefined,
    '重要输出规则：',
    '- envelope.status 成功时使用 success。',
    '- envelope.summary 只能放“应该替换到 DOM 里的最终短文本”，不要解释过程。',
    '- 如果用户任务只是明确说“替换为 xxx”，summary 直接返回 xxx。',
    '- artifacts 至少包含一个 note artifact，并带 metadata.sourceSystem、metadata.entityKey、metadata.verification、metadata.observedFields，说明结果来源。',
    '- 如果无法查询外部系统、缺权限或缺能力，请按 OpenClaw 协议返回 capability_missing/auth_error/error，不要编造结果。',
    '',
    `页面 URL: ${String(data.urlPattern || '')}`,
    `目标 selector: ${String(data.selector || '')}`,
    sectionLabel ? `目标语义: ${sectionLabel}` : undefined,
    oldValue ? `原始文本: ${oldValue}` : undefined,
    nearbyText ? `附近文本: ${nearbyText}` : undefined,
    '',
    '用户任务:',
    userPrompt,
  ]
    .filter(Boolean)
    .join('\n');
}

function extractPersonalAiArReplacementText(response: Record<string, any>): string {
  const result = response?.result && typeof response.result === 'object'
    ? response.result as Record<string, any>
    : {};
  const payload = result.payload && typeof result.payload === 'object'
    ? result.payload as Record<string, any>
    : {};
  const candidates = [
    payload.arReplacementText,
    payload.replacementText,
    payload.displayText,
    payload.issueTotal,
    payload.issueCount,
    payload.issuesTotal,
    payload.total,
    payload.count,
    payload.value,
    result.summary,
  ];

  for (const candidate of candidates) {
    const text = arScalarToText(candidate);
    if (text) return text;
  }

  const artifacts = Array.isArray(result.artifacts) ? result.artifacts : [];
  for (const artifact of artifacts) {
    if (!artifact || typeof artifact !== 'object') continue;
    const text = nonEmptyArString((artifact as Record<string, unknown>).content);
    if (text) return text;
  }

  return '';
}

async function updatePersonalAiArBindingLastResult(input: {
  bindingId: string;
  text: string;
  status?: string;
  error?: string;
  updateResult?: boolean;
}): Promise<void> {
  const storage = await chrome.storage.local.get([PERSONAL_AI_AR_BINDINGS_KEY]);
  const rawBindings = storage[PERSONAL_AI_AR_BINDINGS_KEY];
  if (!Array.isArray(rawBindings)) {
    return;
  }

  let changed = false;
  const nextBindings = rawBindings.map((binding) => {
    if (!binding || typeof binding !== 'object' || binding.id !== input.bindingId) {
      return binding;
    }
    changed = true;
    const lastResult = input.updateResult === false
      ? binding.lastResult
      : {
          text: input.text,
          updatedAt: new Date().toISOString(),
        };
    return {
      ...binding,
      lastResult,
      lastRunStatus: input.status,
      lastRunError: input.error,
      lastRunAt: new Date().toISOString(),
    };
  });

  if (changed) {
    await chrome.storage.local.set({ [PERSONAL_AI_AR_BINDINGS_KEY]: nextBindings });
  }
}

async function executePersonalAiArBinding(data: Record<string, any>): Promise<{
  replacementText: string;
  response: Record<string, any>;
}> {
  const arBindingId = String(data.arBindingId || data.id || '').trim();
  const taskPrompt = String(data.agentTaskPrompt || data.taskPrompt || '').trim();
  if (!arBindingId) {
    throw new Error('缺少 AR binding id');
  }
  if (!taskPrompt) {
    throw new Error('缺少 AR Agent task prompt');
  }

  const envConfig = await getEnvConfig();
  const executeUrl = buildAgentTaskWebhookUrlFromMemoryBase(envConfig.MEMORY_SERVICE_BASE_URL);
  if (!executeUrl) {
    throw new Error('缺少 memory-service 配置，无法执行 AR 数据');
  }

  const storage = await chrome.storage.local.get(['userinfo']);
  const userinfo = storage.userinfo || {};
  const userId = [
    userinfo.username,
    userinfo.userEmail,
    userinfo.email,
    userinfo.name,
    userinfo.displayName,
    userinfo.fullName,
  ]
    .map(normalizeAgentTaskUserId)
    .find(Boolean);
  if (!userId) {
    throw new Error('缺少 memory-service 用户身份，无法执行 AR 数据');
  }
  const title = String(data.title || data.sectionLabel || data.oldValue || 'AR 数据更新').trim();
  const executionHints = inferPersonalAiArExecutionHints(data);
  const body = {
    taskId: `ar:${arBindingId}`,
    title: `AR 数据：${title}`,
    task: buildPersonalAiArExecutionTask(data, executionHints),
    taskKind: executionHints.taskKind,
    targetSystem: executionHints.targetSystem,
    executionHints,
    notifyTemplate: String(data.notifyTemplate || '').trim(),
    triggerSource: data.triggerSource || 'ar_manual',
    arBindingId,
    idempotencyKey: data.idempotencyKey || `${data.triggerSource || 'ar_manual'}:${arBindingId}:${Date.now()}`,
    userId,
    notify: false,
    source: {
      urlPattern: data.urlPattern,
      selector: data.selector,
      oldValue: data.oldValue,
      nearbyText: data.nearbyText,
      sectionLabel: data.sectionLabel,
    },
    scheduleSpec: {
      type: data.triggerSource === 'ar_auto_page_open' ? 'auto_ar_refresh' : 'manual_ar_refresh',
      autoRefreshDate: data.autoRefreshDate,
    },
  };

  const client = getMemoryServiceClient();
  client.setUserId(userId);
  const headers = await client.buildAuthHeaders();
  headers['Content-Type'] = 'application/json';
  headers.Accept = 'application/json';

  console.info('[Personal AI AR] execute via memory-service', {
    arBindingId,
    executeUrl,
    triggerSource: body.triggerSource,
    userId,
  });

  const response = await fetch(executeUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(responseBody?.error || responseBody?.message || `AR 数据执行失败（HTTP ${response.status}）`);
  }

  const replacementText = extractPersonalAiArReplacementText(responseBody);
  if (!replacementText || responseBody.queueStatus !== 'succeeded') {
    const error = responseBody?.error ||
      responseBody?.result?.summary ||
      responseBody?.queueStatus ||
      'AR 数据执行未返回可替换文本';
    throw new Error(error);
  }

  await updatePersonalAiArBindingLastResult({
    bindingId: arBindingId,
    text: replacementText,
    status: responseBody.queueStatus,
    updateResult: true,
  });
  return { replacementText, response: responseBody };
}

function getPersonalAiArExecutionInFlightKey(data: Record<string, any>): string {
  const arBindingId = String(data.arBindingId || data.id || '').trim();
  const taskPrompt = String(data.agentTaskPrompt || data.taskPrompt || '').trim();
  return `${arBindingId}:${taskPrompt}`;
}

function executePersonalAiArBindingDeduped(data: Record<string, any>): Promise<{
  replacementText: string;
  response: Record<string, any>;
}> {
  const key = getPersonalAiArExecutionInFlightKey(data);
  const existing = personalAiArExecutionInFlight.get(key);
  if (existing) {
    return existing;
  }

  const task = executePersonalAiArBinding(data).finally(() => {
    personalAiArExecutionInFlight.delete(key);
  });
  personalAiArExecutionInFlight.set(key, task);
  return task;
}

async function detachPersonalAiArAgentTask(data: Record<string, any>): Promise<ScheduledMessage> {
  const messageId = String(data.messageId || '').trim();
  const arBindingId = String(data.arBindingId || '').trim();
  if (!messageId) {
    throw new Error('缺少要暂停的 AgentTask 行 ID');
  }

  const token = await getGoogleAuthTokenSilently({
    caller: 'background.detachAgentTaskFromArBinding',
    scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
  });
  if (!token) {
    throw new Error('缺少 Google 授权，无法暂停重复 AR AgentTask');
  }

  const messageService = new ScheduledMessageService(token);
  const updates: Partial<ScheduledMessage> = {
    Status: 'Paused',
    Agent_AR_Binding_ID: '',
    Agent_Last_Status: 'ar_detached',
    Agent_Last_Result: arBindingId
      ? `AR binding ${arBindingId} 已取消重复执行`
      : 'AR binding 已取消重复执行',
    Exec_Log: 'AR binding 已取消重复执行；任务已暂停，历史记录保留。',
  };
  return messageService.updateMessage(messageId, updates);
}

function waitForDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function registerPersonalAiArContextMenu(): void {
  if (!chrome.contextMenus) {
    return;
  }

  chrome.contextMenus.remove(PERSONAL_AI_AR_CONTEXT_MENU_ID, () => {
    chrome.contextMenus.create({
      id: PERSONAL_AI_AR_CONTEXT_MENU_ID,
      title: 'AR 数据',
      contexts: ['page', 'selection', 'link', 'image', 'editable'],
      documentUrlPatterns: ['http://*/*', 'https://*/*', 'file://*/*'],
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn('AR 数据右键菜单创建失败:', chrome.runtime.lastError.message);
      }
    });
  });
}

function ensureBackgroundAlarm(
  name: string,
  alarmInfo: chrome.alarms.AlarmCreateInfo,
  shouldReplace: (alarm: chrome.alarms.Alarm) => boolean = () => false,
): void {
  chrome.alarms.get(name, (alarm) => {
    if (chrome.runtime.lastError) {
      console.warn(
        `读取后台定时器失败: ${name}`,
        chrome.runtime.lastError.message,
      );
      return;
    }

    if (alarm && !shouldReplace(alarm)) {
      console.log(`✅ 后台定时器已存在: ${name}`);
      return;
    }

    chrome.alarms.create(name, alarmInfo);
    console.log(`⏰ 后台定时器已设置: ${name}`);
  });
}

async function waitForTabReady(tabId: number): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') {
      await waitForDelay(1000);
      return;
    }
  } catch (error) {
    console.warn(
      'waitForTabReady: 读取标签页状态失败，改为等待 onUpdated',
      error,
    );
  }

  await waitForTabLoad(tabId);
}

async function openGlipPopupWindow(
  url: string,
  options: { width?: number; height?: number; focused?: boolean } = {},
): Promise<{ windowId: number; tabId: number }> {
  const popupWindow = await chrome.windows.create({
    url,
    type: 'popup',
    width: options.width ?? GLIP_POPUP_DEFAULT_WIDTH,
    height: options.height ?? GLIP_POPUP_DEFAULT_HEIGHT,
    focused: options.focused ?? true,
  });

  const windowId = popupWindow.id;
  if (windowId == null) {
    throw new Error('glip_popup_window_missing_id');
  }

  let tabId = popupWindow.tabs?.[0]?.id;
  if (!tabId) {
    const tabs = await chrome.tabs.query({ windowId });
    tabId = tabs[0]?.id;
  }

  if (!tabId) {
    throw new Error('glip_popup_tab_missing_id');
  }

  await waitForTabReady(tabId);
  return { windowId, tabId };
}

function isNotificationCenterCompatError(error: any): boolean {
  return error?.status === 404 || error?.status === 501;
}

function formatChromeNotificationCreateError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String(error ?? 'chrome_notification_create_failed');
  const compacted = message.replace(/\s+/g, ' ').trim();
  if (!compacted) return 'chrome_notification_create_failed';
  if (compacted.length <= 140) return compacted;
  return `${compacted.slice(0, 139).trim()}…`;
}

type ChromeDeliveryEvent = {
  sourceRef: string;
  lane: 'todo' | 'notice';
  status: 'delivered' | 'failed' | 'clicked' | 'dismissed';
  externalRef?: string;
  error?: string;
};

const CHROME_DELIVERY_OUTBOX_STORAGE_KEY =
  'notification_center_chrome_delivery_outbox_v1';

async function safeReportChromeDelivery(
  events: ChromeDeliveryEvent[],
): Promise<boolean> {
  if (events.length === 0) return true;
  try {
    const client = getMemoryServiceClient();
    await client.reportNotificationCenterDelivery(
      events.map((event) => ({
        ...event,
        channel: 'chrome',
      })),
    );
    return true;
  } catch (error: any) {
    if (isNotificationCenterCompatError(error)) {
      return true;
    }
    console.debug('safeReportChromeDelivery error:', error);
    return false;
  }
}

function getChromeDeliveryEventKey(event: ChromeDeliveryEvent): string {
  return [
    event.sourceRef,
    event.lane,
    event.status,
    event.externalRef || '',
    event.error || '',
  ].join('\u001f');
}

async function readChromeDeliveryOutbox(): Promise<ChromeDeliveryEvent[]> {
  try {
    const stored = await chrome.storage.local.get(
      CHROME_DELIVERY_OUTBOX_STORAGE_KEY,
    );
    const raw = stored?.[CHROME_DELIVERY_OUTBOX_STORAGE_KEY];
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (event: any) =>
        event &&
        typeof event.sourceRef === 'string' &&
        (event.lane === 'todo' || event.lane === 'notice') &&
        ['delivered', 'failed', 'clicked', 'dismissed'].includes(event.status),
    );
  } catch (error) {
    console.debug('readChromeDeliveryOutbox error:', error);
    return [];
  }
}

async function enqueueChromeDeliveryOutbox(
  events: ChromeDeliveryEvent[],
): Promise<void> {
  if (events.length === 0) return;
  try {
    const merged = new Map<string, ChromeDeliveryEvent>();
    for (const event of [...(await readChromeDeliveryOutbox()), ...events]) {
      merged.set(getChromeDeliveryEventKey(event), event);
    }
    await chrome.storage.local.set({
      [CHROME_DELIVERY_OUTBOX_STORAGE_KEY]: Array.from(merged.values()).slice(
        -100,
      ),
    });
  } catch (error) {
    console.debug('enqueueChromeDeliveryOutbox error:', error);
  }
}

async function flushChromeDeliveryOutbox(): Promise<boolean> {
  const pending = await readChromeDeliveryOutbox();
  if (pending.length === 0) return true;
  const reported = await safeReportChromeDelivery(pending);
  if (!reported) return false;
  try {
    await chrome.storage.local.remove(CHROME_DELIVERY_OUTBOX_STORAGE_KEY);
  } catch (error) {
    console.debug('flushChromeDeliveryOutbox cleanup error:', error);
  }
  return true;
}

async function storeBackendNotificationMeta(
  notificationId: string,
  meta: BackendNotificationMeta,
): Promise<void> {
  backendNotificationMeta.set(notificationId, meta);
  try {
    await chrome.storage.local.set({
      [getBackendNotificationMetaStorageKey(notificationId)]: meta,
    });
  } catch (error) {
    console.debug('storeBackendNotificationMeta error:', error);
  }
}

async function getStoredBackendNotificationMeta(
  notificationId: string,
): Promise<BackendNotificationMeta | undefined> {
  const cached = backendNotificationMeta.get(notificationId);
  if (cached) return cached;

  try {
    const storageKey = getBackendNotificationMetaStorageKey(notificationId);
    const stored = await chrome.storage.local.get(storageKey);
    const meta = normalizeBackendNotificationMeta(stored[storageKey]);
    if (meta) {
      backendNotificationMeta.set(notificationId, meta);
      return meta;
    }
  } catch (error) {
    console.debug('getStoredBackendNotificationMeta error:', error);
  }

  return undefined;
}

async function clearBackendNotificationMeta(
  notificationId: string,
): Promise<void> {
  backendNotificationMeta.delete(notificationId);
  try {
    await chrome.storage.local.remove(
      getBackendNotificationMetaStorageKey(notificationId),
    );
  } catch (error) {
    console.debug('clearBackendNotificationMeta error:', error);
  }
}

interface OutreachTemplateMirrorOverrides {
  targetType?: string;
  targetRef?: string;
  contextTemplate?: string;
  maxFollowup?: number;
  followupIntervalHours?: number;
}

function parseOutreachEpochSeconds(raw?: string): number | undefined {
  if (!raw || !raw.trim()) return undefined;
  const normalized = raw.includes('T')
    ? raw
    : raw.includes(' ')
    ? raw.replace(' ', 'T')
    : `${raw}T09:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return undefined;
  return Math.floor(date.getTime() / 1000);
}

function getOutreachScheduleTimeZone(): string {
  return (
    Intl.DateTimeFormat().resolvedOptions().timeZone?.trim() || 'Asia/Shanghai'
  );
}

function isRecurringScheduledMessage(message: ScheduledMessage): boolean {
  return Boolean(message.Repeat_Every && message.Repeat_Unit);
}

function getExpectedOutreachScheduleTime(message: ScheduledMessage): string {
  return normalizeLocalScheduleTime(message.Schedule_Time) || '09:00';
}

function isNextExecAlignedWithScheduleTime(
  message: ScheduledMessage,
  nextExecution?: string,
): boolean {
  if (!nextExecution?.trim()) return false;

  try {
    const { timeStr } = formatLocalScheduleDateTime(nextExecution);
    return timeStr === getExpectedOutreachScheduleTime(message);
  } catch {
    return false;
  }
}

function resolveOutreachNextExecution(message: ScheduledMessage): string {
  if (!isRecurringScheduledMessage(message)) {
    return message.Next_Exec || message.Schedule_Date || '';
  }

  if (isNextExecAlignedWithScheduleTime(message, message.Next_Exec)) {
    return message.Next_Exec || '';
  }

  return calculateScheduledMessageNextExecution(message);
}

function buildOutreachScheduleSpec(
  message: ScheduledMessage,
): Record<string, unknown> {
  const spec: Record<string, unknown> = {
    timezone: getOutreachScheduleTimeZone(),
  };
  const nextDispatchAt = parseOutreachEpochSeconds(
    resolveOutreachNextExecution(message),
  );
  if (nextDispatchAt) {
    spec.nextDispatchAt = nextDispatchAt;
  }
  if (message.Schedule_Date) {
    spec.scheduleDate = message.Schedule_Date;
  }
  if (message.Schedule_Time) {
    spec.scheduleTime = message.Schedule_Time;
  }
  if (message.Repeat_Every && message.Repeat_Unit) {
    spec.repeatEvery = Number(message.Repeat_Every);
    spec.repeatUnit = message.Repeat_Unit;
  }
  if (message.Repeat_Days) {
    spec.repeatDays = message.Repeat_Days;
  }
  if (message.End_Date) {
    spec.endDate = message.End_Date;
  }
  if (message.Repeat_Count) {
    spec.repeatCount = Number(message.Repeat_Count);
  }
  return spec;
}

function resolveOutreachTargetRef(
  message: ScheduledMessage,
  targetType?: string,
): string {
  return (
    (targetType === 'group'
      ? message.Glip_Team_ID?.trim()
      : message.Glip_User_Name?.trim()) ||
    message.Outreach_Target_Ref?.trim() ||
    ''
  );
}

function buildOutreachTemplatePayload(
  message: ScheduledMessage,
  overrides: OutreachTemplateMirrorOverrides = {},
) {
  const targetType =
    overrides.targetType ||
    message.Target_Type ||
    message.Outreach_Target_Type ||
    (message.Glip_Team_ID ? 'group' : 'private');
  const targetRef =
    overrides.targetRef?.trim() ||
    resolveOutreachTargetRef(message, targetType);
  const questionTemplate =
    message.Content?.trim() ||
    (
      message as ScheduledMessage & { Outreach_Question?: string }
    ).Outreach_Question?.trim();
  if (!targetRef) {
    throw new Error('Outreach target ref is required');
  }
  if (!questionTemplate) {
    throw new Error('Outreach question is required');
  }

  const status = message.Status || 'Active';
  const enabled = status === 'Active';
  const syncState =
    status === 'Paused'
      ? 'paused'
      : status === 'Completed' || status === 'Done'
      ? 'cancelled'
      : 'synced';

  return {
    id: message.ID,
    sourceKind: 'scheduled_message',
    sourceRefId: message.ID,
    sheetMessageId: message.ID,
    title: message.Topic,
    questionTemplate,
    contextTemplate: overrides.contextTemplate?.trim(),
    informationGoalTemplate: overrides.contextTemplate?.trim(),
    targetType,
    targetRef,
    scheduleSpec: buildOutreachScheduleSpec(message),
    enabled,
    approvalPolicy: 'manual_direct',
    maxFollowup: overrides.maxFollowup,
    followupIntervalSeconds:
      overrides.followupIntervalHours === undefined
        ? undefined
        : Math.max(3600, Number(overrides.followupIntervalHours ?? 24) * 3600),
    syncState,
  };
}

async function syncOutreachTemplateMirror(
  message: ScheduledMessage,
  overrides?: OutreachTemplateMirrorOverrides,
): Promise<void> {
  const client = getMemoryServiceClient();
  await client.upsertOutreachTemplate(
    buildOutreachTemplatePayload(message, overrides),
  );
}

async function cancelOutreachTemplateMirror(messageId: string): Promise<void> {
  const client = getMemoryServiceClient();
  await client.cancelOutreachTemplate(messageId);
}

/**
 * Registers AgentTask result-notification preferences directly with
 * memory-service instead of relying on them reaching it through Sheet ->
 * deployed Apps Script -> request body. That path only forwards whatever
 * fields the *deployed* GAS version knows about, so config added after the
 * last upgrade (e.g. successReceipt) silently never arrives.
 */
function buildAgentTaskNotifyTargetPayload(
  message: ScheduledMessage,
): { type: 'private' | 'group'; targetGroupId?: string; glipUserName?: string } | null {
  if (message.Target_Type === 'group') {
    const groupId = message.Glip_Team_ID?.trim();
    return groupId ? { type: 'group', targetGroupId: groupId } : null;
  }
  const glipUserName = message.Glip_User_Name?.trim();
  return glipUserName ? { type: 'private', glipUserName } : null;
}

async function syncAgentTaskNotifyConfigMirror(message: ScheduledMessage): Promise<void> {
  if (message.Push_Method !== 'AgentTask') return;
  const client = getMemoryServiceClient();
  await client.upsertAgentTaskNotifyConfig({
    sheetMessageId: message.ID,
    notifyTarget: buildAgentTaskNotifyTargetPayload(message),
    successReceipt: message.Agent_Notify_Success_Receipt === 'N' ? 'N' : 'Y',
    notifyVia: message.Agent_Notify_Via === 'asme' ? 'asme' : 'bot',
    notifyTemplate: message.Agent_Notify_Template?.trim() || undefined,
  });
}

async function deleteAgentTaskNotifyConfigMirror(sheetMessageId: string): Promise<void> {
  const client = getMemoryServiceClient();
  await client.deleteAgentTaskNotifyConfig(sheetMessageId);
}

async function pauseOutreachTemplateMirror(
  message: ScheduledMessage,
): Promise<void> {
  const client = getMemoryServiceClient();
  try {
    await client.pauseOutreachTemplate(message.ID);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    if (!messageText.includes('404')) {
      throw error;
    }
    await client.upsertOutreachTemplate(
      buildOutreachTemplatePayload({ ...message, Status: 'Paused' }),
    );
  }
}

let glipMarkerRefreshInFlight: Promise<any> | null = null;
let glipMarkerRefreshTimer: ReturnType<typeof setTimeout> | null = null;

async function getScheduledSheetDataForMarkers(): Promise<{
  messages: ScheduledMessage[];
  pushLogs: PushLog[];
}> {
  try {
    const { scheduledMessagesConfig } = await chrome.storage.local.get([
      'scheduledMessagesConfig',
    ]);
    if (!scheduledMessagesConfig?.sheetId) {
      return { messages: [], pushLogs: [] };
    }
    const token = await getGoogleAuthTokenSilently({
      caller: 'refreshGlipMessageMarkers',
      scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
    });
    if (!token) {
      return { messages: [], pushLogs: [] };
    }
    const service = new ScheduledMessageService(token);
    const [messages, pushLogs] = await Promise.all([
      service.getAllMessages(),
      service.getRecentPushLogs(500),
    ]);
    return { messages, pushLogs };
  } catch (error) {
    console.warn(
      '⚠️ 同步 Scheduled Message Glip 标注失败，跳过 Sheet marker:',
      error,
    );
    return { messages: [], pushLogs: [] };
  }
}

async function refreshGlipMessageMarkers(): Promise<unknown> {
  if (glipMarkerRefreshInFlight) {
    return glipMarkerRefreshInFlight;
  }

  glipMarkerRefreshInFlight = (async () => {
    const [{ concernedItems }, outreachSnapshot, scheduledSheetData] =
      await Promise.all([
        chrome.storage.local.get(['concernedItems']),
        getMemoryServiceClient()
          .getGlipMessageMarkers()
          .catch((error) => {
            console.warn(
              '⚠️ 同步 Outreach Glip 标注失败，使用本地 marker:',
              error,
            );
            return { items: [], generatedAt: 0 };
          }),
        getScheduledSheetDataForMarkers(),
      ]);

    const markersByChatId = mergeMarkerIndexes(
      buildFollowThreadMarkers(concernedItems || []),
      buildScheduledSnoozeMarkers(scheduledSheetData.messages),
      buildScheduledPushLogMarkers(scheduledSheetData.pushLogs),
      // memory-service already returns flat marker records; index them via cache writer helper.
      mergeMarkerIndexes(
        ...outreachSnapshot.items.map((marker) => ({
          [marker.chatId]: {
            [marker.postId]: [marker],
          },
        })),
      ),
    );

    const deliveredScheduledMessageIds = scheduledSheetData.pushLogs
      .filter((log) => log.Status === 'Success')
      .map((log) => (typeof log.Message_ID === 'string' ? log.Message_ID : ''))
      .filter(Boolean);

    return writeGlipMessageMarkersCache(markersByChatId, {
      deliveredScheduledMessageIds,
    });
  })().finally(() => {
    glipMarkerRefreshInFlight = null;
  });

  return glipMarkerRefreshInFlight;
}

function scheduleGlipMessageMarkerRefresh(
  delayMs = 1200,
  persistentBootstrap = false,
): void {
  if (glipMarkerRefreshTimer) {
    clearTimeout(glipMarkerRefreshTimer);
  }
  glipMarkerRefreshTimer = setTimeout(() => {
    glipMarkerRefreshTimer = null;
    const refreshPromise = persistentBootstrap
      ? runPersistentlyThrottledTask({
          storage: chrome.storage.local,
          taskId: 'glip-message-markers-bootstrap',
          successIntervalMs: 5 * 60_000,
          failureIntervalMs: 60_000,
          task: refreshGlipMessageMarkers,
        })
      : refreshGlipMessageMarkers();
    void refreshPromise.catch((error) => {
      console.warn('⚠️ 刷新 Glip 标注缓存失败:', error);
    });
  }, delayMs);
}

// 注册 Digest 任务（关注后续合并通知、concernedItems 每日摘要等）
registerFollowThreadDigestTask();
registerConcernedItemsDigestTask();
ensureBackgroundAlarm(
  'refreshGlipMessageMarkers',
  { periodInMinutes: 5 },
  (alarm) => alarm.periodInMinutes !== 5,
);
scheduleGlipMessageMarkerRefresh(3000, true);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.concernedItems) {
    scheduleGlipMessageMarkerRefresh();
  }
});

// 记录扩展启动
Logger.lifecycle('startup', 'Background script loaded');
void runPersistentlyThrottledTask({
  storage: chrome.storage.local,
  taskId: 'stored-user-identity-bootstrap',
  successIntervalMs: 5 * 60_000,
  failureIntervalMs: 60_000,
  task: syncStoredUserIdentityToMemory,
}).catch((error) => {
  console.warn('User identity bootstrap sync failed:', error);
});

// Background script 加载时检查并初始化任务调度器
//
// 根据 Chrome Extension 官方文档:
// - chrome.management.onEnabled/onDisabled 只能监听其他扩展，无法监听自身
// - chrome.runtime.onInstalled 不会在扩展重新启用时触发
// - chrome.runtime.onStartup 只在浏览器启动时触发
//
// 因此，当扩展被禁用后重新启用时，background script 会重新加载，
// 但不会触发任何生命周期事件。唯一可靠的方法是在 script 加载时主动检查。
//
// 这会处理以下场景:
// 1. 扩展被禁用后重新启用 (重新加载 background script)
// 2. Chrome 浏览器重启 (配合 onStartup 的延迟)
// 3. 扩展被手动重新加载 (开发者工具中)
(async () => {
  try {
    // 延迟初始化，避免与 onInstalled 冲突
    setTimeout(async () => {
      const { envConfig } = await chrome.storage.local.get(['envConfig']);
      updateConcernedItemsDigestTaskSchedule(
        normalizeConcernedItemsDigestHour(
          envConfig?.CONCERNED_ITEMS_DIGEST_HOUR,
          8,
        ),
      );
      try {
        const roadmapBase =
          envConfig?.ROADMAP_BASE_URL ||
          (await getEnvConfig()).ROADMAP_BASE_URL;
        await syncRoadmapContentScript(roadmapBase);
      } catch (error) {
        console.warn('[pai-roadmap] content script sync failed', error);
      }
      await taskScheduler.startAllTasks();
    }, 5000); // 5秒延迟，确保扩展环境完全就绪
  } catch (error) {
    console.error('❌ Background script 初始化检查失败:', error);
  }
})();

// 浏览器启动时恢复任务调度器
chrome.runtime.onStartup.addListener(async () => {
  try {
    registerPersonalAiArContextMenu();
    setTimeout(async () => {
      console.log('🔄 浏览器启动，恢复任务调度器...');
      await taskScheduler.startAllTasks();
    }, 10000);
  } catch (error) {
    console.error('❌ onStartup 监听器错误:', error);
  }
});

// 扩展安装、更新或重新启用时，立即创建定时任务，处理一些 Storage 的初始化
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    console.log('Extension event:', details.reason); // 可能的值: install, update, chrome_update, shared_module_update
    registerPersonalAiArContextMenu();

    // 记录生命周期事件
    const manifest = chrome.runtime.getManifest();
    Logger.lifecycle(details.reason, `扩展 ${details.reason}`, {
      version: manifest.version,
      previousVersion: details.previousVersion,
    });

    // 如果是更新，记录版本升级日志
    if (details.reason === 'update' && details.previousVersion) {
      Logger.upgrade(
        manifest.version,
        true,
        `从 v${details.previousVersion} 升级到 v${manifest.version}`,
      );
    } else if (details.reason === 'install') {
      Logger.upgrade(manifest.version, true, `首次安装 v${manifest.version}`);
    }

    // 加载配置
    const config = await getEnvConfig();
    console.log('Global config loaded:', config);

    try {
      await syncRoadmapContentScript(config.ROADMAP_BASE_URL);
    } catch (error) {
      console.warn('[pai-roadmap] content script sync failed', error);
    }

    // 启动统一任务调度器
    await taskScheduler.startAllTasks();

    // 如果是扩展更新，检查并更新 Sheet Schema、App Script 和 Jira Rule
    // 注意：使用 getCachedAuthToken 避免在无用户操作时弹出授权窗口
    if (details.reason === 'update') {
      console.log(
        '🔄 检测到扩展更新，检查 Sheet Schema、App Script 和 Jira Rule 是否需要更新...',
      );

      // 1. 检查并更新 Sheet Schema（先更新表结构，再更新脚本）
      // 使用静默方法：只使用缓存的 token，不弹出授权窗口
      SheetSchemaUpdater.checkAndAutoUpdate(
        () =>
          getGoogleAuthTokenSilently({
            caller: 'background.autoUpdateSchema',
            scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
          }),
        {
          showNotification: true,
        },
      )
        .then(() => {
          Logger.upgrade(manifest.version, true, 'Sheet Schema 更新成功', {
            component: 'SheetSchema',
          });
        })
        .catch((error) => {
          console.error('❌ Sheet Schema 自动更新失败:', error);
          Logger.upgrade(manifest.version, false, 'Sheet Schema 更新失败', {
            component: 'SheetSchema',
            error: error.message,
          });
        });

      // 2. 检查并更新 App Script（延迟 3 秒，等待 Schema 更新完成）
      // 使用静默方法：只使用缓存的 token，不弹出授权窗口
      setTimeout(() => {
        AppScriptUpdater.checkAndAutoUpdate(() =>
          getGoogleAuthTokenSilently({
            caller: 'background.autoUpdateAppScript',
            scopes: GOOGLE_AUTH_SCOPE_SETS.APPS_SCRIPT_ADMIN,
          }),
        )
          .then((outcome) => {
            // checkAndAutoUpdate resolves even when it skipped or failed, so the
            // log line has to follow the outcome instead of the promise.
            if (outcome.status === 'updated') {
              Logger.upgrade(manifest.version, true, 'App Script 更新成功', {
                component: 'AppScript',
                newVersion: outcome.newVersion,
              });
              return;
            }

            if (outcome.status === 'up_to_date') {
              Logger.upgrade(manifest.version, true, 'App Script 已是最新版本', {
                component: 'AppScript',
                currentVersion: outcome.currentVersion,
              });
              return;
            }

            if (outcome.status === 'skipped') {
              Logger.upgrade(manifest.version, true, `App Script 更新已跳过（${outcome.reason}）`, {
                component: 'AppScript',
                reason: outcome.reason,
              });
              return;
            }

            Logger.upgrade(manifest.version, false, 'App Script 更新失败', {
              component: 'AppScript',
              error: outcome.error,
              ...('errorCode' in outcome && outcome.errorCode
                ? { errorCode: outcome.errorCode }
                : {}),
            });
          })
          .catch((error) => {
            console.error('❌ App Script 自动更新失败:', error);
            Logger.upgrade(manifest.version, false, 'App Script 更新失败', {
              component: 'AppScript',
              error: error.message,
            });
          });
      }, 3000);

      // 3. 检查并更新 Jira Automation Rule（延迟 8 秒，避免与上面的更新冲突）
      // 使用静默方法：只使用缓存的 token，不弹出授权窗口
      JiraRuleUpdater.checkAndAutoUpdate(
        () =>
          getGoogleAuthTokenSilently({
            caller: 'background.autoUpdateJiraRule',
            scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
          }),
        {
          delay: 8000,
          showNotification: true,
        },
      )
        .then(() => {
          Logger.upgrade(manifest.version, true, 'Jira Rule 更新成功', {
            component: 'JiraRule',
          });
        })
        .catch((error) => {
          console.error('❌ Jira Rule 自动更新失败:', error);
          Logger.upgrade(manifest.version, false, 'Jira Rule 更新失败', {
            component: 'JiraRule',
            error: error.message,
          });
        });
    }

    chrome.storage.local.remove('ollamaAnalysisProgress');

    // 获取并清理过期的 concernedItems
    const { concernedItems } = await chrome.storage.local.get('concernedItems');
    if (concernedItems) {
      const { manualItems, systemItems } =
        partitionConcernedItems(concernedItems);
      // 仅过滤 manual 项目的过期项；保留隐藏 system/internal 项
      const validItems = manualItems
        .filter((item: any) => {
          return !item.expiredAt || new Date(item.expiredAt) > new Date();
        })
        .concat(systemItems);

      // 如果有项目被过滤掉，更新存储
      if (validItems.length !== concernedItems.length) {
        await chrome.storage.local.set({ concernedItems: validItems });
      }
    }

    // 如果没有 concernedItems 或已清空，设置默认值
    // notifyMethod 使用逗号分隔格式，如 'bot,chrome'
    if (!concernedItems || concernedItems.length === 0) {
      chrome.storage.local.set({
        concernedItems: [
          {
            id: '1',
            text: '聊到关于公司政策，也可以是政策相关的八卦消息',
            expiredAt: 0,
            notifyMethod: 'bot',
          },
          {
            id: '2',
            text: '任何提到我的名字的消息，排除 @Team，排除明确@{我的名字}，排除发送者是我',
            expiredAt: 0,
            notifyMethod: 'chrome',
          },
          {
            id: '3',
            text: '可能是回复我的消息，比如在我发完消息之后的答复。排除发送者是我，排除明确@{我的名字}',
            expiredAt: 0,
            notifyMethod: 'bot',
            mentionMe: true,
          },
        ],
      });
    } else {
      // 迁移旧的 pushToGlip 到 notifyMethod
      let needsMigration = false;
      const migratedItems = concernedItems.map((item: any) => {
        if (item.pushToGlip !== undefined && !item.notifyMethod) {
          needsMigration = true;
          return {
            ...item,
            notifyMethod: item.pushToGlip ? 'bot' : '',
            pushToGlip: undefined, // 移除旧字段
          };
        }
        return item;
      });
      if (needsMigration) {
        await chrome.storage.local.set({ concernedItems: migratedItems });
        console.log('✅ 已迁移 pushToGlip 到 notifyMethod');
      }
    }
    console.log('concernedItems', concernedItems);

    // 获取用户信息
    try {
      let userinfo = null;
      // 查找并刷新 RingCentral 标签页
      const rcTab = await findRingCentralTab();
      if (rcTab && rcTab.id) {
        await chrome.tabs.reload(rcTab.id);
        console.log('RingCentral tab refreshed');

        // 延迟获取 RC Radar 配置
        userinfo = await getUserinfoFromRCpage();
      }
      // 如果获取不到用户信息，则从 jira.ringcentral.com 获取用户信息
      const cacheUserinfo = await chrome.storage.local.get(['userinfo']);
      if (!userinfo && !cacheUserinfo.userinfo) {
        userinfo = await getUserinfoFromJiraPage();
      }
    } catch (error) {
      console.error('Error refreshing RingCentral tab:', error);
    }

    // 离屏文档已废弃 — 后端 memory-service 处理嵌入生成
  } catch (error) {
    console.error('Error in onInstalled listener:', error);
  }
});

// ========================================
// 🔥 关键修复：立即设置 alarm 监听器
// ========================================
// Manifest V3 Service Worker 会在不活动时被终止。
// 当 chrome.alarms 触发时会唤醒 Service Worker，
// 但必须确保监听器在 Service Worker 启动时立即设置，
// 否则 alarm 事件会丢失！
//
// 监听器必须在顶层同步设置，不能延迟或等待异步初始化。
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('🔔 收到 alarm 事件:', alarm.name);

  try {
    // 所有定时任务统一由 TaskScheduler 管理
    if (await TaskScheduler.tryHandleAlarm(alarm)) {
      return;
    }

    if (alarm.name === 'refreshGlipMessageMarkers') {
      await refreshGlipMessageMarkers();
      return;
    }

    // 处理关注后续清理任务
    if (alarm.name === 'cleanupFollowThreads') {
      await cleanupExpiredFollowThreads();
      // 设置下一次清理时间
      chrome.alarms.create('cleanupFollowThreads', {
        when: getNextCleanupTime(),
      });
      return;
    }

    // Poll backend notifications (dream_digest, weekly_report, etc.)
    if (alarm.name === 'pollBackendNotifications') {
      await pollBackendNotifications();
      return;
    }

    // 定时上报前端用量打点（token / 能力频率）
    if (alarm.name === 'flushUsageTelemetry') {
      await UsageTracker.flush();
      return;
    }

    if (alarm.name === 'contextAssistOutlookCalendarSync') {
      const envConfig = await getEnvConfig();
      if (
        envConfig.CONTEXT_ASSIST_ENABLED !== false &&
        envConfig.MEETING_PREP_ENABLED !== false &&
        envConfig.TODAY_PILOT_MEETING_PREP_ENABLED !== false &&
        envConfig.MEETING_PREP_CALENDAR_SOURCE !== 'ringcentral_indexeddb'
      ) {
        const status = await getOutlookCalendarStatus();
        if (status.connected && envConfig.MS_OUTLOOK_CLIENT_ID) {
          await syncOutlookCalendarToMemoryService(
            getMemoryServiceClient(),
            envConfig,
          );
        }
      }
      return;
    }

    // 处理未知 alarm
    console.log(`⚡ 未处理的 alarm 事件: ${alarm.name}`);
  } catch (error) {
    console.error('❌ 处理 alarm 事件失败:', error);
  }
});
console.log('✅ Alarm 监听器已设置（顶层同步）');

if (chrome.contextMenus?.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== PERSONAL_AI_AR_CONTEXT_MENU_ID || !tab?.id) {
      return;
    }

    chrome.tabs.sendMessage(tab.id, {
      type: 'PERSONAL_AI_AR_CONTEXT_MENU',
      data: {
        selectionText: info.selectionText || '',
        srcUrl: info.srcUrl || '',
        linkUrl: info.linkUrl || '',
      },
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn('AR 数据右键菜单消息发送失败:', chrome.runtime.lastError.message);
      }
    });
  });
}

let followupAskSetupCache:
  | { expiresAt: number; state: FollowupAskSetupState }
  | null = null;
const FOLLOWUP_ASK_SETUP_TTL_MS = 30_000;

function invalidateFollowupAskSetupCache(): void {
  followupAskSetupCache = null;
}

async function loadFollowupAskSetupState(
  force = false,
): Promise<FollowupAskSetupState> {
  if (
    !force &&
    followupAskSetupCache &&
    followupAskSetupCache.expiresAt > Date.now()
  ) {
    return followupAskSetupCache.state;
  }

  try {
    const runtime = await getMemoryServiceClient().getRuntimeConfig();
    const state = resolveFollowupAskSetupState({
      outreachEnabled: runtime.outreachEnabled === true,
      ringCentralReady: isRingCentralOutreachReady(runtime),
    });
    followupAskSetupCache = {
      expiresAt: Date.now() + FOLLOWUP_ASK_SETUP_TTL_MS,
      state,
    };
    return state;
  } catch (error) {
    console.warn('读取跟进追问主动询问配置失败:', error);
    const state = resolveFollowupAskSetupState({ configUnavailable: true });
    followupAskSetupCache = {
      expiresAt: Date.now() + 10_000,
      state,
    };
    return state;
  }
}

async function openOptionsPageWithHash(hash?: string): Promise<void> {
  const normalizedHash =
    typeof hash === 'string' ? hash.replace(/^#/, '').trim() : '';
  if (!normalizedHash) {
    await chrome.runtime.openOptionsPage();
    return;
  }
  const url = chrome.runtime.getURL(`options.html#${normalizedHash}`);
  const existing = await chrome.tabs.query({
    url: chrome.runtime.getURL('options.html'),
  });
  const existingTab = existing[0];
  if (existingTab?.id) {
    await chrome.tabs.update(existingTab.id, { url, active: true });
    if (existingTab.windowId) {
      await chrome.windows.update(existingTab.windowId, { focused: true });
    }
    return;
  }
  await chrome.tabs.create({ url });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 全局日志：记录所有收到的消息
  // console.log(
  //   '🔔 Background 收到消息:',
  //   request.type,
  //   '来自:',
  //   sender.tab?.url || sender.url || 'unknown',
  // );

  if (request.type === 'FLUSH_USAGE_TELEMETRY') {
    (async () => {
      try {
        const before = await UsageTracker.getFlushDiagnostics();
        await UsageTracker.flush();
        const after = await UsageTracker.getFlushDiagnostics();
        sendResponse({
          success: !after.lastFlushError,
          before,
          diagnostics: after,
        });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error?.message || String(error),
        });
      }
    })();
    return true;
  }

  if (request.type === 'OPEN_OPTIONS_PAGE') {
    (async () => {
      try {
        await openOptionsPageWithHash(
          typeof request.hash === 'string' ? request.hash : undefined,
        );
        sendResponse({ success: true });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error?.message || String(error),
        });
      }
    })();
    return true;
  }

  if (request.type === 'GET_FOLLOWUP_ASK_SETUP') {
    (async () => {
      try {
        const setup = await loadFollowupAskSetupState(
          request.force === true,
        );
        sendResponse({ success: true, setup });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error?.message || 'setup_failed',
          setup: resolveFollowupAskSetupState({ configUnavailable: true }),
        });
      }
    })();
    return true;
  }

  if (request.type === 'GET_USAGE_TELEMETRY_STATUS') {
    (async () => {
      try {
        const diagnostics = await UsageTracker.getFlushDiagnostics();
        sendResponse({ success: true, diagnostics });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error?.message || String(error),
        });
      }
    })();
    return true;
  }

  if (request.type === 'EXECUTE_PERSONAL_AI_AR_BINDING') {
    (async () => {
      try {
        const result = await executePersonalAiArBindingDeduped(request.data || {});
        sendResponse({
          success: true,
          replacementText: result.replacementText,
          response: result.response,
        });
      } catch (error: any) {
        const bindingId = String(request.data?.arBindingId || request.data?.id || '').trim();
        if (bindingId) {
          await updatePersonalAiArBindingLastResult({
            bindingId,
            text: String(request.data?.lastResultText || request.data?.oldValue || '').trim(),
            status: 'failed',
            error: error?.message || 'ar_execute_failed',
            updateResult: false,
          });
        }
        sendResponse({
          success: false,
          error: error?.message || 'ar_execute_failed',
        });
      }
    })();
    return true;
  }

  if (
    request.type === 'CREATE_AGENT_TASK_FROM_AR_BINDING' ||
    request.type === 'UPSERT_AGENT_TASK_FROM_AR_BINDING'
  ) {
    (async () => {
      try {
        const data = request.data || {};
        const token = await getGoogleAuthTokenSilently({
          caller: 'background.createAgentTaskFromArBinding',
          scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
        });
        if (!token) {
          throw new Error('缺少 Google 授权，无法写入 Scheduled Messages');
        }
        await ensureAgentTaskWebhookConfigForBackground(token);

        const messageService = new ScheduledMessageService(token);
        const today = formatLocalScheduleDateTime(new Date()).dateStr;
        const repeatUnit = data.repeatUnit === 'Month' ? 'Month' : 'Week';
        const repeatEvery = data.repeatEvery === 3 ? 3 : 1;
        const taskPrompt = String(data.taskPrompt || '').trim();
        if (!taskPrompt) {
          throw new Error('缺少 Agent task 描述');
        }

        const formData: CreateMessageFormData = {
          Topic: String(data.title || 'AR 数据更新').trim() || 'AR 数据更新',
          Content: taskPrompt,
          Schedule_Date: today,
          Schedule_Time: '',
          Repeat_Every: repeatEvery,
          Repeat_Unit: repeatUnit,
          Push_Method: 'AgentTask',
          Target_Type: 'private',
          Category: 'AR 数据,帮我做',
          Agent_Task_ID: String(data.agentTaskId || `agent_task_${Date.now()}`),
          Agent_Executor: '',
          Agent_Notify_Template: String(data.notifyTemplate || '').trim(),
          Agent_Notify_Success_Receipt: 'Y',
          Agent_Trigger_Source: 'jira_rule',
          Agent_AR_Binding_ID: String(data.arBindingId || '').trim(),
        };

        let saved: ScheduledMessage;
        const messageId = String(data.messageId || '').trim();
        if (messageId) {
          try {
            saved = await messageService.updateMessage(messageId, formData);
          } catch (error: any) {
            if (!String(error?.message || '').includes('未找到消息')) {
              throw error;
            }
            saved = await messageService.createMessage(formData);
          }
        } else {
          saved = await messageService.createMessage(formData);
        }

        sendResponse({ success: true, message: saved });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error?.message || 'create_agent_task_failed',
        });
      }
    })();
    return true;
  }

  if (request.type === 'DETACH_AGENT_TASK_FROM_AR_BINDING') {
    (async () => {
      try {
        const message = await detachPersonalAiArAgentTask(request.data || {});
        sendResponse({ success: true, message });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error?.message || 'detach_agent_task_failed',
        });
      }
    })();
    return true;
  }

  if (request.type === 'SYNC_OUTREACH_TEMPLATE_MIRROR') {
    (async () => {
      try {
        await syncOutreachTemplateMirror(
          request.data?.message as ScheduledMessage,
          request.data?.overrides as
            | OutreachTemplateMirrorOverrides
            | undefined,
        );
        sendResponse({ success: true });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error?.message || 'sync_failed',
        });
      }
    })();
    return true;
  }

  if (request.type === 'CANCEL_OUTREACH_TEMPLATE_MIRROR') {
    (async () => {
      try {
        await cancelOutreachTemplateMirror(
          String(request.data?.messageId || ''),
        );
        sendResponse({ success: true });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error?.message || 'cancel_failed',
        });
      }
    })();
    return true;
  }

  if (request.type === 'SYNC_AGENT_TASK_NOTIFY_CONFIG') {
    (async () => {
      try {
        await syncAgentTaskNotifyConfigMirror(
          request.data?.message as ScheduledMessage,
        );
        sendResponse({ success: true });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error?.message || 'sync_failed',
        });
      }
    })();
    return true;
  }

  if (request.type === 'DELETE_AGENT_TASK_NOTIFY_CONFIG') {
    (async () => {
      try {
        await deleteAgentTaskNotifyConfigMirror(
          String(request.data?.sheetMessageId || ''),
        );
        sendResponse({ success: true });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error?.message || 'delete_failed',
        });
      }
    })();
    return true;
  }

  if (request.type === 'PAUSE_OUTREACH_TEMPLATE_MIRROR') {
    (async () => {
      try {
        await pauseOutreachTemplateMirror(
          request.data?.message as ScheduledMessage,
        );
        sendResponse({ success: true });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error?.message || 'pause_failed',
        });
      }
    })();
    return true;
  }

  if (request.type === 'REFRESH_GLIP_MESSAGE_MARKERS') {
    (async () => {
      try {
        const cache = await refreshGlipMessageMarkers();
        sendResponse({ success: true, cache });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error?.message || 'refresh_failed',
        });
      }
    })();
    return true;
  }

  if (request.type === 'CREATE_OUTREACH_FROM_MESSAGE') {
    (async () => {
      try {
        const setup = await loadFollowupAskSetupState(true);
        if (!setup.ready) {
          sendResponse({
            success: false,
            error: buildFollowupAskSetupToast(setup.reason),
            setup,
          });
          return;
        }
        const result =
          await getMemoryServiceClient().createOutreachSessionFromMessage(
            request.data,
          );
        await refreshGlipMessageMarkers();
        sendResponse({
          success: true,
          session: result.session,
          created: result.created !== false,
          reason: result.reason,
        });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error?.message || 'create_failed',
        });
      }
    })();
    return true;
  }

  if (request.type === 'CONTINUE_OUTREACH_FOLLOWUP') {
    (async () => {
      try {
        const setup = await loadFollowupAskSetupState(true);
        if (!setup.ready) {
          sendResponse({
            success: false,
            error: buildFollowupAskSetupToast(setup.reason),
            setup,
          });
          return;
        }
        const sessionId =
          typeof request.data?.sessionId === 'string'
            ? request.data.sessionId.trim()
            : '';
        if (!sessionId) {
          sendResponse({ success: false, error: 'missing_session_id' });
          return;
        }
        const result = await getMemoryServiceClient().continueOutreachFollowup(
          sessionId,
          {
            maxFollowup: request.data?.maxFollowup,
            followupIntervalSeconds: request.data?.followupIntervalSeconds,
          },
        );
        await refreshGlipMessageMarkers();
        sendResponse({
          success: true,
          session: result.session,
        });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error?.message || 'continue_failed',
        });
      }
    })();
    return true;
  }

  if (request.type === 'OPEN_OUTREACH_SESSION_REVIEW') {
    (async () => {
      try {
        const rawSessionId =
          typeof request.data?.sessionId === 'string'
            ? request.data.sessionId.trim()
            : '';
        const continueFollowup = request.data?.continueFollowup === true;
        const path = rawSessionId
          ? `memory-exploring.html#/outreach/${encodeURIComponent(rawSessionId)}${
              continueFollowup ? '?continueFollowup=1' : ''
            }`
          : 'memory-exploring.html#/outreach?originKind=message_reaction';
        const tab = await chrome.tabs.create({
          url: chrome.runtime.getURL(path),
        });
        sendResponse({ success: true, tabId: tab.id });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error?.message || 'open_failed',
        });
      }
    })();
    return true;
  }

  // 如果不是 background 定时程序，会从页面发送请求到这里执行
  if (request.type === 'MESSAGE_DEALING') {
    const { body } = request.data;
    console.log('Sending request to LLM:', body);
    analyzeMessagesInBackground(
      body.data,
      body.username,
      body.isScheduledTask,
    ).then((raw) => {
      sendResponse(raw);
    });
    return true;
  }

  // 处理Google Slides项目分析请求
  if (request.type === 'ANALYZE_PROJECT') {
    console.log(
      '处理单个项目分析请求:',
      request.data.request?.project_data?.project?.name,
      request.data,
    );
    const { request: projectRequest, config, context } = request.data;

    const agent = new IntelligentAgent();
    agent
      .analyze(projectRequest, config, context)
      .then((result: ProjectAnalysisResult) => {
        console.log('单个项目分析结果:', result);
        sendResponse(result);
      })
      .catch((error: Error) => {
        console.error('单个项目分析失败:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  // 获取任务调度状态
  if (request.type === 'GET_TASK_SCHEDULER_STATUS') {
    (async () => {
      try {
        await taskScheduler.startAllTasks();
        const status = await taskScheduler.getTaskStatusFreshResult();
        sendResponse({
          success: true,
          tasks: status.tasks,
          refreshReceipt: status.refreshReceipt,
        });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 控制特定任务
  if (request.type === 'CONTROL_TASK') {
    const { taskId, action } = request;

    (async () => {
      try {
        if (action === 'toggle') {
          const success = await taskScheduler.toggleTask(
            taskId,
            request.enabled,
          );
          sendResponse({
            success,
            message: success ? '任务状态已更新' : '任务控制失败',
            error: success ? undefined : `任务控制失败: ${taskId}`,
          });
        } else if (action === 'run') {
          const result = await taskScheduler.runTaskManuallyWithResult(taskId);
          sendResponse({
            success: result.success,
            message: result.skipped
              ? result.error || '任务已跳过'
              : result.success
              ? '任务执行成功'
              : result.error || '任务执行失败',
            error:
              result.success || result.skipped
                ? undefined
                : result.error || '任务执行失败',
            skipped: result.skipped,
          });
        } else if (action === 'repair') {
          const success = await taskScheduler.repairTaskSchedule(taskId);
          sendResponse({
            success,
            message: success ? '任务排程已修复' : '任务排程修复失败',
            error: success ? undefined : `任务排程修复失败: ${taskId}`,
          });
        } else {
          sendResponse({
            success: false,
            error: `不支持的任务操作: ${action}`,
          });
        }
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.type === 'KNOWLEDGE_QUERY') {
    const client = getMemoryServiceClient();
    client
      .ask(request.question)
      .then((result) => {
        console.log('General query result:', result);
        // Adapt AskResponse { answer, evidence, queryTimeMs } to legacy format
        sendResponse({
          success: true,
          answer: result.answer,
          evidence: result.evidence || [],
          queryTimeMs: result.queryTimeMs,
        });
      })
      .catch((error) => {
        console.error('Knowledge query failed:', error);
        sendResponse({
          success: false,
          message: error.message || 'Query failed',
        });
      });
    return true;
  }

  // 更新环境配置
  if (request.type === 'UPDATE_ENV_CONFIG') {
    const config = request.config as {
      CONCERNED_ITEMS_DIGEST_HOUR?: number;
      MEMORY_SERVICE_BASE_URL?: string;
      MEMORY_SERVICE_API_KEY?: string;
      MEMORY_SERVICE_TIMEOUT?: number;
      ROADMAP_BASE_URL?: string;
    };
    chrome.storage.local.set({ envConfig: request.config });
    console.log('Updated environment config:', request.config);
    invalidateFollowupAskSetupCache();
    updateConcernedItemsDigestTaskSchedule(
      normalizeConcernedItemsDigestHour(config?.CONCERNED_ITEMS_DIGEST_HOUR, 8),
    );
    // 同步 MemoryServiceClient 配置（从 envConfig 读取，此处做运行时更新）
    (async () => {
      try {
        const { getMemoryServiceClient } = await import(
          './services/MemoryServiceClient'
        );
        const client = getMemoryServiceClient();
        if (config?.MEMORY_SERVICE_BASE_URL)
          client.setBaseUrl(config.MEMORY_SERVICE_BASE_URL);
        if (config?.MEMORY_SERVICE_API_KEY !== undefined)
          client.setApiKey(config.MEMORY_SERVICE_API_KEY || undefined);
        if (config?.MEMORY_SERVICE_TIMEOUT !== undefined)
          client.setTimeout(Number(config.MEMORY_SERVICE_TIMEOUT));
      } catch (e) {
        console.warn('MemoryServiceClient config sync:', e);
      }
      try {
        await syncRoadmapContentScript(
          config?.ROADMAP_BASE_URL ?? request.config?.ROADMAP_BASE_URL,
        );
      } catch (e) {
        console.warn('[pai-roadmap] content script sync failed', e);
      }
      sendResponse({ success: true });
    })();
    return true;
  }

  // Offscreen / 部分页面无 chrome.storage：由 service worker 代读 envConfig
  if (request.type === 'PERSONAL_AI_GET_ENV_CONFIG') {
    (async () => {
      try {
        const envConfig = await getEnvConfig();
        sendResponse({ success: true, envConfig });
      } catch (error) {
        sendResponse({
          success: false,
          error: String((error as Error)?.message || error),
        });
      }
    })();
    return true;
  }

  if (request.type === JIRA_COOKIE_AUTH_GUARD_MESSAGE) {
    (async () => {
      try {
        await assertJiraCookieAuthAllowed(request.requestLabel);
        sendResponse({ allowed: true });
      } catch (error: any) {
        sendResponse({
          allowed: false,
          reason: error?.message || 'Jira cookie auth is not safe right now.',
        });
      }
    })();
    return true;
  }

  // 非 Jira 站点的内容脚本（如 roadmap 页面）受宿主 CORS 限制，由 SW 代发
  if (request.type === JIRA_PROXY_FETCH_MESSAGE) {
    (async () => {
      const result = await handleJiraProxyFetch(request);
      if (!result.success) {
        console.warn('[jira-proxy] request failed', {
          url: request.url,
          label: request.requestLabel,
          error: result.error,
        });
      }
      sendResponse(result);
    })();
    return true;
  }

  if (request.type === JIRA_SYNC_XSRF_TOKEN_ALL_MESSAGE) {
    (async () => {
      await notifyJiraIssuePagesToSyncXsrf();
      sendResponse({ success: true });
    })();
    return true;
  }

  // 离屏嵌入已废弃 — 后端 memory-service 处理嵌入生成

  // 处理 Jira tickets 获取
  if (request.type === 'FETCH_JIRA_TICKETS') {
    const { jql, requestId } = request;
    FETCH_JIRA_TICKETS(jql, requestId, sender.tab?.id);
    return true; // 保持消息通道开放
  }

  // 获取单个 Jira ticket 的详细信息（用于消息中的 Jira 链接预览）
  if (request.type === 'FETCH_JIRA_TICKET_DETAIL') {
    (async () => {
      const { ticketKey } = request;
      console.log(`📋 获取 Jira Ticket 详情: ${ticketKey}`);
      const result = await getTicketDetail(ticketKey);
      sendResponse(result);
    })();
    return true; // 保持消息通道开放
  }

  if (request.type === 'FETCH_JIRA_MEMORY_FRESHNESS_FIELDS') {
    (async () => {
      const ticketKey = String(request.ticketKey || '').trim();
      if (!/^[A-Z][A-Z0-9]+-\d+$/i.test(ticketKey)) {
        sendResponse({ success: false, error: 'invalid Jira ticket key' });
        return;
      }
      sendResponse(await getJiraMemoryFreshnessFields(ticketKey.toUpperCase()));
    })();
    return true;
  }

  // 获取 DORA Metrics Rollout Date（避免 CORS 问题）
  if (request.type === 'FETCH_ROLLOUT_DATE') {
    (async () => {
      const { fixVersion } = request;
      console.log(`📊 获取 Rollout Date: ${fixVersion}`);
      try {
        const url = `https://rcv-dora-metrics.int.rclabenv.com/api/releases/${encodeURIComponent(
          fixVersion,
        )}/lead-time`;
        const response = await fetch(url, { method: 'GET' });
        if (!response.ok) {
          sendResponse({ success: false, data: null });
          return;
        }
        const data = await response.json();
        const rolloutDate = data.metrics?.lastMrMergedTimestamp || null;
        sendResponse({ success: true, data: rolloutDate });
      } catch (error) {
        console.error('获取 Rollout Date 失败:', error);
        sendResponse({ success: false, data: null });
      }
    })();
    return true; // 保持消息通道开放
  }

  // 获取当前标签页 URL
  if (request.type === 'GET_CURRENT_TAB_URL') {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      sendResponse({ url: tab?.url });
    });
    return true; // 保持消息通道开放
  }

  if (
    request.type === 'OPEN_GLIP_POPUP_WINDOW' ||
    request.type === 'OPEN_GLIP_TEMP_WINDOW'
  ) {
    (async () => {
      try {
        const { url, width, height, focused } = request.data || {};
        if (!url) {
          throw new Error('glip_popup_url_missing');
        }

        const popupInfo = await openGlipPopupWindow(url, {
          width,
          height,
          focused,
        });

        sendResponse({
          success: true,
          ...popupInfo,
        });
      } catch (error: any) {
        console.error('❌ 打开 Glip popup window 失败:', error);
        sendResponse({
          success: false,
          error: error?.message || 'open_glip_popup_failed',
        });
      }
    })();
    return true;
  }

  // 处理分析幻灯片项目的请求
  if (request.type === 'REQUEST_SLIDES_ANALYSIS' && sender.tab?.id) {
    handleSlideAnalysisRequest(sender.tab.id);
    return true;
  }

  // 数据迁移功能已移除，使用新的记忆系统
  if (request.type === 'MIGRATE_DATA_TO_GRAPH') {
    sendResponse({
      success: false,
      error: '数据迁移功能已弃用，请使用新的记忆系统进行数据管理',
    });
    return true;
  }

  // 处理存储健康检查请求
  if (request.type === 'GET_STORAGE_HEALTH') {
    const client = getMemoryServiceClient();
    client
      .getHealth()
      .then((healthStatus) =>
        sendResponse({
          success: true,
          healthMetrics: healthStatus,
        }),
      )
      .catch((error) =>
        sendResponse({
          success: false,
          error: error.message,
        }),
      );
    return true;
  }

  // 处理维护任务执行请求
  // Note: The new Memory Service backend handles maintenance internally.
  // This handler is kept for backward compatibility but no longer triggers maintenance directly.
  if (request.type === 'RUN_MAINTENANCE_TASK') {
    const client = getMemoryServiceClient();
    client
      .getHealth()
      .then((healthStatus) =>
        sendResponse({
          success: true,
          data: { success: true, healthStatus },
          message: '维护任务由后端服务自动管理',
        }),
      )
      .catch((error) =>
        sendResponse({
          success: false,
          error: error.message,
        }),
      );
    return true;
  }

  // Roadmap content script → memory-service (avoid host-page CORS)
  if (request.type === ROADMAP_MEMORY_REQUEST) {
    (async () => {
      try {
        const method = String(request.method || '') as RoadmapMemoryMethod;
        const args = Array.isArray(request.args) ? request.args : [];
        const client = getMemoryServiceClient();
        let data: unknown;
        switch (method) {
          case 'getMemoryProjectCandidates':
            data = await client.getMemoryProjectCandidates();
            break;
          case 'getProjectDriftReceipts':
            data = await client.getProjectDriftReceipts(
              args[0] as string | undefined,
            );
            break;
          case 'resolveProjectDriftReceipt':
            data = await client.resolveProjectDriftReceipt(
              (args[0] || {}) as {
                id?: string;
                status?: 'accepted' | 'ignored' | 'converged';
                barTargetEnd?: string;
                projectId?: string;
              },
            );
            break;
          case 'syncFocusProjects':
            data = await client.syncFocusProjects(
              args[0] as {
                teamId: string;
                teamName?: string;
                items: Array<Record<string, unknown>>;
                syncedAt: number;
              },
            );
            break;
          case 'getRuntimeConfig':
            data = await client.getRuntimeConfig();
            break;
          case 'getAgentTaskRuntimeStatus':
            data = await client.getAgentTaskRuntimeStatus(
              args[0] as string[] | undefined,
              args[1] as number | undefined,
            );
            break;
          case 'executeAgentTask':
            data = await client.executeAgentTask(
              args[0] as {
                taskId: string;
                title?: string;
                task: string;
                mode?: 'read' | 'write';
                executor?: string;
                notify?: boolean;
                idempotencyKey?: string;
                triggerSource?: string;
                timeoutMs?: number;
              },
            );
            break;
          default:
            sendResponse({
              success: false,
              error: `unsupported_roadmap_memory_method:${method}`,
            });
            return;
        }
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return true;
  }

  // Passive context recall: proxy request to memory-service /context-recall
  if (request.type === 'CONTEXT_RECALL_REQUEST') {
    (async () => {
      try {
        const [envConfig, uiPreferences, identityStorage] = await Promise.all([
          getEnvConfig(),
          readExtensionUiPreferences(),
          chrome.storage.local.get(['userinfo']),
        ]);
        const contextRequest = {
          ...(request.request || {}),
          sourceTypes: filterSceneRehearsalSourceTypes(
            request.request?.sourceTypes,
            envConfig,
            DEFAULT_RECALL_SOURCE_TYPES_WITHOUT_REHEARSAL,
          ),
        };
        const cacheKey = buildSessionRequestCacheKey('context-recall-v1', {
          request: contextRequest,
          uiLanguage: uiPreferences.language,
          memoryServiceBaseUrl: envConfig.MEMORY_SERVICE_BASE_URL,
          userIdentity: {
            id: identityStorage?.userinfo?.id,
            username: identityStorage?.userinfo?.username,
            email: identityStorage?.userinfo?.email,
          },
        });
        // Session reuse is for passive scene projection. A selected-text query
        // is an explicit user action; repeating the same selection should
        // re-read current memory state instead of silently replaying a prior
        // result from the passive background cache.
        const cacheable =
          !contextRequest.debug && contextRequest.contextType !== 'selected_text';

        await ensureContextRecallBackgroundCacheLoaded();
        const cached = cacheable
          ? contextRecallBackgroundCache.get(cacheKey)
          : undefined;
        if (cached) {
          sendResponse({ ...cached, requestReuse: 'cache_hit' });
          return;
        }

        const existing = contextRecallBackgroundInFlight.get(cacheKey);
        const responsePromise =
          existing ||
          (async () => {
            try {
              const result = await getMemoryServiceClient().contextRecall(
                contextRequest,
              );
              const response = {
                success: true,
                uiLanguage: uiPreferences.language,
                topMatch: result.topMatch,
                matches: result.matches,
                scopeReceipt: result.scopeReceipt,
                cohesionReceipt: result.cohesionReceipt,
                attributionReceipt: result.attributionReceipt,
                changeProjections: result.changeProjections,
                autopilot: result.autopilot,
                keystoneBrief: result.keystoneBrief,
                debug: result.debug,
                queryTimeMs: result.queryTimeMs,
              };
              if (cacheable) {
                contextRecallBackgroundCache.set(cacheKey, response);
                await persistBackgroundSessionCache(
                  CONTEXT_RECALL_BACKGROUND_CACHE_STORAGE_KEY,
                  contextRecallBackgroundCache,
                );
              }
              return response;
            } finally {
              contextRecallBackgroundInFlight.delete(cacheKey);
            }
          })();

        if (!existing) {
          contextRecallBackgroundInFlight.set(cacheKey, responsePromise);
        }
        const response = await responsePromise;
        sendResponse({
          ...response,
          requestReuse: existing ? 'joined_inflight' : 'backend_request',
        });
      } catch (err) {
        console.warn('[background] context-recall failed:', err);
        sendResponse({ success: true, topMatch: null, matches: [] });
      }
    })();
    return true;
  }

  if (request.type === 'MEMORY_CLAIM_CORRECTION') {
    (async () => {
      try {
        const claimId = String(request.claimId || '').trim();
        if (!claimId) throw new Error('claimId is required');
        const result = await getMemoryServiceClient().correctMemoryClaim(
          claimId,
          request.correction,
        );
        sendResponse({ success: true, result });
      } catch (err) {
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return true;
  }

  if (request.type === 'CONTEXT_RECALL_FEEDBACK') {
    (async () => {
      try {
        const feedback = request.feedback || {};
        const targetId = String(feedback.targetId || '').trim();
        const targetType = feedback.targetType;
        const action = feedback.action === 'positive' ? 'positive' : 'negative';
        const allowedTargetTypes = new Set([
          'message',
          'chunk',
          'entity',
          'rehearsal',
          'source_memory',
        ]);
        if (!targetId || !allowedTargetTypes.has(targetType)) {
          sendResponse({ success: false, error: 'invalid_feedback_target' });
          return;
        }

        const detail =
          typeof feedback.detail === 'string'
            ? feedback.detail.slice(0, 1200)
            : undefined;
        const client = getMemoryServiceClient();
        if (targetType === 'rehearsal') {
          const activationId =
            typeof feedback.rehearsalActivationId === 'string'
              ? feedback.rehearsalActivationId.slice(0, 200)
              : undefined;
          const result = await client.submitRehearsalFeedback(targetId, {
            outcome: action === 'positive' ? 'accepted' : 'irrelevant',
            activationId,
            note: detail,
          });
          sendResponse({ success: true, result });
          return;
        }

        const result = await client.submitFeedback({
          type: 'recall_quality',
          targetId,
          targetType,
          action,
          detail,
        });
        sendResponse({ success: true, result });
      } catch (err) {
        console.warn('[background] context-recall feedback failed:', err);
        sendResponse({
          success: false,
          error: String((err as Error)?.message || err),
        });
      }
    })();
    return true;
  }

  if (request.type === 'KEYSTONE_BRIEF_EVENT') {
    (async () => {
      try {
        const briefId = String(request.briefId || '').trim();
        const event = request.event || {};
        const allowedEventTypes = new Set([
          'shown',
          'opened',
          'evidence_opened',
          'copied',
          'useful',
          'hidden',
          'not_accurate',
          'used_in_ask',
          'used_by_compiler',
        ]);
        if (!briefId || !allowedEventTypes.has(event.eventType)) {
          sendResponse({ success: false, error: 'invalid_keystone_brief_event' });
          return;
        }
        const client = getMemoryServiceClient();
        const result = await client.recordKeystoneBriefEvent(briefId, {
          eventType: event.eventType,
          surface: typeof event.surface === 'string' ? event.surface : undefined,
          context:
            event.context && typeof event.context === 'object'
              ? event.context
              : undefined,
          reason: typeof event.reason === 'string' ? event.reason.slice(0, 400) : undefined,
          detail: typeof event.detail === 'string' ? event.detail.slice(0, 1200) : undefined,
        });
        sendResponse({ success: true, result });
      } catch (err) {
        console.warn('[background] keystone brief event failed:', err);
        sendResponse({
          success: false,
          error: String((err as Error)?.message || err),
        });
      }
    })();
    return true;
  }

  if (request.type === 'MEMORY_CAPTURE_SCORE_SELECTION') {
    (async () => {
      try {
        const client = getMemoryServiceClient();
        const result = await client.scoreSourceMemorySelection(request.request || {});
        sendResponse({ success: true, result });
      } catch (err) {
        console.warn('[background] memory-capture selection score failed:', err);
        sendResponse({
          success: false,
          error: String((err as Error)?.message || err),
        });
      }
    })();
    return true;
  }

  if (request.type === 'MEMORY_CAPTURE_SCORE_PAGE') {
    (async () => {
      try {
        const client = getMemoryServiceClient();
        const result = await client.scoreSourceMemoryCandidate({
          ...(request.request || {}),
          sourceKind: request.request?.sourceKind || 'webpage',
        });
        sendResponse({ success: true, result });
      } catch (err) {
        console.warn('[background] memory-capture page score failed:', err);
        sendResponse({
          success: false,
          error: String((err as Error)?.message || err),
        });
      }
    })();
    return true;
  }

  if (request.type === 'MEMORY_CAPTURE_SAVE_SELECTION') {
    (async () => {
      try {
        const client = getMemoryServiceClient();
        const result = await client.createSourceMemoryCapsule({
          ...(request.request || {}),
          sourceKind: request.request?.sourceKind || 'selection',
          captureMode: request.request?.captureMode || 'manual',
          captureReason:
            request.request?.captureReason || '用户点击右侧半露出 + 记住按钮',
          interactions: {
            ...(request.request?.interactions || {}),
            selectedText: true,
            manualClick: true,
          },
        });
        sendResponse({ success: true, result });
      } catch (err) {
        console.warn('[background] memory-capture selection save failed:', err);
        sendResponse({
          success: false,
          error: String((err as Error)?.message || err),
        });
      }
    })();
    return true;
  }

  if (request.type === 'MEMORY_CAPTURE_SAVE_PAGE') {
    (async () => {
      try {
        const client = getMemoryServiceClient();
        const captureMode = request.request?.captureMode || 'manual';
        const result = await client.createSourceMemoryCapsule({
          ...(request.request || {}),
          sourceKind: request.request?.sourceKind || 'webpage',
          captureMode,
          captureReason:
            request.request?.captureReason || '用户点击右侧半露出 + 记住当前页面',
          interactions: {
            ...(request.request?.interactions || {}),
            manualClick:
              captureMode === 'manual' ||
              Boolean(request.request?.interactions?.manualClick),
          },
        });
        sendResponse({ success: true, result });
      } catch (err) {
        console.warn('[background] memory-capture page save failed:', err);
        sendResponse({
          success: false,
          error: String((err as Error)?.message || err),
        });
      }
    })();
    return true;
  }

  if (request.type === 'MEMORY_CAPTURE_DISMISS_CAPSULE') {
    (async () => {
      try {
        const capsuleId = String(request.capsuleId || '').trim();
        if (!capsuleId) {
          sendResponse({ success: false, error: 'Missing capsule id' });
          return;
        }
        const client = getMemoryServiceClient();
        const result = await client.dismissSourceMemoryCapsule(
          capsuleId,
          request.reason || '用户撤销入库',
        );
        sendResponse({ success: true, result });
      } catch (err) {
        console.warn('[background] memory-capture dismiss failed:', err);
        sendResponse({
          success: false,
          error: String((err as Error)?.message || err),
        });
      }
    })();
    return true;
  }

  if (request.type === 'MEMORY_CAPTURE_UPDATE_CAPSULE_NOTE') {
    (async () => {
      try {
        const capsuleId = String(request.capsuleId || '').trim();
        if (!capsuleId) {
          sendResponse({ success: false, error: 'Missing capsule id' });
          return;
        }
        const client = getMemoryServiceClient();
        const result = await client.updateSourceMemoryCapsuleNote(
          capsuleId,
          String(request.note || ''),
        );
        sendResponse({ success: true, result });
      } catch (err) {
        console.warn('[background] memory-capture note update failed:', err);
        sendResponse({
          success: false,
          error: String((err as Error)?.message || err),
        });
      }
    })();
    return true;
  }

  if (request.type === 'OWNER_AUTHORED_LEARNING_SIGNAL') {
    (async () => {
      try {
        const envConfig = await getEnvConfig();
        if (envConfig.OWNER_SPEECH_LEARNING_ENABLED === false) {
          sendResponse({ success: true, stored: 0, disabled: true });
          return;
        }
        const payloads = (
          Array.isArray(request.payloads) ? request.payloads : []
        ) as IngestPayload[];
        const safePayloads = payloads.filter(
          (payload) =>
            payload &&
            payload.sourceType === 'jira' &&
            payload.metadata?.authorRole === 'owner' &&
            payload.metadata?.isSelf === true &&
            payload.metadata?.issueKey &&
            payload.metadata?.commentId &&
            payload.metadata?.sourceUrl,
        );
        if (!safePayloads.length) {
          sendResponse({ success: true, stored: 0 });
          return;
        }
        const client = getMemoryServiceClient();
        if (safePayloads.length === 1) {
          await client.ingest(safePayloads[0]);
        } else {
          await client.ingestBatch(safePayloads);
        }
        let captured = 0;
        for (const payload of safePayloads) {
          try {
            await client.createSourceMemoryCapsule({
              sourceKind: 'jira_comment',
              sourceUrl: payload.sourceUrl,
              sourceTitle: payload.sourceTitle || payload.metadata?.issueKey,
              text: payload.content,
              scope: payload.scope,
              captureMode: 'auto',
              captureReason: '用户在 Jira 对外发布的评论',
              interactions: {
                ownerAuthored: true,
              },
              metadata: {
                ...(payload.metadata || {}),
                captureSource: 'owner_authored_learning_signal',
              },
            });
            captured += 1;
          } catch (captureError) {
            console.warn(
              '[background] owner-authored memory capture skipped:',
              captureError,
            );
          }
        }
        sendResponse({ success: true, stored: safePayloads.length, captured });
      } catch (err) {
        console.warn(
          '[background] owner-authored learning ingest failed:',
          err,
        );
        sendResponse({
          success: false,
          error: String((err as Error)?.message || err),
        });
      }
    })();
    return true;
  }

  // Composer Guard: user-approved context insertion for native page composers.
  if (request.type === 'COMPOSER_ASSIST_REQUEST') {
    (async () => {
      try {
        const envConfig = await getEnvConfig();
        const assistIntent =
          request.request?.assistIntent === 'draft_refine'
            ? 'draft_refine'
            : request.request?.assistIntent === 'draft_compose'
              ? 'draft_compose'
              : null;
        if (
          !isComposerAssistEnabledFromConfig(
            envConfig as unknown as Record<string, unknown>,
          ) ||
          (assistIntent &&
            !isComposerAssistIntentEnabledFromConfig(
              assistIntent,
              envConfig as unknown as Record<string, unknown>,
            ))
        ) {
          sendResponse({
            success: true,
            result: buildComposerAssistDisabledResponse(
              Boolean(request.request?.debug),
            ),
          });
          return;
        }
        const client = getMemoryServiceClient();
        const result = await client.composerAssist({
          ...(request.request || {}),
          sourceTypes: filterSceneRehearsalSourceTypes(
            request.request?.sourceTypes,
            envConfig,
            DEFAULT_RECALL_SOURCE_TYPES_WITHOUT_REHEARSAL,
          ),
        });
        sendResponse({ success: true, result });
      } catch (err: any) {
        console.warn('[background] composer-assist failed:', err);
        sendResponse({
          success: false,
          error: err?.message || 'composer_assist_failed',
        });
      }
    })();
    return true;
  }

  if (request.type === 'AMBIENT_CALIBRATION_TRACE') {
    (async () => {
      try {
        const client = getMemoryServiceClient();
        const result = await client.submitAmbientCalibrationTrace(
          request.trace || {},
        );
        sendResponse({ success: true, result });
      } catch (err: any) {
        console.warn('[background] ambient calibration trace failed:', err);
        sendResponse({
          success: false,
          error: err?.message || 'ambient_calibration_trace_failed',
        });
      }
    })();
    return true;
  }

  if (request.type === 'CONTEXT_ASSIST_REQUEST') {
    (async () => {
      try {
        const envConfig = await getEnvConfig();
        const client = getMemoryServiceClient();
        const result = await client.contextAssist({
          ...(request.request || {}),
          sourceTypes: filterSceneRehearsalSourceTypes(
            request.request?.sourceTypes,
            envConfig,
            DEFAULT_RECALL_SOURCE_TYPES_WITHOUT_REHEARSAL,
          ),
        });
        sendResponse({ success: true, result });
      } catch (err: any) {
        console.warn('[background] context-assist failed:', err);
        sendResponse({
          success: false,
          error: err?.message || 'context_assist_failed',
        });
      }
    })();
    return true;
  }

  if (request.type === 'TODAY_PILOT_MEETING_PREP_REQUEST') {
    (async () => {
      try {
        const envConfig = await getEnvConfig();
        const client = getMemoryServiceClient();
        const result = await client.resolveTodayPilotMeetingPrep(
          {
            ...(request.request || {}),
            sourceTypes: filterSceneRehearsalSourceTypes(
              request.request?.sourceTypes,
              envConfig,
              DEFAULT_RECALL_SOURCE_TYPES_WITHOUT_REHEARSAL,
            ),
          },
        );
        sendResponse({ success: true, result });
      } catch (err: any) {
        console.warn('[background] today-pilot meeting-prep failed:', err);
        sendResponse({
          success: false,
          error: err?.message || 'today_pilot_meeting_prep_failed',
        });
      }
    })();
    return true;
  }

  if (request.type === 'TODAY_PILOT_PREPARE_MEETINGS_REQUEST') {
    (async () => {
      try {
        const client = getMemoryServiceClient();
        const result = await client.prepareTodayPilotMeetingPreps(
          request.request || {},
        );
        sendResponse({ success: true, result });
      } catch (err: any) {
        console.warn('[background] today-pilot prepare-meetings failed:', err);
        sendResponse({
          success: false,
          error: err?.message || 'today_pilot_prepare_meetings_failed',
        });
      }
    })();
    return true;
  }

  if (request.type === 'CALENDAR_EVENTS_SYNC_REQUEST') {
    (async () => {
      try {
        const result = await syncCalendarEventsToMemoryService(
          getMemoryServiceClient(),
          request.sourceSystem,
          request.events || [],
        );
        sendResponse({ success: true, result });
      } catch (err: any) {
        console.warn('[background] calendar sync failed:', err);
        sendResponse({
          success: false,
          error: err?.message || 'calendar_sync_failed',
        });
      }
    })();
    return true;
  }

  if (request.type === 'OUTLOOK_CALENDAR_STATUS') {
    getOutlookCalendarStatus()
      .then((result) => sendResponse({ success: true, result }))
      .catch((err) =>
        sendResponse({
          success: false,
          error: err?.message || 'outlook_status_failed',
        }),
      );
    return true;
  }

  if (request.type === 'OUTLOOK_CALENDAR_CONNECT') {
    (async () => {
      try {
        const envConfig = request.config || (await getEnvConfig());
        const result = await connectOutlookCalendar(envConfig);
        sendResponse({ success: true, result });
      } catch (err: any) {
        sendResponse({
          success: false,
          error: err?.message || 'outlook_connect_failed',
        });
      }
    })();
    return true;
  }

  if (request.type === 'OUTLOOK_CALENDAR_DISCONNECT') {
    disconnectOutlookCalendar()
      .then((result) => sendResponse({ success: true, result }))
      .catch((err) =>
        sendResponse({
          success: false,
          error: err?.message || 'outlook_disconnect_failed',
        }),
      );
    return true;
  }

  if (request.type === 'OUTLOOK_CALENDAR_SYNC_NOW') {
    (async () => {
      try {
        const envConfig = request.config || (await getEnvConfig());
        const result = await syncOutlookCalendarToMemoryService(
          getMemoryServiceClient(),
          envConfig,
        );
        sendResponse({ success: true, result });
      } catch (err: any) {
        sendResponse({
          success: false,
          error: err?.message || 'outlook_sync_failed',
        });
      }
    })();
    return true;
  }

  // 🆕 处理用户画像相关请求
  const userProfileHandled = UserProfileMessageHandler.handleMessage(
    request,
    sender,
    sendResponse,
  );
  if (userProfileHandled) {
    return true;
  }

  // 记忆界面相关消息处理
  const memoryResult = handleMemoryMessage(request);
  if (memoryResult !== null) {
    // 是记忆相关消息，处理异步结果
    memoryResult
      .then((response) => sendResponse(response))
      .catch((error) => {
        console.error('记忆消息处理失败:', error);
        sendResponse({
          success: false,
          error: error.message,
        });
      });
    return true; // 保持消息通道开放
  }

  // 处理智能网页分析请求
  if (request.type === 'WEB_INTELLIGENCE_ANALYSIS') {
    (async () => {
      try {
        const pageContent = request.pageContent || {};
        const input = {
          title: String(pageContent.title || ''),
          url: String(pageContent.url || ''),
          domain: String(pageContent.domain || ''),
          mainContent: String(pageContent.mainContent || ''),
          wordCount: Number(pageContent.wordCount || 0),
        };
        if (!input.url || input.mainContent.trim().length < 120) {
          sendResponse({
            success: true,
            processed: false,
            stored: false,
            reason: 'insufficient_page_content',
          });
          return;
        }

        const analysisKey = String(
          request.analysisKey || buildPassiveWebpageAnalysisKey(input),
        );
        const cacheKey = buildSessionRequestCacheKey('webpage-analysis-v2', {
          analysisKey,
          promptVersion: PASSIVE_WEBPAGE_ANALYSIS_PROMPT_VERSION,
          provider: 'memory_service',
          model: 'backend_configured',
        });
        const force = Boolean(request.force);
        const triggerSource =
          request.triggerSource === 'manual'
            ? 'manual'
            : 'memory_capture_candidate';

        await Promise.all([
          ensureWebpageAnalysisBackgroundCacheLoaded(),
          ensureWebpageAnalysisFailureBackoffLoaded(),
        ]);
        const cached = force
          ? undefined
          : webpageAnalysisBackgroundCache.get(cacheKey);
        if (cached) {
          sendResponse({
            success: true,
            processed: cached.decision !== 'skip',
            analyzed: true,
            stored: false,
            storageBoundary: 'memory_capture_contract_only',
            requestReuse: 'cache_hit',
            triggerSource,
            analysisKey,
            result: cached,
          });
          return;
        }

        const failureCooldown = force
          ? undefined
          : webpageAnalysisFailureBackoff.getCooldown(cacheKey);
        if (failureCooldown) {
          sendResponse({
            success: false,
            stored: false,
            error: 'passive_webpage_analysis_cooldown',
            errorKind: failureCooldown.errorKind,
            retryAfterMs: Math.max(0, failureCooldown.retryAfter - Date.now()),
            requestReuse: 'failure_cooldown',
            triggerSource,
            analysisKey,
          });
          return;
        }

        const existing = webpageAnalysisBackgroundInFlight.get(cacheKey);
        const resultPromise =
          existing ||
          (async () => {
            try {
              const response = await getMemoryServiceClient()
                .analyzeSourceMemoryWebpage(input);
              if (
                response.promptVersion !==
                PASSIVE_WEBPAGE_ANALYSIS_PROMPT_VERSION
              ) {
                throw new Error('passive_webpage_analysis_prompt_version_mismatch');
              }
              const result = normalizePassiveWebpageAnalysisResult(
                response.result,
                input.mainContent,
              );
              webpageAnalysisBackgroundCache.set(cacheKey, result, {
                ttlMs:
                  result.decision === 'skip'
                    ? WEBPAGE_ANALYSIS_SKIP_CACHE_TTL_MS
                    : WEBPAGE_ANALYSIS_RESULT_CACHE_TTL_MS,
              });
              await persistBackgroundSessionCache(
                WEBPAGE_ANALYSIS_BACKGROUND_CACHE_STORAGE_KEY,
                webpageAnalysisBackgroundCache,
              );
              if (webpageAnalysisFailureBackoff.clear(cacheKey)) {
                await persistWebpageAnalysisFailureBackoff();
              }
              return result;
            } catch (error) {
              webpageAnalysisFailureBackoff.recordFailure(
                cacheKey,
                classifyWebpageAnalysisFailure(error),
              );
              await persistWebpageAnalysisFailureBackoff();
              throw error;
            } finally {
              webpageAnalysisBackgroundInFlight.delete(cacheKey);
            }
          })();

        if (!existing) {
          webpageAnalysisBackgroundInFlight.set(cacheKey, resultPromise);
        }
        const result = await resultPromise;
        console.log('✅ 网页候选已完成单次聚焦分析:', {
          url: input.url,
          decision: result.decision,
          confidence: result.confidence,
          requestReuse: existing ? 'joined_inflight' : 'model_run',
          triggerSource,
        });
        sendResponse({
          success: true,
          processed: result.decision !== 'skip',
          analyzed: true,
          stored: false,
          storageBoundary: 'memory_capture_contract_only',
          requestReuse: existing ? 'joined_inflight' : 'model_run',
          triggerSource,
          analysisKey,
          result,
        });
      } catch (error) {
        console.error('❌ 单次网页分析失败:', error);
        sendResponse({
          success: false,
          stored: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    return true; // 保持消息通道开放
  }

  // 获取智能网页分析统计
  if (request.type === 'GET_WEB_INTELLIGENCE_STATS') {
    try {
      const integrator = getWebIntelligenceIntegrator();
      const stats = integrator.getSystemStats();
      const componentStatus = integrator.getComponentStatus();

      sendResponse({
        success: true,
        stats,
        componentStatus,
      });
    } catch (error) {
      console.error('❌ 获取智能分析统计失败:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  // 智能网页分析健康检查
  if (request.type === 'WEB_INTELLIGENCE_HEALTH_CHECK') {
    try {
      const integrator = getWebIntelligenceIntegrator();
      integrator
        .healthCheck()
        .then((healthStatus) =>
          sendResponse({
            success: true,
            health: healthStatus,
          }),
        )
        .catch((error) =>
          sendResponse({
            success: false,
            error: error.message,
          }),
        );
    } catch (error) {
      console.error('❌ 智能分析健康检查失败:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  // 使用仪表盘消息处理器处理项目相关消息
  if (
    request.type === 'GET_PROJECT_DATA' ||
    request.type === 'UPDATE_PROJECT_ITEM' ||
    request.type === 'QUICK_ACTION' ||
    request.type === 'ADD_PROJECT' ||
    request.type === 'SUGGEST_PROJECTS' ||
    request.type === 'ADD_PROJECT_ITEM' ||
    request.type === 'IMPORT_PROJECT_REPORT'
  ) {
    console.log('📊 仪表盘消息处理开始:', {
      type: request.type,
      projectId: request.projectId,
      timestamp: new Date().toISOString(),
      sender: sender.tab?.url || 'extension',
      request: request,
    });

    (async () => {
      try {
        const dashboardHandler = new DashboardMessageHandler();
        await dashboardHandler.handleMessage(request, sendResponse);
        console.log('✅ 仪表盘消息处理完成:', request.type);
      } catch (error) {
        console.error('❌ 仪表盘消息处理失败:', {
          type: request.type,
          error: error.message,
          stack: error.stack,
        });
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 深度分析网页内容
  if (request.type === 'DEEP_ANALYZE_WEB_CONTENT') {
    (async () => {
      try {
        const { pageContent, quickResult, userAction } = request.data;

        console.log('🔍 深度分析网页内容:', {
          url: pageContent.url,
          title: pageContent.title,
          userAction,
        });

        // 调用agentThinking进行深度分析
        const agent = new IntelligentAgent();
        const result = await agent.analyze(
          {
            type: 'webpage_deep',
            url: pageContent.url,
            title: pageContent.title,
            content: pageContent.mainContent,
            metadata: pageContent.metadata,
            quickAnalysis: quickResult,
            userAction,
          },
          {
            type: 'webpage',
            analysisDepth: 'deep',
          },
        );

        sendResponse({ success: true, result });
      } catch (error) {
        console.error('❌ 深度分析失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 快速保存网页内容
  if (request.type === 'QUICK_SAVE_WEB_CONTENT') {
    (async () => {
      try {
        const { pageContent, quickResult, userAction } = request.data;

        console.log('💾 快速保存网页内容:', {
          url: pageContent.url,
          title: pageContent.title,
          userAction,
        });

        // 轻量级保存，不进行深度分析
        const agent = new IntelligentAgent();
        const result = await agent.analyze(
          {
            type: 'webpage_quick_save',
            url: pageContent.url,
            title: pageContent.title,
            content: pageContent.mainContent,
            metadata: pageContent.metadata,
            quickAnalysis: quickResult,
            userAction,
          },
          {
            type: 'webpage',
            analysisDepth: 'quick',
          },
        );

        sendResponse({ success: true, result });
      } catch (error) {
        console.error('❌ 快速保存失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 记录分析结果
  if (request.type === 'RECORD_ANALYSIS_RESULT') {
    (async () => {
      try {
        const { url, result, timestamp } = request.data;

        // 记录到本地存储用于统计
        const analysisHistory = (await chrome.storage.local.get(
          'analysisHistory',
        )) || { analysisHistory: [] };
        analysisHistory.analysisHistory.push({
          url,
          result,
          timestamp,
        });

        // 保留最近100条记录
        if (analysisHistory.analysisHistory.length > 100) {
          analysisHistory.analysisHistory =
            analysisHistory.analysisHistory.slice(-100);
        }

        await chrome.storage.local.set({
          analysisHistory: analysisHistory.analysisHistory,
        });

        sendResponse({ success: true });
      } catch (error) {
        console.error('❌ 记录分析结果失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 记录用户行为
  if (request.type === 'RECORD_USER_ACTION') {
    (async () => {
      try {
        const { action, url, timestamp } = request.data;

        // 记录用户行为用于改进推荐
        const userActions = (await chrome.storage.local.get('userActions')) || {
          userActions: [],
        };
        userActions.userActions.push({
          action,
          url,
          timestamp,
        });

        // 保留最近500条记录
        if (userActions.userActions.length > 500) {
          userActions.userActions = userActions.userActions.slice(-500);
        }

        await chrome.storage.local.set({
          userActions: userActions.userActions,
        });

        sendResponse({ success: true });
      } catch (error) {
        console.error('❌ 记录用户行为失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 更新智能网页分析配置
  if (request.type === 'UPDATE_WEB_INTELLIGENCE_CONFIG') {
    try {
      const { config } = request;
      const integrator = getWebIntelligenceIntegrator();
      integrator.updateConfig(config);

      sendResponse({ success: true, message: '配置已更新' });
    } catch (error) {
      console.error('❌ 更新智能分析配置失败:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  // 重启智能网页分析组件
  if (request.type === 'RESTART_WEB_INTELLIGENCE_COMPONENT') {
    try {
      const { component } = request;
      const integrator = getWebIntelligenceIntegrator();
      integrator
        .restartComponent(component)
        .then((success) =>
          sendResponse({
            success,
            message: success
              ? `组件 ${component} 重启成功`
              : `组件 ${component} 重启失败`,
          }),
        )
        .catch((error) =>
          sendResponse({
            success: false,
            error: error.message,
          }),
        );
    } catch (error) {
      console.error('❌ 重启智能分析组件失败:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  // =====================================================
  // Jira Automation 导入 Scheduled Messages 功能
  // =====================================================

  // 转换 Jira Rule 的 trigger 为 incoming webhook
  if (request.type === 'CONVERT_JIRA_RULE_TO_WEBHOOK') {
    (async () => {
      try {
        const { ruleId, projectId, jiraUrl } = request.data;

        // 使用静态导入的 JiraAutomationService（避免 Service Worker 中动态导入问题）
        const service = new JiraAutomationService();

        // 获取项目 Key（使用统一的 jiraFetch，自动支持 token 和 cookie）
        const projectResponse = await jiraFetch(
          `${jiraUrl}/rest/api/2/project/${projectId}`,
        );
        const projectData = await projectResponse.json();
        const projectKey = projectData.key;

        const config = {
          jiraUrl,
          projectKey,
        };

        // 转换为 webhook trigger
        const webhookUrl = await service.convertToWebhookTrigger(
          config,
          ruleId,
        );

        sendResponse({ success: true, webhookUrl });
      } catch (error: any) {
        console.error('转换 Jira Rule 为 webhook 失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 将 Incoming Webhook Trigger 转换回 Scheduled Trigger（撤销托管）
  if (request.type === 'CONVERT_WEBHOOK_TO_SCHEDULED') {
    (async () => {
      try {
        const { ruleId, projectId, jiraUrl, scheduleConfig } = request.data;
        console.log(`🔄 将规则 ${ruleId} 的 trigger 转换回 scheduled...`);

        // 使用 JiraAutomationService
        const service = new JiraAutomationService();

        // 获取项目 Key（使用统一的 jiraFetch）
        const projectResponse = await jiraFetch(
          `${jiraUrl}/rest/api/2/project/${projectId}`,
        );
        const projectData = await projectResponse.json();
        const projectKey = projectData.key;

        const config = {
          jiraUrl,
          projectKey,
        };

        // 转换为 scheduled trigger
        await service.convertToScheduledTrigger(config, ruleId, scheduleConfig);

        sendResponse({ success: true });
      } catch (error: any) {
        console.error('转换 Jira Rule 为 scheduled 失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 添加 Scheduled Message（从 Jira Automation 页面调用）
  if (request.type === 'ADD_SCHEDULED_MESSAGE') {
    (async () => {
      try {
        console.log('📝 收到 ADD_SCHEDULED_MESSAGE 请求:', request.data);
        const messageData = request.data;

        // 获取配置和 token
        const result = await chrome.storage.local.get([
          'scheduledMessagesConfig',
        ]);
        const config = result.scheduledMessagesConfig;

        console.log('📋 Scheduled Messages 配置:', config);

        if (!config || !config.sheetId) {
          console.error('❌ 未配置 Scheduled Messages');
          sendResponse({
            success: false,
            error: '未配置 Scheduled Messages，请先在设置中初始化',
          });
          return;
        }

        // 获取 auth token（用户主动操作，可以弹窗）
        console.log('🔐 获取 Google 认证 token...');
        const token = await getGoogleAuthToken({
          caller: 'background.createScheduledMessage',
          scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
        });
        console.log('✅ Token 获取成功');

        // 使用静态导入的 ScheduledMessageService（避免 Service Worker 中动态导入问题）
        const service = new ScheduledMessageService(token);

        console.log('📤 创建消息:', messageData);
        // 创建消息
        const newMessage = await service.createMessage(messageData);

        console.log('✅ 消息创建成功:', newMessage);
        sendResponse({ success: true, message: newMessage });
      } catch (error: any) {
        console.error('❌ 添加 Scheduled Message 失败:', error);
        console.error('错误堆栈:', error.stack);
        sendResponse({ success: false, error: error.message || '未知错误' });
      }
    })();
    return true;
  }

  // 从 RingCentral 发送框创建定时消息
  if (request.type === 'CREATE_GLIP_COMPOSE_SCHEDULED_MESSAGE') {
    (async () => {
      try {
        const data = request.data || {};
        const content = typeof data.content === 'string' ? data.content.trim() : '';
        const topic = typeof data.topic === 'string' && data.topic.trim()
          ? data.topic.trim()
          : '定时发送消息';
        const scheduledAt = new Date(String(data.scheduledAt || ''));
        const targetType = data.targetType === 'group' ? 'group' : 'private';
        const glipUserName =
          typeof data.glipUserName === 'string' ? data.glipUserName.trim() : '';
        const glipTeamId =
          typeof data.glipTeamId === 'string' ? data.glipTeamId.trim() : '';
        const chatId = typeof data.chatId === 'string' ? data.chatId.trim() : '';

        if (!content) {
          sendResponse({
            success: false,
            reason: 'empty_content',
            error: '请先输入要定时发送的消息',
          });
          return;
        }

        if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
          sendResponse({
            success: false,
            reason: 'invalid_time',
            error: '请选择未来时间',
          });
          return;
        }

        if (targetType === 'group' && !glipTeamId) {
          sendResponse({
            success: false,
            reason: 'missing_target',
            error: '无法识别当前群组目标',
          });
          return;
        }

        if (!chatId) {
          sendResponse({
            success: false,
            reason: 'missing_chat',
            error: '无法识别当前聊天会话',
          });
          return;
        }

        if (targetType === 'private' && !glipUserName) {
          sendResponse({
            success: false,
            reason: 'missing_target',
            error: '无法识别当前私聊目标',
          });
          return;
        }

        const result = await chrome.storage.local.get([
          'scheduledMessagesConfig',
        ]);
        const config = result.scheduledMessagesConfig;
        const ringCentralSenderConfigured = hasRingCentralSenderCredentials(config);

        if (!config || !config.sheetId) {
          sendResponse({
            success: false,
            reason: 'not_initialized',
            error: '请先在设置中初始化定时消息系统',
            ringCentralSenderConfigured,
          });
          return;
        }

        const token = await getGoogleAuthToken({
          caller: 'background.createGlipComposeScheduledMessage',
          scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
        });
        if (!token) {
          sendResponse({
            success: false,
            reason: 'auth_required',
            error: '无法获取 Google 授权，请打开定时消息管理器重新授权',
            ringCentralSenderConfigured,
          });
          return;
        }

        const { dateStr, timeStr } = formatLocalScheduleDateTime(scheduledAt);
        const service = new ScheduledMessageService(token);
        const formData: CreateMessageFormData = {
          Topic: topic,
          Content: content,
          Schedule_Date: dateStr,
          Schedule_Time: timeStr,
          Push_Method: 'AsMe',
          Target_Type: targetType,
          Glip_User_Name: targetType === 'private' ? glipUserName : undefined,
          Glip_Team_ID: targetType === 'group' ? glipTeamId : undefined,
          Category: 'ComposeScheduled,定时发送',
        };

        const newMessage = await service.createMessage(formData);
        await upsertGlipPendingScheduledMessage({
          id: `compose-scheduled:${newMessage.ID || `${chatId}:${scheduledAt.toISOString()}`}`,
          messageId: newMessage.ID,
          chatId,
          topic,
          content,
          scheduledAt: scheduledAt.toISOString(),
          targetType,
          targetLabel: targetType === 'group' ? glipTeamId : glipUserName,
          sourceUrl: typeof data.sourceUrl === 'string' ? data.sourceUrl : undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          warnings: data.warnings,
        });
        sendResponse({
          success: true,
          messageId: newMessage.ID,
          ringCentralSenderConfigured,
        });
      } catch (error: any) {
        console.error('❌ 从 Glip 发送框创建定时消息失败:', error);
        sendResponse({
          success: false,
          reason: 'background_error',
          error: error.message || '创建定时消息失败',
        });
      }
    })();
    return true;
  }

  // 检查 Automation_Link 是否已存在于 Scheduled Messages 中
  if (request.type === 'CHECK_AUTOMATION_LINK_EXISTS') {
    (async () => {
      try {
        const { automationLink } = request.data;
        console.log('🔍 检查 Automation_Link 是否存在:', automationLink);

        // 获取配置和 token
        const result = await chrome.storage.local.get([
          'scheduledMessagesConfig',
        ]);
        const config = result.scheduledMessagesConfig;

        if (!config || !config.sheetId) {
          sendResponse({ exists: false });
          return;
        }

        // 🔧 使用静默方法，避免在后台检查时弹出授权窗口
        console.log(
          '🔐 [background.CHECK_AUTOMATION_LINK_EXISTS] 使用静默方法（自动检查）',
        );
        const token = await getGoogleAuthTokenSilently({
          caller: 'background.checkAutomationLink',
          scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
        });
        if (!token) {
          console.warn(
            '🔐 [background.CHECK_AUTOMATION_LINK_EXISTS] 无缓存 token，返回不存在',
          );
          sendResponse({ exists: false });
          return;
        }

        const service = new ScheduledMessageService(token);
        const messages = await service.getAllMessages();

        // 检查是否有相同的 Automation_Link
        const exists = messages.some(
          (msg) => msg.Automation_Link === automationLink,
        );
        console.log('🔍 检查结果:', exists ? '已存在' : '不存在');
        sendResponse({ exists });
      } catch (error: any) {
        console.error('❌ 检查 Automation_Link 失败:', error);
        sendResponse({ exists: false, error: error.message });
      }
    })();
    return true;
  }

  // 批量检查多个 Automation_Link 是否已存在于 Scheduled Messages 中
  if (request.type === 'BATCH_CHECK_AUTOMATION_LINKS_EXIST') {
    (async () => {
      try {
        const { automationLinks } = request.data;
        console.log(
          '🔍 批量检查 Automation_Links 是否存在:',
          automationLinks.length,
          '个',
        );

        // 获取配置和 token
        const result = await chrome.storage.local.get([
          'scheduledMessagesConfig',
        ]);
        const config = result.scheduledMessagesConfig;

        if (!config || !config.sheetId) {
          const emptyResults: Record<string, boolean> = {};
          automationLinks.forEach((link: string) => {
            emptyResults[link] = false;
          });
          sendResponse({ results: emptyResults });
          return;
        }

        // 🔧 使用静默方法，避免在后台批量检查时弹出授权窗口
        console.log(
          '🔐 [background.BATCH_CHECK_AUTOMATION_LINKS] 使用静默方法（自动预加载）',
        );
        const token = await getGoogleAuthTokenSilently({
          caller: 'background.batchCheckAutomationLinks',
          scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
        });
        if (!token) {
          console.warn(
            '🔐 [background.BATCH_CHECK_AUTOMATION_LINKS] 无缓存 token，返回空结果',
          );
          const emptyResults: Record<string, boolean> = {};
          automationLinks.forEach((link: string) => {
            emptyResults[link] = false;
          });
          sendResponse({ results: emptyResults });
          return;
        }

        const service = new ScheduledMessageService(token);
        const messages = await service.getAllMessages();

        // 构建 Automation_Link 的 Set 用于快速查找
        const existingLinks = new Set(
          messages.map((msg) => msg.Automation_Link).filter(Boolean),
        );

        // 批量检查每个链接
        const results: Record<string, boolean> = {};
        automationLinks.forEach((link: string) => {
          results[link] = existingLinks.has(link);
        });

        const existCount = Object.values(results).filter(Boolean).length;
        console.log(
          `🔍 批量检查完成: ${existCount}/${automationLinks.length} 个已存在`,
        );
        sendResponse({ results });
      } catch (error: any) {
        console.error('❌ 批量检查 Automation_Links 失败:', error);
        sendResponse({ results: {}, error: error.message });
      }
    })();
    return true;
  }

  // 调用 LLM 总结规则内容
  if (request.type === 'CALL_LLM_SUMMARIZE') {
    (async () => {
      try {
        const { prompt } = request.data;
        console.log('🤖 调用 LLM 总结规则...');

        const { handleLLMRequest } = await import('./llm');
        const { CAPABILITIES } = await import('./analytics/capabilities');
        const summary = await handleLLMRequest({
          prompt,
          capability: CAPABILITIES.JIRA_AUTOMATION_IMPORT,
          feature: 'rule_summary',
        });

        console.log('✅ LLM 总结完成:', summary);
        sendResponse({ success: true, summary });
      } catch (error: any) {
        console.error('❌ LLM 总结失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 更新 Jira Automation Rule 状态（启用/禁用）
  if (request.type === 'UPDATE_JIRA_RULE_STATE') {
    (async () => {
      try {
        const { jiraUrl, projectId, ruleId, newState, ruleData } = request.data;
        console.log(`🔄 更新 Jira Rule ${ruleId} 状态为: ${newState}`);

        // 发送请求更新规则状态（使用统一的 jiraFetch）
        const response = await jiraFetch(
          `${jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule/${ruleId}`,
          {
            method: 'PUT',
            body: {
              ...ruleData,
              state: newState,
            },
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`更新失败 (${response.status}): ${errorText}`);
        }

        console.log(`✅ Jira Rule ${ruleId} 状态更新成功`);
        sendResponse({ success: true });
      } catch (error: any) {
        console.error('❌ 更新 Jira Rule 状态失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 批量获取某个项目的所有 Jira Automation Rules（用于状态同步优化）
  if (request.type === 'GET_ALL_JIRA_RULES') {
    (async () => {
      try {
        const { jiraUrl, projectId } = request.data;
        console.log(`📖 批量获取项目 ${projectId} 的所有 Jira Rules...`);

        const response = await jiraFetch(
          `${jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule`,
        );

        if (!response.ok) {
          throw new Error(`获取失败 (${response.status})`);
        }

        const rules = await response.json();
        console.log(`✅ 获取项目 ${projectId} 的 ${rules.length} 条规则成功`);
        sendResponse({ success: true, rules });
      } catch (error: any) {
        console.error('❌ 批量获取 Jira Rules 失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 获取 Jira Automation Rule 详情
  if (request.type === 'GET_JIRA_RULE_DETAILS') {
    (async () => {
      try {
        const { jiraUrl, projectId, ruleId } = request.data;
        console.log(`📖 获取 Jira Rule ${ruleId} 详情...`);

        // 使用获取规则列表的接口（使用统一的 jiraFetch）
        const response = await jiraFetch(
          `${jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule`,
        );

        if (!response.ok) {
          throw new Error(`获取失败 (${response.status})`);
        }

        const rules = await response.json();
        // 在规则列表中查找指定的 rule ID
        const ruleData = rules.find(
          (r: any) => String(r.id) === String(ruleId),
        );

        if (!ruleData) {
          throw new Error(`未找到规则 ${ruleId}`);
        }

        console.log(`✅ 获取 Jira Rule ${ruleId} 成功`);
        sendResponse({ success: true, ruleData });
      } catch (error: any) {
        console.error('❌ 获取 Jira Rule 详情失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 更新 Jira Automation Rule 名称（同步 Topic）
  if (request.type === 'UPDATE_JIRA_RULE_NAME') {
    (async () => {
      try {
        const { jiraUrl, projectId, ruleId, newName, ruleData } = request.data;
        console.log(`📝 更新 Jira Rule ${ruleId} 名称为: ${newName}`);

        // 发送请求更新规则名称（使用统一的 jiraFetch）
        const response = await jiraFetch(
          `${jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule/${ruleId}`,
          {
            method: 'PUT',
            body: {
              ...ruleData,
              name: newName,
            },
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`更新失败 (${response.status}): ${errorText}`);
        }

        console.log(`✅ Jira Rule ${ruleId} 名称更新成功`);
        sendResponse({ success: true });
      } catch (error: any) {
        console.error('❌ 更新 Jira Rule 名称失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 打开定时消息管理界面
  if (request.type === 'OPEN_SCHEDULED_MESSAGES') {
    (async () => {
      try {
        console.log('📅 打开定时消息管理界面...');
        const params = new URLSearchParams();
        const requestData = request.data || {};
        const categories = Array.isArray(requestData.categories)
          ? requestData.categories
          : requestData.category
          ? [requestData.category]
          : [];

        categories
          .map((category: unknown) =>
            typeof category === 'string' ? category.trim() : '',
          )
          .filter(Boolean)
          .forEach((category: string) => params.append('category', category));

        if (requestData.filterPendingReview === true) {
          params.set('filterPendingReview', 'true');
        }

        const targetMessageId =
          typeof requestData.messageId === 'string'
            ? requestData.messageId.trim()
            : typeof requestData.targetMessageId === 'string'
            ? requestData.targetMessageId.trim()
            : '';
        if (targetMessageId) {
          params.set('messageId', targetMessageId);
        }

        if (requestData.configureRingCentralSender === true) {
          params.set('configureRingCentralSender', 'true');
        }

        const query = params.toString();
        const url = chrome.runtime.getURL(
          `scheduled-messages.html${query ? `?${query}` : ''}`,
        );
        await chrome.tabs.create({ url });
        sendResponse({ success: true });
      } catch (error: any) {
        console.error('❌ 打开定时消息管理界面失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 打开项目进度仪表盘
  if (request.type === 'OPEN_PROJECT_DASHBOARD') {
    (async () => {
      try {
        console.log('📊 打开项目进度仪表盘...', {
          projectId: request.projectId,
          projectName: request.projectName,
        });
        const url = chrome.runtime.getURL(
          buildProjectDashboardLaunchPath({
            projectId: request.projectId,
            projectName: request.projectName,
          }),
        );
        await chrome.windows.create({
          url,
          type: 'popup',
          width: 1200,
          height: 900,
          focused: true,
        });
        sendResponse({ success: true });
      } catch (error: any) {
        console.error('❌ 打开项目进度仪表盘失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 打开自动答复配置界面（从消息悬浮菜单触发）
  if (request.type === 'OPEN_AUTO_REPLY_CONFIG') {
    (async () => {
      try {
        console.log('🤖 打开自动答复配置界面...', request.data);

        // 将消息上下文存储到 storage，供 topic-modal 使用
        if (request.data) {
          await chrome.storage.local.set({
            pendingAutoReplyConfig: {
              sender: request.data.sender,
              groupId: request.data.groupId,
              groupName: request.data.groupName,
              content: request.data.content,
              messageId: request.data.messageId,
              timestamp: Date.now(),
            },
          });
        }

        // 打开记忆入口规则（memory-exploring 路由，iframe 承载 topic-modal）
        await openMemoryEntryRules({
          asPopup: true,
          surface: 'task',
          intent: 'auto-reply',
          ...MEMORY_ENTRY_RULES_TASK_POPUP_SIZE,
        });
        sendResponse({ success: true });
      } catch (error: any) {
        console.error('❌ 打开自动答复配置界面失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 打开联动操作配置界面（从消息悬浮菜单触发）
  if (request.type === 'OPEN_LINKED_ACTION_CONFIG') {
    (async () => {
      try {
        console.log('🔗 打开联动操作配置界面...', request.data);

        if (request.data) {
          await chrome.storage.local.set({
            pendingLinkedActionConfig: buildPendingLinkedActionConfig(
              request.data,
            ),
          });
        }

        await openMemoryEntryRules({
          asPopup: true,
          surface: 'task',
          intent: 'linked-action',
          ...MEMORY_ENTRY_RULES_TASK_POPUP_SIZE,
        });
        sendResponse({ success: true });
      } catch (error: any) {
        console.error('❌ 打开联动操作配置界面失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // RPA: 获取 JIRA 当前用户信息（使用 jira.ts 的通用方法）
  if (request.type === 'RPA_GET_JIRA_CURRENT_USER') {
    (async () => {
      console.log('👤 RPA: 获取 JIRA 当前用户...');
      const result = await getCurrentUser();
      if (result.success) {
        console.log('✅ 获取到用户:', result.ownerId);
      } else {
        console.error('❌ 获取 JIRA 用户信息失败:', result.error);
      }
      sendResponse(result);
    })();
    return true;
  }

  // RPA: 通过 projectKey 获取 projectId（使用 jira.ts 的通用方法）
  if (request.type === 'RPA_GET_JIRA_PROJECT_ID') {
    (async () => {
      const { projectKey } = request.data;
      console.log(`🔍 RPA: 获取项目 ${projectKey} 的 ID...`);
      const result = await getProjectByKey(projectKey);
      if (result.success) {
        console.log(`✅ 项目 ${projectKey} 的 ID: ${result.projectId}`);
      } else {
        console.error('❌ 获取项目 ID 失败:', result.error);
      }
      sendResponse(result);
    })();
    return true;
  }

  // =====================================================
  // Snooze 稍后处理功能
  // =====================================================

  // 撤销刚创建的 Snooze 提醒，只允许删除仍未完成的 Snooze 项，避免误删其他定时消息
  if (request.type === 'CANCEL_SNOOZE_REMINDER') {
    (async () => {
      try {
        const messageId =
          typeof request.data?.messageId === 'string'
            ? request.data.messageId.trim()
            : '';
        const expectedScheduleDate =
          typeof request.data?.expectedScheduleDate === 'string'
            ? request.data.expectedScheduleDate.trim()
            : '';
        const expectedScheduleTime =
          typeof request.data?.expectedScheduleTime === 'string'
            ? request.data.expectedScheduleTime.trim()
            : '';
        if (!messageId) {
          sendResponse({ success: false, error: '缺少提醒 ID' });
          return;
        }

        const result = await chrome.storage.local.get([
          'scheduledMessagesConfig',
        ]);
        const config = result.scheduledMessagesConfig;
        if (!config || !config.sheetId) {
          sendResponse({
            success: false,
            error: '请先在设置中初始化定时消息系统',
          });
          return;
        }

        const token = await getGoogleAuthToken({
          caller: 'background.cancelSnoozeReminder',
          scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
        });
        const service = new ScheduledMessageService(token);
        const messages = await service.getAllMessages();
        const message = messages.find((item) => item.ID === messageId);
        if (!message) {
          sendResponse({
            success: false,
            error: '未找到提醒，可能已被删除',
          });
          return;
        }

        if (!isOpenSnoozeReminder(message)) {
          sendResponse({
            success: false,
            error: '只能撤销未完成的稍后处理提醒',
          });
          return;
        }

        if (
          !doesSnoozeReminderMatchSchedule(message, {
            scheduleDate: expectedScheduleDate,
            scheduleTime: expectedScheduleTime,
          })
        ) {
          sendResponse({
            success: false,
            error: '提醒时间已被更新，请到管理稍后处理中确认或删除',
          });
          return;
        }

        await service.deleteMessage(messageId);
        sendResponse({ success: true });
      } catch (error: any) {
        console.error('❌ Background: 撤销 Snooze 提醒失败:', error);
        sendResponse({
          success: false,
          error: error.message || '撤销提醒失败，请稍后重试',
        });
      }
    })();
    return true;
  }

  // 创建 Snooze 提醒（从 RingCentral 消息页面调用）
  // 注意：MV3 Service Worker 有严格的生命周期管理，需要快速返回响应
  if (request.type === 'CREATE_SNOOZE_REMINDER') {
    console.log('🔔 Background: 收到 CREATE_SNOOZE_REMINDER 请求');

    // 使用同步方式获取必要数据，然后快速响应
    const { messageInfo, remindAt, note } = request.data;
    const snoozeSourceKey = messageInfo
      ? getSnoozeReminderSourceKey(messageInfo)
      : '';
    console.log('🔔 Background: Snooze 请求数据:', {
      messageId: messageInfo?.id,
      groupName: messageInfo?.groupName,
      remindAt: remindAt,
    });

    if (snoozeSourceKey && pendingSnoozeReminderKeys.has(snoozeSourceKey)) {
      sendResponse({
        success: false,
        reason: 'request_pending',
        error: '正在创建或更新这条消息的提醒，请稍候',
      });
      return true;
    }

    if (snoozeSourceKey) {
      pendingSnoozeReminderKeys.add(snoozeSourceKey);
    }

    // 快速处理核心逻辑，然后立即响应
    (async () => {
      try {
        // 获取配置
        console.log('🔔 Background: 获取配置...');
        const result = await chrome.storage.local.get([
          'scheduledMessagesConfig',
          'userinfo',
        ]);
        const config = result.scheduledMessagesConfig;
        const userinfo = result.userinfo;

        console.log('🔔 Background: 配置状态:', {
          hasConfig: !!config,
          hasSheetId: !!config?.sheetId,
          hasUserinfo: !!userinfo,
        });

        if (!config || !config.sheetId) {
          console.error('❌ Background: 未配置 Scheduled Messages');
          sendResponse({
            success: false,
            error: '请先在设置中初始化定时消息系统',
          });
          return;
        }

        // 获取 auth token（用户主动操作，可以弹窗）
        console.log('🔔 Background: 获取 Google Auth Token...');
        const token = await getGoogleAuthToken({
          caller: 'background.createSnoozeMessage',
          scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
        });
        console.log('🔔 Background: Token 获取成功');

        const service = new ScheduledMessageService(token);

        // 格式化提醒时间
        const { dateStr, timeStr } = formatLocalScheduleDateTime(remindAt);

        console.log('🔔 Background: 提醒时间:', dateStr, timeStr);

        // 直接使用群组名作为 Topic，跳过耗时的 LLM 调用
        // LLM 摘要会在后台异步更新
        const topicSummary = messageInfo.groupName || '消息提醒';

        // 构建提醒内容
        const contentParts = [
          `📌 **您设置了一个稍后处理提醒**`,
          ``,
          `**来自**: ${messageInfo.senderName}`,
          `**群组**: ${messageInfo.groupName}`,
          `**原文摘要**:`,
          `> ${messageInfo.content}`,
          ``,
          `🔗 [点击查看原消息](${messageInfo.messageLink})`,
        ];

        if (note) {
          contentParts.splice(2, 0, `**备注**: ${note}`);
        }

        const snoozeContent = contentParts.join('\n');
        const existingSnooze = findOpenSnoozeReminderForMessage(
          await service.getAllMessages(),
          messageInfo,
        );

        if (existingSnooze) {
          console.log(
            '🔔 Background: 已存在同源 Snooze，改为更新提醒时间:',
            existingSnooze.ID,
          );

          const updatedMessage = await service.updateMessage(
            existingSnooze.ID,
            {
              Topic: existingSnooze.Topic || `稍后处理: ${topicSummary}`,
              Content: snoozeContent,
              Schedule_Date: dateStr,
              Schedule_Time: timeStr,
              Status: 'Active',
              Exec_Log: '已重新安排，待执行',
            },
          );

          sendResponse({
            success: true,
            messageId: updatedMessage.ID,
            updated: true,
          });
          return;
        }

        // 创建定时消息（核心操作）
        console.log('🔔 Background: 创建定时消息...');
        const newMessage = await service.createMessage({
          Topic: `稍后处理: ${topicSummary}`,
          Content: snoozeContent,
          Schedule_Date: dateStr,
          Schedule_Time: timeStr,
          Push_Method: 'Bot',
          Target_Type: 'private',
          Glip_User_Name: userinfo?.fullName || userinfo?.username || '',
          Category: 'Snooze,提醒',
        });

        console.log('✅ Background: Snooze 定时消息创建成功:', newMessage.ID);

        // 🔥 立即发送成功响应，避免消息通道超时
        sendResponse({ success: true, messageId: newMessage.ID });

        // ========== 以下为后台异步任务，不阻塞响应 ==========

        // 异步生成 LLM 摘要并更新 Topic（可选，失败不影响主功能）
        setTimeout(async () => {
          try {
            console.log('🔔 Background: 后台生成消息摘要...');
            const summaryPrompt = `请用不超过15个字概括以下消息的核心内容，直接输出摘要，不要任何前缀或解释：

消息内容：${messageInfo.content}`;

            const summaryResult = await handleLLMRequest({
              prompt: summaryPrompt,
              capability: CAPABILITIES.SCHEDULED_MESSAGES,
              feature: 'message_summary',
            });
            if (summaryResult && summaryResult.trim()) {
              const newTopicSummary = summaryResult.trim().substring(0, 20);
              console.log('✅ Background: 后台摘要生成成功:', newTopicSummary);

              // 更新已创建消息的 Topic
              try {
                const freshToken = await getGoogleAuthToken({
                  caller: 'background.updateMessageTopic',
                  scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
                });
                const freshService = new ScheduledMessageService(freshToken);
                await freshService.updateMessage(newMessage.ID, {
                  Topic: `稍后处理: ${newTopicSummary}`,
                });
                console.log('✅ Background: 消息 Topic 已更新');
              } catch (updateError) {
                console.warn(
                  '⚠️ Background: 更新 Topic 失败（不影响功能）:',
                  updateError,
                );
              }
            }
          } catch (summaryError) {
            console.warn(
              '⚠️ Background: 后台摘要生成失败（不影响功能）:',
              summaryError,
            );
          }
        }, 100);

        // 异步存储到云端记忆系统
        setTimeout(async () => {
          try {
            console.log('🔔 Background: 后台存储 Snooze 消息到云端记忆...');

            const messageContent = `[稍后处理] ${messageInfo.senderName}: ${messageInfo.content}`;

            const memClient = getMemoryServiceClient();
            await memClient.ingest({
              content: messageContent,
              sourceType: 'glip',
              sender: messageInfo.senderName,
              groupId: messageInfo.groupId,
              groupName: messageInfo.groupName,
              sourceUrl: messageInfo.messageLink,
              timestamp: Date.now(),
              metadata: {
                summary: `用户主动关注的消息：${messageInfo.content.substring(
                  0,
                  100,
                )}`,
                matchedRules: ['user_snooze'],
                replyAdvice: '',
                contextMessages: [
                  {
                    id: messageInfo.id,
                    sender: messageInfo.senderName,
                    content: messageInfo.content,
                    datetime: messageInfo.timestamp,
                    isMainMessage: true,
                  },
                ],
                entities: {
                  people: messageInfo.senderName
                    ? [
                        {
                          name: messageInfo.senderName,
                          type: 'Person',
                          relevanceScore: 0.9,
                        },
                      ]
                    : [],
                  topics: [
                    {
                      name: messageInfo.groupName,
                      type: 'Topic',
                      relevanceScore: 0.8,
                    },
                  ],
                },
                snoozeInfo: {
                  remindAt: remindAt,
                  scheduledMessageId: newMessage.ID,
                  note: note || '',
                },
              },
            });

            console.log('✅ Background: Snooze 消息已存储到云端记忆');

            // 更新用户画像 via profile items
            try {
              console.log('🔔 Background: 后台更新用户画像...');

              if (messageInfo.senderName) {
                await memClient.createInferredProfileItem({
                  itemType: 'interest',
                  itemKey: 'snooze_person',
                  itemValue: messageInfo.senderName,
                  evidenceRefs: [
                    {
                      sourceType: 'glip',
                      actionType: 'snooze_reminder',
                      messageId: messageInfo.id,
                      groupName: messageInfo.groupName,
                      remindAt,
                      sourceUrl: messageInfo.messageLink,
                    },
                  ],
                  confidence: 0.3,
                });
              }

              if (messageInfo.groupName) {
                await memClient.createInferredProfileItem({
                  itemType: 'interest',
                  itemKey: 'snooze_topic',
                  itemValue: messageInfo.groupName,
                  evidenceRefs: [
                    {
                      sourceType: 'glip',
                      actionType: 'snooze_reminder',
                      messageId: messageInfo.id,
                      senderName: messageInfo.senderName,
                      groupId: messageInfo.groupId,
                      sourceUrl: messageInfo.messageLink,
                    },
                  ],
                  confidence: 0.2,
                });
              }

              console.log('✅ Background: 用户画像已更新');
            } catch (profileError) {
              console.warn(
                '⚠️ Background: 更新用户画像失败（不影响功能）:',
                profileError,
              );
            }
          } catch (memoryError) {
            console.error(
              '⚠️ Background: 后台存储到记忆系统失败（不影响提醒功能）:',
              memoryError,
            );
          }
        }, 200);
      } catch (error: any) {
        console.error('❌ Background: 创建 Snooze 提醒失败:', error);
        console.error('❌ Background: 错误堆栈:', error.stack);
        sendResponse({ success: false, error: error.message || '创建失败' });
      } finally {
        if (snoozeSourceKey) {
          pendingSnoozeReminderKeys.delete(snoozeSourceKey);
        }
      }
    })();
    return true;
  }

  // RPA: 创建 JIRA Automation 规则（使用 JiraAutomationService）
  if (request.type === 'RPA_CREATE_JIRA_AUTOMATION_RULE') {
    (async () => {
      try {
        const { ruleData, projectId, projectKey } = request.data;
        console.log(
          `📝 RPA: 创建 Automation 规则到项目 ${projectKey} (ID: ${projectId})...`,
        );

        // 创建 JiraAutomationService 实例
        const service = new JiraAutomationService();
        const config = {
          jiraUrl: 'https://jira.ringcentral.com',
          projectKey: projectKey,
        };

        // 调用 createRule 方法（会自动处理 webhook trigger）
        const result = await service.createRule(config, ruleData);
        console.log(`✅ 规则创建成功，ID: ${result.id}`);
        sendResponse({ success: true, data: result });
      } catch (error: any) {
        console.error('❌ 创建 Automation 规则失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 存储关注后续的原消息到 ChromaDB
  if (request.type === 'STORE_FOLLOWED_MESSAGE') {
    storeRelatedMessage(request.data, { throwOnError: true })
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // 打开关注后续配置表单
  if (request.type === 'OPEN_FOLLOW_THREAD_CONFIG') {
    (async () => {
      try {
        await chrome.storage.local.set({
          pendingFollowThreadConfig: buildPendingFollowThreadConfig(
            request.data,
          ),
        });

        // 打开记忆入口规则
        await openMemoryEntryRules({
          asPopup: true,
          surface: 'task',
          intent: 'follow-thread',
          ...MEMORY_ENTRY_RULES_TASK_POPUP_SIZE,
        });

        sendResponse({ success: true });
      } catch (error: any) {
        console.error('❌ 打开关注后续配置失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  return false;
});

// 处理 Chrome 通知点击事件
chrome.notifications.onClicked.addListener(async (notificationId) => {
  // 处理新的统一通知格式 (msg_xxx)
  if (notificationId.startsWith('msg_')) {
    try {
      const result = await chrome.storage.local.get(
        `notification_link_${notificationId}`,
      );
      const link = result[`notification_link_${notificationId}`];

      if (link) {
        await chrome.tabs.create({ url: link });
        await chrome.storage.local.remove(
          `notification_link_${notificationId}`,
        );
      }
    } catch (error) {
      console.error('❌ 处理通知点击失败:', error);
    }
    chrome.notifications.clear(notificationId);
    return;
  }

  // 处理后端推送通知 (backend-xxx)
  if (notificationId.startsWith('backend-')) {
    try {
      const meta = await getStoredBackendNotificationMeta(notificationId);
      const targetHash = meta?.targetHash || '/decisions';
      const url = chrome.runtime.getURL(`memory-exploring.html#${targetHash}`);
      await chrome.tabs.create({ url });

      if (meta?.sourceRef) {
        await safeReportChromeDelivery([
          {
            sourceRef: meta.sourceRef,
            lane: meta.lane,
            status: 'clicked',
            externalRef: notificationId,
          },
        ]);

        if (meta.sourceRef.startsWith('notification:')) {
          const client = getMemoryServiceClient();
          const notificationRecordId =
            meta.notificationId || meta.sourceRef.slice('notification:'.length);
          await client.acknowledgeNotification(
            notificationRecordId,
            'chrome_notification_opened',
          );
        }
      }
    } catch (error) {
      console.error('Failed to handle backend notification click:', error);
    } finally {
      await clearBackendNotificationMeta(notificationId);
      chrome.notifications.clear(notificationId);
    }
    return;
  }

  // 处理旧的关注后续通知格式 (followThread_xxx)
  if (notificationId.startsWith('followThread_')) {
    const parts = notificationId.split('_');
    if (parts.length >= 3) {
      const originalPostId = parts[1];
      const relatedPostId = parts[2];

      try {
        // 获取关注项配置以获取 teamId
        const result = await chrome.storage.local.get('concernedItems');
        const concernedItems = result.concernedItems || [];
        const followItem = concernedItems.find(
          (item: any) =>
            item.followConfig?.originalMessage.postId === originalPostId,
        );

        if (followItem && followItem.followConfig) {
          const teamId = followItem.followConfig.originalMessage.teamId;
          const messageUrl = `https://app.ringcentral.com/messages/${teamId}/${relatedPostId}`;
          await chrome.tabs.create({ url: messageUrl });
        }
      } catch (error) {
        console.error('❌ 处理通知点击失败:', error);
      }
    }
    chrome.notifications.clear(notificationId);
  }
});

// 处理 Chrome 通知按钮点击事件
chrome.notifications.onButtonClicked.addListener(
  async (notificationId, buttonIndex) => {
    // 处理新的统一通知格式 (msg_xxx)
    if (notificationId.startsWith('msg_')) {
      if (buttonIndex === 0) {
        // 查看消息
        try {
          const result = await chrome.storage.local.get(
            `notification_link_${notificationId}`,
          );
          const link = result[`notification_link_${notificationId}`];

          if (link) {
            await chrome.tabs.create({ url: link });
            await chrome.storage.local.remove(
              `notification_link_${notificationId}`,
            );
          }
        } catch (error) {
          console.error('❌ 处理通知按钮点击失败:', error);
        }
      }
      chrome.notifications.clear(notificationId);
      return;
    }

    if (notificationId.startsWith('backend-')) {
      const meta = await getStoredBackendNotificationMeta(notificationId);
      try {
        if (buttonIndex === 0) {
          const targetHash = meta?.targetHash || '/decisions';
          const url = chrome.runtime.getURL(
            `memory-exploring.html#${targetHash}`,
          );
          await chrome.tabs.create({ url });

          if (meta?.sourceRef) {
            await safeReportChromeDelivery([
              {
                sourceRef: meta.sourceRef,
                lane: meta.lane,
                status: 'clicked',
                externalRef: notificationId,
              },
            ]);
            if (meta.sourceRef.startsWith('notification:')) {
              const client = getMemoryServiceClient();
              const notificationRecordId =
                meta.notificationId ||
                meta.sourceRef.slice('notification:'.length);
              await client.acknowledgeNotification(
                notificationRecordId,
                'chrome_notification_view_button',
              );
            }
          }
        } else if (buttonIndex === 1 && meta?.sourceRef) {
          const client = getMemoryServiceClient();
          await performBackendNotificationSecondaryAction(meta, notificationId, {
            reportDelivery: safeReportChromeDelivery,
            snoozeNotification: (id, delaySeconds) =>
              client.snoozeNotification(id, delaySeconds),
            dismissNotification: (id, detail) =>
              client.dismissNotification(id, detail),
          });
        }
      } catch (error) {
        console.error(
          'Failed to handle backend notification button click:',
          error,
        );
      } finally {
        await clearBackendNotificationMeta(notificationId);
        chrome.notifications.clear(notificationId);
      }
      return;
    }

    // 处理旧的关注后续通知格式 (followThread_xxx)
    if (notificationId.startsWith('followThread_')) {
      const parts = notificationId.split('_');
      if (parts.length >= 3) {
        const originalPostId = parts[1];

        if (buttonIndex === 0) {
          // 查看消息（与点击通知相同）
          // 手动触发点击处理逻辑
          try {
            const result = await chrome.storage.local.get('concernedItems');
            const concernedItems = result.concernedItems || [];
            const followItem = concernedItems.find(
              (item: any) =>
                item.followConfig?.originalMessage.postId === originalPostId,
            );
            if (followItem && followItem.followConfig) {
              const teamId = followItem.followConfig.originalMessage.teamId;
              const relatedPostId = parts[2];
              const messageUrl = `https://app.ringcentral.com/messages/${teamId}/${relatedPostId}`;
              await chrome.tabs.create({ url: messageUrl });
            }
          } catch (error) {
            console.error('❌ 查看消息失败:', error);
          }
        } else if (buttonIndex === 1) {
          // 取消关注
          try {
            const result = await chrome.storage.local.get('concernedItems');
            const concernedItems = result.concernedItems || [];
            const updatedItems = concernedItems.filter(
              (item: any) =>
                !isManualConcernedItem(item) ||
                item.followConfig?.originalMessage.postId !== originalPostId,
            );
            await chrome.storage.local.set({ concernedItems: updatedItems });
            console.log('✅ 已取消关注');
          } catch (error) {
            console.error('❌ 取消关注失败:', error);
          }
        }
      }
      chrome.notifications.clear(notificationId);
    }
  },
);

chrome.notifications.onClosed.addListener((notificationId, byUser) => {
  if (notificationId.startsWith('backend-')) {
    void (async () => {
      const meta = await getStoredBackendNotificationMeta(notificationId);
      if (byUser && meta?.sourceRef) {
        await safeReportChromeDelivery([
          {
            sourceRef: meta.sourceRef,
            lane: meta.lane,
            status: getBackendNotificationClosedDeliveryStatus(meta),
            externalRef: notificationId,
          },
        ]);
      }
      await clearBackendNotificationMeta(notificationId);
    })();
  }
});

// 初始化关注后续清理任务。不要在每次 Service Worker 唤醒时重置已有 alarm。
ensureBackgroundAlarm(
  'cleanupFollowThreads',
  {
    when: getNextCleanupTime(),
  },
  (alarm) => alarm.scheduledTime <= Date.now(),
);

// Poll backend notifications every 15 minutes for dream_digest, weekly_report, etc.
ensureBackgroundAlarm(
  'pollBackendNotifications',
  {
    delayInMinutes: 1,
    periodInMinutes: 15,
  },
  (alarm) => alarm.periodInMinutes !== 15,
);

ensureBackgroundAlarm(
  'contextAssistOutlookCalendarSync',
  {
    delayInMinutes: 2,
    periodInMinutes: 30,
  },
  (alarm) => alarm.periodInMinutes !== 30,
);

// 每 5 分钟上报一次前端用量打点缓冲（阈值刷新由 UsageTracker.record 内部触发）
ensureBackgroundAlarm(
  'flushUsageTelemetry',
  {
    delayInMinutes: 1,
    periodInMinutes: 5,
  },
  (alarm) => alarm.periodInMinutes !== 5,
);

/** Track the last notification we saw so we don't re-show it. */
let _lastSeenNotifCreatedAt = 0;

async function pollBackendNotifications(): Promise<void> {
  try {
    const client = getMemoryServiceClient();
    if (!(await flushChromeDeliveryOutbox())) {
      console.debug(
        'pollBackendNotifications skipped: pending delivery outbox is still unavailable',
      );
      return;
    }
    try {
      const feed = await client.getNotificationCenterFeed(
        'chrome',
        ['todo', 'notice'],
        20,
        'incremental',
      );
      const deliveryEvents: ChromeDeliveryEvent[] = [];
      for (const item of feed.items) {
        const notifId = buildBackendNotificationId(item.sourceRef);
        await storeBackendNotificationMeta(notifId, {
          sourceRef: item.sourceRef,
          sourceType: item.sourceType,
          lane: item.lane,
          type: item.type,
          dueAt: item.dueAt,
          targetHash: getBackendTargetHash(
            item.type,
            item.sourceType,
            item.sourceId,
            item.payload,
          ),
          notificationId:
            item.sourceType === 'notification' ? item.sourceId : undefined,
        });
        try {
          await chrome.notifications.create(notifId, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title: item.title || 'Personal AI',
            message: buildBackendNotificationMessage({
              body: item.body,
              type: item.type,
              payload: item.payload,
            }),
            contextMessage: buildBackendNotificationContextMessage(
              item.lane,
              item.priority,
              item.dueAt,
              item.deliveryContext,
              item.payload,
              item.channelReceipts,
              item.evidenceReceipt,
              item.snoozeReceipt,
              item.sourceType,
            ),
            priority: item.priority === 'high' ? 2 : 1,
            buttons: buildBackendNotificationButtons(
              item.lane,
              item.sourceType,
            ),
          });
          deliveryEvents.push({
            sourceRef: item.sourceRef,
            lane: item.lane,
            status: 'delivered',
            externalRef: notifId,
          });
        } catch (createError) {
          const errorMessage =
            formatChromeNotificationCreateError(createError);
          await clearBackendNotificationMeta(notifId);
          deliveryEvents.push({
            sourceRef: item.sourceRef,
            lane: item.lane,
            status: 'failed',
            externalRef: notifId,
            error: errorMessage,
          });
          console.debug('Backend notification create failed:', errorMessage);
        }
      }
      if (!(await safeReportChromeDelivery(deliveryEvents))) {
        await enqueueChromeDeliveryOutbox(deliveryEvents);
      }
      return;
    } catch (feedError: any) {
      if (!isNotificationCenterCompatError(feedError)) {
        throw feedError;
      }
    }

    const pending = await client.getNotifications('pending');
    if (!pending || pending.length === 0) return;

    const backendOnlyTypes = new Set([
      'dream_digest',
      'weekly_report',
      'new_conflict',
      'truth_conflict',
    ]);

    for (const n of pending) {
      if (!n.type || !backendOnlyTypes.has(n.type)) continue;
      if (n.createdAt <= _lastSeenNotifCreatedAt) continue;
      _lastSeenNotifCreatedAt = n.createdAt;

      const notifId = buildBackendNotificationId(`notification:${n.id}`);
      const legacyLane = inferLegacyLane(n.type);
      const legacyPriority =
        n.type === 'dream_digest' || n.type === 'weekly_report'
          ? 'high'
          : 'normal';
      await storeBackendNotificationMeta(notifId, {
        sourceRef: `notification:${n.id}`,
        lane: legacyLane,
        type: n.type,
        targetHash: getBackendTargetHash(
          n.type,
          'notification',
          undefined,
          n.payload,
        ),
        notificationId: n.id,
      });
      await chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: n.title || 'Personal AI',
        message: buildBackendNotificationMessage({
          body: n.body,
          type: n.type,
          payload: n.payload,
        }),
        contextMessage: buildBackendNotificationContextMessage(
          legacyLane,
          legacyPriority,
          n.sentAt,
          undefined,
          n.payload,
        ),
        priority: legacyPriority === 'high' ? 2 : 1,
        buttons: buildBackendNotificationButtons(legacyLane),
      });
    }
  } catch (err) {
    // Silently ignore — backend may be offline
    console.debug('pollBackendNotifications error:', err);
  }
}

(globalThis as typeof globalThis & {
  __personalAiPollBackendNotificationsForE2E?: (config?: {
    baseUrl?: string;
    timeoutMs?: number;
  }) => Promise<void>;
}).__personalAiPollBackendNotificationsForE2E = async (config) => {
  if (config?.baseUrl) {
    const client = getMemoryServiceClient();
    client.setBaseUrl(config.baseUrl);
    if (config.timeoutMs !== undefined) {
      client.setTimeout(config.timeoutMs);
    }
  }
  await pollBackendNotifications();
};
console.log('✅ Backend notification poller 已设置 (15min)');

// 监听扩展命令
chrome.commands.onCommand.addListener(async (command) => {
  console.log('Command received:', command);

  if (command === 'open-memory-interface') {
    try {
      // 获取当前活跃的标签页
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (activeTab?.id) {
        // 打开记忆查询界面
        const memoryUrl = chrome.runtime.getURL('memory-exploring.html');

        // 使用弹窗方式打开记忆界面
        await chrome.windows.create({
          url: memoryUrl,
          type: 'popup',
          width: 1400,
          height: 900,
          focused: true,
        });

        console.log('Memory interface opened via command shortcut');
      }
    } catch (error) {
      console.error('Failed to open memory interface:', error);
    }
  }
});

async function getUserinfoFromRCpage() {
  let rcTab = await findRingCentralTab();
  if (!rcTab) {
    rcTab = await createRingCentralTab();
    // 等待页面加载完成
    await waitForTabLoad(rcTab.id);
  }

  try {
    const response = await sendMessageWithRetry(rcTab.id, {
      type: 'GET_USER_INFO',
    });
    const userinfo = response.data || {
      fullName: '',
      username: '',
      userEmail: '',
      extensionId: '',
    };
    chrome.storage.local.set({ userinfo });
    void syncUserIdentityToMemory(userinfo).catch((syncError) => {
      console.warn('Failed to sync RC userinfo to memory profile:', syncError);
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get userinfo:', error);
    return null;
  }
}

// 查找已打开的 JIRA 标签页
async function findJiraTab() {
  const tabs = await chrome.tabs.query({
    url: '*://jira.ringcentral.com/browse/*',
  });
  return tabs[0];
}

// 创建新的 JIRA 标签页
async function createJiraTab() {
  return await chrome.tabs.create({
    url: 'https://jira.ringcentral.com/browse/MTR-620',
    active: false,
  });
}

// 从 JIRA 页面获取用户信息
async function getUserinfoFromJiraPage() {
  let jiraTab = await findJiraTab();
  let shouldCloseTab = false;

  if (!jiraTab) {
    jiraTab = await createJiraTab();
    shouldCloseTab = true; // 标记需要关闭这个新创建的tab
    // 等待页面加载完成
    await waitForTabLoad(jiraTab.id);
  }

  try {
    const response = await sendMessageWithRetry(jiraTab.id, {
      type: 'GET_USER_INFO',
    });

    const userinfo = response.data || {
      fullName: '',
      username: '',
      userEmail: '',
      extensionId: '',
    };

    chrome.storage.local.set({ userinfo });
    if (userinfo.ownerId)
      chrome.storage.local.set({ ownerId: userinfo.ownerId });
    void syncUserIdentityToMemory(userinfo).catch((syncError) => {
      console.warn(
        'Failed to sync JIRA userinfo to memory profile:',
        syncError,
      );
    });

    // 如果是新创建的tab，关闭它
    if (shouldCloseTab && jiraTab.id) {
      setTimeout(() => {
        chrome.tabs.remove(jiraTab.id);
      }, 1000); // 延迟1秒关闭，确保数据已保存
    }

    return userinfo;
  } catch (error) {
    console.error('Failed to get userinfo from JIRA:', error);

    // 如果出错且是新创建的tab，也要关闭它
    if (shouldCloseTab && jiraTab.id) {
      chrome.tabs.remove(jiraTab.id);
    }

    return null;
  }
}

// 处理幻灯片分析请求
async function handleSlideAnalysisRequest(tabId: number) {
  try {
    // 获取认证token（用户主动操作，可以弹窗）
    const token = await getGoogleAuthToken({
      caller: 'background.analyzeSlides',
      scopes: GOOGLE_AUTH_SCOPE_SETS.SLIDES,
    });
    if (token) {
      // 发送回内容脚本
      chrome.tabs.sendMessage(tabId, {
        type: 'ANALYZE_SLIDES_PROJECTS',
        token,
      });
    } else {
      const errorMessage = '获取 Google 认证失败，请重新授权后再试';
      console.error(errorMessage);
      chrome.tabs.sendMessage(tabId, {
        type: 'SLIDES_ANALYSIS_AUTH_FAILED',
        error: errorMessage,
      });
    }
  } catch (error) {
    const errorMessage = `处理幻灯片分析请求时出错: ${
      error instanceof Error ? error.message : String(error)
    }`;
    console.error(errorMessage);
    chrome.tabs.sendMessage(tabId, {
      type: 'SLIDES_ANALYSIS_AUTH_FAILED',
      error: errorMessage,
    });
  }
}

// 生成项目数据 (模拟函数)
async function generateProjectData(projectId?: string) {
  // 模拟项目数据 - 实际实现中会从Jira、GitHub等数据源获取
  const mockProjects = [
    {
      id: 'project-1',
      name: '个人AI助手扩展',
      description: '基于Chrome扩展的智能项目管理和信息处理平台',
      status: 'in-progress',
      overallProgress: 75,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      milestones: [
        {
          id: 'milestone-1',
          name: '网页智能分析系统',
          description: '实现通用网页内容智能分析',
          progress: 90,
          plannedDate: new Date('2024-03-15'),
          actualDate: new Date('2024-03-20'),
          status: 'completed',
          dependencies: [] as string[],
          assignees: [{ id: 'user1', name: '开发者A', role: '前端工程师' }],
          tasks: [
            {
              id: 'task-1',
              title: '实现UniversalContentScript',
              description: '通用内容脚本开发',
              status: 'done',
              assignee: 'user1',
              estimatedHours: 16,
              actualHours: 18,
              priority: 'high',
              dependencies: [],
              startDate: new Date('2024-03-01'),
              endDate: new Date('2024-03-10'),
            },
            {
              id: 'task-2',
              title: '集成Chrome AI',
              description: '集成Chrome内置AI能力',
              status: 'done',
              assignee: 'user1',
              estimatedHours: 12,
              actualHours: 14,
              priority: 'medium',
              dependencies: ['task-1'],
              startDate: new Date('2024-03-10'),
              endDate: new Date('2024-03-18'),
            },
          ],
        },
        {
          id: 'milestone-2',
          name: '项目可视化仪表盘',
          description: '项目进度和团队状态可视化',
          progress: 60,
          plannedDate: new Date('2024-06-15'),
          status: 'in-progress',
          dependencies: ['milestone-1'],
          assignees: [{ id: 'user1', name: '开发者A', role: '前端工程师' }],
          tasks: [
            {
              id: 'task-3',
              title: '甘特图组件开发',
              description: '实现交互式甘特图',
              status: 'in-progress',
              assignee: 'user1',
              estimatedHours: 24,
              actualHours: 16,
              priority: 'high',
              dependencies: [] as string[],
              startDate: new Date('2024-05-01'),
              endDate: new Date('2024-05-20'),
            },
            {
              id: 'task-4',
              title: '依赖关系图组件',
              description: '项目依赖关系可视化',
              status: 'todo',
              assignee: 'user1',
              estimatedHours: 20,
              priority: 'medium',
              dependencies: ['task-3'],
              startDate: new Date('2024-05-20'),
              endDate: new Date('2024-06-10'),
            },
          ],
        },
      ],
      dependencies: [
        {
          id: 'dep-1',
          type: 'design',
          source: 'milestone-1',
          target: 'milestone-2',
          status: 'completed',
          criticality: 'high',
          estimatedCompletion: new Date('2024-03-31'),
          actualCompletion: new Date('2024-03-20'),
        },
      ],
      team: [
        {
          id: 'user1',
          name: '开发者A',
          role: '全栈工程师',
          currentWorkload: 75,
          availability: 80,
          skills: [
            'React',
            'TypeScript',
            'Chrome Extensions',
            'AI Integration',
          ],
          status: 'available',
        },
      ],
      risks: [
        {
          id: 'risk-1',
          title: 'Chrome AI API变更风险',
          description: 'Chrome内置AI API仍在实验阶段，可能发生破坏性变更',
          severity: 'medium',
          probability: 30,
          impact: '可能需要重写AI集成部分',
          mitigation: '维护fallback方案，使用云端AI作为备选',
          owner: 'user1',
          status: 'mitigating',
          identifiedDate: new Date('2024-02-15'),
          targetResolutionDate: new Date('2024-08-01'),
          category: 'technical',
        },
      ],
      lastUpdated: new Date(),
    },
  ];

  if (projectId) {
    return mockProjects.filter((p) => p.id === projectId);
  }

  return mockProjects;
}

// 同步项目数据（预留功能）
async function _syncProjectData(projectId: string) {
  console.log('🔄 同步项目数据:', projectId);

  try {
    // 模拟从多个数据源同步
    // 实际实现中会调用Jira API、GitHub API等

    const syncResults = {
      jira: { synced: 5, updated: 2, errors: 0 },
      github: { synced: 8, updated: 1, errors: 0 },
      confluence: { synced: 3, updated: 0, errors: 0 },
    };

    // 记录同步结果到agentThinking
    const agent = new IntelligentAgent();
    await agent.analyze(
      {
        type: 'data_sync',
        projectId,
        syncResults,
        timestamp: Date.now(),
      },
      {
        type: 'generic',
        analysisDepth: 'quick',
      },
    );

    return {
      success: true,
      syncResults,
      message: '数据同步完成',
    };
  } catch (error) {
    console.error('❌ 数据同步失败:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// 导出项目报告（预留功能）
async function _exportProjectReport(projectId: string) {
  console.log('📊 导出项目报告:', projectId);

  try {
    const projectData = await generateProjectData(projectId);
    const project = projectData[0];

    if (!project) {
      throw new Error('项目不存在');
    }

    // 生成报告数据
    const report = {
      projectName: project.name,
      generatedAt: new Date().toISOString(),
      overallProgress: project.overallProgress,
      milestones: project.milestones.map((m) => ({
        name: m.name,
        progress: m.progress,
        status: m.status,
        tasksTotal: m.tasks.length,
        tasksCompleted: m.tasks.filter((t) => t.status === 'done').length,
      })),
      teamMetrics: {
        totalMembers: project.team.length,
        averageWorkload:
          project.team.reduce((sum, m) => sum + m.currentWorkload, 0) /
          project.team.length,
        skillDistribution: project.team.flatMap((m) => m.skills),
      },
      riskSummary: {
        totalRisks: project.risks.length,
        highRisks: project.risks.filter((r) => r.severity === 'high').length,
        openRisks: project.risks.filter((r) => r.status === 'open').length,
      },
    };

    // 记录导出操作
    const agent = new IntelligentAgent();
    await agent.analyze(
      {
        type: 'report_export',
        projectId,
        reportType: 'project_summary',
        timestamp: Date.now(),
      },
      {
        type: 'generic',
        analysisDepth: 'quick',
      },
    );

    return {
      success: true,
      report,
      downloadUrl: `data:application/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(report, null, 2),
      )}`,
    };
  } catch (error) {
    console.error('❌ 报告导出失败:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// 创建项目项目（预留功能）
async function _createProjectItem(actionType: string, data: any) {
  console.log('✅ 创建项目项目:', actionType, data);

  try {
    const { projectId, type, content, timestamp } = data;

    // 根据类型创建不同的项目
    let newItem = null;

    switch (actionType) {
      case 'create_milestone':
        newItem = {
          id: `milestone-${Date.now()}`,
          name: content.split('\n')[0] || '新里程碑',
          description: content,
          progress: 0,
          plannedDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后
          status: 'on-track',
          dependencies: [] as string[],
          assignees: [] as any[],
          tasks: [] as any[],
        };
        break;

      case 'create_task':
        newItem = {
          id: `task-${Date.now()}`,
          title: content.split('\n')[0] || '新任务',
          description: content,
          status: 'todo',
          assignee: '',
          estimatedHours: 8,
          priority: 'medium',
          dependencies: [] as string[],
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后
        };
        break;

      case 'log_risk':
        newItem = {
          id: `risk-${Date.now()}`,
          title: content.split('\n')[0] || '新风险',
          description: content,
          severity: 'medium',
          probability: 50,
          impact: '待评估',
          mitigation: '待制定',
          owner: '',
          status: 'open',
          identifiedDate: new Date(),
          targetResolutionDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14天后
          category: 'general',
        };
        break;
    }

    // 记录创建操作到agentThinking
    const agent = new IntelligentAgent();
    await agent.analyze(
      {
        type: 'item_creation',
        projectId,
        itemType: type,
        newItem,
        timestamp,
      },
      {
        type: 'project',
        analysisDepth: 'quick',
      },
    );

    return {
      success: true,
      newItem,
      message: `${type}创建成功`,
    };
  } catch (error) {
    console.error('❌ 创建项目项目失败:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
