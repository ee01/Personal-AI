/**
 * 定时消息管理主页面
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect, useRef, useMemo } from 'react';
import { OneClickSetup } from './components/OneClickSetup';
import { ScheduledMessageService } from './ScheduledMessageService';
import { ScheduledMessage, SheetConfig, InitializationResult, Statistics, CreateMessageFormData, BotAutomationConfig, TargetType } from './types';
import {
  AppScriptUpdater,
  APP_SCRIPT_PROJECT_HISTORY_LIMIT_ERROR,
  buildProjectHistoryUrl,
  type AppScriptVersionUsage,
} from './AppScriptUpdater';
import { SheetSchemaUpdater } from './SheetSchemaUpdater';
import { JiraRuleUpdater } from './JiraRuleUpdater';
import Select, { StylesConfig, MultiValue, SingleValue } from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { jiraFetch } from '../jira';
import { getGoogleAuthToken, getGoogleAuthTokenSilently } from '../utils/googleAuth';
import {
  DEFAULT_TIMELINE_PROJECT,
  TIMELINE_PROJECT_OPTIONS,
  getTimelineProjectOption,
  getTimelineSyncDryRunHelp,
  type TimelineSyncDryRunHelp,
  resolveTimelineProjectForSave,
} from './timelineProjects';
import {
  BotConfigDialogMode,
  BotConfigValidityStatus,
  getBotDialogModeForStatus,
  getExecutorRule,
  getJiraAutomationRuleUrl,
  getRingCentralSenderConfig,
  getTimelineSyncRule,
  hasRingCentralSenderCredentials,
  hasExecutorRule,
  hasTimelineSyncRule,
  normalizeSheetConfig,
  shouldRecreateExecutorRuleForRingCentralSenderUpgrade,
  withBotAutomation,
  withRingCentralSender,
} from './botAutomationConfig';
import {
  formatTimelineFrequencyText,
  formatTimelineNextExecutionText,
  isValidTimelineOffsetValue,
  parseTimelineOffsetInputValue,
} from './timelineFormatting';
import {
  buildTimelineMilestoneOptions,
  formatTimelineMilestoneKeys,
  getTimelineMilestoneOption,
  isTimelineMilestoneMissingFromCache,
} from './timelineMilestones';
import {
  formatTimelineCacheAge,
  formatTimelineCacheLastAttempt,
  formatTimelineSyncDryRunResult,
  getTimelineCacheAttemptQuickFixText,
  getTimelineCacheExecutionImpactText,
  getTimelineCacheProjectStatus,
  getTimelineCacheStatusActionText,
  getTimelineCacheStatusLabel,
  getTimelineProjectCacheSaveBlockText,
  parseTimelineCacheStatusResponseText,
  parseTimelineSyncDryRunResponseText,
  shouldAutoRefreshTimelineCacheStatus,
  type TimelineCacheUsage,
  type TimelineCacheStatus,
  type TimelineSyncDryRunResult,
} from './timelineCacheStatus';
import {
  getMemoryServiceClient,
  type OutreachTemplateRuntimeStatusItem,
} from '../services/MemoryServiceClient';
import {
  formatLocalScheduleDate,
  formatLocalScheduleDateTime,
  formatLocalScheduleTimezoneHint,
  hasLocalScheduleTime,
  getTodayLocalScheduleDate,
  isValidLocalScheduleTime,
  normalizeLocalScheduleTime,
  parseLocalScheduleTime,
} from './scheduleDateTime';
import {
  calculateScheduledMessageNextExecution,
  getEmptyScheduleTimeHint,
  getDefaultScheduleTime,
  isExecutorDrivenSchedule,
} from './scheduleNextExecution';
import { formatScheduledMessageFrequency } from './scheduleFrequencyDisplay';
import {
  formatScheduleQueueBlockReason,
  formatScheduleQueuePressure,
  formatScheduleQueueSuggestion,
  formatScheduleQueueSlotSummary,
  formatScheduleQueueSummary,
  getScheduleQueuePressure,
  getScheduleQueueSuggestion,
  getScheduleQueueSummary,
  hasScheduleQueueBlockingRisk,
  hasScheduleQueueSlotRisk,
  type ScheduleQueueSlotSummary,
} from './scheduleQueuePressure';
import {
  formatScheduleHealthIssue,
  formatScheduleHealthSummary,
  getScheduleHealthIssue,
  getScheduleHealthIssues,
  getScheduleHealthRecoverySuggestion,
  getScheduleHealthRecoverySuggestions,
} from './scheduleHealth';
import {
  filterScheduledMessagesForView,
  getScheduledMessageCategories,
  hasScheduledMessagesViewFilters,
  parseScheduledMessagesQueryFilters,
} from './scheduledMessagesFilters';
import {
  buildScheduledMessagesSheetTabUrl,
  getScheduledMessagesSheetTabId,
  type ScheduledMessagesSheetTab,
} from './scheduledSheetLinks';
import { buildRepeatSubmissionFields } from './repeatSubmission';
import { getScheduledMessageStatusToggleAction } from './scheduledMessageStatusActions';
import {
  formatExecutionRouteSummary,
  getScheduledMessageExecutionRoute,
} from './executionRoute';

// react-select 选项类型
interface SelectOption {
  value: string;
  label: string;
}

interface BotConfigWarningState {
  status: BotConfigValidityStatus;
  title: string;
  description: string;
  dialogMode: BotConfigDialogMode;
}

function formatAppScriptUpdateCheckedAt(isoValue: string): string {
  if (!isoValue) {
    return '';
  }

  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString();
}

interface OutreachRuntimeState {
  enabled: boolean;
  ringCentralReady: boolean;
}

const OUTREACH_OPTIONS_HASH = 'outreach-config';
const DEFAULT_QUEUE_SLOT_DISPLAY_LIMIT = 3;
const DEFAULT_SCHEDULE_HEALTH_ISSUE_DISPLAY_LIMIT = 4;

type AddDialogMode = 'default' | 'reminder' | 'outreach';

const PROJECT_VARIABLE_KEYS = [
  '{currentRelease}',
  '{nextRelease}',
  '{currentPhase}',
  '{currentPhaseStartDate}',
  '{currentPhaseStartedWorkdays}',
  '{nextPhase}',
  '{nextPhaseStartDate}',
  '{nextPhaseCountdownWorkdays}',
];

function containsProjectVariableText(...values: Array<string | undefined>): boolean {
  const combinedText = values.filter(Boolean).join('');
  return PROJECT_VARIABLE_KEYS.some(variable => combinedText.includes(variable));
}

// react-select 自定义样式
const selectStyles: StylesConfig<SelectOption, true> = {
  control: (base, state) => ({
    ...base,
    minHeight: '38px',
    borderColor: state.isFocused ? '#007bff' : '#ddd',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(0, 123, 255, 0.25)' : 'none',
    '&:hover': {
      borderColor: '#007bff',
    },
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#007bff' : state.isFocused ? '#e7f3ff' : 'white',
    color: state.isSelected ? 'white' : '#333',
    cursor: 'pointer',
    '&:active': {
      backgroundColor: '#0056b3',
    },
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: '#e7f3ff',
    borderRadius: '4px',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: '#007bff',
    fontWeight: 500,
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: '#007bff',
    '&:hover': {
      backgroundColor: '#007bff',
      color: 'white',
    },
  }),
  placeholder: (base) => ({
    ...base,
    color: '#999',
  }),
  menu: (base) => ({
    ...base,
    zIndex: 9999,
  }),
};

// 单选样式
const singleSelectStyles: StylesConfig<SelectOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: '38px',
    borderColor: state.isFocused ? '#007bff' : '#ddd',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(0, 123, 255, 0.25)' : 'none',
    '&:hover': {
      borderColor: '#007bff',
    },
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#007bff' : state.isFocused ? '#e7f3ff' : 'white',
    color: state.isSelected ? 'white' : '#333',
    cursor: 'pointer',
    '&:active': {
      backgroundColor: '#0056b3',
    },
  }),
  singleValue: (base) => ({
    ...base,
    color: '#333',
  }),
  placeholder: (base) => ({
    ...base,
    color: '#999',
  }),
  menu: (base) => ({
    ...base,
    zIndex: 9999,
  }),
};

/**
 * 解析 CRON 表达式中的 dayOfWeek 字段
 * 支持格式：1-5, 1,3,5, MON-FRI, MON,WED,FRI, 2,4,6
 * 返回数字数组：1=周日, 2=周一, ..., 7=周六（Jira CRON 使用 1-7）
 */
function parseCronDaysOfWeek(dayOfWeek: string): number[] {
  const dayMap: Record<string, number> = {
    'SUN': 1, 'MON': 2, 'TUE': 3, 'WED': 4, 'THU': 5, 'FRI': 6, 'SAT': 7,
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7
  };
  
  const result: number[] = [];
  
  // 处理范围和逗号分隔
  const segments = dayOfWeek.split(',');
  for (const segment of segments) {
    const trimmed = segment.trim().toUpperCase();
    
    // 检查是否是范围（如 1-5, MON-FRI）
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-');
      const startNum = dayMap[start.trim()] || parseInt(start.trim(), 10);
      const endNum = dayMap[end.trim()] || parseInt(end.trim(), 10);
      
      if (!isNaN(startNum) && !isNaN(endNum)) {
        for (let i = startNum; i <= endNum; i++) {
          if (!result.includes(i)) result.push(i);
        }
      }
    } else {
      const num = dayMap[trimmed] || parseInt(trimmed, 10);
      if (!isNaN(num) && !result.includes(num)) {
        result.push(num);
      }
    }
  }
  
  return result.sort((a, b) => a - b);
}

function isTimelineTriggeredMessage(message: ScheduledMessage): boolean {
  return Boolean(message.Timeline_Milestone && !message.Schedule_Date);
}

function requiresBotAutomation(message: ScheduledMessage): boolean {
  return message.Push_Method === 'Bot' || message.Push_Method === 'AI';
}

function isOutreachMessage(message: ScheduledMessage): boolean {
  return message.Push_Method === 'Outreach';
}

function buildOutreachSessionsUrl(templateId?: string, sessionId?: string): string {
  if (sessionId) {
    return chrome.runtime.getURL(`memory-exploring.html#/outreach/${encodeURIComponent(sessionId)}`);
  }

  const params = new URLSearchParams();
  if (templateId) params.set('templateId', templateId);
  const query = params.toString();
  return chrome.runtime.getURL(`memory-exploring.html#/outreach${query ? `?${query}` : ''}`);
}

function formatOutreachTarget(message: ScheduledMessage): string {
  if (message.Target_Type === 'group' && message.Glip_Team_ID && message.Glip_Team_ID.trim()) {
    return message.Glip_Team_ID.trim();
  }

  if (message.Target_Type === 'private' && message.Glip_User_Name && message.Glip_User_Name.trim()) {
    return message.Glip_User_Name.trim();
  }

  if (message.Outreach_Target_Ref && message.Outreach_Target_Ref.trim()) {
    return message.Outreach_Target_Ref.trim();
  }

  return '-';
}

function getOutreachQuestion(message: ScheduledMessage): string {
  return message.Content?.trim() || (message as ScheduledMessage & { Outreach_Question?: string }).Outreach_Question?.trim() || '';
}

function getOutreachResult(message: ScheduledMessage): string {
  return message.Outreach_Result?.trim() || message.Outreach_Last_Result?.trim() || '';
}

function normalizeOutreachTargetLabel(targetType: string | undefined, targetRef: string | undefined): string {
  const raw = targetRef?.trim() || '';
  if (!raw) {
    return targetType === 'group' ? '某个群' : '某个人';
  }

  if (/^https?:\/\//i.test(raw) || /^\d{6,}$/.test(raw)) {
    return targetType === 'group' ? '某个群' : '某个人';
  }

  if (targetType === 'group') {
    return raw;
  }

  const firstToken = raw.split(/[\s@,，]+/).find((item) => item.trim().length > 0);
  return firstToken?.trim() || raw;
}

function buildOutreachTitle(targetType: string | undefined, targetRef: string | undefined, question: string | undefined): string {
  const targetLabel = normalizeOutreachTargetLabel(targetType, targetRef);
  const normalizedQuestion = question?.replace(/\s+/g, ' ').trim() || '';
  const preview = normalizedQuestion.length > 24
    ? `${normalizedQuestion.slice(0, 24).trim()}…`
    : normalizedQuestion;
  return `询问 ${targetLabel}：${preview || '待补充问题'}`;
}

function buildWebAppActionUrl(webAppUrl: string, action: string): string {
  const separator = webAppUrl.includes('?') ? '&' : '?';
  return `${webAppUrl}${separator}action=${encodeURIComponent(action)}`;
}

function formatAppsScriptHttpError(prefix: string, status: number, responseText: string): string {
  const compact = responseText.replace(/\s+/g, ' ').trim();
  const isHtmlError = /^<!doctype html/i.test(compact) || /^<html/i.test(compact);
  if (isHtmlError) {
    return `${prefix}: HTTP ${status} - Google 返回了 HTML 错误页；通常是 Web App URL、权限或多账号登录态问题。`;
  }

  const snippet = compact.slice(0, 120);
  return `${prefix}: HTTP ${status}${snippet ? ` - ${snippet}` : ''}`;
}

async function fetchTimelineCacheStatus(webAppUrl?: string): Promise<TimelineCacheStatus | null> {
  if (!webAppUrl) {
    return null;
  }

  const response = await fetch(buildWebAppActionUrl(webAppUrl, 'getTimelineCacheStatus'), {
    method: 'GET',
    credentials: 'omit',
    headers: {
      'Cache-Control': 'no-cache',
    },
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(formatAppsScriptHttpError('Timeline 缓存状态读取失败', response.status, responseText));
  }

  return parseTimelineCacheStatusResponseText(responseText);
}

async function runTimelineSyncDryRun(dryRunHelp: TimelineSyncDryRunHelp): Promise<TimelineSyncDryRunResult> {
  const headers: Record<string, string> = {
    'Cache-Control': 'no-cache',
  };
  const init: RequestInit = {
    method: dryRunHelp.method,
    credentials: 'omit',
    headers: {
      ...headers,
    },
  };

  if (dryRunHelp.method !== 'GET' && dryRunHelp.customBody) {
    init.headers = {
      ...headers,
      'Content-Type': dryRunHelp.contentType,
    };
    init.body = dryRunHelp.customBody;
  }

  const response = await fetch(dryRunHelp.url, init);

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(formatAppsScriptHttpError('Apps Script dry-run 失败', response.status, responseText));
  }

  return parseTimelineSyncDryRunResponseText(responseText);
}

function formatOutreachSummary(message: ScheduledMessage): string {
  const parts: string[] = [];

  if (message.Outreach_Sync_State && message.Outreach_Sync_State.trim()) {
    parts.push(`同步:${formatOutreachSyncState(message.Outreach_Sync_State)}`);
  }

  if (message.Outreach_Runtime_Status && message.Outreach_Runtime_Status.trim()) {
    parts.push(`会话:${formatOutreachRuntimeStatus(message.Outreach_Runtime_Status)}`);
  }

  const outreachResult = getOutreachResult(message);
  if (outreachResult) {
    const result = outreachResult;
    parts.push(`结果:${result.length > 18 ? `${result.substring(0, 18)}…` : result}`);
  }

  return parts.join(' · ');
}

function buildStatistics(messages: ScheduledMessage[]): Statistics {
  const today = getTodayLocalScheduleDate();

  return {
    total: messages.length,
    active: messages.filter(message => message.Status === 'Active').length,
    paused: messages.filter(message => message.Status === 'Paused').length,
    completed: messages.filter(message => message.Status === 'Completed').length,
    done: messages.filter(message => message.Status === 'Done').length,
    pendingReview: messages.filter(message => message.Status === 'PendingReview').length,
    executedToday: messages.filter(message => message.Last_Exec && message.Last_Exec.startsWith(today)).length,
  };
}

function formatQueueSlotLaneLabel(slot: ScheduleQueueSlotSummary): string {
  return slot.hasExplicitTime ? slot.slotKey : `${slot.slotKey} 后队列`;
}

function formatQueueSlotDelayLabel(slot: ScheduleQueueSlotSummary): string {
  return slot.maxDelayMinutes > 0
    ? `最大延后 ${slot.maxDelayMinutes} 分钟`
    : '优先执行';
}

function formatQueueSlotActionLabel(slot: ScheduleQueueSlotSummary): string {
  return slot.actionTopic
    ? `建议处理：${slot.actionTopic}（第 ${slot.actionPosition}/${slot.slotSize} 个）`
    : '';
}

function formatQueueSlotBlockingLabel(slot: ScheduleQueueSlotSummary): string {
  return slot.blockingCount > 0
    ? `前面 ${slot.blockingCount} 条会先执行`
    : '';
}

function formatQueueSlotSuggestionLabel(slot: ScheduleQueueSlotSummary): string {
  return slot.suggestion ? `建议改到 ${slot.suggestion.label}` : '';
}

function formatQueueSlotRiskLabel(slot: ScheduleQueueSlotSummary): string {
  if (slot.exceedsCompensationWindow) {
    return [
      '可能超过 30 分钟补偿窗口',
      slot.remainingCompensationMinutes > 0
        ? `剩余 ${slot.remainingCompensationMinutes} 分钟`
        : '',
    ].filter(Boolean).join(' · ');
  }

  if (slot.exceedsExecutionWindow) {
    return [
      '可能排到执行日期结束后',
      typeof slot.remainingSameDaySlots === 'number'
        ? `当天剩余约 ${slot.remainingSameDaySlots} 条`
        : '',
    ].filter(Boolean).join(' · ');
  }

  return '';
}

function normalizeOutreachTimestamp(value?: number): string | undefined {
  if (!value || !Number.isFinite(value)) return undefined;
  const ms = value > 1_000_000_000_000 ? value : value * 1000;
  return new Date(ms).toISOString();
}

function hasUpcomingOutreachDispatch(message: ScheduledMessage): boolean {
  if (!message.Next_Exec) return false;
  const parsed = Date.parse(message.Next_Exec);
  return Number.isFinite(parsed) && parsed > Date.now();
}

function summarizeOutreachResult(item: OutreachTemplateRuntimeStatusItem): string | undefined {
  const session = item.latestSession;
  if (!session) return undefined;
  if (session.errorMessage?.trim()) return session.errorMessage.trim();
  if (session.outcome && typeof session.outcome === 'object') {
    const summaryCandidate = (session.outcome.resolvedConclusion ||
      session.outcome.summary ||
      session.outcome.evidenceSummary ||
      session.outcome.reason ||
      session.outcome.answer ||
      session.outcome.answerText ||
      session.outcome.reply) as string | undefined;
    if (typeof summaryCandidate === 'string' && summaryCandidate.trim().length > 0) {
      return summaryCandidate.trim();
    }
  }
  if (session.replyRawText?.trim()) return session.replyRawText.trim();
  if (session.replyClassification?.trim()) {
    return formatOutreachReplyClassification(session.replyClassification.trim());
  }
  return undefined;
}

function getScheduledMessageTooltipContent(message: ScheduledMessage): string {
  if (!isOutreachMessage(message)) {
    return message.Content || '';
  }

  const question = getOutreachQuestion(message);
  const result = getOutreachResult(message);
  if (question && result) {
    return `${question}\n\n询问结果：${result}`;
  }
  return question || (result ? `询问结果：${result}` : '');
}

function formatOutreachSyncState(value?: string): string {
  if (value === 'synced') return '已同步';
  if (value === 'sync_error') return '同步失败';
  if (value === 'paused') return '已暂停';
  if (value === 'cancelled') return '已取消';
  return value || '未知';
}

function formatOutreachRuntimeStatus(value?: string): string {
  if (value === 'pending_approval') return '待审批';
  if (value === 'scheduled') return '已排程';
  if (value === 'waiting_reply') return '等待回复';
  if (value === 'deferred') return '延期等待';
  if (value === 'resolved') return '已拿到结果';
  if (value === 'no_reply') return '无回复';
  if (value === 'escalated') return '已升级';
  if (value === 'cancelled') return '已取消';
  if (value === 'failed') return '失败';
  return value || '未知';
}

function formatOutreachReplyClassification(value?: string): string {
  if (value === 'answer') return '已答复';
  if (value === 'defer') return '稍后回复';
  if (value === 'irrelevant') return '回复不相关';
  if (value === 'decline') return '明确拒绝';
  if (value === 'unclear') return '回复不明确';
  return value || '未知';
}

async function overlayOutreachRuntimeStatus(messages: ScheduledMessage[]): Promise<ScheduledMessage[]> {
  const outreachIds = messages
    .filter((message) => isOutreachMessage(message))
    .map((message) => message.ID)
    .filter(Boolean);
  if (outreachIds.length === 0) {
    return messages;
  }

  try {
    const client = getMemoryServiceClient();
    const runtime = await client.getOutreachTemplateRuntimeStatus(outreachIds, outreachIds.length);
    const mapping = new Map<string, OutreachTemplateRuntimeStatusItem>();
    for (const item of runtime.items) {
      if (item.template?.id) {
        mapping.set(item.template.id, item);
      }
    }

    return messages.map((message) => {
      if (!isOutreachMessage(message)) {
        return message;
      }
      const runtimeItem = mapping.get(message.ID);
      if (!runtimeItem) {
        return message;
      }

      const latestSession = runtimeItem.latestSession;
      const latestResult = summarizeOutreachResult(runtimeItem) || getOutreachResult(message);
      const nextDispatchAt = normalizeOutreachTimestamp(
        Number(runtimeItem.template.scheduleSpec?.nextDispatchAt) || undefined,
      );
      return {
        ...message,
        Target_Type: (runtimeItem.template.targetType as TargetType | undefined) || message.Target_Type,
        Glip_User_Name:
          runtimeItem.template.targetType === 'group'
            ? message.Glip_User_Name
            : runtimeItem.template.targetRef || message.Glip_User_Name,
        Glip_Team_ID:
          runtimeItem.template.targetType === 'group'
            ? runtimeItem.template.targetRef || message.Glip_Team_ID
            : message.Glip_Team_ID,
        Outreach_Target_Type: (runtimeItem.template.targetType as TargetType | undefined) || message.Outreach_Target_Type,
        Outreach_Target_Ref: runtimeItem.template.targetRef || message.Outreach_Target_Ref,
        Outreach_Context: runtimeItem.template.contextTemplate || message.Outreach_Context,
        Outreach_Max_Followup: runtimeItem.template.maxFollowup ?? message.Outreach_Max_Followup,
        Outreach_Followup_Interval_Hours:
          runtimeItem.template.followupIntervalSeconds
            ? Math.max(1, Math.round(runtimeItem.template.followupIntervalSeconds / 3600))
            : message.Outreach_Followup_Interval_Hours,
        Outreach_Sync_State: runtimeItem.template.syncState || message.Outreach_Sync_State,
        Outreach_Runtime_Status: latestSession?.status || message.Outreach_Runtime_Status,
        Outreach_Last_Session_ID: latestSession?.id || message.Outreach_Last_Session_ID,
        Outreach_Result: latestResult,
        Outreach_Last_Result: latestResult,
        Next_Exec: nextDispatchAt || message.Next_Exec,
        Outreach_Last_Updated:
          normalizeOutreachTimestamp(latestSession?.updatedAt || runtimeItem.template.updatedAt) ||
          message.Outreach_Last_Updated,
      };
    });
  } catch (error) {
    console.info('加载 Outreach runtime 状态失败，使用 Sheet 数据兜底:', error);
    return messages;
  }
}

async function backfillOutreachDoneStatus(
  messageService: ScheduledMessageService,
  msgs: ScheduledMessage[],
): Promise<ScheduledMessage[]> {
  const candidates = msgs.filter((message) =>
    isOutreachMessage(message) &&
    message.Status !== 'Done' &&
    message.Outreach_Runtime_Status === 'resolved' &&
    !hasUpcomingOutreachDispatch(message),
  );

  if (candidates.length === 0) {
    return msgs;
  }

  const doneIds = new Set<string>();
  await Promise.all(
    candidates.map(async (message) => {
      try {
        await messageService.updateMessage(message.ID, { Status: 'Done' });
        doneIds.add(message.ID);
      } catch (error) {
        console.warn(`回写主动询问 ${message.ID} 的 Done 状态失败:`, error);
      }
    }),
  );

  if (doneIds.size === 0) {
    return msgs;
  }

  return msgs.map((message) =>
    doneIds.has(message.ID)
      ? { ...message, Status: 'Done' }
      : message,
  );
}

function buildBotConfigWarningState(
  status: BotConfigValidityStatus,
  config?: SheetConfig | null
): BotConfigWarningState {
  switch (status) {
    case 'missing_timeline_sync_rule':
      return {
        status,
        title: 'Timeline 缓存同步未配置',
        description: '检测到您有 Timeline Bot/AI 消息，但缺少 Timeline Sync Rule，相关消息无法读取项目 Milestone 缓存；普通 Bot/AI 不受影响。',
        dialogMode: 'upgrade-sync-only',
      };
    case 'missing_executor_rule':
      return {
        status,
        title: 'Bot 推送配置失效',
        description: '检测到您有待推送的 Bot/AI 消息，但执行规则已不存在，需要重新配置。',
        dialogMode: getBotDialogModeForStatus(status, config),
      };
    case 'missing_both':
      return {
        status,
        title: 'Bot 推送配置失效',
        description: '检测到您有待推送的 Bot/AI 消息，但执行规则和 Timeline Sync Rule 都缺失，需要重新配置。',
        dialogMode: getBotDialogModeForStatus(status, config),
      };
    default:
      return {
        status: 'ok',
        title: '',
        description: '',
        dialogMode: getBotDialogModeForStatus('ok', config),
      };
  }
}

