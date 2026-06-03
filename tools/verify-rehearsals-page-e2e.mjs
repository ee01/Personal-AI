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
  path.join(os.tmpdir(), 'personal-ai-rehearsals-page-'),
);
const nowSeconds = Math.floor(Date.now() / 1000);
const listStatuses = [];
const detailRequests = [];
const reactivationRequests = [];

const activeRehearsal = {
  id: 'active-rehearsal',
  title: 'Active launch prep',
  scenarioType: 'meeting_prep',
  status: 'active',
  summary: 'Bring the launch review question into the next meeting.',
  content: 'Ask the launch team whether owner handoff is ready.',
  activationCues: {
    projects: ['Launch Review'],
    keywords: ['handoff'],
  },
  evidenceRefs: ['message:active'],
  sourceKind: 'reflection',
  sourceRefId: 'reflection-active',
  confidence: 0.91,
  priority: 8,
  activationCount: 2,
  usedCount: 0,
  dismissedCount: 0,
  createdAt: nowSeconds - 3600,
  updatedAt: nowSeconds - 1800,
};

const staleRehearsal = {
  id: 'stale-rehearsal',
  title: 'Stale Colin follow-up',
  scenarioType: 'person_chat',
  status: 'stale',
  summary: 'Ask Colin whether RingClaw review ownership is still blocked.',
  content: 'When speaking with Colin Liu, ask whether RingClaw review ownership is still blocked.',
  activationCues: {
    people: ['Colin Liu'],
    groupIds: ['colin-group'],
    keywords: ['RingClaw'],
  },
  evidenceRefs: ['message:colin'],
  sourceKind: 'reflection',
  sourceRefId: 'reflection-colin',
  confidence: 0.84,
  priority: 7,
  validUntil: nowSeconds - 7200,
  activationCount: 1,
  usedCount: 0,
  dismissedCount: 0,
  staleReason: 'validity_expired',
  createdAt: nowSeconds - 86400 * 100,
  updatedAt: nowSeconds - 600,
};

const staleActivation = {
  id: 'activation-stale',
  rehearsalId: staleRehearsal.id,
  surface: 'composer_guard',
  contextType: 'message_thread',
  sceneKey: 'ringcentral:colin-group',
  score: 0.76,
  displayPriority: 'p2',
  matchedCues: {
    people: ['Colin Liu'],
    keywords: ['RingClaw'],
    groupIds: ['colin-group'],
  },
  outcome: 'shown',
  createdAt: nowSeconds - 300,
  updatedAt: nowSeconds - 300,
};

