import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentScriptPath = path.join(repoRoot, 'dist/contentScriptWebIntelligence.js');
const extensionPath = path.join(repoRoot, 'dist');
const lensScreenshotPath = '/tmp/personal-ai-change-ledger-lens.png';
const sourceScreenshotPath = '/tmp/personal-ai-change-ledger-source-memory.png';

await fs.access(contentScriptPath).catch(() => {
  throw new Error('Missing dist/contentScriptWebIntelligence.js. Run npm start first.');
});

const timestamps = {
  first: 1_782_820_800,
  second: 1_782_907_200,
};

function changeValue(kind, display, normalized = display) {
  return { kind, display, normalized };
}

function changeEvent({ id, nextValue, sourceTitle, reason, observedAt, previousValue }) {
  return {
    id,
    chainKey: 'release:desktop-8.2:release.date',
    subjectKey: 'release:desktop-8.2',
    subjectLabel: 'Desktop 8.2',
    subjectKind: 'release',
    propertyKey: 'release.date',
    propertyLabel: '发布时间',
    previousValue,
    nextValue,
    eventKind: 'update',
    authorityRole: 'authoritative_source',
    confidence: 0.98,
    sourceRef: {
      type: 'source_memory',
      id: 'capsule-change-ledger',
      title: sourceTitle,
      url: 'https://release.example.com/desktop-8-2',
    },
    reason,
    observedAt,
    capturedAt: observedAt + 5,
    active: true,
    isReversal: false,
  };
}

const july11 = changeValue('date', '2026-07-11');
const july18 = changeValue('date', '2026-07-18');
const july25 = changeValue('date', '2026-07-25');
const july30 = changeValue('date', '2026-07-30');
const history = [
  changeEvent({
    id: 'change-release-a',
    previousValue: july11,
    nextValue: july18,
    sourceTitle: 'Release tracker A',
    reason: '等待安全审核窗口',
    observedAt: timestamps.first,
  }),
  changeEvent({
    id: 'change-release-b',
    previousValue: july18,
    nextValue: july25,
    sourceTitle: 'Release tracker B',
    reason: '客户端回归增加一周',
    observedAt: timestamps.second,
  }),
];

function lensProjection(mode) {
  if (mode === 'mixed') {
    return {
      chainKey: 'release:desktop-8.2:release.date',
      subjectKey: 'release:desktop-8.2',
      subjectLabel: 'Desktop 8.2',
      subjectKind: 'release',
      propertyKey: 'release.date',
      propertyLabel: '发布时间',
      currentValue: july25,
      previousValue: july18,
      visiblePageValue: july30,
      status: 'superseded_on_page',
      summary: 'Desktop 8.2 · 发布时间：2026-07-18 -> 2026-07-25',
      boundary: '当前页面显示“2026-07-30”，与变化链最后观测“2026-07-25”不同；以页面当前值为准，历史链未被改写。',
      eventCount: 2,
      reversalCount: 0,
      conflictCount: 0,
      firstObservedAt: timestamps.first,
      lastObservedAt: timestamps.second,
      currentEvent: history[1],
      history,
    };
  }
  return {
    chainKey: 'release:desktop-8.2:release.date',
    subjectKey: 'release:desktop-8.2',
    subjectLabel: 'Desktop 8.2',
    subjectKind: 'release',
    propertyKey: 'release.date',
    propertyLabel: '发布时间',
    currentValue: july25,
    previousValue: july18,
    status: 'last_observed',
    summary: 'Desktop 8.2 · 发布时间：2026-07-18 -> 2026-07-25',
    boundary: '这是最后一次观测，不等于权威系统已确认的当前值。',
    eventCount: 2,
    reversalCount: 0,
    conflictCount: 0,
    firstObservedAt: timestamps.first,
    lastObservedAt: timestamps.second,
    currentEvent: history[1],
    history,
  };
}

function ordinaryMatch() {
  return {
    id: 'release-memory-8-2',
    type: 'source_memory',
    score: 0.94,
    title: 'Desktop 8.2 发布准备记录',
    uiSummary: '发布准备会上确认需要先完成客户端回归。',
    snippet: '发布准备会上确认需要先完成客户端回归。',
    sourceLabel: '资料记忆',
    sourceTitle: 'Desktop 8.2 release notes',
    links: [],
    whyMatched: '命中当前 Desktop 8.2 发布页面',
    whyRelevant: ['同一 release 对象', '包含发布准备上下文'],
    displayPriority: 'p1',
  };
}

