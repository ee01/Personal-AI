export type BackgroundJobStatusFilter =
  | 'all'
  | 'attention'
  | 'executing'
  | 'warning'
  | 'skipped'
  | 'failed'
  | 'disabled';

export type BackgroundJobStatusKind =
  | 'executing'
  | 'warning'
  | 'skipped'
  | 'failed'
  | 'running'
  | 'disabled';

export const TASK_FAILURE_PAUSE_SUGGESTION_STREAK = 3;

export interface BackgroundJobStatusFilterTask {
  enabled: boolean;
  isExecuting?: boolean;
  lastCompletedAt?: number;
  lastSkippedAt?: number;
  lastSuccess?: boolean;
  runHistory?: Array<{
    success: boolean;
    skipped?: boolean;
  }>;
  scheduleHealth?:
    | 'scheduled'
    | 'missing_alarm'
    | 'period_mismatch'
    | 'overdue'
    | 'repair_failed'
    | 'disabled';
}

export function hasTaskScheduleWarning(
  task: BackgroundJobStatusFilterTask,
): boolean {
  return Boolean(
    task.enabled &&
      (task.scheduleHealth === 'missing_alarm' ||
        task.scheduleHealth === 'period_mismatch' ||
        task.scheduleHealth === 'overdue' ||
        task.scheduleHealth === 'repair_failed'),
  );
}

export function hasTaskRecentSkip(task: BackgroundJobStatusFilterTask): boolean {
  return Boolean(
    task.lastSkippedAt &&
      (!task.lastCompletedAt || task.lastSkippedAt >= task.lastCompletedAt),
  );
}

export function getTaskFailureStreak(
  task: BackgroundJobStatusFilterTask,
): number {
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

export function getTaskStatusKind(
  task: BackgroundJobStatusFilterTask,
): BackgroundJobStatusKind {
  if (task.isExecuting) {
    return 'executing';
  }
  if (hasTaskScheduleWarning(task)) {
    return 'warning';
  }
  if (hasTaskRecentSkip(task)) {
    return 'skipped';
  }
  if (task.lastSuccess === false) {
    return 'failed';
  }
  return task.enabled ? 'running' : 'disabled';
}

export function taskNeedsAttention(
  task: BackgroundJobStatusFilterTask,
): boolean {
  const statusKind = getTaskStatusKind(task);
  return (
    statusKind === 'executing' ||
    statusKind === 'warning' ||
    statusKind === 'skipped' ||
    statusKind === 'failed'
  );
}

export function getTaskAttentionRank(
  task: BackgroundJobStatusFilterTask,
): number {
  const statusKind = getTaskStatusKind(task);
  if (statusKind === 'executing') return 0;
  if (statusKind === 'warning') return 1;
  if (statusKind === 'failed') return 2;
  if (statusKind === 'skipped') return 3;
  if (statusKind === 'running') return 4;
  return 5;
}

export function getTaskPrimaryAttentionRank(
  task: BackgroundJobStatusFilterTask,
): number {
  const statusKind = getTaskStatusKind(task);
  if (statusKind === 'executing') return 0;
  if (statusKind === 'warning') return 1;
  if (statusKind === 'failed') return 2;
  if (statusKind === 'skipped') return 3;
  if (statusKind === 'running') return 4;
  return 5;
}

export function taskMatchesStatusFilter(
  task: BackgroundJobStatusFilterTask,
  filter: BackgroundJobStatusFilter,
): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'attention') {
    return taskNeedsAttention(task);
  }
  return getTaskStatusKind(task) === filter;
}

export function shouldRecommendTaskPause(
  task: BackgroundJobStatusFilterTask,
): boolean {
  return (
    task.enabled &&
    getTaskStatusKind(task) === 'failed' &&
    getTaskFailureStreak(task) >= TASK_FAILURE_PAUSE_SUGGESTION_STREAK
  );
}

export function countTasksByStatusFilter(
  tasks: BackgroundJobStatusFilterTask[],
  filter: BackgroundJobStatusFilter,
): number {
  return tasks.filter((task) => taskMatchesStatusFilter(task, filter)).length;
}

/** @deprecated Use BackgroundJobStatusFilter */
export type TaskSchedulerStatusFilter = BackgroundJobStatusFilter;
/** @deprecated Use BackgroundJobStatusKind */
export type TaskSchedulerStatusKind = BackgroundJobStatusKind;
/** @deprecated Use BackgroundJobStatusFilterTask */
export type TaskSchedulerStatusFilterTask = BackgroundJobStatusFilterTask;
