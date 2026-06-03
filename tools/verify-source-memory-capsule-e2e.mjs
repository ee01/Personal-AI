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
  path.join(os.tmpdir(), 'personal-ai-source-memory-'),
);
const nowSeconds = Math.floor(Date.now() / 1000);
let dismissCount = 0;
let openSourceCount = 0;

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function emptyList() {
  return { items: [], total: 0, limit: 50, offset: 0 };
}

function capsuleFixture(status = 'saved') {
  return {
    capsule: {
      id: 'capsule-falcon-source',
      sourceKind: 'webpage',
      sourceUrl: 'https://source.example.com/falcon/handoff?ticket=PAI-321',
      sourceTitle: 'Falcon handoff source packet',
      sourceHost: 'source.example.com',
      captureMode: 'manual',
      captureReason: '用户点击右侧半露出 + 入库当前页面',
      status,
      scope: 'work',
      privacyLevel: 'work',
      summary: 'Falcon handoff owner, launch risk, and review checklist.',
      contentPreview:
        'Falcon launch handoff notes preserve the owner checklist, customer communication, release risk, and the next readiness review.',
      messageId: 'source-memory-message-falcon',
      createdAt: nowSeconds - 3600,
      updatedAt: nowSeconds - 1800,
      savedAt: nowSeconds - 3500,
      anchors: [
        {
          id: 'anchor-1',
          anchorKind: 'page_excerpt',
          locator: 'https://source.example.com/falcon/handoff?ticket=PAI-321',
          quoteOrPreview:
            'Falcon launch handoff notes preserve the owner checklist and next readiness review.',
          sensitivity: 'normal',
          confidence: 0.78,
        },
      ],
      takeaways: [
        {
          id: 'takeaway-1',
          kind: 'summary',
          title: 'Falcon handoff owner',
          body: 'The source packet names the owner checklist and launch review risk.',
          evidenceAnchorIds: ['anchor-1'],
          confidence: 0.72,
          status: 'draft',
        },
      ],
      triggers: [
        {
          id: 'trigger-1',
          triggerKind: 'title',
          description:
            'Use this source when Falcon handoff or readiness review appears.',
          matcher: { title: 'Falcon handoff source packet' },
          defaultBehavior: 'surface',
        },
      ],
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
      currentUser: {
        id: 'verify-user',
        fallbackToDefault: false,
      },
    };
  }
  if (pathname.endsWith('/meetings')) {
    return { items: [], total: 0, limit: 50, offset: 0 };
  }
  if (pathname.endsWith('/confirm-requests')) return emptyList();
  if (pathname.endsWith('/actions')) return emptyList();
  if (pathname.endsWith('/outreach/sessions')) return emptyList();
  if (pathname.endsWith('/outreach/templates/runtime-status'))
    return emptyList();
  if (pathname.endsWith('/skills')) return emptyList();
  if (pathname.endsWith('/skills/suggestions')) return emptyList();
  return {};
}

const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1240, height: 860 },
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

try {
  await context.route('https://source.example.com/**', async (route) => {
    openSourceCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Falcon source</title><main>Falcon source opened.</main>',
    });
  });

  await context.route('http://localhost:3210/api/v1/**', async (route) => {
    const request = route.request();
    const url = request.url();
    const pathname = new URL(url).pathname;
    if (
      request.method() === 'GET' &&
      pathname.endsWith('/source-memory/capsules/capsule-falcon-source')
    ) {
      await route.fulfill(jsonResponse(capsuleFixture()));
      return;
    }
    if (
      request.method() === 'POST' &&
      pathname.endsWith('/source-memory/capsules/capsule-falcon-source/dismiss')
    ) {
      dismissCount += 1;
      const payload = JSON.parse(request.postData() || '{}');
      assert.equal(payload.reason, '用户在资料记忆详情页撤销');
      await route.fulfill(jsonResponse(capsuleFixture('dismissed')));
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
    `chrome-extension://${extensionId}/memory-exploring.html#/source-memory/capsule-falcon-source`,
    { waitUntil: 'domcontentloaded' },
  );

  await page
    .getByRole('heading', { name: 'Falcon handoff source packet' })
    .waitFor({
      timeout: 10000,
    });
  await page.locator('.eyebrow', { hasText: '资料记忆' }).waitFor({
    timeout: 10000,
  });
  await page.getByText('已保存').waitFor({ timeout: 10000 });
  await page.getByText('整页资料').waitFor({ timeout: 10000 });
  await page.getByText('主动保存').waitFor({ timeout: 10000 });
  await page.getByText('Falcon handoff owner, launch risk').waitFor({
    timeout: 10000,
  });
  await page.getByText('证据锚点').waitFor({ timeout: 10000 });
  await page
    .locator('.evidence-card')
    .getByText('Falcon launch handoff notes preserve')
    .waitFor({ timeout: 10000 });
  await page.getByText('草稿要点').waitFor({ timeout: 10000 });
  await page.getByRole('heading', { name: 'Falcon handoff owner' }).waitFor({
    timeout: 10000,
  });
  await page.getByText('未来触发线索').waitFor({ timeout: 10000 });
  await page.getByText('Use this source when Falcon handoff').waitFor({
    timeout: 10000,
  });

  const timelineHref = await page
    .getByRole('link', { name: '查看关联记忆' })
    .getAttribute('href');
  assert.ok(
    timelineHref?.includes('#/timeline?focus=source-memory-message-falcon'),
    `timeline link should target the linked web memory signal: ${timelineHref}`,
  );

  const sourcePagePromise = context.waitForEvent('page');
  await page.getByRole('button', { name: '打开来源' }).click();
  const sourcePage = await sourcePagePromise;
  await sourcePage.waitForLoadState('domcontentloaded');
  assert.equal(
    sourcePage.url(),
    'https://source.example.com/falcon/handoff?ticket=PAI-321',
  );
  assert.equal(openSourceCount, 1);
  await sourcePage.close();

  await page.getByRole('button', { name: '撤销资料记忆' }).click();
  await page.getByText('已撤销').waitFor({ timeout: 10000 });
  assert.equal(dismissCount, 1);
  assert.equal(
    await page.getByRole('button', { name: '撤销资料记忆' }).count(),
    0,
    'dismissed source memory should not keep the destructive action visible',
  );

  console.log('verify-source-memory-capsule-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
