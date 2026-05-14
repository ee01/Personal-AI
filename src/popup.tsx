import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect } from 'react';
import { sendMessageToActiveTab } from './popup';
import { getEnvConfig } from './utils';
import { getGoogleAuthToken } from './utils/googleAuth';
import {
  getMemoryServiceClient,
  type DayPilotCard,
} from './services/MemoryServiceClient';
import { getTaskEnabled } from './services/taskSchedulerDefinitions';
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
}

const TASK_CATEGORY_LABELS: Record<string, string> = {
  message_analysis: '消息',
  data_sync: '同步',
  system_maintenance: '维护',
  user_profile: '画像',
};

function formatTaskInterval(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    return `${minutes / 1440} 天`;
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60} 小时`;
  }
  return `${minutes} 分钟`;
}

function formatTaskRelativeTime(value?: number): string {
  if (!value) return '未排程';

  const diffMs = value - Date.now();
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

function formatTaskResult(task: TaskSchedulerTask): string {
  if (task.isExecuting) {
    return `执行中 · 开始 ${formatTaskTime(task.lastRun)}`;
  }
  if (
    task.lastSkippedAt &&
    (!task.lastCompletedAt || task.lastSkippedAt > task.lastCompletedAt)
  ) {
    return `上次跳过 · ${task.lastSkipReason || '已有执行中任务'}`;
  }
  if (!task.lastCompletedAt) {
    return '尚未执行';
  }
  if (task.lastSuccess === false) {
    return `上次失败 · ${task.lastError || '查看后台日志'}`;
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
        ? '成功'
        : `失败: ${run.error || '未知错误'}`;
      return `${formatTaskTime(run.completedAt)} · ${formatTaskRunTrigger(
        run.trigger,
      )} · ${result} · ${run.durationMs}ms`;
    })
    .join('\n');
}

function hasTaskScheduleWarning(task: TaskSchedulerTask): boolean {
  return Boolean(
    task.enabled &&
      (task.scheduleHealth === 'missing_alarm' ||
        task.scheduleHealth === 'period_mismatch' ||
        task.scheduleHealth === 'overdue' ||
        task.scheduleHealth === 'repair_failed'),
  );
}

function hasTaskRecentSkip(task: TaskSchedulerTask): boolean {
  return Boolean(
    task.lastSkippedAt &&
      (!task.lastCompletedAt || task.lastSkippedAt > task.lastCompletedAt),
  );
}

function formatTaskSchedule(task: TaskSchedulerTask): string {
  if (!task.enabled) {
    return '停用 · 可手动执行';
  }
  if (hasTaskScheduleWarning(task)) {
    return task.scheduleWarning || '排程需要刷新';
  }
  if (!task.nextRun) {
    return '等待 Chrome 排程';
  }
  return `下次 ${formatTaskRelativeTime(task.nextRun)} · ${formatTaskTime(
    task.nextRun,
  )}`;
}

function getTaskAttentionRank(task: TaskSchedulerTask): number {
  if (task.isExecuting) {
    return 0;
  }
  if (hasTaskScheduleWarning(task)) {
    return 1;
  }
  if (hasTaskRecentSkip(task)) {
    return 2;
  }
  if (task.lastSuccess === false) {
    return 3;
  }
  if (task.enabled) {
    return 4;
  }
  return 5;
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

function formatTodayPilotDue(card: DayPilotCard): string {
  if (!card.dueAt) return card.priority;
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
  const [isExpandingEpic, setIsExpandingEpic] = useState(false);
  const [isAnalyzingSlides, setIsAnalyzingSlides] = useState(false);
  const [isScheduleUpdating, setIsScheduleUpdating] = useState(false);
  const [isTaskStatusLoading, setIsTaskStatusLoading] = useState(false);
  const [taskSchedulerTasks, setTaskSchedulerTasks] = useState<
    TaskSchedulerTask[]
  >([]);
  const [taskSchedulerError, setTaskSchedulerError] = useState('');
  const [busyTaskIds, setBusyTaskIds] = useState<Record<string, boolean>>({});
  const [todayPilotCards, setTodayPilotCards] = useState<DayPilotCard[]>([]);
  const [todayPilotLoading, setTodayPilotLoading] = useState(false);
  const [todayPilotError, setTodayPilotError] = useState('');
  const [todayPilotCopyingMissionId, setTodayPilotCopyingMissionId] =
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
      setTodayPilotCards(
        (response.brief?.cards || [])
          .filter((card) => card.state !== 'done' && card.state !== 'muted')
          .slice(0, 3),
      );
      setTodayPilotError('');
    } catch (error: any) {
      setTodayPilotCards([]);
      setTodayPilotError(error?.message || 'today_pilot_unavailable');
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
    if (!activeRingCentralTab?.id) {
      setMeetingPilotSession(null);
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
        console.warn('[Meeting Pilot][popup] start capture did not succeed', {
          response,
          capture: response?.session?.capture,
          readiness: response?.session?.readiness,
        });
      }
    } catch (error) {
      console.error('[Meeting Pilot][popup] failed to open panorama', error);
    } finally {
      setIsMeetingPilotBusy(false);
    }
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
      const response = await getMemoryServiceClient().renderDayPilotContextPack(
        card.missionId,
        {
          targetProvider: 'generic',
          includeSensitive: false,
        },
      );
      await navigator.clipboard.writeText(response.bodyMd);
      setTodayPilotError('');
    } catch (error: any) {
      setTodayPilotError(error?.message || 'context_pack_copy_failed');
    } finally {
      setTodayPilotCopyingMissionId('');
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
            (_response) => {
              // 当收到响应时关闭loading状态
              setIsAnalyzingSlides(false);
            },
          );
        } else {
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
  const executingTaskCount = taskSchedulerTasks.filter(
    (task) => task.isExecuting,
  ).length;
  const failedTaskCount = taskSchedulerTasks.filter(
    (task) => task.lastSuccess === false,
  ).length;
  const scheduleWarningTaskCount = taskSchedulerTasks.filter(
    hasTaskScheduleWarning,
  ).length;
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
    : `${enabledTaskCount}/${taskSchedulerTasks.length || '-'} 启用`;
  const visibleTaskSchedulerTasks = taskSchedulerTasks
    .map((task, index) => ({ task, index }))
    .sort(
      (left, right) =>
        getTaskAttentionRank(left.task) - getTaskAttentionRank(right.task) ||
        left.index - right.index,
    )
    .map(({ task }) => task);

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
          const token = await getGoogleAuthToken({
            caller: 'popup.handleSlidesAnalysis',
          });
          if (token) {
            chrome.tabs.sendMessage(activeTab.id, {
              type: 'ANALYZE_SLIDES_PROJECTS',
              token,
            });
          } else {
            console.error('获取Google认证失败');
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
                        {card.nextBestAction}
                      </span>
                    </span>
                    <span className="today-pilot-due">
                      {formatTodayPilotDue(card)}
                    </span>
                  </button>
                  {isMeeting ? (
                    <div className="today-pilot-card-actions">
                      <button onClick={openRingCentralVideoHome}>
                        打开 Video Home
                      </button>
                      <button
                        onClick={() => void copyTodayPilotContextPack(card)}
                        disabled={copying}
                      >
                        {copying ? '复制中' : '复制 context pack'}
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </section>

      <details className="task-status-panel">
        <summary>
          <span>后台任务</span>
          <span className="task-summary">{taskStatusSummary}</span>
        </summary>
        <div className="task-status-toolbar">
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
        {taskSchedulerError && (
          <div className="task-status-error">{taskSchedulerError}</div>
        )}
        <div className="task-list">
          {!taskSchedulerError && taskSchedulerTasks.length === 0 && (
            <div className="task-empty-state">
              {isTaskStatusLoading ? '正在加载后台任务' : '暂无后台任务状态'}
            </div>
          )}
          {visibleTaskSchedulerTasks.map((task) => {
            const isBusy = Boolean(busyTaskIds[task.id]);
            const hasScheduleWarning = hasTaskScheduleWarning(task);
            const hasRecentSkip = hasTaskRecentSkip(task);
            const statusClass = task.isExecuting
              ? 'executing'
              : hasScheduleWarning
              ? 'warning'
              : hasRecentSkip
              ? 'skipped'
              : task.lastSuccess === false
              ? 'failed'
              : task.enabled && task.status === 'running'
              ? 'running'
              : 'stopped';
            const stateLabel = task.isExecuting
              ? '执行中'
              : hasScheduleWarning
              ? task.scheduleHealth === 'repair_failed'
                ? '修复失败'
                : '排程异常'
              : hasRecentSkip
              ? '跳过'
              : task.lastSuccess === false
              ? '失败'
              : task.enabled
              ? '启用'
              : '停用';
            const runHistorySummary = formatTaskRunHistorySummary(task);
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
                    {formatTaskSchedule(task)}
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
                  {runHistorySummary && (
                    <div
                      className="task-history"
                      title={formatTaskRunHistoryTitle(task)}
                    >
                      {runHistorySummary}
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
                  <button
                    className="task-run-btn"
                    onClick={() => void runTaskNow(task)}
                    disabled={isBusy || task.isExecuting}
                    title={
                      isBusy || task.isExecuting
                        ? '正在执行'
                        : task.enabled
                        ? '立即执行'
                        : '手动执行一次，不启用排程'
                    }
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
      )}

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
                    border-bottom: 1px solid #eeeeee;
                    margin-bottom: 4px;
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
                    min-height: 56px;
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
                .today-pilot-card-sub {
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
                .today-pilot-due {
                    color: #64748b;
                    font-size: 11px;
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
                    border: 1px solid #d4d4d8;
                    border-radius: 4px;
                    background: #f8fafc;
                    color: #334155;
                    font-size: 11px;
                    font-weight: 600;
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
                    justify-content: flex-end;
                    height: 28px;
                    align-items: center;
                }

                .task-refresh-btn,
                .task-repair-btn,
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
                .task-run-btn:hover {
                    background: #f4f4f5;
                }

                .task-refresh-btn:disabled,
                .task-repair-btn:disabled,
                .task-run-btn:disabled {
                    cursor: wait;
                    opacity: 0.55;
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

                .task-row {
                    min-height: 70px;
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

                .task-history {
                    margin-top: 2px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: #71717a;
                    font-size: 10px;
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
