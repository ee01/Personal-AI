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
  path.join(os.tmpdir(), 'personal-ai-today-pilot-home-'),
);
const now = Math.floor(Date.now() / 1000);

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function emptyList() {
  return { items: [], total: 0, limit: 50 };
}

function apiFallback(url) {
  const pathname = new URL(url).pathname;
  if (pathname.endsWith('/stats')) {
    return {
      entities: { total: 0, byType: {} },
      relationships: { total: 0 },
      messages: { today: 0, thisWeek: 0 },
      chunks: { total: 0 },
      notifications: { pending: 0 },
    };
  }
  if (pathname.endsWith('/meetings')) return { items: [], total: 0 };
  if (pathname.endsWith('/confirm-requests')) return emptyList();
  if (pathname.endsWith('/reflection-threads')) return emptyList();
  if (pathname.endsWith('/actions')) return emptyList();
  if (pathname.endsWith('/config/runtime')) return { outreachEnabled: false };
  if (pathname.endsWith('/outreach/summary')) {
    return {
      upcomingCount: 0,
      waitingReplyCount: 0,
      escalatedCount: 0,
      pendingApprovalCount: 0,
    };
  }
  if (pathname.endsWith('/outreach/templates/runtime-status')) {
    return emptyList();
  }
  if (pathname.endsWith('/skills')) return emptyList();
  if (pathname.endsWith('/skills/suggestions')) return emptyList();
  if (pathname.endsWith('/user/identity')) {
    return { id: 'esone.qiu', source: 'storage' };
  }
  return {};
}

