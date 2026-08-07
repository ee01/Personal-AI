import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(repoRoot, 'desktop-app/package.json'));
const { chromium } = require('playwright');

const extensionPath = path.join(repoRoot, 'dist');
const askWithReceiptQuery = 'Nimbus 方案里哪些话是我的决定？';
const askWithoutReceiptQuery = 'Atlas 的下次同步是什么时候？';
const claimId = 'claim-ai-suggestion-1';
const selfExtensionId = '20367368195';
const forbiddenGlipToolbarLabel = /记住这段|归属/;
const memoryLensFixtureUrl =
  'https://example.com/pai-memory-claim-attribution-e2e';

const memoryLensFixtureHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Nimbus launch ownership review</title>
  </head>
  <body>
    <main>
      <h1>Nimbus launch ownership review</h1>
      <p>
        The Nimbus team is reviewing launch readiness, owner handoff, rollout scope,
        migration checkpoints, and the difference between a user decision and an AI
        suggestion before the next release review.
      </p>
    </main>
  </body>
</html>`;

const glipFixtureHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Memory claim attribution Glip fixture</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .conversation { width: 720px; margin: 48px auto; }
      .conversation-card { padding: 8px 0; }
      .conversation-card-wrapper {
        position: relative;
        min-height: 96px;
        padding: 16px 20px;
        border: 1px solid #d7dce2;
        border-radius: 8px;
        background: white;
      }
      [data-name="name"] { display: block; font-weight: 600; margin-bottom: 8px; }
      [data-name="text"] { line-height: 1.5; }
      [data-name="time"] { display: block; margin-top: 8px; color: #64748b; font-size: 12px; }
      [data-name="avatar"] { display: none; }
      [data-name="conversationTitle"] { display: block; margin-bottom: 16px; font-size: 18px; font-weight: 700; }
    </style>
    <script>
      const request = indexedDB.open('Glip', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('group')) db.createObjectStore('group', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('person')) db.createObjectStore('person', { keyPath: 'id' });
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['group', 'person'], 'readwrite');
        tx.objectStore('group').put({ id: 12345, is_team: true, set_abbreviation: 'Release Team' });
        tx.objectStore('person').put({ id: ${selfExtensionId}, first_name: 'Esone', last_name: 'Qiu' });
      };
    </script>
  </head>
  <body>
    <main class="conversation">
      <span data-name="conversationTitle">Release Team</span>
      <section id="message-chat-stream-wrapper">
        <div role="listbox">
          <article class="conversation-card" role="document">
            <div class="conversation-card-wrapper" data-id="msg-claim-e2e" groupid="12345">
              <button data-name="avatar" data-uid="GLIP_PERSON.99999"></button>
              <span data-name="name">Alicia Chen</span>
              <div data-name="text">The launch owner suggested moving the date, but no decision was made.</div>
              <span data-name="time" datetime="2026-07-31T09:30:00Z">09:30</span>
            </div>
          </article>
        </div>
      </section>
    </main>
  </body>
</html>`;

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

function askResponse({ attributionReceipt } = {}) {
  return {
    answer: attributionReceipt
      ? 'Nimbus 方案中，你明确决定先做小范围验证；AI 提出的全量发布只作为背景。'
      : 'Atlas 的下次同步安排在周五上午。',
    evidence: [
      {
        id: attributionReceipt ? 'nimbus-message-1' : 'atlas-message-1',
        type: 'message',
        content: attributionReceipt
          ? '我决定先做小范围验证。AI: We could launch to everyone next week.'
          : 'Atlas sync is Friday morning.',
        displayTitle: attributionReceipt ? 'Nimbus 方案讨论' : 'Atlas 项目群',
        displayText: attributionReceipt
          ? '我决定先做小范围验证。AI: We could launch to everyone next week.'
          : 'Atlas sync is Friday morning.',
        score: 0.93,
        source: 'glip',
        sourceTitle: attributionReceipt ? 'Nimbus 方案讨论' : 'Atlas 项目群',
        channels: ['fts'],
        timestamp: Math.floor(Date.now() / 1000),
        scope: 'work',
        metadata: { channels: ['fts'] },
      },
    ],
    attributionReceipt,
    resolutionState: 'complete',
    queryTimeMs: 7,
    blocks: [],
  };
}

