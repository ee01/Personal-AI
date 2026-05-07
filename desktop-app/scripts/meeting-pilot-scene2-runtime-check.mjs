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
  path.join(os.tmpdir(), 'meeting-pilot-scene2-'),
);

const welcomeUrl = 'https://v.ringcentral.com/welcome/join/';
const meetingId = 'fixture-meeting-002';
const meetingUrl = `https://v.ringcentral.com/conf/on/${meetingId}`;
const meetingTitle = 'Fixture RingCentral Runtime Meeting';
const minutesBaseUrl = 'https://minutes.example.test';

const welcomeHtml = `<!doctype html><html><body><button id="startMeetingBtn">Start</button><script>document.getElementById('startMeetingBtn').addEventListener('click',()=>{location.href='${meetingUrl}'})</script></body></html>`;
const meetingHtml = `<!doctype html><html><head><title>${meetingTitle}</title></head><body><button>Leave meeting</button><button>Participants</button><button>Chat</button><button>Notes</button><button aria-label="Alex Chen has a good connection">Alex Chen</button><div>Esone Qiu (You)</div><button aria-label="Sarah Wang has a good connection">Sarah Wang</button><button aria-label="Mike Liu has a good connection">Mike Liu</button></body></html>`;

function log(message) {
  console.log(`[meeting-pilot-scene2] ${message}`);
}

async function saveScreenshot(page, filename) {
  const fullPath = path.join(screenshotDir, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  return fullPath;
}

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'meeting-pilot-scene2-browser-'),
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

let launched;

