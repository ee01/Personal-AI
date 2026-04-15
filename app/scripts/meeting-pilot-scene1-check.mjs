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
  path.join(os.tmpdir(), 'meeting-pilot-scene1-'),
);

const welcomeUrl = 'https://v.ringcentral.com/welcome/join/';
const meetingId = 'fixture-meeting-001';
const meetingUrl = `https://v.ringcentral.com/conf/on/${meetingId}`;
const meetingTitle = 'Fixture RingCentral Meeting';
const minutesBaseUrl = 'https://minutes.example.test';

const welcomeHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RingCentral Welcome Fixture</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: system-ui, sans-serif;
        background: linear-gradient(135deg, #111827, #1f2937);
        color: #f9fafb;
      }
      .card {
        width: min(92vw, 420px);
        padding: 32px;
        border-radius: 20px;
        background: rgba(17, 24, 39, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
      }
      button {
        margin-top: 18px;
        width: 100%;
        border: none;
        border-radius: 12px;
        padding: 14px 16px;
        font-size: 15px;
        font-weight: 700;
        color: white;
        cursor: pointer;
        background: linear-gradient(135deg, #2563eb, #3b82f6);
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Join RingCentral Fixture</h1>
      <p>This is a deterministic fixture for Meeting Pilot Scene 1.</p>
      <button id="startMeetingBtn" type="button">Start</button>
    </div>
    <script>
      document.getElementById('startMeetingBtn')?.addEventListener('click', () => {
        window.location.href = '${meetingUrl}';
      });
    </script>
  </body>
</html>`;

const meetingHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${meetingTitle}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        font-family: system-ui, sans-serif;
        background: radial-gradient(circle at top, rgba(37, 99, 235, 0.18), transparent 30%), #0f172a;
        color: #e2e8f0;
      }
      .shell {
        display: grid;
        grid-template-columns: 220px 1fr 280px;
        gap: 16px;
        padding: 20px;
      }
      .panel {
        border-radius: 18px;
        padding: 18px;
        background: rgba(15, 23, 42, 0.88);
        border: 1px solid rgba(148, 163, 184, 0.14);
      }
      .panel h2 {
        margin-top: 0;
      }
      button {
        display: block;
        width: 100%;
        margin-top: 10px;
        border: none;
        border-radius: 12px;
        padding: 10px 12px;
        background: rgba(30, 41, 59, 0.92);
        color: inherit;
        text-align: left;
      }
      .tile {
        margin-top: 12px;
        padding: 14px;
        border-radius: 14px;
        background: rgba(30, 41, 59, 0.75);
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="panel">
        <h2>Controls</h2>
        <button>Leave meeting</button>
        <button>Participants</button>
        <button>Chat</button>
        <button>Notes</button>
      </section>
      <main class="panel">
        <h1>${meetingTitle}</h1>
        <p>This fixture keeps the RingCentral meeting URL real while serving local HTML.</p>
        <button class="tile" aria-label="Alex Chen has a good connection">Alex Chen</button>
        <div class="tile">Esone Qiu (You)</div>
        <button class="tile" aria-label="Sarah Wang has a good connection">Sarah Wang</button>
        <button class="tile" aria-label="Mike Liu has a good connection">Mike Liu</button>
      </main>
      <aside class="panel">
        <h2>Meeting Notes</h2>
        <p>Agenda: budget review, timeline, technical review, next steps.</p>
      </aside>
    </div>
  </body>
</html>`;

function log(message) {
  console.log(`[meeting-pilot-scene1] ${message}`);
}

async function saveScreenshot(page, filename) {
  const fullPath = path.join(screenshotDir, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  return fullPath;
}

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'meeting-pilot-scene1-browser-'),
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

function buildPageErrorCollector(page) {
  const pageErrors = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error instanceof Error ? error.message : String(error));
  });
  return () => {
    assert.deepEqual(pageErrors, [], `页面脚本异常: ${pageErrors.join('; ')}`);
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
          MEETING_PROVIDER_API_KEY: 'scene1-provider-key',
          MEETING_TRANSCRIBE_MODEL: 'whisper-1',
          MEETING_ANALYSIS_MODEL: 'gpt-5.4-mini',
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
  const assertNoMeetingPageErrors = buildPageErrorCollector(page);

  log('Scene 1.1 打开 welcome/join fixture 页面');
  await page.goto(welcomeUrl, { waitUntil: 'load' });
  await page.waitForSelector('#startMeetingBtn');
  assert.equal(page.url(), welcomeUrl);
  await saveScreenshot(page, 'scene1-1-welcome.png');

  log('Scene 1.2 点击 Start，跳转到 /conf/on/:meetingId');
  await page.locator('#startMeetingBtn').click();
  await page.waitForURL(meetingUrl, { timeout: 10000 });
  assert.equal(page.url(), meetingUrl);

  log('Scene 1.3 等待 content script 注入页内入口');
  await page.waitForFunction(() => {
    const host = document.getElementById('meeting-pilot-overlay-root');
    return Boolean(host?.shadowRoot?.getElementById('mpEntry'));
  });
  await page.waitForFunction(() => {
    const host = document.getElementById('meeting-pilot-overlay-root');
    const count =
      host?.shadowRoot?.getElementById('mpParticipantCount')?.textContent ||
      '0';
    return Number.parseInt(count, 10) >= 4;
  });

  const overlayState = await page.evaluate(() => {
    const host = document.getElementById('meeting-pilot-overlay-root');
    const shadow = host?.shadowRoot;
    return {
      hasOverlay: Boolean(host),
      hasEntry: Boolean(shadow?.getElementById('mpEntry')),
      statusText:
        shadow?.getElementById('mpStatusText')?.textContent?.trim() || '',
      entryCaption:
        shadow?.getElementById('mpEntryCaption')?.textContent?.trim() || '',
      idlePrimaryText:
        shadow?.getElementById('mpIdlePrimaryAction')?.textContent?.trim() ||
        '',
      topicTitle:
        shadow?.getElementById('mpTopicTitle')?.textContent?.trim() || '',
      topicMeta:
        shadow?.getElementById('mpTopicMeta')?.textContent?.trim() || '',
      participantCount:
        shadow?.getElementById('mpParticipantCount')?.textContent?.trim() || '',
    };
  });

  assert.equal(overlayState.hasOverlay, true, '未注入 overlay host');
  assert.equal(overlayState.hasEntry, true, '未渲染 Meeting Pilot 入口按钮');

  log('Scene 1.4 验证 Idle 状态文案');
  assert.ok(
    ['READY', 'DEGRADED'].includes(overlayState.statusText),
    `Idle 状态不应为阻断态: ${overlayState.statusText}`,
  );
  assert.match(overlayState.idlePrimaryText, /开始 Capture/);
  assert.match(overlayState.topicTitle, /授权并开启 Capture/);
  assert.ok(
    Number.parseInt(overlayState.participantCount || '0', 10) >= 4,
    `参会人数未正确渲染: ${overlayState.participantCount}`,
  );
  await saveScreenshot(page, 'scene1-2-overlay.png');
  assertNoMeetingPageErrors();

  log('附加校验: background 已收到会议上下文，side panel 不再回落到 demo 数据');
  const panelPage = await context.newPage();
  const assertNoPanelPageErrors = buildPageErrorCollector(panelPage);
  await panelPage.goto(
    `chrome-extension://${extensionId}/meeting-sidepanel.html?scene1StateProbe=1`,
    { waitUntil: 'load' },
  );
  const meetingTabId = await panelPage.evaluate(async (targetUrl) => {
    const tabs = await chrome.tabs.query({ url: targetUrl });
    return tabs[0]?.id ?? null;
  }, meetingUrl);
  assert.ok(
    Number.isFinite(meetingTabId),
    `未找到会议 tabId: ${String(meetingTabId)}`,
  );
  await panelPage.goto(
    `chrome-extension://${extensionId}/meeting-sidepanel.html?tabId=${meetingTabId}&scene1Check=1`,
    { waitUntil: 'load' },
  );
  await panelPage.waitForFunction(
    () => {
      const shell = document.querySelector('.meeting-shell');
      return Boolean(shell && shell.getAttribute('data-session-title'));
    },
    { timeout: 15000 },
  );
  await panelPage.waitForFunction(
    (expectedTitle) => {
      const element = document.querySelector('.meeting-shell');
      return (
        (element?.getAttribute('data-session-title') || '').trim() ===
        expectedTitle
      );
    },
    meetingTitle,
    { timeout: 15000 },
  );
  const panelTitle = (
    await panelPage.locator('.meeting-shell').getAttribute('data-session-title')
  )?.trim();
  assert.equal(
    panelTitle,
    meetingTitle,
    `side panel 未绑定真实会议状态: ${panelTitle}`,
  );

  log('附加校验: side panel 设置页展示核心服务状态与 options 入口');
  await panelPage.locator('.panel-tab', { hasText: '设置' }).click();
  await panelPage.waitForFunction(() => {
    return Array.from(document.querySelectorAll('.settings-chip')).some((el) =>
      /Whisper|Minutes API/.test(el.textContent || ''),
    );
  });
  const settingsSnapshot = await panelPage.evaluate(() => ({
    chips: Array.from(document.querySelectorAll('.settings-chip')).map((el) =>
      (el.textContent || '').trim(),
    ),
    values: Array.from(document.querySelectorAll('.setting-value')).map((el) =>
      (el.textContent || '').trim(),
    ),
    buttons: Array.from(document.querySelectorAll('button')).map((el) =>
      (el.textContent || '').trim(),
    ),
  }));
  assert.ok(
    settingsSnapshot.chips.some((label) => label.includes('Whisper')),
    `设置页未展示 Whisper 状态: ${JSON.stringify(settingsSnapshot.chips)}`,
  );
  assert.ok(
    settingsSnapshot.chips.some((label) => label.includes('Minutes API')),
    `设置页未展示 Minutes API 状态: ${JSON.stringify(settingsSnapshot.chips)}`,
  );
  assert.ok(
    settingsSnapshot.values.some((label) =>
      /whisper-1|gpt-5\.4-mini/.test(label),
    ),
    `设置页未展示模型信息: ${JSON.stringify(settingsSnapshot.values)}`,
  );
  assert.ok(
    settingsSnapshot.buttons.includes('前往选项页配置服务与密钥'),
    '设置页缺少前往 options 的服务配置入口',
  );
  await saveScreenshot(panelPage, 'scene1-3-sidepanel.png');
  assertNoPanelPageErrors();

  log('附加校验: overlay 渲染 P0 年龄标签与记忆弹幕链接');
  await panelPage.evaluate(
    async ({ tabId, url, title, meetingId }) => {
      await chrome.tabs.sendMessage(tabId, {
        type: 'MEETING_PILOT_SESSION_SNAPSHOT',
        snapshot: {
          meetingId,
          tabId,
          url,
          title,
          status: 'ready',
          inMeeting: true,
          shareState: 'active',
          selfSharing: false,
          sharerName: 'Sarah Wang',
          speakerLabel: 'Alex Chen',
          participantCount: 4,
          capture: {
            kind: 'recording',
            startedAt: Date.now() - 120000,
            chunkCount: 3,
          },
          digest: {
            status: 'processing',
          },
          alerts: [
            {
              id: 'fixture-p0-1',
              level: 'P0',
              title: '你被点名',
              body: 'Alex 要求你确认技术评审 owner。',
              source: 'mention',
              createdAt: Date.now() - 65000,
            },
            {
              id: 'fixture-p1-1',
              level: 'P1',
              title: '话题切换',
              body: '讨论已切换到技术方案评审。',
              source: 'summary',
              createdAt: Date.now() - 30000,
            },
          ],
          chapters: [],
          currentTopic: '技术方案评审',
          actionItems: [],
          decisions: [],
          timelineEvents: [],
          participants: [
            {
              id: 'alex',
              name: 'Alex Chen',
              role: '主持人',
              speakingPct: 35,
              stances: [
                {
                  topic: 'Q2 预算',
                  stance: '主导',
                  keyQuote: '“200万的预算分配需要今天敲定。”',
                  timeRange: '📍 10:05 - 10:15',
                },
              ],
            },
            {
              id: 'sarah',
              name: 'Sarah Wang',
              role: 'PM',
              speakingPct: 22,
              stances: [
                {
                  topic: '排期安排',
                  stance: '主导',
                  keyQuote: '“Sprint 7-12 排期已拉通。”',
                  timeRange: '📍 10:18 - 10:27',
                },
              ],
            },
          ],
          transcript: [],
          memoryRefs: [
            {
              id: 'fixture-memory-1',
              title: 'Q2 预算复盘',
              snippet: '上季度也讨论过类似的研发投入争议。',
              fullSnippet:
                '上季度也讨论过类似的研发投入争议。Sarah 当时建议提前锁定 QA 资源，并把评审 owner 提前明确。',
              score: 0.91,
              sourceLabel: 'memory-service',
              sourceUrl: 'https://example.com/q2-review',
            },
          ],
          summary: 'Fixture summary',
          timelineProgress: 0.45,
          detectedAt: Date.now() - 180000,
          updatedAt: Date.now(),
        },
      });
    },
    {
      tabId: meetingTabId,
      url: meetingUrl,
      title: meetingTitle,
      meetingId,
    },
  );

  await page.waitForFunction(
    () => {
      const host = document.getElementById('meeting-pilot-overlay-root');
      const shadow = host?.shadowRoot;
      const p0Label =
        shadow?.querySelector('.p0-label .ago')?.textContent || '';
      const memoryLink =
        shadow?.querySelector('.danmaku-item.memory-danmaku a')?.textContent ||
        '';
      return Boolean(p0Label) && /查看/.test(memoryLink);
    },
    { timeout: 15000 },
  );

  const overlayAlertState = await page.evaluate(() => {
    const host = document.getElementById('meeting-pilot-overlay-root');
    const shadow = host?.shadowRoot;
    return {
      p0Age: shadow?.querySelector('.p0-label .ago')?.textContent?.trim() || '',
      memoryLink:
        shadow
          ?.querySelector('.danmaku-item.memory-danmaku a')
          ?.textContent?.trim() || '',
      memorySummary:
        shadow
          ?.querySelector('.danmaku-item.memory-danmaku .danmaku-summary')
          ?.textContent?.trim() || '',
      memoryFullText:
        shadow
          ?.querySelector('.danmaku-item.memory-danmaku .danmaku-full-text')
          ?.textContent?.trim() || '',
      memoryClass:
        shadow?.querySelector('.danmaku-item.memory-danmaku')?.className || '',
    };
  });

  assert.ok(overlayAlertState.p0Age.length > 0, 'P0 提醒未显示年龄标签');
  assert.match(overlayAlertState.memoryLink, /查看/);
  assert.match(overlayAlertState.memoryClass, /memory-danmaku/);
  assert.ok(overlayAlertState.memorySummary.length > 0, '记忆弹幕未渲染 summary');
  assert.ok(
    overlayAlertState.memoryFullText.includes('Sarah 当时建议提前锁定 QA 资源'),
    '记忆弹幕未保留完整展开文本',
  );

  log('附加校验: 真实会议节点 hover 后出现 stance 卡片');
  await page
    .locator('button[aria-label="Alex Chen has a good connection"]')
    .hover();
  await page.waitForFunction(() => {
    const card = document.querySelector('.meeting-pilot-stance-card');
    return Boolean(card?.textContent?.includes('Q2 预算'));
  });
  const hoverStanceState = await page.evaluate(() => ({
    cards: document.querySelectorAll('.meeting-pilot-stance-card').length,
    text:
      document.querySelector('.meeting-pilot-stance-card')?.textContent || '',
  }));
  assert.ok(hoverStanceState.cards >= 1, 'hover stance 卡片未注入');
  assert.match(hoverStanceState.text, /Q2 预算/);
  await saveScreenshot(page, 'scene1-4b-hover-stance.png');
  await saveScreenshot(page, 'scene1-4-overlay-alerts.png');

  log('附加校验: 扩展 panorama 页面支持 PDF 区块与立场展开');
  const panoramaPage = await context.newPage();
  const assertNoPanoramaErrors = buildPageErrorCollector(panoramaPage);
  await panoramaPage.goto(
    `chrome-extension://${extensionId}/meeting-panorama.html?demo=1&scene1PanoramaProbe=1`,
    { waitUntil: 'load' },
  );
  await panoramaPage.locator('#pdfPreviewSection').waitFor({ timeout: 15000 });
  await panoramaPage
    .locator('.stance-toggle')
    .first()
    .waitFor({ state: 'attached', timeout: 15000 });
  await panoramaPage.locator('.stance-toggle').first().scrollIntoViewIfNeeded();
  const stanceBefore = await panoramaPage
    .locator('.stance-details')
    .first()
    .evaluate((el) => getComputedStyle(el).display);
  await panoramaPage.locator('.stance-toggle').first().click();
  await panoramaPage.waitForFunction(() => {
    const details = document.querySelector('.stance-details');
    return details && getComputedStyle(details).display !== 'none';
  });
  const panoramaState = await panoramaPage.evaluate(() => ({
    pdfSection: Boolean(document.getElementById('pdfPreviewSection')),
    pdfButton: (
      Array.from(document.querySelectorAll('button')).find((button) =>
        /会议纪要 PDF/.test(button.textContent || ''),
      )?.textContent || ''
    ).trim(),
    expandedVisible: (() => {
      const details = document.querySelector('.stance-details');
      return details ? getComputedStyle(details).display !== 'none' : false;
    })(),
  }));
  assert.equal(stanceBefore, 'none', '立场详情默认不应展开');
  assert.equal(panoramaState.pdfSection, true, 'Panorama 缺少 PDF 预览区块');
  assert.match(panoramaState.pdfButton, /会议纪要 PDF/);
  assert.equal(panoramaState.expandedVisible, true, '立场展开交互未生效');
  await saveScreenshot(panoramaPage, 'scene1-5-panorama.png');
  assertNoPanoramaErrors();
  await panoramaPage.close();

  await panelPage.close();

  await page.close();
  log(`Scene 1 验证通过，截图目录: ${screenshotDir}`);
} finally {
  if (launched?.context) {
    await launched.context.close();
  }
}
