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

async function assertButtonBoundary(locator, patterns, label) {
  await locator.waitFor({ state: 'attached', timeout: 15000 });
  const title = (await locator.getAttribute('title')) || '';
  const ariaLabel = (await locator.getAttribute('aria-label')) || '';
  assert.ok(title, `${label} 缺少 title 边界`);
  assert.equal(ariaLabel, title, `${label} aria-label 应镜像 title`);
  for (const pattern of patterns) {
    assert.match(title, pattern, `${label} 边界缺少 ${pattern}: ${title}`);
  }
}

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error instanceof Error ? error.message : String(error));
  });
  return () => {
    assert.deepEqual(errors, [], `页面脚本异常: ${errors.join('; ')}`);
  };
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

  log('验证 popup Capture 启动提交中回执');
  const popupPage = await context.newPage();
  const assertNoPopupErrors = collectPageErrors(popupPage);
  await popupPage.route('https://memory.local/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ brief: { cards: [] } }),
    });
  });
  await popupPage.addInitScript(
    ({ meetingTabId, meetingUrl, meetingTitle }) => {
      const originalTabsQuery = chrome.tabs.query.bind(chrome.tabs);
      const originalSendMessage = chrome.runtime.sendMessage.bind(
        chrome.runtime,
      );
      const meetingId = meetingUrl.split('/').pop();
      const queryOverride = (queryInfo, callback) => {
        if (queryInfo?.active && queryInfo?.currentWindow) {
          const tabs = [
            { id: meetingTabId, url: meetingUrl, title: meetingTitle },
          ];
          if (typeof callback === 'function') {
            callback(tabs);
            return undefined;
          }
          return Promise.resolve(tabs);
        }
        return originalTabsQuery(queryInfo, callback);
      };
      const sendMessageOverride = (message, ...args) => {
        if (message?.type === 'GET_TASK_SCHEDULER_STATUS') {
          return Promise.resolve({
            success: true,
            tasks: [],
            refreshReceipt: {
              checkedAt: Date.now(),
              checkedTaskCount: 0,
              enabledTaskCount: 0,
              scheduleAttentionCount: 0,
              autoRepairAttempted: false,
              createdAlarms: 0,
              updatedAlarms: 0,
              clearedAlarms: 0,
              orphanedAlarmsCleared: 0,
              disabledAlarmsCleared: 0,
              failedRepairs: 0,
              refreshOnly: true,
            },
          });
        }
        if (message?.type === 'MEETING_PILOT_GET_STATE') {
          return Promise.resolve({
            activeMeetingId: meetingId,
            sessions: [],
            activeSession: null,
          });
        }
        if (message?.type === 'MEETING_PILOT_ENABLE_CAPTURE_AND_OPEN_PANEL') {
          return new Promise((resolve) => {
            window.__resolveMeetingPilotPopupStart = () =>
              resolve({
                success: false,
                session: {
                  tabId: meetingTabId,
                  meetingId,
                  url: meetingUrl,
                  title: meetingTitle,
                  capture: {
                    kind: 'error',
                    chunkCount: 0,
                    lastError: 'tabCapture_stream_unavailable',
                  },
                  readiness: {
                    status: 'ready',
                    summary: 'Ready for local capture.',
                    canStartCapture: true,
                    checkedAt: Date.now(),
                    blockers: [],
                    degradations: [],
                    dependencies: {},
                  },
                  transcript: [],
                  participants: [],
                },
              });
          });
        }
        return originalSendMessage(message, ...args);
      };
      Object.defineProperty(chrome.tabs, 'query', {
        configurable: true,
        value: queryOverride,
      });
      Object.defineProperty(chrome.runtime, 'sendMessage', {
        configurable: true,
        value: sendMessageOverride,
      });
    },
    { meetingTabId, meetingUrl, meetingTitle },
  );
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`, {
    waitUntil: 'domcontentloaded',
  });
  await popupPage
    .locator('.radar-button', { hasText: '开启会议弹幕' })
    .waitFor({ timeout: 15000 });
  await popupPage.locator('.radar-button', { hasText: '开启会议弹幕' }).click();
  await popupPage
    .locator('.meeting-pilot-notice.info', {
      hasText: '正在提交 Meeting Pilot Capture 启动请求',
    })
    .waitFor({ timeout: 15000 });
  const pendingPopupNotice =
    (await popupPage.locator('.meeting-pilot-notice.info').innerText()) || '';
  assert.match(pendingPopupNotice, /尚未确认录制开始/);
  assert.match(pendingPopupNotice, /不会通知参会者/);
  assert.match(pendingPopupNotice, /录制同意/);
  await popupPage.evaluate(() => window.__resolveMeetingPilotPopupStart?.());
  await popupPage
    .locator('.meeting-pilot-notice.error', {
      hasText: '没有通知参会者',
    })
    .waitFor({ timeout: 15000 });
  const failedPopupNotice =
    (await popupPage.locator('.meeting-pilot-notice.error').innerText()) || '';
  assert.match(failedPopupNotice, /创建纪要/);
  assert.match(failedPopupNotice, /写入外部任务/);
  assertNoPopupErrors();
  await popupPage.close();

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
    async ({ tabId }) => {
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_TIER_STATUS_UPDATE',
        tabId,
        tierStatus: {
          activeTier: 'web_speech',
          badge: 'On-Device',
          mode: 'auto',
          lastTransitionAt: Date.now() - 3000,
          lastTransitionReason: 'ASR tier web_speech activated',
          lastStatusDetail:
            'Chrome On-Device waiting for first transcript; fallback watchdog 12s. Chrome may not be consuming the extension/offscreen custom audio track.',
          probeTrail: [
            {
              tier: 'web_speech',
              state: 'selected',
              ts: Date.now() - 3200,
            },
          ],
        },
      });
    },
    { tabId: meetingTabId },
  );
  await panelPage.locator('.panel-tab', { hasText: '发言' }).click();
  await panelPage
    .locator('.speech-asr-receipt', { hasText: 'ASR 链路回执' })
    .waitFor({ timeout: 15000 });
  const webSpeechReceiptText = await panelPage
    .locator('.speech-asr-receipt')
    .innerText();
  assert.match(
    webSpeechReceiptText,
    /本机 Web Speech · 等待首条转写（12s 无文本将 fallback）/,
    `Web Speech 回执未展示首条转写 watchdog: ${webSpeechReceiptText}`,
  );
  assert.match(
    webSpeechReceiptText,
    /探测路径[\s\S]*本机 Web Speech 已选中/,
    `Web Speech 回执未展示本轮 ASR 探测路径: ${webSpeechReceiptText}`,
  );
  assert.match(
    webSpeechReceiptText,
    /不要把空 transcript 当成会议无人发言/,
    `Web Speech 回执未说明空 transcript 边界: ${webSpeechReceiptText}`,
  );
  assert.match(
    webSpeechReceiptText,
    /实时状态[\s\S]*正在等浏览器给出第一条 live transcript/,
    `Web Speech 回执未把首条 live transcript 等待态放入实时状态: ${webSpeechReceiptText}`,
  );
  assert.match(
    webSpeechReceiptText,
    /Desktop App \/ Cloud ASR/,
    `Web Speech 回执未给出替代恢复路径: ${webSpeechReceiptText}`,
  );

  await panelPage.evaluate(
    async ({ tabId }) => {
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_TIER_STATUS_UPDATE',
        tabId,
        tierStatus: {
          activeTier: 'desktop_whisper',
          badge: 'Local ASR',
          mode: 'local-only',
          lastTransitionAt: Date.now() - 3000,
          lastTransitionReason: 'Local ASR · no live → Whisper',
        },
      });
    },
    { tabId: meetingTabId },
  );
  await panelPage.waitForTimeout(500);
  const localFinalOnlyEmptyStatusText = await panelPage
    .locator('.speech-status-card')
    .innerText();
  assert.match(
    localFinalOnlyEmptyStatusText,
    /等待 final transcript · 当前无 live preview/,
    `Local ASR 空转写状态摘要未区分 final-only 等待态: ${localFinalOnlyEmptyStatusText}`,
  );

  await panelPage.evaluate(
    async ({ tabId }) => {
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_TIER_STATUS_UPDATE',
        tabId,
        tierStatus: {
          activeTier: null,
          badge: 'No ASR',
          mode: 'local-only',
          lastTransitionAt: Date.now() - 2500,
          lastTransitionReason:
            'All ASR tiers unavailable (desktop_whisper: asr_model_downloading 42% funasr_nano)',
          probeTrail: [
            {
              tier: 'desktop_whisper',
              state: 'unavailable',
              reason: 'asr_model_downloading 42% funasr_nano',
              ts: Date.now() - 2500,
            },
          ],
        },
      });
    },
    { tabId: meetingTabId },
  );
  await panelPage.waitForTimeout(500);
  const localSetupReceiptText = await panelPage
    .locator('.speech-asr-receipt')
    .innerText();
  assert.match(
    localSetupReceiptText,
    /本地准备[\s\S]*本机 ASR 模型下载中（42%） · funasr nano/,
    `Local ASR 准备回执未展示模型下载进度: ${localSetupReceiptText}`,
  );
  assert.match(
    localSetupReceiptText,
    /恢复动作[\s\S]*保持 Personal AI Desktop App 开启并等待模型下载完成/,
    `Local ASR 准备回执未展示具体恢复动作: ${localSetupReceiptText}`,
  );
  assert.doesNotMatch(
    localSetupReceiptText,
    /asr_model_downloading/,
    `Local ASR 准备回执不应暴露 raw readiness code: ${localSetupReceiptText}`,
  );

  await panelPage.evaluate(
    async ({ tabId }) => {
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_TIER_STATUS_UPDATE',
        tabId,
        tierStatus: {
          activeTier: null,
          badge: 'No ASR',
          mode: 'local-only',
          lastTransitionAt: Date.now() - 2400,
          lastTransitionReason:
            'All ASR tiers unavailable (desktop_whisper: live_ready_final_not_ready missing_model+whisper_binary_missing)',
          probeTrail: [
            {
              tier: 'desktop_whisper',
              state: 'unavailable',
              reason:
                'live_ready_final_not_ready missing_model+whisper_binary_missing',
              ts: Date.now() - 2400,
            },
          ],
        },
      });
    },
    { tabId: meetingTabId },
  );
  await panelPage.waitForTimeout(500);
  const liveReadyFinalMissingReceiptText = await panelPage
    .locator('.speech-asr-receipt')
    .innerText();
  assert.match(
    liveReadyFinalMissingReceiptText,
    /本地准备[\s\S]*本地实时引擎已就绪/,
    `Local ASR 准备回执未区分 live-ready/final-not-ready: ${liveReadyFinalMissingReceiptText}`,
  );
  assert.match(
    liveReadyFinalMissingReceiptText,
    /Local ASR session 仍需要 FunASR 或 Whisper fallback/,
    `Local ASR 准备回执未说明 session 仍依赖 final 兜底: ${liveReadyFinalMissingReceiptText}`,
  );
  assert.match(
    liveReadyFinalMissingReceiptText,
    /local-only 不会调用云端/,
    `Local ASR 准备回执未说明 local-only 上传边界: ${liveReadyFinalMissingReceiptText}`,
  );
  assert.doesNotMatch(
    liveReadyFinalMissingReceiptText,
    /live_ready_final_not_ready/,
    `Local ASR 准备回执不应暴露 raw live-ready code: ${liveReadyFinalMissingReceiptText}`,
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
  const staleTranscriptBaseTs = Date.now() - 155000;
  const transcriptChunks = [
    {
      id: 'scene2-t1',
      speaker: 'Alex Chen',
      text: '今天先讨论 Q2 预算，然后看技术评审 owner。',
      ts: staleTranscriptBaseTs - 20000,
      source: 'cloud',
    },
    {
      id: 'scene2-t2',
      speaker: 'Sarah Wang',
      text: 'Sprint 8 排期已拉通，QA 资源需要我来跟进。',
      ts: staleTranscriptBaseTs - 10000,
      source: 'cloud',
    },
    {
      id: 'scene2-t3',
      speaker: 'Alex Chen',
      text: '决定由 Esone 负责 Meeting Pilot 技术评审，DDL 下周三。',
      ts: staleTranscriptBaseTs,
      source: 'cloud',
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

  await panelPage.evaluate(
    async ({ tabId }) => {
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_TIER_STATUS_UPDATE',
        tabId,
        tierStatus: {
          activeTier: 'cloud',
          badge: 'Cloud',
          mode: 'auto',
          lastTransitionAt: Date.now() - 9000,
          lastTransitionReason:
            'Local ASR start failed: desktop_app_not_running. ASR fallback activated: cloud',
          lastStatusDetail:
            'Cloud ASR · POST /v1/chat/completions + input_audio · OpenAI Chat Completions + input_audio · model qwen3-asr-flash · language auto · segment 5s',
          probeTrail: [
            {
              tier: 'desktop_whisper',
              state: 'start_failed',
              reason: 'desktop_app_not_running',
              ts: Date.now() - 9500,
            },
            {
              tier: 'cloud',
              state: 'selected',
              ts: Date.now() - 9000,
            },
          ],
        },
      });
    },
    { tabId: meetingTabId },
  );

  await panelPage.locator('.panel-tab', { hasText: '发言' }).click();
  await panelPage
    .locator('.speech-asr-receipt', { hasText: 'ASR 链路回执' })
    .waitFor({ timeout: 15000 });
  const asrReceiptText = await panelPage
    .locator('.speech-asr-receipt')
    .innerText();
  assert.match(
    asrReceiptText,
    /自动 · 本地优先/,
    `ASR 回执未展示当前转写模式: ${asrReceiptText}`,
  );
  assert.match(
    asrReceiptText,
    /云端 ASR/,
    `ASR 回执未展示当前云端层级: ${asrReceiptText}`,
  );
  assert.match(
    asrReceiptText,
    /探测路径[\s\S]*本地 ASR \/ Whisper 启动失败：Personal AI Desktop App 未连接[\s\S]*云端 ASR 已选中/,
    `ASR 回执未展示云端 fallback 前的探测路径: ${asrReceiptText}`,
  );
  assert.match(
    asrReceiptText,
    /本地准备[\s\S]*Personal AI Desktop App 未连接/,
    `ASR 回执未展示本地 ASR 准备失败原因: ${asrReceiptText}`,
  );
  assert.match(
    asrReceiptText,
    /每段约 5s 音频会转成 WAV 后以内联 input_audio 发送/,
    `ASR 回执未展示云端 input_audio 上传边界: ${asrReceiptText}`,
  );
  assert.match(
    asrReceiptText,
    /单片超过 7\.5MB 会拒绝/,
    `ASR 回执未展示 chat audio 大小边界: ${asrReceiptText}`,
  );
  assert.match(
    asrReceiptText,
    /POST \/v1\/chat\/completions \+ input_audio/,
    `ASR 回执未展示云端 endpoint: ${asrReceiptText}`,
  );
  assert.match(
    asrReceiptText,
    /模型 qwen3-asr-flash · 语言 auto/,
    `ASR 回执未展示云端模型与语言: ${asrReceiptText}`,
  );
  assert.match(
    asrReceiptText,
    /云端 ASR · 3 条/,
    `ASR 回执未使用最近 transcript source 兜底展示结果来源: ${asrReceiptText}`,
  );
  assert.match(
    asrReceiptText,
    /新鲜度[\s\S]*云端 ASR 仍标记为运行/,
    `ASR 回执未展示 active tier 的转写新鲜度: ${asrReceiptText}`,
  );
  assert.match(
    asrReceiptText,
    /旧转写不代表当前仍在收到音频/,
    `ASR 回执未说明旧 transcript 的当前性边界: ${asrReceiptText}`,
  );
  assert.match(
    asrReceiptText,
    /请检查会议是否静音、语言设置、Desktop App 或云端网络/,
    `ASR 回执未提供 stale transcript 恢复方向: ${asrReceiptText}`,
  );

  await panelPage.evaluate(
    async ({ tabId }) => {
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_TRANSCRIPT_UPDATE',
        tabId,
        transcriptChunk: {
          id: 'scene2-local-final',
          speaker: 'Esone Qiu',
          text: '本地 final fallback 已生成最后一句转写。',
          ts: Date.now() - 2000,
          source: 'desktop_whisper',
        },
      });
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_TIER_STATUS_UPDATE',
        tabId,
        tierStatus: {
          activeTier: 'desktop_whisper',
          badge: 'Local ASR',
          mode: 'local-only',
          lastTransitionAt: Date.now() - 3000,
          lastTransitionReason: 'Local ASR · no live → Whisper',
        },
      });
    },
    { tabId: meetingTabId },
  );
  await panelPage.waitForTimeout(1000);
  const localAsrReceiptText = await panelPage
    .locator('.speech-asr-receipt')
    .innerText();
  assert.match(
    localAsrReceiptText,
    /本地 ASR · 无实时预览 → Whisper final/,
    `Local ASR 回执未翻译 final-only 链路: ${localAsrReceiptText}`,
  );
  assert.match(
    localAsrReceiptText,
    /当前只有 final transcript/,
    `Local ASR 回执未说明 final-only 延迟边界: ${localAsrReceiptText}`,
  );
  assert.match(
    localAsrReceiptText,
    /实时状态[\s\S]*当前没有 live partial preview/,
    `Local ASR 回执未把 final-only live preview 边界放入实时状态: ${localAsrReceiptText}`,
  );
  assert.match(
    localAsrReceiptText,
    /音频片段只发给本机 Desktop App/,
    `Local ASR 回执未展示本机上传边界: ${localAsrReceiptText}`,
  );
  assert.match(
    localAsrReceiptText,
    /仅本地/,
    `Local ASR 回执未展示 local-only 模式: ${localAsrReceiptText}`,
  );
  assert.doesNotMatch(
    localAsrReceiptText,
    /no live/,
    `Local ASR 回执不应暴露 raw engine 状态: ${localAsrReceiptText}`,
  );
  await assertButtonBoundary(
    panelPage.locator('.speech-asr-receipt'),
    [
      /ASR 链路回执/,
      /当前层：本地 ASR · 无实时预览 → Whisper final/,
      /上传边界：音频片段只发给本机 Desktop App/,
      /这只是当前会议 session 的转写状态快照/,
      /不会开始\/停止 Capture/,
      /不会切换 ASR 模式/,
      /不会.*额外上传音频/,
      /不会.*RingCentral 保存\/下载完整 transcript/,
      /不会.*创建外部任务/,
    ],
    'Local ASR 回执卡总边界',
  );

  await panelPage.evaluate(
    async ({ tabId }) => {
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_TIER_STATUS_UPDATE',
        tabId,
        tierStatus: {
          activeTier: 'desktop_whisper',
          badge: 'Local ASR',
          mode: 'auto',
          lastTransitionAt: Date.now() - 2000,
          lastTransitionReason: 'ASR tier desktop_whisper activated',
          lastStatusDetail:
            'Local ASR stream warning (2/3): desktop ASR stream lost',
        },
      });
    },
    { tabId: meetingTabId },
  );
  await panelPage.waitForTimeout(1000);
  const localWarningReceiptText = await panelPage
    .locator('.speech-asr-receipt')
    .innerText();
  assert.match(
    localWarningReceiptText,
    /本地 ASR · 流暂不稳定（2\/3）/,
    `Local ASR warning 回执未展示重试计数: ${localWarningReceiptText}`,
  );
  assert.match(
    localWarningReceiptText,
    /本地流状态[\s\S]*chunk stream 重试 2\/3/,
    `Local ASR warning 回执未把 stream 重试拆成结构化行: ${localWarningReceiptText}`,
  );
  assert.match(
    localWarningReceiptText,
    /距离 fatal fallback 还剩 1 次失败/,
    `Local ASR warning 回执未展示剩余 fatal fallback 容忍次数: ${localWarningReceiptText}`,
  );
  assert.match(
    localWarningReceiptText,
    /实时 partial preview 可能短暂停住/,
    `Local ASR warning 回执未说明实时预览暂停边界: ${localWarningReceiptText}`,
  );
  assert.match(
    localWarningReceiptText,
    /实时状态[\s\S]*本地 live partial preview 正在重试/,
    `Local ASR warning 回执未把 live retry 状态放到实时状态: ${localWarningReceiptText}`,
  );
  assert.match(
    localWarningReceiptText,
    /已收到的 final \/ 历史 transcript 会保留/,
    `Local ASR warning 回执未说明已有转写保留: ${localWarningReceiptText}`,
  );
  assert.match(
    localWarningReceiptText,
    /当前音频仍只发给本机 Desktop App/,
    `Local ASR warning 回执未说明本机上传边界: ${localWarningReceiptText}`,
  );
  assert.match(
    localWarningReceiptText,
    /继续失败才会按当前模式切到下一层/,
    `Local ASR warning 回执未说明切层条件: ${localWarningReceiptText}`,
  );

  await panelPage.evaluate(
    async ({ tabId }) => {
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_TRANSCRIPT_UPDATE',
        tabId,
        transcriptChunk: {
          id: 'scene2-rc-transcript',
          speaker: 'Alex Chen',
          text: 'RingCentral transcript 已经在会议页显示。',
          ts: Date.now() - 1000,
          source: 'ringcentral_transcript',
        },
      });
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_TIER_STATUS_UPDATE',
        tabId,
        tierStatus: {
          activeTier: 'ringcentral_transcript',
          badge: 'RC Transcript',
          mode: 'auto',
          lastTransitionAt: Date.now() - 1500,
          lastTransitionReason:
            'RingCentral web transcript became active; local/cloud ASR stopped.',
        },
      });
    },
    { tabId: meetingTabId },
  );
  await panelPage.waitForTimeout(800);
  const ringCentralTranscriptReceiptText = await panelPage
    .locator('.speech-asr-receipt')
    .innerText();
  assert.match(
    ringCentralTranscriptReceiptText,
    /平台转写[\s\S]*只读取当前会议页已经显示的 RingCentral caption\/transcript/,
    `RC Transcript 回执未说明平台转写读取范围: ${ringCentralTranscriptReceiptText}`,
  );
  assert.match(
    ringCentralTranscriptReceiptText,
    /Local \/ Cloud ASR 已跳过/,
    `RC Transcript 回执未说明本地和云端 ASR 已跳过: ${ringCentralTranscriptReceiptText}`,
  );
  assert.match(
    ringCentralTranscriptReceiptText,
    /已读文本会进入本场实时摘要、行动项、时间线和归档草稿/,
    `RC Transcript 回执未说明已读文本仍参与本场产物: ${ringCentralTranscriptReceiptText}`,
  );
  assert.match(
    ringCentralTranscriptReceiptText,
    /不会请求 RingCentral 保存\/下载完整 transcript、发送通知、开启录制或额外上传音频/,
    `RC Transcript 回执未说明平台保存和上传边界: ${ringCentralTranscriptReceiptText}`,
  );
  assert.match(
    ringCentralTranscriptReceiptText,
    /上传边界[\s\S]*读取会议页已有转写，不额外上传音频/,
    `RC Transcript 回执未保留无额外上传边界: ${ringCentralTranscriptReceiptText}`,
  );
  await assertButtonBoundary(
    panelPage.locator('.speech-asr-receipt'),
    [
      /ASR 链路回执/,
      /当前层：RC 转写/,
      /上传边界：读取会议页已有转写，不额外上传音频/,
      /这只是当前会议 session 的转写状态快照/,
      /不会开始\/停止 Capture/,
      /不会切换 ASR 模式/,
      /不会.*额外上传音频/,
      /不会.*RingCentral 保存\/下载完整 transcript/,
      /不会.*发送会议纪要/,
    ],
    'RC Transcript 回执卡总边界',
  );
  await assertButtonBoundary(
    panelPage.locator('.panel-status-action'),
    [/停止当前 Meeting Pilot Capture/, /归档链路/, /不会发送纪要/, /通知参会者/],
    '运行态侧栏底部停止 Capture 按钮',
  );

  await panelPage.locator('.panel-tab', { hasText: '时间线' }).click();
  await panelPage.waitForFunction(
    () => {
      return Array.from(document.querySelectorAll('.mini-tl-item')).length >= 2;
    },
    { timeout: 15000 },
  );
  await panelPage.locator('.panel-tab', { hasText: '行动项' }).click();
  await assertButtonBoundary(
    panelPage.locator('.panel-tab', { hasText: '行动项' }),
    [/查看当前会议 session 的行动项/, /不会开始\/停止 Capture/, /不会.*外部任务/],
    '运行态行动项 tab',
  );
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
  await assertButtonBoundary(
    panelPage
      .locator(`[data-action-id="${blockedAction.id}"]`)
      .locator('button', { hasText: /^确认例外$/ }),
    [/确认例外/, /标为已确认/, /不会标记完成/, /Calendar\/Jira\/RingCentral/],
    '缺信息行动项确认例外按钮',
  );
  await assertButtonBoundary(
    panelPage
      .locator(`[data-action-id="${blockedAction.id}"]`)
      .locator('button', { hasText: /^确认例外并完成$/ }),
    [/确认例外并完成/, /只更新当前会议 session/, /不会创建\/关闭外部任务/],
    '缺信息行动项确认并完成按钮',
  );
  await assertButtonBoundary(
    panelPage
      .locator(`[data-action-id="${blockedAction.id}"]`)
      .locator('button', { hasText: '忽略' }),
    [/标为已忽略/, /不会删除 transcript/, /不会.*纪要/],
    '行动项忽略按钮',
  );
  await assertButtonBoundary(
    panelPage.locator('[data-action-filter="needs-info"]'),
    [/只改变本侧栏可见列表/, /不会确认/, /不会.*外部任务/],
    '需补信息筛选按钮',
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
  await assertButtonBoundary(
    panelPage.locator('.action-bulk-confirm', { hasText: '确认可用项' }),
    [/批量确认当前筛选/, /缺信息项仍跳过/, /不会标记完成/],
    '行动项批量确认按钮',
  );
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
    .waitFor({ state: 'attached', timeout: 15000 });
  await assertButtonBoundary(
    panelPage.locator('.action-copy-followup', { hasText: '复制跟进清单' }),
    [/只复制 \d+ 个已确认/, /本机剪贴板/, /不会改变复核\/完成状态/],
    '复制跟进清单按钮',
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
    .waitFor({ state: 'attached', timeout: 15000 });
  await assertButtonBoundary(
    panelPage.locator('.action-copy-all', { hasText: '复制当前筛选' }),
    [/只复制当前/, /本机剪贴板/, /不会改变复核\/完成\/忽略状态/],
    '复制当前筛选按钮',
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
    .waitFor({ state: 'attached', timeout: 15000 });
  await assertButtonBoundary(
    panelPage
      .locator(`[data-action-id="${firstActionId}"]`)
      .locator('button', { hasText: '复制' }),
    [/只复制/, /本机剪贴板/, /不会确认/],
    '单条行动项复制按钮',
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
    .waitFor({ state: 'attached', timeout: 15000 });
  await assertButtonBoundary(
    panelPage
      .locator(`[data-action-id="${firstActionId}"]`)
      .locator('button', { hasText: '编辑' }),
    [/本地校正表单/, /保存前不会改写行动项/, /外部任务/],
    '行动项编辑按钮',
  );
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
  await assertButtonBoundary(
    actionCard.locator('button', { hasText: '保存校正' }),
    [/保存.*标题、负责人和截止校正/, /标为已确认/, /不会修改原始 transcript/],
    '行动项保存校正按钮',
  );
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