try {
  launched = await launchExtensionContext();
  const { context, extensionId } = launched;

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
    if (!url.href.startsWith('https://v.ringcentral.com/')) {
      await route.continue();
      return;
    }
    if (route.request().resourceType() !== 'document') {
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    if (url.href === welcomeUrl) {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: welcomeHtml,
      });
      return;
    }
    if (url.href === meetingUrl) {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: meetingHtml,
      });
      return;
    }
    await route.fulfill({ status: 404, body: 'Not found' });
  });

  const page = await context.newPage();
  const settingsPage = await context.newPage();
  await settingsPage.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'load',
  });
  await settingsPage.evaluate(
    async ({ minutesBaseUrl }) => {
      await chrome.storage.local.set({
        envConfig: {
          MEETING_PILOT_ENABLED: true,
          MEETING_FEATURE_ENABLED: true,
          MEETING_AUTO_DETECT: true,
          MEETING_ENTRY_MODE: 'auto',
          MEETING_DIGEST_API_BASE_URL: minutesBaseUrl,
          MEETING_MINUTES_API_URL: minutesBaseUrl,
          MEETING_PROVIDER_BASE_URL: minutesBaseUrl,
          MEETING_PROVIDER_API_KEY: 'fixture-key',
          MEETING_TRANSCRIBE_MODEL: 'whisper-1',
        },
      });
    },
    { minutesBaseUrl },
  );
  await settingsPage.close();

  log('打开会议 fixture 并点击授权 Capture');
  await page.goto(welcomeUrl, { waitUntil: 'load' });
  await page.click('#startMeetingBtn');
  await page.waitForURL(meetingUrl, { timeout: 10000 });
  await page.waitForFunction(() => {
    const host = document.getElementById('meeting-pilot-overlay-root');
    return Boolean(host?.shadowRoot?.getElementById('mpPrimaryAction'));
  });
  await page.evaluate(() => {
    const host = document.getElementById('meeting-pilot-overlay-root');
    const button = host?.shadowRoot?.getElementById('mpPrimaryAction');
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  const panelPage = await context.newPage();
  await panelPage.goto(
    `chrome-extension://${extensionId}/meeting-sidepanel.html?scene2Probe=1`,
    { waitUntil: 'load' },
  );
  const meetingTabId = await panelPage.evaluate(async (targetUrl) => {
    const tabs = await chrome.tabs.query({ url: targetUrl });
    return tabs[0]?.id ?? null;
  }, meetingUrl);
  assert.ok(
    Number.isFinite(meetingTabId),
    '未找到 runtime scene2 的 meeting tab',
  );
  await panelPage.goto(
    `chrome-extension://${extensionId}/meeting-sidepanel.html?tabId=${meetingTabId}&scene2Probe=1`,
    { waitUntil: 'load' },
  );
  await panelPage.waitForFunction(
    () => {
      const shell = document.querySelector('.meeting-shell');
      return Boolean(shell && shell.getAttribute('data-session-title'));
    },
    undefined,
    { timeout: 15000 },
  );

  await panelPage.evaluate(async () => {
    await chrome.runtime.sendMessage({
      type: 'MEETING_PILOT_TEST_SET_API_MOCK',
      enabled: true,
    });
  });

  log('通过真实 START_CAPTURE + panel open path 启动 Capture');
  const startResult = await panelPage.evaluate(
    async ({ meetingId, tabId, title, url }) => {
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_TEST_SET_SIDE_PANEL_FAILURE',
        enabled: true,
      });
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'MEETING_PILOT_ENABLE_CAPTURE_AND_OPEN_PANEL',
          meetingId,
          tabId,
          title,
          url,
          source: 'overlay',
        });
        return response ?? { success: false, error: 'empty_response' };
      } catch (error) {
        return {
          success: false,
          error: String(error?.message || error),
          lastError: chrome.runtime.lastError?.message,
        };
      } finally {
        await chrome.runtime.sendMessage({
          type: 'MEETING_PILOT_TEST_SET_SIDE_PANEL_FAILURE',
          enabled: false,
        });
      }
    },
    { meetingId, tabId: meetingTabId, title: meetingTitle, url: meetingUrl },
  );
  assert.equal(
    startResult?.success,
    true,
    `真实 START_CAPTURE 未成功: ${JSON.stringify(startResult)}`,
  );
  assert.ok(
    ['embedded', 'side-panel', 'window'].includes(startResult?.surface),
    `启动 Capture 后未打开有效面板 surface: ${String(startResult?.surface)}`,
  );
  assert.ok(
    ['armed', 'recording', 'uploading', 'completed'].includes(
      startResult?.session?.capture?.kind,
    ),
    `打开面板后 capture 未进入有效状态: ${String(
      startResult?.session?.capture?.kind,
    )}`,
  );

  await panelPage.evaluate(
    async ({ meetingId }) => {
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_TEST_INJECT_CAPTURE_CHUNK',
        text: `recording for ${meetingId}`,
      });
    },
    { meetingId },
  );

  log('注入 transcript update，验证真实结构化链路');
  const transcriptChunks = [
    {
      id: 'scene2-t1',
      speaker: 'Alex Chen',
      text: '今天先讨论 Q2 预算，然后看技术评审 owner。',
      ts: Date.now() - 30000,
    },
    {
      id: 'scene2-t2',
      speaker: 'Sarah Wang',
      text: 'Sprint 8 排期已拉通，QA 资源需要我来跟进。',
      ts: Date.now() - 20000,
    },
    {
      id: 'scene2-t3',
      speaker: 'Alex Chen',
      text: '决定由 Esone 负责 Meeting Pilot 技术评审，DDL 下周三。',
      ts: Date.now() - 10000,
    },
  ];

  for (const transcriptChunk of transcriptChunks) {
    await panelPage.evaluate(
      async ({ tabId, transcriptChunk }) => {
        await chrome.runtime.sendMessage({
          type: 'MEETING_PILOT_TRANSCRIPT_UPDATE',
          tabId,
          transcriptChunk,
        });
      },
      { tabId: meetingTabId, transcriptChunk },
    );
  }

  await panelPage.locator('.panel-tab', { hasText: '时间线' }).click();
  await panelPage.waitForFunction(
    () => {
      return Array.from(document.querySelectorAll('.mini-tl-item')).length >= 2;
    },
    { timeout: 15000 },
  );
  await panelPage.locator('.panel-tab', { hasText: '行动项' }).click();
  await panelPage.waitForFunction(
    () => {
      return Array.from(document.querySelectorAll('.action-card')).length >= 1;
    },
    { timeout: 15000 },
  );
  const actionText = await panelPage
    .locator('.action-card')
    .first()
    .innerText();
  assert.match(
    actionText,
    /Esone|Sarah Wang/,
    `行动项未展示明确 owner: ${actionText}`,
  );
  assert.match(
    actionText,
    /依据：/,
    `行动项未展示 transcript 依据: ${actionText}`,
  );
  assert.match(actionText, /待复核/, `行动项未进入用户复核状态: ${actionText}`);
  const firstActionId = await panelPage
    .locator('.action-card')
    .first()
    .getAttribute('data-action-id');
  assert.ok(firstActionId, '行动项卡片缺少稳定 data-action-id');
  await panelPage
    .locator('.action-copy-all', { hasText: '复制当前筛选' })
    .click();
  await panelPage.waitForFunction(
    () => {
      return Array.from(document.querySelectorAll('.action-copy-all')).some(
        (button) => button.textContent?.trim() === '已复制当前筛选',
      );
    },
    undefined,
    { timeout: 10000 },
  );
  await panelPage
    .locator(`[data-action-id="${firstActionId}"]`)
    .locator('button', { hasText: '复制' })
    .click();
  await panelPage.waitForFunction(
    (actionId) => {
      const card = document.querySelector(`[data-action-id="${actionId}"]`);
      return Array.from(card?.querySelectorAll('button') || []).some(
        (button) => button.textContent?.trim() === '已复制',
      );
    },
    firstActionId,
    { timeout: 10000 },
  );

  log('编辑行动项并验证人工校正状态');
  await panelPage
    .locator(`[data-action-id="${firstActionId}"]`)
    .locator('button', { hasText: '编辑' })
    .click();
  const actionCard = panelPage.locator(`[data-action-id="${firstActionId}"]`);
  await actionCard.locator('label', { hasText: '行动项' }).locator('input').fill(
    '校正后的 Meeting Pilot 技术评审材料',
  );
  await actionCard
    .locator('label', { hasText: '负责人' })
    .locator('input')
    .fill('Esone Qiu');
  await actionCard
    .locator('label', { hasText: '截止' })
    .locator('input')
    .fill('下周四');
  await actionCard.locator('button', { hasText: '保存校正' }).click();
  await panelPage.waitForFunction(
    (actionId) => {
      const card = document.querySelector(`[data-action-id="${actionId}"]`);
      return (
        card?.textContent?.includes('校正后的 Meeting Pilot 技术评审材料') &&
        card?.textContent?.includes('Esone Qiu') &&
        card?.textContent?.includes('下周四') &&
        card?.textContent?.includes('人工校正') &&
        card?.textContent?.includes('已确认')
      );
    },
    firstActionId,
    { timeout: 10000 },
  );
  await panelPage.locator('[data-action-filter="confirmed"]').click();
  await panelPage.waitForFunction(
    (actionId) => {
      const card = document.querySelector(`[data-action-id="${actionId}"]`);
      return (
        card?.textContent?.includes('已确认') &&
        card?.textContent?.includes('校正后的 Meeting Pilot 技术评审材料')
      );
    },
    firstActionId,
    { timeout: 10000 },
  );
  await panelPage.locator('[data-action-filter="review"]').click();
  await panelPage.waitForFunction(
    (actionId) => !document.querySelector(`[data-action-id="${actionId}"]`),
    firstActionId,
    { timeout: 10000 },
  );
  await panelPage.locator('[data-action-filter="open"]').click();
  await panelPage.waitForFunction(
    (actionId) =>
      Boolean(document.querySelector(`[data-action-id="${actionId}"]`)),
    firstActionId,
    { timeout: 10000 },
  );
  await panelPage.evaluate(
    async ({ tabId }) => {
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_TRANSCRIPT_UPDATE',
        tabId,
        transcriptChunk: {
          id: 'scene2-t4',
          speaker: 'Sarah Wang',
          text: '确认保持当前 Meeting Pilot 技术评审计划。',
          ts: Date.now(),
        },
      });
    },
    { tabId: meetingTabId },
  );
  await panelPage.waitForFunction(
    (actionId) => {
      const card = document.querySelector(`[data-action-id="${actionId}"]`);
      return (
        card?.textContent?.includes('已确认') &&
        card?.textContent?.includes('校正后的 Meeting Pilot 技术评审材料') &&
        card?.textContent?.includes('Esone Qiu') &&
        card?.textContent?.includes('人工校正')
      );
    },
    firstActionId,
    { timeout: 10000 },
  );
  await saveScreenshot(panelPage, 'scene2-sidepanel-runtime.png');

  log('通过真实 stop path 触发 upload/generate/poll');
  await panelPage.locator('.panel-tab', { hasText: '实时' }).click();
  await panelPage.locator('.panel-status-action').click();

  await panelPage.waitForFunction(
    async () => {
      const apiLog = await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_TEST_GET_API_LOG',
      });
      return (
        apiLog?.requestLog?.includes('POST /api/v2/upload/video') &&
        apiLog?.requestLog?.includes('POST /api/v3/generate_digest')
      );
    },
    undefined,
    { timeout: 15000 },
  );

  const apiLog = await panelPage.evaluate(async () => {
    return chrome.runtime.sendMessage({
      type: 'MEETING_PILOT_TEST_GET_API_LOG',
    });
  });
  assert.ok(
    apiLog.requestLog.includes('POST /api/v2/upload/video'),
    '未触发视频上传请求',
  );
  assert.ok(
    apiLog.requestLog.includes('POST /api/v3/generate_digest'),
    '未触发 digest 生成请求',
  );

  const panoramaPage = await context.newPage();
  await panoramaPage.goto(
    `chrome-extension://${extensionId}/meeting-panorama.html?meetingId=${meetingId}&tabId=${meetingTabId}`,
    { waitUntil: 'load' },
  );
  await panoramaPage.waitForFunction(
    () => {
      const header = document.querySelector('.page-header h1');
      const pdfSection = document.getElementById('pdfPreviewSection');
      return (
        Boolean(
          header?.textContent?.includes('Fixture RingCentral Runtime Meeting'),
        ) &&
        Boolean(pdfSection) &&
        Boolean(
          document.querySelector('.pdf-preview-frame, .pdf-digest-preview'),
        )
      );
    },
    { timeout: 15000 },
  );
  await saveScreenshot(panoramaPage, 'scene2-panorama-runtime.png');

  log(`Scene 2 运行时验证通过，截图目录: ${screenshotDir}`);
  await panoramaPage.close();
  await panelPage.close();
  await page.close();
} finally {
  if (launched?.context) {
    await launched.context.close();
  }
}
