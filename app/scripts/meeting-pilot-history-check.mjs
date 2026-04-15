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
  path.join(os.tmpdir(), 'meeting-pilot-history-check-'),
);
const memoryBaseUrl = 'https://memory.example.test';

function log(message) {
  console.log(`[meeting-pilot-history] ${message}`);
}

async function saveScreenshot(page, filename) {
  const fullPath = path.join(screenshotDir, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  return fullPath;
}

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'meeting-pilot-history-browser-'),
  );
  const extensionPath = path.join(repoRoot, 'dist');
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
          MEMORY_SERVICE_BASE_URL: configuredBaseUrl,
          MEMORY_SERVICE_API_KEY: 'history-check-key',
        },
      }),
    memoryBaseUrl,
  );

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/memory-exploring.html`, {
    waitUntil: 'load',
    timeout: 30000,
  });
  await page.evaluate(async () => {
    await chrome.runtime.sendMessage({
      type: 'SET_TEST_MEETINGS_FIXTURE',
      fixture: {
        items: [
          {
            meetingId: 'meeting-archive-001',
            title: 'Q2 Planning Review',
            date: 1712505600000,
            lastEventAt: 1712509200000,
            participants: ['Alex Chen', 'Esone Qiu', 'Sarah Wang'],
            pdfUrl: 'https://memory.example.test/files/q2-planning.pdf',
            digestId: 'digest-q2-planning',
            summary: '确认了 Q2 预算、技术评审 owner 与下一步行动。',
            topicCount: 3,
            actionItemCount: 2,
            decisionCount: 2,
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
        detail: {
          meetingId: 'meeting-archive-001',
          title: 'Q2 Planning Review',
          date: 1712505600000,
          lastEventAt: 1712509200000,
          participants: ['Alex Chen', 'Esone Qiu', 'Sarah Wang'],
          pdfUrl: 'https://memory.example.test/files/q2-planning.pdf',
          digestId: 'digest-q2-planning',
          summary: '确认了 Q2 预算、技术评审 owner 与下一步行动。',
          latestObservationText: '共享画面显示预算表和 Sprint 甘特图。',
          topicCount: 3,
          actionItemCount: 2,
          decisionCount: 2,
          chapters: [
            {
              id: 'chapter-1',
              title: 'Q2 预算讨论',
              summary: '预算与 owner 被确认。',
              startLabel: '10:05',
              actionCount: 1,
              decisionCount: 1,
            },
          ],
          actionItems: [
            {
              id: 'action-1',
              title: '准备技术评审文档',
              owner: 'Esone',
              deadline: '04-08',
              status: 'pending',
            },
          ],
          decisions: [
            {
              id: 'decision-1',
              text: 'Q2 预算确认为 200 万。',
              timestamp: '10:15',
            },
          ],
          timelineEvents: [
            {
              id: 'timeline-1',
              type: 'decision',
              title: 'Q2 预算确认为 200 万',
              description: '云服务 40%，人力 45%，弹性 15%。',
              timestamp: '10:15',
            },
          ],
          participantStances: [
            {
              participant: 'Sarah Wang',
              topic: 'Q2 预算',
              stance: '支持',
              keyQuote: '预算分配合理，建议保留弹性预算。',
              timeRange: '10:12',
            },
          ],
        },
      },
    });
  });

  log('打开 memory-exploring 会议记录页');
  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/meetings`,
    {
      waitUntil: 'load',
      timeout: 30000,
    },
  );

  await page.waitForFunction(
    () => {
      return Array.from(document.querySelectorAll('.meeting-card')).length >= 1;
    },
    { timeout: 15000 },
  );

  const cardText = await page.locator('.meeting-card').first().textContent();
  assert.match(cardText || '', /Q2 Planning Review/);
  assert.match(cardText || '', /Digest 完成/);
  assert.match(cardText || '', /PDF 已就绪/);
  assert.match(cardText || '', /确认了 Q2 预算/);
  assert.match(cardText || '', /话题 3/);
  assert.match(cardText || '', /行动项 2/);
  assert.match(cardText || '', /决议 2/);
  await saveScreenshot(page, 'history-list.png');

  await page.evaluate(() => {
    const opened = [];
    window.__meetingHistoryOpenedUrls = opened;
    window.open = (url) => {
      opened.push(String(url || ''));
      return null;
    };
  });

  log('验证打开 Panorama 与 PDF 动作');
  await page.locator('.meeting-primary-action').click();
  await page.locator('.meeting-secondary-action').click();
  const openedUrls = await page.evaluate(
    () => window.__meetingHistoryOpenedUrls || [],
  );
  assert.ok(
    openedUrls.some((url) =>
      /meeting-panorama\.html\?.*meetingId=meeting-archive-001/.test(url),
    ),
    `打开 Panorama 未请求预期 URL: ${JSON.stringify(openedUrls)}`,
  );
  assert.ok(
    openedUrls.includes('https://memory.example.test/files/q2-planning.pdf'),
    `打开 PDF 未请求预期 URL: ${JSON.stringify(openedUrls)}`,
  );

  log(`会议历史 UI 验证通过，截图目录: ${screenshotDir}`);
  await page.close();
} finally {
  await launched?.context?.close().catch(() => undefined);
}
