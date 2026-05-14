import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const require = createRequire(path.join(repoRoot, 'desktop-app/package.json'));
const { chromium } = require('playwright');

const extensionPath = path.join(repoRoot, 'dist');
const screenshotDir = path.join(repoRoot, 'test-results');
const userDataDir = await fs.mkdtemp(
  path.join(os.tmpdir(), 'personal-ai-memory-timeline-'),
);

const nowSeconds = Math.floor(Date.now() / 1000);
const recallRequests = [];
const focusRequests = [];
const feedbackRequests = [];

const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

try {
  await context.route('http://localhost:3210/api/v1/recall', async (route) => {
    const payload = route.request().postDataJSON();
    recallRequests.push(payload);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: `safe-${payload.scope}`,
            type: 'message',
            content: `Safe memory content for ${payload.scope}`,
            displayTitle: `Safe timeline memory ${payload.scope}`,
            displayText: `A real timeline row rendered from the ${payload.scope} recall response.`,
            score: 0.96,
            source: 'meeting',
            sourceUrl: 'https://example.com/timeline-safe',
            sourceTitle: 'Timeline source',
            exploreLink: '#/timeline?type=message&focus=safe',
            timestamp: nowSeconds,
            scope: payload.scope === 'personal' ? 'personal' : 'work',
            metadata: { channels: ['time'], recallFeedback: 'negative' },
          },
          {
            id: `unsafe-${payload.scope}`,
            type: 'message',
            content: 'Unsafe source should not become a button.',
            displayTitle: 'Unsafe source memory',
            displayText: 'The unsafe URL is present in data but not exposed as an external action.',
            score: 0.72,
            source: 'manual',
            sourceUrl: 'javascript:alert(1)',
            sourceTitle: 'Unsafe source',
            timestamp: nowSeconds - 60,
            scope: 'work',
            metadata: { channels: ['time'] },
          },
        ],
        totalFound: 2,
        queryTimeMs: 12,
        channels: ['time'],
      }),
    });
  });

  await context.route(
    'http://localhost:3210/api/v1/memories/message/focused-old',
    async (route) => {
      focusRequests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'focused-old',
          type: 'message',
          content: 'Focused memory content outside the selected time range.',
          displayTitle: 'Focused memory outside range',
          displayText:
            'This focused result is fetched directly and pinned above the timeline.',
          score: 1,
          source: 'manual',
          sourceUrl: 'https://example.com/focused',
          sourceTitle: 'Focused source',
          exploreLink: '#/timeline?type=message&focus=focused-old',
          timestamp: nowSeconds - 40 * 24 * 60 * 60,
          scope: 'work',
          metadata: { channels: ['direct'] },
        }),
      });
    },
  );

  await context.route('http://localhost:3210/api/v1/feedback', async (route) => {
    feedbackRequests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', targetType: 'message' }),
    });
  });

  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }
  const extensionId = new URL(worker.url()).host;
  assert.ok(extensionId, 'extension id should be available');

  const page = await context.newPage();
  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/timeline?type=message&focus=focused-old`,
    {
      waitUntil: 'domcontentloaded',
    },
  );

  await page.getByText('今日记忆时间轴').waitFor({ timeout: 10000 });
  await page.getByText('Focused memory outside range').waitFor({ timeout: 10000 });
  await page
    .getByText('已置顶定位记忆；它可能不属于当前时间范围。')
    .waitFor({ timeout: 10000 });
  await page.getByText('Safe timeline memory all').waitFor({ timeout: 10000 });
  await page.getByText('Unsafe source memory').waitFor({ timeout: 10000 });
  assert.equal(focusRequests.length, 1);
  assert.equal(
    await page.locator('.timeline-item.focused').count(),
    1,
    'focused timeline item should be visually marked',
  );

  assert.equal(recallRequests[0]?.query, '近期记忆时间轴');
  assert.equal(recallRequests[0]?.scope, 'all');
  assert.deepEqual(recallRequests[0]?.channels, ['time']);
  assert.ok(recallRequests[0]?.timeRange?.start);
  assert.ok(recallRequests[0]?.timeRange?.end);

  const openSourceButtons = await page
    .getByRole('button', { name: '打开来源' })
    .count();
  assert.equal(openSourceButtons, 2, 'only http/https source URLs should render');

  const safeTimelineCard = page.locator('article', {
    hasText: 'Safe timeline memory all',
  });
  await safeTimelineCard
    .getByText('已记录为不相关')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await safeTimelineCard
      .getByRole('button', { name: '不相关' })
      .getAttribute('aria-pressed'),
    'true',
    'persisted negative feedback should be restored on load',
  );
  await safeTimelineCard.getByRole('button', { name: '有用' }).click();
  await safeTimelineCard.getByText('已记录为有用').waitFor({ timeout: 10000 });
  assert.equal(
    await safeTimelineCard
      .getByRole('button', { name: '有用' })
      .getAttribute('aria-pressed'),
    'true',
  );
  assert.deepEqual(feedbackRequests[0], {
    type: 'recall_quality',
    targetId: 'safe-all',
    targetType: 'message',
    action: 'positive',
  });
  await safeTimelineCard.getByRole('button', { name: '不相关' }).click();
  await safeTimelineCard
    .getByText('已记录为不相关')
    .waitFor({ timeout: 10000 });
  assert.deepEqual(feedbackRequests[1], {
    type: 'recall_quality',
    targetId: 'safe-all',
    targetType: 'message',
    action: 'negative',
  });
  await safeTimelineCard.getByRole('button', { name: '撤销反馈' }).click();
  await safeTimelineCard.getByText('已撤销反馈').waitFor({ timeout: 10000 });
  assert.deepEqual(feedbackRequests[2], {
    type: 'recall_quality',
    targetId: 'safe-all',
    targetType: 'message',
    action: 'clear',
  });
  assert.equal(
    await safeTimelineCard
      .getByRole('button', { name: '不相关' })
      .getAttribute('aria-pressed'),
    'false',
  );
  assert.equal(
    await safeTimelineCard.getByRole('button', { name: '撤销反馈' }).count(),
    0,
    'clear action should return the card to a neutral feedback state',
  );

  await fs.mkdir(screenshotDir, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDir, 'memory-timeline-desktop.png'),
    fullPage: true,
  });

  await page
    .locator('.timeline-controls')
    .getByRole('button', { name: '工作' })
    .click();
  await page.getByText('Safe timeline memory work').waitFor({ timeout: 10000 });
  assert.equal(recallRequests.at(-1)?.scope, 'work');

  await page
    .locator('.timeline-controls')
    .getByRole('button', { name: '近7天' })
    .click();
  await page.getByText('近 7 天记忆时间轴').waitFor({ timeout: 10000 });
  await page.getByText('Safe timeline memory work').waitFor({ timeout: 10000 });
  const recentRequest = recallRequests.at(-1);
  assert.equal(recentRequest?.scope, 'work');
  assert.equal(
    recentRequest?.timeRange?.end - recentRequest?.timeRange?.start,
    7 * 24 * 60 * 60,
  );

  await page.setViewportSize({ width: 390, height: 780 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Focused memory outside range').waitFor({ timeout: 10000 });
  await page.waitForFunction(() => {
    const element = document.querySelector('.timeline-item.focused h3');
    const box = element?.getBoundingClientRect();
    return Boolean(box && box.y >= 0 && box.y < window.innerHeight);
  });
  const mobileTitleBox = await page
    .getByText('Focused memory outside range')
    .boundingBox();
  assert.ok(mobileTitleBox, 'mobile timeline title should have a layout box');
  assert.ok(
    mobileTitleBox.x >= 0 && mobileTitleBox.x < 390,
    'mobile focused timeline content should be horizontally visible',
  );
  assert.ok(
    mobileTitleBox.y >= 0 && mobileTitleBox.y < 780,
    'mobile focused timeline content should be visible without scrolling past the first viewport',
  );
  await page.screenshot({
    path: path.join(screenshotDir, 'memory-timeline-mobile.png'),
    fullPage: true,
  });

  console.log('verify-memory-timeline-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