function baseBrief(overrides = {}) {
  return {
    id: 'brief-hidden-rehearsal',
    userId: 'esone.qiu',
    localDate: '2026-05-26',
    timezone: 'Asia/Shanghai',
    generatedAt: now,
    horizon: { from: now - 3600, to: now + 86400 },
    status: 'ready',
    summary: 'Fixture brief',
    attentionBudget: {
      maxInterruptions: 3,
      usedInterruptions: 0,
      plannedInterruptions: [],
      boardOnlyCardIds: [],
      quietWindows: [],
    },
    sourceStats: {
      messages: { scanned: 0, totalRecent: 0 },
      calendar: { scanned: 0, upcoming: 0 },
      notifications: { scanned: 0, pending: 0 },
      actions: { scanned: 0, queued: 0 },
      reflections: { scanned: 0, active: 0 },
      rehearsals: { scanned: 0, active: 0 },
      skills: { scanned: 0, suggestions: 0 },
      relationships: { scanned: 0, highFrequencyPeople: 0 },
    },
    cards: [],
    missions: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function rehearsalCard(id = 'card-hidden-rehearsal') {
  return {
    id,
    missionId: `mission-${id}`,
    sourceHash: id,
    cardType: 'rehearsal_prompt',
    title: '会前使用少讲结论的预演脚本',
    priority: 'high',
    state: 'now',
    score: 88,
    dueAt: now + 1800,
    whyNow: '今天的会议参会人命中一个仍在有效期内的预演。',
    nextBestAction: '进会前复习 30 秒回应脚本。',
    people: [{ name: 'Sophia' }],
    projects: [{ name: 'AI Tools' }],
    evidenceRefs: [
      {
        sourceKind: 'rehearsal',
        sourceId: 'reh-1',
        title: 'Sophia 预演',
        snippet: '遇到质疑时先复述对方问题，再给出边界。',
        timestamp: now - 600,
      },
    ],
    openQuestions: [],
    trust: {
      confidence: 0.86,
      riskLevel: 'low',
      staleEvidenceCount: 0,
      sensitiveEvidenceCount: 0,
    },
    contextPack: { preview: 'Mission: rehearse concise answer' },
    createdAt: now,
    updatedAt: now,
  };
}

function decisionCard() {
  return {
    id: 'card-visible-decision',
    missionId: 'mission-visible-decision',
    sourceHash: 'visible-decision',
    cardType: 'decision_check',
    title: '确认 OpenClaw 是否继续重试部署查询',
    priority: 'high',
    state: 'now',
    score: 92,
    dueAt: now + 900,
    whyNow: '动作队列有一条需要今天确认的生产部署查询。',
    nextBestAction: '进入决策中心确认是否允许重试。',
    people: [{ name: 'Esone' }],
    projects: [{ name: 'OpenClaw' }],
    evidenceRefs: [
      {
        sourceKind: 'action',
        sourceId: 'action-op-deploy',
        title: 'OpenClaw 部署查询',
        snippet: '需要 owner 判断是否允许重试生产部署状态查询。',
        timestamp: now - 300,
      },
    ],
    openQuestions: ['是否允许继续重试？'],
    trust: {
      confidence: 0.91,
      riskLevel: 'low',
      staleEvidenceCount: 0,
      sensitiveEvidenceCount: 0,
    },
    contextPack: { preview: 'Mission: approve OpenClaw retry' },
    createdAt: now,
    updatedAt: now,
  };
}

const hiddenRehearsal = rehearsalCard();
const visibleDecision = decisionCard();
let currentBrief = baseBrief({
  attentionBudget: {
    maxInterruptions: 3,
    usedInterruptions: 1,
    plannedInterruptions: [
      { cardId: hiddenRehearsal.id, reason: 'high priority rehearsal' },
    ],
    boardOnlyCardIds: [],
    quietWindows: [],
  },
  sourceStats: {
    messages: { scanned: 0, totalRecent: 2 },
    calendar: { scanned: 0, upcoming: 0 },
    notifications: { scanned: 0, pending: 0 },
    actions: { scanned: 0, queued: 0 },
    reflections: { scanned: 0, active: 0 },
    rehearsals: { scanned: 1, active: 1 },
    skills: { scanned: 0, suggestions: 0 },
    relationships: { scanned: 0, highFrequencyPeople: 0 },
  },
  cards: [hiddenRehearsal],
});
let failTodayPilotRequest = true;

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error instanceof Error ? error.message : String(error));
  });
  return () => {
    assert.deepEqual(errors, [], `Today Pilot page errors: ${errors.join('; ')}`);
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
  await context.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = request.url();
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/today-pilot/today')) {
      if (failTodayPilotRequest) {
        await route.fulfill(jsonResponse({ error: 'fixture unavailable' }, 503));
        return;
      }
      await route.fulfill(jsonResponse({ brief: currentBrief }));
      return;
    }
    await route.fulfill(jsonResponse(apiFallback(url)));
  });

  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  }
  const extensionId = new URL(worker.url()).host;
  assert.ok(extensionId, 'extension id should be available');

  await worker.evaluate(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      userinfo: { username: 'esone.qiu' },
      envConfig: {
        MEMORY_SERVICE_BASE_URL: 'http://localhost:3210/api/v1',
        MEMORY_SERVICE_TIMEOUT: 30000,
        CONTEXT_ASSIST_ENABLED: true,
        SCENE_REHEARSAL_DISPLAY_ENABLED: false,
      },
    });
  });

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);
  await page.goto(`chrome-extension://${extensionId}/memory-exploring.html#/`, {
    waitUntil: 'domcontentloaded',
  });

  await page
    .getByText('今日领航后端暂时不可用')
    .waitFor({ timeout: 15000 });
  await page
    .getByText('尚不能判断今天是否没有高优先级事项')
    .waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '重试生成' }).waitFor({
    timeout: 15000,
  });
  await assert.rejects(
    page
      .getByText('当前没有需要放到首页的高优先级事项')
      .waitFor({ timeout: 600 }),
  );
  assert.deepEqual(await page.locator('.attention-count').allInnerTexts(), [
    '0',
    '0',
    '0',
    '0',
    '0',
  ]);

  failTodayPilotRequest = false;
  await page.getByRole('button', { name: '重试生成' }).click();

  await page.getByText('今天有 0 件事值得关注').waitFor({ timeout: 15000 });
  await page.getByText('当前没有需要放到首页的高优先级事项').waitFor({
    timeout: 15000,
  });
  assert.equal(await page.locator('.budget-count').innerText(), '0 / 3');
  await page.locator('.source-tag', { hasText: '0 mission' }).waitFor({
    timeout: 15000,
  });
  await assert.rejects(
    page.locator('.source-tag', { hasText: '1 预演' }).waitFor({
      timeout: 600,
    }),
  );
  await assert.rejects(
    page.locator('.source-tag', { hasText: '1 mission' }).waitFor({
      timeout: 600,
    }),
  );
  await page.locator('.ranking-chip', { hasText: '0/2' }).waitFor({
    timeout: 15000,
  });
  await page.locator('.ranking-chip', { hasText: '0/3' }).waitFor({
    timeout: 15000,
  });

  currentBrief = baseBrief({
    id: 'brief-mixed-hidden-rehearsal',
    attentionBudget: {
      maxInterruptions: 3,
      usedInterruptions: 2,
      plannedInterruptions: [
        { cardId: visibleDecision.id, reason: 'high priority decision' },
        { cardId: hiddenRehearsal.id, reason: 'high priority rehearsal' },
      ],
      boardOnlyCardIds: [hiddenRehearsal.id],
      quietWindows: [],
    },
    sourceStats: {
      messages: { scanned: 1, totalRecent: 1 },
      calendar: { scanned: 0, upcoming: 0 },
      notifications: { scanned: 0, pending: 0 },
      actions: { scanned: 1, queued: 1 },
      reflections: { scanned: 0, active: 0 },
      rehearsals: { scanned: 1, active: 1 },
      skills: { scanned: 0, suggestions: 0 },
      relationships: { scanned: 0, highFrequencyPeople: 0 },
    },
    cards: [visibleDecision, hiddenRehearsal],
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page
    .getByText('今天有 1 件事值得关注')
    .waitFor({ timeout: 15000 });
  await page
    .locator('.mission-title', {
      hasText: '确认 OpenClaw 是否继续重试部署查询',
    })
    .waitFor({ timeout: 15000 });
  const decisionMission = page.locator('.mission-card', {
    hasText: '确认 OpenClaw 是否继续重试部署查询',
  });
  await decisionMission.locator('.mission-head').click();
  await decisionMission
    .getByText('OpenClaw 外部执行')
    .waitFor({ timeout: 15000 });
  await decisionMission
    .getByText('真正的外部执行只会由 OpenClaw 接管')
    .waitFor({ timeout: 15000 });
  await decisionMission
    .getByRole('button', { name: '打开动作队列' })
    .waitFor({ timeout: 15000 });
  await decisionMission
    .getByRole('button', { name: '从首页移除' })
    .waitFor({ timeout: 15000 });
  await assert.rejects(
    decisionMission.locator('.provider-segment').waitFor({ timeout: 600 }),
  );
  await assert.rejects(
    decisionMission.getByText('生成上下文包').waitFor({ timeout: 600 }),
  );
  await assert.rejects(
    decisionMission.getByText('复制上下文包').waitFor({ timeout: 600 }),
  );
  assert.equal(await page.locator('.budget-count').innerText(), '1 / 3');
  await page.locator('.source-tag', { hasText: '1 mission' }).waitFor({
    timeout: 15000,
  });
  await assert.rejects(
    page.locator('.source-tag', { hasText: '2 mission' }).waitFor({
      timeout: 600,
    }),
  );
  await assert.rejects(
    page.getByText('会前使用少讲结论的预演脚本').waitFor({
      timeout: 600,
    }),
  );
  await page.locator('.ranking-chip', { hasText: '2/2' }).waitFor({
    timeout: 15000,
  });
  await page.locator('.ranking-chip', { hasText: '1/3' }).waitFor({
    timeout: 15000,
  });
  await assert.rejects(
    page.locator('.ranking-chip', { hasText: '2/3' }).waitFor({
      timeout: 600,
    }),
  );

  const popupPage = await context.newPage();
  const assertNoPopupPageErrors = collectPageErrors(popupPage);
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`, {
    waitUntil: 'domcontentloaded',
  });
  const popupDecisionCard = popupPage.locator('.today-pilot-card', {
    hasText: '确认 OpenClaw 是否继续重试部署查询',
  });
  await popupDecisionCard.waitFor({ timeout: 15000 });
  await popupDecisionCard
    .getByRole('button', { name: /去处理|Review/ })
    .waitFor({ timeout: 15000 });
  await assert.rejects(
    popupDecisionCard
      .getByRole('button', { name: /^复制$|^Copy$/ })
      .waitFor({ timeout: 600 }),
  );
  assertNoPopupPageErrors();
  await popupPage.close();

  assertNoPageErrors();
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
