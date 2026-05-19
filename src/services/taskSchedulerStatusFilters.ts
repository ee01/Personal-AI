export type TaskSchedulerStatusFilter =
  | 'all'
  | 'attention'
  | 'executing'
  | 'warning'
  | 'skipped'
  | 'failed'
  | 'disabled';

export type TaskSchedulerStatusKind =
  | 'executing'
  | 'warning'
  | 'skipped'
  | 'failed'
  | 'running'
  | 'disabled';

export const TASK_FAILURE_PAUSE_SUGGESTION_STREAK = 3;

export interface TaskSchedulerStatusFilterTask {
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
  task: TaskSchedulerStatusFilterTask,
): boolean {
  return Boolean(
    task.enabled &&
      (task.scheduleHealth === 'missing_alarm' ||
        task.scheduleHealth === 'period_mismatch' ||
        task.scheduleHealth === 'overdue' ||
        task.scheduleHealth === 'repair_failed'),
  );
}

export function hasTaskRecentSkip(task: TaskSchedulerStatusFilterTask): boolean {
  return Boolean(
    task.lastSkippedAt &&
      (!task.lastCompletedAt || task.lastSkippedAt >= task.lastCompletedAt),
  );
}

export function getTaskFailureStreak(
  task: TaskSchedulerStatusFilterTask,
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
  task: TaskSchedulerStatusFilterTask,
): TaskSchedulerStatusKind {
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
  task: TaskSchedulerStatusFilterTask,
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
  task: TaskSchedulerStatusFilterTask,
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
  task: TaskSchedulerStatusFilterTask,
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
  task: TaskSchedulerStatusFilterTask,
  filter: TaskSchedulerStatusFilter,
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
  task: TaskSchedulerStatusFilterTask,
): boolean {
  return (
    task.enabled &&
    getTaskStatusKind(task) === 'failed' &&
    getTaskFailureStreak(task) >= TASK_FAILURE_PAUSE_SUGGESTION_STREAK
  );
}

export function countTasksByStatusFilter(
  tasks: TaskSchedulerStatusFilterTask[],
  filter: TaskSchedulerStatusFilter,
): number {
  return tasks.filter((task) => taskMatchesStatusFilter(task, filter)).length;
}
