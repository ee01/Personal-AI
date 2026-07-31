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
const userDataDir = await fs.mkdtemp(
  path.join(os.tmpdir(), 'personal-ai-memory-search-scope-'),
);
const askRequests = [];
const recallRequests = [];
const nowSeconds = Math.floor(Date.now() / 1000);
let delayNextAllScopeAsk = false;

function jsonResponse(body) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function countScopes(items) {
  return items.reduce(
    (counts, item) => {
      if (item.scope === 'work' || item.scope === 'personal') {
        counts[item.scope] += 1;
      } else {
        counts.unknown += 1;
      }
      counts.total += 1;
      return counts;
    },
    { work: 0, personal: 0, unknown: 0, total: 0 },
  );
}

function scopeReceiptFor(scope, evidence) {
  const returned = countScopes(evidence);
  const effectiveScope = scope === 'all' || scope === 'both' ? 'both' : scope;
  let note = '';
  if (effectiveScope === 'work') {
    note = '本次主动召回仅检索工作记忆，个人记忆未进入候选。';
  } else if (effectiveScope === 'personal') {
    note = '本次主动召回仅检索个人记忆，工作记忆未进入候选。';
  } else if (returned.personal > 0) {
    note = `本次主动召回检索全部记忆，返回结果包含 ${returned.personal} 条个人记忆；引用到工作场景前请确认。`;
  } else {
    note = '本次主动召回检索全部记忆，当前返回结果未包含个人记忆。';
  }
  return {
    requestedScope: scope,
    effectiveScope,
    returned,
    candidates: returned,
    note,
    includesPersonal: returned.personal > 0,
  };
}

async function expectScopeIntentReceipt(page, { summary, caution, metrics }) {
  const receipt = page.getByLabel('搜索范围意图');
  await receipt.getByText('搜索范围意图').waitFor({ timeout: 10000 });
  await receipt.getByText(summary).waitFor({ timeout: 10000 });
  await receipt
    .getByText('当前有查询，切换范围会立即重新召回并同步 URL；只读取 Memory Service。')
    .waitFor({ timeout: 10000 });
  await receipt.getByText(caution).waitFor({ timeout: 10000 });
  for (const metric of metrics) {
    await receipt.getByText(metric).waitFor({ timeout: 10000 });
  }
}

async function expectScopeButtonBoundary(
  scopeControls,
  label,
  expectedFragments,
) {
  const button = getScopeButtonByVisibleLabel(scopeControls, label);
  const title = (await button.getAttribute('title')) || '';
  const ariaLabel = (await button.getAttribute('aria-label')) || '';
  assert.equal(
    ariaLabel,
    title,
    `${label} scope button should keep title and aria-label in sync`,
  );
  for (const fragment of expectedFragments) {
    assert.ok(
      title.includes(fragment),
      `${label} scope button boundary should include "${fragment}", got "${title}"`,
    );
  }
}

function getScopeButtonByVisibleLabel(scopeControls, label) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return scopeControls
    .locator('button.scope-option')
    .filter({ hasText: new RegExp(`^\\s*${escapedLabel}\\s*$`) });
}