function memoryLensResponse() {
  const match = {
    id: 'nimbus-memory-lens-claim-1',
    type: 'message',
    score: 0.94,
    displayPriority: 'p1',
    scope: 'work',
    title: 'Nimbus launch ownership decision',
    uiSummary:
      '你决定先做小范围验证；AI 提出的全量发布方案只作为背景。',
    snippet:
      'I decided to validate with a small cohort first. AI: We could launch to everyone next week.',
    sourceLabel: 'glip',
    sourceUrl: 'https://source.example.com/nimbus-launch-review',
    sourceTitle: 'Nimbus launch review',
    exploreLink: '#/timeline?focus=nimbus-memory-lens-claim-1',
    links: [
      {
        label: 'Open source',
        url: 'https://source.example.com/nimbus-launch-review',
      },
    ],
    whyMatched: '当前页面命中 Nimbus launch 与 owner handoff',
    whyRelevant: ['项目：Nimbus', '主题：owner handoff'],
    matchedAnchors: {
      projects: ['Nimbus'],
      topics: ['owner handoff'],
    },
    reasonType: 'keyword_overlap',
    evidenceRole: 'decision',
    timestamp: Math.floor(Date.now() / 1000),
    claimAttribution: [
      {
        claimId,
        sourceMessageId: 'nimbus-message-1',
        revision: 4,
        excerpt: 'AI: We could launch to everyone next week.',
        ownerKind: 'ai_agent',
        ownerLabel: 'AI',
        speechMode: 'suggestion',
        verification: 'source_only',
        commitment: 'none',
        effect: 'background_only',
        displayLabel: 'AI · 建议',
        consequence: '仅作背景，不代表你的立场',
        correctionAllowed: true,
        corrected: false,
      },
    ],
  };
  return {
    matches: [match],
    topMatch: match,
    queryTimeMs: 3,
  };
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
  if (pathname.endsWith('/glip-message-markers')) {
    return { items: [], generatedAt: Math.floor(Date.now() / 1000) };
  }
  if (pathname.endsWith('/skills')) return { items: [], total: 0 };
  if (pathname.endsWith('/skills/suggestions')) return { items: [], total: 0 };
  return {};
}

