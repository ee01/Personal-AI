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
    path.join(os.tmpdir(), 'message-analysis-empty-export-e2e-'),
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
      `Message Analysis empty export page errors: ${errors.join('; ')}`,
    );
  };
}

let launched;

try {
  launched = await launchExtensionContext();
  const { context, extensionId, serviceWorker } = launched;

  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      envConfig: {
        MEMORY_SERVICE_BASE_URL: 'http://127.0.0.1:49211/api/v1',
        OPENCLAW_ENABLED: false,
      },
      taskSchedulerStates: {
        message_analysis: { enabled: true },
      },
      userinfo: {
        username: 'empty.export.verify',
        fullName: 'Empty Export Verify',
      },
      concernedItems: [
        {
          id: 'exported-memory-only',
          text: 'Export quiet memory',
          expiredAt: 0,
          filterSender: 'Morgan Lee',
        },
        {
          id: 'outreach:system-not-exported',
          source: 'outreach',
          text: 'Internal system watch item must not export',
          expiredAt: 0,
        },
      ],
    });
  });

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);

  await page.goto(`chrome-extension://${extensionId}/topic-modal.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await page.locator('h2', { hasText: '记忆入口规则' }).waitFor({
    timeout: 15000,
  });
  await page
    .locator('.topic-item', { hasText: 'Export quiet memory' })
    .waitFor({ timeout: 5000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
  await page.locator('button', { hasText: '导出规则' }).click({
    timeout: 5000,
  });
  const download = await downloadPromise;
  assert.match(
    download.suggestedFilename(),
    /^Personal AI - memory-entry-rules \d{4}-\d{2}-\d{2}\.xml$/,
  );

  const exportReceipt = page.locator('.rule-export-receipt');
  await exportReceipt.locator('text=导出规则回执').waitFor({
    timeout: 5000,
  });
  await exportReceipt
    .locator('text=已导出 1 条本机手动规则')
    .waitFor({ timeout: 5000 });
  await exportReceipt
    .locator('text=系统观察规则、Outreach 会话和自我反思临时观察不会进入 XML')
    .waitFor({ timeout: 5000 });

  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.set({ concernedItems: [] });
  });
  await page.reload({ waitUntil: 'load', timeout: 15000 });
  await page.locator('h2', { hasText: '记忆入口规则' }).waitFor({
    timeout: 15000,
  });
  assert.equal(
    await page.locator('.topic-item').count(),
    0,
    'empty export fixture should have no manual rule cards',
  );

  const emptyDownloadPromise = page
    .waitForEvent('download', { timeout: 1500 })
    .catch(() => null);
  await page.locator('button', { hasText: '导出规则' }).click({
    timeout: 5000,
  });
  assert.equal(
    await emptyDownloadPromise,
    null,
    'empty manual-rule export should not download a blank XML file',
  );
  await page
    .locator('.rule-operation-toast.success', {
      hasText: '未生成 XML 文件',
    })
    .waitFor({ timeout: 5000 });
  const emptyExportReceipt = page.locator('.rule-export-receipt');
  await emptyExportReceipt
    .locator('text=导出规则回执 · 无手动规则')
    .waitFor({ timeout: 5000 });
  await emptyExportReceipt
    .locator('text=未生成 XML 文件 · 本机当前没有可导出的手动规则')
    .waitFor({ timeout: 5000 });
  await emptyExportReceipt
    .locator('text=没有下载 XML 文件')
    .waitFor({ timeout: 5000 });
  await emptyExportReceipt
    .locator('text=本机手动规则列表为空')
    .waitFor({ timeout: 5000 });
  await emptyExportReceipt
    .locator('text=没有下载文件，也不会自动分析历史消息')
    .waitFor({ timeout: 5000 });
  await emptyExportReceipt
    .locator('text=没有手动联动操作需要导出')
    .waitFor({ timeout: 5000 });
  await emptyExportReceipt
    .locator('text=没有手动规则需要安全复核')
    .waitFor({ timeout: 5000 });

  assertNoPageErrors();
  console.log('verify-message-analysis-empty-export-e2e: ok');
} finally {
  if (launched?.context) {
    await launched.context.close();
  }
  if (launched?.userDataDir) {
    await fs.rm(launched.userDataDir, { recursive: true, force: true });
  }
}