function apiFallback(url) {
  const pathname = new URL(url).pathname;
  if (pathname.endsWith('/stats')) {
    return {
      entities: { total: 0, byType: {} },
      relationships: { total: 0 },
      messages: { today: 0, thisWeek: 0 },
    };
  }
  if (pathname.endsWith('/meetings')) return { items: [], total: 0 };
  if (pathname.endsWith('/confirm-requests')) return { items: [], total: 0 };
  if (pathname.endsWith('/reflection-threads')) return { items: [], total: 0 };
  if (pathname.endsWith('/actions')) return { items: [], total: 0 };
  if (pathname.endsWith('/config/runtime')) return { outreachEnabled: false };
  if (pathname.endsWith('/outreach/summary')) {
    return { upcomingCount: 0, waitingReplyCount: 0, escalatedCount: 0 };
  }
  if (pathname.endsWith('/outreach/templates/runtime-status')) {
    return { items: [], total: 0 };
  }
  if (pathname.endsWith('/skills')) return { items: [], total: 0 };
  if (pathname.endsWith('/skills/suggestions')) return { items: [], total: 0 };
  return {};
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
  await context.route('http://localhost:3210/api/v1/**', async (route) => {
    const request = route.request();
    const url = request.url();
    const pathname = new URL(url).pathname;

    if (pathname.endsWith('/ask')) {
      const payload = request.postDataJSON();
      const scope = payload.scope || 'work';
      askRequests.push(payload);
      if (scope === 'all' && delayNextAllScopeAsk) {
        delayNextAllScopeAsk = false;
        await new Promise((resolve) => setTimeout(resolve, 850));
      }
      const evidence =
        scope === 'all'
          ? [
              {
                id: 'all-work-memory',
                type: 'message',
                content: 'Work memory evidence for all',
                displayTitle: 'Scoped memory result all',
                displayText: 'The all search includes a work memory.',
                score: 0.91,
                source: 'manual',
                sourceTitle: 'Search source',
                sourceUrl: 'https://example.com/search-scope-all-work',
                timestamp: nowSeconds,
                scope: 'work',
                metadata: { channels: ['vector', 'fts'] },
              },
              {
                id: 'all-personal-memory',
                type: 'chunk',
                content: 'Personal memory evidence for all',
                displayTitle: 'Scoped personal memory result all',
                displayText: 'The all search includes a personal memory.',
                score: 0.89,
                source: 'manual',
                sourceTitle: 'Personal source',
                sourceUrl: 'https://example.com/search-scope-all-personal',
                timestamp: nowSeconds - 60,
                scope: 'personal',
                metadata: { channels: ['fts'] },
              },
            ]
          : [
              {
                id: `${scope}-memory`,
                type: 'message',
                content: `Memory evidence for ${scope}`,
                displayTitle: `Scoped memory result ${scope}`,
                displayText: `The search scope is ${scope}.`,
                score: 0.91,
                source: 'manual',
                sourceTitle: 'Search source',
                sourceUrl: `https://example.com/search-scope-${scope}`,
                timestamp: nowSeconds,
                scope: scope === 'personal' ? 'personal' : 'work',
                metadata: { channels: ['fts'] },
              },
            ];
      await route.fulfill(
        jsonResponse({
          answer: `Answer for ${scope}`,
          evidence,
          queryTimeMs: 8,
          channelDiagnostics:
            scope === 'all'
              ? [
                  { channel: 'vector', status: 'hit', candidateCount: 1 },
                  {
                    channel: 'fts',
                    status: 'hit',
                    candidateCount: evidence.length,
                  },
                  { channel: 'graph', status: 'empty', candidateCount: 0 },
                  { channel: 'time', status: 'empty', candidateCount: 0 },
                ]
              : [
                  {
                    channel: 'vector',
                    status: 'skipped',
                    candidateCount: 0,
                    reason: 'embedding_unavailable',
                  },
                  {
                    channel: 'fts',
                    status: 'hit',
                    candidateCount: evidence.length,
                  },
                  { channel: 'graph', status: 'empty', candidateCount: 0 },
                  { channel: 'time', status: 'empty', candidateCount: 0 },
                ],
          scopeReceipt: scopeReceiptFor(scope, evidence),
          blocks: [],
        }),
      );
      return;
    }

    if (pathname.endsWith('/recall')) {
      const payload = request.postDataJSON();
      recallRequests.push(payload);
      if (payload.query === 'backend outage') {
        await route.fulfill(
          {
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'simulated memory-service recall outage',
            }),
          },
        );
        return;
      }

      if (payload.query === 'empty result') {
        await route.fulfill(
          jsonResponse({
            items: [],
            totalFound: 0,
            queryTimeMs: 6,
            channels: payload.channels || [],
            channelDiagnostics: [
              {
                channel: 'vector',
                status: 'skipped',
                candidateCount: 0,
                reason: 'embedding_unavailable',
              },
              { channel: 'fts', status: 'empty', candidateCount: 0 },
              { channel: 'graph', status: 'empty', candidateCount: 0 },
            ],
          }),
        );
        return;
      }

      await route.fulfill(
        jsonResponse({
          items: [],
          totalFound: 0,
          queryTimeMs: 5,
          channels: payload.channels || [],
          channelDiagnostics: [],
        }),
      );
      return;
    }

    await route.fulfill(jsonResponse(apiFallback(url)));
  });

  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }
  const extensionId = new URL(worker.url()).host;
  assert.ok(extensionId, 'extension id should be available');

  const page = await context.newPage();
  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/search?q=scope%20query&scope=work`,
    { waitUntil: 'domcontentloaded' },
  );

  await page.getByText('Scoped memory result work').waitFor({ timeout: 10000 });
  assert.equal(askRequests.at(-1)?.scope, 'work');
  const scopeControls = page.locator('.search-header .scope-segmented');
  await expectScopeButtonBoundary(scopeControls, '工作', [
    '当前已选择工作记忆',
    '个人记忆不会进入候选',
    '不会写入、删除、同步外部来源、写反馈、确认答案或外发',
  ]);
  await expectScopeButtonBoundary(scopeControls, '全部', [
    '切到全部记忆会立即用当前 query 重新请求 Memory Service',
    '上一次结果只作为旧快照',
    '个人证据带到工作场景前需要确认',
  ]);
  await expectScopeIntentReceipt(page, {
    summary: '下一次搜索只读取工作记忆。',
    caution: '个人记忆不会进入候选；适合默认工作场景检索。',
    metrics: ['仅工作', '不含个人', '不写入/删除/同步/确认'],
  });
  await page.getByText('范围: 工作记忆').waitFor({ timeout: 10000 });
  await page.getByText('命中范围: 工作 1').waitFor({ timeout: 10000 });
  await page
    .getByText('本次仅检索工作记忆，未纳入个人记忆。')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('本次主动召回仅检索工作记忆，个人记忆未进入候选。')
    .waitFor({ timeout: 10000 });
  assert.equal(await page.getByText('已包含 1 条个人记忆').count(), 0);
  const initialBatchReceipt = page.getByLabel('结果批次回执');
  await initialBatchReceipt.getByText('结果批次回执').waitFor({
    timeout: 10000,
  });
  await initialBatchReceipt
    .getByText('当前 1 条卡片绑定查询“scope query”、工作记忆和Ask 智能搜索')
    .waitFor({ timeout: 10000 });
  await initialBatchReceipt
    .getByText('不会重新召回、重排、同步外部来源或确认事实')
    .waitFor({ timeout: 10000 });
  await initialBatchReceipt.getByText('通道 1/4 命中').waitFor({
    timeout: 10000,
  });
  await initialBatchReceipt.getByText('批次只读').waitFor({
    timeout: 10000,
  });
  await page.getByText('语义 未运行').waitFor({ timeout: 10000 });
  await page.getByText('关键词 命中 1').waitFor({ timeout: 10000 });
  await page.getByText('图谱 无命中').waitFor({ timeout: 10000 });
  const recallChannelReceipt = page.locator('[aria-label="召回通道回执"]');
  await recallChannelReceipt
    .getByText('召回通道回执', { exact: true })
    .waitFor({ timeout: 10000 });
  await recallChannelReceipt
    .getByText('本轮结果来自 1/4 个召回通道：关键词1。')
    .waitFor({ timeout: 10000 });
  await recallChannelReceipt
    .getByText('未完整覆盖：语义未运行、图谱无命中、时间无命中。')
    .waitFor({ timeout: 10000 });
  await recallChannelReceipt
    .getByText('语义未运行：语义索引不可用')
    .waitFor({ timeout: 10000 });
  await recallChannelReceipt
    .getByText('不会写入、删除、同步外部来源或确认答案')
    .waitFor({ timeout: 10000 });
  const initialEvidenceChannelOverlapReceipt = page.getByLabel(
    '证据通道交叉回执',
  );
  await initialEvidenceChannelOverlapReceipt
    .getByText('证据通道交叉回执')
    .waitFor({ timeout: 10000 });
  await initialEvidenceChannelOverlapReceipt
    .getByText('当前 1 条可见结果为单通道证据，尚无通道交叉支持。')
    .waitFor({ timeout: 10000 });
  await initialEvidenceChannelOverlapReceipt.getByText('多通道 0').waitFor({
    timeout: 10000,
  });
  await initialEvidenceChannelOverlapReceipt.getByText('单通道 1').waitFor({
    timeout: 10000,
  });
  await initialEvidenceChannelOverlapReceipt
    .getByText('不等于事实已确认，也不会重新召回、重排、写反馈或写入记忆')
    .waitFor({ timeout: 10000 });
  const initialSearchResultCard = page.locator('.search-result-card', {
    hasText: 'Scoped memory result work',
  });
  const initialOpenResultButton = initialSearchResultCard.getByRole('button', {
    name: /打开结果：Scoped memory result work/,
  });
  const initialOpenResultTitle =
    (await initialOpenResultButton.getAttribute('title')) || '';
  assert.ok(
    initialOpenResultTitle.includes('noopener/noreferrer') &&
      initialOpenResultTitle.includes('不会写入记忆、反馈或来源系统') &&
      initialOpenResultTitle.includes('不会重新读取、同步或确认来源内容'),
    'search primary open button should expose external-open and no-write boundaries before click',
  );
  const initialSourceButton = initialSearchResultCard.getByRole('button', {
    name: /打开来源/,
  });
  const initialSourceButtonTitle =
    (await initialSourceButton.getAttribute('title')) || '';
  assert.ok(
    initialSourceButtonTitle.includes('example.com') &&
      initialSourceButtonTitle.includes('新标签页') &&
      initialSourceButtonTitle.includes('noopener/noreferrer') &&
      initialSourceButtonTitle.includes('不会重新读取、同步或确认来源内容'),
    'search source button should expose sanitized host and opener/referrer boundary before click',
  );
  await page.evaluate(() => {
    window.__searchOpenedSources = [];
    window.open = (...args) => {
      window.__searchOpenedSources.push(args);
      return null;
    };
  });
  await initialSourceButton.click();
  await page
    .locator('.search-navigation-receipt-info')
    .getByText('来源：已请求浏览器打开 example.com。')
    .waitFor({ timeout: 10000 });
  await page
    .locator('.search-navigation-receipt-info')
    .getByText('不代表 Memory Service 重新读取、同步或确认了来源内容')
    .waitFor({ timeout: 10000 });
  const openedSearchSources = await page.evaluate(
    () => window.__searchOpenedSources,
  );
  assert.equal(
    openedSearchSources.length,
    1,
    'search source click should request one browser open',
  );
  assert.equal(
    openedSearchSources[0][0],
    'https://example.com/search-scope-work',
    'search source click should open the sanitized http/https source URL',
  );
  assert.equal(
    openedSearchSources[0][2],
    'noopener,noreferrer',
    'search source click should keep opener/referrer isolation',
  );

  delayNextAllScopeAsk = true;
  await page.getByRole('button', { name: '搜索全部记忆' }).click();
  const loadingScopeReceipt = page.getByLabel('搜索范围请求中');
  await loadingScopeReceipt.getByText('搜索范围请求中').waitFor({
    timeout: 10000,
  });
  await loadingScopeReceipt
    .getByText('正在按全部记忆请求 Memory Service')
    .waitFor({ timeout: 10000 });
  await loadingScopeReceipt
    .getByText('上一次可见快照 1 条已暂时隐藏')
    .waitFor({ timeout: 10000 });
  await loadingScopeReceipt.getByText('范围 全部记忆').waitFor({
    timeout: 10000,
  });
  await loadingScopeReceipt.getByText('旧快照 1').waitFor({
    timeout: 10000,
  });
  await loadingScopeReceipt.getByText('只读请求').waitFor({
    timeout: 10000,
  });
  await page.getByText('Scoped memory result all').waitFor({ timeout: 10000 });
  assert.equal(askRequests.at(-1)?.scope, 'all');
  assert.ok(page.url().includes('scope=all'));
  await expectScopeIntentReceipt(page, {
    summary: '下一次搜索会同时读取工作与个人记忆。',
    caution: '个人证据可能进入结果；复制、引用或带到工作场景前先确认。',
    metrics: ['工作 + 个人', '个人证据需确认', '不写入/删除/同步/确认'],
  });
  await page.getByText('范围: 全部记忆').waitFor({ timeout: 10000 });
  await page.getByText('命中范围: 工作 1 · 个人 1').waitFor({ timeout: 10000 });
  const allScopeBatchReceipt = page.getByLabel('结果批次回执');
  await allScopeBatchReceipt
    .getByText('当前 2 条卡片绑定查询“scope query”、全部记忆和Ask 智能搜索')
    .waitFor({ timeout: 10000 });
  await allScopeBatchReceipt.getByText('结果 2').waitFor({ timeout: 10000 });
  await allScopeBatchReceipt.getByText('通道 2/4 命中').waitFor({
    timeout: 10000,
  });
  await page
    .getByRole('button', {
      name: /全部类型筛选：当前显示 2 条/,
    })
    .waitFor({ timeout: 10000 });
  await page
    .getByRole('button', {
      name: /片段类型筛选：点击显示 1\/2 · 隐藏 1/,
    })
    .waitFor({ timeout: 10000 });
  const sourceCoverageReceipt = page.getByLabel('来源覆盖回执');
  await sourceCoverageReceipt.getByText('来源覆盖回执').waitFor({
    timeout: 10000,
  });
  await sourceCoverageReceipt
    .getByText('当前 2 条结果覆盖 2 个来源/标题')
    .waitFor({ timeout: 10000 });
  await sourceCoverageReceipt
    .getByText('不会重新读取来源、刷新连接器、写反馈或确认事实')
    .waitFor({ timeout: 10000 });
  await sourceCoverageReceipt.getByText('来源 2').waitFor({
    timeout: 10000,
  });
  const evidenceChannelOverlapReceipt = page.getByLabel('证据通道交叉回执');
  await evidenceChannelOverlapReceipt
    .getByText('证据通道交叉回执')
    .waitFor({ timeout: 10000 });
  await evidenceChannelOverlapReceipt
    .getByText('1 条由多个召回通道共同命中')
    .waitFor({ timeout: 10000 });
  await evidenceChannelOverlapReceipt
    .getByText('常见交叉：语义+关键词 1')
    .waitFor({ timeout: 10000 });
  await evidenceChannelOverlapReceipt
    .getByText('不等于事实已确认，也不会重新召回、重排、写反馈或写入记忆')
    .waitFor({ timeout: 10000 });
  await evidenceChannelOverlapReceipt.getByText('多通道 1').waitFor({
    timeout: 10000,
  });
  await evidenceChannelOverlapReceipt.getByText('交叉 语义+关键词 1').waitFor({
    timeout: 10000,
  });
  await page
    .getByText('已包含 1 条个人记忆；复制或引用前先确认是否适合当前工作场景。')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('本次主动召回检索全部记忆，返回结果包含 1 条个人记忆；引用到工作场景前请确认。')
    .waitFor({ timeout: 10000 });
  assert.equal(await page.getByText('本次仅检索工作记忆').count(), 0);
  await page
    .getByRole('button', {
      name: /片段类型筛选：点击显示 1\/2 · 隐藏 1/,
    })
    .click();
  await page
    .getByRole('button', {
      name: /片段类型筛选：当前显示 1\/2 条/,
    })
    .waitFor({ timeout: 10000 });
  await page
    .getByRole('button', {
      name: /全部类型筛选：显示全部 2 条/,
    })
    .waitFor({ timeout: 10000 });
  await page.getByText('显示 1/2 个相关结果').waitFor({ timeout: 10000 });
  const typeFilterReceipt = page.getByLabel('类型筛选回执');
  await typeFilterReceipt.getByText('类型筛选回执').waitFor({ timeout: 10000 });
  await typeFilterReceipt
    .getByText('当前仅显示片段类型 1/2 条')
    .waitFor({ timeout: 10000 });
  await typeFilterReceipt
    .getByText('不会重新召回、重排、写反馈或隐藏服务端结果')
    .waitFor({ timeout: 10000 });
  await typeFilterReceipt.getByText('已隐藏 1').waitFor({ timeout: 10000 });
  const filteredBatchReceipt = page.getByLabel('结果批次回执');
  await filteredBatchReceipt
    .getByText('当前片段可见 1/2 条卡片绑定查询“scope query”、全部记忆和Ask 智能搜索')
    .waitFor({ timeout: 10000 });
  await filteredBatchReceipt
    .getByText('可见 1/2', { exact: true })
    .waitFor({
      timeout: 10000,
    });
  await sourceCoverageReceipt
    .getByText('当前片段可见 1/2 条结果都来自 Personal source')
    .waitFor({ timeout: 10000 });
  await sourceCoverageReceipt.getByText('可见 1/2', { exact: true }).waitFor({
    timeout: 10000,
  });
  assert.equal(
    await page
      .locator('.search-result-card', { hasText: 'Scoped memory result all' })
      .count(),
    0,
    'type filter should hide the non-matching message result locally',
  );
  await typeFilterReceipt.getByRole('button', { name: '显示全部类型' }).click();
  await page.getByText('找到 2 个相关结果').waitFor({ timeout: 10000 });
  await page
    .locator('.search-result-card', { hasText: 'Scoped memory result all' })
    .waitFor({ timeout: 10000 });

  await getScopeButtonByVisibleLabel(scopeControls, '个人').click();
  await page
    .getByText('Scoped memory result personal')
    .waitFor({ timeout: 10000 });
  assert.equal(askRequests.at(-1)?.scope, 'personal');
  assert.ok(page.url().includes('scope=personal'));
  await expectScopeButtonBoundary(scopeControls, '个人', [
    '当前已选择个人记忆',
    '工作记忆不会进入候选',
    '不会写入、删除、同步外部来源、写反馈、确认答案或外发',
  ]);
  await expectScopeButtonBoundary(scopeControls, '全部', [
    '切到全部记忆会立即用当前 query 重新请求 Memory Service',
    '上一次结果只作为旧快照',
    '个人证据带到工作场景前需要确认',
  ]);
  await expectScopeIntentReceipt(page, {
    summary: '下一次搜索只读取个人记忆。',
    caution: '工作记忆不会进入候选；适合只查私人生活域。',
    metrics: ['仅个人', '不含工作', '不写入/删除/同步/确认'],
  });
  await page.getByText('范围: 个人记忆').waitFor({ timeout: 10000 });
  await page.getByText('命中范围: 个人 1').waitFor({ timeout: 10000 });
  await page
    .getByText('本次仅检索个人记忆，未纳入工作记忆。')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('本次主动召回仅检索个人记忆，工作记忆未进入候选。')
    .waitFor({ timeout: 10000 });

  await getScopeButtonByVisibleLabel(scopeControls, '全部').click();
  await page.getByText('Scoped memory result all').waitFor({ timeout: 10000 });
  assert.equal(askRequests.at(-1)?.scope, 'all');
  assert.ok(page.url().includes('scope=all'));
  await expectScopeButtonBoundary(scopeControls, '全部', [
    '当前已选择全部记忆',
    '工作与个人证据都可能进入结果',
    '不会写入、删除、同步外部来源、写反馈、确认答案或外发',
  ]);
  await page.getByText('范围: 全部记忆').waitFor({ timeout: 10000 });
  await page.getByText('命中范围: 工作 1 · 个人 1').waitFor({ timeout: 10000 });
  await page
    .getByText('已包含 1 条个人记忆；复制或引用前先确认是否适合当前工作场景。')
    .waitFor({ timeout: 10000 });

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/search?q=legacy%20scope%20query&scope=both`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.getByText('Scoped memory result all').waitFor({ timeout: 10000 });
  assert.equal(askRequests.at(-1)?.scope, 'all');
  assert.equal(
    await scopeControls
      .locator('button.scope-option')
      .filter({ hasText: /^全部$/ })
      .getAttribute('aria-pressed'),
    'true',
  );
  await expectScopeIntentReceipt(page, {
    summary: '下一次搜索会同时读取工作与个人记忆。',
    caution: '个人证据可能进入结果；复制、引用或带到工作场景前先确认。',
    metrics: ['工作 + 个人', '个人证据需确认', '不写入/删除/同步/确认'],
  });
  await page.getByText('范围: 全部记忆').waitFor({ timeout: 10000 });
  await page
    .getByText('已包含 1 条个人记忆；复制或引用前先确认是否适合当前工作场景。')
    .waitFor({ timeout: 10000 });

  assert.deepEqual(
    askRequests.map((request) => request.scope),
    ['work', 'all', 'personal', 'all', 'all'],
  );

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/entity/Person`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.locator('.search-header .search-input').fill('empty result');
  await page.locator('.search-header .filter-btn').first().click();
  const emptyState = page.locator('.empty-search-state');
  await emptyState.getByText('没有找到相关结果').waitFor({
    timeout: 10000,
  });
  const emptyReceipt = page.getByLabel('真实空结果回执');
  await emptyReceipt.getByText('真实空结果回执').waitFor({
    timeout: 10000,
  });
  await emptyReceipt
    .getByText('Memory Service 已完成记忆召回，但当前工作记忆没有返回可展示结果')
    .waitFor({ timeout: 10000 });
  await emptyReceipt
    .getByText('不会写入、删除、同步外部来源、刷新连接器、写反馈或确认事实')
    .waitFor({ timeout: 10000 });
  await emptyReceipt.getByText('范围 工作记忆').waitFor({
    timeout: 10000,
  });
  await emptyReceipt.getByText('实体搜索 人物').waitFor({
    timeout: 10000,
  });
  await emptyReceipt.getByText('通道 0/3 命中').waitFor({
    timeout: 10000,
  });
  await page
    .getByLabel('空结果召回通道回执')
    .getByText('本轮结果来自 0/3 个召回通道：暂无命中。')
    .waitFor({ timeout: 10000 });
  await page
    .getByLabel('空结果召回通道回执')
    .getByText('未完整覆盖：语义未运行、关键词无命中、图谱无命中。')
    .waitFor({ timeout: 10000 });
  await page
    .getByLabel('空结果召回通道回执')
    .getByText('语义未运行：语义索引不可用')
    .waitFor({ timeout: 10000 });
  await page.getByText('语义 未运行').waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('.search-failure-state').count(),
    0,
    'successful empty recall should not render as a search failure',
  );
  assert.equal(recallRequests.at(-1)?.query, 'empty result');
  assert.equal(recallRequests.at(-1)?.scope, 'work');
  assert.deepEqual(recallRequests.at(-1)?.entityTypes, ['Person']);

  await emptyState.getByRole('button', { name: '搜索全部记忆' }).click();
  await emptyReceipt.getByText('范围 全部记忆').waitFor({
    timeout: 10000,
  });
  assert.equal(recallRequests.at(-1)?.query, 'empty result');
  assert.equal(recallRequests.at(-1)?.scope, 'all');
  assert.deepEqual(recallRequests.at(-1)?.entityTypes, ['Person']);

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/entity/Person`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.locator('.search-header .search-input').fill('backend outage');
  await page.locator('.search-header .filter-btn').first().click();
  const failureState = page.locator('.search-failure-state');
  await failureState.getByText('真实搜索没有完成').waitFor({
    timeout: 10000,
  });
  await failureState
    .getByText('没有展示模拟记忆；请重试真实后端搜索')
    .waitFor({ timeout: 10000 });
  await failureState.getByText('查询: "backend outage"').waitFor({
    timeout: 10000,
  });
  await failureState.getByText('范围: 工作记忆').waitFor({ timeout: 10000 });
  await failureState.getByText('实体搜索: 人物').waitFor({ timeout: 10000 });
  await failureState
    .getByText('simulated memory-service recall outage')
    .waitFor({
      timeout: 10000,
    });
  assert.equal(await page.locator('.search-result-card').count(), 0);
  assert.equal(recallRequests.at(-1)?.query, 'backend outage');
  assert.equal(recallRequests.at(-1)?.scope, 'work');
  assert.deepEqual(recallRequests.at(-1)?.entityTypes, ['Person']);

  const recallCountBeforeRetry = recallRequests.length;
  await page.getByRole('button', { name: '重试真实搜索' }).click();
  await failureState.getByText('真实搜索没有完成').waitFor({
    timeout: 10000,
  });
  assert.equal(recallRequests.length, recallCountBeforeRetry + 1);

  console.log('verify-memory-search-scope-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
