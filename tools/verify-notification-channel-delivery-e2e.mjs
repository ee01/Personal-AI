import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionPath = path.join(repoRoot, 'dist');

function sendJson(res, body, status = 200) {
  res.writeHead(status, {
    'content-type': 'application/json',
  });
  res.end(JSON.stringify(body));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

async function startMockMemoryServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');

      if (
        req.method === 'GET' &&
        url.pathname.endsWith('/notification-center/feed')
      ) {
        assert.equal(url.searchParams.get('channel'), 'chrome');
        assert.equal(url.searchParams.get('lanes'), 'todo,notice');
        assert.equal(url.searchParams.get('deliveryMode'), 'incremental');
        const visibleItems = feedItems.filter(
          (item) => !successfullyDeliveredRefs.has(item.sourceRef),
        );
        sendJson(res, {
          items: visibleItems,
          total: visibleItems.length,
          meta: {
            channel: 'chrome',
            lanes: ['todo', 'notice'],
            deliveryMode: 'incremental',
            limit: 20,
            returned: visibleItems.length,
            hasMore: false,
            snapshotReceipt: {
              label: 'Feed 快照口径回执',
              generatedAt: 1_777_000_002,
              detail:
                'Chrome 滚动同步在 2026-04-25 08:26:42 读取；本次按待办/通知范围和 limit=20 返回 4 条，当前页未发现更多条目。',
              boundary:
                '这是本次读取时的只读队列快照；不代表之后没有新通知，不会确认、忽略、重发通知，不会写渠道送达回执，也不会改变全局处理状态。',
            },
          },
        });
        return;
      }

      if (
        req.method === 'POST' &&
        url.pathname.endsWith('/notification-center/delivery')
      ) {
        const body = await readRequestBody(req);
        deliveryAttempts.push(body.events);
        if (failDeliveryRequestsRemaining > 0) {
          failDeliveryRequestsRemaining -= 1;
          sendJson(res, { error: 'simulated_delivery_write_failure' }, 503);
          return;
        }
        deliveryBatches.push(body.events);
        for (const event of body.events) {
          if (
            event.status === 'delivered' ||
            event.status === 'clicked' ||
            event.status === 'dismissed'
          ) {
            successfullyDeliveredRefs.add(event.sourceRef);
          }
        }
        sendJson(res, {
          ok: true,
          updated: body.events.length,
          items: body.events.map((event) => ({
            ...event,
            effectiveStatus: event.status,
            hasSuccessfulDelivery:
              event.status === 'delivered' ||
              event.status === 'clicked' ||
              event.status === 'dismissed',
          })),
        });
        return;
      }

      sendJson(res, {});
    } catch (error) {
      sendJson(
        res,
        {
          error: 'mock_memory_server_error',
          message: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  assert(address && typeof address === 'object');
  return {
    baseUrl: `http://127.0.0.1:${address.port}/api/v1`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'notification-channel-delivery-'),
  );
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 900 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', {
      timeout: 15000,
    });
  }

  return {
    context,
    serviceWorker,
    userDataDir,
  };
}

async function waitFor(predicate, label, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(`Timed out waiting for ${label}`);
}

