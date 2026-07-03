/**
 * 统一任务调度管理器
 * 集中管理所有定时任务，避免重复执行和遗漏
 *
 * 特性：
 * - message_analysis 任务的间隔时间从 envConfig.MESSAGE_ANALYSIS_INTERVAL 动态读取
 * - 消息上下文获取窗口从 envConfig.MESSAGE_CONTEXT_WINDOW 动态读取
 * - 自动监听配置变化，当配置更新时自动重新加载任务间隔
 * - 无需手动干预，配置更改后立即生效
 */

import {
  findRingCentralTab,
  createRingCentralTab,
  waitForTabLoad,
} from '../utils/tabHelpers';
import { getEnvConfig } from '../utils';
import { Logger } from '../utils/logger';
import { digestQueueService } from './DigestQueueService';
import type {
  DigestProcessResult,
  DigestQueueStatusSummary,
  DigestQueueTaskSnapshot,
  DigestQueueScheduleBreakdownItem,
} from '../types/digestQueue';
import { getMemoryServiceClient } from './MemoryServiceClient';
import { concernedItemsSyncService } from './ConcernedItemsSyncService';
import { TASK_DEFINITIONS } from './taskSchedulerDefinitions';
import {
  summarizeMessageAnalysisDeliveryReceipt,
  type MessageAnalysisDeliveryReceipt,
} from '../messageAnalysisDelivery';
import { DIGEST_QUEUE_RELEASE_CHECK_INTERVAL_MINUTES } from './digestQueueConfig';
export {
  getTaskEnabled,
  onTaskEnabledChanged,
} from './taskSchedulerDefinitions';

// 任务类型定义
export interface ScheduledTask {
  id: string;
  name: string;
  category:
    | 'message_analysis'
    | 'data_sync'
    | 'system_maintenance'
    | 'user_profile';
  intervalMinutes: number;
  description: string;
  enabled: boolean;
  lastRun?: number;
  lastCompletedAt?: number;
  lastSkippedAt?: number;
  lastSuccess?: boolean;
  lastError?: string;
  lastSkipReason?: string;
  lastResultSummary?: string;
  nextRun?: number;
  runHistory?: ScheduledTaskRunRecord[];
}

export interface ScheduledTaskStatus extends ScheduledTask {
  status: 'running' | 'stopped';
  isExecuting: boolean;
  scheduleHealth:
    | 'scheduled'
    | 'missing_alarm'
    | 'period_mismatch'
    | 'overdue'
    | 'repair_failed'
    | 'disabled';
  scheduleWarning?: string;
  statusReceipt: ScheduledTaskStatusReceipt;
  currentQueueSummary?: string;
  currentQueueStatus?: DigestQueueStatusSummary;
  currentQueueStatusError?: string;
}

export interface ScheduledTaskStatusReceipt {
  state:
    | 'executing'
    | 'schedule_attention'
    | 'recent_skip'
    | 'failed'
    | 'healthy'
    | 'disabled'
    | 'idle';
  tone:
    | 'executing'
    | 'warning'
    | 'failed'
    | 'skipped'
    | 'running'
    | 'disabled';
  label: string;
  detail: string;
  nextAction: string;
}

export interface TaskSchedulerStatusRefreshReceipt {
  checkedAt: number;
  checkedTaskCount: number;
  enabledTaskCount: number;
  scheduleAttentionCount: number;
  autoRepairAttempted: boolean;
  createdAlarms: number;
  updatedAlarms: number;
  clearedAlarms: number;
  orphanedAlarmsCleared: number;
  disabledAlarmsCleared: number;
  failedRepairs: number;
  queueStatusUnavailableCount: number;
  refreshOnly: true;
}

export interface TaskSchedulerStatusFreshResult {
  tasks: Array<ScheduledTaskStatus>;
  refreshReceipt: TaskSchedulerStatusRefreshReceipt;
}

export interface TaskExecutionResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
  summary?: string;
}

interface MessageAnalysisRunResponse {
  success?: boolean;
  message?: string;
  error?: string;
  deliveryReceipt?: MessageAnalysisDeliveryReceipt;
}

export type TaskExecutionTrigger = 'scheduled' | 'manual' | 'startup';

export interface ScheduledTaskRunRecord {
  startedAt: number;
  completedAt: number;
  durationMs: number;
  success: boolean;
  skipped?: boolean;
  trigger: TaskExecutionTrigger;
  error?: string;
  summary?: string;
}

interface TaskStatusOptions {
  repairAlarms?: boolean;
  persist?: boolean;
}

interface AlarmRefreshSummary {
  autoRepairAttempted: boolean;
  createdAlarms: number;
  updatedAlarms: number;
  clearedAlarms: number;
  orphanedAlarmsCleared: number;
  disabledAlarmsCleared: number;
  failedRepairs: number;
}

const TASK_RUN_HISTORY_LIMIT = 5;
const MIN_CHROME_ALARM_INTERVAL_MINUTES = 0.5;
const MIN_ALARM_OVERDUE_GRACE_MS = 5 * 60 * 1000;
const MAX_ALARM_OVERDUE_GRACE_MS = 30 * 60 * 1000;
const DIGEST_QUEUE_STATUS_BOUNDARY =
  `本地延迟摘要：到达释放窗口后由后台任务推送，通常 ${DIGEST_QUEUE_RELEASE_CHECK_INTERVAL_MINUTES} 分钟内检查；查看/刷新不立即发送、不写入 Memory Service、不确认通知`;
const DIGEST_QUEUE_STATUS_UNAVAILABLE_BOUNDARY =
  '本地摘要队列状态未确认：本次刷新未能读取队列明细；刷新没有立即发送摘要、不写入 Memory Service、不确认通知，可稍后重试或检查本地摘要配置';

function getTaskErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return '未知错误';
}

export function summarizeDigestQueueProcessResults(
  results: DigestProcessResult[],
): TaskExecutionResult {
  if (results.length === 0) {
    return {
      success: true,
      summary: '无到期摘要',
    };
  }

  const failedResults = results.filter((result) => !result.success);
  const totalItems = results.reduce(
    (sum, result) => sum + result.itemsProcessed,
    0,
  );
  const totalPending = results.reduce(
    (sum, result) => sum + (result.itemsPending || 0),
    0,
  );
  const totalDue = results.reduce(
    (sum, result) => sum + (result.itemsDue || 0),
    0,
  );
  const successCount = results.length - failedResults.length;
  const nextReleaseAt = getEarliestDigestReleaseAt(results);
  const dueReceipt = formatDigestQueueDueReleaseReceipt(totalDue);

  if (failedResults.length > 0) {
    const failureSummary = failedResults
      .map((result) => `${result.taskId}: ${result.error || '处理失败'}`)
      .join('; ');
    const retainedDetails = formatDigestQueueResultDetails(
      failedResults,
      '保留明细',
    );
    return {
      success: false,
      error: `摘要推送失败 ${failedResults.length}/${results.length}：${failureSummary}`,
      summary: `${successCount} 个摘要任务成功，${
        failedResults.length
      } 个失败，队列已保留${totalPending > 0 ? ` ${totalPending} 条` : ''}${
        retainedDetails ? `；${retainedDetails}` : ''
      }${dueReceipt ? `；${dueReceipt}` : ''}`,
    };
  }

  if (totalPending > 0) {
    const waitingDetails = formatDigestQueueResultDetails(results, '等待明细');
    return {
      success: true,
      summary: `${successCount} 个摘要任务完成，等待 ${totalPending} 条${
        nextReleaseAt ? `，最早 ${formatDigestReleaseTime(nextReleaseAt)}` : ''
      }${waitingDetails ? `；${waitingDetails}` : ''}${
        dueReceipt ? `；${dueReceipt}` : ''
      }`,
    };
  }

  return {
    success: true,
    summary:
      totalItems > 0
        ? `${successCount} 个摘要任务成功，推送 ${totalItems} 条`
        : `${successCount} 个摘要任务完成，无到期条目`,
  };
}

