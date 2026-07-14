import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;

async function launchExtensionContext() {
  const extensionPath = path.resolve('dist');
  await fs.access(extensionPath);
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'personal-ai-meeting-live-map-'),
  );
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    timeout: 300000,
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
  };
}

let launched;

try {
  launched = await launchExtensionContext();
  const { context, extensionId } = launched;
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => {
    pageErrors.push(
      error instanceof Error ? error.stack || error.message : String(error),
    );
  });

  await page.goto(
    `chrome-extension://${extensionId}/meeting-live-map.html?demo=1`,
    {
      waitUntil: 'load',
      timeout: 30000,
    },
  );
  await page.getByText('Alerts and Context').waitFor({ timeout: 15000 });
  const scopeReceipt = page.getByLabel('Live Map 提醒可见口径回执');
  await scopeReceipt.waitFor({ timeout: 15000 });
  const scopeText =
    (await scopeReceipt.textContent())?.replace(/\s+/g, ' ') || '';
  assert.match(scopeText, /Visible alert scope/);
  assert.match(scopeText, /显示 2 条可操作会中提醒/);
  assert.match(scopeText, /降噪 1 条纯上下文刷新/);
  assert.match(scopeText, /当前页面可见切片/);
  assert.match(scopeText, /不会标记提醒已处理/);
  assert.equal(
    await page.locator('.alert', { hasText: 'Current speaker updated' }).count(),
    0,
    'Live Map should not surface pure context-refresh alerts as reminders',
  );
  const receipt = page.getByLabel('Live Map 会中提醒边界回执').first();
  await receipt.waitFor({ timeout: 15000 });

  const receiptText = (await receipt.textContent())?.replace(/\s+/g, ' ') || '';
  assert.match(receiptText, /为什么/);
  assert.match(receiptText, /下一步/);
  assert.match(receiptText, /边界/);
  assert.match(receiptText, /信号/);
  assert.match(receiptText, /owner|deadline/);
  assert.match(receiptText, /行动项页/);
  assert.match(receiptText, /不会自动进入跟进清单/);
  assert.match(receiptText, /外部任务系统/);
  assert.match(receiptText, /新近信号|较旧信号|信号时间未知/);
  assert.match(receiptText, /依据句|记忆召回|共享画面|会中摘要/);

  assert.equal(pageErrors.length, 0, pageErrors.join('\n\n'));
  console.log('verify-meeting-live-map-e2e: ok');
} finally {
  if (launched) {
    await launched.context.close();
  }
}
