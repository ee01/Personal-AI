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
  path.join(os.tmpdir(), 'meeting-pilot-panorama-check-'),
);

function log(message) {
  console.log(`[meeting-pilot-panorama] ${message}`);
}

async function saveScreenshot(page, filename) {
  const fullPath = path.join(screenshotDir, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  return fullPath;
}

async function launchExtensionContext() {
  const extensionPath = path.join(repoRoot, 'dist');
  await fs.access(extensionPath);
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'meeting-pilot-panorama-browser-'),
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
    pageErrors.push(error instanceof Error ? error.stack || error.message : String(error));
  });

  log('打开 Panorama demo 页');
  await page.goto(`chrome-extension://${extensionId}/meeting-panorama.html?demo=1`, {
    waitUntil: 'load',
    timeout: 30000,
  });
  await page.waitForSelector('.followup-readiness', { timeout: 15000 });
  await page.waitForSelector('.action-list .action-item', { timeout: 15000 });

  const state = await page.evaluate(() => {
    const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
    return {
      followupState:
        document
          .querySelector('.followup-readiness')
          ?.getAttribute('data-followup-state') || '',
      followupText: normalize(
        document.querySelector('.followup-readiness')?.textContent,
      ),
      actionStat: normalize(
        Array.from(document.querySelectorAll('.stat-card')).find((node) =>
          /行动项/.test(node.textContent || ''),
        )?.textContent,
      ),
      actionCount: document.querySelectorAll('.action-list .action-item').length,
    };
  });

  assert.equal(state.followupState, 'needs-review');
  assert.match(state.followupText, /会后跟进状态|跟进清单可交付度/);
  assert.match(state.followupText, /3\s*待复核/);
  assert.match(state.followupText, /复制跟进清单/);
  assert.match(state.actionStat, /3\s*待复核\s*·\s*0\s*已确认\s*·\s*1\s*已完成/);
  assert.equal(state.actionCount, 4);

  log('验证跟进清单复制反馈');
  await page.locator('.followup-copy').click();
  await page.waitForFunction(
    () => /已复制/.test(document.querySelector('.followup-copy-state')?.textContent || ''),
    { timeout: 5000 },
  );
  await saveScreenshot(page, 'panorama-followup-readiness.png');

  assert.deepEqual(pageErrors, [], `页面脚本异常: ${pageErrors.join('\n\n')}`);
  log(`Panorama 跟进状态 E2E 验证通过，截图目录: ${screenshotDir}`);
  await page.close();
} finally {
  await launched?.context?.close().catch(() => undefined);
}
