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
const missingDetailRequests = [];
const missingRehearsalId = 'missing-rehearsal';

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
      listStatuses.push(status);
      const items = status === 'all'
        ? [staleRehearsal, activeRehearsal, weakCueRehearsal, cueLessRehearsal]
        : status === 'active'
          ? [activeRehearsal, weakCueRehearsal, cueLessRehearsal]
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
      if (request.method() === 'PATCH') {
        const payload = request.postDataJSON();
        pauseRequests.push(payload);
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

    if (pathname.endsWith(`/rehearsals/${cueLessRehearsal.id}`)) {
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
  await listScopeReceipt.getByText('Active · 4 条').waitFor({ timeout: 10000 });
  await listScopeReceipt.getByText('1 条仅审计').waitFor({ timeout: 10000 });
  await listScopeReceipt.getByText('1 条需补锚点').waitFor({ timeout: 10000 });
  await listScopeReceipt
    .getByText('Stale · 临时置顶')
    .waitFor({ timeout: 10000 });
  await listScopeReceipt
    .getByText('当前按「Active」读取列表')
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
    .getByText('不会激活、暂停、归档、标记反馈、写入外部系统或执行预演脚本')
    .waitFor({ timeout: 10000 });

  const firstCardText = await page.locator('.rehearsal-card').first().innerText();
  assert.ok(
    firstCardText.includes('Stale Colin follow-up'),
    'deep-linked rehearsal outside the active filter should be pinned first',
  );
  const staleListReadiness = page
    .locator('.rehearsal-card')
    .filter({ hasText: 'Stale Colin follow-up' })
    .locator('.card-readiness');
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

  await page.getByRole('button', { name: '查看全部' }).click();
  await page.getByText('Active launch prep').waitFor({ timeout: 10000 });
  await listScopeReceipt.getByText('All · 4 条').waitFor({ timeout: 10000 });
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
  assert.deepEqual(listStatuses.slice(0, 2), ['active', 'all']);

  await page.getByRole('button', { name: /Active launch prep/ }).click();
  await detailPanel
    .getByRole('heading', { name: 'Active launch prep' })
    .waitFor({ timeout: 10000 });
  await listScopeReceipt.getByText('All · 4 条').waitFor({ timeout: 10000 });
  const activeListReadiness = page
    .locator('.rehearsal-card')
    .filter({ hasText: 'Active launch prep' })
    .locator('.card-readiness');
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
  await detailPanel.getByRole('button', { name: '暂停' }).click();
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

  await page.getByRole('button', { name: /Legacy script without cue/ }).click();
  await detailPanel
    .getByRole('heading', { name: 'Legacy script without cue' })
    .waitFor({ timeout: 10000 });
  const cueLessListReadiness = page
    .locator('.rehearsal-card')
    .filter({ hasText: 'Legacy script without cue' })
    .locator('.card-readiness');
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
  await page.getByRole('button', { name: /Broad handoff keyword reminder/ }).click();
  await detailPanel
    .getByRole('heading', { name: 'Broad handoff keyword reminder' })
    .waitFor({ timeout: 10000 });
  const weakCueListReadiness = page
    .locator('.rehearsal-card')
    .filter({ hasText: 'Broad handoff keyword reminder' })
    .locator('.card-readiness');
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
  await listScopeReceipt.getByText('Stale · 1 条').waitFor({ timeout: 10000 });
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

  await detailPanel.getByRole('button', { name: '重新激活' }).click();
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
  await listScopeReceipt.getByText('Stale · 2 条').waitFor({ timeout: 10000 });
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
  assert.deepEqual(listStatuses.slice(0, 3), ['active', 'all', 'stale']);

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
  await listScopeReceipt.getByText('Stale · 1 条').waitFor({ timeout: 10000 });
  assert.equal(
    missingDetailRequests.length,
    missingDetailRequestCount + 1,
    'missing deep-link target should be fetched directly before falling back to the list',
  );

  await focusReceipt.getByRole('button', { name: '重试目标' }).click();
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

  await focusReceipt.getByRole('button', { name: '查看 All' }).click();
  await page.getByText('Active launch prep').waitFor({ timeout: 10000 });
  await listScopeReceipt.getByText('All · 4 条').waitFor({ timeout: 10000 });
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

  await emptyFilterReceipt.getByRole('button', { name: '查看 All' }).click();
  await page.getByText('Active launch prep').waitFor({ timeout: 10000 });
  await page.getByLabel('列表范围回执').getByText('All · 4 条').waitFor({
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

  console.log('verify-rehearsals-page-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
