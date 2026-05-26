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
  path.join(os.tmpdir(), 'personal-ai-memory-search-feedback-'),
);
const askRequests = [];
const feedbackRequests = [];
const nowSeconds = Math.floor(Date.now() / 1000);

function jsonResponse(body) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
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
      askRequests.push(payload);
      await route.fulfill(
        jsonResponse({
          answer: 'Search feedback answer',
          evidence: [
            {
              id: 'search-feedback-message',
              type: 'message',
              content: 'Search feedback memory content.',
              displayTitle: 'Search feedback memory',
              displayText: 'This result restores and updates recall feedback.',
              score: 0.93,
              source: 'manual',
              sourceUrl: 'javascript:alert(1)',
              exploreLink: '#/settings',
              timestamp: nowSeconds,
              scope: 'work',
              metadata: { channels: ['fts'], recallFeedback: 'negative' },
            },
          ],
          queryTimeMs: 8,
          blocks: [],
        }),
      );
      return;
    }

    if (pathname.endsWith('/feedback')) {
      feedbackRequests.push(request.postDataJSON());
      await route.fulfill(
        jsonResponse({ status: 'ok', targetType: 'message' }),
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
    `chrome-extension://${extensionId}/memory-exploring.html#/search?q=feedback%20query&scope=work`,
    { waitUntil: 'domcontentloaded' },
  );

  await page.getByText('Search feedback memory').waitFor({ timeout: 10000 });
  assert.equal(askRequests.at(-1)?.scope, 'work');

  const resultCard = page.locator('.search-result-card', {
    hasText: 'Search feedback memory',
  });
  await resultCard
    .locator('mark.search-highlight', { hasText: 'feedback' })
    .first()
    .waitFor({ timeout: 10000 });
  await resultCard
    .getByText('来源链接已隐藏：仅支持 http/https')
    .waitFor({ timeout: 10000 });
  await resultCard
    .getByText('记忆内跳转已隐藏：不支持的目标')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await resultCard.getByRole('button', { name: '打开来源' }).count(),
    0,
    'unsafe search result source should not expose an open-source button',
  );
  assert.equal(
    await resultCard.getByRole('button', { name: '在记忆中查看' }).count(),
    0,
    'unsupported search result route should not expose an internal jump button',
  );
  await resultCard.getByText('已记录为不相关').waitFor({ timeout: 10000 });
  assert.equal(
    await resultCard
      .getByRole('button', { name: '不相关' })
      .getAttribute('aria-pressed'),
    'true',
    'search result should restore persisted negative feedback',
  );

  await resultCard.getByRole('button', { name: '有用' }).click();
  await resultCard.getByText('已记录为有用').waitFor({ timeout: 10000 });
  assert.deepEqual(feedbackRequests[0], {
    type: 'recall_quality',
    targetId: 'search-feedback-message',
    targetType: 'message',
    action: 'positive',
  });

  await resultCard.getByRole('button', { name: '不相关' }).click();
  await resultCard.getByText('已记录为不相关').waitFor({ timeout: 10000 });
  assert.deepEqual(feedbackRequests[1], {
    type: 'recall_quality',
    targetId: 'search-feedback-message',
    targetType: 'message',
    action: 'negative',
  });

  await resultCard.getByRole('button', { name: '撤销' }).click();
  await resultCard.getByText('已撤销反馈').waitFor({ timeout: 10000 });
  assert.deepEqual(feedbackRequests[2], {
    type: 'recall_quality',
    targetId: 'search-feedback-message',
    targetType: 'message',
    action: 'clear',
  });
  assert.equal(
    await resultCard.getByRole('button', { name: '撤销' }).count(),
    0,
    'clear action should return the search result to a neutral feedback state',
  );

  console.log('verify-memory-search-feedback-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
