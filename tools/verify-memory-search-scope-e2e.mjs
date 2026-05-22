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
      const scope = payload.scope || 'work';
      askRequests.push(payload);
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
                timestamp: nowSeconds,
                scope: 'work',
                metadata: { channels: ['fts'] },
              },
              {
                id: 'all-personal-memory',
                type: 'message',
                content: 'Personal memory evidence for all',
                displayTitle: 'Scoped personal memory result all',
                displayText: 'The all search includes a personal memory.',
                score: 0.89,
                source: 'manual',
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
          channelDiagnostics: [
            {
              channel: 'vector',
              status: 'skipped',
              candidateCount: 0,
              reason: 'embedding_unavailable',
            },
            { channel: 'fts', status: 'hit', candidateCount: evidence.length },
            { channel: 'graph', status: 'empty', candidateCount: 0 },
            { channel: 'time', status: 'empty', candidateCount: 0 },
          ],
          blocks: [],
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
  await page.getByText('范围: 工作记忆').waitFor({ timeout: 10000 });
  await page.getByText('命中范围: 工作 1').waitFor({ timeout: 10000 });
  await page.getByText('语义 未运行').waitFor({ timeout: 10000 });
  await page.getByText('关键词 命中 1').waitFor({ timeout: 10000 });
  await page.getByText('图谱 无命中').waitFor({ timeout: 10000 });

  const scopeControls = page.locator('.search-header .scope-segmented');
  await scopeControls.getByRole('button', { name: '个人' }).click();
  await page
    .getByText('Scoped memory result personal')
    .waitFor({ timeout: 10000 });
  assert.equal(askRequests.at(-1)?.scope, 'personal');
  assert.ok(page.url().includes('scope=personal'));
  await page.getByText('范围: 个人记忆').waitFor({ timeout: 10000 });
  await page.getByText('命中范围: 个人 1').waitFor({ timeout: 10000 });

  await scopeControls.getByRole('button', { name: '全部' }).click();
  await page.getByText('Scoped memory result all').waitFor({ timeout: 10000 });
  assert.equal(askRequests.at(-1)?.scope, 'all');
  assert.ok(page.url().includes('scope=all'));
  await page.getByText('范围: 全部记忆').waitFor({ timeout: 10000 });
  await page.getByText('命中范围: 工作 1 · 个人 1').waitFor({ timeout: 10000 });

  assert.deepEqual(
    askRequests.map((request) => request.scope),
    ['work', 'personal', 'all'],
  );

  console.log('verify-memory-search-scope-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
