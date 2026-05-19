import assert from 'node:assert/strict';

import {
  countTasksByStatusFilter,
  getTaskAttentionRank,
  getTaskFailureStreak,
  getTaskPrimaryAttentionRank,
  getTaskStatusKind,
  hasTaskRecentSkip,
  hasTaskScheduleWarning,
  shouldRecommendTaskPause,
  taskMatchesStatusFilter,
  taskNeedsAttention,
  type TaskSchedulerStatusFilterTask,
} from '../src/services/taskSchedulerStatusFilters';

const now = Date.now();

const running: TaskSchedulerStatusFilterTask = {
  enabled: true,
  scheduleHealth: 'scheduled',
  lastSuccess: true,
};
const executing: TaskSchedulerStatusFilterTask = {
  ...running,
  isExecuting: true,
};
const warning: TaskSchedulerStatusFilterTask = {
  ...running,
  scheduleHealth: 'overdue',
};
const skippedAfterFailure: TaskSchedulerStatusFilterTask = {
  ...running,
  lastSuccess: false,
  lastCompletedAt: now - 2_000,
  lastSkippedAt: now - 1_000,
};
const skippedAsLatestCompletedRun: TaskSchedulerStatusFilterTask = {
  ...running,
  lastSuccess: true,
  lastCompletedAt: now,
  lastSkippedAt: now,
  runHistory: [{ success: true, skipped: true }],
};
const failed: TaskSchedulerStatusFilterTask = {
  ...running,
  lastSuccess: false,
  lastCompletedAt: now - 1_000,
  runHistory: [
    { success: false },
    { success: false },
    { success: true },
  ],
};
const repeatedlyFailed: TaskSchedulerStatusFilterTask = {
  ...running,
  lastSuccess: false,
  lastCompletedAt: now - 1_000,
  runHistory: [
    { success: false },
    { success: false },
    { success: false },
  ],
};
const disabledWithWarningFlag: TaskSchedulerStatusFilterTask = {
  enabled: false,
  scheduleHealth: 'missing_alarm',
};

const tasks = [
  running,
  executing,
  warning,
  skippedAfterFailure,
  failed,
  disabledWithWarningFlag,
];

assert.equal(getTaskStatusKind(running), 'running');
assert.equal(getTaskStatusKind(executing), 'executing');
assert.equal(getTaskStatusKind(warning), 'warning');
assert.equal(
  getTaskStatusKind(skippedAfterFailure),
  'skipped',
  'a fresh skip should take precedence over an older failure',
);
assert.equal(
  getTaskStatusKind(skippedAsLatestCompletedRun),
  'skipped',
  'a skip that is itself the latest completed run should be classified as skipped',
);
assert.equal(getTaskStatusKind(failed), 'failed');
assert.equal(
  getTaskFailureStreak(failed),
  2,
  'failure streak should count consecutive failed completed runs from newest history',
);
assert.equal(
  shouldRecommendTaskPause(repeatedlyFailed),
  true,
  'three consecutive failures should offer a schedule pause action',
);
assert.equal(
  shouldRecommendTaskPause(failed),
  false,
  'two consecutive failures should still prefer retry guidance over pausing',
);
assert.equal(
  getTaskStatusKind(disabledWithWarningFlag),
  'disabled',
  'disabled tasks should not be classified as schedule warnings',
);

assert.equal(hasTaskScheduleWarning(warning), true);
assert.equal(hasTaskScheduleWarning(disabledWithWarningFlag), false);
assert.equal(hasTaskRecentSkip(skippedAfterFailure), true);
assert.equal(hasTaskRecentSkip(skippedAsLatestCompletedRun), true);
assert.equal(taskNeedsAttention(running), false);
assert.equal(taskNeedsAttention(failed), true);

assert.equal(countTasksByStatusFilter(tasks, 'all'), 6);
assert.equal(countTasksByStatusFilter(tasks, 'attention'), 4);
assert.equal(countTasksByStatusFilter(tasks, 'executing'), 1);
assert.equal(countTasksByStatusFilter(tasks, 'warning'), 1);
assert.equal(countTasksByStatusFilter(tasks, 'skipped'), 1);
assert.equal(countTasksByStatusFilter(tasks, 'failed'), 1);
assert.equal(countTasksByStatusFilter(tasks, 'disabled'), 1);

assert.equal(taskMatchesStatusFilter(skippedAfterFailure, 'failed'), false);
assert.equal(taskMatchesStatusFilter(skippedAfterFailure, 'skipped'), true);
assert.deepEqual(
  [executing, warning, failed, skippedAfterFailure, running, disabledWithWarningFlag]
    .map(getTaskAttentionRank),
  [0, 1, 2, 3, 4, 5],
  'attention rank should put failures before recent skips in the task list',
);
assert.deepEqual(
  [executing, warning, failed, skippedAfterFailure, running, disabledWithWarningFlag]
    .map(getTaskPrimaryAttentionRank),
  [0, 1, 2, 3, 4, 5],
  'primary attention rank should make failed tasks the next user action before recent skips',
);

console.log('✅ Task scheduler status filter verification passed');