function segmentBetween(text, startMarker, endMarker, label) {
  const start = text.indexOf(startMarker);
  assert.notEqual(start, -1, `${label}: missing start marker ${startMarker}`);
  const end = text.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${label}: missing end marker ${endMarker}`);
  return text.slice(start, end);
}

function verifyLensPlacementContract(source, runtimeBundle) {
  const sourceRest = segmentBetween(
    source,
    'const buildContextBubbleRestReceipt = (',
    'const getSourceMemoryActionTargetLabel = (',
    'Memory Lens source Rest contract',
  );
  const sourcePeek = segmentBetween(
    source,
    'const renderPeek = (): void => {',
    'const renderCard = (): void => {',
    'Memory Lens source Peek contract',
  );
  const sourceExpanded = segmentBetween(
    source,
    'const renderCard = (): void => {',
    'const buildSourceOpenReceipt = (',
    'Memory Lens source Expanded Card contract',
  );
  assert.doesNotMatch(sourceRest, /pai-context-attribution-chip/);
  assert.doesNotMatch(sourcePeek, /pai-context-attribution-chip/);
  assert.match(sourceExpanded, /pai-context-attribution-chip/);
  assert.match(sourceExpanded, /match\.claimAttribution/);

  const runtimeRest = segmentBetween(
    runtimeBundle,
    'const buildContextBubbleRestReceipt=',
    'const getSourceMemoryActionTargetLabel=',
    'Memory Lens dist Rest contract',
  );
  const runtimePeek = segmentBetween(
    runtimeBundle,
    'const renderPeek=()=>{',
    'const renderCard=()=>{',
    'Memory Lens dist Peek contract',
  );
  const runtimeExpanded = segmentBetween(
    runtimeBundle,
    'const renderCard=()=>{',
    'const buildSourceOpenReceipt=',
    'Memory Lens dist Expanded Card contract',
  );
  assert.doesNotMatch(runtimeRest, /pai-context-attribution-chip/);
  assert.doesNotMatch(runtimePeek, /pai-context-attribution-chip/);
  assert.match(runtimeExpanded, /pai-context-attribution-chip/);
  assert.match(runtimeExpanded, /match\.claimAttribution/);

  const sourceExpansionBoundary = segmentBetween(
    source,
    'const setExpanded = (nextExpanded: boolean): void => {',
    'const finishBubbleDrag = (): void => {',
    'Memory Lens expanded visibility boundary',
  );
  assert.match(sourceExpansionBoundary, /card\.style\.display = expanded \? 'flex' : 'none'/);
  assert.match(sourceExpansionBoundary, /card\.setAttribute\('aria-hidden', String\(!expanded\)\)/);
}

async function verifyAskJourney(context, extensionId, correctionRequests) {
  const page = await context.newPage();
  try {
    await page.goto(
      `chrome-extension://${extensionId}/memory-exploring.html#/search?q=${encodeURIComponent(
        askWithReceiptQuery,
      )}&scope=work`,
      { waitUntil: 'domcontentloaded' },
    );

    await page
      .getByText('Nimbus 方案中，你明确决定先做小范围验证')
      .waitFor({ timeout: 12_000 });
    const receipt = page.locator('.claim-attribution-receipt');
    await receipt.waitFor({ state: 'visible', timeout: 10_000 });
    await receipt.getByText('归属回执', { exact: true }).waitFor();
    await receipt
      .getByText('采用 1 条；仅作背景 1 条；未使用 1 条', { exact: true })
      .waitFor();
    assert.match(
      (await receipt.getAttribute('aria-label')) || '',
      /不修改原始消息或外部系统/,
    );

    const details = receipt.locator('details.claim-attribution-details');
    assert.equal(await details.getAttribute('open'), null);
    assert.equal(
      await receipt.getByRole('button', { name: '不是我的观点' }).isVisible(),
      false,
      'compact receipt should keep correction actions collapsed initially',
    );

    await receipt.getByText('查看依据或纠正归属', { exact: true }).click();
    await receipt.getByText('AI · 建议', { exact: true }).waitFor();
    await receipt
      .getByText('仅作背景，不代表你的立场', { exact: true })
      .waitFor();
    await receipt.getByRole('button', { name: '不是我的观点' }).click();
    await receipt
      .getByText('已更新派生归属；原始消息未修改。', { exact: true })
      .waitFor({ timeout: 10_000 });

    assert.equal(correctionRequests.length, 1);
    assert.equal(correctionRequests[0].method, 'POST');
    assert.equal(
      correctionRequests[0].pathname,
      `/api/v1/memory-claims/${claimId}/corrections`,
    );
    assert.equal(correctionRequests[0].body.correction, 'not_my_view');
    assert.equal(correctionRequests[0].body.expectedRevision, 1);
    assert.equal(correctionRequests[0].body.source, 'ask_receipt');
    assert.equal(
      typeof correctionRequests[0].body.idempotencyKey,
      'string',
    );
    assert.ok(correctionRequests[0].body.idempotencyKey.length > 8);

    await page.goto(
      `chrome-extension://${extensionId}/memory-exploring.html#/search?q=${encodeURIComponent(
        askWithoutReceiptQuery,
      )}&scope=work`,
      { waitUntil: 'domcontentloaded' },
    );
    await page
      .getByText('Atlas 的下次同步安排在周五上午')
      .waitFor({ timeout: 12_000 });
    assert.equal(
      await page.locator('.claim-attribution-receipt').count(),
      0,
      'Ask must not invent an attribution receipt when the API omitted it',
    );
  } finally {
    await page.close();
  }
}

async function verifyMemoryLensJourney(
  context,
  correctionRequests,
  contextRecallRequests,
) {
  await context.route(memoryLensFixtureUrl, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: memoryLensFixtureHtml,
    }),
  );

  const page = await context.newPage();
  const diagnostics = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      diagnostics.push(`console error: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    diagnostics.push(`pageerror: ${error.message}`);
  });

  try {
    await page.goto(memoryLensFixtureUrl, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForSelector('.pai-context-bubble', { timeout: 12_000 });
    } catch (error) {
      const lensRecallCount = contextRecallRequests.filter((request) =>
        String(request.url || '').includes('pai-memory-claim-attribution-e2e'),
      ).length;
      throw new Error(
        `Memory Lens bubble did not appear; recall requests=${lensRecallCount}; diagnostics=${diagnostics.join(' | ') || 'none'}`,
        { cause: error },
      );
    }

    const lensRecallRequests = contextRecallRequests.filter((request) =>
      String(request.url || '').includes('pai-memory-claim-attribution-e2e'),
    );
    assert.equal(
      lensRecallRequests.length,
      1,
      'fixture should trigger one passive context-recall request',
    );
    assert.equal(lensRecallRequests[0].surface, 'web_passive');
    assert.equal(lensRecallRequests[0].contextType, 'webpage');

    const bubble = page.locator('.pai-context-bubble');
    const card = page.locator('.pai-context-card');
    const peek = page.locator('.pai-context-peek');
    const chip = page.locator('.pai-context-attribution-chip');
    await chip.waitFor({ state: 'attached', timeout: 5_000 });

    assert.equal(await card.isVisible(), false, 'Rest should keep Expanded Card hidden');
    assert.equal(await chip.isVisible(), false, 'Rest should not expose the attribution chip');
    assert.doesNotMatch(
      `${(await bubble.getAttribute('title')) || ''} ${(await bubble.getAttribute('aria-label')) || ''}`,
      /AI · 建议|仅作背景/,
      'Rest receipt should not surface claim attribution details',
    );

    await bubble.hover();
    await page.waitForSelector('.pai-context-peek.pai-context-peek--visible', {
      timeout: 5_000,
    });
    assert.equal(await chip.isVisible(), false, 'Hover Peek should not expose the attribution chip');
    assert.doesNotMatch(
      await peek.innerText(),
      /AI · 建议|仅作背景/,
      'Hover Peek should not surface claim attribution details',
    );

    await bubble.click();
    await card.waitFor({ state: 'visible', timeout: 5_000 });
    await chip.waitFor({ state: 'visible', timeout: 5_000 });
    assert.equal((await chip.innerText()).trim(), 'AI · 建议 · 仅作背景');
    assert.match(
      (await chip.getAttribute('title')) || '',
      /仅作背景，不代表你的立场；只影响 Personal AI 的派生使用，不修改原始消息/,
    );

    await card.locator('.pai-context-recall-negative').click();
    const correctionItem = page.locator(
      `.pai-context-claim-correction-item[data-claim-id="${claimId}"]`,
    );
    await correctionItem.waitFor({ state: 'visible', timeout: 5_000 });
    await correctionItem
      .locator('[data-claim-correction="not_my_view"]')
      .click();
    await correctionItem
      .getByText('已更新派生归属；原始消息未修改。', { exact: true })
      .waitFor({ timeout: 10_000 });

    const lensCorrections = correctionRequests.filter(
      (request) => request.body.source === 'memory_lens',
    );
    assert.equal(lensCorrections.length, 1);
    assert.equal(lensCorrections[0].method, 'POST');
    assert.equal(
      lensCorrections[0].pathname,
      `/api/v1/memory-claims/${claimId}/corrections`,
    );
    assert.equal(lensCorrections[0].body.correction, 'not_my_view');
    assert.equal(lensCorrections[0].body.expectedRevision, 4);
    assert.equal(typeof lensCorrections[0].body.idempotencyKey, 'string');
    assert.ok(lensCorrections[0].body.idempotencyKey.length > 8);

    assert.equal(
      diagnostics.some((entry) => entry.startsWith('pageerror:')),
      false,
      diagnostics.join('\n'),
    );
  } finally {
    await page.close();
  }
}