function installChromeStub(page) {
  const fixtures = {
    chainProjection: lensProjection('chain'),
    mixedProjection: lensProjection('mixed'),
    ordinaryMatch: ordinaryMatch(),
  };
  return page.addInitScript((ledgerFixtures) => {
    const storageState = {
      envConfig: {
        CONTEXT_ASSIST_ENABLED: true,
        COMPOSE_ASSIST_ENABLED: true,
      },
    };
    const storageListeners = [];
    window.__paiContextRecallRequests = [];

    function normalizeKeys(keys) {
      if (Array.isArray(keys)) return keys;
      if (typeof keys === 'string') return [keys];
      if (keys && typeof keys === 'object') return Object.keys(keys);
      return Object.keys(storageState);
    }

    function buildStorageResult(keys) {
      const result = {};
      for (const key of normalizeKeys(keys)) {
        if (key in storageState) result[key] = storageState[key];
      }
      return result;
    }

    function respond(callback, response) {
      if (typeof callback === 'function') {
        window.setTimeout(() => callback(response), 0);
        return undefined;
      }
      return Promise.resolve(response);
    }

    window.chrome = {
      extension: { inIncognitoContext: false },
      runtime: {
        lastError: null,
        getURL: (assetPath) => `chrome-extension://pai-test/${assetPath}`,
        sendMessage(message, callback) {
          window.chrome.runtime.lastError = null;
          if (message?.type === 'CONTEXT_RECALL_REQUEST') {
            window.__paiContextRecallRequests.push(message.request);
            const mode = new URL(window.location.href).searchParams.get('mode') || 'chain';
            const projection = mode === 'mixed'
              ? ledgerFixtures.mixedProjection
              : ledgerFixtures.chainProjection;
            const match = mode === 'mixed' ? ledgerFixtures.ordinaryMatch : null;
            return respond(callback, {
              topMatch: match,
              matches: match ? [match] : [],
              changeProjections: [projection],
            });
          }
          return respond(callback, { success: true });
        },
      },
      storage: {
        local: {
          get(keys, callback) {
            const result = buildStorageResult(keys);
            if (typeof callback === 'function') {
              callback(result);
              return undefined;
            }
            return Promise.resolve(result);
          },
          set(items, callback) {
            Object.assign(storageState, items || {});
            const changes = Object.fromEntries(
              Object.entries(items || {}).map(([key, value]) => [key, { newValue: value }]),
            );
            for (const listener of storageListeners) listener(changes, 'local');
            if (typeof callback === 'function') callback();
            return Promise.resolve();
          },
        },
        onChanged: {
          addListener(listener) {
            storageListeners.push(listener);
          },
        },
      },
    };
  }, fixtures);
}

