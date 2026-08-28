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
  buildAppScriptProjectUrl,
  buildAppScriptWebAppActionUrl,
  buildProjectHistoryUrl,
  type AppScriptVersionUsage,
} from './AppScriptUpdater';
import { SheetSchemaUpdater } from './SheetSchemaUpdater';
import { JiraRuleUpdater } from './JiraRuleUpdater';
import Select, { StylesConfig, MultiValue, SingleValue } from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { jiraFetch } from '../jira';
import {
  GOOGLE_AUTH_SCOPE_SETS,
  formatGoogleAuthFailure,
  getGoogleAuthToken,
  getGoogleAuthTokenResult,
  getGoogleAuthTokenSilently,
  getGoogleAuthTokenSilentlyResult,
  isGoogleAuthRecoveryError,
} from '../utils/googleAuth';
import { getEnvConfig, getUserInfo } from '../utils';
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
  getAgentTaskWebhookConfig,
  getBotDialogModeForStatus,
  getBotAutomationConfig,
  getExecutorRule,
  getJiraAutomationRuleUrl,
  getRingCentralSenderConfig,
  getTimelineSyncRule,
  hasRingCentralSenderCredentials,
  hasExecutorRule,
  hasTimelineSyncRule,
  normalizeSheetConfig,
  shouldRecreateExecutorRuleForRingCentralSenderUpgrade,
  withAgentTaskWebhook,
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
  buildTimelineCacheDiagnosticText,
  getTimelineCacheAttemptQuickFixText,
  getTimelineCacheExecutionImpactText,
  getTimelineCacheProjectStatusHeadline,
  getTimelineCacheProjectStatus,
  getTimelineCacheScopeReceiptText,
  getTimelineCacheStatusActionText,
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
  type AgentTaskRuntimeStatusItem,
} from '../services/MemoryServiceClient';
import {
  agentTaskExecutorMissingReason,
  listAgentExecutorOptions,
  resolveAgentTaskExecutorSelection,
  type AgentExecutorOption,
} from './agentTaskExecutor';
import {
  formatLocalScheduleDate,
  formatLocalScheduleDateTime,
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
  formatScheduleQueueCompactSummary,
  formatScheduleQueueDetailsReceipt,
  formatScheduleQueueSuggestion,
  formatScheduleQueueSlotDecisionBasis,
  formatScheduleQueueSlotSummary,
  getScheduleQueuePressure,
  getScheduleQueueSuggestion,
  getScheduleQueueSummary,
  hasScheduleQueueBlockingRisk,
  hasScheduleQueueSlotRisk,
  type ScheduleQueueSlotSummary,
} from './scheduleQueuePressure';
import {
  formatScheduleCompensationWindowReceipt,
  formatScheduleCompensationWindowReceiptDetail,
  formatScheduleHealthIssue,
  formatScheduleHealthIssueMissedWindow,
  formatScheduleHealthIssueSuggestedAction,
  formatScheduleHealthSummary,
  getScheduleCompensationWindowReceipt,
  getScheduleHealthIssue,
  getScheduleHealthIssues,
  getScheduleHealthRecoverySuggestion,
  getScheduleHealthRecoverySuggestions,
} from './scheduleHealth';
import {
  buildScheduledMessagesFilterReceipt,
  buildScheduledMessagesTargetReceipt,
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
import {
  resolveAutomationLinkForSave,
  resolveJiraRuleNameSyncLink,
} from './jiraAutomationLink';
import { buildRepeatSubmissionFields } from './repeatSubmission';
import { getScheduledMessageStatusToggleAction } from './scheduledMessageStatusActions';
import {
  formatExecutionLaneReceipt,
  formatExecutionLaneSummary,
  formatExecutionRouteSummary,
  getScheduledMessageExecutionLaneReceipt,
  getScheduledMessageExecutionRoute,
} from './executionRoute';
import {
  compareConfigSyncFreshness,
  formatConfigSyncTimestamp,
} from './configSyncFreshness';
import { ConfigSyncService } from './ConfigSyncService';
import {
  normalizeAgentTaskUserId,
  resolveAgentTaskWebhookConfig,
} from './agentTaskWebhookConfig';
import {
  getManualBindConfigDiff,
  type ManualBindConfigDiffItem,
} from './manualBindConfigDecision';
import { getJiraScheduleRestoreTiming } from './jiraScheduleRestore';
import {
  SCHEDULED_MESSAGES_SETUP_RECEIPT_KEY,
  buildScheduledMessagesSetupReceipt,
  buildScheduledMessagesSetupReceiptNotice,
  type ScheduledMessagesSetupReceipt,
} from './setupReceipt';

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

type ConfigSyncNoticeTone = 'success' | 'info' | 'warning' | 'error';

interface ConfigSyncNotice {
  tone: ConfigSyncNoticeTone;
  title: string;
  description: string;
  details?: string[];
}

interface AppScriptUpgradeNotice extends ConfigSyncNotice {
  recoveryUrl?: string;
}

interface ConfigSyncNoticeDetailOptions {
  adoptedSource?: string;
  boundary?: string;
  nextStep?: string;
}

interface ManualConfigSyncStage {
  tone: ConfigSyncNoticeTone;
  title: string;
  summary: string;
  adoptedSource: string;
  boundary: string;
  nextStep: string;
  details?: string[];
}

interface RescheduleNoticeInput {
  message: Pick<ScheduledMessage, 'ID' | 'Topic'>;
  label: string;
  source: 'queue' | 'health';
  clearsScheduleTime?: boolean;
  reason?: string;
  executionLaneSummary?: string;
}

interface RescheduleFailureNoticeInput {
  source: 'queue' | 'health';
  messageId?: string;
  topic?: string;
  reason: string;
  nextStep?: string;
  tone?: Extract<ConfigSyncNoticeTone, 'warning' | 'error'>;
}

interface ScheduleQueueDraftSuggestionReceipt {
  label: string;
  reason?: string;
  clearsScheduleTime?: boolean;
  executionLaneSummary?: string;
}

interface ScheduleHealthPendingReceipt {
  messageId: string;
  topic: string;
  label: string;
  clearsScheduleTime?: boolean;
  executionLaneSummary?: string;
}

async function resolveAgentTaskWebhookUserId(currentUsername: string): Promise<string | undefined> {
  const fromCurrentUser = normalizeAgentTaskUserId(currentUsername);
  if (fromCurrentUser) {
    return fromCurrentUser;
  }

  try {
    const userinfo = await getUserInfo();
    return normalizeAgentTaskUserId(userinfo?.username) ||
      normalizeAgentTaskUserId(userinfo?.email);
  } catch (error) {
    console.warn('读取 AgentTask 用户身份失败:', error);
    return undefined;
  }
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

function formatConfigSyncActionForDisplay(value?: string): string {
  const action = value?.trim();
  if (!action) {
    return '未知';
  }

  const labels: Record<string, string> = {
    one_click_setup: '一键初始化',
    manual_bind_minimal_config: '手动绑定补齐基础 Config',
    manual_bind_recovered_worksheet_ids: '手动绑定补齐子表定位',
    manual_bind_keep_local: '手动绑定：保留本机',
    manual_bind_use_sheet: '手动绑定：使用 Sheet',
    manual_sync_recovered_worksheet_ids: '手动同步补齐子表定位',
    app_script_metadata_update: 'App Script 元数据更新',
    sheet_schema_update: 'Sheet schema 更新',
    bot_config_update: 'Bot / Timeline 配置更新',
    agent_task_webhook_auto_config: '帮我做执行入口自动补齐',
    jira_rule_update: 'Jira Rule 更新',
    partial_update: '局部配置更新',
    config_sync: '配置同步',
  };

  return labels[action] || action;
}

function formatConfigSyncNoticeDetails(
  config: Partial<SheetConfig>,
  options: ConfigSyncNoticeDetailOptions = {}
): string[] {
  return [
    options.adoptedSource ? `采用配置: ${options.adoptedSource}` : '',
    `Sheet: ${config.sheetId || '未知'}`,
    `同步时间: ${formatConfigSyncTimestamp(config.last_sync_time)}`,
    `最近动作: ${formatConfigSyncActionForDisplay(config.last_sync_action)}`,
    options.boundary ? `边界: ${options.boundary}` : '',
    options.nextStep ? `下一步: ${options.nextStep}` : '',
  ].filter(Boolean);
}

function buildManualConfigSyncRunningNotice(
  config: Partial<SheetConfig>,
  duplicateClick = false
): ConfigSyncNotice {
  return {
    tone: 'info',
    title: 'Config 同步进行中',
    description: duplicateClick
      ? '当前同步仍在读取 Sheet Config 或刷新 Messages / Logs，本次点击没有追加第二条同步链。最终是否写入本机缓存或 Config Sheet，以当前任务完成后的回执为准。'
      : '正在读取 Sheet Config；只有确认 Sheet 更新时才写本机缓存，只有缺少子表定位时才写回 Config Sheet，随后再刷新 Messages / Logs。',
    details: formatConfigSyncNoticeDetails(config, {
      adoptedSource: duplicateClick ? '当前任务待确认' : '待确认',
      boundary: duplicateClick
        ? '未发起第二次 Config 读取、Messages 刷新或 Config 写回'
        : '尚未确认采用 Sheet；进行中不发送消息、不改 Messages / Logs、不执行队列',
      nextStep: duplicateClick
        ? '等待当前同步完成后查看最终采用来源和写入结果'
        : '等待读取完成后查看采用配置、写入边界和恢复建议',
    }),
  };
}

function buildManualConfigSyncActionBoundary(isSyncing: boolean): string {
  if (isSyncing) {
    return 'Config 同步正在进行中；当前任务仍在读取 Sheet Config 或刷新 Messages / Logs，完成前不会启动第二个 Config 读取、Messages 刷新、Config 写回、消息发送或队列执行。';
  }

  return '手动同步 Config 与 Messages；会读取 Sheet Config，只有 Sheet 明确更新时才刷新本机缓存，只有缺少子表定位时才写回 Config Sheet，随后读取 Messages / Logs；不会发送消息、执行队列、改 Logs、批准或删除计划。';
}

function buildAgentTaskWebhookReadOnlyNotice(
  config: Partial<SheetConfig>,
  agentTaskCount: number
): ConfigSyncNotice {
  return {
    tone: 'warning',
    title: '帮我做执行入口待确认',
    description: `当前列表有 ${agentTaskCount} 条帮我做计划，但本机 Config 没有 agent_task_webhook_url。页面打开没有自动读取或写回 Sheet Config，也没有触发 Jira Rule；到期前请同步刷新或保存任一帮我做任务补齐执行入口。`,
    details: formatConfigSyncNoticeDetails(config, {
      adoptedSource: '本机缓存',
      boundary: '页面打开只检查本机缓存和当前 Messages 快照；未读取/写入 Sheet Config，未领取任务',
      nextStep: '点击同步刷新 Config，或创建/保存帮我做时补齐执行入口',
    }),
  };
}

function buildManualConfigSyncStageNotice(
  config: Partial<SheetConfig>,
  stage: ManualConfigSyncStage,
  extraDetails: string[] = []
): ConfigSyncNotice {
  return {
    tone: stage.tone,
    title: stage.title,
    description: stage.summary,
    details: [
      ...formatConfigSyncNoticeDetails(config, {
        adoptedSource: stage.adoptedSource,
        boundary: stage.boundary,
        nextStep: stage.nextStep,
      }),
      ...(stage.details || []),
      ...extraDetails,
    ],
  };
}

function buildManualConfigSyncCompletionNotice(
  config: Partial<SheetConfig>,
  stage: ManualConfigSyncStage,
  messageCount: number
): ConfigSyncNotice {
  return {
    tone: stage.tone === 'error' ? 'warning' : stage.tone,
    title: '同步完成：Messages 已刷新',
    description: `${stage.summary}。Messages / Logs 已按当前采用配置刷新，当前列表读取到 ${messageCount} 条消息。`,
    details: formatConfigSyncNoticeDetails(config, {
      adoptedSource: stage.adoptedSource,
      boundary: `Config 阶段：${stage.boundary}；Messages / Logs 已读取；本次同步不发送消息、不执行队列、不改 Logs`,
      nextStep: `Messages / Logs 已刷新；Config 阶段后续：${stage.nextStep}`,
    }).concat([`Config 阶段: ${stage.title}`, ...(stage.details || [])]),
  };
}

function buildManualConfigSyncMessagesFailureNotice(
  config: Partial<SheetConfig>,
  stage: ManualConfigSyncStage,
  messageError: string
): ConfigSyncNotice {
  return {
    tone: 'error',
    title: 'Messages 刷新失败',
    description: `${stage.summary}；但 Messages / Logs 没有确认刷新成功：${messageError}`,
    details: formatConfigSyncNoticeDetails(config, {
      adoptedSource: stage.adoptedSource,
      boundary: `Config 阶段：${stage.boundary}；Messages / Logs 刷新失败，未确认当前列表为最新；未发送消息、未执行队列、未改 Logs`,
      nextStep: `先修复 Messages / Logs 读取；Config 阶段后续：${stage.nextStep}`,
    }).concat([`Config 阶段: ${stage.title}`, ...(stage.details || [])]),
  };
}

function formatConfigDiffPreviewDetails(
  diffItems: ManualBindConfigDiffItem[],
  limit = 3
): string[] {
  const previewDetails = diffItems.slice(0, limit).map((item) =>
    `差异: ${item.label} | 本机: ${item.localValue} | Sheet: ${item.sheetValue}`
  );

  if (diffItems.length > limit) {
    previewDetails.push(`更多差异: 另有 ${diffItems.length - limit} 项，重新绑定可查看全部并选择采用哪一侧`);
  }

  return previewDetails;
}

function buildRescheduleNotice(input: RescheduleNoticeInput): ConfigSyncNotice {
  const topic = input.message.Topic || input.message.ID;
  const queueBoundary = input.clearsScheduleTime
    ? '清空 Schedule_Time，保留 08:00 后队列语义'
    : '写入未来本地明确时间';
  const sourceLabel = input.source === 'queue' ? '队列建议' : '健康告警';

  return {
    tone: 'success',
    title: '已应用改期建议',
    description: `「${topic}」已改到 ${input.label}，页面已定位到该消息。`,
    details: [
      `来源: ${sourceLabel}`,
      `写入: Messages 行 ${input.message.ID}`,
      `边界: ${queueBoundary}`,
      input.executionLaneSummary ? `写入后: ${input.executionLaneSummary}` : '',
      '确认口径: 本回执只确认新计划已写入；尚未确认执行器已领取/发送，也未确认 Last_Exec / Logs 或 AgentTask run 已更新。',
      input.reason ? `原因: ${input.reason}` : '',
      '下一步: 查看目标行或同步刷新确认队列健康',
    ].filter(Boolean),
  };
}

function buildRescheduleFailureNotice(input: RescheduleFailureNoticeInput): ConfigSyncNotice {
  const sourceLabel = input.source === 'queue' ? '队列建议' : '健康告警';
  const target = input.topic || input.messageId || '当前消息';

  return {
    tone: input.tone || 'error',
    title: '改期建议未应用',
    description: `「${target}」没有写入新的执行时间。`,
    details: [
      `来源: ${sourceLabel}`,
      input.messageId ? `目标: Messages 行 ${input.messageId}` : '',
      '边界: 未写入 Messages，未改动 Schedule_Date / Schedule_Time',
      `原因: ${input.reason}`,
      `下一步: ${input.nextStep || '同步刷新 Messages 后重试，或打开目标行手动编辑'}`,
    ].filter(Boolean),
  };
}

function formatScheduleHealthPendingReceipt(input: ScheduleHealthPendingReceipt): string {
  return `写入中：改到 ${input.label}`;
}

function buildAppScriptUpgradeNotice(input: {
  hasWarnings: boolean;
  results: string[];
  recoveryUrl?: string;
  recoveryMessage?: string;
}): AppScriptUpgradeNotice {
  const resultDetails = input.results
    .flatMap((result) => result.split('\n'))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10);

  return {
    tone: input.hasWarnings ? 'warning' : 'success',
    title: input.hasWarnings ? 'App Script 升级结果需要处理' : 'App Script 升级结果回执',
    description: input.hasWarnings
      ? '升级流程已执行完毕，但至少一个环节未完成；已保留未写入或需恢复的边界。'
      : '升级流程已完成；Sheet、App Script 和 Jira Automation 的结果已汇总在页面上。',
    details: [
      ...resultDetails,
      '边界: 已是最新时跳过脚本写入；失败项保留现有版本',
      input.recoveryMessage ? `恢复: ${input.recoveryMessage}` : '',
      `下一步: ${input.recoveryUrl ? '打开检查页面处理后重试检查' : '同步刷新确认执行配置'}`,
    ].filter(Boolean),
    recoveryUrl: input.recoveryUrl,
  };
}

function buildAppScriptUpgradePendingNotice(input: {
  currentVersion?: string;
  latestVersion?: string;
  versionUsageText: string;
}): AppScriptUpgradeNotice {
  const versionText = input.currentVersion && input.latestVersion
    ? `${input.currentVersion} -> ${input.latestVersion}`
    : '当前版本待重新确认';

  return {
    tone: 'info',
    title: 'App Script 升级请求回执',
    description: '升级请求已提交，正在依次检查 Sheet、App Script deployment 和 Jira Automation；最终结果会覆盖本回执。',
    details: [
      `目标: ${versionText}`,
      `预检: ${input.versionUsageText}`,
      '进行中: Sheet 表结构 -> App Script Web App -> Jira Automation 规则',
      '尚未确认: Web App URL 返回新版本、Sheet/Storage 标记最新、Jira rule 更新完成',
      '边界: 等待完成前不发送定时消息、不触发 Bot/Chrome/Doubao、不确认通知，也不把失败项当作已升级',
      '恢复: deployment 生效确认失败时仍走现有回退与检查页面路径',
    ],
  };
}

function buildAppScriptUpdateActionBoundary(input: {
  action: 'check' | 'recheck' | 'upgrade' | 'project-history' | 'version-probe' | 'project' | 'recovery';
  currentVersion?: string;
  latestVersion?: string;
  versionUsageText: string;
  checkedAtText?: string;
  limitReached?: boolean;
  cleanupSuggested?: boolean;
  busy?: boolean;
}): string {
  const versionText = `当前 App Script ${input.currentVersion || '未知'}，最新 ${input.latestVersion || '未知'}`;
  const checkedText = input.checkedAtText
    ? `上次检查于 ${input.checkedAtText}`
    : '尚未完成本轮手动检查';
  const stateText = `${versionText}；${input.versionUsageText}${checkedText ? `；${checkedText}` : ''}`;
  const noRuntimeEffects = '不会发送定时消息、不会触发 Bot/Chrome/Doubao，也不会确认通知';
  const readOnlyCheck = '只读取版本端点、deployment 和 Project History，不写 Sheet、Script 或 Jira Rule';

  if (input.busy) {
    return `App Script 操作进行中；当前按钮暂不可重复提交。${stateText}；${noRuntimeEffects}`;
  }

  switch (input.action) {
    case 'check':
      return `手动检查 App Script 版本；需要授权时会显示 Google 授权窗口。${readOnlyCheck}；${noRuntimeEffects}。${stateText}`;
    case 'recheck':
      return `重新读取 App Script 版本和 Project History 额度；适合清理旧版本后刷新判断。${readOnlyCheck}；不会升级 deployment 或标记配置为最新。${stateText}`;
    case 'upgrade':
      if (input.limitReached) {
        return `打开 App Script Project History 清理旧版本；当前版本历史已满，点击不会升级 deployment、写 Sheet 或改 Jira Rule。${stateText}`;
      }
      return `升级调度系统；确认后依次检查 Sheet、App Script deployment 和 Jira Automation。只有 Web App 版本端点确认目标版本后才标记 Sheet/Storage 为最新；已是最新时不会重复创建脚本版本，失败项保留现有版本，deployment 生效失败会尝试回退。${stateText}`;
    case 'project-history':
      return `打开 App Script Project History；用于查看或清理脚本版本额度。点击只打开检查页面，不升级 deployment、不写 Sheet、不改 Jira Rule。${stateText}`;
    case 'version-probe':
      return `打开 App Script getVersion 版本端点；只查看当前 Web App 返回的 version/lastUpdated，不触发检查、升级、Sheet 写入或消息发送。${stateText}`;
    case 'project':
      return `打开 Apps Script 项目；用于检查代码、权限或 Manage deployments。点击只打开项目页面，不从当前页写入脚本、Sheet 或 Jira Rule。${stateText}`;
    case 'recovery':
      return `打开 App Script 升级检查页面；用于处理 Project History、deployment 或版本端点问题。点击只打开恢复页面，不重新提交升级、不写 Sheet/Script/Jira Rule，也不发送消息。${stateText}`;
    default:
      return `App Script 更新操作；${stateText}`;
  }
}

function isAutoReplyScheduledMessage(message: Pick<ScheduledMessage, 'Category' | 'Status'>): boolean {
  const categories = getScheduledMessageCategories(message.Category);
  return categories.some((category) => /^(自动答复|AutoReply)$/i.test(category));
}

function formatAutoReplyReviewContentPreview(content: string | undefined, maxLength = 64): string {
  const normalized = content?.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '当前正文为空；批准前应先编辑补齐，避免发送空内容。';
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}...`
    : normalized;
}

function formatAutoReplyReviewScheduleSnapshot(message: ScheduledMessage): string {
  const scheduleDate = message.Schedule_Date?.trim();
  const scheduleTime = message.Schedule_Time?.trim();
  if (scheduleDate && scheduleTime) {
    return `${scheduleDate} ${scheduleTime}`;
  }
  return scheduleDate || scheduleTime || '未设置原排期';
}

function buildAutoReplyReviewReceipt(message: ScheduledMessage): { label: string; detail: string; details: string[] } | null {
  if (message.Status !== 'PendingReview') {
    return null;
  }

  const categoryLabel = isAutoReplyScheduledMessage(message) ? '自动答复审核' : '待审核消息';
  const routeLabel = message.Push_Method || '当前执行方式';
  const contentPreview = formatAutoReplyReviewContentPreview(message.Content);
  const scheduleSnapshot = formatAutoReplyReviewScheduleSnapshot(message);

  return {
    label: categoryLabel,
    detail: `批准前请复核当前正文快照；批准会把这行改为 Active，并排到下一分钟按 ${routeLabel} 发送当前正文。`,
    details: [
      `正文快照: ${contentPreview}`,
      `原排期: ${scheduleSnapshot}；执行方式: ${routeLabel}`,
      '拒绝只把这行标为 Done，不删除触发规则，也不改原消息。',
      '边界: 这是当前表格快照；如果正文、目标或规则刚被改过，先刷新再批准。',
    ],
  };
}

function mergeSheetConfigForRefresh(
  localConfig: SheetConfig,
  sheetConfig: Partial<SheetConfig>
): SheetConfig {
  const localBotAutomation = getBotAutomationConfig(localConfig);
  const sheetBotAutomation = getBotAutomationConfig(sheetConfig);

  return normalizeSheetConfig({
    ...localConfig,
    ...sheetConfig,
    botAutomation: {
      executorRule: sheetBotAutomation.executorRule || localBotAutomation.executorRule,
      timelineSyncRule: sheetBotAutomation.timelineSyncRule || localBotAutomation.timelineSyncRule,
    },
  }) as SheetConfig;
}

function getConfigSyncNoticeIcon(tone: ConfigSyncNoticeTone): string {
  switch (tone) {
    case 'success':
      return '✅';
    case 'warning':
      return '⚠️';
    case 'error':
      return '⛔';
    case 'info':
    default:
      return 'ℹ️';
  }
}

function getConfigSyncNoticeStyle(tone: ConfigSyncNoticeTone): React.CSSProperties {
  const toneStyle: Record<ConfigSyncNoticeTone, React.CSSProperties> = {
    success: styles.configSyncBannerSuccess,
    info: styles.configSyncBannerInfo,
    warning: styles.configSyncBannerWarning,
    error: styles.configSyncBannerError,
  };

  return {
    ...styles.configSyncBanner,
    ...toneStyle[tone],
  };
}

interface OutreachRuntimeState {
  enabled: boolean;
  ringCentralReady: boolean;
  openClawReady: boolean;
  openClawMissingReason?: string;
  configLoadError?: string;
  agentExecutors: AgentExecutorOption[];
  agentTaskDefaultExecutor: string;
}

const OUTREACH_OPTIONS_HASH = 'outreach-config';
const OPENCLAW_OPTIONS_HASH = 'openclaw-config';
const DEFAULT_QUEUE_SLOT_DISPLAY_LIMIT = 3;
const DEFAULT_SCHEDULE_HEALTH_ISSUE_DISPLAY_LIMIT = 4;
const RINGCENTRAL_SENDER_REQUIRED_PERMISSIONS = ['ReadAccounts', 'ReadMessages', 'EditMessages'];

type AddDialogMode = 'default' | 'reminder';

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

function isAgentTaskPushMethod(pushMethod: unknown): boolean {
  return String(pushMethod || '').trim().toLowerCase().replace(/[\s_-]+/g, '') === 'agenttask';
}

function requiresBotAutomation(message: ScheduledMessage): boolean {
  return message.Push_Method === 'Bot' || message.Push_Method === 'AI' || isAgentTaskPushMethod(message.Push_Method);
}

function isOutreachMessage(message: ScheduledMessage): boolean {
  return message.Push_Method === 'Outreach';
}

function isAgentTaskMessage(message: ScheduledMessage): boolean {
  return isAgentTaskPushMethod(message.Push_Method);
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

function getAgentTaskPrompt(message: ScheduledMessage): string {
  return message.Content?.trim() || (message as ScheduledMessage & { Agent_Task_Prompt?: string }).Agent_Task_Prompt?.trim() || '';
}

function getAgentTaskResult(message: ScheduledMessage): string {
  return message.Agent_Last_Result?.trim() || '';
}

function getAgentTaskEvidence(message: ScheduledMessage): string {
  return message.Agent_Last_Evidence?.trim() || '';
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

function formatAgentTaskRuntimeStatus(value?: string): string {
  if (value === 'queued') return '排队中';
  if (value === 'running') return '执行中';
  if (value === 'succeeded') return '已完成';
  if (value === 'failed') return '失败';
  if (value === 'cancelled') return '已取消';
  if (value === 'dead_letter') return '死信';
  if (value === 'success') return '成功';
  if (value === 'error') return '错误';
  if (value === 'capability_missing') return '能力缺失';
  if (value === 'auth_error') return '鉴权失败';
  if (value === 'need_human_decision') return '待人工决策';
  return value || '未知';
}

function formatAgentTaskSummary(message: ScheduledMessage): string {
  const parts: string[] = [];
  if (message.Agent_Last_Status?.trim()) {
    parts.push(`状态:${formatAgentTaskRuntimeStatus(message.Agent_Last_Status)}`);
  }
  if (message.Agent_Last_Run_At?.trim()) {
    parts.push(`最近:${message.Agent_Last_Run_At}`);
  }
  const result = getAgentTaskResult(message);
  if (result) {
    parts.push(`结果:${result.length > 18 ? `${result.substring(0, 18)}…` : result}`);
  }
  if (message.Agent_AR_Binding_ID?.trim()) {
    parts.push('AR 绑定');
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

function formatQueueSlotFocusActionLabel(slot: ScheduleQueueSlotSummary): string {
  const target = slot.actionTopic || slot.actionMessageId || '最晚消息';
  return `定位最晚：${target}，${formatQueueSlotLaneLabel(slot)} 第 ${slot.actionPosition}/${slot.slotSize} 个；只定位当前列表行，不写 Sheet、不改期、不发送、不跳过前序消息`;
}

function formatQueueSlotEditActionLabel(slot: ScheduleQueueSlotSummary): string {
  const target = slot.actionTopic || slot.actionMessageId || '最晚消息';
  return `编辑队列建议目标：${target}，${formatQueueSlotLaneLabel(slot)} 第 ${slot.actionPosition}/${slot.slotSize} 个；只打开编辑草稿，不写 Sheet、不改期、不发送、不跳过前序消息`;
}

function formatQueueSlotBlockingLabel(slot: ScheduleQueueSlotSummary): string {
  return slot.blockingCount > 0
    ? `前面 ${slot.blockingCount} 条会先执行`
    : '';
}

function formatQueueSlotSuggestionLabel(slot: ScheduleQueueSlotSummary): string {
  return slot.suggestion ? `建议改到 ${slot.suggestion.label}` : '';
}

function formatQueueSlotSuggestionReasonLabel(slot: ScheduleQueueSlotSummary): string {
  return slot.suggestion?.reason ? `原因：${slot.suggestion.reason}` : '';
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
      slot.reservedExplicitMinutes
        ? `已避开 ${slot.reservedExplicitMinutes} 个明确时间分钟`
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

function formatAgentTaskEvidencePreview(evidence?: {
  kind?: string;
  title?: string;
  content?: string;
}): string | undefined {
  if (!evidence) return undefined;
  const parts = [evidence.title, evidence.content].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  if (parts.length === 0) return undefined;
  return parts.join(' — ');
}

function summarizeAgentTaskRuntimeResult(item: AgentTaskRuntimeStatusItem): {
  summary?: string;
  evidence?: string;
  status?: string;
  runAt?: string;
} {
  const latest = item.latestAction;
  if (!latest) {
    return {
      summary: item.summary?.trim() || undefined,
      evidence: formatAgentTaskEvidencePreview(item.evidence),
    };
  }

  const status = latest.resultStatus || latest.queueStatus;
  const runAtMs = latest.finishedAt || latest.startedAt || latest.createdAt;
  let runAt: string | undefined;
  if (typeof runAtMs === 'number' && Number.isFinite(runAtMs)) {
    try {
      const { dateStr, timeStr } = formatLocalScheduleDateTime(new Date(runAtMs));
      runAt = `${dateStr} ${timeStr}`;
    } catch {
      runAt = undefined;
    }
  }
  return {
    summary: item.summary?.trim() || latest.lastError?.trim() || undefined,
    evidence: formatAgentTaskEvidencePreview(item.evidence),
    status,
    runAt,
  };
}

function getScheduledMessageTooltipContent(message: ScheduledMessage): string {
  if (isOutreachMessage(message)) {
    const question = getOutreachQuestion(message);
    const result = getOutreachResult(message);
    if (question && result) {
      return `${question}\n\n询问结果：${result}`;
    }
    return question || (result ? `询问结果：${result}` : '');
  }

  if (isAgentTaskMessage(message)) {
    const prompt = getAgentTaskPrompt(message);
    const result = getAgentTaskResult(message) || getAgentTaskEvidence(message);
    const sections: string[] = [];
    if (prompt) {
      sections.push(prompt);
    }
    if (result) {
      sections.push(`执行结果：${result}`);
    }
    if (message.Agent_Last_Error?.trim() && !getAgentTaskResult(message)) {
      sections.push(`错误：${message.Agent_Last_Error.trim()}`);
    }
    return sections.join('\n\n');
  }

  return message.Content || '';
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

function getOpenClawMissingReason(executors: AgentExecutorOption[]): string {
  return agentTaskExecutorMissingReason(executors, true);
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

async function overlayAgentTaskRuntimeStatus(messages: ScheduledMessage[]): Promise<ScheduledMessage[]> {
  const agentTaskMessages = messages.filter((message) => isAgentTaskMessage(message));
  if (agentTaskMessages.length === 0) {
    return messages;
  }

  const lookupIds = Array.from(
    new Set(
      agentTaskMessages
        .flatMap((message) => [message.ID, message.Agent_Task_ID])
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter(Boolean),
    ),
  );
  if (lookupIds.length === 0) {
    return messages;
  }

  try {
    const client = getMemoryServiceClient();
    const runtime = await client.getAgentTaskRuntimeStatus(lookupIds, lookupIds.length);
    const mapping = new Map<string, AgentTaskRuntimeStatusItem>();
    for (const item of runtime.items) {
      for (const key of [item.sourceRefId, item.sheetMessageId, item.taskId]) {
        if (key?.trim()) {
          mapping.set(key.trim(), item);
        }
      }
    }

    return messages.map((message) => {
      if (!isAgentTaskMessage(message)) {
        return message;
      }
      const runtimeItem =
        mapping.get(message.ID) ||
        (message.Agent_Task_ID ? mapping.get(message.Agent_Task_ID) : undefined);
      if (!runtimeItem?.latestAction) {
        return message;
      }

      const summarized = summarizeAgentTaskRuntimeResult(runtimeItem);
      return {
        ...message,
        Agent_Last_Status: summarized.status || message.Agent_Last_Status,
        Agent_Last_Run_At: summarized.runAt || message.Agent_Last_Run_At,
        Agent_Last_Result: summarized.summary || message.Agent_Last_Result,
        Agent_Last_Error:
          runtimeItem.latestAction.queueStatus === 'succeeded'
            ? undefined
            : runtimeItem.latestAction.lastError || message.Agent_Last_Error,
        Agent_Last_Evidence: summarized.evidence,
      };
    });
  } catch (error) {
    console.info('加载 AgentTask runtime 状态失败，使用 Sheet 数据兜底:', error);
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
  const [authFailureMessage, setAuthFailureMessage] = useState('');
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
  const submitMessageInFlightRef = useRef(false);
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
  const ringCentralSenderConfigOpenedFromQueryRef = useRef(false);
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
    openClawReady: false,
    agentExecutors: [],
    agentTaskDefaultExecutor: '',
  });
  const [outreachRuntimeLoaded, setOutreachRuntimeLoaded] = useState(false);
  const [queueSummaryNow, setQueueSummaryNow] = useState(() => new Date());
  const [showQueueDetails, setShowQueueDetails] = useState(false);
  const [showAllQueueSlots, setShowAllQueueSlots] = useState(false);
  const [showAllScheduleHealthIssues, setShowAllScheduleHealthIssues] = useState(false);
  const [configSyncNotice, setConfigSyncNotice] = useState<ConfigSyncNotice | null>(null);
  const [isSyncingConfig, setIsSyncingConfig] = useState(false);
  const syncConfigInFlightRef = useRef(false);
  const lastLoadMessagesErrorRef = useRef<string | null>(null);
  const [rescheduleNotice, setRescheduleNotice] = useState<ConfigSyncNotice | null>(null);
  const [scheduleHealthPendingReceipt, setScheduleHealthPendingReceipt] = useState<ScheduleHealthPendingReceipt | null>(null);
  const [appScriptUpgradeNotice, setAppScriptUpgradeNotice] = useState<AppScriptUpgradeNotice | null>(null);
  const timelineSyncRuleUrl = useMemo(
    () => getJiraAutomationRuleUrl(getTimelineSyncRule(config)),
    [config],
  );
  const rescheduleExecutionLaneContext = useMemo(() => ({
    botConfigured,
    ringCentralSenderConfigured: hasRingCentralSenderCredentials(config),
    outreachEnabled: outreachRuntime.enabled,
    outreachConfigured: outreachRuntime.ringCentralReady,
  }), [
    botConfigured,
    config,
    outreachRuntime.enabled,
    outreachRuntime.ringCentralReady,
  ]);
  const getRescheduleSuggestionLaneSummary = (
    message: ScheduledMessage,
    suggestion: Pick<RescheduleNoticeInput, 'label'> & {
      dateStr: string;
      timeStr: string;
    },
  ) => formatExecutionLaneSummary(getScheduledMessageExecutionLaneReceipt({
    ...message,
    Schedule_Date: suggestion.dateStr,
    Schedule_Time: suggestion.timeStr,
  }, rescheduleExecutionLaneContext));
  
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
        let authResult = await getGoogleAuthTokenSilentlyResult({
          caller: 'ScheduledMessagesManager.init',
          scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
        });
        if (
          !authResult.token &&
          (authResult.failureReason === 'auth_error' || authResult.failureReason === 'no_token')
        ) {
          // Chrome Identity 偶发会在扩展刚重载/账号状态刚恢复时短暂返回失败。
          // 再静默检查一次（包括其它 Chrome Google 账号），仍失败才打断页面。
          await new Promise((resolve) => window.setTimeout(resolve, 200));
          authResult = await getGoogleAuthTokenSilentlyResult({
            caller: 'ScheduledMessagesManager.init.retry',
            scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
          });
        }
        const token = authResult.token;
        if (!token) {
          const failureMessage = formatGoogleAuthFailure(authResult);
          console.warn('⚠️ Google Sheets 授权不可用，需要用户手动处理:', failureMessage);
          setAuthFailureMessage(failureMessage);
          setNeedsReauth(true);
        }
        
        if (token) {
          const messageService = new ScheduledMessageService(token);
          setService(messageService);
          const initialMessages = await loadMessages(messageService, false, { deferEnrichment: true });
          const didConsumeSetupReceipt = await consumePendingSetupReceipt(savedConfig);
          if (!didConsumeSetupReceipt) {
            maybeShowAgentTaskWebhookReadinessNotice(savedConfig, initialMessages);
          }

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

  const consumePendingSetupReceipt = async (currentConfig: SheetConfig): Promise<boolean> => {
    try {
      if (!chrome?.storage?.local) {
        return false;
      }

      const storage = await chrome.storage.local.get([SCHEDULED_MESSAGES_SETUP_RECEIPT_KEY]);
      const receipt = storage[SCHEDULED_MESSAGES_SETUP_RECEIPT_KEY] as ScheduledMessagesSetupReceipt | undefined;

      if (!receipt?.sheetId) {
        return false;
      }

      await chrome.storage.local.remove(SCHEDULED_MESSAGES_SETUP_RECEIPT_KEY);
      const receiptNotice = buildScheduledMessagesSetupReceiptNotice(receipt, currentConfig);
      setConfigSyncNotice(receiptNotice);
      return true;
    } catch (error) {
      console.warn('读取定时消息初始化收据失败:', error);
      return false;
    }
  };

  const maybeShowAgentTaskWebhookReadinessNotice = (
    currentConfig: SheetConfig,
    currentMessages: ScheduledMessage[]
  ): void => {
    if (getAgentTaskWebhookConfig(currentConfig)?.webhookUrl) {
      return;
    }

    const agentTaskCount = currentMessages.filter(isAgentTaskMessage).length;
    if (agentTaskCount === 0) {
      return;
    }

    setConfigSyncNotice(buildAgentTaskWebhookReadOnlyNotice(currentConfig, agentTaskCount));
  };

  const loadOutreachRuntime = async () => {
    let runtimeBaseUrl = '';
    try {
      const envConfig = await getEnvConfig();
      runtimeBaseUrl = envConfig.MEMORY_SERVICE_BASE_URL || '';
      if (!runtimeBaseUrl.trim()) {
        throw new Error('MEMORY_SERVICE_BASE_URL is empty');
      }

      const userinfo = await getUserInfo().catch(() => null);
      const runtimeUserId =
        normalizeAgentTaskUserId(currentUsername) ||
        normalizeAgentTaskUserId(userinfo?.username) ||
        normalizeAgentTaskUserId(userinfo?.email);
      const client = getMemoryServiceClient();
      if (runtimeUserId) {
        client.setUserId(runtimeUserId);
      }
      const runtime = await client.getRuntimeConfig();
      const ringCentralReady =
        Boolean(runtime.ringCentralServerUrl?.trim()) &&
        Boolean(runtime.ringCentralClientId?.trim()) &&
        Boolean(runtime.ringCentralClientSecretConfigured) &&
        Boolean(runtime.ringCentralJwtConfigured);
      const agentExecutors = listAgentExecutorOptions(runtime);
      const openClawMissingReason = getOpenClawMissingReason(agentExecutors);
      setOutreachRuntime({
        enabled: Boolean(runtime.outreachEnabled),
        ringCentralReady,
        openClawReady: !openClawMissingReason,
        openClawMissingReason,
        agentExecutors,
        agentTaskDefaultExecutor: String(runtime.executorDefaults?.agent_task || '').trim(),
        configLoadError: undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.info('加载 Outreach runtime 配置失败:', error);
      setOutreachRuntime({
        enabled: false,
        ringCentralReady: false,
        openClawReady: false,
        agentExecutors: [],
        agentTaskDefaultExecutor: '',
        configLoadError: runtimeBaseUrl
          ? `无法读取 memory-service runtime 配置（${runtimeBaseUrl}）：${message}`
          : '无法读取 memory-service runtime 配置：MEMORY_SERVICE_BASE_URL 为空。',
        openClawMissingReason: runtimeBaseUrl
          ? `无法读取 memory-service runtime 配置（${runtimeBaseUrl}），请确认 Memory Service 可访问后再创建帮我做任务。`
          : '无法读取 memory-service runtime 配置：MEMORY_SERVICE_BASE_URL 为空，请先在 Options 配置 Memory Service 地址。',
      });
    } finally {
      setOutreachRuntimeLoaded(true);
    }
  };

  useEffect(() => {
    if (showAddDialog) {
      setOutreachRuntimeLoaded(false);
      void loadOutreachRuntime();
    }
  }, [showAddDialog]);

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

  const openOpenClawOptionsPage = () => {
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL(`options.html#${OPENCLAW_OPTIONS_HASH}`)
      : `options.html#${OPENCLAW_OPTIONS_HASH}`;
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
    lastLoadMessagesErrorRef.current = null;
    try {
      const { deferEnrichment = false } = options;
      const baseMessages = await messageService.getAllMessages();

      setMessages(baseMessages);
      setStatistics(buildStatistics(baseMessages));

      const applyOutreachOverlay = async (
        seedMessages: ScheduledMessage[],
      ): Promise<ScheduledMessage[]> => {
        const outreachOverlayMsgs = await overlayOutreachRuntimeStatus(seedMessages);
        const agentTaskOverlayMsgs = await overlayAgentTaskRuntimeStatus(outreachOverlayMsgs);
        const updatedMsgs = await backfillOutreachDoneStatus(
          messageService,
          agentTaskOverlayMsgs,
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
        setIsBackgroundLoading(true);
        void enrichMessages()
          .catch((error) => {
            console.error('后台补充消息状态失败:', error);
          })
          .finally(() => {
            setIsBackgroundLoading(false);
          });
        return baseMessages;
      }

      return await enrichMessages();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '未知错误');
      lastLoadMessagesErrorRef.current = message;
      if (isGoogleAuthRecoveryError(error)) {
        setAuthFailureMessage(message);
        setNeedsReauth(true);
      }
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
      void (async () => {
        try {
          if (chrome?.storage?.local) {
            await chrome.storage.local.set({
              [SCHEDULED_MESSAGES_SETUP_RECEIPT_KEY]: buildScheduledMessagesSetupReceipt(result),
            });
          }
        } catch (error) {
          console.warn('保存定时消息初始化收据失败:', error);
        } finally {
          // 刷新页面重新加载
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      })();
    }
  };

  const refreshConfigFromSheetForManualSync = async (
    currentConfig: SheetConfig,
    currentService: ScheduledMessageService
  ): Promise<{
    nextConfig: SheetConfig;
    nextService: ScheduledMessageService;
    configStage: ManualConfigSyncStage;
    token?: string;
  }> => {
    try {
      const token = await getGoogleAuthToken({
        caller: 'ScheduledMessagesManager.syncConfigFromSheet',
        scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
      });
      if (!token) {
        const configStage: ManualConfigSyncStage = {
          tone: 'warning',
          title: '未刷新 Config',
          summary: '没有取得 Google 授权，本次只会继续使用本机缓存刷新 Messages 数据',
          adoptedSource: '本机缓存',
          boundary: '未读取 Sheet Config，未更新本机缓存',
          nextStep: '完成 Google 授权后重新同步',
        };
        setConfigSyncNotice(buildManualConfigSyncStageNotice(currentConfig, configStage));
        return { nextConfig: currentConfig, nextService: currentService, configStage };
      }

      const syncService = new ConfigSyncService(token);
      const sheetConfig = await syncService.readConfigFromSheet(currentConfig.sheetId);
      const mergedSheetConfig = mergeSheetConfigForRefresh(currentConfig, sheetConfig);
      const freshness = compareConfigSyncFreshness(currentConfig, mergedSheetConfig);
      const diffItems = getManualBindConfigDiff(currentConfig, mergedSheetConfig);

      if (freshness === 'sheet-newer') {
        await syncService.saveConfigToStorage(mergedSheetConfig);
        const refreshedService = new ScheduledMessageService(token);
        setConfig(mergedSheetConfig);
        setService(refreshedService);
        setBotConfigured(hasExecutorRule(mergedSheetConfig));
        setTimelineBotConfigured(hasTimelineSyncRule(mergedSheetConfig));
        const configStage: ManualConfigSyncStage = {
          tone: 'success',
          title: '已从 Sheet Config 刷新本机配置',
          summary: '另一台设备或维护表里的较新配置已写入本机缓存，本次同步会使用刷新后的 Apps Script、Bot / Timeline 与子表定位',
          adoptedSource: 'Sheet Config',
          boundary: '先写入本机缓存，再读取 Messages / Logs',
          nextStep: '检查列表是否已使用新的 Web App、Bot / Timeline 与子表定位',
        };
        setConfigSyncNotice(buildManualConfigSyncStageNotice(mergedSheetConfig, configStage));
        return { nextConfig: mergedSheetConfig, nextService: refreshedService, token, configStage };
      }

      if (freshness === 'local-newer') {
        const configStage: ManualConfigSyncStage = {
          tone: 'warning',
          title: '保留本机较新 Config',
          summary: 'Sheet Config 比本机缓存更旧，本次同步没有覆盖本机配置；需要共享给其它设备时请使用会写回 Config 的配置操作',
          adoptedSource: '本机缓存',
          boundary: 'Sheet Config 较旧，未覆盖本机缓存',
          nextStep: '如需跨设备恢复，请使用配置操作写回 Sheet',
        };
        setConfigSyncNotice(buildManualConfigSyncStageNotice(currentConfig, configStage));
        return { nextConfig: currentConfig, nextService: currentService, token, configStage };
      }

      if (diffItems.length > 0) {
        const configStage: ManualConfigSyncStage = {
          tone: 'warning',
          title: 'Config 有差异，未自动覆盖',
          summary: `同步时间相同或无法判断，但发现 ${diffItems.length} 项关键配置不同。本次继续使用本机配置，避免误覆盖另一端`,
          adoptedSource: '本机缓存',
          boundary: '同步时间相同或不可判断，未覆盖本机缓存',
          nextStep: '重新绑定后选择保留本机或使用 Sheet',
          details: formatConfigDiffPreviewDetails(diffItems),
        };
        setConfigSyncNotice(buildManualConfigSyncStageNotice(currentConfig, configStage));
        return { nextConfig: currentConfig, nextService: currentService, token, configStage };
      }

      const configStage: ManualConfigSyncStage = {
        tone: 'info',
        title: 'Config 已是最新',
        summary: 'Sheet Config 与本机缓存一致，本次同步继续刷新 Messages / Logs 数据',
        adoptedSource: '本机缓存',
        boundary: 'Sheet Config 与本机缓存一致',
        nextStep: '继续查看 Messages / Logs 刷新结果',
      };
      setConfigSyncNotice(buildManualConfigSyncStageNotice(currentConfig, configStage));
      return { nextConfig: currentConfig, nextService: currentService, token, configStage };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '未知错误');
      console.warn('刷新 Sheet Config 失败，继续使用本机配置同步消息:', error);
      const configStage: ManualConfigSyncStage = {
        tone: 'error',
        title: 'Config 刷新失败',
        summary: `${message}。本次会继续使用本机缓存刷新 Messages 数据`,
        adoptedSource: '本机缓存',
        boundary: 'Sheet Config 读取失败，未更新本机缓存',
        nextStep: '确认 Google 授权、网络或 Config 表后重试同步',
      };
      setConfigSyncNotice(buildManualConfigSyncStageNotice(currentConfig, configStage));
      return { nextConfig: currentConfig, nextService: currentService, configStage };
    }
  };
  
  const handleSync = async () => {
    if (!service || !config) return;

    if (syncConfigInFlightRef.current) {
      setConfigSyncNotice(buildManualConfigSyncRunningNotice(config, true));
      return;
    }
    
    syncConfigInFlightRef.current = true;
    setIsSyncingConfig(true);
    setConfigSyncNotice(buildManualConfigSyncRunningNotice(config));
    try {
      const {
        nextConfig,
        nextService,
        configStage,
        token: configSyncToken,
      } = await refreshConfigFromSheetForManualSync(config, service);
      const syncedMessages = await loadMessages(nextService);
      const messageLoadError = lastLoadMessagesErrorRef.current;
      if (!messageLoadError) {
        void checkBotConfigValidity(nextConfig, syncedMessages);
      }
      let didRecoverWorksheetIds = false;
      
      // 检查并补充 Messages / Logs 工作表 ID（如果缺失）
      if (
        nextConfig.messagesSheetId === undefined ||
        nextConfig.messagesSheetId === null ||
        nextConfig.logsSheetId === undefined ||
        nextConfig.logsSheetId === null
      ) {
        console.log('⏳ 同步时发现 Messages/Logs 工作表 ID 缺失，尝试获取...');
        try {
          const token = configSyncToken ||
            await getGoogleAuthToken({
              caller: 'ScheduledMessagesManager.syncWorksheetIds',
              scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
            });
          if (token) {
            const worksheetIds = await fetchScheduledWorksheetIds(token, nextConfig.sheetId);
            const updatedConfig = { ...nextConfig };
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
              const syncService = new ConfigSyncService(token);
              const syncedConfig = await syncService.syncConfig(updatedConfig, {
                syncAction: 'manual_sync_recovered_worksheet_ids',
              });
              setConfig(syncedConfig);
              const refreshedService = new ScheduledMessageService(token);
              setService(refreshedService);
              setConfigSyncNotice({
                tone: 'success',
                title: '已补齐子表定位并写回 Config',
                description: 'Messages / Logs 子表 ID 已按 Sheet-first 顺序写回 Config，再更新本机缓存。',
                details: formatConfigSyncNoticeDetails(syncedConfig, {
                  adoptedSource: 'Sheet Config + 本机缓存',
                  boundary: '子表定位先写 Sheet，再更新本机缓存',
                  nextStep: '用新定位打开 Messages / Logs',
                }),
              });
              didRecoverWorksheetIds = true;
              console.log('✅ 已补充 Messages/Logs 工作表 ID:', worksheetIds);
            }
          }
        } catch (error) {
          console.error('补充 Messages/Logs 工作表 ID 失败:', error);
        }
      }

      if (messageLoadError) {
        setConfigSyncNotice(buildManualConfigSyncMessagesFailureNotice(
          nextConfig,
          configStage,
          messageLoadError,
        ));
      } else if (!didRecoverWorksheetIds) {
        setConfigSyncNotice(buildManualConfigSyncCompletionNotice(
          nextConfig,
          configStage,
          syncedMessages.length,
        ));
      }
    } finally {
      syncConfigInFlightRef.current = false;
      setIsSyncingConfig(false);
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
        ? await getGoogleAuthToken({
            caller: 'ScheduledMessagesManager.checkForUpdates.manual',
            scopes: GOOGLE_AUTH_SCOPE_SETS.APPS_SCRIPT_ADMIN,
          })
        : await getGoogleAuthTokenSilently({
            caller: 'ScheduledMessagesManager.checkForUpdates.auto',
            scopes: GOOGLE_AUTH_SCOPE_SETS.APPS_SCRIPT_ADMIN,
          });
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
      const result = await updater.checkForUpdates({
        syncKnownVersionToConfig: interactive,
      });
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
    setAppScriptUpgradeNotice(buildAppScriptUpgradePendingNotice({
      currentVersion: appScriptVersion || undefined,
      latestVersion: latestAppScriptVersion || undefined,
      versionUsageText: appScriptVersionUsageText,
    }));
    const updateResults: string[] = [];
    let appScriptRecoveryUrl = '';
    let appScriptRecoveryMessage = '';
    let appScriptRecoveryTitle = 'App Script 需要处理后重试';
    
    try {
      const token = await getGoogleAuthToken({
        caller: 'ScheduledMessagesManager.handleUpgrade',
        scopes: GOOGLE_AUTH_SCOPE_SETS.APPS_SCRIPT_ADMIN,
      });
      if (!token) {
        throw new Error('无法获取 Google 授权');
      }
      let upgradeConfig = normalizeSheetConfig(config) as SheetConfig;
      
      // 1. 升级 Sheet Schema
      console.log('🔄 开始升级 Sheet Schema...');
      try {
        const schemaUpdater = new SheetSchemaUpdater(token, upgradeConfig);
        const schemaResult = await schemaUpdater.checkAndUpdate();
        
        if (!schemaResult.success) {
          updateResults.push(`⚠️ Sheet 表结构升级失败: ${schemaResult.error || '未知原因'}`);
        } else if (schemaResult.updated) {
          if (schemaResult.updatedConfig) {
            upgradeConfig = normalizeSheetConfig(schemaResult.updatedConfig) as SheetConfig;
            setConfig(upgradeConfig);
          }
          updateResults.push(
            schemaResult.addedColumns.length > 0
              ? `✅ Sheet 表结构已升级\n   新增列: ${schemaResult.addedColumns.join(', ')}`
              : '✅ Sheet Config 已补齐 AgentTask 执行入口'
          );
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
        const appScriptUpdater = new AppScriptUpdater(token, upgradeConfig);
        const appScriptResult = await appScriptUpdater.updateAppScript();
        
        if (appScriptResult.success) {
          if (appScriptResult.updatedConfig) {
            upgradeConfig = normalizeSheetConfig(appScriptResult.updatedConfig) as SheetConfig;
            setConfig(upgradeConfig);
          }
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
        const jiraUpdater = new JiraRuleUpdater(upgradeConfig);
        const checkResult = await jiraUpdater.checkForUpdates();
        
        if (checkResult.needsUpdate) {
          const jiraResult = await jiraUpdater.updateJiraRule({ googleAuthToken: token });
          if (jiraResult.success) {
            if (jiraResult.updatedConfig) {
              upgradeConfig = normalizeSheetConfig(jiraResult.updatedConfig) as SheetConfig;
              setConfig(upgradeConfig);
            }
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
      setAppScriptUpgradeNotice(buildAppScriptUpgradeNotice({
        hasWarnings,
        results: updateResults,
        recoveryUrl: appScriptRecoveryUrl,
        recoveryMessage: appScriptRecoveryMessage,
      }));
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
      setAppScriptUpgradeNotice({
        tone: 'error',
        title: 'App Script 升级未完成',
        description: '升级流程在开始阶段中断，未能完成 Sheet、App Script 或 Jira Automation 的完整检查。',
        details: [
          `原因: ${error.message}`,
          '边界: 未确认升级完成前，不会把 App Script 配置标记为最新',
          '下一步: 重新检查脚本版本，或打开 Apps Script 项目确认 deployment 状态',
        ],
      });
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
  const appScriptUpgradeToastText = isAppScriptVersionLimitReached
    ? 'App Script 可升级，但版本历史已满，请先清理旧版本。'
    : shouldSuggestAppScriptVersionCleanup
      ? `App Script ${latestAppScriptVersion || ''} 可升级；Project History 仅剩 ${appScriptVersionUsage?.remaining} 个版本。`
      : `App Script ${latestAppScriptVersion || ''} 可升级。`;
  const appScriptVersionProbeUrl = config?.webAppUrl
    ? buildAppScriptWebAppActionUrl(config.webAppUrl, 'getVersion')
    : '';
  const appScriptProjectUrl = config?.scriptId
    ? buildAppScriptProjectUrl(config.scriptId)
    : '';
  const appScriptCheckActionBoundary = buildAppScriptUpdateActionBoundary({
    action: 'check',
    currentVersion: appScriptVersion || undefined,
    latestVersion: latestAppScriptVersion || undefined,
    versionUsageText: appScriptVersionUsageText,
    checkedAtText: appScriptUpdateCheckedAtText,
    busy: isCheckingUpdates || isUpdating,
  });
  const appScriptRecheckActionBoundary = buildAppScriptUpdateActionBoundary({
    action: 'recheck',
    currentVersion: appScriptVersion || undefined,
    latestVersion: latestAppScriptVersion || undefined,
    versionUsageText: appScriptVersionUsageText,
    checkedAtText: appScriptUpdateCheckedAtText,
    busy: isCheckingUpdates || isUpdating,
  });
  const appScriptUpgradeActionBoundary = buildAppScriptUpdateActionBoundary({
    action: 'upgrade',
    currentVersion: appScriptVersion || undefined,
    latestVersion: latestAppScriptVersion || undefined,
    versionUsageText: appScriptVersionUsageText,
    checkedAtText: appScriptUpdateCheckedAtText,
    limitReached: isAppScriptVersionLimitReached,
    cleanupSuggested: shouldSuggestAppScriptVersionCleanup,
    busy: isUpdating,
  });
  const appScriptProjectHistoryActionBoundary = buildAppScriptUpdateActionBoundary({
    action: 'project-history',
    currentVersion: appScriptVersion || undefined,
    latestVersion: latestAppScriptVersion || undefined,
    versionUsageText: appScriptVersionUsageText,
    checkedAtText: appScriptUpdateCheckedAtText,
    busy: isUpdating,
  });
  const appScriptVersionProbeActionBoundary = buildAppScriptUpdateActionBoundary({
    action: 'version-probe',
    currentVersion: appScriptVersion || undefined,
    latestVersion: latestAppScriptVersion || undefined,
    versionUsageText: appScriptVersionUsageText,
    checkedAtText: appScriptUpdateCheckedAtText,
    busy: isCheckingUpdates || isUpdating,
  });
  const appScriptProjectActionBoundary = buildAppScriptUpdateActionBoundary({
    action: 'project',
    currentVersion: appScriptVersion || undefined,
    latestVersion: latestAppScriptVersion || undefined,
    versionUsageText: appScriptVersionUsageText,
    checkedAtText: appScriptUpdateCheckedAtText,
    busy: isCheckingUpdates || isUpdating,
  });
  const appScriptRecoveryActionBoundary = buildAppScriptUpdateActionBoundary({
    action: 'recovery',
    currentVersion: appScriptVersion || undefined,
    latestVersion: latestAppScriptVersion || undefined,
    versionUsageText: appScriptVersionUsageText,
    checkedAtText: appScriptUpdateCheckedAtText,
    busy: isCheckingUpdates || isUpdating,
  });
  const manualConfigSyncActionBoundary = buildManualConfigSyncActionBoundary(isSyncingConfig);

  const handleOpenAppScriptProjectHistory = () => {
    const projectHistoryUrl = appScriptVersionUsage?.projectHistoryUrl
      || (config?.scriptId ? buildProjectHistoryUrl(config.scriptId) : '');
    if (projectHistoryUrl) {
      window.open(projectHistoryUrl, '_blank');
    } else {
      alert('未找到 Script ID，无法打开 App Script Project History。');
    }
  };

  const handleOpenAppScriptVersionProbe = () => {
    if (appScriptVersionProbeUrl) {
      window.open(appScriptVersionProbeUrl, '_blank');
    }
  };

  const handleOpenAppScriptProject = () => {
    if (appScriptProjectUrl) {
      window.open(appScriptProjectUrl, '_blank');
    } else {
      alert('未找到 Script ID，无法打开 Apps Script 项目。');
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
          scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
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

  useEffect(() => {
    if (
      !initialQueryFilters.configureRingCentralSender ||
      ringCentralSenderConfigOpenedFromQueryRef.current ||
      !isInitialized ||
      !config
    ) {
      return;
    }

    ringCentralSenderConfigOpenedFromQueryRef.current = true;
    openRingCentralSenderConfigDialog();
  }, [initialQueryFilters.configureRingCentralSender, isInitialized, config]);
  
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

  // 托管确认弹窗状态
  const [showTakeoverDialog, setShowTakeoverDialog] = useState(false);
  const [takeoverMessage, setTakeoverMessage] = useState<ScheduledMessage | null>(null);
  const [takeoverLoading, setTakeoverLoading] = useState(false);
  const [takeoverError, setTakeoverError] = useState<string>('');
  
  const handleEditMessage = async (message: ScheduledMessage) => {
    // 检查是否是需要托管确认的 JiraAutomation 消息
    // 条件：Push_Method 是 JiraAutomation，有 Schedule_Date，但没有 AI_Endpoint
    const needsTakeoverConfirmation = isJiraAutomationTakeoverCandidate(message);
    
    if (needsTakeoverConfirmation) {
      // 显示托管确认弹窗
      setTakeoverMessage(message);
      setTakeoverError('');
      setShowTakeoverDialog(true);
      return;
    }
    
    // 正常编辑流程（Push_Method 由 editingMessage 驱动表单，不再使用 outreach/agent-task dialogMode）
    setAddDialogMode('default');
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
      setConfigSyncNotice({
        tone: 'success',
        title: '已批准自动答复',
        description: `「${message.Topic || message.ID}」会在下一分钟按 ${message.Push_Method || '当前执行方式'} 发送。`,
        details: [
          `写入: Messages 行 ${message.ID} -> Active`,
          `发送时间: ${scheduleDate} ${scheduleTime}`,
          `正文快照: ${formatAutoReplyReviewContentPreview(message.Content)}`,
          '边界: 只批准当前待审核行；不删除触发规则，也不修改原消息。',
          '恢复: 发送前仍可在本页暂停或删除这行。',
        ],
      });
      
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
      setConfigSyncNotice({
        tone: 'info',
        title: '已拒绝自动答复',
        description: `「${message.Topic || message.ID}」已标记为 Done，不会发送当前待审核正文。`,
        details: [
          `写入: Messages 行 ${message.ID} -> Done`,
          `正文快照: ${formatAutoReplyReviewContentPreview(message.Content)}`,
          '边界: 只拒绝当前待审核行；不删除触发规则，也不修改原消息。',
          '下一步: 如果不想再触发，请回到记忆入口规则里停用或修改自动答复规则。',
        ],
      });
      
      console.log(`❌ 自动答复已拒绝: ${message.Topic}`);
    } catch (error) {
      console.error('拒绝自动答复失败:', error);
      alert('拒绝失败，请稍后重试');
    }
  };
  
  const handleDeleteMessage = async (message: ScheduledMessage, topic: string) => {
    if (!service) return;
    const id = message.ID;
    const shouldCancelOutreachMirror = isOutreachMessage(message);
    
    const deleteAuditLines = message
      ? [
          `ID: ${message.ID}`,
          `状态: ${message.Status}`,
          `下次执行: ${formatNextExec(message)}`,
          `频率: ${formatFrequency(message)}`,
          `发给: ${formatRecipient(message)}`,
        ]
      : [`ID: ${id}`];
    const deleteAuditSummary = deleteAuditLines.join('\n');
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
        `${deleteAuditSummary}\n\n` +
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
        if (!linkInfo) {
          alert(
            '❌ 无法解析 Jira Automation 链接。\n\n' +
            '为了数据安全，不会删除 Personal AI 中的消息记录。\n' +
            '请先手动检查 Automation_Link，然后再尝试删除。'
          );
          setIsLoading(false);
          return;
        }

        const { jiraUrl, projectKey, ruleId } = linkInfo;
        // 使用带缓存的版本
        const projectId = await getProjectIdFromKeyWithCache(jiraUrl, projectKey);
        if (!projectId) {
          alert(
            `❌ 无法获取 Jira 项目 ID: ${projectKey}\n\n` +
            '为了数据安全，不会删除 Personal AI 中的消息记录。\n' +
            '请先确认 Jira 登录状态和项目权限，然后再尝试删除。'
          );
          setIsLoading(false);
          return;
        }

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

        const restoreTiming = getJiraScheduleRestoreTiming(message);
        console.log('🕐 时间转换:', restoreTiming);

        const scheduleConfig = {
          scheduleTime: restoreTiming.utcTime,  // Jira Automation Server 使用 UTC 时间
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
        
        // 只有在恢复成功后才删除消息
        await service.deleteMessage(id);
        let cancelledOutreachTemplate = false;
        if (shouldCancelOutreachMirror) {
          cancelledOutreachTemplate = await cancelOutreachTemplateMirror(message.ID);
        }
        await loadMessages(service);
        const clearedFocusedRow = id === targetMessageId;
        if (clearedFocusedRow) {
          clearMessageFilters();
        }
        setConfigSyncNotice(buildMessageDeleteNotice(message, {
          clearedFocusedRow,
          restoredJiraRule: true,
          cancelledOutreachTemplate,
        }));
        
      } catch (error: any) {
        console.error('删除托管消息失败:', error);
        alert(`删除失败: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
      
    } else {
      // 普通消息的删除流程
      if (!confirm(`确定要删除消息 "${topic}" 吗？\n\n${deleteAuditSummary}\n\n此操作无法撤销。`)) {
        return;
      }
      
      setIsLoading(true);
      try {
        await service.deleteMessage(id);
        let cancelledOutreachTemplate = false;
        if (shouldCancelOutreachMirror) {
          cancelledOutreachTemplate = await cancelOutreachTemplateMirror(message.ID);
        }
        await loadMessages(service);
        const clearedFocusedRow = id === targetMessageId;
        if (clearedFocusedRow) {
          clearMessageFilters();
        }
        setConfigSyncNotice(buildMessageDeleteNotice(message, {
          clearedFocusedRow,
          cancelledOutreachTemplate,
        }));
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

  const buildAgentTaskLedgerUrl = (message: ScheduledMessage): string => {
    const params = new URLSearchParams({
      sourceKind: 'agent_task',
      sourceRefId: message.ID,
    });
    return `memory-exploring.html#/actions?${params.toString()}`;
  };

  const openTopicLink = (event: React.MouseEvent, url: string) => {
    event.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
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
      let jiraRuleSyncDetail = '';
      let jiraRuleSyncWarning = false;
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
                jiraRuleSyncWarning = true;
                jiraRuleSyncDetail = `Jira Rule: 同步失败（${updateResult?.error || '未知原因'}），Messages 状态仍继续写入`;
              } else {
                jiraRuleSyncDetail = `Jira Rule: 已同步为 ${newState}`;
              }
            } else {
              jiraRuleSyncWarning = true;
              jiraRuleSyncDetail = `Jira Rule: 规则详情未确认，Messages 状态仍继续写入`;
            }
          } else {
            jiraRuleSyncWarning = true;
            jiraRuleSyncDetail = `Jira Rule: 项目 ID 未确认，Messages 状态仍继续写入`;
          }
        } else {
          jiraRuleSyncWarning = true;
          jiraRuleSyncDetail = `Jira Rule: Automation_Link 无法解析，Messages 状态仍继续写入`;
        }
      }
      
      const updatedMessage = await service.toggleMessageStatus(message.ID);
      let outreachMirrorDetail = '';
      let outreachMirrorWarning = false;
      if (isOutreachMessage(updatedMessage)) {
        try {
          await syncOutreachTemplateStatusMirror(updatedMessage);
          outreachMirrorDetail = updatedMessage.Status === 'Paused'
            ? 'Outreach: 已暂停对应主动询问模板；未取消历史会话'
            : 'Outreach: 已同步 runtime 模板为可用状态';
        } catch (error) {
          outreachMirrorWarning = true;
          const messageText = error instanceof Error ? error.message : String(error);
          outreachMirrorDetail = `Outreach: runtime 同步未确认（${messageText}）；Messages 状态已写入`;
        }
      }
      // 跳过 Jira 同步，因为状态刚刚被手动更新了
      await loadMessages(service, true);
      setConfigSyncNotice(buildMessageStatusToggleNotice(message, updatedMessage, {
        jiraRuleSyncDetail,
        jiraRuleSyncWarning,
        outreachMirrorDetail,
        outreachMirrorWarning,
      }));
    } catch (error) {
      console.error('切换状态失败:', error);
      alert(`切换状态失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSubmitNewMessage = async (formData: CreateMessageFormData) => {
    if (!service) return;
    if (submitMessageInFlightRef.current) {
      return;
    }
    
    submitMessageInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      const agentTaskWebhookDetail = formData.Push_Method === 'AgentTask'
        ? (await ensureAgentTaskWebhookConfigForSave()).detail
        : '';
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
        const jiraRuleNameSyncLink = resolveJiraRuleNameSyncLink({
          savedLink: savedMessage.Automation_Link,
          formLink: formData.Automation_Link,
          editingLink: editingMessage.Automation_Link,
        });
        if (editingMessage.Push_Method === 'JiraAutomation' &&
            jiraRuleNameSyncLink &&
            formData.Topic &&
            formData.Topic !== editingMessage.Topic) {
          try {
            await syncJiraRuleName(jiraRuleNameSyncLink, formData.Topic);
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

        let agentTaskNotifyConfigError: Error | null = null;
        try {
          if (editingMessage.Push_Method === 'AgentTask' && savedMessage.Push_Method !== 'AgentTask') {
            await deleteAgentTaskNotifyConfigMirror(editingMessage.ID);
          } else {
            await syncAgentTaskNotifyConfigMirror(savedMessage);
          }
        } catch (syncError: any) {
          agentTaskNotifyConfigError = syncError instanceof Error
            ? syncError
            : new Error(syncError?.message || 'AgentTask 通知配置同步失败');
        }

        // 跳过 Jira 状态同步，因为刚保存的消息状态是一致的
        await loadMessages(service, true);
        setShowAddDialog(false);
        setEditingMessage(null);
        focusMessageById(savedMessage.ID);
        setConfigSyncNotice(buildMessageSaveNotice(
          savedMessage,
          'updated',
          outreachSyncError,
          agentTaskWebhookDetail,
          editingMessage.Status,
          agentTaskNotifyConfigError,
        ));
      } else {
        // 新建模式：创建消息
        const savedMessage = await service.createMessage(formData);
        let outreachSyncError: Error | null = null;

        try {
          await syncOutreachTemplateMirror(savedMessage, outreachMirrorOverrides);
        } catch (syncError: any) {
          outreachSyncError = syncError instanceof Error ? syncError : new Error(syncError?.message || '主动询问同步失败');
        }

        let agentTaskNotifyConfigError: Error | null = null;
        try {
          await syncAgentTaskNotifyConfigMirror(savedMessage);
        } catch (syncError: any) {
          agentTaskNotifyConfigError = syncError instanceof Error
            ? syncError
            : new Error(syncError?.message || 'AgentTask 通知配置同步失败');
        }

        // 跳过 Jira 状态同步，因为新建的消息不需要同步
        await loadMessages(service, true);
        setShowAddDialog(false);
        focusMessageById(savedMessage.ID);
        setConfigSyncNotice(buildMessageSaveNotice(
          savedMessage,
          'created',
          outreachSyncError,
          agentTaskWebhookDetail,
          undefined,
          agentTaskNotifyConfigError,
        ));
      }
    } catch (error) {
      console.error(editingMessage ? '更新消息失败:' : '创建消息失败:', error);
      alert(`${editingMessage ? '更新' : '创建'}失败: ${error.message}`);
    } finally {
      submitMessageInFlightRef.current = false;
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

  const cancelOutreachTemplateMirror = async (messageId: string): Promise<boolean> => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CANCEL_OUTREACH_TEMPLATE_MIRROR',
        data: {
          messageId
        }
      });

      if (response && response.success === false) {
        console.info('Outreach template mirror cancel skipped:', response.error || 'backend unavailable');
        return false;
      }
      return true;
    } catch (error) {
      console.info('Outreach template mirror cancel unavailable, ignoring:', error);
      return false;
    }
  };

  // AgentTask 通知配置（通知目标/成功回执/通知身份/模板）直接注册到 memory-service，
  // 不再依赖「Sheet -> 已部署 Apps Script -> 请求体」这条链路——那条链路只会转发
  // 已部署脚本版本认识的字段，版本没跟上时会静默丢字段（例如 successReceipt）。
  const syncAgentTaskNotifyConfigMirror = async (message: ScheduledMessage): Promise<void> => {
    if (message.Push_Method !== 'AgentTask') {
      return;
    }
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SYNC_AGENT_TASK_NOTIFY_CONFIG',
        data: { message },
      });
      if (response && response.success === false) {
        throw new Error(response.error || 'backend unavailable');
      }
    } catch (error) {
      console.warn('AgentTask notify config sync failed:', error);
      throw error;
    }
  };

  const deleteAgentTaskNotifyConfigMirror = async (sheetMessageId: string): Promise<boolean> => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DELETE_AGENT_TASK_NOTIFY_CONFIG',
        data: { sheetMessageId },
      });
      if (response && response.success === false) {
        console.info('AgentTask notify config delete skipped:', response.error || 'backend unavailable');
        return false;
      }
      return true;
    } catch (error) {
      console.info('AgentTask notify config delete unavailable, ignoring:', error);
      return false;
    }
  };

  const pauseOutreachTemplateMirror = async (message: ScheduledMessage) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'PAUSE_OUTREACH_TEMPLATE_MIRROR',
        data: {
          message
        }
      });

      if (response && response.success === false) {
        throw new Error(response.error || 'backend unavailable');
      }
    } catch (error) {
      console.warn('Outreach template mirror pause failed:', error);
      throw error;
    }
  };

  const syncOutreachTemplateStatusMirror = async (message: ScheduledMessage) => {
    if (!isOutreachMessage(message)) {
      return;
    }
    if (message.Status === 'Paused') {
      await pauseOutreachTemplateMirror(message);
      return;
    }
    await syncOutreachTemplateMirror(message);
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
      const outreachCompletedMessageIds = messages
        .filter(message => message.Status === 'Done' && isOutreachMessage(message))
        .map(message => message.ID);
      const deletedCount = await service.deleteCompletedMessages();
      await Promise.all(
        outreachCompletedMessageIds.map(messageId =>
          cancelOutreachTemplateMirror(messageId),
        ),
      );
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

  const ensureAgentTaskWebhookConfigForSave = async (): Promise<{
    config: SheetConfig;
    detail: string;
  }> => {
    if (!config) {
      throw new Error('帮我做缺少 Scheduled Messages 配置，无法写入 memory-service webhook');
    }

    const existingWebhook = getAgentTaskWebhookConfig(config);
    const envConfig = await getEnvConfig();
    const userId = existingWebhook?.userId || await resolveAgentTaskWebhookUserId(currentUsername);
    const resolvedWebhook = resolveAgentTaskWebhookConfig({
      existingWebhook,
      memoryServiceBaseUrl: envConfig.MEMORY_SERVICE_BASE_URL,
      memoryServiceApiKey: envConfig.MEMORY_SERVICE_API_KEY,
      userIdCandidates: [userId],
      requireUserId: true,
    });

    if (!resolvedWebhook.webhook) {
      if (resolvedWebhook.missingReason === '缺少 memory-service 用户身份') {
        throw new Error('帮我做缺少可用于 memory-service 的用户身份。请先登录/刷新用户信息，或在 Config 表设置 agent_task_user_id。');
      }
      throw new Error('帮我做缺少 memory-service webhook。请先在 Options 配置 MEMORY_SERVICE_BASE_URL，或在 Config 表设置 agent_task_webhook_url。');
    }

    const nextWebhook = resolvedWebhook.webhook;
    if (!resolvedWebhook.changed) {
      return {
        config,
        detail: `执行入口: Config 已配置 ${nextWebhook.webhookUrl}；Jira Rule 到期时会带 X-User-Id=${nextWebhook.userId} 调用 memory-service`,
      };
    }

    const token = await getGoogleAuthToken({
      caller: 'ScheduledMessagesManager.ensureAgentTaskWebhook',
      scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
    });
    if (!token) {
      throw new Error('帮我做需要 Google 授权才能把 memory-service webhook 写入 Sheet Config。');
    }

    const syncService = new ConfigSyncService(token);
    const nextConfig = withAgentTaskWebhook(config, nextWebhook);
    const syncedConfig = await syncService.syncConfig(nextConfig, {
      syncAction: 'agent_task_webhook_auto_config',
    });
    setConfig(syncedConfig);

    return {
      config: syncedConfig,
      detail: `执行入口: 本次已补齐 Config ${nextWebhook.webhookUrl}；Jira Rule 到期时会带 X-User-Id=${nextWebhook.userId} 调用 memory-service`,
    };
  };
  
  const getCurrentUserName = async () => {
    try {
      const token = await getGoogleAuthTokenSilently({
        caller: 'ScheduledMessagesManager.getCurrentUserName',
        scopes: GOOGLE_AUTH_SCOPE_SETS.IDENTITY,
      });
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

  const isJiraAutomationTakeoverCandidate = (message: ScheduledMessage): boolean => Boolean(
    message.Push_Method === 'JiraAutomation' &&
    message.Schedule_Date &&
    !message.AI_Endpoint &&
    message.Automation_Link
  );

  const isManagedJiraAutomationMessage = (message: ScheduledMessage): boolean => Boolean(
    message.Push_Method === 'JiraAutomation' &&
    message.Schedule_Date &&
    message.AI_Endpoint &&
    message.Automation_Link
  );
  
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

    if (isAgentTaskMessage(message)) {
      return 'Agent 任务';
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

    if (message.Push_Method === 'AgentTask') {
      const executorId = message.Agent_Executor?.trim();
      const executorLabel = outreachRuntime.agentExecutors.find((item) => item.id === executorId)?.label
        || executorId
        || '默认执行器';
      return `memory-service / ${executorLabel}`;
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

  const buildMessageSaveNotice = (
    message: ScheduledMessage,
    action: 'created' | 'updated',
    outreachSyncError?: Error | null,
    agentTaskWebhookDetail?: string,
    previousStatus?: ScheduledMessage['Status'],
    agentTaskNotifyConfigError?: Error | null,
  ): ConfigSyncNotice => {
    const topic = message.Topic || message.ID;
    const actionLabel = action === 'created' ? '创建' : '更新';
    const outreachSyncDetail = outreachSyncError
      ? `主动询问同步: 写入 Messages 成功，但同步到 memory-service 失败 - ${outreachSyncError.message}`
      : message.Push_Method === 'Outreach'
        ? '主动询问同步: 已同步到 memory-service runtime'
        : '';
    const agentTaskDetail = message.Push_Method === 'AgentTask'
      ? '帮我做: 已写入 AgentTask 计划行；Jira Rule 只在到期时调用 memory-service，执行账本和通知以后端为准'
      : '';
    const agentTaskNotifyConfigDetail = agentTaskNotifyConfigError
      ? `结果通知配置: 写入 Messages 成功，但同步到 memory-service 失败 - ${agentTaskNotifyConfigError.message}；若线上 App Script 版本较旧，通知目标/成功回执可能不生效`
      : message.Push_Method === 'AgentTask'
        ? '结果通知配置: 已直接注册到 memory-service，不依赖 Jira Rule 触发时的请求体字段'
        : '';
    const reactivatedFromDone = previousStatus === 'Done' && message.Status === 'Active';

    return {
      tone: outreachSyncError || agentTaskNotifyConfigError ? 'warning' : 'success',
      title: message.Push_Method === 'AgentTask' ? `帮我做${actionLabel}回执` : `定时消息${actionLabel}回执`,
      description: `「${topic}」已写入 Messages 并定位到列表。`,
      details: [
        `写入: Messages 行 ${message.ID}`,
        reactivatedFromDone
          ? '状态: 已从 Done 恢复为 Active，执行器会按下次执行时间领取'
          : '',
        `下次执行: ${formatNextExec(message)}`,
        `频率: ${formatFrequency(message)}`,
        `发给: ${formatRecipient(message)}`,
        outreachSyncDetail,
        agentTaskDetail,
        agentTaskNotifyConfigDetail,
        message.Push_Method === 'AgentTask' ? agentTaskWebhookDetail : '',
        '边界: 已保存计划但没有立即发送；定位只改变当前列表视图',
        '恢复: 返回完整列表可清除定位；发送前仍可继续编辑、暂停或删除',
      ].filter(Boolean),
    };
  };

  const buildMessageDeleteNotice = (
    message: ScheduledMessage | undefined,
    options: {
      clearedFocusedRow: boolean;
      restoredJiraRule?: boolean;
      cancelledOutreachTemplate?: boolean;
    },
  ): ConfigSyncNotice => {
    const topic = message?.Topic || message?.ID || '这条消息';

    return {
      tone: 'success',
      title: '定时消息删除回执',
      description: `「${topic}」已从 Messages 表删除。`,
      details: [
        `删除: Messages 行 ${message?.ID || '未知'}`,
        message ? `原状态: ${message.Status}` : '',
        message ? `原下次执行: ${formatNextExec(message)}` : '',
        message ? `原频率: ${formatFrequency(message)}` : '',
        options.restoredJiraRule ? 'Jira Rule: 已恢复为 Scheduled trigger' : '',
        options.cancelledOutreachTemplate ? 'Outreach: 已取消对应主动询问模板' : '',
        '边界: 只删除维护表中的计划；不会撤回已发出的消息或历史 Logs',
        options.clearedFocusedRow
          ? '恢复: 已清除 messageId，页面返回完整列表'
          : '恢复: 如误删需从 Sheet 版本历史或备份恢复',
      ].filter(Boolean),
    };
  };

  const buildMessageStatusToggleNotice = (
    previousMessage: ScheduledMessage,
    updatedMessage: ScheduledMessage,
    options: {
      jiraRuleSyncDetail?: string;
      jiraRuleSyncWarning?: boolean;
      outreachMirrorDetail?: string;
      outreachMirrorWarning?: boolean;
    } = {},
  ): ConfigSyncNotice => {
    const topic = updatedMessage.Topic || previousMessage.Topic || updatedMessage.ID;
    const isPaused = updatedMessage.Status === 'Paused';
    const actionLabel = isPaused ? '已暂停' : '已恢复';
    const hasWarning = Boolean(options.jiraRuleSyncWarning || options.outreachMirrorWarning);

    return {
      tone: hasWarning ? 'warning' : 'success',
      title: '定时消息状态回执',
      description: `「${topic}」${actionLabel}。`,
      details: [
        `写入: Messages 行 ${updatedMessage.ID} ${previousMessage.Status} -> ${updatedMessage.Status}`,
        options.jiraRuleSyncDetail || '',
        options.outreachMirrorDetail || '',
        '边界: 只切换排程状态；不会立即发送、不会改 Logs、不会批准或拒绝待审核正文。',
        isPaused
          ? '恢复: 发送前可点恢复，或继续编辑 / 删除这行。'
          : '恢复: 如不想继续执行，发送前仍可暂停、编辑或删除这行。',
      ].filter(Boolean),
    };
  };

  const buildMessageActionSnapshot = (message: ScheduledMessage): string => [
    `ID ${message.ID || '未知'}`,
    `状态 ${message.Status || '未知'}`,
    `下次执行 ${formatNextExec(message)}`,
    `频率 ${formatFrequency(message)}`,
    `发给 ${formatRecipient(message)}`,
  ].join('，');

  const buildMessageEditActionBoundary = (message: ScheduledMessage, displayTitle: string): string => {
    const topic = displayTitle || message.Topic || message.ID || '这条消息';
    const snapshot = buildMessageActionSnapshot(message);

    if (isJiraAutomationTakeoverCandidate(message)) {
      return [
        `托管并编辑 ${topic}。`,
        '点击只打开托管确认，不会立刻写 Messages、改 Jira Rule、发送或删除。',
        '确认托管成功后才会写入 AI_Endpoint 并进入编辑草稿。',
        `当前: ${snapshot}。`,
      ].join('');
    }

    return [
      `编辑 ${topic}。`,
      '点击只打开本地编辑草稿，不会立刻写 Messages、改期、发送、删除、改 Logs 或同步 Sheet。',
      `保存后才写回 Messages 行 ${message.ID || '未知'}。`,
      `当前: ${snapshot}。`,
    ].join('');
  };

  const buildMessageDeleteActionBoundary = (message: ScheduledMessage, displayTitle: string): string => {
    const topic = displayTitle || message.Topic || message.ID || '这条消息';
    const snapshot = buildMessageActionSnapshot(message);

    if (isManagedJiraAutomationMessage(message)) {
      return [
        `删除 ${topic}。`,
        '点击先显示删除确认，确认前不会写 Sheet。',
        `确认后会先尝试把 Jira Rule 恢复为 Scheduled trigger，成功后才删除 Messages 行 ${message.ID || '未知'}。`,
        '不会撤回已发消息或历史 Logs。',
        `当前: ${snapshot}。`,
      ].join('');
    }

    if (isOutreachMessage(message)) {
      return [
        `删除 ${topic}。`,
        '点击先显示删除确认，确认前不会写 Sheet。',
        `确认后删除 Messages 行 ${message.ID || '未知'} 并取消对应 Outreach 模板镜像。`,
        '不会撤回已发消息、历史会话或 Logs。',
        `当前: ${snapshot}。`,
      ].join('');
    }

    return [
      `删除 ${topic}。`,
      '点击先显示删除确认，确认前不会写 Sheet。',
      `确认后只删除 Messages 行 ${message.ID || '未知'}。`,
      '不会撤回已发消息或历史 Logs。',
      `当前: ${snapshot}。`,
    ].join('');
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
  const listFilterReceipt = useMemo(
    () => targetMessageId
      ? null
      : buildScheduledMessagesFilterReceipt(messages, {
        selectedCategories: selectedCategoryValues,
        filterPendingReview,
        filterSelfOnly,
        currentUsername,
      }, {
        isBackgroundLoading,
      }),
    [currentUsername, filterPendingReview, filterSelfOnly, isBackgroundLoading, messages, selectedCategoryValues, targetMessageId],
  );
  const targetMessageReceipt = useMemo(
    () => buildScheduledMessagesTargetReceipt({
      targetMessageId,
      targetMessage,
      filters: {
        selectedCategories: selectedCategoryValues,
        filterPendingReview,
        filterSelfOnly,
        currentUsername,
      },
    }),
    [currentUsername, filterPendingReview, filterSelfOnly, selectedCategoryValues, targetMessage, targetMessageId],
  );
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
    if (!service) {
      setRescheduleNotice(buildRescheduleFailureNotice({
        source: 'queue',
        messageId: slot.actionMessageId,
        topic: slot.actionTopic,
        reason: '定时消息服务还没有完成初始化。',
        nextStep: '等待页面加载完成后重试，或手动同步刷新维护表',
        tone: 'warning',
      }));
      return;
    }

    if (!slot.actionMessageId || !slot.suggestion) {
      setRescheduleNotice(buildRescheduleFailureNotice({
        source: 'queue',
        messageId: slot.actionMessageId,
        topic: slot.actionTopic,
        reason: '当前槽位没有可直接应用的改期建议。',
        nextStep: '定位或编辑目标消息，手动选择一个未来执行时间',
        tone: 'warning',
      }));
      return;
    }

    const message = messages.find(candidate => candidate.ID === slot.actionMessageId);
    if (!message) {
      setRescheduleNotice(buildRescheduleFailureNotice({
        source: 'queue',
        messageId: slot.actionMessageId,
        topic: slot.actionTopic,
        reason: '当前列表中找不到建议处理的消息，可能已经被删除、筛选隐藏或 Sheet 已更新。',
      }));
      return;
    }

    setIsSubmitting(true);
    try {
      const executionLaneSummary = getRescheduleSuggestionLaneSummary(message, slot.suggestion);
      await service.updateMessage(slot.actionMessageId, {
        Schedule_Date: slot.suggestion.dateStr,
        Schedule_Time: slot.suggestion.timeStr,
      });
      await loadMessages(service, true);
      focusMessageById(slot.actionMessageId);
      setRescheduleNotice(buildRescheduleNotice({
        message,
        label: slot.suggestion.label,
        source: 'queue',
        clearsScheduleTime: slot.suggestion.clearsScheduleTime,
        reason: slot.suggestion.reason,
        executionLaneSummary,
      }));
    } catch (error: any) {
      console.error('应用队列建议时间失败:', error);
      setRescheduleNotice(buildRescheduleFailureNotice({
        source: 'queue',
        messageId: slot.actionMessageId,
        topic: message.Topic || message.ID,
        reason: error instanceof Error ? error.message : String(error || '未知错误'),
        nextStep: '检查 Google 授权、Sheet 权限或网络后重试，也可以打开 Messages 表手动改期',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleApplyScheduleHealthSuggestion = async (messageId: string) => {
    if (!service) {
      setRescheduleNotice(buildRescheduleFailureNotice({
        source: 'health',
        messageId,
        reason: '定时消息服务还没有完成初始化。',
        nextStep: '等待页面加载完成后重试，或手动同步刷新维护表',
        tone: 'warning',
      }));
      return;
    }

    if (!messageId) {
      setRescheduleNotice(buildRescheduleFailureNotice({
        source: 'health',
        reason: '健康告警没有提供可写入的消息 ID。',
        nextStep: '同步刷新 Messages 后再处理健康告警',
        tone: 'warning',
      }));
      return;
    }

    const message = messages.find(candidate => candidate.ID === messageId);
    if (!message) {
      setRescheduleNotice(buildRescheduleFailureNotice({
        source: 'health',
        messageId,
        reason: '当前列表中找不到这条健康告警消息，可能已经被删除、筛选隐藏或 Sheet 已更新。',
      }));
      return;
    }

    const suggestion = scheduleHealthRecoverySuggestions.get(messageId) ||
      getScheduleHealthRecoverySuggestion(message, queueSummaryNow);
    if (!suggestion) {
      setRescheduleNotice(buildRescheduleFailureNotice({
        source: 'health',
        messageId,
        topic: message.Topic || message.ID,
        reason: '当前消息没有可直接应用的改期建议。',
        nextStep: '打开编辑，把执行日期或时间改到未来可执行窗口',
        tone: 'warning',
      }));
      return;
    }

    const executionLaneSummary = getRescheduleSuggestionLaneSummary(message, suggestion);
    setScheduleHealthPendingReceipt({
      messageId,
      topic: message.Topic || message.ID,
      label: suggestion.label,
      clearsScheduleTime: suggestion.clearsScheduleTime,
      executionLaneSummary,
    });
    setIsSubmitting(true);
    try {
      await service.updateMessage(messageId, {
        Schedule_Date: suggestion.dateStr,
        Schedule_Time: suggestion.timeStr,
      });
      await loadMessages(service, true);
      focusMessageById(messageId);
      setRescheduleNotice(buildRescheduleNotice({
        message,
        label: suggestion.label,
        source: 'health',
        clearsScheduleTime: suggestion.clearsScheduleTime,
        reason: suggestion.reason,
        executionLaneSummary,
      }));
    } catch (error: any) {
      console.error('应用健康告警改期建议失败:', error);
      setRescheduleNotice(buildRescheduleFailureNotice({
        source: 'health',
        messageId,
        topic: message.Topic || message.ID,
        reason: error instanceof Error ? error.message : String(error || '未知错误'),
        nextStep: '检查 Google 授权、Sheet 权限或网络后重试，也可以打开 Messages 表手动改期',
      }));
    } finally {
      setIsSubmitting(false);
      setScheduleHealthPendingReceipt(null);
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

  const showOutreachConfigWarning = outreachRuntimeLoaded && (
    Boolean(outreachRuntime.configLoadError) ||
    !outreachRuntime.enabled ||
    !outreachRuntime.ringCentralReady
  );
  const outreachConfigWarningTitle = outreachRuntime.configLoadError
    ? '无法验证主动询问配置'
    : !outreachRuntime.enabled
    ? '主动询问引擎尚未开启'
    : 'RingCentral 配置尚未完成';
  const outreachConfigWarningDescription = outreachRuntime.configLoadError
    ? `${outreachRuntime.configLoadError}。不会将此错误视为 RingCentral 未配置；请恢复 Memory Service 访问后重试。`
    : !outreachRuntime.enabled
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
        const authResult = await getGoogleAuthTokenResult({
          caller: 'ScheduledMessagesManager.handleReauth',
          scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
          promptForAccount: true,
        });
        const token = authResult.token;
        if (token) {
          setAuthFailureMessage('');
          setNeedsReauth(false);
          const messageService = new ScheduledMessageService(token);
          setService(messageService);
          const initialMessages = await loadMessages(messageService, false, { deferEnrichment: true });
          if (config) {
            const didConsumeSetupReceipt = await consumePendingSetupReceipt(config);
            if (!didConsumeSetupReceipt) {
              maybeShowAgentTaskWebhookReadinessNotice(config, initialMessages);
            }
          }
          if (config) {
            void checkBotConfigValidity(config, initialMessages);
          }
        } else {
          setAuthFailureMessage(formatGoogleAuthFailure(authResult));
        }
      } catch (error) {
        console.error('重新授权失败:', error);
        alert('授权失败，请重试');
      }
    };
    
    return (
      <div style={styles.loadingContainer}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '18px', marginBottom: '16px' }}>🔐 需要 Google Sheets 授权</p>
          <p style={{ color: '#666', marginBottom: '24px' }}>
            {authFailureMessage || '当前无法取得定时消息所需的 Google Sheets 权限。'}
            请点击下方按钮完成或恢复授权；本次不会请求 Google Slides 权限。
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
          <button style={styles.addButton} onClick={handleAddMessage} title="新增消息">
            ➕ 新增
          </button>
          <button
            style={{
              ...styles.syncButton,
              opacity: isSyncingConfig ? 0.7 : 1,
              cursor: isSyncingConfig ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSync}
            title={manualConfigSyncActionBoundary}
            aria-label={manualConfigSyncActionBoundary}
            disabled={isSyncingConfig}
          >
            {isSyncingConfig ? '⏳ 同步中...' : '🔄 同步'}
          </button>
          {!updateAvailable && (
            <button
              style={styles.checkUpdateButton}
              onClick={() => checkForUpdates({ interactive: true, showCurrentAlert: true })}
              disabled={isCheckingUpdates || isUpdating}
              title={appScriptCheckActionBoundary}
              aria-label={appScriptCheckActionBoundary}
            >
              {isCheckingUpdates ? '⏳ 检查中...' : '🔎 检查脚本'}
            </button>
          )}
          <button style={styles.configButton} onClick={handleOpenLogsSheet} title="查看推送记录">
            📊 推送记录
          </button>
        </div>
      </header>

      {configSyncNotice && (
        <div style={getConfigSyncNoticeStyle(configSyncNotice.tone)} role="status">
          <div style={styles.warningContent}>
            <span style={styles.warningIcon}>{getConfigSyncNoticeIcon(configSyncNotice.tone)}</span>
            <div style={styles.warningText}>
              <strong>{configSyncNotice.title}</strong>
              <p style={styles.configSyncDescription}>{configSyncNotice.description}</p>
              {configSyncNotice.details && configSyncNotice.details.length > 0 && (
                <div style={styles.configSyncMetaRow}>
                  {configSyncNotice.details.map((item) => (
                    <span key={item} style={styles.configSyncMetaItem}>{item}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            style={styles.configSyncDismissButton}
            onClick={() => setConfigSyncNotice(null)}
            aria-label="关闭 Config 同步状态"
          >
            ×
          </button>
        </div>
      )}

      {rescheduleNotice && (
        <div style={getConfigSyncNoticeStyle(rescheduleNotice.tone)} role="status" aria-live="polite">
          <div style={styles.warningContent}>
            <span style={styles.warningIcon}>{getConfigSyncNoticeIcon(rescheduleNotice.tone)}</span>
            <div style={styles.warningText}>
              <strong>{rescheduleNotice.title}</strong>
              <p style={styles.configSyncDescription}>{rescheduleNotice.description}</p>
              {rescheduleNotice.details && rescheduleNotice.details.length > 0 && (
                <div style={styles.configSyncMetaRow}>
                  {rescheduleNotice.details.map((item) => (
                    <span key={item} style={styles.configSyncMetaItem}>{item}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            style={styles.configSyncDismissButton}
            onClick={() => setRescheduleNotice(null)}
            aria-label="关闭改期回执"
          >
            ×
          </button>
        </div>
      )}

      {appScriptUpgradeNotice && (
        <div style={getConfigSyncNoticeStyle(appScriptUpgradeNotice.tone)} role="status" aria-live="polite">
          <div style={styles.warningContent}>
            <span style={styles.warningIcon}>{getConfigSyncNoticeIcon(appScriptUpgradeNotice.tone)}</span>
            <div style={styles.warningText}>
              <strong>{appScriptUpgradeNotice.title}</strong>
              <p style={styles.configSyncDescription}>{appScriptUpgradeNotice.description}</p>
              {appScriptUpgradeNotice.details && appScriptUpgradeNotice.details.length > 0 && (
                <div style={styles.configSyncMetaRow}>
                  {appScriptUpgradeNotice.details.map((item) => (
                    <span key={item} style={styles.configSyncMetaItem}>{item}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={styles.updateBannerActions}>
            {appScriptUpgradeNotice.recoveryUrl && (
              <button
                type="button"
                style={styles.secondaryUpdateBannerButton}
                onClick={() => window.open(appScriptUpgradeNotice.recoveryUrl, '_blank')}
                title={appScriptRecoveryActionBoundary}
                aria-label={appScriptRecoveryActionBoundary}
              >
                打开检查页面
              </button>
            )}
            <button
              type="button"
              style={styles.configSyncDismissButton}
              onClick={() => setAppScriptUpgradeNotice(null)}
              aria-label="关闭 App Script 升级结果回执"
            >
              ×
            </button>
          </div>
        </div>
      )}

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
            title={appScriptCheckActionBoundary}
            aria-label={appScriptCheckActionBoundary}
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
                {updateCheckError} 当前脚本不会被自动改动；先打开版本端点确认是否返回 JSON version/lastUpdated，或进入 Apps Script 项目检查 Web App deployment 后重试。
              </p>
            </div>
          </div>
          <div style={styles.updateBannerActions}>
            {appScriptVersionProbeUrl && (
              <button
                style={styles.secondaryUpdateErrorButton}
                onClick={handleOpenAppScriptVersionProbe}
                disabled={isCheckingUpdates || isUpdating}
                title={appScriptVersionProbeActionBoundary}
                aria-label={appScriptVersionProbeActionBoundary}
              >
                打开版本端点
              </button>
            )}
            {appScriptProjectUrl && (
              <button
                style={styles.secondaryUpdateErrorButton}
                onClick={handleOpenAppScriptProject}
                disabled={isCheckingUpdates || isUpdating}
                title={appScriptProjectActionBoundary}
                aria-label={appScriptProjectActionBoundary}
              >
                打开 Apps Script
              </button>
            )}
            <button
              style={styles.updateErrorButton}
              onClick={() => checkForUpdates({ interactive: true, showCurrentAlert: true })}
              disabled={isCheckingUpdates || isUpdating}
              title={appScriptRecheckActionBoundary}
              aria-label={appScriptRecheckActionBoundary}
            >
              {isCheckingUpdates ? '检查中...' : '重试检查'}
            </button>
          </div>
        </div>
      )}

      {updateAvailable && (
        <div style={styles.updateAvailableToast} role="status" aria-live="polite">
          <span>🚀 {appScriptUpgradeToastText}</span>
          <button
            style={styles.updateToastAction}
            onClick={isAppScriptVersionLimitReached ? handleOpenAppScriptProjectHistory : handleUpgradeVersion}
            disabled={isCheckingUpdates || isUpdating}
            title={isAppScriptVersionLimitReached
              ? appScriptProjectHistoryActionBoundary
              : appScriptUpgradeActionBoundary}
            aria-label={isAppScriptVersionLimitReached
              ? appScriptProjectHistoryActionBoundary
              : appScriptUpgradeActionBoundary}
          >
            {isUpdating ? '升级中...' : isAppScriptVersionLimitReached ? '清理版本' : '升级'}
          </button>
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
                  const pendingReceipt = scheduleHealthPendingReceipt?.messageId === issue.messageId
                    ? scheduleHealthPendingReceipt
                    : null;

                  return (
                    <div
                      key={issue.messageId}
                      style={styles.queueIssueItem}
                      title={formatScheduleHealthIssue(issue)}
                    >
                      <span style={styles.queueIssueText}>
                        <strong>{issue.topic}</strong>
                        <small style={styles.queueIssueSuggestionText}>
                          {formatScheduleHealthIssueMissedWindow(issue)}
                        </small>
                        <small style={styles.queueIssueSuggestionText}>
                          {formatScheduleHealthIssueSuggestedAction(issue, recoverySuggestion)}
                        </small>
                        {pendingReceipt && (
                          <small
                            style={styles.queueIssuePendingReceipt}
                            aria-label="健康告警改期写入中"
                            aria-live="polite"
                          >
                            {formatScheduleHealthPendingReceipt(pendingReceipt)}
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
                            aria-label={pendingReceipt
                              ? `正在将${issue.topic || issue.messageId}改到${recoverySuggestion.label}`
                              : `将${issue.topic || issue.messageId}改到${recoverySuggestion.label}`}
                            title={pendingReceipt
                              ? '正在写入这条健康告警的建议时间，其他告警尚未改动'
                              : recoverySuggestion.reason}
                          >
                            {pendingReceipt ? '写入中' : '一键改期'}
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
              <div style={styles.queueSummaryHeader}>
                <strong>
                  {scheduleQueueSummary.riskSlotCount > 0 ? '执行器队列可能延迟' : '执行器队列正在排队'}
                </strong>
                <button
                  type="button"
                  style={styles.queueDetailsToggleButton}
                  onClick={() => setShowQueueDetails(value => !value)}
                  aria-expanded={showQueueDetails}
                  aria-label={showQueueDetails ? '收起执行器队列详情' : '查看执行器队列详情'}
                >
                  {showQueueDetails ? '收起详情' : '查看详情'}
                </button>
              </div>
              <p style={scheduleQueueSummary.riskSlotCount > 0 ? styles.queueRiskDescription : styles.queueInfoDescription}>
                {formatScheduleQueueCompactSummary(scheduleQueueSummary)}
              </p>
              {showQueueDetails && (
                <>
                  <div
                    style={styles.queueDetailsReceipt}
                    role="status"
                    aria-live="polite"
                  >
                    {formatScheduleQueueDetailsReceipt(scheduleQueueSummary, queueSummaryNow)}
                  </div>
                  <p style={styles.queueBoundaryDescription}>
                    操作边界：改到建议只写回最晚消息的 Schedule_Date / Schedule_Time，不会立即发送、不会跳过前序消息；写入后需同步刷新确认新队列健康。
                  </p>
                  <div style={styles.queueSlotList}>
                    {scheduleQueueSummary.topSlots.map(slot => {
                      const actionMessage = messages.find(candidate => candidate.ID === slot.actionMessageId);
                      const suggestionLaneSummary = actionMessage && slot.suggestion
                        ? getRescheduleSuggestionLaneSummary(actionMessage, slot.suggestion)
                        : '';

                      return (
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
                                {slot.suggestion.reason && (
                                  <small style={styles.queueSlotSuggestionReasonText}>
                                    {formatQueueSlotSuggestionReasonLabel(slot)}
                                  </small>
                                )}
                                {suggestionLaneSummary && (
                                  <small style={styles.queueSlotSuggestionReasonText}>
                                    写入后{suggestionLaneSummary}
                                  </small>
                                )}
                              </div>
                            )}
                            {slot.actionMessageId && (
                              <div style={styles.queueSlotBasisText}>
                                {formatScheduleQueueSlotDecisionBasis(slot)}
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
                                aria-label={formatQueueSlotFocusActionLabel(slot)}
                                title={formatQueueSlotFocusActionLabel(slot)}
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
                                aria-label={formatQueueSlotEditActionLabel(slot)}
                                title={formatQueueSlotEditActionLabel(slot)}
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
                                  title={slot.suggestion.reason
                                    ? `改到 ${slot.suggestion.label}: ${slot.suggestion.reason}`
                                    : `改到 ${slot.suggestion.label}`}
                                >
                                  改到建议
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                </>
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
        <div
          style={{
            ...styles.targetReviewBanner,
            ...(targetMessageReceipt?.tone === 'warning' ? styles.targetReviewBannerWarning : {}),
          }}
          role="status"
          aria-live="polite"
        >
          <div style={styles.targetReviewText}>
            <strong>{targetMessageReceipt?.title || '已定位消息'}</strong>
            <span>{targetMessageReceipt?.summary || `消息 ${targetMessageId}`}</span>
            {targetMessageReceipt?.details && (
              <div style={styles.targetReviewDetails}>
                {targetMessageReceipt.details.map((detail) => (
                  <span key={detail}>{detail}</span>
                ))}
              </div>
            )}
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

      {listFilterReceipt && (
        <div
          style={{
            ...styles.filterReceipt,
            ...(listFilterReceipt.tone === 'warning' ? styles.filterReceiptWarning : {}),
          }}
          role="status"
          aria-live="polite"
        >
          <div style={styles.filterReceiptBody}>
            <strong>{listFilterReceipt.title}</strong>
            <span>{listFilterReceipt.summary}</span>
            <div style={styles.filterReceiptDetails}>
              {listFilterReceipt.details.map((detail) => (
                <span key={detail}>{detail}</span>
              ))}
            </div>
          </div>
          <button
            type="button"
            style={styles.filterReceiptButton}
            onClick={clearMessageFilters}
          >
            清除筛选
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
                    const executionLaneReceipt = getScheduledMessageExecutionLaneReceipt(message, {
                      botConfigured,
                      ringCentralSenderConfigured: hasRingCentralSenderCredentials(config),
                      outreachEnabled: outreachRuntime.enabled,
                      outreachConfigured: outreachRuntime.ringCentralReady,
                    });
                    const executionLaneSummary = formatExecutionLaneSummary(executionLaneReceipt);
                    const executionLaneDetail = formatExecutionLaneReceipt(executionLaneReceipt);
                    const compensationWindowReceipt = getScheduleCompensationWindowReceipt(message, queueSummaryNow);
                    const nextExecText = formatNextExec(message);
                    const statusToggleAction = getScheduledMessageStatusToggleAction(message.Status);
                    const editActionBoundary = buildMessageEditActionBoundary(message, displayTitle);
                    const deleteActionBoundary = buildMessageDeleteActionBoundary(message, displayTitle);
                    const autoReplyReviewReceipt = buildAutoReplyReviewReceipt(message);
                    const agentTaskLedgerUrl = isAgentTaskMessage(message)
                      ? buildAgentTaskLedgerUrl(message)
                      : '';
                    const outreachSessionsUrl = message.Push_Method === 'Outreach'
                      ? buildOutreachSessionsUrl(message.ID, message.Outreach_Last_Session_ID)
                      : '';
                    return (
                      <tr 
                        key={message.ID} 
                        data-message-id={message.ID}
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
                          <div style={styles.topicStack}>
                            <div style={styles.topicTitleRow}>
                              <span style={styles.topicText} title={displayTitle}>
                                {isAutoReplyScheduledMessage(message) && (
                                  <span title="自动答复消息" style={{ marginRight: '4px' }}>🤖</span>
                                )}
                                {displayTitle}
                              </span>
                              {message.Automation_Link && (
                                <button
                                  type="button"
                                  style={styles.topicInlineLinkButton}
                                  onClick={(event) => openTopicLink(event, message.Automation_Link!)}
                                  aria-label={`打开 Jira Automation Rule: ${displayTitle}`}
                                  title="打开 Jira Automation Rule"
                                >
                                  🔗
                                </button>
                              )}
                              {agentTaskLedgerUrl && (
                                <button
                                  type="button"
                                  style={styles.topicInlineLinkButton}
                                  onClick={(event) => openTopicLink(event, agentTaskLedgerUrl)}
                                  aria-label={`查看帮我做执行账本: ${displayTitle}`}
                                  title="查看帮我做执行账本"
                                >
                                  🔗
                                </button>
                              )}
                              {outreachSessionsUrl && (
                                <button
                                  type="button"
                                  style={styles.topicInlineLinkButton}
                                  onClick={(event) => openTopicLink(event, outreachSessionsUrl)}
                                  aria-label={`打开主动询问会话: ${displayTitle}`}
                                  title="打开主动询问会话页面"
                                >
                                  💬
                                </button>
                              )}
                            </div>
                            {autoReplyReviewReceipt && (
                              <small style={styles.autoReplyReviewReceipt}>
                                <strong>{autoReplyReviewReceipt.label}</strong>
                                <span>{autoReplyReviewReceipt.detail}</span>
                                {autoReplyReviewReceipt.details.map((detail) => (
                                  <span key={detail}>{detail}</span>
                                ))}
                              </small>
                            )}
                          </div>
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
                            {isAgentTaskMessage(message) && (
                              <small style={{ color: '#6c757d', lineHeight: 1.4 }}>
                                {formatAgentTaskSummary(message) || '结果以 memory-service 执行账本为准'}
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
                            <small
                              style={executionLaneReceipt.tone === 'warning' ? styles.schedulePolicyWarningText : styles.schedulePolicyText}
                              title={executionLaneDetail}
                            >
                              {executionLaneSummary}
                            </small>
                            {compensationWindowReceipt && (
                              <small
                                style={styles.schedulePolicyWarningText}
                                title={formatScheduleCompensationWindowReceiptDetail(compensationWindowReceipt)}
                                aria-label={formatScheduleCompensationWindowReceiptDetail(compensationWindowReceipt)}
                              >
                                {formatScheduleCompensationWindowReceipt(compensationWindowReceipt)}
                              </small>
                            )}
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
                                aria-label={editActionBoundary}
                                title={editActionBoundary}
                              >
                                ✏️
                              </button>
                            )}
                            <button 
                              style={styles.deleteButton}
                              onClick={() => handleDeleteMessage(message, displayTitle)}
                              aria-label={deleteActionBoundary}
                              title={deleteActionBoundary}
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
           outreachConfigLoadError={outreachRuntime.configLoadError}
           agentTaskOpenClawConfigured={outreachRuntime.openClawReady}
           agentTaskOpenClawCheckLoaded={outreachRuntimeLoaded}
           agentTaskOpenClawMissingReason={outreachRuntime.openClawMissingReason}
           agentExecutors={outreachRuntime.agentExecutors}
           agentTaskDefaultExecutor={outreachRuntime.agentTaskDefaultExecutor}
           onRefreshAgentExecutors={loadOutreachRuntime}
           ringCentralSenderConfigured={hasRingCentralSenderCredentials(config)}
           onConfigureBot={(mode) => openBotConfigDialog(mode)}
           onConfigureRingCentralSender={openRingCentralSenderConfigDialog}
           onConfigureOutreach={openOptionsPage}
           onConfigureOpenClaw={openOpenClawOptionsPage}
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
               : isAgentTaskMessage(hoveredMessage)
                 ? getAgentTaskResult(hoveredMessage) || getAgentTaskEvidence(hoveredMessage)
                   ? '帮我做内容与结果'
                   : '帮我做内容'
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
  const selectedStatus = getTimelineCacheProjectStatus(status, selectedProject);
  const hasStatus = Boolean(status);
  const selectedProjectMissingFromStatus = Boolean(selectedProject && status && !selectedStatus);
  const selectedMilestoneKeys = selectedStatus?.milestoneKeys;
  const selectedMilestoneMissing = isTimelineMilestoneMissingFromCache(
    selectedMilestone,
    selectedMilestoneKeys,
  );
  const hasSyncWarning = selectedStatus?.lastAttempt?.success === false;
  const cacheAvailable = Boolean(
    !error &&
    selectedStatus?.status === 'ready' &&
    !selectedMilestoneMissing &&
    !selectedProjectMissingFromStatus,
  );
  const isReady = cacheAvailable && !hasSyncWarning;
  const compactStatusLabel = isLoading
    ? '检查中'
    : cacheAvailable
      ? '可用'
      : error || selectedProjectMissingFromStatus || selectedStatus || hasStatus
        ? '不可用'
        : '待检查';
  const compactStatusText = selectedProject || selectedStatus?.project
    ? `${selectedProject || selectedStatus?.project}：${compactStatusLabel}`
    : compactStatusLabel;
  const statusColor = cacheAvailable && !isLoading ? '#155724' : '#856404';
  const statusBg = cacheAvailable && !isLoading ? '#d4edda' : '#fff3cd';
  const statusBorder = cacheAvailable && !isLoading ? '#c3e6cb' : '#ffeeba';
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
  const scopeReceiptText = getTimelineCacheScopeReceiptText({
    usage,
    selectedProject,
    selectedMilestone,
    hasStatus,
    hasReadError: Boolean(error),
    canDryRun: Boolean(dryRunHelp),
    hasTimelineSyncRule: Boolean(timelineSyncRuleUrl),
  });
  const [dryRunTesting, setDryRunTesting] = React.useState(false);
  const [dryRunResultText, setDryRunResultText] = React.useState('');
  const [dryRunResultSuccess, setDryRunResultSuccess] = React.useState<boolean | null>(null);
  const [diagnosticCopyText, setDiagnosticCopyText] = React.useState('');
  const [diagnosticCopySuccess, setDiagnosticCopySuccess] = React.useState<boolean | null>(null);
  const [detailsExpanded, setDetailsExpanded] = React.useState(false);
  const diagnosticText = React.useMemo(
    () => buildTimelineCacheDiagnosticText({
      status,
      error,
      selectedProject,
      selectedMilestone,
      webAppUrl,
      timelineSyncRuleUrl,
    }),
    [error, selectedMilestone, selectedProject, status, timelineSyncRuleUrl, webAppUrl],
  );
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
  const handleCopyDiagnostic = React.useCallback(async () => {
    if (!diagnosticText.trim()) {
      return;
    }

    setDiagnosticCopyText('');
    setDiagnosticCopySuccess(null);

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('clipboard_unavailable');
      }

      await navigator.clipboard.writeText(diagnosticText);
      setDiagnosticCopyText('已复制 Timeline 缓存诊断到本机剪贴板；没有刷新缓存、没有写 Timeline 缓存，也没有保存或发送消息。');
      setDiagnosticCopySuccess(true);
    } catch (copyError: any) {
      const reason = copyError?.message || 'clipboard_unavailable';
      setDiagnosticCopyText(`复制诊断失败：${reason}。没有刷新缓存、没有写 Timeline 缓存，也没有保存或发送消息。`);
      setDiagnosticCopySuccess(false);
    }
  }, [diagnosticText]);

  React.useEffect(() => {
    setDryRunResultText('');
    setDryRunResultSuccess(null);
  }, [dryRunHelp?.url, dryRunHelp?.customBody]);

  React.useEffect(() => {
    setDiagnosticCopyText('');
    setDiagnosticCopySuccess(null);
  }, [diagnosticText]);

  const detailLines: string[] = [
    scopeReceiptText,
    isLoading
      ? '正在检查缓存状态...'
      : error
        ? `读取失败：${error}`
        : selectedStatus
          ? getTimelineCacheProjectStatusHeadline({
            status: selectedStatus,
            selectedMilestone,
          })
          : selectedProjectMissingFromStatus
            ? `${selectedProject}: 当前 App Script 未返回该项目状态`
            : hasStatus
              ? `已同步 ${status?.readyProjects || 0}/${status?.totalProjects || 0} 个项目`
              : '尚未读取缓存状态',
    selectedStatus?.status === 'ready' && !selectedMilestoneMissing
      ? `更新于 ${formatTimelineCacheAge(selectedStatus.ageMs)}${milestonePreview ? `，包含 ${milestonePreview}` : ''}`
      : '',
    selectedMilestoneMissing && !isLoading && !error
      ? `当前缓存包含 ${formatTimelineMilestoneKeys(selectedMilestoneKeys)}。请同步后刷新，或改选已有 Milestone。`
      : '',
    selectedStatus && selectedStatus.status !== 'ready' && !isLoading && !error
      ? getTimelineCacheStatusActionText(selectedStatus.status)
      : '',
    lastAttemptFailureText && !isLoading && !error
      ? `${lastAttemptFailureText}${selectedStatus?.status === 'ready' ? '，当前仍使用已有缓存。' : ''}`
      : '',
    lastAttemptQuickFixText && !isLoading && !error
      ? `下一步：${lastAttemptQuickFixText}`
      : '',
    selectedProjectMissingFromStatus && !isLoading && !error
      ? '请更新 App Script 并重新配置 Timeline Sync Rule，让项目清单与扩展保持一致。'
      : '',
    executionImpactText ? `执行影响：${executionImpactText}` : '',
    status && !selectedStatus && !error
      ? `缺失 ${status.missingProjects} 个，异常或过期 ${status.staleProjects} 个。`
      : '',
    shouldShowRefreshAfterRuleHint
      ? '在 Jira 里完成同步或修复后，回到这里点击“刷新状态”确认缓存已生效。'
      : '',
  ].filter((line): line is string => Boolean(line));
  const detailTooltip = detailLines.join('\n');
  const shouldShowInfoButton = Boolean(
    detailLines.length > 0 &&
    !isLoading &&
    (!cacheAvailable || hasSyncWarning || selectedMilestoneMissing || selectedProjectMissingFromStatus || error || executionImpactText),
  );

  React.useEffect(() => {
    setDetailsExpanded(false);
  }, [compactStatusText, detailTooltip]);

  return (
    <div style={{
      padding: '12px',
      backgroundColor: statusBg,
      borderRadius: '6px',
      border: `1px solid ${statusBorder}`,
      marginBottom: '16px',
    }} role="status" aria-live="polite">
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0}}>
          <strong style={{fontSize: '13px', color: statusColor, whiteSpace: 'nowrap'}}>Timeline 缓存状态</strong>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: '28px',
            padding: '4px 9px',
            backgroundColor: '#fff',
            border: `1px solid ${statusBorder}`,
            borderRadius: '999px',
            color: statusColor,
            fontSize: '13px',
            fontWeight: 700,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}>
            {compactStatusText}
          </span>
          {shouldShowInfoButton && (
            <button
              type="button"
              aria-label="查看 Timeline 缓存原因"
              aria-expanded={detailsExpanded}
              onClick={() => setDetailsExpanded((current) => !current)}
              title={detailTooltip}
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                border: `1px solid ${statusBorder}`,
                backgroundColor: '#fff',
                color: statusColor,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 700,
                lineHeight: '24px',
                padding: 0,
              }}
            >
              i
            </button>
          )}
        </div>
        <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end'}}>
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
      {detailsExpanded && shouldShowInfoButton && (
        <div style={{
          marginTop: '10px',
          padding: '8px 10px',
          backgroundColor: '#fff',
          border: `1px solid ${statusBorder}`,
          borderRadius: '6px',
          color: statusColor,
          fontSize: '12px',
          lineHeight: 1.5,
        }}>
          {detailLines.map((line, index) => (
            <div key={`${index}-${line}`} style={{marginTop: index === 0 ? 0 : '4px'}}>
              {line}
            </div>
          ))}
          <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px'}}>
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
              onClick={handleCopyDiagnostic}
              title="复制当前 Timeline 缓存诊断；只写本机剪贴板"
              style={{
                padding: '6px 10px',
                backgroundColor: '#fff',
                color: '#5c4b00',
                border: '1px solid #d6b656',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                whiteSpace: 'nowrap',
              }}
            >
              复制诊断
            </button>
          </div>
        </div>
      )}
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
      {diagnosticCopyText && (
        <div style={{
          marginTop: '10px',
          padding: '8px 10px',
          backgroundColor: diagnosticCopySuccess ? '#f0fff4' : '#fff5f5',
          color: diagnosticCopySuccess ? '#0f5132' : '#842029',
          border: `1px solid ${diagnosticCopySuccess ? '#badbcc' : '#f5c2c7'}`,
          borderRadius: '4px',
          fontSize: '12px',
          lineHeight: 1.5,
        }}>
          {diagnosticCopyText}
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
  outreachConfigLoadError?: string;
  agentTaskOpenClawConfigured: boolean;
  agentTaskOpenClawCheckLoaded: boolean;
  agentTaskOpenClawMissingReason?: string;
  agentExecutors: AgentExecutorOption[];
  agentTaskDefaultExecutor: string;
  onRefreshAgentExecutors: () => void | Promise<void>;
  ringCentralSenderConfigured: boolean;
  onConfigureBot: (mode?: BotConfigDialogMode) => void;
  onConfigureRingCentralSender: () => void;
  onConfigureOutreach: () => void;
  onConfigureOpenClaw: () => void;
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
  outreachConfigLoadError,
  agentTaskOpenClawConfigured,
  agentTaskOpenClawCheckLoaded,
  agentTaskOpenClawMissingReason,
  agentExecutors,
  agentTaskDefaultExecutor,
  onRefreshAgentExecutors,
  ringCentralSenderConfigured,
  onConfigureBot,
  onConfigureRingCentralSender,
  onConfigureOutreach,
  onConfigureOpenClaw,
  dialogMode = 'default',
  currentUsername = '',
  availableCategories,
  editingMessage = null,
  existingMessages,
}) => {
  const isEditMode = !!editingMessage;
  const isReminderMode = dialogMode === 'reminder';
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
        Content: editingMessage.Content || (editingMessage as ScheduledMessage & { Agent_Task_Prompt?: string }).Agent_Task_Prompt || (editingMessage as ScheduledMessage & { Outreach_Question?: string }).Outreach_Question || '',
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
        Agent_Task_ID: editingMessage.Agent_Task_ID,
        Agent_Mode: editingMessage.Agent_Mode === 'write' ? 'write' : 'read',
        Agent_Executor: editingMessage.Agent_Executor || '',
        Agent_Notify_Template: editingMessage.Agent_Notify_Template,
        Agent_Notify_Success_Receipt: editingMessage.Agent_Notify_Success_Receipt,
        Agent_Notify_Via: editingMessage.Agent_Notify_Via,
        Agent_Trigger_Source: editingMessage.Agent_Trigger_Source || 'jira_rule',
        Agent_AR_Binding_ID: editingMessage.Agent_AR_Binding_ID,
        Agent_Last_Run_At: editingMessage.Agent_Last_Run_At,
        Agent_Last_Status: editingMessage.Agent_Last_Status,
        Agent_Last_Result: editingMessage.Agent_Last_Result,
        Agent_Last_Error: editingMessage.Agent_Last_Error,
        Category: editingMessage.Category,
        Automation_Link: editingMessage.Automation_Link,
      };
    }
    return {
      Topic: '',
      Content: '',
      Schedule_Date: getTodayLocalScheduleDate(),
      Schedule_Time: '',
      Push_Method: 'AsMe',
      Target_Type: 'private',
      Glip_User_Name: '',
      Glip_Team_ID: '',
      Outreach_Target_Type: 'private',
      Outreach_Target_Ref: '',
      Outreach_Result: '',
      Outreach_Context: '',
      Outreach_Max_Followup: 2,
      Outreach_Followup_Interval_Hours: 24,
      Agent_Executor: '',
      Agent_Mode: 'read',
      Agent_Trigger_Source: 'jira_rule',
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
  const isOutreachMode = formData.Push_Method === 'Outreach';
  const isAgentTaskMode = isAgentTaskPushMethod(formData.Push_Method);
  const agentTaskLikelyWrites = /(?:\b(?:create|update|edit|delete|set|sync|assign|move|close|reopen|send|post|publish|merge|deploy)\b|创建|修改|更新|删除|设置|同步|写入|指派|移动|关闭|重开|发送|发布|合并|部署)/i.test(formData.Content || '');
  const resolvedAgentExecutorId = resolveAgentTaskExecutorSelection({
    savedId: formData.Agent_Executor,
    defaultId: agentTaskDefaultExecutor,
    executors: agentExecutors,
  });
  React.useEffect(() => {
    if (!isAgentTaskMode || !agentExecutors.length) return;
    if (formData.Agent_Executor === resolvedAgentExecutorId) return;
    setFormData((prev) => {
      const nextId = resolveAgentTaskExecutorSelection({
        savedId: prev.Agent_Executor,
        defaultId: agentTaskDefaultExecutor,
        executors: agentExecutors,
      });
      if (prev.Agent_Executor === nextId) return prev;
      return { ...prev, Agent_Executor: nextId };
    });
  }, [
    isAgentTaskMode,
    agentExecutors,
    agentTaskDefaultExecutor,
    formData.Agent_Executor,
    resolvedAgentExecutorId,
  ]);
  const [agentResultNotifyEnabled, setAgentResultNotifyEnabled] = useState(() => {
    if (!editingMessage || !isAgentTaskMessage(editingMessage)) return false;
    return Boolean(
      editingMessage.Glip_Team_ID?.trim() ||
      editingMessage.Glip_User_Name?.trim()
    );
  });
  const [agentSuccessReceipt, setAgentSuccessReceipt] = useState(() => {
    if (!editingMessage) return true;
    return String(editingMessage.Agent_Notify_Success_Receipt || 'Y').trim().toUpperCase() !== 'N';
  });
  const [agentNotifyVia, setAgentNotifyVia] = useState<'bot' | 'asme'>(() => {
    if (!editingMessage) return 'bot';
    return String(editingMessage.Agent_Notify_Via || 'bot').trim().toLowerCase() === 'asme'
      ? 'asme'
      : 'bot';
  });
  const [scheduleQueueSuggestionReceipt, setScheduleQueueSuggestionReceipt] =
    useState<ScheduleQueueDraftSuggestionReceipt | null>(null);
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
        outputs: { noduedate: false, overdue: false, toTest: false, tickets: true },
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
        outputs: { noduedate: false, overdue: false, toTest: false, tickets: true },
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
  const [customOutputDraftReceipt, setCustomOutputDraftReceipt] = useState<{
    title: string;
    detail: string;
    boundary: string;
  } | null>(null);
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

  const getCustomOutputDraftLabel = (
    output: { name?: string; prompt?: string },
    index: number,
  ): string => output.name?.trim() || `自定义版块 ${index + 1}`;

  const buildCustomOutputEditDraftBoundary = (
    output: { name?: string; prompt?: string },
    index: number,
  ): string => [
    `编辑本地自定义版块草稿「${getCustomOutputDraftLabel(output, index)}」。`,
    '点击只打开当前弹窗里的版块草稿，不会写 Messages、保存 AI_Body、发送消息、改 Logs 或删除已保存计划。',
    '只有保存整个定时消息后才会写入 Sheet。',
  ].join('');

  const buildCustomOutputDeleteDraftBoundary = (
    output: { name?: string; prompt?: string },
    index: number,
  ): string => [
    `删除本地自定义版块草稿「${getCustomOutputDraftLabel(output, index)}」。`,
    '点击只从当前表单草稿移除，尚未写 Messages、保存 AI_Body、发送消息或改 Logs。',
    '不会删除已保存的定时消息、历史发送记录或外部系统内容。',
  ].join('');

  const addCustomOutputDraftBoundary = [
    '添加本地自定义版块草稿。',
    '点击只打开版块编辑弹窗，不会写 Messages、保存 AI_Body、发送消息、改 Logs 或创建计划。',
    '只有保存整个定时消息后才会写入 Sheet。',
  ].join('');
  
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
          outputs: 'tickets',
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
    if (formData.Push_Method !== 'Outreach' && !formData.Topic) {
      alert('请填写消息主题');
      return;
    }

    if (scheduleTimeError) {
      alert(scheduleTimeError);
      return;
    }

    if (executionRouteBlockReason) {
      alert(`${executionRouteBlockReason}\n\n请先完成发送配置后再保存。`);
      return;
    }

    if (agentTaskOpenClawBlockReason) {
      alert(`${agentTaskOpenClawBlockReason}\n\n请先完成 Agent 执行器配置后再保存。`);
      return;
    }
    if (isAgentTaskMode && !resolvedAgentExecutorId) {
      alert('请选择 Agent 执行器后再保存。');
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
    if (formData.Push_Method === 'AgentTask') {
      if (!botConfigured) {
        alert('帮我做依赖 Jira executor rule 到期触发 memory-service，请先配置 Bot 推送规则。');
        return;
      }

      if (!formData.Content?.trim()) {
        alert('请填写希望 AI 帮你执行的任务描述');
        return;
      }

      if (agentResultNotifyEnabled) {
        if (formData.Target_Type === 'private' && userTags.length === 0) {
          alert('请填写结果通知接收人');
          return;
        }
        if (formData.Target_Type === 'group' && !formData.Glip_Team_ID?.trim()) {
          alert('请填写结果通知群组 ID');
          return;
        }
        if (agentNotifyVia === 'asme' && !ringCentralSenderConfigured) {
          alert('以本人身份发送结果通知需要先配置 AsMe 的 RingCentral sender（与顶部 AsMe 发消息 tab 同一套 Client ID / Secret / JWT）。');
          return;
        }
      }

    } else if (formData.Push_Method === 'Outreach') {
      if (outreachConfigLoadError) {
        alert(`无法验证主动询问配置：${outreachConfigLoadError}。这不代表 RingCentral 未配置；请恢复 Memory Service 访问后重试。`);
        return;
      }

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
    const agentTaskRecipientTagsForSave = userTags;
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
        : formData.Push_Method === 'AgentTask'
          ? (formData.Content || '').trim()
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
        : formData.Push_Method === 'AgentTask'
          ? (
              agentResultNotifyEnabled
                ? (
                    formData.Target_Type === 'group'
                      ? undefined
                      : formatUserName.joinForStorage(agentTaskRecipientTagsForSave.slice(0, 1))
                  )
                : undefined
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
        : formData.Push_Method === 'AgentTask'
          ? (
              agentResultNotifyEnabled && formData.Target_Type === 'group'
                ? formData.Glip_Team_ID?.trim()
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
      Automation_Link: resolveAutomationLinkForSave({
        pushMethod: formData.Push_Method,
        formLink: formData.Automation_Link,
        existingLink: isEditMode ? editingMessage?.Automation_Link : undefined,
      }),
      ...repeatFields,
      Schedule_Date: isTimelineTrigger ? '' : formData.Schedule_Date,
      Timeline_Project: timelineProjectForSave,
      Timeline_Milestone: isTimelineTrigger ? formData.Timeline_Milestone : undefined,
      Timeline_Offset: isTimelineTrigger ? normalizedTimelineOffset : undefined,
      Category: categoryTags.length > 0 ? categoryTags.map(t => t.value).join(',') : undefined,
      Agent_Task_ID: formData.Push_Method === 'AgentTask'
        ? formData.Agent_Task_ID || `agent_task_${Date.now()}`
        : undefined,
      Agent_Mode: formData.Push_Method === 'AgentTask'
        ? (formData.Agent_Mode === 'write' ? 'write' : 'read')
        : undefined,
      Agent_Executor: formData.Push_Method === 'AgentTask'
        ? resolveAgentTaskExecutorSelection({
            savedId: formData.Agent_Executor,
            defaultId: agentTaskDefaultExecutor,
            executors: agentExecutors,
          })
        : undefined,
      Agent_Notify_Template: formData.Push_Method === 'AgentTask'
        ? formData.Agent_Notify_Template?.trim()
        : undefined,
      Agent_Notify_Success_Receipt: formData.Push_Method === 'AgentTask'
        ? (agentSuccessReceipt ? 'Y' : 'N')
        : undefined,
      Agent_Notify_Via: formData.Push_Method === 'AgentTask'
        ? (agentNotifyVia === 'asme' ? 'asme' : 'bot')
        : undefined,
      Agent_Trigger_Source: formData.Push_Method === 'AgentTask'
        ? 'jira_rule'
        : undefined,
      Agent_AR_Binding_ID: formData.Push_Method === 'AgentTask'
        ? formData.Agent_AR_Binding_ID
        : undefined,
    };
    
    onSubmit(finalFormData);
  };
  
  const handleChange = (
    field: keyof CreateMessageFormData,
    value: any,
    options: { preserveScheduleSuggestionReceipt?: boolean } = {},
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (
      !options.preserveScheduleSuggestionReceipt &&
      (
        field === 'Schedule_Date' ||
        field === 'Schedule_Time' ||
        field === 'Push_Method' ||
        field === 'AI_Endpoint' ||
        field === 'Repeat_Every' ||
        field === 'Repeat_Unit' ||
        field === 'Repeat_Count' ||
        field === 'Repeat_Days' ||
        field === 'End_Date'
      )
    ) {
      setScheduleQueueSuggestionReceipt(null);
    }
  };

  const handlePushMethodTabClick = (method: CreateMessageFormData['Push_Method']) => {
    setFormData((prev) => {
      const next: CreateMessageFormData = { ...prev, Push_Method: method };
      if (method === 'Outreach') {
        next.Target_Type = 'private';
        if (!next.Outreach_Target_Type) next.Outreach_Target_Type = 'private';
        if (next.Outreach_Max_Followup === undefined) next.Outreach_Max_Followup = 2;
        if (next.Outreach_Followup_Interval_Hours === undefined) {
          next.Outreach_Followup_Interval_Hours = 24;
        }
      } else if (method === 'AgentTask') {
        next.Agent_Executor = resolveAgentTaskExecutorSelection({
          savedId: next.Agent_Executor,
          defaultId: agentTaskDefaultExecutor,
          executors: agentExecutors,
        });
        next.Agent_Trigger_Source = 'jira_rule';
      }
      return next;
    });
    setScheduleQueueSuggestionReceipt(null);
  };

  const handleScheduleDateChange = (
    dateStr: string,
    options: { preserveScheduleSuggestionReceipt?: boolean } = {},
  ) => {
    handleChange('Schedule_Date', dateStr, options);
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

  const getDraftSuggestionLaneSummary = (
    suggestion: Pick<RescheduleNoticeInput, 'label'> & {
      dateStr: string;
      timeStr: string;
    },
  ): string => {
    if (!scheduleQueueDraftMessage) {
      return '';
    }

    return formatExecutionLaneSummary(getScheduledMessageExecutionLaneReceipt({
      ...scheduleQueueDraftMessage,
      Schedule_Date: suggestion.dateStr,
      Schedule_Time: suggestion.timeStr,
    }, {
      botConfigured,
      ringCentralSenderConfigured,
      outreachEnabled,
      outreachConfigured,
    }));
  };

  const applyScheduleQueueSuggestion = () => {
    if (!scheduleQueueSuggestion) {
      return;
    }

    handleScheduleDateChange(scheduleQueueSuggestion.dateStr, {
      preserveScheduleSuggestionReceipt: true,
    });
    handleChange('Schedule_Time', scheduleQueueSuggestion.timeStr, {
      preserveScheduleSuggestionReceipt: true,
    });
    setScheduleQueueSuggestionReceipt({
      label: scheduleQueueSuggestion.label,
      reason: scheduleQueueSuggestion.reason,
      clearsScheduleTime: scheduleQueueSuggestion.clearsScheduleTime,
      executionLaneSummary: getDraftSuggestionLaneSummary(scheduleQueueSuggestion),
    });
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

  const hasScheduleWarning = Boolean(
    scheduleBlockReason ||
    scheduleQueueBlockReason ||
    hasScheduleQueueBlockingRisk(scheduleQueuePressure),
  );
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
  const executionRouteSetupAction = useMemo(() => {
    if (executionRoute.state !== 'needs_setup') {
      return null;
    }

    if (
      formData.Push_Method === 'Bot' ||
      formData.Push_Method === 'AI' ||
      formData.Push_Method === 'AgentTask' ||
      formData.Push_Method === 'JiraAutomation' ||
      (formData.Push_Method === 'AsMe' && ringCentralSenderConfigured)
    ) {
      return {
        label: botConfigured ? '修复 Bot 执行规则' : '配置 Bot 执行规则',
        onClick: () => onConfigureBot(botConfigured ? 'repair' : 'create'),
      };
    }

    if (formData.Push_Method === 'Outreach') {
      return {
        label: '前往主动询问配置',
        onClick: onConfigureOutreach,
      };
    }

    return null;
  }, [
    botConfigured,
    executionRoute.state,
    formData.Push_Method,
    onConfigureBot,
    onConfigureOutreach,
    ringCentralSenderConfigured,
  ]);
  const executionRouteBlockReason = executionRoute.state === 'needs_setup'
    ? `发送配置未完成：${executionRoute.detail}`
    : '';
  const agentTaskOpenClawBlockReason = isAgentTaskMode
    ? agentTaskOpenClawCheckLoaded
      ? (agentTaskOpenClawConfigured
          ? (resolvedAgentExecutorId ? '' : '请选择 Agent 执行器。')
          : agentTaskOpenClawMissingReason || '尚未配置 Agent 执行器，帮我做任务到期后无法执行。')
      : '正在检查 Agent 执行器，请稍候。'
    : '';
  const outreachGateActive = isOutreachMode && !(outreachEnabled && outreachConfigured);
  const outreachReadinessUnknown = isOutreachMode && Boolean(outreachConfigLoadError);
  const agentTaskBotGateActive = isAgentTaskMode && !botConfigured;
  const shouldShowExecutionSetupWarning = Boolean(executionRouteBlockReason);
  const isSubmitBlockedByExecutionRoute = Boolean(executionRouteBlockReason);
  const isSubmitBlockedByAgentTaskOpenClaw = Boolean(agentTaskOpenClawBlockReason);
  const isSubmitBlockedByOutreachGate = outreachGateActive;
  const isSubmitBlockedByAgentTaskBotGate = agentTaskBotGateActive;
  const isSubmitBlockedBySchedule = Boolean(scheduleTimeError || scheduleBlockReason || scheduleQueueBlockReason);
  const isSubmitBlocked = isSubmitBlockedBySchedule ||
    isSubmitBlockedByExecutionRoute ||
    isSubmitBlockedByAgentTaskOpenClaw ||
    isSubmitBlockedByOutreachGate ||
    isSubmitBlockedByAgentTaskBotGate;
  const submitBlockedTitle = isSubmitBlockedByExecutionRoute
    ? executionRouteBlockReason
    : isSubmitBlockedByAgentTaskOpenClaw
      ? agentTaskOpenClawBlockReason
    : outreachReadinessUnknown
      ? '无法验证主动询问配置；请恢复 Memory Service 访问后重试。'
    : isSubmitBlockedByOutreachGate
      ? '主动询问前置配置尚未完成，请先补齐后再保存。'
    : isSubmitBlockedByAgentTaskBotGate
      ? '帮我做依赖 Bot executor rule，请先配置 Bot 推送规则。'
    : isSubmitBlockedBySchedule
      ? '请先修正执行时间或队列风险'
      : undefined;

  const agentNotifyTargetLabel = React.useMemo(() => {
    if (formData.Target_Type === 'group') {
      const id = formData.Glip_Team_ID?.trim() || '（未填写群组 ID）';
      return `群组 ${id}`;
    }
    const name = userTags[0]?.trim() || formatUserName.joinForStorage(userTags.slice(0, 1)).trim() || '（未填写接收人）';
    return `私发 ${name}`;
  }, [formData.Target_Type, formData.Glip_Team_ID, userTags]);

  const agentNotifyPreview = React.useMemo(() => {
    if (!isAgentTaskMode) {
      return { successSilent: false, successLine: '', failLine: '' };
    }
    const hasTemplate = Boolean(formData.Agent_Notify_Template?.trim());
    const normalizedCurrentUsername = currentUsername.trim().toLowerCase();
    const normalizedTarget = formatUserName.joinForStorage(userTags.slice(0, 1)).trim().toLowerCase();
    const isSelf = agentResultNotifyEnabled &&
      formData.Target_Type === 'private' &&
      Boolean(normalizedCurrentUsername) &&
      (
        normalizedTarget === normalizedCurrentUsername ||
        normalizedTarget === 'user' ||
        normalizedTarget === 'me' ||
        normalizedTarget === 'self'
      );
    const failLine = 'Bot 私发失败回执给我（始终，不发到通知目标）';
    const resultIdentity = agentNotifyVia === 'asme' ? '以本人身份（AsMe）' : '由 Bot（SM AI）';
    let successLine = '';
    let successSilent = false;
    if (agentResultNotifyEnabled && agentSuccessReceipt) {
      successLine = isSelf
        ? `${resultIdentity}把成功结果发到 ${agentNotifyTargetLabel}（即本人）${hasTemplate ? '（按模板整理）' : ''}——与成功回执合并为一条，不重复发送`
        : `${resultIdentity}把成功结果发到 ${agentNotifyTargetLabel}${hasTemplate ? '（按模板整理）' : ''} + Bot 私发成功回执给我`;
    } else if (agentResultNotifyEnabled && !agentSuccessReceipt) {
      successLine = `${resultIdentity}把成功结果发到 ${agentNotifyTargetLabel}${hasTemplate ? '（按模板整理）' : ''}（不私发成功回执）`;
    } else if (!agentResultNotifyEnabled && agentSuccessReceipt) {
      successLine = 'Bot 私发成功回执给我（默认摘要）';
    } else {
      successSilent = true;
      successLine = '⚠️ 静默——不推送任何消息，成功结果只能在列表运行态和 Action Queue 查看';
    }
    return { successSilent, successLine, failLine };
  }, [
    agentNotifyTargetLabel,
    agentNotifyVia,
    agentResultNotifyEnabled,
    agentSuccessReceipt,
    currentUsername,
    formData.Agent_Notify_Template,
    formData.Target_Type,
    isAgentTaskMode,
    userTags,
  ]);
  
  const handleUserTagsChange = (tags: string[]) => {
    setUserTags(tags);
  };

  const outreachTargetRefValue = formData.Outreach_Target_Type === 'group'
    ? (formData.Outreach_Target_Ref || '')
    : formatUserName.joinForStorage(userTags.slice(0, 1));
  const customOutputDialogLabel = customOutputName.trim() || (
    editingCustomOutputIndex !== null
      ? getCustomOutputDraftLabel(
          customOutputs[editingCustomOutputIndex] || {},
          editingCustomOutputIndex,
        )
      : `自定义版块 ${customOutputs.length + 1}`
  );
  const customOutputDialogCancelBoundary = [
    `取消编辑本地自定义版块草稿「${customOutputDialogLabel}」。`,
    '只关闭当前小弹窗，不会写 Messages、保存 AI_Body、发送消息、改 Logs 或删除已保存计划。',
  ].join('');
  const customOutputDialogSaveBoundary = [
    `${editingCustomOutputIndex !== null ? '保存修改到' : '添加'}本地自定义版块草稿「${customOutputDialogLabel}」。`,
    '只更新当前定时消息表单里的草稿，尚未写 Messages、保存 AI_Body、发送消息或改 Logs。',
    '保存整个定时消息后才会写入 Sheet。',
  ].join('');
  const dialogTitleHint = isOutreachMode
    ? '由 memory-service 负责追问与结果整理'
    : isAgentTaskMode
      ? '到期后由 OpenClaw 执行，结果通知单独配置'
      : '';
  
  return (
    <div style={dialogStyles.overlay}>
      <div style={dialogStyles.dialog}>
        <div style={dialogStyles.header}>
          <div style={dialogStyles.titleRow}>
            <h2 style={dialogStyles.title}>
              {isEditMode
                ? (isOutreachMode ? '✏️ 编辑主动询问计划' : isAgentTaskMode ? '✏️ 编辑帮我做任务' : '✏️ 编辑定时消息')
                : isReminderMode
                  ? '⏰ 新增个人提醒'
                  : isOutreachMode
                    ? '💬 新增主动询问'
                    : isAgentTaskMode
                      ? '🧠 新增帮我做'
                    : '➕ 新增定时消息'}
            </h2>
            {dialogTitleHint && (
              <span style={dialogStyles.titleHint}>{dialogTitleHint}</span>
            )}
          </div>
          <button style={dialogStyles.closeButton} onClick={onCancel}>✕</button>
        </div>
        
        <form onSubmit={handleSubmit} style={dialogStyles.form}>
          {isAgentTaskMode && agentTaskOpenClawBlockReason && (
            <div
              style={dialogStyles.executionRouteWarning}
              role={agentTaskOpenClawCheckLoaded ? 'alert' : 'status'}
              aria-live="polite"
            >
              <div style={dialogStyles.executionRouteLabel}>Agent 执行器</div>
              <div style={dialogStyles.executionRouteValue}>
                {agentTaskOpenClawCheckLoaded ? '需要先完成配置' : '正在检查配置'}
              </div>
              <div style={dialogStyles.executionRouteHint}>
                {agentTaskOpenClawBlockReason} 保存前不会写入 Messages，也不会创建可领取的 Agent task。
              </div>
              <div style={dialogStyles.executionRouteActionRow}>
                <span style={dialogStyles.executionRouteBlockText}>
                  请在 Options → Agent 执行器 中添加，配置后可重新检测。
                </span>
                <button
                  type="button"
                  style={dialogStyles.executionRouteActionButton}
                  onClick={onConfigureOpenClaw}
                >
                  前往 Agent 执行器
                </button>
                <button
                  type="button"
                  style={dialogStyles.executionRouteActionButton}
                  onClick={() => { void onRefreshAgentExecutors(); }}
                >
                  重新检测
                </button>
              </div>
            </div>
          )}

          {!isReminderMode && (
            <div style={dialogStyles.methodTabsSection}>
              {formData.Push_Method === 'JiraAutomation' ? (
                <div role="tablist" aria-label="任务类型" style={dialogStyles.methodTabs}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected="true"
                    style={{
                      ...getMethodTabStyle(true),
                      cursor: 'default',
                    }}
                    disabled
                  >
                    🔧 JIRA 自动化
                  </button>
                </div>
              ) : isEditMode && isOutreachMode ? (
                <div role="tablist" aria-label="任务类型" style={dialogStyles.methodTabs}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected="true"
                    style={{
                      ...getMethodTabStyle(true),
                      cursor: 'default',
                    }}
                    disabled
                  >
                    💬 帮我问
                  </button>
                </div>
              ) : isEditMode && isAgentTaskMode ? (
                <div role="tablist" aria-label="任务类型" style={dialogStyles.methodTabs}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected="true"
                    style={{
                      ...getMethodTabStyle(true),
                      cursor: 'default',
                    }}
                    disabled
                  >
                    🧠 帮我做
                  </button>
                </div>
              ) : (
                <div style={dialogStyles.methodTabGroups} role="tablist" aria-label="任务类型">
                  <span style={dialogStyles.methodTabGroupLabelInline}>发消息</span>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={formData.Push_Method === 'AsMe'}
                    style={getMethodTabStyle(formData.Push_Method === 'AsMe')}
                    onClick={() => handlePushMethodTabClick('AsMe')}
                  >
                    👤 AsMe
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={formData.Push_Method === 'Bot'}
                    style={getMethodTabStyle(formData.Push_Method === 'Bot', !botConfigured && formData.Push_Method !== 'Bot')}
                    onClick={() => handlePushMethodTabClick('Bot')}
                    title={!botConfigured ? '可先选择填写草稿；保存前需要配置 Bot。' : 'Bot（机器人）'}
                  >
                    <span>🤖 Bot</span>
                    {!botConfigured && formData.Push_Method !== 'Bot' && (
                      <span style={dialogStyles.methodPreviewBadge}>待配置</span>
                    )}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={formData.Push_Method === 'AI'}
                    style={getMethodTabStyle(formData.Push_Method === 'AI', !botConfigured && formData.Push_Method !== 'AI')}
                    onClick={() => handlePushMethodTabClick('AI')}
                    title={!botConfigured ? '可先选择填写草稿；保存前需要配置 Bot。' : 'AI Report'}
                  >
                    <span>🤖 AI Report</span>
                    {!botConfigured && formData.Push_Method !== 'AI' && (
                      <span style={dialogStyles.methodPreviewBadge}>待配置</span>
                    )}
                  </button>
                  <span style={dialogStyles.methodTabInlineDivider} aria-hidden="true" />
                  <span style={dialogStyles.methodTabGroupLabelInline}>Agent</span>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={formData.Push_Method === 'Outreach'}
                    style={getMethodTabStyle(
                      formData.Push_Method === 'Outreach',
                      !(outreachEnabled && outreachConfigured) && formData.Push_Method !== 'Outreach',
                    )}
                    onClick={() => handlePushMethodTabClick('Outreach')}
                    title={!(outreachEnabled && outreachConfigured)
                      ? '可先选择填写草稿；保存前需要在 Options 启用主动询问并完成 RingCentral 配置。'
                      : '帮我问'}
                  >
                    <span>💬 帮我问</span>
                    {!(outreachEnabled && outreachConfigured) && formData.Push_Method !== 'Outreach' && (
                      <span style={dialogStyles.methodPreviewBadge}>待配置</span>
                    )}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isAgentTaskMode}
                    style={getMethodTabStyle(isAgentTaskMode, !botConfigured && !isAgentTaskMode)}
                    onClick={() => handlePushMethodTabClick('AgentTask')}
                    title={!botConfigured
                      ? '可先选择填写草稿；保存前需要配置 Bot executor rule。'
                      : '帮我做'}
                  >
                    <span>🧠 帮我做</span>
                    {!botConfigured && !isAgentTaskMode && (
                      <span style={dialogStyles.methodPreviewBadge}>待配置</span>
                    )}
                  </button>
                </div>
              )}
              <div style={{ fontSize: '12px', color: '#5d6978', margin: '4px 0 0', lineHeight: 1.6 }}>
                前三类到点「发一条消息」；后两类到点「让 Agent 干活并回报」。编辑已有帮我问 / 帮我做行时 tab 锁定。
              </div>
              {(outreachGateActive || agentTaskBotGateActive) && (
                <div style={dialogStyles.methodSetupNotice} role="alert">
                  <p style={dialogStyles.methodSetupText}>
                    ⚠️ <strong>{outreachReadinessUnknown ? '无法验证配置' : '前置配置待完成'}</strong>——当前 tab 可先填写草稿；保存会被阻止，不会写入 Messages、不会创建 Jira Rule 或同步 runtime。
                    {isAgentTaskMode ? ' 帮我做需要 Bot executor rule + OpenClaw 配置；' : ''}
                    {isOutreachMode
                      ? outreachReadinessUnknown
                        ? ` 帮我问暂时无法读取 Memory Service 配置（${outreachConfigLoadError}）；这不代表 RingCentral 未配置。`
                        : ' 帮我问需要在 Options 启用主动询问并完成 RingCentral 配置。'
                      : ''}
                  </p>
                  {isOutreachMode && (
                    <button
                      type="button"
                      onClick={onConfigureOutreach}
                      style={dialogStyles.methodSetupButton}
                    >
                      前往主动询问配置
                    </button>
                  )}
                  {isAgentTaskMode && !botConfigured && (
                    <button
                      type="button"
                      onClick={() => onConfigureBot()}
                      style={dialogStyles.methodSetupButton}
                    >
                      🔧 配置 Bot 后启用
                    </button>
                  )}
                </div>
              )}
              {!botConfigured && (formData.Push_Method === 'Bot' || formData.Push_Method === 'AI') && (
                <div style={dialogStyles.methodPreviewReceipt} role="status" aria-live="polite">
                  <strong>发送配置待完成</strong>
                  <span>
                    Bot / AI Report 可以先选中填写草稿；保存前会要求完成 Bot 配置，不会写入 Messages、不会发送，也不会创建 Jira Rule。
                  </span>
                </div>
              )}
              {formData.Push_Method === 'Bot' && !botConfigured && (
                <div style={dialogStyles.methodSetupNotice}>
                  <p style={dialogStyles.methodSetupText}>
                    ⚠️ 您还未配置 Bot 推送功能，需要先配置才能使用。
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onConfigureBot();
                    }}
                    style={dialogStyles.methodSetupButton}
                  >
                    🔧 配置 Bot 后启用
                  </button>
                </div>
              )}
              {formData.Push_Method === 'AI' && !botConfigured && (
                <div style={dialogStyles.methodSetupNotice}>
                  <p style={dialogStyles.methodSetupText}>
                    ⚠️ AI Report 功能需要配置 Bot 推送功能才能使用。
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onConfigureBot();
                    }}
                    style={dialogStyles.methodSetupButton}
                  >
                    🔧 配置 Bot 后启用
                  </button>
                </div>
              )}
              {formData.Push_Method === 'AsMe' && !ringCentralSenderConfigured && (
                <div style={dialogStyles.asMeSenderNotice}>
                  <p style={dialogStyles.asMeSenderText}>
                    AsMe 当前会继续使用邮件 fallback。配置 RingCentral sender 后，将由 Jira rule 调内网 Dify 接口发送，可支持 @ 人。
                  </p>
                  <button
                    type="button"
                    onClick={onConfigureRingCentralSender}
                    style={dialogStyles.asMeSenderButton}
                  >
                    🔧 配置 @ 人发送能力
                  </button>
                </div>
              )}
            </div>
          )}

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

          {/* 消息内容（提醒模式始终显示；主动询问使用独立的问题输入框） */}
          {!isOutreachMode && !isAgentTaskMode && !(formData.Push_Method === 'AI' && aiReportTemplate === 'ai-report' && !isReminderMode) && (
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

          {isAgentTaskMode && (
            <div style={{...dialogStyles.section, backgroundColor: '#fafafa', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb'}}>
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>任务描述 *</label>
                <textarea
                  style={dialogStyles.textarea}
                  value={formData.Content || ''}
                  onChange={(event) => handleChange('Content', event.target.value)}
                  onBlur={handleContentBlur}
                  placeholder="例如：查找 RCV Mobile Q2 JQL 数据，整理 issues 总数、异常项和需要跟进的人，并输出简短结论"
                  rows={5}
                />
                <small style={dialogStyles.hint}>
                  这段内容会作为 OpenClaw 执行任务本身（存入 Content 列）；不需要再在这里写「通知到某某群」——推送由下方结果通知配置在拿到结果后完成。
                </small>
              </div>

              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>执行边界</label>
                <div style={dialogStyles.buttonGroup}>
                  <button
                    type="button"
                    style={getButtonStyle((formData.Agent_Mode || 'read') !== 'write')}
                    onClick={() => handleChange('Agent_Mode', 'read')}
                  >
                    只读查询
                  </button>
                  <button
                    type="button"
                    style={getButtonStyle(formData.Agent_Mode === 'write')}
                    onClick={() => handleChange('Agent_Mode', 'write')}
                  >
                    允许外部写入
                  </button>
                </div>
                <small style={dialogStyles.hint}>
                  {agentTaskLikelyWrites && formData.Agent_Mode !== 'write'
                    ? '检测到“同步/更新/设置”等写入意图：如需实际改 Jira、发消息或更新外部数据，请选择“允许外部写入”。未选择时任务按只读执行。'
                    : '默认只读。写入必须由你显式选择；文本识别只给建议，不会自行授予写权限。'}
                </small>
              </div>

              <div style={{...dialogStyles.section, backgroundColor: '#fbfdff', padding: '16px', borderRadius: '8px', border: '1px dashed #b3d7ff', marginBottom: '16px'}}>
                <h3 style={{margin: '0 0 14px 0', fontSize: '15px', fontWeight: 'bold', color: '#111827'}}>
                  📣 结果通知
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <label style={{ position: 'relative', display: 'inline-flex', width: '40px', height: '22px', flexShrink: 0, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={agentResultNotifyEnabled}
                      onChange={(event) => setAgentResultNotifyEnabled(event.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                    />
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '999px',
                        backgroundColor: agentResultNotifyEnabled ? '#0066cc' : '#c3ccd5',
                        transition: 'background-color 0.18s ease',
                      }}
                    />
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        top: '2px',
                        left: agentResultNotifyEnabled ? '20px' : '2px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: '#fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                        transition: 'left 0.18s ease',
                      }}
                    />
                  </label>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>成功结果通知到指定目标</span>
                </div>

                {agentResultNotifyEnabled && (
                  <div style={{ marginTop: '12px', padding: '14px', border: '1px dashed #b3d7ff', borderRadius: '8px', backgroundColor: '#fbfdff' }}>
                    <div style={dialogStyles.formGroup}>
                      <label style={dialogStyles.label}>结果按如下模板通知（可选）</label>
                      <textarea
                        style={dialogStyles.textarea}
                        value={formData.Agent_Notify_Template || ''}
                        onChange={(event) => handleChange('Agent_Notify_Template', event.target.value)}
                        placeholder="例如：用 3 行告诉我：本次结果、需要关注的风险、下一步建议。"
                        rows={3}
                      />
                      <small style={dialogStyles.hint}>
                        填写后成功结果按模板发到下面的通知目标（memory-service 做一次仅格式化的整理再推送）；不改变 OpenClaw 原始结果和 artifact。失败不会发到通知目标。
                      </small>
                    </div>
                    <div style={dialogStyles.formGroup}>
                      <label style={dialogStyles.label}>通知目标 *</label>
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
                    {formData.Target_Type === 'private' && (
                      <div style={dialogStyles.formGroup}>
                        <label style={dialogStyles.label}>接收人 *（只能填一个人名）</label>
                        <TagsInput
                          tags={userTags}
                          onChange={handleUserTagsChange}
                          placeholder="输入人名后按 Enter 或直接移开焦点添加，例如：Esone Qiu 或 esone.qiu"
                          maxTags={1}
                        />
                        <small style={dialogStyles.hint}>复用 Bot 推送的接收人组件（TagsInput，maxTags = 1）。</small>
                      </div>
                    )}
                    {formData.Target_Type === 'group' && (
                      <div style={dialogStyles.formGroup}>
                        <label style={dialogStyles.label}>群组 ID *</label>
                        <input
                          style={dialogStyles.input}
                          type="text"
                          value={formData.Glip_Team_ID || ''}
                          onChange={(event) => handleChange('Glip_Team_ID', event.target.value)}
                          placeholder="例如：148192141318"
                        />
                        <small style={dialogStyles.hint}>
                          复用 Bot 推送的群组组件。群组通知由 SM AI 机器人发出，请先把「SM AI」加到目标群。
                        </small>
                      </div>
                    )}
                    <div style={{ ...dialogStyles.formGroup, marginBottom: 0 }}>
                      <label style={dialogStyles.label}>通知发送身份</label>
                      <div style={dialogStyles.buttonGroup}>
                        <button
                          type="button"
                          style={getButtonStyle(agentNotifyVia === 'bot')}
                          onClick={() => setAgentNotifyVia('bot')}
                        >
                          🤖 Bot（SM AI）
                        </button>
                        <button
                          type="button"
                          style={{
                            ...getButtonStyle(agentNotifyVia === 'asme', !ringCentralSenderConfigured),
                            display: 'inline-flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: '6px',
                            flexWrap: 'nowrap',
                          }}
                          onClick={() => setAgentNotifyVia('asme')}
                          title={
                            ringCentralSenderConfigured
                              ? '成功结果以本人身份发送，使用与顶部 AsMe 发消息 tab 同一套 Sheet RingCentral sender token。回执仍由 Bot 私发。'
                              : '需要先配置 AsMe RingCentral sender（Client ID / Secret / JWT），与顶部 AsMe 发消息 tab 同一套。可先选中预览，保存前需补齐配置。'
                          }
                        >
                          <span>👤 AsMe</span>
                          {!ringCentralSenderConfigured && (
                            <span style={{ ...dialogStyles.methodPreviewBadge, marginTop: 0 }}>
                              可预览 · 待配置
                            </span>
                          )}
                        </button>
                      </div>
                      <small style={dialogStyles.hint}>
                        只影响成功结果通知的投递身份。失败回执和成功回执仍由 Bot 私发。推送由 memory-service 在拿到执行结果后代码层完成
                        {agentNotifyVia === 'asme' ? '（AsMe 走 Sheet RingCentral sender，与顶部 AsMe 发消息 tab 同一套 token）' : '（Bot API）'}
                        。
                        {!ringCentralSenderConfigured && agentNotifyVia === 'asme' && (
                          <>
                            {' '}
                            <button
                              type="button"
                              style={dialogStyles.inlineLinkButton}
                              onClick={onConfigureRingCentralSender}
                            >
                              配置 AsMe RingCentral sender
                            </button>
                          </>
                        )}
                      </small>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={agentSuccessReceipt}
                      onChange={(event) => setAgentSuccessReceipt(event.target.checked)}
                      style={{ marginTop: '2px' }}
                    />
                    <span><strong>成功回执：任务成功时也回执给我</strong>（Bot 私发）</span>
                  </label>
                  <small style={{ ...dialogStyles.hint, marginLeft: '24px', display: 'block' }}>
                    <strong>失败回执始终开启</strong>，不受此开关影响——任务失败一定会 Bot 私发回执给我，失败信息不会发到上面的通知目标。
                  </small>
                </div>

                <div
                  style={{
                    ...dialogStyles.agentNotifyPreview,
                    ...(agentNotifyPreview.successSilent ? dialogStyles.agentNotifyPreviewSilent : {}),
                    marginTop: '14px',
                  }}
                  role="status"
                  aria-live="polite"
                >
                  <strong>通知预览</strong>
                  <div style={{ marginTop: '4px' }}>
                    ✅ 成功时：{agentNotifyPreview.successLine}
                  </div>
                  <div>
                    ❌ 失败时：{agentNotifyPreview.failLine}
                  </div>
                </div>
              </div>

              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>Agent 执行器</label>
                {agentExecutors.length > 0 ? (
                  <div style={dialogStyles.executorChipRow} role="group" aria-label="Agent 执行器">
                    {agentExecutors.map((executor) => {
                      const selected = executor.id === formData.Agent_Executor;
                      const isDefault = executor.id === agentTaskDefaultExecutor;
                      return (
                        <button
                          key={executor.id}
                          type="button"
                          style={getExecutorChipStyle(selected)}
                          onClick={() => handleChange('Agent_Executor', executor.id)}
                          disabled={isSubmitting}
                          aria-pressed={selected}
                        >
                          <span style={dialogStyles.executorChipDot} aria-hidden="true" />
                          {executor.label}
                          {isDefault ? (
                            <span style={dialogStyles.executorChipBadge}>默认</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={dialogStyles.hint}>
                    {agentTaskOpenClawCheckLoaded
                      ? '尚未检测到执行器。'
                      : '正在检测执行器…'}
                  </div>
                )}
                <small style={dialogStyles.hint}>
                  执行器在 Options → Agent 执行器 中管理。新建默认选中 Agent Task 默认执行器，可改成其他实例。
                  {' '}
                  <button
                    type="button"
                    style={dialogStyles.inlineLinkButton}
                    onClick={() => { void onRefreshAgentExecutors(); }}
                  >
                    重新检测
                  </button>
                </small>
              </div>
              <div style={dialogStyles.formRow}>
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>触发入口</label>
                  <input
                    style={dialogStyles.input}
                    type="text"
                    value="jira_rule"
                    disabled
                  />
                  <small style={dialogStyles.hint}>架构兼容未来 memory-service cron / heartbeat 直接触发。</small>
                </div>
              </div>
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
              {!isAgentTaskMode && (
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
              )}
              
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
              {!isAgentTaskMode && (
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
              )}
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
              {shouldShowExecutionSetupWarning && (
                <div style={dialogStyles.executionRouteWarning}>
                  <div style={dialogStyles.executionRouteLabel}>发送配置</div>
                  <div style={dialogStyles.executionRouteValue}>需要先完成配置</div>
                  <div style={dialogStyles.executionRouteHint}>当前发送方式还缺少必要配置，保存前不会写入 Messages 或发送消息。</div>
                  <div style={dialogStyles.executionRouteActionRow}>
                    <span style={dialogStyles.executionRouteBlockText}>请先完成配置后再保存。</span>
                    {executionRouteSetupAction && (
                      <button
                        type="button"
                        style={dialogStyles.executionRouteActionButton}
                        onClick={executionRouteSetupAction.onClick}
                      >
                        {executionRouteSetupAction.label}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {schedulePreviewDisplayValue && (
                <div style={hasScheduleWarning ? dialogStyles.scheduleWarning : dialogStyles.schedulePreview}>
                  <div style={dialogStyles.schedulePreviewLabel}>预计下次执行</div>
                  <div style={dialogStyles.schedulePreviewValue}>{schedulePreviewDisplayValue}</div>
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
                  {scheduleQueueSuggestionReceipt && (
                    <div
                      style={dialogStyles.scheduleSuggestionReceipt}
                      role="status"
                      aria-live="polite"
                    >
                      <div style={dialogStyles.scheduleSuggestionReceiptTitle}>
                        建议时间已应用到草稿
                      </div>
                      <div style={dialogStyles.scheduleSuggestionReceiptDetail}>
                        目标: {scheduleQueueSuggestionReceipt.label}
                      </div>
                      {scheduleQueueSuggestionReceipt.reason && (
                        <div style={dialogStyles.scheduleSuggestionReceiptDetail}>
                          原因: {scheduleQueueSuggestionReceipt.reason}
                        </div>
                      )}
                      {scheduleQueueSuggestionReceipt.executionLaneSummary && (
                        <div style={dialogStyles.scheduleSuggestionReceiptDetail}>
                          写入后: {scheduleQueueSuggestionReceipt.executionLaneSummary}
                        </div>
                      )}
                      <div style={dialogStyles.scheduleSuggestionReceiptDetail}>
                        边界: {scheduleQueueSuggestionReceipt.clearsScheduleTime
                          ? '清空 Schedule_Time，保留 08:00 后队列语义'
                          : '写入本地明确时间'}；这里只更新表单草稿，尚未写入 Messages、不会立即发送，也不会跳过前序消息，保存后才会写入 Sheet。
                      </div>
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

              {shouldShowExecutionSetupWarning && (
                <div style={dialogStyles.executionRouteWarning}>
                  <div style={dialogStyles.executionRouteLabel}>发送配置</div>
                  <div style={dialogStyles.executionRouteValue}>需要先完成配置</div>
                  <div style={dialogStyles.executionRouteHint}>当前发送方式还缺少必要配置，保存前不会写入 Messages 或发送消息。</div>
                  <div style={dialogStyles.executionRouteActionRow}>
                    <span style={dialogStyles.executionRouteBlockText}>请先完成配置后再保存。</span>
                    {executionRouteSetupAction && (
                      <button
                        type="button"
                        style={dialogStyles.executionRouteActionButton}
                        onClick={executionRouteSetupAction.onClick}
                      >
                        {executionRouteSetupAction.label}
                      </button>
                    )}
                  </div>
                </div>
              )}
              
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
                {isAgentTaskMode ? '重复执行' : '是否重复推送'}
              </label>
              {isAgentTaskMode && (
                <small style={dialogStyles.hint}>
                  不勾选时执行一次后标记 Done；勾选后按重复规则继续计算 Next_Exec。非重复 AR 替换仍只保存在 AR binding/result，不进入 Messages 列表。
                </small>
              )}
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
          {!isReminderMode && formData.Push_Method !== 'Outreach' && (
            <>
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
                              title={buildCustomOutputEditDraftBoundary(output, index)}
                              aria-label={buildCustomOutputEditDraftBoundary(output, index)}
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
                              title={buildCustomOutputDeleteDraftBoundary(output, index)}
                              aria-label={buildCustomOutputDeleteDraftBoundary(output, index)}
                              onClick={() => {
                                const draftLabel = getCustomOutputDraftLabel(output, index);
                                setCustomOutputs(customOutputs.filter((_, i) => i !== index));
                                setCustomOutputDraftReceipt({
                                  title: '自定义版块草稿已移除',
                                  detail: `已从当前表单草稿移除「${draftLabel}」。`,
                                  boundary: '尚未写入 Messages / AI_Body；不会删除已保存消息、历史 Logs 或外部系统内容。',
                                });
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
                        title={addCustomOutputDraftBoundary}
                        aria-label={addCustomOutputDraftBoundary}
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

                      {customOutputDraftReceipt && (
                        <div
                          role="status"
                          aria-live="polite"
                          aria-label={`${customOutputDraftReceipt.title}：${customOutputDraftReceipt.detail}${customOutputDraftReceipt.boundary}`}
                          style={{
                            marginTop: '10px',
                            padding: '10px 12px',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            backgroundColor: '#eff6ff',
                            color: '#1e3a8a',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            fontSize: '13px',
                            lineHeight: 1.45,
                          }}
                        >
                          <strong>{customOutputDraftReceipt.title}</strong>
                          <span>{customOutputDraftReceipt.detail}</span>
                          <small>{customOutputDraftReceipt.boundary}</small>
                        </div>
                      )}
                      
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
                            title={customOutputDialogCancelBoundary}
                            aria-label={customOutputDialogCancelBoundary}
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
                            title={customOutputDialogSaveBoundary}
                            aria-label={customOutputDialogSaveBoundary}
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
                                setCustomOutputDraftReceipt({
                                  title: '自定义版块草稿已更新',
                                  detail: `「${getCustomOutputDraftLabel(newOutput, editingCustomOutputIndex)}」只更新当前表单草稿。`,
                                  boundary: '尚未写入 Messages / AI_Body；不会发送消息、改 Logs 或删除已保存计划。',
                                });
                              } else {
                                // 添加模式
                                setCustomOutputs([...customOutputs, newOutput]);
                                setCustomOutputDraftReceipt({
                                  title: '自定义版块草稿已添加',
                                  detail: `「${getCustomOutputDraftLabel(newOutput, customOutputs.length)}」只添加到当前表单草稿。`,
                                  boundary: '尚未写入 Messages / AI_Body；不会发送消息、改 Logs 或创建计划。',
                                });
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
          
          {/* 推送目标（AgentTask 由结果通知面板负责，不在此显示） */}
          {formData.Push_Method !== 'AI' &&
            formData.Push_Method !== 'JiraAutomation' &&
            formData.Push_Method !== 'Outreach' &&
            formData.Push_Method !== 'AgentTask' && (
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
                    maxTags={formData.Push_Method === 'Bot' || formData.Push_Method === 'AgentTask' ? 1 : undefined}
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
                  {formData.Push_Method === 'Bot' && (
                    <div
                      style={dialogStyles.methodPreviewReceipt}
                      role="status"
                      aria-live="polite"
                    >
                      <strong>群组 Bot 前置条件</strong>
                      <span>
                        Bot 群组消息会由 SM AI 机器人发出。请先把 “SM AI” 加到目标群；未加人时保存仍可写入 Messages，但到点推送会失败。私发不需要加群。
                      </span>
                    </div>
                  )}
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
              disabled={isSubmitting || isSubmitBlocked}
              title={submitBlockedTitle}
            >
              {isSubmitting
                ? (isEditMode ? '保存中...' : '创建中...')
                : isSubmitBlockedByExecutionRoute
                  ? '先完成配置'
                  : isSubmitBlockedByAgentTaskOpenClaw
                    ? '先配置 OpenClaw'
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
const getButtonStyle = (isSelected: boolean, isPreviewOnly = false): React.CSSProperties => ({
  flex: 1,
  padding: '10px 16px',
  backgroundColor: isPreviewOnly ? '#fff8e6' : (isSelected ? '#007bff' : '#fff'),
  color: isPreviewOnly ? '#8a4b00' : (isSelected ? '#fff' : '#333'),
  border: `2px solid ${isPreviewOnly ? '#f0c36d' : (isSelected ? '#007bff' : '#ddd')}`,
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: isSelected ? 'bold' : 'normal',
  transition: 'all 0.2s',
  opacity: 1,
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '44px',
});

const getExecutorChipStyle = (isSelected: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: '999px',
  border: `1px solid ${isSelected ? '#80bdff' : '#d9e2ef'}`,
  backgroundColor: isSelected ? '#eef6ff' : '#fff',
  color: isSelected ? '#0056b3' : '#334155',
  fontWeight: isSelected ? 700 : 600,
  fontSize: '13px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  lineHeight: 1.25,
});

const getMethodTabStyle = (isSelected: boolean, isPreviewOnly = false): React.CSSProperties => ({
  flex: '1 1 160px',
  minHeight: '36px',
  padding: '6px 10px',
  backgroundColor: isPreviewOnly ? '#fff8e6' : (isSelected ? '#eef6ff' : '#fff'),
  color: isPreviewOnly ? '#8a4b00' : (isSelected ? '#0056b3' : '#334155'),
  border: `1px solid ${isPreviewOnly ? '#f0c36d' : (isSelected ? '#80bdff' : '#d9e2ef')}`,
  borderBottom: isSelected && !isPreviewOnly ? '3px solid #007bff' : `1px solid ${isPreviewOnly ? '#f0c36d' : '#d9e2ef'}`,
  borderRadius: '6px 6px 0 0',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: isSelected ? 700 : 600,
  lineHeight: 1.25,
  transition: 'all 0.2s',
  display: 'inline-flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  whiteSpace: 'nowrap',
  flexShrink: 0,
});

const getTypeStyle = (pushMethod: string): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
  };

  if (isAgentTaskPushMethod(pushMethod)) {
    return { ...baseStyle, backgroundColor: '#e5e7eb', color: '#111827' }; // 深灰 - 帮我做
  }
  
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
    flex: '1 1 auto',
    minWidth: 0,
  },
  topicTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    maxWidth: '100%',
    minWidth: 0,
  },
  topicStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  topicInlineLinkButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
    width: '22px',
    height: '22px',
    padding: 0,
    backgroundColor: 'transparent',
    color: '#0052cc',
    border: '1px solid transparent',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    lineHeight: 1,
  },
  autoReplyReviewReceipt: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid #ffe0b2',
    backgroundColor: '#fff8e1',
    color: '#6d4c00',
    fontSize: '11px',
    lineHeight: 1.4,
    whiteSpace: 'normal',
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
  updateAvailableToast: {
    backgroundColor: '#fff3cd',
    borderLeft: '4px solid #ffc107',
    borderBottom: '1px solid #ffc107',
    padding: '8px 20px',
    color: '#856404',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    fontSize: '13px',
    fontWeight: 600,
    lineHeight: 1.35,
    animation: 'slideDown 0.3s ease-out',
  },
  updateToastAction: {
    padding: '6px 12px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
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
  secondaryUpdateErrorButton: {
    padding: '8px 14px',
    backgroundColor: '#fff',
    color: '#991b1b',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
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
  configSyncBanner: {
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    borderBottom: '1px solid #e5e7eb',
    animation: 'slideDown 0.3s ease-out',
  },
  configSyncBannerSuccess: {
    backgroundColor: '#ecfdf5',
    borderLeft: '4px solid #10b981',
  },
  configSyncBannerInfo: {
    backgroundColor: '#eff6ff',
    borderLeft: '4px solid #3b82f6',
  },
  configSyncBannerWarning: {
    backgroundColor: '#fffbeb',
    borderLeft: '4px solid #f59e0b',
  },
  configSyncBannerError: {
    backgroundColor: '#fef2f2',
    borderLeft: '4px solid #ef4444',
  },
  configSyncDescription: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#374151',
    lineHeight: 1.45,
  },
  configSyncMetaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px 10px',
    marginTop: '8px',
  },
  configSyncMetaItem: {
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    color: '#334155',
    fontSize: '12px',
    lineHeight: 1.35,
    maxWidth: '100%',
    overflowWrap: 'anywhere',
    textAlign: 'left',
  },
  configSyncDismissButton: {
    border: '1px solid rgba(100, 116, 139, 0.28)',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    color: '#475569',
    borderRadius: '6px',
    width: '28px',
    height: '28px',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: '20px',
    flex: '0 0 auto',
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
  updateProofReceipt: {
    marginTop: '10px',
    padding: '8px 10px',
    backgroundColor: '#fff',
    border: '1px solid #fdba74',
    borderRadius: '6px',
    color: '#7c2d12',
    fontSize: '12px',
    lineHeight: 1.45,
    maxWidth: '720px',
  },
  updateErrorDescription: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#991b1b',
  },
  queueSummaryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    flexWrap: 'wrap',
  },
  queueDetailsToggleButton: {
    padding: '3px 8px',
    backgroundColor: '#fff',
    color: '#0b4f8a',
    border: '1px solid #93c5fd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
    lineHeight: 1.3,
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
  queueBoundaryDescription: {
    margin: '6px 0 0 0',
    fontSize: '12px',
    color: '#7c2d12',
    lineHeight: 1.45,
  },
  queueDetailsReceipt: {
    marginTop: '8px',
    padding: '7px 9px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    border: '1px solid rgba(251, 146, 60, 0.45)',
    color: '#7c2d12',
    fontSize: '12px',
    fontWeight: 600,
    lineHeight: 1.45,
    overflowWrap: 'anywhere',
  },
  queueTriageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '6px',
    marginTop: '8px',
    maxWidth: '900px',
  },
  queueTriageItem: {
    padding: '5px 8px',
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    border: '1px solid rgba(251, 146, 60, 0.5)',
    borderRadius: '6px',
    color: '#7c2d12',
    fontSize: '12px',
    fontWeight: 700,
    lineHeight: 1.35,
    overflowWrap: 'anywhere',
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
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    color: '#0f5132',
    fontWeight: 600,
  },
  queueSlotSuggestionReasonText: {
    color: '#166534',
    fontWeight: 500,
    lineHeight: 1.35,
    overflowWrap: 'anywhere',
  },
  queueSlotBasisText: {
    padding: '5px 7px',
    borderRadius: '6px',
    backgroundColor: '#f8fafc',
    border: '1px solid #cbd5e1',
    color: '#334155',
    fontSize: '12px',
    fontWeight: 600,
    lineHeight: 1.4,
    overflowWrap: 'anywhere',
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
  queueIssueDiagnosticText: {
    color: '#475569',
    fontWeight: 600,
    overflowWrap: 'anywhere',
  },
  queueIssuePendingReceipt: {
    marginTop: '2px',
    padding: '5px 7px',
    borderRadius: '6px',
    backgroundColor: '#fff7ed',
    border: '1px solid #fdba74',
    color: '#7c2d12',
    fontWeight: 700,
    lineHeight: 1.4,
    overflowWrap: 'anywhere',
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
  targetReviewBannerWarning: {
    backgroundColor: '#fff8e1',
    borderBottom: '1px solid #ffe08a',
    borderLeft: '4px solid #b45309',
  },
  targetReviewText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    color: '#1b5e20',
    fontSize: '13px',
  },
  targetReviewDetails: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px 12px',
    color: '#2f4f2f',
    fontSize: '12px',
    lineHeight: 1.45,
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
  filterReceipt: {
    backgroundColor: '#eef6ff',
    borderBottom: '1px solid #bfdbfe',
    borderLeft: '4px solid #2563eb',
    padding: '12px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
  },
  filterReceiptWarning: {
    backgroundColor: '#fff8e1',
    borderBottom: '1px solid #ffe08a',
    borderLeft: '4px solid #b45309',
  },
  filterReceiptBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    color: '#1e3a8a',
    fontSize: '13px',
    lineHeight: 1.45,
  },
  filterReceiptDetails: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px 14px',
    color: '#475569',
    fontSize: '12px',
  },
  filterReceiptButton: {
    padding: '7px 12px',
    backgroundColor: '#2563eb',
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
    maxWidth: 'calc(100vw - 48px)',
    width: '1415px',
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
  titleRow: {
    display: 'flex',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: '8px',
    minWidth: 0,
  },
  titleHint: {
    color: '#6b7280',
    fontSize: '12px',
    fontWeight: 400,
    lineHeight: 1.4,
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
  executorChipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  executorChipDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'currentColor',
    opacity: 0.75,
  },
  executorChipBadge: {
    marginLeft: '2px',
    fontSize: '11px',
    fontWeight: 600,
    opacity: 0.7,
  },
  inlineLinkButton: {
    border: 'none',
    background: 'none',
    padding: 0,
    color: '#0056b3',
    cursor: 'pointer',
    fontSize: '12px',
    textDecoration: 'underline',
  },
  section: {
    marginBottom: '16px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  methodTabsSection: {
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #e5e7eb',
  },
  methodTabs: {
    display: 'flex',
    alignItems: 'stretch',
    gap: '6px',
    flexWrap: 'wrap',
  },
  methodTabGroups: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    overflowX: 'auto',
  },
  methodTabGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  methodTabGroupDivider: {
    marginLeft: 14,
    paddingLeft: 14,
    borderLeft: '1px solid #d9e0e7',
  },
  methodTabGroupLabel: {
    fontSize: 11,
    color: '#5d6978',
    letterSpacing: 1,
    paddingLeft: 2,
  },
  methodTabGroupLabelInline: {
    fontSize: 11,
    color: '#5d6978',
    letterSpacing: 0.5,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    padding: '0 2px',
  },
  methodTabInlineDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#d9e0e7',
    margin: '0 4px',
    flexShrink: 0,
  },
  agentNotifyPreview: {
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 12.5,
    lineHeight: 1.8,
    background: '#e9f7ec',
    border: '1px solid #bfe5c8',
    color: '#14532d',
  },
  agentNotifyPreviewSilent: {
    background: '#fff3cd',
    borderColor: '#ffc107',
    color: '#856404',
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
  executionLaneReceipt: {
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid #d9e2ef',
    fontSize: '12px',
    lineHeight: 1.4,
  },
  executionLaneSummary: {
    color: '#1f2937',
    fontWeight: 700,
  },
  executionLaneDetail: {
    marginTop: '3px',
    color: '#5f6f82',
  },
  executionLaneBoundary: {
    marginTop: '3px',
    color: '#4b5563',
  },
  executionRouteActionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    marginTop: '8px',
    flexWrap: 'wrap',
  },
  executionRouteBlockText: {
    fontSize: '12px',
    color: '#8a4b00',
    lineHeight: 1.35,
  },
  executionRouteActionButton: {
    padding: '6px 10px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
  },
  methodPreviewBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    padding: '1px 5px',
    borderRadius: '4px',
    backgroundColor: '#fff3cd',
    color: '#8a4b00',
    border: '1px solid #f0c36d',
    fontSize: '10px',
    lineHeight: 1.2,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  methodPreviewReceipt: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: '10px',
    padding: '9px 11px',
    borderRadius: '6px',
    backgroundColor: '#fff8e6',
    border: '1px solid #f0c36d',
    color: '#6f4200',
    fontSize: '12px',
    lineHeight: 1.4,
  },
  methodSetupNotice: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#fff3cd',
    borderRadius: '6px',
    border: '1px solid #ffc107',
  },
  methodSetupText: {
    margin: '0 0 10px 0',
    color: '#856404',
    fontSize: '14px',
  },
  methodSetupButton: {
    padding: '8px 16px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  asMeSenderNotice: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#e7f3ff',
    borderRadius: '6px',
    border: '1px solid #b3d7ff',
  },
  asMeSenderText: {
    margin: '0 0 10px 0',
    color: '#0b4f79',
    fontSize: '14px',
    lineHeight: 1.5,
  },
  asMeSenderButton: {
    padding: '8px 16px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
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
  scheduleSuggestionReceipt: {
    marginTop: '8px',
    padding: '8px 10px',
    backgroundColor: '#f5fbf7',
    border: '1px solid #badbcc',
    borderRadius: '6px',
    color: '#0f5132',
    fontSize: '12px',
    lineHeight: 1.45,
  },
  scheduleSuggestionReceiptTitle: {
    fontWeight: 700,
    marginBottom: '3px',
  },
  scheduleSuggestionReceiptDetail: {
    marginTop: '2px',
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
  ringCentralSenderPermissionNotice: {
    marginBottom: '16px',
    padding: '12px',
    backgroundColor: '#eef7ff',
    border: '1px solid #b7dbff',
    borderRadius: '6px',
  },
  ringCentralSenderPermissionTitle: {
    margin: '0 0 8px 0',
    fontSize: '13px',
    fontWeight: 700,
    color: '#0b4f79',
  },
  ringCentralSenderPermissionList: {
    margin: 0,
    paddingLeft: '18px',
    fontSize: '12px',
    color: '#32536a',
    lineHeight: 1.5,
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

      let updatedConfig = withRingCentralSender(
        withBotAutomation(normalizedConfig, nextBotAutomation),
        resolvedRingCentralSender
      );
      
      if (mode !== 'create' && !shouldRecreateExecutorForRingCentralSender && nextBotAutomation.executorRule?.ruleId) {
        const { JiraRuleUpdater } = await import('./JiraRuleUpdater');
        const updateResult = await new JiraRuleUpdater(updatedConfig).updateJiraRule({
          saveConfigToStorage: false,
          syncConfigToSheet: false,
        });
        if (!updateResult.success) {
          throw new Error(updateResult.error || updateResult.message || '更新 Jira executor rule 失败');
        }

        if (updateResult.updatedConfig) {
          updatedConfig = updateResult.updatedConfig;
        }
      }

      // 使用 ConfigSyncService 同步配置到 Sheet 和 Chrome Storage。放在 Jira rule 更新成功之后，
      // 避免 Config 先启用 sender 但 executor rule 未更新时禁用旧邮件 fallback。
      const token = await getGoogleAuthToken({
        caller: 'BotConfigDialog.handleSubmit',
        scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
      });
      const { ConfigSyncService } = await import('./ConfigSyncService');
      const syncService = new ConfigSyncService(token);
      const syncedConfig = await syncService.syncConfig(updatedConfig, { syncAction: 'bot_config_update' });
      
      onSuccess(syncedConfig);
      
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
                    <div style={dialogStyles.ringCentralSenderPermissionNotice}>
                      <p style={dialogStyles.ringCentralSenderPermissionTitle}>
                        RingCentral app 权限要求
                      </p>
                      <ul style={dialogStyles.ringCentralSenderPermissionList}>
                        <li>
                          创建 RingCentral app / JWT 时至少勾选{' '}
                          {RINGCENTRAL_SENDER_REQUIRED_PERMISSIONS.join('、')}。
                        </li>
                        <li>
                          ReadAccounts 用于读取公司通讯录，并把 personName（例如 esone.qiu）解析成 person id。
                          缺少该权限时 OAuth 可能成功，但 directory endpoint 会返回 403 InsufficientPermissions，
                          sender workflow 会出现 Cannot resolve target personName。
                        </li>
                        <li>
                          ReadMessages 和 EditMessages 用于消息读取、发送 / 更新以及无发送预检。
                        </li>
                      </ul>
                    </div>

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
