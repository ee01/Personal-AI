import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect } from 'react';
import { sendMessageToActiveTab } from './popup';
import { getEnvConfig } from './utils';
import { openMemoryEntryRules } from './utils/memoryEntryRulesNavigation';
import { getGoogleAuthToken } from './utils/googleAuth';
import {
  getMemoryServiceClient,
  type AmbientCalibrationEvidenceRef,
  type DayPilotBrief,
  type DayPilotCard,
  type DayPilotContextPackResponse,
  type DayPilotTodayResponse,
} from './services/MemoryServiceClient';
import { getTaskEnabled } from './services/taskSchedulerDefinitions';
import {
  countTasksByStatusFilter,
  getTaskFailureStreak,
  getTaskAttentionRank,
  getTaskPrimaryAttentionRank,
  getTaskStatusKind,
  hasTaskRecentSkip,
  hasTaskScheduleWarning,
  shouldRecommendTaskPause,
  taskNeedsAttention,
} from './services/taskSchedulerStatusFilters';
import {
  extractMeetingIdFromUrl,
  MeetingPilotSessionSnapshot,
} from './meeting-shell/protocol';
import {
  countTodayPilotCandidates,
  countTodayPilotRawSignals,
  countTodayPilotSelectedEvidence,
  getTodayPilotSourceStatItems,
  summarizeTodayPilotNoiseBreakdown,
} from './todayPilotSourceStats';
import { DIGEST_QUEUE_RELEASE_CHECK_INTERVAL_MINUTES } from './services/digestQueueConfig';
import { useExtensionUiLanguage, useStaticDomI18n } from './i18n/react';
import type { UiLanguage } from './i18n';

const WIKI_URL =
  'https://wiki.ringcentral.com/spaces/XTO/pages/911054301/Personal+AI+-+Tools';
const DOUBAO_ICON_URL =
  typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL('icons/connect-doubao.png')
    : '';