const ScheduledMessagesManager: React.FC = () => {
  const initialQueryFilters = parseScheduledMessagesQueryFilters(window.location.search);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);  // 🔧 新增：是否需要重新授权
  const [config, setConfig] = useState<SheetConfig | null>(null);
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({
    total: 0,
    active: 0,
    paused: 0,
    completed: 0,
    done: 0,
    pendingReview: 0,
    executedToday: 0
  });
  const [service, setService] = useState<ScheduledMessageService | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogMode, setAddDialogMode] = useState<AddDialogMode>('default');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBotConfigDialog, setShowBotConfigDialog] = useState(false);
  const [botConfigDialogMode, setBotConfigDialogMode] = useState<BotConfigDialogMode>('create');
  const [botConfigDefaultEnableRingCentralSender, setBotConfigDefaultEnableRingCentralSender] = useState(false);
  const [botConfigured, setBotConfigured] = useState(false);
  const [timelineBotConfigured, setTimelineBotConfigured] = useState(false);
  const [showBotConfigWarning, setShowBotConfigWarning] = useState(false);
  const [botConfigWarningState, setBotConfigWarningState] = useState<BotConfigWarningState>(
    buildBotConfigWarningState('ok')
  );
  const [filterSelfOnly, setFilterSelfOnly] = useState(() => initialQueryFilters.filterSelfOnly);
  const [filterPendingReview, setFilterPendingReview] = useState(() => initialQueryFilters.filterPendingReview);  // 仅过滤待审核推送
  const [targetMessageId, setTargetMessageId] = useState(() => initialQueryFilters.targetMessageId || '');
  const [selectedCategories, setSelectedCategories] = useState<SelectOption[]>(() =>
    initialQueryFilters.categories.map((category) => ({
      value: category,
      label: category,
    })),
  );
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const targetMessageRowRef = useRef<HTMLTableRowElement | null>(null);
  const [hoveredMessage, setHoveredMessage] = useState<ScheduledMessage | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [appScriptVersion, setAppScriptVersion] = useState<string>('');
  const [latestAppScriptVersion, setLatestAppScriptVersion] = useState<string>('');
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateCheckNeedsAuth, setUpdateCheckNeedsAuth] = useState(false);
  const [updateCheckError, setUpdateCheckError] = useState('');
  const [appScriptVersionUsage, setAppScriptVersionUsage] = useState<AppScriptVersionUsage | null>(null);
  const [appScriptUpdateCheckedAt, setAppScriptUpdateCheckedAt] = useState('');
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null);
  const [outreachRuntime, setOutreachRuntime] = useState<OutreachRuntimeState>({
    enabled: false,
    ringCentralReady: false,
  });
  const [outreachRuntimeLoaded, setOutreachRuntimeLoaded] = useState(false);
  const [queueSummaryNow, setQueueSummaryNow] = useState(() => new Date());
  const [showAllQueueSlots, setShowAllQueueSlots] = useState(false);
  const [showAllScheduleHealthIssues, setShowAllScheduleHealthIssues] = useState(false);
  const timelineSyncRuleUrl = useMemo(
    () => getJiraAutomationRuleUrl(getTimelineSyncRule(config)),
    [config],
  );
  
  useEffect(() => {
    initializeApp();
    void getCurrentUserName();
    void loadOutreachRuntime();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setQueueSummaryNow(new Date()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  
  // 从所有消息中提取 category 选项
  const availableCategories = useMemo(() => {
    const categorySet = new Set<string>();
    messages.forEach(msg => {
      getScheduledMessageCategories(msg.Category).forEach(cat => categorySet.add(cat));
    });
    return Array.from(categorySet).sort().map(cat => ({
      value: cat,
      label: cat
    }));
  }, [messages]);
  
  const initializeApp = async () => {
    try {
      // 检查是否已初始化
      const result = await chrome.storage.local.get(['scheduledMessagesConfig']);
      const savedConfig = result.scheduledMessagesConfig
        ? normalizeSheetConfig(result.scheduledMessagesConfig)
        : null;
      
      if (savedConfig && savedConfig.sheetId) {
        setConfig(savedConfig);
        setIsInitialized(true);
        
        setBotConfigured(hasExecutorRule(savedConfig));
        setTimelineBotConfigured(hasTimelineSyncRule(savedConfig));
        
        // 🔧 优先使用缓存的 token，避免在页面加载时弹出授权窗口
        const token = await getGoogleAuthTokenSilently({ caller: 'ScheduledMessagesManager.init' });
        if (!token) {
          // 如果没有缓存的 token，显示提示让用户手动授权
          console.warn('⚠️ 无缓存的 Google 认证 token，需要用户手动授权');
          setNeedsReauth(true);
        }
        
        if (token) {
          const messageService = new ScheduledMessageService(token);
          setService(messageService);
          const initialMessages = await loadMessages(messageService, false, { deferEnrichment: true });

          // 基础数据到位后先展示页面，其余校验延后到后台
          setIsLoading(false);
          void checkBotConfigValidity(savedConfig, initialMessages);
          return;
        }
      } else {
        setIsInitialized(false);
      }
    } catch (error) {
      console.error('初始化应用失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOutreachRuntime = async () => {
    try {
      const client = getMemoryServiceClient();
      const runtime = await client.getRuntimeConfig();
      const ringCentralReady =
        Boolean(runtime.ringCentralServerUrl?.trim()) &&
        Boolean(runtime.ringCentralClientId?.trim()) &&
        Boolean(runtime.ringCentralClientSecretConfigured) &&
        Boolean(runtime.ringCentralJwtConfigured);
      setOutreachRuntime({
        enabled: Boolean(runtime.outreachEnabled),
        ringCentralReady,
      });
    } catch (error) {
      console.info('加载 Outreach runtime 配置失败，按未配置处理:', error);
      setOutreachRuntime({
        enabled: false,
        ringCentralReady: false,
      });
    } finally {
      setOutreachRuntimeLoaded(true);
    }
  };

  const openOptionsPage = () => {
    if (chrome?.runtime?.openOptionsPage) {
      void chrome.runtime.openOptionsPage();
    }
  };

  const openOutreachOptionsPage = () => {
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL(`options.html#${OUTREACH_OPTIONS_HASH}`)
      : `options.html#${OUTREACH_OPTIONS_HASH}`;
    window.open(url, '_blank');
  };
  
  /**
   * 加载消息列表
   * @param messageService 消息服务
   * @param skipJiraSync 是否跳过 Jira 状态同步（保存消息后可跳过以提升性能）
   */
  const loadMessages = async (
    messageService: ScheduledMessageService,
    skipJiraSync = false,
    options: { deferEnrichment?: boolean } = {},
  ): Promise<ScheduledMessage[]> => {
    try {
      const { deferEnrichment = false } = options;
      const baseMessages = await messageService.getAllMessages();

      setMessages(baseMessages);
      setStatistics(buildStatistics(baseMessages));

      const applyOutreachOverlay = async (
        seedMessages: ScheduledMessage[],
      ): Promise<ScheduledMessage[]> => {
        const outreachOverlayMsgs = await overlayOutreachRuntimeStatus(seedMessages);
        const updatedMsgs = await backfillOutreachDoneStatus(
          messageService,
          outreachOverlayMsgs,
        );

        setMessages(updatedMsgs);
        setStatistics(buildStatistics(updatedMsgs));
        return updatedMsgs;
      };

      const enrichMessages = async (): Promise<ScheduledMessage[]> => {
        const jiraSyncedMsgs = skipJiraSync
          ? baseMessages
          : await syncJiraAutomationStatus(baseMessages, messageService);
        return await applyOutreachOverlay(jiraSyncedMsgs);
      };

      if (deferEnrichment) {
        const outreachFirstPass = await applyOutreachOverlay(baseMessages);
        setIsBackgroundLoading(true);
        void enrichMessages()
          .catch((error) => {
            console.error('后台补充消息状态失败:', error);
          })
          .finally(() => {
            setIsBackgroundLoading(false);
          });
        return outreachFirstPass;
      }

      return await enrichMessages();
    } catch (error) {
      console.error('加载消息失败:', error);
      return [];
    }
  };

  // projectId 缓存，避免重复请求
  const projectIdCacheRef = useRef<Map<string, string>>(new Map());
  
  /**
   * 获取项目 ID（带缓存）
   */
  const getProjectIdFromKeyWithCache = async (jiraUrl: string, projectKey: string): Promise<string | null> => {
    const cacheKey = `${jiraUrl}::${projectKey}`;
    if (projectIdCacheRef.current.has(cacheKey)) {
      return projectIdCacheRef.current.get(cacheKey)!;
    }
    const projectId = await getProjectIdFromKey(jiraUrl, projectKey);
    if (projectId) {
      projectIdCacheRef.current.set(cacheKey, projectId);
    }
    return projectId;
  };
  
  /**
   * 同步 JiraAutomation 状态（优化版本）
   * 按项目分组，每个项目只请求一次 API，大幅减少网络请求
   */
  const syncJiraAutomationStatus = async (
    msgs: ScheduledMessage[], 
    messageService: ScheduledMessageService
  ): Promise<ScheduledMessage[]> => {
    const updatedMsgs = [...msgs];
    let hasUpdates = false;
    
    // 1. 筛选需要同步的消息，并按项目分组
    interface MessageToSync {
      index: number;
      msg: ScheduledMessage;
      linkInfo: { jiraUrl: string; projectKey: string; ruleId: string };
    }
    
    const messagesGroupedByProject = new Map<string, MessageToSync[]>();
    
    for (let i = 0; i < updatedMsgs.length; i++) {
      const msg = updatedMsgs[i];
      
      // 只处理 JiraAutomation 类型的消息
      if (msg.Push_Method !== 'JiraAutomation' || !msg.Automation_Link) {
        continue;
      }
      
      const linkInfo = parseAutomationLink(msg.Automation_Link);
      if (!linkInfo) continue;
      
      const { jiraUrl, projectKey } = linkInfo;
      const groupKey = `${jiraUrl}::${projectKey}`;
      
      if (!messagesGroupedByProject.has(groupKey)) {
        messagesGroupedByProject.set(groupKey, []);
      }
      messagesGroupedByProject.get(groupKey)!.push({ index: i, msg, linkInfo });
    }
    
    // 如果没有需要同步的消息，直接返回
    if (messagesGroupedByProject.size === 0) {
      return msgs;
    }
    
    console.log(`[同步] 需要同步 ${messagesGroupedByProject.size} 个项目的 Jira 规则状态`);
    
    // 2. 并行获取每个项目的所有规则
    const syncTasks = Array.from(messagesGroupedByProject.entries()).map(
      async ([groupKey, messagesToSync]) => {
        const [jiraUrl, projectKey] = groupKey.split('::');
        
        try {
          // 获取项目 ID（带缓存）
          const projectId = await getProjectIdFromKeyWithCache(jiraUrl, projectKey);
          if (!projectId) {
            console.warn(`[同步] 无法获取项目 ${projectKey} 的 ID`);
            return;
          }
          
          // 批量获取该项目的所有规则（单次请求）
          const result = await chrome.runtime.sendMessage({
            type: 'GET_ALL_JIRA_RULES',
            data: { jiraUrl, projectId }
          });
          
          if (!result?.success || !result.rules) {
            console.warn(`[同步] 获取项目 ${projectKey} 的规则失败:`, result?.error);
            return;
          }
          
          // 构建规则 ID 到规则的映射
          const rulesMap = new Map<string, any>();
          for (const rule of result.rules) {
            rulesMap.set(String(rule.id), rule);
          }
          
          // 3. 在本地匹配并更新状态
          const updatePromises: Promise<void>[] = [];
          
          for (const { index, msg, linkInfo } of messagesToSync) {
            const ruleData = rulesMap.get(linkInfo.ruleId);
            if (!ruleData) {
              console.warn(`[同步] 未找到规则 ${linkInfo.ruleId}`);
              continue;
            }
            
            const jiraState = ruleData.state; // 'ENABLED' 或 'DISABLED'
            const expectedStatus = jiraState === 'ENABLED' ? 'Active' : 'Paused';
            
            // 如果状态不一致，更新
            if (msg.Status !== expectedStatus) {
              console.log(`[同步] Jira Rule ${linkInfo.ruleId} 状态不一致: Sheet=${msg.Status}, Jira=${jiraState}, 更新为 ${expectedStatus}`);
              
              // 更新本地状态
              updatedMsgs[index] = { ...msg, Status: expectedStatus };
              hasUpdates = true;
              
              // 异步更新 Sheet（收集到数组中）
              updatePromises.push(
                messageService.updateMessage(msg.ID, { Status: expectedStatus })
                  .then(() => { return; })  // 转换返回类型为 void
                  .catch(err => {
                    console.warn(`[同步] 更新消息 ${msg.ID} 状态失败:`, err);
                  })
              );
            }
          }
          
          // 等待所有 Sheet 更新完成
          await Promise.all(updatePromises);
          
        } catch (error) {
          console.warn(`[同步] 同步项目 ${projectKey} 的规则状态失败:`, error);
        }
      }
    );
    
    // 并行执行所有项目的同步任务
    await Promise.all(syncTasks);
    
    return hasUpdates ? updatedMsgs : msgs;
  };
  
  const checkBotConfigValidity = async (savedConfig: SheetConfig, msgs: ScheduledMessage[]) => {
    try {
      const normalizedConfig = normalizeSheetConfig(savedConfig);
      const executorRule = getExecutorRule(normalizedConfig);
      const timelineSyncRule = getTimelineSyncRule(normalizedConfig);

      const hasPendingAutomationMessages = msgs.some(
        msg => msg.Status === 'Active' && requiresBotAutomation(msg)
      );
      const hasPendingTimelineAutomationMessages = msgs.some(
        msg => msg.Status === 'Active' && requiresBotAutomation(msg) && isTimelineTriggeredMessage(msg)
      );

      const executorConfigured = Boolean(executorRule?.ruleId);
      const timelineSyncConfigured = Boolean(timelineSyncRule?.ruleId);

      setBotConfigured(executorConfigured);
      setTimelineBotConfigured(timelineSyncConfigured);

      if (!hasPendingAutomationMessages) {
        setShowBotConfigWarning(false);
        setBotConfigWarningState(buildBotConfigWarningState('ok', normalizedConfig));
        return;
      }

      const { JiraAutomationService } = await import('./JiraAutomationService');
      const jiraService = new JiraAutomationService();

      let executorExists = executorConfigured;
      if (executorRule?.ruleId && executorRule?.jiraUrl) {
        executorExists = await jiraService.checkRuleExists(
          {
            jiraUrl: executorRule.jiraUrl,
            projectKey: executorRule.projectKey
          },
          executorRule.ruleId
        );
      }

      let timelineSyncExists = timelineSyncConfigured;
      if (timelineSyncRule?.ruleId && timelineSyncRule?.jiraUrl) {
        timelineSyncExists = await jiraService.checkRuleExists(
          {
            jiraUrl: timelineSyncRule.jiraUrl,
            projectKey: timelineSyncRule.projectKey
          },
          timelineSyncRule.ruleId
        );
      }

      setBotConfigured(executorExists);
      setTimelineBotConfigured(timelineSyncExists);

      let status: BotConfigValidityStatus = 'ok';
      if (!executorExists && hasPendingTimelineAutomationMessages) {
        status = timelineSyncExists ? 'missing_executor_rule' : 'missing_both';
      } else if (!executorExists) {
        status = 'missing_executor_rule';
      } else if (!timelineSyncExists && hasPendingTimelineAutomationMessages) {
        status = 'missing_timeline_sync_rule';
      }

      const nextWarningState = buildBotConfigWarningState(status, normalizedConfig);
      setBotConfigWarningState(nextWarningState);
      setShowBotConfigWarning(status !== 'ok');
    } catch (error) {
      console.error('检查 Bot 配置有效性失败:', error);
      // 检查失败不影响正常使用，不显示警告
    }
  };
  
  const handleInitializationComplete = (result: InitializationResult) => {
    if (result.success) {
      // 刷新页面重新加载
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  };
  
  const handleSync = async () => {
    if (!service || !config) return;
    
    setIsLoading(true);
    try {
      await loadMessages(service);
      
      // 检查并补充 Messages / Logs 工作表 ID（如果缺失）
      if (
        config.messagesSheetId === undefined ||
        config.messagesSheetId === null ||
        config.logsSheetId === undefined ||
        config.logsSheetId === null
      ) {
        console.log('⏳ 同步时发现 Messages/Logs 工作表 ID 缺失，尝试获取...');
        try {
          const token = await getGoogleAuthToken({ caller: 'ScheduledMessagesManager.syncWorksheetIds' });
          if (token) {
            const worksheetIds = await fetchScheduledWorksheetIds(token, config.sheetId);
            const updatedConfig = { ...config };
            let hasWorksheetIdUpdates = false;

            if (
              (updatedConfig.messagesSheetId === undefined || updatedConfig.messagesSheetId === null) &&
              worksheetIds.messagesSheetId !== null
            ) {
              updatedConfig.messagesSheetId = worksheetIds.messagesSheetId;
              hasWorksheetIdUpdates = true;
            }

            if (
              (updatedConfig.logsSheetId === undefined || updatedConfig.logsSheetId === null) &&
              worksheetIds.logsSheetId !== null
            ) {
              updatedConfig.logsSheetId = worksheetIds.logsSheetId;
              hasWorksheetIdUpdates = true;
            }

            if (hasWorksheetIdUpdates) {
              // 保存到配置
              await chrome.storage.local.set({ scheduledMessagesConfig: updatedConfig });
              setConfig(updatedConfig);
              console.log('✅ 已补充 Messages/Logs 工作表 ID:', worksheetIds);
            }
          }
        } catch (error) {
          console.error('补充 Messages/Logs 工作表 ID 失败:', error);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // 检查 App Script 更新
  const checkForUpdates = async (
    options: { interactive?: boolean; showCurrentAlert?: boolean } = {},
  ) => {
    const { interactive = false, showCurrentAlert = false } = options;

    try {
      if (!config || !config.webAppUrl) {
        setAppScriptVersionUsage(null);
        setUpdateCheckError('');
        setUpdateAvailable(false);
        return;
      }

      if (interactive) {
        setIsCheckingUpdates(true);
        setUpdateCheckError('');
      }
      
      const token = interactive
        ? await getGoogleAuthToken({ caller: 'ScheduledMessagesManager.checkForUpdates.manual' })
        : await getGoogleAuthTokenSilently({ caller: 'ScheduledMessagesManager.checkForUpdates.auto' });
      if (!token) {
        setUpdateCheckNeedsAuth(true);
        setUpdateCheckError('');
        setUpdateAvailable(false);
        setAppScriptVersionUsage(null);
        if (showCurrentAlert) {
          alert('无法获取 Google 授权，暂时不能检查 App Script 升级状态。');
        }
        return;
      }

      setUpdateCheckNeedsAuth(false);
      
      const updater = new AppScriptUpdater(token, config);
      const result = await updater.checkForUpdates();
      setAppScriptUpdateCheckedAt(new Date().toISOString());
      setLatestAppScriptVersion(result.latestVersion);
      setAppScriptVersionUsage(result.versionUsage || null);

      if (result.error) {
        setUpdateCheckError(result.error);
        setUpdateAvailable(false);
        if (showCurrentAlert) {
          alert(`检查 App Script 升级状态失败: ${result.error}`);
        }
        return;
      }

      setUpdateCheckError('');
      
      if (result.needsUpdate) {
        setUpdateAvailable(true);
        setAppScriptVersion(result.currentVersion);
        console.log(`发现新版本: ${result.latestVersion}`);
        if (showCurrentAlert) {
          alert(`发现 App Script 新版本: ${result.currentVersion} → ${result.latestVersion}`);
        }
      } else {
        setUpdateAvailable(false);
        setAppScriptVersion(result.currentVersion);
        if (showCurrentAlert) {
          alert(`App Script 已是最新版本: ${result.currentVersion}`);
        }
      }
    } catch (error) {
      console.error('检查更新失败:', error);
      setAppScriptUpdateCheckedAt(new Date().toISOString());
      setUpdateCheckError(error instanceof Error ? error.message : String(error));
      setUpdateAvailable(false);
      setAppScriptVersionUsage(null);
      if (showCurrentAlert) {
        alert(`检查 App Script 升级状态失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      if (interactive) {
        setIsCheckingUpdates(false);
      }
    }
  };
  
  // 执行升级版本（包含 Sheet Schema、App Script、Jira Rule 三项更新）
  const handleUpgradeVersion = async () => {
    if (!config) return;
    
    const versionSummary = appScriptVersion && latestAppScriptVersion
      ? `\n\n当前 App Script: ${appScriptVersion}\n最新 App Script: ${latestAppScriptVersion}`
      : '';

    if (!confirm(`确定要升级调度系统吗？${versionSummary}\n\n将依次执行以下升级：\n1. Sheet 表结构升级\n2. App Script Web App 代码升级（先重新确认线上版本，再预检部署和 Web App URL 匹配，保持 Web App URL 不变，提交后确认新版本已生效）\n3. Jira Automation 规则升级\n\n失败项会保留现有版本；如果 App Script 已是最新，会跳过脚本写入和版本创建；如果 deployment 预检、URL 匹配或版本生效确认失败，不会把配置标记为最新，并会尝试回退到升级前 deployment 版本。整个过程可能需要几分钟时间。`)) {
      return;
    }
    
    setIsUpdating(true);
    const updateResults: string[] = [];
    let appScriptRecoveryUrl = '';
    let appScriptRecoveryMessage = '';
    let appScriptRecoveryTitle = 'App Script 需要处理后重试';
    
    try {
      const token = await getGoogleAuthToken({ caller: 'ScheduledMessagesManager.handleUpgrade' });
      if (!token) {
        throw new Error('无法获取 Google 授权');
      }
      
      // 1. 升级 Sheet Schema
      console.log('🔄 开始升级 Sheet Schema...');
      try {
        const schemaUpdater = new SheetSchemaUpdater(token, config);
        const schemaResult = await schemaUpdater.checkAndUpdate();
        
        if (schemaResult.updated) {
          updateResults.push(`✅ Sheet 表结构已升级\n   新增列: ${schemaResult.addedColumns.join(', ')}`);
        } else {
          updateResults.push('✓ Sheet 表结构已是最新');
        }
      } catch (error) {
        console.error('Sheet Schema 升级失败:', error);
        updateResults.push(`⚠️ Sheet 表结构升级失败: ${error.message}`);
      }
      
      // 2. 升级 App Script（延迟 3 秒，等待 Schema 更新完成）
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('🔄 开始升级 App Script...');
      try {
        const appScriptUpdater = new AppScriptUpdater(token, config);
        const appScriptResult = await appScriptUpdater.updateAppScript();
        
        if (appScriptResult.success) {
          const reportedVersion = appScriptResult.currentVersion || appScriptResult.newVersion || '';
          updateResults.push(
            appScriptResult.skipped
              ? `✓ ${appScriptResult.message}，未创建新的脚本版本`
              : `✅ App Script 已升级到 ${appScriptResult.newVersion}`
          );
          setUpdateAvailable(false);
          setAppScriptVersion(reportedVersion);
          setLatestAppScriptVersion(appScriptResult.latestVersion || appScriptResult.newVersion || reportedVersion);
        } else if (
          appScriptResult.errorCode === APP_SCRIPT_PROJECT_HISTORY_LIMIT_ERROR &&
          appScriptResult.helpUrl
        ) {
          appScriptRecoveryUrl = appScriptResult.helpUrl;
          appScriptRecoveryMessage = appScriptResult.helpMessage || '请先清理旧的历史版本后重试升级。';
          appScriptRecoveryTitle = 'App Script 历史版本已达到 200 个上限';
          updateResults.push(
            `⚠️ App Script 升级失败：历史版本已达到 200 个上限\n   处理方式：${appScriptRecoveryMessage}\n   清理页面：${appScriptRecoveryUrl}`
          );
        } else if (appScriptResult.helpUrl) {
          appScriptRecoveryUrl = appScriptResult.helpUrl;
          appScriptRecoveryMessage = appScriptResult.helpMessage || '请检查 Apps Script deployment 配置后重试升级。';
          appScriptRecoveryTitle = 'App Script deployment 需要检查';
          updateResults.push(
            `⚠️ App Script 升级失败：${appScriptResult.message}\n   处理方式：${appScriptRecoveryMessage}\n   检查页面：${appScriptRecoveryUrl}`
          );
        } else {
          throw new Error(appScriptResult.error || '更新失败');
        }
      } catch (error) {
        console.error('App Script 升级失败:', error);
        updateResults.push(`⚠️ App Script 升级失败: ${error.message}`);
      }
      
      // 3. 升级 Jira Automation Rule（延迟 5 秒，避免与上面的更新冲突）
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('🔄 开始升级 Jira Automation Rule...');
      try {
        const jiraUpdater = new JiraRuleUpdater(config);
        const checkResult = await jiraUpdater.checkForUpdates();
        
        if (checkResult.needsUpdate) {
          const jiraResult = await jiraUpdater.updateJiraRule();
          if (jiraResult.success) {
            updateResults.push(`✅ Jira Automation 规则已升级到 ${jiraResult.newVersion}`);
          } else {
            throw new Error(jiraResult.error || '更新失败');
          }
        } else {
          updateResults.push('✓ Jira Automation 规则已是最新');
        }
      } catch (error) {
        console.error('Jira Rule 升级失败:', error);
        updateResults.push(`⚠️ Jira Automation 规则升级失败: ${error.message}`);
      }
      
      // 显示升级结果
      const hasWarnings = updateResults.some(result => result.includes('⚠️'));
      alert(`${hasWarnings ? '⚠️ 升级流程已执行完毕（含失败项）' : '🎉 版本升级完成！'}\n\n${updateResults.join('\n\n')}\n\n页面将重新加载以应用更新...`);

      if (appScriptRecoveryUrl) {
        const shouldOpenRecoveryPage = confirm(
          `${appScriptRecoveryTitle}\n\n${appScriptRecoveryMessage}\n\n是否立即打开检查页面？`
        );
        if (shouldOpenRecoveryPage) {
          window.open(appScriptRecoveryUrl, '_blank');
        }
      }
      
      // 重新加载配置
      await initializeApp();
      
    } catch (error) {
      console.error('版本升级失败:', error);
      alert(`❌ 升级失败: ${error.message}\n\n请稍后重试或联系管理员。`);
    } finally {
      setIsUpdating(false);
    }
  };

  const isAppScriptVersionLimitReached = appScriptVersionUsage?.remaining === 0;
  const shouldSuggestAppScriptVersionCleanup = Boolean(
    appScriptVersionUsage?.nearLimit && appScriptVersionUsage.remaining > 0,
  );
  const appScriptVersionUsageText = appScriptVersionUsage
    ? `Project History 已用 ${appScriptVersionUsage.count}/${appScriptVersionUsage.limit}，剩余 ${appScriptVersionUsage.remaining} 个版本。`
    : '升级前会检查 Project History 版本额度。';
  const appScriptUpdateCheckedAtText = formatAppScriptUpdateCheckedAt(appScriptUpdateCheckedAt);
  const appScriptUpgradeSummary = [
    `当前 ${appScriptVersion || '未知'}`,
    `最新 ${latestAppScriptVersion || '未知'}`,
    appScriptVersionUsage
      ? `Project History ${appScriptVersionUsage.count}/${appScriptVersionUsage.limit}`
      : '升级前预检版本额度',
    appScriptUpdateCheckedAtText ? `检查于 ${appScriptUpdateCheckedAtText}` : '',
    'URL 匹配后更新',
    'Web App URL 不变',
    '失败回退旧部署',
  ].filter(Boolean);
  const appScriptUpgradePreflightSteps = [
    '重新确认线上版本',
    '匹配当前 Web App deployment',
    '检查 Project History 额度',
    '确认新版本已生效',
    '失败回退旧 deployment',
    '更新后同步 Sheet 配置',
  ];
  const appScriptUpgradeGuidance = isAppScriptVersionLimitReached
    ? '请先清理旧版本，避免升级流程被 200 个版本上限阻塞。'
    : shouldSuggestAppScriptVersionCleanup
      ? `Project History 只剩 ${appScriptVersionUsage?.remaining} 个版本，建议先打开 Project History 清理旧版本，再执行升级。`
      : '升级前会重新确认线上版本、预检 deployment 是否匹配当前 Web App URL，并检查版本额度；提交更新后会确认 Web App URL 已返回新版本，确认失败会尝试回退到升级前 deployment 版本，已是最新则跳过脚本写入和版本创建。';

  const handleOpenAppScriptProjectHistory = () => {
    const projectHistoryUrl = appScriptVersionUsage?.projectHistoryUrl
      || (config?.scriptId ? buildProjectHistoryUrl(config.scriptId) : '');
    if (projectHistoryUrl) {
      window.open(projectHistoryUrl, '_blank');
    } else {
      alert('未找到 Script ID，无法打开 App Script Project History。');
    }
  };
  
  // 组件加载时检查更新
  useEffect(() => {
    if (isInitialized && config) {
      checkForUpdates({ interactive: false });
    }
  }, [isInitialized, config]);
  
  const handleOpenScheduledSheetTab = async (
    tab: ScheduledMessagesSheetTab,
    event?: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
  ) => {
    event?.preventDefault();

    if (!config?.sheetUrl) {
      return;
    }

    let nextConfig = config;
    const currentTabId = getScheduledMessagesSheetTabId(config, tab);

    if (currentTabId === undefined || currentTabId === null) {
      console.log(`⏳ ${tab === 'messages' ? 'messagesSheetId' : 'logsSheetId'} 未记录，尝试获取...`);
      try {
        const token = await getGoogleAuthToken({
          caller: tab === 'messages'
            ? 'ScheduledMessagesManager.openMessagesSheet'
            : 'ScheduledMessagesManager.openLogsSheet',
        });

        if (token) {
          const worksheetIds = await fetchScheduledWorksheetIds(token, config.sheetId);
          const updatedConfig = { ...config };
          let hasWorksheetIdUpdates = false;

          if (worksheetIds.messagesSheetId !== null && updatedConfig.messagesSheetId !== worksheetIds.messagesSheetId) {
            updatedConfig.messagesSheetId = worksheetIds.messagesSheetId;
            hasWorksheetIdUpdates = true;
          }

          if (worksheetIds.logsSheetId !== null && updatedConfig.logsSheetId !== worksheetIds.logsSheetId) {
            updatedConfig.logsSheetId = worksheetIds.logsSheetId;
            hasWorksheetIdUpdates = true;
          }

          if (hasWorksheetIdUpdates) {
            await chrome.storage.local.set({ scheduledMessagesConfig: updatedConfig });
            setConfig(updatedConfig);
            nextConfig = updatedConfig;
            console.log('✅ 已获取并保存 Messages/Logs 工作表 ID:', worksheetIds);
          }
        }
      } catch (error) {
        console.error(`获取 ${tab === 'messages' ? 'messagesSheetId' : 'logsSheetId'} 失败:`, error);
      }
    }

    window.open(buildScheduledMessagesSheetTabUrl(nextConfig, tab), '_blank');
  };

  const handleOpenMessagesSheet = (
    event?: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
  ) => handleOpenScheduledSheetTab('messages', event);

  const handleOpenLogsSheet = (
    event?: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
  ) => handleOpenScheduledSheetTab('logs', event);

  // 获取 Messages / Logs Sheet ID
  const fetchScheduledWorksheetIds = async (
    token: string,
    sheetId: string,
  ): Promise<{ messagesSheetId: number | null; logsSheetId: number | null }> => {
    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`获取 Sheet 信息失败: ${response.status}`);
      }
      
      const data = await response.json();
      const messagesSheet = data.sheets.find((s: any) => s.properties.title === 'Messages');
      const logsSheet = data.sheets.find((s: any) => s.properties.title === 'Logs');
      
      if (!messagesSheet) {
        console.warn('未找到 Messages 工作表');
      }

      if (!logsSheet) {
        console.warn('未找到 Logs 工作表');
      }

      return {
        messagesSheetId: messagesSheet?.properties.sheetId ?? null,
        logsSheetId: logsSheet?.properties.sheetId ?? null,
      };
    } catch (error) {
      console.error('fetchScheduledWorksheetIds 失败:', error);
      return { messagesSheetId: null, logsSheetId: null };
    }
  };

  const openBotConfigDialog = (mode?: BotConfigDialogMode) => {
    const nextMode = mode || getBotDialogModeForStatus(botConfigWarningState.status, config);
    setBotConfigDefaultEnableRingCentralSender(false);
    setBotConfigDialogMode(nextMode);
    setShowBotConfigDialog(true);
  };

  const openRingCentralSenderConfigDialog = () => {
    setBotConfigDefaultEnableRingCentralSender(true);
    setBotConfigDialogMode(hasExecutorRule(config) ? 'repair' : 'create');
    setShowBotConfigDialog(true);
  };
  
  const handleAddMessage = () => {
    setAddDialogMode('default');
    setEditingMessage(null);
    setShowAddDialog(true);
  };
  
  const handleAddReminder = () => {
    setAddDialogMode('reminder');
    setEditingMessage(null);
    setShowAddDialog(true);
  };

  const handleAddOutreach = () => {
    setAddDialogMode('outreach');
    setEditingMessage(null);
    setShowAddDialog(true);
  };
  
  // 托管确认弹窗状态
  const [showTakeoverDialog, setShowTakeoverDialog] = useState(false);
  const [takeoverMessage, setTakeoverMessage] = useState<ScheduledMessage | null>(null);
  const [takeoverLoading, setTakeoverLoading] = useState(false);
  const [takeoverError, setTakeoverError] = useState<string>('');
  
  const handleEditMessage = async (message: ScheduledMessage) => {
    // 检查是否是需要托管确认的 JiraAutomation 消息
    // 条件：Push_Method 是 JiraAutomation，有 Schedule_Date，但没有 AI_Endpoint
    const needsTakeoverConfirmation = 
      message.Push_Method === 'JiraAutomation' && 
      message.Schedule_Date && 
      !message.AI_Endpoint &&
      message.Automation_Link;
    
    if (needsTakeoverConfirmation) {
      // 显示托管确认弹窗
      setTakeoverMessage(message);
      setTakeoverError('');
      setShowTakeoverDialog(true);
      return;
    }
    
    // 正常编辑流程
    setAddDialogMode(isOutreachMessage(message) ? 'outreach' : 'default');
    setEditingMessage(message);
    setShowAddDialog(true);
  };
  
  // 处理托管确认
  const handleTakeoverConfirm = async () => {
    if (!takeoverMessage || !service) return;
    
    // 检查 Bot 是否已配置
    if (!botConfigured) {
      alert('⚠️ 托管 Jira 规则需要先配置 Bot 推送功能\n\n托管后的规则将通过 Bot 推送触发执行，请先完成 Bot 配置。');
      setShowTakeoverDialog(false);
      setTakeoverMessage(null);
      openBotConfigDialog();
      return;
    }
    
    setTakeoverLoading(true);
    setTakeoverError('');
    
    try {
      const linkInfo = parseAutomationLink(takeoverMessage.Automation_Link!);
      if (!linkInfo) {
        throw new Error('无法解析 Automation_Link');
      }
      
      const { jiraUrl, projectKey, ruleId } = linkInfo;
      // 使用带缓存的版本
      const projectId = await getProjectIdFromKeyWithCache(jiraUrl, projectKey);
      
      if (!projectId) {
        throw new Error('无法获取项目 ID');
      }
      
      // 获取规则详情，检查 executionMode
      console.log('🔍 检查规则 executionMode...');
      const detailResult = await chrome.runtime.sendMessage({
        type: 'GET_JIRA_RULE_DETAILS',
        data: { jiraUrl, projectId, ruleId }
      });
      
      if (!detailResult?.success || !detailResult.ruleData) {
        throw new Error('无法获取规则详情');
      }
      
      const ruleData = detailResult.ruleData;
      const trigger = ruleData.trigger;
      const executionMode = trigger?.value?.executionMode;
      
      // 检查执行频率是否小于 1 天
      if (trigger && trigger.type === 'jira.jql.scheduled') {
        const schedule = trigger.value?.schedule;
        
        if (schedule) {
          let intervalTooShort = false;
          let intervalDescription = '';
          
          // 检查 method=FIXED
          if (schedule.method === 'FIXED') {
            const rateInterval = schedule.rateInterval || 0;
            
            // rateInterval 单位是分钟，86400 分钟 = 1 天
            if (rateInterval < 86400) {
              intervalTooShort = true;
              const hours = Math.floor(rateInterval / 60);
              const minutes = rateInterval % 60;
              intervalDescription = hours > 0 
                ? `每 ${hours} 小时 ${minutes > 0 ? minutes + ' 分钟' : ''}`
                : `每 ${minutes} 分钟`;
            }
          } 
          // 检查 method=CRON
          else if (schedule.method === 'CRON') {
            const cronExpression = schedule.cronExpression || '';
            
            // 解析 CRON 表达式判断频率
            // CRON 格式: 秒 分 时 日 月 周
            // 例如: "0 0 */12 * * ?" = 每 12 小时执行一次
            // 例如: "0 0 9 ? * MON-FRI" = 每工作日 9:00
            // 例如: "0 0 9 ? * 2,4,6" = 每周一、三、五 9:00
            const parts = cronExpression.split(' ');
            if (parts.length >= 6) {
              const dayOfMonth = parts[3];
              const hours = parts[2];
              const dayOfWeek = parts[5];
              
              // 检查是否是小时级别的执行（时字段包含 */N）
              if (hours.includes('*/')) {
                const hourMatch = hours.match(/^\*\/(\d+)$/);
                if (hourMatch) {
                  const hourInterval = parseInt(hourMatch[1], 10);
                  if (hourInterval < 24) {
                    intervalTooShort = true;
                    intervalDescription = `每 ${hourInterval} 小时`;
                  }
                }
              } else if (hours.includes(',')) {
                // 多个小时执行（例如 "0,6,12,18"）
                const hourList = hours.split(',');
                if (hourList.length > 1) {
                  intervalTooShort = true;
                  intervalDescription = '每天多次执行';
                }
              }
              
              // 检查是否是每 N 天执行（日字段包含 */N，且 N < 1）
              if (dayOfMonth.includes('*/')) {
                const dayMatch = dayOfMonth.match(/^\*\/(\d+)$/);
                if (dayMatch) {
                  const dayInterval = parseInt(dayMatch[1], 10);
                  if (dayInterval < 1) {
                    intervalTooShort = true;
                    intervalDescription = '小于 1 天';
                  }
                }
              }
              
              // 检查是否是一周多天模式（如 MON-FRI, 1,3,5, 2,4,6 等）
              // 这种模式是支持的，每天最多执行一次，不应视为"间隔过短"
              if (!intervalTooShort && dayOfWeek && dayOfWeek !== '*' && dayOfWeek !== '?') {
                // 解析多星期配置，转换为 JS 格式 (0=周日, 1=周一...6=周六)
                const jiraDays = parseCronDaysOfWeek(dayOfWeek);
                if (jiraDays.length > 0) {
                  // 转换 Jira 格式 (1=周日, 2=周一...7=周六) 到 JS 格式 (0=周日, 1=周一...6=周六)
                  const jsDays = jiraDays.map(d => (d - 1) % 7);
                  
                  // 保存解析的星期到消息中
                  (takeoverMessage as any)._parsedRepeatDays = jsDays.join(',');
                  (takeoverMessage as any)._parsedRepeatUnit = 'Week';
                  (takeoverMessage as any)._parsedRepeatEvery = 1;
                  
                  console.log('📅 检测到一周多天模式:', {
                    cronDayOfWeek: dayOfWeek,
                    jiraDays,
                    jsDays,
                    repeatDays: jsDays.join(',')
                  });
                }
              }
            }
          }
          
          // 如果间隔小于 1 天，显示错误并返回
          if (intervalTooShort) {
            setTakeoverError(
              `⚠️ 该规则的执行间隔小于 1 天（${intervalDescription}），无法在 Personal AI 中托管。\n\n` +
              'Personal AI 的调度系统基于 Google Sheets 和 Apps Script，仅支持每天最多执行一次。\n\n' +
              '如果需要更高频率的执行，请保持规则在 Jira Automation 中运行。'
            );
            setTakeoverLoading(false);
            return;
          }
        }
      }
      
      // 检查是否是 nosearch 模式
      if (executionMode !== 'nosearch') {
        setTakeoverError(
          '⚠️ 该规则的触发器使用了 JQL 查询模式（' + (executionMode || 'unknown') + '）。\n\n' +
          '要使用 Personal AI 托管，请先在 Jira 中修改该规则的 Scheduled trigger 为：\n' +
          '"Simply run the conditions and actions without providing issues" 模式，\n' +
          '并使用 JQL branch 替代原有的 Jira 查询功能。\n\n' +
          '修改完成后，请重新尝试托管。'
        );
        setTakeoverLoading(false);
        return;
      }
      
      // 执行 webhook 转换
      console.log('🔄 转换规则为 incoming webhook...');
      const webhookResult = await chrome.runtime.sendMessage({
        type: 'CONVERT_JIRA_RULE_TO_WEBHOOK',
        data: {
          ruleId,
          projectId,
          jiraUrl
        }
      });
      
      if (!webhookResult?.success || !webhookResult.webhookUrl) {
        throw new Error(webhookResult?.error || '转换 webhook 失败');
      }
      
      // 更新 Sheet 中的 AI_Endpoint 和解析的调度配置
      console.log('📝 更新消息的 AI_Endpoint 和调度配置...');
      const aiEndpoint = `POST ${webhookResult.webhookUrl}`;
      
      // 构建更新数据，包含解析的多星期配置
      const updateData: any = { AI_Endpoint: aiEndpoint };
      
      // 如果从 CRON 解析出了多星期配置，一并更新
      if ((takeoverMessage as any)._parsedRepeatDays) {
        updateData.Repeat_Days = (takeoverMessage as any)._parsedRepeatDays;
        updateData.Repeat_Unit = (takeoverMessage as any)._parsedRepeatUnit || 'Week';
        updateData.Repeat_Every = (takeoverMessage as any)._parsedRepeatEvery || 1;
        console.log('📅 同时更新多星期配置:', {
          Repeat_Days: updateData.Repeat_Days,
          Repeat_Unit: updateData.Repeat_Unit,
          Repeat_Every: updateData.Repeat_Every
        });
      }
      
      await service.updateMessage(takeoverMessage.ID, updateData);
      
      // 获取更新后的消息列表用于查找（不更新 state，避免重复请求）
      const updatedMessages = await service.getAllMessages();
      
      // 更新 state（跳过 Jira 同步，因为状态刚刚被手动更新）
      setMessages(updatedMessages);
      setStatistics(buildStatistics(updatedMessages));
      
      // 关闭弹窗并进入编辑模式
      setShowTakeoverDialog(false);
      setTakeoverMessage(null);
      
      // 找到更新后的消息并进入编辑模式
      const updatedMessage = updatedMessages.find(m => m.ID === takeoverMessage.ID);
      
      if (updatedMessage) {
        setAddDialogMode('default');
        setEditingMessage(updatedMessage);
        setShowAddDialog(true);
        alert('✅ 已成功将规则托管给 Personal AI！\n现在可以编辑调度配置了。');
      }
      
    } catch (error: any) {
      console.error('托管失败:', error);
      setTakeoverError(`托管失败: ${error.message}`);
    } finally {
      setTakeoverLoading(false);
    }
  };
  
  // 取消托管确认
  const handleTakeoverCancel = () => {
    setShowTakeoverDialog(false);
    setTakeoverMessage(null);
    setTakeoverError('');
  };
  
  // 批准自动答复消息（将状态改为 Active，并设置下一分钟执行）
  const handleApproveAutoReply = async (message: ScheduledMessage) => {
    if (!service) return;
    
    try {
      const now = new Date();
      const nextMinute = new Date(now.getTime() + 60 * 1000);
      const { dateStr: scheduleDate, timeStr: scheduleTime } =
        formatLocalScheduleDateTime(nextMinute);
      
      await service.updateMessage(message.ID, {
        Status: 'Active',
        Schedule_Date: scheduleDate,
        Schedule_Time: scheduleTime
      });
      
      // 刷新消息列表（跳过 Jira 同步，因为状态已手动更新）
      await loadMessages(service, true);
      
      console.log(`✅ 自动答复已批准: ${message.Topic}`);
    } catch (error) {
      console.error('批准自动答复失败:', error);
      alert('批准失败，请稍后重试');
    }
  };
  
  // 拒绝自动答复消息（将状态改为 Done）
  const handleRejectAutoReply = async (message: ScheduledMessage) => {
    if (!service) return;
    
    const confirmReject = window.confirm(
      `确定要拒绝此自动答复吗？\n\n主题: ${message.Topic}\n内容: ${message.Content.substring(0, 100)}...`
    );
    
    if (!confirmReject) return;
    
    try {
      await service.updateMessage(message.ID, {
        Status: 'Done'
      });
      
      // 刷新消息列表（跳过 Jira 同步，因为状态已手动更新）
      await loadMessages(service, true);
      
      console.log(`❌ 自动答复已拒绝: ${message.Topic}`);
    } catch (error) {
      console.error('拒绝自动答复失败:', error);
      alert('拒绝失败，请稍后重试');
    }
  };
  
  const handleDeleteMessage = async (id: string, topic: string) => {
    if (!service) return;
    
    // 查找消息，检查是否是托管中的 JiraAutomation 消息
    const message = messages.find(m => m.ID === id);
    const isManagedJiraAutomation = message && 
      message.Push_Method === 'JiraAutomation' && 
      message.Schedule_Date && 
      message.AI_Endpoint &&
      message.Automation_Link;
    
    if (isManagedJiraAutomation) {
      // 托管消息需要特殊处理
      const confirmMessage = 
        `⚠️ 删除托管消息\n\n` +
        `消息: "${topic}"\n\n` +
        `此消息正在由 Personal AI 托管，删除后将：\n` +
        `1. 将 Jira Rule 的 trigger 恢复为 Scheduled 模式\n` +
        `2. 从 Personal AI 中移除此消息\n\n` +
        `确定要撤销托管并删除吗？`;
      
      if (!confirm(confirmMessage)) {
        return;
      }
      
      setIsLoading(true);
      try {
        // 先恢复 Jira Rule 的 trigger
        const linkInfo = parseAutomationLink(message.Automation_Link!);
        if (linkInfo) {
          const { jiraUrl, projectKey, ruleId } = linkInfo;
          // 使用带缓存的版本
          const projectId = await getProjectIdFromKeyWithCache(jiraUrl, projectKey);
          
          if (projectId) {
            console.log('🔄 恢复 Jira Rule 的 scheduled trigger...');
            
            // 构建调度配置
            // 解析 Repeat_Days：JS 格式 (0=周日, 1=周一...6=周六) 转换回 Jira 格式 (1=周日, 2=周一...7=周六)
            let scheduleDaysOfWeek: number[] | undefined;
            if (message.Repeat_Days && message.Repeat_Unit === 'Week') {
              scheduleDaysOfWeek = message.Repeat_Days.split(',')
                .map(d => parseInt(d.trim(), 10))
                .filter(d => !isNaN(d))
                .map(d => d + 1);  // JS格式 -> Jira格式
              console.log('📅 恢复多星期配置:', { 
                jsDays: message.Repeat_Days, 
                jiraDays: scheduleDaysOfWeek 
              });
            }
            
            // 将本地时间转换为 UTC 时间（Jira Automation Server 使用 UTC）
            // 本地时间是 UTC+8，所以需要减去 8 小时
            const localTime = message.Schedule_Time || '09:00';
            const [localHours, localMinutes] = localTime.split(':').map(Number);
            const utcHours = (localHours - 8 + 24) % 24;
            const utcTime = `${String(utcHours).padStart(2, '0')}:${String(localMinutes).padStart(2, '0')}`;
            console.log('🕐 时间转换:', { localTime, utcTime, offset: -8 });
            
            const scheduleConfig = {
              scheduleTime: utcTime,  // 使用 UTC 时间
              repeatEvery: Number(message.Repeat_Every) || 1,  // 确保转换为数字
              repeatUnit: (message.Repeat_Unit || 'Day') as 'Day' | 'Week' | 'Month',
              scheduleDaysOfWeek
            };
            
            const convertResult = await chrome.runtime.sendMessage({
              type: 'CONVERT_WEBHOOK_TO_SCHEDULED',
              data: {
                ruleId,
                projectId,
                jiraUrl,
                scheduleConfig
              }
            });
            
            if (!convertResult?.success) {
              const errorMsg = convertResult?.error || '未知错误';
              // 恢复失败，不删除消息
              alert(
                `❌ 恢复 Jira Rule 失败: ${errorMsg}\n\n` +
                `为了数据安全，不会删除 Personal AI 中的消息记录。\n` +
                `请先手动检查并修复 Jira Rule，然后再尝试删除。`
              );
              setIsLoading(false);
              return;
            }
          }
        }
        
        // 只有在恢复成功后才删除消息
        await service.deleteMessage(id);
        if (message && isOutreachMessage(message)) {
          await cancelOutreachTemplateMirror(message.ID);
        }
        await loadMessages(service);
        
        alert(
          '✅ 消息已删除，Jira Rule 已恢复为 Scheduled 模式。\n\n' +
          '请前往 Jira Automation 页面确认规则是否正常运作。'
        );
        
      } catch (error: any) {
        console.error('删除托管消息失败:', error);
        alert(`删除失败: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
      
    } else {
      // 普通消息的删除流程
      if (!confirm(`确定要删除消息 "${topic}" 吗？此操作无法撤销。`)) {
        return;
      }
      
      setIsLoading(true);
      try {
        await service.deleteMessage(id);
        if (message && isOutreachMessage(message)) {
          await cancelOutreachTemplateMirror(message.ID);
        }
        await loadMessages(service);
        alert('消息已删除');
      } catch (error: any) {
        console.error('删除消息失败:', error);
        alert(`删除失败: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  // 从 Automation_Link 解析 Jira 信息
  const parseAutomationLink = (link: string): { jiraUrl: string; projectKey: string; ruleId: string } | null => {
    try {
      // 格式: https://jira.ringcentral.com/secure/AutomationProjectAdminAction!default.jspa?projectKey=MTR#/rule/1646
      const url = new URL(link);
      const jiraUrl = url.origin;
      const projectKey = url.searchParams.get('projectKey') || '';
      const ruleIdMatch = link.match(/#\/rule\/(\d+)/);
      const ruleId = ruleIdMatch ? ruleIdMatch[1] : '';
      
      if (jiraUrl && projectKey && ruleId) {
        return { jiraUrl, projectKey, ruleId };
      }
      return null;
    } catch (error) {
      console.error('解析 Automation_Link 失败:', error);
      return null;
    }
  };
  
  // 获取项目 ID（从项目 key，使用统一的 jiraFetch）
  const getProjectIdFromKey = async (jiraUrl: string, projectKey: string): Promise<string | null> => {
    try {
      const response = await jiraFetch(`${jiraUrl}/rest/api/2/project/${projectKey}`);
      
      if (response.ok) {
        const data = await response.json();
        return data.id;
      }
      return null;
    } catch (error) {
      console.error('获取项目 ID 失败:', error);
      return null;
    }
  };
  
  const handleToggleStatus = async (message: ScheduledMessage) => {
    if (!service) return;
    
    setIsLoading(true);
    try {
      // 如果有 Automation_Link，同时更新 Jira Rule 状态
      if (message.Automation_Link) {
        const linkInfo = parseAutomationLink(message.Automation_Link);
        if (linkInfo) {
          const { jiraUrl, projectKey, ruleId } = linkInfo;
          // 使用带缓存的版本
          const projectId = await getProjectIdFromKeyWithCache(jiraUrl, projectKey);
          
          if (projectId) {
            // 获取规则详情
            const detailResult = await chrome.runtime.sendMessage({
              type: 'GET_JIRA_RULE_DETAILS',
              data: { jiraUrl, projectId, ruleId }
            });
            
            if (detailResult?.success && detailResult.ruleData) {
              // 更新 Jira Rule 状态
              const newState = message.Status === 'Active' ? 'DISABLED' : 'ENABLED';
              const updateResult = await chrome.runtime.sendMessage({
                type: 'UPDATE_JIRA_RULE_STATE',
                data: {
                  jiraUrl,
                  projectId,
                  ruleId,
                  newState,
                  ruleData: detailResult.ruleData
                }
              });
              
              if (!updateResult?.success) {
                console.warn('更新 Jira Rule 状态失败:', updateResult?.error);
                // 不阻止本地状态更新，只是给个警告
              }
            }
          }
        }
      }
      
      const updatedMessage = await service.toggleMessageStatus(message.ID);
      await syncOutreachTemplateMirror(updatedMessage);
      // 跳过 Jira 同步，因为状态刚刚被手动更新了
      await loadMessages(service, true);
    } catch (error) {
      console.error('切换状态失败:', error);
      alert(`切换状态失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSubmitNewMessage = async (formData: CreateMessageFormData) => {
    if (!service) return;
    
    setIsSubmitting(true);
    try {
      const outreachMirrorOverrides = formData.Push_Method === 'Outreach'
        ? {
            targetType: formData.Outreach_Target_Type || 'private',
            targetRef:
              formData.Outreach_Target_Type === 'group'
                ? formData.Glip_Team_ID?.trim() || formData.Outreach_Target_Ref?.trim() || ''
                : formData.Glip_User_Name?.trim() || formData.Outreach_Target_Ref?.trim() || '',
            contextTemplate: formData.Outreach_Context?.trim(),
            maxFollowup: formData.Outreach_Max_Followup,
            followupIntervalHours: formData.Outreach_Followup_Interval_Hours,
          }
        : undefined;

      if (editingMessage) {
        // 编辑模式：更新消息
        const savedMessage = await service.updateMessage(editingMessage.ID, formData);
        let outreachSyncError: Error | null = null;
        
        // 如果是 JiraAutomation 类型且 Topic 发生变化，同步更新 Jira Rule 名称
        if (editingMessage.Push_Method === 'JiraAutomation' && 
            editingMessage.Automation_Link &&
            formData.Topic && 
            formData.Topic !== editingMessage.Topic) {
          try {
            await syncJiraRuleName(editingMessage.Automation_Link, formData.Topic);
          } catch (syncError: any) {
            console.warn('同步 Jira Rule 名称失败:', syncError);
            // 不阻塞主流程，只是警告
          }
        }

        try {
          if (isOutreachMessage(editingMessage) && !isOutreachMessage(savedMessage)) {
            await cancelOutreachTemplateMirror(editingMessage.ID);
          } else {
            await syncOutreachTemplateMirror(savedMessage, outreachMirrorOverrides);
          }
        } catch (syncError: any) {
          outreachSyncError = syncError instanceof Error ? syncError : new Error(syncError?.message || '主动询问同步失败');
        }
        
        // 跳过 Jira 状态同步，因为刚保存的消息状态是一致的
        await loadMessages(service, true);
        setShowAddDialog(false);
        setEditingMessage(null);
        if (outreachSyncError) {
          alert(`消息更新成功，但主动询问同步到 memory service 失败：${outreachSyncError.message}`);
        } else {
          alert('消息更新成功！');
        }
      } else {
        // 新建模式：创建消息
        const savedMessage = await service.createMessage(formData);
        let outreachSyncError: Error | null = null;

        try {
          await syncOutreachTemplateMirror(savedMessage, outreachMirrorOverrides);
        } catch (syncError: any) {
          outreachSyncError = syncError instanceof Error ? syncError : new Error(syncError?.message || '主动询问同步失败');
        }
        // 跳过 Jira 状态同步，因为新建的消息不需要同步
        await loadMessages(service, true);
        setShowAddDialog(false);
        if (outreachSyncError) {
          alert(`消息创建成功，但主动询问同步到 memory service 失败：${outreachSyncError.message}`);
        } else {
          alert('消息创建成功！');
        }
      }
    } catch (error) {
      console.error(editingMessage ? '更新消息失败:' : '创建消息失败:', error);
      alert(`${editingMessage ? '更新' : '创建'}失败: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const syncOutreachTemplateMirror = async (
    message: ScheduledMessage,
    overrides?: {
      targetType?: string;
      targetRef?: string;
      contextTemplate?: string;
      maxFollowup?: number;
      followupIntervalHours?: number;
    },
  ) => {
    if (!isOutreachMessage(message)) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SYNC_OUTREACH_TEMPLATE_MIRROR',
        data: {
          message,
          overrides,
        }
      });

      if (response && response.success === false) {
        throw new Error(response.error || 'backend unavailable');
      }
    } catch (error) {
      console.warn('Outreach template mirror sync failed:', error);
      throw error;
    }
  };

  const cancelOutreachTemplateMirror = async (messageId: string) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CANCEL_OUTREACH_TEMPLATE_MIRROR',
        data: {
          messageId
        }
      });

      if (response && response.success === false) {
        console.info('Outreach template mirror cancel skipped:', response.error || 'backend unavailable');
      }
    } catch (error) {
      console.info('Outreach template mirror cancel unavailable, ignoring:', error);
    }
  };
  
  /**
   * 同步 Topic 到 Jira Automation Rule 名称
   */
  const syncJiraRuleName = async (automationLink: string, newTopic: string) => {
    const linkInfo = parseAutomationLink(automationLink);
    if (!linkInfo) {
      console.warn('无法解析 Automation_Link，跳过同步');
      return;
    }
    
    const { jiraUrl, projectKey, ruleId } = linkInfo;
    // 使用带缓存的版本
    const projectId = await getProjectIdFromKeyWithCache(jiraUrl, projectKey);
    
    if (!projectId) {
      console.warn('无法获取项目 ID，跳过同步');
      return;
    }
    
    // 获取规则详情
    const detailResult = await chrome.runtime.sendMessage({
      type: 'GET_JIRA_RULE_DETAILS',
      data: { jiraUrl, projectId, ruleId }
    });
    
    if (!detailResult?.success || !detailResult.ruleData) {
      throw new Error('无法获取规则详情');
    }
    
    // 更新规则名称
    console.log(`📝 同步 Topic 到 Jira Rule: ${newTopic}`);
    const updateResult = await chrome.runtime.sendMessage({
      type: 'UPDATE_JIRA_RULE_NAME',
      data: {
        jiraUrl,
        projectId,
        ruleId,
        newName: newTopic,
        ruleData: detailResult.ruleData
      }
    });
    
    if (!updateResult?.success) {
      throw new Error(updateResult?.error || '更新规则名称失败');
    }
    
    console.log('✅ Jira Rule 名称同步成功');
  };
  
  const handleCleanupCompleted = async () => {
    if (!service) return;
    
    if (!confirm(`确定要删除所有已完成的消息吗？\n共 ${statistics.done} 条消息将被永久删除。`)) {
      return;
    }
    
    try {
      const deletedCount = await service.deleteCompletedMessages();
      // 跳过 Jira 同步，因为删除的是已完成的消息
      await loadMessages(service, true);
      alert(`成功清理 ${deletedCount} 条已完成的消息！`);
    } catch (error) {
      console.error('清理已完成消息失败:', error);
      alert(`清理失败: ${error.message}`);
    }
  };
  
  // Google Auth Token 已迁移到 utils/googleAuth.ts
  // 使用 getGoogleAuthToken（会弹窗）和 getGoogleAuthTokenSilently（静默）
  
  const getCurrentUserName = async () => {
    try {
      const token = await getGoogleAuthTokenSilently({ caller: 'ScheduledMessagesManager.getCurrentUserName' });
      if (!token) {
        return;
      }
      const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const userInfo = await response.json();
        // userInfo.email 格式如：esone.qiu@ringcentral.com
        const email = userInfo.email || '';
        const username = email.split('@')[0]; // 提取 esone.qiu
        setCurrentUsername(username);
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  };
  
  // 格式化下次执行时间
  const formatNextExec = (message: ScheduledMessage): string => {
    if (message.Status === 'Done' || message.Status === 'Completed') {
      return '已完成';
    }

    // 检查是否为 Timeline 触发
    if (!message.Schedule_Date && message.Timeline_Milestone) {
      return `下次 ${formatTimelineNextExecutionText(message)}`;
    }
    
    // 时间触发：返回原有的 Next_Exec 值
    return message.Next_Exec || '-';
  };

  const isExecutorDrivenMessage = (message: ScheduledMessage): boolean => {
    return isExecutorDrivenSchedule(message);
  };
  
  // 频率格式化函数
  const formatFrequency = (message: ScheduledMessage): string => {
    // 检查是否为只有 Automation_Link 而没有 Schedule_Date 的 Jira Automation 规则
    if (message.Automation_Link && !message.Schedule_Date) {
      return 'JIRA触发器';
    }
    
    // 检查是否为 Timeline 触发
    if (!message.Schedule_Date && message.Timeline_Milestone) {
      return formatTimelineFrequencyText(message);
    }
    
    return formatScheduledMessageFrequency(message);
  };

  const formatDispatchPolicy = (message: ScheduledMessage): string => {
    if (message.Push_Method === 'Outreach') {
      return '';
    }

    if (message.Automation_Link && !message.Schedule_Date) {
      return '';
    }

    const scheduleHealthIssue = getScheduleHealthIssue(message, queueSummaryNow);
    if (scheduleHealthIssue) {
      return formatScheduleHealthIssue(scheduleHealthIssue);
    }

    const hasScheduleTime = hasLocalScheduleTime(message.Schedule_Time);
    if (hasScheduleTime && !isValidLocalScheduleTime(message.Schedule_Time)) {
      return '请编辑为 00:00-23:59';
    }

    if (hasScheduleTime) {
      if (!isExecutorDrivenMessage(message)) {
        return '';
      }

      const queuePressure = getScheduleQueuePressure(messages, message, queueSummaryNow);
      return queuePressure ? formatScheduleQueuePressure(queuePressure) : '';
    }

    if (!isExecutorDrivenMessage(message)) {
      return '未设时间：09:00 执行';
    }

    const nextExecution = calculateScheduledMessageNextExecution(message, queueSummaryNow);
    const nextExecutionDate = nextExecution.slice(0, 10);
    if (nextExecutionDate && nextExecutionDate < formatLocalScheduleDate(queueSummaryNow)) {
      return '未设时间：执行日期已过，请改成今天或未来日期';
    }

    const queuePressure = getScheduleQueuePressure(messages, message, queueSummaryNow);
    return [
      '未设时间：08:00 后排队',
      queuePressure ? formatScheduleQueuePressure(queuePressure) : '',
    ].filter(Boolean).join('；');
  };
  
  // 根据 Push_Method 显示类型
  const getMessageTypeDisplay = (message: ScheduledMessage): string => {
    // 特殊逻辑：sync.service 显示为系统消息
    if (message.Glip_User_Name === 'sync.service') {
      return '系统消息';
    }
    
    switch (message.Push_Method) {
      case 'AI':
        return 'AI Report';
      case 'AsMe':
        return '假装我发的';
      case 'Bot':
        return 'Bot 定时';
      case 'Outreach':
        return '主动询问';
      case 'JiraAutomation':
        return 'JIRA自动化';
      default:
        return message.Push_Method;
    }
  };
  
  // 格式化"发给"列的显示
  const formatRecipient = (message: ScheduledMessage): string => {
    if (message.Push_Method === 'Outreach') {
      return formatOutreachTarget(message);
    }
    
    // 优先显示用户名
    if (message.Glip_User_Name && message.Glip_User_Name.trim()) {
      const usernames = message.Glip_User_Name.split('+');
      const formattedNames = usernames.map(name => {
        // esone.qiu -> Esone
        const parts = name.split('.');
        if (parts.length > 0) {
          return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        }
        return name;
      });
      return formattedNames.join(', ');
    }
    
    // 否则显示群组 ID
    if (message.Glip_Team_ID && message.Glip_Team_ID.trim()) {
      return message.Glip_Team_ID;
    }
    
    return '-';
  };

  const openOutreachSessionsPage = (message: ScheduledMessage) => {
    const url = buildOutreachSessionsUrl(message.ID, message.Outreach_Last_Session_ID);
    window.open(url, '_blank');
  };

  const selectedCategoryValues = useMemo(
    () => selectedCategories.map((category) => category.value),
    [selectedCategories],
  );
  const targetMessage = useMemo(
    () => targetMessageId
      ? messages.find((message) => message.ID === targetMessageId) || null
      : null,
    [messages, targetMessageId],
  );
  const filteredMessages = useMemo(
    () => {
      if (targetMessageId) {
        return targetMessage ? [targetMessage] : [];
      }

      return filterScheduledMessagesForView(messages, {
        selectedCategories: selectedCategoryValues,
        filterPendingReview,
        filterSelfOnly,
        currentUsername,
      });
    },
    [currentUsername, filterPendingReview, filterSelfOnly, messages, selectedCategoryValues, targetMessage, targetMessageId],
  );
  const hasActiveMessageFilters = Boolean(
    targetMessageId ||
    hasScheduledMessagesViewFilters({
      selectedCategories: selectedCategoryValues,
      filterPendingReview,
      filterSelfOnly,
      currentUsername,
    }),
  );
  const activeFilterSummary = [
    targetMessageId ? `消息：${targetMessageId}` : '',
    filterPendingReview ? '待审核' : '',
    filterSelfOnly ? '隐藏仅发给我的消息' : '',
    selectedCategoryValues.length > 0 ? `类别：${selectedCategoryValues.join('、')}` : '',
  ].filter(Boolean).join(' · ');
  const scheduleQueueSummary = useMemo(
    () => getScheduleQueueSummary(
      messages,
      queueSummaryNow,
      showAllQueueSlots ? Number.MAX_SAFE_INTEGER : DEFAULT_QUEUE_SLOT_DISPLAY_LIMIT,
    ),
    [messages, queueSummaryNow, showAllQueueSlots],
  );
  const canToggleQueueSlotDisplay = Boolean(
    scheduleQueueSummary &&
    scheduleQueueSummary.congestedSlotCount > DEFAULT_QUEUE_SLOT_DISPLAY_LIMIT,
  );
  const scheduleHealthIssues = useMemo(
    () => getScheduleHealthIssues(messages, queueSummaryNow),
    [messages, queueSummaryNow],
  );
  const scheduleHealthRecoverySuggestions = useMemo(
    () => getScheduleHealthRecoverySuggestions(messages, queueSummaryNow),
    [messages, queueSummaryNow],
  );
  const visibleScheduleHealthIssues = showAllScheduleHealthIssues
    ? scheduleHealthIssues
    : scheduleHealthIssues.slice(0, DEFAULT_SCHEDULE_HEALTH_ISSUE_DISPLAY_LIMIT);
  const canToggleScheduleHealthIssues = scheduleHealthIssues.length > DEFAULT_SCHEDULE_HEALTH_ISSUE_DISPLAY_LIMIT;
  const hiddenScheduleHealthIssueCount = Math.max(
    0,
    scheduleHealthIssues.length - visibleScheduleHealthIssues.length,
  );
  const focusMessageById = (messageId: string) => {
    setTargetMessageId(messageId);

    const url = new URL(window.location.href);
    url.searchParams.set('messageId', messageId);
    window.history.replaceState(null, document.title, `${url.pathname}${url.search}${url.hash}`);
  };
  const handleApplyQueueSlotSuggestion = async (slot: ScheduleQueueSlotSummary) => {
    if (!service || !slot.actionMessageId || !slot.suggestion) {
      return;
    }

    const message = messages.find(candidate => candidate.ID === slot.actionMessageId);
    if (!message) {
      alert('未找到需要改期的消息，请先同步数据后重试。');
      return;
    }

    setIsSubmitting(true);
    try {
      await service.updateMessage(slot.actionMessageId, {
        Schedule_Date: slot.suggestion.dateStr,
        Schedule_Time: slot.suggestion.timeStr,
      });
      await loadMessages(service, true);
      focusMessageById(slot.actionMessageId);
      alert(`已将「${message.Topic || slot.actionMessageId}」改到 ${slot.suggestion.label}。`);
    } catch (error: any) {
      console.error('应用队列建议时间失败:', error);
      alert(`应用建议时间失败: ${error.message || error}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleApplyScheduleHealthSuggestion = async (messageId: string) => {
    if (!service || !messageId) {
      return;
    }

    const message = messages.find(candidate => candidate.ID === messageId);
    if (!message) {
      alert('未找到需要改期的消息，请先同步数据后重试。');
      return;
    }

    const suggestion = scheduleHealthRecoverySuggestions.get(messageId) ||
      getScheduleHealthRecoverySuggestion(message, queueSummaryNow);
    if (!suggestion) {
      alert('当前消息没有可直接应用的改期建议，请先同步数据后重试。');
      return;
    }

    setIsSubmitting(true);
    try {
      await service.updateMessage(messageId, {
        Schedule_Date: suggestion.dateStr,
        Schedule_Time: suggestion.timeStr,
      });
      await loadMessages(service, true);
      focusMessageById(messageId);
      alert(`已将「${message.Topic || messageId}」改到 ${suggestion.label}。`);
    } catch (error: any) {
      console.error('应用健康告警改期建议失败:', error);
      alert(`应用改期建议失败: ${error.message || error}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  const clearMessageFilters = () => {
    setTargetMessageId('');
    setFilterPendingReview(false);
    setFilterSelfOnly(false);
    setSelectedCategories([]);
    if (targetMessageId) {
      window.history.replaceState(null, document.title, window.location.pathname + window.location.hash);
    }
  };

  useEffect(() => {
    if (!targetMessageId || !targetMessageRowRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      targetMessageRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [targetMessageId, filteredMessages]);

  const showOutreachConfigWarning =
    outreachRuntimeLoaded && (!outreachRuntime.enabled || !outreachRuntime.ringCentralReady);
  const outreachConfigWarningTitle = !outreachRuntime.enabled
    ? '主动询问引擎尚未开启'
    : 'RingCentral 配置尚未完成';
  const outreachConfigWarningDescription = !outreachRuntime.enabled
    ? '“帮我问”和主动询问计划依赖主动询问引擎。请先到 Options 开启，再继续使用。'
    : '“帮我问”需要 RingCentral Server URL、Client ID、Client Secret 和 JWT。补齐后才能创建和派发主动询问。';
  
  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>加载中...</p>
      </div>
    );
  }
  
  if (!isInitialized) {
    return <OneClickSetup onComplete={handleInitializationComplete} />;
  }
  
  // 🔧 需要重新授权的提示
  if (needsReauth) {
    const handleReauth = async () => {
      try {
        const token = await getGoogleAuthToken({ caller: 'ScheduledMessagesManager.handleReauth' });
        if (token) {
          setNeedsReauth(false);
          const messageService = new ScheduledMessageService(token);
          setService(messageService);
          const initialMessages = await loadMessages(messageService, false, { deferEnrichment: true });
          if (config) {
            void checkBotConfigValidity(config, initialMessages);
          }
        }
      } catch (error) {
        console.error('重新授权失败:', error);
        alert('授权失败，请重试');
      }
    };
    
    return (
      <div style={styles.loadingContainer}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '18px', marginBottom: '16px' }}>🔐 需要 Google 授权</p>
          <p style={{ color: '#666', marginBottom: '24px' }}>
            您的 Google 授权已过期，请点击下方按钮重新授权以继续使用定时消息功能。
          </p>
          <button 
            onClick={handleReauth}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            🔓 重新授权
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>⏰ 定时消息管理</h1>
        <div style={styles.headerActions}>
          <button style={styles.reminderButton} onClick={handleAddReminder} title="快速创建个人提醒">
            ⏰ 提醒我
          </button>
          <button
            style={{
              ...styles.reminderButton,
              background: outreachRuntime.enabled && outreachRuntime.ringCentralReady
                ? 'linear-gradient(135deg, #0ea5e9, #2563eb)'
                : '#94a3b8',
              opacity: outreachRuntime.enabled && outreachRuntime.ringCentralReady ? 1 : 0.7,
              cursor: outreachRuntime.enabled && outreachRuntime.ringCentralReady ? 'pointer' : 'not-allowed',
            }}
            onClick={handleAddOutreach}
            title={outreachRuntime.enabled && outreachRuntime.ringCentralReady
              ? '创建主动询问计划'
              : '请先在 Options 中启用主动询问并完成 RingCentral 配置'}
            disabled={!outreachRuntime.enabled || !outreachRuntime.ringCentralReady}
          >
            💬 帮我问
          </button>
          <button style={styles.addButton} onClick={handleAddMessage} title="新增消息">
            ➕ 新增
          </button>
          <button style={styles.syncButton} onClick={handleSync} title="同步数据">
            🔄 同步
          </button>
          {!updateAvailable && (
            <button
              style={styles.checkUpdateButton}
              onClick={() => checkForUpdates({ interactive: true, showCurrentAlert: true })}
              disabled={isCheckingUpdates || isUpdating}
              title="手动检查 App Script 版本；需要授权时会显示 Google 授权窗口"
            >
              {isCheckingUpdates ? '⏳ 检查中...' : '🔎 检查脚本'}
            </button>
          )}
          {updateAvailable && (
            <button 
              style={styles.updateButton} 
              onClick={isAppScriptVersionLimitReached ? handleOpenAppScriptProjectHistory : handleUpgradeVersion}
              disabled={isUpdating}
              title={isAppScriptVersionLimitReached
                ? `${appScriptVersionUsageText}请先清理旧版本后再升级。`
                : `当前 App Script: ${appScriptVersion || '未知'}，最新: ${latestAppScriptVersion || '未知'}。将同时检查 Sheet、Script、Jira Rule；升级前会重新确认线上版本并校验 deployment 的 Web App URL 匹配，提交后确认 Web App URL 已返回新版本，确认失败会尝试回退旧 deployment，已是最新时不会重复创建脚本版本。${appScriptVersionUsage ? ` ${appScriptVersionUsageText}` : ''}${shouldSuggestAppScriptVersionCleanup ? ' 版本额度接近上限，建议先清理旧版本。' : ''}`}
            >
              {isUpdating
                ? '⏳ 升级中...'
                : isAppScriptVersionLimitReached ? '🧹 清理脚本版本' : '🚀 升级调度系统'}
            </button>
          )}
          <button style={styles.configButton} onClick={handleOpenLogsSheet} title="查看推送记录">
            📊 推送记录
          </button>
        </div>
      </header>

      {updateCheckNeedsAuth && (
        <div style={styles.updateAuthBanner}>
          <div style={styles.warningContent}>
            <span style={styles.warningIcon}>🔐</span>
            <div style={styles.warningText}>
              <strong>无法自动检查 App Script 升级</strong>
              <p style={styles.warningDescription}>
                当前没有可复用的 Google 授权。自动检查已跳过，点击右侧按钮后再授权检查。
              </p>
            </div>
          </div>
          <button
            style={styles.warningButton}
            onClick={() => checkForUpdates({ interactive: true, showCurrentAlert: true })}
            disabled={isCheckingUpdates || isUpdating}
          >
            {isCheckingUpdates ? '检查中...' : '检查脚本'}
          </button>
        </div>
      )}

      {updateCheckError && !updateCheckNeedsAuth && !updateAvailable && (
        <div style={styles.updateErrorBanner}>
          <div style={styles.warningContent}>
            <span style={styles.warningIcon}>⚠️</span>
            <div style={styles.warningText}>
              <strong>无法确认 App Script 升级状态</strong>
              <p style={styles.updateErrorDescription}>
                {updateCheckError} 当前脚本不会被自动改动；请修复后重试检查。
              </p>
            </div>
          </div>
          <button
            style={styles.updateErrorButton}
            onClick={() => checkForUpdates({ interactive: true, showCurrentAlert: true })}
            disabled={isCheckingUpdates || isUpdating}
          >
            {isCheckingUpdates ? '检查中...' : '重试检查'}
          </button>
        </div>
      )}

      {updateAvailable && (
        <div style={styles.updateAvailableBanner}>
          <div style={styles.warningContent}>
            <span style={styles.warningIcon}>🚀</span>
            <div style={styles.warningText}>
              <strong>
                {isAppScriptVersionLimitReached
                  ? 'App Script 可升级，但版本历史已满'
                  : shouldSuggestAppScriptVersionCleanup
                    ? 'App Script 可升级，版本历史接近上限'
                    : 'App Script 可升级'}
              </strong>
              <p style={styles.updateDescription}>
                {appScriptUpgradeGuidance}
              </p>
              <div style={styles.updateMetaRow}>
                {appScriptUpgradeSummary.map((item) => (
                  <span key={item} style={styles.updateMetaItem}>{item}</span>
                ))}
              </div>
              <div style={styles.updatePreflightRow} aria-label="App Script 升级前检查">
                {appScriptUpgradePreflightSteps.map((step, index) => (
                  <span key={step} style={styles.updatePreflightItem}>
                    <strong style={styles.updatePreflightItemNumber}>{index + 1}</strong>
                    {step}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div style={styles.updateBannerActions}>
            {shouldSuggestAppScriptVersionCleanup && (
              <button
                style={styles.secondaryUpdateBannerButton}
                onClick={handleOpenAppScriptProjectHistory}
                disabled={isUpdating}
              >
                打开 Project History
              </button>
            )}
            <button
              style={styles.updateBannerButton}
              onClick={isAppScriptVersionLimitReached ? handleOpenAppScriptProjectHistory : handleUpgradeVersion}
              disabled={isUpdating}
            >
              {isUpdating ? '升级中...' : isAppScriptVersionLimitReached ? '打开 Project History' : '升级调度系统'}
            </button>
          </div>
        </div>
      )}
      
      {/* Bot 配置失效警告 */}
      {showBotConfigWarning && (
        <div style={styles.warningBanner}>
          <div style={styles.warningContent}>
            <span style={styles.warningIcon}>⚠️</span>
            <div style={styles.warningText}>
              <strong>{botConfigWarningState.title}</strong>
              <p style={styles.warningDescription}>
                {botConfigWarningState.description}
              </p>
            </div>
          </div>
          <button 
            style={styles.warningButton}
            onClick={() => openBotConfigDialog(botConfigWarningState.dialogMode)}
          >
            {botConfigWarningState.status === 'missing_timeline_sync_rule' ? '🔧 补齐 Timeline Sync' : '🔧 重新配置'}
          </button>
        </div>
      )}

      {showOutreachConfigWarning && (
        <div style={styles.warningBanner}>
          <div style={styles.warningContent}>
            <span style={styles.warningIcon}>💬</span>
            <div style={styles.warningText}>
              <strong>{outreachConfigWarningTitle}</strong>
              <p style={styles.warningDescription}>
                {outreachConfigWarningDescription}
              </p>
            </div>
          </div>
          <button
            style={styles.warningButton}
            onClick={openOutreachOptionsPage}
          >
            🔧 前往主动询问配置
          </button>
        </div>
      )}

      {scheduleHealthIssues.length > 0 && (
        <div style={styles.queueRiskBanner}>
          <div style={styles.warningContent}>
            <span style={styles.warningIcon}>⏰</span>
            <div style={styles.warningText}>
              <strong>有定时消息需要改期</strong>
              <p style={styles.queueRiskDescription}>
                {formatScheduleHealthSummary(scheduleHealthIssues)}
              </p>
              <div style={styles.queueSlotList}>
                {visibleScheduleHealthIssues.map(issue => {
                  const message = messages.find(candidate => candidate.ID === issue.messageId);
                  const recoverySuggestion = message
                    ? scheduleHealthRecoverySuggestions.get(issue.messageId) ||
                      getScheduleHealthRecoverySuggestion(message, queueSummaryNow)
                    : null;

                  return (
                    <div
                      key={issue.messageId}
                      style={styles.queueIssueItem}
                      title={formatScheduleHealthIssue(issue)}
                    >
                      <span style={styles.queueIssueText}>
                        {issue.topic}: {formatScheduleHealthIssue(issue)}
                        {recoverySuggestion && (
                          <small style={styles.queueIssueSuggestionText}>
                            建议改到 {recoverySuggestion.label}。{recoverySuggestion.reason}
                          </small>
                        )}
                      </span>
                      <div style={styles.queueIssueActions}>
                        <button
                          type="button"
                          style={styles.queueIssueButton}
                          onClick={() => focusMessageById(issue.messageId)}
                        >
                          定位
                        </button>
                        <button
                          type="button"
                          style={styles.queueIssueButton}
                          onClick={() => {
                            if (message) {
                              void handleEditMessage(message);
                            }
                          }}
                        >
                          编辑
                        </button>
                        {recoverySuggestion && (
                          <button
                            type="button"
                            style={{
                              ...styles.queueIssueButton,
                              ...(isSubmitting ? styles.queueIssueButtonDisabled : {}),
                            }}
                            onClick={() => handleApplyScheduleHealthSuggestion(issue.messageId)}
                            disabled={isSubmitting}
                            aria-label={`将${issue.topic || issue.messageId}改到${recoverySuggestion.label}`}
                            title={recoverySuggestion.reason}
                          >
                            一键改期
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {canToggleScheduleHealthIssues && (
                <div style={styles.queueMoreRow}>
                  <button
                    type="button"
                    style={styles.queueIssueButton}
                    onClick={() => setShowAllScheduleHealthIssues(value => !value)}
                  >
                    {showAllScheduleHealthIssues
                      ? '收起需处理消息'
                      : `显示全部 ${scheduleHealthIssues.length} 条需处理消息`}
                  </button>
                  {!showAllScheduleHealthIssues && hiddenScheduleHealthIssueCount > 0 && (
                    <span style={styles.queueMoreText}>
                      还有 {hiddenScheduleHealthIssueCount} 条需处理消息未显示
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {scheduleQueueSummary && (
        <div style={scheduleQueueSummary.riskSlotCount > 0 ? styles.queueRiskBanner : styles.queueInfoBanner}>
          <div style={styles.warningContent}>
            <span style={styles.warningIcon}>{scheduleQueueSummary.riskSlotCount > 0 ? '⏱️' : '📬'}</span>
            <div style={styles.warningText}>
              <strong>
                {scheduleQueueSummary.riskSlotCount > 0 ? '执行器队列可能延迟' : '执行器队列正在排队'}
              </strong>
              <p style={scheduleQueueSummary.riskSlotCount > 0 ? styles.queueRiskDescription : styles.queueInfoDescription}>
                {formatScheduleQueueSummary(scheduleQueueSummary)}
              </p>
              <div style={styles.queueSlotList}>
                {scheduleQueueSummary.topSlots.map(slot => (
                  <div
                    key={`${slot.hasExplicitTime ? 'explicit' : 'no-time'}:${slot.slotKey}`}
                    style={styles.queueSlotItem}
                    title={formatScheduleQueueSlotSummary(slot)}
                    aria-label={formatScheduleQueueSlotSummary(slot)}
                  >
                    <div style={styles.queueSlotContent}>
                      <div style={styles.queueSlotHeader}>
                        <span style={styles.queueSlotLane}>
                          {formatQueueSlotLaneLabel(slot)}
                        </span>
                        <span style={hasScheduleQueueSlotRisk(slot) ? styles.queueSlotRiskPill : styles.queueSlotDelayPill}>
                          {formatQueueSlotDelayLabel(slot)}
                        </span>
                        <span style={styles.queueSlotCountPill}>
                          {slot.slotSize} 条
                        </span>
                      </div>
                      {hasScheduleQueueSlotRisk(slot) && (
                        <div style={styles.queueSlotRiskText}>
                          {formatQueueSlotRiskLabel(slot)}
                        </div>
                      )}
                      {slot.actionTopic && (
                        <div style={styles.queueSlotActionText}>
                          {formatQueueSlotActionLabel(slot)}
                        </div>
                      )}
                      {slot.blockingCount > 0 && (
                        <div style={styles.queueSlotBlockingText}>
                          <span>{formatQueueSlotBlockingLabel(slot)}</span>
                          {slot.blockingTopics.length > 0 && (
                            <span style={styles.queueSlotInlineList}>
                              {slot.blockingTopics.map((topic, index) => (
                                <span key={`${topic}:${index}`} style={styles.queueSlotBlockingTopic}>
                                  {topic}
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                      )}
                      {slot.suggestion && (
                        <div style={styles.queueSlotSuggestionText}>
                          {formatQueueSlotSuggestionLabel(slot)}
                        </div>
                      )}
                      {slot.sampleTopics.length > 0 && (
                        <div style={styles.queueSlotSampleList}>
                          <span style={styles.queueSlotSampleLabel}>示例</span>
                          {slot.sampleTopics.map((topic, index) => (
                            <span key={`${topic}:${index}`} style={styles.queueSlotSampleTopic}>
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {slot.actionMessageId && (
                      <div style={styles.queueIssueActions}>
                        <button
                          type="button"
                          style={styles.queueIssueButton}
                          onClick={() => focusMessageById(slot.actionMessageId)}
                        >
                          定位最晚
                        </button>
                        <button
                          type="button"
                          style={styles.queueIssueButton}
                          onClick={() => {
                            const message = messages.find(candidate => candidate.ID === slot.actionMessageId);
                            if (message) {
                              void handleEditMessage(message);
                            }
                          }}
                        >
                          编辑
                        </button>
                        {slot.suggestion && (
                          <button
                            type="button"
                            style={{
                              ...styles.queueIssueButton,
                              ...(isSubmitting ? styles.queueIssueButtonDisabled : {}),
                            }}
                            onClick={() => handleApplyQueueSlotSuggestion(slot)}
                            disabled={isSubmitting}
                            aria-label={`将${slot.actionTopic || slot.actionMessageId}改到建议时间${slot.suggestion.label}`}
                            title={`改到 ${slot.suggestion.label}`}
                          >
                            改到建议
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {canToggleQueueSlotDisplay && (
                <div style={styles.queueMoreRow}>
                  <button
                    type="button"
                    style={styles.queueIssueButton}
                    onClick={() => setShowAllQueueSlots(value => !value)}
                  >
                    {showAllQueueSlots
                      ? '收起队列槽位'
                      : `显示全部 ${scheduleQueueSummary.congestedSlotCount} 个时间槽`}
                  </button>
                  {!showAllQueueSlots && scheduleQueueSummary.hiddenSlotCount > 0 && (
                    <span style={styles.queueMoreText}>
                      还有 {scheduleQueueSummary.hiddenSlotCount} 个时间槽未显示
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div style={styles.statusBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
          <span style={styles.statusItem}>
            📊 状态：<strong>已初始化</strong>
          </span>
          <span style={styles.statusItem}>
            总计: <strong>{statistics.total}</strong>
          </span>
          <span style={styles.statusItem}>
            活跃: <strong style={{ color: '#28a745' }}>{statistics.active}</strong>
          </span>
          <span style={styles.statusItem}>
            暂停: <strong style={{ color: '#ffc107' }}>{statistics.paused}</strong>
          </span>
          <span style={styles.statusItem}>
            已完成: <strong style={{ color: '#6c757d' }}>{statistics.done}</strong>
          </span>
          {statistics.pendingReview > 0 && (
            <span style={styles.statusItem}>
              待审核: <strong style={{ color: '#ff9800' }}>{statistics.pendingReview}</strong>
            </span>
          )}
          <span style={styles.statusItem}>
            今日已执行: <strong style={{ color: '#007bff' }}>{statistics.executedToday}</strong>
          </span>
          {isBackgroundLoading && (
            <span style={styles.statusItem}>后台补充状态中...</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* 只看待审核推送 */}
          {statistics.pendingReview > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filterPendingReview}
                onChange={(e) => setFilterPendingReview(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ color: '#ff9800', fontWeight: 500 }}>只看待审核</span>
            </label>
          )}
          {statistics.done > 0 && (
            <button
              onClick={handleCleanupCompleted}
              style={{
                padding: '6px 12px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500
              }}
              title={`清理 ${statistics.done} 条已完成的消息`}
            >
              🗑️ 清理已完成 ({statistics.done})
            </button>
          )}
          {/* Category 筛选框 */}
          <div style={{ minWidth: '200px' }}>
            <Select<SelectOption, true>
              isMulti
              options={availableCategories}
              value={selectedCategories}
              onChange={(newValue: MultiValue<SelectOption>) => setSelectedCategories([...newValue])}
              placeholder="🏷️ 筛选类别..."
              styles={selectStyles}
              noOptionsMessage={() => '暂无类别'}
              isClearable
            />
          </div>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            color: '#666',
            userSelect: 'none'
          }}>
            <input 
              type="checkbox"
              checked={filterSelfOnly}
              onChange={(e) => setFilterSelfOnly(e.target.checked)}
              style={{ marginRight: '6px', cursor: 'pointer' }}
            />
            过滤掉仅发我的
          </label>
        </div>
      </div>
      
      {targetMessageId && (
        <div style={styles.targetReviewBanner}>
          <div style={styles.targetReviewText}>
            <strong>已定位消息</strong>
            <span>
              {targetMessage
                ? `消息 ${targetMessageId}，当前状态：${targetMessage.Status}`
                : `消息 ${targetMessageId} 未在维护表中找到`}
            </span>
          </div>
          <button
            type="button"
            style={styles.targetReviewButton}
            onClick={clearMessageFilters}
          >
            返回完整列表
          </button>
        </div>
      )}

      <div style={styles.content}>
        {messages.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>暂无定时消息</p>
            <p style={styles.emptyHint}>
              请在 <a href="#" onClick={handleOpenMessagesSheet}>Google Sheet</a> 中添加消息
            </p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>当前筛选没有匹配消息</p>
            <p style={styles.emptyHint}>
              {activeFilterSummary || '当前列表没有满足条件的消息'}。清除筛选后可查看全部 {messages.length} 条消息。
            </p>
            {hasActiveMessageFilters && (
              <button
                type="button"
                style={styles.emptyActionButton}
                onClick={clearMessageFilters}
              >
                清除筛选
              </button>
            )}
          </div>
        ) : (
          <div style={styles.messageList}>
            <table style={styles.table}>
              <colgroup>
                <col style={styles.typeColumn} />
                <col style={styles.topicColumn} />
                <col style={styles.categoryColumn} />
                <col style={styles.recipientColumn} />
                <col style={styles.frequencyColumn} />
                <col style={styles.nextExecColumn} />
                <col style={styles.sentCountColumn} />
                <col style={styles.statusColumn} />
                <col style={styles.actionsColumn} />
              </colgroup>
              <thead>
                <tr>
                  <th style={styles.th}>类型</th>
                  <th style={styles.th}>主题</th>
                  <th style={styles.th}>类别</th>
                  <th style={styles.th}>发给</th>
                  <th style={styles.th}>频率</th>
                  <th style={styles.th}>下次执行</th>
                  <th style={styles.th}>已发</th>
                  <th style={styles.th}>状态</th>
                  <th style={styles.th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredMessages.map((message) => {
                    const questionPreview = getOutreachQuestion(message);
                    const displayTitle = message.Topic || (
                      questionPreview.length > 30 ? `${questionPreview.substring(0, 30)}...` : questionPreview
                    );
                    const frequencyText = formatFrequency(message);
                    const scheduleHealthIssue = getScheduleHealthIssue(message, queueSummaryNow);
                    const dispatchPolicy = formatDispatchPolicy(message);
                    const executionRoute = getScheduledMessageExecutionRoute(message, {
                      botConfigured,
                      ringCentralSenderConfigured: hasRingCentralSenderCredentials(config),
                      outreachEnabled: outreachRuntime.enabled,
                      outreachConfigured: outreachRuntime.ringCentralReady,
                    });
                    const executionRouteSummary = formatExecutionRouteSummary(executionRoute);
                    const nextExecText = formatNextExec(message);
                    const statusToggleAction = getScheduledMessageStatusToggleAction(message.Status);
                    return (
                      <tr 
                        key={message.ID} 
                        ref={(element) => {
                          if (message.ID === targetMessageId) {
                            targetMessageRowRef.current = element;
                          }
                        }}
                        style={message.ID === targetMessageId
                          ? { ...styles.tr, ...styles.targetedMessageRow }
                          : styles.tr}
                        onMouseMove={(e) => {
                          setHoveredMessage(message);
                          setTooltipPosition({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseLeave={() => {
                          setHoveredMessage(null);
                        }}
                      >
                        <td style={styles.td}>
                          <span style={getTypeStyle(message.Push_Method)}>
                            {getMessageTypeDisplay(message)}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.topicText} title={displayTitle}>
                            {message.Category?.includes('自动答复') && (
                              <span title="自动答复消息" style={{ marginRight: '4px' }}>🤖</span>
                            )}
                            {displayTitle}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {message.Category ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {message.Category.split(',').map((cat, idx) => (
                                <span key={idx} style={styles.categoryTag}>
                                  {cat.trim()}
                                </span>
                              ))}
                            </div>
                          ) : '-'}
                        </td>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span>{formatRecipient(message)}</span>
                            {message.Push_Method === 'Outreach' && formatOutreachSummary(message) && (
                              <small style={{ color: '#6c757d', lineHeight: 1.4 }}>
                                {formatOutreachSummary(message)}
                              </small>
                            )}
                          </div>
                        </td>
                        <td style={{ ...styles.td, ...styles.frequencyCell }}>
                          <div style={styles.frequencyStack}>
                            <span style={styles.frequencyPrimaryText} title={frequencyText}>{frequencyText}</span>
                            <small
                              style={executionRoute.state === 'needs_setup' ? styles.schedulePolicyWarningText : styles.schedulePolicyText}
                              title={executionRouteSummary}
                            >
                              {executionRoute.engine}
                            </small>
                            {dispatchPolicy && (
                              <small
                                style={scheduleHealthIssue ? styles.schedulePolicyWarningText : styles.schedulePolicyText}
                                title={dispatchPolicy}
                              >
                                {dispatchPolicy}
                              </small>
                            )}
                          </div>
                        </td>
                        <td style={{ ...styles.td, ...styles.nextExecCell }} title={nextExecText}>{nextExecText}</td>
                        <td style={{ ...styles.td, ...styles.sentCountCell }}>{message.Exec_Count || 0} 次</td>
                        <td style={{ ...styles.td, ...styles.statusCell }}>
                          <span 
                            style={getStatusStyle(message.Status)}
                            title={statusToggleAction.title}
                          >
                            {message.Status}
                          </span>
                        </td>
                        <td style={{ ...styles.td, ...styles.actionCell }}>
                          <div style={styles.rowActions}>
                            {/* 待审核消息的快速操作按钮 */}
                            {message.Status === 'PendingReview' && (
                              <>
                                <button 
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: 500
                                  }}
                                  onClick={() => handleApproveAutoReply(message)}
                                  title="批准发送（将在下一分钟执行）"
                                >
                                  ✓ 批准
                                </button>
                                <button 
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: 500
                                  }}
                                  onClick={() => handleRejectAutoReply(message)}
                                  title="拒绝此自动答复"
                                >
                                  ✗ 拒绝
                                </button>
                              </>
                            )}
                            {message.Automation_Link && (
                              <button 
                                style={styles.jiraLinkButton}
                                onClick={() => window.open(message.Automation_Link, '_blank')}
                                title="打开 Jira Automation Rule"
                              >
                                🔗
                              </button>
                            )}
                            {message.Push_Method === 'Outreach' && (
                              <button
                                style={{
                                  ...styles.jiraLinkButton,
                                  color: '#0b7285',
                                  borderColor: '#0b7285',
                                }}
                                onClick={() => openOutreachSessionsPage(message)}
                                title="打开主动询问会话页面"
                              >
                                💬 会话
                              </button>
                            )}
                            {statusToggleAction.canToggle && (
                              <button
                                type="button"
                                style={styles.statusActionButton}
                                onClick={() => handleToggleStatus(message)}
                                aria-label={statusToggleAction.buttonLabel}
                                title={statusToggleAction.title}
                              >
                                {statusToggleAction.buttonIcon}
                              </button>
                            )}
                            {/* 如果只有 Automation_Link 而没有 Schedule_Date，不显示编辑按钮 */}
                            {!(message.Automation_Link && !message.Schedule_Date) && (
                              <button 
                                style={{
                                  ...styles.editButton,
                                  // 未托管的 JiraAutomation 消息（有 Automation_Link 但没有 AI_Endpoint）显示为灰度
                                  filter: message.Push_Method === 'JiraAutomation' && 
                                          message.Automation_Link && 
                                          message.Schedule_Date && 
                                          !message.AI_Endpoint 
                                    ? 'grayscale(1) opacity(0.5)' 
                                    : 'none'
                                }}
                                onClick={() => handleEditMessage(message)}
                                title={
                                  message.Push_Method === 'JiraAutomation' && 
                                  message.Automation_Link && 
                                  message.Schedule_Date && 
                                  !message.AI_Endpoint
                                    ? '点击托管此规则'
                                    : '编辑消息'
                                }
                              >
                                ✏️
                              </button>
                            )}
                            <button 
                              style={styles.deleteButton}
                              onClick={() => handleDeleteMessage(message.ID, displayTitle)}
                              title="删除消息"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <footer style={styles.footer}>
        <p style={styles.footerText}>
          提示：可在本页直接新增 / 编辑；批量调整请打开 <a href="#" onClick={handleOpenMessagesSheet}>Google Sheet</a>
        </p>
      </footer>
      
       {showAddDialog && (
         <AddMessageDialog 
           onSubmit={handleSubmitNewMessage}
           onCancel={() => {
             setShowAddDialog(false);
             setAddDialogMode('default');
             setEditingMessage(null);
           }}
           isSubmitting={isSubmitting}
           botConfigured={botConfigured}
           timelineBotConfigured={timelineBotConfigured}
           webAppUrl={config?.webAppUrl}
           timelineSyncRuleUrl={timelineSyncRuleUrl}
           outreachEnabled={outreachRuntime.enabled}
           outreachConfigured={outreachRuntime.enabled && outreachRuntime.ringCentralReady}
           ringCentralSenderConfigured={hasRingCentralSenderCredentials(config)}
           onConfigureBot={(mode) => openBotConfigDialog(mode)}
           onConfigureRingCentralSender={openRingCentralSenderConfigDialog}
           onConfigureOutreach={openOptionsPage}
           dialogMode={addDialogMode}
           currentUsername={currentUsername}
           availableCategories={availableCategories}
           editingMessage={editingMessage}
           existingMessages={messages}
         />
       )}
       
       {showBotConfigDialog && config && (
         <BotConfigDialog
           config={config}
           mode={botConfigDialogMode}
           defaultEnableRingCentralSender={botConfigDefaultEnableRingCentralSender}
           onClose={() => {
             setBotConfigDefaultEnableRingCentralSender(false);
             setShowBotConfigDialog(false);
           }}
          onSuccess={(updatedConfig) => {
            const normalizedConfig = normalizeSheetConfig(updatedConfig);
            setConfig(normalizedConfig);
            setBotConfigured(hasExecutorRule(normalizedConfig));
            setTimelineBotConfigured(hasTimelineSyncRule(normalizedConfig));
            setShowBotConfigWarning(false);
            setBotConfigWarningState(buildBotConfigWarningState('ok', normalizedConfig));
            setBotConfigDefaultEnableRingCentralSender(false);
            setShowBotConfigDialog(false);
            void initializeApp();
            alert(
              'Bot 推送配置成功！\n\n' +
              '执行规则会立即按分钟运行；Timeline Sync Rule 会在每天 05:00 刷新缓存。\n' +
              '如果刚补齐 Timeline 配置，可在 Jira Automation 中手动运行一次 Sync Rule，或等待下一次 05:00 同步。'
            );
            const timelineSyncRuleUrl = getJiraAutomationRuleUrl(getTimelineSyncRule(normalizedConfig));
            if (timelineSyncRuleUrl) {
              if (confirm('现在打开 Timeline Sync Rule 手动运行一次，让 Timeline 缓存立即生效吗？')) {
                window.open(timelineSyncRuleUrl, '_blank');
              }
            }
          }}
        />
      )}
       
       {/* 托管确认弹窗 */}
       {showTakeoverDialog && takeoverMessage && (
         <div style={{
           position: 'fixed',
           top: 0,
           left: 0,
           right: 0,
           bottom: 0,
           backgroundColor: 'rgba(0, 0, 0, 0.5)',
           display: 'flex',
           justifyContent: 'center',
           alignItems: 'center',
           zIndex: 1000
         }}>
           <div style={{
             backgroundColor: 'white',
             borderRadius: '12px',
             padding: '24px',
             maxWidth: '500px',
             width: '90%',
             boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
           }}>
             <h3 style={{ margin: '0 0 16px', fontSize: '18px', color: '#172B4D' }}>
               🤖 使用 Personal AI 托管此规则？
             </h3>
             
             <div style={{
               marginBottom: '16px',
               padding: '12px',
               backgroundColor: '#F4F5F7',
               borderRadius: '8px'
             }}>
               <p style={{ margin: '0 0 8px', fontSize: '14px' }}>
                 <strong>规则：</strong> {takeoverMessage.Topic}
               </p>
               <p style={{ margin: '0', fontSize: '13px', color: '#666' }}>
                 当前调度：{takeoverMessage.Schedule_Time} | {(() => {
                   // 检查是否有多星期配置
                   if (takeoverMessage.Repeat_Days && takeoverMessage.Repeat_Unit === 'Week') {
                     const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                     const days = takeoverMessage.Repeat_Days.split(',')
                       .map(d => parseInt(d.trim(), 10))
                       .filter(d => !isNaN(d) && d >= 0 && d <= 6)
                       .sort((a, b) => a - b);
                     // 检查是否是工作日
                     if (days.length === 5 && days[0] === 1 && days[1] === 2 && days[2] === 3 && days[3] === 4 && days[4] === 5) {
                       return '工作日 (Mon-Fri)';
                     }
                     // 检查是否是周末
                     if (days.length === 2 && days[0] === 0 && days[1] === 6) {
                       return '周末 (Sat, Sun)';
                     }
                     return `每周 ${days.map(d => dayNames[d]).join(', ')}`;
                   }
                   // 默认显示
                   return `每 ${takeoverMessage.Repeat_Every} ${takeoverMessage.Repeat_Unit === 'Day' ? '天' : takeoverMessage.Repeat_Unit === 'Week' ? '周' : '月'}`;
                 })()}
               </p>
             </div>
             
             <div style={{
               marginBottom: '16px',
               padding: '12px',
               backgroundColor: '#FFFAE6',
               borderRadius: '8px',
               borderLeft: '3px solid #FFAB00'
             }}>
               <p style={{ margin: '0', fontSize: '13px', color: '#172B4D' }}>
                 ⚠️ <strong>注意：</strong>确认后，规则的 Scheduled Trigger 将被转换为 Incoming Webhook 模式，
                 由 Personal AI 接管调度时间管理。原有的定时触发将被替换。
               </p>
             </div>
             
             {takeoverError && (
               <div style={{
                 marginBottom: '16px',
                 padding: '12px',
                 backgroundColor: '#FFEBE6',
                 borderRadius: '8px',
                 borderLeft: '3px solid #FF5630'
               }}>
                 <p style={{ margin: '0', fontSize: '13px', color: '#BF2600', whiteSpace: 'pre-wrap' }}>
                   {takeoverError}
                 </p>
               </div>
             )}
             
             <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
               <button
                 onClick={handleTakeoverCancel}
                 disabled={takeoverLoading}
                 style={{
                   padding: '10px 20px',
                   border: '1px solid #DFE1E6',
                   borderRadius: '6px',
                   backgroundColor: 'white',
                   cursor: takeoverLoading ? 'not-allowed' : 'pointer',
                   fontSize: '14px',
                   fontWeight: 500
                 }}
               >
                 取消
               </button>
               <button
                 onClick={handleTakeoverConfirm}
                 disabled={takeoverLoading}
                 style={{
                   padding: '10px 20px',
                   border: 'none',
                   borderRadius: '6px',
                   backgroundColor: takeoverLoading ? '#ccc' : '#0052cc',
                   color: 'white',
                   cursor: takeoverLoading ? 'not-allowed' : 'pointer',
                   fontSize: '14px',
                   fontWeight: 500
                 }}
               >
                 {takeoverLoading ? '⏳ 处理中...' : '✅ 确认托管'}
               </button>
             </div>
           </div>
         </div>
       )}
       
       {/* 浮动 Tooltip */}
       {hoveredMessage && (
         <div style={{
           ...styles.tooltip,
           left: `${tooltipPosition.x + 15}px`,
           top: `${tooltipPosition.y + 15}px`,
         }}>
           <div style={styles.tooltipHeader}>
             {isOutreachMessage(hoveredMessage)
               ? getOutreachResult(hoveredMessage)
                 ? '主动询问内容与结果'
                 : '主动询问内容'
               : '消息内容'}
           </div>
           <div style={styles.tooltipContent}>{getScheduledMessageTooltipContent(hoveredMessage)}</div>
         </div>
       )}
    </div>
  );
};

// 变量选择器组件
const VariableSelector: React.FC<{
  onInsert: (variable: string) => void;
  excludeVariables?: string[];
}> = ({ onInsert, excludeVariables = [] }) => {
  // 项目变量列表（用于检测是否插入了项目变量）- 预留扩展用
  const _projectVariables = [
    '{currentRelease}',
    '{nextRelease}',
    '{currentPhase}',
    '{currentPhaseStartDate}',
    '{currentPhaseStartedWorkdays}',
    '{nextPhase}',
    '{nextPhaseStartDate}',
    '{nextPhaseCountdownWorkdays}'
  ];
  
  const variables = [
    { key: '{Topic}', label: '消息主题' },
    { key: '{Content}', label: '消息内容' },
    { key: '{TeamID}', label: '群组 ID' },
    { key: '{currentRelease}', label: '当前 Release', isProjectVar: true },
    { key: '{nextRelease}', label: '下个 Release', isProjectVar: true },
    { key: '{currentPhase}', label: '当前 Phase', isProjectVar: true },
    { key: '{currentPhaseStartDate}', label: '当前 Phase 日期', isProjectVar: true },
    { key: '{currentPhaseStartedWorkdays}', label: '已过天数', isProjectVar: true },
    { key: '{nextPhase}', label: '下个 Phase', isProjectVar: true },
    { key: '{nextPhaseStartDate}', label: '下个 Phase 日期', isProjectVar: true },
    { key: '{nextPhaseCountdownWorkdays}', label: '距离天数', isProjectVar: true }
  ].filter(v => !excludeVariables.includes(v.key));

  if (variables.length === 0) return null;

  return (
    <div style={{
      marginTop: '8px',
      padding: '8px 10px',
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      border: '1px solid #e0e0e0',
      fontSize: '12px',
      color: '#666',
    }}>
      <span style={{ marginRight: '8px' }}>💡 插入变量：</span>
      {variables.map((variable, index) => (
        <React.Fragment key={variable.key}>
          {index > 0 && <span style={{ margin: '0 4px', color: '#ccc' }}>|</span>}
          <button
            type="button"
            onClick={() => onInsert(variable.key)}
            style={{
              padding: '2px 8px',
              backgroundColor: '#e0e0e0',
              color: '#555',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#d0d0d0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#e0e0e0';
            }}
            title={`插入 ${variable.key}`}
          >
            {variable.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

// 用户名格式化工具函数
const formatUserName = {
  /**
   * 验证用户名格式（必须包含 first name 和 last name）
   */
  validate: (input: string): boolean => {
    const trimmed = input.trim();
    if (!trimmed) return false;
    
    // 支持两种格式：
    // 1. "Esone Qiu" - 空格分隔
    // 2. "esone.qiu" - 点号分隔
    const parts = trimmed.includes('.') 
      ? trimmed.split('.') 
      : trimmed.split(/\s+/);
    
    // 必须至少有两个部分（first name 和 last name）
    return parts.length >= 2 && parts.every(p => p.length > 0);
  },
  
  /**
   * 转换为显示格式："Esone Qiu"
   */
  toDisplayFormat: (input: string): string => {
    const trimmed = input.trim().toLowerCase();
    
    // 分割：支持空格或点号
    const parts = trimmed.includes('.') 
      ? trimmed.split('.') 
      : trimmed.split(/\s+/);
    
    // 首字母大写
    return parts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  },
  
  /**
   * 转换为存储格式："esone.qiu"
   */
  toStorageFormat: (input: string): string => {
    const trimmed = input.trim().toLowerCase();
    
    // 分割：支持空格或点号
    const parts = trimmed.includes('.') 
      ? trimmed.split('.') 
      : trimmed.split(/\s+/);
    
    // 用点号连接
    return parts.join('.');
  },
  
  /**
   * 将多个用户名转换为存储格式（用+连接，用于 Glip_User_Name）
   */
  joinForStorage: (displayNames: string[]): string => {
    return displayNames
      .map(name => formatUserName.toStorageFormat(name))
      .join('+');
  },
  
  /**
   * 将多个用户名转换为 mentionList 格式（用,连接，用于 AI Report）
   */
  joinForMentionList: (displayNames: string[]): string => {
    return displayNames
      .map(name => formatUserName.toStorageFormat(name))
      .join(',');
  }
};

// Tags 输入框组件
const TagsInput: React.FC<{
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
}> = ({ tags, onChange, placeholder, maxTags, disabled }) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  const commitInputValue = () => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) {
      setError('');
      return;
    }

    // 验证格式
    if (!formatUserName.validate(trimmedValue)) {
      setError('请输入完整的姓名（如：Esone Qiu 或 esone.qiu）');
      return;
    }

    if (maxTags && tags.length >= maxTags) {
      setError(`最多只能添加 ${maxTags} 个`);
      return;
    }

    // 转换为显示格式
    const displayName = formatUserName.toDisplayFormat(trimmedValue);

    // 检查是否已存在（避免重复）
    if (tags.includes(displayName)) {
      setError('该用户已添加');
      return;
    }

    onChange([...tags, displayName]);
    setInputValue('');
    setError('');
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      commitInputValue();
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1));
      setError('');
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (error) setError(''); // 清除错误提示
  };

  const handleInputBlur = () => {
    commitInputValue();
  };
  
  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, index) => index !== indexToRemove));
    setError('');
  };
  
  return (
    <div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '8px',
        border: `1px solid ${error ? '#dc3545' : '#ddd'}`,
        borderRadius: '4px',
        minHeight: '42px',
        backgroundColor: disabled ? '#f5f5f5' : '#fff',
      }}>
        {tags.map((tag, index) => (
          <span key={index} style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 8px',
            backgroundColor: '#007bff',
            color: '#fff',
            borderRadius: '4px',
            fontSize: '14px',
          }}>
            {tag}
            <button
              onClick={() => removeTag(index)}
              disabled={disabled}
              style={{
                marginLeft: '6px',
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0',
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleInputBlur}
          placeholder={tags.length === 0 ? placeholder : ''}
          disabled={disabled}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            minWidth: '120px',
            fontSize: '14px',
            backgroundColor: 'transparent',
          }}
        />
      </div>
      {error && (
        <div style={{
          color: '#dc3545',
          fontSize: '12px',
          marginTop: '4px',
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

// AI Header 选项
const AVAILABLE_AI_HEADERS = [
  { value: 'Authorization', label: 'Authorization (认证)', placeholder: 'Bearer token 或 Basic xxx' },
  { value: 'Content-Type', label: 'Content-Type (内容类型)', placeholder: 'application/json' },
  { value: 'Accept', label: 'Accept (接受类型)', placeholder: 'application/json' },
  { value: 'X-API-Key', label: 'X-API-Key (API密钥)', placeholder: 'sk-xxxxxxx' },
  { value: 'User-Agent', label: 'User-Agent (用户代理)', placeholder: 'MyApp/1.0' },
  { value: 'X-Request-ID', label: 'X-Request-ID (请求ID)', placeholder: 'req-12345' },
  { value: 'X-Custom-Header', label: 'X-Custom-Header (自定义)', placeholder: '自定义值' }
];

// AI Header 类型
interface AIHeader {
  name: string;
  value: string;
}

const TimelineCacheStatusPanel: React.FC<{
  usage: TimelineCacheUsage;
  status: TimelineCacheStatus | null;
  selectedProject?: string;
  selectedMilestone?: string;
  webAppUrl?: string;
  timelineSyncRuleUrl?: string;
  isLoading: boolean;
  error: string;
  onRefresh: () => void;
}> = ({ usage, status, selectedProject, selectedMilestone, webAppUrl, timelineSyncRuleUrl, isLoading, error, onRefresh }) => {
  const selectedStatus = selectedProject
    ? status?.projects?.find(project => project.project === selectedProject)
    : undefined;
  const hasStatus = Boolean(status);
  const selectedProjectMissingFromStatus = Boolean(selectedProject && status && !selectedStatus);
  const selectedMilestoneKeys = selectedStatus?.milestoneKeys;
  const selectedMilestoneMissing = isTimelineMilestoneMissingFromCache(
    selectedMilestone,
    selectedMilestoneKeys,
  );
  const hasSyncWarning = selectedStatus?.lastAttempt?.success === false;
  const isReady = selectedStatus?.status === 'ready' && !selectedMilestoneMissing && !selectedProjectMissingFromStatus && !hasSyncWarning;
  const statusColor = isReady ? '#155724' : '#856404';
  const statusBg = isReady ? '#d4edda' : '#fff3cd';
  const statusBorder = isReady ? '#c3e6cb' : '#ffeeba';
  const milestonePreview = formatTimelineMilestoneKeys(selectedStatus?.milestoneKeys?.slice(0, 4));
  const lastAttemptFailureText = selectedStatus?.lastAttempt?.success === false
    ? formatTimelineCacheLastAttempt(selectedStatus.lastAttempt)
    : '';
  const lastAttemptQuickFixText = selectedStatus?.lastAttempt?.success === false
    ? getTimelineCacheAttemptQuickFixText(selectedStatus.lastAttempt)
    : '';
  const executionImpactText = !isLoading
    ? getTimelineCacheExecutionImpactText({
      usage,
      status: selectedStatus,
      selectedMilestone,
      projectMissingFromStatus: selectedProjectMissingFromStatus,
      hasReadError: Boolean(error),
    })
    : '';
  const shouldShowSyncRuleAction = Boolean(timelineSyncRuleUrl) && (!isReady || Boolean(error));
  const syncRuleActionLabel = error || selectedStatus?.status === 'invalid' || selectedStatus?.status === 'error'
    ? '打开并修复 Rule'
    : '打开并手动同步';
  const shouldShowRefreshAfterRuleHint = shouldShowSyncRuleAction && !isLoading && !isReady;
  const dryRunHelp = React.useMemo(
    () => getTimelineSyncDryRunHelp({
      project: selectedProject,
      webAppUrl,
      milestone: selectedMilestone,
    }),
    [selectedMilestone, selectedProject, webAppUrl],
  );
  const shouldShowDryRunAction = Boolean(
    dryRunHelp && (!isReady || error || selectedMilestoneMissing || selectedProjectMissingFromStatus || hasSyncWarning),
  );
  const [dryRunTesting, setDryRunTesting] = React.useState(false);
  const [dryRunResultText, setDryRunResultText] = React.useState('');
  const [dryRunResultSuccess, setDryRunResultSuccess] = React.useState<boolean | null>(null);
  const handleRunDryRun = React.useCallback(async () => {
    if (!dryRunHelp || dryRunTesting) {
      return;
    }

    setDryRunTesting(true);
    setDryRunResultText('');
    setDryRunResultSuccess(null);

    try {
      const result = await runTimelineSyncDryRun(dryRunHelp);
      setDryRunResultText(formatTimelineSyncDryRunResult(result));
      setDryRunResultSuccess(result.success);
    } catch (runError: any) {
      setDryRunResultText(runError?.message || 'Apps Script dry-run 测试失败');
      setDryRunResultSuccess(false);
    } finally {
      setDryRunTesting(false);
    }
  }, [dryRunHelp, dryRunTesting]);

  React.useEffect(() => {
    setDryRunResultText('');
    setDryRunResultSuccess(null);
  }, [dryRunHelp?.url, dryRunHelp?.customBody]);

  return (
    <div style={{
      padding: '12px',
      backgroundColor: statusBg,
      borderRadius: '6px',
      border: `1px solid ${statusBorder}`,
      marginBottom: '16px',
    }} role="status" aria-live="polite">
      <div style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px'}}>
        <div style={{fontSize: '13px', color: statusColor, lineHeight: '1.5', flex: 1}}>
          <strong>Timeline 缓存状态</strong>
          <div style={{marginTop: '4px'}}>
            {isLoading
              ? '正在检查缓存状态...'
              : error
                ? error
                : selectedStatus
                  ? selectedMilestoneMissing
                    ? `${selectedStatus.project}: 当前缓存缺少 ${selectedMilestone}`
                    : `${selectedStatus.project}: ${getTimelineCacheStatusLabel(selectedStatus.status)}`
                  : selectedProjectMissingFromStatus
                    ? `${selectedProject}: 当前 App Script 未返回该项目状态`
                  : hasStatus
                    ? `已同步 ${status?.readyProjects || 0}/${status?.totalProjects || 0} 个项目`
                    : '尚未读取缓存状态'}
          </div>
          {selectedStatus?.status === 'ready' && !selectedMilestoneMissing && (
            <div style={{marginTop: '4px'}}>
              更新于 {formatTimelineCacheAge(selectedStatus.ageMs)}
              {milestonePreview ? `，包含 ${milestonePreview}` : ''}
            </div>
          )}
          {selectedMilestoneMissing && !isLoading && !error && (
            <div style={{marginTop: '4px'}}>
              当前缓存包含 {formatTimelineMilestoneKeys(selectedMilestoneKeys)}。请同步后刷新，或改选已有 Milestone。
            </div>
          )}
          {selectedStatus && selectedStatus.status !== 'ready' && !isLoading && !error && (
            <div style={{marginTop: '4px'}}>
              {getTimelineCacheStatusActionText(selectedStatus.status)}
            </div>
          )}
          {lastAttemptFailureText && !isLoading && !error && (
            <div style={{marginTop: '4px'}}>
              {lastAttemptFailureText}
              {selectedStatus?.status === 'ready' ? '，当前仍使用已有缓存。' : ''}
            </div>
          )}
          {lastAttemptQuickFixText && !isLoading && !error && (
            <div style={{
              marginTop: '6px',
              padding: '6px 8px',
              backgroundColor: '#fff',
              border: `1px solid ${statusBorder}`,
              borderRadius: '4px',
              color: '#5c4b00',
            }}>
              下一步：{lastAttemptQuickFixText}
            </div>
          )}
          {selectedProjectMissingFromStatus && !isLoading && !error && (
            <div style={{marginTop: '4px'}}>
              请更新 App Script 并重新配置 Timeline Sync Rule，让项目清单与扩展保持一致。
            </div>
          )}
          {executionImpactText && (
            <div style={{
              marginTop: '6px',
              padding: '6px 8px',
              backgroundColor: '#fff',
              border: `1px solid ${statusBorder}`,
              borderRadius: '4px',
              color: statusColor,
            }}>
              执行影响：{executionImpactText}
            </div>
          )}
          {status && !selectedStatus && !error && (
            <div style={{marginTop: '4px'}}>
              缺失 {status.missingProjects} 个，异常或过期 {status.staleProjects} 个。
            </div>
          )}
          {shouldShowRefreshAfterRuleHint && (
            <div style={{marginTop: '4px'}}>
              在 Jira 里完成同步或修复后，回到这里点击“刷新状态”确认缓存已生效。
            </div>
          )}
        </div>
        <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end'}}>
          {shouldShowDryRunAction && (
            <button
              type="button"
              onClick={handleRunDryRun}
              disabled={dryRunTesting}
              title="用 dryRun=true 发送当前项目的样例 payload；不会写入 Timeline 缓存"
              style={{
                padding: '6px 10px',
                backgroundColor: '#fff',
                color: '#0f5132',
                border: '1px solid #75b798',
                borderRadius: '4px',
                cursor: dryRunTesting ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                whiteSpace: 'nowrap',
              }}
            >
              {dryRunTesting ? '测试中...' : '样例测试'}
            </button>
          )}
          {shouldShowSyncRuleAction && (
            <button
              type="button"
              onClick={() => window.open(timelineSyncRuleUrl, '_blank')}
              title={syncRuleActionLabel}
              style={{
                padding: '6px 10px',
                backgroundColor: '#fff',
                color: '#856404',
                border: '1px solid #f0c36d',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                whiteSpace: 'nowrap',
              }}
            >
              {syncRuleActionLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            style={{
              padding: '6px 10px',
              backgroundColor: '#fff',
              color: '#0056b3',
              border: '1px solid #80bdff',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              whiteSpace: 'nowrap',
            }}
          >
            刷新状态
          </button>
        </div>
      </div>
      {dryRunResultText && (
        <div style={{
          marginTop: '10px',
          padding: '8px 10px',
          backgroundColor: dryRunResultSuccess ? '#f0fff4' : '#fff5f5',
          color: dryRunResultSuccess ? '#0f5132' : '#842029',
          border: `1px solid ${dryRunResultSuccess ? '#badbcc' : '#f5c2c7'}`,
          borderRadius: '4px',
          fontSize: '12px',
          lineHeight: 1.5,
        }}>
          {dryRunResultText}
        </div>
      )}
    </div>
  );
};

// 新增/编辑消息对话框组件
const AddMessageDialog: React.FC<{
  onSubmit: (data: CreateMessageFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  botConfigured: boolean;
  timelineBotConfigured: boolean;
  webAppUrl?: string;
  timelineSyncRuleUrl?: string;
  outreachEnabled: boolean;
  outreachConfigured: boolean;
  ringCentralSenderConfigured: boolean;
  onConfigureBot: (mode?: BotConfigDialogMode) => void;
  onConfigureRingCentralSender: () => void;
  onConfigureOutreach: () => void;
  dialogMode?: AddDialogMode;
  currentUsername?: string;
  availableCategories: SelectOption[];
  editingMessage?: ScheduledMessage | null;
  existingMessages: ScheduledMessage[];
}> = ({
  onSubmit,
  onCancel,
  isSubmitting,
  botConfigured,
  timelineBotConfigured,
  webAppUrl,
  timelineSyncRuleUrl,
  outreachEnabled,
  outreachConfigured,
  ringCentralSenderConfigured,
  onConfigureBot,
  onConfigureRingCentralSender,
  onConfigureOutreach: _onConfigureOutreach,
  dialogMode = 'default',
  currentUsername = '',
  availableCategories,
  editingMessage = null,
  existingMessages,
}) => {
  const isEditMode = !!editingMessage;
  const isReminderMode = dialogMode === 'reminder';
  const isOutreachMode = dialogMode === 'outreach';
  const [scheduleNow, setScheduleNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const timer = window.setInterval(() => setScheduleNow(new Date()), 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  // 格式化时间为 HH:MM 格式（确保两位数）
  const formatTimeToHHMM = (time: string | undefined): string => {
    return normalizeLocalScheduleTime(time) || '';
  };
  
  // 初始化表单数据（编辑模式时使用现有数据）
  const getInitialFormData = (): CreateMessageFormData => {
    if (editingMessage) {
      const outreachTargetType = editingMessage.Target_Type || editingMessage.Outreach_Target_Type || (editingMessage.Glip_Team_ID ? 'group' : 'private');
      return {
        Topic: editingMessage.Topic || '',
        Content: editingMessage.Content || (editingMessage as ScheduledMessage & { Outreach_Question?: string }).Outreach_Question || '',
        Schedule_Date: editingMessage.Schedule_Date || '',
        Schedule_Time: formatTimeToHHMM(editingMessage.Schedule_Time),
        Push_Method: editingMessage.Push_Method || 'AsMe',
        Target_Type: editingMessage.Target_Type || (editingMessage.Glip_Team_ID ? 'group' : 'private'),
        Glip_User_Name: editingMessage.Glip_User_Name || '',
        Glip_Team_ID: editingMessage.Glip_Team_ID || '',
        Outreach_Target_Type: outreachTargetType,
        Outreach_Target_Ref: outreachTargetType === 'group'
          ? (editingMessage.Glip_Team_ID || editingMessage.Outreach_Target_Ref || '')
          : (editingMessage.Glip_User_Name || editingMessage.Outreach_Target_Ref || ''),
        Outreach_Result: editingMessage.Outreach_Result || editingMessage.Outreach_Last_Result || '',
        Outreach_Context: editingMessage.Outreach_Context || '',
        Outreach_Max_Followup: typeof editingMessage.Outreach_Max_Followup === 'number'
          ? editingMessage.Outreach_Max_Followup
          : editingMessage.Outreach_Max_Followup
            ? parseInt(String(editingMessage.Outreach_Max_Followup), 10)
            : undefined,
        Outreach_Followup_Interval_Hours: typeof editingMessage.Outreach_Followup_Interval_Hours === 'number'
          ? editingMessage.Outreach_Followup_Interval_Hours
          : editingMessage.Outreach_Followup_Interval_Hours
            ? parseInt(String(editingMessage.Outreach_Followup_Interval_Hours), 10)
            : undefined,
        Repeat_Every: editingMessage.Repeat_Every,
        Repeat_Unit: editingMessage.Repeat_Unit,
        Repeat_Count: editingMessage.Repeat_Count,
        End_Date: editingMessage.End_Date,
        AI_Endpoint: editingMessage.AI_Endpoint,
        AI_Headers: editingMessage.AI_Headers,
        AI_Body: editingMessage.AI_Body,
        Timeline_Project: editingMessage.Timeline_Project,
        Timeline_Milestone: editingMessage.Timeline_Milestone,
        Timeline_Offset: editingMessage.Timeline_Offset,
        Category: editingMessage.Category,
      };
    }
    return {
      Topic: '',
      Content: '',
      Schedule_Date: getTodayLocalScheduleDate(),
      Schedule_Time: '',
      Push_Method: isOutreachMode ? 'Outreach' : 'AsMe',
      Target_Type: 'private',
      Glip_User_Name: '',
      Glip_Team_ID: '',
      Outreach_Target_Type: 'private',
      Outreach_Target_Ref: '',
      Outreach_Result: '',
      Outreach_Context: '',
      Outreach_Max_Followup: 2,
      Outreach_Followup_Interval_Hours: 24
    };
  };
  
  // 初始化用户标签（编辑模式时解析现有用户名）
  const getInitialUserTags = (): string[] => {
    if (editingMessage && editingMessage.Push_Method === 'Outreach' && (editingMessage.Target_Type || editingMessage.Outreach_Target_Type) !== 'group') {
      const targetRef = editingMessage.Glip_User_Name?.trim() || editingMessage.Outreach_Target_Ref?.trim();
      if (targetRef) {
        return [formatUserName.toDisplayFormat(targetRef)];
      }
      return [];
    }
    if (editingMessage && editingMessage.Glip_User_Name) {
      // esone.qiu+john.doe -> ['Esone Qiu', 'John Doe']
      return editingMessage.Glip_User_Name.split('+').map(name => formatUserName.toDisplayFormat(name));
    }
    return [];
  };
  
  // 初始化分类标签
  const getInitialCategoryTags = (): SelectOption[] => {
    if (editingMessage && editingMessage.Category) {
      return editingMessage.Category.split(',').map(cat => ({
        value: cat.trim(),
        label: cat.trim()
      }));
    }
    return [];
  };
  
  const [formData, setFormData] = useState<CreateMessageFormData>(getInitialFormData);
  const [userTags, setUserTags] = useState<string[]>(getInitialUserTags);
  const [isRepeating, setIsRepeating] = useState(editingMessage ? !!(editingMessage.Repeat_Every && editingMessage.Repeat_Unit) : false);
  const [aiReportTemplate, setAiReportTemplate] = useState<'ai-report' | 'pep-report' | 'multiple-jira-query' | 'custom'>(() => {
    // 编辑模式时，根据 AI_Endpoint 判断模板类型
    if (editingMessage && editingMessage.Push_Method === 'AI' && editingMessage.AI_Endpoint) {
      if (editingMessage.AI_Endpoint.includes('dify.int.rclabenv.com')) {
        return 'ai-report';
      } else if (editingMessage.AI_Endpoint.includes('pep_daily_report')) {
        return 'pep-report';
      } else if (editingMessage.AI_Endpoint.includes('multiple_jira_query_notify')) {
        return 'multiple-jira-query';
      }
      return 'custom';
    }
    return 'ai-report';
  });
  const [aiHeaders, setAiHeaders] = useState<AIHeader[]>([]);
  const [isTimelineTrigger, setIsTimelineTrigger] = useState(editingMessage ? !!(editingMessage.Timeline_Milestone && !editingMessage.Schedule_Date) : false);
  const [timelineCacheStatus, setTimelineCacheStatus] = useState<TimelineCacheStatus | null>(null);
  const [timelineCacheStatusLoading, setTimelineCacheStatusLoading] = useState(false);
  const [timelineCacheStatusError, setTimelineCacheStatusError] = useState('');
  
  // 多星期选择状态（0=周日, 1=周一...6=周六）
  const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>(() => {
    if (editingMessage && editingMessage.Repeat_Days && editingMessage.Repeat_Unit === 'Week') {
      return editingMessage.Repeat_Days.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d));
    }
    return [];
  });
  
  // 解析编辑模式下 AI Report Body 的辅助函数
  const parseAiReportBody = () => {
    if (!editingMessage || editingMessage.Push_Method !== 'AI' || !editingMessage.AI_Body) {
      return {
        jql: '',
        outputs: { noduedate: false, overdue: true, toTest: false, tickets: true },
        ticketIncludes: ['summary', 'status', 'assignee', 'reporter'],
        customOutputs: [] as {name: string; prompt: string}[],
        teamId: '',
        mentionList: [] as string[],
        extraText: ''
      };
    }
    
    try {
      const body = JSON.parse(editingMessage.AI_Body);
      const inputs = body.inputs || {};
      
      // 解析 outputs
      const outputsStr = inputs.outputs || '';
      const outputsArr = outputsStr.split(',').map((s: string) => s.trim());
      
      // 解析 ticketIncludes
      const ticketIncludesStr = inputs.ticketIncludes || 'summary, status, assignee, reporter';
      const ticketIncludesArr = ticketIncludesStr.split(',').map((s: string) => s.trim());
      
      // 解析 customOutputs（格式：name1:prompt1 | prompt2）
      const customOutputsStr = inputs.customOutputs || '';
      const customOutputsArr = customOutputsStr ? customOutputsStr.split(' | ').map((item: string) => {
        const colonIndex = item.indexOf(':');
        if (colonIndex > 0) {
          return { name: item.substring(0, colonIndex), prompt: item.substring(colonIndex + 1) };
        }
        return { name: '', prompt: item };
      }) : [];
      
      // 解析 mentionList
      const mentionListStr = inputs.mentionList || '';
      const mentionListArr = mentionListStr ? mentionListStr.split(',').map((s: string) => formatUserName.toDisplayFormat(s.trim())) : [];
      
      return {
        jql: editingMessage.Content || inputs.jql || '',
        outputs: {
          noduedate: outputsArr.includes('noduedate'),
          overdue: outputsArr.includes('overdue'),
          toTest: outputsArr.includes('toTest'),
          tickets: outputsArr.includes('tickets')
        },
        ticketIncludes: ticketIncludesArr,
        customOutputs: customOutputsArr,
        teamId: editingMessage.Glip_Team_ID || inputs.teamId || '',
        mentionList: mentionListArr,
        extraText: inputs.extraText || ''
      };
    } catch (e) {
      console.error('解析 AI Report Body 失败:', e);
      return {
        jql: editingMessage.Content || '',
        outputs: { noduedate: false, overdue: true, toTest: false, tickets: true },
        ticketIncludes: ['summary', 'status', 'assignee', 'reporter'],
        customOutputs: [] as {name: string; prompt: string}[],
        teamId: editingMessage.Glip_Team_ID || '',
        mentionList: [] as string[],
        extraText: ''
      };
    }
  };
  
  const initialAiReportData = parseAiReportBody();
  
  // AI Report 可视化字段
  const [aiReportJql, setAiReportJql] = useState(initialAiReportData.jql);
  const [aiReportOutputs, setAiReportOutputs] = useState(initialAiReportData.outputs);
  const [ticketIncludes, setTicketIncludes] = useState<string[]>(initialAiReportData.ticketIncludes);
  const [customOutputs, setCustomOutputs] = useState<{name: string; prompt: string}[]>(initialAiReportData.customOutputs);
  const [showCustomOutputDialog, setShowCustomOutputDialog] = useState(false);
  const [editingCustomOutputIndex, setEditingCustomOutputIndex] = useState<number | null>(null);
  const [customOutputName, setCustomOutputName] = useState('');
  const [customOutputPrompt, setCustomOutputPrompt] = useState('');
  const [aiReportTeamId, setAiReportTeamId] = useState(initialAiReportData.teamId);
  const [aiReportMentionList, setAiReportMentionList] = useState<string[]>(initialAiReportData.mentionList);
  const [aiReportExtraText, setAiReportExtraText] = useState(initialAiReportData.extraText);
  const [pepReportTeamId, setPepReportTeamId] = useState(() => {
    // 编辑模式时，如果是 pep-report 类型，初始化 TeamID
    if (editingMessage && editingMessage.Push_Method === 'AI' && editingMessage.AI_Endpoint?.includes('pep_daily_report')) {
      return editingMessage.Glip_Team_ID || '';
    }
    return '';
  });
  const [multipleJiraQueryTeamId, setMultipleJiraQueryTeamId] = useState(() => {
    // 编辑模式时，如果是 multiple-jira-query 类型，初始化 TeamID
    if (editingMessage && editingMessage.Push_Method === 'AI' && editingMessage.AI_Endpoint?.includes('multiple_jira_query_notify')) {
      return editingMessage.Glip_Team_ID || '';
    }
    return '';
  });
  const [categoryTags, setCategoryTags] = useState<SelectOption[]>(getInitialCategoryTags);
  const timelineCacheLastRefreshAtRef = useRef<number | null>(null);
  const timelineCacheStatusLoadingRef = useRef(false);
  const hasProjectVariablesInForm = containsProjectVariableText(
    formData.Content,
    formData.AI_Body,
    formData.Topic,
  );
  const usesProjectVariablesForTimeTrigger = !isTimelineTrigger &&
    formData.Push_Method !== 'AsMe' &&
    hasProjectVariablesInForm;
  const shouldLoadTimelineCacheStatus = isTimelineTrigger || usesProjectVariablesForTimeTrigger;
  const selectedTimelineProjectValue = formData.Timeline_Project ||
    (usesProjectVariablesForTimeTrigger ? DEFAULT_TIMELINE_PROJECT : undefined);
  
  // Body 输入框的 ref，用于插入变量
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const jqlTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 提醒模式：展开高级选项的状态
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  // Topic 自动生成相关状态
  const [isGeneratingTopic, setIsGeneratingTopic] = useState(false);
  const generateTopicRequestIdRef = useRef<number>(0); // 用于追踪请求，处理竞态条件

  const loadTimelineCacheStatus = React.useCallback(async () => {
    if (!webAppUrl || !botConfigured || !timelineBotConfigured) {
      setTimelineCacheStatus(null);
      return;
    }

    timelineCacheLastRefreshAtRef.current = Date.now();
    setTimelineCacheStatusLoading(true);
    setTimelineCacheStatusError('');

    try {
      const nextStatus = await fetchTimelineCacheStatus(webAppUrl);
      setTimelineCacheStatus(nextStatus);
    } catch (error: any) {
      setTimelineCacheStatus(null);
      setTimelineCacheStatusError(error?.message || 'Timeline 缓存状态读取失败');
    } finally {
      setTimelineCacheStatusLoading(false);
    }
  }, [webAppUrl, botConfigured, timelineBotConfigured]);

  React.useEffect(() => {
    if (shouldLoadTimelineCacheStatus && botConfigured && timelineBotConfigured) {
      void loadTimelineCacheStatus();
    } else {
      setTimelineCacheStatus(null);
      setTimelineCacheStatusError('');
    }
  }, [shouldLoadTimelineCacheStatus, botConfigured, timelineBotConfigured, loadTimelineCacheStatus]);

  React.useEffect(() => {
    timelineCacheStatusLoadingRef.current = timelineCacheStatusLoading;
  }, [timelineCacheStatusLoading]);

  React.useEffect(() => {
    const enabled = shouldLoadTimelineCacheStatus && botConfigured && timelineBotConfigured;
    if (!enabled) {
      return;
    }

    const handlePageResume = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') {
        return;
      }

      if (!shouldAutoRefreshTimelineCacheStatus({
        enabled,
        isLoading: timelineCacheStatusLoadingRef.current,
        nowMs: Date.now(),
        lastRefreshAtMs: timelineCacheLastRefreshAtRef.current,
      })) {
        return;
      }

      void loadTimelineCacheStatus();
    };

    window.addEventListener('focus', handlePageResume);
    document.addEventListener('visibilitychange', handlePageResume);

    return () => {
      window.removeEventListener('focus', handlePageResume);
      document.removeEventListener('visibilitychange', handlePageResume);
    };
  }, [shouldLoadTimelineCacheStatus, botConfigured, timelineBotConfigured, loadTimelineCacheStatus]);

  const selectedTimelineProjectStatus = useMemo(() => {
    return getTimelineCacheProjectStatus(timelineCacheStatus, selectedTimelineProjectValue);
  }, [selectedTimelineProjectValue, timelineCacheStatus]);

  const selectedTimelineMilestoneKeys = selectedTimelineProjectStatus?.milestoneKeys;
  const selectedTimelineMilestoneMissing = isTimelineMilestoneMissingFromCache(
    formData.Timeline_Milestone,
    selectedTimelineMilestoneKeys,
  );
  const timelineMilestoneOptions = useMemo(
    () => buildTimelineMilestoneOptions(selectedTimelineMilestoneKeys, formData.Timeline_Milestone),
    [selectedTimelineMilestoneKeys, formData.Timeline_Milestone],
  );
  
  // 当 Content blur 时自动生成 Topic
  const handleContentBlur = async () => {
    const content = formData.Content?.trim();
    const topic = formData.Topic?.trim();
    
    // 如果 Content 为空或 Topic 已有值，不处理
    if (!content || topic) {
      return;
    }
    
    // 生成唯一请求 ID，用于处理竞态条件
    const currentRequestId = ++generateTopicRequestIdRef.current;
    setIsGeneratingTopic(true);
    
    try {
      // 构建 prompt
      const prompt = `请根据以下消息内容，生成一个简短的主题标题（不超过20个字，不要加引号或标点）：

${content}

主题：`;
      
      // 调用 LLM 生成主题
      const response = await chrome.runtime.sendMessage({
        type: 'CALL_LLM_SUMMARIZE',
        data: { prompt }
      });
      
      // 检查是否是最新的请求（处理竞态条件）
      if (currentRequestId !== generateTopicRequestIdRef.current) {
        console.log('🔄 Topic 生成请求已过期，放弃填充');
        return;
      }
      
      // 检查用户是否已经开始输入 Topic
      if (formData.Topic?.trim()) {
        console.log('📝 用户已输入 Topic，放弃自动填充');
        return;
      }
      
      if (response?.success && response.summary) {
        // 清理生成的主题（去除可能的引号、换行等）
        let generatedTopic = response.summary
          .replace(/^["'""'']+|["'""'']+$/g, '') // 去除引号
          .replace(/\n/g, ' ') // 换行替换为空格
          .trim();
        
        // 限制长度
        if (generatedTopic.length > 30) {
          generatedTopic = generatedTopic.substring(0, 30);
        }
        
        // 再次检查 Topic 是否仍为空（双重保险）
        if (!formData.Topic?.trim()) {
          handleChange('Topic', generatedTopic);
          console.log('✅ 自动生成 Topic:', generatedTopic);
        }
      }
    } catch (error) {
      console.error('❌ 自动生成 Topic 失败:', error);
    } finally {
      // 只有当前请求才能关闭 loading 状态
      if (currentRequestId === generateTopicRequestIdRef.current) {
        setIsGeneratingTopic(false);
      }
    }
  };
  
  // 提醒模式初始化（仅新建模式时生效）
  React.useEffect(() => {
    if (isReminderMode && !isEditMode) {
      // 自动填充提醒模式的数据
      handleChange('Topic', '个人提醒事项');
      handleChange('Push_Method', 'Bot');
      handleChange('Target_Type', 'private');
      
      // 填充当前用户名
      if (currentUsername) {
        const displayName = formatUserName.toDisplayFormat(currentUsername);
        setUserTags([displayName]);
      }
    }
  }, [isReminderMode, isEditMode]);

  React.useEffect(() => {
    if (isOutreachMode && !isEditMode) {
      handleChange('Push_Method', 'Outreach');
      handleChange('Target_Type', 'private');
      if (!formData.Outreach_Target_Type) {
        handleChange('Outreach_Target_Type', 'private');
      }
      if (formData.Outreach_Max_Followup === undefined) {
        handleChange('Outreach_Max_Followup', 2);
      }
      if (formData.Outreach_Followup_Interval_Hours === undefined) {
        handleChange('Outreach_Followup_Interval_Hours', 24);
      }
    }
  }, [isOutreachMode, isEditMode]);
  
  // 四个模板的数据缓存（内存中，关闭页面后失效）
  const templateCacheRef = React.useRef<{
    'ai-report': { AI_Endpoint: string; AI_Headers: string; AI_Body: string };
    'pep-report': { AI_Endpoint: string; AI_Headers: string; AI_Body: string };
    'multiple-jira-query': { AI_Endpoint: string; AI_Headers: string; AI_Body: string };
    'custom': { AI_Endpoint: string; AI_Headers: string; AI_Body: string };
  }>({
    'ai-report': { AI_Endpoint: '', AI_Headers: '', AI_Body: '' },
    'pep-report': { AI_Endpoint: '', AI_Headers: '', AI_Body: '' },
    'multiple-jira-query': { AI_Endpoint: '', AI_Headers: '', AI_Body: '' },
    'custom': { AI_Endpoint: '', AI_Headers: '', AI_Body: '' }
  });
  
  // AI Report 预设值
  const aiReportPresets = {
    'ai-report': {
      AI_Endpoint: 'POST https://dify.int.rclabenv.com/v1/chat-messages',
      AI_Headers: 'Authorization: Bearer app-hTAaR1jaLnYDITixXRP5qi4Y\nContent-Type: application/json',
      AI_Body: JSON.stringify({
        response_mode: 'blocking',
        user: 'default-user',
        query: '{Topic}',
        inputs: {
          title: '{Topic}',
          outputs: 'noduedate, overdue, toTest, tickets',
          jql: '{Content}',
          extraText: '',
          teamId: '{TeamID}',
          mentionList: '',
          ticketIncludes: 'summary, status, assignee, reporter'
        }
      }, null, 2)
    },
    'pep-report': {
      AI_Endpoint: 'POST https://gitlab-reviewer.int.rclabenv.com/pep_daily_report',
      AI_Headers: 'Content-Type: application/json',
      AI_Body: JSON.stringify({
        jql: '',
        jira_query_id: 111,
        sheet_id: '',
        sheet_name: '',
        team_id: '{TeamID}',
        mention_list: [],
        overallFilterId: '',
        bugFilterid: '',
        ignore_due_soon: true,
        force_running: true,
        missing_due_check_scope: 'all',
        language: '',
        milestones: [
          {
            abbreviation: 'MR',
            full_name: 'Code Merge',
            goal: '提测所有功能及安排在本Release的Production Bug'
          },
          {
            abbreviation: 'FF',
            full_name: 'Feature Freeze',
            goal: '1）完成所有功能测试；2）完成安排在本Release的所有Production和Release Bug (接近FF 2天内的P2 bug可以Regression阶段修复）'
          },
          {
            abbreviation: 'CF',
            full_name: 'Code Freeze',
            goal: '完成所有本Release的功能开发、测试和Bug修复。完成Sign off。提供Dogfooding Build'
          }
        ]
      }, null, 2)
    },
    'multiple-jira-query': {
      AI_Endpoint: 'POST https://pep.int.rclabenv.com/multiple_jira_query_notify',
      AI_Headers: 'Content-Type: application/json',
      AI_Body: JSON.stringify({
        team_id: '{TeamID}',
        queries: [
          {
            query_id: 2253,
            intro_text: 'High priority issues:',
            mention: ['reporter', 'assignee'],
            show_status: true
          },
          {
            query: 'project = RCVR AND status = Open',
            intro_text: 'Open RCVR issues:',
            mention: ['firstof(assignee, reporter)']
          }
        ]
      }, null, 2)
    }
  };
  
  // 处理模板切换
  const handleTemplateChange = (newTemplate: 'ai-report' | 'pep-report' | 'multiple-jira-query' | 'custom') => {
    // 保存当前模板的数据到缓存
    if (aiReportTemplate === 'ai-report') {
      // ai-report 使用可视化字段，不需要保存 Body
      templateCacheRef.current[aiReportTemplate] = {
        AI_Endpoint: formData.AI_Endpoint || '',
        AI_Headers: formData.AI_Headers || '',
        AI_Body: '' // ai-report 的 Body 会动态生成
      };
    } else {
      templateCacheRef.current[aiReportTemplate] = {
        AI_Endpoint: formData.AI_Endpoint || '',
        AI_Headers: formData.AI_Headers || '',
        AI_Body: formData.AI_Body || ''
      };
    }
    
    // 切换到新模板
    setAiReportTemplate(newTemplate);
    
    // 如果新模板有预设值且缓存为空，使用预设值
    if (newTemplate === 'ai-report' && !templateCacheRef.current['ai-report'].AI_Endpoint) {
      const headersStr = aiReportPresets['ai-report'].AI_Headers;
      handleChange('AI_Endpoint', aiReportPresets['ai-report'].AI_Endpoint);
      handleChange('AI_Headers', headersStr);
      // ai-report 的 Body 会通过可视化字段自动生成，不需要手动设置
      setAiHeaders(parseHeadersString(headersStr));
    } else if (newTemplate === 'pep-report' && !templateCacheRef.current['pep-report'].AI_Endpoint) {
      const headersStr = aiReportPresets['pep-report'].AI_Headers;
      handleChange('AI_Endpoint', aiReportPresets['pep-report'].AI_Endpoint);
      handleChange('AI_Headers', headersStr);
      handleChange('AI_Body', aiReportPresets['pep-report'].AI_Body);
      setAiHeaders(parseHeadersString(headersStr));
    } else if (newTemplate === 'multiple-jira-query' && !templateCacheRef.current['multiple-jira-query']?.AI_Endpoint) {
      const headersStr = aiReportPresets['multiple-jira-query'].AI_Headers;
      handleChange('AI_Endpoint', aiReportPresets['multiple-jira-query'].AI_Endpoint);
      handleChange('AI_Headers', headersStr);
      handleChange('AI_Body', aiReportPresets['multiple-jira-query'].AI_Body);
      setAiHeaders(parseHeadersString(headersStr));
    } else {
      // 从缓存恢复数据
      const cached = templateCacheRef.current[newTemplate];
      handleChange('AI_Endpoint', cached.AI_Endpoint);
      handleChange('AI_Headers', cached.AI_Headers);
      if (newTemplate !== 'ai-report') {
        handleChange('AI_Body', cached.AI_Body);
      }
      if (newTemplate === 'custom') {
        setAiHeaders(parseHeadersString(cached.AI_Headers));
      }
    }
  };
  
  // 构建 AI Report Body JSON
  const buildAiReportBody = (): string => {
    const outputs = Object.entries(aiReportOutputs)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key)
      .join(', ');
    
    const inputs: any = {
      title: '{Topic}',
      outputs: outputs,
      jql: '{Content}',
      extraText: aiReportExtraText,
      teamId: '{TeamID}',
      mentionList: formatUserName.joinForMentionList(aiReportMentionList)
    };
    
    // 如果选择了列出JQL查询结果，添加 ticketIncludes（逗号分隔字符串）
    if (aiReportOutputs.tickets) {
      inputs.ticketIncludes = ticketIncludes.join(', ');
    }
    
    // 如果有自定义版块，添加 customOutputs（格式：name1:prompt1 | prompt2）
    if (customOutputs.length > 0) {
      inputs.customOutputs = customOutputs
        .map(output => output.name ? `${output.name}:${output.prompt}` : output.prompt)
        .join(' | ');
    }
    
    return JSON.stringify({
      response_mode: 'blocking',
      user: 'default-user',
      query: '{Topic}',
      inputs: inputs
    }, null, 2);
  };
  
  // 解析 headers 字符串为数组
  const parseHeadersString = (headersStr: string): AIHeader[] => {
    if (!headersStr) return [];
    const lines = headersStr.split('\n');
    const headers: AIHeader[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;
      
      const name = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();
      
      if (name && value) {
        headers.push({ name, value });
      }
    }
    
    return headers;
  };
  
  // 将 headers 数组转换为字符串
  const formatHeadersToString = (headers: AIHeader[]): string => {
    return headers
      .filter(h => h.name && h.value)
      .map(h => `${h.name}: ${h.value}`)
      .join('\n');
  };
  
  // 当 Push_Method 切换到 AI 时，初始化模板（仅新建模式时）
  React.useEffect(() => {
    if (formData.Push_Method === 'AI' && !formData.AI_Endpoint && !isEditMode) {
      setAiReportTemplate('ai-report');
      const headersStr = aiReportPresets['ai-report'].AI_Headers;
      handleChange('AI_Endpoint', aiReportPresets['ai-report'].AI_Endpoint);
      handleChange('AI_Headers', headersStr);
      // ai-report 模板不需要初始化 AI_Body，会通过可视化字段动态生成
      setAiHeaders(parseHeadersString(headersStr));
    }
  }, [formData.Push_Method, isEditMode]);
  
  // 编辑模式下，初始化 AI Headers
  React.useEffect(() => {
    if (isEditMode && editingMessage?.AI_Headers) {
      setAiHeaders(parseHeadersString(editingMessage.AI_Headers));
    }
  }, [isEditMode, editingMessage]);
  
  // 当 ai-report 的可视化字段变化时，自动更新 Content 和 AI_Body
  React.useEffect(() => {
    if (formData.Push_Method === 'AI' && aiReportTemplate === 'ai-report') {
      // 同步 JQL 到 Content
      handleChange('Content', aiReportJql);
      // 动态构建 AI_Body
      handleChange('AI_Body', buildAiReportBody());
    }
  }, [aiReportJql, aiReportOutputs, aiReportTeamId, aiReportMentionList, aiReportExtraText, ticketIncludes, customOutputs]);
  
  // Header 管理函数
  const addAIHeader = () => {
    setAiHeaders([...aiHeaders, { name: '', value: '' }]);
  };
  
  const updateAIHeaderName = (index: number, name: string) => {
    const newHeaders = [...aiHeaders];
    newHeaders[index].name = name;
    setAiHeaders(newHeaders);
    handleChange('AI_Headers', formatHeadersToString(newHeaders));
  };
  
  const updateAIHeaderValue = (index: number, value: string) => {
    const newHeaders = [...aiHeaders];
    newHeaders[index].value = value;
    setAiHeaders(newHeaders);
    handleChange('AI_Headers', formatHeadersToString(newHeaders));
  };
  
  const removeAIHeader = (index: number) => {
    const newHeaders = aiHeaders.filter((_, i) => i !== index);
    setAiHeaders(newHeaders);
    handleChange('AI_Headers', formatHeadersToString(newHeaders));
  };
  
  // 检查是否是项目变量
  const isProjectVariable = (variable: string) => {
    return PROJECT_VARIABLE_KEYS.includes(variable);
  };
  
  // 检查内容中是否包含项目变量
  const hasProjectVariables = () => {
    return hasProjectVariablesInForm;
  };
  
  // 插入变量到 Body 输入框
  const insertVariableToBody = (variable: string) => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.AI_Body || '';
    const newText = text.substring(0, start) + variable + text.substring(end);
    
    handleChange('AI_Body', newText);
    
    // 如果插入的是项目变量，自动设置默认项目（如果还没设置）
    if (isProjectVariable(variable) && !formData.Timeline_Project) {
      handleChange('Timeline_Project', DEFAULT_TIMELINE_PROJECT);
    }
    
    // 设置光标位置到插入变量之后
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };
  
  // 插入变量到消息内容输入框
  const insertVariableToContent = (variable: string) => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.Content || '';
    const newText = text.substring(0, start) + variable + text.substring(end);
    
    handleChange('Content', newText);
    
    // 如果插入的是项目变量，自动设置默认项目（如果还没设置）
    if (isProjectVariable(variable) && !formData.Timeline_Project) {
      handleChange('Timeline_Project', DEFAULT_TIMELINE_PROJECT);
    }
    
    // 设置光标位置到插入变量之后
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };
  
  // 插入变量到 JQL 输入框
  const insertVariableToJql = (variable: string) => {
    const textarea = jqlTextareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = aiReportJql || '';
    const newText = text.substring(0, start) + variable + text.substring(end);
    
    setAiReportJql(newText);
    
    // 如果插入的是项目变量，自动设置默认项目（如果还没设置）
    if (isProjectVariable(variable) && !formData.Timeline_Project) {
      handleChange('Timeline_Project', DEFAULT_TIMELINE_PROJECT);
    }
    
    // 设置光标位置到插入变量之后
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasProjectVariablesInMessage = hasProjectVariables();
    const timelineProjectForSave = resolveTimelineProjectForSave({
      isTimelineTrigger,
      pushMethod: formData.Push_Method,
      hasProjectVariables: hasProjectVariablesInMessage,
      timelineProject: formData.Timeline_Project,
    });
    let normalizedTimelineOffset: number | undefined;
    
    // 提醒模式：检查 Bot 是否已配置
    if (isReminderMode && !botConfigured) {
      alert('请先配置 Bot 推送功能才能创建个人提醒');
      return;
    }
    
    // 验证必填字段
    if (!isOutreachMode && !formData.Topic) {
      alert('请填写消息主题');
      return;
    }

    if (scheduleTimeError) {
      alert(scheduleTimeError);
      return;
    }
    
    // 验证触发方式
    if (isTimelineTrigger) {
      // Timeline 触发验证：必须先配置执行 rule
      if (!botConfigured) {
        alert('Timeline 触发功能需要先配置 Bot 推送（需要通过 Jira Automation 规则访问 Release 信息）');
        return;
      }

      if (!timelineBotConfigured) {
        alert('Timeline 触发功能需要先补齐 Timeline Sync Rule，相关消息才能按项目 Milestone 触发。');
        return;
      }
      
      normalizedTimelineOffset = parseTimelineOffsetInputValue(String(formData.Timeline_Offset ?? ''));

      if (!formData.Timeline_Project || !formData.Timeline_Milestone || normalizedTimelineOffset === undefined) {
        alert('请完整填写 Timeline 触发配置');
        return;
      }

      if (!isValidTimelineOffsetValue(normalizedTimelineOffset)) {
        alert('Timeline 偏移天数必须是 -30 到 30 之间的整数');
        return;
      }

      // Timeline cache status is advisory at creation time. Users can draft
      // messages before the Jira sync rule has been repaired or refreshed.
    } else {
      // 时间触发验证
      if (!formData.Schedule_Date) {
        alert('请填写执行日期');
        return;
      }

      if (scheduleBlockReason) {
        alert(`${scheduleBlockReason}\n\n预计下次执行：${schedulePreviewDisplayValue || schedulePreview || '暂无可执行时间'}`);
        return;
      }

      if (scheduleQueueBlockReason) {
        alert(`${scheduleQueueBlockReason}\n\n预计下次执行：${schedulePreviewDisplayValue || schedulePreview || '暂无可执行时间'}`);
        return;
      }

      if (usesProjectVariablesForTimeTrigger) {
        if (!botConfigured) {
          alert('项目变量需要先配置 Bot 推送，执行规则才能读取并替换项目 Release 信息。');
          return;
        }

        if (!timelineBotConfigured) {
          alert('项目变量需要先补齐 Timeline Sync Rule，相关消息才能读取项目 Milestone 缓存。');
          return;
        }

        const timelineProjectCacheBlockText = getTimelineProjectCacheSaveBlockText({
          isLoading: timelineCacheStatusLoading,
          status: timelineCacheStatus,
          error: timelineCacheStatusError,
          project: timelineProjectForSave,
        });

        if (timelineProjectCacheBlockText) {
          alert(timelineProjectCacheBlockText);
          return;
        }
      }
    }
    
    // 验证推送目标
    if (formData.Push_Method === 'Outreach') {
      if (!outreachEnabled) {
        alert('主动询问引擎尚未开启，请先到 Options 页面启用后再创建主动询问计划。');
        return;
      }

      if (!outreachConfigured) {
        alert('主动询问依赖的 RingCentral 配置尚未完成，请先到 Options 页面补齐后再创建主动询问计划。');
        return;
      }

      if (!formData.Outreach_Target_Type) {
        alert('请填写主动询问目标类型');
        return;
      }

      const outreachTargetRef = formData.Outreach_Target_Type === 'group'
        ? formData.Outreach_Target_Ref?.trim() || ''
        : formatUserName.joinForStorage(userTags.slice(0, 1));

      if (!outreachTargetRef) {
        alert('请填写主动询问目标');
        return;
      }

      if (!formData.Content || !formData.Content.trim()) {
        alert('请填写询问内容');
        return;
      }

      const normalizedTargetRef = outreachTargetRef.trim().toLowerCase();
      const normalizedCurrentUsername = currentUsername.trim().toLowerCase();
      const targetsSelf =
        formData.Outreach_Target_Type !== 'group' &&
        (
          normalizedTargetRef === 'user' ||
          normalizedTargetRef === 'me' ||
          normalizedTargetRef === 'self' ||
          (normalizedCurrentUsername.length > 0 && normalizedTargetRef === normalizedCurrentUsername)
        );
      if (targetsSelf) {
        alert('主动询问只用于对外询问，不应把自己作为目标。请改用“提醒我”或等待决策中心处理。');
        return;
      }

      if (!formData.Outreach_Context || !formData.Outreach_Context.trim()) {
        alert('请填写主动询问要拿到的信息目标');
        return;
      }

      if (formData.Outreach_Max_Followup === undefined || formData.Outreach_Max_Followup < 0) {
        alert('请填写有效的最大追问次数');
        return;
      }

      if (!formData.Outreach_Followup_Interval_Hours || formData.Outreach_Followup_Interval_Hours < 1) {
        alert('请填写有效的追问间隔（小时）');
        return;
      }
    } else if (formData.Push_Method === 'AI') {
      // AI 消息验证
      if (aiReportTemplate === 'ai-report') {
        // ai-report 模板验证 JQL
        if (!aiReportJql.trim()) {
          alert('请填写 JQL 查询');
          return;
        }
      } else {
        // 其他模板验证 Content 和 Body
        if (!formData.Content) {
          alert('请填写消息内容');
          return;
        }
        if (!formData.AI_Endpoint || !formData.AI_Body) {
          alert('请填写 AI Endpoint 和 Body');
          return;
        }
      }
    } else {
      // Bot/AsMe 消息验证
      if (!formData.Content) {
        alert('请填写消息内容');
        return;
      }
      
      // 非提醒模式才需要验证推送目标（提醒模式已自动配置）
      if (!isReminderMode && formData.Push_Method !== 'JiraAutomation') {
        if (formData.Target_Type === 'private' && userTags.length === 0) {
          alert('请至少添加一个接收人');
          return;
        }
        
        if (formData.Target_Type === 'group' && !formData.Glip_Team_ID) {
          alert('请填写群组 ID');
          return;
        }
      }
    }
    
    // 验证周期性消息
    if (isRepeating) {
      const repeatEvery = Number(formData.Repeat_Every);
      if (!Number.isFinite(repeatEvery) || repeatEvery < 1 || !formData.Repeat_Unit) {
        alert('请完整填写重复设置');
        return;
      }
    }
    
    // 合并 userTags 到 Glip_User_Name（转换为存储格式：esone.qiu+john.doe）
    // 注意：不传递 Target_Type，由 AppScript 动态判断
    
    // 处理 AI Report 的 Glip_Team_ID
    let glipTeamId = formData.Glip_Team_ID;
    if (formData.Push_Method === 'AI') {
      if (aiReportTemplate === 'ai-report') {
        // ai-report 模板：使用可视化输入框的值
        glipTeamId = aiReportTeamId;
      } else if (aiReportTemplate === 'pep-report') {
        // pep-report 模板：使用专用的输入框值
        glipTeamId = pepReportTeamId;
      } else if (aiReportTemplate === 'multiple-jira-query') {
        // multiple-jira-query 模板：使用专用的输入框值
        glipTeamId = multipleJiraQueryTeamId;
      }
      // custom 模板：不处理，用户自己负责
    }

    const outreachQuestion = formData.Content?.trim();
    const outreachTitle = buildOutreachTitle(
      formData.Outreach_Target_Type,
      outreachTargetRefValue,
      outreachQuestion,
    );
    const repeatFields = buildRepeatSubmissionFields({
      isRepeating,
      repeatEvery: formData.Repeat_Every,
      repeatUnit: formData.Repeat_Unit,
      repeatCount: formData.Repeat_Count,
      selectedWeekDays,
      endDate: formData.End_Date,
    });
    
    const finalFormData: CreateMessageFormData = {
      ...formData,
      Topic: formData.Push_Method === 'Outreach' ? outreachTitle : formData.Topic,
      Content: formData.Push_Method === 'Outreach'
        ? (formData.Content || '')
        : formData.Content,
      Target_Type: formData.Push_Method === 'Outreach'
        ? formData.Outreach_Target_Type || 'private'
        : formData.Target_Type,
      Glip_User_Name: formData.Push_Method === 'Outreach'
        ? (
            formData.Outreach_Target_Type === 'group'
              ? undefined
              : formatUserName.joinForStorage(userTags.slice(0, 1))
          )
        : formData.Push_Method === 'AI'
          ? undefined
        : formatUserName.joinForStorage(userTags),
      Glip_Team_ID: formData.Push_Method === 'Outreach'
        ? (
            formData.Outreach_Target_Type === 'group'
              ? formData.Outreach_Target_Ref?.trim()
              : undefined
          )
        : glipTeamId,
      Outreach_Target_Type: formData.Push_Method === 'Outreach'
        ? formData.Outreach_Target_Type || 'private'
        : undefined,
      Outreach_Target_Ref: formData.Push_Method === 'Outreach'
        ? (formData.Outreach_Target_Type === 'group'
            ? formData.Outreach_Target_Ref?.trim()
            : formatUserName.joinForStorage(userTags.slice(0, 1)))
        : undefined,
      Outreach_Result: formData.Push_Method === 'Outreach'
        ? (isEditMode ? editingMessage?.Outreach_Result || editingMessage?.Outreach_Last_Result || '' : '')
        : undefined,
      Outreach_Context: formData.Push_Method === 'Outreach'
        ? formData.Outreach_Context?.trim()
        : undefined,
      Outreach_Max_Followup: formData.Push_Method === 'Outreach'
        ? formData.Outreach_Max_Followup
        : undefined,
      Outreach_Followup_Interval_Hours: formData.Push_Method === 'Outreach'
        ? formData.Outreach_Followup_Interval_Hours
        : undefined,
      AI_Endpoint: formData.Push_Method === 'Outreach' ? undefined : formData.AI_Endpoint,
      AI_Headers: formData.Push_Method === 'Outreach' ? undefined : formData.AI_Headers,
      AI_Body: formData.Push_Method === 'Outreach' ? undefined : formData.AI_Body,
      Automation_Link: formData.Push_Method === 'Outreach' ? undefined : formData.Automation_Link,
      ...repeatFields,
      Schedule_Date: isTimelineTrigger ? '' : formData.Schedule_Date,
      Timeline_Project: timelineProjectForSave,
      Timeline_Milestone: isTimelineTrigger ? formData.Timeline_Milestone : undefined,
      Timeline_Offset: isTimelineTrigger ? normalizedTimelineOffset : undefined,
      Category: categoryTags.length > 0 ? categoryTags.map(t => t.value).join(',') : undefined,
    };
    
    onSubmit(finalFormData);
  };
  
  const handleChange = (field: keyof CreateMessageFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleScheduleDateChange = (dateStr: string) => {
    handleChange('Schedule_Date', dateStr);
  };

  const defaultScheduleInput = {
    Push_Method: formData.Push_Method,
    AI_Endpoint: formData.AI_Endpoint,
  };
  const usesExecutorDefaultQueue = isExecutorDrivenSchedule(defaultScheduleInput);
  const defaultScheduleTime = getDefaultScheduleTime(defaultScheduleInput);
  const emptyScheduleTimeHint = getEmptyScheduleTimeHint(defaultScheduleInput);
  const defaultScheduleQuickActionLabel = usesExecutorDefaultQueue
    ? `下次 ${defaultScheduleTime}（明确时间）`
    : `下次 ${defaultScheduleTime}`;
  const clearScheduleTimeLabel = usesExecutorDefaultQueue
    ? `${defaultScheduleTime} 后队列`
    : '清空时间';

  const applyScheduleDateTime = (date: Date) => {
    const { dateStr, timeStr } = formatLocalScheduleDateTime(date);
    handleScheduleDateChange(dateStr);
    handleChange('Schedule_Time', timeStr);
  };

  const getNextWholeHour = (): Date => {
    const date = new Date();
    date.setHours(date.getHours() + 1, 0, 0, 0);
    return date;
  };

  const getNextDefaultScheduleTime = (): Date => {
    const { hours, minutes } = parseLocalScheduleTime(defaultScheduleTime);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    if (date.getTime() <= Date.now()) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  };

  const repeatDaysValue = isRepeating && formData.Repeat_Unit === 'Week' && selectedWeekDays.length > 0
    ? selectedWeekDays.join(',')
    : undefined;

  const scheduleTimeError = useMemo(() => {
    if (!hasLocalScheduleTime(formData.Schedule_Time)) {
      return '';
    }

    return isValidLocalScheduleTime(formData.Schedule_Time)
      ? ''
      : '执行时间格式异常，请使用 00:00 到 23:59 之间的本地时间。';
  }, [formData.Schedule_Time]);

  const schedulePreview = useMemo(() => {
    if (isTimelineTrigger) {
      return '';
    }

    return calculateScheduledMessageNextExecution({
      Schedule_Date: formData.Schedule_Date,
      Schedule_Time: formData.Schedule_Time,
      End_Date: formData.End_Date,
      Repeat_Every: isRepeating ? formData.Repeat_Every : undefined,
      Repeat_Unit: isRepeating ? formData.Repeat_Unit : undefined,
      Repeat_Count: isRepeating ? formData.Repeat_Count : undefined,
      Repeat_Days: repeatDaysValue,
      Push_Method: formData.Push_Method,
      AI_Endpoint: formData.AI_Endpoint,
    });
  }, [
    formData.AI_Endpoint,
    formData.End_Date,
    formData.Schedule_Date,
    formData.Schedule_Time,
    formData.Repeat_Every,
    formData.Repeat_Unit,
    formData.Repeat_Count,
    formData.Push_Method,
    isRepeating,
    isTimelineTrigger,
    repeatDaysValue,
  ]);

  const schedulePreviewLabel = useMemo(() => {
    if (!schedulePreview) {
      return '';
    }

    const hasExplicitTime = hasLocalScheduleTime(formData.Schedule_Time);
    if (!hasExplicitTime && isExecutorDrivenSchedule({
      Push_Method: formData.Push_Method,
      AI_Endpoint: formData.AI_Endpoint,
    })) {
      return `${schedulePreview} 后`;
    }

    return schedulePreview;
  }, [formData.AI_Endpoint, formData.Push_Method, formData.Schedule_Time, schedulePreview]);

  const schedulePreviewHint = useMemo(() => {
    if (!schedulePreview) {
      return '';
    }

    const hasExplicitTime = hasLocalScheduleTime(formData.Schedule_Time);
    const isExecutorDriven = isExecutorDrivenSchedule({
      Push_Method: formData.Push_Method,
      AI_Endpoint: formData.AI_Endpoint,
    });

    if (formData.Push_Method === 'Outreach') {
      return '触发时会先做答案预检，命中已有答案时不会重复发问。';
    }

    if (isExecutorDriven) {
      return hasExplicitTime
        ? 'Bot/AI 由 Jira Automation 每分钟轮询；不会早于预计时间发出，错过后 30 分钟内仍会补偿执行。'
        : 'Bot/AI 未填写时间时从 08:00 后进入队列，每分钟执行一条。';
    }

    return hasExplicitTime
      ? 'AsMe 由 Apps Script 定时触发。'
      : '未填写时间时按 09:00 执行。';
  }, [formData.AI_Endpoint, formData.Push_Method, formData.Schedule_Time, schedulePreview]);

  const scheduleQueueDraftMessage = useMemo<ScheduledMessage | null>(() => {
    if (isTimelineTrigger || !schedulePreview) {
      return null;
    }

    return {
      ID: editingMessage?.ID || '__draft_scheduled_message__',
      Topic: formData.Topic || '',
      Content: formData.Content || '',
      Schedule_Date: formData.Schedule_Date,
      Schedule_Time: formData.Schedule_Time,
      End_Date: formData.End_Date,
      Repeat_Every: isRepeating ? formData.Repeat_Every : undefined,
      Repeat_Unit: isRepeating ? formData.Repeat_Unit : undefined,
      Repeat_Count: isRepeating ? formData.Repeat_Count : undefined,
      Repeat_Days: repeatDaysValue,
      Push_Method: formData.Push_Method,
      Target_Type: formData.Target_Type,
      Glip_User_Name: formData.Glip_User_Name,
      Glip_Team_ID: formData.Glip_Team_ID,
      AI_Endpoint: formData.AI_Endpoint,
      Status: 'Active',
    };
  }, [
    editingMessage?.ID,
    formData.AI_Endpoint,
    formData.Content,
    formData.End_Date,
    formData.Glip_Team_ID,
    formData.Glip_User_Name,
    formData.Push_Method,
    formData.Schedule_Date,
    formData.Schedule_Time,
    formData.Repeat_Every,
    formData.Repeat_Unit,
    formData.Repeat_Count,
    formData.Target_Type,
    formData.Topic,
    isRepeating,
    isTimelineTrigger,
    repeatDaysValue,
    schedulePreview,
  ]);

  const scheduleQueuePressure = useMemo(() => {
    if (!scheduleQueueDraftMessage) {
      return null;
    }

    return getScheduleQueuePressure(existingMessages, scheduleQueueDraftMessage, scheduleNow);
  }, [
    existingMessages,
    scheduleQueueDraftMessage,
    scheduleNow,
  ]);

  const scheduleQueueSuggestion = useMemo(() => {
    if (!scheduleQueueDraftMessage || !scheduleQueuePressure) {
      return null;
    }

    if (!scheduleQueuePressure.hasExplicitTime && !scheduleQueuePressure.exceedsExecutionWindow) {
      return null;
    }

    return getScheduleQueueSuggestion(existingMessages, scheduleQueueDraftMessage, scheduleNow);
  }, [
    existingMessages,
    scheduleQueueDraftMessage,
    scheduleQueuePressure,
    scheduleNow,
  ]);

  const scheduleQueueBlockReason = hasScheduleQueueBlockingRisk(scheduleQueuePressure)
    ? formatScheduleQueueBlockReason(scheduleQueuePressure)
    : '';

  const scheduleQueueWarning = scheduleQueueBlockReason || (scheduleQueuePressure
    ? formatScheduleQueuePressure(scheduleQueuePressure)
    : '');

  const scheduleQueueSuggestionText = scheduleQueueSuggestion
    ? formatScheduleQueueSuggestion(scheduleQueueSuggestion)
    : '';

  const applyScheduleQueueSuggestion = () => {
    if (!scheduleQueueSuggestion) {
      return;
    }

    handleScheduleDateChange(scheduleQueueSuggestion.dateStr);
    handleChange('Schedule_Time', scheduleQueueSuggestion.timeStr);
  };

  const scheduleBlockReason = useMemo(() => {
    if (isTimelineTrigger || !formData.Schedule_Date) {
      return '';
    }

    if (isRepeating) {
      if (formData.End_Date?.trim() && !schedulePreview) {
        return '结束日期早于下一次可执行日期，请延后结束日期、调整重复规则，或关闭重复。';
      }

      return '';
    }

    if (!schedulePreview) {
      return '';
    }

    const normalized = schedulePreview.replace(' ', 'T');
    const candidate = new Date(normalized.length === 16 ? `${normalized}:00` : normalized);
    if (Number.isNaN(candidate.getTime())) {
      return '';
    }

    const now = scheduleNow.getTime();
    const hasExplicitTime = hasLocalScheduleTime(formData.Schedule_Time);
    const isExecutorDriven = isExecutorDrivenSchedule({
      Push_Method: formData.Push_Method,
      AI_Endpoint: formData.AI_Endpoint,
    });
    const allowedLagMs = hasExplicitTime && isExecutorDriven ? 30 * 60 * 1000 : 0;

    if (candidate.getTime() < now - allowedLagMs) {
      const defaultTime = getDefaultScheduleTime({
        Push_Method: formData.Push_Method,
        AI_Endpoint: formData.AI_Endpoint,
      });
      if (!hasExplicitTime && isExecutorDriven) {
        const executionDate = schedulePreview.slice(0, 10);
        const today = formatLocalScheduleDate(scheduleNow);

        if (executionDate < today) {
          return `未填写执行时间会按 ${defaultTime} 后队列处理，但当前日期已经过去，请改成今天或未来日期。`;
        }

        return '';
      }

      return hasExplicitTime
        ? `当前执行时间已超过可补偿窗口，请改成未来时间。`
        : `未填写执行时间会按 ${defaultTime} 处理，当前日期已经错过该时间。`;
    }

    return '';
  }, [
    formData.AI_Endpoint,
    formData.End_Date,
    formData.Push_Method,
    formData.Schedule_Date,
    formData.Schedule_Time,
    isRepeating,
    isTimelineTrigger,
    schedulePreview,
    scheduleNow,
  ]);
  const schedulePreviewDisplayValue = schedulePreviewLabel || (scheduleBlockReason ? '暂无可执行时间' : '');
  const scheduleTimezoneHint = useMemo(
    () => formatLocalScheduleTimezoneHint(schedulePreview || formData.Schedule_Date),
    [formData.Schedule_Date, schedulePreview],
  );

  const hasScheduleWarning = Boolean(
    scheduleBlockReason ||
    scheduleQueueBlockReason ||
    hasScheduleQueueBlockingRisk(scheduleQueuePressure),
  );
  const isSubmitBlockedBySchedule = Boolean(scheduleTimeError || scheduleBlockReason || scheduleQueueBlockReason);
  const executionRoute = useMemo(() => getScheduledMessageExecutionRoute({
    Push_Method: formData.Push_Method,
    AI_Endpoint: formData.AI_Endpoint,
    Automation_Link: formData.Automation_Link,
    Schedule_Date: formData.Schedule_Date,
  }, {
    botConfigured,
    ringCentralSenderConfigured,
    outreachEnabled,
    outreachConfigured,
  }), [
    botConfigured,
    formData.AI_Endpoint,
    formData.Automation_Link,
    formData.Push_Method,
    formData.Schedule_Date,
    outreachConfigured,
    outreachEnabled,
    ringCentralSenderConfigured,
  ]);
  const executionRouteSummary = formatExecutionRouteSummary(executionRoute);
  
  const handleUserTagsChange = (tags: string[]) => {
    setUserTags(tags);
  };

  const outreachTargetRefValue = formData.Outreach_Target_Type === 'group'
    ? (formData.Outreach_Target_Ref || '')
    : formatUserName.joinForStorage(userTags.slice(0, 1));
  
  return (
    <div style={dialogStyles.overlay}>
      <div style={dialogStyles.dialog}>
        <div style={dialogStyles.header}>
          <h2 style={dialogStyles.title}>
            {isEditMode
              ? (isOutreachMode ? '✏️ 编辑主动询问计划' : '✏️ 编辑定时消息')
              : isReminderMode
                ? '⏰ 新增个人提醒'
                : isOutreachMode
                  ? '💬 新增主动询问'
                  : '➕ 新增定时消息'}
          </h2>
          <button style={dialogStyles.closeButton} onClick={onCancel}>✕</button>
        </div>
        
        <form onSubmit={handleSubmit} style={dialogStyles.form}>
          {/* 提醒模式说明 */}
          {isReminderMode && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#e7f3ff',
              borderRadius: '8px',
              marginBottom: '16px',
              border: '1px solid #b3d7ff',
            }}>
              <div style={{ fontSize: '14px', color: '#0066cc', lineHeight: '1.6' }}>
                <strong>💡 个人提醒模式</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                  此模式会通过 Bot 向您发送私信提醒，无需配置推送方式和接收人。
                </p>
              </div>
            </div>
          )}

          {isOutreachMode && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#eef6ff',
              borderRadius: '8px',
              marginBottom: '16px',
              border: '1px solid #cfe2ff',
            }}>
              <div style={{ fontSize: '14px', color: '#1f4e79', lineHeight: '1.6' }}>
                <strong>💬 主动询问计划</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                  这里填写“要问谁、问什么、希望拿到什么信息”。Sheet 里只保留原始提问和基础目标信息；信息目标、追问策略和结果摘要都以下游 memory-service 为准。
                </p>
              </div>
            </div>
          )}
          
          {/* 消息内容（提醒模式始终显示；主动询问使用独立的问题输入框） */}
          {!isOutreachMode && !(formData.Push_Method === 'AI' && aiReportTemplate === 'ai-report' && !isReminderMode) && (
            <div style={dialogStyles.formGroup}>
              <label style={dialogStyles.label}>消息内容 *</label>
              <textarea 
                ref={contentTextareaRef}
                style={dialogStyles.textarea}
                value={formData.Content}
                onChange={(e) => handleChange('Content', e.target.value)}
                onBlur={handleContentBlur}
                placeholder={isReminderMode ? "输入提醒内容" : "输入消息内容"}
                rows={4}
              />
              {/* 提醒模式下隐藏变量选择器，AsMe 模式也隐藏（无法获取 releaseInfo）*/}
              {!isReminderMode && formData.Push_Method !== 'AsMe' && (
                <VariableSelector 
                  onInsert={insertVariableToContent}
                  excludeVariables={['{Topic}', '{Content}', '{TeamID}']}
                />
              )}
            </div>
          )}

          {isOutreachMode && (
            <div style={{...dialogStyles.section, backgroundColor: '#f8fbff', padding: '16px', borderRadius: '8px', border: '1px solid #d7e7ff'}}>
              <h3 style={{margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold', color: '#1f4e79'}}>
                💬 询问对象与内容
              </h3>

              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>主动询问对象类型 *</label>
                <div style={dialogStyles.buttonGroup}>
                  <button
                    type="button"
                    style={getButtonStyle(formData.Outreach_Target_Type === 'private')}
                    onClick={() => handleChange('Outreach_Target_Type', 'private')}
                  >
                    👤 某个人
                  </button>
                  <button
                    type="button"
                    style={getButtonStyle(formData.Outreach_Target_Type === 'group')}
                    onClick={() => handleChange('Outreach_Target_Type', 'group')}
                  >
                    👥 某个群
                  </button>
                </div>
                <small style={dialogStyles.hint}>
                  这里只需要先判断“问某个人”还是“问某个群”。如果选择某个人，系统后续会自动识别成联系人或已有私聊。
                </small>
              </div>

              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>
                  {formData.Outreach_Target_Type === 'group' ? '群组对象 *' : '目标对象 *'}
                </label>
                {formData.Outreach_Target_Type === 'group' ? (
                  <input
                    style={dialogStyles.input}
                    type="text"
                    value={formData.Outreach_Target_Ref || ''}
                    onChange={(e) => handleChange('Outreach_Target_Ref', e.target.value)}
                    placeholder="例如：RCV Mobile VT3、54490570758 或聊天链接"
                  />
                ) : (
                  <TagsInput
                    tags={userTags}
                    onChange={handleUserTagsChange}
                    placeholder="输入人名后按 Enter 或直接移开焦点添加，例如：Esone Qiu 或 esone.qiu"
                    maxTags={1}
                  />
                )}
                <small style={dialogStyles.hint}>
                  {formData.Outreach_Target_Type === 'group'
                    ? '群组模式用于“问某个群”。支持群名、群聊 chat ID，或直接粘贴 RingCentral 聊天链接；审批时仍可改目标。通过链接或 chat ID 确认过一次后，后续可直接按群名搜。'
                    : '某个人模式复用接收人输入框，只能填一个人。支持 Esone Qiu / esone.qiu 这类名字格式，提交后会作为 person 目标发给 memory service；如果需要更稳，也可以继续在审批页改成聊天链接或 chat id。'}
                </small>
              </div>

              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>询问内容 *</label>
                <textarea
                  ref={contentTextareaRef}
                  style={dialogStyles.textarea}
                  value={formData.Content || ''}
                  onChange={(e) => handleChange('Content', e.target.value)}
                  placeholder="输入想让系统帮你问出去的具体问题"
                  rows={4}
                />
                <small style={dialogStyles.hint}>
                  将自动保存标题：{buildOutreachTitle(formData.Outreach_Target_Type, outreachTargetRefValue, formData.Content)}
                </small>
              </div>

              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>主动询问的信息目标 *</label>
                <textarea
                  style={dialogStyles.textarea}
                  value={formData.Outreach_Context || ''}
                  onChange={(e) => handleChange('Outreach_Context', e.target.value)}
                  placeholder="写清楚这次询问达到什么条件才算完成"
                  rows={4}
                />
                <small style={dialogStyles.hint}>
                  这部分会作为后续回复是否满足目标的判断标准
                </small>
              </div>
            </div>
          )}
          
          {/* 提醒模式：高级选项折叠容器 */}
          {isReminderMode && (
            <div 
              style={{
                overflow: 'hidden',
                transition: 'max-height 0.3s ease-in-out, opacity 0.3s ease-in-out',
                maxHeight: showAdvancedOptions ? '2000px' : '0px',
                opacity: showAdvancedOptions ? 1 : 0,
              }}
            >
              {/* 变量选择器（AsMe 模式隐藏，无法获取 releaseInfo）*/}
              {!(formData.Push_Method === 'AI' && aiReportTemplate === 'ai-report') && formData.Push_Method !== 'AsMe' && (
                <div style={dialogStyles.formGroup}>
                  <VariableSelector 
                    onInsert={insertVariableToContent}
                    excludeVariables={['{Topic}', '{Content}', '{TeamID}']}
                  />
                </div>
              )}
              
              {/* 消息主题 */}
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>
                  消息主题（可选）
                  {isGeneratingTopic && (
                    <span style={{ marginLeft: '8px', color: '#007bff', fontSize: '12px' }}>
                      ✨ AI 生成中...
                    </span>
                  )}
                </label>
                <input 
                  style={dialogStyles.input}
                  type="text"
                  value={formData.Topic}
                  onChange={(e) => {
                    handleChange('Topic', e.target.value);
                    // 用户开始输入时，取消正在进行的自动生成
                    if (e.target.value.trim()) {
                      generateTopicRequestIdRef.current++;
                      setIsGeneratingTopic(false);
                    }
                  }}
                  placeholder={isGeneratingTopic ? "AI 正在生成主题..." : "输入消息主题"}
                />
              </div>
              
              {/* 触发类型选择 */}
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>触发方式 *</label>
                <div style={dialogStyles.buttonGroup}>
                  <button
                    type="button"
                    style={getButtonStyle(!isTimelineTrigger)}
                    onClick={() => {
                      setIsTimelineTrigger(false);
                      handleScheduleDateChange(getTodayLocalScheduleDate());
                      handleChange('Timeline_Project', undefined);
                      handleChange('Timeline_Milestone', undefined);
                      handleChange('Timeline_Offset', undefined);
                    }}
                  >
                    ⏰ 时间触发
                  </button>
                  <button
                    type="button"
                    style={getButtonStyle(isTimelineTrigger)}
                    onClick={() => {
                      setIsTimelineTrigger(true);
                      handleChange('Schedule_Date', '');
                      handleChange('Timeline_Project', DEFAULT_TIMELINE_PROJECT);
                      handleChange('Timeline_Milestone', 'FF');
                      handleChange('Timeline_Offset', 0);
                    }}
                  >
                    📅 Timeline 触发
                  </button>
                </div>
              </div>
              
              {/* 是否重复推送（仅时间触发） */}
              {!isTimelineTrigger && (
                <div style={dialogStyles.formGroup}>
                  <label style={{...dialogStyles.label, display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                    <input 
                      type="checkbox"
                      checked={isRepeating}
                      onChange={(e) => {
                        setIsRepeating(e.target.checked);
                        if (e.target.checked) {
                          handleChange('Repeat_Every', 1);
                          handleChange('Repeat_Unit', 'Week');
                        }
                      }}
                      style={{marginRight: '8px'}}
                    />
                    是否重复推送
                  </label>
                </div>
              )}
            </div>
          )}
          
          {/* 非提醒模式：正常显示消息主题和触发方式 */}
          {!isReminderMode && (
            <>
              {/* 消息主题 */}
              {!isOutreachMode && (
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>
                    消息主题 *
                    {isGeneratingTopic && (
                      <span style={{ marginLeft: '8px', color: '#007bff', fontSize: '12px', fontWeight: 'normal' }}>
                        ✨ AI 生成中...
                      </span>
                    )}
                  </label>
                  <input
                    style={dialogStyles.input}
                    type="text"
                    value={formData.Topic}
                    onChange={(e) => {
                      handleChange('Topic', e.target.value);
                      // 用户开始输入时，取消正在进行的自动生成
                      if (e.target.value.trim()) {
                        generateTopicRequestIdRef.current++;
                        setIsGeneratingTopic(false);
                      }
                    }}
                    placeholder={isGeneratingTopic ? "AI 正在生成主题..." : "输入消息主题"}
                  />
                </div>
              )}
              
              {/* 触发类型选择 */}
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>触发方式 *</label>
                <div style={dialogStyles.buttonGroup}>
                  <button
                    type="button"
                    style={getButtonStyle(!isTimelineTrigger)}
                    onClick={() => {
                      setIsTimelineTrigger(false);
                      handleScheduleDateChange(getTodayLocalScheduleDate());
                      handleChange('Timeline_Project', undefined);
                      handleChange('Timeline_Milestone', undefined);
                      handleChange('Timeline_Offset', undefined);
                    }}
                  >
                    ⏰ 时间触发
                  </button>
                  <button
                    type="button"
                    style={getButtonStyle(isTimelineTrigger)}
                    onClick={() => {
                      setIsTimelineTrigger(true);
                      handleChange('Schedule_Date', '');
                      handleChange('Timeline_Project', DEFAULT_TIMELINE_PROJECT);
                      handleChange('Timeline_Milestone', 'FF');
                      handleChange('Timeline_Offset', 0);
                    }}
                  >
                    📅 Timeline 触发
                  </button>
                </div>
              </div>
            </>
          )}
          
          {/* 时间触发：执行日期 */}
          {!isTimelineTrigger && (
            <div style={dialogStyles.section}>
              <div style={dialogStyles.formRow}>
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>执行日期 *</label>
                  <input
                    style={dialogStyles.input}
                    type="date"
                    value={formData.Schedule_Date || ''}
                    onChange={(e) => handleScheduleDateChange(e.target.value)}
                  />
                </div>

                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>执行时间</label>
                  <input
                    style={dialogStyles.input}
                    type="time"
                    value={formData.Schedule_Time || ''}
                    onChange={(e) => handleChange('Schedule_Time', e.target.value)}
                    placeholder={defaultScheduleTime}
                  />
                  <small style={dialogStyles.hint}>{emptyScheduleTimeHint}</small>
                  {scheduleTimeError && (
                    <small style={dialogStyles.fieldError}>{scheduleTimeError}</small>
                  )}
                </div>
              </div>

              <div style={dialogStyles.quickActions}>
                <button
                  type="button"
                  style={dialogStyles.quickActionButton}
                  onClick={() => applyScheduleDateTime(new Date(Date.now() + 60 * 1000))}
                >
                  1 分钟后
                </button>
                <button
                  type="button"
                  style={dialogStyles.quickActionButton}
                  onClick={() => applyScheduleDateTime(getNextWholeHour())}
                >
                  下个整点
                </button>
                <button
                  type="button"
                  style={dialogStyles.quickActionButton}
                  onClick={() => applyScheduleDateTime(getNextDefaultScheduleTime())}
                >
                  {defaultScheduleQuickActionLabel}
                </button>
                <button
                  type="button"
                  style={dialogStyles.quickActionButton}
                  onClick={() => handleChange('Schedule_Time', '')}
                >
                  {clearScheduleTimeLabel}
                </button>
              </div>
              <small style={dialogStyles.hint}>按本机本地时间保存到 Sheet，避免跨日误差。{scheduleTimezoneHint}</small>
              <div
                style={executionRoute.state === 'needs_setup'
                  ? dialogStyles.executionRouteWarning
                  : dialogStyles.executionRoute}
                title={executionRouteSummary}
              >
                <div style={dialogStyles.executionRouteLabel}>执行引擎</div>
                <div style={dialogStyles.executionRouteValue}>{executionRoute.engine}</div>
                <div style={dialogStyles.executionRouteHint}>{executionRoute.detail}</div>
              </div>
              {schedulePreviewDisplayValue && (
                <div style={hasScheduleWarning ? dialogStyles.scheduleWarning : dialogStyles.schedulePreview}>
                  <div style={dialogStyles.schedulePreviewLabel}>预计下次执行</div>
                  <div style={dialogStyles.schedulePreviewValue}>{schedulePreviewDisplayValue}</div>
                  <div style={dialogStyles.schedulePreviewHint}>{scheduleTimezoneHint}</div>
                  {schedulePreviewHint && (
                    <div style={dialogStyles.schedulePreviewHint}>{schedulePreviewHint}</div>
                  )}
                  {scheduleQueueWarning && (
                    <div style={
                      hasScheduleQueueBlockingRisk(scheduleQueuePressure)
                        ? dialogStyles.scheduleWarningText
                        : dialogStyles.schedulePreviewHint
                    }>
                      {scheduleQueueWarning}
                    </div>
                  )}
                  {scheduleQueueSuggestionText && (
                    <div style={dialogStyles.scheduleSuggestionRow}>
                      <span>{scheduleQueueSuggestionText}</span>
                      <button
                        type="button"
                        style={dialogStyles.scheduleSuggestionButton}
                        onClick={applyScheduleQueueSuggestion}
                      >
                        使用建议时间
                      </button>
                    </div>
                  )}
                  {scheduleBlockReason && (
                    <div style={dialogStyles.scheduleWarningText}>{scheduleBlockReason}</div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Timeline 触发：项目和 Milestone 配置 */}
          {isTimelineTrigger && (
            <div style={{...dialogStyles.section, backgroundColor: '#f0f7ff', padding: '16px', borderRadius: '8px', marginBottom: '16px'}}>
              {/* Timeline 模式 Bot 配置检查 */}
              {(!botConfigured || !timelineBotConfigured) && (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#fff3cd',
                  borderRadius: '6px',
                  border: '1px solid #ffc107',
                  marginBottom: '16px',
                }}>
                  <p style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '14px' }}>
                    {!botConfigured
                      ? '⚠️ Timeline 触发功能需要先配置 Bot 推送才能使用（需要通过 Jira Automation 规则访问 Release 信息）'
                      : '⚠️ 当前缺少 Timeline Sync Rule，Timeline 消息（包括 AsMe）无法读取项目 Milestone 缓存，请先补齐配置。普通 Bot/AI 不受影响。'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onConfigureBot(!botConfigured ? 'create' : 'upgrade-sync-only');
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#ffc107',
                      color: '#000',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold',
                    }}
                  >
                    {!botConfigured ? '🔧 配置 Bot 后启用' : '🔧 补齐 Timeline Sync'}
                  </button>
                </div>
              )}

              {botConfigured && timelineBotConfigured && (
                <TimelineCacheStatusPanel
                  usage="timeline-trigger"
                  status={timelineCacheStatus}
                  selectedProject={formData.Timeline_Project}
                  selectedMilestone={formData.Timeline_Milestone}
                  webAppUrl={webAppUrl}
                  timelineSyncRuleUrl={timelineSyncRuleUrl}
                  isLoading={timelineCacheStatusLoading}
                  error={timelineCacheStatusError}
                  onRefresh={loadTimelineCacheStatus}
                />
              )}

              <div
                style={executionRoute.state === 'needs_setup'
                  ? dialogStyles.executionRouteWarning
                  : dialogStyles.executionRoute}
                title={executionRouteSummary}
              >
                <div style={dialogStyles.executionRouteLabel}>执行引擎</div>
                <div style={dialogStyles.executionRouteValue}>{executionRoute.engine}</div>
                <div style={dialogStyles.executionRouteHint}>{executionRoute.detail}</div>
              </div>
              
              <div style={dialogStyles.formRow}>
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>项目 *</label>
                  <Select<SelectOption, false>
                    options={TIMELINE_PROJECT_OPTIONS}
                    value={getTimelineProjectOption(formData.Timeline_Project)}
                    onChange={(option: SingleValue<SelectOption>) => option && handleChange('Timeline_Project', option.value)}
                    styles={singleSelectStyles}
                    isDisabled={!botConfigured || !timelineBotConfigured}
                    isSearchable={false}
                  />
                  <small style={dialogStyles.hint}>
                    新增请联系项目组所在 SDET 完善 <a href="https://heimdall-xmn02.int.rclabenv.com/api/swagger/#/bot/bot_get_release_info_retrieve" target="_blank" rel="noopener noreferrer" style={{color: '#007bff', textDecoration: 'underline'}}>API</a>
                  </small>
                </div>
                
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>Milestone *</label>
                  <Select<SelectOption, false>
                    options={timelineMilestoneOptions}
                    value={getTimelineMilestoneOption(formData.Timeline_Milestone || 'FF')}
                    onChange={(option: SingleValue<SelectOption>) => option && handleChange('Timeline_Milestone', option.value)}
                    styles={singleSelectStyles}
                    isDisabled={!botConfigured || !timelineBotConfigured}
                    isSearchable={false}
                  />
                  {selectedTimelineMilestoneMissing && (
                    <small style={{...dialogStyles.hint, color: '#856404'}}>
                      当前项目缓存不包含该 Milestone；可保存，但执行器会跳过直到同步出现该 Milestone。也可改选 {formatTimelineMilestoneKeys(selectedTimelineMilestoneKeys)}。
                    </small>
                  )}
                </div>
              </div>
              
              <div style={dialogStyles.formRow}>
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>偏移天数 *</label>
                  <input 
                    style={dialogStyles.input}
                    type="number"
                    min="-30"
                    max="30"
                    step="1"
                    value={formData.Timeline_Offset ?? ''}
                    onChange={(e) => handleChange('Timeline_Offset', e.target.value)}
                    disabled={!botConfigured || !timelineBotConfigured}
                  />
                  <small style={dialogStyles.hint}>
                    填 -30 到 30 的整数。负数=之前，0=当天，正数=之后。
                  </small>
                </div>
                
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>执行时间</label>
                  <input 
                    style={dialogStyles.input}
                    type="time"
                    value={formData.Schedule_Time || ''}
                    onChange={(e) => handleChange('Schedule_Time', e.target.value)}
                    placeholder={defaultScheduleTime}
                    disabled={!botConfigured || !timelineBotConfigured}
                  />
                  <small style={dialogStyles.hint}>{emptyScheduleTimeHint}</small>
                  {scheduleTimeError && (
                    <small style={dialogStyles.fieldError}>{scheduleTimeError}</small>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* 项目选择器（非 Timeline 模式下，检测到项目变量时显示）*/}
          {usesProjectVariablesForTimeTrigger && (
            <div style={{...dialogStyles.section, backgroundColor: '#fff8e1', padding: '12px', borderRadius: '8px', marginBottom: '16px'}}>
              <div style={{marginBottom: '8px', color: '#856404', fontSize: '13px', fontWeight: '500'}}>
                💡 检测到项目变量，请选择项目
              </div>
              {(!botConfigured || !timelineBotConfigured) && (
                <div style={{
                  padding: '10px',
                  backgroundColor: '#fff3cd',
                  borderRadius: '6px',
                  border: '1px solid #ffc107',
                  marginBottom: '12px',
                }}>
                  <p style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '13px' }}>
                    {!botConfigured
                      ? '项目变量需要 Bot 执行规则读取 Release 信息，先完成 Bot 推送配置。'
                      : '项目变量需要 Timeline Sync Rule 刷新 Release 缓存，先补齐同步规则。'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onConfigureBot(!botConfigured ? 'create' : 'upgrade-sync-only');
                    }}
                    style={{
                      padding: '7px 12px',
                      backgroundColor: '#ffc107',
                      color: '#000',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 'bold',
                    }}
                  >
                    {!botConfigured ? '🔧 配置 Bot' : '🔧 补齐 Timeline Sync'}
                  </button>
                </div>
              )}
              {botConfigured && timelineBotConfigured && (
                <TimelineCacheStatusPanel
                  usage="project-variables"
                  status={timelineCacheStatus}
                  selectedProject={selectedTimelineProjectValue}
                  webAppUrl={webAppUrl}
                  timelineSyncRuleUrl={timelineSyncRuleUrl}
                  isLoading={timelineCacheStatusLoading}
                  error={timelineCacheStatusError}
                  onRefresh={loadTimelineCacheStatus}
                />
              )}
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>项目 *</label>
                <Select<SelectOption, false>
                  options={TIMELINE_PROJECT_OPTIONS}
                  value={getTimelineProjectOption(selectedTimelineProjectValue)}
                  onChange={(option: SingleValue<SelectOption>) => option && handleChange('Timeline_Project', option.value)}
                  styles={singleSelectStyles}
                  isSearchable={false}
                />
                <small style={dialogStyles.hint}>
                  选择项目以替换消息中的变量（如 {'{currentRelease}'}、{'{nextPhase}'} 等）
                </small>
              </div>
            </div>
          )}
          
          {/* 是否重复 Toggle（仅非提醒模式显示，提醒模式已在高级选项中） */}
          {!isReminderMode && !isTimelineTrigger && (
            <div style={dialogStyles.formGroup}>
              <label style={{...dialogStyles.label, display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                <input 
                  type="checkbox"
                  checked={isRepeating}
                  onChange={(e) => {
                    setIsRepeating(e.target.checked);
                    if (e.target.checked) {
                      handleChange('Repeat_Every', 1);
                      handleChange('Repeat_Unit', 'Week');
                    }
                  }}
                  style={{marginRight: '8px'}}
                />
                是否重复推送
              </label>
            </div>
          )}
          
          {/* 重复设置（仅时间触发模式显示） */}
          {!isTimelineTrigger && isRepeating && (
            <div style={{...dialogStyles.section, backgroundColor: '#f8f9fa', padding: '16px', borderRadius: '8px'}}>
              <div style={dialogStyles.formRow}>
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>每隔 *</label>
                  <input 
                    style={dialogStyles.input}
                    type="number"
                    min="1"
                    value={formData.Repeat_Every || 1}
                    onChange={(e) => handleChange('Repeat_Every', parseInt(e.target.value))}
                  />
                </div>
                
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>重复单位 *</label>
                  <div style={dialogStyles.buttonGroup}>
                    {['Day', 'Week', 'Month', 'Year'].map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        style={getButtonStyle(formData.Repeat_Unit === unit)}
                        onClick={() => {
                          handleChange('Repeat_Unit', unit);
                        }}
                      >
                        {unit === 'Day' ? '天' : unit === 'Week' ? '周' : unit === 'Month' ? '月' : '年'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div style={dialogStyles.formRow}>
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>结束日期（可选）</label>
                  <input 
                    style={dialogStyles.input}
                    type="date"
                    value={formData.End_Date || ''}
                    onChange={(e) => handleChange('End_Date', e.target.value)}
                  />
                </div>
                
                {/* 多星期选择器（仅当重复单位为"周"时显示，与结束日期并列） */}
                {formData.Repeat_Unit === 'Week' && (
                  <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>每周几（可选）</label>
                    <div style={{display: 'flex', gap: '4px', flexWrap: 'wrap'}}>
                      {[
                        { day: 0, label: 'Sun' },
                        { day: 1, label: 'Mon' },
                        { day: 2, label: 'Tue' },
                        { day: 3, label: 'Wed' },
                        { day: 4, label: 'Thu' },
                        { day: 5, label: 'Fri' },
                        { day: 6, label: 'Sat' },
                      ].map(({ day, label }) => (
                        <button
                          key={day}
                          type="button"
                          style={{
                            padding: '4px 8px',
                            backgroundColor: selectedWeekDays.includes(day) ? '#007bff' : '#fff',
                            color: selectedWeekDays.includes(day) ? '#fff' : '#666',
                            border: `1px solid ${selectedWeekDays.includes(day) ? '#007bff' : '#ccc'}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: selectedWeekDays.includes(day) ? '600' : 'normal',
                            transition: 'all 0.15s',
                            minWidth: '36px',
                          }}
                          onClick={() => {
                            const newSelection = selectedWeekDays.includes(day)
                              ? selectedWeekDays.filter(d => d !== day)
                              : [...selectedWeekDays, day].sort((a, b) => a - b);
                            setSelectedWeekDays(newSelection);
                            
                            // 自动调整执行日期到最近的符合条件的日期
                            if (newSelection.length > 0) {
                              const today = new Date();
                              const currentDayOfWeek = today.getDay();
                              
                              // 找今天或之后最近的一个符合条件的日期
                              for (let offset = 0; offset < 7; offset++) {
                                const checkDay = (currentDayOfWeek + offset) % 7;
                                if (newSelection.includes(checkDay)) {
                                  const targetDate = new Date(today);
                                  targetDate.setDate(today.getDate() + offset);
                                  handleScheduleDateChange(formatLocalScheduleDate(targetDate));
                                  break;
                                }
                              }
                            }
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>重复次数（可选）</label>
                  <input
                    style={dialogStyles.input}
                    type="number"
                    min="1"
                    value={formData.Repeat_Count || ''}
                    onChange={(e) => handleChange('Repeat_Count', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="留空表示无限"
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* 提醒模式：展开更多选项按钮 */}
          {isReminderMode && (
            <div style={{
              marginBottom: '16px',
              textAlign: 'center',
            }}>
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'transparent',
                  color: '#007bff',
                  border: '1px dashed #007bff',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  margin: '0 auto',
                  transition: 'all 0.2s ease-in-out',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f7ff';
                  e.currentTarget.style.borderColor = '#0056b3';
                  e.currentTarget.style.color = '#0056b3';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = '#007bff';
                  e.currentTarget.style.color = '#007bff';
                }}
              >
                <span style={{
                  display: 'inline-block',
                  transition: 'transform 0.3s ease-in-out',
                  transform: showAdvancedOptions ? 'rotate(180deg)' : 'rotate(0deg)',
                }}>
                  ▼
                </span>
                {showAdvancedOptions ? '收起高级选项' : '展开更多选项'}
              </button>
            </div>
          )}
          
          {/* 提醒模式：Bot 配置检查 */}
          {isReminderMode && !botConfigured && (
            <div style={{
              padding: '16px',
              backgroundColor: '#fff3cd',
              borderRadius: '8px',
              border: '1px solid #ffc107',
              marginBottom: '16px',
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#856404', fontSize: '15px' }}>
                ⚠️ Bot 推送功能未配置
              </div>
              <p style={{ margin: '0 0 12px 0', color: '#856404', fontSize: '14px', lineHeight: '1.6' }}>
                个人提醒功能需要通过 Bot 发送消息。请先配置 Bot 推送功能才能使用。
              </p>
                  <button
                    type="button"
                    onClick={() => {
                      onConfigureBot();
                    }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#ffc107',
                  color: '#000',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                🔧 立即配置 Bot
              </button>
            </div>
          )}
          
          {/* 非提醒模式：显示完整的推送配置 */}
          {!isReminderMode && !isOutreachMode && (
            <>
           {/* 推送方式 */}
           <div style={dialogStyles.formGroup}>
             <label style={dialogStyles.label}>推送方式 *</label>
             {/* JiraAutomation 模式只显示一个选中的选项 */}
             {formData.Push_Method === 'JiraAutomation' ? (
               <div style={dialogStyles.buttonGroup}>
                 <button
                   type="button"
                   style={{
                     ...getButtonStyle(true),
                     cursor: 'default',
                   }}
                   disabled
                 >
                   🔧 JIRA 自动化
                 </button>
               </div>
             ) : (
             <div style={dialogStyles.buttonGroup}>
               <button
                 type="button"
                 style={getButtonStyle(formData.Push_Method === 'AsMe')}
                 onClick={() => handleChange('Push_Method', 'AsMe')}
               >
                 👤 AsMe（以我的身份）
               </button>
               <button
                 type="button"
                 style={getButtonStyle(formData.Push_Method === 'Bot', !botConfigured)}
                 onClick={() => handleChange('Push_Method', 'Bot')}
                 disabled={!botConfigured}
               >
                 🤖 Bot（机器人）
               </button>
               <button
                 type="button"
                 style={getButtonStyle(formData.Push_Method === 'AI', !botConfigured)}
                 onClick={() => handleChange('Push_Method', 'AI')}
                 disabled={!botConfigured}
               >
                 🤖 AI Report
               </button>
             </div>
             )}
             {formData.Push_Method === 'Bot' && !botConfigured && (
               <div style={{
                 marginTop: '12px',
                 padding: '12px',
                 backgroundColor: '#fff3cd',
                 borderRadius: '6px',
                 border: '1px solid #ffc107',
               }}>
                 <p style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '14px' }}>
                   ⚠️ 您还未配置 Bot 推送功能，需要先配置才能使用。
                 </p>
                 <button
                   type="button"
                   onClick={() => {
                     onConfigureBot();
                   }}
                   style={{
                     padding: '8px 16px',
                     backgroundColor: '#ffc107',
                     color: '#000',
                     border: 'none',
                     borderRadius: '4px',
                     cursor: 'pointer',
                     fontSize: '14px',
                     fontWeight: 'bold',
                   }}
                 >
                   🔧 配置 Bot 后启用
                 </button>
               </div>
             )}
             {formData.Push_Method === 'AI' && !botConfigured && (
               <div style={{
                 marginTop: '12px',
                 padding: '12px',
                 backgroundColor: '#fff3cd',
                 borderRadius: '6px',
                 border: '1px solid #ffc107',
               }}>
                 <p style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '14px' }}>
                   ⚠️ AI Report 功能需要配置 Bot 推送功能才能使用。
                 </p>
                 <button
                   type="button"
                   onClick={() => {
                     onConfigureBot();
                   }}
                   style={{
                     padding: '8px 16px',
                     backgroundColor: '#ffc107',
                     color: '#000',
                     border: 'none',
                     borderRadius: '4px',
                     cursor: 'pointer',
                     fontSize: '14px',
                     fontWeight: 'bold',
                   }}
                 >
                   🔧 配置 Bot 后启用
                 </button>
               </div>
             )}
             {formData.Push_Method === 'AsMe' && !ringCentralSenderConfigured && (
               <div style={{
                 marginTop: '12px',
                 padding: '12px',
                 backgroundColor: '#e7f3ff',
                 borderRadius: '6px',
                 border: '1px solid #b3d7ff',
               }}>
                 <p style={{ margin: '0 0 10px 0', color: '#0b4f79', fontSize: '14px', lineHeight: '1.5' }}>
                   AsMe 当前会继续使用邮件 fallback。配置 RingCentral sender 后，将由 Jira rule 调内网 Dify 接口发送，可支持 @ 人。
                 </p>
                 <button
                   type="button"
                   onClick={onConfigureRingCentralSender}
                   style={{
                     padding: '8px 16px',
                     backgroundColor: '#007bff',
                     color: '#fff',
                     border: 'none',
                     borderRadius: '4px',
                     cursor: 'pointer',
                     fontSize: '14px',
                     fontWeight: 'bold',
                   }}
                 >
                   🔧 配置 @ 人发送能力
                 </button>
               </div>
             )}
           </div>
          
          {/* AI Report 配置 */}
          {formData.Push_Method === 'AI' && (
            <>
              {/* 模板选择 */}
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>报告模板 *</label>
                <Select<SelectOption, false>
                  options={[
                    { value: 'ai-report', label: '🤖 AI Report' },
                    { value: 'pep-report', label: '📊 PEP Report' },
                    { value: 'multiple-jira-query', label: '🔍 Multiple Jira Query' },
                    { value: 'custom', label: '⚙️ 自定义' }
                  ]}
                  value={{ 
                    value: aiReportTemplate, 
                    label: aiReportTemplate === 'ai-report' ? '🤖 AI Report' : 
                           aiReportTemplate === 'pep-report' ? '📊 PEP Report' : 
                           aiReportTemplate === 'multiple-jira-query' ? '🔍 Multiple Jira Query' : '⚙️ 自定义' 
                  }}
                  onChange={(option: SingleValue<SelectOption>) => option && handleTemplateChange(option.value as 'ai-report' | 'pep-report' | 'multiple-jira-query' | 'custom')}
                  styles={singleSelectStyles}
                  isSearchable={false}
                />
                {/* PEP Report 文档提示 */}
                {aiReportTemplate === 'pep-report' && (
                  <small style={{...dialogStyles.hint, marginTop: '8px'}}>
                    📖 参数说明请参考文档：
                    <a 
                      href="https://wiki.ringcentral.com/spaces/XTO/pages/958780959/PEP+Daily+Report" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{color: '#007bff', textDecoration: 'underline', marginLeft: '4px'}}
                    >
                      PEP Daily Report 文档
                    </a>
                  </small>
                )}
                {/* Multiple Jira Query 文档提示 */}
                {aiReportTemplate === 'multiple-jira-query' && (
                  <small style={{...dialogStyles.hint, marginTop: '8px'}}>
                    📖 参数说明请参考 API 文档：
                    <a 
                      href="https://pep.int.rclabenv.com/usage/multiple_jira_query_notify" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{color: '#007bff', textDecoration: 'underline', marginLeft: '4px'}}
                    >
                      Multiple Jira Query Notify
                    </a>
                  </small>
                )}
              </div>
              
              {/* AI Endpoint */}
              {(aiReportTemplate === 'custom') && (
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>API Endpoint *</label>
                  <input 
                    style={dialogStyles.input}
                    type="text"
                    value={formData.AI_Endpoint || ''}
                    onChange={(e) => handleChange('AI_Endpoint', e.target.value)}
                    placeholder="POST https://example.com/api 或 GET https://example.com/api 或 https://example.com/api"
                  />
                  <small style={dialogStyles.hint}>格式：POST/GET URL 或仅 URL（默认为 GET）</small>
                </div>
              )}
              
              {/* AI Headers */}
              {(aiReportTemplate === 'custom') && (
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>Headers</label>
                  <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '12px', backgroundColor: '#f9f9f9' }}>
                    {aiHeaders.map((header, index) => (
                      <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'flex-start' }}>
                        <div style={{ flex: '0 0 200px' }}>
                          <Select<SelectOption, false>
                            options={AVAILABLE_AI_HEADERS.map(h => ({ value: h.value, label: h.label }))}
                            value={header.name ? { value: header.name, label: AVAILABLE_AI_HEADERS.find(h => h.value === header.name)?.label || header.name } : null}
                            onChange={(option: SingleValue<SelectOption>) => updateAIHeaderName(index, option?.value || '')}
                            placeholder="选择 Header"
                            styles={singleSelectStyles}
                            isClearable
                          />
                        </div>
                        <input
                          type="text"
                          value={header.value}
                          onChange={(e) => updateAIHeaderValue(index, e.target.value)}
                          placeholder={
                            header.name
                              ? AVAILABLE_AI_HEADERS.find(h => h.value === header.name)?.placeholder || 'Header 值'
                              : 'Header 值'
                          }
                          style={{
                            ...dialogStyles.input,
                            flex: 1,
                            marginBottom: 0
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeAIHeader(index)}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#dc3545',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            whiteSpace: 'nowrap'
                          }}
                          title="删除此 Header"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addAIHeader}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#28a745',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        width: '100%',
                        marginTop: aiHeaders.length > 0 ? '4px' : '0'
                      }}
                    >
                      ➕ 添加 Header
                    </button>
                  </div>
                  <small style={dialogStyles.hint}>
                    💡 提示：只支持预定义的 7 个 header 名称，选择后填写对应的值即可
                  </small>
                </div>
              )}
              
              {/* AI Body */}
              {aiReportTemplate === 'ai-report' ? (
                /* AI Report 可视化配置 */
                <div style={{...dialogStyles.section, backgroundColor: '#f8f9fa', padding: '16px', borderRadius: '8px'}}>
                  <h3 style={{margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold', color: '#333'}}>
                    📊 AI Report 配置
                  </h3>
                  
                  {/* JQL 输入框 */}
                  <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>JQL 查询 *</label>
                    <textarea 
                      ref={jqlTextareaRef}
                      style={dialogStyles.textarea}
                      value={aiReportJql}
                      onChange={(e) => setAiReportJql(e.target.value)}
                      placeholder='例如：project = MTR AND status = "In Progress"'
                      rows={3}
                    />
                    {/* JQL 变量选择器 - 只显示当前 Release */}
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 10px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                      border: '1px solid #e0e0e0',
                      fontSize: '12px',
                      color: '#666',
                    }}>
                      <span style={{ marginRight: '8px' }}>💡 插入变量：</span>
                      <button
                        type="button"
                        onClick={() => insertVariableToJql('{currentRelease}')}
                        style={{
                          padding: '2px 8px',
                          backgroundColor: '#e0e0e0',
                          color: '#555',
                          border: 'none',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#d0d0d0';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#e0e0e0';
                        }}
                        title="插入 {currentRelease}"
                      >
                        当前 Release
                      </button>
                    </div>
                  </div>
                  
                  {/* 版块自定义 */}
                  <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>版块自定义</label>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                      
                      {/* 列出JQL查询结果 */}
                      <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px'}}>
                        <input 
                          type="checkbox"
                          checked={aiReportOutputs.tickets}
                          onChange={(e) => setAiReportOutputs({...aiReportOutputs, tickets: e.target.checked})}
                          style={{marginRight: '8px'}}
                        />
                        列出JQL查询结果
                      </label>
                      {/* ticket 字段多选 */}
                      {aiReportOutputs.tickets && (
                        <div style={{
                          marginLeft: '24px',
                          padding: '12px',
                          backgroundColor: '#f8f9fa',
                          borderRadius: '6px',
                          border: '1px solid #e0e0e0',
                        }}>
                          <div style={{fontSize: '13px', color: '#666', marginBottom: '8px'}}>
                            选择要展示的 ticket 字段：
                          </div>
                          <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                            {[
                              { key: 'summary', label: 'Summary' },
                              { key: 'status', label: 'Status' },
                              { key: 'assignee', label: 'Assignee' },
                              { key: 'reporter', label: 'Reporter' },
                              { key: 'priority', label: 'Priority' },
                              { key: 'duedate', label: 'Due Date' },
                              { key: 'created', label: 'Created' },
                              { key: 'updated', label: 'Updated' },
                              { key: 'labels', label: 'Labels' },
                              { key: 'components', label: 'Components' },
                              { key: 'fixVersions', label: 'Fix Versions' },
                              { key: 'sprint', label: 'Sprint' },
                              { key: 'team', label: 'Team' },
                            ].map(field => (
                              <label 
                                key={field.key}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  padding: '4px 8px',
                                  backgroundColor: ticketIncludes.includes(field.key) ? '#e3f2fd' : '#fff',
                                  border: `1px solid ${ticketIncludes.includes(field.key) ? '#1976d2' : '#ddd'}`,
                                  borderRadius: '4px',
                                }}
                              >
                                <input 
                                  type="checkbox"
                                  checked={ticketIncludes.includes(field.key)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setTicketIncludes([...ticketIncludes, field.key]);
                                    } else {
                                      setTicketIncludes(ticketIncludes.filter(f => f !== field.key));
                                    }
                                  }}
                                  style={{marginRight: '4px'}}
                                />
                                {field.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px'}}>
                        <input 
                          type="checkbox"
                          checked={aiReportOutputs.noduedate}
                          onChange={(e) => setAiReportOutputs({...aiReportOutputs, noduedate: e.target.checked})}
                          style={{marginRight: '8px'}}
                        />
                        展示没填 Duedate 的 tickets
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px'}}>
                        <input 
                          type="checkbox"
                          checked={aiReportOutputs.overdue}
                          onChange={(e) => setAiReportOutputs({...aiReportOutputs, overdue: e.target.checked})}
                          style={{marginRight: '8px'}}
                        />
                        展示 Duedate 超时的 tickets
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px'}}>
                        <input 
                          type="checkbox"
                          checked={aiReportOutputs.toTest}
                          onChange={(e) => setAiReportOutputs({...aiReportOutputs, toTest: e.target.checked})}
                          style={{marginRight: '8px'}}
                        />
                        展示待 QA 验证的 tickets
                      </label>
                      
                      {/* 已添加的自定义版块列表 */}
                      {customOutputs.map((output, index) => (
                        <div 
                          key={index}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            backgroundColor: '#e8f5e9',
                            borderRadius: '6px',
                            border: '1px solid #a5d6a7',
                          }}
                        >
                          <div style={{flex: 1, overflow: 'hidden'}}>
                            <div style={{fontWeight: 'bold', color: '#2e7d32', fontSize: '14px'}}>
                              {output.name ? `📋 ${output.name}` : '📋 自定义版块'}
                            </div>
                            <div style={{
                              color: '#666', 
                              fontSize: '12px', 
                              marginTop: '4px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {output.prompt}
                            </div>
                          </div>
                          <div style={{display: 'flex', gap: '8px'}}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCustomOutputIndex(index);
                                setCustomOutputName(output.name);
                                setCustomOutputPrompt(output.prompt);
                                setShowCustomOutputDialog(true);
                              }}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: '#fff',
                                color: '#1976d2',
                                border: '1px solid #1976d2',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCustomOutputs(customOutputs.filter((_, i) => i !== index));
                              }}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: '#fff',
                                color: '#dc3545',
                                border: '1px solid #dc3545',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {/* 添加自定义版块按钮 */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCustomOutputIndex(null);
                          setCustomOutputName('');
                          setCustomOutputPrompt('');
                          setShowCustomOutputDialog(true);
                        }}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#fff',
                          color: '#28a745',
                          border: '1px dashed #28a745',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          marginTop: '4px',
                        }}
                      >
                        ➕ 添加自定义版块
                      </button>
                      
                      {/* 自定义版块的 ticket 字段选择器（仅当有自定义版块且未勾选"列出JQL查询结果"时显示） */}
                      {customOutputs.length > 0 && !aiReportOutputs.tickets && (
                        <div style={{
                          marginTop: '12px',
                          padding: '12px',
                          backgroundColor: '#f8f9fa',
                          borderRadius: '6px',
                          border: '1px solid #e0e0e0',
                        }}>
                          <div style={{fontSize: '13px', color: '#666', marginBottom: '8px'}}>
                            选择要提供给自定义版块分析的 ticket 字段：
                          </div>
                          <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                            {[
                              { key: 'summary', label: 'Summary' },
                              { key: 'status', label: 'Status' },
                              { key: 'assignee', label: 'Assignee' },
                              { key: 'reporter', label: 'Reporter' },
                              { key: 'priority', label: 'Priority' },
                              { key: 'duedate', label: 'Due Date' },
                              { key: 'created', label: 'Created' },
                              { key: 'updated', label: 'Updated' },
                              { key: 'labels', label: 'Labels' },
                              { key: 'components', label: 'Components' },
                              { key: 'fixVersions', label: 'Fix Versions' },
                              { key: 'sprint', label: 'Sprint' },
                              { key: 'team', label: 'Team' },
                            ].map(field => (
                              <label 
                                key={field.key}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  padding: '4px 8px',
                                  backgroundColor: ticketIncludes.includes(field.key) ? '#e3f2fd' : '#fff',
                                  border: `1px solid ${ticketIncludes.includes(field.key) ? '#1976d2' : '#ddd'}`,
                                  borderRadius: '4px',
                                }}
                              >
                                <input 
                                  type="checkbox"
                                  checked={ticketIncludes.includes(field.key)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setTicketIncludes([...ticketIncludes, field.key]);
                                    } else {
                                      setTicketIncludes(ticketIncludes.filter(f => f !== field.key));
                                    }
                                  }}
                                  style={{marginRight: '4px'}}
                                />
                                {field.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 自定义版块对话框 */}
                  {showCustomOutputDialog && (
                    <div style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      zIndex: 2000,
                    }}>
                      <div style={{
                        backgroundColor: '#fff',
                        borderRadius: '12px',
                        padding: '20px',
                        maxWidth: '500px',
                        width: '90%',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                      }}>
                        <h3 style={{margin: '0 0 16px 0', fontSize: '18px', color: '#333'}}>
                          {editingCustomOutputIndex !== null ? '📝 编辑自定义版块' : '➕ 添加自定义版块'}
                        </h3>
                        
                        <div style={{marginBottom: '16px'}}>
                          <label style={{display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 'bold', color: '#333'}}>
                            版块名称（可选）
                          </label>
                          <input 
                            type="text"
                            value={customOutputName}
                            onChange={(e) => setCustomOutputName(e.target.value)}
                            placeholder="例如：风险分析（可留空）"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '14px',
                              boxSizing: 'border-box',
                            }}
                          />
                          <small style={{display: 'block', marginTop: '4px', fontSize: '12px', color: '#999'}}>
                            留空时不会显示标题，直接输出分析结果
                          </small>
                        </div>
                        
                        <div style={{marginBottom: '16px'}}>
                          <label style={{display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 'bold', color: '#333'}}>
                            Prompt *
                          </label>
                          <textarea 
                            value={customOutputPrompt}
                            onChange={(e) => setCustomOutputPrompt(e.target.value)}
                            placeholder="例如：分析这些 tickets 中可能存在的风险点，并给出建议"
                            rows={4}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '14px',
                              resize: 'vertical',
                              boxSizing: 'border-box',
                            }}
                          />
                          <small style={{display: 'block', marginTop: '4px', fontSize: '12px', color: '#999'}}>
                            描述 AI 应该如何处理这个版块的内容
                          </small>
                        </div>
                        
                        <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCustomOutputDialog(false);
                              setEditingCustomOutputIndex(null);
                              setCustomOutputName('');
                              setCustomOutputPrompt('');
                            }}
                            style={{
                              padding: '10px 20px',
                              backgroundColor: '#6c757d',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '14px',
                            }}
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!customOutputPrompt.trim()) {
                                alert('请填写 Prompt');
                                return;
                              }
                              
                              const newOutput = { 
                                name: customOutputName.trim(), 
                                prompt: customOutputPrompt.trim() 
                              };
                              
                              if (editingCustomOutputIndex !== null) {
                                // 编辑模式
                                const newOutputs = [...customOutputs];
                                newOutputs[editingCustomOutputIndex] = newOutput;
                                setCustomOutputs(newOutputs);
                              } else {
                                // 添加模式
                                setCustomOutputs([...customOutputs, newOutput]);
                              }
                              
                              setShowCustomOutputDialog(false);
                              setEditingCustomOutputIndex(null);
                              setCustomOutputName('');
                              setCustomOutputPrompt('');
                            }}
                            style={{
                              padding: '10px 20px',
                              backgroundColor: '#28a745',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '14px',
                            }}
                          >
                            {editingCustomOutputIndex !== null ? '保存修改' : '添加版块'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Team ID */}
                  <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>Team ID</label>
                    <input 
                      style={dialogStyles.input}
                      type="text"
                      value={aiReportTeamId}
                      onChange={(e) => setAiReportTeamId(e.target.value)}
                      placeholder="例如：148192141318"
                    />
                    <small style={dialogStyles.hint}>
                      如何获取 Team ID 请参考 <a href="https://drive.google.com/file/d/1t6KrOK7OZL3f8X2LBIM02H5OsIl38_QC/view" target="_blank" rel="noopener noreferrer" style={{color: '#007bff', textDecoration: 'underline'}}>教程</a>
                    </small>
                  </div>
                  
                  {/* @ 成员 */}
                  <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>@ 成员</label>
                    <TagsInput
                      tags={aiReportMentionList}
                      onChange={setAiReportMentionList}
                      placeholder="输入人名后按 Enter 或直接移开焦点添加，例如：Esone Qiu 或 esone.qiu"
                    />
                    <small style={dialogStyles.hint}>
                      支持格式：<strong>Esone Qiu</strong> 或 <strong>esone.qiu</strong>，按 Enter 或直接移开焦点即可添加
                    </small>
                  </div>
                  
                  {/* 尾部添加文本 */}
                  <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>尾部添加文本</label>
                    <textarea 
                      style={dialogStyles.textarea}
                      value={aiReportExtraText}
                      onChange={(e) => setAiReportExtraText(e.target.value)}
                      placeholder="可选，在报告末尾添加自定义文本"
                      rows={2}
                    />
                  </div>
                </div>
              ) : (
                /* PEP Report 和自定义模板：显示 JSON 输入框 */
                  <>
                   {/* PEP Report 专用：群组 ID 输入框 */}
                   {aiReportTemplate === 'pep-report' && (
                     <div style={dialogStyles.formGroup}>
                       <label style={dialogStyles.label}>群组 ID</label>
                       <input 
                         style={dialogStyles.input}
                         type="text"
                         value={pepReportTeamId}
                         onChange={(e) => setPepReportTeamId(e.target.value)}
                         placeholder="例如：148192141318"
                       />
                       <small style={dialogStyles.hint}>
                         如何获取 Team ID 请参考 <a href="https://drive.google.com/file/d/1t6KrOK7OZL3f8X2LBIM02H5OsIl38_QC/view" target="_blank" rel="noopener noreferrer" style={{color: '#007bff', textDecoration: 'underline'}}>教程</a>
                       </small>
                     </div>
                   )}

                   {/* Multiple Jira Query 专用：群组 ID 输入框 */}
                   {aiReportTemplate === 'multiple-jira-query' && (
                     <div style={dialogStyles.formGroup}>
                       <label style={dialogStyles.label}>群组 ID</label>
                       <input 
                         style={dialogStyles.input}
                         type="text"
                         value={multipleJiraQueryTeamId}
                         onChange={(e) => setMultipleJiraQueryTeamId(e.target.value)}
                         placeholder="例如：148192141318"
                       />
                       <small style={dialogStyles.hint}>
                         如何获取 Team ID 请参考 <a href="https://drive.google.com/file/d/1t6KrOK7OZL3f8X2LBIM02H5OsIl38_QC/view" target="_blank" rel="noopener noreferrer" style={{color: '#007bff', textDecoration: 'underline'}}>教程</a>
                       </small>
                     </div>
                   )}

                    <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>Body *</label>
                    <textarea 
                      ref={bodyTextareaRef}
                      style={dialogStyles.textarea}
                      value={formData.AI_Body || ''}
                      onChange={(e) => handleChange('AI_Body', e.target.value)}
                      placeholder='{"key": "value"}'
                      rows={8}
                    />
                    {/* AI 模式支持变量插入 */}
                    <VariableSelector 
                      onInsert={insertVariableToBody}
                    />
                  </div>
                </>
              )}
            </>
          )}
          
          {/* Outreach 跟进策略 */}
          {formData.Push_Method === 'Outreach' && (
            <div style={{...dialogStyles.section, backgroundColor: '#f8fbff', padding: '16px', borderRadius: '8px', border: '1px solid #d7e7ff'}}>
              <h3 style={{margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold', color: '#1f4e79'}}>
                🔁 跟进策略
              </h3>
              <div style={dialogStyles.formRow}>
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>最大追问次数 *</label>
                  <input
                    style={dialogStyles.input}
                    type="number"
                    min="0"
                    value={formData.Outreach_Max_Followup ?? 0}
                    onChange={(e) => handleChange('Outreach_Max_Followup', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  />
                  <small style={dialogStyles.hint}>留空按默认值，0 表示不追问</small>
                </div>
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>追问间隔（小时） *</label>
                  <input
                    style={dialogStyles.input}
                    type="number"
                    min="1"
                    value={formData.Outreach_Followup_Interval_Hours ?? 24}
                    onChange={(e) => handleChange('Outreach_Followup_Interval_Hours', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  />
                  <small style={dialogStyles.hint}>用于后续自动追问的等待间隔</small>
                </div>
              </div>
            </div>
          )}
          
          {/* 推送目标（仅 Bot/AsMe 时显示，JiraAutomation / Outreach 不显示） */}
          {formData.Push_Method !== 'AI' && formData.Push_Method !== 'JiraAutomation' && formData.Push_Method !== 'Outreach' && (
            <>
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>推送目标 *</label>
                <div style={dialogStyles.buttonGroup}>
                  <button
                    type="button"
                    style={getButtonStyle(formData.Target_Type === 'private')}
                    onClick={() => handleChange('Target_Type', 'private')}
                  >
                    💬 私发消息
                  </button>
                  <button
                    type="button"
                    style={getButtonStyle(formData.Target_Type === 'group')}
                    onClick={() => handleChange('Target_Type', 'group')}
                  >
                    👥 群组消息
                  </button>
                </div>
              </div>
              
              {/* 私发消息 - 用户名 */}
              {formData.Target_Type === 'private' && (
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>
                    接收人 * 
                    {formData.Push_Method === 'Bot' && <span style={{color: '#dc3545', marginLeft: '8px'}}>（Bot 模式只能填一个人名）</span>}
                  </label>
                  <TagsInput
                    tags={userTags}
                    onChange={handleUserTagsChange}
                    placeholder="输入人名后按 Enter 或直接移开焦点添加，例如：Esone Qiu 或 esone.qiu"
                    maxTags={formData.Push_Method === 'Bot' ? 1 : undefined}
                  />
                  <small style={dialogStyles.hint}>
                    支持格式：<strong>Esone Qiu</strong> 或 <strong>esone.qiu</strong>，按 Enter 或直接移开焦点即可添加
                  </small>
                </div>
              )}
              
              {/* 群组消息 - 群组 ID */}
              {formData.Target_Type === 'group' && (
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>群组 ID *</label>
                  <input 
                    style={dialogStyles.input}
                    type="text"
                    value={formData.Glip_Team_ID || ''}
                    onChange={(e) => handleChange('Glip_Team_ID', e.target.value)}
                    placeholder="例如：148192141318"
                  />
                  <small style={dialogStyles.hint}>
                    如何获取 Team ID 请参考 <a href="https://drive.google.com/file/d/1t6KrOK7OZL3f8X2LBIM02H5OsIl38_QC/view" target="_blank" rel="noopener noreferrer" style={{color: '#007bff', textDecoration: 'underline'}}>教程</a>
                  </small>
                </div>
              )}
            </>
          )}
          </>
          )}
          
          {/* 分类标签 */}
          <div style={dialogStyles.formGroup}>
            <label style={dialogStyles.label}>类别（可选）</label>
            <CreatableSelect<SelectOption, true>
              isMulti
              options={availableCategories}
              value={categoryTags}
              onChange={(newValue: MultiValue<SelectOption>) => setCategoryTags([...newValue])}
              placeholder="选择或输入类别，按 Enter 添加..."
              styles={selectStyles}
              noOptionsMessage={() => '输入新类别并按 Enter 添加'}
              formatCreateLabel={(inputValue: string) => `创建 "${inputValue}"`}
              isClearable
            />
            <small style={dialogStyles.hint}>
              可选择已有类别，或输入新类别按 Enter 创建
            </small>
          </div>
          
          {/* 提交按钮 */}
          <div style={dialogStyles.actions}>
            <button 
              type="button" 
              style={dialogStyles.cancelButton}
              onClick={onCancel}
              disabled={isSubmitting}
            >
              取消
            </button>
            <button 
              type="submit" 
              style={dialogStyles.submitButton}
              disabled={isSubmitting || isSubmitBlockedBySchedule}
              title={isSubmitBlockedBySchedule ? '请先修正执行时间或队列风险' : undefined}
            >
              {isSubmitting
                ? (isEditMode ? '保存中...' : '创建中...')
                : isSubmitBlockedBySchedule
                  ? '请先调整时间'
                  : (isEditMode ? '✅ 保存修改' : '✅ 创建消息')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 按钮选择器样式辅助函数
const getButtonStyle = (isSelected: boolean, isDisabled = false): React.CSSProperties => ({
  flex: 1,
  padding: '10px 16px',
  backgroundColor: isDisabled ? '#f5f5f5' : (isSelected ? '#007bff' : '#fff'),
  color: isDisabled ? '#999' : (isSelected ? '#fff' : '#333'),
  border: `2px solid ${isDisabled ? '#e0e0e0' : (isSelected ? '#007bff' : '#ddd')}`,
  borderRadius: '6px',
  cursor: isDisabled ? 'not-allowed' : 'pointer',
  fontSize: '14px',
  fontWeight: isSelected ? 'bold' : 'normal',
  transition: 'all 0.2s',
  opacity: isDisabled ? 0.7 : 1,
});

const getTypeStyle = (pushMethod: string): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
  };
  
  switch (pushMethod) {
    case 'AI':
      return { ...baseStyle, backgroundColor: '#e3f2fd', color: '#1976d2' }; // 蓝色 - AI Report
    case 'AsMe':
      return { ...baseStyle, backgroundColor: '#f3e5f5', color: '#7b1fa2' }; // 紫色 - 假装我发的
    case 'Bot':
      return { ...baseStyle, backgroundColor: '#fff3e0', color: '#f57c00' }; // 橙色 - Bot 定时
    case 'Outreach':
      return { ...baseStyle, backgroundColor: '#e0f7fa', color: '#006064' }; // 青色 - 主动询问
    case 'JiraAutomation':
      return { ...baseStyle, backgroundColor: '#e8f5e9', color: '#388e3c' }; // 绿色 - JIRA自动化
    default:
      return { ...baseStyle, backgroundColor: '#f5f5f5', color: '#666' };
  }
};

const getStatusStyle = (status: string): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
  };
  
  switch (status) {
    case 'Active':
      return { ...baseStyle, backgroundColor: '#d4edda', color: '#155724' };
    case 'Paused':
      return { ...baseStyle, backgroundColor: '#fff3cd', color: '#856404' };
    case 'Completed':
      return { ...baseStyle, backgroundColor: '#d1ecf1', color: '#0c5460' };
    case 'PendingReview':
      return { ...baseStyle, backgroundColor: '#ffe0b2', color: '#e65100' };
    default:
      return { ...baseStyle, backgroundColor: '#f5f5f5', color: '#666' };
  }
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #007bff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  topicText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
    display: 'block',
  },
  categoryTag: {
    display: 'inline-block',
    padding: '2px 8px',
    backgroundColor: '#e7f3ff',
    color: '#007bff',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
  },
  header: {
    backgroundColor: '#fff',
    padding: '20px',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
  },
  headerActions: {
    display: 'flex',
    gap: '10px',
  },
  reminderButton: {
    padding: '8px 16px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  addButton: {
    padding: '8px 16px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  syncButton: {
    padding: '8px 16px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  updateButton: {
    padding: '8px 16px',
    backgroundColor: '#ff5722',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    animation: 'pulse 2s infinite',
  },
  checkUpdateButton: {
    padding: '8px 16px',
    backgroundColor: '#f8f9fa',
    color: '#495057',
    border: '1px solid #ced4da',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  configButton: {
    padding: '8px 16px',
    backgroundColor: '#6c757d',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  editButton: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: '#007bff',
    border: '1px solid #007bff',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  jiraLinkButton: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: '#0052cc',
    border: '1px solid #0052cc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  deleteButton: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: '#dc3545',
    border: '1px solid #dc3545',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  statusActionButton: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: '#0d6efd',
    border: '1px solid #0d6efd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: 1,
    transition: 'all 0.2s',
  },
  warningBanner: {
    backgroundColor: '#fff3cd',
    borderLeft: '4px solid #ffc107',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #ffc107',
    animation: 'slideDown 0.3s ease-out',
  },
  updateAuthBanner: {
    backgroundColor: '#eef6ff',
    borderLeft: '4px solid #0d6efd',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #b6d4fe',
    animation: 'slideDown 0.3s ease-out',
  },
  updateAvailableBanner: {
    backgroundColor: '#fff7ed',
    borderLeft: '4px solid #f97316',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #fed7aa',
    animation: 'slideDown 0.3s ease-out',
  },
  updateErrorBanner: {
    backgroundColor: '#fef2f2',
    borderLeft: '4px solid #dc2626',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #fecaca',
    animation: 'slideDown 0.3s ease-out',
  },
  updateBannerActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginLeft: '16px',
    flexShrink: 0,
  },
  secondaryUpdateBannerButton: {
    padding: '8px 14px',
    backgroundColor: '#fff',
    color: '#9a3412',
    border: '1px solid #fdba74',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
  },
  queueInfoBanner: {
    backgroundColor: '#eef6ff',
    borderLeft: '4px solid #0d6efd',
    padding: '14px 20px',
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #b6d4fe',
    animation: 'slideDown 0.3s ease-out',
  },
  queueRiskBanner: {
    backgroundColor: '#fff7ed',
    borderLeft: '4px solid #f97316',
    padding: '14px 20px',
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #fed7aa',
    animation: 'slideDown 0.3s ease-out',
  },
  warningContent: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    flex: 1,
  },
  warningIcon: {
    fontSize: '24px',
    lineHeight: 1,
  },
  warningText: {
    flex: 1,
  },
  warningDescription: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#856404',
  },
  updateDescription: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#9a3412',
  },
  updateMetaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px 14px',
    marginTop: '8px',
  },
  updateMetaItem: {
    fontSize: '12px',
    color: '#7c2d12',
    whiteSpace: 'nowrap',
  },
  updatePreflightRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '6px',
    marginTop: '10px',
    maxWidth: '720px',
  },
  updatePreflightItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    minHeight: '28px',
    padding: '4px 8px',
    backgroundColor: '#ffedd5',
    border: '1px solid #fed7aa',
    borderRadius: '6px',
    color: '#7c2d12',
    fontSize: '12px',
    lineHeight: 1.35,
  },
  updatePreflightItemNumber: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    backgroundColor: '#f97316',
    color: '#fff',
    fontSize: '11px',
    lineHeight: 1,
    flexShrink: 0,
  },
  updateErrorDescription: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#991b1b',
  },
  queueInfoDescription: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#0b4f8a',
  },
  queueRiskDescription: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#9a3412',
  },
  queueSlotList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    alignItems: 'stretch',
    marginTop: '8px',
  },
  queueSlotItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '8px 10px',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#334155',
    lineHeight: 1.4,
    maxWidth: '100%',
    minWidth: 'min(100%, 360px)',
    flex: '1 1 360px',
    boxSizing: 'border-box',
  },
  queueSlotContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
    minWidth: 0,
  },
  queueSlotHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  queueSlotLane: {
    fontWeight: 700,
    color: '#1e293b',
  },
  queueSlotDelayPill: {
    padding: '1px 6px',
    borderRadius: '4px',
    backgroundColor: '#e0f2fe',
    color: '#075985',
    border: '1px solid #bae6fd',
    fontWeight: 600,
  },
  queueSlotRiskPill: {
    padding: '1px 6px',
    borderRadius: '4px',
    backgroundColor: '#ffedd5',
    color: '#9a3412',
    border: '1px solid #fed7aa',
    fontWeight: 700,
  },
  queueSlotCountPill: {
    padding: '1px 6px',
    borderRadius: '4px',
    backgroundColor: '#f8fafc',
    color: '#475569',
    border: '1px solid #e2e8f0',
    fontWeight: 600,
  },
  queueSlotRiskText: {
    color: '#9a3412',
    fontWeight: 600,
  },
  queueSlotActionText: {
    color: '#7c2d12',
    fontWeight: 700,
  },
  queueSlotBlockingText: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '4px',
    color: '#475569',
    fontWeight: 600,
  },
  queueSlotInlineList: {
    display: 'inline-flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '4px',
  },
  queueSlotBlockingTopic: {
    padding: '1px 5px',
    borderRadius: '4px',
    backgroundColor: '#eef2ff',
    border: '1px solid #c7d2fe',
    color: '#3730a3',
    fontWeight: 600,
  },
  queueSlotSuggestionText: {
    color: '#0f5132',
    fontWeight: 600,
  },
  queueSlotSampleList: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '4px',
  },
  queueSlotSampleLabel: {
    color: '#64748b',
    fontWeight: 600,
  },
  queueSlotSampleTopic: {
    padding: '1px 5px',
    borderRadius: '4px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#475569',
  },
  queueIssueItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '4px 8px',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#334155',
    lineHeight: 1.35,
    maxWidth: '100%',
  },
  queueIssueText: {
    minWidth: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  queueIssueSuggestionText: {
    color: '#9a3412',
    fontWeight: 600,
  },
  queueIssueActions: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  queueMoreRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '8px',
  },
  queueMoreText: {
    fontSize: '12px',
    color: '#9a3412',
  },
  queueIssueButton: {
    padding: '2px 6px',
    backgroundColor: '#fff',
    color: '#9a3412',
    border: '1px solid #fdba74',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
  },
  queueIssueButtonDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  warningButton: {
    padding: '8px 16px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    marginLeft: '16px',
  },
  updateBannerButton: {
    padding: '8px 16px',
    backgroundColor: '#ea580c',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
  },
  updateErrorButton: {
    padding: '8px 16px',
    backgroundColor: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    marginLeft: '16px',
  },
  statusBar: {
    backgroundColor: '#fff',
    padding: '15px 20px',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    gap: '20px',
  },
  statusItem: {
    fontSize: '14px',
    color: '#666',
  },
  targetReviewBanner: {
    backgroundColor: '#e8f5e9',
    borderBottom: '1px solid #c8e6c9',
    borderLeft: '4px solid #2e7d32',
    padding: '12px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
  },
  targetReviewText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    color: '#1b5e20',
    fontSize: '13px',
  },
  targetReviewButton: {
    padding: '7px 12px',
    backgroundColor: '#2e7d32',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  content: {
    padding: '20px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: '#fff',
    borderRadius: '8px',
  },
  emptyText: {
    fontSize: '18px',
    color: '#666',
    marginBottom: '10px',
  },
  emptyHint: {
    fontSize: '14px',
    color: '#999',
  },
  emptyActionButton: {
    marginTop: '16px',
    padding: '8px 16px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  messageList: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    overflowX: 'auto',
    overflowY: 'hidden',
  },
  table: {
    width: '100%',
    minWidth: '1080px',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
  },
  typeColumn: {
    width: '7%',
  },
  topicColumn: {
    width: '22%',
  },
  categoryColumn: {
    width: '8%',
  },
  recipientColumn: {
    width: '10%',
  },
  frequencyColumn: {
    width: '21%',
  },
  nextExecColumn: {
    width: '10%',
  },
  sentCountColumn: {
    width: '5%',
  },
  statusColumn: {
    width: '6%',
  },
  actionsColumn: {
    width: '11%',
  },
  th: {
    padding: '12px 10px',
    textAlign: 'left',
    backgroundColor: '#f8f9fa',
    borderBottom: '2px solid #e0e0e0',
    fontWeight: 'bold',
    fontSize: '14px',
    color: '#333',
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid #e0e0e0',
  },
  targetedMessageRow: {
    backgroundColor: '#f1f8e9',
    boxShadow: 'inset 4px 0 0 #2e7d32',
  },
  td: {
    padding: '12px 10px',
    fontSize: '14px',
    color: '#666',
    verticalAlign: 'top',
    minWidth: 0,
  },
  frequencyCell: {
    maxWidth: '320px',
  },
  frequencyStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  },
  frequencyPrimaryText: {
    display: 'block',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  schedulePolicyText: {
    display: 'block',
    maxWidth: '100%',
    color: '#6c757d',
    lineHeight: 1.35,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  schedulePolicyWarningText: {
    display: 'block',
    maxWidth: '100%',
    color: '#b45309',
    lineHeight: 1.35,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: 600,
  },
  nextExecCell: {
    whiteSpace: 'normal',
    wordBreak: 'break-word',
  },
  sentCountCell: {
    whiteSpace: 'nowrap',
  },
  statusCell: {
    whiteSpace: 'nowrap',
  },
  actionCell: {
    whiteSpace: 'normal',
  },
  rowActions: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  footer: {
    padding: '20px',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '12px',
    color: '#999',
  },
  tooltip: {
    position: 'fixed',
    backgroundColor: '#333',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    maxWidth: '400px',
    zIndex: 10000,
    pointerEvents: 'none',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  },
  tooltipHeader: {
    fontWeight: 'bold',
    marginBottom: '4px',
    fontSize: '12px',
    color: '#ffc107',
  },
  tooltipContent: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
};

// 对话框样式
const dialogStyles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '0',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #e0e0e0',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#666',
    padding: '0',
    width: '30px',
    height: '30px',
  },
  form: {
    padding: '20px',
  },
  formGroup: {
    marginBottom: '16px',
    flex: '1',
  },
  formRow: {
    display: 'flex',
    gap: '16px',
  },
  section: {
    marginBottom: '16px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  quickActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '-4px',
    marginBottom: '4px',
  },
  quickActionButton: {
    padding: '6px 10px',
    backgroundColor: '#fff',
    color: '#0056b3',
    border: '1px solid #b8daff',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    lineHeight: 1.2,
  },
  executionRoute: {
    marginTop: '10px',
    padding: '10px 12px',
    backgroundColor: '#f7fafc',
    border: '1px solid #d9e2ef',
    borderRadius: '6px',
  },
  executionRouteWarning: {
    marginTop: '10px',
    padding: '10px 12px',
    backgroundColor: '#fff8e6',
    border: '1px solid #f0c36d',
    borderRadius: '6px',
  },
  executionRouteLabel: {
    fontSize: '12px',
    color: '#5f6f82',
    marginBottom: '2px',
  },
  executionRouteValue: {
    fontSize: '14px',
    color: '#1f2937',
    fontWeight: 600,
  },
  executionRouteHint: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#5f6f82',
    lineHeight: 1.35,
  },
  schedulePreview: {
    marginTop: '10px',
    padding: '10px 12px',
    backgroundColor: '#f4f7fb',
    border: '1px solid #d9e2ef',
    borderRadius: '6px',
  },
  scheduleWarning: {
    marginTop: '10px',
    padding: '10px 12px',
    backgroundColor: '#fff8e6',
    border: '1px solid #f0c36d',
    borderRadius: '6px',
  },
  schedulePreviewLabel: {
    fontSize: '12px',
    color: '#5f6f82',
    marginBottom: '2px',
  },
  schedulePreviewValue: {
    fontSize: '14px',
    color: '#1f2937',
    fontWeight: 600,
  },
  schedulePreviewHint: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#5f6f82',
    lineHeight: 1.35,
  },
  scheduleWarningText: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#8a5a00',
    lineHeight: 1.35,
  },
  scheduleSuggestionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '8px',
    fontSize: '12px',
    color: '#5f4100',
    lineHeight: 1.35,
  },
  scheduleSuggestionButton: {
    padding: '5px 9px',
    backgroundColor: '#fff',
    color: '#8a5a00',
    border: '1px solid #f0c36d',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    lineHeight: 1.2,
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  hint: {
    display: 'block',
    marginTop: '4px',
    fontSize: '12px',
    color: '#999',
  },
  fieldError: {
    display: 'block',
    marginTop: '4px',
    fontSize: '12px',
    color: '#b42318',
    lineHeight: 1.35,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid #e0e0e0',
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  submitButton: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
};

// 添加 CSS 动画
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  button:hover {
    opacity: 0.9;
  }
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
document.head.appendChild(styleSheet);

// Bot 配置对话框组件
const BotConfigDialog: React.FC<{
  config: SheetConfig;
  mode: BotConfigDialogMode;
  defaultEnableRingCentralSender?: boolean;
  onClose: () => void;
  onSuccess: (updatedConfig: SheetConfig) => void;
}> = ({ config, mode, defaultEnableRingCentralSender = false, onClose, onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'input' | 'testing' | 'creating'>('input');
  const [isJiraNotLoggedIn, setIsJiraNotLoggedIn] = useState(false);
  const normalizedConfig = normalizeSheetConfig(config);
  const existingExecutorRule = getExecutorRule(normalizedConfig);
  const existingTimelineSyncRule = getTimelineSyncRule(normalizedConfig);
  const existingBaseRule = existingExecutorRule || existingTimelineSyncRule;
  const existingRingCentralSender = getRingCentralSenderConfig(normalizedConfig);
  const isProjectConfigLocked = mode !== 'create' && Boolean(existingBaseRule?.jiraUrl && existingBaseRule?.projectKey);
  const [jiraUrl, setJiraUrl] = useState(existingBaseRule?.jiraUrl || 'https://jira.ringcentral.com');
  const [projectKey, setProjectKey] = useState(existingBaseRule?.projectKey || '');
  const [ringCentralSenderEnabled, setRingCentralSenderEnabled] = useState(
    defaultEnableRingCentralSender || Boolean(existingRingCentralSender?.enabled)
  );
  const [ringCentralClientId, setRingCentralClientId] = useState(existingRingCentralSender?.clientId || '');
  const [ringCentralClientSecret, setRingCentralClientSecret] = useState('');
  const [ringCentralJwt, setRingCentralJwt] = useState('');
  
  // 使用 ref 跟踪组件是否已挂载
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Google Auth Token 已迁移到 utils/googleAuth.ts
  // 使用 getGoogleAuthToken（会弹窗）

  const modeTitle = mode === 'upgrade-sync-only'
    ? '🤖 升级 Timeline Sync'
    : mode === 'repair'
      ? '🤖 修复 Bot 推送'
      : '🤖 配置 Bot 推送';
  const displayedJiraUrl = (isProjectConfigLocked ? existingBaseRule?.jiraUrl : jiraUrl) || jiraUrl;

  const modeDescription = mode === 'upgrade-sync-only'
    ? [
        '只补齐 Timeline Sync Rule，现有执行 rule 保持不变',
        'Jira URL 和 Project Key 将复用现有配置',
        '同步规则每天 05:00 执行一次，负责刷新项目 Timeline 缓存',
        '同步规则每天 05:00 刷新项目里程碑缓存，Executor Rule 每分钟读取缓存',
        '补齐后可在 Jira Automation 中手动运行一次 Sync Rule，或等待下一次 05:00 同步'
      ]
    : mode === 'repair'
      ? [
          '将只重建缺失的 Jira Automation 规则',
          '仍然存在的规则会保留，不会重复创建',
          'Jira URL 和 Project Key 将优先复用现有配置',
          '如果这次开启 RingCentral AsMe sender 且当前是旧版 executor rule，会先删除旧 rule 再创建新版 rule'
        ]
      : [
          '需要您在 Jira 上有管理权限的项目',
          '系统将在该项目下创建 2 条 Automation 规则',
          '执行规则每分钟检查并发送 Bot/AI 消息，Sync 规则每天 05:00 刷新 Timeline 缓存',
          '首次配置后可在 Jira Automation 中手动运行一次 Sync Rule，或等待下一次 05:00 同步'
        ];

  const submitLabel = mode === 'upgrade-sync-only'
    ? '✅ 补齐 Timeline Sync Rule'
    : mode === 'repair'
      ? '✅ 修复缺失规则'
      : '✅ 开始配置';
  const hasExistingRingCentralClientSecret = Boolean(existingRingCentralSender?.clientSecret);
  const hasExistingRingCentralJwt = Boolean(existingRingCentralSender?.jwt);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const resolvedJiraUrl = (isProjectConfigLocked ? existingBaseRule?.jiraUrl : jiraUrl)?.trim() || '';
    const resolvedProjectKey = ((isProjectConfigLocked ? existingBaseRule?.projectKey : projectKey) || '').trim().toUpperCase();

    if (!resolvedProjectKey) {
      setError('请输入 Jira Project Key');
      return;
    }

    if (!resolvedJiraUrl) {
      setError('请输入 Jira URL');
      return;
    }

    const resolvedRingCentralSender = {
      enabled: false,
      clientId: undefined as string | undefined,
      clientSecret: undefined as string | undefined,
      jwt: undefined as string | undefined,
      updatedAt: new Date().toISOString(),
    };

    if (ringCentralSenderEnabled) {
      const resolvedClientId = ringCentralClientId.trim();
      const resolvedClientSecret = ringCentralClientSecret.trim() || existingRingCentralSender?.clientSecret || '';
      const resolvedJwt = ringCentralJwt.trim() || existingRingCentralSender?.jwt || '';

      if (!resolvedClientId || !resolvedClientSecret || !resolvedJwt) {
        setError('开启 RingCentral AsMe sender 时，需要填完整 Client ID、Client Secret 和 JWT。');
        return;
      }

      resolvedRingCentralSender.enabled = true;
      resolvedRingCentralSender.clientId = resolvedClientId;
      resolvedRingCentralSender.clientSecret = resolvedClientSecret;
      resolvedRingCentralSender.jwt = resolvedJwt;
    }
    
    setIsSubmitting(true);
    setError('');
    setIsJiraNotLoggedIn(false);
    
    try {
      // 导入服务类
      const { JiraAutomationService } = await import('./JiraAutomationService');
      const jiraService = new JiraAutomationService();
      const jiraConfig = {
        jiraUrl: resolvedJiraUrl,
        projectKey: resolvedProjectKey,
        ringCentralSender: resolvedRingCentralSender,
      };
      
      // 步骤 1: 测试连接
      setStep('testing');
      const testResult = await jiraService.testAccess(jiraConfig);
      
      if (!testResult.success) {
        throw new Error(testResult.message);
      }
      
      // 步骤 2: 创建/修复规则
      setStep('creating');
      if (!normalizedConfig.webAppUrl) {
        throw new Error('未找到 Web App URL，请先完成定时消息初始化。');
      }

      const existingBotAutomation = {
        executorRule: existingExecutorRule,
        timelineSyncRule: existingTimelineSyncRule,
      } as BotAutomationConfig;

      let nextBotAutomation: BotAutomationConfig = existingBotAutomation;
      const shouldRecreateExecutorForRingCentralSender = shouldRecreateExecutorRuleForRingCentralSenderUpgrade(
        normalizedConfig,
        resolvedRingCentralSender
      );

      if (shouldRecreateExecutorForRingCentralSender && existingBotAutomation.executorRule?.ruleId) {
        try {
          await jiraService.deleteRule(jiraConfig, existingBotAutomation.executorRule.ruleId);
        } catch (deleteError) {
          const deleteMessage = deleteError instanceof Error ? deleteError.message : String(deleteError);
          if (!deleteMessage.includes('(404)')) {
            throw deleteError;
          }
          console.warn('旧 Bot executor rule 已不存在，继续创建新 rule:', deleteError);
        }

        const executorRule = await jiraService.createBotExecutorRule(jiraConfig, normalizedConfig.webAppUrl);
        const timelineSyncRule = existingBotAutomation.timelineSyncRule?.ruleId
          ? existingBotAutomation.timelineSyncRule
          : await jiraService.createTimelineSyncRule(jiraConfig, normalizedConfig.webAppUrl);

        nextBotAutomation = {
          executorRule,
          timelineSyncRule,
        };
      } else if (mode === 'create') {
        nextBotAutomation = await jiraService.createBotAutomationRules(jiraConfig, normalizedConfig.webAppUrl);
      } else if (mode === 'upgrade-sync-only') {
        if (!existingBotAutomation.executorRule?.ruleId) {
          throw new Error('缺少执行规则，无法仅升级 Timeline Sync Rule，请改用修复模式。');
        }

        const timelineSyncRule = existingBotAutomation.timelineSyncRule?.ruleId
          ? existingBotAutomation.timelineSyncRule
          : await jiraService.createTimelineSyncRule(jiraConfig, normalizedConfig.webAppUrl);

        nextBotAutomation = {
          ...existingBotAutomation,
          timelineSyncRule,
        };
      } else {
        nextBotAutomation = { ...existingBotAutomation };

        if (!nextBotAutomation.executorRule?.ruleId) {
          nextBotAutomation.executorRule = await jiraService.createBotExecutorRule(
            jiraConfig,
            normalizedConfig.webAppUrl
          );
        }

        if (!nextBotAutomation.timelineSyncRule?.ruleId) {
          nextBotAutomation.timelineSyncRule = await jiraService.createTimelineSyncRule(
            jiraConfig,
            normalizedConfig.webAppUrl
          );
        }
      }

      const updatedConfig = withRingCentralSender(
        withBotAutomation(normalizedConfig, nextBotAutomation),
        resolvedRingCentralSender
      );
      
      if (mode !== 'create' && !shouldRecreateExecutorForRingCentralSender && nextBotAutomation.executorRule?.ruleId) {
        const { JiraRuleUpdater } = await import('./JiraRuleUpdater');
        const updateResult = await new JiraRuleUpdater(updatedConfig).updateJiraRule();
        if (!updateResult.success) {
          throw new Error(updateResult.error || updateResult.message || '更新 Jira executor rule 失败');
        }
      }

      // 使用 ConfigSyncService 同步配置到 Sheet 和 Chrome Storage。放在 Jira rule 更新成功之后，
      // 避免 Config 先启用 sender 但 executor rule 未更新时禁用旧邮件 fallback。
      const token = await getGoogleAuthToken({ caller: 'BotConfigDialog.handleSubmit' });
      const { ConfigSyncService } = await import('./ConfigSyncService');
      const syncService = new ConfigSyncService(token);
      await syncService.syncConfig(updatedConfig);
      
      onSuccess(updatedConfig);
      
    } catch (err: any) {
      console.error('配置 Bot 失败:', err);
      if (isMountedRef.current) {
        const errorMessage = err.message || '配置失败，请重试';
        // 检测未登录状态（通常是 401 错误或包含登录相关关键词）
        const isNotLoggedIn = errorMessage.includes('401') || 
                              errorMessage.includes('未登录') || 
                              errorMessage.includes('登录') ||
                              errorMessage.includes('Unauthorized') ||
                              errorMessage.includes('authentication') ||
                              errorMessage.includes('login');
        setIsJiraNotLoggedIn(isNotLoggedIn);
        setError(isNotLoggedIn ? 'JIRA 未登录，请先登录后再试' : errorMessage);
        setStep('input');
      }
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };
  
  return (
    <div style={dialogStyles.overlay}>
      <div style={dialogStyles.dialog}>
        <div style={dialogStyles.header}>
          <h2 style={dialogStyles.title}>{modeTitle}</h2>
          <button 
            style={dialogStyles.closeButton} 
            onClick={onClose}
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} style={dialogStyles.form}>
          {step === 'input' && (
            <>
              <div style={{
                backgroundColor: '#e7f3ff',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '1px solid #b3d7ff',
              }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
                  📋 配置说明
                </p>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
                  {modeDescription.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                  <li>✅ Bot 配置（API 地址、Token、ID）将自动从扩展设置中读取，无需手动填写</li>
                </ul>
              </div>
              
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>Jira URL *</label>
                <input 
                  style={dialogStyles.input}
                  type="text"
                  value={jiraUrl}
                  onChange={(e) => setJiraUrl(e.target.value)}
                  placeholder="https://jira.ringcentral.com"
                  disabled={isProjectConfigLocked}
                />
                <small style={dialogStyles.hint}>
                  {isProjectConfigLocked ? '已复用现有配置，如需变更请先重新配置执行规则' : '请确保您已在浏览器中登录此 Jira 实例'}
                </small>
              </div>
              
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>Project Key *</label>
                <input 
                  style={dialogStyles.input}
                  type="text"
                  value={projectKey}
                  onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                  placeholder="MTR"
                  maxLength={10}
                  disabled={isProjectConfigLocked}
                />
                <small style={dialogStyles.hint}>
                  {isProjectConfigLocked ? '已复用现有 Project Key' : '请输入您有管理权限的项目 Key，如：MTR'}
                </small>
              </div>

              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                marginBottom: '16px',
              }}>
                <label style={{ ...dialogStyles.label, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={ringCentralSenderEnabled}
                    onChange={(e) => setRingCentralSenderEnabled(e.target.checked)}
                    disabled={isSubmitting}
                  />
                  RingCentral AsMe sender
                </label>
                <small style={dialogStyles.hint}>
                  开启后，AsMe 会由 Jira rule 调内网 Dify 接口发送；关闭时继续使用 AppScript 邮件 fallback。
                </small>

                {ringCentralSenderEnabled && (
                  <div style={{ marginTop: '14px' }}>
                    <div style={dialogStyles.formGroup}>
                      <label style={dialogStyles.label}>RingCentral Client ID *</label>
                      <input
                        style={dialogStyles.input}
                        type="text"
                        value={ringCentralClientId}
                        onChange={(e) => setRingCentralClientId(e.target.value)}
                        placeholder="Client ID"
                        disabled={isSubmitting}
                      />
                    </div>

                    <div style={dialogStyles.formGroup}>
                      <label style={dialogStyles.label}>RingCentral Client Secret *</label>
                      <input
                        style={dialogStyles.input}
                        type="password"
                        value={ringCentralClientSecret}
                        onChange={(e) => setRingCentralClientSecret(e.target.value)}
                        placeholder={hasExistingRingCentralClientSecret ? '已配置，留空则沿用' : 'Client Secret'}
                        disabled={isSubmitting}
                      />
                      {hasExistingRingCentralClientSecret && (
                        <small style={dialogStyles.hint}>为避免暴露 secret，这里不回显已有值。</small>
                      )}
                    </div>

                    <div style={dialogStyles.formGroup}>
                      <label style={dialogStyles.label}>RingCentral JWT *</label>
                      <textarea
                        style={{ ...dialogStyles.textarea, minHeight: '72px' }}
                        value={ringCentralJwt}
                        onChange={(e) => setRingCentralJwt(e.target.value)}
                        placeholder={hasExistingRingCentralJwt ? '已配置，留空则沿用' : 'JWT'}
                        disabled={isSubmitting}
                      />
                      {hasExistingRingCentralJwt && (
                        <small style={dialogStyles.hint}>为避免暴露 JWT，这里不回显已有值。</small>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {error && (
                <div style={{
                  padding: '12px',
                  backgroundColor: isJiraNotLoggedIn ? '#fff3cd' : '#f8d7da',
                  color: isJiraNotLoggedIn ? '#856404' : '#721c24',
                  borderRadius: '6px',
                  fontSize: '14px',
                  marginTop: '16px',
                  border: `1px solid ${isJiraNotLoggedIn ? '#ffc107' : '#f5c6cb'}`,
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                    {isJiraNotLoggedIn ? '⚠️ JIRA 未登录' : '❌ 配置失败'}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', marginBottom: isJiraNotLoggedIn ? '12px' : '0' }}>
                    {error}
                  </div>
                  {isJiraNotLoggedIn && (
                    <button
                      type="button"
                      onClick={() => window.open(displayedJiraUrl, '_blank')}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#ffc107',
                        color: '#000',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                      }}
                    >
                      🔗 打开 JIRA 登录
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          
          {step === 'testing' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={styles.spinner}></div>
              <p style={{ fontSize: '16px', color: '#333', marginTop: '20px' }}>
                正在测试 Jira 连接...
              </p>
            </div>
          )}
          
          {step === 'creating' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={styles.spinner}></div>
              <p style={{ fontSize: '16px', color: '#333', marginTop: '20px' }}>
                正在处理 Jira Automation 规则...
              </p>
              <p style={{ fontSize: '13px', color: '#999', marginTop: '10px' }}>
                这可能需要几秒钟，请稍候...
              </p>
            </div>
          )}
          
          {step === 'input' && (
            <div style={dialogStyles.actions}>
              <button 
                type="button" 
                style={dialogStyles.cancelButton}
                onClick={onClose}
                disabled={isSubmitting}
              >
                取消
              </button>
              <button 
                type="submit" 
                style={dialogStyles.submitButton}
                disabled={isSubmitting}
              >
                {isSubmitting ? '处理中...' : submitLabel}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

// 渲染应用
ReactDOM.render(
  <React.StrictMode>
    <ScheduledMessagesManager />
  </React.StrictMode>,
  document.getElementById('root')
);
