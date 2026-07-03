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
let currentThreadStatus = 'active';
let currentReflectionCount = 3;
let currentSummary = '本轮反思确认需要先看本地证据再决定是否问人。';

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
      status: currentThreadStatus,
      priority: 8,
      salience: 0.91,
      sourceType: 'ask',
      currentHypothesis: 'Orbit owner should be Platform Team.',
      openQuestions: ['Orbit 的 owner 是否已经稳定？'],
      latestSummary: currentSummary,
      continueReason: 'waiting_for_outreach',
      nextReflectionAt: nowSeconds + 3600,
      lastReflectedAt: nowSeconds - 900,
      reflectionCount: currentReflectionCount,
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
        requestedSourceTypes: ['glip', 'manual', 'unsupported_slack'],
        rejectedSourceTypes: ['unsupported_slack'],
        scopeNotice:
          '研究范围已裁剪：仅查询 Personal AI 支持的本地来源 glip / manual；已忽略不支持的来源 unsupported_slack。',
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
        sourceTypes: [
          'glip',
          'jira',
          'web',
          'manual',
          'system',
          'source_memory',
          'user_core',
          'markdown',
          'reflection',
          'reflection_thread',
          'rehearsal',
          'daily_log',
          'project_summary',
          'entity_profile',
        ],
        requestedSourceTypes: ['notion_private'],
        rejectedSourceTypes: ['notion_private'],
        scopeNotice:
          '研究范围已裁剪：模型建议的来源 notion_private 当前不支持，已改用默认本地来源 glip / jira / web / manual / system / source_memory / user_core / markdown / reflection / reflection_thread / rehearsal / daily_log / project_summary / entity_profile。',
        senderFilter: [],
        groupFilter: [],
        evidenceRefs: [],
        createdAt: nowSeconds - 90,
      },
      {
        id: 'research-skipped',
        threadId: 'thread-1',
        runId: 'run-1',
        query: '未执行本地研究查询',
        purpose: '规划器未返回可执行的本地研究查询',
        status: 'skipped',
        resultCount: 0,
        sourceTypes: [],
        requestedSourceTypes: [],
        rejectedSourceTypes: [],
        scopeNotice:
          '本轮没有执行额外 recall 查询；Memory Service 继续使用线程已有证据生成反思。这不是读取失败，也没有联网搜索、发送消息、确认决策或执行 OpenClaw。',
        senderFilter: [],
        groupFilter: [],
        evidenceRefs: [],
        createdAt: nowSeconds - 82,
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

function threadListFixture() {
  const { thread } = threadDetailFixture();
  return {
    items: [
      {
        ...thread,
        latestSummary: '正在等待外部回复，不会自动跳过联系人确认。',
      },
    ],
    total: 7,
    limit: 50,
    offset: 0,
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
    const method = route.request().method();
    const pathname = decodeURIComponent(new URL(requestUrl).pathname);

    if (method === 'POST' && pathname.endsWith('/reflection-threads/thread-1/revisit')) {
      currentReflectionCount += 1;
      currentSummary = '手动反思已完成，等待用户复核新运行。';
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill(
        jsonResponse({
          thread: threadDetailFixture().thread,
          run: {
            id: `run-manual-${currentReflectionCount}`,
            threadId: 'thread-1',
            runType: 'manual_revisit',
            triggerType: 'manual',
            inputRefs: ['entity:entity-orbit'],
            summary: '手动反思已完成。',
            discoveries: ['继续等待外部回复，不跳过联系人确认。'],
            openQuestions: [],
            actions: [],
            createdAt: nowSeconds,
          },
          actions: [],
        }),
      );
      return;
    }

    if (method === 'POST' && pathname.endsWith('/reflection-threads/thread-1/pause')) {
      currentThreadStatus = 'paused';
      await route.fulfill(jsonResponse({ thread: threadDetailFixture().thread }));
      return;
    }

    if (method === 'POST' && pathname.endsWith('/reflection-threads/thread-1/resume')) {
      currentThreadStatus = 'active';
      await route.fulfill(jsonResponse({ thread: threadDetailFixture().thread }));
      return;
    }

    if (pathname.endsWith('/reflection-threads/thread-1')) {
      await route.fulfill(jsonResponse(threadDetailFixture()));
      return;
    }

    if (pathname.endsWith('/reflection-threads') && failReflectionList) {
      await new Promise(resolve => setTimeout(resolve, 750));
      await route.fulfill(
        jsonResponse({ error: 'reflection list unavailable' }, 503),
      );
      return;
    }

    if (pathname.endsWith('/reflection-threads')) {
      await route.fulfill(jsonResponse(threadListFixture()));
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
  await page.locator('.hero-meta').getByText('运行 3').waitFor({
    timeout: 10000,
  });
  await page.locator('.hero-meta').getByText(/最近/).waitFor({
    timeout: 10000,
  });
  await page.getByText('继续原因').waitFor({ timeout: 10000 });
  await page.getByText('等待关联主动询问回复').waitFor({ timeout: 10000 });
  const operationScopeBox = page.locator('.operation-scope-box');
  await operationScopeBox
    .getByText('本次操作范围', { exact: true })
    .waitFor({ timeout: 10000 });
  await operationScopeBox
    .getByText('推进前先看阻塞范围')
    .waitFor({ timeout: 10000 });
  await operationScopeBox
    .getByText(/立即自我反思会读取本地可见证据/)
    .waitFor({ timeout: 10000 });
  await operationScopeBox
    .getByText(/本次点击本身不会发送消息、确认决策、执行 OpenClaw/)
    .waitFor({ timeout: 10000 });
  await operationScopeBox
    .getByText(/暂停会停止自动推进；关闭会停止后续推进/)
    .waitFor({ timeout: 10000 });
  await page.getByText('反思推进回执').waitFor({ timeout: 10000 });
  await page.getByText('推进需要修复').waitFor({ timeout: 10000 });
  await page
    .getByText('关联主动询问状态暂时读不到，主反思仍可查看。')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('失败和子链路读取错误会暴露出来，不会伪装成暂无结果。')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('点击关联主动询问区块的重试；必要时稍后刷新详情页。')
    .waitFor({ timeout: 10000 });
  await page
    .getByText(/关联主动询问加载失败：.*outreach service unavailable/)
    .waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: '立即自我反思' }).click();
  const pendingResearchReceipt = page.locator('.research-pending-receipt');
  await pendingResearchReceipt
    .getByText('新一轮本地研究提交中')
    .waitFor({ timeout: 10000 });
  await pendingResearchReceipt
    .getByText(/正在为这次 manual_revisit 规划并读取本地可见证据/)
    .waitFor({ timeout: 10000 });
  await pendingResearchReceipt
    .getByText(/下方仍是上次成功读取的 5 条研究 trace/)
    .waitFor({ timeout: 10000 });
  await pendingResearchReceipt
    .getByText(/不代表研究已完成，也不联网搜索、发送消息、确认决策、执行 OpenClaw/)
    .waitFor({ timeout: 10000 });
  const operationReceipt = page.locator('.operation-receipt');
  await operationReceipt
    .getByText('手动反思已完成')
    .waitFor({ timeout: 10000 });
  await operationReceipt
    .getByText('写入运行 run-manual-4；候选动作 0')
    .waitFor({ timeout: 10000 });
  await operationReceipt
    .getByText(/不代表已发送消息、确认决策、执行 OpenClaw/)
    .waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: '暂停' }).click();
  await operationReceipt
    .getByText('反思线程已暂停')
    .waitFor({ timeout: 10000 });
  await operationReceipt
    .getByText('线程状态 已暂停')
    .waitFor({ timeout: 10000 });
  await page.locator('.hero-metrics').getByText('状态 已暂停').waitFor({
    timeout: 10000,
  });
  await page.getByRole('button', { name: '恢复' }).click();
  await operationReceipt
    .getByText('反思线程已恢复')
    .waitFor({ timeout: 10000 });
  await operationReceipt
    .getByText('线程状态 进行中')
    .waitFor({ timeout: 10000 });
  await operationReceipt
    .getByText(/恢复不会补齐外部回复、确认决策、执行动作/)
    .waitFor({ timeout: 10000 });
  await page.locator('.hero-metrics').getByText('状态 进行中').waitFor({
    timeout: 10000,
  });
  await page.getByText('研究补查过程').waitFor({ timeout: 10000 });
  const researchTracePanel = page.locator('.panel', {
    hasText: '研究补查过程',
  });
  const researchRunScope = researchTracePanel.locator('.research-run-scope');
  await researchRunScope
    .getByText('本轮研究范围', { exact: true })
    .waitFor({ timeout: 10000 });
  await researchRunScope
    .getByText('本地研究有失败项')
    .waitFor({ timeout: 10000 });
  await researchRunScope
    .getByText(/本轮 4 次实际查询只读取 Personal AI 本地可见记忆/)
    .waitFor({ timeout: 10000 });
  await researchRunScope
    .getByText('实际查询 4/5 · 命中查询 2/4 · 证据 3 · 部分失败 1 · 无结果 1 · 未补查 1 · 失败 1')
    .waitFor({ timeout: 10000 });
  await researchRunScope
    .getByText(/14 类来源：glip \/ manual \/ jira \/ web \/ system 等 14 类；已裁剪 2 类/)
    .waitFor({ timeout: 10000 });
  await researchRunScope
    .getByText(/只读补查，不联网搜索、不发送、不确认决策、不执行 OpenClaw、不写 confirmed profile/)
    .waitFor({ timeout: 10000 });
  await researchRunScope
    .getByText('失败查询保留在下方 trace；重新反思会重新规划并再次补查。')
    .waitFor({ timeout: 10000 });
  await researchTracePanel
    .getByText('查询 5', { exact: true })
    .waitFor({ timeout: 10000 });
  await researchTracePanel.getByText('命中查询 2', { exact: true }).waitFor({
    timeout: 10000,
  });
  await researchTracePanel
    .getByText('证据 3', { exact: true })
    .waitFor({ timeout: 10000 });
  await researchTracePanel.getByText('部分失败 1', { exact: true }).waitFor({
    timeout: 10000,
  });
  await researchTracePanel
    .getByText('无结果 1', { exact: true })
    .waitFor({ timeout: 10000 });
  await researchTracePanel
    .locator('.research-summary-pill.skipped')
    .getByText('未补查 1', { exact: true })
    .waitFor({ timeout: 10000 });
  await researchTracePanel
    .getByText('失败 1', { exact: true })
    .waitFor({ timeout: 10000 });
  await page.getByText('确认 Orbit owner 是否已有本地证据').waitFor({
    timeout: 10000,
  });
  const ownerResearchCard = page.locator('.research-trace-card', {
    hasText: '确认 Orbit owner 是否已有本地证据',
  });
  await ownerResearchCard
    .getByText('已命中', { exact: true })
    .waitFor({ timeout: 10000 });
  await ownerResearchCard.getByText('命中 2').waitFor({ timeout: 10000 });
  await ownerResearchCard.getByText('glip / manual', { exact: true }).waitFor({
    timeout: 10000,
  });
  await ownerResearchCard
    .getByText('研究范围回执')
    .waitFor({ timeout: 10000 });
  await ownerResearchCard
    .getByText(/已忽略不支持的来源 unsupported_slack/)
    .waitFor({ timeout: 10000 });
  await ownerResearchCard
    .getByText('证据 message:msg-1 · entity:entity-orbit')
    .waitFor({
      timeout: 10000,
    });
  const emptyResearchCard = page.locator('.research-trace-card', {
    hasText: '确认是否已有 BE signoff 证据',
  });
  await emptyResearchCard
    .getByText('无结果', { exact: true })
    .waitFor({ timeout: 10000 });
  await emptyResearchCard
    .getByText('本地没有找到可加入本轮反思的证据。')
    .waitFor({ timeout: 10000 });
  await emptyResearchCard
    .locator('.action-meta')
    .getByText(/source_memory \/ user_core \/ markdown \/ reflection \/ reflection_thread \/ rehearsal/)
    .waitFor({ timeout: 10000 });
  await emptyResearchCard
    .getByText(/已改用默认本地来源 glip \/ jira \/ web \/ manual \/ system \/ source_memory/)
    .waitFor({ timeout: 10000 });
  const skippedResearchCard = page.locator('.research-trace-card', {
    hasText: '规划器未返回可执行的本地研究查询',
  });
  await skippedResearchCard
    .getByText('未补查', { exact: true })
    .waitFor({ timeout: 10000 });
  await skippedResearchCard
    .getByText('未执行 recall', { exact: true })
    .waitFor({ timeout: 10000 });
  await skippedResearchCard
    .getByText(/继续使用线程已有证据生成反思/)
    .waitFor({ timeout: 10000 });
  await skippedResearchCard
    .getByText(/这不是读取失败，也没有联网搜索、发送消息/)
    .waitFor({ timeout: 10000 });
  const degradedResearchCard = page.locator('.research-trace-card', {
    hasText: '确认 PM 决策是否已有本地证据',
  });
  await degradedResearchCard
    .getByText('确认 PM 决策是否已有本地证据')
    .waitFor({ timeout: 10000 });
  await degradedResearchCard
    .getByText('部分召回通道失败，命中可能不完整：vector(embedding timeout)')
    .waitFor({ timeout: 10000 });
  const failedResearchCard = page.locator('.research-trace-card', {
    hasText: '确认发布风险是否已有本地证据',
  });
  await failedResearchCard
    .getByText('查询失败', { exact: true })
    .waitFor({ timeout: 10000 });
  await failedResearchCard
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

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/reflection-threads`,
    { waitUntil: 'domcontentloaded' },
  );
  const listScope = page.locator('.list-scope-box');
  await listScope
    .getByText('列表查看范围', { exact: true })
    .waitFor({ timeout: 10000 });
  await listScope
    .getByText('当前反思快照')
    .waitFor({ timeout: 10000 });
  await listScope
    .getByText('状态 进行中')
    .waitFor({ timeout: 10000 });
  await listScope
    .getByText('未输入搜索词')
    .waitFor({ timeout: 10000 });
  await listScope
    .getByText('可见 1 / 总计 7')
    .waitFor({ timeout: 10000 });
  await listScope
    .getByText(/筛选、搜索和刷新只读列表快照，不会运行反思、写记忆、确认决策、发送消息或执行动作/)
    .waitFor({ timeout: 10000 });

  const listCard = page.locator('.thread-card', {
    hasText: '项目反思: Orbit',
  });
  const listReceipt = listCard.locator('.thread-handoff');
  await listCard.getByText('等待主动询问回复').waitFor({ timeout: 10000 });
  await listCard.getByText('运行 4').first().waitFor({ timeout: 10000 });
  await listReceipt
    .getByText('正在等待外部回复，不会自动跳过联系人确认。')
    .waitFor({ timeout: 10000 });
  await listCard.locator('text=下次').first().waitFor({
    timeout: 10000,
  });

  failReflectionList = true;
  await page.getByRole('button', { name: '刷新', exact: true }).click();
  await page
    .getByText('刷新中 · 保留上次成功快照')
    .waitFor({ timeout: 10000 });
  await page
    .getByText(/下方线程仍是上次读取结果/)
    .waitFor({ timeout: 10000 });
  await listCard.getByText('等待主动询问回复').waitFor({ timeout: 10000 });
  await page
    .getByText('自我反思线程暂时不可用')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('reflection list unavailable')
    .waitFor({ timeout: 10000 });
  await listScope
    .getByText('保留上次成功快照')
    .waitFor({ timeout: 10000 });
  await listScope
    .getByText('本次刷新没有拿到新的 Reflection 列表；下方仍是上次成功读取的线程快照。')
    .waitFor({ timeout: 10000 });
  await listCard.getByText('等待主动询问回复').waitFor({ timeout: 10000 });

  console.log('verify-reflection-research-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
