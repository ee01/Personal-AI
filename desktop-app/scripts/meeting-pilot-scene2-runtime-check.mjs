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
  await panelPage.setViewportSize({ width: 440, height: 760 });
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
  const panelLayout = await panelPage.evaluate(() => {
    const shell = document.querySelector('.meeting-shell');
    const shellElement = shell instanceof HTMLElement ? shell : null;
    return {
      viewportWidth: window.innerWidth,
      shellWidth: shellElement?.offsetWidth || 0,
      shellLeft: shellElement?.offsetLeft || 0,
      shellRightGap: shellElement
        ? window.innerWidth - shellElement.offsetLeft - shellElement.offsetWidth
        : -1,
      isWindowSurface: Boolean(shell?.classList.contains('surface-window')),
    };
  });
  assert.equal(
    panelLayout.isWindowSurface,
    true,
    '独立 side panel 页面缺少 window surface 标记',
  );
  assert.ok(
    panelLayout.shellWidth >= panelLayout.viewportWidth - 1,
    `独立窗口未占满紧凑视口: ${JSON.stringify(panelLayout)}`,
  );
  assert.ok(
    panelLayout.shellLeft <= 1 && panelLayout.shellRightGap <= 1,
    `独立窗口仍存在大面积边缘空白: ${JSON.stringify(panelLayout)}`,
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
  const initialCaptureStartedAt = startResult?.session?.capture?.startedAt;
  assert.equal(
    typeof initialCaptureStartedAt,
    'number',
    `启动 Capture 后缺少 startedAt: ${JSON.stringify(startResult?.session?.capture)}`,
  );

  log('停止后重新开始 Capture，验证计时从本次授权重新计算');
  const stoppedResult = await panelPage.evaluate(
    async ({ meetingId, tabId }) =>
      chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_STOP_CAPTURE',
        meetingId,
        tabId,
      }),
    { meetingId, tabId: meetingTabId },
  );
  assert.equal(
    stoppedResult?.session?.capture?.kind,
    'stopped',
    `停止 Capture 未进入 stopped: ${JSON.stringify(stoppedResult)}`,
  );

  log('使用无效 streamId 验证 Capture 启动失败不会被覆盖成 recording');
  await panelPage.evaluate(async () => {
    await chrome.runtime.sendMessage({
      type: 'MEETING_PILOT_TEST_SET_API_MOCK',
      enabled: false,
    });
  });
  const failedStartResult = await panelPage.evaluate(
    async ({ meetingId, tabId, title, url }) =>
      chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_START_CAPTURE',
        meetingId,
        tabId,
        title,
        url,
        streamId: '__meeting_pilot_invalid_stream__',
      }),
    { meetingId, tabId: meetingTabId, title: meetingTitle, url: meetingUrl },
  );
  assert.equal(
    failedStartResult?.success,
    false,
    `无效 streamId 启动不应返回成功: ${JSON.stringify(failedStartResult)}`,
  );
  assert.equal(
    failedStartResult?.session?.capture?.kind,
    'error',
    `无效 streamId 启动不应进入 recording: ${JSON.stringify(
      failedStartResult?.session?.capture,
    )}`,
  );
  assert.ok(
    failedStartResult?.session?.capture?.lastError,
    `无效 streamId 启动应保留真实错误: ${JSON.stringify(
      failedStartResult?.session?.capture,
    )}`,
  );
  await panelPage.waitForTimeout(150);
  const failedState = await panelPage.evaluate(
    async ({ tabId }) =>
      chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_GET_STATE',
        tabId,
      }),
    { tabId: meetingTabId },
  );
  assert.equal(
    failedState?.activeSession?.capture?.kind,
    'error',
    `失败后状态不应被异步覆盖成 recording: ${JSON.stringify(
      failedState?.activeSession?.capture,
    )}`,
  );
  await panelPage.evaluate(async () => {
    await chrome.runtime.sendMessage({
      type: 'MEETING_PILOT_TEST_SET_API_MOCK',
      enabled: true,
    });
  });

  await panelPage.waitForTimeout(30);
  const restartedResult = await panelPage.evaluate(
    async ({ meetingId, tabId, title, url }) =>
      chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_START_CAPTURE',
        meetingId,
        tabId,
        title,
        url,
      }),
    { meetingId, tabId: meetingTabId, title: meetingTitle, url: meetingUrl },
  );
  assert.equal(
    restartedResult?.success,
    true,
    `重新开始 Capture 未成功: ${JSON.stringify(restartedResult)}`,
  );
  assert.ok(
    ['armed', 'recording', 'uploading', 'completed'].includes(
      restartedResult?.session?.capture?.kind,
    ),
    `重启后 capture 状态无效: ${JSON.stringify(
      restartedResult?.session?.capture,
    )}`,
  );
  assert.ok(
    restartedResult?.session?.capture?.startedAt > initialCaptureStartedAt,
    `重启后 startedAt 沿用了旧值: ${JSON.stringify({
      initialCaptureStartedAt,
      restartedCapture: restartedResult?.session?.capture,
    })}`,
  );
  assert.equal(
    restartedResult?.session?.capture?.stoppedAt,
    undefined,
    `重启后不应保留 stoppedAt: ${JSON.stringify(
      restartedResult?.session?.capture,
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
  assert.match(
    actionText,
    /确认(?:例外)?并完成/,
    `未复核行动项的完成按钮没有显式确认或例外确认语义: ${actionText}`,
  );
  const actionReviewStates = await panelPage.evaluate(() =>
    Array.from(document.querySelectorAll('.action-card')).map((card) => ({
      id: card.getAttribute('data-action-id') || '',
      text: card.textContent || '',
      warnings: Array.from(card.querySelectorAll('.ac-review-warning')).map(
        (warning) => warning.textContent || '',
      ),
    })),
  );
  const confirmableAction = actionReviewStates.find(
    (item) => item.id && item.warnings.length === 0,
  );
  const blockedAction = actionReviewStates.find(
    (item) => item.id && item.warnings.length > 0,
  );
  assert.ok(
    confirmableAction,
    `没有可批量确认的完整行动项: ${JSON.stringify(actionReviewStates)}`,
  );
  assert.ok(
    blockedAction,
    `没有覆盖缺信息行动项: ${JSON.stringify(actionReviewStates)}`,
  );
  assert.ok(
    blockedAction.warnings.some((warning) => /补截止|补负责人|缺依据/.test(warning)),
    `缺信息行动项未展示复核提示: ${JSON.stringify(blockedAction)}`,
  );
  assert.match(
    blockedAction.text,
    /确认例外/,
    `缺信息行动项没有显示例外确认文案: ${JSON.stringify(blockedAction)}`,
  );
  assert.doesNotMatch(
    confirmableAction.text,
    /确认例外/,
    `信息完整行动项不应显示例外确认文案: ${JSON.stringify(confirmableAction)}`,
  );
  await panelPage.locator('[data-action-filter="needs-info"]').click();
  await panelPage.waitForFunction(
    (actionId) => {
      const card = document.querySelector(`[data-action-id="${actionId}"]`);
      return card?.textContent?.includes('待复核');
    },
    blockedAction.id,
    { timeout: 10000 },
  );
  await panelPage.locator('[data-action-filter="open"]').click();
  const firstActionId = confirmableAction.id;
  assert.ok(firstActionId, '行动项卡片缺少稳定 data-action-id');
  log('批量确认当前筛选里信息完整的待复核行动项');
  await panelPage
    .locator('.action-bulk-confirm', { hasText: '确认可用项' })
    .click();
  await panelPage.waitForFunction(
    () => {
      return Array.from(document.querySelectorAll('.action-bulk-confirm')).some(
        (button) => /^已确认 \d+ 项$/.test(button.textContent?.trim() || ''),
      );
    },
    undefined,
    { timeout: 10000 },
  );
  await panelPage.waitForFunction(
    (actionId) => {
      const card = document.querySelector(`[data-action-id="${actionId}"]`);
      const text = card?.textContent || '';
      return text.includes('已确认') && !text.includes('待复核');
    },
    firstActionId,
    { timeout: 10000 },
  );
  await panelPage.waitForFunction(
    (actionId) => {
      const card = document.querySelector(`[data-action-id="${actionId}"]`);
      const text = card?.textContent || '';
      return text.includes('待复核') && !text.includes('已确认');
    },
    blockedAction.id,
    { timeout: 10000 },
  );
  await panelPage
    .locator('.action-copy-followup', { hasText: '复制跟进清单' })
    .click();
  await panelPage.waitForFunction(
    () => {
      return Array.from(document.querySelectorAll('.action-copy-followup')).some(
        (button) => button.textContent?.trim() === '已复制跟进清单',
      );
    },
    undefined,
    { timeout: 10000 },
  );
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
  const panoramaText = await panoramaPage.locator('body').textContent();
  assert.doesNotMatch(
    panoramaText || '',
    /\bProbing\b/,
    'Panorama 不应暴露英文内部转写探测状态',
  );
  assert.match(
    panoramaText || '',
    /检测中|RC 转写|本机转写|本地 ASR|云端 ASR|无转写/,
    'Panorama 应展示用户可理解的转写状态文案',
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