async function verifyMemoryLens() {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pai-change-ledger-lens-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 430, height: 900 },
  });
  try {
    const fixtureHtml = `<!doctype html>
      <html><head><title>Desktop 8.2 release</title><style>
        body { margin: 0; padding: 24px; font: 15px/1.5 system-ui, sans-serif; background: #f7f8fa; color: #17202a; }
        main { max-width: 720px; margin: auto; }
        .conversation-card-wrapper { padding: 14px; border: 1px solid #d9dee5; background: white; }
      </style></head><body><main>
        <h1>Desktop 8.2 release</h1>
        <section id="message-chat-stream-wrapper">
          <div class="conversation-card-wrapper" data-id="release-post" groupid="desktop-8-2">
            <span data-name="name">Release owner</span>
            <span data-name="text">Desktop 8.2 发布时间和客户端回归进展</span>
            <span data-name="time">10:00 AM</span>
          </div>
        </section>
      </main></body></html>`;

    await context.route('https://app.ringcentral.com/messages/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: fixtureHtml }),
    );

    const chainPage = await context.newPage();
    await installChromeStub(chainPage);
    await chainPage.goto('https://app.ringcentral.com/messages/desktop-8-2?mode=chain');
    await chainPage.addScriptTag({ path: contentScriptPath });
    const chainBubble = chainPage.locator('.pai-context-bubble');
    await chainBubble.waitFor({ state: 'visible', timeout: 10_000 });
    await chainBubble.click();
    const chainCard = chainPage.locator('.pai-context-card');
    await chainCard.waitFor({ state: 'visible', timeout: 3_000 });
    const chainText = await chainCard.innerText();
    assert.match(chainText, /变化脉络/);
    assert.match(chainText, /发布时间/);
    assert.match(chainText, /2026-07-18\s*→\s*2026-07-25/);
    assert.match(chainText, /最后观测/);
    assert.match(chainText, /链级只读/);
    assert.match(chainText, /只读变化证据，不确认当前值\/写入\/插入\/发送/);
    assert.equal(await chainCard.locator('.pai-context-recall-positive').count(), 0);
    assert.equal(await chainCard.locator('.pai-context-recall-negative').count(), 0);

    const chainHistory = chainCard.locator('.pai-context-change-history');
    await chainHistory.evaluate((details) => {
      details.open = true;
    });
    assert.equal(await chainHistory.evaluate((details) => details.open), true);
    assert.match((await chainHistory.textContent()) || '', /客户端回归增加一周/);
    await chainCard.locator('.pai-context-card-scroll').evaluate((scroller) => {
      const target = scroller.querySelector('.pai-context-change-ledger');
      if (target) scroller.scrollTop = Math.max(0, target.offsetTop - 12);
    });
    const chainBox = await chainCard.boundingBox();
    const viewport = chainPage.viewportSize();
    assert.ok(
      chainBox && viewport && chainBox.x >= 0 && chainBox.x + chainBox.width <= viewport.width + 1,
      `Lens card must fit the viewport: box=${JSON.stringify(chainBox)} viewport=${JSON.stringify(viewport)}`,
    );
    await chainCard.screenshot({ path: lensScreenshotPath });

    const mixedPage = await context.newPage();
    await installChromeStub(mixedPage);
    await mixedPage.goto('https://app.ringcentral.com/messages/desktop-8-2-mixed?mode=mixed');
    await mixedPage.addScriptTag({ path: contentScriptPath });
    const mixedBubble = mixedPage.locator('.pai-context-bubble');
    await mixedBubble.waitFor({ state: 'visible', timeout: 10_000 });
    await mixedBubble.click();
    const mixedCard = mixedPage.locator('.pai-context-card');
    await mixedCard.waitFor({ state: 'visible', timeout: 3_000 });
    const mixedText = await mixedCard.innerText();
    assert.match(mixedText, /Desktop 8\.2\s*·\s*变化脉络/);
    assert.match(mixedText, /变化脉络/);
    assert.match(mixedText, /2026-07-30/);
    assert.match(mixedText, /页面已有新值/);
    assert.match(mixedText, /链级只读/);
    assert.match(mixedText, /1\s*\/\s*2/);
    assert.equal(await mixedCard.locator('.pai-context-recall-positive').count(), 0);
    assert.equal(await mixedCard.locator('.pai-context-recall-negative').count(), 0);

    await mixedCard.locator('.pai-context-next').click();
    const ordinaryText = await mixedCard.innerText();
    assert.match(ordinaryText, /Desktop 8\.2 发布准备记录/);
    assert.doesNotMatch(ordinaryText, /变化脉络/);
    assert.equal(await mixedCard.locator('.pai-context-recall-positive').count(), 1);
    assert.equal(await mixedCard.locator('.pai-context-recall-negative').count(), 1);
  } finally {
    await context.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}