const Toggle = ({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) => (
  <div className="toggle-container">
    <span className="toggle-label">{label}</span>
    <label className="toggle-switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className="toggle-slider"></span>
    </label>
  </div>
);

interface TaskSchedulerTask {
  id: string;
  name: string;
  category: string;
  intervalMinutes: number;
  description: string;
  enabled: boolean;
  status: 'running' | 'stopped';
  isExecuting?: boolean;
  lastRun?: number;
  lastCompletedAt?: number;
  lastSkippedAt?: number;
  lastSuccess?: boolean;
  lastError?: string;
  lastSkipReason?: string;
  lastResultSummary?: string;
  nextRun?: number;
  scheduleHealth?:
    | 'scheduled'
    | 'missing_alarm'
    | 'period_mismatch'
    | 'overdue'
    | 'repair_failed'
    | 'disabled';
  scheduleWarning?: string;
  statusReceipt?: TaskSchedulerStatusReceipt;
  currentQueueSummary?: string;
  currentQueueStatus?: DigestQueueStatusSummary;
  currentQueueStatusError?: string;
  runHistory?: TaskSchedulerRunRecord[];
}

interface DigestQueueStatusSummary {
  totalItems: number;
  dueItems: number;
  nextReleaseAt?: string;
  checkedAt?: string;
  tasks?: DigestQueueTaskSnapshot[];
}

interface DigestQueueTaskSnapshot {
  taskId: string;
  taskName?: string;
  totalItems: number;
  dueItems: number;
  nextReleaseAt?: string;
  sourceBreakdown?: DigestQueueSourceBreakdownItem[];
  sourceOverflowCount?: number;
  scheduleBreakdown?: DigestQueueScheduleBreakdownItem[];
  scheduleOverflowCount?: number;
}

interface DigestQueueSourceBreakdownItem {
  label: string;
  count: number;
}

interface DigestQueueScheduleBreakdownItem {
  frequency: 'daily' | 'weekly';
  preferredHour: number;
  preferredDayOfWeek?: number;
  count: number;
}

interface DigestQueueStatusUi {
  heading: string;
  totalLine: string;
  dueLine: string;
  nextLine?: string;
  snapshotLine?: string;
  dueReceiptLine?: string;
  taskLines: string[];
  boundaryLine: string;
  title: string;
}

interface TaskSchedulerStatusReceipt {
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

interface TaskSchedulerStatusRefreshReceipt {
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
  queueStatusUnavailableCount?: number;
  alarmCalibrations?: TaskSchedulerAlarmCalibration[];
  refreshOnly: true;
}

interface TaskSchedulerAlarmCalibration {
  taskId: string;
  taskName: string;
  action:
    | 'created'
    | 'updated'
    | 'disabled_cleared'
    | 'orphaned_cleared'
    | 'failed';
  detail?: string;
}

interface TaskSchedulerRunRecord {
  startedAt: number;
  completedAt: number;
  durationMs: number;
  success: boolean;
  skipped?: boolean;
  trigger?: 'scheduled' | 'manual' | 'startup';
  error?: string;
  summary?: string;
}

interface TaskSchedulerActionReceipt {
  taskId: string;
  tone: 'success' | 'warning' | 'failed';
  label: string;
  detail: string;
  boundary: string;
  createdAt: number;
}

interface TaskSchedulerRefreshFailureReceipt {
  label: string;
  detail: string;
  boundary: string;
  createdAt: number;
}

interface TaskSchedulerRefreshPendingReceipt {
  label: string;
  detail: string;
  boundary: string;
}

interface TaskSchedulerPendingActionReceipt {
  tone: 'pending';
  label: string;
  detail: string;
  nextAction: string;
}

interface TaskSchedulerHeaderPendingReceipt {
  label: string;
  detail: string;
  boundary: string;
}

type TaskSchedulerPendingAction =
  | 'toggle-enable'
  | 'toggle-disable'
  | 'run'
  | 'repair';

type MeetingPilotNotice = {
  tone: 'info' | 'warning' | 'error';
  message: string;
  action?: 'options';
};

const MEETING_PILOT_LOCAL_CAPTURE_BOUNDARY =
  '这是本机 Chrome tab capture 授权请求；提交中尚未确认录制开始，也不会通知参会者、发送会议内容、创建纪要、写入外部任务，或代表你取得录制同意。';

const TASK_CATEGORY_LABELS: Record<UiLanguage, Record<string, string>> = {
  'zh-CN': {
    message_analysis: '消息',
    data_sync: '同步',
    system_maintenance: '维护',
    user_profile: '画像',
  },
  'en-US': {
    message_analysis: 'Messages',
    data_sync: 'Sync',
    system_maintenance: 'Maintenance',
    user_profile: 'Profile',
  },
};
const TASK_ENGLISH_DISPLAY_TEXT: Record<
  string,
  { name: string; description: string }
> = {
  message_analysis: {
    name: 'Analyze msg in background',
    description: 'Analyze RingCentral messages in the background.',
  },
  memory_sync: {
    name: 'Memory sync',
    description: 'Sync local and cloud memory data.',
  },
  system_monitoring: {
    name: 'System health',
    description: 'Run system health checks and automatic maintenance.',
  },
  user_profile_decay: {
    name: 'Profile decay',
    description: 'Apply natural decay to user profile weights.',
  },
  vectorized_data_maintenance: {
    name: 'Vector maintenance',
    description: 'Clean old vector records and refresh embeddings.',
  },
  user_summary_generation: {
    name: 'Profile summary',
    description: 'Generate and refresh user behavior summaries.',
  },
  vector_quality_check: {
    name: 'Vector quality check',
    description: 'Check vector data quality and repair abnormal records.',
  },
  digest_queue_process: {
    name: 'Digest queue',
    description: 'Process due digest delivery tasks.',
  },
};
const TASK_ATTENTION_SUMMARY_LIMIT = 3;
const TASK_COLLAPSED_ATTENTION_PREVIEW_LIMIT = 2;

function isEnglishUi(language: UiLanguage): boolean {
  return language === 'en-US';
}

function getTaskDisplayName(
  task: Pick<TaskSchedulerTask, 'id' | 'name'>,
  language: UiLanguage,
): string {
  if (isEnglishUi(language)) {
    return TASK_ENGLISH_DISPLAY_TEXT[task.id]?.name || task.name;
  }
  return task.name;
}

function getTaskDisplayDescription(
  task: Pick<TaskSchedulerTask, 'id' | 'description'>,
  language: UiLanguage,
): string {
  if (isEnglishUi(language)) {
    return TASK_ENGLISH_DISPLAY_TEXT[task.id]?.description || task.description;
  }
  return task.description;
}

function getTaskCategoryLabel(category: string, language: UiLanguage): string {
  return (
    TASK_CATEGORY_LABELS[language]?.[category] ||
    TASK_CATEGORY_LABELS['zh-CN'][category] ||
    (isEnglishUi(language) ? 'Task' : '任务')
  );
}

function pluralizeEn(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
}

function formatTaskInterval(
  minutes: number,
  language: UiLanguage = 'zh-CN',
): string {
  if (isEnglishUi(language)) {
    if (minutes >= 1440 && minutes % 1440 === 0) {
      const days = minutes / 1440;
      return pluralizeEn(days, 'day');
    }
    if (minutes >= 60 && minutes % 60 === 0) {
      const hours = minutes / 60;
      return pluralizeEn(hours, 'hour');
    }
    return `${minutes} min`;
  }
  if (minutes >= 1440 && minutes % 1440 === 0) {
    return `${minutes / 1440} 天`;
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60} 小时`;
  }
  return `${minutes} 分钟`;
}

function formatTaskRelativeTime(
  value?: number,
  now = Date.now(),
  language: UiLanguage = 'zh-CN',
): string {
  if (!value) return isEnglishUi(language) ? 'Not scheduled' : '未排程';

  const diffMs = value - now;
  if (diffMs <= 0) {
    return isEnglishUi(language) ? 'waiting to run' : '等待触发';
  }

  const totalMinutes = Math.max(1, Math.ceil(diffMs / 60_000));
  if (totalMinutes < 60) {
    if (isEnglishUi(language)) return `in ${totalMinutes} min`;
    return `${totalMinutes} 分钟后`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) {
    if (isEnglishUi(language)) {
      return minutes > 0
        ? `in ${hours}h ${minutes}m`
        : `in ${pluralizeEn(hours, 'hour')}`;
    }
    return minutes > 0 ? `${hours} 小时 ${minutes} 分钟后` : `${hours} 小时后`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (isEnglishUi(language)) {
    return remainingHours > 0 ? `in ${days}d ${remainingHours}h` : `in ${days}d`;
  }
  return remainingHours > 0 ? `${days} 天 ${remainingHours} 小时后` : `${days} 天后`;
}

function formatTaskTime(
  value?: number,
  language: UiLanguage = 'zh-CN',
): string {
  if (!value) return isEnglishUi(language) ? 'Not scheduled' : '未排程';
  return new Date(value).toLocaleString(language, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildDigestQueueStatusUi(
  summary: DigestQueueStatusSummary | undefined,
  fallbackSummary: string | undefined,
  statusError: string | undefined,
  language: UiLanguage = 'zh-CN',
): DigestQueueStatusUi | undefined {
  const isEnglish = isEnglishUi(language);
  const normalizedStatusError = statusError?.trim();

  if (normalizedStatusError) {
    const boundaryLine = isEnglish
      ? 'This refresh did not send digest items, write to Memory Service, or confirm notifications; retry later or check local digest settings.'
      : '本次刷新没有立即发送摘要、不写入 Memory Service、不确认通知；可稍后重试或检查本地摘要配置。';
    const taskLine = isEnglish
      ? `Read failed: ${normalizedStatusError}`
      : `失败原因：${normalizedStatusError}`;
    return {
      heading: isEnglish ? 'Local digest queue' : '本地摘要队列',
      totalLine: isEnglish ? 'Status not confirmed' : '状态未确认',
      dueLine: isEnglish
        ? 'Queue details were not read in this refresh'
        : '本次未读取到队列明细',
      taskLines: [taskLine],
      boundaryLine,
      title: [taskLine, boundaryLine].join(' · '),
    };
  }

  if (summary && summary.totalItems <= 0) {
    const fallback = fallbackSummary?.trim();
    const heading = isEnglish ? 'Local digest queue' : '本地摘要队列';
    const totalLine = isEnglish
      ? 'Current local queue is empty'
      : '当前本地队列为空';
    const dueLine = isEnglish ? 'No items due now' : '没有到期条目';
    const snapshotLine = summary.checkedAt
      ? isEnglish
        ? `Queue snapshot ${formatTaskTime(
            new Date(summary.checkedAt).getTime(),
            language,
          )}; separate from the latest background run result.`
        : `队列快照 ${formatTaskTime(
            new Date(summary.checkedAt).getTime(),
            language,
          )}；独立于最近一次后台运行结果。`
      : undefined;
    const taskLines = fallback
      ? [
          isEnglish
            ? `Latest run record: ${fallback}`
            : `最近运行记录：${fallback}`,
        ]
      : [];
    const boundaryLine = isEnglish
      ? 'Current snapshot only: there are no local delayed digest items queued; viewing or refreshing does not send now, write to Memory Service, or confirm notifications.'
      : '当前快照：本机没有等待释放的本地摘要；查看或刷新不立即发送、不写入 Memory Service、不确认通知。';
    const titleParts = [
      heading,
      totalLine,
      dueLine,
      snapshotLine,
      ...taskLines,
      boundaryLine,
    ].filter(Boolean);

    return {
      heading,
      totalLine,
      dueLine,
      snapshotLine,
      taskLines,
      boundaryLine,
      title: titleParts.join(' · '),
    };
  }

  if (!summary) {
    const fallback = fallbackSummary?.trim();
    return fallback
      ? {
          heading: isEnglish ? 'Local digest queue' : '本地摘要队列',
          totalLine: fallback,
          dueLine: isEnglish
            ? 'Last confirmed status only'
            : '仅显示上次确认状态',
          taskLines: [],
          boundaryLine: isEnglish
            ? 'Viewing or refreshing does not send now, write to Memory Service, or confirm notifications.'
            : '查看或刷新不立即发送、不写入 Memory Service、不确认通知。',
          title: fallback,
        }
      : undefined;
  }

  const itemLabel = isEnglish
    ? pluralizeEn(summary.totalItems, 'item')
    : `${summary.totalItems} 条`;
  const dueLine =
    summary.dueItems > 0
      ? isEnglish
        ? `${pluralizeEn(summary.dueItems, 'item')} in the release window`
        : `${summary.dueItems} 条已到释放窗口`
      : isEnglish
      ? 'No items due yet'
      : '暂无到期条目';
  const nextLine = summary.nextReleaseAt
    ? isEnglish
      ? `Earliest future release ${formatTaskTime(
          new Date(summary.nextReleaseAt).getTime(),
          language,
        )}`
      : `最早后续释放 ${formatTaskTime(
          new Date(summary.nextReleaseAt).getTime(),
          language,
        )}`
    : undefined;
  const snapshotLine = summary.checkedAt
    ? isEnglish
      ? `Queue snapshot ${formatTaskTime(
          new Date(summary.checkedAt).getTime(),
          language,
        )}; separate from the latest background run result.`
      : `队列快照 ${formatTaskTime(
          new Date(summary.checkedAt).getTime(),
          language,
        )}；独立于最近一次后台运行结果。`
    : undefined;
  const taskLines = (summary.tasks || [])
    .map((task) => formatDigestQueueTaskSummaryForUi(task, language))
    .filter(Boolean);
  const dueReceiptLine =
    summary.dueItems > 0
      ? isEnglish
        ? `Release-window receipt: ${pluralizeEn(
            summary.dueItems,
            'item',
          )} ready for the next background task; refreshing status does not send now.`
        : `释放窗口回执：${summary.dueItems} 条已具备发送资格，等待后台任务推送；刷新状态不会立即发送。`
      : undefined;
  const boundaryLine = isEnglish
    ? `Local delayed digest: after the release window, the background task checks within about ${DIGEST_QUEUE_RELEASE_CHECK_INTERVAL_MINUTES} minutes; viewing or refreshing does not send now, write to Memory Service, or confirm notifications.`
    : `本地延迟摘要：到达释放窗口后由后台任务推送，通常 ${DIGEST_QUEUE_RELEASE_CHECK_INTERVAL_MINUTES} 分钟内检查；查看或刷新不立即发送、不写入 Memory Service、不确认通知。`;
  const heading = isEnglish ? 'Local digest queue' : '本地摘要队列';
  const totalLine = isEnglish
    ? `${itemLabel} pending locally`
    : `${itemLabel}本地待释放`;
  const titleParts = [
    heading,
    totalLine,
    dueLine,
    nextLine,
    snapshotLine,
    ...taskLines,
    dueReceiptLine,
    boundaryLine,
  ].filter(Boolean);

  return {
    heading,
    totalLine,
    dueLine,
    nextLine,
    snapshotLine,
    dueReceiptLine,
    taskLines,
    boundaryLine,
    title: titleParts.join(isEnglish ? ' · ' : ' · '),
  };
}

function isDigestQueueProcessTask(task: TaskSchedulerTask): boolean {
  return task.id === 'digest_queue_process';
}

function formatDigestQueueRunBoundary(
  task: TaskSchedulerTask,
  isBusy: boolean,
  language: UiLanguage = 'zh-CN',
): string | null {
  if (!isDigestQueueProcessTask(task)) {
    return null;
  }

  const isEnglish = isEnglishUi(language);
  const statusError = task.currentQueueStatusError?.trim();
  const summary = task.currentQueueStatus;

  if (isBusy || task.isExecuting) {
    return isEnglish
      ? 'Local digest queue run is already in progress; another click is recorded as skipped, not as a second digest release.'
      : '本地摘要队列正在执行；重复点击只会记录为跳过，不会启动第二次摘要释放。';
  }

  if (statusError) {
    return isEnglish
      ? `Local digest status is not confirmed (${statusError}); Run now will re-read the local queue and try to release due digest items once. Send, retain, or failure outcome is only confirmed by this run receipt; it does not write to Memory Service, confirm notifications, clear history, or change the automatic schedule.`
      : `本地摘要状态未确认（${statusError}）；立即执行会重新读取本机队列并尝试释放到期摘要一次。是否发送、保留或失败只以本次运行回执为准；不会写入 Memory Service、确认通知、清空历史或改变自动排程。`;
  }

  if (!summary) {
    return isEnglish
      ? 'Local digest snapshot is unavailable; Run now will initialize the local queue and process due digest items once. The run receipt is the source of truth; it does not write to Memory Service, confirm notifications, clear history, or change the automatic schedule.'
      : '当前没有本地摘要快照；立即执行会初始化本机队列并处理到期摘要一次。结果以运行回执为准；不会写入 Memory Service、确认通知、清空历史或改变自动排程。';
  }

  const totalItems = Math.max(0, summary.totalItems || 0);
  const dueItems = Math.max(0, summary.dueItems || 0);

  if (totalItems <= 0) {
    return isEnglish
      ? 'Current local digest queue is empty; Run now only checks the queue and does not send an empty digest. It does not write to Memory Service, confirm notifications, clear history, or change the automatic schedule.'
      : '当前本地摘要队列为空；立即执行只检查队列，不会发送空摘要。不会写入 Memory Service、确认通知、清空历史或改变自动排程。';
  }

  if (dueItems > 0) {
    return isEnglish
      ? `Current snapshot has ${totalItems} local digest item(s), ${dueItems} in the release window; Run now processes due digest items once and may send them through the configured channel. Future items remain queued locally. It does not write to Memory Service, confirm notifications, clear history, or change the automatic schedule.`
      : `当前快照有 ${totalItems} 条本地摘要，${dueItems} 条已到释放窗口；立即执行会处理到期摘要一次，并可能发送到配置渠道。未到期条目继续留在本机队列；不会写入 Memory Service、确认通知、清空历史或改变自动排程。`;
  }

  return isEnglish
    ? `Current snapshot has ${totalItems} local digest item(s), none due yet; Run now only checks the queue and will not send future digest items early. Items remain queued locally. It does not write to Memory Service, confirm notifications, clear history, or change the automatic schedule.`
    : `当前快照有 ${totalItems} 条本地摘要，暂无到期条目；立即执行只检查队列，不会提前发送未到期摘要。条目继续留在本机队列；不会写入 Memory Service、确认通知、清空历史或改变自动排程。`;
}

function formatDigestQueueTaskSummaryForUi(
  task: DigestQueueTaskSnapshot,
  language: UiLanguage = 'zh-CN',
): string {
  const isEnglish = isEnglishUi(language);
  const taskName =
    isEnglish && task.taskId === 'concerned_items_daily'
      ? 'Concerned items digest'
      : task.taskName || task.taskId;
  const countText = isEnglish
    ? pluralizeEn(task.totalItems, 'item')
    : `${task.totalItems} 条`;
  const dueText =
    task.dueItems > 0
      ? isEnglish
        ? `, ${pluralizeEn(task.dueItems, 'item')} due`
        : `，${task.dueItems} 条已到期`
      : '';
  const sourceText = formatDigestQueueSourcesForUi(task, language);
  const scheduleText = formatDigestQueueSchedulesForUi(task, language);
  const details = [sourceText, scheduleText].filter(Boolean);

  return `${taskName} ${countText}${dueText}${
    details.length > 0
      ? ` (${details.join(isEnglish ? '; ' : '；')})`
      : ''
  }`;
}

function formatDigestQueueSourcesForUi(
  task: DigestQueueTaskSnapshot,
  language: UiLanguage = 'zh-CN',
): string {
  const entries = task.sourceBreakdown || [];
  if (entries.length === 0) return '';

  const isEnglish = isEnglishUi(language);
  const sourceText = entries
    .map((entry) =>
      isEnglish
        ? `${entry.label} x${entry.count}`
        : `${entry.label} ${entry.count} 条`,
    )
    .join(isEnglish ? ', ' : '、');
  const overflow = task.sourceOverflowCount || 0;
  if (overflow <= 0) return sourceText;

  return isEnglish
    ? `${sourceText}, ${overflow} more focus ${overflow === 1 ? 'rule' : 'rules'}`
    : `${sourceText}、另 ${overflow} 个关注项`;
}

function formatDigestQueueSchedulesForUi(
  task: DigestQueueTaskSnapshot,
  language: UiLanguage = 'zh-CN',
): string {
  const entries = task.scheduleBreakdown || [];
  if (entries.length === 0) return '';

  const isEnglish = isEnglishUi(language);
  const scheduleText = entries
    .map((entry) => formatDigestQueueScheduleForUi(entry, language))
    .join(isEnglish ? ', ' : '、');
  const overflow = task.scheduleOverflowCount || 0;
  if (overflow <= 0) return scheduleText;

  return isEnglish
    ? `${scheduleText}, ${overflow} more schedules`
    : `${scheduleText}、另 ${overflow} 个释放节奏`;
}

function formatDigestQueueScheduleForUi(
  entry: DigestQueueScheduleBreakdownItem,
  language: UiLanguage = 'zh-CN',
): string {
  const isEnglish = isEnglishUi(language);
  const hour = `${String(entry.preferredHour).padStart(2, '0')}:00`;
  const countText =
    entry.count > 1
      ? isEnglish
        ? ` x${entry.count}`
        : ` ${entry.count} 条`
      : '';

  if (entry.frequency === 'weekly') {
    const weekday = isEnglish
      ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
          entry.preferredDayOfWeek ?? 1
        ] || 'Mon'
      : ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][
          entry.preferredDayOfWeek ?? 1
        ] || '周一';
    return isEnglish
      ? `weekly ${weekday} ${hour}${countText}`
      : `每周${weekday} ${hour}${countText}`;
  }

  return isEnglish ? `daily ${hour}${countText}` : `每日 ${hour}${countText}`;
}

function formatTaskRefreshTime(
  value: number,
  language: UiLanguage = 'zh-CN',
): string {
  return new Date(value).toLocaleTimeString(language, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function appendTaskResultSummary(detail: string, summary?: string): string {
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

function getLocalTaskTimeZoneLabel(language: UiLanguage = 'zh-CN'): string {
  return (
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    (isEnglishUi(language) ? 'Local time zone' : '本机时区')
  );
}

function formatTaskSchedulerStatusError(
  errorMessage: string,
  options: {
    hasSnapshot: boolean;
    snapshotRefreshedAt: number;
    language: UiLanguage;
  },
): string {
  const message =
    errorMessage ||
    (isEnglishUi(options.language)
      ? 'Task status is unavailable'
      : '任务状态不可用');

  if (!options.hasSnapshot) {
    return isEnglishUi(options.language)
      ? `Task status refresh failed: ${message}. No previous task snapshot is available.`
      : `后台任务状态读取失败：${message}。当前没有可用任务快照。`;
  }

  const snapshotTime = formatTaskRefreshTime(
    options.snapshotRefreshedAt,
    options.language,
  );
  return isEnglishUi(options.language)
    ? `Task status refresh failed: ${message}. The list below is the last snapshot from ${snapshotTime}; current Chrome alarms and running state are not confirmed.`
    : `后台任务状态读取失败：${message}。下方仍是 ${snapshotTime} 的上次快照；当前 Chrome alarm 和执行状态未确认。`;
}

function buildTaskSchedulerRefreshFailureReceipt(
  errorMessage: string,
  options: {
    hasSnapshot: boolean;
    snapshotRefreshedAt: number;
    language: UiLanguage;
  },
): TaskSchedulerRefreshFailureReceipt {
  const isEnglish = isEnglishUi(options.language);
  const message =
    errorMessage ||
    (isEnglish ? 'Task status is unavailable' : '任务状态不可用');
  const snapshotTime = formatTaskRefreshTime(
    options.snapshotRefreshedAt,
    options.language,
  );

  return {
    label: isEnglish ? 'Refresh not confirmed' : '刷新未确认',
    detail: options.hasSnapshot
      ? isEnglish
        ? `This refresh failed: ${message}. The list below is the last snapshot from ${snapshotTime}.`
        : `本次读取失败：${message}。下方仍是 ${snapshotTime} 的上次快照。`
      : isEnglish
      ? `This refresh failed: ${message}. No previous task snapshot is available.`
      : `本次读取失败：${message}。当前没有可用任务快照。`,
    boundary: isEnglish
      ? 'It did not confirm current Chrome alarms or running state, and it did not run, enable, pause, repair tasks, or clear history.'
      : '没有确认当前 Chrome alarm 或执行状态，也没有立即执行、启用、停用、修复任务或清空历史。',
    createdAt: Date.now(),
  };
}

function buildTaskSchedulerRefreshPendingReceipt(options: {
  hasSnapshot: boolean;
  snapshotRefreshedAt: number;
  language: UiLanguage;
}): TaskSchedulerRefreshPendingReceipt {
  const isEnglish = isEnglishUi(options.language);
  const snapshotTime = formatTaskRefreshTime(
    options.snapshotRefreshedAt,
    options.language,
  );

  return {
    label: isEnglish ? 'Checking status' : '正在核对',
    detail: options.hasSnapshot
      ? isEnglish
        ? `The list below is still the last confirmed snapshot from ${snapshotTime}.`
        : `下方仍是 ${snapshotTime} 的上次确认快照。`
      : isEnglish
      ? 'No confirmed task snapshot is available yet.'
      : '当前还没有已确认的任务快照。',
    boundary: isEnglish
      ? 'This request is only reading task status and calibrating Chrome alarms; it has not run, enabled, paused, repaired tasks, or cleared history.'
      : '本次只在读取任务状态并校准 Chrome alarm；尚未立即执行、启用、停用、修复任务或清空历史。',
  };
}

function buildTaskSchedulerPendingActionReceipt(
  task: TaskSchedulerTask,
  action: TaskSchedulerPendingAction,
  language: UiLanguage,
): TaskSchedulerPendingActionReceipt {
  const isEnglish = isEnglishUi(language);
  const displayName = getTaskDisplayName(task, language);
  if (action === 'toggle-enable' || action === 'toggle-disable') {
    const isEnable = action === 'toggle-enable';
    return {
      tone: 'pending',
      label: isEnglish
        ? isEnable
          ? 'Enable pending'
          : 'Pause pending'
        : isEnable
        ? '启用确认中'
        : '停用确认中',
      detail: isEnglish
        ? `${displayName} is still showing the last confirmed schedule state.`
        : `${displayName} 仍显示上次确认的排程状态。`,
      nextAction: isEnglish
        ? isEnable
          ? 'Wait for confirmation before trusting the enabled state or next run time'
          : 'Wait for confirmation before treating the schedule as paused'
        : isEnable
        ? '等待后台确认后再显示已启用和下一次执行时间'
        : '等待后台确认后再显示停用；不会提前清掉历史或下次执行时间',
    };
  }

  if (action === 'run') {
    return {
      tone: 'pending',
      label: isEnglish ? 'Run pending' : '执行确认中',
      detail: isEnglish
        ? `${displayName} is still showing the last confirmed run snapshot.`
        : `${displayName} 仍显示上次确认的运行快照。`,
      nextAction: isEnglish
        ? 'Wait for this one-time run to finish; history and schedule are unchanged until confirmed'
        : '等待本次一次性执行完成；确认前不会改写历史或自动排程',
    };
  }

  return {
    tone: 'pending',
    label: isEnglish ? 'Reschedule pending' : '重排确认中',
    detail: isEnglish
      ? `${displayName} is still showing the last confirmed schedule snapshot.`
      : `${displayName} 仍显示上次确认的排程快照。`,
    nextAction: isEnglish
      ? 'Wait for the background response before trusting the next run time'
      : '等待后台返回后再确认下一次执行时间',
  };
}

function buildTaskSchedulerHeaderTogglePendingReceipt({
  action,
  task,
  language,
}: {
  action: 'toggle-enable' | 'toggle-disable';
  task?: TaskSchedulerTask;
  language: UiLanguage;
}): TaskSchedulerHeaderPendingReceipt {
  const isEnglish = isEnglishUi(language);
  const isEnable = action === 'toggle-enable';
  const displayName = task
    ? getTaskDisplayName(task, language)
    : isEnglish
    ? 'Background message analysis'
    : '静默消息分析';

  return {
    label: isEnglish
      ? isEnable
        ? 'Schedule enable pending'
        : 'Schedule pause pending'
      : isEnable
      ? '排程启用提交中'
      : '排程停用提交中',
    detail: isEnglish
      ? `${displayName} still reflects the last confirmed state; the background has not confirmed ${
          isEnable ? 'the enabled state or next run time' : 'the paused state'
        } yet.`
      : `${displayName} 仍显示上次确认状态；后台尚未确认${
          isEnable ? '启用和下一次执行时间' : '停用'
        }。`,
    boundary: isEnglish
      ? 'It has not run the task, confirmed a Chrome alarm, updated the next run time, or cleared run history.'
      : '尚未立即执行任务、确认 Chrome alarm、更新下一次执行时间或清空运行历史。',
  };
}

function formatTaskSchedulerRefreshReceipt(
  receipt: TaskSchedulerStatusRefreshReceipt | null,
  language: UiLanguage,
): string {
  if (!receipt) {
    return '';
  }

  const isEnglish = isEnglishUi(language);
  const changedParts: string[] = [];
  if (receipt.createdAlarms > 0) {
    changedParts.push(
      isEnglish
        ? `${receipt.createdAlarms} created`
        : `补齐 ${receipt.createdAlarms} 个`,
    );
  }
  if (receipt.updatedAlarms > 0) {
    changedParts.push(
      isEnglish
        ? `${receipt.updatedAlarms} rescheduled`
        : `重排 ${receipt.updatedAlarms} 个`,
    );
  }
  if (receipt.clearedAlarms > 0) {
    changedParts.push(
      isEnglish
        ? `${receipt.clearedAlarms} cleared`
        : `清理 ${receipt.clearedAlarms} 个`,
    );
  }

  const repairDetail = receipt.autoRepairAttempted
    ? changedParts.length > 0
      ? isEnglish
        ? `Chrome alarms calibrated: ${changedParts.join(', ')}.`
        : `已校准 Chrome alarm：${changedParts.join('，')}。`
      : isEnglish
      ? 'Chrome alarms were checked; no schedule changes were needed.'
      : '已核对 Chrome alarm，未发现需要改动的排程。'
    : isEnglish
    ? 'Chrome alarms were not repaired in this refresh.'
    : '本次未尝试自动修复 Chrome alarm。';

  const failureDetail =
    receipt.failedRepairs > 0
      ? isEnglish
        ? ` ${receipt.failedRepairs} repair failed; see task rows.`
        : ` ${receipt.failedRepairs} 个修复失败，详见任务行。`
      : '';
  const queueStatusUnavailableCount =
    receipt.queueStatusUnavailableCount || 0;
  const queueStatusDetail =
    queueStatusUnavailableCount > 0
      ? isEnglish
        ? ` ${queueStatusUnavailableCount} queue detail not confirmed; see task rows.`
        : ` ${queueStatusUnavailableCount} 个队列明细未确认，详见任务行。`
      : '';
  const calibrationDetail = formatTaskSchedulerAlarmCalibrations(
    receipt,
    language,
  );

  return isEnglish
    ? `Refresh receipt: checked ${receipt.checkedTaskCount} tasks, ${receipt.enabledTaskCount} enabled schedules. ${repairDetail}${failureDetail}${queueStatusDetail}${calibrationDetail} Refresh only reads status and calibrates alarms; it did not run tasks, enable or pause tasks, or clear run history.`
    : `刷新回执：已核对 ${receipt.checkedTaskCount} 个任务，${receipt.enabledTaskCount} 个启用排程。${repairDetail}${failureDetail}${queueStatusDetail}${calibrationDetail} 刷新只读取状态并校准排程，没有立即执行任务、启用或停用任务，也没有清空运行历史。`;
}

function formatTaskSchedulerAlarmCalibrations(
  receipt: TaskSchedulerStatusRefreshReceipt,
  language: UiLanguage,
): string {
  const calibrations = Array.isArray(receipt.alarmCalibrations)
    ? receipt.alarmCalibrations
    : [];
  if (calibrations.length === 0) {
    return '';
  }

  const isEnglish = isEnglishUi(language);
  const visible = calibrations.slice(0, 3).map((item) => {
    const actionLabel = formatTaskSchedulerAlarmCalibrationAction(
      item.action,
      language,
    );
    const detail = item.detail ? ` (${item.detail})` : '';
    return isEnglish
      ? `${actionLabel} ${item.taskName}${detail}`
      : `${actionLabel}${item.taskName}${detail}`;
  });
  const hiddenCount = calibrations.length - visible.length;
  const more =
    hiddenCount > 0
      ? isEnglish
        ? `, ${hiddenCount} more`
        : `，另 ${hiddenCount} 项`
      : '';

  return isEnglish
    ? ` Calibrated this refresh: ${visible.join('; ')}${more}.`
    : ` 本次校准：${visible.join('；')}${more}。`;
}

function formatTaskSchedulerAlarmCalibrationAction(
  action: TaskSchedulerAlarmCalibration['action'],
  language: UiLanguage,
): string {
  const isEnglish = isEnglishUi(language);
  if (action === 'created') {
    return isEnglish ? 'created alarm for' : '补齐 ';
  }
  if (action === 'updated') {
    return isEnglish ? 'rescheduled' : '重排 ';
  }
  if (action === 'disabled_cleared') {
    return isEnglish ? 'cleared disabled alarm for' : '清理已停用 ';
  }
  if (action === 'orphaned_cleared') {
    return isEnglish ? 'cleared leftover alarm' : '清理残留 ';
  }
  return isEnglish ? 'repair failed for' : '修复失败 ';
}

function formatTaskResult(
  task: TaskSchedulerTask,
  language: UiLanguage = 'zh-CN',
): string {
  const failureStreak = getTaskFailureStreak(task);
  if (task.isExecuting) {
    return isEnglishUi(language)
      ? `Running · started ${formatTaskTime(task.lastRun, language)}`
      : `执行中 · 开始 ${formatTaskTime(task.lastRun, language)}`;
  }
  if (hasTaskRecentSkip(task)) {
    return isEnglishUi(language)
      ? `Last skipped · ${task.lastSkipReason || 'another run is active'}`
      : `上次跳过 · ${task.lastSkipReason || '已有执行中任务'}`;
  }
  if (!task.lastCompletedAt) {
    return isEnglishUi(language) ? 'Not run yet' : '尚未执行';
  }
  if (task.lastSuccess === false) {
    const failureDetail = appendTaskResultSummary(
      task.lastError ||
        (isEnglishUi(language) ? 'check background logs' : '查看后台日志'),
      task.lastResultSummary,
    );
    if (failureStreak > 1) {
      return isEnglishUi(language)
        ? `${failureStreak} consecutive failures · ${failureDetail}`
        : `连续失败 ${failureStreak} 次 · ${failureDetail}`;
    }
    return isEnglishUi(language)
      ? `Last failed · ${failureDetail}`
      : `上次失败 · ${failureDetail}`;
  }
  if (task.lastResultSummary) {
    return isEnglishUi(language)
      ? `Last succeeded · ${task.lastResultSummary}`
      : `上次成功 · ${task.lastResultSummary}`;
  }
  return isEnglishUi(language)
    ? `Last succeeded · ${formatTaskTime(task.lastCompletedAt, language)}`
    : `上次成功 · ${formatTaskTime(task.lastCompletedAt, language)}`;
}

function formatTaskRunTrigger(
  trigger?: TaskSchedulerRunRecord['trigger'],
  language: UiLanguage = 'zh-CN',
): string {
  if (isEnglishUi(language)) {
    if (trigger === 'manual') return 'Manual';
    if (trigger === 'startup') return 'Startup';
    return 'Scheduled';
  }
  if (trigger === 'manual') return '手动';
  if (trigger === 'startup') return '启动';
  return '排程';
}

function formatTaskRunDuration(
  durationMs?: number,
  language: UiLanguage = 'zh-CN',
): string {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
    return isEnglishUi(language) ? 'duration unknown' : '耗时未知';
  }
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  if (durationMs < 10_000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }
  return `${Math.round(durationMs / 1000)}s`;
}

function getTaskLatestRunSummary(
  task: TaskSchedulerTask,
  language: UiLanguage = 'zh-CN',
):
  | {
      text: string;
      className: 'success' | 'failed' | 'skipped';
    }
  | null {
  const latestRun = Array.isArray(task.runHistory) ? task.runHistory[0] : null;
  if (!latestRun) {
    return null;
  }

  const className = latestRun.skipped
    ? 'skipped'
    : latestRun.success
    ? 'success'
    : 'failed';
  const resultLabel = isEnglishUi(language)
    ? latestRun.skipped
      ? 'skipped'
      : latestRun.success
      ? 'succeeded'
      : 'failed'
    : latestRun.skipped
    ? '跳过'
    : latestRun.success
    ? '成功'
    : '失败';
  const detail = latestRun.skipped
    ? latestRun.error ||
      (isEnglishUi(language) ? 'another run is active' : '已有执行中任务')
    : latestRun.success
    ? latestRun.summary || ''
    : appendTaskResultSummary(
        latestRun.error || (isEnglishUi(language) ? 'unknown error' : '未知错误'),
        latestRun.summary,
      );
  const parts = [
    isEnglishUi(language) ? 'Latest' : '最近一次',
    isEnglishUi(language)
      ? `${formatTaskRunTrigger(latestRun.trigger, language)} ${resultLabel}`
      : `${formatTaskRunTrigger(latestRun.trigger, language)}${resultLabel}`,
    formatTaskRunDuration(latestRun.durationMs, language),
  ];

  if (detail) {
    parts.push(detail);
  }

  return {
    text: parts.join(' · '),
    className,
  };
}

function formatTaskRunHistorySummary(
  task: TaskSchedulerTask,
  language: UiLanguage = 'zh-CN',
): string {
  const history = Array.isArray(task.runHistory) ? task.runHistory : [];
  if (history.length === 0) {
    return '';
  }

  const skippedCount = history.filter((run) => run.skipped).length;
  const successCount = history.filter(
    (run) => !run.skipped && run.success,
  ).length;
  const failedCount = history.filter(
    (run) => !run.skipped && !run.success,
  ).length;
  const parts = [
    isEnglishUi(language)
      ? pluralizeEn(successCount, 'success', 'successes')
      : `${successCount} 成功`,
  ];
  if (failedCount > 0) {
    parts.push(
      isEnglishUi(language)
        ? pluralizeEn(failedCount, 'failure')
        : `${failedCount} 失败`,
    );
  }
  if (skippedCount > 0) {
    parts.push(
      isEnglishUi(language)
        ? `${skippedCount} skipped`
        : `${skippedCount} 跳过`,
    );
  }
  return isEnglishUi(language)
    ? `Last ${history.length} runs · ${parts.join(' / ')}`
    : `近 ${history.length} 次 · ${parts.join(' / ')}`;
}

function formatTaskRunHistoryTitle(
  task: TaskSchedulerTask,
  language: UiLanguage = 'zh-CN',
): string {
  const history = Array.isArray(task.runHistory) ? task.runHistory : [];
  return history
    .map((run) => {
      const result = isEnglishUi(language)
        ? run.skipped
          ? `Skipped: ${run.error || 'another run is active'}`
          : run.success
          ? run.summary
            ? `Succeeded: ${run.summary}`
            : 'Succeeded'
          : `Failed: ${appendTaskResultSummary(
              run.error || 'unknown error',
              run.summary,
            )}`
        : run.skipped
        ? `跳过: ${run.error || '已有执行中任务'}`
        : run.success
        ? run.summary
          ? `成功: ${run.summary}`
          : '成功'
        : `失败: ${appendTaskResultSummary(
            run.error || '未知错误',
            run.summary,
          )}`;
      return `${formatTaskTime(run.completedAt, language)} · ${formatTaskRunTrigger(
        run.trigger,
        language,
      )} · ${result} · ${run.durationMs}ms`;
    })
    .join('\n');
}

function findLatestManualTaskRun(
  task?: TaskSchedulerTask,
): TaskSchedulerRunRecord | undefined {
  return Array.isArray(task?.runHistory)
    ? task.runHistory.find((run) => run.trigger === 'manual')
    : undefined;
}

function buildTaskSchedulerActionReceipt({
  action,
  task,
  updatedTask,
  enabled,
  message,
  skipped,
  failed,
  language,
}: {
  action: 'toggle' | 'run' | 'repair';
  task: TaskSchedulerTask;
  updatedTask?: TaskSchedulerTask;
  enabled?: boolean;
  message?: string;
  skipped?: boolean;
  failed?: boolean;
  language: UiLanguage;
}): TaskSchedulerActionReceipt {
  const displayName = getTaskDisplayName(updatedTask || task, language);
  const currentTask = updatedTask || task;
  const isEnglish = isEnglishUi(language);

  if (action === 'toggle') {
    const isEnabled = enabled ?? currentTask.enabled;
    if (failed) {
      return {
        taskId: task.id,
        tone: 'failed',
        label: isEnglish
          ? isEnabled
            ? 'Enable failed'
            : 'Pause failed'
          : isEnabled
          ? '启用失败'
          : '停用失败',
        detail: isEnglish
          ? `${displayName}: ${message || 'Task control failed'}`
          : `${displayName}：${message || '任务控制失败'}`,
        boundary: isEnabled
          ? isEnglish
            ? 'The schedule was not confirmed enabled; it did not run the task, create a trusted next run, or clear run history.'
            : '这次没有确认启用排程；没有立即执行任务、没有生成可信下一次执行时间，也没有清空运行历史。'
          : isEnglish
          ? 'The schedule was not confirmed paused; it did not run the task, clear the alarm state, or clear run history.'
          : '这次没有确认停用排程；没有立即执行任务、没有清除已确认排程状态，也没有清空运行历史。',
        createdAt: Date.now(),
      };
    }
    return {
      taskId: task.id,
      tone: 'success',
      label: isEnglish
        ? isEnabled
          ? 'Schedule enabled'
          : 'Schedule paused'
        : isEnabled
        ? '排程已启用'
        : '排程已停用',
      detail: isEnabled
        ? isEnglish
          ? `${displayName} will use the Chrome alarm schedule${
              currentTask.nextRun
                ? `, next ${formatTaskTime(currentTask.nextRun, language)}`
                : ''
            }.`
          : `${displayName} 已恢复 Chrome alarm 排程${
              currentTask.nextRun
                ? `，下次 ${formatTaskTime(currentTask.nextRun, language)}`
                : ''
            }。`
        : isEnglish
        ? `${displayName} will not create an automatic Chrome alarm.`
        : `${displayName} 不会再自动创建 Chrome alarm。`,
      boundary: isEnabled
        ? isEnglish
          ? 'This only restores the schedule; it did not run the task immediately.'
          : '这次只恢复排程，没有立即执行任务。'
        : isEnglish
        ? 'Manual run remains available once; pausing did not delete run history.'
        : '仍可手动执行一次；停用不会删除运行历史。',
      createdAt: Date.now(),
    };
  }

  if (action === 'repair') {
    if (failed) {
      return {
        taskId: task.id,
        tone: 'failed',
        label: isEnglish ? 'Reschedule failed' : '重排失败',
        detail: isEnglish
          ? `${displayName}: ${message || 'Schedule repair failed'}`
          : `${displayName}：${message || '排程修复失败'}`,
        boundary: isEnglish
          ? 'The Chrome alarm was not confirmed repaired; it did not run the task, clear the schedule issue, or clear past failures.'
          : '这次没有确认 Chrome alarm 已修复；没有立即执行任务、没有清除排程异常，也没有清空历史失败。',
        createdAt: Date.now(),
      };
    }
    return {
      taskId: task.id,
      tone: 'success',
      label: isEnglish ? 'Schedule repaired' : '排程已重排',
      detail: currentTask.nextRun
        ? isEnglish
          ? `${displayName} next run is ${formatTaskTime(
              currentTask.nextRun,
              language,
            )}.`
          : `${displayName} 下次执行为 ${formatTaskTime(
              currentTask.nextRun,
              language,
            )}。`
        : isEnglish
        ? `${displayName} was repaired, waiting for Chrome to report next run.`
        : `${displayName} 已修复，等待 Chrome 返回下一次执行时间。`,
      boundary: isEnglish
        ? 'Repair only recreates the Chrome alarm; it does not run the task or clear past failures.'
        : '修复只重建 Chrome alarm，不会立即执行任务或清除历史失败。',
      createdAt: Date.now(),
    };
  }

  const latestManualRun = findLatestManualTaskRun(currentTask);
  const manualRunSkipped = Boolean(latestManualRun?.skipped || skipped);
  const manualRunFailed = Boolean(
    (latestManualRun?.success === false && !latestManualRun.skipped) || failed,
  );
  const runDetail =
    manualRunSkipped
      ? latestManualRun?.error ||
        message ||
        (isEnglish ? 'Task conditions were not met.' : '任务条件未满足。')
      : manualRunFailed
      ? appendTaskResultSummary(
          latestManualRun?.error ||
            message ||
            (isEnglish ? 'Task execution failed' : '任务执行失败'),
          latestManualRun?.summary,
        )
      : latestManualRun?.summary || message || (isEnglish ? 'Run completed.' : '执行完成。');

  return {
    taskId: task.id,
    tone: manualRunFailed
      ? 'failed'
      : manualRunSkipped
      ? 'warning'
      : 'success',
    label:
      manualRunSkipped
        ? isEnglish
          ? 'Manual run skipped'
          : '本次已跳过'
        : manualRunFailed
        ? isEnglish
          ? 'Manual run failed'
          : '手动执行失败'
        : isEnglish
        ? 'Manual run completed'
        : '已手动执行',
    detail: isEnglish
      ? `${displayName}: ${runDetail}`
      : `${displayName}：${runDetail}`,
    boundary: currentTask.enabled
      ? isEnglish
        ? 'This was a one-time run; the automatic schedule stayed enabled.'
        : '这是一次性执行，自动排程仍保持启用。'
      : isEnglish
      ? 'This was a one-time run; the task stayed disabled afterward.'
      : '这是一次性执行，任务之后仍保持停用。',
    createdAt: Date.now(),
  };
}

function formatTaskScheduleHealthLabel(
  task: TaskSchedulerTask,
  language: UiLanguage = 'zh-CN',
): string {
  if (isEnglishUi(language)) {
    if (task.scheduleHealth === 'missing_alarm') return 'Not scheduled';
    if (task.scheduleHealth === 'period_mismatch') return 'Needs reschedule';
    if (task.scheduleHealth === 'overdue') return 'Overdue';
    if (task.scheduleHealth === 'repair_failed') return 'Repair failed';
    return 'Schedule issue';
  }
  if (task.scheduleHealth === 'missing_alarm') return '未排程';
  if (task.scheduleHealth === 'period_mismatch') return '需重排';
  if (task.scheduleHealth === 'overdue') return '逾期';
  if (task.scheduleHealth === 'repair_failed') return '修复失败';
  return '排程异常';
}

function formatTaskSchedule(
  task: TaskSchedulerTask,
  now = Date.now(),
  language: UiLanguage = 'zh-CN',
): string {
  if (!task.enabled) {
    return isEnglishUi(language)
      ? 'Disabled · manual run available'
      : '停用 · 可手动执行';
  }
  if (hasTaskScheduleWarning(task)) {
    return (
      task.scheduleWarning ||
      (isEnglishUi(language)
        ? 'Schedule needs refresh'
        : '排程需要刷新')
    );
  }
  if (!task.nextRun) {
    return isEnglishUi(language)
      ? 'Waiting for Chrome schedule'
      : '等待 Chrome 排程';
  }
  return isEnglishUi(language)
    ? `Next ${formatTaskRelativeTime(
        task.nextRun,
        now,
        language,
      )} · ${formatTaskTime(task.nextRun, language)}`
    : `下次 ${formatTaskRelativeTime(
        task.nextRun,
        now,
        language,
      )} · ${formatTaskTime(task.nextRun, language)}`;
}

function formatTaskStatusReceipt(
  task: TaskSchedulerTask,
  language: UiLanguage = 'zh-CN',
): TaskSchedulerStatusReceipt | null {
  const receipt = task.statusReceipt;
  if (!receipt) {
    return null;
  }
  if (!isEnglishUi(language)) {
    return receipt;
  }

  const failureStreak = getTaskFailureStreak(task);
  if (receipt.state === 'executing') {
    return {
      ...receipt,
      label: 'Running',
      detail: `Started ${formatTaskTime(task.lastRun, language)}`,
      nextAction: 'Wait for this run to finish before starting another one',
    };
  }
  if (receipt.state === 'schedule_attention') {
    const nextAction =
      task.scheduleHealth === 'overdue'
        ? 'Run once now, then reschedule the next run'
        : task.scheduleHealth === 'repair_failed'
        ? 'Keep the old schedule and retry rescheduling later'
        : 'Reschedule the Chrome alarm';
    return {
      ...receipt,
      label: formatTaskScheduleHealthLabel(task, language),
      detail: task.scheduleWarning || 'Chrome alarm needs refresh',
      nextAction,
    };
  }
  if (receipt.state === 'recent_skip') {
    return {
      ...receipt,
      label: 'Skipped',
      detail: task.lastSkipReason || 'Task conditions were not met',
      nextAction: 'Wait for the active run or condition to recover, then retry',
    };
  }
  if (receipt.state === 'failed') {
    const detail = appendTaskResultSummary(
      task.lastError || 'Check background logs',
      task.lastResultSummary,
    );
    return {
      ...receipt,
      label:
        failureStreak > 1
          ? `${failureStreak} failures`
          : 'Last run failed',
      detail,
      nextAction:
        failureStreak >= 3
          ? 'Pause the schedule, check service config, then retry manually'
          : 'Retry once; check service status if it fails again',
    };
  }
  if (receipt.state === 'healthy') {
    return {
      ...receipt,
      label: 'Recently succeeded',
      detail:
        task.lastResultSummary ||
        `Completed ${formatTaskTime(task.lastCompletedAt, language)}`,
      nextAction: 'Keep the schedule; act only if it becomes unhealthy',
    };
  }
  if (receipt.state === 'disabled') {
    return {
      ...receipt,
      label: 'Disabled',
      detail: 'Manual run remains available',
      nextAction: 'Enable the schedule when it should run automatically',
    };
  }
  return {
    ...receipt,
    label: 'Waiting',
    detail: 'No completed runs yet',
    nextAction: 'Wait for the next schedule or run once manually',
  };
}

function formatTaskActionHint(
  task: TaskSchedulerTask,
  language: UiLanguage = 'zh-CN',
): string {
  const statusReceipt = formatTaskStatusReceipt(task, language);
  if (
    statusReceipt?.nextAction &&
    statusReceipt.state !== 'healthy'
  ) {
    return statusReceipt.nextAction;
  }

  const failureStreak = getTaskFailureStreak(task);
  if (task.isExecuting) {
    return '';
  }
  if (hasTaskScheduleWarning(task)) {
    if (task.scheduleHealth === 'overdue') {
      return isEnglishUi(language)
        ? 'Run once now, then reschedule the next run'
        : '建议先立即执行，再重排下一次';
    }
    if (task.scheduleHealth === 'repair_failed') {
      return isEnglishUi(language)
        ? 'The old schedule is kept; retry rescheduling later'
        : '旧排程会尽量保留，可稍后重试重排';
    }
    return isEnglishUi(language)
      ? 'Reschedule the Chrome alarm'
      : '建议重排 Chrome alarm';
  }
  if (hasTaskRecentSkip(task)) {
    return isEnglishUi(language)
      ? 'Retry after the active run finishes'
      : '当前任务完成后再重试';
  }
  if (shouldRecommendTaskPause(task)) {
    return isEnglishUi(language)
      ? `${failureStreak} consecutive failures. Pause the schedule and check service config.`
      : `连续失败 ${failureStreak} 次，建议先暂停排程并检查服务配置`;
  }
  if (failureStreak > 1) {
    return isEnglishUi(language)
      ? `${failureStreak} consecutive failures. Check background logs before retrying.`
      : `连续失败 ${failureStreak} 次，建议检查后台日志后重试`;
  }
  if (task.lastSuccess === false) {
    return isEnglishUi(language)
      ? 'Retry once; check background logs if it fails again'
      : '建议重试一次，重复失败再查后台日志';
  }
  return '';
}

function formatTaskActionBoundary(
  task: TaskSchedulerTask,
  language: UiLanguage = 'zh-CN',
): string {
  const isEnglish = isEnglishUi(language);

  if (task.isExecuting) {
    return isEnglish
      ? 'Action scope: wait for this run; another trigger is recorded as skipped, not as a new failure.'
      : '操作范围：等待当前执行；重复触发会记录为跳过，不会当作新失败。';
  }

  const digestQueueBoundary = formatDigestQueueRunBoundary(
    task,
    false,
    language,
  );
  if (digestQueueBoundary) {
    return isEnglish
      ? `Action scope: ${digestQueueBoundary} The switch only changes future scheduling.`
      : `操作范围：${digestQueueBoundary} 开关只改变后续排程。`;
  }

  if (hasTaskScheduleWarning(task)) {
    if (task.scheduleHealth === 'overdue') {
      return isEnglish
        ? 'Action scope: Run now is one-time; Repair only reschedules the Chrome alarm and keeps run history.'
        : '操作范围：立即执行只跑一次；重排只校准下一次 Chrome alarm，并保留运行历史。';
    }
    if (task.scheduleHealth === 'repair_failed') {
      return isEnglish
        ? 'Action scope: retry repair only recreates the Chrome alarm; it does not clear the failure or run the task.'
        : '操作范围：再次重排只重建 Chrome alarm，不会清除失败或立即执行任务。';
    }
    return isEnglish
      ? 'Action scope: Repair only recreates the Chrome alarm; Run now is a separate one-time execution.'
      : '操作范围：重排只重建 Chrome alarm；立即执行是独立的一次性运行。';
  }

  if (hasTaskRecentSkip(task)) {
    return isEnglish
      ? 'Action scope: retry after the active run or condition recovers; the skip does not overwrite the last success.'
      : '操作范围：等当前执行或前置条件恢复后再试；跳过不会覆盖最近成功结果。';
  }

  if (shouldRecommendTaskPause(task)) {
    return isEnglish
      ? 'Action scope: Pause only stops the automatic schedule and keeps history; Run now retries once.'
      : '操作范围：暂停只停止自动排程并保留历史；立即执行只重试一次。';
  }

  if (task.lastSuccess === false) {
    return isEnglish
      ? 'Action scope: Run now retries once; it does not clear failure history or change the schedule.'
      : '操作范围：立即执行只重试一次，不会清空失败历史或改变自动排程。';
  }

  if (!task.enabled) {
    return isEnglish
      ? 'Action scope: manual run is one-time and keeps the task disabled afterward.'
      : '操作范围：手动执行只跑一次，完成后任务仍保持停用。';
  }

  return isEnglish
    ? 'Action scope: the switch only changes the schedule; Run now is one-time and keeps history.'
    : '操作范围：开关只改变排程；立即执行只跑一次，并保留运行历史。';
}

function getTaskRunButtonTitle(
  task: TaskSchedulerTask,
  isBusy: boolean,
  language: UiLanguage = 'zh-CN',
): string {
  const digestQueueBoundary = formatDigestQueueRunBoundary(
    task,
    isBusy,
    language,
  );
  if (digestQueueBoundary) {
    return digestQueueBoundary;
  }

  const taskName = getTaskDisplayName(task, language);
  if (isBusy || task.isExecuting) {
    return isEnglishUi(language)
      ? `${taskName} is already running; wait for it to finish. Another trigger would be recorded as skipped, not as a new failure.`
      : `${taskName} 正在执行，等待完成后再触发；重复触发只会记录为跳过，不会当作新失败。`;
  }
  if (hasTaskScheduleWarning(task)) {
    return isEnglishUi(language)
      ? `Run ${taskName} once now. This does not repair the Chrome schedule, clear the schedule issue, or clear run history.`
      : `立即执行 ${taskName} 一次；不会修复 Chrome 排程、清除排程异常或清空运行历史。`;
  }
  if (task.lastSuccess === false) {
    return isEnglishUi(language)
      ? `Retry ${taskName} once now. This does not clear failure history or change the automatic schedule.`
      : `立即重试 ${taskName} 一次；不会清空失败历史或改变自动排程。`;
  }
  if (!task.enabled) {
    return isEnglishUi(language)
      ? `Run ${taskName} once manually. The task stays disabled afterward.`
      : `手动执行 ${taskName} 一次；完成后任务仍保持停用。`;
  }
  return isEnglishUi(language)
    ? `Run ${taskName} once now. The automatic schedule stays enabled and run history is kept.`
    : `立即执行 ${taskName} 一次；自动排程仍保持启用，运行历史会保留。`;
}

function getTaskRunButtonAriaLabel(
  task: TaskSchedulerTask,
  isBusy: boolean,
  language: UiLanguage = 'zh-CN',
): string {
  return getTaskRunButtonTitle(task, isBusy, language);
}

function getTaskToggleButtonTitle(
  task: TaskSchedulerTask,
  language: UiLanguage = 'zh-CN',
): string {
  const taskName = getTaskDisplayName(task, language);
  if (task.enabled) {
    return isEnglishUi(language)
      ? `Pause ${taskName} schedule. This stops future automatic Chrome alarms, keeps run history, and does not run the task.`
      : `停用 ${taskName} 排程；只停止后续自动 Chrome alarm，保留运行历史，不会立即执行任务。`;
  }
  return isEnglishUi(language)
    ? `Enable ${taskName} schedule. This restores future automatic Chrome alarms, but does not run the task now or clear history.`
    : `启用 ${taskName} 排程；只恢复后续自动 Chrome alarm，不会立即执行任务或清空历史。`;
}

function getTaskToggleButtonAriaLabel(
  task: TaskSchedulerTask,
  language: UiLanguage = 'zh-CN',
): string {
  return getTaskToggleButtonTitle(task, language);
}

function getTaskRepairButtonTitle(
  task: TaskSchedulerTask,
  language: UiLanguage = 'zh-CN',
): string {
  const taskName = getTaskDisplayName(task, language);
  if (task.scheduleHealth === 'repair_failed') {
    return isEnglishUi(language)
      ? `Retry repairing ${taskName} schedule. This only recreates the Chrome alarm; it does not run the task or clear past failures.`
      : `重试修复 ${taskName} 排程；只重建 Chrome alarm，不会立即执行任务或清除历史失败。`;
  }
  return isEnglishUi(language)
    ? `Repair ${taskName} schedule. This only recreates or calibrates the Chrome alarm; Run now is a separate one-time action.`
    : `修复 ${taskName} 排程；只重建或校准 Chrome alarm，立即执行是另一项一次性操作。`;
}

function getTaskRepairButtonAriaLabel(
  task: TaskSchedulerTask,
  language: UiLanguage = 'zh-CN',
): string {
  return getTaskRepairButtonTitle(task, language);
}

function getTaskPauseButtonTitle(
  task: TaskSchedulerTask,
  language: UiLanguage = 'zh-CN',
): string {
  const taskName = getTaskDisplayName(task, language);
  return isEnglishUi(language)
    ? `Pause ${taskName} schedule after repeated failures. This keeps run history and leaves one-time manual run available.`
    : `因连续失败暂停 ${taskName} 排程；保留运行历史，仍可手动执行一次。`;
}

function getTaskPauseButtonAriaLabel(
  task: TaskSchedulerTask,
  language: UiLanguage = 'zh-CN',
): string {
  return getTaskPauseButtonTitle(task, language);
}

function formatTaskListEmptyState(
  isLoading: boolean,
  language: UiLanguage = 'zh-CN',
): string {
  if (isLoading) {
    return isEnglishUi(language)
      ? 'Loading background tasks'
      : '正在加载后台任务';
  }
  return isEnglishUi(language)
    ? 'No background task status yet'
    : '暂无后台任务状态';
}

function formatTaskSchedulerNextStep(
  task: TaskSchedulerTask | undefined,
  language: UiLanguage = 'zh-CN',
): {
  tone: 'executing' | 'warning' | 'failed' | 'skipped';
  message: string;
  boundary: string;
} | null {
  if (!task) {
    return null;
  }

  const boundary = formatTaskSchedulerNextStepBoundary(task, language);
  const receipt = formatTaskStatusReceipt(task, language);
  if (
    receipt &&
    (receipt.tone === 'executing' ||
      receipt.tone === 'warning' ||
      receipt.tone === 'failed' ||
      receipt.tone === 'skipped')
  ) {
    const taskName = getTaskDisplayName(task, language);
    return {
      tone: receipt.tone,
      message: isEnglishUi(language)
        ? `${taskName} ${receipt.label}: ${receipt.nextAction}.`
        : `${taskName} ${receipt.label}：${receipt.nextAction}。`,
      boundary,
    };
  }

  const statusKind = getTaskStatusKind(task);
  const taskName = getTaskDisplayName(task, language);
  if (statusKind === 'executing') {
    return {
      tone: 'executing',
      message: isEnglishUi(language)
        ? `${taskName} is running. Wait for it to finish before starting another action.`
        : `${taskName} 正在执行，等待完成后再触发新操作。`,
      boundary,
    };
  }
  if (statusKind === 'warning') {
    if (task.scheduleHealth === 'overdue') {
      return {
        tone: 'warning',
        message: isEnglishUi(language)
          ? `${taskName} is overdue. Run it once now, then reschedule the next run.`
          : `${taskName} 排程逾期，先立即执行一次，再重排下一次。`,
        boundary,
      };
    }
    if (task.scheduleHealth === 'repair_failed') {
      return {
        tone: 'warning',
        message: isEnglishUi(language)
          ? `${taskName} schedule repair failed. Keep the old schedule and retry later.`
          : `${taskName} 排程修复失败，保留旧排程并稍后重试。`,
        boundary,
      };
    }
    return {
      tone: 'warning',
      message: isEnglishUi(language)
        ? `${taskName} has a schedule issue. Reschedule the Chrome alarm first.`
        : `${taskName} 排程异常，优先点击重排恢复 Chrome alarm。`,
      boundary,
    };
  }
  if (statusKind === 'failed') {
    const failureStreak = getTaskFailureStreak(task);
    if (failureStreak > 1) {
      return {
        tone: 'failed',
        message: isEnglishUi(language)
          ? `${taskName} failed ${failureStreak} times in a row. Check service config or network before retrying.`
          : `${taskName} 连续失败 ${failureStreak} 次，先检查服务配置或网络，再重试。`,
        boundary,
      };
    }
    return {
      tone: 'failed',
      message: isEnglishUi(language)
        ? `${taskName} failed last time. Retry once; check service status if it fails again.`
        : `${taskName} 上次失败，可重试一次；重复失败先查服务状态。`,
      boundary,
    };
  }
  if (statusKind === 'skipped') {
    return {
      tone: 'skipped',
      message: isEnglishUi(language)
        ? `${taskName} was skipped recently. Retry after the current run finishes.`
        : `${taskName} 最近被跳过，等待当前执行完成后再重试。`,
      boundary,
    };
  }
  return null;
}

function formatTaskSchedulerNextStepBoundary(
  task: TaskSchedulerTask,
  language: UiLanguage = 'zh-CN',
): string {
  const isEnglish = isEnglishUi(language);
  const statusKind = getTaskStatusKind(task);

  if (statusKind === 'executing') {
    return isEnglish
      ? 'This next-step hint only explains the current run; it does not start another task, cancel the run, change the schedule, or clear history.'
      : '这条下一步提示只解释当前执行；不会开始新任务、取消当前任务、改变排程或清空运行历史。';
  }

  if (statusKind === 'warning') {
    if (task.scheduleHealth === 'overdue') {
      return isEnglish
        ? 'This hint does not run or reschedule the task automatically; use the row buttons separately and wait for background confirmation.'
        : '这条提示不会自动立即执行或重排；需要在任务行分别点击立即执行或重排，并等待后台确认。';
    }
    if (task.scheduleHealth === 'repair_failed') {
      return isEnglish
        ? 'This hint does not clear the repair failure or old schedule; retrying repair only rebuilds the Chrome alarm, not the task run or history.'
        : '这条提示不会清除修复失败或旧排程；重试重排只会重建 Chrome alarm，不会执行任务或清空历史。';
    }
    return isEnglish
      ? 'This hint does not repair Chrome alarms automatically; use the row repair button and wait for the refreshed status.'
      : '这条提示不会自动修复 Chrome alarm；需要在任务行点击重排并等待刷新确认。';
  }

  if (statusKind === 'failed') {
    if (shouldRecommendTaskPause(task)) {
      return isEnglish
        ? 'This hint does not pause or retry automatically; pause and one-time run still require row actions, and run history is kept.'
        : '这条提示不会自动暂停或重试；暂停和立即执行仍需在任务行触发，运行历史会保留。';
    }
    return isEnglish
      ? 'This hint does not retry the task or clear the failure; use Run once to retry while keeping schedule and history intact.'
      : '这条提示不会自动重试或清除失败；需要点击立即执行重试，排程和历史都会保留。';
  }

  if (statusKind === 'skipped') {
    return isEnglish
      ? 'This hint does not rerun the task automatically; the skip keeps the last success intact until conditions recover.'
      : '这条提示不会自动重跑；跳过不会覆盖最近成功，需等条件恢复后再手动执行。';
  }

  return isEnglish
    ? 'This hint only explains current status; task changes still require an explicit row action.'
    : '这条提示只解释当前状态；真正的任务变更仍需要点击任务行操作。';
}

function formatTaskSchedulerCollapsedAttentionPreview(
  tasks: TaskSchedulerTask[],
  language: UiLanguage = 'zh-CN',
): string {
  const attentionTasks = tasks
    .filter(taskNeedsAttention)
    .map((task, index) => ({ task, index }))
    .sort(
      (left, right) =>
        getTaskPrimaryAttentionRank(left.task) -
          getTaskPrimaryAttentionRank(right.task) || left.index - right.index,
    )
    .map(({ task }) => task);

  if (attentionTasks.length === 0) {
    return '';
  }

  const isEnglish = isEnglishUi(language);
  const visible = attentionTasks
    .slice(0, TASK_COLLAPSED_ATTENTION_PREVIEW_LIMIT)
    .map((task) => {
      const name = getTaskDisplayName(task, language);
      const status = formatTaskAttentionStatusLabel(task, language);
      return `${name} · ${status}`;
    });
  const hiddenCount = attentionTasks.length - visible.length;
  const more =
    hiddenCount > 0
      ? isEnglish
        ? `, ${hiddenCount} more`
        : `，另 ${hiddenCount} 项`
      : '';

  return isEnglish
    ? `Needs action: ${visible.join('; ')}${more}`
    : `需处理：${visible.join('；')}${more}`;
}

function formatTaskAttentionStatusLabel(
  task: TaskSchedulerTask,
  language: UiLanguage = 'zh-CN',
): string {
  const statusKind = getTaskStatusKind(task);
  if (isEnglishUi(language)) {
    if (statusKind === 'executing') return 'Running';
    if (statusKind === 'warning') return formatTaskScheduleHealthLabel(task, language);
    if (statusKind === 'failed') return 'Failed';
    if (statusKind === 'skipped') return 'Skipped';
    return 'Needs action';
  }
  if (statusKind === 'executing') return '执行中';
  if (statusKind === 'warning') return formatTaskScheduleHealthLabel(task, language);
  if (statusKind === 'failed') return '失败';
  if (statusKind === 'skipped') return '跳过';
  return '需处理';
}

function formatTaskAttentionReason(
  task: TaskSchedulerTask,
  language: UiLanguage = 'zh-CN',
): string {
  const statusReceipt = formatTaskStatusReceipt(task, language);
  if (statusReceipt?.detail) {
    return statusReceipt.detail;
  }

  const statusKind = getTaskStatusKind(task);
  if (statusKind === 'executing') {
    return isEnglishUi(language)
      ? `Started ${formatTaskTime(task.lastRun, language)}`
      : `开始 ${formatTaskTime(task.lastRun, language)}`;
  }
  if (statusKind === 'warning') {
    return task.scheduleWarning ||
      (isEnglishUi(language)
        ? 'Chrome alarm needs refresh'
        : 'Chrome alarm 需要刷新');
  }
  if (statusKind === 'failed') {
    const failureStreak = getTaskFailureStreak(task);
    const prefix = isEnglishUi(language)
      ? failureStreak > 1
        ? `${failureStreak} consecutive failures`
        : 'Last run failed'
      : failureStreak > 1
      ? `连续失败 ${failureStreak} 次`
      : '上次失败';
    return task.lastError ? `${prefix} · ${task.lastError}` : prefix;
  }
  if (statusKind === 'skipped') {
    return task.lastSkipReason ||
      (isEnglishUi(language) ? 'Task conditions were not met' : '任务条件未满足');
  }
  return '';
}

function formatTaskAttentionAction(
  task: TaskSchedulerTask,
  language: UiLanguage = 'zh-CN',
): string {
  const statusReceipt = formatTaskStatusReceipt(task, language);
  if (statusReceipt?.nextAction) {
    return statusReceipt.nextAction;
  }

  const actionHint = formatTaskActionHint(task, language);
  if (actionHint) {
    return actionHint;
  }

  const statusKind = getTaskStatusKind(task);
  if (isEnglishUi(language)) {
    if (statusKind === 'executing') return 'Wait for completion';
    if (statusKind === 'warning') return 'Reschedule Chrome alarm';
    if (statusKind === 'failed') return 'Retry or check service';
    if (statusKind === 'skipped') return 'Retry later';
    return 'View task details';
  }
  if (statusKind === 'executing') return '等待完成';
  if (statusKind === 'warning') return '重排 Chrome alarm';
  if (statusKind === 'failed') return '重试或检查服务';
  if (statusKind === 'skipped') return '稍后重试';
  return '查看任务详情';
}

function isMeetingPilotCaptureActive(
  session: MeetingPilotSessionSnapshot | null,
): boolean {
  return Boolean(
    session &&
      ['armed', 'recording', 'uploading', 'completed'].includes(
        session.capture?.kind || '',
      ),
  );
}

function isMeetingPilotTranscriptPilotActive(
  session: MeetingPilotSessionSnapshot | null,
): boolean {
  return Boolean(
    session?.webTranscript?.active &&
      session.transcript?.some(
        (chunk) => chunk.source === 'ringcentral_transcript',
      ),
  );
}

function formatMeetingPilotCaptureError(error?: string): string {
  const value = String(error || '').trim();
  if (!value) return 'Capture 没有成功开始';
  if (value === 'tabCapture_stream_unavailable') {
    return 'Chrome 没有返回标签页录制授权';
  }
  if (/already recording meeting/i.test(value)) {
    return '已有另一场会议正在录制';
  }
  if (/offscreen/i.test(value)) {
    return '录制后台没有成功启动';
  }
  return value;
}

function buildMeetingPilotStartNotice(
  response:
    | {
        success?: boolean;
        session?: MeetingPilotSessionSnapshot;
        activeRecording?: MeetingPilotSessionSnapshot;
        panelError?: string;
      }
    | undefined,
): MeetingPilotNotice {
  if (response?.activeRecording) {
    return {
      tone: 'warning',
      message: `已有会议正在录制：${
        response.activeRecording.title || response.activeRecording.meetingId
      }。请先停止那场会议，或切换到正在录制的 tab。本次点击没有开始新的本机 Capture，也没有通知参会者。`,
    };
  }

  const session = response?.session;
  if (session?.readiness && !session.readiness.canStartCapture) {
    const blocker = session.readiness.blockers.find(Boolean);
    const detail = blocker ? ` 阻断项：${blocker}` : '';
    return {
      tone: 'error',
      message: `${
        session.readiness.summary || 'Meeting Pilot 当前配置阻止开始 Capture'
      }。${detail} 请打开 Meeting Pilot 配置页修复后重试。本次没有开始录制，也没有通知参会者。`,
      action: 'options',
    };
  }

  if (session?.capture?.kind === 'error') {
    return {
      tone: 'error',
      message: `${formatMeetingPilotCaptureError(
        session.capture.lastError,
      )}。请确认原会议 tab 仍打开，再点击“开启会议全貌”重新授权；本次失败没有通知参会者、创建纪要或写入外部任务。`,
    };
  }

  if (response?.panelError) {
    return {
      tone: 'warning',
      message: `Capture 已尝试启动，但会议面板没有打开：${response.panelError}。请从会议页右下角入口或 popup 再打开面板；参会者通知和录制同意仍需要你在会议中自行处理。`,
    };
  }

  return {
    tone: 'warning',
    message:
      'Capture 没有成功开始。请确认当前 tab 是 RingCentral 会议页，再重试；本次没有通知参会者或发送会议内容。',
  };
}

function buildMeetingPilotStartPendingNotice(): MeetingPilotNotice {
  return {
    tone: 'info',
    message: `正在提交 Meeting Pilot Capture 启动请求。${MEETING_PILOT_LOCAL_CAPTURE_BOUNDARY}`,
  };
}

function formatTodayPilotDue(card: DayPilotCard): string {
  if (!card.dueAt) {
    if (card.state === 'now') return '现在';
    if (card.state === 'prepare') return '准备';
    if (card.state === 'waiting') return '等待';
    return getTodayPilotPriorityLabel(card);
  }
  return new Date(card.dueAt * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTodayPilotPriorityLabel(card: DayPilotCard): string {
  if (card.priority === 'critical') return '关键';
  if (card.priority === 'high') return '高';
  if (card.priority === 'medium') return '中';
  return '低';
}

function isTodayPilotMeetingCard(card: DayPilotCard): boolean {
  return card.cardType === 'meeting_prepare';
}

function formatTodayPilotEvidenceMeta(card: DayPilotCard): string {
  const evidenceCount = card.evidenceRefs?.length ?? 0;
  const confidence =
    typeof card.trust?.confidence === 'number'
      ? Math.round(Math.max(0, Math.min(1, card.trust.confidence)) * 100)
      : 0;
  return `证据 ${evidenceCount} · 信心 ${confidence}%`;
}

interface TodayPilotPopupScopeReceipt {
  main: string;
  detail: string;
  overflowCount: number;
  overflowActionLabel: string;
  overflowBoundary: string;
}

type TodayPilotPopupScopeContext = Partial<Pick<
  DayPilotTodayResponse,
  'generated' | 'stale'
>> & {
  nowMs?: number;
};

function filterTodayPilotVisibleCards(cards: DayPilotCard[]): DayPilotCard[] {
  return cards.filter((card) => card.state !== 'done' && card.state !== 'muted');
}

function normalizeTodayPilotSnapshotTimestamp(
  value: number | undefined,
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value > 1_000_000_000_000 ? value : value * 1000;
}

function formatTodayPilotSnapshotTime(value: number | undefined): string {
  const timestampMs = normalizeTodayPilotSnapshotTimestamp(value);
  if (!timestampMs) return '生成时间未返回';
  return new Date(timestampMs).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTodayPilotSnapshotAge(
  value: number | undefined,
  nowMs = Date.now(),
): string {
  const timestampMs = normalizeTodayPilotSnapshotTimestamp(value);
  if (!timestampMs) return '无法判断新鲜度';
  const diffSeconds = Math.floor((nowMs - timestampMs) / 1000);
  if (diffSeconds < -60) return '服务端时间在当前时间之后';
  const ageSeconds = Math.max(0, diffSeconds);
  if (ageSeconds < 60) return '刚刚生成';
  const ageMinutes = Math.round(ageSeconds / 60);
  if (ageMinutes < 60) return `约 ${ageMinutes} 分钟前`;
  const ageHours = Math.round(ageMinutes / 60);
  if (ageHours < 24) return `约 ${ageHours} 小时前`;
  const ageDays = Math.round(ageHours / 24);
  return `约 ${ageDays} 天前`;
}

function getTodayPilotBriefStatusLabel(
  brief: DayPilotBrief,
  context: TodayPilotPopupScopeContext,
): string {
  if (context.stale) return '陈旧 brief';
  if (brief.status === 'ready') return '可用 brief';
  if (brief.status === 'stale') return '陈旧 brief';
  if (brief.status === 'draft') return '草稿 brief';
  if (brief.status === 'archived') return '已归档 brief';
  return '未知状态 brief';
}

function buildTodayPilotPopupSnapshotBasis(
  brief: DayPilotBrief,
  context: TodayPilotPopupScopeContext = {},
): string {
  const mode = context.generated ? '服务端新生成' : '读取已有 brief';
  const generatedAt = formatTodayPilotSnapshotTime(brief.generatedAt);
  const age = formatTodayPilotSnapshotAge(brief.generatedAt, context.nowMs);
  const status = getTodayPilotBriefStatusLabel(brief, context);
  return `快照基准：${mode} · ${generatedAt} · ${age} · ${status}；这里只读取 Today Pilot brief，不会重新扫描来源、写反馈、发送消息或执行动作。`;
}

function buildTodayPilotPopupScopeReceipt(
  brief?: DayPilotBrief | null,
  context: TodayPilotPopupScopeContext = {},
): TodayPilotPopupScopeReceipt | null {
  if (!brief) return null;
  const visibleCards = filterTodayPilotVisibleCards(brief.cards || []);
  const displayed = Math.min(3, visibleCards.length);
  const sourceItems = getTodayPilotSourceStatItems(brief, visibleCards);
  const rawSignals = countTodayPilotRawSignals(sourceItems);
  const candidates = countTodayPilotCandidates(sourceItems);
  const selectedEvidence = countTodayPilotSelectedEvidence(sourceItems);
  const candidateNotSelected = Math.max(0, candidates - selectedEvidence);
  const prefilteredNoise = Math.max(0, rawSignals - candidates);
  const prefilteredNoiseBreakdown =
    summarizeTodayPilotNoiseBreakdown(sourceItems);
  const hiddenByTopThree = Math.max(0, visibleCards.length - displayed);
  const maxInterruptions = brief.attentionBudget?.maxInterruptions ?? 0;
  const usedInterruptions = brief.attentionBudget?.usedInterruptions ?? 0;
  const overflowDetail =
    hiddenByTopThree > 0 ? ` · 另有 ${hiddenByTopThree} 张需进首页查看` : '';
  const noiseDetail = prefilteredNoiseBreakdown
    ? ` (${prefilteredNoiseBreakdown})`
    : '';

  return {
    main: `筛选口径：显示 ${displayed}/${visibleCards.length} 张 mission · 扫描 ${rawSignals} 条信号`,
    detail: `候选 ${candidates} · 入选证据 ${selectedEvidence} · 候选未入选 ${candidateNotSelected} · 前置降噪 ${prefilteredNoise}${noiseDetail} · 提醒预算 ${usedInterruptions}/${maxInterruptions}${overflowDetail}。这里只是 Top 3 快照，不会自动执行。${buildTodayPilotPopupSnapshotBasis(
      brief,
      context,
    )}`,
    overflowCount: hiddenByTopThree,
    overflowActionLabel:
      hiddenByTopThree > 0 ? `查看全部 ${visibleCards.length}` : '',
    overflowBoundary:
      hiddenByTopThree > 0
        ? `Top 3 之外还有 ${hiddenByTopThree} 张 mission；打开 Today Pilot 首页只查看完整可见 brief，不会刷新、写反馈、发送消息或执行动作。`
        : '',
  };
}

function compactTodayPilotErrorMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim().slice(0, 96) || 'refresh_failed';
}

function buildTodayPilotPopupRefreshFailureReceipt(
  errorMessage: string,
  previousReceipt: TodayPilotPopupScopeReceipt | null,
  previousCards: DayPilotCard[],
): TodayPilotPopupScopeReceipt {
  const previousSummary = previousReceipt
    ? `${previousReceipt.main.replace(/^筛选口径：/, '上次筛选：')} · ${
        previousReceipt.detail
      }`
    : `上次显示 ${previousCards.length} 张 mission`;
  return {
    main: '刷新失败 · 仍显示上次 Top 3 快照',
    detail: `${previousSummary}；尚未确认当前 Memory Service 最新状态，也没有写入反馈、发送消息或执行动作。错误：${compactTodayPilotErrorMessage(
      errorMessage,
    )}`,
    overflowCount: previousReceipt?.overflowCount ?? 0,
    overflowActionLabel: previousReceipt?.overflowActionLabel || '',
    overflowBoundary: previousReceipt?.overflowBoundary || '',
  };
}

function formatTodayPilotPopupCardLabel(card: DayPilotCard): string {
  return card.title || card.missionId || card.id || 'mission';
}

function buildTodayPilotPopupCardMainBoundary(
  card: DayPilotCard,
  language: UiLanguage,
): string {
  const label = formatTodayPilotPopupCardLabel(card);
  const next = card.nextBestAction?.trim();
  const reason = card.whyNow?.trim();
  if (language === 'en-US') {
    return [
      `Open Today Pilot home for "${label}".`,
      'This popup row is only a collapsed Top 3 snapshot; opening it navigates to the full visible brief.',
      next ? `Next action: ${next}.` : '',
      reason ? `Reason: ${reason}.` : '',
      'It does not refresh the brief, write feedback, copy context, send messages, or execute actions.',
    ]
      .filter(Boolean)
      .join(' ');
  }
  return [
    `打开 Today Pilot 首页查看「${label}」。`,
    '这行只是 Top 3 折叠快照；点击只导航到完整可见 brief。',
    next ? `你要做：${next}。` : '',
    reason ? `为什么出现：${reason}。` : '',
    '不会刷新 brief、写反馈、复制上下文、发送消息或执行动作。',
  ]
    .filter(Boolean)
    .join('');
}

function buildTodayPilotPopupOverflowBoundary(
  receipt: TodayPilotPopupScopeReceipt,
  language: UiLanguage,
): string {
  if (language === 'en-US') {
    return receipt.overflowBoundary
      ? `${receipt.overflowBoundary} This button only opens Today Pilot home; it does not refresh, write feedback, send messages, or execute actions.`
      : 'Open Today Pilot home to view the full visible brief; this does not refresh, write feedback, send messages, or execute actions.';
  }
  return receipt.overflowBoundary
    ? `${receipt.overflowBoundary} 这个按钮只打开 Today Pilot 首页，不会刷新、写反馈、发送消息或执行动作。`
    : '打开 Today Pilot 首页查看完整可见 brief；不会刷新、写反馈、发送消息或执行动作。';
}

function buildTodayPilotPopupMeetingBoundary(
  card: DayPilotCard,
  language: UiLanguage,
): string {
  const label = formatTodayPilotPopupCardLabel(card);
  if (language === 'en-US') {
    return `Open RingCentral Video Home for "${label}" to review the meeting-prep surface. This only opens the meeting list; it does not join a meeting, start capture, write feedback, send messages, or change calendar data.`;
  }
  return `打开 RingCentral Video Home 复核「${label}」的会前准备入口；只打开会议列表，不会加入会议、开始 Capture、写反馈、发送消息或改日历。`;
}

function buildTodayPilotPopupFeedbackButtonBoundary(
  card: DayPilotCard,
  action: TodayPilotPopupFeedbackAction,
  language: UiLanguage,
  pending = false,
): string {
  const label = formatTodayPilotPopupCardLabel(card);
  const actionLabel = todayPilotPopupFeedbackActionLabel(action, language);
  if (language === 'en-US') {
    if (pending) {
      return `Submitting ${actionLabel} for "${label}". The mission stays visible until Memory Service confirms; source tasks, messages, calendar items, schedules, and external systems are unchanged.`;
    }
    if (action === 'done') {
      return `Done for "${label}": writes Today Pilot display/ranking feedback and hides this mission from today's Top 3 after confirmation. It does not complete source tasks, mark messages read, change calendars or schedules, sync external systems, or execute actions.`;
    }
    return `Later for "${label}": writes Today Pilot display/ranking feedback and hides this mission for 6 hours after confirmation. It does not reschedule the source task, change calendars or action execution time, send messages, sync external systems, or execute actions.`;
  }
  if (pending) {
    return `正在提交「${label}」的${actionLabel}反馈：等待 Memory Service 确认前 mission 仍保留；不会修改来源任务、消息、日历、排程、外部系统或执行动作。`;
  }
  if (action === 'done') {
    return `完成「${label}」：确认后只写 Today Pilot 展示/排序反馈，并从今天 Top 3 隐藏；不会完成来源任务、标记消息已读、改日历/排程、同步外部系统或执行动作。`;
  }
  return `稍后 6 小时「${label}」：确认后只写 Today Pilot 展示/排序反馈，并让这张 mission 6 小时内不进 Top 3；不会改来源任务排程、日历、动作执行时间、发送消息、同步外部系统或执行动作。`;
}

