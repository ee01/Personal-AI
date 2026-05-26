import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect } from 'react';
import { sendMessageToActiveTab } from './popup';
import { getEnvConfig } from './utils';
import { getGoogleAuthToken } from './utils/googleAuth';
import {
  getMemoryServiceClient,
  type DayPilotCard,
  type DayPilotContextPackResponse,
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
  taskMatchesStatusFilter,
  taskNeedsAttention,
  type TaskSchedulerStatusFilter,
} from './services/taskSchedulerStatusFilters';
import {
  extractMeetingIdFromUrl,
  MeetingPilotSessionSnapshot,
} from './meeting-shell/protocol';

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
  runHistory?: TaskSchedulerRunRecord[];
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

type MeetingPilotNotice = {
  tone: 'info' | 'warning' | 'error';
  message: string;
  action?: 'options';
};

const TASK_CATEGORY_LABELS: Record<string, string> = {
  message_analysis: '消息',
  data_sync: '同步',
  system_maintenance: '维护',
  user_profile: '画像',
};
const TASK_ATTENTION_SUMMARY_LIMIT = 3;

function formatTaskInterval(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    return `${minutes / 1440} 天`;
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60} 小时`;
  }
  return `${minutes} 分钟`;
}

function formatTaskRelativeTime(value?: number, now = Date.now()): string {
  if (!value) return '未排程';

  const diffMs = value - now;
  if (diffMs <= 0) {
    return '等待触发';
  }

  const totalMinutes = Math.max(1, Math.ceil(diffMs / 60_000));
  if (totalMinutes < 60) {
    return `${totalMinutes} 分钟后`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) {
    return minutes > 0 ? `${hours} 小时 ${minutes} 分钟后` : `${hours} 小时后`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days} 天 ${remainingHours} 小时后` : `${days} 天后`;
}

function formatTaskTime(value?: number): string {
  if (!value) return '未排程';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTaskRefreshTime(value: number): string {
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getLocalTaskTimeZoneLabel(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || '本机时区';
}

function formatTaskResult(task: TaskSchedulerTask): string {
  const failureStreak = getTaskFailureStreak(task);
  if (task.isExecuting) {
    return `执行中 · 开始 ${formatTaskTime(task.lastRun)}`;
  }
  if (hasTaskRecentSkip(task)) {
    return `上次跳过 · ${task.lastSkipReason || '已有执行中任务'}`;
  }
  if (!task.lastCompletedAt) {
    return '尚未执行';
  }
  if (task.lastSuccess === false) {
    if (failureStreak > 1) {
      return `连续失败 ${failureStreak} 次 · ${task.lastError || '查看后台日志'}`;
    }
    return `上次失败 · ${task.lastError || '查看后台日志'}`;
  }
  if (task.lastResultSummary) {
    return `上次成功 · ${task.lastResultSummary}`;
  }
  return `上次成功 · ${formatTaskTime(task.lastCompletedAt)}`;
}

function formatTaskRunTrigger(
  trigger?: TaskSchedulerRunRecord['trigger'],
): string {
  if (trigger === 'manual') return '手动';
  if (trigger === 'startup') return '启动';
  return '排程';
}

function formatTaskRunDuration(durationMs?: number): string {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
    return '耗时未知';
  }
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  if (durationMs < 10_000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }
  return `${Math.round(durationMs / 1000)}s`;
}

function getTaskLatestRunSummary(task: TaskSchedulerTask):
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
  const resultLabel = latestRun.skipped
    ? '跳过'
    : latestRun.success
    ? '成功'
    : '失败';
  const detail = latestRun.skipped
    ? latestRun.error || '已有执行中任务'
    : latestRun.success
    ? latestRun.summary || ''
    : latestRun.error || '未知错误';
  const parts = [
    '最近一次',
    `${formatTaskRunTrigger(latestRun.trigger)}${resultLabel}`,
    formatTaskRunDuration(latestRun.durationMs),
  ];

  if (detail) {
    parts.push(detail);
  }

  return {
    text: parts.join(' · '),
    className,
  };
}

function formatTaskRunHistorySummary(task: TaskSchedulerTask): string {
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
  const parts = [`${successCount} 成功`];
  if (failedCount > 0) {
    parts.push(`${failedCount} 失败`);
  }
  if (skippedCount > 0) {
    parts.push(`${skippedCount} 跳过`);
  }
  return `近 ${history.length} 次 · ${parts.join(' / ')}`;
}

