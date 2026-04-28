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
  path.join(os.tmpdir(), 'meeting-pilot-real-site-'),
);

const meetingUrl = 'https://v.ringcentral.com/conf/on/299746567';
const minutesBaseUrl = 'https://minutes.example.test';

function log(message) {
  console.log(`[meeting-pilot-real-site] ${message}`);
}

async function saveScreenshot(page, filename) {
  const fullPath = path.join(screenshotDir, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  return fullPath;
}

async function clickOverlayButton(page, buttonText) {
  const entryBox = await page.evaluate(() => {
    const shadow = document.getElementById(
      'meeting-pilot-overlay-root',
    )?.shadowRoot;
    const target = shadow?.querySelector('#mpEntry');
    if (!(target instanceof HTMLElement)) {
      return null;
    }
    const rect = target.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  });

  assert(entryBox, '未找到 overlay radar 入口');
  await page.mouse.move(entryBox.x, entryBox.y);
  await page.waitForTimeout(300);

  const box = await page.evaluate((text) => {
    const shadow = document.getElementById(
      'meeting-pilot-overlay-root',
    )?.shadowRoot;
    const target = Array.from(shadow?.querySelectorAll('button') || []).find(
      (el) => (el.textContent || '').trim() === text,
    );
    if (!(target instanceof HTMLElement)) {
      return null;
    }
    const rect = target.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }, buttonText);

  assert(box, `未找到 overlay 按钮: ${buttonText}`);
  await page.mouse.click(box.x, box.y);
}

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'meeting-pilot-real-site-browser-'),
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

let launched;

