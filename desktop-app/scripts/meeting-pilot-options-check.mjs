import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(appRoot, '..');
const screenshotDir = await fs.mkdtemp(
  path.join(os.tmpdir(), 'meeting-pilot-options-check-'),
);

function log(message) {
  console.log(`[meeting-pilot-options] ${message}`);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-User-Id',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(payload));
}

async function routeDesktopAsrBridge(context) {
  await context.route('http://127.0.0.1:46321/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      'Access-Control-Allow-Headers':
        'Authorization, Content-Type, X-Bridge-Token',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers, body: '' });
      return;
    }

    if (url.pathname === '/pair' && request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({ token: 'meeting-options-test-token' }),
      });
      return;
    }

    if (url.pathname === '/asr/status' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          ready: false,
          liveReady: false,
          finalReady: true,
          modelRoot: '/tmp/personal-ai-asr-fixture',
          engines: {
            appleSpeech: { ready: false, reason: 'not_authorized' },
            sherpaStreaming: { modelReady: false, reason: 'missing_model' },
            funasrFinal: { modelReady: false, reason: 'missing_model' },
            whisperFallback: {
              ready: true,
              modelReady: true,
              whisperBinaryAvailable: true,
            },
          },
          activeSessionId: null,
          activeSessions: [],
          downloadInProgress: false,
          downloadProgress: 0,
        }),
      });
      return;
    }

    if (url.pathname === '/asr/model/ensure' && request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({ ok: true, downloading: true }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      headers,
      body: JSON.stringify({ ok: false, error: 'not_found' }),
    });
  });
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('error', reject);
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

async function startMemoryServiceStub() {
  let runtimeConfig = {
    decisionCenterPushTarget: 'me',
    dreamDigestEnabled: true,
    dreamDigestIntervalDays: 1,
    dreamDigestPushTarget: 'me',
    dreamDigestScheduleType: 'every_x_days',
    outreachEnabled: false,
    outreachIntervalMs: 60000,
    outreachRequireApprovalForManual: true,
    outreachRequireApprovalForReflection: true,
    outreachResultPushTarget: 'me',
    reflectionEnabled: true,
    reflectionHeartbeatMinutes: 15,
    weeklyReportEnabled: true,
    weeklyReportMinMessages: 20,
    weeklyReportPushTarget: 'me',
  };

  const server = http.createServer(async (request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-User-Id',
        'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
        'Access-Control-Allow-Origin': '*',
      });
      response.end();
      return;
    }

    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/api/v1/config' && request.method === 'GET') {
      sendJson(response, 200, runtimeConfig);
      return;
    }

    if (url.pathname === '/api/v1/config' && request.method === 'PUT') {
      const rawBody = await readRequestBody(request);
      runtimeConfig = {
        ...runtimeConfig,
        ...(rawBody ? JSON.parse(rawBody) : {}),
      };
      sendJson(response, 200, runtimeConfig);
      return;
    }

    if (
      url.pathname === '/api/v1/outreach/directory/status' &&
      request.method === 'GET'
    ) {
      sendJson(response, 200, { items: [] });
      return;
    }

    sendJson(response, 404, { error: 'not_found' });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object', 'Memory Service stub 未启动');

  return {
    baseUrl: `http://127.0.0.1:${address.port}/api/v1`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'meeting-pilot-options-browser-'),
  );
  const extensionPath = path.join(repoRoot, 'dist');
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
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
    extensionId: new URL(serviceWorker.url()).host,
    serviceWorker,
  };
}

function buildPageErrorCollector(page) {
  const pageErrors = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error instanceof Error ? error.message : String(error));
  });
  return () => {
    assert.deepEqual(pageErrors, [], `页面脚本异常: ${pageErrors.join('; ')}`);
  };
}