function formatTaskRunHistoryTitle(task: TaskSchedulerTask): string {
  const history = Array.isArray(task.runHistory) ? task.runHistory : [];
  return history
    .map((run) => {
      const result = run.skipped
        ? `跳过: ${run.error || '已有执行中任务'}`
        : run.success
        ? run.summary
          ? `成功: ${run.summary}`
          : '成功'
        : `失败: ${run.error || '未知错误'}`;
      return `${formatTaskTime(run.completedAt)} · ${formatTaskRunTrigger(
        run.trigger,
      )} · ${result} · ${run.durationMs}ms`;
    })
    .join('\n');
}

function formatTaskScheduleHealthLabel(task: TaskSchedulerTask): string {
  if (task.scheduleHealth === 'missing_alarm') return '未排程';
  if (task.scheduleHealth === 'period_mismatch') return '需重排';
  if (task.scheduleHealth === 'overdue') return '逾期';
  if (task.scheduleHealth === 'repair_failed') return '修复失败';
  return '排程异常';
}

function formatTaskSchedule(task: TaskSchedulerTask, now = Date.now()): string {
  if (!task.enabled) {
    return '停用 · 可手动执行';
  }
  if (hasTaskScheduleWarning(task)) {
    return task.scheduleWarning || '排程需要刷新';
  }
  if (!task.nextRun) {
    return '等待 Chrome 排程';
  }
  return `下次 ${formatTaskRelativeTime(task.nextRun, now)} · ${formatTaskTime(
    task.nextRun,
  )}`;
}

function formatTaskActionHint(task: TaskSchedulerTask): string {
  const failureStreak = getTaskFailureStreak(task);
  if (task.isExecuting) {
    return '';
  }
  if (hasTaskScheduleWarning(task)) {
    if (task.scheduleHealth === 'overdue') {
      return '建议先立即执行，再重排下一次';
    }
    if (task.scheduleHealth === 'repair_failed') {
      return '旧排程会尽量保留，可稍后重试重排';
    }
    return '建议重排 Chrome alarm';
  }
  if (hasTaskRecentSkip(task)) {
    return '当前任务完成后再重试';
  }
  if (shouldRecommendTaskPause(task)) {
    return `连续失败 ${failureStreak} 次，建议先暂停排程并检查服务配置`;
  }
  if (failureStreak > 1) {
    return `连续失败 ${failureStreak} 次，建议检查后台日志后重试`;
  }
  if (task.lastSuccess === false) {
    return '建议重试一次，重复失败再查后台日志';
  }
  return '';
}

function getTaskRunButtonTitle(task: TaskSchedulerTask, isBusy: boolean): string {
  if (isBusy || task.isExecuting) {
    return '正在执行';
  }
  if (hasTaskScheduleWarning(task)) {
    return '立即执行一次，不会修复排程';
  }
  if (task.lastSuccess === false) {
    return '立即重试';
  }
  if (!task.enabled) {
    return '手动执行一次，不启用排程';
  }
  return '立即执行';
}

function formatTaskFilterEmptyState(
  filter: TaskSchedulerStatusFilter,
  isLoading: boolean,
): string {
  if (isLoading) {
    return '正在加载后台任务';
  }
  if (filter === 'attention') return '当前没有需要处理的后台任务';
  if (filter === 'executing') return '当前没有执行中的后台任务';
  if (filter === 'warning') return '当前没有排程异常';
  if (filter === 'skipped') return '当前没有最近跳过的任务';
  if (filter === 'failed') return '当前没有失败任务';
  if (filter === 'disabled') return '当前没有停用任务';
  return '暂无后台任务状态';
}

