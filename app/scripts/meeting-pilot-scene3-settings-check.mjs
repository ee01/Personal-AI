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
  path.join(os.tmpdir(), 'meeting-pilot-scene3-'),
);

const welcomeUrl = 'https://v.ringcentral.com/welcome/join/';
const meetingId = 'fixture-meeting-003';
const meetingUrl = `https://v.ringcentral.com/conf/on/${meetingId}`;
const meetingTitle = 'Fixture RingCentral Settings Meeting';

const welcomeHtml = `<!doctype html><html><body><button id="startMeetingBtn">Start</button><script>document.getElementById('startMeetingBtn').addEventListener('click',()=>{location.href='${meetingUrl}'})</script></body></html>`;
const meetingHtml = `<!doctype html><html><head><title>${meetingTitle}</title></head><body><button>Leave meeting</button><button>Participants</button><button>Chat</button><button>Notes</button><button aria-label="Alex has a good connection">Alex</button><div>Esone Qiu (You)</div><button aria-label="Sarah Wang has a good connection">Sarah Wang</button></body></html>`;

function log(message) {
  console.log(`[meeting-pilot-scene3] ${message}`);
}

async function saveScreenshot(page, filename) {
  const fullPath = path.join(screenshotDir, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  return fullPath;
}

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'meeting-pilot-scene3-browser-'),
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

  await context.route('https://v.ringcentral.com/**', async (route) => {
    const url = new URL(route.request().url());
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

  log('验证总开关关闭时不会自动注入');
  await page.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'load',
  });
  await page.evaluate(async () => {
    await chrome.storage.local.set({
      envConfig: {
        MEETING_PILOT_ENABLED: false,
        MEETING_FEATURE_ENABLED: false,
        MEETING_AUTO_DETECT: false,
        MEETING_ENTRY_MODE: 'manual',
      },
    });
  });
  await page.goto(welcomeUrl, { waitUntil: 'load' });
  await page.click('#startMeetingBtn');
  await page.waitForURL(meetingUrl, { timeout: 10000 });
  await page.waitForTimeout(1500);
  const noOverlay = await page.evaluate(
    () => !document.getElementById('meeting-pilot-overlay-root'),
  );
  assert.equal(noOverlay, true, '禁用 Meeting Pilot 后仍自动注入 overlay');

  log('验证开启后，privacy notice / hotwords / aliases 会影响真实运行时');
  const settingsPage = await context.newPage();
  await settingsPage.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'load',
  });
  await settingsPage.evaluate(async () => {
    await chrome.storage.local.set({
      envConfig: {
        MEETING_PILOT_ENABLED: true,
        MEETING_FEATURE_ENABLED: true,
        MEETING_AUTO_DETECT: true,
        MEETING_ENTRY_MODE: 'auto',
        MEETING_MEMORY_CONTEXT_ENABLED: true,
        MEETING_PRIVACY_NOTICE_TEXT:
          '请注意：会议内容将用于 Meeting Pilot 分析。',
        MEETING_HOTWORDS: '技术评审',
        MEETING_NAME_ALIASES: 'Alex=Alex Chen',
      },
    });
  });
  await settingsPage.close();
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => {
    const host = document.getElementById('meeting-pilot-overlay-root');
    return Boolean(host?.shadowRoot?.getElementById('mpTopicMeta'));
  });
  const overlayMeta = await page.evaluate(() => {
    const host = document.getElementById('meeting-pilot-overlay-root');
    return host?.shadowRoot?.getElementById('mpTopicMeta')?.textContent || '';
  });
  assert.match(overlayMeta, /请注意：会议内容将用于 Meeting Pilot 分析/);
  await saveScreenshot(page, 'scene3-overlay-settings.png');

  const panelPage = await context.newPage();
  await panelPage.goto(
    `chrome-extension://${extensionId}/meeting-sidepanel.html?scene3Probe=1`,
    {
      waitUntil: 'load',
    },
  );
  const meetingTabId = await panelPage.evaluate(async (targetUrl) => {
    const tabs = await chrome.tabs.query({ url: targetUrl });
    return tabs[0]?.id ?? null;
  }, meetingUrl);
  assert.ok(Number.isFinite(meetingTabId), '未找到 scene3 meeting tab');
  await panelPage.goto(
    `chrome-extension://${launched.extensionId}/meeting-sidepanel.html?tabId=${meetingTabId}&scene3=1`,
    { waitUntil: 'load' },
  );
  await page.reload({ waitUntil: 'load' });
  await panelPage.evaluate(
    async ({ tabId }) => {
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_TRANSCRIPT_UPDATE',
        tabId,
        transcriptChunk: {
          id: 'scene3-t1',
          speaker: 'Alex',
          text: '今天重点看技术评审 owner。',
          ts: Date.now(),
        },
      });
    },
    { tabId: meetingTabId },
  );
  await panelPage.waitForFunction(() => {
    const cards = Array.from(document.querySelectorAll('.current-topic-card'));
    const topicCard = cards.find((card) =>
      /当前话题/.test(card.textContent || ''),
    );
    return Boolean(
      topicCard?.querySelector('.value')?.textContent?.includes('技术评审'),
    );
  });
  const currentTopic = await panelPage.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.current-topic-card'));
    const topicCard = cards.find((card) =>
      /当前话题/.test(card.textContent || ''),
    );
    return topicCard?.querySelector('.value')?.textContent || '';
  });
  assert.match(currentTopic || '', /技术评审/);

  await panelPage.locator('.panel-tab', { hasText: '时间线' }).click();
  const timelineItems = panelPage.locator('.mini-tl-item');
  const timelineCount = await timelineItems.count();
  for (let index = 0; index < timelineCount; index += 1) {
    await timelineItems.nth(index).click();
  }
  await panelPage.waitForFunction(() => {
    return Array.from(document.querySelectorAll('.detail-speaker')).some((el) =>
      /Alex Chen/.test(el.textContent || ''),
    );
  });
  await saveScreenshot(panelPage, 'scene3-sidepanel-settings-effects.png');

  log(`Scene 3 设置行为验证通过，截图目录: ${screenshotDir}`);
  await panelPage.close();
  await page.close();
} finally {
  if (launched?.context) {
    await launched.context.close();
  }
}
