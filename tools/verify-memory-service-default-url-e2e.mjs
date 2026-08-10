import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const extensionPath = path.join(repoRoot, 'dist');
const userDataDir = await fs.mkdtemp(
  path.join(os.tmpdir(), 'personal-ai-memory-service-default-url-'),
);
const expectedBaseUrl = 'http://10.32.56.212:3210/api/v1';
const memoryRequests = [];

function jsonResponse(body) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: true,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

try {
  await context.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = request.url();
    const pathname = new URL(url).pathname;
    memoryRequests.push({ method: request.method(), url });

    if (
      request.method() === 'POST' &&
      pathname.endsWith('/outreach/sessions/from-message')
    ) {
      await route.fulfill(
        jsonResponse({
          session: {
            id: 'message-reaction-default-url',
            originKind: 'message_reaction',
            status: 'waiting_reply',
          },
          created: true,
        }),
      );
      return;
    }

    if (pathname.endsWith('/glip-message-markers')) {
      await route.fulfill(jsonResponse({ items: [], generatedAt: 0 }));
      return;
    }

    await route.fulfill(jsonResponse({}));
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', {
      timeout: 15_000,
    });
  }
  const extensionId = new URL(serviceWorker.url()).host;

  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      userinfo: { username: 'default.url.verify' },
    });
  });

  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'domcontentloaded',
  });
  await optionsPage.waitForFunction(
    (expected) =>
      document.querySelector('#MEMORY_SERVICE_BASE_URL')?.value === expected,
    expectedBaseUrl,
    { timeout: 10_000 },
  );

  const response = await optionsPage.evaluate(
    () =>
      new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'CREATE_OUTREACH_FROM_MESSAGE',
            data: {
              chatId: 'chat-default-url',
              postId: 'post-default-url',
              messageText: 'Please confirm the release owner.',
              senderName: 'Default URL Verify',
              informationGoal: '确认发布负责人',
              followupIntervalSeconds: 86400,
              maxFollowup: 1,
            },
          },
          resolve,
        );
      }),
  );

  assert.equal(response?.success, true, JSON.stringify(response));
  const createRequest = memoryRequests.find(({ method, url }) => {
    const pathname = new URL(url).pathname;
    return (
      method === 'POST' && pathname.endsWith('/outreach/sessions/from-message')
    );
  });
  assert.ok(
    createRequest,
    'Expected the background to create an Outreach session',
  );
  assert.equal(
    createRequest.url,
    `${expectedBaseUrl}/outreach/sessions/from-message`,
  );
  assert.equal(
    memoryRequests.some(({ url }) => url.startsWith('http://localhost:3210/')),
    false,
    'No Memory Service request should fall back to localhost when envConfig is missing',
  );

  console.log(
    'verify-memory-service-default-url-e2e: Options and background request defaults match',
  );
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