function formatTaskSchedulerNextStep(task?: TaskSchedulerTask): {
  tone: 'executing' | 'warning' | 'failed' | 'skipped';
  message: string;
} | null {
  if (!task) {
    return null;
  }

  const statusKind = getTaskStatusKind(task);
  if (statusKind === 'executing') {
    return {
      tone: 'executing',
      message: `${task.name} 正在执行，等待完成后再触发新操作。`,
    };
  }
  if (statusKind === 'warning') {
    if (task.scheduleHealth === 'overdue') {
      return {
        tone: 'warning',
        message: `${task.name} 排程逾期，先立即执行一次，再重排下一次。`,
      };
    }
    if (task.scheduleHealth === 'repair_failed') {
      return {
        tone: 'warning',
        message: `${task.name} 排程修复失败，保留旧排程并稍后重试。`,
      };
    }
    return {
      tone: 'warning',
      message: `${task.name} 排程异常，优先点击重排恢复 Chrome alarm。`,
    };
  }
  if (statusKind === 'failed') {
    const failureStreak = getTaskFailureStreak(task);
    if (failureStreak > 1) {
      return {
        tone: 'failed',
        message: `${task.name} 连续失败 ${failureStreak} 次，先检查服务配置或网络，再重试。`,
      };
    }
    return {
      tone: 'failed',
      message: `${task.name} 上次失败，可重试一次；重复失败先查服务状态。`,
    };
  }
  if (statusKind === 'skipped') {
    return {
      tone: 'skipped',
      message: `${task.name} 最近被跳过，等待当前执行完成后再重试。`,
    };
  }
  return null;
}

function formatTaskAttentionStatusLabel(task: TaskSchedulerTask): string {
  const statusKind = getTaskStatusKind(task);
  if (statusKind === 'executing') return '执行中';
  if (statusKind === 'warning') return formatTaskScheduleHealthLabel(task);
  if (statusKind === 'failed') return '失败';
  if (statusKind === 'skipped') return '跳过';
  return '需处理';
}

function formatTaskAttentionReason(task: TaskSchedulerTask): string {
  const statusKind = getTaskStatusKind(task);
  if (statusKind === 'executing') {
    return `开始 ${formatTaskTime(task.lastRun)}`;
  }
  if (statusKind === 'warning') {
    return task.scheduleWarning || 'Chrome alarm 需要刷新';
  }
  if (statusKind === 'failed') {
    const failureStreak = getTaskFailureStreak(task);
    const prefix =
      failureStreak > 1 ? `连续失败 ${failureStreak} 次` : '上次失败';
    return task.lastError ? `${prefix} · ${task.lastError}` : prefix;
  }
  if (statusKind === 'skipped') {
    return task.lastSkipReason || '任务条件未满足';
  }
  return '';
}