export function summarizeDigestQueueStatusSummary(
  summary: DigestQueueStatusSummary,
): string | undefined {
  if (summary.totalItems <= 0) {
    return undefined;
  }

  const dueText =
    summary.dueItems > 0 ? `${summary.dueItems} 条已到期` : '暂无到期';
  const nextRelease = summary.nextReleaseAt
    ? `，最早 ${formatDigestReleaseTime(summary.nextReleaseAt)}`
    : '';
  const taskBreakdown = summary.tasks
    .map(formatDigestQueueTaskSummary)
    .filter(Boolean)
    .join('；');
  const dueReceipt = formatDigestQueueDueReleaseReceipt(summary.dueItems);
  return `本地摘要队列 ${summary.totalItems} 条，${dueText}${nextRelease}${
    taskBreakdown ? `；${taskBreakdown}` : ''
  }${dueReceipt ? `；${dueReceipt}` : ''}；${DIGEST_QUEUE_STATUS_BOUNDARY}`;
}

export function summarizeDigestQueueStatusUnavailable(error: unknown): string {
  const message = getTaskErrorMessage(error);
  return `${DIGEST_QUEUE_STATUS_UNAVAILABLE_BOUNDARY}；失败原因：${message}`;
}

function formatDigestQueueResultDetails(
  results: DigestProcessResult[],
  label: string,
): string {
  const summaries = results
    .map((result) => result.queueSnapshot)
    .filter(
      (snapshot): snapshot is DigestQueueTaskSnapshot =>
        Boolean(snapshot && snapshot.totalItems > 0),
    )
    .map(formatDigestQueueTaskSummary);

  return summaries.length > 0 ? `${label}：${summaries.join('；')}` : '';
}

function formatDigestQueueDueReleaseReceipt(dueItems: number): string {
  if (dueItems <= 0) return '';
  return `释放窗口回执：${dueItems} 条已具备发送资格，等待 digest_queue_process 后台任务推送；查看或刷新状态不会立即发送摘要`;
}

function getEarliestDigestReleaseAt(
  results: DigestProcessResult[],
): string | undefined {
  return results.reduce<string | undefined>((earliest, result) => {
    if (!result.nextReleaseAt) return earliest;
    if (!earliest) return result.nextReleaseAt;
    return new Date(result.nextReleaseAt).getTime() <
      new Date(earliest).getTime()
      ? result.nextReleaseAt
      : earliest;
  }, undefined);
}

function formatDigestReleaseTime(isoString: string): string {
  const date = new Date(isoString);
  if (!Number.isFinite(date.getTime())) {
    return '未知时间';
  }
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDigestQueueTaskSummary(
  task: DigestQueueTaskSnapshot,
): string {
  const taskName = task.taskName || task.taskId;
  const sourceText = formatDigestSourceBreakdown(task);
  const scheduleText = formatDigestScheduleBreakdown(task.scheduleBreakdown);
  const parts = [sourceText, scheduleText].filter(Boolean);

  return `${taskName} ${task.totalItems} 条${
    task.dueItems > 0 ? `（${task.dueItems} 条已到期）` : ''
  }${parts.length > 0 ? `（${parts.join('；')}）` : ''}`;
}

function formatDigestSourceBreakdown(
  task: DigestQueueTaskSnapshot,
): string {
  const entries = task.sourceBreakdown || [];
  if (entries.length === 0) return '';

  const sourceText = entries
    .map((entry) => `${entry.label} ${entry.count} 条`)
    .join('、');
  return task.sourceOverflowCount && task.sourceOverflowCount > 0
    ? `${sourceText}、另 ${task.sourceOverflowCount} 个关注项`
    : sourceText;
}

function formatDigestScheduleBreakdown(
  entries: DigestQueueScheduleBreakdownItem[] | undefined,
): string {
  if (!entries || entries.length === 0) return '';

  const scheduleText = entries
    .map((entry) => formatDigestScheduleEntry(entry))
    .join('、');
  return scheduleText;
}

function formatDigestScheduleEntry(
  entry: DigestQueueScheduleBreakdownItem,
): string {
  const hour = `${entry.preferredHour}:00`;
  const countText = entry.count > 1 ? ` ${entry.count} 条` : '';

  if (entry.frequency === 'weekly') {
    const weekday =
      ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][
        entry.preferredDayOfWeek ?? 1
      ] || '周一';
    return `每周${weekday} ${hour}${countText}`;
  }

  return `每日 ${hour}${countText}`;
}

function isAlarmPersistenceFlagUnsupported(error: unknown): boolean {
  const message = getTaskErrorMessage(error);
  return (
    message.includes('persistAcrossSessions') &&
    /(Unexpected property|Invalid value|not supported|unsupported)/i.test(
      message,
    )
  );
}

function getAlarmOverdueGraceMs(task: ScheduledTask): number {
  return Math.min(
    Math.max(task.intervalMinutes * 60 * 1000, MIN_ALARM_OVERDUE_GRACE_MS),
    MAX_ALARM_OVERDUE_GRACE_MS,
  );
}

function getAlarmOverdueMs(
  task: ScheduledTask,
  alarm: chrome.alarms.Alarm,
): number {
  return Date.now() - alarm.scheduledTime - getAlarmOverdueGraceMs(task);
}

function isAlarmOverdue(
  task: ScheduledTask,
  alarm: chrome.alarms.Alarm,
): boolean {
  return getAlarmOverdueMs(task, alarm) > 0;
}

function parseValidIntervalMinutes(value: unknown): number | null {
  const interval = Number(value);
  if (
    !Number.isFinite(interval) ||
    interval < MIN_CHROME_ALARM_INTERVAL_MINUTES
  ) {
    return null;
  }
  return interval;
}

function resolveMessageAnalysisInterval(config: {
  MESSAGE_ANALYSIS_INTERVAL?: unknown;
  SCHEDULED_INTERVAL?: unknown;
}): number {
  return (
    parseValidIntervalMinutes(config.MESSAGE_ANALYSIS_INTERVAL) ??
    parseValidIntervalMinutes(config.SCHEDULED_INTERVAL) ??
    30
  );
}

