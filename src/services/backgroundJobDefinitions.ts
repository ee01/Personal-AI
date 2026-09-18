import { DIGEST_QUEUE_RELEASE_CHECK_INTERVAL_MINUTES } from './digestQueueConfig';

export interface BackgroundJobDefinition {
  id: string;
  name: string;
  category: 'message_analysis' | 'data_sync' | 'system_maintenance' | 'user_profile';
  intervalMinutes: number;
  description: string;
  enabled: boolean;
}

/** @deprecated Use BackgroundJobDefinition */
export type TaskSchedulerDefinition = BackgroundJobDefinition;

export const BACKGROUND_JOB_STATES_KEY = 'backgroundJobStates';
export const LEGACY_TASK_SCHEDULER_STATES_KEY = 'taskSchedulerStates';

export const BACKGROUND_JOB_ALARM_PREFIX = 'background_job_';
export const LEGACY_SCHEDULED_TASK_ALARM_PREFIX = 'scheduled_task_';

export const BACKGROUND_JOB_MESSAGE = {
  GET_STATUS: 'GET_BACKGROUND_JOBS_STATUS',
  CONTROL: 'CONTROL_BACKGROUND_JOB',
} as const;

export const LEGACY_BACKGROUND_JOB_MESSAGE = {
  GET_STATUS: 'GET_TASK_SCHEDULER_STATUS',
  CONTROL: 'CONTROL_TASK',
} as const;

export function isBackgroundJobStatusRequest(type: unknown): boolean {
  return (
    type === BACKGROUND_JOB_MESSAGE.GET_STATUS ||
    type === LEGACY_BACKGROUND_JOB_MESSAGE.GET_STATUS
  );
}

export function isBackgroundJobControlRequest(type: unknown): boolean {
  return (
    type === BACKGROUND_JOB_MESSAGE.CONTROL ||
    type === LEGACY_BACKGROUND_JOB_MESSAGE.CONTROL
  );
}

export function isBackgroundJobAlarmName(name: string): boolean {
  return (
    name.startsWith(BACKGROUND_JOB_ALARM_PREFIX) ||
    name.startsWith(LEGACY_SCHEDULED_TASK_ALARM_PREFIX)
  );
}

export function jobIdFromAlarmName(name: string): string {
  if (name.startsWith(BACKGROUND_JOB_ALARM_PREFIX)) {
    return name.slice(BACKGROUND_JOB_ALARM_PREFIX.length);
  }
  if (name.startsWith(LEGACY_SCHEDULED_TASK_ALARM_PREFIX)) {
    return name.slice(LEGACY_SCHEDULED_TASK_ALARM_PREFIX.length);
  }
  return name;
}

export function backgroundJobAlarmName(jobId: string): string {
  return `${BACKGROUND_JOB_ALARM_PREFIX}${jobId}`;
}

export function legacyScheduledTaskAlarmName(jobId: string): string {
  return `${LEGACY_SCHEDULED_TASK_ALARM_PREFIX}${jobId}`;
}

export const BACKGROUND_JOB_DEFINITIONS: BackgroundJobDefinition[] = [
  {
    id: 'message_analysis',
    name: '静默消息分析',
    category: 'message_analysis',
    intervalMinutes: 30, // 默认30分钟间隔（实际值从 envConfig.MESSAGE_ANALYSIS_INTERVAL 读取）
    description: '自动分析RingCentral消息，提取关键信息',
    enabled: false
  },
  {
    id: 'memory_sync',
    name: '记忆系统同步',
    category: 'data_sync',
    intervalMinutes: 5, // 5分钟间隔
    description: '同步本地和云端记忆数据',
    enabled: true
  },
  {
    id: 'system_monitoring',
    name: '系统健康监控',
    category: 'system_maintenance',
    intervalMinutes: 60, // 1小时间隔
    description: '执行系统健康检查和自动维护',
    enabled: true
  },
  {
    id: 'user_profile_decay',
    name: '用户画像权重衰变',
    category: 'user_profile',
    intervalMinutes: 1440, // 24小时间隔
    description: '执行用户画像权重的自然衰变',
    enabled: true
  },
  {
    id: 'vectorized_data_maintenance',
    name: '向量化数据维护',
    category: 'user_profile',
    intervalMinutes: 720, // 12小时间隔
    description: '清理过期向量记录，更新嵌入向量，生成用户概要',
    enabled: true
  },
  {
    id: 'user_summary_generation',
    name: '用户概要生成',
    category: 'user_profile',
    intervalMinutes: 10080, // 7天间隔
    description: '定期生成和更新用户行为概要记录',
    enabled: true
  },
  {
    id: 'vector_quality_check',
    name: '向量质量检查',
    category: 'system_maintenance',
    intervalMinutes: 4320, // 3天间隔
    description: '检查向量数据质量，修复异常记录',
    enabled: true
  },
  {
    id: 'digest_queue_process',
    name: '汇总推送队列处理',
    category: 'data_sync',
    intervalMinutes: DIGEST_QUEUE_RELEASE_CHECK_INTERVAL_MINUTES,
    description: '检查并处理到期的汇总推送任务（关注后续合并通知、每日摘要等）',
    enabled: true
  }
];

