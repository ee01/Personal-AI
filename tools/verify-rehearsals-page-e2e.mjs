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
const pauseRequests = [];
const reactivationRequests = [];
const cueUpdateRequests = [];
const feedbackRequests = [];
const missingDetailRequests = [];
const missingRehearsalId = 'missing-rehearsal';
let releasePauseResponse = () => {};
const pauseResponseGate = new Promise((resolve) => {
  releasePauseResponse = resolve;
});

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

const pausedRehearsal = {
  id: 'paused-rehearsal',
  title: 'Paused handoff check',
  scenarioType: 'meeting_prep',
  status: 'paused',
  summary: 'Keep the handoff script paused until the next planning cycle.',
  content: 'When planning resumes, confirm whether the handoff owner is still correct.',
  activationCues: {
    projects: ['Handoff Planning'],
    issueKeys: ['PAI-77'],
  },
  evidenceRefs: ['manual:paused-handoff'],
  sourceKind: 'manual',
  sourceRefId: 'paused-handoff',
  confidence: 0.74,
  priority: 5,
  activationCount: 1,
  usedCount: 0,
  dismissedCount: 0,
  createdAt: nowSeconds - 86400 * 8,
  updatedAt: nowSeconds - 240,
};

const cueLessRehearsal = {
  id: 'cue-less-rehearsal',
  title: 'Legacy script without cue',
  scenarioType: 'general',
  status: 'active',
  summary: 'Imported before structured future-scene validation existed.',
  content: 'Remember to ask the right follow-up later.',
  activationCues: {},
  evidenceRefs: ['manual:legacy-import'],
  sourceKind: 'manual',
  sourceRefId: 'legacy-import',
  confidence: 0.71,
  priority: 3,
  activationCount: 0,
  usedCount: 0,
  dismissedCount: 0,
  createdAt: nowSeconds - 86400 * 30,
  updatedAt: nowSeconds - 1200,
};

const weakCueRehearsal = {
  id: 'weak-cue-rehearsal',
  title: 'Broad handoff keyword reminder',
  scenarioType: 'writing',
  status: 'active',
  summary: 'A broad keyword-only script that should be reviewed before relying on live prompts.',
  content: 'When writing about handoff, check whether the owner and review path are explicit.',
  activationCues: {
    keywords: ['handoff'],
    surfaces: ['web_ai'],
  },
  evidenceRefs: ['manual:weak-keyword'],
  sourceKind: 'manual',
  sourceRefId: 'weak-keyword',
  confidence: 0.68,
  priority: 4,
  activationCount: 0,
  usedCount: 0,
  dismissedCount: 0,
  createdAt: nowSeconds - 86400 * 12,
  updatedAt: nowSeconds - 900,
};

const extraActiveRehearsals = Array.from({ length: 79 }, (_, index) => ({
  id: `active-extra-${index + 1}`,
  title: `Loaded slice rehearsal ${index + 1}`,
  scenarioType: 'meeting_prep',
  status: 'active',
  summary: `Additional active rehearsal ${index + 1} for list pagination.`,
  content: `Review pagination rehearsal ${index + 1} before the next planning meeting.`,
  activationCues: {
    projects: [`Pagination Project ${index + 1}`],
  },
  evidenceRefs: [`message:extra-${index + 1}`],
  sourceKind: 'reflection',
  sourceRefId: `reflection-extra-${index + 1}`,
  confidence: 0.62,
  priority: 2,
  activationCount: 0,
  usedCount: 0,
  dismissedCount: 0,
  createdAt: nowSeconds - 86400 - index,
  updatedAt: nowSeconds - 2400 - index,
}));

const activeRehearsalRows = [
  activeRehearsal,
  weakCueRehearsal,
  cueLessRehearsal,
  ...extraActiveRehearsals,
];
const allRehearsalRows = [staleRehearsal, ...activeRehearsalRows];

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

