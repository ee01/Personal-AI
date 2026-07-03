import assert from 'node:assert/strict';

type StorageMap = Record<string, any>;
type AlarmMap = Record<string, chrome.alarms.Alarm>;

const storage: StorageMap = {
  envConfig: {
    MEMORY_SERVICE_BASE_URL: 'http://mock-memory/api/v1',
    MESSAGE_ANALYSIS_INTERVAL: 30,
  },
  userinfo: {
    username: 'verify.user',
    fullName: 'Verify User',
  },
  taskSchedulerStates: {
    message_analysis: { enabled: false },
    memory_sync: { enabled: false },
    system_monitoring: { enabled: true },
    user_profile_decay: { enabled: false },
    vectorized_data_maintenance: { lastRun: 123 },
    user_summary_generation: { enabled: false },
    vector_quality_check: { enabled: false },
    digest_queue_process: { enabled: false },
  },
};

const alarms: AlarmMap = {};
const alarmCreateInfos: Record<string, chrome.alarms.AlarmCreateInfo> = {};
const storageListeners: Array<
  (
    changes: Record<string, chrome.storage.StorageChange>,
    namespace: string,
  ) => void
> = [];
let nextAlarmCreateError: string | null = null;
let rejectPersistAcrossSessionsOnce = false;

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function buildStorageChange(
  oldValue: unknown,
  newValue: unknown,
): chrome.storage.StorageChange {
  return {
    oldValue: clone(oldValue),
    newValue: clone(newValue),
  };
}

(globalThis as any).chrome = {
  storage: {
    local: {
      async get(
        keys?: string | string[] | Record<string, any>,
        callback?: (result: Record<string, any>) => void,
      ) {
        await Promise.resolve();
        let result: Record<string, any>;
        if (!keys) {
          result = clone(storage);
        } else if (typeof keys === 'string') {
          result = { [keys]: clone(storage[keys]) };
        } else if (Array.isArray(keys)) {
          result = keys.reduce<Record<string, any>>((acc, key) => {
            acc[key] = clone(storage[key]);
            return acc;
          }, {});
        } else {
          result = Object.keys(keys).reduce<Record<string, any>>((acc, key) => {
            acc[key] = clone(storage[key] ?? keys[key]);
            return acc;
          }, {});
        }
        callback?.(result);
        return result;
      },
      async set(items: Record<string, any>) {
        const changes = Object.keys(items).reduce<
          Record<string, chrome.storage.StorageChange>
        >((acc, key) => {
          acc[key] = buildStorageChange(storage[key], items[key]);
          return acc;
        }, {});

        Object.assign(storage, clone(items));
        for (const listener of storageListeners) {
          listener(changes, 'local');
        }
      },
    },
    onChanged: {
      addListener(listener: (typeof storageListeners)[number]) {
        storageListeners.push(listener);
      },
      removeListener(listener: (typeof storageListeners)[number]) {
        const index = storageListeners.indexOf(listener);
        if (index >= 0) {
          storageListeners.splice(index, 1);
        }
      },
    },
  },
  alarms: {
    create(
      name: string,
      info: chrome.alarms.AlarmCreateInfo,
      callback?: () => void,
    ) {
      if (rejectPersistAcrossSessionsOnce && info.persistAcrossSessions) {
        rejectPersistAcrossSessionsOnce = false;
        (globalThis as any).chrome.runtime.lastError = {
          message: "Unexpected property: 'persistAcrossSessions'",
        };
        callback?.();
        delete (globalThis as any).chrome.runtime.lastError;
        return;
      }

      if (nextAlarmCreateError) {
        const error = nextAlarmCreateError;
        nextAlarmCreateError = null;
        (globalThis as any).chrome.runtime.lastError = { message: error };
        callback?.();
        delete (globalThis as any).chrome.runtime.lastError;
        return;
      }

      const periodInMinutes = info.periodInMinutes;
      alarms[name] = {
        name,
        scheduledTime:
          info.when ??
          Date.now() + (info.delayInMinutes ?? periodInMinutes ?? 1) * 60_000,
        periodInMinutes,
      };
      alarmCreateInfos[name] = clone(info);
      callback?.();
    },
    get(name: string, callback: (alarm?: chrome.alarms.Alarm) => void) {
      callback(alarms[name]);
    },
    clear(name: string, callback: (wasCleared: boolean) => void) {
      const wasCleared = Boolean(alarms[name]);
      delete alarms[name];
      delete alarmCreateInfos[name];
      callback(wasCleared);
    },
    getAll(callback: (items: chrome.alarms.Alarm[]) => void) {
      callback(Object.values(alarms));
    },
  },
  runtime: {
    getURL(path: string) {
      return `chrome-extension://verify/${path}`;
    },
  },
  notifications: {
    async create() {
      return 'notification-id';
    },
    async clear() {
      return true;
    },
  },
};

