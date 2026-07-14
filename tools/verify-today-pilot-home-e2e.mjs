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
    contextPack: {
      preview: 'Mission: rehearse concise answer',
      attention: {
        delivery: 'board',
        reason: 'Visible in Day Pilot without a push interruption.',
      },
      rehearsalCueReceipt: {
        label: '今日预演提示',
        cueLabel: '人物 Sophia · 项目 AI Tools · 会议 CoP AI 工具分享',
        cueDetail: '命中人物1、项目1、会议1 组线索',
        statusLabel: 'Active 预演，今天适合提前复习',
        script: '遇到质疑时先复述对方问题，再给出边界。',
        boundary: '只作为今日准备提醒，不会自动发言、发消息或执行外部动作。',
        tone: 'info',
      },
    },
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
    contextPack: {
      preview: 'Mission: approve OpenClaw retry',
      attention: {
        delivery: 'interrupt',
        reason: 'High-priority now card can consume one interruption slot.',
      },
    },
    createdAt: now,
    updatedAt: now,
  };
}

function contextPackCard() {
  return {
    id: 'card-context-pack',
    missionId: 'mission-context-pack',
    sourceHash: 'context-pack',
    cardType: 'memory_quality',
    title: '整理 Webpage-MCP 链接检查说明',
    priority: 'medium',
    state: 'prepare',
    score: 76,
    dueAt: now + 7200,
    whyNow:
      '两条近期记忆都指向链接检查优先使用 webpage-mcp。 https://example.test/skills/capdev-monthly-data%40v0.1?token=this-is-an-intentionally-long-unbroken-popup-width-regression-fixture',
    nextBestAction: '复制上下文包给 Codex，整理团队可复用说明。',
    people: [{ name: 'Fred Gu' }],
    projects: [{ name: 'Personal AI' }],
    evidenceRefs: [
      {
        sourceKind: 'message',
        sourceId: 'msg-context-pack-1',
        title: 'Webpage-MCP 链接检查',
        snippet: '链接检查需要优先用 webpage-mcp，并说明验证步骤。',
        timestamp: now - 900,
        sourceUrl: 'https://internal.example/context-pack?token=secret',
      },
    ],
    openQuestions: ['是否需要把 Chrome 插件和 webpage-mcp 的边界写清楚？'],
    trust: {
      confidence: 0.83,
      riskLevel: 'medium',
      staleEvidenceCount: 0,
      sensitiveEvidenceCount: 1,
    },
    contextPack: {
      preview: 'Mission: document webpage-mcp link checks',
      attention: {
        delivery: 'board',
        reason: 'Visible in Day Pilot without a push interruption.',
      },
    },
    createdAt: now,
    updatedAt: now,
  };
}

function overflowMessageCard(id, title) {
  return {
    id,
    missionId: `mission-${id}`,
    sourceHash: id,
    cardType: 'memory_quality',
    title,
    priority: 'medium',
    state: 'prepare',
    score: 72,
    dueAt: now + 5400,
    whyNow: '近期消息仍在同一个今日工作窗口内。',
    nextBestAction: '打开 Today Pilot 首页查看完整证据后再处理。',
    people: [{ name: 'Esone' }],
    projects: [{ name: 'Personal AI' }],
    evidenceRefs: [
      {
        sourceKind: 'message',
        sourceId: `msg-${id}`,
        title,
        snippet: '这条 mission 用来验证 popup Top 3 之外仍有完整入口。',
        timestamp: now - 1200,
      },
    ],
    openQuestions: [],
    trust: {
      confidence: 0.77,
      riskLevel: 'low',
      staleEvidenceCount: 0,
      sensitiveEvidenceCount: 0,
    },
    contextPack: {
      preview: `Mission: ${title}`,
      attention: {
        delivery: 'board',
        reason: 'Visible in Day Pilot without a push interruption.',
      },
    },
    createdAt: now,
    updatedAt: now,
  };
}

const hiddenRehearsal = rehearsalCard();
const visibleDecision = decisionCard();
const copyableContextCard = contextPackCard();
const overflowVisibleCard = overflowMessageCard(
  'card-popup-overflow-visible',
  '复核 Today Pilot popup 隐藏入口',
);
const overflowHiddenCard = overflowMessageCard(
  'card-popup-overflow-hidden',
  '补齐本周状态快照',
);
let currentCatchUpBrief = {
  sinceTs: now - 90 * 60,
  nowTs: now,
  total: 3,
  highPriority: [
    {
      messageId: 'catch-up-high-1',
      source: 'ringcentral',
      title: '客户导出需求变更',
      preview: '客户改了导出需求，需要今天确认 owner 和回归窗口。',
      timestamp: now - 2400,
      importance: 0.91,
      salience: 0.52,
      waiting: false,
    },
    {
      messageId: 'catch-up-waiting-1',
      source: 'ringcentral',
      title: 'Harpreet 等你确认 MTR-148115',
      preview: '@你 MTR-148115 的 estimate 能今天回我吗？',
      timestamp: now - 1200,
      importance: 0.82,
      salience: 0.48,
      waiting: true,
    },
  ],
  waiting: [
    {
      messageId: 'catch-up-waiting-1',
      source: 'ringcentral',
      title: 'Harpreet 等你确认 MTR-148115',
      preview: '@你 MTR-148115 的 estimate 能今天回我吗？',
      timestamp: now - 1200,
      importance: 0.82,
      salience: 0.48,
      waiting: true,
    },
    {
      messageId: 'catch-up-waiting-2',
      source: 'ringcentral',
      title: 'Maya 等你确认回归窗口',
      preview: '@你 regression window 今天能不能先给一个范围？',
      timestamp: now - 900,
      importance: 0.72,
      salience: 0.41,
      waiting: true,
    },
  ],
};
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
let failStatsRequest = true;
const ambientTraceRequests = [];
let delayFeedbackCardId = null;
let releaseDelayedFeedback = null;