async function verifyGlipToolbarJourney(context) {
  const glipUrl = 'https://app.ringcentral.com/messages/12345';
  await context.route(glipUrl, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: glipFixtureHtml,
    }),
  );

  const page = await context.newPage();
  try {
    await page.goto(glipUrl, { waitUntil: 'domcontentloaded' });
    const message = page.locator(
      '.conversation-card-wrapper[data-id="msg-claim-e2e"]',
    );
    await message.waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForSelector('.message-reaction-toolbar', {
      state: 'attached',
      timeout: 12_000,
    });

    await message.hover();
    const toolbar = message.locator('.message-reaction-toolbar.visible');
    await toolbar.waitFor({ state: 'visible', timeout: 10_000 });
    const actions = await toolbar.locator('button').evaluateAll((buttons) =>
      buttons.map((button) => ({
        text: button.textContent?.replace(/\s+/g, ' ').trim() || '',
        ariaLabel: button.getAttribute('aria-label') || '',
        title: button.getAttribute('title') || '',
      })),
    );
    assert.ok(actions.length >= 4, `expected ordinary Glip actions, got ${JSON.stringify(actions)}`);
    for (const action of actions) {
      assert.doesNotMatch(
        `${action.text} ${action.ariaLabel} ${action.title}`,
        forbiddenGlipToolbarLabel,
        `ordinary Glip toolbar must not add a memory-claim action: ${JSON.stringify(action)}`,
      );
    }
  } finally {
    await page.close();
  }
}