let fetchMode: 'success' | 'failure' | 'pending' = 'success';
let releasePendingFetch: (() => void) | null = null;

async function waitForPendingFetch(): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    if (releasePendingFetch) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for pending fetch to start');
}

(globalThis as any).fetch = async () => {
  if (fetchMode === 'pending') {
    await new Promise<void>((resolve) => {
      releasePendingFetch = resolve;
    });
  }

  if (fetchMode === 'failure') {
    return new Response(
      JSON.stringify({ error: 'memory service unavailable' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  return new Response(
    JSON.stringify({
      status: 'ok',
      database: {
        connected: true,
        messageCount: 10,
        entityCount: 2,
        chunkCount: 4,
      },
      embedding: {
        loaded: true,
        model: 'mock-model',
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
};

const { getTaskEnabled, onTaskEnabledChanged } = await import(
  '../src/services/taskSchedulerDefinitions.ts'
);
const { concernedItemsSyncService } = await import(
  '../src/services/ConcernedItemsSyncService.ts'
);
const {
  TaskScheduler,
  taskScheduler,
  summarizeMessageAnalysisTaskRun,
} = await import('../src/services/TaskScheduler.ts');
const {
  CONCERNED_ITEMS_DIGEST_TASK_ID,
  digestQueueService,
  registerConcernedItemsDigestTaskWithHour,
} = await import('../src/services/DigestQueueService.ts');
const { notificationService } = await import(
  '../src/services/NotificationService.ts'
);

const partialMessageAnalysisResult = summarizeMessageAnalysisTaskRun(4, {
  success: true,
  deliveryReceipt: {
    version: 1,
    status: 'partial',
    runMode: 'filter',
    source: 'scheduled',
    startedAt: Date.now() - 15_000,
    capturedAt: Date.now(),
    counters: {
      groupsAnalyzed: 2,
      analyzedMessages: 4,
      scopeRejected: 1,
      memoryWriteRequests: 3,
      memoryWritesAccepted: 2,
      memoryDuplicateSkips: 0,
      memoryWriteFailures: 1,
      immediateNotificationAttempts: 1,
      immediateNotificationFailures: 0,
      digestQueueEntries: 1,
      autoReplyHandled: 0,
      autoReplySkipped: 0,
      followThreadUpdates: 0,
      followThreadFailures: 0,
      automationPlanRequests: 1,
      automationActionsCreated: 0,
      automationPlanSkipped: 0,
      automationPlanFailures: 1,
      automationPlanPaused: 0,
    },
    notes: [],
  },
});
assert.equal(
  partialMessageAnalysisResult.success,
  false,
  'message analysis downstream partials should not flatten into scheduler success',
);
assert.match(
  partialMessageAnalysisResult.error || '',
  /下游失败 2/,
  'partial scheduler result should expose the downstream failure count',
);
assert.match(
  partialMessageAnalysisResult.summary || '',
  /记忆写入失败 1/,
  'partial scheduler result should include a failure breakdown',
);
assert.match(
  partialMessageAnalysisResult.summary || '',
  /联动规划失败 1/,
  'partial scheduler result should include automation planning failures',
);

assert.equal(
  await getTaskEnabled('vectorized_data_maintenance'),
  true,
  'getTaskEnabled should fall back to task defaults when a saved state lacks enabled',
);

let observedDefaultEnabled: boolean | undefined;
const unsubscribe = onTaskEnabledChanged(
  'vectorized_data_maintenance',
  (enabled) => {
    observedDefaultEnabled = enabled;
  },
);
await chrome.storage.local.set({
  taskSchedulerStates: {
    ...storage.taskSchedulerStates,
    vectorized_data_maintenance: { lastRun: 456 },
  },
});
unsubscribe();
assert.equal(
  observedDefaultEnabled,
  true,
  'onTaskEnabledChanged should fall back to task defaults when a saved state lacks enabled',
);

await chrome.storage.local.set({
  taskSchedulerStates: {
    ...storage.taskSchedulerStates,
    vectorized_data_maintenance: { enabled: false },
  },
});
let observedRemovedEnabled: boolean | undefined;
const unsubscribeRemoved = onTaskEnabledChanged(
  'vectorized_data_maintenance',
  (enabled) => {
    observedRemovedEnabled = enabled;
  },
);
const {
  vectorized_data_maintenance: _removedVectorizedDataMaintenance,
  ...taskStatesWithoutVectorMaintenance
} = storage.taskSchedulerStates;
await chrome.storage.local.set({
  taskSchedulerStates: taskStatesWithoutVectorMaintenance,
});
unsubscribeRemoved();
assert.equal(
  observedRemovedEnabled,
  true,
  'onTaskEnabledChanged should fall back to task defaults when a saved state row is removed',
);

await chrome.storage.local.set({
  taskSchedulerStates: {
    ...storage.taskSchedulerStates,
    message_analysis: { enabled: true },
  },
});
let observedClearedEnabled: boolean | undefined;
const unsubscribeCleared = onTaskEnabledChanged(
  'message_analysis',
  (enabled) => {
    observedClearedEnabled = enabled;
  },
);
await chrome.storage.local.set({ taskSchedulerStates: {} });
unsubscribeCleared();
assert.equal(
  observedClearedEnabled,
  false,
  'onTaskEnabledChanged should fall back to task defaults when scheduler state storage is cleared',
);

await chrome.storage.local.set({
  taskSchedulerStates: {
    message_analysis: { enabled: false },
    memory_sync: { enabled: false },
    system_monitoring: { enabled: true },
    user_profile_decay: { enabled: false },
    vectorized_data_maintenance: { lastRun: 456 },
    user_summary_generation: { enabled: false },
    vector_quality_check: { enabled: false },
    digest_queue_process: { enabled: false },
  },
});

alarms.scheduled_task_removed_before_start = {
  name: 'scheduled_task_removed_before_start',
  scheduledTime: Date.now() + 10_000,
  periodInMinutes: 5,
};

await taskScheduler.startAllTasks();

let status = taskScheduler.getTaskStatus();

const scheduledSystemMonitoringAlarm =
  alarms.scheduled_task_system_monitoring?.scheduledTime;
assert.ok(
  scheduledSystemMonitoringAlarm,
  'enabled tasks should create a Chrome alarm on scheduler startup',
);
assert.equal(
  alarmCreateInfos.scheduled_task_system_monitoring?.persistAcrossSessions,
  true,
  'scheduled task alarms should explicitly persist across browser sessions',
);
assert.equal(
  alarms.scheduled_task_removed_before_start,
  undefined,
  'scheduler startup should clear orphaned scheduled_task alarms from old task definitions',
);

alarms.scheduled_task_removed_later = {
  name: 'scheduled_task_removed_later',
  scheduledTime: Date.now() + 10_000,
  periodInMinutes: 5,
};
status = await taskScheduler.getTaskStatusFresh();
assert.equal(
  alarms.scheduled_task_removed_later,
  undefined,
  'status refresh should clear orphaned scheduled_task alarms that no longer map to a task definition',
);

alarms.scheduled_task_removed_when_fired = {
  name: 'scheduled_task_removed_when_fired',
  scheduledTime: Date.now() + 10_000,
  periodInMinutes: 5,
};
const handledOrphanAlarm = await TaskScheduler.tryHandleAlarm({
  name: 'scheduled_task_removed_when_fired',
  scheduledTime: Date.now(),
  periodInMinutes: 5,
});
assert.equal(
  handledOrphanAlarm,
  true,
  'TaskScheduler should claim scheduled_task alarms even when their task definition was removed',
);
assert.equal(
  alarms.scheduled_task_removed_when_fired,
  undefined,
  'unknown scheduled_task alarms should be cleared when they fire',
);

const enabledProfileDecay = await taskScheduler.toggleTask(
  'user_profile_decay',
  true,
);
assert.equal(enabledProfileDecay, true);
assert.ok(
  alarms.scheduled_task_user_profile_decay,
  'enabling a task should create its Chrome alarm',
);
await new Promise((resolve) => setTimeout(resolve, 0));
status = taskScheduler.getTaskStatus();
const userProfileDecay = status.find(
  (task) => task.id === 'user_profile_decay',
);
assert.equal(
  userProfileDecay?.lastRun,
  undefined,
  'enabling a task should not implicitly run it; users can use the explicit run action',
);

let memorySyncStartupCalls = 0;
(concernedItemsSyncService as any).syncOnStartup = async () => {
  memorySyncStartupCalls += 1;
};
const enabledMemorySync = await taskScheduler.toggleTask('memory_sync', true);
assert.equal(enabledMemorySync, true);
assert.ok(
  alarms.scheduled_task_memory_sync,
  'enabling memory_sync should create its Chrome alarm',
);
assert.equal(
  memorySyncStartupCalls,
  0,
  'enabling memory_sync should not perform an immediate startup sync',
);

let periodicMemorySyncCalls = 0;
(concernedItemsSyncService as any).runPeriodicSync = async () => {
  periodicMemorySyncCalls += 1;
};
await taskScheduler.toggleTask('memory_sync', false);
const disabledMemorySyncManualRun =
  await taskScheduler.runTaskManuallyWithResult('memory_sync');
assert.equal(
  disabledMemorySyncManualRun.success,
  true,
  'manual runs should still execute memory_sync once even when its schedule is disabled',
);
assert.equal(
  periodicMemorySyncCalls,
  1,
  'manual memory_sync should call the periodic sync implementation while disabled',
);

nextAlarmCreateError = 'maximum number of alarms reached';
await assert.rejects(
  () => taskScheduler.toggleTask('vector_quality_check', true),
  /maximum number of alarms reached/,
  'alarm creation failures should be surfaced to callers',
);
status = taskScheduler.getTaskStatus();
const vectorQualityCheck = status.find(
  (task) => task.id === 'vector_quality_check',
);
assert.equal(
  vectorQualityCheck?.enabled,
  false,
  'alarm creation failures should roll back the in-memory enabled state',
);
assert.equal(
  storage.taskSchedulerStates.vector_quality_check.enabled,
  false,
  'alarm creation failures should persist the rolled-back enabled state',
);
assert.equal(
  alarms.scheduled_task_vector_quality_check,
  undefined,
  'alarm creation failures should not leave a partial alarm behind',
);

fetchMode = 'pending';
const pendingRun = taskScheduler.runTaskManuallyWithResult('system_monitoring');
await Promise.resolve();

status = taskScheduler.getTaskStatus();
let systemMonitoring = status.find((task) => task.id === 'system_monitoring');
assert.equal(
  systemMonitoring?.isExecuting,
  true,
  'manual task run should expose an executing state while in flight',
);
assert.equal(
  systemMonitoring?.statusReceipt.state,
  'executing',
  'manual task run should expose an executing status receipt while in flight',
);
assert.match(
  systemMonitoring?.statusReceipt.nextAction || '',
  /等待完成/,
  'executing status receipt should explain the next safe action',
);
assert.equal(
  systemMonitoring?.nextRun,
  scheduledSystemMonitoringAlarm,
  'manual runs should preserve the real scheduled alarm time while executing',
);

const duplicateRun = await taskScheduler.runTaskManuallyWithResult(
  'system_monitoring',
);
assert.equal(duplicateRun.success, false);
assert.equal(duplicateRun.skipped, true);
status = taskScheduler.getTaskStatus();
systemMonitoring = status.find((task) => task.id === 'system_monitoring');
assert.ok(
  systemMonitoring?.lastSkippedAt,
  'duplicate task triggers should persist the skipped timestamp',
);
assert.match(
  systemMonitoring?.lastSkipReason || '',
  /正在执行，跳过重复触发/,
  'duplicate task triggers should keep a user-visible skip reason',
);
assert.equal(
  systemMonitoring?.runHistory?.[0]?.skipped,
  true,
  'duplicate task triggers should be recorded in recent run history',
);
assert.equal(
  storage.taskSchedulerStates.system_monitoring.runHistory[0].skipped,
  true,
  'skipped run history should be persisted to chrome.storage.local',
);
assert.equal(
  systemMonitoring?.statusReceipt.state,
  'executing',
  'duplicate task triggers should keep the primary receipt in executing state while the original run is still active',
);
assert.match(
  systemMonitoring?.statusReceipt.nextAction || '',
  /等待完成/,
  'duplicate task trigger receipt should still guide users to wait for the active run',
);

await waitForPendingFetch();
releasePendingFetch?.();
assert.equal((await pendingRun).success, true);

status = taskScheduler.getTaskStatus();
systemMonitoring = status.find((task) => task.id === 'system_monitoring');
assert.equal(systemMonitoring?.isExecuting, false);
assert.equal(systemMonitoring?.lastSuccess, true);
assert.ok(systemMonitoring?.lastCompletedAt);
assert.equal(systemMonitoring?.lastError, undefined);
assert.equal(
  systemMonitoring?.runHistory?.[0]?.success,
  true,
  'successful task runs should be recorded in recent run history',
);
assert.equal(
  systemMonitoring?.runHistory?.[0]?.trigger,
  'manual',
  'manual task runs should record their trigger source',
);
assert.equal(
  systemMonitoring?.runHistory?.[1]?.skipped,
  true,
  'recent run history should keep the duplicate skip after the completed run',
);
assert.equal(
  systemMonitoring?.nextRun,
  scheduledSystemMonitoringAlarm,
  'manual runs should not drift the next scheduled run time',
);

fetchMode = 'failure';
const failed = await taskScheduler.runTaskManuallyWithResult(
  'system_monitoring',
);
assert.equal(
  failed.success,
  false,
  'manual task run should report execution failure',
);
assert.match(
  failed.error || '',
  /memory service unavailable/,
  'manual task result should include the real failure reason',
);

status = taskScheduler.getTaskStatus();
systemMonitoring = status.find((task) => task.id === 'system_monitoring');
assert.equal(systemMonitoring?.lastSuccess, false);
assert.match(
  systemMonitoring?.lastError || '',
  /memory service unavailable/,
  'lastError should persist the real task failure',
);
assert.equal(
  systemMonitoring?.runHistory?.[0]?.success,
  false,
  'failed task runs should be recorded as the newest history entry',
);
assert.match(
  systemMonitoring?.runHistory?.[0]?.error || '',
  /memory service unavailable/,
  'failed run history should retain the task failure reason',
);
assert.equal(
  systemMonitoring?.runHistory?.[1]?.success,
  true,
  'recent run history should keep the previous successful run',
);
assert.equal(
  storage.taskSchedulerStates.system_monitoring.lastSuccess,
  false,
  'failure state should be persisted to chrome.storage.local',
);
assert.equal(
  storage.taskSchedulerStates.system_monitoring.runHistory[0].success,
  false,
  'recent run history should be persisted to chrome.storage.local',
);
assert.equal(
  systemMonitoring?.statusReceipt.state,
  'failed',
  'failed task status should expose a structured failed receipt',
);
assert.match(
  systemMonitoring?.statusReceipt.label || '',
  /上次失败/,
  'failed task receipt should label the lifecycle state',
);
assert.match(
  systemMonitoring?.statusReceipt.nextAction || '',
  /重试一次/,
  'failed task receipt should suggest a bounded retry path',
);

const originalSendNotification =
  notificationService.sendNotification.bind(notificationService);
(notificationService as any).sendNotification = async () => ({
  success: false,
  results: [{ method: 'bot', success: false, error: 'bot route unavailable' }],
});
registerConcernedItemsDigestTaskWithHour(8);
storage.digestTaskStates = {};
storage.digestQueues = {
  [CONCERNED_ITEMS_DIGEST_TASK_ID]: {
    taskId: CONCERNED_ITEMS_DIGEST_TASK_ID,
    items: [
      {
        id: 'retained-digest-item',
        createdAt: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
        sourceId: 'rule-retained',
        data: {
          ruleId: 'rule-retained',
          matchedRule: 'Retained digest',
          sender: 'Alice',
          teamName: 'Release',
          messageContent: 'Digest should stay queued after failure',
          summary: 'Digest should stay queued after failure',
          datetime: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
          digestConfig: {
            enabled: true,
            frequency: 'daily',
            preferredHour: 8,
          },
        },
      },
    ],
  },
};
try {
  digestQueueService.updateTask(CONCERNED_ITEMS_DIGEST_TASK_ID, {
    enabled: true,
    frequency: { type: 'custom', intervalMinutes: 0 },
    lastExecutedAt: new Date(0).toISOString(),
  });
  const failedDigestRun = await taskScheduler.runTaskManuallyWithResult(
    'digest_queue_process',
  );
  assert.equal(
    failedDigestRun.success,
    false,
    'digest queue failures should report a failed task run',
  );
  assert.match(
    failedDigestRun.summary || '',
    /队列已保留 1 条/,
    'manual digest failure result should keep the queue-retained summary',
  );
  status = taskScheduler.getTaskStatus();
  const digestTaskStatus = status.find(
    (task) => task.id === 'digest_queue_process',
  );
  assert.match(
    digestTaskStatus?.lastResultSummary || '',
    /队列已保留 1 条/,
    'failed digest queue runs should persist the recovery summary',
  );
  assert.match(
    digestTaskStatus?.runHistory?.[0]?.summary || '',
    /队列已保留 1 条/,
    'failed digest queue run history should retain the recovery summary',
  );
  assert.match(
    storage.taskSchedulerStates.digest_queue_process.lastResultSummary || '',
    /队列已保留 1 条/,
    'failed digest queue recovery summary should be saved to chrome.storage.local',
  );
} finally {
  (notificationService as any).sendNotification = originalSendNotification;
}

const originalGetDigestQueueStatusSummary = (digestQueueService as any)
  .getQueueStatusSummary;
(digestQueueService as any).getQueueStatusSummary = async () => {
  throw new Error('digest queue index unavailable');
};
try {
  const queueStatusUnavailableResult =
    await taskScheduler.getTaskStatusFreshResult({
      repairAlarms: false,
      persist: false,
    });
  const digestTaskStatus = queueStatusUnavailableResult.tasks.find(
    (task) => task.id === 'digest_queue_process',
  );
  assert.equal(
    queueStatusUnavailableResult.refreshReceipt.queueStatusUnavailableCount,
    1,
    'refresh receipt should count digest queue status read failures separately from alarm repair failures',
  );
  assert.match(
    digestTaskStatus?.currentQueueStatusError || '',
    /digest queue index unavailable/,
    'digest queue status read failures should be exposed on the task row',
  );
  assert.match(
    digestTaskStatus?.currentQueueSummary || '',
    /本地摘要队列状态未确认/,
    'digest queue status read failures should leave a visible queue-status receipt',
  );
  assert.match(
    digestTaskStatus?.currentQueueSummary || '',
    /没有立即发送摘要、不写入 Memory Service、不确认通知/,
    'digest queue unavailable receipt should preserve the no-send/no-write/no-confirm boundary',
  );
} finally {
  (digestQueueService as any).getQueueStatusSummary =
    originalGetDigestQueueStatusSummary;
}

for (let i = 0; i < 6; i += 1) {
  const result = await taskScheduler.runTaskManuallyWithResult(
    'user_profile_decay',
  );
  assert.equal(result.success, true);
}
status = taskScheduler.getTaskStatus();
const profileDecayHistory = status.find(
  (task) => task.id === 'user_profile_decay',
)?.runHistory;
assert.equal(
  profileDecayHistory?.length,
  5,
  'recent run history should be capped to the latest five runs',
);

delete alarms.scheduled_task_system_monitoring;
const missingAlarmStatusResult = await taskScheduler.getTaskStatusFreshResult({
  repairAlarms: false,
  persist: false,
});
status = missingAlarmStatusResult.tasks;
assert.equal(
  missingAlarmStatusResult.refreshReceipt.autoRepairAttempted,
  false,
  'status refresh receipt should say when automatic alarm repair was not attempted',
);
assert.equal(
  missingAlarmStatusResult.refreshReceipt.scheduleAttentionCount,
  1,
  'status refresh receipt should count schedule-attention tasks',
);
systemMonitoring = status.find((task) => task.id === 'system_monitoring');
assert.equal(
  systemMonitoring?.scheduleHealth,
  'missing_alarm',
  'fresh status should report enabled tasks whose Chrome alarm disappeared',
);
assert.equal(
  systemMonitoring?.nextRun,
  undefined,
  'missing alarms should not expose a stale nextRun value',
);
assert.equal(
  systemMonitoring?.statusReceipt.state,
  'schedule_attention',
  'missing alarms should expose a schedule-attention status receipt',
);
assert.match(
  systemMonitoring?.statusReceipt.nextAction || '',
  /重排 Chrome alarm/,
  'missing alarm status receipt should point to the repair action',
);

nextAlarmCreateError = 'maximum number of alarms reached';
const failedRepairStatusResult = await taskScheduler.getTaskStatusFreshResult();
status = failedRepairStatusResult.tasks;
assert.equal(
  failedRepairStatusResult.refreshReceipt.autoRepairAttempted,
  true,
  'status refresh receipt should say automatic alarm repair was attempted by default',
);
assert.equal(
  failedRepairStatusResult.refreshReceipt.failedRepairs,
  1,
  'status refresh receipt should count failed automatic repairs',
);
assert.equal(
  failedRepairStatusResult.refreshReceipt.createdAlarms,
  0,
  'failed automatic repair should not be counted as a created alarm',
);
systemMonitoring = status.find((task) => task.id === 'system_monitoring');
assert.equal(
  systemMonitoring?.scheduleHealth,
  'repair_failed',
  'status refresh should keep returning task status when automatic alarm repair fails',
);
assert.match(
  systemMonitoring?.scheduleWarning || '',
  /maximum number of alarms reached/,
  'automatic alarm repair failures should surface the Chrome error reason',
);
assert.equal(
  alarms.scheduled_task_system_monitoring,
  undefined,
  'failed automatic alarm repair should not leave a partial alarm behind',
);
assert.match(
  systemMonitoring?.statusReceipt.detail || '',
  /maximum number of alarms reached/,
  'repair-failed status receipt should preserve the real Chrome alarm error',
);

const repairedMissingAlarmStatusResult =
  await taskScheduler.getTaskStatusFreshResult();
status = repairedMissingAlarmStatusResult.tasks;
assert.equal(
  repairedMissingAlarmStatusResult.refreshReceipt.createdAlarms,
  1,
  'status refresh receipt should count a recreated missing Chrome alarm',
);
assert.equal(
  repairedMissingAlarmStatusResult.refreshReceipt.failedRepairs,
  0,
  'successful alarm recreation should clear failed repair count for this refresh',
);
systemMonitoring = status.find((task) => task.id === 'system_monitoring');
assert.equal(
  systemMonitoring?.scheduleHealth,
  'scheduled',
  'fresh status should repair missing alarms by default',
);
assert.ok(
  alarms.scheduled_task_system_monitoring?.scheduledTime,
  'status refresh should recreate the missing Chrome alarm',
);

const priorSystemMonitoringAlarm = {
  ...alarms.scheduled_task_system_monitoring,
};
alarms.scheduled_task_system_monitoring.periodInMinutes = 30;
nextAlarmCreateError = 'temporary alarm replacement failure';
const failedMismatchRepairStatusResult =
  await taskScheduler.getTaskStatusFreshResult();
status = failedMismatchRepairStatusResult.tasks;
assert.equal(
  failedMismatchRepairStatusResult.refreshReceipt.failedRepairs,
  1,
  'status refresh receipt should count failed period-mismatch repair',
);
assert.equal(
  failedMismatchRepairStatusResult.refreshReceipt.updatedAlarms,
  0,
  'failed period-mismatch repair should not be counted as an updated alarm',
);
systemMonitoring = status.find((task) => task.id === 'system_monitoring');
assert.equal(
  systemMonitoring?.scheduleHealth,
  'repair_failed',
  'period mismatch repair failures should be visible in task status',
);
assert.match(
  systemMonitoring?.scheduleWarning || '',
  /temporary alarm replacement failure/,
  'period mismatch repair failures should surface the Chrome error reason',
);
assert.equal(
  alarms.scheduled_task_system_monitoring?.scheduledTime,
  priorSystemMonitoringAlarm.scheduledTime,
  'failed period mismatch repair should preserve the existing alarm schedule',
);
assert.equal(
  alarms.scheduled_task_system_monitoring?.periodInMinutes,
  30,
  'failed period mismatch repair should keep the existing alarm interval',
);

const repairedMismatchStatusResult =
  await taskScheduler.getTaskStatusFreshResult();
status = repairedMismatchStatusResult.tasks;
assert.equal(
  repairedMismatchStatusResult.refreshReceipt.updatedAlarms,
  1,
  'status refresh receipt should count successful period-mismatch repair',
);
systemMonitoring = status.find((task) => task.id === 'system_monitoring');
assert.equal(
  systemMonitoring?.scheduleHealth,
  'scheduled',
  'a later status refresh should still be able to repair a period mismatch',
);
assert.equal(
  alarms.scheduled_task_system_monitoring?.periodInMinutes,
  60,
  'successful period mismatch repair should replace the alarm interval',
);

alarms.scheduled_task_system_monitoring.scheduledTime =
  Date.now() - 31 * 60_000;
status = await taskScheduler.getTaskStatusFresh({
  persist: false,
});
systemMonitoring = status.find((task) => task.id === 'system_monitoring');
assert.equal(
  systemMonitoring?.scheduleHealth,
  'overdue',
  'fresh status should report existing alarms whose scheduled fire time is stale',
);
assert.match(
  systemMonitoring?.scheduleWarning || '',
  /超过预期触发时间/,
  'overdue alarms should include a user-visible warning',
);
assert.equal(
  systemMonitoring?.statusReceipt.label,
  '排程逾期',
  'overdue alarm status receipt should distinguish late alarms from missing alarms',
);
assert.match(
  systemMonitoring?.statusReceipt.nextAction || '',
  /立即执行一次/,
  'overdue alarm status receipt should recommend run-then-reschedule recovery',
);

const lastRunBeforeRepair = systemMonitoring?.lastRun;
const repairResult = await taskScheduler.repairTaskSchedule('system_monitoring');
assert.equal(
  repairResult,
  true,
  'repairing an enabled task should return success',
);
assert.ok(
  alarms.scheduled_task_system_monitoring?.scheduledTime > Date.now(),
  'repairing a task should reschedule its Chrome alarm into the future',
);
status = await taskScheduler.getTaskStatusFresh({
  persist: false,
});
systemMonitoring = status.find((task) => task.id === 'system_monitoring');
assert.equal(
  systemMonitoring?.scheduleHealth,
  'scheduled',
  'repairing an overdue task should clear the schedule warning',
);
assert.equal(
  systemMonitoring?.lastRun,
  lastRunBeforeRepair,
  'repairing a schedule should not execute the task',
);

rejectPersistAcrossSessionsOnce = true;
const fallbackRepairResult =
  await taskScheduler.repairTaskSchedule('system_monitoring');
assert.equal(
  fallbackRepairResult,
  true,
  'unsupported persistAcrossSessions alarm option should fall back without blocking scheduling',
);
assert.equal(
  alarmCreateInfos.scheduled_task_system_monitoring?.persistAcrossSessions,
  undefined,
  'fallback alarm creation should omit persistAcrossSessions after detecting unsupported Chromium',
);

const missingTask = await taskScheduler.runTaskManuallyWithResult(
  'missing_task',
);
assert.equal(missingTask.success, false);
assert.match(missingTask.error || '', /任务不存在: missing_task/);

const previousUserInfo = storage.userinfo;
storage.userinfo = { username: 'verify.user', fullName: '' };
const skippedMessageAnalysis =
  await taskScheduler.runTaskManuallyWithResult('message_analysis');
assert.equal(
  skippedMessageAnalysis.success,
  true,
  'missing user profile should be a skipped task outcome, not a failure',
);
assert.equal(
  skippedMessageAnalysis.skipped,
  true,
  'missing user profile should expose a skipped task result',
);
assert.match(
  skippedMessageAnalysis.error || '',
  /用户信息不完整/,
  'skipped message analysis should keep a user-visible reason',
);
status = taskScheduler.getTaskStatus();
const messageAnalysis = status.find((task) => task.id === 'message_analysis');
assert.equal(
  messageAnalysis?.lastSuccess,
  true,
  'skipped message analysis should not be counted as a task failure',
);
assert.ok(
  messageAnalysis?.lastSkippedAt,
  'skipped message analysis should persist the skipped timestamp',
);
assert.match(
  messageAnalysis?.lastSkipReason || '',
  /用户信息不完整/,
  'skipped message analysis should persist the skip reason',
);
assert.equal(
  messageAnalysis?.runHistory?.[0]?.skipped,
  true,
  'skipped message analysis should be visible in recent run history',
);
assert.equal(
  messageAnalysis?.statusReceipt.state,
  'recent_skip',
  'business-condition skips should expose a recent-skip status receipt',
);
assert.match(
  messageAnalysis?.statusReceipt.detail || '',
  /用户信息不完整/,
  'business-condition skip receipts should carry the skip reason',
);
storage.userinfo = previousUserInfo;

const originalSetTimeout = globalThis.setTimeout;
let startupTimerCount = 0;
(globalThis as any).setTimeout = (
  handler: TimerHandler,
  timeout?: number,
  ...args: any[]
) => {
  startupTimerCount += 1;
  return originalSetTimeout(handler as any, timeout as any, ...args);
};

try {
  (TaskScheduler as any).instance = null;
  delete storage.taskSchedulerStates;
  for (const key of Object.keys(alarms)) {
    delete alarms[key];
  }
  for (const key of Object.keys(alarmCreateInfos)) {
    delete alarmCreateInfos[key];
  }

  const freshScheduler = TaskScheduler.getInstance();
  await freshScheduler.startAllTasks();
  const freshStatus = freshScheduler.getTaskStatus();

  assert.equal(
    startupTimerCount,
    0,
    'first scheduler startup should not schedule an immediate task execution timer',
  );
  assert.equal(
    freshStatus.some((task) => Boolean(task.lastRun)),
    false,
    'first scheduler startup should only create alarms, not execute enabled tasks',
  );
  assert.ok(
    alarms.scheduled_task_memory_sync,
    'first scheduler startup should still create alarms for default enabled tasks',
  );
  assert.equal(
    freshStatus.find((task) => task.id === 'memory_sync')?.statusReceipt.state,
    'idle',
    'fresh enabled tasks should expose an idle receipt instead of pretending a run already happened',
  );
} finally {
  (globalThis as any).setTimeout = originalSetTimeout;
}

console.log('✅ Task scheduler API verification passed');