async function saveScreenshot(page, filename) {
  const fullPath = path.join(screenshotDir, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  return fullPath;
}

let launched;
let memoryServiceStub;

try {
  memoryServiceStub = await startMemoryServiceStub();
  launched = await launchExtensionContext();
  const { context, extensionId, serviceWorker } = launched;
  await routeDesktopAsrBridge(context);
  await serviceWorker.evaluate(
    async (envConfig) => {
      await chrome.storage.local.set({ envConfig });
    },
    {
      DECISION_CENTER_PUSH_TARGET: 'me',
      DREAM_DIGEST_INTERVAL_DAYS: 1,
      DREAM_DIGEST_SCHEDULE_TYPE: 'every_x_days',
      DREAM_INSIGHT_PUSH_GROUP_ID: '',
      DREAM_INSIGHT_PUSH_TARGET: 'me',
      FOLLOW_UP_PUSH_GROUP_ID: '',
      FOLLOW_UP_PUSH_TARGET: 'me',
      MEMORY_SERVICE_BASE_URL: memoryServiceStub.baseUrl,
      MEMORY_SERVICE_TIMEOUT: 3000,
      MESSAGE_ANALYSIS_INTERVAL: 120,
      MESSAGE_ANALYSIS_PUSH_GROUP_ID: '',
      MESSAGE_ANALYSIS_PUSH_TARGET: 'me',
      MESSAGE_CONTEXT_WINDOW: 125,
      OPENCLAW_BASE_URL: '',
      OPENCLAW_ENABLED: false,
      OPENCLAW_TIMEOUT_MS: 600000,
      OUTREACH_INTERVAL_MS: 60000,
      OUTREACH_RESULT_PUSH_GROUP_ID: '',
      OUTREACH_RESULT_PUSH_TARGET: 'me',
      SELF_REFLECTION_HEARTBEAT_MINUTES: 15,
      WEEKLY_REPORT_PUSH_GROUP_ID: '',
      WEEKLY_REPORT_PUSH_TARGET: 'me',
    },
  );

  const page = await context.newPage();
  const assertNoPageErrors = buildPageErrorCollector(page);

  log('打开扩展 options 页面');
  await page.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });

  await page
    .locator('#MEETING_PILOT_ENABLED')
    .waitFor({ state: 'attached', timeout: 15000 });
  await page.waitForSelector('#MEETING_PROVIDER_BASE_URL', { timeout: 15000 });
  await page.waitForSelector('#MEETING_PROVIDER_API_KEY', { timeout: 15000 });
  await page.waitForSelector('#MEETING_TRANSCRIBE_MODEL', { timeout: 15000 });
  await page.waitForSelector('#MEETING_MINUTES_API_URL', { timeout: 15000 });

  const headingText = await page
    .locator('h2', { hasText: '会议弹幕' })
    .textContent();
  assert.match(headingText || '', /会议弹幕/);
  const sectionHeadings = await page.locator('h2').allTextContents();
  const meetingSectionIndex = sectionHeadings.findIndex(
    (text) => text.trim() === '会议弹幕',
  );
  const webpageMemorySectionIndex = sectionHeadings.findIndex(
    (text) =>
      ['网页记忆提示控制', '记忆提示控制', 'Memory Lens'].includes(text.trim()),
  );
  assert.ok(meetingSectionIndex >= 0, '未找到会议弹幕板块');
  assert.ok(
    webpageMemorySectionIndex > meetingSectionIndex,
    '网页记忆提示控制板块应位于会议弹幕之后',
  );
  await saveScreenshot(page, 'meeting-pilot-options-section.png');

  log('填写会议弹幕配置并保存');
  const providerUrl = 'https://whisper.example.test';
  const providerKey = 'meeting-provider-key';
  const transcribeModel = 'whisper-test-model';
  const minutesApiUrl = 'https://minutes.example.test';

  const enableToggle = page.locator('#MEETING_PILOT_ENABLED');
  if (!(await enableToggle.isChecked())) {
    await enableToggle.check({ force: true });
  }
  await page.waitForFunction(() => {
    const text = document.body.textContent || '';
    return (
      text.includes('Local ASR can transcribe now') &&
      text.includes('Live: No live engine') &&
      text.includes('Final: Whisper fallback ready')
    );
  });
  await page.locator('#MEETING_PROVIDER_BASE_URL').fill(providerUrl);
  await page.locator('#MEETING_PROVIDER_API_KEY').fill(providerKey);
  await page.locator('#MEETING_TRANSCRIBE_MODEL').fill(transcribeModel);
  await page.locator('#MEETING_MINUTES_API_URL').fill(minutesApiUrl);
  await page.locator('button.save-button').click();

  await page.waitForFunction(() => {
    const status = document.querySelector('.status-message');
    return status && /配置已保存/.test(status.textContent || '');
  });

  const storedConfig = await page.evaluate(async () => {
    const result = await chrome.storage.local.get(['envConfig']);
    return result.envConfig;
  });

  assert.equal(
    storedConfig.MEETING_PILOT_ENABLED,
    true,
    'MEETING_PILOT_ENABLED 未写入',
  );
  assert.equal(
    storedConfig.MEETING_FEATURE_ENABLED,
    true,
    'MEETING_FEATURE_ENABLED 未镜像',
  );
  assert.equal(
    storedConfig.MEETING_PROVIDER_BASE_URL,
    providerUrl,
    'MEETING_PROVIDER_BASE_URL 未写入',
  );
  assert.equal(
    storedConfig.MEETING_PROVIDER_API_KEY,
    providerKey,
    'MEETING_PROVIDER_API_KEY 未写入',
  );
  assert.equal(
    storedConfig.MEETING_TRANSCRIBE_MODEL,
    transcribeModel,
    'MEETING_TRANSCRIBE_MODEL 未写入',
  );
  assert.equal(
    storedConfig.MEETING_MINUTES_API_URL,
    minutesApiUrl,
    'MEETING_MINUTES_API_URL 未写入',
  );
  assert.equal(
    storedConfig.MEETING_DIGEST_API_BASE_URL,
    minutesApiUrl,
    'MEETING_DIGEST_API_BASE_URL 未镜像',
  );

  await saveScreenshot(page, 'meeting-pilot-options-saved.png');
  assertNoPageErrors();
  await page.close();

  log(`验证通过，截图目录: ${screenshotDir}`);
} finally {
  if (launched?.context) {
    await launched.context.close();
  }
  if (memoryServiceStub) {
    await memoryServiceStub.close();
  }
}