/** @deprecated Use BACKGROUND_JOB_DEFINITIONS */
export const TASK_DEFINITIONS = BACKGROUND_JOB_DEFINITIONS;

export function getJobDefaultEnabled(jobId: string): boolean {
  return BACKGROUND_JOB_DEFINITIONS.find((job) => job.id === jobId)?.enabled ?? false;
}

/** @deprecated Use getJobDefaultEnabled */
export function getTaskDefaultEnabled(taskId: string): boolean {
  return getJobDefaultEnabled(taskId);
}

type BackgroundJobStorageState = {
  enabled?: boolean;
};

function hasBackgroundJobStorageState(
  backgroundJobStates: unknown,
  jobId: string,
): boolean {
  return Boolean(
    backgroundJobStates &&
      typeof backgroundJobStates === 'object' &&
      Object.prototype.hasOwnProperty.call(backgroundJobStates, jobId),
  );
}

export function resolveJobEnabledFromStates(
  jobId: string,
  backgroundJobStates: unknown,
): boolean {
  const defaultEnabled = getJobDefaultEnabled(jobId);
  if (!backgroundJobStates || typeof backgroundJobStates !== 'object') {
    return defaultEnabled;
  }

  const savedState = (
    backgroundJobStates as Record<string, BackgroundJobStorageState | undefined>
  )[jobId];
  if (!savedState || typeof savedState !== 'object') {
    return defaultEnabled;
  }

  return savedState.enabled ?? defaultEnabled;
}

/** @deprecated Use resolveJobEnabledFromStates */
export function resolveTaskEnabledFromSchedulerStates(
  taskId: string,
  taskSchedulerStates: unknown,
): boolean {
  return resolveJobEnabledFromStates(taskId, taskSchedulerStates);
}

export async function readBackgroundJobStates(): Promise<unknown> {
  const stored = await chrome.storage.local.get([
    BACKGROUND_JOB_STATES_KEY,
    LEGACY_TASK_SCHEDULER_STATES_KEY,
  ]);
  return stored[BACKGROUND_JOB_STATES_KEY] ?? stored[LEGACY_TASK_SCHEDULER_STATES_KEY];
}

export async function writeBackgroundJobStates(states: unknown): Promise<void> {
  await chrome.storage.local.set({ [BACKGROUND_JOB_STATES_KEY]: states });
  await chrome.storage.local.remove(LEGACY_TASK_SCHEDULER_STATES_KEY);
}

/**
 * 辅助函数: 获取指定后台作业的启用状态
 * 用于替代旧的 scheduleActive 存储
 */
export async function getTaskEnabled(taskId: string): Promise<boolean> {
  try {
    const states = await readBackgroundJobStates();
    return resolveJobEnabledFromStates(taskId, states);
  } catch (error) {
    console.error(`获取后台作业 ${taskId} 状态失败:`, error);
    return false;
  }
}

export const getBackgroundJobEnabled = getTaskEnabled;

/**
 * 辅助函数: 监听指定后台作业的启用状态变化
 */
export function onTaskEnabledChanged(
  taskId: string,
  callback: (enabled: boolean) => void
): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
    if (namespace !== 'local') return;
    const change =
      changes[BACKGROUND_JOB_STATES_KEY] || changes[LEGACY_TASK_SCHEDULER_STATES_KEY];
    if (!change) return;
    const newStates = change.newValue;
    const oldStates = change.oldValue;
    if (
      hasBackgroundJobStorageState(newStates, taskId) ||
      hasBackgroundJobStorageState(oldStates, taskId) ||
      !newStates
    ) {
      callback(resolveJobEnabledFromStates(taskId, newStates));
    }
  };

  chrome.storage.onChanged.addListener(listener);

  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

export const onBackgroundJobEnabledChanged = onTaskEnabledChanged;
