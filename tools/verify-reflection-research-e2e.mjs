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
  path.join(os.tmpdir(), 'personal-ai-reflection-research-'),
);
const nowSeconds = Math.floor(Date.now() / 1000);

function jsonResponse(body, status = 200) {
  return {
    status,
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
  if (pathname.endsWith('/reflection-threads')) {
    return { items: [], total: 0, limit: 50, offset: 0 };
  }
  if (pathname.endsWith('/actions')) return { items: [], total: 0 };
  if (pathname.endsWith('/config/runtime')) return { outreachEnabled: false };
  if (pathname.endsWith('/outreach/summary')) {
    return { upcomingCount: 0, waitingReplyCount: 0, escalatedCount: 0 };
  }
  if (pathname.endsWith('/outreach/sessions')) {
    return { items: [], total: 0, limit: 50, offset: 0 };
  }
  if (pathname.endsWith('/outreach/templates/runtime-status')) {
    return { items: [], total: 0 };
  }
  if (pathname.endsWith('/skills')) return { items: [], total: 0 };
  if (pathname.endsWith('/skills/suggestions')) {
    return { items: [], total: 0 };
  }
  return {};
}

function threadDetailFixture() {
  return {
    thread: {
      id: 'thread-1',
      topicKey: 'project:orbit',
      title: '项目反思: Orbit',
      status: 'active',
      priority: 8,
      salience: 0.91,
      sourceType: 'ask',
      currentHypothesis: 'Orbit owner should be Platform Team.',
      openQuestions: ['Orbit 的 owner 是否已经稳定？'],
      latestSummary: '本轮反思确认需要先看本地证据再决定是否问人。',
      continueReason: 'waiting_for_outreach',
      nextReflectionAt: nowSeconds + 3600,
      lastReflectedAt: nowSeconds - 900,
      reflectionCount: 3,
      createdAt: nowSeconds - 86400,
      updatedAt: nowSeconds - 60,
    },
    runs: [
      {
        id: 'run-1',
        threadId: 'thread-1',
        runType: 'manual_revisit',
        triggerType: 'manual',
        inputRefs: ['entity:entity-orbit'],
        summary: '本地研究补查完成。',
        discoveries: ['Orbit owner = Platform Team'],
        openQuestions: [],
        actions: [],
        createdAt: nowSeconds - 120,
      },
    ],
    actions: [],
    actionResults: [],
    researchAttempts: [
      {
        id: 'research-hit',
        threadId: 'thread-1',
        runId: 'run-1',
        query: 'Orbit owner',
        purpose: '确认 Orbit owner 是否已有本地证据',
        status: 'hit',
        resultCount: 2,
        sourceTypes: ['glip', 'manual'],
        projectFilter: 'Orbit',
        senderFilter: [],
        groupFilter: ['Launch'],
        evidenceRefs: ['message:msg-1', 'entity:entity-orbit'],
        createdAt: nowSeconds - 120,
      },
      {
        id: 'research-empty',
        threadId: 'thread-1',
        runId: 'run-1',
        query: 'Orbit backend signoff',
        purpose: '确认是否已有 BE signoff 证据',
        status: 'empty',
        resultCount: 0,
        sourceTypes: ['jira'],
        senderFilter: [],
        groupFilter: [],
        evidenceRefs: [],
        createdAt: nowSeconds - 90,
      },
      {
        id: 'research-degraded-hit',
        threadId: 'thread-1',
        runId: 'run-1',
        query: 'Orbit PM decision',
        purpose: '确认 PM 决策是否已有本地证据',
        status: 'hit',
        resultCount: 1,
        sourceTypes: ['glip', 'jira'],
        senderFilter: [],
        groupFilter: [],
        errorMessage: '部分召回通道失败，命中可能不完整：vector(embedding timeout)',
        evidenceRefs: ['message:msg-2'],
        createdAt: nowSeconds - 75,
      },
      {
        id: 'research-failed',
        threadId: 'thread-1',
        runId: 'run-1',
        query: 'Orbit release risk',
        purpose: '确认发布风险是否已有本地证据',
        status: 'failed',
        resultCount: 0,
        sourceTypes: ['web'],
        senderFilter: [],
        groupFilter: [],
        errorMessage: 'recall index temporarily unavailable',
        evidenceRefs: [],
        createdAt: nowSeconds - 60,
      },
    ],
    links: [
      {
        id: 'link-entity',
        threadId: 'thread-1',
        sourceKind: 'entity',
        sourceId: 'entity-orbit',
        weight: 0.86,
        role: 'research',
        createdAt: nowSeconds - 120,
        previewTitle: '实体线索: Orbit',
        preview:
          'Project · Release coordination | 已知事实: owner=Platform Team',
        previewTimestamp: nowSeconds - 120,
      },
    ],
    dreamRuns: [],
  };
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
  let failReflectionList = false;

  await context.route('http://localhost:3210/api/v1/**', async (route) => {
    const requestUrl = route.request().url();
    const pathname = decodeURIComponent(new URL(requestUrl).pathname);

    if (pathname.endsWith('/reflection-threads/thread-1')) {
      await route.fulfill(jsonResponse(threadDetailFixture()));
      return;
    }

    if (pathname.endsWith('/reflection-threads') && failReflectionList) {
      await route.fulfill(
        jsonResponse({ error: 'reflection list unavailable' }, 503),
      );
      return;
    }

    if (pathname.endsWith('/outreach/sessions')) {
      await route.fulfill(
        jsonResponse({ error: 'outreach service unavailable' }, 503),
      );
      return;
    }

    await route.fulfill(jsonResponse(apiFallback(requestUrl)));
  });

  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }
  const extensionId = new URL(worker.url()).host;
  assert.ok(extensionId, 'extension id should be available');

  const page = await context.newPage();
  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/reflection-threads/thread-1`,
    { waitUntil: 'domcontentloaded' },
  );

  await page.getByText('项目反思: Orbit').waitFor({ timeout: 10000 });
  await page.getByText('继续原因').waitFor({ timeout: 10000 });
  await page.getByText('等待关联主动询问回复').waitFor({ timeout: 10000 });
  await page
    .getByText(/关联主动询问加载失败：.*outreach service unavailable/)
    .waitFor({ timeout: 10000 });
  await page.getByText('研究补查过程').waitFor({ timeout: 10000 });
  await page.getByText('确认 Orbit owner 是否已有本地证据').waitFor({
    timeout: 10000,
  });
  const ownerResearchCard = page.locator('.research-trace-card', {
    hasText: '确认 Orbit owner 是否已有本地证据',
  });
  await ownerResearchCard.getByText('已命中').waitFor({ timeout: 10000 });
  await page.getByText('命中 2').waitFor({ timeout: 10000 });
  await page.getByText('glip / manual').waitFor({ timeout: 10000 });
  await page.getByText('证据 message:msg-1 · entity:entity-orbit').waitFor({
    timeout: 10000,
  });
  await page.getByText('无结果').waitFor({ timeout: 10000 });
  await page
    .getByText('本地没有找到可加入本轮反思的证据。')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('确认 PM 决策是否已有本地证据')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('部分召回通道失败，命中可能不完整：vector(embedding timeout)')
    .waitFor({ timeout: 10000 });
  await page.getByText('查询失败').waitFor({ timeout: 10000 });
  await page
    .getByText('recall index temporarily unavailable')
    .waitFor({ timeout: 10000 });
  const researchEvidencePanel = page.locator('.panel', {
    hasText: '研究命中证据',
  });
  await researchEvidencePanel.waitFor({ timeout: 10000 });
  await researchEvidencePanel
    .getByText('实体线索: Orbit')
    .waitFor({ timeout: 10000 });
  await researchEvidencePanel
    .getByText(/owner=Platform Team/)
    .waitFor({ timeout: 10000 });

  failReflectionList = true;
  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/reflection-threads`,
    { waitUntil: 'domcontentloaded' },
  );
  await page
    .getByText('自我反思线程暂时不可用')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('reflection list unavailable')
    .waitFor({ timeout: 10000 });

  console.log('verify-reflection-research-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
