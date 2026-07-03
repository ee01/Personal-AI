import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionPath = path.join(repoRoot, 'dist');

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'notification-digest-options-'),
  );
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 980 },
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
    userDataDir,
  };
}

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error instanceof Error ? error.message : String(error));
  });
  return () => {
    assert.deepEqual(errors, [], `Options page errors: ${errors.join('; ')}`);
  };
}

const runtimeConfig = {
  dreamDigestEnabled: false,
  dreamDigestScheduleType: 'every_x_days',
  dreamDigestIntervalDays: 1,
  dreamDigestPushTarget: 'none',
  dreamDigestPushGroupId: '',
  weeklyReportEnabled: true,
  weeklyReportCron: '0 18 * * 5',
  weeklyReportMinMessages: 3,
  weeklyReportPushTarget: 'group',
  weeklyReportPushGroupId: 'team-weekly-1',
  reflectionEnabled: true,
  reflectionHeartbeatMinutes: 15,
  decisionCenterPushTarget: 'me',
  decisionCenterPushGroupId: '',
  openClawEnabled: false,
  openClawBaseUrl: '',
  openClawTimeoutMs: 600000,
};

const weeklyRequests = [];
const dreamRequests = [];

let launched;

try {
  launched = await launchExtensionContext();
  const { context, extensionId, serviceWorker } = launched;

  await context.route('http://mock-memory/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (request.method() === 'GET' && pathname.endsWith('/config')) {
      await route.fulfill(jsonResponse(runtimeConfig));
      return;
    }

    if (
      request.method() === 'GET' &&
      pathname.endsWith('/outreach/directory/status')
    ) {
      await route.fulfill(jsonResponse({ items: [] }));
      return;
    }

    if (
      request.method() === 'POST' &&
      pathname.endsWith('/dream-digest/push-now')
    ) {
      const payload = request.postDataJSON();
      dreamRequests.push(payload);
      await wait(250);
      await route.fulfill(
        jsonResponse({
          generated: true,
          delivered: false,
          notificationCreated: false,
          botSent: false,
          pushTarget: 'none',
          dreamCount: 2,
          latestDreamPath: 'dreams/current-launch-2026-06-22.md',
        }),
      );
      return;
    }

    if (
      request.method() === 'POST' &&
      pathname.endsWith('/weekly-report/push-now')
    ) {
      const payload = request.postDataJSON();
      weeklyRequests.push(payload);
      await wait(250);
      await route.fulfill(
        jsonResponse({
          generated: true,
          reportPath: 'reports/weekly-manual-2026-06-22.md',
          messageCount: 42,
          reflectionCount: 3,
          notificationCreated: true,
          botSent: false,
          botError: 'bot_not_configured',
          pushTarget: 'group',
        }),
      );
      return;
    }

    await route.fulfill(jsonResponse({}));
  });

  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.set({
      envConfig: {
        MEMORY_SERVICE_BASE_URL: 'http://mock-memory/api/v1',
        MEMORY_SERVICE_TIMEOUT: 3000,
        DREAM_DIGEST_INTERVAL_DAYS: 1,
        DREAM_DIGEST_SCHEDULE_TYPE: 'every_x_days',
        DREAM_INSIGHT_PUSH_TARGET: 'none',
        DREAM_INSIGHT_PUSH_GROUP_ID: '',
        WEEKLY_REPORT_CRON: '0 18 * * 5',
        WEEKLY_REPORT_MIN_MESSAGES: 3,
        WEEKLY_REPORT_PUSH_TARGET: 'group',
        WEEKLY_REPORT_PUSH_GROUP_ID: 'team-weekly-1',
        DECISION_CENTER_PUSH_TARGET: 'me',
        DECISION_CENTER_PUSH_GROUP_ID: '',
        OUTREACH_RESULT_PUSH_TARGET: 'me',
        OUTREACH_RESULT_PUSH_GROUP_ID: '',
        SELF_REFLECTION_ENABLED: true,
        SELF_REFLECTION_HEARTBEAT_MINUTES: 15,
        OPENCLAW_ENABLED: false,
        OPENCLAW_BASE_URL: '',
        OPENCLAW_TIMEOUT_MS: 600000,
      },
    });
  });

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);

  await page.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });

  await page.locator('#DREAM_DIGEST_SCHEDULE_TYPE').waitFor({
    timeout: 15000,
  });
  await page.locator('#WEEKLY_REPORT_CRON').waitFor({ timeout: 15000 });
  const dreamSection = page.locator('.form-group', {
    has: page.locator('#DREAM_DIGEST_SCHEDULE_TYPE'),
  });
  await page.locator('#DREAM_INSIGHT_PUSH_TARGET').selectOption('group');
  await page.locator('#DREAM_INSIGHT_PUSH_GROUP_ID').fill('');
  await dreamSection.locator('button', { hasText: '立即推送' }).click();
  const dreamBlockedReceipt = dreamSection.locator('.digest-push-receipt', {
    hasText: 'Dream Digest 手动门禁',
  });
  await dreamBlockedReceipt.waitFor({ timeout: 10000 });
  assert.equal(
    await dreamBlockedReceipt.getAttribute('data-delivery-state'),
    'blocked',
    'Dream Digest should block group-target manual pushes without a visible group id',
  );
  await dreamSection
    .locator('.digest-push-receipt', {
      hasText: '自定义群组（未填写 ID）',
    })
    .waitFor({ timeout: 10000 });
  await dreamSection
    .locator('.digest-push-receipt', {
      hasText: '后端未收到 Dream Digest 生成请求',
    })
    .waitFor({ timeout: 10000 });
  await dreamSection
    .locator('.digest-push-receipt', {
      hasText: '不会请求后端生成 Dream Digest',
    })
    .waitFor({ timeout: 10000 });
  assert.deepEqual(
    dreamRequests,
    [],
    'blocked Dream Digest request should not call the backend',
  );

  await page.locator('#DREAM_INSIGHT_PUSH_TARGET').selectOption('none');
  await page.locator('#WEEKLY_REPORT_PUSH_TARGET').selectOption('group');
  await page.locator('#WEEKLY_REPORT_PUSH_GROUP_ID').fill('team-weekly-1');
  assert.equal(
    await page.locator('#DREAM_INSIGHT_PUSH_TARGET').inputValue(),
    'none',
  );
  assert.equal(
    await page.locator('#WEEKLY_REPORT_PUSH_TARGET').inputValue(),
    'group',
  );

  await dreamSection.locator('button', { hasText: '立即推送' }).click();
  const dreamPendingReceipt = page.locator('.digest-push-receipt', {
    hasText: 'Dream Digest 手动请求',
  });
  await dreamPendingReceipt.waitFor({ timeout: 10000 });
  assert.equal(
    await dreamPendingReceipt.getAttribute('data-delivery-state'),
    'pending',
    'Dream Digest should replace stale results with a pending receipt immediately',
  );
  await page
    .locator('.digest-push-receipt', {
      hasText: '请求已提交',
    })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.digest-push-receipt', {
      hasText: '本次不会请求通知写入',
    })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.digest-push-receipt', {
      hasText: '使用当前可见目标“不推送”',
    })
    .waitFor({ timeout: 10000 });
  const dreamReceipt = page.locator('.digest-push-receipt', {
    hasText: 'Dream Digest 手动结果',
  });
  await page
    .locator('.digest-push-receipt', { hasText: 'Dream Digest 手动结果' })
    .waitFor({ timeout: 10000 });
  assert.equal(
    await dreamReceipt.getAttribute('data-delivery-state'),
    'generated',
    'Dream Digest none-target generation should not look like a delivery failure',
  );
  await page
    .locator('.digest-push-receipt', {
      hasText: '未请求通知写入',
    })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.digest-push-receipt', {
      hasText: '纳入 2 个 dream',
    })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.digest-push-receipt', {
      hasText: '不写入通知中心、不发送 Bot/Chrome/Doubao',
    })
    .waitFor({ timeout: 10000 });

  const weeklySection = page.locator('.form-section', {
    has: page.locator('#WEEKLY_REPORT_CRON'),
  });
  await weeklySection.locator('#WEEKLY_REPORT_PUSH_GROUP_ID').fill('');
  await weeklySection
    .locator('button', { hasText: '立即推送周报' })
    .click();
  const weeklyBlockedReceipt = weeklySection.locator('.digest-push-receipt', {
    hasText: '周报手动门禁',
  });
  await weeklyBlockedReceipt.waitFor({ timeout: 10000 });
  assert.equal(
    await weeklyBlockedReceipt.getAttribute('data-delivery-state'),
    'blocked',
    'Weekly report should use the current cleared group id instead of a saved fallback',
  );
  await weeklySection
    .locator('.digest-push-receipt', {
      hasText: '自定义群组（未填写 ID）',
    })
    .waitFor({ timeout: 10000 });
  await weeklySection
    .locator('.digest-push-receipt', {
      hasText: '后端未收到周报生成请求',
    })
    .waitFor({ timeout: 10000 });
  await weeklySection
    .locator('.digest-push-receipt', {
      hasText: '不会请求后端生成周报',
    })
    .waitFor({ timeout: 10000 });
  assert.deepEqual(
    weeklyRequests,
    [],
    'blocked weekly report request should not reuse the previous saved group id',
  );

  await weeklySection
    .locator('#WEEKLY_REPORT_PUSH_GROUP_ID')
    .fill('team-weekly-1');
  await weeklySection
    .locator('button', { hasText: '立即推送周报' })
    .click();
  const weeklyPendingReceipt = page.locator('.digest-push-receipt', {
    hasText: '周报手动请求',
  });
  await weeklyPendingReceipt.waitFor({ timeout: 10000 });
  assert.equal(
    await weeklyPendingReceipt.getAttribute('data-delivery-state'),
    'pending',
    'Weekly report should expose the submitted target before backend result arrives',
  );
  await page
    .locator('.digest-push-receipt', {
      hasText: '自定义群组 team-weekly-1',
    })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.digest-push-receipt', {
      hasText: '等待后端确认 notice 写入',
    })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.digest-push-receipt', {
      hasText: '不会改变自动调度',
    })
    .waitFor({ timeout: 10000 });
  const weeklyReceipt = page.locator('.digest-push-receipt', {
    hasText: '周报手动结果',
  });
  await page
    .locator('.digest-push-receipt', { hasText: '周报手动结果' })
    .waitFor({ timeout: 10000 });
  assert.equal(
    await weeklyReceipt.getAttribute('data-delivery-state'),
    'partial_delivery',
    'Weekly report with Bot delivery failure should be marked partial delivery',
  );
  await page
    .locator('.digest-push-receipt', {
      hasText: '已生成，投递部分失败',
    })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.digest-push-receipt', {
      hasText: '通知中心 notice 已写入',
    })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.digest-push-receipt', {
      hasText: 'Bot 未送达：bot_not_configured',
    })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.digest-push-receipt', {
      hasText: '文件 reports/weekly-manual-2026-06-22.md · 消息 42 · 反思 3',
    })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.digest-push-receipt', {
      hasText: '不会自动点击、忽略或完成通知',
    })
    .waitFor({ timeout: 10000 });

  assert.deepEqual(dreamRequests, [
    {
      force: true,
      dreamDigestPushTarget: 'none',
    },
  ]);
  assert.deepEqual(weeklyRequests, [
    {
      force: true,
      weeklyReportPushTarget: 'group',
      weeklyReportPushGroupId: 'team-weekly-1',
    },
  ]);

  assertNoPageErrors();
  console.log('verify-notification-digest-push-options-e2e: ok');
} finally {
  if (launched?.context) {
    await launched.context.close();
  }
  if (launched?.userDataDir) {
    await fs.rm(launched.userDataDir, { recursive: true, force: true });
  }
}
