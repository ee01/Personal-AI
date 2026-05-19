import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const extensionPath = path.join(repoRoot, 'dist');

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'task-scheduler-popup-e2e-browser-'),
  );
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
    userDataDir,
  };
}

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error instanceof Error ? error.message : String(error));
  });
  return () => {
    assert.deepEqual(
      errors,
      [],
      `Task scheduler popup page errors: ${errors.join('; ')}`,
    );
  };
}

async function visibleTaskNames(page) {
  return page.locator('.task-row .task-name').evaluateAll((nodes) =>
    nodes
      .map((node) => node.textContent?.trim() || '')
      .filter(Boolean),
  );
}

let launched;

try {
  launched = await launchExtensionContext();
  const { context, extensionId, serviceWorker } = launched;
  const now = Date.now();

  await serviceWorker.evaluate(async ({ now }) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      envConfig: {
        MEMORY_SERVICE_BASE_URL: 'https://memory.local/api/v1',
        MESSAGE_ANALYSIS_INTERVAL: 30,
      },
      userinfo: {
        username: 'popup.verify',
        fullName: 'Popup Verify',
      },
      taskSchedulerStates: {
        message_analysis: { enabled: false },
        memory_sync: {
          enabled: true,
          lastSuccess: true,
          lastCompletedAt: now - 20_000,
          lastSkippedAt: now - 1_000,
          lastSkipReason: '任务 记忆系统同步 正在执行，跳过重复触发',
        },
        system_monitoring: {
          enabled: true,
          lastSuccess: false,
          lastCompletedAt: now - 30_000,
          lastError: 'memory service unavailable',
          runHistory: [
            {
              startedAt: now - 30_500,
              completedAt: now - 30_000,
              durationMs: 500,
              success: false,
              trigger: 'manual',
              error: 'memory service unavailable',
            },
            {
              startedAt: now - 60_500,
              completedAt: now - 60_000,
              durationMs: 500,
              success: false,
              trigger: 'scheduled',
              error: 'memory service unavailable',
            },
            {
              startedAt: now - 90_500,
              completedAt: now - 90_000,
              durationMs: 500,
              success: false,
              trigger: 'scheduled',
              error: 'memory service unavailable',
            },
          ],
        },
        user_profile_decay: {
          enabled: true,
          lastSuccess: true,
          lastCompletedAt: now - 40_000,
        },
        vectorized_data_maintenance: { enabled: true },
        user_summary_generation: { enabled: true },
        vector_quality_check: { enabled: true },
        digest_queue_process: { enabled: true },
      },
    });
  }, { now });

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);
  await page.route('https://memory.local/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief: { cards: [] } }),
    });
  });

  await page.goto(`chrome-extension://${extensionId}/popup.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  await page.locator('.task-status-panel summary').click();
  const refreshMeta = page.locator('.task-refresh-meta');
  await refreshMeta.waitFor({ timeout: 15000 });
  assert.match(
    (await refreshMeta.textContent()) || '',
    /刷新 .* · .+/,
    'task scheduler panel should show last refresh time and local timezone',
  );
  await page.locator('.task-health-chip', { hasText: '全部 8' }).waitFor({
    timeout: 15000,
  });
  await page.locator('.task-health-chip', { hasText: '需处理 2' }).waitFor({
    timeout: 15000,
  });
  await page.locator('.task-health-chip', { hasText: '执行中 0' }).waitFor({
    timeout: 15000,
  });
  await page.locator('.task-health-chip', { hasText: '排程异常 0' }).waitFor({
    timeout: 15000,
  });
  await page.locator('.task-health-chip', { hasText: '跳过 1' }).waitFor({
    timeout: 15000,
  });
  await page.locator('.task-health-chip', { hasText: '失败 1' }).waitFor({
    timeout: 15000,
  });
  await page.locator('.task-health-chip', { hasText: '停用 1' }).waitFor({
    timeout: 15000,
  });
  await page
    .locator('.task-next-step.failed', {
      hasText: '系统健康监控 连续失败 3 次',
    })
    .waitFor({ timeout: 15000 });

  await page.locator('.task-health-chip', { hasText: '执行中 0' }).click();
  assert.deepEqual(await visibleTaskNames(page), []);
  await page
    .locator('.task-empty-state', {
      hasText: '当前没有执行中的后台任务',
    })
    .waitFor({ timeout: 15000 });

  await page.locator('.task-health-chip', { hasText: '排程异常 0' }).click();
  assert.deepEqual(await visibleTaskNames(page), []);
  await page
    .locator('.task-empty-state', {
      hasText: '当前没有排程异常',
    })
    .waitFor({ timeout: 15000 });

  await page.locator('.task-health-chip', { hasText: '需处理 2' }).click();
  assert.deepEqual(await visibleTaskNames(page), [
    '系统健康监控',
    '记忆系统同步',
  ]);

  await page.locator('.task-health-chip', { hasText: '失败 1' }).click();
  assert.deepEqual(await visibleTaskNames(page), ['系统健康监控']);
  await page.locator('.task-row', { hasText: 'memory service unavailable' }).waitFor({
    timeout: 15000,
  });
  await page.locator('.task-row', { hasText: '连续失败 3 次' }).waitFor({
    timeout: 15000,
  });
  await page
    .locator('.task-pause-btn', { hasText: '暂停' })
    .waitFor({ timeout: 15000 });

  await page.locator('.task-health-chip', { hasText: '跳过 1' }).click();
  assert.deepEqual(await visibleTaskNames(page), ['记忆系统同步']);

  await page.locator('.task-health-chip', { hasText: '停用 1' }).click();
  assert.deepEqual(await visibleTaskNames(page), ['静默消息分析']);

  await page.locator('.task-health-chip', { hasText: '全部 8' }).click();
  assert.equal((await visibleTaskNames(page)).length, 8);

  assertNoPageErrors();
  await context.close();
  await fs.rm(launched.userDataDir, { recursive: true, force: true });
  console.log('verify-task-scheduler-popup-filters-e2e: ok');
} catch (error) {
  if (launched?.context) await launched.context.close().catch(() => undefined);
  if (launched?.userDataDir) {
    await fs.rm(launched.userDataDir, { recursive: true, force: true }).catch(
      () => undefined,
    );
  }
  throw error;
}
