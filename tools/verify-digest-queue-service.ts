import assert from 'node:assert/strict';

import type {
  DigestProcessor,
  DigestQueueItem,
} from '../src/types/digestQueue.ts';

const storageState: Record<string, any> = {};

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

(globalThis as any).chrome = {
  storage: {
    local: {
      async get(keys?: string | string[] | Record<string, any>) {
        await Promise.resolve();
        if (!keys) return clone(storageState);
        if (typeof keys === 'string') {
          return { [keys]: clone(storageState[keys]) };
        }
        if (Array.isArray(keys)) {
          return keys.reduce<Record<string, any>>((acc, key) => {
            acc[key] = clone(storageState[key]);
            return acc;
          }, {});
        }
        return Object.keys(keys).reduce<Record<string, any>>((acc, key) => {
          acc[key] = clone(storageState[key] ?? keys[key]);
          return acc;
        }, {});
      },
      async set(items: Record<string, any>) {
        await Promise.resolve();
        Object.assign(storageState, clone(items));
      },
      async remove(keys: string | string[]) {
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          delete storageState[key];
        }
      },
    },
  },
  runtime: {
    getURL(path: string) {
      return `chrome-extension://test/${path}`;
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

const {
  CONCERNED_ITEMS_DIGEST_TASK_ID,
  DIGEST_QUEUE_RELEASE_CHECK_INTERVAL_MINUTES,
  digestQueueService,
  enqueueConcernedItemDigest,
  getConcernedItemDigestReleaseAt,
  isConcernedItemDigestDue,
  registerConcernedItemsDigestTaskWithHour,
} = await import('../src/services/DigestQueueService.ts');

const { notificationService } = await import(
  '../src/services/NotificationService.ts'
);
const { buildBotNotificationMessage } = await import(
  '../src/services/NotificationService.ts'
);
const { summarizeDigestQueueProcessResults } = await import(
  '../src/services/TaskScheduler.ts'
);
const { summarizeDigestQueueStatusSummary } = await import(
  '../src/services/TaskScheduler.ts'
);

function makeDigestItem(
  id: string,
  createdAt: Date,
  digestConfig: DigestQueueItem['data']['digestConfig'],
): DigestQueueItem {
  return {
    id,
    createdAt: createdAt.toISOString(),
    sourceId: 'rule-1',
    data: {
      matchedRule: 'Release risks',
      sender: 'Alice',
      teamName: 'Release',
      messageContent: 'A risk appeared',
      summary: 'Risk appeared',
      datetime: createdAt.toISOString(),
      digestConfig,
    },
  };
}

async function verifyConcurrentEnqueueDoesNotDropItems() {
  const taskId = 'verify_concurrent_enqueue';
  await Promise.all([
    digestQueueService.enqueue(taskId, {
      id: 'item-a',
      createdAt: new Date(2026, 3, 30, 9).toISOString(),
      data: { value: 'a' },
    }),
    digestQueueService.enqueue(taskId, {
      id: 'item-b',
      createdAt: new Date(2026, 3, 30, 9).toISOString(),
      data: { value: 'b' },
    }),
  ]);

  const queued = await digestQueueService.peekQueue(taskId);
  assert.deepEqual(
    queued.map((item) => item.id).sort(),
    ['item-a', 'item-b'],
    'concurrent enqueue calls should preserve both items',
  );
}

async function verifyDuplicateIdsAreIdempotent() {
  const taskId = 'verify_idempotent_enqueue';
  await Promise.all([
    digestQueueService.enqueue(taskId, {
      id: 'same-id',
      createdAt: new Date(2026, 3, 30, 9).toISOString(),
      data: { value: 'first' },
    }),
    digestQueueService.enqueue(taskId, {
      id: 'same-id',
      createdAt: new Date(2026, 3, 30, 9).toISOString(),
      data: { value: 'duplicate' },
    }),
  ]);

  await digestQueueService.enqueueBatch(taskId, [
    {
      id: 'same-id',
      createdAt: new Date(2026, 3, 30, 9).toISOString(),
      data: { value: 'batch-duplicate' },
    },
    {
      id: 'other-id',
      createdAt: new Date(2026, 3, 30, 9).toISOString(),
      data: { value: 'other' },
    },
    {
      id: 'other-id',
      createdAt: new Date(2026, 3, 30, 9).toISOString(),
      data: { value: 'other-duplicate' },
    },
  ]);

  const queued = await digestQueueService.peekQueue(taskId);
  assert.deepEqual(
    queued.map((item) => item.id),
    ['same-id', 'other-id'],
    'queue item ids should be idempotent across enqueue and enqueueBatch',
  );
}

function verifyPerRuleDigestReleaseSchedule() {
  const dailyBeforeCutoff = makeDigestItem(
    'daily-before',
    new Date(2026, 3, 30, 9, 30),
    { enabled: true, frequency: 'daily', preferredHour: 10 },
  );
  assert.equal(
    isConcernedItemDigestDue(dailyBeforeCutoff, new Date(2026, 3, 30, 9, 59)),
    false,
  );
  assert.equal(
    isConcernedItemDigestDue(dailyBeforeCutoff, new Date(2026, 3, 30, 10, 0)),
    true,
  );

  const dailyAfterCutoff = makeDigestItem(
    'daily-after',
    new Date(2026, 3, 30, 10, 1),
    { enabled: true, frequency: 'daily', preferredHour: 10 },
  );
  const dailyRelease = getConcernedItemDigestReleaseAt(dailyAfterCutoff);
  assert.equal(dailyRelease.getDate(), new Date(2026, 4, 1, 10, 0).getDate());
  assert.equal(dailyRelease.getHours(), 10);

  const weekly = makeDigestItem('weekly', new Date(2026, 3, 28, 11, 0), {
    enabled: true,
    frequency: 'weekly',
    preferredHour: 9,
    preferredDayOfWeek: 3,
  });
  assert.equal(
    isConcernedItemDigestDue(weekly, new Date(2026, 3, 29, 8, 59)),
    false,
  );
  assert.equal(
    isConcernedItemDigestDue(weekly, new Date(2026, 3, 29, 9, 0)),
    true,
  );

  const midnight = makeDigestItem('midnight', new Date(2026, 3, 30, 23, 0), {
    enabled: true,
    frequency: 'daily',
    preferredHour: 0,
  });
  const midnightRelease = getConcernedItemDigestReleaseAt(midnight);
  assert.equal(
    midnightRelease.getHours(),
    0,
    'midnight schedules should keep hour 0',
  );
}

async function verifyNotificationFailureKeepsItems() {
  const taskId = 'verify_digest_notification_failure';
  const originalSendNotification =
    notificationService.sendNotification.bind(notificationService);

  (notificationService as any).sendNotification = async () => ({
    success: false,
    results: [{ method: 'bot', success: false, error: 'network down' }],
  });

  const processor: DigestProcessor = {
    async collect(items) {
      return items;
    },
    async format(items) {
      return `${items.length} ready`;
    },
    getNotifyConfig() {
      return { notifyMethod: 'bot' };
    },
  };

  digestQueueService.register({
    id: taskId,
    name: 'Verify notification failure retention',
    frequency: { type: 'hourly' },
    enabled: true,
    processor,
  });

  try {
    await digestQueueService.enqueue(taskId, {
      id: 'retained',
      createdAt: new Date(2026, 3, 30, 9).toISOString(),
      data: { kind: 'ready' },
    });

    const result = await digestQueueService.processTask(taskId);
    assert.equal(result.success, false);
    assert.match(result.error || '', /network down/);
    assert.equal(result.queueSnapshot?.totalItems, 1);
    assert.equal(result.queueSnapshot?.taskId, taskId);

    const remaining = await digestQueueService.peekQueue(taskId);
    assert.deepEqual(
      remaining.map((item) => item.id),
      ['retained'],
      'failed notification delivery should not remove queued items',
    );
  } finally {
    digestQueueService.unregister(taskId);
    (notificationService as any).sendNotification = originalSendNotification;
  }
}

function verifyTaskSchedulerSurfacesDigestFailures() {
  const successResult = summarizeDigestQueueProcessResults([
    {
      taskId: 'follow_thread_merged',
      success: true,
      itemsProcessed: 3,
    },
    {
      taskId: 'concerned_items_daily',
      success: true,
      itemsProcessed: 2,
    },
  ]);
  assert.equal(successResult.success, true);
  assert.equal(successResult.summary, '2 个摘要任务成功，推送 5 条');

  const idleResult = summarizeDigestQueueProcessResults([]);
  assert.equal(idleResult.success, true);
  assert.equal(idleResult.summary, '无到期摘要');

  const failedResult = summarizeDigestQueueProcessResults([
    {
      taskId: 'concerned_items_daily',
      success: false,
      itemsProcessed: 0,
      itemsPending: 1,
      error: 'network down',
      queueSnapshot: {
        taskId: 'concerned_items_daily',
        taskName: 'ConcernedItems 定时消息摘要',
        totalItems: 1,
        dueItems: 1,
        sourceBreakdown: [{ label: 'Release risks', count: 1 }],
        scheduleBreakdown: [
          {
            frequency: 'daily',
            preferredHour: 8,
            count: 1,
          },
        ],
      },
    },
  ]);
  assert.equal(failedResult.success, false);
  assert.match(failedResult.error || '', /摘要推送失败 1\/1/);
  assert.match(failedResult.error || '', /network down/);
  assert.equal(
    failedResult.summary,
    '0 个摘要任务成功，1 个失败，队列已保留 1 条；保留明细：ConcernedItems 定时消息摘要 1 条（1 条已到期）（Release risks 1 条；每日 8:00）',
  );

  const pendingResult = summarizeDigestQueueProcessResults([
    {
      taskId: 'concerned_items_daily',
      success: true,
      itemsProcessed: 0,
      itemsPending: 2,
      itemsDue: 0,
      nextReleaseAt: new Date(2026, 0, 2, 8, 0).toISOString(),
      queueSnapshot: {
        taskId: 'concerned_items_daily',
        taskName: 'ConcernedItems 定时消息摘要',
        totalItems: 2,
        dueItems: 0,
        nextReleaseAt: new Date(2026, 0, 2, 8, 0).toISOString(),
        sourceBreakdown: [{ label: 'Release risks', count: 2 }],
        scheduleBreakdown: [
          {
            frequency: 'daily',
            preferredHour: 8,
            count: 2,
          },
        ],
      },
    },
  ]);
  assert.equal(pendingResult.success, true);
  assert.match(pendingResult.summary || '', /等待 2 条/);
  assert.match(pendingResult.summary || '', /最早/);
  assert.match(pendingResult.summary || '', /等待明细/);
  assert.match(pendingResult.summary || '', /Release risks 2 条/);
  assert.match(pendingResult.summary || '', /每日 8:00 2 条/);
}

function verifyDigestBotMessageHasNoBrokenSourceLink() {
  const message = buildBotNotificationMessage({
    teamId: '',
    teamName: '',
    sender: 'Personal AI',
    messageContent: '📊 **定时消息摘要**\n共 2 条匹配消息',
    summary: '[ConcernedItems 定时消息摘要] 2 条汇总',
    datetime: '2026/05/24 08:00:00',
    matchedRule:
      '规则5: [RULE_REF:manual:ppjoemwkn] [RULE_ID:4] AI相关讨论话题',
    mention: false,
  });

  assert.match(message, /__关注项__：AI相关讨论话题/);
  assert.doesNotMatch(message, /RULE_REF|RULE_ID|规则5/);
  assert.match(message, /__内容__：📊 \*\*定时消息摘要\*\*/);
  assert.doesNotMatch(message, /__在群__：/);
  assert.doesNotMatch(message, /app\.ringcentral\.com\/messages\/?[\)\s]/);
  assert.doesNotMatch(message, /点击查看原消息/);
}

async function verifyProcessTaskRemovesOnlyCollectedItems() {
  const taskId = 'verify_digest_process';
  const processor: DigestProcessor = {
    async collect(items) {
      return items.filter((item) => item.data.kind === 'ready');
    },
    async format(items) {
      return `${items.length} ready`;
    },
    getNotifyConfig() {
      return { notifyMethod: '' };
    },
  };

  digestQueueService.register({
    id: taskId,
    name: 'Verify digest process',
    frequency: { type: 'hourly' },
    enabled: true,
    processor,
  });

  await digestQueueService.enqueueBatch(taskId, [
    {
      id: 'ready',
      createdAt: new Date(2026, 3, 30, 9).toISOString(),
      data: { kind: 'ready' },
    },
    {
      id: 'later',
      createdAt: new Date(2026, 3, 30, 9).toISOString(),
      data: { kind: 'later' },
    },
  ]);

  const result = await digestQueueService.processTask(taskId);
  assert.equal(result.success, true);
  assert.equal(result.itemsProcessed, 1);

  const remaining = await digestQueueService.peekQueue(taskId);
  assert.deepEqual(
    remaining.map((item) => item.id),
    ['later'],
    'processing should keep items that collect() did not release',
  );
}

async function verifyProcessAllRunsRegisteredMapTasks() {
  const taskId = 'verify_process_all_map_entries';
  const processor: DigestProcessor = {
    async collect(items) {
      return items;
    },
    async format(items) {
      return `${items.length} process-all ready`;
    },
    getNotifyConfig() {
      return { notifyMethod: '' };
    },
  };

  digestQueueService.register({
    id: taskId,
    name: 'Verify processAll Map entries',
    frequency: { type: 'custom', intervalMinutes: 0 },
    enabled: true,
    processor,
  });

  await digestQueueService.enqueue(taskId, {
    id: 'process-all-item',
    createdAt: new Date(2026, 3, 30, 9).toISOString(),
    data: { kind: 'ready' },
  });

  const results = await digestQueueService.processAll();
  const result = results.find((item) => item.taskId === taskId);
  assert.ok(
    result,
    'processAll should iterate registered Map tasks and return their result',
  );
  assert.equal(result?.success, true);
  assert.equal(result?.itemsProcessed, 1);
}

function verifyConcernedTaskUsesBoundedReleaseWindow() {
  registerConcernedItemsDigestTaskWithHour(18);
  const task = digestQueueService
    .getRegisteredTasks()
    .find((item) => item.id === CONCERNED_ITEMS_DIGEST_TASK_ID);

  assert.ok(task, 'concerned-items digest task should be registered');
  assert.deepEqual(task?.frequency, {
    type: 'custom',
    intervalMinutes: DIGEST_QUEUE_RELEASE_CHECK_INTERVAL_MINUTES,
  });
}

async function verifyConcernedDigestUsesRuleIdForGrouping() {
  const sentMessages: string[] = [];
  const originalSendNotification =
    notificationService.sendNotification.bind(notificationService);

  (notificationService as any).sendNotification = async (data: {
    messageContent: string;
  }) => {
    sentMessages.push(data.messageContent);
    return { success: true, results: [{ method: 'bot', success: true }] };
  };

  registerConcernedItemsDigestTaskWithHour(8);
  await digestQueueService.enqueueBatch(CONCERNED_ITEMS_DIGEST_TASK_ID, [
    makeDigestItem('rule-a-post-1', new Date(2026, 0, 1, 7, 0), {
      enabled: true,
      frequency: 'daily',
      preferredHour: 8,
    }),
    makeDigestItem('rule-b-post-1', new Date(2026, 0, 1, 7, 0), {
      enabled: true,
      frequency: 'daily',
      preferredHour: 8,
    }),
  ]);

  const queued = await digestQueueService.peekQueue(
    CONCERNED_ITEMS_DIGEST_TASK_ID,
  );
  queued[queued.length - 2].data.ruleId = 'rule-a';
  queued[queued.length - 2].data.matchedRule =
    '[RULE_REF:manual:rule-a] [RULE_ID:4] Release risks';
  queued[queued.length - 2].sourceId = 'rule-a';
  queued[queued.length - 1].data.ruleId = 'rule-b';
  queued[queued.length - 1].data.matchedRule =
    '规则5: [RULE_REF:manual:rule-b] [RULE_ID:4] Release risks';
  queued[queued.length - 1].sourceId = 'rule-b';
  storageState.digestQueues[CONCERNED_ITEMS_DIGEST_TASK_ID].items = queued;

  const result = await digestQueueService.processTask(
    CONCERNED_ITEMS_DIGEST_TASK_ID,
  );
  assert.equal(result.success, true);

  const message = sentMessages.at(-1) || '';
  assert.match(
    message,
    /\*\*摘要回执\*\*: 本次释放 2 条已到时间的本地摘要/,
  );
  assert.match(message, /\*\*释放节奏\*\*: 每日 8:00/);
  assert.match(message, /未到期条目继续留在本地队列/);
  assert.match(message, /Bot 推送失败时不会清除本次条目/);
  assert.doesNotMatch(message, /RULE_REF|RULE_ID|规则5/);
  const sectionCount =
    message.match(/\*\*关注项\*\*: Release risks/g)?.length || 0;
  assert.equal(
    sectionCount,
    2,
    'same-label rules should stay as separate digest sections when ruleId differs',
  );

  (notificationService as any).sendNotification = originalSendNotification;
}

async function verifyConcernedDigestEnqueueIsIdempotentPerRulePost() {
  const payload = {
    matchedRule: 'Release risks',
    sender: 'Alice',
    teamName: 'Release',
    teamId: 'team-1',
    messageContent: 'A risk appeared',
    summary: 'Risk appeared',
    datetime: new Date(2026, 3, 30, 9).toISOString(),
    postId: 'post-123',
    ruleId: 'rule-123',
    digestConfig: {
      enabled: true,
      frequency: 'daily' as const,
      preferredHour: 8,
    },
  };

  await enqueueConcernedItemDigest(payload);
  await enqueueConcernedItemDigest(payload);

  const queued = await digestQueueService.peekQueue(
    CONCERNED_ITEMS_DIGEST_TASK_ID,
  );
  const matchingItems = queued.filter(
    (item) => item.id === 'concerned_rule-123_post-123',
  );
  assert.equal(
    matchingItems.length,
    1,
    'same rule/post concerned digest should be queued once',
  );
}

async function verifyPendingDigestQueueStatusIsExplainable() {
  storageState.digestQueues = {};
  storageState.digestTaskStates = {};

  registerConcernedItemsDigestTaskWithHour(8);

  const now = new Date();
  const nextHour = (now.getHours() + 1) % 24;
  const digestConfig = {
    enabled: true,
    frequency: 'daily' as const,
    preferredHour: nextHour,
  };

  await digestQueueService.enqueueBatch(CONCERNED_ITEMS_DIGEST_TASK_ID, [
    makeDigestItem('future-digest-1', now, digestConfig),
    makeDigestItem('future-digest-2', now, digestConfig),
  ]);

  const statusSummary = await digestQueueService.getQueueStatusSummary(now);
  assert.equal(statusSummary.totalItems, 2);
  assert.equal(statusSummary.dueItems, 0);
  assert.equal(statusSummary.checkedAt, now.toISOString());
  assert.ok(statusSummary.nextReleaseAt, 'next release time should be exposed');
  assert.equal(statusSummary.tasks[0]?.taskName, 'ConcernedItems 定时消息摘要');
  assert.deepEqual(statusSummary.tasks[0]?.sourceBreakdown, [
    { label: 'Release risks', count: 2 },
  ]);
  assert.equal(statusSummary.tasks[0]?.scheduleBreakdown?.[0]?.count, 2);

  const currentSummary = summarizeDigestQueueStatusSummary(statusSummary) || '';
  assert.match(currentSummary, /本地摘要队列 2 条/);
  assert.match(currentSummary, /暂无到期/);
  assert.match(currentSummary, /最早/);
  assert.match(currentSummary, /ConcernedItems 定时消息摘要 2 条/);
  assert.match(currentSummary, /Release risks 2 条/);
  assert.match(currentSummary, /每日 .* 2 条/);
  assert.match(currentSummary, /本地延迟摘要/);
  assert.match(currentSummary, /通常 15 分钟内检查/);
  assert.match(currentSummary, /查看\/刷新不立即发送/);
  assert.match(currentSummary, /不写入 Memory Service/);
  assert.match(currentSummary, /不确认通知/);

  const result = await digestQueueService.processTask(
    CONCERNED_ITEMS_DIGEST_TASK_ID,
  );
  assert.equal(result.success, true);
  assert.equal(result.itemsProcessed, 0);
  assert.equal(result.itemsPending, 2);
  assert.equal(result.itemsDue, 0);
  assert.ok(
    result.nextReleaseAt,
    'process result should keep next release time',
  );
  assert.equal(result.queueSnapshot?.totalItems, 2);
  assert.deepEqual(result.queueSnapshot?.sourceBreakdown, [
    { label: 'Release risks', count: 2 },
  ]);
  const processSummary = summarizeDigestQueueProcessResults([result]);
  assert.match(processSummary.summary || '', /等待明细/);
  assert.match(processSummary.summary || '', /Release risks 2 条/);
  assert.match(processSummary.summary || '', /每日 .* 2 条/);
}

async function verifyDueAndFutureDigestQueueStatusIsExplainable() {
  storageState.digestQueues = {};
  storageState.digestTaskStates = {};

  registerConcernedItemsDigestTaskWithHour(8);

  const now = new Date(2026, 0, 1, 9, 0);
  await digestQueueService.enqueueBatch(CONCERNED_ITEMS_DIGEST_TASK_ID, [
    makeDigestItem('due-digest', new Date(2026, 0, 1, 7, 0), {
      enabled: true,
      frequency: 'daily',
      preferredHour: 8,
    }),
    makeDigestItem('future-digest', new Date(2026, 0, 1, 9, 1), {
      enabled: true,
      frequency: 'daily',
      preferredHour: 10,
    }),
  ]);

  const statusSummary = await digestQueueService.getQueueStatusSummary(now);
  assert.equal(statusSummary.totalItems, 2);
  assert.equal(statusSummary.dueItems, 1);
  assert.equal(statusSummary.checkedAt, now.toISOString());
  assert.ok(
    statusSummary.nextReleaseAt,
    'future digest item should keep the next release timestamp visible',
  );
  assert.equal(
    new Date(statusSummary.nextReleaseAt || '').getHours(),
    10,
    'next release should point to the future item, not the due item',
  );

  const currentSummary = summarizeDigestQueueStatusSummary(statusSummary) || '';
  assert.match(currentSummary, /本地摘要队列 2 条/);
  assert.match(currentSummary, /1 条已到期/);
  assert.match(currentSummary, /最早/);
  assert.match(currentSummary, /Release risks 2 条/);
  assert.match(currentSummary, /每日 8:00/);
  assert.match(currentSummary, /每日 10:00/);
  assert.match(currentSummary, /释放窗口回执/);
  assert.match(currentSummary, /1 条已具备发送资格/);
  assert.match(currentSummary, /等待 digest_queue_process 后台任务推送/);
  assert.match(currentSummary, /查看或刷新状态不会立即发送摘要/);

  const processSummary = summarizeDigestQueueProcessResults([
    {
      taskId: CONCERNED_ITEMS_DIGEST_TASK_ID,
      success: true,
      itemsProcessed: 0,
      itemsPending: 2,
      itemsDue: 1,
      nextReleaseAt: statusSummary.nextReleaseAt,
      queueSnapshot: statusSummary.tasks[0],
    },
  ]);
  assert.match(processSummary.summary || '', /等待 2 条/);
  assert.match(processSummary.summary || '', /释放窗口回执/);
  assert.match(processSummary.summary || '', /1 条已具备发送资格/);
}

async function main() {
  await verifyConcurrentEnqueueDoesNotDropItems();
  await verifyDuplicateIdsAreIdempotent();
  verifyPerRuleDigestReleaseSchedule();
  await verifyNotificationFailureKeepsItems();
  verifyTaskSchedulerSurfacesDigestFailures();
  verifyDigestBotMessageHasNoBrokenSourceLink();
  await verifyProcessTaskRemovesOnlyCollectedItems();
  await verifyProcessAllRunsRegisteredMapTasks();
  verifyConcernedTaskUsesBoundedReleaseWindow();
  await verifyConcernedDigestUsesRuleIdForGrouping();
  await verifyConcernedDigestEnqueueIsIdempotentPerRulePost();
  await verifyDueAndFutureDigestQueueStatusIsExplainable();
  await verifyPendingDigestQueueStatusIsExplainable();

  console.log('verify-digest-queue-service: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