async function waitForCondition(condition, message, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(condition(), message);
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
      const search = (url.searchParams.get('search') || '').trim().toLowerCase();
      const offset = Number(url.searchParams.get('offset') || 0);
      const limit = Number(url.searchParams.get('limit') || 50);
      listStatuses.push(status);
      let sourceItems = status === 'all'
        ? allRehearsalRows
        : status === 'active'
          ? activeRehearsalRows
          : status === 'stale'
            ? [staleRehearsal]
            : status === 'paused'
              ? [pausedRehearsal]
              : [];
      if (search) {
        sourceItems = sourceItems.filter((item) =>
          [item.title, item.summary || '', item.content || ''].some((value) =>
            String(value).toLowerCase().includes(search),
          ),
        );
      }
      const items = sourceItems.slice(offset, offset + limit);
      await route.fulfill(
        jsonResponse({
          items,
          total: sourceItems.length,
          limit,
          offset,
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
      if (request.method() === 'PATCH') {
        const payload = request.postDataJSON();
        pauseRequests.push(payload);
        await pauseResponseGate;
        await route.fulfill(
          jsonResponse(
            { error: 'Memory Service unavailable during pause' },
            503,
          ),
        );
        return;
      }
      detailRequests.push(activeRehearsal.id);
      await route.fulfill(
        jsonResponse({
          rehearsal: activeRehearsal,
          activations: [],
        }),
      );
      return;
    }

    if (pathname.endsWith(`/rehearsals/${activeRehearsal.id}/feedback`)) {
      const payload = request.postDataJSON();
      feedbackRequests.push(payload);
      await route.fulfill(
        jsonResponse({
          rehearsal: {
            ...activeRehearsal,
            status: 'dismissed',
            dismissedCount: 1,
            updatedAt: nowSeconds,
          },
        }),
      );
      return;
    }

    if (pathname.endsWith(`/rehearsals/${pausedRehearsal.id}`)) {
      detailRequests.push(pausedRehearsal.id);
      await route.fulfill(
        jsonResponse({
          rehearsal: pausedRehearsal,
          activations: [],
        }),
      );
      return;
    }

    if (pathname.endsWith(`/rehearsals/${cueLessRehearsal.id}`)) {
      if (request.method() === 'PATCH') {
        const payload = request.postDataJSON();
        cueUpdateRequests.push(payload);
        await route.fulfill(
          jsonResponse({
            rehearsal: {
              ...cueLessRehearsal,
              activationCues: payload.activationCues,
              updatedAt: nowSeconds,
            },
          }),
        );
        return;
      }
      detailRequests.push(cueLessRehearsal.id);
      await route.fulfill(
        jsonResponse({
          rehearsal: cueLessRehearsal,
          activations: [],
        }),
      );
      return;
    }

    if (pathname.endsWith(`/rehearsals/${weakCueRehearsal.id}`)) {
      detailRequests.push(weakCueRehearsal.id);
      await route.fulfill(
        jsonResponse({
          rehearsal: weakCueRehearsal,
          activations: [],
        }),
      );
      return;
    }

    if (pathname.endsWith(`/rehearsals/${missingRehearsalId}`)) {
      missingDetailRequests.push(missingRehearsalId);
      await route.fulfill(
        jsonResponse(
          { error: 'Rehearsal not found in fixture memory service' },
          404,
        ),
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

  const detailPanel = page.getByLabel('场景预演详情');
  await detailPanel
    .getByRole('heading', { name: 'Stale Colin follow-up' })
    .waitFor({ timeout: 10000 });
  await page
    .getByText('当前 Stale Rehearsal 不在「Active」列表中，已临时置顶以便继续审计。')
    .waitFor({ timeout: 10000 });
  await detailPanel
    .getByText(
      'When speaking with Colin Liu, ask whether RingClaw review ownership is still blocked.',
      { exact: true },
    )
    .waitFor({ timeout: 10000 });
  const filterSelect = page.locator('.filter-select');
  const searchInput = page.locator('.rehearsal-hero .search-input');
  const refreshButton = page.locator('.refresh-btn');
  assert.match(
    (await filterSelect.getAttribute('title')) || '',
    /切换只重新读取列表并同步当前详情/,
    'status filter should expose its read-only range boundary before change',
  );
  assert.match(
    (await filterSelect.getAttribute('aria-label')) || '',
    /不会激活、暂停、归档、标记反馈、保存触发线索/,
    'status filter should expose no state/action writes to screen readers',
  );
  assert.match(
    (await searchInput.getAttribute('title')) || '',
    /输入只更新本地搜索草稿/,
    'search input should expose local-draft semantics before Enter/refresh',
  );
  assert.match(
    (await searchInput.getAttribute('aria-label')) || '',
    /不会改状态、写入 Memory Service、写外部系统或执行预演脚本/,
    'search input should expose its no-write/no-execution boundary',
  );
  assert.match(
    (await refreshButton.getAttribute('title')) || '',
    /只重新读取列表、详情和命中历史快照/,
    'refresh button should expose read-only snapshot refresh semantics before click',
  );
  assert.match(
    (await refreshButton.getAttribute('aria-label')) || '',
    /不会激活、暂停、归档、标记反馈、保存触发线索/,
    'refresh button should expose no state/action writes to screen readers',
  );
  await detailPanel.getByText('降权原因').waitFor({ timeout: 10000 });
  await detailPanel.getByText('validity_expired').waitFor({ timeout: 10000 });
  await detailPanel.getByText('来源证据').waitFor({ timeout: 10000 });
  await detailPanel.getByText('消息', { exact: true }).waitFor({ timeout: 10000 });
  await detailPanel.getByText('colin', { exact: true }).waitFor({ timeout: 10000 });
  await detailPanel
    .getByText('当前因有效期过期而降权；重新激活会清除过期时间并重新参与匹配。')
    .waitFor({ timeout: 10000 });
  const readinessPanel = detailPanel.getByLabel('场景资格总览');
  await readinessPanel.getByText('场景资格总览').waitFor({ timeout: 10000 });
  await readinessPanel
    .getByText('人物 / 关键词 / 群组 · 3 个值')
    .waitFor({ timeout: 10000 });
  await readinessPanel.getByText('有锚定线索', { exact: true }).waitFor({
    timeout: 10000,
  });
  await readinessPanel
    .getByText('降权保留，只做弱提示')
    .waitFor({ timeout: 10000 });
  await readinessPanel.getByText('来源 1 · 触发 1').waitFor({ timeout: 10000 });
  await readinessPanel
    .getByText('这条预演已降权保留；即使再次命中也应先作为弱提示，重新激活前需要复核来源和触发历史。')
    .waitFor({ timeout: 10000 });
  await readinessPanel
    .getByText('不发送消息、写入外部系统或替用户执行动作')
    .waitFor({ timeout: 10000 });
  const diagnosticPanel = detailPanel.getByLabel('命中诊断');
  await diagnosticPanel.getByText('命中诊断').waitFor({ timeout: 10000 });
  await diagnosticPanel
    .getByText('已展示 · composer_guard')
    .waitFor({ timeout: 10000 });
  await diagnosticPanel.getByText('0.76', { exact: true }).waitFor({ timeout: 10000 });
  await diagnosticPanel.getByText('正向 0 · 负向 0').waitFor({ timeout: 10000 });
  await diagnosticPanel
    .getByText('composer_guard / message_thread')
    .waitFor({ timeout: 10000 });
  await diagnosticPanel
    .getByText('曾经高分命中且没有负反馈；如果来源仍可信，可以重新激活。')
    .waitFor({ timeout: 10000 });
  await detailPanel
    .locator('.activation-row .outcome-badge')
    .getByText('已展示', { exact: true })
    .waitFor({ timeout: 10000 });
  await detailPanel
    .getByText('命中 人物: Colin Liu · 关键词: RingClaw · 群组: colin-group')
    .waitFor({ timeout: 10000 });
  const listScopeReceipt = page.getByLabel('列表范围回执');
  await listScopeReceipt.getByText('列表范围回执').waitFor({ timeout: 10000 });
  await listScopeReceipt.getByText('Active · 可见 81 条').waitFor({ timeout: 10000 });
  await listScopeReceipt.getByText('82 条', { exact: true }).waitFor({
    timeout: 10000,
  });
  await listScopeReceipt.getByText('80 / 82 条').waitFor({ timeout: 10000 });
  await listScopeReceipt
    .getByText('81 条（含置顶 1）')
    .waitFor({ timeout: 10000 });
  await listScopeReceipt.getByText('1 条仅审计').waitFor({ timeout: 10000 });
  await listScopeReceipt.getByText('1 条需补锚点').waitFor({ timeout: 10000 });
  await listScopeReceipt
    .getByText('Stale · 临时置顶')
    .waitFor({ timeout: 10000 });
  await listScopeReceipt
    .getByText('当前按「Active」读取列表')
    .waitFor({ timeout: 10000 });
  await listScopeReceipt
    .getByText('当前只加载匹配结果的 80/82 条')
    .waitFor({ timeout: 10000 });
  await listScopeReceipt
    .getByText('未加载 2 条不纳入缺少 future cue 或仅弱线索统计')
    .waitFor({ timeout: 10000 });
  await listScopeReceipt
    .getByText('临时置顶 Stale Rehearsal')
    .waitFor({ timeout: 10000 });
  await listScopeReceipt
    .getByText('缺少结构化 future cue')
    .waitFor({ timeout: 10000 });
  await listScopeReceipt
    .getByText('只有关键词/主题/surface 弱线索')
    .waitFor({ timeout: 10000 });
  await listScopeReceipt
    .getByText('加载更多或深链定位只读取和置顶本页列表')
    .waitFor({ timeout: 10000 });
  await listScopeReceipt
    .getByText('不会激活、暂停、归档、标记反馈、写入外部系统或执行预演脚本')
    .waitFor({ timeout: 10000 });
  const paginationReceipt = page.getByLabel('列表分页回执');
  await paginationReceipt.getByText('列表分页回执').waitFor({ timeout: 10000 });
  await paginationReceipt.getByText('已加载 80 / 82 条，仍有 2 条未读取。').waitFor({
    timeout: 10000,
  });
  await paginationReceipt
    .getByText('加载更多只读取当前筛选的下一页')
    .waitFor({ timeout: 10000 });
  await paginationReceipt
    .getByText('不会触发任何状态写入或预演动作')
    .waitFor({ timeout: 10000 });
  const loadMoreButton = paginationReceipt.getByRole('button', { name: /加载更多/ });
  assert.match(
    (await loadMoreButton.getAttribute('title')) || '',
    /只读取当前筛选的下一页并追加到列表/,
    'load more should expose append-only list-read semantics before click',
  );
  assert.match(
    (await loadMoreButton.getAttribute('aria-label')) || '',
    /不会改变筛选、选中详情、现场提示资格、反馈状态、外部系统或预演脚本/,
    'load more should expose no state/write/execution boundary',
  );
  await loadMoreButton.click();
  await page.getByText('Loaded slice rehearsal 79').waitFor({ timeout: 10000 });
  await listScopeReceipt.getByText('Active · 可见 83 条').waitFor({
    timeout: 10000,
  });
  await listScopeReceipt.getByText('82 / 82 条').waitFor({ timeout: 10000 });
  await page.locator('.list-pagination-receipt').waitFor({
    state: 'detached',
    timeout: 10000,
  });

  const firstCardText = await page.locator('.rehearsal-card').first().innerText();
  assert.ok(
    firstCardText.includes('Stale Colin follow-up'),
    'deep-linked rehearsal outside the active filter should be pinned first',
  );
  const staleListReadiness = page
    .locator('.rehearsal-card')
    .filter({ hasText: 'Stale Colin follow-up' })
    .locator('.card-readiness');
  const staleCard = page
    .locator('.rehearsal-card')
    .filter({ hasText: 'Stale Colin follow-up' });
  assert.match(
    (await staleCard.getAttribute('title')) || '',
    /点击只会重新聚焦详情/,
    'selected stale rehearsal card should expose that selection only refocuses detail',
  );
  assert.match(
    (await staleCard.getAttribute('aria-label')) || '',
    /不会激活、暂停、归档、标记反馈、保存触发线索、写入外部系统或执行预演脚本/,
    'stale rehearsal card should expose the no-write/no-execution boundary',
  );
  await staleListReadiness
    .getByText('降权保留，只做弱提示')
    .waitFor({ timeout: 10000 });
  await staleListReadiness
    .getByText('人物 / 关键词 / 群组 · 3 个值')
    .waitFor({ timeout: 10000 });
  await staleListReadiness.getByText('有锚定线索').waitFor({ timeout: 10000 });
  await staleListReadiness
    .getByText('降权保留，强命中也先弱提示')
    .waitFor({ timeout: 10000 });
  assert.ok(
    detailRequests.includes(staleRehearsal.id),
    'deep-linked rehearsal detail should be fetched directly',
  );

  const focusShowAllButton = page
    .locator('.focus-notice')
    .getByRole('button', { name: /查看全部/ });
  assert.match(
    (await focusShowAllButton.getAttribute('title')) || '',
    /只把状态筛选切到 All、清空搜索并重新读取列表/,
    'focus notice show-all button should expose filter-only recovery semantics',
  );
  assert.match(
    (await focusShowAllButton.getAttribute('aria-label')) || '',
    /不会恢复、激活、暂停、归档、标记反馈、保存触发线索或执行预演脚本/,
    'focus notice show-all button should expose no mutation boundary',
  );
  await focusShowAllButton.click();
  await page.getByText('Active launch prep').waitFor({ timeout: 10000 });
  await listScopeReceipt.getByText('All · 可见 80 条').waitFor({ timeout: 10000 });
  await listScopeReceipt.getByText('80 / 83 条').waitFor({ timeout: 10000 });
  await listScopeReceipt
    .getByText('当前按「All」读取列表')
    .waitFor({ timeout: 10000 });
  await listScopeReceipt
    .getByText('不等于会进入现场提示')
    .waitFor({ timeout: 10000 });
  await listScopeReceipt
    .getByText('缺少结构化 future cue')
    .waitFor({ timeout: 10000 });
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
  assert.deepEqual(listStatuses.slice(0, 3), ['active', 'active', 'all']);

  await page.getByRole('button', { name: /Active launch prep/ }).click();
  await detailPanel
    .getByRole('heading', { name: 'Active launch prep' })
    .waitFor({ timeout: 10000 });
  await listScopeReceipt.getByText('All · 可见 80 条').waitFor({ timeout: 10000 });
  const activeListReadiness = page
    .locator('.rehearsal-card')
    .filter({ hasText: 'Active launch prep' })
    .locator('.card-readiness');
  const activeCard = page
    .locator('.rehearsal-card')
    .filter({ hasText: 'Active launch prep' });
  assert.match(
    (await activeCard.getAttribute('title')) || '',
    /状态 Active/,
    'active rehearsal card should include current status in hover boundary',
  );
  assert.match(
    (await activeCard.getAttribute('aria-label')) || '',
    /提示资格 会参与现场匹配/,
    'active rehearsal card should include prompt eligibility in its screen-reader boundary',
  );
  assert.match(
    (await activeCard.getAttribute('aria-label')) || '',
    /触发线索 项目 \/ 关键词 · 2 个值 · 有锚定线索/,
    'active rehearsal card should include cue strength before selection',
  );
  await activeListReadiness
    .getByText('会参与现场匹配')
    .waitFor({ timeout: 10000 });
  await activeListReadiness
    .getByText('项目 / 关键词 · 2 个值')
    .waitFor({ timeout: 10000 });
  await activeListReadiness.getByText('有锚定线索').waitFor({ timeout: 10000 });
  await activeListReadiness
    .getByText('只提示脚本，不自动发送/写入/执行')
    .waitFor({ timeout: 10000 });
  const activeReadinessPanel = detailPanel.getByLabel('场景资格总览');
  await activeReadinessPanel
    .getByText('项目 / 关键词 · 2 个值')
    .waitFor({ timeout: 10000 });
  await activeReadinessPanel.getByText('有锚定线索', { exact: true }).waitFor({
    timeout: 10000,
  });
  await activeReadinessPanel.getByText('会参与现场匹配').waitFor({ timeout: 10000 });
  await activeReadinessPanel
    .getByText('这条预演具备未来线索且处于 Active；继续复核线索是否过宽、脚本是否仍适合当前场景。')
    .waitFor({ timeout: 10000 });
  const pauseButton = detailPanel.getByRole('button', { name: /暂停/ });
  assert.match(
    (await pauseButton.getAttribute('title')) || '',
    /只暂停后续现场提示/,
    'pause button should expose its pre-click action boundary in hover text',
  );
  assert.match(
    (await pauseButton.getAttribute('aria-label')) || '',
    /Memory Service 确认前仍按旧状态显示/,
    'pause button should expose the unconfirmed-write boundary to screen readers',
  );
  await pauseButton.click();
  await detailPanel
    .getByText('正在提交暂停请求；Memory Service 返回前，当前状态仍以 Active 为准。')
    .waitFor({ timeout: 10000 });
  const pendingActionReceipt = detailPanel.getByLabel('处理回执');
  await pendingActionReceipt.getByText('处理请求回执').waitFor({ timeout: 10000 });
  await pendingActionReceipt.getByText('暂停回执 请求中').waitFor({ timeout: 10000 });
  await pendingActionReceipt.getByText('请求中，未确认写入').waitFor({
    timeout: 10000,
  });
  await pendingActionReceipt.getByText('临时禁用，防重复提交').waitFor({
    timeout: 10000,
  });
  await pendingActionReceipt
    .getByText('仍以 Active 作为真实状态')
    .waitFor({ timeout: 10000 });
  await pendingActionReceipt
    .getByText('不会提前激活、暂停、归档、标记反馈、写入外部系统或执行预演脚本')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await pauseButton.isDisabled(),
    true,
    'pending pause should disable the action button before Memory Service confirms',
  );
  releasePauseResponse();
  await detailPanel
    .getByText('处理失败：Memory Service 未确认写入，当前状态保持不变。')
    .waitFor({ timeout: 10000 });
  const failedActionReceipt = detailPanel.getByLabel('处理回执');
  await failedActionReceipt.getByText('写入失败回执').waitFor({ timeout: 10000 });
  await failedActionReceipt.getByText('暂停回执 未确认').waitFor({ timeout: 10000 });
  await failedActionReceipt.getByText('当前状态').waitFor({ timeout: 10000 });
  await failedActionReceipt.getByText('Active', { exact: true }).waitFor({ timeout: 10000 });
  await failedActionReceipt.getByText('未确认写入').waitFor({ timeout: 10000 });
  await failedActionReceipt
    .getByText(
      '本次请求失败，Personal AI 没有确认更新 Rehearsal 状态；现场提示资格、来源证据和触发历史都按原状态保留。',
    )
    .waitFor({ timeout: 10000 });
  await failedActionReceipt
    .getByText('请确认 Memory Service 可用后重试同一动作；不要把这次失败当成已暂停、已归档或已标记不相关。')
    .waitFor({ timeout: 10000 });
  assert.deepEqual(
    pauseRequests[0],
    { status: 'paused' },
    'failed pause should still issue the intended status patch once',
  );
  await detailPanel.getByText('当前会进入场景触发；如果近期不想看到它，可以暂停或标记不相关。').waitFor({
    timeout: 10000,
  });
  const irrelevantButton = detailPanel.getByRole('button', { name: /不相关/ });
  assert.match(
    (await irrelevantButton.getAttribute('title')) || '',
    /不是物理删除/,
    'irrelevant button should expose that feedback is not physical deletion',
  );
  await irrelevantButton.click();
  await detailPanel
    .getByText('已标记不相关，这条预演会退出场景提示。')
    .waitFor({ timeout: 10000 });
  const feedbackActionReceipt = detailPanel.getByLabel('处理回执');
  await feedbackActionReceipt.getByText('不相关回执').waitFor({ timeout: 10000 });
  await feedbackActionReceipt.getByText('Active -> Dismissed').waitFor({
    timeout: 10000,
  });
  await feedbackActionReceipt.getByText('详情刷新').waitFor({ timeout: 10000 });
  await feedbackActionReceipt
    .getByText('已刷新命中历史；确认状态保留')
    .waitFor({ timeout: 10000 });
  await detailPanel
    .locator('.detail-header .status-badge')
    .getByText('Dismissed', { exact: true })
    .waitFor({ timeout: 10000 });
  await detailPanel
    .getByText('当前被标记为不相关；恢复后会重新参与场景观察。')
    .waitFor({ timeout: 10000 });
  assert.deepEqual(
    feedbackRequests[0],
    { outcome: 'irrelevant' },
    'marking irrelevant should submit one feedback request',
  );

  await page.getByRole('button', { name: /Legacy script without cue/ }).click();
  await detailPanel
    .getByRole('heading', { name: 'Legacy script without cue' })
    .waitFor({ timeout: 10000 });
  const cueLessListReadiness = page
    .locator('.rehearsal-card')
    .filter({ hasText: 'Legacy script without cue' })
    .locator('.card-readiness');
  const cueLessCard = page
    .locator('.rehearsal-card')
    .filter({ hasText: 'Legacy script without cue' });
  assert.match(
    (await cueLessCard.getAttribute('aria-label')) || '',
    /提示资格 缺少线索，不应现场提示/,
    'cue-less rehearsal card should expose missing-cue prompt eligibility before selection',
  );
  assert.match(
    (await cueLessCard.getAttribute('title')) || '',
    /触发线索 缺少结构化线索/,
    'cue-less rehearsal card should expose missing structured cue before selection',
  );
  await cueLessListReadiness
    .getByText('缺少线索，不应现场提示')
    .waitFor({ timeout: 10000 });
  await cueLessListReadiness
    .getByText('缺少结构化线索')
    .waitFor({ timeout: 10000 });
  await cueLessListReadiness
    .getByText('先补 future cue，再恢复现场提示')
    .waitFor({ timeout: 10000 });
  await detailPanel.getByLabel('未来场景边界缺失').waitFor({ timeout: 10000 });
  await detailPanel
    .getByText('缺少未来场景边界', { exact: true })
    .waitFor({ timeout: 10000 });
  await detailPanel
    .getByText('请先补充触发条件，再恢复现场提示')
    .waitFor({ timeout: 10000 });
  await detailPanel
    .locator('.fact-grid')
    .getByText('缺少线索，不应现场提示', { exact: true })
    .waitFor({ timeout: 10000 });
  await detailPanel
    .getByText('这条记录缺少未来场景边界；即使状态是 Active，也不应被当作可靠现场提示。')
    .waitFor({ timeout: 10000 });
  const legacyReadinessPanel = detailPanel.getByLabel('场景资格总览');
  await legacyReadinessPanel
    .getByText('缺少结构化线索')
    .waitFor({ timeout: 10000 });
  await legacyReadinessPanel
    .getByText('缺少线索，不应现场提示')
    .waitFor({ timeout: 10000 });
  await legacyReadinessPanel
    .getByText('这条预演没有可识别的未来场景；先补人物、项目、issue、URL、主题或 surface，再恢复现场提示。')
    .waitFor({ timeout: 10000 });
  const legacyDiagnosticPanel = detailPanel.getByLabel('命中诊断');
  await legacyDiagnosticPanel.getByText('缺少线索').waitFor({ timeout: 10000 });
  await legacyDiagnosticPanel
    .getByText('这条预演缺少未来场景边界；先补充人物、项目、issue、URL、主题或 surface，再恢复现场提示。')
    .waitFor({ timeout: 10000 });
  const cueEditor = detailPanel.getByLabel('触发线索编辑');
  await cueEditor.getByText('修正触发线索').waitFor({ timeout: 10000 });
  await cueEditor
    .getByText('草稿还没有可保存的 future cue')
    .waitFor({ timeout: 10000 });
  const cueSaveButton = cueEditor.getByRole('button', { name: /保存触发线索/ });
  const cueResetButton = cueEditor.getByRole('button', { name: /重置/ });
  assert.equal(
    await cueSaveButton.isDisabled(),
    true,
    'cue save should stay disabled until the local draft contains a future cue',
  );
  assert.match(
    (await cueSaveButton.getAttribute('title')) || '',
    /草稿与当前记录一致/,
    'disabled cue save should explain that no PATCH is needed when the draft is unchanged',
  );
  assert.match(
    (await cueResetButton.getAttribute('aria-label')) || '',
    /重置不会改变列表、详情、Memory Service 或外部系统/,
    'disabled cue reset should expose that it has no write effect while unchanged',
  );
  await cueEditor.getByLabel('人物触发线索').fill('Mina Chen');
  await cueEditor.getByLabel('工单触发线索').fill('PAI-42');
  await cueEditor
    .getByLabel('页面触发线索')
    .fill('https://jira.example/browse/PAI-42');
  const cueDraftReceipt = detailPanel.getByLabel('触发线索草稿回执');
  await cueDraftReceipt
    .getByText('触发线索草稿待保存')
    .waitFor({ timeout: 10000 });
  await cueDraftReceipt
    .getByText('草稿已有稳定现场锚点')
    .waitFor({ timeout: 10000 });
  await cueDraftReceipt
    .getByText('本地草稿，未确认写入')
    .waitFor({ timeout: 10000 });
  await cueDraftReceipt
    .getByText('保存只 PATCH 当前 Rehearsal 的 activationCues')
    .waitFor({ timeout: 10000 });
  assert.match(
    (await cueSaveButton.getAttribute('title')) || '',
    /保存只 PATCH 当前 Rehearsal 的 activationCues/,
    'enabled cue save should expose its PATCH-only boundary before click',
  );
  assert.match(
    (await cueSaveButton.getAttribute('aria-label')) || '',
    /不会改写脚本正文、创建任务或执行预演动作/,
    'enabled cue save should expose no script/task/execution boundary',
  );
  assert.match(
    (await cueResetButton.getAttribute('title')) || '',
    /只把本地输入恢复为当前记录/,
    'cue reset should expose local-draft-only behavior before click',
  );
  await cueSaveButton.click();
  await detailPanel
    .getByText('已保存触发线索；现场提示资格会按新的 future cue 重新呈现。')
    .waitFor({ timeout: 10000 });
  const cueActionReceipt = detailPanel.getByLabel('处理回执');
  await cueActionReceipt.getByText('触发线索回执').waitFor({ timeout: 10000 });
  await cueActionReceipt.getByText('Active -> Active').waitFor({ timeout: 10000 });
  await cueActionReceipt.getByText('会参与现场匹配').waitFor({ timeout: 10000 });
  await cueActionReceipt
    .getByText('保存触发线索只更新这条 Rehearsal 的 future cue')
    .waitFor({ timeout: 10000 });
  await detailPanel
    .locator('.fact-grid')
    .getByText('会参与现场匹配', { exact: true })
    .waitFor({ timeout: 10000 });
  await detailPanel
    .getByLabel('场景资格总览')
    .getByText('人物 / 工单 / 页面 · 3 个值 · 有锚定线索')
    .waitFor({ timeout: 10000 });
  assert.deepEqual(
    cueUpdateRequests[0],
    {
      activationCues: {
        people: ['Mina Chen'],
        issueKeys: ['PAI-42'],
        urls: ['https://jira.example/browse/PAI-42'],
      },
    },
    'cue editor should PATCH only the normalized activationCues payload',
  );
  assert.equal(
    await cueSaveButton.isDisabled(),
    true,
    'cue save should disable again after confirmed cue update resets the draft baseline',
  );
  await page.getByRole('button', { name: /Broad handoff keyword reminder/ }).click();
  await detailPanel
    .getByRole('heading', { name: 'Broad handoff keyword reminder' })
    .waitFor({ timeout: 10000 });
  const weakCueListReadiness = page
    .locator('.rehearsal-card')
    .filter({ hasText: 'Broad handoff keyword reminder' })
    .locator('.card-readiness');
  const weakCueCard = page
    .locator('.rehearsal-card')
    .filter({ hasText: 'Broad handoff keyword reminder' });
  assert.match(
    (await weakCueCard.getAttribute('aria-label')) || '',
    /提示资格 会参与，但只有弱线索/,
    'weak-cue rehearsal card should expose weak prompt eligibility before selection',
  );
  assert.match(
    (await weakCueCard.getAttribute('title')) || '',
    /仅弱泛化线索/,
    'weak-cue rehearsal card should expose weak cue strength before selection',
  );
  await weakCueListReadiness
    .getByText('会参与，但只有弱线索')
    .waitFor({ timeout: 10000 });
  await weakCueListReadiness
    .getByText('关键词 / 场景 · 2 个值')
    .waitFor({ timeout: 10000 });
  await weakCueListReadiness
    .getByText('关键词 / 场景 · 2 个值 · 仅弱泛化线索')
    .waitFor({ timeout: 10000 });
  await weakCueListReadiness
    .getByText('仅弱泛化线索，先补人物/会议/issue/URL')
    .waitFor({ timeout: 10000 });
  const weakCueReadinessPanel = detailPanel.getByLabel('场景资格总览');
  await weakCueReadinessPanel
    .getByText('关键词 / 场景 · 2 个值')
    .waitFor({ timeout: 10000 });
  await weakCueReadinessPanel
    .getByText('仅弱泛化线索', { exact: true })
    .waitFor({ timeout: 10000 });
  await weakCueReadinessPanel
    .getByText('会参与，但只有弱线索')
    .waitFor({ timeout: 10000 });
  await weakCueReadinessPanel
    .getByText('这条预演只有主题、关键词或 surface 等泛化弱线索；可能在相似文本里误提示')
    .waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: /Active launch prep/ }).click();
  await detailPanel
    .getByRole('heading', { name: 'Active launch prep' })
    .waitFor({ timeout: 10000 });
  await page.locator('.filter-select').selectOption('stale');
  await detailPanel
    .getByRole('heading', { name: 'Stale Colin follow-up' })
    .waitFor({ timeout: 10000 });
  await listScopeReceipt.getByText('Stale · 可见 1 条').waitFor({ timeout: 10000 });
  const staleScopeText = await listScopeReceipt.innerText();
  assert.match(
    staleScopeText,
    /缺少 future cue\s+0 条/,
    'stale filter should show zero missing future-cue rows',
  );
  assert.match(
    staleScopeText,
    /仅弱线索\s+0 条/,
    'stale filter should show zero weak-only rows',
  );
  await listScopeReceipt
    .getByText('当前按「Stale」读取列表')
    .waitFor({ timeout: 10000 });
  await listScopeReceipt
    .getByText('按卡片提示资格判断 active、candidate、stale 或 archived')
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

  const reactivateButton = detailPanel.getByRole('button', { name: /重新激活/ });
  assert.match(
    (await reactivateButton.getAttribute('aria-label')) || '',
    /不会发送消息、写入外部系统或执行脚本/,
    'reactivate button should expose the no-external-action boundary before click',
  );
  await reactivateButton.click();
  await detailPanel.getByText('已清除过期时间并恢复为 Active。').waitFor({
    timeout: 10000,
  });
  await detailPanel.getByText('当前会进入场景触发；如果近期不想看到它，可以暂停或标记不相关。').waitFor({
    timeout: 10000,
  });
  const actionReceipt = detailPanel.getByLabel('处理回执');
  await actionReceipt.getByText('重新激活回执').waitFor({ timeout: 10000 });
  await actionReceipt.getByText('Stale -> Active').waitFor({ timeout: 10000 });
  await actionReceipt.getByText('会参与现场匹配').waitFor({ timeout: 10000 });
  await actionReceipt.getByText('来源 1 · 触发 1').waitFor({ timeout: 10000 });
  await actionReceipt
    .getByText('重新激活只恢复场景匹配；不会自动发送消息或替用户执行动作。')
    .waitFor({ timeout: 10000 });
  await actionReceipt
    .getByText('如果后续再次误命中，可以直接暂停或标记不相关。')
    .waitFor({ timeout: 10000 });
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
  await listScopeReceipt.getByText('Stale · 可见 2 条').waitFor({ timeout: 10000 });
  await listScopeReceipt
    .getByText('Active · 临时置顶')
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
  assert.deepEqual(listStatuses.slice(0, 4), ['active', 'active', 'all', 'stale']);

  const missingDetailRequestCount = missingDetailRequests.length;
  await page.evaluate((id) => {
    window.location.hash = `#/rehearsals?rehearsalId=${encodeURIComponent(id)}`;
  }, missingRehearsalId);
  const focusReceipt = page.getByLabel('深链目标回执');
  await focusReceipt.getByText('深链目标未确认').waitFor({ timeout: 10000 });
  await focusReceipt.getByText(missingRehearsalId).waitFor({ timeout: 10000 });
  await focusReceipt
    .getByText('这不代表目标已被删除、归档或标记不相关')
    .waitFor({ timeout: 10000 });
  await focusReceipt
    .getByText('改状态前先确认目标标题、脚本和触发线索都对应正确')
    .waitFor({ timeout: 10000 });
  await listScopeReceipt.getByText('Stale · 可见 1 条').waitFor({ timeout: 10000 });
  assert.equal(
    missingDetailRequests.length,
    missingDetailRequestCount + 1,
    'missing deep-link target should be fetched directly before falling back to the list',
  );

  const retryFocusButton = focusReceipt.getByRole('button', { name: /重试目标/ });
  const focusFailureShowAllButton = focusReceipt.getByRole('button', { name: /查看 All/ });
  assert.match(
    (await retryFocusButton.getAttribute('title')) || '',
    /只重新请求目标详情和命中历史/,
    'focus retry should expose detail-read-only semantics before click',
  );
  assert.match(
    (await retryFocusButton.getAttribute('aria-label')) || '',
    /不会改状态、写外部系统或执行预演脚本/,
    'focus retry should expose no mutation boundary',
  );
  assert.match(
    (await focusFailureShowAllButton.getAttribute('title')) || '',
    /只清空失败的深链目标、切到 All 并重新读取列表/,
    'focus failure show-all should expose route/filter recovery semantics',
  );
  await retryFocusButton.click();
  await focusReceipt.getByText('深链目标未确认').waitFor({ timeout: 10000 });
  await waitForCondition(
    () => missingDetailRequests.length === missingDetailRequestCount + 2,
    'retry should request the same missing target again without mutating status',
  );
  assert.equal(
    missingDetailRequests.length,
    missingDetailRequestCount + 2,
    'retry should request the same missing target again without mutating status',
  );

  await focusFailureShowAllButton.click();
  await page.getByText('Active launch prep').waitFor({ timeout: 10000 });
  await listScopeReceipt.getByText('All · 可见 80 条').waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('.filter-select').inputValue(),
    'all',
    'focus failure recovery should switch to all rehearsals',
  );
  assert.equal(
    await page.locator('.focus-failure-receipt').count(),
    0,
    'focus failure receipt should clear after the user switches to All',
  );
  assert.equal(
    page.url().includes(missingRehearsalId),
    false,
    'focus failure recovery should clear the stale rehearsalId route',
  );

  await page.locator('.filter-select').selectOption('candidate');
  const emptyFilterReceipt = page.getByLabel('空筛选回执');
  await emptyFilterReceipt.getByText('空筛选回执').waitFor({ timeout: 10000 });
  await emptyFilterReceipt.getByText('Candidate · 0 条').waitFor({ timeout: 10000 });
  await emptyFilterReceipt.getByText('成功读取空结果').waitFor({ timeout: 10000 });
  await emptyFilterReceipt
    .getByText('这只是当前筛选或搜索没有可见 Rehearsal')
    .waitFor({ timeout: 10000 });
  await emptyFilterReceipt
    .getByText('没有写入外部系统或执行预演脚本')
    .waitFor({ timeout: 10000 });
  await emptyFilterReceipt
    .getByText('查看 All 或刷新')
    .waitFor({ timeout: 10000 });
  const emptyShowAllButton = emptyFilterReceipt.getByRole('button', { name: /查看 All/ });
  const emptyRefreshButton = emptyFilterReceipt.getByRole('button', { name: /刷新/ });
  assert.match(
    (await emptyShowAllButton.getAttribute('title')) || '',
    /只清空当前筛选\/搜索并重新读取列表/,
    'empty-state show-all should expose range-only recovery semantics',
  );
  assert.match(
    (await emptyShowAllButton.getAttribute('aria-label')) || '',
    /不会恢复、激活、暂停、归档、标记反馈、保存触发线索/,
    'empty-state show-all should expose no mutation boundary',
  );
  assert.match(
    (await emptyRefreshButton.getAttribute('title')) || '',
    /只重新读取列表、详情和命中历史快照/,
    'empty-state refresh should reuse the read-only refresh boundary',
  );
  assert.equal(
    await page.getByLabel('场景预演详情').count(),
    0,
    'empty filters should not leave a stale detail panel selected',
  );
  assert.equal(
    listStatuses.includes('candidate'),
    true,
    'empty candidate filter should still issue a read request',
  );

  await searchInput.fill('missing rehearsal query');
  await searchInput.press('Enter');
  await emptyFilterReceipt
    .getByText('Candidate / 搜索 missing rehearsal query · 0 条')
    .waitFor({ timeout: 10000 });
  const clearSearchButton = emptyFilterReceipt.getByRole('button', { name: /清空搜索/ });
  assert.match(
    (await clearSearchButton.getAttribute('title')) || '',
    /只删除本页搜索草稿并按当前状态重新读取列表/,
    'empty-state clear-search should expose local-search recovery semantics',
  );
  assert.match(
    (await clearSearchButton.getAttribute('aria-label')) || '',
    /不会改 Rehearsal 状态、保存触发线索、写外部系统或执行预演脚本/,
    'empty-state clear-search should expose no mutation boundary',
  );
  await clearSearchButton.click();
  await emptyFilterReceipt.getByText('Candidate · 0 条').waitFor({ timeout: 10000 });

  await emptyShowAllButton.click();
  await page.getByText('Active launch prep').waitFor({ timeout: 10000 });
  await page.getByLabel('列表范围回执').getByText('All · 可见 80 条').waitFor({
    timeout: 10000,
  });
  assert.equal(
    await page.locator('.filter-select').inputValue(),
    'all',
    'empty filter recovery should switch to all rehearsals',
  );
  assert.equal(
    await page.locator('.empty-filter-receipt').count(),
    0,
    'empty filter receipt should clear after showing all rehearsals',
  );

  await page.locator('.filter-select').selectOption('paused');
  await detailPanel
    .getByRole('heading', { name: 'Paused handoff check' })
    .waitFor({ timeout: 10000 });
  const restoreButtons = detailPanel.getByRole('button', { name: /恢复/ });
  assert.equal(
    await restoreButtons.count(),
    1,
    'paused rehearsals should render one restore button, not duplicate restore/reactivate actions',
  );
  const restoreButton = restoreButtons.first();
  assert.match(
    (await restoreButton.getAttribute('title')) || '',
    /只恢复场景匹配资格/,
    'restore button should expose the pre-click matching-only boundary',
  );
  assert.match(
    (await restoreButton.getAttribute('aria-label')) || '',
    /不会发送消息、创建任务或执行脚本/,
    'restore button should expose the no-send/no-task/no-execution boundary',
  );

  console.log('verify-rehearsals-page-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
