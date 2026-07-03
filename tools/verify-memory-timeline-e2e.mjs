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
let failNextRecallWith = '';
let delayNextRecallMs = 0;
let emptyNextRecall = false;

function assertFeedbackRequest(index, expected, expectedDetail = {}) {
  const request = feedbackRequests[index];
  const { detail, ...base } = request;
  assert.deepEqual(base, expected);
  assert.equal(typeof detail, 'string', 'feedback detail should be serialized');
  const parsedDetail = JSON.parse(detail);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(expectedDetail).map(([key, value]) => [
        key,
        parsedDetail[key],
      ]),
    ),
    expectedDetail,
  );
  assert.equal(
    typeof parsedDetail.scene_anchor_signature,
    'string',
    'feedback detail should include scene signature',
  );
}

async function assertClass(locator, className, message) {
  const classes = (await locator.getAttribute('class')) || '';
  assert.match(classes, new RegExp(`\\b${className}\\b`), message);
}

async function assertNoClass(locator, className, message) {
  const classes = (await locator.getAttribute('class')) || '';
  assert.doesNotMatch(classes, new RegExp(`\\b${className}\\b`), message);
}

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
    if (delayNextRecallMs > 0) {
      const delayMs = delayNextRecallMs;
      delayNextRecallMs = 0;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    if (failNextRecallWith) {
      const error = failNextRecallWith;
      failNextRecallWith = '';
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error }),
      });
      return;
    }
    if (emptyNextRecall) {
      emptyNextRecall = false;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          totalFound: 0,
          queryTimeMs: 8,
          channels: ['time'],
        }),
      });
      return;
    }

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
            displayText:
              'The signed source URL is present in data but not exposed as an external action.',
            score: 0.72,
            source: 'manual',
            sourceUrl:
              'https://files.example.com/private.pdf?X-Amz-Signature=abc&X-Amz-Credential=scope',
            sourceTitle: 'Unsafe source',
            exploreLink: '#/timeline?focus=%3Cscript%3E',
            timestamp: nowSeconds - 60,
            scope: 'work',
            metadata: { channels: ['time'] },
          },
          {
            id: `readonly-${payload.scope}`,
            type: 'chunk',
            content: 'Readonly timeline row without a route or source URL.',
            displayTitle: 'Readonly memory without target',
            displayText:
              'This timeline row should be readable without implying that the card opens a source.',
            score: 0.68,
            timestamp: nowSeconds - 120,
            scope: 'work',
            metadata: { channels: ['time'] },
          },
        ],
        totalFound: 3,
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

  await context.route(
    'http://localhost:3210/api/v1/memories/message/focused-manual',
    async (route) => {
      focusRequests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'focused-manual',
          type: 'message',
          content:
            'Focused manual memory outside the active source filter should still be visible.',
          displayTitle: 'Focused manual source memory',
          displayText:
            'This focus link should clear the source filter before scrolling.',
          score: 1,
          source: 'manual',
          sourceUrl: 'https://example.com/focused-manual',
          sourceTitle: 'Manual focus source',
          exploreLink: '#/timeline?type=message&focus=focused-manual',
          timestamp: nowSeconds - 45 * 24 * 60 * 60,
          scope: 'work',
          metadata: { channels: ['direct'] },
        }),
      });
    },
  );

  await context.route(
    'http://localhost:3210/api/v1/feedback',
    async (route) => {
      feedbackRequests.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', targetType: 'message' }),
      });
    },
  );

  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }
  const extensionId = new URL(worker.url()).host;
  assert.ok(extensionId, 'extension id should be available');

  const page = await context.newPage();
  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/timeline?focus=message:focused-old`,
    {
      waitUntil: 'domcontentloaded',
    },
  );

  await page.getByText('今日记忆时间轴').waitFor({ timeout: 10000 });
  await page
    .getByText('全部记忆 · 今天 · 全部来源 · 时间通道')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('全部 · 今天 · 时间轴回执')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('范围：读取全部记忆；卡片仍保留工作/个人标签。')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('时间：通过 time 通道请求今天窗口，结果按记忆时间分组。')
    .waitFor({ timeout: 10000 });
  await page
    .getByText(
      '定位：目标记忆已置顶；它可能来自当前时间窗或来源筛选之外，请按“定位目标”标记判断。',
    )
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page
      .locator('.search-header .scope-segmented')
      .getByRole('button', { name: '全部' })
      .getAttribute('aria-pressed'),
    'true',
    'timeline without scope query should align the global scope control to all',
  );
  assert.equal(
    await page
      .locator('.timeline-controls')
      .getByRole('button', { name: '全部' })
      .getAttribute('aria-pressed'),
    'true',
    'timeline scope control should expose the active all scope',
  );
  await page
    .getByText('Focused memory outside range')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('已置顶定位记忆；它可能不属于当前时间范围。')
    .waitFor({ timeout: 10000 });
  await page.getByText('Safe timeline memory all').waitFor({ timeout: 10000 });
  await page.getByText('Unsafe source memory').waitFor({ timeout: 10000 });
  await page
    .getByText('Readonly memory without target')
    .waitFor({ timeout: 10000 });
  const sourceOverview = page.getByLabel('时间轴来源覆盖');
  await sourceOverview.getByText('来源覆盖').waitFor({ timeout: 10000 });
  await sourceOverview.getByText('4 条已加载').waitFor({ timeout: 10000 });
  await sourceOverview
    .getByText(
      '当前展示全部来源；点击来源只会收窄这批已加载结果，不会扩大检索范围。',
    )
    .waitFor({ timeout: 10000 });
  await sourceOverview
    .getByRole('button', { name: /Focused source\s*1/ })
    .waitFor({ timeout: 10000 });
  await sourceOverview
    .getByRole('button', { name: /Timeline source\s*1/ })
    .waitFor({ timeout: 10000 });
  await sourceOverview
    .getByRole('button', { name: /Unsafe source\s*1/ })
    .waitFor({ timeout: 10000 });
  await sourceOverview
    .getByRole('button', { name: /来源未知\s*1/ })
    .waitFor({ timeout: 10000 });
  const dayHeaderTexts = await page
    .locator('.timeline-day-header')
    .allInnerTexts();
  assert.ok(
    dayHeaderTexts.some(
      (text) => text.includes('1 条记忆') && text.includes('Focused source'),
    ),
    'focused out-of-range item should keep its own dated group with source context',
  );
  assert.ok(
    dayHeaderTexts.some(
      (text) =>
        text.includes('3 条记忆') &&
        text.includes('Timeline source') &&
        text.includes('Unsafe source'),
    ),
    'timeline should group same-day recall rows with a source summary even when one row has no source',
  );
  assert.equal(focusRequests.length, 1);
  assert.ok(
    focusRequests[0].endsWith('/api/v1/memories/message/focused-old'),
    'legacy focus=message:<id> links should resolve to the typed message lookup',
  );
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
  assert.equal(
    openSourceButtons,
    2,
    'only http/https source URLs should render',
  );
  const unsafeTimelineCard = page.locator('article', {
    hasText: 'Unsafe source memory',
  });
  await unsafeTimelineCard
    .locator('.link-safety-note')
    .getByText('来源链接已隐藏：包含签名或访问凭据参数', {
      exact: true,
    })
    .waitFor({ timeout: 10000 });
  await unsafeTimelineCard
    .locator('.link-safety-note')
    .getByText('记忆内跳转已隐藏：不支持的目标', { exact: true })
    .waitFor({ timeout: 10000 });
  const unsafeLinkStatus = unsafeTimelineCard.locator(
    '.memory-link-safety-status-warning',
  );
  await unsafeLinkStatus
    .getByText('来源或跳转已隐藏')
    .waitFor({ timeout: 10000 });
  await unsafeLinkStatus
    .getByText('安全拦截')
    .waitFor({ timeout: 10000 });
  await unsafeLinkStatus
    .getByText('2 项原因')
    .waitFor({ timeout: 10000 });
  await unsafeTimelineCard
    .getByLabel('时间轴卡片点击行为')
    .getByText('卡片点击：查看拦截原因')
    .waitFor({ timeout: 10000 });
  await unsafeTimelineCard
    .getByLabel('时间轴卡片点击行为')
    .getByText('2 项目标被隐藏，不会打开外部网页')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await unsafeTimelineCard.getByRole('button', { name: '打开来源' }).count(),
    0,
    'unsafe source URL should not expose an open-source button',
  );
  assert.equal(
    await unsafeTimelineCard.getByRole('button', { name: '在记忆中查看' }).count(),
    0,
    'unsupported internal route should not expose a memory-jump button',
  );
  const readonlyTimelineCard = page.locator('article', {
    hasText: 'Readonly memory without target',
  });
  await readonlyTimelineCard
    .locator('.memory-link-safety-status-muted')
    .getByText('暂无可打开目标')
    .waitFor({ timeout: 10000 });
  await readonlyTimelineCard
    .getByLabel('时间轴卡片点击行为')
    .getByText('只读卡片')
    .waitFor({ timeout: 10000 });
  await readonlyTimelineCard
    .getByLabel('时间轴卡片点击行为')
    .getByText('没有安全内链或 http/https 来源')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await readonlyTimelineCard.getByRole('button', { name: '打开来源' }).count(),
    0,
    'read-only timeline rows should not expose a source button',
  );
  assert.equal(
    await readonlyTimelineCard.getByRole('button', { name: '在记忆中查看' }).count(),
    0,
    'read-only timeline rows should not expose a memory-jump button',
  );
  await page.evaluate(() => {
    window.__timelineCopiedDiagnostic = '';
    const clipboard = {
      writeText: async (text) => {
        window.__timelineCopiedDiagnostic = text;
      },
    };
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: clipboard,
      });
    } catch (_error) {
      navigator.clipboard = clipboard;
    }
  });
  await unsafeTimelineCard
    .getByRole('button', { name: '复制安全诊断' })
    .click();
  await page
    .locator('.timeline-navigation-receipt-info')
    .getByText('安全诊断复制回执')
    .waitFor({ timeout: 10000 });
  await page
    .locator('.timeline-navigation-receipt-info')
    .getByText('不包含被拦截的原始 URL')
    .waitFor({ timeout: 10000 });
  const copiedDiagnostic = await page.evaluate(
    () => window.__timelineCopiedDiagnostic,
  );
  assert.ok(
    copiedDiagnostic.includes('Personal AI 时间轴链接安全诊断'),
    'copied diagnostic should include a recognizable header',
  );
  assert.ok(
    copiedDiagnostic.includes('目标：Unsafe source memory'),
    'copied diagnostic should include the visible card title',
  );
  assert.ok(
    copiedDiagnostic.includes('来源标签：Unsafe source'),
    'copied diagnostic should include source label context',
  );
  assert.ok(
    copiedDiagnostic.includes('来源链接已隐藏：包含签名或访问凭据参数'),
    'copied diagnostic should include the block reason',
  );
  assert.ok(
    !copiedDiagnostic.includes('X-Amz-Signature') &&
      !copiedDiagnostic.includes('private.pdf'),
    'copied diagnostic should not leak the blocked raw source URL',
  );
  await unsafeTimelineCard.locator('.timeline-card h3').click();
  await page
    .locator('.timeline-navigation-receipt-warning')
    .getByText('目标：Unsafe source memory。')
    .waitFor({ timeout: 10000 });
  await page
    .locator('.timeline-navigation-receipt-warning')
    .getByText(
      '拦截：记忆内跳转已隐藏：不支持的目标；来源链接已隐藏：包含签名或访问凭据参数。',
    )
    .waitFor({ timeout: 10000 });
  await page
    .locator('.timeline-navigation-receipt-warning')
    .getByText('等待上游写入安全 http/https 来源')
    .waitFor({ timeout: 10000 });

  const recallCountBeforeSourceFilter = recallRequests.length;
  const sourceFilter = page.getByLabel('按来源筛选时间轴');
  await sourceFilter.selectOption({ label: 'Timeline source（1）' });
  await page
    .getByText('全部记忆 · 今天 · Timeline source · 时间通道')
    .waitFor({ timeout: 10000 });
  await page
    .getByText(
      '来源：当前只显示 Timeline source 的 1 条，隐藏 3 条其他来源；切回全部来源可恢复。',
    )
    .waitFor({ timeout: 10000 });
  await sourceOverview
    .getByText(
      '当前只显示 Timeline source；其余来源被临时隐藏，点击 chip 可在本批结果内切换。',
    )
    .waitFor({ timeout: 10000 });
  await sourceOverview
    .getByRole('button', { name: /Unsafe source\s*1\s*已隐藏/ })
    .waitFor({ timeout: 10000 });
  assert.equal(
    recallRequests.length,
    recallCountBeforeSourceFilter,
    'source filtering should refine the loaded timeline without another recall request',
  );
  assert.equal(
    await page
      .locator('article', { hasText: 'Safe timeline memory all' })
      .count(),
    1,
    'selected source should keep matching timeline rows visible',
  );
  assert.equal(
    await page.locator('article', { hasText: 'Unsafe source memory' }).count(),
    0,
    'selected source should hide non-matching timeline rows',
  );
  assert.equal(
    await page
      .locator('article', { hasText: 'Readonly memory without target' })
      .count(),
    0,
    'selected source should hide unknown-source timeline rows',
  );
  await sourceOverview
    .getByRole('button', { name: /Unsafe source\s*1\s*已隐藏/ })
    .click();
  await page
    .getByText('全部记忆 · 今天 · Unsafe source · 时间通道')
    .waitFor({ timeout: 10000 });
  assert.equal(
    recallRequests.length,
    recallCountBeforeSourceFilter,
    'source overview chips should also refine the loaded timeline without another recall request',
  );
  assert.equal(
    await page
      .locator('article', { hasText: 'Unsafe source memory' })
      .count(),
    1,
    'source chip should reveal matching hidden timeline rows',
  );
  assert.equal(
    await page
      .locator('article', { hasText: 'Safe timeline memory all' })
      .count(),
    0,
    'source chip should hide non-matching timeline rows',
  );
  await page.evaluate(() => {
    window.location.hash = '#/timeline?type=message&focus=focused-manual';
  });
  await page
    .getByText(
      '已置顶定位记忆，并清除来源筛选；它可能不属于当前时间范围或当前来源。',
    )
    .waitFor({ timeout: 10000 });
  await page
    .getByText('Focused manual source memory')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('全部记忆 · 今天 · 全部来源 · 时间通道')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('article', { hasText: 'Unsafe source memory' }).count(),
    1,
    'focused timeline navigation should clear a source filter that would hide the target',
  );
  await sourceFilter.selectOption({ label: '全部来源' });
  await page
    .locator('article', { hasText: 'Unsafe source memory' })
    .waitFor({ timeout: 10000 });

  const safeTimelineCard = page.locator('article', {
    hasText: 'Safe timeline memory all',
  });
  const safeLinkStatus = safeTimelineCard.locator(
    '.memory-link-safety-status-ready',
  );
  await safeLinkStatus
    .getByText('可在记忆中查看')
    .waitFor({ timeout: 10000 });
  await safeLinkStatus
    .getByText('来源 example.com')
    .waitFor({ timeout: 10000 });
  await safeTimelineCard
    .getByLabel('时间轴卡片点击行为')
    .getByText('卡片点击：在记忆中查看')
    .waitFor({ timeout: 10000 });
  await safeTimelineCard
    .getByLabel('时间轴卡片点击行为')
    .getByText('打开外部来源需点“打开来源”')
    .waitFor({ timeout: 10000 });
  await page.evaluate(() => {
    window.__timelineOpenedSources = [];
    window.open = (...args) => {
      window.__timelineOpenedSources.push(args);
      return null;
    };
  });
  await safeTimelineCard.getByRole('button', { name: /打开来源/ }).click();
  await page
    .locator('.timeline-navigation-receipt-info')
    .getByText('来源：已请求浏览器打开 example.com。')
    .waitFor({ timeout: 10000 });
  await page
    .locator('.timeline-navigation-receipt-info')
    .getByText('不代表 Memory Service 重新读取、同步或确认了来源内容')
    .waitFor({ timeout: 10000 });
  const openedSources = await page.evaluate(() => window.__timelineOpenedSources);
  assert.equal(openedSources.length, 1, 'source click should request one open');
  assert.equal(
    openedSources[0][0],
    'https://example.com/timeline-safe',
    'source click should open the sanitized http/https source URL',
  );
  assert.equal(
    openedSources[0][2],
    'noopener,noreferrer',
    'source click should keep opener/referrer isolation',
  );

  await safeTimelineCard
    .getByText('已记录为不相关')
    .waitFor({ timeout: 10000 });
  await assertClass(
    safeTimelineCard.locator('.feedback-status'),
    'feedback-status-negative',
    'restored negative feedback status should use negative tone',
  );
  const usefulButton = safeTimelineCard.getByRole('button', { name: '有用' });
  const negativeButton = safeTimelineCard.getByRole('button', {
    name: '不相关',
  });
  await assertClass(
    usefulButton,
    'feedback-btn-positive',
    'useful timeline feedback button should carry positive role class',
  );
  await assertClass(
    negativeButton,
    'feedback-btn-negative',
    'negative timeline feedback button should carry negative role class',
  );
  assert.equal(
    await negativeButton.getAttribute('aria-pressed'),
    'true',
    'persisted negative feedback should be restored on load',
  );
  await assertClass(
    negativeButton,
    'active',
    'restored negative feedback button should be active',
  );
  await usefulButton.click();
  await safeTimelineCard.getByText('已记录为有用').waitFor({ timeout: 10000 });
  await assertClass(
    safeTimelineCard.locator('.feedback-status'),
    'feedback-status-positive',
    'positive feedback status should use positive tone',
  );
  await assertClass(
    usefulButton,
    'active',
    'positive timeline feedback button should become active',
  );
  await assertNoClass(
    negativeButton,
    'active',
    'negative timeline feedback button should no longer be active after positive feedback',
  );
  assert.equal(
    await usefulButton.getAttribute('aria-pressed'),
    'true',
  );
  assertFeedbackRequest(
    0,
    {
      type: 'recall_quality',
      targetId: 'safe-all',
      targetType: 'message',
      action: 'positive',
    },
    {
      interaction: 'context_recall_feedback',
      surface: 'memory_timeline',
      action: 'positive',
      range: 'today',
      scope: 'all',
      target_type: 'message',
    },
  );
  await negativeButton.click();
  await safeTimelineCard
    .getByText('已记录为不相关')
    .waitFor({ timeout: 10000 });
  await assertClass(
    safeTimelineCard.locator('.feedback-status'),
    'feedback-status-negative',
    'negative feedback status should use negative tone after change',
  );
  await assertClass(
    negativeButton,
    'active',
    'negative timeline feedback button should become active after change',
  );
  assertFeedbackRequest(
    1,
    {
      type: 'recall_quality',
      targetId: 'safe-all',
      targetType: 'message',
      action: 'negative',
    },
    {
      interaction: 'memory_relevance_trainer',
      surface: 'memory_timeline',
      action: 'negative',
      feedback_reason: 'timeline_context_mismatch',
      auto_applied: 'true',
      target_type: 'message',
    },
  );
  await safeTimelineCard.getByRole('button', { name: '撤销反馈' }).click();
  await safeTimelineCard.getByText('已撤销反馈').waitFor({ timeout: 10000 });
  await assertClass(
    safeTimelineCard.locator('.feedback-status'),
    'feedback-status-cleared',
    'clear feedback status should use cleared tone',
  );
  assertFeedbackRequest(
    2,
    {
      type: 'recall_quality',
      targetId: 'safe-all',
      targetType: 'message',
      action: 'clear',
    },
    {
      interaction: 'context_recall_feedback',
      surface: 'memory_timeline',
      action: 'clear',
      target_type: 'message',
    },
  );
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

  const recallCountBeforeFailedRefresh = recallRequests.length;
  failNextRecallWith = 'timeline refresh temporarily failed';
  delayNextRecallMs = 500;
  await page
    .locator('.timeline-controls')
    .getByRole('button', { name: '刷新', exact: true })
    .click();
  await page
    .getByText('刷新中 · 上次快照')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('下面暂时仍是上次成功快照')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('article', { hasText: 'Safe timeline memory all' }).count(),
    1,
    'same-scope refresh should keep the previous successful timeline rows while loading',
  );
  await page
    .getByText('刷新失败 · 上次快照')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('当前 Memory Service 状态未确认')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('没有把失败结果当作空时间轴')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('timeline refresh temporarily failed')
    .waitFor({ timeout: 10000 });
  assert.equal(
    recallRequests.length,
    recallCountBeforeFailedRefresh + 1,
    'failed same-scope refresh should still issue one recall request',
  );
  assert.equal(
    await page.locator('article', { hasText: 'Safe timeline memory all' }).count(),
    1,
    'failed same-scope refresh should keep the previous successful timeline rows',
  );
  assert.equal(
    await page.locator('article', { hasText: 'Unsafe source memory' }).count(),
    1,
    'failed same-scope refresh should not clear the last successful snapshot',
  );

  await fs.mkdir(screenshotDir, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDir, 'memory-timeline-desktop.png'),
    fullPage: true,
  });

  failNextRecallWith = 'personal timeline unavailable';
  await page
    .locator('.timeline-controls')
    .getByRole('button', { name: '个人' })
    .click();
  await page
    .getByText('personal timeline unavailable')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page.getByText('刷新失败 · 上次快照').count(),
    0,
    'failed scope change should not present an old-scope stale snapshot',
  );
  assert.equal(
    await page.locator('article', { hasText: 'Safe timeline memory all' }).count(),
    0,
    'failed scope change should not reuse the previous all-scope rows',
  );
  assert.equal(recallRequests.at(-1)?.scope, 'personal');

  await page
    .locator('.timeline-controls')
    .getByRole('button', { name: '工作' })
    .click();
  await page.getByText('Safe timeline memory work').waitFor({ timeout: 10000 });
  await page
    .getByText('范围：只读取工作记忆；个人记忆没有进入本次时间轴。')
    .waitFor({ timeout: 10000 });
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

  await page.evaluate(() => {
    window.location.hash =
      '#/timeline?scope=personal&range=30d&type=message&focus=focused-old';
  });
  await page.getByText('近 30 天记忆时间轴').waitFor({ timeout: 10000 });
  await page
    .getByText('Safe timeline memory personal')
    .waitFor({ timeout: 10000 });
  const routeSyncedRequest = recallRequests.at(-1);
  assert.equal(routeSyncedRequest?.scope, 'personal');
  assert.equal(
    routeSyncedRequest?.timeRange?.end - routeSyncedRequest?.timeRange?.start,
    30 * 24 * 60 * 60,
    'timeline should reload when route scope/range changes without a full page reload',
  );

  await page.setViewportSize({ width: 390, height: 780 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page
    .getByText('Focused memory outside range')
    .waitFor({ timeout: 10000 });
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

  emptyNextRecall = true;
  const emptyPage = await context.newPage();
  await emptyPage.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/timeline?scope=all&range=today`,
    {
      waitUntil: 'domcontentloaded',
    },
  );
  await emptyPage
    .getByText('今天还没有可展示的记忆')
    .waitFor({ timeout: 10000 });
  await emptyPage
    .getByLabel('时间轴空结果回执')
    .getByText('时间轴空结果回执')
    .waitFor({ timeout: 10000 });
  await emptyPage
    .getByLabel('时间轴空结果回执')
    .getByText(
      '结果：本次 全部 · 今天 时间轴读取成功，Memory Service 返回 0 条可展示记忆。',
    )
    .waitFor({ timeout: 10000 });
  await emptyPage
    .getByLabel('时间轴空结果回执')
    .getByText('这是 successful empty，不是刷新失败')
    .waitFor({ timeout: 10000 });
  await emptyPage
    .getByLabel('时间轴空结果回执')
    .getByText('没有删除记忆、清空索引、写入反馈或同步来源')
    .waitFor({ timeout: 10000 });
  await emptyPage
    .getByRole('button', { name: '查看近7天' })
    .waitFor({ timeout: 10000 });
  assert.equal(
    await emptyPage.locator('article').count(),
    0,
    'successful empty timeline should not show stale previous rows',
  );
  await emptyPage.close();

  console.log('verify-memory-timeline-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