function buildTodayPilotPopupCopyBoundary(
  card: DayPilotCard,
  language: UiLanguage,
  copying = false,
): string {
  const label = formatTodayPilotPopupCardLabel(card);
  if (language === 'en-US') {
    return copying
      ? `Copying context for "${label}". This is only writing the generated context pack to the local clipboard; it does not send it to an external AI, approve or execute actions, write back to sources, or complete tasks.`
      : `Copy context for "${label}": generates a generic context pack and writes it to the local clipboard. It does not send it to an external AI, approve or execute actions, write back to sources, or complete tasks.`;
  }
  return copying
    ? `正在复制「${label}」的上下文包：只把生成正文写入本机剪贴板；不会发送给外部 AI、批准或执行动作、写回来源系统或完成任务。`
    : `复制「${label}」上下文包：生成通用 context pack 并写入本机剪贴板；不会发送给外部 AI、批准或执行动作、写回来源系统或完成任务。`;
}

function buildTodayPilotPopupExternalReviewBoundary(
  card: DayPilotCard,
  language: UiLanguage,
): string {
  const label = formatTodayPilotPopupCardLabel(card);
  if (language === 'en-US') {
    return `Review external execution for "${label}": opens the handling page for the action evidence. The popup does not approve, reject, retry, execute OpenClaw, copy a context pack, send messages, or write feedback.`;
  }
  return `去处理「${label}」：只打开动作证据对应的处理页复核外部执行；popup 内不会批准、拒绝、重试或执行 OpenClaw，不会复制上下文包、发送消息或写反馈。`;
}