function restoredRehearsal() {
  return {
    ...staleRehearsal,
    status: 'active',
    staleReason: undefined,
    validUntil: undefined,
    lastActivatedAt: nowSeconds,
    updatedAt: nowSeconds,
  };
}

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function emptyList(limit = 50) {
  return { items: [], total: 0, limit, offset: 0 };
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
  if (pathname.endsWith('/meetings')) return emptyList();
  if (pathname.endsWith('/confirm-requests')) return emptyList();
  if (pathname.endsWith('/reflection-threads')) return emptyList();
  if (pathname.endsWith('/actions')) return emptyList();
  if (pathname.endsWith('/config/runtime')) return { outreachEnabled: false };
  if (pathname.endsWith('/outreach/summary')) {
    return { upcomingCount: 0, waitingReplyCount: 0, escalatedCount: 0 };
  }
  if (pathname.endsWith('/outreach/templates/runtime-status')) return emptyList();
  if (pathname.endsWith('/skills')) return emptyList();
  if (pathname.endsWith('/skills/suggestions')) return emptyList();
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
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname.endsWith('/rehearsals')) {
      const status = url.searchParams.get('status') || 'active';
      listStatuses.push(status);
      const items = status === 'all'
        ? [staleRehearsal, activeRehearsal]
        : status === 'active'
          ? [activeRehearsal]
          : status === 'stale'
            ? [staleRehearsal]
          : [];
      await route.fulfill(
        jsonResponse({
          items,
          total: items.length,
          limit: Number(url.searchParams.get('limit') || 50),
          offset: 0,
        }),
      );
      return;
    }

    if (pathname.endsWith(`/rehearsals/${staleRehearsal.id}`)) {
      if (request.method() === 'PATCH') {
        const payload = request.postDataJSON();
        reactivationRequests.push(payload);
        await route.fulfill(jsonResponse({ rehearsal: restoredRehearsal() }));
        return;
      }
      detailRequests.push(staleRehearsal.id);
      await route.fulfill(
        jsonResponse({
          rehearsal: staleRehearsal,
          activations: [staleActivation],
        }),
      );
      return;
    }

    if (pathname.endsWith(`/rehearsals/${activeRehearsal.id}`)) {
      detailRequests.push(activeRehearsal.id);
      await route.fulfill(
        jsonResponse({
          rehearsal: activeRehearsal,
          activations: [],
        }),
      );
      return;
    }

    await route.fulfill(jsonResponse(apiFallback(request.url())));
  });

  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }
  const extensionId = new URL(worker.url()).host;
  assert.ok(extensionId, 'extension id should be available');

  const page = await context.newPage();
  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/rehearsals?rehearsalId=${staleRehearsal.id}`,
    { waitUntil: 'domcontentloaded' },
  );

  const detailPanel = page.getByLabel('Rehearsal 详情');
  await detailPanel
    .getByRole('heading', { name: 'Stale Colin follow-up' })
    .waitFor({ timeout: 10000 });
  await page
    .getByText('当前 Stale Rehearsal 不在「Active」列表中，已临时置顶以便继续审计。')
    .waitFor({ timeout: 10000 });
  await detailPanel.getByText('RingClaw review ownership is still blocked').waitFor({
    timeout: 10000,
  });
  await detailPanel.getByText('降权原因').waitFor({ timeout: 10000 });
  await detailPanel.getByText('validity_expired').waitFor({ timeout: 10000 });
  await detailPanel.getByText('来源证据').waitFor({ timeout: 10000 });
  await detailPanel.getByText('消息').waitFor({ timeout: 10000 });
  await detailPanel.getByText('colin', { exact: true }).waitFor({ timeout: 10000 });
  await detailPanel
    .getByText('当前因有效期过期而降权；重新激活会清除过期时间并重新参与匹配。')
    .waitFor({ timeout: 10000 });
  await detailPanel.getByText('已展示').waitFor({ timeout: 10000 });
  await detailPanel
    .getByText('命中 人物: Colin Liu · 关键词: RingClaw · 群组: colin-group')
    .waitFor({ timeout: 10000 });

  const firstCardText = await page.locator('.rehearsal-card').first().innerText();
  assert.ok(
    firstCardText.includes('Stale Colin follow-up'),
    'deep-linked rehearsal outside the active filter should be pinned first',
  );
  assert.ok(
    detailRequests.includes(staleRehearsal.id),
    'deep-linked rehearsal detail should be fetched directly',
  );

  await page.getByRole('button', { name: '查看全部' }).click();
  await page.getByText('Active launch prep').waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('.filter-select').inputValue(),
    'all',
    'show all action should clear the filter mismatch',
  );
  assert.equal(
    await page.locator('.focus-notice').count(),
    0,
    'notice should disappear once the selected rehearsal is inside the current filter',
  );
  assert.deepEqual(listStatuses.slice(0, 2), ['active', 'all']);

  await page.getByRole('button', { name: /Active launch prep/ }).click();
  await detailPanel
    .getByRole('heading', { name: 'Active launch prep' })
    .waitFor({ timeout: 10000 });
  await page.locator('.filter-select').selectOption('stale');
  await detailPanel
    .getByRole('heading', { name: 'Stale Colin follow-up' })
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('.focus-notice').count(),
    0,
    'user-applied status filters should not pin the previous rehearsal outside the filter',
  );
  const staleFilterFirstCardText = await page.locator('.rehearsal-card').first().innerText();
  assert.ok(
    staleFilterFirstCardText.includes('Stale Colin follow-up'),
    'stale filter should select an in-filter rehearsal instead of preserving the old active selection',
  );
  assert.ok(
    page.url().includes(`rehearsalId=${staleRehearsal.id}`),
    'user-applied filters should update the focused rehearsal id in the route',
  );

  await detailPanel.getByRole('button', { name: '重新激活' }).click();
  await detailPanel.getByText('已清除过期时间并恢复为 Active。').waitFor({
    timeout: 10000,
  });
  await detailPanel.getByText('当前会进入场景触发；如果近期不想看到它，可以暂停或标记不相关。').waitFor({
    timeout: 10000,
  });
  assert.deepEqual(
    reactivationRequests[0],
    { status: 'active', staleReason: null, validUntil: null },
    'reactivation should clear stale reason and expired validity',
  );

  const activeDetailRequestCount = detailRequests.filter(
    (id) => id === activeRehearsal.id,
  ).length;
  await page.evaluate((id) => {
    window.location.hash = `#/rehearsals?rehearsalId=${encodeURIComponent(id)}`;
  }, activeRehearsal.id);
  await detailPanel
    .getByRole('heading', { name: 'Active launch prep' })
    .waitFor({ timeout: 10000 });
  await detailPanel.getByText('Ask the launch team whether owner handoff is ready.').waitFor({
    timeout: 10000,
  });
  await detailPanel.getByText('active', { exact: true }).waitFor({ timeout: 10000 });
  assert.equal(
    detailRequests.filter((id) => id === activeRehearsal.id).length,
    activeDetailRequestCount + 1,
    'same-page rehearsalId route changes should refetch and focus the requested rehearsal',
  );
  assert.deepEqual(listStatuses.slice(0, 3), ['active', 'all', 'stale']);

  console.log('verify-rehearsals-page-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