try {
  launched = await launchExtensionContext();
  const { context, extensionId, serviceWorker } = launched;

  await serviceWorker.evaluate(
    (configuredBaseUrl) =>
      chrome.storage.local.set({
        envConfig: {
          MEETING_PILOT_ENABLED: true,
          MEETING_FEATURE_ENABLED: true,
          MEETING_MINUTES_API_URL: configuredBaseUrl,
          MEETING_DIGEST_API_BASE_URL: configuredBaseUrl,
          MEETING_PROVIDER_BASE_URL: configuredBaseUrl,
          MEETING_PROVIDER_API_KEY: 'real-site-provider-key',
          MEETING_TRANSCRIBE_MODEL: 'whisper-1',
          LLM_TYPE: 'openai',
          OPENAI_API_KEY: 'real-site-openai-key',
          OPENAI_MODEL: 'gpt-5.4-mini',
          MEETING_MEMORY_CONTEXT_ENABLED: true,
          MEMORY_SERVICE_BASE_URL: configuredBaseUrl,
        },
      }),
    minutesBaseUrl,
  );

  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === minutesBaseUrl) {
      if (url.pathname === '/v1/models') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({
            data: [{ id: 'whisper-1' }, { id: 'gpt-5.4-mini' }],
          }),
        });
        return;
      }
      if (url.pathname === '/health') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ status: 'ok' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.continue();
  });

  const page = await context.newPage();

  log('打开真实 RingCentral meeting 页面');
  await page.goto(meetingUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForTimeout(6000);

  const joinButton = page.getByRole('button', { name: 'Join' });
  if (await joinButton.isVisible().catch(() => false)) {
    log('页面处于 pre-join，点击 Join 进入真实 meeting DOM');
    await joinButton.click();
    await page.waitForTimeout(8000);
  }

  await page.waitForFunction(
    () =>
      Boolean(
        document.getElementById('meeting-pilot-overlay-root')?.shadowRoot,
      ),
    undefined,
    { timeout: 30000 },
  );

  await saveScreenshot(page, 'real-site-overlay-before.png');

  const before = await page.evaluate(() => {
    const shadow = document.getElementById(
      'meeting-pilot-overlay-root',
    )?.shadowRoot;
    return {
      headerClass: shadow?.querySelector('.tooltip-header')?.className || '',
      titleText:
        shadow?.querySelector('#mpTopicTitle')?.textContent?.trim() || '',
      idleButtonText:
        shadow?.querySelector('#mpIdlePrimaryAction')?.textContent?.trim() ||
        '',
      buttons: shadow
        ? Array.from(shadow.querySelectorAll('button')).map((el) =>
            el.textContent?.trim(),
          )
        : [],
    };
  });

  assert(before.buttons.includes('📋 面板'), '真实页 overlay 未出现 面板 按钮');
  assert(
    before.buttons.includes('开始 Capture'),
    '真实页 overlay 未出现 Capture 按钮',
  );

  log('点击 overlay 面板按钮，验证不会再弹新窗口');
  const pageCountBeforePanel = context.pages().length;
  await clickOverlayButton(page, '📋 面板');
  await page.waitForTimeout(2500);
  const pageCountAfterPanel = context.pages().length;
  assert.equal(
    pageCountAfterPanel,
    pageCountBeforePanel,
    '点击 overlay 面板后仍然打开了新的扩展窗口/标签页',
  );

  log('点击 overlay Capture 按钮，验证不再停留在原始授权文案');
  await clickOverlayButton(page, '开始 Capture');
  await page.waitForTimeout(4000);

  const afterCapture = await page.evaluate(() => {
    const shadow = document.getElementById(
      'meeting-pilot-overlay-root',
    )?.shadowRoot;
    return {
      headerClass: shadow?.querySelector('.tooltip-header')?.className || '',
      statusText:
        shadow?.querySelector('#mpStatusText')?.textContent?.trim() || '',
      titleText:
        shadow?.querySelector('#mpTopicTitle')?.textContent?.trim() || '',
      idleButtonText:
        shadow?.querySelector('#mpIdlePrimaryAction')?.textContent?.trim() ||
        '',
      topicMeta:
        shadow?.querySelector('#mpTopicMeta')?.textContent?.trim() || '',
    };
  });

  assert.notEqual(
    afterCapture.titleText,
    '授权并开启 Capture',
    '点击真实页 Capture 后，overlay 仍停留在原始授权文案',
  );
  assert.notEqual(
    afterCapture.idleButtonText,
    '开始 Capture',
    '点击真实页 Capture 后，按钮仍然保持原始开始文案',
  );

  await saveScreenshot(page, 'real-site-overlay-after-capture-click.png');

  log('打开真实会话的 sidepanel 页面，验证页面已绑定到实际会议');
  const currentMeetingUrl = page.url();
  const meetingTabId = await serviceWorker.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    return (
      tabs.find(
        (tab) =>
          (tab.url || '').includes(url) ||
          (tab.url || '').includes('https://v.ringcentral.com/conf/on/'),
      )?.id ?? null
    );
  }, currentMeetingUrl);
  assert.ok(
    Number.isFinite(meetingTabId),
    `真实站点验证未找到会议 tabId: ${String(meetingTabId)}`,
  );
  const sidePanelPage = await context.newPage();
  await sidePanelPage.goto(
    `chrome-extension://${extensionId}/meeting-sidepanel.html?tabId=${meetingTabId}`,
    { waitUntil: 'domcontentloaded', timeout: 30000 },
  );
  await sidePanelPage.waitForFunction(
    () => {
      const shell = document.querySelector('.meeting-shell');
      return Boolean(shell && shell.getAttribute('data-session-title'));
    },
    { timeout: 15000 },
  );
  const sidePanelTitle = await sidePanelPage
    .locator('.meeting-shell')
    .getAttribute('data-session-title');
  assert.ok(sidePanelTitle, '真实 sidepanel 未绑定到实际会议状态');

  await saveScreenshot(sidePanelPage, 'real-site-sidepanel-bound.png');

  log(`真实页验证通过，截图目录: ${screenshotDir}`);
} finally {
  await launched?.context?.close().catch(() => undefined);
}