function formatTodayPilotContextPackReceipt(
  pack: DayPilotContextPackResponse,
): string {
  const provider =
    pack.providerProfile?.id === 'generic'
      ? '通用'
      : pack.providerProfile?.label || 'Today Pilot';
  const total =
    typeof pack.sourceSummary?.evidenceCount === 'number'
      ? pack.sourceSummary.evidenceCount
      : pack.evidenceRefs.length;
  const rendered =
    typeof pack.sourceSummary?.renderedEvidenceCount === 'number'
      ? pack.sourceSummary.renderedEvidenceCount
      : pack.evidenceRefs.length;
  const omitted =
    typeof pack.sourceSummary?.omittedEvidenceCount === 'number'
      ? pack.sourceSummary.omittedEvidenceCount
      : Math.max(0, total - rendered);
  const details = [
    `复制正文 ${Math.max(0, Math.min(total, rendered))}/${total} 条证据`,
  ];
  if (omitted > 0) {
    details.push(`${omitted} 条未进入正文`);
  }
  if (pack.redactionApplied) {
    details.push('已脱敏');
  }
  if (pack.truncated) {
    details.push('已按预算截断');
  }
  return `已复制${provider}上下文包（${details.join('，')}）`;
}

function hashTodayPilotContextPackBody(body: string): string {
  let hash = 0;
  for (let index = 0; index < body.length; index += 1) {
    hash = ((hash << 5) - hash + body.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function todayPilotContextPackEvidenceRefs(
  pack: DayPilotContextPackResponse,
): AmbientCalibrationEvidenceRef[] {
  return pack.evidenceRefs.slice(0, 12).map((ref) => ({
    id: `${ref.sourceKind}:${ref.sourceId}`,
    type: ref.sourceKind,
    title: ref.title,
    sourceLabel: ref.sourceKind,
    role: 'used',
  }));
}

function submitTodayPilotContextCopyTrace(
  card: DayPilotCard,
  pack: DayPilotContextPackResponse,
): void {
  void getMemoryServiceClient()
    .submitAmbientCalibrationTrace({
      surface: 'today_pilot',
      sceneKey: `today_pilot:popup:${card.missionId || card.id}`,
      sourceRequestId: `context-pack:${card.missionId || card.id}:${
        pack.targetProvider
      }`,
      action: 'copied_context',
      strength: 'strong',
      polarity: 'positive',
      evidenceRefs: todayPilotContextPackEvidenceRefs(pack),
      redactedDiff: {
        rawTextStored: false,
        bodyHash: hashTodayPilotContextPackBody(pack.bodyMd),
        bodyLength: pack.bodyMd.length,
        evidenceCount: pack.evidenceRefs.length,
        redactionApplied: pack.redactionApplied,
        truncated: pack.truncated,
      },
      privacyClass:
        pack.redactionApplied || pack.redactionPreview.length > 0
          ? 'sensitive_redacted'
          : 'normal',
      metadata: {
        nativeSurface: 'popup_top_three',
        cardId: card.id,
        missionId: card.missionId,
        cardType: card.cardType,
        targetProvider: pack.targetProvider,
        providerProfile: pack.providerProfile.id,
        includeSensitive: false,
        usageIntent: pack.usageIntent?.kind || 'external_ai_context',
        contextBoundary:
          pack.usageIntent?.boundary || 'context_only_not_execution',
      },
      createdAt: Date.now(),
    })
    .catch((error) => {
      console.warn('[popup] Today Pilot context copy trace failed:', error);
    });
}

function isTodayPilotExternalExecutionCard(card: DayPilotCard): boolean {
  if (card.cardType !== 'decision_check') return false;

  const evidenceText = card.evidenceRefs
    .map((item) =>
      [item.sourceKind, item.sourceId, item.title, item.snippet]
        .filter(Boolean)
        .join(' '),
    )
    .join(' ');
  if (/delegate[_-]?openclaw|openclaw_delegation/i.test(evidenceText)) {
    return true;
  }

  return card.evidenceRefs.some((item) => {
    if (item.sourceKind !== 'action') return false;
    return /openclaw|ringclaw/i.test(
      [item.sourceId, item.title, item.snippet].filter(Boolean).join(' '),
    );
  });
}

function getTodayPilotProcessingPath(card: DayPilotCard): string {
  const actionRef = card.evidenceRefs.find(
    (item) => item.sourceKind === 'action' && item.sourceId,
  );
  if (actionRef) {
    return `memory-exploring.html#/actions?actionId=${encodeURIComponent(
      actionRef.sourceId,
    )}`;
  }
  return 'memory-exploring.html#/';
}

function topTodayPilotCards(cards: DayPilotCard[]): DayPilotCard[] {
  return filterTodayPilotVisibleCards(cards).slice(0, 3);
}

type TodayPilotPopupFeedbackAction = 'done' | 'later';

function todayPilotPopupFeedbackActionLabel(
  action: TodayPilotPopupFeedbackAction,
  language: UiLanguage,
): string {
  if (language === 'en-US') {
    return action === 'done' ? 'Done' : 'Later for 6 hours';
  }
  return action === 'done' ? '完成' : '稍后 6 小时';
}

function buildTodayPilotPopupFeedbackPendingNotice(
  action: TodayPilotPopupFeedbackAction,
  language: UiLanguage,
): string {
  const label = todayPilotPopupFeedbackActionLabel(action, language);
  if (language === 'en-US') {
    return `Submitting ${label}. This mission stays visible until Memory Service confirms it; no Today Pilot display/ranking feedback has been written yet, and source tasks, messages, calendar items, and external systems are unchanged.`;
  }
  return `正在提交反馈：${label}。等待 Memory Service 确认前，这张 mission 仍保留当前状态；尚未写入 Today Pilot 展示/排序反馈，也没有修改来源任务、消息、日历或外部系统。`;
}

function buildTodayPilotPopupFeedbackSuccessNotice(
  action: TodayPilotPopupFeedbackAction,
  language: UiLanguage,
): string {
  const label = todayPilotPopupFeedbackActionLabel(action, language);
  if (language === 'en-US') {
    return `Today Pilot display feedback was saved: ${label}. This only updates today's Today Pilot display/ranking; it does not complete source tasks, mark messages read, change schedules, or operate external systems.`;
  }
  return `已写入 Today Pilot 展示反馈：${label}。这只更新今天的展示/排序，不代表来源任务完成、消息已读、排程变更或外部系统已同步。`;
}

function buildTodayPilotPopupFeedbackFailureNotice(
  errorMessage: string,
  language: UiLanguage,
): string {
  const error = compactTodayPilotErrorMessage(errorMessage);
  if (language === 'en-US') {
    return `Feedback failed; the mission is still visible. No Today Pilot display/ranking feedback was written, and source tasks, messages, calendar items, and external systems were not changed. Error: ${error}`;
  }
  return `反馈提交失败，原卡仍显示。尚未写入 Today Pilot 展示/排序反馈，也没有修改来源任务、消息、日历或外部系统。错误：${error}`;
}

async function focusMeetingPilotRecordingTab(
  session: MeetingPilotSessionSnapshot,
): Promise<void> {
  const tab = await chrome.tabs.get(session.tabId);
  if (typeof tab.windowId === 'number') {
    await chrome.windows.update(tab.windowId, { focused: true });
  }
  await chrome.tabs.update(session.tabId, { active: true });
}

const Popup = () => {
  const { language: uiLanguage, t } = useExtensionUiLanguage();
  useStaticDomI18n(uiLanguage);
  const [isScheduleActive, setIsScheduleActive] = useState(false);
  const [envConfig, setEnvConfig] = useState<any>(null);
  const [isGoogleSheets, setIsGoogleSheets] = useState(false);
  const [isGoogleSlides, setIsGoogleSlides] = useState(false);
  const [isRingCentralMeeting, setIsRingCentralMeeting] = useState(false);
  const [activeRingCentralTab, setActiveRingCentralTab] = useState<{
    id: number;
    url?: string;
    title?: string;
  } | null>(null);
  const [meetingPilotSession, setMeetingPilotSession] =
    useState<MeetingPilotSessionSnapshot | null>(null);
  const [isMeetingPilotBusy, setIsMeetingPilotBusy] = useState(false);
  const [meetingPilotNotice, setMeetingPilotNotice] =
    useState<MeetingPilotNotice | null>(null);
  const [isExpandingEpic, setIsExpandingEpic] = useState(false);
  const [isAnalyzingSlides, setIsAnalyzingSlides] = useState(false);
  const [isScheduleUpdating, setIsScheduleUpdating] = useState(false);
  const [isTaskStatusLoading, setIsTaskStatusLoading] = useState(false);
  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false);
  const [taskStatusNow, setTaskStatusNow] = useState(() => Date.now());
  const [taskSchedulerTasks, setTaskSchedulerTasks] = useState<
    TaskSchedulerTask[]
  >([]);
  const [taskSchedulerError, setTaskSchedulerError] = useState('');
  const [taskSchedulerRefreshReceipt, setTaskSchedulerRefreshReceipt] =
    useState<TaskSchedulerStatusRefreshReceipt | null>(null);
  const [
    taskSchedulerRefreshFailureReceipt,
    setTaskSchedulerRefreshFailureReceipt,
  ] = useState<TaskSchedulerRefreshFailureReceipt | null>(null);
  const [taskSchedulerActionReceipt, setTaskSchedulerActionReceipt] =
    useState<TaskSchedulerActionReceipt | null>(null);
  const [busyTaskIds, setBusyTaskIds] = useState<Record<string, boolean>>({});
  const [pendingTaskActions, setPendingTaskActions] = useState<
    Record<string, TaskSchedulerPendingAction>
  >({});
  const [todayPilotCards, setTodayPilotCards] = useState<DayPilotCard[]>([]);
  const [todayPilotLoading, setTodayPilotLoading] = useState(false);
  const [todayPilotError, setTodayPilotError] = useState('');
  const [todayPilotNotice, setTodayPilotNotice] = useState('');
  const [todayPilotScopeReceipt, setTodayPilotScopeReceipt] =
    useState<TodayPilotPopupScopeReceipt | null>(null);
  const [todayPilotCopyingMissionId, setTodayPilotCopyingMissionId] =
    useState('');
  const [todayPilotFeedbackingCardId, setTodayPilotFeedbackingCardId] =
    useState('');
  const headerSchedulePendingAction =
    pendingTaskActions.message_analysis === 'toggle-enable' ||
    pendingTaskActions.message_analysis === 'toggle-disable'
      ? pendingTaskActions.message_analysis
      : null;
  const headerSchedulePendingReceipt = headerSchedulePendingAction
    ? buildTaskSchedulerHeaderTogglePendingReceipt({
        action: headerSchedulePendingAction,
        task: taskSchedulerTasks.find((task) => task.id === 'message_analysis'),
        language: uiLanguage,
      })
    : null;

  const loadTaskSchedulerStatus = async (
    showLoading = false,
  ): Promise<TaskSchedulerTask[] | null> => {
    if (showLoading) {
      setIsTaskStatusLoading(true);
    }
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'GET_TASK_SCHEDULER_STATUS',
      })) as
        | {
            success?: boolean;
            tasks?: TaskSchedulerTask[];
            refreshReceipt?: TaskSchedulerStatusRefreshReceipt;
            error?: string;
          }
        | undefined;

      if (!response?.success || !Array.isArray(response.tasks)) {
        throw new Error(response?.error || '任务状态不可用');
      }

      setTaskSchedulerTasks(response.tasks);
      setTaskSchedulerRefreshReceipt(response.refreshReceipt || null);
      setTaskSchedulerRefreshFailureReceipt(null);
      setTaskStatusNow(Date.now());
      setTaskSchedulerError('');

      const messageAnalysisTask = response.tasks.find(
        (task) => task.id === 'message_analysis',
      );
      if (messageAnalysisTask) {
        setIsScheduleActive(messageAnalysisTask.enabled);
      }
      return response.tasks;
    } catch (error: any) {
      const message = error?.message || '任务状态不可用';
      const hasSnapshot = taskSchedulerTasks.length > 0;
      const snapshotRefreshedAt = taskStatusNow;
      setTaskSchedulerRefreshReceipt(null);
      setTaskSchedulerRefreshFailureReceipt(
        buildTaskSchedulerRefreshFailureReceipt(message, {
          hasSnapshot,
          snapshotRefreshedAt,
          language: uiLanguage,
        }),
      );
      setTaskSchedulerError(
        formatTaskSchedulerStatusError(message, {
          hasSnapshot,
          snapshotRefreshedAt,
          language: uiLanguage,
        }),
      );
      return null;
    } finally {
      if (showLoading) {
        setIsTaskStatusLoading(false);
      }
    }
  };

  const loadTodayPilotCards = async () => {
    const previousCards = todayPilotCards;
    const previousScopeReceipt = todayPilotScopeReceipt;
    setTodayPilotLoading(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await getMemoryServiceClient().getTodayPilotToday({
        timezone: timezone || 'Asia/Shanghai',
        autoGenerate: true,
      });
      setTodayPilotCards(topTodayPilotCards(response.brief?.cards || []));
      setTodayPilotScopeReceipt(
        buildTodayPilotPopupScopeReceipt(response.brief, {
          generated: response.generated,
          stale: response.stale,
        }),
      );
      setTodayPilotError('');
      setTodayPilotNotice('');
    } catch (error: any) {
      const message = error?.message || 'today_pilot_unavailable';
      if (previousCards.length > 0) {
        setTodayPilotCards(previousCards);
        setTodayPilotScopeReceipt(
          buildTodayPilotPopupRefreshFailureReceipt(
            message,
            previousScopeReceipt,
            previousCards,
          ),
        );
        setTodayPilotError('刷新失败，仍显示上次 Top 3 快照');
      } else {
        setTodayPilotCards([]);
        setTodayPilotScopeReceipt(null);
        setTodayPilotError(message);
      }
      setTodayPilotNotice('');
    } finally {
      setTodayPilotLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      // 获取定时任务状态 - 使用辅助函数
      const messageAnalysisEnabled = await getTaskEnabled('message_analysis');
      setIsScheduleActive(messageAnalysisEnabled);
      void loadTaskSchedulerStatus(false);
      void loadTodayPilotCards();

      // 检查当前标签页是否是 Google Sheets 或 Google Slides
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.url?.includes('docs.google.com/spreadsheets')) {
        setIsGoogleSheets(true);
      }
      if (tab?.url?.includes('docs.google.com/presentation')) {
        setIsGoogleSlides(true);
      }
      if (
        tab?.id &&
        (tab.url?.includes('app.ringcentral.com') ||
          tab.url?.includes('v.ringcentral.com/conf/on/'))
      ) {
        setActiveRingCentralTab({
          id: tab.id,
          url: tab.url,
          title: tab.title,
        });
      }
      if (tab?.url?.includes('v.ringcentral.com/conf/on/')) {
        setIsRingCentralMeeting(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isTaskPanelOpen) {
      return undefined;
    }

    const refreshTimer = window.setInterval(() => {
      void loadTaskSchedulerStatus(false);
    }, 60_000);

    return () => {
      window.clearInterval(refreshTimer);
    };
  }, [isTaskPanelOpen]);

  useEffect(() => {
    if (!activeRingCentralTab?.id) {
      setMeetingPilotSession(null);
      setMeetingPilotNotice(null);
      return;
    }

    const refreshMeetingPilotSession = async () => {
      try {
        const response = (await chrome.runtime.sendMessage({
          type: 'MEETING_PILOT_GET_STATE',
          tabId: activeRingCentralTab.id,
        })) as { activeSession?: MeetingPilotSessionSnapshot } | undefined;
        setMeetingPilotSession(response?.activeSession || null);
      } catch (error) {
        console.warn(
          'Failed to refresh Meeting Pilot session in popup:',
          error,
        );
      }
    };

    void refreshMeetingPilotSession();

    const handleMessage = (message: any) => {
      if (message.type !== 'MEETING_PILOT_SESSION_SNAPSHOT') {
        return;
      }
      const snapshot = message.snapshot as
        | MeetingPilotSessionSnapshot
        | undefined;
      if (!snapshot || snapshot.tabId !== activeRingCentralTab.id) {
        return;
      }
      setMeetingPilotSession(snapshot);
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [activeRingCentralTab?.id]);

  useEffect(() => {
    (async () => {
      const envConfigData = await getEnvConfig();
      setEnvConfig(envConfigData);
    })();
  }, []);

  const toggleSchedule = async () => {
    if (isScheduleUpdating) {
      return;
    }

    const newState = !isScheduleActive;
    const previousState = isScheduleActive;
    setIsScheduleUpdating(true);
    setTaskSchedulerActionReceipt(null);
    setPendingTaskAction(
      'message_analysis',
      newState ? 'toggle-enable' : 'toggle-disable',
    );

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'CONTROL_TASK',
        taskId: 'message_analysis',
        action: 'toggle',
        enabled: newState,
      })) as
        | { success?: boolean; error?: string; message?: string }
        | undefined;

      if (!response?.success) {
        await loadTaskSchedulerStatus(false);
        throw new Error(response?.error || response?.message || '任务控制失败');
      }

      const updatedTasks = await loadTaskSchedulerStatus(false);
      const updatedTask = updatedTasks?.find(
        (task) => task.id === 'message_analysis',
      );
      if (updatedTask) {
        setIsScheduleActive(updatedTask.enabled);
      } else {
        setIsScheduleActive(newState);
      }
      const fallbackTask =
        taskSchedulerTasks.find((task) => task.id === 'message_analysis') ||
        updatedTask;
      if (fallbackTask) {
        setTaskSchedulerActionReceipt(
          buildTaskSchedulerActionReceipt({
            action: 'toggle',
            task: fallbackTask,
            updatedTask,
            enabled: newState,
            message: response.message,
            language: uiLanguage,
          }),
        );
      }

      if (newState) {
        void maybeOpenSilentAnalysisOnboarding();
      }
    } catch (error: any) {
      setIsScheduleActive(previousState);
      const fallbackTask = taskSchedulerTasks.find(
        (task) => task.id === 'message_analysis',
      );
      if (fallbackTask) {
        setTaskSchedulerActionReceipt(
          buildTaskSchedulerActionReceipt({
            action: 'toggle',
            task: fallbackTask,
            enabled: newState,
            message: error?.message || '任务控制失败',
            failed: true,
            language: uiLanguage,
          }),
        );
      }
      setTaskSchedulerError('');
    } finally {
      setPendingTaskAction('message_analysis', null);
      setIsScheduleUpdating(false);
    }
  };

  const setTaskBusy = (taskId: string, busy: boolean) => {
    setBusyTaskIds((current) => ({ ...current, [taskId]: busy }));
  };

  const setPendingTaskAction = (
    taskId: string,
    action: TaskSchedulerPendingAction | null,
  ) => {
    setPendingTaskActions((current) => {
      const next = { ...current };
      if (action) {
        next[taskId] = action;
      } else {
        delete next[taskId];
      }
      return next;
    });
  };

  const patchTaskSchedulerTask = (
    taskId: string,
    patch: Partial<TaskSchedulerTask>,
  ) => {
    setTaskSchedulerTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              ...patch,
            }
          : task,
      ),
    );
  };

  const updateTaskEnabled = async (
    task: TaskSchedulerTask,
    enabled: boolean,
  ) => {
    const previousTask = task;
    setTaskBusy(task.id, true);
    setTaskSchedulerActionReceipt(null);
    setPendingTaskAction(
      task.id,
      enabled ? 'toggle-enable' : 'toggle-disable',
    );

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'CONTROL_TASK',
        taskId: task.id,
        action: 'toggle',
        enabled,
      })) as
        | { success?: boolean; error?: string; message?: string }
        | undefined;

      if (!response?.success) {
        await loadTaskSchedulerStatus(false);
        throw new Error(response?.error || response?.message || '任务控制失败');
      }

      const updatedTasks = await loadTaskSchedulerStatus(false);
      const updatedTask = updatedTasks?.find(
        (candidate) => candidate.id === task.id,
      );
      setTaskSchedulerActionReceipt(
        buildTaskSchedulerActionReceipt({
          action: 'toggle',
          task,
          updatedTask,
          enabled,
          message: response.message,
          language: uiLanguage,
        }),
      );
    } catch (error: any) {
      patchTaskSchedulerTask(task.id, previousTask);
      if (task.id === 'message_analysis') {
        setIsScheduleActive(previousTask.enabled);
      }
      setTaskSchedulerActionReceipt(
        buildTaskSchedulerActionReceipt({
          action: 'toggle',
          task: previousTask,
          enabled,
          message: error?.message || '任务控制失败',
          failed: true,
          language: uiLanguage,
        }),
      );
      setTaskSchedulerError('');
    } finally {
      setPendingTaskAction(task.id, null);
      setTaskBusy(task.id, false);
    }
  };

  const runTaskNow = async (task: TaskSchedulerTask) => {
    setTaskBusy(task.id, true);
    setTaskSchedulerActionReceipt(null);
    setPendingTaskAction(task.id, 'run');
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'CONTROL_TASK',
        taskId: task.id,
        action: 'run',
      })) as
        | {
            success?: boolean;
            skipped?: boolean;
            error?: string;
            message?: string;
          }
        | undefined;

      if (!response) {
        throw new Error('任务执行失败');
      }

      const updatedTasks = await loadTaskSchedulerStatus(false);
      const updatedTask = updatedTasks?.find(
        (candidate) => candidate.id === task.id,
      );
      const runFailed = response.success !== true && !response.skipped;
      setTaskSchedulerActionReceipt(
        buildTaskSchedulerActionReceipt({
          action: 'run',
          task,
          updatedTask,
          message: response.error || response.message,
          skipped: response.skipped,
          failed: runFailed,
          language: uiLanguage,
        }),
      );
      if (runFailed) {
        if (updatedTasks) {
          setTaskSchedulerError('');
        }
        return;
      }
    } catch (error: any) {
      await loadTaskSchedulerStatus(false);
      setTaskSchedulerActionReceipt(
        buildTaskSchedulerActionReceipt({
          action: 'run',
          task,
          message: error?.message || '任务执行失败',
          failed: true,
          language: uiLanguage,
        }),
      );
      setTaskSchedulerError('');
    } finally {
      setPendingTaskAction(task.id, null);
      setTaskBusy(task.id, false);
    }
  };

  const repairTaskSchedule = async (task: TaskSchedulerTask) => {
    setTaskBusy(task.id, true);
    setTaskSchedulerActionReceipt(null);
    setPendingTaskAction(task.id, 'repair');

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'CONTROL_TASK',
        taskId: task.id,
        action: 'repair',
      })) as
        | { success?: boolean; error?: string; message?: string }
        | undefined;

      if (!response?.success) {
        throw new Error(response?.error || response?.message || '排程修复失败');
      }

      const updatedTasks = await loadTaskSchedulerStatus(false);
      const updatedTask = updatedTasks?.find(
        (candidate) => candidate.id === task.id,
      );
      setTaskSchedulerActionReceipt(
        buildTaskSchedulerActionReceipt({
          action: 'repair',
          task,
          updatedTask,
          message: response.message,
          language: uiLanguage,
        }),
      );
    } catch (error: any) {
      await loadTaskSchedulerStatus(false);
      setTaskSchedulerActionReceipt(
        buildTaskSchedulerActionReceipt({
          action: 'repair',
          task,
          message: error?.message || '排程修复失败',
          failed: true,
          language: uiLanguage,
        }),
      );
      setTaskSchedulerError('');
    } finally {
      setPendingTaskAction(task.id, null);
      setTaskBusy(task.id, false);
    }
  };

  const pushMeetingPilotSnapshotToTab = async (
    snapshot: MeetingPilotSessionSnapshot | null | undefined,
  ) => {
    if (!snapshot || !activeRingCentralTab?.id) {
      return;
    }
    try {
      await chrome.tabs.sendMessage(activeRingCentralTab.id, {
        type: 'MEETING_PILOT_SESSION_SNAPSHOT',
        snapshot,
      });
    } catch (error) {
      console.warn(
        'Failed to sync Meeting Pilot snapshot back to meeting tab:',
        error,
      );
    }
  };

  const handleOpenRadar = async () => {
    if (!activeRingCentralTab?.id) {
      console.info(
        '[Meeting Pilot][popup] no meeting tab resolved, falling back to active tab message',
      );
      setMeetingPilotNotice({
        tone: 'warning',
        message: '没有找到当前 RingCentral 会议 tab。请切回会议页后再开启会议全貌。',
      });
      sendMessageToActiveTab(
        { type: 'RADAR-POC-OPEN-PANEL' },
        'RADAR-POC-OPEN-PANEL',
      );
      return;
    }

    if (isMeetingPilotBusy) {
      return;
    }

    setIsMeetingPilotBusy(true);
    setMeetingPilotNotice(buildMeetingPilotStartPendingNotice());
    try {
      if (isMeetingPilotCaptureActive(meetingPilotSession)) {
        await pushMeetingPilotSnapshotToTab(meetingPilotSession);
        await chrome.runtime.sendMessage({
          type: 'MEETING_PILOT_OPEN_SIDE_PANEL',
          tabId: activeRingCentralTab.id,
        });
        window.close();
        return;
      }

      const meetingId = extractMeetingIdFromUrl(activeRingCentralTab.url);
      if (!meetingId) {
        console.warn('[Meeting Pilot][popup] meeting id not found', {
          tabId: activeRingCentralTab.id,
          url: activeRingCentralTab.url,
        });
        setMeetingPilotNotice({
          tone: 'warning',
          message:
            '当前 tab 还不是 RingCentral 会议房间页。请进入 /conf/on/ 会议页后再开启会议全貌。',
        });
        return;
      }

      console.info('[Meeting Pilot][popup] starting capture', {
        tabId: activeRingCentralTab.id,
        meetingId,
      });
      const response = (await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_ENABLE_CAPTURE_AND_OPEN_PANEL',
        tabId: activeRingCentralTab.id,
        meetingId,
        url: activeRingCentralTab.url,
        title: activeRingCentralTab.title || 'RingCentral meeting',
        source: 'popup-start',
      })) as
        | {
            success?: boolean;
            session?: MeetingPilotSessionSnapshot;
            activeRecording?: MeetingPilotSessionSnapshot;
            panelError?: string;
            surface?: string;
          }
        | undefined;
      console.info('[Meeting Pilot][popup] start capture response', response);

      if (response?.session) {
        setMeetingPilotSession(response.session);
        await pushMeetingPilotSnapshotToTab(response.session);
      }

      if (response?.success) {
        setMeetingPilotNotice(null);
        window.close();
      } else {
        if (response?.activeRecording) {
          const activeRecording = response.activeRecording;
          const shouldFocusRecordingTab = window.confirm(
            `已有会议正在录制：${
              activeRecording.title || activeRecording.meetingId
            }\n\n是否跳转到正在录制的会议 tab？`,
          );
          if (shouldFocusRecordingTab) {
            try {
              await focusMeetingPilotRecordingTab(activeRecording);
              window.close();
              return;
            } catch (error) {
              console.warn(
                '[Meeting Pilot][popup] failed to focus active recording tab',
                error,
              );
              alert('正在录制的会议 tab 已无法访问，请重试开启会议全貌。');
            }
          }
        }
        setMeetingPilotNotice(buildMeetingPilotStartNotice(response));
        console.warn('[Meeting Pilot][popup] start capture did not succeed', {
          response,
          capture: response?.session?.capture,
          readiness: response?.session?.readiness,
        });
      }
    } catch (error) {
      console.error('[Meeting Pilot][popup] failed to open panorama', error);
      setMeetingPilotNotice({
        tone: 'error',
        message: `开启会议全貌失败：${String(
          (error as Error)?.message || error,
        )}。请确认会议页仍打开后重试。`,
      });
    } finally {
      setIsMeetingPilotBusy(false);
    }
  };

  const openMeetingPilotOptions = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('options.html#meeting-pilot-config'),
      active: true,
    });
  };

  const openProjectRoadmap = async () => {
    const config = envConfig || (await getEnvConfig());
    const roadmapUrl = String(config.ROADMAP_BASE_URL || '').trim();
    if (!roadmapUrl) {
      chrome.tabs.create({
        url: chrome.runtime.getURL('options.html#roadmap-config'),
        active: true,
      });
      return;
    }
    chrome.tabs.create({
      url: roadmapUrl,
      active: true,
    });
  };

  const maybeOpenSilentAnalysisOnboarding = async () => {
    try {
      const stored = await chrome.storage.local.get([
        'silentAnalysisOnboarded',
        'concernedItems',
      ]);
      if (stored.silentAnalysisOnboarded) return;

      const items = Array.isArray(stored.concernedItems)
        ? stored.concernedItems
        : [];
      const hasCustomRules = items.some((item: any) => {
        const id = String(item?.id || '');
        return id && !['1', '2', '3'].includes(id);
      });
      if (hasCustomRules) {
        await chrome.storage.local.set({ silentAnalysisOnboarded: true });
        return;
      }

      await openMemoryEntryRules({ onboarding: true });
    } catch (error) {
      console.warn('Silent analysis onboarding failed:', error);
    }
  };

  const _openProjectDashboard = () => {
    chrome.windows.create({
      url: 'project-dashboard.html',
      type: 'popup',
      width: 1200,
      height: 900,
      focused: true,
    });
  };

  const openMemoryInterface = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('memory-exploring.html'),
      active: true,
    });
  };

  const openTodayPilotHome = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('memory-exploring.html#/'),
      active: true,
    });
  };

  const openTodayPilotProcessingTarget = (card: DayPilotCard) => {
    chrome.tabs.create({
      url: chrome.runtime.getURL(getTodayPilotProcessingPath(card)),
      active: true,
    });
  };

  const openRingCentralVideoHome = () => {
    chrome.tabs.create({
      url: 'https://app.ringcentral.com/video/home',
      active: true,
    });
  };

  const copyTodayPilotContextPack = async (card: DayPilotCard) => {
    if (!card.missionId) {
      openTodayPilotHome();
      return;
    }
    setTodayPilotCopyingMissionId(card.missionId);
    try {
      const client = getMemoryServiceClient();
      const response = await client.renderTodayPilotContextPack(card.missionId, {
        targetProvider: 'generic',
        includeSensitive: false,
      });
      await navigator.clipboard.writeText(response.bodyMd);
      submitTodayPilotContextCopyTrace(card, response);
      setTodayPilotError('');
      setTodayPilotNotice(formatTodayPilotContextPackReceipt(response));
    } catch (error: any) {
      setTodayPilotError(error?.message || 'context_pack_copy_failed');
      setTodayPilotNotice('');
    } finally {
      setTodayPilotCopyingMissionId('');
    }
  };

  const sendTodayPilotPopupFeedback = async (
    card: DayPilotCard,
    action: TodayPilotPopupFeedbackAction,
  ) => {
    const previousCards = todayPilotCards;
    const feedbackKey = `${card.id}:${action}`;
    setTodayPilotFeedbackingCardId(feedbackKey);
    setTodayPilotError('');
    setTodayPilotNotice(
      buildTodayPilotPopupFeedbackPendingNotice(action, uiLanguage),
    );
    try {
      const response = await getMemoryServiceClient().sendTodayPilotCardFeedback(
        card.id,
        {
          action,
          snoozeUntil:
            action === 'later'
              ? Math.floor(Date.now() / 1000) + 6 * 3600
              : undefined,
        },
      );
      setTodayPilotCards(topTodayPilotCards(response.brief?.cards || []));
      setTodayPilotScopeReceipt(buildTodayPilotPopupScopeReceipt(response.brief));
      setTodayPilotError('');
      setTodayPilotNotice(
        buildTodayPilotPopupFeedbackSuccessNotice(action, uiLanguage),
      );
    } catch (error: any) {
      setTodayPilotCards(previousCards);
      setTodayPilotError(
        buildTodayPilotPopupFeedbackFailureNotice(
          error?.message || 'today_pilot_feedback_failed',
          uiLanguage,
        ),
      );
      setTodayPilotNotice('');
    } finally {
      setTodayPilotFeedbackingCardId('');
    }
  };

  const openScheduledMessagesManager = () => {
    chrome.windows.create({
      url: 'scheduled-messages.html',
      type: 'popup',
      width: 1280,
      height: 700,
      focused: true,
    });
  };

  // Help 图标点击处理
  const handleOpenHelp = () => {
    chrome.tabs.create({ url: WIKI_URL, active: true });
  };

  // Share 图标点击处理 - 打开独立窗口
  const handleOpenShare = () => {
    chrome.windows.create({
      url: 'share-modal.html',
      type: 'popup',
      width: 560,
      height: 680,
      focused: true,
    });
  };

  const handleOpenDesktopApp = () => {
    chrome.windows.create({
      url: chrome.runtime.getURL('desktop-app.html'),
      type: 'popup',
      width: 900,
      height: 920,
      focused: true,
    });
  };

  const analyzeSlidesProjects = async () => {
    try {
      setIsAnalyzingSlides(true);
      // 先获取OAuth token
      const token = await getGoogleAuthToken({
        caller: 'popup.analyzeSlidesProjects',
      });
      if (!token) {
        console.error('无法获取Google认证，请检查账号授权');
        alert('无法获取Google认证，请检查账号授权');
        // 可以在界面上显示错误消息
        setIsAnalyzingSlides(false);
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.id) {
          chrome.tabs.sendMessage(
            activeTab.id,
            {
              type: 'ANALYZE_SLIDES_PROJECTS',
              token,
            },
            (response) => {
              const runtimeError = chrome.runtime.lastError;

              if (runtimeError) {
                const errorMessage = `无法连接 Google Slides 页面: ${runtimeError.message}`;
                console.error(errorMessage);
                alert(errorMessage);
              } else if (!response?.success) {
                const errorMessage = response?.error || 'Slides 分析启动失败，请刷新页面后重试';
                console.error('Slides分析失败:', errorMessage);
                alert(errorMessage);
              }

              // 当收到响应时关闭loading状态
              setIsAnalyzingSlides(false);
            },
          );
        } else {
          alert('未找到当前 Google Slides 标签页，请切回 Slides 页面后重试');
          setIsAnalyzingSlides(false);
        }
      });
    } catch (error) {
      console.error('获取认证失败:', error);
      // 可以在界面上显示错误消息
      setIsAnalyzingSlides(false);
    }
  };

  const getMessageAnalysisIntervalLabel = () => {
    const messageAnalysisTask = taskSchedulerTasks.find(
      (task) => task.id === 'message_analysis',
    );
    const intervalMinutes =
      messageAnalysisTask?.intervalMinutes ||
      Number(envConfig?.MESSAGE_ANALYSIS_INTERVAL) ||
      Number(envConfig?.SCHEDULED_INTERVAL) ||
      30;

    return formatTaskInterval(intervalMinutes, uiLanguage);
  };

  const enabledTaskCount = taskSchedulerTasks.filter(
    (task) => task.enabled,
  ).length;
  const attentionTaskCount = countTasksByStatusFilter(
    taskSchedulerTasks,
    'attention',
  );
  const executingTaskCount = countTasksByStatusFilter(
    taskSchedulerTasks,
    'executing',
  );
  const failedTaskCount = countTasksByStatusFilter(
    taskSchedulerTasks,
    'failed',
  );
  const recentSkippedTaskCount = countTasksByStatusFilter(
    taskSchedulerTasks,
    'skipped',
  );
  const scheduleWarningTaskCount = countTasksByStatusFilter(
    taskSchedulerTasks,
    'warning',
  );
  const totalTaskCount = taskSchedulerTasks.length || '-';
  const enabledStatusSummary = isEnglishUi(uiLanguage)
    ? `${enabledTaskCount}/${totalTaskCount} enabled`
    : `${enabledTaskCount}/${totalTaskCount} 启用`;
  const taskStatusSummary = taskSchedulerError
    ? isEnglishUi(uiLanguage)
      ? 'Status unavailable'
      : '状态不可用'
    : isTaskStatusLoading
    ? isEnglishUi(uiLanguage)
      ? 'Loading'
      : '加载中'
    : executingTaskCount > 0
    ? isEnglishUi(uiLanguage)
      ? `${executingTaskCount} running · ${enabledStatusSummary}`
      : `${executingTaskCount} 执行中 · ${enabledStatusSummary}`
    : scheduleWarningTaskCount > 0
    ? isEnglishUi(uiLanguage)
      ? `${scheduleWarningTaskCount} schedule issue · ${enabledStatusSummary}`
      : `${scheduleWarningTaskCount} 排程异常 · ${enabledStatusSummary}`
    : failedTaskCount > 0
    ? isEnglishUi(uiLanguage)
      ? `${failedTaskCount} failed · ${enabledStatusSummary}`
      : `${failedTaskCount} 失败 · ${enabledStatusSummary}`
    : recentSkippedTaskCount > 0
    ? isEnglishUi(uiLanguage)
      ? `${recentSkippedTaskCount} skipped · ${enabledStatusSummary}`
      : `${recentSkippedTaskCount} 跳过 · ${enabledStatusSummary}`
    : enabledStatusSummary;
  const taskCollapsedAttentionPreview =
    formatTaskSchedulerCollapsedAttentionPreview(taskSchedulerTasks, uiLanguage);
  const visibleTaskSchedulerTasks = taskSchedulerTasks
    .map((task, index) => ({ task, index }))
    .sort(
      (left, right) =>
        getTaskAttentionRank(left.task) - getTaskAttentionRank(right.task) ||
        left.index - right.index,
    )
    .map(({ task }) => task);
  const primaryAttentionTask = taskSchedulerTasks
    .filter(taskNeedsAttention)
    .map((task, index) => ({ task, index }))
    .sort(
      (left, right) =>
        getTaskPrimaryAttentionRank(left.task) -
          getTaskPrimaryAttentionRank(right.task) || left.index - right.index,
    )[0]?.task;
  const taskSchedulerNextStep = formatTaskSchedulerNextStep(
    primaryAttentionTask,
    uiLanguage,
  );
  const taskSchedulerRefreshReceiptText = formatTaskSchedulerRefreshReceipt(
    taskSchedulerRefreshReceipt,
    uiLanguage,
  );
  const hasTaskSchedulerSnapshot = taskSchedulerTasks.length > 0;
  const taskSchedulerRefreshPendingReceipt = isTaskStatusLoading
    ? buildTaskSchedulerRefreshPendingReceipt({
        hasSnapshot: hasTaskSchedulerSnapshot,
        snapshotRefreshedAt: taskStatusNow,
        language: uiLanguage,
      })
    : null;
  const taskSchedulerRefreshMeta = hasTaskSchedulerSnapshot
    ? isEnglishUi(uiLanguage)
      ? `Last confirmed ${formatTaskRefreshTime(
          taskStatusNow,
          uiLanguage,
        )}`
      : `上次确认 ${formatTaskRefreshTime(taskStatusNow, uiLanguage)}`
    : isTaskStatusLoading
    ? isEnglishUi(uiLanguage)
      ? 'Checking status'
      : '正在核对'
    : isEnglishUi(uiLanguage)
    ? 'Not confirmed yet'
    : '尚未确认';
  const taskAttentionSummaryItems = taskSchedulerTasks
    .filter(taskNeedsAttention)
    .map((task, index) => ({ task, index }))
    .sort(
      (left, right) =>
        getTaskPrimaryAttentionRank(left.task) -
          getTaskPrimaryAttentionRank(right.task) || left.index - right.index,
    )
    .slice(0, TASK_ATTENTION_SUMMARY_LIMIT)
    .map(({ task }) => ({
      task,
      statusKind: getTaskStatusKind(task),
      statusLabel: formatTaskAttentionStatusLabel(task, uiLanguage),
      reason: formatTaskAttentionReason(task, uiLanguage),
      action: formatTaskAttentionAction(task, uiLanguage),
    }));
  const hiddenAttentionTaskCount = Math.max(
    0,
    attentionTaskCount - taskAttentionSummaryItems.length,
  );

  const openJiraQueryDialog = async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (activeTab?.id && activeTab.url) {
      const tabId = activeTab.id;
      const token = await getGoogleAuthToken({
        caller: 'popup.openJiraQueryDialog',
      });

      chrome.tabs.sendMessage(
        tabId,
        {
          type: 'OPEN_JIRA_QUERY_DIALOG',
          url: activeTab.url,
          sheetToken: token,
        },
        (_response) => {
          // close the popup window
          window.close();
        },
      );
    } else {
      console.error('无法获取活动标签页 ID 或 URL');
    }
  };

  const expandEpicTickets = async () => {
    setIsExpandingEpic(true);

    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const activeTab = tabs[0];

      if (activeTab?.id && activeTab.url) {
        const tabId = activeTab.id;
        const token = await getGoogleAuthToken({
          caller: 'popup.expandEpicTickets',
        });

        if (token) {
          chrome.tabs.sendMessage(
            tabId,
            {
              type: 'EXPAND_EPIC_TICKETS',
              url: activeTab.url,
              sheetToken: token,
            },
            (_response) => {
              setIsExpandingEpic(false);
            },
          );
        } else {
          console.error('获取到的 token 无效');
          setIsExpandingEpic(false);
        }
      } else {
        console.error('无法获取活动标签页 ID 或 URL');
        setIsExpandingEpic(false);
      }
    } catch (error) {
      console.error('expandEpicTickets 失败:', error);
      setIsExpandingEpic(false);
    }
  };

  // 监听内容脚本发来的请求
  // ⚠️ 重要：不能使用 async 函数作为消息监听器！
  // async 函数会返回 Promise，这会干扰 Chrome 的消息传递机制
  useEffect(() => {
    const handleMessage = (
      message: any,
      _sender: chrome.runtime.MessageSender,
      _sendResponse: (response?: any) => void,
    ) => {
      // 只处理 REQUEST_SLIDES_ANALYSIS 消息
      if (message.type !== 'REQUEST_SLIDES_ANALYSIS') {
        // 不处理的消息，返回 false 让其他监听器处理
        return false;
      }

      // 使用 IIFE 处理异步操作
      (async () => {
        // 获取当前标签页
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        const activeTab = tabs[0];

        if (
          activeTab?.id &&
          activeTab.url?.includes('docs.google.com/presentation')
        ) {
          // 获取token并发送回内容脚本
          try {
            const token = await getGoogleAuthToken({
              caller: 'popup.handleSlidesAnalysis',
            });
            if (token) {
              chrome.tabs.sendMessage(activeTab.id, {
                type: 'ANALYZE_SLIDES_PROJECTS',
                token,
              });
            } else {
              const errorMessage = '获取 Google 认证失败，请重新授权后再试';
              console.error(errorMessage);
              chrome.tabs.sendMessage(activeTab.id, {
                type: 'SLIDES_ANALYSIS_AUTH_FAILED',
                error: errorMessage,
              });
            }
          } catch (error) {
            const errorMessage = `获取 Google 认证失败: ${
              error instanceof Error ? error.message : String(error)
            }`;
            console.error(errorMessage);
            chrome.tabs.sendMessage(activeTab.id, {
              type: 'SLIDES_ANALYSIS_AUTH_FAILED',
              error: errorMessage,
            });
          }
        }
      })();

      // 这个消息不需要响应，但我们处理了它
      return true;
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  return (
    <div className="popup-container">
      {/* 顶部工具栏：包含开关和图标 */}
      <div className="header-toolbar">
        <Toggle
          checked={isScheduleActive}
          onChange={toggleSchedule}
          label={`${t('popup.messageAnalysis.background')} · ${t(
            'popup.messageAnalysis.every',
            { interval: getMessageAnalysisIntervalLabel() },
          )}`}
          disabled={isScheduleUpdating}
        />
        <div className="header-icons">
          <button
            className="header-icon-btn doubao-icon-btn"
            onClick={handleOpenDesktopApp}
            title="Desktop App"
          >
            {DOUBAO_ICON_URL ? (
              <img
                className="doubao-icon-image"
                src={DOUBAO_ICON_URL}
                alt="Desktop App"
              />
            ) : (
              '豆'
            )}
          </button>
          <button
            className="header-icon-btn"
            onClick={handleOpenShare}
            title={t('popup.shareWithColleagues')}
          >
            ↗️
          </button>
          <button
            className="header-icon-btn"
            onClick={handleOpenHelp}
            title={t('popup.helpDocs')}
          >
            ❓
          </button>
        </div>
      </div>
      {headerSchedulePendingReceipt && (
        <div
          className="task-header-pending-receipt"
          role="status"
          aria-live="polite"
          title={`${headerSchedulePendingReceipt.detail} · ${headerSchedulePendingReceipt.boundary}`}
        >
          <div className="task-header-pending-title">
            {headerSchedulePendingReceipt.label}
          </div>
          <div className="task-header-pending-detail">
            {headerSchedulePendingReceipt.detail}
          </div>
          <div className="task-header-pending-boundary">
            {headerSchedulePendingReceipt.boundary}
          </div>
        </div>
      )}

      <details
        className="task-status-panel"
        onToggle={(event) => {
          const isOpen = event.currentTarget.open;
          setIsTaskPanelOpen(isOpen);
          if (isOpen) {
            void loadTaskSchedulerStatus(true);
          }
        }}
      >
        <summary>
          <span>{t('popup.backgroundTasks')}</span>
          <span
            className={`task-summary ${
              taskCollapsedAttentionPreview ? 'has-attention-preview' : ''
            }`}
            title={
              taskCollapsedAttentionPreview
                ? `${taskStatusSummary} · ${taskCollapsedAttentionPreview}`
                : taskStatusSummary
            }
          >
            <span className="task-summary-status">{taskStatusSummary}</span>
            {taskCollapsedAttentionPreview && (
              <span className="task-summary-attention-preview">
                {taskCollapsedAttentionPreview}
              </span>
            )}
          </span>
        </summary>
        <div className="task-status-toolbar">
          <span className="task-refresh-meta">
            {taskSchedulerRefreshMeta} · {getLocalTaskTimeZoneLabel(uiLanguage)}
          </span>
          <button
            className="task-refresh-btn"
            onClick={() => void loadTaskSchedulerStatus(true)}
            disabled={isTaskStatusLoading}
            title={
              isEnglishUi(uiLanguage)
                ? 'Refresh background task status'
                : '刷新后台任务状态'
            }
            aria-label={
              isEnglishUi(uiLanguage)
                ? 'Refresh background task status'
                : '刷新后台任务状态'
            }
          >
            ↻
          </button>
        </div>
        {taskSchedulerRefreshPendingReceipt ? (
          <div
            className="task-refresh-receipt pending"
            role="status"
            title={`${taskSchedulerRefreshPendingReceipt.detail} · ${taskSchedulerRefreshPendingReceipt.boundary}`}
          >
            <div className="task-refresh-pending-title">
              {taskSchedulerRefreshPendingReceipt.label}
            </div>
            <div className="task-refresh-pending-detail">
              {taskSchedulerRefreshPendingReceipt.detail}
            </div>
            <div className="task-refresh-pending-boundary">
              {taskSchedulerRefreshPendingReceipt.boundary}
            </div>
          </div>
        ) : taskSchedulerRefreshReceiptText ? (
          <div
            className={`task-refresh-receipt ${
              taskSchedulerRefreshReceipt?.failedRepairs ||
              taskSchedulerRefreshReceipt?.queueStatusUnavailableCount
                ? 'warning'
                : 'neutral'
            }`}
            role="status"
          >
            {taskSchedulerRefreshReceiptText}
          </div>
        ) : null}
        {taskSchedulerRefreshFailureReceipt && (
          <div
            className="task-refresh-receipt failed"
            role="alert"
            title={`${taskSchedulerRefreshFailureReceipt.detail} · ${taskSchedulerRefreshFailureReceipt.boundary}`}
          >
            <div className="task-refresh-failure-title">
              <span>{taskSchedulerRefreshFailureReceipt.label}</span>
              <span>
                {formatTaskRefreshTime(
                  taskSchedulerRefreshFailureReceipt.createdAt,
                  uiLanguage,
                )}
              </span>
            </div>
            <div className="task-refresh-failure-detail">
              {taskSchedulerRefreshFailureReceipt.detail}
            </div>
            <div className="task-refresh-failure-boundary">
              {taskSchedulerRefreshFailureReceipt.boundary}
            </div>
          </div>
        )}
        {taskSchedulerNextStep && (
          <div
            className={`task-next-step ${taskSchedulerNextStep.tone}`}
            role="status"
            title={`${taskSchedulerNextStep.message} · ${taskSchedulerNextStep.boundary}`}
            aria-label={`${taskSchedulerNextStep.message} ${taskSchedulerNextStep.boundary}`}
          >
            {taskSchedulerNextStep.message}
          </div>
        )}
        {taskAttentionSummaryItems.length > 1 && (
          <div
            className="task-attention-summary"
            aria-label={
              isEnglishUi(uiLanguage)
                ? 'Background task action overview'
                : '后台任务需处理总览'
            }
          >
            <div className="task-attention-summary-title">
              <span>
                {isEnglishUi(uiLanguage)
                  ? 'Needs Action Overview'
                  : '需处理总览'}
              </span>
              <span>
                {isEnglishUi(uiLanguage)
                  ? pluralizeEn(attentionTaskCount, 'item')
                  : `${attentionTaskCount} 项`}
              </span>
            </div>
            {taskAttentionSummaryItems.map((item) => (
              <div
                className={`task-attention-item ${item.statusKind}`}
                key={item.task.id}
              >
                <div className="task-attention-main">
                  <span className="task-attention-name">
                    {getTaskDisplayName(item.task, uiLanguage)}
                  </span>
                  <span className="task-attention-status">
                    {item.statusLabel}
                  </span>
                </div>
                <div className="task-attention-detail">{item.reason}</div>
                <div className="task-attention-action">{item.action}</div>
              </div>
            ))}
            {hiddenAttentionTaskCount > 0 && (
              <div className="task-attention-more">
                {isEnglishUi(uiLanguage)
                  ? `${hiddenAttentionTaskCount} more tasks need action and are listed below`
                  : `还有 ${hiddenAttentionTaskCount} 个需处理任务，已在下方列表中展示`}
              </div>
            )}
          </div>
        )}
        {taskSchedulerError && (
          <div className="task-status-error">{taskSchedulerError}</div>
        )}
        {taskSchedulerActionReceipt && (
          <div
            className={`task-action-receipt-panel ${taskSchedulerActionReceipt.tone}`}
            role={
              taskSchedulerActionReceipt.tone === 'failed'
                ? 'alert'
                : 'status'
            }
            title={`${taskSchedulerActionReceipt.detail} · ${taskSchedulerActionReceipt.boundary}`}
          >
            <div className="task-action-receipt-title">
              <span>{taskSchedulerActionReceipt.label}</span>
              <span>
                {formatTaskRefreshTime(
                  taskSchedulerActionReceipt.createdAt,
                  uiLanguage,
                )}
              </span>
            </div>
            <div className="task-action-receipt-detail">
              {taskSchedulerActionReceipt.detail}
            </div>
            <div className="task-action-receipt-boundary">
              {taskSchedulerActionReceipt.boundary}
            </div>
          </div>
        )}
        <div className="task-list">
          {!taskSchedulerError && visibleTaskSchedulerTasks.length === 0 && (
            <div className="task-empty-state">
              {formatTaskListEmptyState(isTaskStatusLoading, uiLanguage)}
            </div>
          )}
          {visibleTaskSchedulerTasks.map((task) => {
            const isBusy = Boolean(busyTaskIds[task.id]);
            const hasScheduleWarning = hasTaskScheduleWarning(task);
            const hasRecentSkip = hasTaskRecentSkip(task);
            const statusKind = getTaskStatusKind(task);
            const canPauseFailedSchedule = shouldRecommendTaskPause(task);
            const statusClass =
              statusKind === 'disabled' ? 'stopped' : statusKind;
            const stateLabel = isEnglishUi(uiLanguage)
              ? statusKind === 'executing'
                ? 'Running'
                : statusKind === 'warning'
                ? formatTaskScheduleHealthLabel(task, uiLanguage)
                : statusKind === 'skipped'
                ? 'Skipped'
                : statusKind === 'failed'
                ? 'Failed'
                : statusKind === 'running'
                ? 'Enabled'
                : 'Disabled'
              : statusKind === 'executing'
              ? '执行中'
              : statusKind === 'warning'
              ? formatTaskScheduleHealthLabel(task, uiLanguage)
              : statusKind === 'skipped'
              ? '跳过'
              : statusKind === 'failed'
              ? '失败'
              : statusKind === 'running'
              ? '启用'
              : '停用';
            const runHistorySummary = formatTaskRunHistorySummary(
              task,
              uiLanguage,
            );
            const latestRunSummary = getTaskLatestRunSummary(task, uiLanguage);
            const actionHint = formatTaskActionHint(task, uiLanguage);
            const actionBoundary = formatTaskActionBoundary(task, uiLanguage);
            const pendingAction = pendingTaskActions[task.id];
            const pendingActionReceipt =
              pendingAction
                ? buildTaskSchedulerPendingActionReceipt(
                    task,
                    pendingAction,
                    uiLanguage,
                  )
                : null;
            const statusReceipt = pendingActionReceipt
              ? null
              : formatTaskStatusReceipt(task, uiLanguage);
            const taskDisplayName = getTaskDisplayName(task, uiLanguage);
            const queueSummary = buildDigestQueueStatusUi(
              task.currentQueueStatus,
              task.currentQueueSummary,
              task.currentQueueStatusError,
              uiLanguage,
            );
            return (
              <div
                className="task-row"
                key={task.id}
                title={getTaskDisplayDescription(task, uiLanguage)}
              >
                <div className="task-main">
                  <div className="task-name-line">
                    <span className={`task-dot ${statusClass}`}></span>
                    <span className="task-name">{taskDisplayName}</span>
                    <span className={`task-state-badge ${statusClass}`}>
                      {stateLabel}
                    </span>
                    <span className="task-category-badge">
                      {getTaskCategoryLabel(task.category, uiLanguage)}
                    </span>
                  </div>
                  <div
                    className={`task-meta ${
                      hasScheduleWarning ? 'warning' : ''
                    }`}
                  >
                    {isEnglishUi(uiLanguage) ? 'Every' : '每'}{' '}
                    {formatTaskInterval(task.intervalMinutes, uiLanguage)}
                    {' · '}
                    {formatTaskSchedule(task, taskStatusNow, uiLanguage)}
                  </div>
                  <div
                    className={`task-result ${
                      hasScheduleWarning
                        ? 'warning'
                        : hasRecentSkip
                        ? 'skipped'
                        : task.lastSuccess === false
                        ? 'failed'
                        : ''
                    }`}
                    title={
                      task.scheduleWarning ||
                      (hasRecentSkip
                        ? task.lastSkipReason
                        : task.lastSuccess === false
                        ? appendTaskResultSummary(
                            task.lastError ||
                              (isEnglishUi(uiLanguage)
                                ? 'check background logs'
                                : '查看后台日志'),
                            task.lastResultSummary,
                          )
                        : task.lastError) ||
                      ''
                    }
                  >
                    {formatTaskResult(task, uiLanguage)}
                  </div>
                  {statusReceipt && (
                    <div
                      className={`task-status-receipt ${statusReceipt.tone}`}
                      title={`${statusReceipt.label} · ${statusReceipt.detail} · ${statusReceipt.nextAction}`}
                    >
                      <span className="task-status-receipt-label">
                        {statusReceipt.label}
                      </span>
                      <span className="task-status-receipt-detail">
                        {statusReceipt.detail}
                      </span>
                      <span className="task-status-receipt-action">
                        {statusReceipt.nextAction}
                      </span>
                    </div>
                  )}
                  {pendingActionReceipt && (
                    <div
                      className="task-status-receipt pending"
                      title={`${pendingActionReceipt.label} · ${pendingActionReceipt.detail} · ${pendingActionReceipt.nextAction}`}
                    >
                      <span className="task-status-receipt-label">
                        {pendingActionReceipt.label}
                      </span>
                      <span className="task-status-receipt-detail">
                        {pendingActionReceipt.detail}
                      </span>
                      <span className="task-status-receipt-action">
                        {pendingActionReceipt.nextAction}
                      </span>
                    </div>
                  )}
                  {queueSummary && (
                    <div
                      className="task-queue-summary"
                      title={queueSummary.title}
                      role="status"
                    >
                      <div className="task-queue-summary-heading">
                        {queueSummary.heading}
                      </div>
                      <div className="task-queue-summary-grid">
                        <span>
                          {isEnglishUi(uiLanguage) ? 'Pending' : '待释放'}
                        </span>
                        <strong>{queueSummary.totalLine}</strong>
                        <span>
                          {isEnglishUi(uiLanguage) ? 'Due now' : '已到期'}
                        </span>
                        <strong>{queueSummary.dueLine}</strong>
                        {queueSummary.nextLine && (
                          <>
                            <span>
                              {isEnglishUi(uiLanguage)
                                ? 'Next release'
                                : '下次释放'}
                            </span>
                            <strong>{queueSummary.nextLine}</strong>
                          </>
                        )}
                      </div>
                      {queueSummary.taskLines.length > 0 && (
                        <div className="task-queue-summary-details">
                          {queueSummary.taskLines.map((line) => (
                            <span key={line}>{line}</span>
                          ))}
                        </div>
                      )}
                      {queueSummary.snapshotLine && (
                        <div className="task-queue-summary-boundary">
                          {queueSummary.snapshotLine}
                        </div>
                      )}
                      {queueSummary.dueReceiptLine && (
                        <div className="task-queue-summary-boundary">
                          {queueSummary.dueReceiptLine}
                        </div>
                      )}
                      <div className="task-queue-summary-boundary">
                        {queueSummary.boundaryLine}
                      </div>
                    </div>
                  )}
                  {latestRunSummary && (
                    <div
                      className={`task-latest-run ${latestRunSummary.className}`}
                      title={latestRunSummary.text}
                    >
                      {latestRunSummary.text}
                    </div>
                  )}
                  {runHistorySummary && (
                    <div
                      className="task-history"
                      title={formatTaskRunHistoryTitle(task, uiLanguage)}
                    >
                      {runHistorySummary}
                    </div>
                  )}
                  {actionHint && (
                    <div
                      className={`task-action-hint ${
                        hasScheduleWarning
                          ? 'warning'
                          : hasRecentSkip
                          ? 'skipped'
                          : task.lastSuccess === false
                          ? 'failed'
                          : ''
                      }`}
                    >
                      {actionHint}
                    </div>
                  )}
                  <div
                    className={`task-action-boundary ${statusKind}`}
                    title={actionBoundary}
                  >
                    {actionBoundary}
                  </div>
                </div>
                <div className="task-actions">
                  <label
                    className="task-mini-switch"
                    title={getTaskToggleButtonTitle(task, uiLanguage)}
                  >
                    <input
                      type="checkbox"
                      checked={task.enabled}
                      disabled={isBusy}
                      aria-label={getTaskToggleButtonAriaLabel(
                        task,
                        uiLanguage,
                      )}
                      onChange={(event) =>
                        void updateTaskEnabled(
                          task,
                          event.currentTarget.checked,
                        )
                      }
                    />
                    <span></span>
                  </label>
                  {hasScheduleWarning && task.enabled && (
                    <button
                      className="task-repair-btn"
                      onClick={() => void repairTaskSchedule(task)}
                      disabled={isBusy}
                      title={getTaskRepairButtonTitle(task, uiLanguage)}
                      aria-label={getTaskRepairButtonAriaLabel(
                        task,
                        uiLanguage,
                      )}
                    >
                      ↻
                    </button>
                  )}
                  {canPauseFailedSchedule && (
                    <button
                      className="task-pause-btn"
                      onClick={() => void updateTaskEnabled(task, false)}
                      disabled={isBusy}
                      title={getTaskPauseButtonTitle(task, uiLanguage)}
                      aria-label={getTaskPauseButtonAriaLabel(
                        task,
                        uiLanguage,
                      )}
                    >
                      {isEnglishUi(uiLanguage) ? 'Pause' : '暂停'}
                    </button>
                  )}
                  <button
                    className="task-run-btn"
                    onClick={() => void runTaskNow(task)}
                    disabled={isBusy || task.isExecuting}
                    title={getTaskRunButtonTitle(task, isBusy, uiLanguage)}
                    aria-label={getTaskRunButtonAriaLabel(
                      task,
                      isBusy,
                      uiLanguage,
                    )}
                  >
                    {isBusy || task.isExecuting ? '...' : '▶'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </details>

      {(isRingCentralMeeting || isGoogleSheets || isGoogleSlides) && (
        <div className="page-actions-card">
          <div className="page-actions-title">针对当前页面</div>
          {isRingCentralMeeting && (
            <>
              <button
                onClick={handleOpenRadar}
                className="radar-button"
                disabled={isMeetingPilotBusy}
              >
                {isMeetingPilotBusy
                  ? t('popup.meetingPilot.processing')
                  : isMeetingPilotCaptureActive(meetingPilotSession)
                  ? t('popup.meetingPilot.open')
                  : isMeetingPilotTranscriptPilotActive(meetingPilotSession)
                  ? t('popup.meetingPilot.enableVision')
                  : t('popup.meetingPilot.start')}
              </button>
              {meetingPilotNotice ? (
                <div
                  className={`meeting-pilot-notice ${meetingPilotNotice.tone}`}
                  role={
                    meetingPilotNotice.tone === 'error' ? 'alert' : 'status'
                  }
                >
                  <span>{meetingPilotNotice.message}</span>
                  {meetingPilotNotice.action === 'options' ? (
                    <button type="button" onClick={openMeetingPilotOptions}>
                      {t('popup.meetingPilot.openOptions')}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
          {isGoogleSheets && (
            <>
              <button onClick={openJiraQueryDialog} className="jira-button">
                抓取 Jira Tickets 到 Sheet
              </button>
              <button
                onClick={expandEpicTickets}
                className="jira-button expand-button"
                disabled={isExpandingEpic}
              >
                {isExpandingEpic ? (
                  <span className="loading-text">正在查找 Epic 子任务...</span>
                ) : (
                  '展开 Epic 下面所有的 tickets'
                )}
              </button>
            </>
          )}
          {isGoogleSlides && (
            <button
              onClick={analyzeSlidesProjects}
              className="slides-button main-button"
              disabled={isAnalyzingSlides}
            >
              {isAnalyzingSlides ? (
                <span className="loading-text">正在分析 Slide 项目信息...</span>
              ) : (
                '分析 Slide 项目信息并更新'
              )}
            </button>
          )}
        </div>
      )}

      <button onClick={openMemoryInterface} className="memory-button">
        🧠 {t('popup.memoryExplorer')}
      </button>

      {/* <button onClick={openProjectDashboard} className="dashboard-button">
                📊 项目进度仪表盘
            </button> */}

      <button
        onClick={openScheduledMessagesManager}
        className="scheduled-button"
      >
        ⏰ {t('popup.scheduledMessages')}
      </button>

      <button onClick={openProjectRoadmap} className="message-button">
        🗺 {t('popup.projectRoadmap')}
      </button>

      <section className="today-pilot-panel">
        <div className="today-pilot-head">
          <button
            className="today-pilot-title"
            onClick={openTodayPilotHome}
            title={t('popup.today.openTitle')}
            aria-label={t('popup.today.openTitle')}
          >
            {t('terms.todayPilot')}
          </button>
          <button
            className="today-pilot-refresh"
            onClick={() => void loadTodayPilotCards()}
            disabled={todayPilotLoading}
            title={t('popup.today.refreshTitle')}
            aria-label={t('popup.today.refreshTitle')}
          >
            ↻
          </button>
        </div>
        {todayPilotScopeReceipt ? (
          <div className="today-pilot-scope-receipt">
            <strong>{todayPilotScopeReceipt.main}</strong>
            <span>{todayPilotScopeReceipt.detail}</span>
            {todayPilotScopeReceipt.overflowCount > 0 ? (
              <div className="today-pilot-scope-handoff">
                <button
                  type="button"
                  onClick={openTodayPilotHome}
                  title={buildTodayPilotPopupOverflowBoundary(
                    todayPilotScopeReceipt,
                    uiLanguage,
                  )}
                  aria-label={buildTodayPilotPopupOverflowBoundary(
                    todayPilotScopeReceipt,
                    uiLanguage,
                  )}
                >
                  {todayPilotScopeReceipt.overflowActionLabel}
                </button>
                <span>{todayPilotScopeReceipt.overflowBoundary}</span>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="today-pilot-list">
          {todayPilotLoading && todayPilotCards.length === 0 ? (
            <div className="today-pilot-empty">{t('popup.today.loading')}</div>
          ) : todayPilotError && todayPilotCards.length === 0 ? (
            <div className="today-pilot-empty">
              {t('popup.today.unavailable')}
            </div>
          ) : todayPilotCards.length === 0 ? (
            <div className="today-pilot-empty">{t('popup.today.empty')}</div>
          ) : (
            todayPilotCards.map((card) => {
              const isMeeting = isTodayPilotMeetingCard(card);
              const externalExecution =
                isTodayPilotExternalExecutionCard(card);
              const copying = todayPilotCopyingMissionId === card.missionId;
              const doneKey = `${card.id}:done`;
              const laterKey = `${card.id}:later`;
              const feedbackPending = todayPilotFeedbackingCardId.startsWith(
                `${card.id}:`,
              );
              const cardMainBoundary = buildTodayPilotPopupCardMainBoundary(
                card,
                uiLanguage,
              );
              const doneBoundary = buildTodayPilotPopupFeedbackButtonBoundary(
                card,
                'done',
                uiLanguage,
                todayPilotFeedbackingCardId === doneKey,
              );
              const laterBoundary = buildTodayPilotPopupFeedbackButtonBoundary(
                card,
                'later',
                uiLanguage,
                todayPilotFeedbackingCardId === laterKey,
              );
              const copyOrReviewBoundary = externalExecution
                ? buildTodayPilotPopupExternalReviewBoundary(card, uiLanguage)
                : buildTodayPilotPopupCopyBoundary(
                    card,
                    uiLanguage,
                    copying,
                  );
              return (
                <article className="today-pilot-card" key={card.id}>
                  <button
                    className="today-pilot-card-main"
                    onClick={openTodayPilotHome}
                    title={cardMainBoundary}
                    aria-label={cardMainBoundary}
                  >
                    <span className={`today-pilot-priority ${card.priority}`}>
                      {getTodayPilotPriorityLabel(card)}
                    </span>
                    <span className="today-pilot-card-text">
                      <span className="today-pilot-card-title">
                        {card.title}
                      </span>
                      <span className="today-pilot-card-sub">
                        <strong>{t('popup.today.action')}</strong>
                        <span>{card.nextBestAction}</span>
                      </span>
                      <span className="today-pilot-card-why">
                        <strong>{t('popup.today.reason')}</strong>
                        <span>{card.whyNow}</span>
                      </span>
                      <span className="today-pilot-card-meta">
                        {formatTodayPilotEvidenceMeta(card)}
                      </span>
                    </span>
                    <span className="today-pilot-due">
                      {formatTodayPilotDue(card)}
                    </span>
                  </button>
                  <div className="today-pilot-card-actions">
                    {isMeeting ? (
                      <button
                        onClick={openRingCentralVideoHome}
                        title={buildTodayPilotPopupMeetingBoundary(
                          card,
                          uiLanguage,
                        )}
                        aria-label={buildTodayPilotPopupMeetingBoundary(
                          card,
                          uiLanguage,
                        )}
                      >
                        Video Home
                      </button>
                    ) : null}
                    <button
                      onClick={() =>
                        void sendTodayPilotPopupFeedback(card, 'done')
                      }
                      disabled={feedbackPending}
                      title={doneBoundary}
                      aria-label={doneBoundary}
                    >
                      {todayPilotFeedbackingCardId === doneKey
                        ? t('popup.today.handling')
                        : t('popup.today.done')}
                    </button>
                    <button
                      onClick={() =>
                        void sendTodayPilotPopupFeedback(card, 'later')
                      }
                      disabled={feedbackPending}
                      title={laterBoundary}
                      aria-label={laterBoundary}
                    >
                      {todayPilotFeedbackingCardId === laterKey
                        ? t('popup.today.handling')
                        : t('popup.today.later')}
                    </button>
                    <button
                      onClick={() =>
                        externalExecution
                          ? openTodayPilotProcessingTarget(card)
                          : void copyTodayPilotContextPack(card)
                      }
                      disabled={!externalExecution && copying}
                      title={copyOrReviewBoundary}
                      aria-label={copyOrReviewBoundary}
                    >
                      {externalExecution
                        ? t('popup.today.reviewExternal')
                        : copying
                        ? t('popup.today.copying')
                        : t('popup.today.copy')}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
        {(todayPilotError || todayPilotNotice) &&
        (todayPilotCards.length > 0 || todayPilotNotice) ? (
          <div
            className={`today-pilot-message ${
              todayPilotError ? 'error' : ''
            }`}
          >
            {todayPilotError || todayPilotNotice}
          </div>
        ) : null}
      </section>

      {/* <button onClick={openOptionsPage}>
                设置
            </button> */}

      <style>{`
                html {
                    width: 328px;
                    max-width: 328px;
                    overflow-x: hidden;
                }

                body {
                    width: 300px;
                    max-width: 300px;
                    overflow-x: hidden;
                }

                #popup-root,
                .popup-container {
                    width: 100%;
                    max-width: 100%;
                    min-width: 0;
                    box-sizing: border-box;
                    overflow-x: hidden;
                }

                .popup-container {
                    padding-bottom: 8px; /* Add padding at the bottom */
                }
                
                /* 顶部工具栏样式 */
                .header-toolbar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 4px 8px;
                    border-bottom: 1px solid #eee;
                    margin-bottom: 4px;
                }
                
                .header-toolbar .toggle-container {
                    flex: 1;
                    margin-bottom: 0;
                    padding: 4px 0;
                }

                .today-pilot-panel {
                    min-width: 0;
                    max-width: 100%;
                    box-sizing: border-box;
                    overflow-x: hidden;
                    padding: 8px;
                    border-top: 1px solid #eeeeee;
                    margin-top: 4px;
                }

                .today-pilot-head {
                    min-width: 0;
                    max-width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 6px;
                }

                .today-pilot-title {
                    width: auto;
                    min-width: 0;
                    max-width: calc(100% - 32px);
                    box-sizing: border-box;
                    border: 0;
                    background: transparent;
                    padding: 0;
                    margin: 0;
                    color: #111827;
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                    text-align: left;
                }

                .today-pilot-refresh {
                    width: 24px !important;
                    min-width: 24px !important;
                    height: 24px;
                    padding: 0 !important;
                    margin: 0 !important;
                    border: 1px solid #d4d4d8;
                    border-radius: 4px;
                    background: #ffffff;
                    color: #334155;
                }

                .today-pilot-list {
                    min-width: 0;
                    max-width: 100%;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .today-pilot-scope-receipt {
                    min-width: 0;
                    max-width: 100%;
                    box-sizing: border-box;
                    overflow-wrap: anywhere;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    background: #f8fafc;
                    color: #475569;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    font-size: 10.5px;
                    line-height: 1.35;
                    margin-bottom: 6px;
                    padding: 6px 7px;
                }

                .today-pilot-scope-receipt strong {
                    color: #334155;
                    font-size: 11px;
                    font-weight: 700;
                }

                .today-pilot-scope-handoff {
                    min-width: 0;
                    max-width: 100%;
                    box-sizing: border-box;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding-top: 2px;
                }

                .today-pilot-scope-handoff button {
                    flex: 0 0 auto;
                    width: auto;
                    min-width: 0;
                    min-height: 24px;
                    margin: 0;
                    padding: 3px 6px;
                    border: 1px solid #cbd5e1;
                    border-radius: 4px;
                    background: #ffffff;
                    color: #1d4ed8;
                    font-size: 10.5px;
                    font-weight: 700;
                }

                .today-pilot-scope-handoff span {
                    min-width: 0;
                    max-width: 100%;
                    box-sizing: border-box;
                    color: #64748b;
                    overflow-wrap: anywhere;
                }

                .today-pilot-empty {
                    color: #64748b;
                    font-size: 12px;
                    line-height: 1.45;
                    padding: 6px 0;
                }

                .today-pilot-card {
                    min-width: 0;
                    max-width: 100%;
                    box-sizing: border-box;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    background: #ffffff;
                    overflow: hidden;
                }

                .today-pilot-card-main {
                    width: 100%;
                    min-width: 0;
                    max-width: 100%;
                    box-sizing: border-box;
                    min-height: 72px;
                    border: 0;
                    background: transparent;
                    display: grid;
                    grid-template-columns: auto minmax(0, 1fr) auto;
                    gap: 8px;
                    align-items: center;
                    padding: 8px;
                    margin: 0;
                    text-align: left;
                    cursor: pointer;
                }

                .today-pilot-priority {
                    min-width: 24px;
                    text-align: center;
                    border-radius: 4px;
                    padding: 2px 4px;
                    font-size: 10px;
                    font-weight: 700;
                    color: #334155;
                    background: #f1f5f9;
                }

                .today-pilot-priority.critical,
                .today-pilot-priority.high {
                    color: #991b1b;
                    background: #fee2e2;
                }

                .today-pilot-priority.medium {
                    color: #92400e;
                    background: #fef3c7;
                }

                .today-pilot-card-text {
                    min-width: 0;
                    max-width: 100%;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .today-pilot-card-title,
                .today-pilot-card-sub,
                .today-pilot-card-why,
                .today-pilot-card-meta {
                    min-width: 0;
                    max-width: 100%;
                    box-sizing: border-box;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .today-pilot-card-title {
                    display: block;
                    color: #111827;
                    font-size: 12px;
                    font-weight: 700;
                }

                .today-pilot-card-sub,
                .today-pilot-card-why,
                .today-pilot-card-meta,
                .today-pilot-due {
                    color: #64748b;
                    font-size: 11px;
                }

                .today-pilot-card-sub,
                .today-pilot-card-why {
                    display: flex;
                    gap: 4px;
                    align-items: center;
                    min-width: 0;
                }

                .today-pilot-card-sub strong,
                .today-pilot-card-why strong {
                    flex: 0 0 auto;
                    color: #334155;
                    font-size: 10px;
                }

                .today-pilot-card-meta {
                    display: block;
                    color: #475569;
                    font-size: 10px;
                }

                .today-pilot-card-sub span,
                .today-pilot-card-why span {
                    display: block;
                    flex: 1 1 0;
                    width: 0;
                    min-width: 0;
                    max-width: 100%;
                    box-sizing: border-box;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .today-pilot-card-actions {
                    min-width: 0;
                    max-width: 100%;
                    box-sizing: border-box;
                    border-top: 1px solid #f1f5f9;
                    display: flex;
                    gap: 6px;
                    padding: 6px 8px;
                }

                .today-pilot-card-actions button {
                    flex: 1;
                    width: auto;
                    min-height: 26px;
                    min-width: 0;
                    margin: 0;
                    padding: 4px 6px;
                    border: 1px solid #d4d4d8;
                    border-radius: 4px;
                    background: #f8fafc;
                    color: #334155;
                    font-size: 11px;
                    font-weight: 600;
                }

                .today-pilot-card-actions button:disabled {
                    opacity: 0.55;
                    cursor: not-allowed;
                }

                .today-pilot-message {
                    margin-top: 6px;
                    color: #2563eb;
                    font-size: 11px;
                    line-height: 1.35;
                }

                .today-pilot-message.error {
                    color: #b91c1c;
                }

                .task-status-panel {
                    padding: 0 8px 4px;
                    border-bottom: 1px solid #eeeeee;
                    margin-bottom: 4px;
                }

                .task-status-panel summary {
                    min-height: 28px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                    color: #1f2937;
                    list-style: none;
                }

                .task-status-panel summary::-webkit-details-marker {
                    display: none;
                }

                .task-summary {
                    margin-left: auto;
                    min-width: 0;
                    max-width: 70%;
                    color: #64748b;
                    font-weight: 500;
                    text-align: right;
                }

                .task-summary.has-attention-preview {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 1px;
                    line-height: 1.25;
                }

                .task-summary-status,
                .task-summary-attention-preview {
                    max-width: 100%;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .task-summary-attention-preview {
                    color: #b45309;
                    font-size: 10px;
                    font-weight: 700;
                }

                .task-status-toolbar {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    height: 28px;
                    align-items: center;
                }

                .task-refresh-meta {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: #71717a;
                    font-size: 10px;
                    line-height: 1.4;
                }

                .task-refresh-receipt {
                    margin: 2px 0 6px;
                    padding: 6px 8px;
                    border: 1px solid #bfdbfe;
                    border-radius: 4px;
                    background: #eff6ff;
                    color: #1e3a8a;
                    font-size: 10px;
                    line-height: 1.45;
                }

                .task-refresh-receipt.warning {
                    border-color: #fed7aa;
                    background: #fff7ed;
                    color: #9a3412;
                }

                .task-refresh-receipt.pending {
                    border-color: #cbd5e1;
                    background: #f8fafc;
                    color: #334155;
                }

                .task-refresh-receipt.failed {
                    border-color: #fecaca;
                    background: #fef2f2;
                    color: #991b1b;
                }

                .task-refresh-failure-title {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    font-weight: 800;
                }

                .task-refresh-failure-title span:first-child,
                .task-refresh-pending-title,
                .task-refresh-pending-detail,
                .task-refresh-pending-boundary,
                .task-refresh-failure-detail,
                .task-refresh-failure-boundary {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .task-refresh-pending-title {
                    font-weight: 800;
                }

                .task-refresh-pending-detail {
                    margin-top: 3px;
                    font-weight: 700;
                }

                .task-refresh-pending-boundary {
                    margin-top: 1px;
                    color: #475569;
                }

                .task-refresh-failure-detail {
                    margin-top: 3px;
                    font-weight: 700;
                }

                .task-refresh-failure-boundary {
                    margin-top: 1px;
                    color: #334155;
                }

                .task-refresh-btn,
                .task-repair-btn,
                .task-pause-btn,
                .task-run-btn {
                    width: 26px !important;
                    min-width: 26px !important;
                    height: 26px;
                    padding: 0 !important;
                    margin: 0 !important;
                    border: 1px solid #d4d4d8;
                    border-radius: 4px;
                    background: #ffffff;
                    color: #334155;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                }

                .task-refresh-btn:hover,
                .task-repair-btn:hover,
                .task-pause-btn:hover,
                .task-run-btn:hover {
                    background: #f4f4f5;
                }

                .task-refresh-btn:disabled,
                .task-repair-btn:disabled,
                .task-pause-btn:disabled,
                .task-run-btn:disabled {
                    cursor: wait;
                    opacity: 0.55;
                }

                .task-pause-btn {
                    width: 34px !important;
                    min-width: 34px !important;
                    border-color: #fecaca;
                    background: #fef2f2;
                    color: #991b1b;
                    font-size: 10px;
                    font-weight: 700;
                }

                .task-list {
                    max-height: 260px;
                    overflow: auto;
                }

                .task-empty-state {
                    padding: 10px 2px;
                    border-top: 1px solid #f1f5f9;
                    color: #71717a;
                    font-size: 11px;
                    line-height: 1.4;
                }

                .task-next-step {
                    margin: 0 0 6px;
                    padding: 6px 8px;
                    border: 1px solid #e2e8f0;
                    border-radius: 4px;
                    background: #f8fafc;
                    color: #334155;
                    font-size: 11px;
                    font-weight: 600;
                    line-height: 1.35;
                }

                .task-next-step.executing {
                    border-color: #bae6fd;
                    background: #f0f9ff;
                    color: #075985;
                }

                .task-next-step.warning {
                    border-color: #fde68a;
                    background: #fffbeb;
                    color: #92400e;
                }

                .task-next-step.failed {
                    border-color: #fecaca;
                    background: #fef2f2;
                    color: #991b1b;
                }

                .task-next-step.skipped {
                    border-color: #cbd5e1;
                    background: #f8fafc;
                    color: #475569;
                }

                .task-action-receipt-panel {
                    margin: 0 0 6px;
                    padding: 7px 8px;
                    border: 1px solid #bbf7d0;
                    border-radius: 4px;
                    background: #f0fdf4;
                    color: #14532d;
                    font-size: 10px;
                    line-height: 1.35;
                }

                .task-action-receipt-panel.warning {
                    border-color: #fde68a;
                    background: #fffbeb;
                    color: #92400e;
                }

                .task-action-receipt-panel.failed {
                    border-color: #fecaca;
                    background: #fef2f2;
                    color: #991b1b;
                }

                .task-action-receipt-title {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    font-weight: 800;
                }

                .task-action-receipt-title span:first-child,
                .task-action-receipt-detail,
                .task-action-receipt-boundary {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .task-action-receipt-detail {
                    margin-top: 3px;
                    color: #166534;
                    font-weight: 700;
                }

                .task-action-receipt-boundary {
                    margin-top: 1px;
                    color: #334155;
                }

                .task-action-receipt-panel.warning .task-action-receipt-detail {
                    color: #92400e;
                }

                .task-action-receipt-panel.failed .task-action-receipt-detail {
                    color: #991b1b;
                }

                .task-attention-summary {
                    margin: 0 0 6px;
                    padding: 6px 8px;
                    border: 1px solid #e2e8f0;
                    border-radius: 4px;
                    background: #ffffff;
                }

                .task-attention-summary-title {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    margin-bottom: 4px;
                    color: #334155;
                    font-size: 10px;
                    font-weight: 800;
                    line-height: 1.3;
                }

                .task-attention-item {
                    padding: 5px 0;
                    border-top: 1px solid #f1f5f9;
                }

                .task-attention-summary-title + .task-attention-item {
                    border-top: 0;
                }

                .task-attention-main {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    min-width: 0;
                }

                .task-attention-name {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: #111827;
                    font-size: 11px;
                    font-weight: 700;
                }

                .task-attention-status {
                    flex: 0 0 auto;
                    padding: 1px 4px;
                    border-radius: 4px;
                    background: #f1f5f9;
                    color: #475569;
                    font-size: 9px;
                    font-weight: 800;
                    line-height: 1.35;
                }

                .task-attention-item.warning .task-attention-status {
                    background: #fef3c7;
                    color: #92400e;
                }

                .task-attention-item.failed .task-attention-status {
                    background: #fee2e2;
                    color: #991b1b;
                }

                .task-attention-item.skipped .task-attention-status {
                    background: #f1f5f9;
                    color: #475569;
                }

                .task-attention-item.executing .task-attention-status {
                    background: #e0f2fe;
                    color: #075985;
                }

                .task-attention-detail,
                .task-attention-action,
                .task-attention-more {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    font-size: 10px;
                    line-height: 1.35;
                }

                .task-attention-detail {
                    margin-top: 2px;
                    color: #64748b;
                }

                .task-attention-action {
                    margin-top: 1px;
                    color: #334155;
                    font-weight: 700;
                }

                .task-attention-more {
                    padding-top: 4px;
                    border-top: 1px solid #f1f5f9;
                    color: #64748b;
                }

                .task-row {
                    min-height: 78px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    border-top: 1px solid #f1f5f9;
                    box-sizing: border-box;
                }

                .task-main {
                    min-width: 0;
                    flex: 1;
                }

                .task-name-line {
                    min-width: 0;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .task-name {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    font-size: 12px;
                    font-weight: 600;
                    color: #111827;
                }

                .task-state-badge {
                    flex: 0 0 auto;
                    padding: 1px 5px;
                    border-radius: 4px;
                    background: #f1f5f9;
                    color: #475569;
                    font-size: 10px;
                    font-weight: 600;
                    line-height: 1.4;
                }

                .task-state-badge.running {
                    background: #dcfce7;
                    color: #166534;
                }

                .task-state-badge.executing {
                    background: #e0f2fe;
                    color: #075985;
                }

                .task-state-badge.failed {
                    background: #fee2e2;
                    color: #991b1b;
                }

                .task-state-badge.warning {
                    background: #fef3c7;
                    color: #92400e;
                }

                .task-state-badge.skipped {
                    background: #f1f5f9;
                    color: #475569;
                }

                .task-category-badge {
                    flex: 0 0 auto;
                    padding: 1px 5px;
                    border-radius: 4px;
                    background: #f8fafc;
                    color: #64748b;
                    border: 1px solid #e2e8f0;
                    font-size: 10px;
                    font-weight: 600;
                    line-height: 1.4;
                }

                .task-meta {
                    margin-top: 2px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: #71717a;
                    font-size: 11px;
                }

                .task-meta.warning {
                    color: #92400e;
                }

                .task-result {
                    margin-top: 2px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: #64748b;
                    font-size: 11px;
                }

                .task-result.failed {
                    color: #b91c1c;
                }

                .task-result.warning {
                    color: #92400e;
                }

                .task-result.skipped {
                    color: #475569;
                }

                .task-status-receipt {
                    margin-top: 3px;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    min-width: 0;
                    overflow: hidden;
                    color: #334155;
                    font-size: 10px;
                    line-height: 1.35;
                }

                .task-status-receipt-label {
                    flex: 0 0 auto;
                    padding: 1px 4px;
                    border-radius: 4px;
                    background: #f1f5f9;
                    color: #475569;
                    font-weight: 800;
                }

                .task-status-receipt-detail,
                .task-status-receipt-action {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .task-status-receipt-detail {
                    color: #64748b;
                }

                .task-status-receipt-action {
                    color: #334155;
                    font-weight: 700;
                }

                .task-status-receipt.warning .task-status-receipt-label {
                    background: #fef3c7;
                    color: #92400e;
                }

                .task-status-receipt.failed .task-status-receipt-label {
                    background: #fee2e2;
                    color: #991b1b;
                }

                .task-status-receipt.executing .task-status-receipt-label {
                    background: #e0f2fe;
                    color: #075985;
                }

                .task-status-receipt.pending .task-status-receipt-label {
                    background: #e0f2fe;
                    color: #075985;
                }

                .task-status-receipt.running .task-status-receipt-label {
                    background: #dcfce7;
                    color: #166534;
                }

                .task-status-receipt.disabled .task-status-receipt-label {
                    background: #f4f4f5;
                    color: #52525b;
                }

                .task-queue-summary {
                    margin-top: 4px;
                    padding: 6px 7px;
                    border-radius: 6px;
                    background: #eef6ff;
                    color: #0f4f7a;
                    font-size: 10px;
                    line-height: 1.35;
                }

                .task-queue-summary-heading {
                    color: #075985;
                    font-weight: 800;
                }

                .task-queue-summary-grid {
                    display: grid;
                    grid-template-columns: max-content minmax(0, 1fr);
                    gap: 2px 7px;
                    margin-top: 4px;
                    align-items: baseline;
                }

                .task-queue-summary-grid span {
                    color: #64748b;
                    font-weight: 700;
                }

                .task-queue-summary-grid strong {
                    min-width: 0;
                    color: #0f4f7a;
                    font-weight: 800;
                    overflow-wrap: anywhere;
                }

                .task-queue-summary-details {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 3px;
                    margin-top: 5px;
                }

                .task-queue-summary-details span {
                    max-width: 100%;
                    padding: 2px 5px;
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.82);
                    color: #075985;
                    font-weight: 700;
                    overflow-wrap: anywhere;
                }

                .task-queue-summary-boundary {
                    margin-top: 5px;
                    color: #475569;
                    font-weight: 700;
                    overflow-wrap: anywhere;
                }

                .task-latest-run {
                    margin-top: 2px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: #475569;
                    font-size: 10px;
                    font-weight: 600;
                }

                .task-latest-run.success {
                    color: #166534;
                }

                .task-latest-run.failed {
                    color: #b91c1c;
                }

                .task-latest-run.skipped {
                    color: #475569;
                }

                .task-history {
                    margin-top: 2px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: #71717a;
                    font-size: 10px;
                }

                .task-action-hint {
                    margin-top: 2px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: #475569;
                    font-size: 10px;
                    font-weight: 600;
                }

                .task-action-hint.warning {
                    color: #92400e;
                }

                .task-action-hint.failed {
                    color: #b91c1c;
                }

                .task-action-hint.skipped {
                    color: #475569;
                }

                .task-action-boundary {
                    margin-top: 4px;
                    padding: 4px 6px;
                    border-radius: 6px;
                    background: #f8fafc;
                    color: #475569;
                    font-size: 10px;
                    font-weight: 600;
                    line-height: 1.35;
                    overflow-wrap: anywhere;
                }

                .task-action-boundary.warning {
                    background: #fffbeb;
                    color: #92400e;
                }

                .task-action-boundary.failed {
                    background: #fef2f2;
                    color: #991b1b;
                }

                .task-action-boundary.skipped,
                .task-action-boundary.disabled {
                    background: #f1f5f9;
                    color: #475569;
                }

                .task-dot {
                    width: 7px;
                    height: 7px;
                    flex: 0 0 7px;
                    border-radius: 999px;
                    background: #a1a1aa;
                }

                .task-dot.running {
                    background: #16a34a;
                }

                .task-dot.executing {
                    background: #0284c7;
                }

                .task-dot.failed {
                    background: #dc2626;
                }

                .task-dot.warning {
                    background: #f59e0b;
                }

                .task-dot.skipped {
                    background: #64748b;
                }

                .task-dot.stopped {
                    background: #a1a1aa;
                }

                .task-actions {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex-shrink: 0;
                }

                .task-mini-switch {
                    position: relative;
                    display: inline-block;
                    width: 32px;
                    height: 18px;
                }

                .task-mini-switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }

                .task-mini-switch span {
                    position: absolute;
                    cursor: pointer;
                    inset: 0;
                    border-radius: 999px;
                    background: #d4d4d8;
                    transition: 0.2s;
                }

                .task-mini-switch span:before {
                    content: "";
                    position: absolute;
                    width: 14px;
                    height: 14px;
                    left: 2px;
                    bottom: 2px;
                    border-radius: 50%;
                    background: #ffffff;
                    transition: 0.2s;
                }

                .task-mini-switch input:checked + span {
                    background: #0ea5e9;
                }

                .task-mini-switch input:checked + span:before {
                    transform: translateX(14px);
                }

                .task-mini-switch input:disabled + span {
                    cursor: wait;
                    opacity: 0.55;
                }

                .task-status-error {
                    margin: 0 0 6px;
                    color: #b91c1c;
                    font-size: 11px;
                    line-height: 1.4;
                }
                
                .header-icons {
                    display: flex;
                    gap: 4px;
                    margin-left: 8px;
                }
                
                .header-icon-btn {
                    width: 28px !important;
                    min-width: 28px !important;
                    height: 28px;
                    padding: 0 !important;
                    margin: 0 !important;
                    border: none;
                    border-radius: 6px;
                    background: #f0f0f0;
                    cursor: pointer;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }
                
                .header-icon-btn:hover {
                    background: #e0e0e0;
                    transform: scale(1.1);
                }

                .doubao-icon-btn {
                    padding: 0 !important;
                    overflow: hidden;
                    background: transparent;
                    border: 1px solid rgba(0, 0, 0, 0.08);
                }

                .doubao-icon-btn:hover {
                    background: transparent;
                    transform: scale(1.1);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
                }

                .doubao-icon-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                    border-radius: 6px;
                }

                .toggle-container {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px;
                    margin-bottom: 5px; /* Added margin */
                }

                .toggle-label {
                    margin-right: 10px;
                    font-size: 12px; /* Adjusted font size */
                }

                .task-header-pending-receipt {
                    margin: -3px 8px 6px;
                    padding: 7px 8px;
                    border: 1px solid #cbd5e1;
                    border-radius: 4px;
                    background: #f8fafc;
                    color: #334155;
                    font-size: 10px;
                    line-height: 1.35;
                }

                .task-header-pending-title {
                    font-weight: 800;
                }

                .task-header-pending-detail {
                    margin-top: 3px;
                    color: #1f2937;
                    font-weight: 700;
                }

                .task-header-pending-boundary {
                    margin-top: 1px;
                    color: #475569;
                }

                .task-header-pending-title,
                .task-header-pending-detail,
                .task-header-pending-boundary {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .toggle-switch {
                    position: relative;
                    display: inline-block;
                    width: 40px; /* Slightly wider */
                    height: 20px; /* Slightly taller */
                }

                .toggle-switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }

                .toggle-slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #ccc;
                    transition: .4s;
                    border-radius: 20px; /* Match height */
                }

                .toggle-slider:before {
                    position: absolute;
                    content: "";
                    height: 16px; /* Adjusted size */
                    width: 16px;  /* Adjusted size */
                    left: 2px;    /* Adjusted position */
                    bottom: 2px;  /* Adjusted position */
                    background-color: white;
                    transition: .4s;
                    border-radius: 50%;
                }

                input:checked + .toggle-slider {
                    background-color: #2196F3;
                }

                input:checked + .toggle-slider:before {
                    transform: translateX(20px); /* Adjusted translation */
                }

                input:disabled + .toggle-slider {
                    cursor: wait;
                    opacity: 0.6;
                }

                button { /* General button styling */
                    display: block; /* Make buttons take full width */
                    width: calc(100% - 16px); /* Account for padding */
                    padding: 8px 16px;
                    margin: 8px 8px 0 8px; /* Adjust margins */
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    text-align: center;
                    box-sizing: border-box;
                }

                button:hover {
                    opacity: 0.9;
                }

                .jira-button {
                    background-color: #0052CC;
                    color: white;
                }

                .jira-button:hover {
                    background-color: #0065FF;
                }

                .expand-button { /* Style for the new button */
                    background-color: #5bc0de; /* Example info blue */
                    color: white;
                }

                .expand-button:hover {
                     background-color: #31b0d5;
                }

                 .dashboard-button {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    font-weight: 600;
                    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
                    transition: all 0.3s ease;
                 }
                 
                 .dashboard-button:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                 }
                 
                 .memory-button {
                    background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
                    color: white;
                    font-weight: 600;
                    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
                    transition: all 0.3s ease;
                 }
                 
		                 .memory-button:hover {
		                    transform: translateY(-1px);
		                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
		                 }

		                 .message-button {
	                    background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);
                     color: white;
                     font-weight: 600;
                     box-shadow: 0 2px 8px rgba(20, 184, 166, 0.28);
                     transition: all 0.3s ease;
                  }
                  .message-button:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(20, 184, 166, 0.38);
                  }
                 
                 .scheduled-button {
                    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                    color: white;
                    font-weight: 600;
                    box-shadow: 0 2px 8px rgba(245, 87, 108, 0.3);
                    transition: all 0.3s ease;
                 }
                 
	                 .scheduled-button:hover {
	                    transform: translateY(-1px);
	                    box-shadow: 0 4px 12px rgba(245, 87, 108, 0.4);
	                 }

	                 .page-actions-card {
	                    margin: 8px 8px 0;
	                    padding: 8px;
	                    border: 1px solid #e2e8f0;
	                    border-radius: 8px;
	                    background: #f8fafc;
	                    display: flex;
	                    flex-direction: column;
	                    gap: 8px;
	                }

	                .page-actions-title {
	                    margin: 0 0 2px;
	                    padding: 0 2px;
	                    color: #475569;
	                    font-size: 10px;
	                    font-weight: 800;
	                    letter-spacing: 0.04em;
	                    text-transform: uppercase;
	                }

	                .page-actions-card button {
	                    width: 100%;
	                    margin: 0;
	                }

	                .page-actions-card .meeting-pilot-notice {
	                    width: 100%;
	                    margin: 0;
	                }

	                 .meeting-pilot-notice {
	                    width: calc(100% - 16px);
	                    margin: 6px 8px 0;
	                    padding: 8px 10px;
	                    box-sizing: border-box;
	                    border-radius: 6px;
	                    border: 1px solid #d4d4d8;
	                    background: #fafafa;
	                    color: #3f3f46;
	                    font-size: 11px;
	                    line-height: 1.45;
	                    display: flex;
	                    align-items: flex-start;
	                    gap: 8px;
	                }

	                .meeting-pilot-notice.error {
	                    border-color: #fecaca;
	                    background: #fff1f2;
	                    color: #991b1b;
	                }

	                .meeting-pilot-notice.warning {
	                    border-color: #fde68a;
	                    background: #fffbeb;
	                    color: #92400e;
	                }

	                .meeting-pilot-notice.info {
	                    border-color: #bfdbfe;
	                    background: #eff6ff;
	                    color: #1e3a8a;
	                }

	                .meeting-pilot-notice span {
	                    min-width: 0;
	                    flex: 1;
	                }

	                .meeting-pilot-notice button {
	                    width: auto;
	                    min-width: 58px;
	                    margin: 0;
	                    padding: 4px 7px;
	                    border-radius: 4px;
	                    border: 1px solid currentColor;
	                    background: rgba(255, 255, 255, 0.64);
	                    color: inherit;
	                    font-size: 11px;
	                    white-space: nowrap;
	                }

		                 .slides-button.main-button {
	                    background-color: #4285F4; /* Google blue */
	                    color: white;
	                 }
                 
                 .slides-button.main-button:hover {
                    background-color: #2a75f3;
                 }

                 .loading-text {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                 }
            `}</style>
    </div>
  );
};

ReactDOM.render(
  <React.StrictMode>
    {' '}
    {/* Added StrictMode */}
    <Popup />
  </React.StrictMode>,
  document.getElementById('popup-root'),
);