function sourceCapsuleFixture() {
  const conflictHistory = [
    changeEvent({
      id: 'conflict-a',
      previousValue: july11,
      nextValue: july18,
      sourceTitle: 'Release tracker A',
      observedAt: timestamps.second,
    }),
    changeEvent({
      id: 'conflict-b',
      previousValue: july11,
      nextValue: july25,
      sourceTitle: 'Release tracker B',
      observedAt: timestamps.second,
    }),
  ];
  return {
    capsule: {
      id: 'capsule-change-ledger',
      sourceKind: 'webpage',
      sourceUrl: 'https://release.example.com/desktop-8-2',
      sourceTitle: 'Desktop 8.2 发布计划',
      sourceHost: 'release.example.com',
      captureMode: 'manual',
      captureReason: '用户保存发布计划',
      status: 'saved',
      scope: 'work',
      privacyLevel: 'work',
      summary: 'Desktop 8.2 发布日期曾被两个同权威来源更新。',
      contentPreview: 'Release tracker A 和 Release tracker B 在同一时间给出不同发布日期。',
      messageId: 'source-memory-change-ledger-message',
      metadata: {},
      createdAt: timestamps.first,
      updatedAt: timestamps.second,
      savedAt: timestamps.second,
      anchors: [],
      takeaways: [],
      triggers: [],
      changeLedger: {
        status: 'ready',
        label: '已形成变化脉络',
        detail: '提取 2 条带前后值和来源的状态变化。',
        evidence: ['事件与当前投影分开保存。', '同权威候选冲突时不推断当前值。'],
        inputHash: 'verify-change-ledger',
        extractedCount: 2,
        excludedNoiseCount: 0,
        generatedAt: timestamps.second,
        active: true,
        events: conflictHistory,
        projections: [{
          chainKey: 'release:desktop-8.2:release.date',
          subjectKey: 'release:desktop-8.2',
          subjectLabel: 'Desktop 8.2',
          subjectKind: 'release',
          propertyKey: 'release.date',
          propertyLabel: '发布时间',
          previousValue: july11,
          status: 'conflicted',
          summary: 'Desktop 8.2 · 发布时间：候选冲突（2026-07-18 / 2026-07-25），当前值未知',
          boundary: '相近时间存在同等权威但值不同的证据；回答或起草前需要核对当前来源。',
          eventCount: 2,
          reversalCount: 0,
          conflictCount: 1,
          firstObservedAt: timestamps.second,
          lastObservedAt: timestamps.second,
          history: conflictHistory,
        }],
      },
    },
  };
}

function apiFallback(url) {
  const pathname = new URL(url).pathname;
  if (pathname.endsWith('/stats')) {
    return {
      entities: { total: 0, byType: {} },
      messages: { today: 0, thisWeek: 0 },
      relationships: { total: 0 },
      currentUser: { id: 'verify-user', fallbackToDefault: false },
    };
  }
  if (pathname.endsWith('/meetings')) return { items: [], total: 0, limit: 50, offset: 0 };
  return { items: [], total: 0, limit: 50, offset: 0 };
}

async function verifySourceMemory() {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pai-change-ledger-source-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1240, height: 900 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  try {
    await context.route('http://localhost:3210/api/v1/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (
        route.request().method() === 'GET' &&
        pathname.endsWith('/source-memory/capsules/capsule-change-ledger')
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(sourceCapsuleFixture()),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiFallback(route.request().url())),
      });
    });

    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 10_000 });
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(
      `chrome-extension://${extensionId}/memory-exploring.html#/source-memory/capsule-change-ledger`,
      { waitUntil: 'domcontentloaded' },
    );

    await page.getByRole('heading', { name: 'Desktop 8.2 发布计划' }).waitFor({ timeout: 10_000 });
    const panel = page.locator('.change-ledger-panel');
    await panel.waitFor({ state: 'visible', timeout: 10_000 });
    const panelText = await panel.innerText();
    assert.match(panelText, /变化脉络/);
    assert.match(panelText, /已形成变化脉络/);
    assert.match(panelText, /已提取/);
    assert.match(panelText, /存在冲突/);
    assert.match(panelText, /未记录\s*→\s*未知|2026-07-11\s*→\s*未知/);
    assert.match(panelText, /回答或起草前需要核对当前来源/);

    await panel.locator('.change-history summary').evaluate((summary) => summary.click());
    await panel.getByText('Release tracker A').waitFor({ timeout: 3_000 });
    await panel.getByText('Release tracker B').waitFor({ timeout: 3_000 });
    await panel.screenshot({ path: sourceScreenshotPath });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    const noHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    );
    assert.equal(noHorizontalOverflow, true, 'Source Memory detail must not overflow at mobile width');
  } finally {
    await context.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}

await verifyMemoryLens();
await verifySourceMemory();

console.log('verify-change-memory-ledger-e2e: ok');
console.log(`Lens screenshot: ${lensScreenshotPath}`);
console.log(`Source Memory screenshot: ${sourceScreenshotPath}`);