function formatTaskReceiptTime(value?: number): string {
  if (!value) return '未知时间';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function appendTaskReceiptDetail(detail: string, summary?: string): string {
  const normalizedDetail = detail.trim();
  const normalizedSummary = summary?.trim();
  if (!normalizedSummary) return normalizedDetail;
  if (!normalizedDetail) return normalizedSummary;
  if (
    normalizedDetail.includes(normalizedSummary) ||
    normalizedSummary.includes(normalizedDetail)
  ) {
    return normalizedDetail;
  }
  return `${normalizedDetail} · ${normalizedSummary}`;
}

export function summarizeMessageAnalysisTaskRun(
  messagesCount: number,
  response: unknown,
): TaskExecutionResult {
  const result = response as MessageAnalysisRunResponse | undefined;
  const receipt = result?.deliveryReceipt;
  if (receipt) {
    return summarizeMessageAnalysisDeliveryReceipt(receipt);
  }

  if (result && result.success === false) {
    const error = result.error || result.message || '消息分析失败';
    return {
      success: false,
      error,
      summary: `分析了 ${messagesCount} 条消息，未返回分发回执`,
    };
  }

  return {
    success: true,
    summary: `分析了 ${messagesCount} 条消息，未返回分发回执`,
  };
}

function getTaskReceiptFailureStreak(task: ScheduledTask): number {
  if (task.lastSuccess !== false) {
    return 0;
  }

  const history = Array.isArray(task.runHistory) ? task.runHistory : [];
  if (history.length === 0) {
    return 1;
  }

  let streak = 0;
  for (const run of history) {
    if (run.skipped) {
      break;
    }
    if (run.success === false) {
      streak += 1;
      continue;
    }
    break;
  }

  return Math.max(streak, 1);
}

function hasRecentTaskSkip(task: ScheduledTask): boolean {
  return Boolean(
    task.lastSkippedAt &&
      (!task.lastCompletedAt || task.lastSkippedAt >= task.lastCompletedAt),
  );
}

function buildTaskStatusReceipt(
  task: ScheduledTask,
  scheduleHealth: ScheduledTaskStatus['scheduleHealth'],
  scheduleWarning: string | undefined,
  isExecuting: boolean,
): ScheduledTaskStatusReceipt {
  if (isExecuting) {
    return {
      state: 'executing',
      tone: 'executing',
      label: '正在执行',
      detail: `开始 ${formatTaskReceiptTime(task.lastRun)}`,
      nextAction: '等待完成后再触发新操作',
    };
  }

  if (scheduleHealth !== 'disabled' && scheduleHealth !== 'scheduled') {
    const label =
      scheduleHealth === 'overdue'
        ? '排程逾期'
        : scheduleHealth === 'repair_failed'
        ? '修复失败'
        : scheduleHealth === 'period_mismatch'
        ? '间隔不一致'
        : '未排程';
    const nextAction =
      scheduleHealth === 'overdue'
        ? '先立即执行一次，再重排下一次'
        : scheduleHealth === 'repair_failed'
        ? '旧排程会尽量保留，稍后重试重排'
        : '重排 Chrome alarm';
    return {
      state: 'schedule_attention',
      tone: 'warning',
      label,
      detail: scheduleWarning || 'Chrome alarm 需要刷新',
      nextAction,
    };
  }

  if (hasRecentTaskSkip(task)) {
    return {
      state: 'recent_skip',
      tone: 'skipped',
      label: '最近跳过',
      detail: task.lastSkipReason || '任务条件未满足',
      nextAction: '等待当前执行完成或条件恢复后再重试',
    };
  }

  if (task.lastSuccess === false) {
    const failureStreak = getTaskReceiptFailureStreak(task);
    return {
      state: 'failed',
      tone: 'failed',
      label: failureStreak > 1 ? `连续失败 ${failureStreak} 次` : '上次失败',
      detail: appendTaskReceiptDetail(
        task.lastError || '查看后台日志',
        task.lastResultSummary,
      ),
      nextAction:
        failureStreak >= 3
          ? '先暂停排程并检查服务配置，再手动重试'
          : '重试一次；重复失败先检查服务状态',
    };
  }

  if (!task.enabled) {
    return {
      state: 'disabled',
      tone: 'disabled',
      label: '停用',
      detail: '不会自动创建 Chrome alarm',
      nextAction: '需要时可手动执行一次，不会重新启用排程',
    };
  }

  if (!task.lastCompletedAt) {
    return {
      state: 'idle',
      tone: 'running',
      label: '等待首次执行',
      detail: task.nextRun
        ? `下次 ${formatTaskReceiptTime(task.nextRun)}`
        : '等待 Chrome 排程',
      nextAction: '保持排程，必要时手动执行一次',
    };
  }

  return {
    state: 'healthy',
    tone: 'running',
    label: '最近成功',
    detail: task.lastResultSummary || `完成 ${formatTaskReceiptTime(task.lastCompletedAt)}`,
    nextAction: '保持排程，异常时再处理',
  };
}

function createAlarmRefreshSummary(
  autoRepairAttempted: boolean,
): AlarmRefreshSummary {
  return {
    autoRepairAttempted,
    createdAlarms: 0,
    updatedAlarms: 0,
    clearedAlarms: 0,
    orphanedAlarmsCleared: 0,
    disabledAlarmsCleared: 0,
    failedRepairs: 0,
  };
}

function buildTaskStatusRefreshReceipt(
  tasks: Array<ScheduledTaskStatus>,
  refreshSummary: AlarmRefreshSummary,
): TaskSchedulerStatusRefreshReceipt {
  return {
    checkedAt: Date.now(),
    checkedTaskCount: tasks.length,
    enabledTaskCount: tasks.filter((task) => task.enabled).length,
    scheduleAttentionCount: tasks.filter(
      (task) =>
        task.enabled &&
        task.scheduleHealth !== 'scheduled' &&
        task.scheduleHealth !== 'disabled',
    ).length,
    autoRepairAttempted: refreshSummary.autoRepairAttempted,
    createdAlarms: refreshSummary.createdAlarms,
    updatedAlarms: refreshSummary.updatedAlarms,
    clearedAlarms: refreshSummary.clearedAlarms,
    orphanedAlarmsCleared: refreshSummary.orphanedAlarmsCleared,
    disabledAlarmsCleared: refreshSummary.disabledAlarmsCleared,
    failedRepairs: refreshSummary.failedRepairs,
    queueStatusUnavailableCount: tasks.filter((task) =>
      Boolean(task.currentQueueStatusError),
    ).length,
    refreshOnly: true,
  };
}

export class TaskScheduler {
  private static instance: TaskScheduler | null = null;
  private tasks: Map<string, ScheduledTask> = new Map();
  private alarmListeners: Set<string> = new Set();
  private runningTasks: Set<string> = new Set();
  private scheduleRepairErrors: Map<string, string> = new Map();
  private startPromise: Promise<void> | null = null;
  private alarmPersistenceFlagSupported = true;
  public isInitialized = false; // 改为 public，方便 background.ts 检查状态
  private storageChangeListener:
    | ((
        changes: { [key: string]: chrome.storage.StorageChange },
        namespace: string,
      ) => void)
    | null = null;

  private constructor() {
    // initializeTasks 现在是异步的，将在 startAllTasks 中调用
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): TaskScheduler {
    if (!TaskScheduler.instance) {
      TaskScheduler.instance = new TaskScheduler();
    }
    return TaskScheduler.instance;
  }

  private isConcernedItemsSyncEnabled(): boolean {
    return this.tasks.get('memory_sync')?.enabled ?? false;
  }

  /**
   * 初始化任务定义
   */
  private async initializeTasks(): Promise<void> {
    // 获取环境配置
    const config = await getEnvConfig();

    // 初始化所有任务
    TASK_DEFINITIONS.forEach((task) => {
      const taskCopy = { ...task };

      // message_analysis 任务的间隔时间使用用户配置
      if (task.id === 'message_analysis') {
        // 优先使用新配置，如果不存在则使用旧配置作为回退
        taskCopy.intervalMinutes = resolveMessageAnalysisInterval(config);
        console.log(
          `⚙️ message_analysis 任务间隔已设置为: ${taskCopy.intervalMinutes} 分钟`,
        );
        console.log(
          `⚙️ 消息上下文窗口已设置为: ${
            config.MESSAGE_CONTEXT_WINDOW || 125
          } 分钟`,
        );
      }

      this.tasks.set(taskCopy.id, taskCopy);
    });

    console.log(
      '📋 任务调度器初始化完成，注册任务:',
      Array.from(this.tasks.keys()),
    );
  }

  /**
   * 启动所有定时任务
   */
  public async startAllTasks(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ 任务调度器已启动，跳过重复启动');
      return;
    }

    if (this.startPromise) {
      console.log('⏳ 任务调度器正在启动，等待已有启动流程完成');
      await this.startPromise;
      return;
    }

    this.startPromise = this.startAllTasksInternal();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private async startAllTasksInternal(): Promise<void> {
    console.log('🚀 启动任务调度器...');

    // 初始化任务定义（包括从配置中读取 message_analysis 的间隔）
    await this.initializeTasks();

    // 从 storage 恢复任务状态
    await this.restoreTaskStates();

    if (this.isConcernedItemsSyncEnabled()) {
      try {
        await concernedItemsSyncService.syncOnStartup();
      } catch (error) {
        console.warn('ConcernedItems startup sync skipped:', error);
      }
    }

    // 确保所有启用的任务都有对应的 alarm
    // Chrome 官方推荐：不依赖 alarms 持久化，而是基于 Storage 状态重建
    await this.ensureAlarmsCreated();

    // 设置 alarm 监听器（每次都需要重新设置，因为监听器不会持久化）
    this.setupAlarmListeners();

    // 设置配置变化监听器
    this.setupConfigChangeListener();

    console.log('🔄 已恢复任务排程，等待 Chrome alarm 或手动触发执行');

    this.isInitialized = true;

    // 保存初始化状态
    await this.saveTaskStates();

    console.log('✅ 任务调度器启动完成');
  }

  /**
   * 停止所有定时任务
   */
  public async stopAllTasks(): Promise<void> {
    console.log('🛑 停止任务调度器...');

    // 只清除我们创建的 alarms，不影响其他扩展功能的 alarms
    const existingAlarms = await this.getExistingAlarms();
    for (const alarm of existingAlarms) {
      await new Promise((resolve) => chrome.alarms.clear(alarm.name, resolve));
    }
    console.log(`🧹 已清除 ${existingAlarms.length} 个任务定时器`);

    this.alarmListeners.clear();

    // 移除配置变化监听器
    if (this.storageChangeListener) {
      chrome.storage.onChanged.removeListener(this.storageChangeListener);
      this.storageChangeListener = null;
      console.log('🗑️ 已移除配置变化监听器');
    }

    this.isInitialized = false;

    // 禁用所有任务
    for (const [_taskId, task] of Array.from(this.tasks.entries())) {
      task.enabled = false;
    }

    // 保存停止状态
    await this.saveTaskStates();

    console.log('✅ 任务调度器已停止');
  }

  /**
   * 从 Chrome Storage 恢复任务状态
   */
  private async restoreTaskStates(): Promise<void> {
    try {
      const { taskSchedulerStates } = await chrome.storage.local.get(
        'taskSchedulerStates',
      );

      if (taskSchedulerStates) {
        console.log('🔄 恢复任务状态:', taskSchedulerStates);

        // 恢复每个任务的状态
        for (const [taskId, savedState] of Object.entries(
          taskSchedulerStates,
        )) {
          const task = this.tasks.get(taskId);
          if (task && savedState) {
            const state = savedState as Partial<ScheduledTask>;
            task.enabled = state.enabled ?? task.enabled;
            task.lastRun = state.lastRun;
            task.lastCompletedAt = state.lastCompletedAt;
            task.lastSkippedAt = state.lastSkippedAt;
            task.lastSuccess = state.lastSuccess;
            task.lastError = state.lastError;
            task.lastSkipReason = state.lastSkipReason;
            task.lastResultSummary = state.lastResultSummary;
            task.nextRun = state.nextRun;
            task.runHistory = Array.isArray(state.runHistory)
              ? state.runHistory.slice(0, TASK_RUN_HISTORY_LIMIT)
              : undefined;
          }
        }

        console.log('✅ 任务状态恢复完成');
      } else {
        console.log('📝 未找到已保存的任务状态，使用默认配置');
      }
    } catch (error) {
      console.error('❌ 恢复任务状态失败:', error);
    }
  }

  /**
   * 保存任务状态到 Chrome Storage
   */
  private async saveTaskStates(): Promise<void> {
    try {
      const taskStates: Record<string, Partial<ScheduledTask>> = {};

      for (const [taskId, task] of Array.from(this.tasks.entries())) {
        taskStates[taskId] = {
          enabled: task.enabled,
          lastRun: task.lastRun,
          lastCompletedAt: task.lastCompletedAt,
          lastSkippedAt: task.lastSkippedAt,
          lastSuccess: task.lastSuccess,
          lastError: task.lastError,
          lastSkipReason: task.lastSkipReason,
          lastResultSummary: task.lastResultSummary,
          nextRun: task.nextRun,
          runHistory: task.runHistory,
        };
      }

      await chrome.storage.local.set({ taskSchedulerStates: taskStates });
      console.log('💾 任务状态已保存');
    } catch (error) {
      console.error('❌ 保存任务状态失败:', error);
    }
  }

  /**
   * 创建单个任务的 alarm
   */
  private async createChromeAlarm(
    alarmName: string,
    alarmInfo: chrome.alarms.AlarmCreateInfo,
  ): Promise<void> {
    const createAlarm = chrome.alarms.create as unknown as (
      name: string,
      alarmInfo: chrome.alarms.AlarmCreateInfo,
      callback: () => void,
    ) => void;

    await new Promise<void>((resolve, reject) => {
      createAlarm(alarmName, alarmInfo, () => {
        const errorMessage = chrome.runtime.lastError?.message;
        if (errorMessage) {
          reject(new Error(`创建定时器失败: ${alarmName}: ${errorMessage}`));
          return;
        }
        resolve();
      });
    });
  }

  private getAlarmCreateInfo(
    task: ScheduledTask,
  ): chrome.alarms.AlarmCreateInfo {
    const alarmInfo: chrome.alarms.AlarmCreateInfo = {
      delayInMinutes: task.intervalMinutes,
      periodInMinutes: task.intervalMinutes,
    };

    if (this.alarmPersistenceFlagSupported) {
      alarmInfo.persistAcrossSessions = true;
    }

    return alarmInfo;
  }

  private async createTaskAlarm(task: ScheduledTask): Promise<void> {
    const alarmName = `scheduled_task_${task.id}`;

    try {
      await this.createChromeAlarm(alarmName, this.getAlarmCreateInfo(task));
    } catch (error) {
      if (
        this.alarmPersistenceFlagSupported &&
        isAlarmPersistenceFlagUnsupported(error)
      ) {
        this.alarmPersistenceFlagSupported = false;
        console.warn(
          '⚠️ 当前 Chromium 不支持 chrome.alarms persistAcrossSessions，降级为默认持久化行为',
        );
        await this.createChromeAlarm(alarmName, this.getAlarmCreateInfo(task));
      } else {
        throw error;
      }
    }

    const createdAlarm = await this.getAlarm(alarmName);
    if (!createdAlarm) {
      throw new Error(`创建定时器失败: ${alarmName}`);
    }

    task.nextRun = createdAlarm.scheduledTime;
    this.scheduleRepairErrors.delete(task.id);

    console.log(
      `⏰ 创建定时任务: ${task.name} (${task.intervalMinutes}分钟间隔)`,
    );
  }

  private async refreshTaskNextRun(task: ScheduledTask): Promise<void> {
    if (!task.enabled) {
      task.nextRun = undefined;
      return;
    }

    const alarm = await this.getAlarm(`scheduled_task_${task.id}`);
    task.nextRun = alarm?.scheduledTime;
  }

  /**
   * 确保所有启用的任务都有对应的 alarm
   * 采用 Chrome 官方推荐的方式：基于 Storage 状态检查并创建 alarms
   */
  private async ensureAlarmsCreated({
    throwOnError = false,
  }: { throwOnError?: boolean } = {}): Promise<AlarmRefreshSummary> {
    console.log('🔍 检查并确保所有任务的定时器已创建...');
    const summary = createAlarmRefreshSummary(true);

    const orphanedAlarmsCleared = await this.clearOrphanedTaskAlarms();
    summary.orphanedAlarmsCleared = orphanedAlarmsCleared;
    summary.clearedAlarms += orphanedAlarmsCleared;

    for (const [taskId, task] of Array.from(this.tasks.entries())) {
      const alarmName = `scheduled_task_${taskId}`;

      if (!task.enabled) {
        // 任务已禁用，确保 alarm 被清除
        const existingAlarm = await this.getAlarm(alarmName);
        if (existingAlarm) {
          console.log(`🗑️ 清除已禁用任务的定时器: ${task.name}`);
          await this.clearAlarm(alarmName);
          summary.disabledAlarmsCleared += 1;
          summary.clearedAlarms += 1;
        }
        task.nextRun = undefined;
        this.scheduleRepairErrors.delete(taskId);
        continue;
      }

      try {
        // 检查 alarm 是否存在
        const existingAlarm = await this.getAlarm(alarmName);

        if (!existingAlarm) {
          // alarm 不存在，创建新的
          await this.createTaskAlarm(task);
          summary.createdAlarms += 1;
        } else if (existingAlarm.periodInMinutes !== task.intervalMinutes) {
          // alarm 存在但配置不一致，直接同名替换。不要先 clear，避免创建失败时丢掉旧排程。
          console.log(
            `🔄 更新定时器配置: ${task.name} (${existingAlarm.periodInMinutes}min -> ${task.intervalMinutes}min)`,
          );
          await this.createTaskAlarm(task);
          summary.updatedAlarms += 1;
        } else {
          // alarm 存在且配置正确
          task.nextRun = existingAlarm.scheduledTime;
          this.scheduleRepairErrors.delete(taskId);
          console.log(`✅ 定时器已存在: ${task.name}`);
        }
      } catch (error) {
        const errorMessage = getTaskErrorMessage(error);
        this.scheduleRepairErrors.set(taskId, errorMessage);
        summary.failedRepairs += 1;
        await this.refreshTaskNextRun(task);
        console.error(`❌ 修复任务 ${task.name} 的定时器失败:`, error);
        if (throwOnError) {
          throw error;
        }
      }
    }

    console.log('✅ 定时器检查完成');
    return summary;
  }

  private async clearOrphanedTaskAlarms(): Promise<number> {
    const knownTaskIds = new Set(this.tasks.keys());
    const existingAlarms = await this.getExistingAlarms();
    let clearedCount = 0;

    for (const alarm of existingAlarms) {
      const taskId = alarm.name.replace('scheduled_task_', '');
      if (knownTaskIds.has(taskId)) {
        continue;
      }

      console.warn(`🧹 清理未知任务的残留定时器: ${alarm.name}`);
      await this.clearAlarm(alarm.name);
      clearedCount += 1;
    }

    return clearedCount;
  }

  /**
   * 获取单个 alarm
   */
  private async getAlarm(
    name: string,
  ): Promise<chrome.alarms.Alarm | undefined> {
    return new Promise((resolve) => {
      chrome.alarms.get(name, (alarm) => {
        resolve(alarm);
      });
    });
  }

  /**
   * 清除单个 alarm
   */
  private async clearAlarm(name: string): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.alarms.clear(name, (wasCleared) => {
        resolve(wasCleared);
      });
    });
  }

  /**
   * 获取所有现有的任务相关 alarms（用于调试和监控）
   */
  private async getExistingAlarms(): Promise<chrome.alarms.Alarm[]> {
    return new Promise((resolve) => {
      chrome.alarms.getAll((alarms) => {
        // 只返回我们的任务调度器创建的 alarms
        const taskAlarms = alarms.filter((alarm) =>
          alarm.name.startsWith('scheduled_task_'),
        );
        resolve(taskAlarms);
      });
    });
  }

  /**
   * 清理所有 alarms
   */
  private async clearAllAlarms(): Promise<void> {
    return new Promise((resolve) => {
      chrome.alarms.clearAll(() => {
        console.log('🧹 清理所有定时任务');
        resolve();
      });
    });
  }

  /**
   * 设置 alarm 监听器
   * 注意：在 Manifest V3 中，监听器应该在顶层设置，而不是在这里
   * 这个方法保留用于兼容性，但实际监听器已经在 background.ts 顶层设置
   */
  private setupAlarmListeners(): void {
    if (this.alarmListeners.has('main')) {
      return;
    }

    // 🔥 不再在这里设置监听器，改为在 background.ts 顶层设置
    // 原因：Service Worker 重启时，如果监听器设置延迟，alarm 事件会丢失

    this.alarmListeners.add('main');
    console.log(
      '✅ TaskScheduler 监听器标记已设置（实际监听器在 background.ts 顶层）',
    );
  }

  /**
   * 处理 alarm 事件
   * 由 background.ts 的顶层监听器调用
   */
  public async handleAlarmEvent(alarm: chrome.alarms.Alarm): Promise<void> {
    const taskId = alarm.name.replace('scheduled_task_', '');
    const task = this.tasks.get(taskId);

    if (task) {
      if (!task.enabled) {
        console.warn(`⚠️ 忽略已禁用任务的残留定时器: ${task.name}`);
        await this.clearAlarm(alarm.name);
        task.nextRun = undefined;
        await this.saveTaskStates();
        return;
      }
      console.log(`⚡ 执行定时任务: ${task.name}`);
      await this.executeTask(task, 'scheduled');
    } else {
      console.warn(`⚠️ 未找到任务: ${taskId}，清理残留定时器`);
      await this.clearAlarm(alarm.name);
    }
  }

  /**
   * 静态方法：尝试处理 alarm 事件
   * 返回 true 表示已处理，false 表示不是 TaskScheduler 的 alarm
   */
  public static async tryHandleAlarm(
    alarm: chrome.alarms.Alarm,
  ): Promise<boolean> {
    if (!alarm.name.startsWith('scheduled_task_')) {
      return false;
    }

    const instance = TaskScheduler.getInstance();

    // 确保已初始化
    if (!instance.isInitialized) {
      console.log('⚠️ TaskScheduler 未初始化，开始初始化...');
      await instance.startAllTasks();
    }

    const taskId = alarm.name.replace('scheduled_task_', '');
    console.log(`⚡ 执行定时任务: ${taskId}`);
    await instance.handleAlarmEvent(alarm);

    return true;
  }

  /**
   * 设置配置变化监听器
   * 自动监听 envConfig.MESSAGE_ANALYSIS_INTERVAL 的变化并更新 message_analysis 任务
   */
  private setupConfigChangeListener(): void {
    if (this.storageChangeListener) {
      // 已存在监听器，先移除
      chrome.storage.onChanged.removeListener(this.storageChangeListener);
    }

    this.storageChangeListener = async (changes, namespace) => {
      // 只处理 local storage 的变化
      if (namespace !== 'local') {
        return;
      }

      // 检查是否是 envConfig 的变化
      if (changes.envConfig) {
        const oldConfig = changes.envConfig.oldValue;
        const newConfig = changes.envConfig.newValue;

        // 检查 MESSAGE_ANALYSIS_INTERVAL 是否变化
        const oldInterval =
          oldConfig?.MESSAGE_ANALYSIS_INTERVAL || oldConfig?.SCHEDULED_INTERVAL;
        const newInterval =
          newConfig?.MESSAGE_ANALYSIS_INTERVAL || newConfig?.SCHEDULED_INTERVAL;
        const oldContextWindow = oldConfig?.MESSAGE_CONTEXT_WINDOW;
        const newContextWindow = newConfig?.MESSAGE_CONTEXT_WINDOW;

        if (oldInterval !== newInterval) {
          console.log(
            `🔄 检测到 MESSAGE_ANALYSIS_INTERVAL 配置变化: ${oldInterval} -> ${newInterval} 分钟`,
          );

          // 自动重新加载 message_analysis 任务的间隔配置
          try {
            const updated = await this.reloadMessageAnalysisInterval();

            if (updated) {
              console.log('✅ message_analysis 任务间隔已自动更新');
            }
          } catch (error) {
            console.error(
              '❌ message_analysis 任务间隔自动更新失败，保留现有排程:',
              error,
            );
          }
        }

        if (oldContextWindow !== newContextWindow) {
          console.log(
            `🔄 检测到 MESSAGE_CONTEXT_WINDOW 配置变化: ${oldContextWindow} -> ${newContextWindow} 分钟`,
          );
        }
      }
    };

    chrome.storage.onChanged.addListener(this.storageChangeListener);
    console.log(
      '👂 配置变化监听器已设置（自动监听 MESSAGE_ANALYSIS_INTERVAL 和 MESSAGE_CONTEXT_WINDOW）',
    );
  }

  /**
   * 执行具体任务
   */
  private recordTaskRun(
    task: ScheduledTask,
    record: ScheduledTaskRunRecord,
  ): void {
    const history = Array.isArray(task.runHistory) ? task.runHistory : [];
    task.runHistory = [record, ...history].slice(0, TASK_RUN_HISTORY_LIMIT);
  }

  private async executeTask(
    task: ScheduledTask,
    trigger: TaskExecutionTrigger,
  ): Promise<TaskExecutionResult> {
    if (this.runningTasks.has(task.id)) {
      const message = `任务 ${task.name} 正在执行，跳过重复触发`;
      const skippedAt = Date.now();
      console.warn(`⚠️ ${message}`);
      task.lastSkippedAt = skippedAt;
      task.lastSkipReason = message;
      await this.refreshTaskNextRun(task);
      this.recordTaskRun(task, {
        startedAt: skippedAt,
        completedAt: skippedAt,
        durationMs: 0,
        success: false,
        skipped: true,
        trigger,
        error: message,
      });
      await this.saveTaskStates();
      Logger.task(task.id, true, message, {
        category: task.category,
        skipped: true,
        trigger,
      });
      return { success: false, skipped: true, error: message };
    }

    this.runningTasks.add(task.id);
    const startTime = Date.now();
    task.lastRun = startTime;
    task.lastError = undefined;
    task.lastSkipReason = undefined;
    await this.refreshTaskNextRun(task);

    try {
      let taskResult: TaskExecutionResult | void;
      switch (task.id) {
        case 'message_analysis':
          taskResult = await this.executeMessageAnalysis();
          break;
        case 'memory_sync':
          taskResult = await this.executeMemorySync();
          break;
        case 'system_monitoring':
          taskResult = await this.executeSystemMonitoring();
          break;
        case 'user_profile_decay':
          taskResult = await this.executeUserProfileDecay();
          break;
        case 'vectorized_data_maintenance':
          taskResult = await this.executeVectorizedDataMaintenance();
          break;
        case 'user_summary_generation':
          taskResult = await this.executeUserSummaryGeneration();
          break;
        case 'vector_quality_check':
          taskResult = await this.executeVectorQualityCheck();
          break;
        case 'digest_queue_process':
          taskResult = await this.executeDigestQueueProcess();
          break;
        default:
          throw new Error(`未实现任务执行逻辑: ${task.id}`);
      }

      const duration = Date.now() - startTime;
      const completedAt = Date.now();
      const wasSkipped = taskResult?.skipped === true;
      const success = taskResult?.success ?? true;
      const resultMessage = taskResult?.error;
      const resultSummary = taskResult?.summary;
      const persistedResultSummary = resultSummary?.trim()
        ? resultSummary
        : undefined;
      task.lastCompletedAt = completedAt;
      task.lastSuccess = success;
      task.lastError = success ? undefined : resultMessage;
      task.lastResultSummary = persistedResultSummary;
      if (wasSkipped) {
        task.lastSkippedAt = completedAt;
        task.lastSkipReason = resultMessage || '任务条件未满足，已跳过';
      } else {
        task.lastSkipReason = undefined;
      }
      this.recordTaskRun(task, {
        startedAt: startTime,
        completedAt,
        durationMs: duration,
        success,
        skipped: wasSkipped || undefined,
        trigger,
        error: wasSkipped || !success ? resultMessage : undefined,
        summary: persistedResultSummary,
      });
      console.log(
        `${success ? '✅' : '❌'} 任务 ${task.name}${
          wasSkipped ? ' 已跳过' : ' 执行完成'
        }，耗时: ${duration}ms`,
      );

      const logContext: Record<string, unknown> = {
        duration: `${duration}ms`,
        category: task.category,
        skipped: wasSkipped || undefined,
      };
      if (resultSummary) {
        logContext.summary = resultSummary;
      }

      // 记录任务执行日志
      Logger.task(
        task.id,
        success,
        wasSkipped
          ? `${task.name} 已跳过: ${task.lastSkipReason}`
          : `${task.name} 执行完成`,
        logContext,
      );
      return {
        success,
        skipped: wasSkipped || undefined,
        error: resultMessage,
        summary: persistedResultSummary,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = getTaskErrorMessage(error);
      task.lastCompletedAt = Date.now();
      task.lastSuccess = false;
      task.lastError = errorMessage;
      this.recordTaskRun(task, {
        startedAt: startTime,
        completedAt: task.lastCompletedAt,
        durationMs: duration,
        success: false,
        trigger,
        error: errorMessage,
      });
      console.error(`❌ 任务 ${task.name} 执行失败:`, error);

      // 记录任务执行失败日志
      Logger.task(task.id, false, `${task.name} 执行失败: ${errorMessage}`, {
        duration: `${duration}ms`,
        category: task.category,
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    } finally {
      this.runningTasks.delete(task.id);
      await this.refreshTaskNextRun(task);
      await this.saveTaskStates();
    }
  }

  /**
   * 执行消息分析任务
   */
  private async executeMessageAnalysis(): Promise<TaskExecutionResult | void> {
    const startTime = Date.now();

    try {
      // 获取配置
      const config = await getEnvConfig();

      // 该任务已经通过 enabled 状态控制，无需额外检查

      // 获取用户信息
      const { userinfo } = await chrome.storage.local.get(['userinfo']);
      if (!userinfo || userinfo.fullName === '') {
        // 如果没有用户信息，跳过此次分析
        const skipReason = '用户信息不完整，跳过消息分析';
        console.log(`📝 ${skipReason}`);
        Logger.analysis('message_analysis', {
          result: `跳过 - ${skipReason}`,
          duration: Date.now() - startTime,
        });
        return { success: true, skipped: true, error: skipReason };
      }

      // 查找或创建 RingCentral 标签页
      let rcTab = await findRingCentralTab();
      if (!rcTab) {
        rcTab = await createRingCentralTab();
        await waitForTabLoad(rcTab.id);
      }

      // 计算分析时间范围
      // MESSAGE_CONTEXT_WINDOW 是从此刻往前推的绝对时间窗口
      const contextWindow = Number(config.MESSAGE_CONTEXT_WINDOW) || 125;
      const messageStartTime = new Date(Date.now() - contextWindow * 60 * 1000);

      console.log(
        `📝 开始消息分析，时间范围: 距离此刻 ${contextWindow} 分钟内的消息`,
      );

      // 发送消息获取请求
      const response = await this.sendMessageWithRetry(rcTab.id, {
        type: 'FETCH_USER_MESSAGES',
        startTime: messageStartTime,
      });

      const messagesCount = response.data?.length || 0;

      // 分析消息。这里延迟加载 messageDealing，避免轻量调度器导入路径拉入完整消息分析模块。
      const { analyzeMessages } = await import('../messageDealing');
      const analysisResult = await analyzeMessages(
        response.data,
        userinfo.fullName,
        true,
      );
      const taskResult = summarizeMessageAnalysisTaskRun(
        messagesCount,
        analysisResult,
      );

      const duration = Date.now() - startTime;
      console.log('📝 消息分析任务执行完成');

      // 记录消息分析日志
      Logger.analysis('message_analysis', {
        messagesCount,
        duration,
        result: taskResult.summary || `分析了 ${messagesCount} 条消息`,
        error: taskResult.success ? undefined : taskResult.error,
      });
      if (!taskResult.success) {
        console.warn(`⚠️ 消息分析任务存在部分失败: ${taskResult.error}`);
      }
      return taskResult;
    } catch (error: any) {
      console.error('❌ 消息分析任务失败:', error);

      // 记录消息分析错误日志
      Logger.analysis('message_analysis', {
        duration: Date.now() - startTime,
        error: error.message,
      });

      throw error; // 重新抛出以便 executeTask 记录
    }
  }

  /**
   * 执行记忆系统同步任务
   * Note: With the new Memory Service backend, cache sync is no longer needed.
   * The backend manages its own data persistence and synchronization.
   */
  private async executeMemorySync(): Promise<void> {
    try {
      await concernedItemsSyncService.runPeriodicSync();
      console.log('🔄 concernedItems 周期同步完成');
    } catch (error) {
      console.error('❌ 记忆系统同步任务失败:', error);
      throw error;
    }
  }

  /**
   * 执行系统监控任务
   */
  private async executeSystemMonitoring(): Promise<void> {
    try {
      // 执行健康检查（通过 Memory Service HTTP API）
      const client = getMemoryServiceClient();
      const healthStatus = await client.getHealth();
      console.log('🔍 系统健康检查完成:', healthStatus);

      // Note: System maintenance is now auto-managed by the backend Memory Service.
      // No explicit performSystemMaintenance() call needed.
      console.log('🔧 系统维护由后端自动管理');
    } catch (error) {
      console.error('❌ 系统监控任务失败:', error);
      throw error;
    }
  }

  /**
   * 执行用户画像权重衰变任务
   * Note: With the new Memory Service backend, profile decay is handled
   * automatically by the backend's ForgettingEngine. This is now a no-op.
   */
  private async executeUserProfileDecay(): Promise<void> {
    try {
      // No-op: backend ForgettingEngine handles profile decay automatically.
      console.log('🧠 用户画像权重衰变由后端自动管理');
    } catch (error) {
      console.error('❌ 用户画像权重衰变任务失败:', error);
      throw error;
    }
  }

  /**
   * 执行向量化数据维护任务
   * Note: With the new Memory Service backend, vectorized data maintenance
   * is handled automatically by the backend. This is now a no-op.
   */
  private async executeVectorizedDataMaintenance(): Promise<void> {
    try {
      // No-op: backend Memory Service handles vectorized data maintenance automatically.
      console.log('🔧 向量化数据维护由后端自动管理');
    } catch (error) {
      console.error('❌ 向量化数据维护任务失败:', error);
      throw error;
    }
  }

  /**
   * 执行用户概要生成任务
   * Note: With the new Memory Service backend, user summary generation
   * is handled by the backend's consolidation engine. We can optionally
   * fetch stats for logging purposes.
   */
  private async executeUserSummaryGeneration(): Promise<void> {
    try {
      console.log('📊 开始用户概要生成...');

      // Fetch stats from the backend for logging purposes
      const client = getMemoryServiceClient();
      const stats = await client.getStats();

      console.log('📈 当前存储统计:', {
        total_messages: stats.messages.total,
        total_entities: stats.entities.total,
        total_chunks: stats.chunks.total,
      });

      // No-op: backend consolidation engine handles summary generation automatically.
      console.log('📊 用户概要生成由后端自动管理');
    } catch (error) {
      console.error('❌ 用户概要生成任务失败:', error);
      throw error;
    }
  }

  /**
   * 执行向量质量检查任务
   * Uses the Memory Service backend health and stats endpoints to assess quality.
   */
  private async executeVectorQualityCheck(): Promise<void> {
    try {
      console.log('🔍 开始向量质量检查...');

      const client = getMemoryServiceClient();

      // Fetch health and stats from the backend
      const health = await client.getHealth();
      const stats = await client.getStats();

      const qualityChecks = {
        serviceStatus: health.status,
        dbConnected: health.database.connected,
        messageCount: health.database.messageCount,
        entityCount: health.database.entityCount,
        chunkCount: health.database.chunkCount,
        embeddingLoaded: health.embedding.loaded,
        embeddingModel: health.embedding.model,
        issues: [] as string[],
      };

      // 检查1: 服务状态
      if (health.status !== 'ok') {
        qualityChecks.issues.push(`服务状态异常: ${health.status}`);
      }

      // 检查2: 数据库连接
      if (!health.database.connected) {
        qualityChecks.issues.push('数据库未连接');
      }

      // 检查3: 嵌入模型
      if (!health.embedding.loaded) {
        qualityChecks.issues.push('嵌入模型未加载');
      }

      // 检查4: 记录数量
      if (health.database.messageCount === 0) {
        qualityChecks.issues.push('存储中无消息记录');
      } else if (health.database.messageCount > 100000) {
        qualityChecks.issues.push('消息记录数量过多，可能需要清理');
      }

      // 检查5: 实体分布
      if (stats.entities.total === 0) {
        qualityChecks.issues.push('无实体记录');
      }

      // 输出检查结果
      console.log('📊 向量质量检查结果:', qualityChecks);

      if (qualityChecks.issues.length > 0) {
        console.warn('⚠️ 发现质量问题:', qualityChecks.issues);
      } else {
        console.log('✅ 向量数据质量良好');
      }
    } catch (error) {
      console.error('❌ 向量质量检查任务失败:', error);
      throw error;
    }
  }

  /**
   * 执行汇总推送队列处理
   */
  private async executeDigestQueueProcess(): Promise<TaskExecutionResult> {
    try {
      console.log('📬 开始处理汇总推送队列...');

      // 确保 DigestQueueService 已初始化
      await digestQueueService.initialize();

      // 处理所有到期的 digest 任务
      const results = await digestQueueService.processAll();

      const successCount = results.filter((r) => r.success).length;
      const totalItems = results.reduce((sum, r) => sum + r.itemsProcessed, 0);
      const result = summarizeDigestQueueProcessResults(results);

      console.log(
        `✅ 汇总推送处理完成: ${successCount}/${results.length} 个任务成功, 共推送 ${totalItems} 条`,
      );
      if (!result.success) {
        console.warn(`⚠️ 汇总推送队列存在失败: ${result.error}`);
      }

      // 保存任务状态
      await digestQueueService.saveTaskStates();
      return result;
    } catch (error) {
      console.error('❌ 汇总推送队列处理失败:', error);
      throw error;
    }
  }

  /**
   * 带重试机制的消息发送函数
   */
  private sendMessageWithRetry(
    tabId: number,
    message: any,
    maxRetries = 3,
    retryInterval = 10000,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      let attempts = 0;

      const trySendMessage = () => {
        attempts++;
        chrome.tabs.sendMessage(tabId, message, async (response) => {
          if (chrome.runtime.lastError) {
            console.log(
              `Attempt ${attempts} failed:`,
              chrome.runtime.lastError,
            );
            if (attempts < maxRetries) {
              if (
                chrome.runtime.lastError.message?.includes(
                  'Could not establish connection',
                )
              ) {
                await chrome.tabs.reload(tabId);
              }
              setTimeout(trySendMessage, retryInterval);
            } else {
              reject(
                new Error('Failed to send message after multiple attempts'),
              );
            }
          } else if (response && !response.error) {
            resolve(response);
          } else if (attempts < maxRetries) {
            setTimeout(trySendMessage, retryInterval * 3);
          } else {
            const responseError =
              response?.error || 'Empty or error response from content script';
            reject(new Error(responseError));
          }
        });
      };

      trySendMessage();
    });
  }

  /**
   * 获取任务状态
   */
  public getTaskStatus(): Array<ScheduledTaskStatus> {
    return this.buildTaskStatus();
  }

  public async getTaskStatusFresh(
    options: TaskStatusOptions = {},
  ): Promise<Array<ScheduledTaskStatus>> {
    const result = await this.getTaskStatusFreshResult(options);
    return result.tasks;
  }

  public async getTaskStatusFreshResult(
    options: TaskStatusOptions = {},
  ): Promise<TaskSchedulerStatusFreshResult> {
    if (!this.isInitialized) {
      await this.startAllTasks();
    }

    let refreshSummary = createAlarmRefreshSummary(false);
    if (options.repairAlarms !== false) {
      refreshSummary = await this.ensureAlarmsCreated();
    }

    const alarms = await this.getExistingAlarms();
    const alarmByName = new Map(alarms.map((alarm) => [alarm.name, alarm]));

    for (const task of Array.from(this.tasks.values())) {
      if (!task.enabled) {
        task.nextRun = undefined;
        continue;
      }

      const alarm = alarmByName.get(`scheduled_task_${task.id}`);
      task.nextRun = alarm?.scheduledTime;
    }

    const status = this.buildTaskStatus(alarmByName);
    await this.enrichDigestQueueStatus(status);
    if (options.persist !== false) {
      await this.saveTaskStates();
    }
    return {
      tasks: status,
      refreshReceipt: buildTaskStatusRefreshReceipt(status, refreshSummary),
    };
  }

  private async enrichDigestQueueStatus(
    statuses: Array<ScheduledTaskStatus>,
  ): Promise<void> {
    const digestTask = statuses.find(
      (task) => task.id === 'digest_queue_process',
    );
    if (!digestTask) {
      return;
    }

    try {
      const summary = await digestQueueService.getQueueStatusSummary();
      digestTask.currentQueueStatus = summary;
      digestTask.currentQueueSummary = summarizeDigestQueueStatusSummary(summary);
    } catch (error) {
      console.warn('⚠️ 获取汇总推送队列状态失败:', error);
      digestTask.currentQueueStatusError = getTaskErrorMessage(error);
      digestTask.currentQueueSummary =
        summarizeDigestQueueStatusUnavailable(error);
    }
  }

  private buildTaskStatus(
    alarmByName?: Map<string, chrome.alarms.Alarm>,
  ): Array<ScheduledTaskStatus> {
    return Array.from(this.tasks.values()).map((task) => {
      const alarmName = `scheduled_task_${task.id}`;
      const alarm = alarmByName?.get(alarmName);
      const repairError = this.scheduleRepairErrors.get(task.id);
      let scheduleHealth: ScheduledTaskStatus['scheduleHealth'] = 'disabled';
      let scheduleWarning: string | undefined;

      if (task.enabled) {
        if (repairError) {
          scheduleHealth = 'repair_failed';
          scheduleWarning = `Chrome alarm 修复失败：${repairError}`;
        } else if (alarmByName && !alarm) {
          scheduleHealth = 'missing_alarm';
          scheduleWarning = '任务已启用，但未找到对应的 Chrome alarm';
        } else if (alarm && alarm.periodInMinutes !== task.intervalMinutes) {
          scheduleHealth = 'period_mismatch';
          scheduleWarning = `任务间隔为 ${
            task.intervalMinutes
          } 分钟，Chrome alarm 仍为 ${alarm.periodInMinutes ?? '一次性'} 排程`;
        } else if (alarm && isAlarmOverdue(task, alarm)) {
          const overdueMinutes = Math.max(
            1,
            Math.round(getAlarmOverdueMs(task, alarm) / 60_000),
          );
          scheduleHealth = 'overdue';
          scheduleWarning = `Chrome alarm 已超过预期触发时间 ${overdueMinutes} 分钟，建议手动执行或重新启用排程`;
        } else {
          scheduleHealth = 'scheduled';
        }
      }

      const isExecuting = this.runningTasks.has(task.id);
      const statusReceipt = buildTaskStatusReceipt(
        task,
        scheduleHealth,
        scheduleWarning,
        isExecuting,
      );

      return {
        ...task,
        status: this.isInitialized && task.enabled ? 'running' : 'stopped',
        isExecuting,
        scheduleHealth,
        scheduleWarning,
        statusReceipt,
      };
    });
  }

  /**
   * 启用/禁用特定任务
   */
  public async toggleTask(taskId: string, enabled: boolean): Promise<boolean> {
    if (!this.isInitialized) {
      console.log(`⚠️ 任务调度器未初始化，先启动后再控制任务: ${taskId}`);
      await this.startAllTasks();
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      console.error(`❌ 任务不存在: ${taskId}`);
      return false;
    }

    const previousState = {
      enabled: task.enabled,
      nextRun: task.nextRun,
    };
    const alarmName = `scheduled_task_${taskId}`;

    task.enabled = enabled;
    try {
      if (enabled) {
        await this.createTaskAlarm(task);
      } else {
        await this.clearAlarm(alarmName);
        task.nextRun = undefined;
      }

      // 保存任务状态变更
      await this.saveTaskStates();
    } catch (error) {
      task.enabled = previousState.enabled;
      task.nextRun = previousState.nextRun;
      if (!previousState.enabled) {
        await this.clearAlarm(alarmName);
      }
      await this.saveTaskStates();
      throw error;
    }

    console.log(
      `${enabled ? '✅' : '❌'} 任务 ${task.name} ${
        enabled ? '已启用' : '已禁用'
      }`,
    );
    return true;
  }

  /**
   * 修复/重排单个任务的 Chrome alarm。
   * 用于 popup 对过期、丢失或间隔不一致的排程提供一键恢复入口。
   */
  public async repairTaskSchedule(taskId: string): Promise<boolean> {
    if (!this.isInitialized) {
      console.log(`⚠️ 任务调度器未初始化，先启动后再修复排程: ${taskId}`);
      await this.startAllTasks();
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      console.error(`❌ 任务不存在: ${taskId}`);
      return false;
    }

    const alarmName = `scheduled_task_${taskId}`;
    if (!task.enabled) {
      await this.clearAlarm(alarmName);
      task.nextRun = undefined;
      await this.saveTaskStates();
      console.log(`ℹ️ 任务 ${task.name} 已停用，无需修复排程`);
      return true;
    }

    try {
      await this.createTaskAlarm(task);
      await this.saveTaskStates();
      console.log(`✅ 任务 ${task.name} 排程已修复`);
      Logger.task(task.id, true, `${task.name} 排程已修复`, {
        category: task.category,
      });
      return true;
    } catch (error) {
      await this.refreshTaskNextRun(task);
      await this.saveTaskStates();
      throw error;
    }
  }

  /**
   * 手动执行指定任务
   */
  public async runTaskManuallyWithResult(
    taskId: string,
  ): Promise<TaskExecutionResult> {
    if (!this.isInitialized) {
      console.log(`⚠️ 任务调度器未初始化，先启动后再手动执行任务: ${taskId}`);
      await this.startAllTasks();
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      const error = `任务不存在: ${taskId}`;
      console.error(`❌ ${error}`);
      return { success: false, error };
    }

    console.log(`🔧 手动执行任务: ${task.name}`);
    return this.executeTask(task, 'manual');
  }

  public async runTaskManually(taskId: string): Promise<boolean> {
    const result = await this.runTaskManuallyWithResult(taskId);
    return result.success;
  }

  /**
   * 重新加载 message_analysis 任务的间隔配置
   * 注意：通常不需要手动调用此方法，因为任务调度器会自动监听配置变化
   * 此方法主要用于测试或特殊场景下的手动触发
   */
  public async reloadMessageAnalysisInterval(): Promise<boolean> {
    const task = this.tasks.get('message_analysis');
    if (!task) {
      console.error('❌ message_analysis 任务不存在');
      return false;
    }

    // 读取最新配置
    const config = await getEnvConfig();
    const newInterval = resolveMessageAnalysisInterval(config);

    // 如果间隔没有变化，不需要更新
    if (task.intervalMinutes === newInterval) {
      console.log(`⚙️ message_analysis 任务间隔未变化: ${newInterval} 分钟`);
      return false;
    }

    // 更新间隔时间
    const oldInterval = task.intervalMinutes;
    task.intervalMinutes = newInterval;
    console.log(
      `⚙️ message_analysis 任务间隔已更新: ${oldInterval} -> ${newInterval} 分钟`,
    );

    // 如果任务已启用，需要重新创建 alarm
    if (task.enabled && this.isInitialized) {
      try {
        await this.createTaskAlarm(task);
        console.log('✅ 定时器已更新');
      } catch (error) {
        this.scheduleRepairErrors.set(task.id, getTaskErrorMessage(error));
        await this.refreshTaskNextRun(task);
        await this.saveTaskStates();
        throw error;
      }
    }

    // 保存状态
    await this.saveTaskStates();

    return true;
  }
}

// 导出单例实例
export const taskScheduler = TaskScheduler.getInstance();