async function waitForDelayedFeedbackHook() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (releaseDelayedFeedback) return releaseDelayedFeedback;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Delayed Today Pilot feedback request was not observed');
}

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error instanceof Error ? error.message : String(error));
  });
  return () => {
    assert.deepEqual(errors, [], `Today Pilot page errors: ${errors.join('; ')}`);
  };
}

async function assertPopupLayoutWidth(page) {
  const layout = await page.evaluate(() => {
    const bodyRect = document.body.getBoundingClientRect();
    const root = document.getElementById('popup-root');
    const container = document.querySelector('.popup-container');
    const todayPilotPanel = document.querySelector('.today-pilot-panel');
    const overflowingElement =
      Array.from(document.querySelectorAll('.popup-container *'))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            className: String(element.className || ''),
            left: rect.left,
            right: rect.right,
            width: rect.width,
            text: (element.textContent || '').replace(/\s+/g, ' ').slice(0, 80),
          };
        })
        .find(
          (item) =>
            item.width > 0 &&
            (item.left < bodyRect.left - 0.5 || item.right > bodyRect.right + 0.5),
        ) || null;

    return {
      htmlOffsetWidth: document.documentElement.offsetWidth,
      htmlRectWidth: document.documentElement.getBoundingClientRect().width,
      bodyOffsetWidth: document.body.offsetWidth,
      bodyScrollWidth: document.body.scrollWidth,
      rootWidth: root?.getBoundingClientRect().width || 0,
      containerWidth: container?.getBoundingClientRect().width || 0,
      todayPilotPanelWidth: todayPilotPanel?.getBoundingClientRect().width || 0,
      overflowingElement,
    };
  });

  assert.ok(
    layout.htmlOffsetWidth <= 328,
    `popup html width should stay bounded, got ${layout.htmlOffsetWidth}`,
  );
  assert.ok(
    layout.htmlRectWidth <= 328,
    `popup html box should stay bounded, got ${layout.htmlRectWidth}`,
  );
  assert.ok(
    layout.bodyOffsetWidth <= 320,
    `popup body width should stay bounded, got ${layout.bodyOffsetWidth}`,
  );
  assert.ok(
    layout.bodyScrollWidth <= 320,
    `popup body scroll width should stay bounded, got ${layout.bodyScrollWidth}`,
  );
  assert.ok(
    layout.rootWidth <= 300,
    `popup root width should stay inside the body content box, got ${layout.rootWidth}`,
  );
  assert.ok(
    layout.containerWidth <= 300,
    `popup container width should stay inside the body content box, got ${layout.containerWidth}`,
  );
  assert.ok(
    layout.todayPilotPanelWidth <= 300,
    `Today Pilot panel should stay inside the popup content box, got ${layout.todayPilotPanelWidth}`,
  );
  assert.equal(
    layout.overflowingElement,
    null,
    `popup content should not overflow horizontally: ${JSON.stringify(
      layout.overflowingElement,
    )}`,
  );
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
    if (pathname.endsWith('/today-pilot/catch-up')) {
      await route.fulfill(jsonResponse(currentCatchUpBrief));
      return;
    }
    const feedbackMatch = pathname.match(
      /\/today-pilot\/cards\/([^/]+)\/feedback$/,
    );
    if (feedbackMatch) {
      const cardId = decodeURIComponent(feedbackMatch[1]);
      if (delayFeedbackCardId === cardId) {
        await new Promise((resolve) => {
          releaseDelayedFeedback = resolve;
        });
        releaseDelayedFeedback = null;
        delayFeedbackCardId = null;
      }
      currentBrief = {
        ...currentBrief,
        attentionBudget: {
          ...currentBrief.attentionBudget,
          plannedInterruptions: currentBrief.attentionBudget.plannedInterruptions.filter(
            (item) => item.cardId !== cardId,
          ),
          boardOnlyCardIds: currentBrief.attentionBudget.boardOnlyCardIds.filter(
            (item) => item !== cardId,
          ),
        },
        cards: currentBrief.cards.filter((card) => card.id !== cardId),
      };
      await route.fulfill(jsonResponse({ brief: currentBrief }));
      return;
    }
    if (pathname.endsWith('/context-pack')) {
      const payload = request.postDataJSON();
      const targetProvider = payload?.targetProvider || 'codex';
      if (targetProvider === 'claude') {
        await route.fulfill(
          jsonResponse(
            {
              error: 'Simulated context pack renderer outage',
            },
            503,
          ),
        );
        return;
      }
      const style =
        targetProvider === 'codex'
          ? 'implementation'
          : targetProvider === 'doubao'
          ? 'chinese'
          : 'plain';
      await route.fulfill(
        jsonResponse({
          missionId: copyableContextCard.missionId,
          generatedAt: now,
          tokenBudget: payload?.tokenBudget || 1600,
          maxChars: 6400,
          targetProvider,
          providerProfile: {
            id: targetProvider,
            label:
              targetProvider === 'codex'
                ? 'Codex implementation brief'
                : 'Generic context pack',
            defaultTokenBudget: 1600,
            style,
          },
          usageIntent: {
            kind: 'external_ai_context',
            boundary: 'context_only_not_execution',
            defaultSensitiveHandling: 'redacted_by_default',
          },
          sourceSummary: {
            evidenceCount: copyableContextCard.evidenceRefs.length,
            renderedEvidenceCount: copyableContextCard.evidenceRefs.length,
            omittedEvidenceCount: 0,
            sourceKinds: { message: 1 },
            redactionApplied: true,
            truncated: false,
          },
          bodyMd: [
            '# Codex Brief: 整理 Webpage-MCP 链接检查说明',
            '',
            '## Handoff Boundary',
            '- This pack gives the target AI context to read; it is not permission to execute external actions.',
            '',
            '## Evidence',
            '- Webpage-MCP 链接检查: 链接检查需要优先用 webpage-mcp。',
          ].join('\n'),
          evidenceRefs: copyableContextCard.evidenceRefs.map((ref) => ({
            ...ref,
            sourceUrl: undefined,
          })),
          warnings: [
            'Sensitive or direct source fields were redacted by default; use includeSensitive only after review.',
          ],
          redactionPreview: [
            'Webpage-MCP 链接检查:msg-context-pack-1 source URL omitted',
          ],
          redactionApplied: true,
          truncated: false,
        }),
      );
      return;
    }
    if (pathname.endsWith('/ambient-calibration/traces')) {
      ambientTraceRequests.push(request.postDataJSON());
      await route.fulfill(
        jsonResponse({
          status: 'ok',
          traceId: `trace-${ambientTraceRequests.length}`,
          stored: true,
        }),
      );
      return;
    }
    if (pathname.endsWith('/stats')) {
      if (failStatsRequest) {
        await route.fulfill(
          jsonResponse(
            {
              error: 'fixture unavailable',
              code: 'SQLITE_CORRUPT',
              message: 'database disk image is malformed',
            },
            500,
          ),
        );
        return;
      }
      await route.fulfill(jsonResponse(apiFallback(url)));
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
  await page.getByText('记忆统计暂不可用').waitFor({ timeout: 15000 });
  const homeRefreshButton = page.locator('.refresh-btn');
  assert.match(
    (await homeRefreshButton.getAttribute('title')) || '',
    /刷新 Today Pilot 快照/,
    'homepage refresh button should expose the Today Pilot snapshot refresh scope before click',
  );
  assert.match(
    (await homeRefreshButton.getAttribute('aria-label')) || '',
    /不会标记消息已读、完成来源任务、写入反馈、发送消息、审批或执行外部动作/,
    'homepage refresh button should expose the no-source-side-effect boundary to assistive tech',
  );
  await page.getByRole('button', { name: '重试生成' }).waitFor({
    timeout: 15000,
  });
  await assert.rejects(
    page.getByText('记忆统计加载中').waitFor({ timeout: 600 }),
  );
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
  failStatsRequest = false;
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
      messages: { scanned: 1, totalRecent: 3, selected: 0 },
      calendar: { scanned: 0, upcoming: 0 },
      notifications: { scanned: 0, pending: 0 },
      actions: { scanned: 1, queued: 1, selected: 1 },
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
    .locator('.card-ranking-receipt', { hasText: '计划打断' })
    .waitFor({ timeout: 15000 });
  await decisionMission
    .locator('.card-ranking-receipt', {
      hasText: '不会自动批准、发送、执行或改写外部系统',
    })
    .waitFor({ timeout: 15000 });
  await decisionMission
    .getByText('OpenClaw 外部执行')
    .waitFor({ timeout: 15000 });
  await decisionMission
    .getByText('真正的外部执行只会由 OpenClaw 接管')
    .waitFor({ timeout: 15000 });
  await decisionMission
    .getByRole('button', { name: '打开动作队列' })
    .waitFor({ timeout: 15000 });
  const openClawRemoveButton = decisionMission.locator('button.card-action.primary', {
    hasText: '从首页移除',
  });
  await decisionMission
    .locator('.mission-action-scope-receipt', {
      hasText: '从首页移除、稍后 6h 或不再提醒同类会等待 Memory Service 写入展示/排序反馈',
    })
    .waitFor({ timeout: 15000 });
  await decisionMission
    .locator('.mission-action-scope-receipt', {
      hasText: '不会批准、拒绝、重试或执行 OpenClaw',
    })
    .waitFor({ timeout: 15000 });
  await decisionMission
    .locator('.mission-action-scope-receipt', {
      hasText: '打开详情只导航到处理页',
    })
    .waitFor({ timeout: 15000 });
  await openClawRemoveButton.waitFor({ timeout: 15000 });
  assert.match(
    (await openClawRemoveButton.getAttribute('title')) || '',
    /从首页移除：只写 Today Pilot 展示反馈；不会批准、拒绝、重试或执行 OpenClaw/,
  );
  assert.match(
    (await openClawRemoveButton.getAttribute('aria-label')) || '',
    /不会完成动作队列或决策中心事项/,
  );
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
  await page.locator('.ranking-chip', { hasText: '2/4' }).waitFor({
    timeout: 15000,
  });
  await page
    .locator('.ranking-chip', { hasText: '1 条候选未入选首页' })
    .waitFor({
      timeout: 15000,
    });
  await page
    .locator('.ranking-chip', {
      hasText: '2 条前置降噪信号 · 消息 2',
    })
    .waitFor({
      timeout: 15000,
    });
  await page.locator('.ranking-chip', { hasText: '1/3' }).waitFor({
    timeout: 15000,
  });
  await page
    .locator('.ranking-note', {
      hasText: '首页快照基准：读取已有 brief',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.ranking-note', {
      hasText: '不会重新扫描来源、写反馈、发送消息或执行动作',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.source-breakdown-receipt', {
      hasText: '来源分布',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.source-breakdown-receipt', {
      hasText: '当前 brief 展开 2/2 个有信号来源桶',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.source-breakdown-receipt', {
      hasText: '这里只解释当前可见 brief，不会重新排序、展开隐藏内容、写反馈、标记提醒、发送消息或执行动作',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.source-breakdown-item', {
      hasText: '动作',
    })
    .getByText('原始 1 · 候选 1 · 当前可见入选 1')
    .waitFor({ timeout: 15000 });
  await page
    .locator('.source-breakdown-item', {
      hasText: '消息',
    })
    .getByText(
      '原始 3 · 候选 1 · 当前可见入选 0 · 未进入当前可见 1 · 前置降噪 2',
    )
    .waitFor({ timeout: 15000 });
  await page
    .locator('.catch-up-receipt', {
      hasText: '3 条新信号，高优 2 条，等你回 2 条',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.catch-up-receipt', {
      hasText: '其中 1 条等你回已在高优变化展示',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.catch-up-receipt', {
      hasText: '不会标已读、代回复、改排序或写回来源系统',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.catch-up-item', { hasText: '客户导出需求变更' })
    .waitFor({ timeout: 15000 });
  const highCatchUpItem = page.locator('.catch-up-item', {
    hasText: '客户导出需求变更',
  });
  assert.match(
    (await highCatchUpItem.getAttribute('title')) || '',
    /打开补课来源复核/,
    'high-priority catch-up item should expose the review handoff boundary',
  );
  assert.match(
    (await highCatchUpItem.getAttribute('aria-label')) || '',
    /点击只打开记忆搜索，不会标已读、代回复、完成任务、改排序或写回来源系统/,
    'high-priority catch-up item should expose the no-side-effect boundary to assistive tech',
  );
  await page
    .locator('.catch-up-item', { hasText: 'Harpreet 等你确认 MTR-148115' })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.catch-up-column-note', {
      hasText: '1 条等你回已在高优变化展示',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.catch-up-item.waiting', { hasText: 'Maya 等你确认回归窗口' })
    .waitFor({ timeout: 15000 });
  const waitingCatchUpItem = page.locator('.catch-up-item.waiting', {
    hasText: 'Maya 等你确认回归窗口',
  });
  assert.match(
    (await waitingCatchUpItem.getAttribute('aria-label')) || '',
    /这条含等待回复信号，但仍需你复核来源后再处理/,
    'waiting catch-up item should not imply an automatic reply',
  );
  assert.equal(
    await page
      .locator('.catch-up-item.waiting', {
        hasText: 'Harpreet 等你确认 MTR-148115',
      })
      .count(),
    0,
    'overlapping catch-up item should not be duplicated in the waiting column',
  );
  await assert.rejects(
    page.locator('.ranking-chip', { hasText: '2/3' }).waitFor({
      timeout: 600,
    }),
  );
  delayFeedbackCardId = visibleDecision.id;
  await openClawRemoveButton.click();
  await page
    .locator('.mission-feedback-receipt', {
      hasText: '正在提交反馈：移出首页',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.mission-feedback-receipt', {
      hasText: '尚未写入 Today Pilot 展示/排序反馈',
    })
    .waitFor({ timeout: 15000 });
  await decisionMission.waitFor({ timeout: 15000 });
  await decisionMission
    .locator('.mission-pending-note', {
      hasText: '等待 Memory Service 确认',
    })
    .waitFor({ timeout: 15000 });
  assert.equal(
    await openClawRemoveButton.isDisabled(),
    true,
    'feedback button should stay disabled while Memory Service has not confirmed',
  );
  const releaseFeedback = await waitForDelayedFeedbackHook();
  releaseFeedback();
  await page
    .locator('.mission-feedback-receipt', { hasText: 'Mission 反馈回执' })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.mission-feedback-receipt', {
      hasText: '只记录 Today Pilot 的完成反馈',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.mission-feedback-receipt', {
      hasText: '不会把来源任务、动作队列、决策、消息或外部系统标记为已完成',
    })
    .waitFor({ timeout: 15000 });
  await page.getByText('今天有 0 件事值得关注').waitFor({
    timeout: 15000,
  });
  await page
    .locator('.ranking-chip', { hasText: '0 条证据进入当前可见 mission' })
    .waitFor({
      timeout: 15000,
    });
  await page
    .locator('.ranking-chip', {
      hasText: '2 条候选未入选首页',
    })
    .waitFor({
      timeout: 15000,
    });
  await page
    .locator('.ranking-chip', {
      hasText: '2 条前置降噪信号 · 消息 2',
    })
    .waitFor({
      timeout: 15000,
    });
  await page
    .locator('.source-breakdown-item', {
      hasText: '动作',
    })
    .getByText(
      '原始 1 · 候选 1 · 当前可见入选 0 · 本页已隐藏入选 1 · 未进入当前可见 1',
    )
    .waitFor({ timeout: 15000 });
  await page
    .locator('.source-breakdown-item', {
      hasText: '消息',
    })
    .getByText(
      '原始 3 · 候选 1 · 当前可见入选 0 · 未进入当前可见 1 · 前置降噪 2',
    )
    .waitFor({ timeout: 15000 });
  await page
    .locator('.source-breakdown-receipt', {
      hasText: '1 个来源有 1 条本页已隐藏入选证据',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.source-breakdown-receipt', {
      hasText: '不代表来源任务完成、证据删除或外部系统已同步',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.ranking-note', {
      hasText: '当前是反馈后的可见快照',
    })
    .waitFor({
      timeout: 15000,
    });
  await page
    .locator('.ranking-note', {
      hasText: '不代表来源任务完成、消息已读、排程变更或外部系统已同步',
    })
    .waitFor({
      timeout: 15000,
    });
  assert.equal(await page.locator('.budget-count').innerText(), '0 / 3');

  await worker.evaluate(async () => {
    const { envConfig = {} } = await chrome.storage.local.get('envConfig');
    await chrome.storage.local.set({
      envConfig: {
        ...envConfig,
        SCENE_REHEARSAL_DISPLAY_ENABLED: true,
      },
    });
  });
  currentBrief = baseBrief({
    id: 'brief-visible-rehearsal-receipt',
    attentionBudget: {
      maxInterruptions: 3,
      usedInterruptions: 0,
      plannedInterruptions: [],
      boardOnlyCardIds: [hiddenRehearsal.id],
      quietWindows: [],
    },
    sourceStats: {
      messages: { scanned: 0, totalRecent: 0 },
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
  await page.reload({ waitUntil: 'domcontentloaded' });
  const rehearsalMission = page.locator('.mission-card', {
    hasText: '会前使用少讲结论的预演脚本',
  });
  await rehearsalMission.waitFor({ timeout: 15000 });
  await rehearsalMission.locator('.mission-head').click();
  await rehearsalMission
    .locator('.sub-title', { hasText: '预演回执' })
    .waitFor({ timeout: 15000 });
  await rehearsalMission
    .locator('.rehearsal-receipt', { hasText: '人物 Sophia' })
    .waitFor({ timeout: 15000 });
  await rehearsalMission
    .locator('.rehearsal-receipt', {
      hasText: '遇到质疑时先复述对方问题',
    })
    .waitFor({ timeout: 15000 });
  await rehearsalMission
    .locator('.rehearsal-receipt', {
      hasText: '不会自动发言、发消息或执行外部动作',
    })
    .waitFor({ timeout: 15000 });
  await rehearsalMission
    .locator('.card-ranking-receipt', { hasText: '首页展示' })
    .waitFor({ timeout: 15000 });
  await rehearsalMission
    .locator('.card-ranking-receipt', {
      hasText: '完成、稍后、静默或外部处理都需要用户明确点击',
    })
    .waitFor({ timeout: 15000 });

  currentBrief = baseBrief({
    id: 'brief-copyable-context-pack',
    attentionBudget: {
      maxInterruptions: 3,
      usedInterruptions: 0,
      plannedInterruptions: [],
      boardOnlyCardIds: [copyableContextCard.id],
      quietWindows: [],
    },
    sourceStats: {
      messages: { scanned: 1, totalRecent: 3 },
      calendar: { scanned: 0, upcoming: 0 },
      notifications: { scanned: 0, pending: 0 },
      actions: { scanned: 0, queued: 0 },
      reflections: { scanned: 0, active: 0 },
      rehearsals: { scanned: 0, active: 0 },
      skills: { scanned: 0, suggestions: 0 },
      relationships: { scanned: 0, highFrequencyPeople: 0 },
    },
    cards: [copyableContextCard],
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.__todayPilotCopiedText = value;
        },
      },
    });
  });
  const copyableMission = page.locator('.mission-card', {
    hasText: '整理 Webpage-MCP 链接检查说明',
  });
  await copyableMission.waitFor({ timeout: 15000 });
  await copyableMission.locator('.mission-head').click();
  await copyableMission
    .locator('.card-ranking-receipt', { hasText: '首页展示' })
    .waitFor({ timeout: 15000 });
  await copyableMission
    .locator('.card-ranking-receipt', { hasText: '中隐私风险' })
    .waitFor({ timeout: 15000 });
  await copyableMission
    .locator('.mission-action-scope-receipt', {
      hasText: '完成、稍后 6h 或不再提醒同类会等待 Memory Service 写入展示/排序反馈',
    })
    .waitFor({ timeout: 15000 });
  await copyableMission
    .locator('.mission-action-scope-receipt', {
      hasText: '不会完成来源任务、标记消息已读、改日历/排程、删除证据、发送或执行外部动作',
    })
    .waitFor({ timeout: 15000 });
  await copyableMission
    .locator('.mission-action-scope-receipt', {
      hasText: '复制上下文包只写本机剪贴板，打开详情只导航',
    })
    .waitFor({ timeout: 15000 });
  const doneButton = copyableMission.locator('button.card-action.primary', {
    hasText: '完成',
  });
  const laterButton = copyableMission.locator('button.card-action.secondary', {
    hasText: '稍后 6h',
  });
  const usefulButton = copyableMission.locator('button.card-action.secondary', {
    hasText: '有用',
  });
  const wrongButton = copyableMission.locator('button.card-action.ghost', {
    hasText: '不准确',
  });
  const copyButton = copyableMission.locator('button.card-action.secondary', {
    hasText: '复制上下文包',
  });
  const detailButton = copyableMission.locator('button.card-action.ghost', {
    hasText: '打开详情',
  });
  const muteButton = copyableMission.locator('button.card-action.ghost', {
    hasText: '不再提醒同类',
  });
  assert.match(
    (await doneButton.getAttribute('aria-label')) || '',
    /完成：只写 Today Pilot 展示反馈并从今日首页隐藏；不会完成来源任务/,
  );
  assert.match(
    (await laterButton.getAttribute('title')) || '',
    /稍后 6h：只让 Today Pilot 在 6 小时内不展示这张 mission；不会修改来源排程/,
  );
  assert.match(
    (await usefulButton.getAttribute('aria-label')) || '',
    /有用：只记录 Today Pilot 排序学习信号；不会批准、发送、执行/,
  );
  assert.match(
    (await wrongButton.getAttribute('title')) || '',
    /不准确：只记录 Today Pilot 去噪反馈；不会删除原始证据/,
  );
  assert.match(
    (await copyButton.getAttribute('aria-label')) || '',
    /复制上下文包：只生成\/复制这张 mission 的上下文到本机剪贴板；不会发送给外部 AI/,
  );
  assert.match(
    (await detailButton.getAttribute('title')) || '',
    /打开详情：只导航到来源或处理页；不会写反馈、完成任务/,
  );
  assert.match(
    (await muteButton.getAttribute('aria-label')) || '',
    /不再提醒同类：只让同类 Today Pilot source hash 后续降噪或隐藏；不会删除原始记忆/,
  );
  await copyableMission
    .locator('.context-preflight-receipt', {
      hasText:
        '当前目标 Codex；生成只读取这张 mission 的 1 条证据，默认脱敏',
    })
    .waitFor({ timeout: 15000 });
  await copyableMission
    .locator('.context-preflight-receipt', {
      hasText: '不会发送给外部 AI、批准/执行或写回来源系统',
    })
    .waitFor({ timeout: 15000 });
  await copyButton.click();
  await page
    .getByText('已复制 Codex 上下文包（复制正文 1/1 条证据，已脱敏）。')
    .waitFor({ timeout: 15000 });
  await page.waitForFunction(
    () =>
      window.__todayPilotCopiedText?.includes('Handoff Boundary') &&
      window.__todayPilotCopiedText?.includes(
        'not permission to execute external actions',
      ),
    null,
    { timeout: 15000 },
  );
  assert.equal(ambientTraceRequests.length, 1);
  assert.equal(ambientTraceRequests[0].surface, 'today_pilot');
  assert.equal(ambientTraceRequests[0].action, 'copied_context');
  assert.equal(ambientTraceRequests[0].privacyClass, 'sensitive_redacted');
  assert.equal(ambientTraceRequests[0].redactedDiff.rawTextStored, false);
  assert.equal(
    ambientTraceRequests[0].metadata.contextBoundary,
    'context_only_not_execution',
  );
  assert.ok(
    !JSON.stringify(ambientTraceRequests[0]).includes(
      'This pack gives the target AI context',
    ),
    'ambient trace should not store raw context pack body',
  );

  await copyableMission
    .getByRole('button', { name: '生成上下文包', exact: true })
    .click();
  await copyableMission
    .locator('.context-pack pre', { hasText: 'Codex Brief' })
    .waitFor({ timeout: 15000 });
  await copyableMission.getByRole('button', { name: 'Claude' }).click();
  await copyableMission
    .locator('.context-status-failed', {
      hasText: '当前没有可复制的 Claude 正文',
    })
    .waitFor({ timeout: 15000 });
  const failedContextPanelText = await copyableMission
    .locator('.context-pack')
    .innerText();
  assert.ok(
    !failedContextPanelText.includes('Mission: document webpage-mcp link checks'),
    'failed context pack state should not render the card preview as generated body',
  );
  assert.ok(
    !failedContextPanelText.includes('Codex Brief'),
    'failed context pack state should not keep showing the previous provider body',
  );

  currentBrief = baseBrief({
    id: 'brief-popup-overflow-handoff',
    attentionBudget: {
      maxInterruptions: 3,
      usedInterruptions: 1,
      plannedInterruptions: [
        { cardId: visibleDecision.id, reason: 'high priority decision' },
      ],
      boardOnlyCardIds: [],
      quietWindows: [],
    },
    sourceStats: {
      messages: { scanned: 3, totalRecent: 5 },
      calendar: { scanned: 0, upcoming: 0 },
      notifications: { scanned: 0, pending: 0 },
      actions: { scanned: 1, queued: 1 },
      reflections: { scanned: 0, active: 0 },
      rehearsals: { scanned: 0, active: 0 },
      skills: { scanned: 0, suggestions: 0 },
      relationships: { scanned: 0, highFrequencyPeople: 0 },
    },
    cards: [
      visibleDecision,
      copyableContextCard,
      overflowVisibleCard,
      overflowHiddenCard,
    ],
  });

  const overflowPopupPage = await context.newPage();
  await overflowPopupPage.goto(`chrome-extension://${extensionId}/popup.html`, {
    waitUntil: 'domcontentloaded',
  });
  await overflowPopupPage
    .locator('.today-pilot-scope-receipt', {
      hasText: '筛选口径：显示 3/4 张 mission · 扫描 6 条信号',
    })
    .waitFor({ timeout: 15000 });
  await overflowPopupPage
    .locator('.today-pilot-scope-receipt', {
      hasText: '另有 1 张需进首页查看',
    })
    .waitFor({ timeout: 15000 });
  await overflowPopupPage
    .locator('.today-pilot-scope-handoff', {
      hasText: '查看全部 4',
    })
    .waitFor({ timeout: 15000 });
  await overflowPopupPage
    .locator('.today-pilot-scope-handoff', {
      hasText:
        'Top 3 之外还有 1 张 mission；打开 Today Pilot 首页只查看完整可见 brief，不会刷新、写反馈、发送消息或执行动作。',
    })
    .waitFor({ timeout: 15000 });
  await assertPopupLayoutWidth(overflowPopupPage);
  await overflowPopupPage
    .locator('.today-pilot-card', { hasText: '补齐本周状态快照' })
    .waitFor({ state: 'detached', timeout: 15000 });
  const fullBriefPagePromise = context.waitForEvent('page');
  await overflowPopupPage.getByRole('button', { name: '查看全部 4' }).click();
  const fullBriefPage = await fullBriefPagePromise;
  await fullBriefPage.waitForURL(/memory-exploring\.html#\//, {
    timeout: 15000,
  });
  assert.ok(
    fullBriefPage.url().includes('memory-exploring.html#/'),
    `overflow handoff should open Today Pilot home, got ${fullBriefPage.url()}`,
  );
  await fullBriefPage.close();
  await overflowPopupPage.close();

  currentBrief = baseBrief({
    id: 'brief-popup-external-execution',
    attentionBudget: {
      maxInterruptions: 3,
      usedInterruptions: 1,
      plannedInterruptions: [
        { cardId: visibleDecision.id, reason: 'high priority decision' },
      ],
      boardOnlyCardIds: [],
      quietWindows: [],
    },
    sourceStats: {
      messages: { scanned: 1, totalRecent: 3 },
      calendar: { scanned: 0, upcoming: 0 },
      notifications: { scanned: 0, pending: 0 },
      actions: { scanned: 1, queued: 1 },
      reflections: { scanned: 0, active: 0 },
      rehearsals: { scanned: 0, active: 0 },
      skills: { scanned: 0, suggestions: 0 },
      relationships: { scanned: 0, highFrequencyPeople: 0 },
    },
    cards: [visibleDecision],
  });

  const popupPage = await context.newPage();
  const assertNoPopupPageErrors = collectPageErrors(popupPage);
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`, {
    waitUntil: 'domcontentloaded',
  });
  const popupDecisionCard = popupPage.locator('.today-pilot-card', {
    hasText: '确认 OpenClaw 是否继续重试部署查询',
  });
  await popupDecisionCard.waitFor({ timeout: 15000 });
  await popupPage
    .locator('.today-pilot-scope-receipt', {
      hasText: '筛选口径：显示 1/1 张 mission · 扫描 4 条信号',
    })
    .waitFor({ timeout: 15000 });
  await popupPage
    .locator('.today-pilot-scope-receipt', {
      hasText:
        '候选 2 · 入选证据 1 · 候选未入选 1 · 前置降噪 2 (消息 2) · 提醒预算 1/3',
    })
    .waitFor({ timeout: 15000 });
  await popupPage
    .locator('.today-pilot-scope-receipt', {
      hasText: '这里只是 Top 3 快照，不会自动执行',
    })
    .waitFor({ timeout: 15000 });
  await popupPage
    .locator('.today-pilot-scope-receipt', {
      hasText: '快照基准：读取已有 brief',
    })
    .waitFor({ timeout: 15000 });
  await popupPage
    .locator('.today-pilot-scope-receipt', {
      hasText: '可用 brief',
    })
    .waitFor({ timeout: 15000 });
  await popupPage
    .locator('.today-pilot-scope-receipt', {
      hasText: '不会重新扫描来源、写反馈、发送消息或执行动作',
    })
    .waitFor({ timeout: 15000 });
  const popupRefreshButton = popupPage.locator('.today-pilot-refresh');
  assert.match(
    (await popupRefreshButton.getAttribute('title')) || '',
    /Today Pilot Top 3 (快照|snapshot)/,
    'popup refresh button should expose the Top 3 snapshot scope before click',
  );
  assert.match(
    (await popupRefreshButton.getAttribute('aria-label')) || '',
    /不会标记消息已读、完成来源任务、写入反馈、发送消息、审批或执行外部动作|does not mark messages read, complete source tasks, write feedback, send messages, approve, or execute external actions/,
    'popup refresh button should expose the no-source-side-effect boundary to assistive tech',
  );
  await assertPopupLayoutWidth(popupPage);
  await popupDecisionCard
    .getByRole('button', { name: /去处理|Review/ })
    .waitFor({ timeout: 15000 });
  await assert.rejects(
    popupDecisionCard
      .getByRole('button', { name: /^复制$|^Copy$/ })
      .waitFor({ timeout: 600 }),
  );

  failTodayPilotRequest = true;
  await popupPage.locator('.today-pilot-refresh').click();
  await popupPage
    .locator('.today-pilot-scope-receipt', {
      hasText: '刷新失败 · 仍显示上次 Top 3 快照',
    })
    .waitFor({ timeout: 15000 });
  await popupPage
    .locator('.today-pilot-scope-receipt', {
      hasText: '尚未确认当前 Memory Service 最新状态',
    })
    .waitFor({ timeout: 15000 });
  await popupPage
    .locator('.today-pilot-message.error', {
      hasText: '刷新失败，仍显示上次 Top 3 快照',
    })
    .waitFor({ timeout: 15000 });
  await popupDecisionCard.waitFor({ timeout: 15000 });

  delayFeedbackCardId = visibleDecision.id;
  await popupDecisionCard.getByRole('button', { name: /^完成$|^Done$/ }).click();
  await popupPage
    .locator('.today-pilot-message', {
      hasText: '正在提交反馈：完成',
    })
    .waitFor({ timeout: 15000 });
  await popupPage
    .locator('.today-pilot-message', {
      hasText: '尚未写入 Today Pilot 展示/排序反馈',
    })
    .waitFor({ timeout: 15000 });
  await popupDecisionCard.waitFor({ timeout: 15000 });
  assert.equal(
    await popupDecisionCard
      .getByRole('button', { name: /^处理中$|^Working$/ })
      .isDisabled(),
    true,
    'popup active feedback button should stay disabled while feedback is pending',
  );
  assert.equal(
    await popupDecisionCard
      .getByRole('button', { name: /^稍后$|^Later$/ })
      .isDisabled(),
    true,
    'popup sibling feedback button should stay disabled while feedback is pending',
  );
  const releasePopupFeedback = await waitForDelayedFeedbackHook();
  releasePopupFeedback();
  await popupPage
    .locator('.today-pilot-message', {
      hasText: '已写入 Today Pilot 展示反馈：完成',
    })
    .waitFor({ timeout: 15000 });
  await popupPage
    .locator('.today-pilot-message', {
      hasText: '不代表来源任务完成、消息已读、排程变更或外部系统已同步',
    })
    .waitFor({ timeout: 15000 });
  await popupPage
    .locator('.today-pilot-empty', {
      hasText: '暂时没有需要处理的事项',
    })
    .waitFor({ timeout: 15000 });

  assertNoPopupPageErrors();
  await popupPage.close();

  assertNoPageErrors();
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