const feedItems = [
  {
    sourceRef: 'notification:notif-create-fail',
    sourceType: 'notification',
    sourceId: 'notif-create-fail',
    lane: 'notice',
    priority: 'high',
    title: 'Chrome create failure probe',
    body: 'This item should record a failed Chrome delivery.',
    createdAt: 1_777_000_000,
    sentAt: 1_777_000_000,
    type: 'weekly_report',
    payload: {
      reportSummary: 'Create failure should be visible to channel receipts.',
    },
    deliveryContext: {
      channel: 'chrome',
      reason: 'new',
      hasSuccessfulDelivery: false,
    },
    channelReceipts: [],
  },
  {
    sourceRef: 'notification:notif-create-ok',
    sourceType: 'notification',
    sourceId: 'notif-create-ok',
    lane: 'notice',
    priority: 'normal',
    title: 'Chrome create success probe',
    body: 'This item should still be delivered after the first one fails.',
    createdAt: 1_777_000_001,
    sentAt: 1_777_000_001,
    type: 'project_update',
    payload: {
      summary: 'The poller must continue after a per-item create failure.',
    },
    deliveryContext: {
      channel: 'chrome',
      reason: 'new',
      hasSuccessfulDelivery: false,
    },
    channelReceipts: [],
  },
  {
    sourceRef: 'notification:notif-snoozed-due',
    sourceType: 'notification',
    sourceId: 'notif-snoozed-due',
    lane: 'todo',
    priority: 'high',
    title: 'Deferred deadline probe',
    body: 'This deferred reminder should clearly remain unresolved.',
    dueAt: 1_777_003_600,
    createdAt: 1_777_000_002,
    sentAt: 1_777_000_002,
    type: 'deadline',
    payload: {
      summary: 'Original reminder context should stay visible.',
      snooze: {
        sourceNotificationId: 'notif-snoozed-source',
        rootNotificationId: 'notif-snoozed-root',
        snoozedAt: 1_776_994_202,
        scheduledAt: 1_777_000_002,
        delaySeconds: 90 * 60,
        count: 2,
      },
    },
    deliveryContext: {
      channel: 'chrome',
      reason: 'new',
      hasSuccessfulDelivery: false,
    },
    snoozeReceipt: {
      label: '第2次稍后提醒',
      detail:
        '来源通知 notif-snoozed-source；根通知 notif-snoozed-root；原定回提醒 2026-04-25 08:26；上次延后 90分钟',
      boundary:
        '这是稍后提醒到点的上下文；不会确认事项、发送消息、同步外部平台、执行动作或修改原始证据。',
      sourceNotificationId: 'notif-snoozed-source',
      rootNotificationId: 'notif-snoozed-root',
      snoozedAt: 1_776_994_202,
      scheduledAt: 1_777_000_002,
      delaySeconds: 90 * 60,
      count: 2,
    },
    evidenceReceipt: {
      evidenceCount: 2,
      label: '依据 2 条记忆',
      detail: '本次通知依据：message:deadline:source、memory:project-risk',
      boundary:
        '只说明生成这条通知时引用过的记忆证据；不会确认、忽略、重发通知，或改变任何渠道投递状态。',
      sampleRefs: ['message:deadline:source', 'memory:project-risk'],
    },
    channelReceipts: [],
  },
  {
    sourceRef: 'notification:notif-cross-channel',
    sourceType: 'notification',
    sourceId: 'notif-cross-channel',
    lane: 'notice',
    priority: 'high',
    title: 'Cross channel delivery probe',
    body: 'This item should expose other-channel state in Chrome.',
    createdAt: 1_777_000_003,
    sentAt: 1_777_000_003,
    type: 'project_update',
    payload: {
      summary: 'Chrome is seeing this for the first time after other channels.',
    },
    deliveryContext: {
      channel: 'chrome',
      reason: 'new',
      hasSuccessfulDelivery: false,
    },
    channelReceipts: [
      {
        channel: 'chrome',
        state: 'not_attempted',
        label: '未尝试',
        detail: '该渠道尚未写入投递回执',
        hasSuccessfulDelivery: false,
      },
      {
        channel: 'doubao',
        state: 'delivered',
        label: '已送达',
        detail: '渠道已报告送达；这不等于用户已处理',
        status: 'delivered',
        effectiveStatus: 'delivered',
        hasSuccessfulDelivery: true,
        firstDeliveredAt: 1_777_000_000,
        lastDeliveredAt: 1_777_000_000,
        lastAttemptAt: 1_777_000_000,
      },
      {
        channel: 'glip',
        state: 'failed',
        label: '发送失败',
        detail: '最近一次渠道发送失败：bot_not_configured',
        status: 'failed',
        effectiveStatus: 'failed',
        hasSuccessfulDelivery: false,
        lastAttemptAt: 1_777_000_001,
        lastError: 'bot_not_configured',
      },
    ],
  },
];

const deliveryBatches = [];
const deliveryAttempts = [];
const successfullyDeliveredRefs = new Set();
let failDeliveryRequestsRemaining =
  process.env.NOTIFICATION_E2E_FAIL_FIRST_DELIVERY === '1' ? 1 : 0;
let launched;
let mockMemory;