async function main() {
  await fs.access(path.join(extensionPath, 'manifest.json'));
  const [lensSource, lensRuntimeBundle] = await Promise.all([
    fs.readFile(path.join(repoRoot, 'src/contentScriptWebIntelligence.ts'), 'utf8'),
    fs.readFile(path.join(extensionPath, 'contentScriptWebIntelligence.js'), 'utf8'),
  ]);
  verifyLensPlacementContract(lensSource, lensRuntimeBundle);

  const correctionRequests = [];
  const askRequests = [];
  const contextRecallRequests = [];
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'memory-claim-attribution-e2e-'),
  );
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
      if (request.method() === 'OPTIONS') {
        await route.fulfill(jsonResponse({}, 204));
        return;
      }
      if (pathname.endsWith('/ask')) {
        const body = request.postDataJSON();
        askRequests.push(body);
        await route.fulfill(
          jsonResponse(
            body.query === askWithReceiptQuery
              ? askResponse({
                  attributionReceipt: {
                    status: 'downgraded',
                    visibility: 'compact',
                    summary: '采用 1 条；仅作背景 1 条；未使用 1 条',
                    boundary:
                      '归属回执只影响 Personal AI 如何使用派生记忆，不修改原始消息或外部系统。',
                    used: [
                      { kind: 'self:direct_assertion', label: '你 · 明确表达', count: 1 },
                    ],
                    backgroundOnly: [
                      { kind: 'ai_agent:suggestion', label: 'AI · 建议', count: 1 },
                    ],
                    blocked: [
                      { kind: 'other:reported', label: '他人 · 转述', count: 1 },
                    ],
                    claims: [
                      {
                        claimId,
                        sourceMessageId: 'nimbus-message-1',
                        revision: 1,
                        excerpt: 'AI: We could launch to everyone next week.',
                        ownerKind: 'ai_agent',
                        ownerLabel: 'AI',
                        speechMode: 'suggestion',
                        verification: 'source_only',
                        commitment: 'none',
                        effect: 'background_only',
                        displayLabel: 'AI · 建议',
                        consequence: '仅作背景，不代表你的立场',
                        correctionAllowed: true,
                        corrected: false,
                      },
                    ],
                    affectedHighResponsibility: false,
                    correctedCount: 0,
                  },
                })
              : askResponse(),
          ),
        );
        return;
      }
      if (pathname.endsWith('/context-recall')) {
        const body = request.postDataJSON();
        contextRecallRequests.push(body);
        await route.fulfill(
          jsonResponse(
            String(body.url || '').includes(
              'pai-memory-claim-attribution-e2e',
            )
              ? memoryLensResponse()
              : { matches: [], topMatch: null, queryTimeMs: 2 },
          ),
        );
        return;
      }
      if (pathname === `/api/v1/memory-claims/${claimId}/corrections`) {
        const body = request.postDataJSON();
        correctionRequests.push({
          method: request.method(),
          pathname,
          body,
        });
        await route.fulfill(
          jsonResponse({
            claimId,
            revision: body.source === 'memory_lens' ? 5 : 2,
            current: {
              ownerKind: 'ai_agent',
              speechMode: 'reported',
              effect: 'blocked',
            },
            invalidatedDerived: { profile: 0, tasks: 0 },
            recomputeStatus: 'not_needed',
            rawSourceChanged: false,
          }),
        );
        return;
      }
      await route.fulfill(jsonResponse(apiFallback(url)));
    });

    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent('serviceworker', { timeout: 15_000 });
    }
    const extensionId = new URL(worker.url()).host;
    assert.ok(extensionId, 'extension id should be available');
    await worker.evaluate(async ({ selfExtensionId: extensionUserId }) => {
      await chrome.storage.local.set({
        envConfig: {
          MEMORY_SERVICE_BASE_URL: 'http://localhost:3210/api/v1',
          MEMORY_SERVICE_TIMEOUT: 5000,
          ENABLE_SNOOZE: true,
          ENABLE_FOLLOW_THREAD: true,
          ENABLE_AUTO_REPLY: true,
          ENABLE_LINKED_ACTION: true,
        },
        userinfo: {
          fullName: 'Esone Qiu',
          username: 'esone.qiu',
          userEmail: 'esone.qiu@example.com',
          extensionId: extensionUserId,
        },
        glipMessageMarkers: {
          version: 1,
          updatedAt: Date.now(),
          markersByChatId: {},
        },
        'pai-context-muted-sites-v1': {},
        'pai-context-blocked-sites-v1': {},
        'pai-context-blocked-page-prefixes-v1': {},
        'pai-context-allowed-sites-v1': {},
        'pai-context-site-allowlist-mode-v1': false,
      });
    }, { selfExtensionId });

    await verifyAskJourney(context, extensionId, correctionRequests);
    assert.deepEqual(
      askRequests.map((request) => request.query),
      [askWithReceiptQuery, askWithoutReceiptQuery],
      'Ask journey should make exactly one request per page state',
    );
    await verifyMemoryLensJourney(
      context,
      correctionRequests,
      contextRecallRequests,
    );
    await verifyGlipToolbarJourney(context);

    console.log('verify-memory-claim-attribution-e2e: ok');
    console.log('  Ask: real extension E2E (receipt, correction API, raw-source boundary, absent receipt)');
    console.log('  Glip: real content-script E2E (ordinary message toolbar has no memory-claim action)');
    console.log('  Memory Lens: real browser-injected Rest → Hover Peek → Expanded Card E2E');
    console.log('  Memory Lens correction: real drawer + correction API + raw-source boundary E2E');
    console.log('  Memory Lens placement: supplementary source + loaded dist runtime contract');
  } finally {
    await context.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}

await main();
