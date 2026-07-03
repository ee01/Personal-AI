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
        sendJson(res, {
          items: feedItems,
          total: feedItems.length,
          meta: {
            channel: 'chrome',
            lanes: ['todo', 'notice'],
            deliveryMode: 'retry_after_cooldown',
            limit: 20,
            returned: feedItems.length,
            hasMore: false,
          },
        });
        return;
      }

      if (
        req.method === 'POST' &&
        url.pathname.endsWith('/notification-center/delivery')
      ) {
        const body = await readRequestBody(req);
        deliveryBatches.push(body.events);
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
];

const deliveryBatches = [];
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

  await waitFor(
    () => deliveryBatches.flat().length >= 2,
    'failed and delivered delivery reports',
    70000,
  );

  const deliveries = deliveryBatches.flat();
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
  assert.equal(createCalls.length, 2);
  assert.match(createCalls[0].notificationId, /notif-create-fail/);
  assert.match(createCalls[1].notificationId, /notif-create-ok/);

  console.log(
    '✅ notification channel delivery E2E passed: create failure wrote failed receipt and later item still delivered',
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
