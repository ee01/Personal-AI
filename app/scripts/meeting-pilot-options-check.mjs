import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
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

try {
  launched = await launchExtensionContext();
  const { context, extensionId } = launched;

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
    .locator('h2', { hasText: 'Meeting Pilot' })
    .textContent();
  assert.match(headingText || '', /Meeting Pilot/);
  await saveScreenshot(page, 'meeting-pilot-options-section.png');

  log('填写 Meeting Pilot 配置并保存');
  const providerUrl = 'https://whisper.example.test';
  const providerKey = 'meeting-provider-key';
  const transcribeModel = 'whisper-test-model';
  const minutesApiUrl = 'https://minutes.example.test';

  const enableToggle = page.locator('#MEETING_PILOT_ENABLED');
  if (!(await enableToggle.isChecked())) {
    await enableToggle.check({ force: true });
  }
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
}