try {
  mockMemory = await startMockMemoryServer();
  launched = await launchExtensionContext();
  const { serviceWorker } = launched;

  await serviceWorker.evaluate(async (baseUrl) => {
    await chrome.storage.local.set({
      envConfig: {
        MEMORY_SERVICE_BASE_URL: baseUrl,
        MEMORY_SERVICE_TIMEOUT: 3000,
      },
    });

    globalThis.__notificationCreateCalls = [];
    chrome.notifications.create = async (notificationId, options) => {
      globalThis.__notificationCreateCalls.push({
        notificationId,
        title: options?.title,
        message: options?.message,
        contextMessage: options?.contextMessage,
        buttons: options?.buttons?.map((button) => button.title),
      });
      if (notificationId.includes('notif-create-fail')) {
        throw new Error('simulated_chrome_notification_create_failure');
      }
      return notificationId;
    };

    await globalThis.__personalAiPollBackendNotificationsForE2E({
      baseUrl,
      timeoutMs: 3000,
    });
  }, mockMemory.baseUrl);

  const exercisesOutbox =
    process.env.NOTIFICATION_E2E_FAIL_FIRST_DELIVERY === '1';
  if (exercisesOutbox) {
    await waitFor(
      () => deliveryAttempts.length >= 1,
      'initial failed batched delivery attempt',
      70000,
    );
    await serviceWorker.evaluate(async () => {
      await globalThis.__personalAiPollBackendNotificationsForE2E();
    });
  }

  await waitFor(
    () => deliveryBatches.flat().length >= (exercisesOutbox ? 5 : 4),
    'failed and delivered delivery reports',
    70000,
  );

  const deliveries = deliveryBatches[0];
  assert.equal(
    deliveryBatches.length,
    exercisesOutbox ? 2 : 1,
    exercisesOutbox
      ? 'the recovery poll should flush one outbox batch, then report the one Chrome create retry failure'
      : 'one poll should report all Chrome delivery receipts in one POST',
  );
  assert.deepEqual(
    deliveries.map((event) => [
      event.sourceRef,
      event.channel,
      event.lane,
      event.status,
    ]),
    [
      ['notification:notif-create-fail', 'chrome', 'notice', 'failed'],
      ['notification:notif-create-ok', 'chrome', 'notice', 'delivered'],
      ['notification:notif-snoozed-due', 'chrome', 'todo', 'delivered'],
      ['notification:notif-cross-channel', 'chrome', 'notice', 'delivered'],
    ],
  );
  assert.match(
    deliveries[0].error || '',
    /simulated_chrome_notification_create_failure/,
  );
  assert.match(deliveries[0].externalRef || '', /notif-create-fail/);
  assert.match(deliveries[1].externalRef || '', /notif-create-ok/);

  const createCalls = await serviceWorker.evaluate(
    () => globalThis.__notificationCreateCalls,
  );
  assert.equal(createCalls.length, exercisesOutbox ? 5 : 4);
  assert.match(createCalls[0].notificationId, /notif-create-fail/);
  assert.match(createCalls[1].notificationId, /notif-create-ok/);
  assert.match(createCalls[2].notificationId, /notif-snoozed-due/);
  assert.match(createCalls[3].notificationId, /notif-cross-channel/);
  assert.match(createCalls[2].contextMessage, /第2次稍后提醒/);
  assert.match(createCalls[2].contextMessage, /依据 2 条记忆/);
  assert.match(createCalls[2].contextMessage, /仍未处理/);
  assert.match(createCalls[2].contextMessage, /延后90分钟/);
  assert.match(createCalls[2].contextMessage, /稍后按钮：/);
  assert.deepEqual(createCalls[2].buttons, ['查看待办', '稍后提醒']);
  assert.match(createCalls[3].contextMessage, /本渠道首次提醒/);
  assert.match(createCalls[3].contextMessage, /其他渠道 豆包已送达/);
  assert.match(
    createCalls[3].contextMessage,
    /Glip发送失败（bot_not_configured，未送达）/,
  );
  if (exercisesOutbox) {
    assert.equal(
      createCalls.filter((call) => call.notificationId.includes('notif-create-ok')).length,
      1,
      'a delivered notification must not be displayed again after outbox recovery',
    );
    assert.equal(
      createCalls.filter((call) => call.notificationId.includes('notif-snoozed-due')).length,
      1,
      'a delivered todo must not be displayed again after outbox recovery',
    );
    const outbox = await serviceWorker.evaluate(async () =>
      chrome.storage.local.get('notification_center_chrome_delivery_outbox_v1'),
    );
    assert.equal(
      outbox.notification_center_chrome_delivery_outbox_v1,
      undefined,
      'successful outbox replay should remove the persisted batch',
    );
  }

  console.log(
    exercisesOutbox
      ? '✅ notification channel delivery outbox E2E passed: failed batch was replayed before the next incremental feed and successful notifications were not displayed twice'
      : '✅ notification channel delivery E2E passed: one incremental poll wrote one batched receipt POST, create failure stayed isolated, due snooze kept unresolved context, and cross-channel receipts stayed visible',
  );
} finally {
  if (launched?.context) {
    await launched.context.close();
  }
  if (launched?.userDataDir) {
    await fs.rm(launched.userDataDir, { recursive: true, force: true });
  }
  if (mockMemory) {
    await mockMemory.close();
  }
}