function formatTaskAttentionAction(task: TaskSchedulerTask): string {
  const actionHint = formatTaskActionHint(task);
  if (actionHint) {
    return actionHint;
  }

  const statusKind = getTaskStatusKind(task);
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
      }。请先停止那场会议，或切换到正在录制的 tab。`,
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
      }。${detail} 请打开 Meeting Pilot 配置页修复后重试。`,
      action: 'options',
    };
  }

  if (session?.capture?.kind === 'error') {
    return {
      tone: 'error',
      message: `${formatMeetingPilotCaptureError(
        session.capture.lastError,
      )}。请确认原会议 tab 仍打开，再点击“开启会议全貌”重新授权。`,
    };
  }

  if (response?.panelError) {
    return {
      tone: 'warning',
      message: `Capture 已尝试启动，但会议面板没有打开：${response.panelError}。请从会议页右下角入口或 popup 再打开面板。`,
    };
  }

  return {
    tone: 'warning',
    message: 'Capture 没有成功开始。请确认当前 tab 是 RingCentral 会议页，再重试。',
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

function formatTodayPilotContextPackReceipt(
  pack: DayPilotContextPackResponse,
): string {
  const provider =
    pack.providerProfile?.id === 'generic'
      ? '通用'
      : pack.providerProfile?.label || 'Today Pilot';
  const details = [`${pack.evidenceRefs.length} 条证据`];
  if (pack.redactionApplied) {
    details.push('已脱敏');
  }
  if (pack.truncated) {
    details.push('已按预算截断');
  }
  return `已复制${provider}上下文包（${details.join('，')}）`;
}

function topTodayPilotCards(cards: DayPilotCard[]): DayPilotCard[] {
  return cards
    .filter((card) => card.state !== 'done' && card.state !== 'muted')
    .slice(0, 3);
}

type TodayPilotPopupFeedbackAction = 'done' | 'later';

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
  const [taskSchedulerFilter, setTaskSchedulerFilter] =
    useState<TaskSchedulerStatusFilter>('all');
  const [taskSchedulerError, setTaskSchedulerError] = useState('');
  const [busyTaskIds, setBusyTaskIds] = useState<Record<string, boolean>>({});
  const [todayPilotCards, setTodayPilotCards] = useState<DayPilotCard[]>([]);
  const [todayPilotLoading, setTodayPilotLoading] = useState(false);
  const [todayPilotError, setTodayPilotError] = useState('');
  const [todayPilotNotice, setTodayPilotNotice] = useState('');
  const [todayPilotCopyingMissionId, setTodayPilotCopyingMissionId] =
    useState('');
  const [todayPilotFeedbackingCardId, setTodayPilotFeedbackingCardId] =
    useState('');

  const loadTaskSchedulerStatus = async (showLoading = false) => {
    if (showLoading) {
      setIsTaskStatusLoading(true);
    }
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'GET_TASK_SCHEDULER_STATUS',
      })) as
        | { success?: boolean; tasks?: TaskSchedulerTask[]; error?: string }
        | undefined;

      if (!response?.success || !Array.isArray(response.tasks)) {
        throw new Error(response?.error || '任务状态不可用');
      }

      setTaskSchedulerTasks(response.tasks);
      setTaskStatusNow(Date.now());
      setTaskSchedulerError('');

      const messageAnalysisTask = response.tasks.find(
        (task) => task.id === 'message_analysis',
      );
      if (messageAnalysisTask) {
        setIsScheduleActive(messageAnalysisTask.enabled);
      }
    } catch (error: any) {
      setTaskSchedulerError(error?.message || '任务状态不可用');
    } finally {
      if (showLoading) {
        setIsTaskStatusLoading(false);
      }
    }
  };

  const loadTodayPilotCards = async () => {
    setTodayPilotLoading(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await getMemoryServiceClient().getTodayPilotToday({
        timezone: timezone || 'Asia/Shanghai',
        autoGenerate: true,
      });
      setTodayPilotCards(topTodayPilotCards(response.brief?.cards || []));
      setTodayPilotError('');
      setTodayPilotNotice('');
    } catch (error: any) {
      setTodayPilotCards([]);
      setTodayPilotError(error?.message || 'today_pilot_unavailable');
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
      setTaskStatusNow(Date.now());
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
    setIsScheduleActive(newState);
    setIsScheduleUpdating(true);

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

      await loadTaskSchedulerStatus(false);
    } catch (error: any) {
      setIsScheduleActive(previousState);
      setTaskSchedulerError(error?.message || '任务控制失败');
    } finally {
      setIsScheduleUpdating(false);
    }
  };

  const setTaskBusy = (taskId: string, busy: boolean) => {
    setBusyTaskIds((current) => ({ ...current, [taskId]: busy }));
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
    patchTaskSchedulerTask(task.id, {
      enabled,
      status: enabled ? 'running' : 'stopped',
      nextRun: enabled ? task.nextRun : undefined,
      scheduleHealth: enabled ? 'scheduled' : 'disabled',
      scheduleWarning: undefined,
    });
    if (task.id === 'message_analysis') {
      setIsScheduleActive(enabled);
    }

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

      await loadTaskSchedulerStatus(false);
    } catch (error: any) {
      patchTaskSchedulerTask(task.id, previousTask);
      if (task.id === 'message_analysis') {
        setIsScheduleActive(previousTask.enabled);
      }
      setTaskSchedulerError(error?.message || '任务控制失败');
    } finally {
      setTaskBusy(task.id, false);
    }
  };

  const runTaskNow = async (task: TaskSchedulerTask) => {
    setTaskBusy(task.id, true);
    patchTaskSchedulerTask(task.id, {
      isExecuting: true,
      lastRun: Date.now(),
      lastError: undefined,
    });
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

      if (!response?.success && !response?.skipped) {
        throw new Error(response?.error || response?.message || '任务执行失败');
      }

      await loadTaskSchedulerStatus(false);
    } catch (error: any) {
      await loadTaskSchedulerStatus(false);
      setTaskSchedulerError(error?.message || '任务执行失败');
    } finally {
      setTaskBusy(task.id, false);
    }
  };

  const repairTaskSchedule = async (task: TaskSchedulerTask) => {
    setTaskBusy(task.id, true);
    patchTaskSchedulerTask(task.id, {
      nextRun: Date.now() + task.intervalMinutes * 60_000,
      scheduleHealth: 'scheduled',
      scheduleWarning: undefined,
    });

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

      await loadTaskSchedulerStatus(false);
    } catch (error: any) {
      await loadTaskSchedulerStatus(false);
      setTaskSchedulerError(error?.message || '排程修复失败');
    } finally {
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
    setMeetingPilotNotice(null);
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

  const openTopicWindow = () => {
    chrome.windows.create({
      url: 'topic-modal.html',
      type: 'popup',
      width: 980,
      height: 920,
      focused: true,
    });
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
      const response =
        await getMemoryServiceClient().renderTodayPilotContextPack(
          card.missionId,
          {
            targetProvider: 'generic',
            includeSensitive: false,
          },
        );
      await navigator.clipboard.writeText(response.bodyMd);
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
    setTodayPilotCards((cards) => cards.filter((item) => item.id !== card.id));
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
      setTodayPilotError('');
      setTodayPilotNotice(
        action === 'done' ? '已在今日领航标记完成' : '已稍后 6 小时',
      );
    } catch (error: any) {
      setTodayPilotCards(previousCards);
      setTodayPilotError(error?.message || 'today_pilot_feedback_failed');
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

    return formatTaskInterval(intervalMinutes);
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
  const disabledTaskCount = countTasksByStatusFilter(
    taskSchedulerTasks,
    'disabled',
  );
  const taskFilterChips = [
    {
      key: 'all' as const,
      label: '全部',
      count: taskSchedulerTasks.length,
      className: 'all',
    },
    {
      key: 'attention' as const,
      label: '需处理',
      count: attentionTaskCount,
      className: 'attention',
    },
    {
      key: 'executing' as const,
      label: '执行中',
      count: executingTaskCount,
      className: 'executing',
    },
    {
      key: 'warning' as const,
      label: '排程异常',
      count: scheduleWarningTaskCount,
      className: 'warning',
    },
    {
      key: 'skipped' as const,
      label: '跳过',
      count: recentSkippedTaskCount,
      className: 'skipped',
    },
    {
      key: 'failed' as const,
      label: '失败',
      count: failedTaskCount,
      className: 'failed',
    },
    {
      key: 'disabled' as const,
      label: '停用',
      count: disabledTaskCount,
      className: 'disabled',
    },
  ];
  const taskStatusSummary = taskSchedulerError
    ? '状态不可用'
    : isTaskStatusLoading
    ? '加载中'
    : executingTaskCount > 0
    ? `${executingTaskCount} 执行中 · ${enabledTaskCount}/${
        taskSchedulerTasks.length || '-'
      } 启用`
    : scheduleWarningTaskCount > 0
    ? `${scheduleWarningTaskCount} 排程异常 · ${enabledTaskCount}/${
        taskSchedulerTasks.length || '-'
      } 启用`
    : failedTaskCount > 0
    ? `${failedTaskCount} 失败 · ${enabledTaskCount}/${
        taskSchedulerTasks.length || '-'
      } 启用`
    : recentSkippedTaskCount > 0
    ? `${recentSkippedTaskCount} 跳过 · ${enabledTaskCount}/${
        taskSchedulerTasks.length || '-'
      } 启用`
    : `${enabledTaskCount}/${taskSchedulerTasks.length || '-'} 启用`;
  const visibleTaskSchedulerTasks = taskSchedulerTasks
    .filter((task) => taskMatchesStatusFilter(task, taskSchedulerFilter))
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
  const taskSchedulerNextStep =
    formatTaskSchedulerNextStep(primaryAttentionTask);
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
      statusLabel: formatTaskAttentionStatusLabel(task),
      reason: formatTaskAttentionReason(task),
      action: formatTaskAttentionAction(task),
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
          label={`静默消息分析 · 每 ${getMessageAnalysisIntervalLabel()}`}
          disabled={isScheduleUpdating}
        />
        <div className="header-icons">
          <button
            className="header-icon-btn"
            onClick={handleOpenHelp}
            title="查看帮助文档"
          >
            ❓
          </button>
          <button
            className="header-icon-btn"
            onClick={handleOpenShare}
            title="分享给同事"
          >
            ↗️
          </button>
          <button
            className="header-icon-btn doubao-icon-btn"
            onClick={handleOpenDesktopApp}
            title="Desktop App"
          >
            {DOUBAO_ICON_URL ? (
              <img
                className="doubao-icon-image"
                src={DOUBAO_ICON_URL}
                alt="Doubao"
              />
            ) : (
              '豆'
            )}
          </button>
        </div>
      </div>

      <details
        className="task-status-panel"
        onToggle={(event) => {
          const isOpen = event.currentTarget.open;
          setIsTaskPanelOpen(isOpen);
          if (isOpen) {
            setTaskStatusNow(Date.now());
            void loadTaskSchedulerStatus(true);
          }
        }}
      >
        <summary>
          <span>后台任务</span>
          <span className="task-summary">{taskStatusSummary}</span>
        </summary>
        <div className="task-status-toolbar">
          <span className="task-refresh-meta">
            刷新 {formatTaskRefreshTime(taskStatusNow)} ·{' '}
            {getLocalTaskTimeZoneLabel()}
          </span>
          <button
            className="task-refresh-btn"
            onClick={() => void loadTaskSchedulerStatus(true)}
            disabled={isTaskStatusLoading}
            title="刷新后台任务状态"
            aria-label="刷新后台任务状态"
          >
            ↻
          </button>
        </div>
        {taskFilterChips.length > 0 && (
          <div className="task-health-strip" aria-label="筛选后台任务状态">
            {taskFilterChips.map((chip) => (
              <button
                className={`task-health-chip ${chip.className} ${
                  taskSchedulerFilter === chip.key ? 'active' : ''
                } ${chip.count === 0 ? 'empty' : ''}`}
                key={chip.key}
                type="button"
                onClick={() => setTaskSchedulerFilter(chip.key)}
                title={`筛选${chip.label}任务`}
                aria-pressed={taskSchedulerFilter === chip.key}
              >
                {chip.label} {chip.count}
              </button>
            ))}
          </div>
        )}
        {taskSchedulerNextStep && (
          <div
            className={`task-next-step ${taskSchedulerNextStep.tone}`}
            role="status"
          >
            {taskSchedulerNextStep.message}
          </div>
        )}
        {taskAttentionSummaryItems.length > 1 && (
          <div
            className="task-attention-summary"
            aria-label="后台任务需处理总览"
          >
            <div className="task-attention-summary-title">
              <span>需处理总览</span>
              <span>{attentionTaskCount} 项</span>
            </div>
            {taskAttentionSummaryItems.map((item) => (
              <div
                className={`task-attention-item ${item.statusKind}`}
                key={item.task.id}
              >
                <div className="task-attention-main">
                  <span className="task-attention-name">{item.task.name}</span>
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
                还有 {hiddenAttentionTaskCount} 个需处理任务，切到“需处理”查看
              </div>
            )}
          </div>
        )}
        {taskSchedulerError && (
          <div className="task-status-error">{taskSchedulerError}</div>
        )}
        <div className="task-list">
          {!taskSchedulerError && visibleTaskSchedulerTasks.length === 0 && (
            <div className="task-empty-state">
              {formatTaskFilterEmptyState(
                taskSchedulerFilter,
                isTaskStatusLoading,
              )}
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
            const stateLabel =
              statusKind === 'executing'
                ? '执行中'
                : statusKind === 'warning'
                ? formatTaskScheduleHealthLabel(task)
                : statusKind === 'skipped'
                ? '跳过'
                : statusKind === 'failed'
                ? '失败'
                : statusKind === 'running'
                ? '启用'
                : '停用';
            const runHistorySummary = formatTaskRunHistorySummary(task);
            const latestRunSummary = getTaskLatestRunSummary(task);
            const actionHint = formatTaskActionHint(task);
            return (
              <div className="task-row" key={task.id} title={task.description}>
                <div className="task-main">
                  <div className="task-name-line">
                    <span className={`task-dot ${statusClass}`}></span>
                    <span className="task-name">{task.name}</span>
                    <span className={`task-state-badge ${statusClass}`}>
                      {stateLabel}
                    </span>
                    <span className="task-category-badge">
                      {TASK_CATEGORY_LABELS[task.category] || '任务'}
                    </span>
                  </div>
                  <div
                    className={`task-meta ${
                      hasScheduleWarning ? 'warning' : ''
                    }`}
                  >
                    每 {formatTaskInterval(task.intervalMinutes)}
                    {' · '}
                    {formatTaskSchedule(task, taskStatusNow)}
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
                      (hasRecentSkip ? task.lastSkipReason : task.lastError) ||
                      ''
                    }
                  >
                    {formatTaskResult(task)}
                  </div>
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
                      title={formatTaskRunHistoryTitle(task)}
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
                </div>
                <div className="task-actions">
                  <label className="task-mini-switch" title="启用或停用">
                    <input
                      type="checkbox"
                      checked={task.enabled}
                      disabled={isBusy}
                      aria-label={`${task.enabled ? '停用' : '启用'}${
                        task.name
                      }`}
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
                      title="重试创建此任务的 Chrome 排程"
                      aria-label={`修复${task.name}排程`}
                    >
                      ↻
                    </button>
                  )}
                  {canPauseFailedSchedule && (
                    <button
                      className="task-pause-btn"
                      onClick={() => void updateTaskEnabled(task, false)}
                      disabled={isBusy}
                      title="暂停排程，保留手动执行入口"
                      aria-label={`暂停${task.name}排程`}
                    >
                      暂停
                    </button>
                  )}
                  <button
                    className="task-run-btn"
                    onClick={() => void runTaskNow(task)}
                    disabled={isBusy || task.isExecuting}
                    title={getTaskRunButtonTitle(task, isBusy)}
                    aria-label={`立即执行${task.name}`}
                  >
                    {isBusy || task.isExecuting ? '...' : '▶'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </details>

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

      <button onClick={openMemoryInterface} className="memory-button">
        🧠 实体记忆查询
      </button>

      {/* <button onClick={openProjectDashboard} className="dashboard-button">
                📊 项目进度仪表盘
            </button> */}

      <button
        onClick={openScheduledMessagesManager}
        className="scheduled-button"
      >
        ⏰ 定时消息管理
      </button>

      <button onClick={openTopicWindow} className="message-button">
        📋 管理记忆入口
      </button>

      {isRingCentralMeeting && (
        <>
          <button
            onClick={handleOpenRadar}
            className="radar-button"
            disabled={isMeetingPilotBusy}
          >
            {isMeetingPilotBusy
              ? '处理中...'
              : isMeetingPilotCaptureActive(meetingPilotSession)
              ? '打开会议全貌'
              : isMeetingPilotTranscriptPilotActive(meetingPilotSession)
              ? '启用画面理解与纪要'
              : '开启会议全貌'}
          </button>
          {meetingPilotNotice ? (
            <div
              className={`meeting-pilot-notice ${meetingPilotNotice.tone}`}
              role={meetingPilotNotice.tone === 'error' ? 'alert' : 'status'}
            >
              <span>{meetingPilotNotice.message}</span>
              {meetingPilotNotice.action === 'options' ? (
                <button type="button" onClick={openMeetingPilotOptions}>
                  打开配置
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <section className="today-pilot-panel">
        <div className="today-pilot-head">
          <button
            className="today-pilot-title"
            onClick={openTodayPilotHome}
            title="打开 Today Pilot 首页"
          >
            今日领航
          </button>
          <button
            className="today-pilot-refresh"
            onClick={() => void loadTodayPilotCards()}
            disabled={todayPilotLoading}
            title="刷新今日领航"
            aria-label="刷新今日领航"
          >
            ↻
          </button>
        </div>
        <div className="today-pilot-list">
          {todayPilotLoading && todayPilotCards.length === 0 ? (
            <div className="today-pilot-empty">正在读取今日 mission</div>
          ) : todayPilotError && todayPilotCards.length === 0 ? (
            <div className="today-pilot-empty">Today Pilot 暂不可用</div>
          ) : todayPilotCards.length === 0 ? (
            <div className="today-pilot-empty">暂时没有需要处理的事项</div>
          ) : (
            todayPilotCards.map((card) => {
              const isMeeting = isTodayPilotMeetingCard(card);
              const copying = todayPilotCopyingMissionId === card.missionId;
              const doneKey = `${card.id}:done`;
              const laterKey = `${card.id}:later`;
              return (
                <article className="today-pilot-card" key={card.id}>
                  <button
                    className="today-pilot-card-main"
                    onClick={openTodayPilotHome}
                    title={card.whyNow}
                  >
                    <span className={`today-pilot-priority ${card.priority}`}>
                      {getTodayPilotPriorityLabel(card)}
                    </span>
                    <span className="today-pilot-card-text">
                      <span className="today-pilot-card-title">
                        {card.title}
                      </span>
                      <span className="today-pilot-card-sub">
                        <strong>做</strong>
                        <span>{card.nextBestAction}</span>
                      </span>
                      <span className="today-pilot-card-why">
                        <strong>因</strong>
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
                      <button onClick={openRingCentralVideoHome}>
                        Video Home
                      </button>
                    ) : null}
                    <button
                      onClick={() =>
                        void sendTodayPilotPopupFeedback(card, 'done')
                      }
                      disabled={todayPilotFeedbackingCardId === doneKey}
                      title="今天不再显示这张 mission"
                    >
                      {todayPilotFeedbackingCardId === doneKey
                        ? '处理中'
                        : '完成'}
                    </button>
                    <button
                      onClick={() =>
                        void sendTodayPilotPopupFeedback(card, 'later')
                      }
                      disabled={todayPilotFeedbackingCardId === laterKey}
                      title="6 小时内不再显示"
                    >
                      {todayPilotFeedbackingCardId === laterKey
                        ? '处理中'
                        : '稍后'}
                    </button>
                    <button
                      onClick={() => void copyTodayPilotContextPack(card)}
                      disabled={copying}
                    >
                      {copying ? '复制中' : '复制'}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
        {(todayPilotError || todayPilotNotice) && todayPilotCards.length > 0 ? (
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
                .popup-container {
                    padding-bottom: 8px; /* Add padding at the bottom */
                    min-width: 300px;
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
                    padding: 8px;
                    border-top: 1px solid #eeeeee;
                    margin-top: 4px;
                }

                .today-pilot-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 6px;
                }

                .today-pilot-title {
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
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .today-pilot-empty {
                    color: #64748b;
                    font-size: 12px;
                    line-height: 1.45;
                    padding: 6px 0;
                }

                .today-pilot-card {
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    background: #ffffff;
                    overflow: hidden;
                }

                .today-pilot-card-main {
                    width: 100%;
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
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .today-pilot-card-title,
                .today-pilot-card-sub,
                .today-pilot-card-why,
                .today-pilot-card-meta {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .today-pilot-card-title {
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
                    color: #475569;
                    font-size: 10px;
                }

                .today-pilot-card-sub span,
                .today-pilot-card-why span {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .today-pilot-card-actions {
                    border-top: 1px solid #f1f5f9;
                    display: flex;
                    gap: 6px;
                    padding: 6px 8px;
                }

                .today-pilot-card-actions button {
                    flex: 1;
                    min-height: 26px;
                    min-width: 0;
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
                    color: #64748b;
                    font-weight: 500;
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

                .task-health-strip {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                    padding: 0 0 6px;
                }

                .task-health-chip {
                    flex: 0 0 auto;
                    padding: 2px 6px;
                    border-radius: 4px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    color: #475569;
                    cursor: pointer;
                    font-family: inherit;
                    font-size: 10px;
                    font-weight: 700;
                    line-height: 1.4;
                }

                .task-health-chip:hover,
                .task-health-chip.active {
                    border-color: #94a3b8;
                    background: #e2e8f0;
                    color: #1f2937;
                }

                .task-health-chip.attention {
                    background: #f8fafc;
                    border-color: #cbd5e1;
                    color: #334155;
                }

                .task-health-chip.executing {
                    background: #e0f2fe;
                    border-color: #bae6fd;
                    color: #075985;
                }

                .task-health-chip.warning {
                    background: #fef3c7;
                    border-color: #fde68a;
                    color: #92400e;
                }

                .task-health-chip.skipped {
                    background: #f1f5f9;
                    border-color: #cbd5e1;
                    color: #475569;
                }

                .task-health-chip.failed {
                    background: #fee2e2;
                    border-color: #fecaca;
                    color: #991b1b;
                }

                .task-health-chip.disabled {
                    background: #f4f4f5;
                    border-color: #d4d4d8;
                    color: #52525b;
                }

                .task-health-chip.active {
                    box-shadow: inset 0 0 0 1px currentColor;
                }

                .task-health-chip.empty:not(.active) {
                    opacity: 0.72;
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
