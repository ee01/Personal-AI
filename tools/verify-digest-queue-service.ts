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
  digestQueueService,
  enqueueConcernedItemDigest,
  getConcernedItemDigestReleaseAt,
  isConcernedItemDigestDue,
  registerConcernedItemsDigestTaskWithHour,
} = await import('../src/services/DigestQueueService.ts');

const { notificationService } = await import('../src/services/NotificationService.ts');

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
    queued.map(item => item.id).sort(),
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
    queued.map(item => item.id),
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

  const weekly = makeDigestItem(
    'weekly',
    new Date(2026, 3, 28, 11, 0),
    {
      enabled: true,
      frequency: 'weekly',
      preferredHour: 9,
      preferredDayOfWeek: 3,
    },
  );
  assert.equal(
    isConcernedItemDigestDue(weekly, new Date(2026, 3, 29, 8, 59)),
    false,
  );
  assert.equal(
    isConcernedItemDigestDue(weekly, new Date(2026, 3, 29, 9, 0)),
    true,
  );

  const midnight = makeDigestItem(
    'midnight',
    new Date(2026, 3, 30, 23, 0),
    { enabled: true, frequency: 'daily', preferredHour: 0 },
  );
  const midnightRelease = getConcernedItemDigestReleaseAt(midnight);
  assert.equal(midnightRelease.getHours(), 0, 'midnight schedules should keep hour 0');
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

  await digestQueueService.enqueue(taskId, {
    id: 'retained',
    createdAt: new Date(2026, 3, 30, 9).toISOString(),
    data: { kind: 'ready' },
  });

  const result = await digestQueueService.processTask(taskId);
  assert.equal(result.success, false);
  assert.match(result.error || '', /network down/);

  const remaining = await digestQueueService.peekQueue(taskId);
  assert.deepEqual(
    remaining.map(item => item.id),
    ['retained'],
    'failed notification delivery should not remove queued items',
  );

  (notificationService as any).sendNotification = originalSendNotification;
}

async function verifyProcessTaskRemovesOnlyCollectedItems() {
  const taskId = 'verify_digest_process';
  const processor: DigestProcessor = {
    async collect(items) {
      return items.filter(item => item.data.kind === 'ready');
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
    remaining.map(item => item.id),
    ['later'],
    'processing should keep items that collect() did not release',
  );
}

function verifyConcernedTaskRunsHourlyForPerRuleSchedules() {
  registerConcernedItemsDigestTaskWithHour(18);
  const task = digestQueueService
    .getRegisteredTasks()
    .find(item => item.id === CONCERNED_ITEMS_DIGEST_TASK_ID);

  assert.ok(task, 'concerned-items digest task should be registered');
  assert.deepEqual(task?.frequency, { type: 'hourly' });
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
    makeDigestItem(
      'rule-a-post-1',
      new Date(2026, 0, 1, 7, 0),
      { enabled: true, frequency: 'daily', preferredHour: 8 },
    ),
    makeDigestItem(
      'rule-b-post-1',
      new Date(2026, 0, 1, 7, 0),
      { enabled: true, frequency: 'daily', preferredHour: 8 },
    ),
  ]);

  const queued = await digestQueueService.peekQueue(
    CONCERNED_ITEMS_DIGEST_TASK_ID,
  );
  queued[queued.length - 2].data.ruleId = 'rule-a';
  queued[queued.length - 2].data.matchedRule = 'Release risks';
  queued[queued.length - 2].sourceId = 'rule-a';
  queued[queued.length - 1].data.ruleId = 'rule-b';
  queued[queued.length - 1].data.matchedRule = 'Release risks';
  queued[queued.length - 1].sourceId = 'rule-b';
  storageState.digestQueues[CONCERNED_ITEMS_DIGEST_TASK_ID].items = queued;

  const result = await digestQueueService.processTask(
    CONCERNED_ITEMS_DIGEST_TASK_ID,
  );
  assert.equal(result.success, true);

  const message = sentMessages.at(-1) || '';
  const sectionCount = message.match(/\*\*关注项\*\*: Release risks/g)?.length || 0;
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
  const matchingItems = queued.filter(item => item.id === 'concerned_rule-123_post-123');
  assert.equal(
    matchingItems.length,
    1,
    'same rule/post concerned digest should be queued once',
  );
}

async function main() {
  await verifyConcurrentEnqueueDoesNotDropItems();
  await verifyDuplicateIdsAreIdempotent();
  verifyPerRuleDigestReleaseSchedule();
  await verifyNotificationFailureKeepsItems();
  await verifyProcessTaskRemovesOnlyCollectedItems();
  verifyConcernedTaskRunsHourlyForPerRuleSchedules();
  await verifyConcernedDigestUsesRuleIdForGrouping();
  await verifyConcernedDigestEnqueueIsIdempotentPerRulePost();

  console.log('verify-digest-queue-service: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
