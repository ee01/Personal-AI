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
  path.join(os.tmpdir(), 'personal-ai-decision-center-'),
);
const nowSeconds = Math.floor(Date.now() / 1000);
const answerRequests = [];
const stateRequests = [];
const watchStateRequests = [];
let failConfirmRequests = false;
let failWatchRequests = false;
let includeDeepLinkPeer = false;
let decisionState = 'pending';
let retryDecisionState = 'hidden';
let ruleImprovementState = 'hidden';
let delayNextRiskAnswer = false;
let delayNextWatchState = false;
let riskAnswerGate = null;
let watchStateGate = null;

function createReleaseGate() {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function releaseGateWhenReady(getGate, label) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const gate = getGate();
    if (gate?.release) {
      gate.release();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`${label} gate was not created`);
}

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
    };
  }
  if (pathname.endsWith('/meetings')) return { items: [], total: 0 };
  if (pathname.endsWith('/reflection-threads')) return emptyList();
  if (pathname.endsWith('/actions')) return emptyList();
  if (pathname.endsWith('/config/runtime')) return { outreachEnabled: false };
  if (pathname.endsWith('/outreach/summary')) {
    return { upcomingCount: 0, waitingReplyCount: 0, escalatedCount: 0 };
  }
  if (pathname.endsWith('/outreach/templates/runtime-status')) {
    return emptyList();
  }
  if (pathname.endsWith('/skills')) return emptyList();
  if (pathname.endsWith('/skills/suggestions')) return emptyList();
  return {};
}

const decisionItem = {
  id: 'cr-risky-deploy',
  question: '是否允许 OpenClaw 继续查询生产部署状态？',
  context: 'OpenClaw 读取 Jira/部署系统时返回鉴权缺口，需要你判断是否重试。',
  options: [
    { label: '批准执行', value: 'approve' },
    { label: '拒绝执行', value: 'reject' },
    { label: '需要更多上下文', value: 'need_context' },
  ],
  evidenceRefs: [
    'action:action-risky-deploy-approval-1',
    'thread:reflection-prod-rollout',
    'message:glip-approval-context',
    'memory:deployment-risk-memory',
    'meeting:ops-review-followup',
  ],
  category: 'openclaw_delegation',
  priority: 'high',
  state: 'pending',
  routing: 'decision',
  reasonCode: 'approval_required',
  sourceAnchor: 'prod-rollout',
  snoozeCount: 0,
  createdAt: nowSeconds - 180,
  updatedAt: nowSeconds - 60,
};

const unrelatedDecisionItem = {
  ...decisionItem,
  id: 'cr-general-review',
  question: '是否继续保留旧的部署检查提醒？',
  context: '这条确认项用于证明通知深链会把目标卡片置顶，而不是只停在列表顶部。',
  evidenceRefs: ['notification:notif-general-review'],
  category: 'notification_center',
  reasonCode: 'authority_required',
  sourceAnchor: 'notification-center',
  createdAt: nowSeconds - 30,
  updatedAt: nowSeconds - 20,
};

const watchItem = {
  ...decisionItem,
  id: 'cr-watch-release-evidence',
  question: 'Release 证据是否已经足够？',
  context: '本地反思还缺部署窗口和负责人来源，需要先补证据再决定是否推进。',
  options: [],
  evidenceRefs: ['thread:reflection-release-evidence'],
  category: 'reflection_research',
  priority: 'normal',
  state: 'pending',
  routing: 'watch',
  reasonCode: 'artifact_gap',
  sourceAnchor: 'release-evidence',
  gapType: 'artifact_check',
  snoozeCount: 0,
  createdAt: nowSeconds - 240,
  updatedAt: nowSeconds - 120,
};

function currentDecisionItem() {
  return {
    ...decisionItem,
    state: decisionState,
    snoozeUntil: decisionState === 'snoozed' ? nowSeconds + 24 * 3600 : null,
    snoozeCount: decisionState === 'snoozed' ? 1 : 0,
  };
}

const retryDecisionItem = {
  ...decisionItem,
  id: 'cr-openclaw-retry',
  question: 'OpenClaw 配置已修复，是否续跑部署查询？',
  context: '上一次 OpenClaw 委派因鉴权失败停在动作队列，配置修复后需要你确认是否重试。',
  options: [
    { label: '配置好了，请重试', value: 'retry' },
    { label: '暂时跳过', value: 'skip_once' },
    { label: '不再查询', value: 'stop' },
  ],
  evidenceRefs: ['action:action-openclaw-retry-1'],
  reasonCode: 'approval_required',
  createdAt: nowSeconds - 90,
  updatedAt: nowSeconds - 30,
};

function currentRetryDecisionItem() {
  return {
    ...retryDecisionItem,
    state: retryDecisionState,
  };
}

const ruleImprovementContext = {
  schema: 'message_rule_improvement.v1',
  ruleRef: 'manual:pto-rule',
  ruleText: "发送了内容与以下语义相似：Esone's PTO",
  currentPrompt:
    '检测到请假消息后，开始前 3 小时修改 Glip 状态为 PTO，结束后改回 Available。',
  proposedPrompt:
    '检测到 PTO 消息后，先只读确认 RingCentral token/API 和当前状态；如果缺少恢复状态证据，不要猜测 Available，改为进入决策中心。',
  reason: 'OpenClaw 返回能力缺失，需要把写入前查证边界写进规则。',
  summary: '补充 Glip 状态写入前的只读查证边界',
  sourceActionId: 'action-rule-improvement-1',
  sourceActionTitle: '请假开始前 3h 设置 Glip 状态',
  targetSystem: 'glip',
};

const ruleImprovementItem = {
  ...decisionItem,
  id: 'cr-rule-improvement',
  question: '这条记忆入口规则的联动操作可能需要改写，是否打开规则应用建议？',
  context: JSON.stringify(ruleImprovementContext),
  options: [{ label: '忽略建议', value: 'dismissed' }],
  evidenceRefs: ['action:action-rule-improvement-1', 'message_rule:manual:pto-rule'],
  category: 'message_rule_improvement',
  priority: 'normal',
  state: 'pending',
  routing: 'decision',
  reasonCode: 'action_result_improvement',
  sourceAnchor: 'message_rule:manual:pto-rule',
  gapType: 'linked_action_prompt_improvement',
  createdAt: nowSeconds - 75,
  updatedAt: nowSeconds - 25,
};

function currentRuleImprovementItem() {
  return {
    ...ruleImprovementItem,
    state: ruleImprovementState,
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
  await context.route('http://localhost:3210/api/v1/**', async (route) => {
    const request = route.request();
    const url = request.url();
    const parsed = new URL(url);
    const pathname = parsed.pathname;

    if (pathname.endsWith('/confirm-requests') && request.method() === 'GET') {
      if (failConfirmRequests) {
        await route.fulfill(
          jsonResponse({ error: 'memory service unavailable' }, 503),
        );
        return;
      }
      const queue = parsed.searchParams.get('queue');
      const state = parsed.searchParams.get('state');
      if (failWatchRequests && queue === 'watch') {
        await route.fulfill(
          jsonResponse({ error: 'watch queue temporarily unavailable' }, 503),
        );
        return;
      }
      if (queue === 'decision' && state === 'pending') {
        const items = [];
        if (decisionState === 'pending') {
          items.push(
            ...(includeDeepLinkPeer
              ? [unrelatedDecisionItem, currentDecisionItem()]
              : [currentDecisionItem()]),
          );
        }
        if (retryDecisionState === 'pending') {
          items.push(currentRetryDecisionItem());
        }
        if (ruleImprovementState === 'pending') {
          items.push(currentRuleImprovementItem());
        }
        await route.fulfill(
          jsonResponse({ items, total: items.length, limit: 50, state, queue }),
        );
        return;
      }
      if (queue === 'decision' && state === 'snoozed') {
        const items =
          decisionState === 'snoozed' ? [currentDecisionItem()] : [];
        await route.fulfill(
          jsonResponse({ items, total: items.length, limit: 50, state, queue }),
        );
        return;
      }
      if (queue === 'watch' && state === 'pending') {
        await route.fulfill(
          jsonResponse({
            items: [watchItem],
            total: 1,
            limit: 50,
            state,
            queue,
          }),
        );
        return;
      }
      await route.fulfill(jsonResponse({ ...emptyList(), state, queue }));
      return;
    }

    if (
      pathname.endsWith('/confirm-requests/cr-rule-improvement/answer') &&
      request.method() === 'POST'
    ) {
      const payload = request.postDataJSON();
      answerRequests.push(payload);
      ruleImprovementState = 'answered';
      await route.fulfill(
        jsonResponse({
          status: 'resolved',
          confirmRequest: {
            ...ruleImprovementItem,
            state: 'answered',
            userAnswer: payload.answer,
            answeredAt: nowSeconds,
          },
        }),
      );
      return;
    }

    if (
      pathname.endsWith('/confirm-requests/cr-risky-deploy/answer') &&
      request.method() === 'POST'
    ) {
      const payload = request.postDataJSON();
      if (delayNextRiskAnswer) {
        delayNextRiskAnswer = false;
        riskAnswerGate = createReleaseGate();
        await riskAnswerGate.promise;
        riskAnswerGate = null;
      }
      answerRequests.push(payload);
      decisionState = 'answered';
      await route.fulfill(
        jsonResponse({
          status: 'resolved',
          confirmRequest: {
            ...decisionItem,
            state: 'answered',
            userAnswer: payload.answer,
            answeredAt: nowSeconds,
          },
        }),
      );
      return;
    }

    if (
      pathname.endsWith('/confirm-requests/cr-openclaw-retry/answer') &&
      request.method() === 'POST'
    ) {
      const payload = request.postDataJSON();
      answerRequests.push(payload);
      retryDecisionState = 'answered';
      await route.fulfill(
        jsonResponse({
          status: 'resolved',
          confirmRequest: {
            ...retryDecisionItem,
            state: 'answered',
            userAnswer: payload.answer,
            answeredAt: nowSeconds,
          },
          retriedActionId:
            payload.answer === 'retry' ? 'action-openclaw-retry-1' : undefined,
        }),
      );
      return;
    }

    if (
      pathname.endsWith('/confirm-requests/cr-risky-deploy/state') &&
      request.method() === 'POST'
    ) {
      const payload = request.postDataJSON();
      stateRequests.push(payload);
      decisionState = payload.state;
      await route.fulfill(
        jsonResponse({
          status: 'updated',
          confirmRequest: currentDecisionItem(),
        }),
      );
      return;
    }

    if (
      pathname.endsWith('/confirm-requests/cr-watch-release-evidence/state') &&
      request.method() === 'POST'
    ) {
      const payload = request.postDataJSON();
      if (delayNextWatchState) {
        delayNextWatchState = false;
        watchStateGate = createReleaseGate();
        await watchStateGate.promise;
        watchStateGate = null;
      }
      watchStateRequests.push(payload);
      await route.fulfill(
        jsonResponse({
          status: 'updated',
          confirmRequest: {
            ...watchItem,
            state: payload.state,
            snoozeUntil:
              payload.state === 'snoozed' ? nowSeconds + 72 * 3600 : null,
            snoozeCount: payload.state === 'snoozed' ? 1 : 0,
          },
          queuedActionId:
            payload.state === 'pending' ? 'action-watch-verify-1' : undefined,
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

  includeDeepLinkPeer = true;
  const deepLinkPage = await context.newPage();
  await deepLinkPage.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/decisions?confirmRequestId=cr-risky-deploy`,
    { waitUntil: 'domcontentloaded' },
  );
  await deepLinkPage.getByText('决策中心 (2)').waitFor({ timeout: 10000 });
  await deepLinkPage
    .getByText('已定位通知对应确认项')
    .waitFor({ timeout: 10000 });
  const firstCardQuestion = await deepLinkPage
    .locator('.decision-card')
    .first()
    .locator('.question-text')
    .innerText();
  assert.match(firstCardQuestion, /OpenClaw 继续查询生产部署状态/);
  const deepLinkTargetCard = deepLinkPage.locator(
    '.decision-card.deep-link-target[data-request-id="cr-risky-deploy"]',
  );
  await deepLinkTargetCard.waitFor({ timeout: 10000 });
  delayNextRiskAnswer = true;
  const approveClick = deepLinkTargetCard
    .getByRole('button', { name: '批准执行' })
    .click();
  await deepLinkTargetCard
    .getByText('正在提交决策')
    .waitFor({ timeout: 10000 });
  await deepLinkTargetCard
    .getByText(/服务端返回前还不是已写入答案/)
    .waitFor({ timeout: 10000 });
  await releaseGateWhenReady(() => riskAnswerGate, 'risk answer');
  await approveClick;
  await deepLinkPage
    .getByText('通知对应项已由本次操作处理')
    .waitFor({ timeout: 10000 });
  await deepLinkPage
    .getByText('页面保留的操作回执才是本次真实结果')
    .waitFor({ timeout: 10000 });
  await deepLinkPage.getByText('已提交「批准执行」').waitFor({
    timeout: 10000,
  });
  assert.deepEqual(answerRequests, [{ answer: 'approve' }]);
  decisionState = 'pending';
  answerRequests.length = 0;
  await deepLinkPage
    .locator(
      '.decision-card.deep-link-target[data-request-id="cr-risky-deploy"]',
    )
    .waitFor({ state: 'detached', timeout: 10000 });

  const missingLinkPage = await context.newPage();
  await missingLinkPage.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/decisions?confirmRequestId=cr-already-handled`,
    { waitUntil: 'domcontentloaded' },
  );
  await missingLinkPage
    .getByText('通知对应确认项不在已读取队列')
    .waitFor({ timeout: 10000 });
  await missingLinkPage
    .getByText('本次只读刷新已查过需你拍板、稍后决策、待观察、待观察（稍后）')
    .waitFor({ timeout: 10000 });
  await missingLinkPage
    .getByText('刷新只重新读取队列，不会批准、恢复、结束追踪、创建动作或发送消息')
    .waitFor({ timeout: 10000 });

  failWatchRequests = true;
  const partialMissingLinkPage = await context.newPage();
  await partialMissingLinkPage.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/decisions?confirmRequestId=cr-missing-while-watch-fails`,
    { waitUntil: 'domcontentloaded' },
  );
  await partialMissingLinkPage
    .getByText('通知对应确认项不在已读取队列')
    .waitFor({ timeout: 10000 });
  await partialMissingLinkPage
    .getByText('刷新失败，不能确认目标不在这些队列')
    .waitFor({ timeout: 10000 });
  await partialMissingLinkPage
    .getByText('刷新只重新读取队列，不会批准、恢复、结束追踪、创建动作或发送消息')
    .waitFor({ timeout: 10000 });
  failWatchRequests = false;

  includeDeepLinkPeer = false;
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__decisionCenterCopiedText = text;
        },
      },
    });
  });
  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/decisions`,
    {
      waitUntil: 'domcontentloaded',
    },
  );

  await page.getByText('决策中心 (1)').waitFor({ timeout: 10000 });
  await page.getByText('审核上下文').waitFor({ timeout: 10000 });
  await page.getByText('处理选项：批准执行 / 拒绝执行 / 需要更多上下文').waitFor({
    timeout: 10000,
  });
  await page
    .getByText('选择任一答案会写入该确认项并移出主队列')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('普通审批文案不会直接续跑 OpenClaw')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('稍后再决定只收起 24 小时')
    .waitFor({ timeout: 10000 });

  failWatchRequests = true;
  await page.getByRole('button', { name: '刷新', exact: true }).click();
  await page.getByText('决策中心 (1)').waitFor({ timeout: 10000 });
  await page.getByText('部分队列刷新失败').waitFor({ timeout: 10000 });
  await page.getByText(/失败队列：待观察/).waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: '批准执行' }).waitFor({
    timeout: 10000,
  });

  failWatchRequests = false;
  await page.getByRole('button', { name: '重试全部' }).click();
  await page
    .getByText('部分队列刷新失败')
    .waitFor({ state: 'detached', timeout: 10000 });
  await page.locator('.watch-section .watch-toggle').click();
  await page
    .getByText('立即查证只会排入或复用一条只读 OpenClaw 查证动作')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('OpenClaw 未配置或执行失败会留在动作队列或后续回执里')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('继续观察只延后 72 小时')
    .waitFor({ timeout: 10000 });
  delayNextWatchState = true;
  const verifyClick = page.getByRole('button', { name: '立即查证' }).click();
  await page.getByText('正在排入只读查证').waitFor({ timeout: 10000 });
  await page
    .getByText(/返回前还没有动作 ID 或排队结果/)
    .waitFor({ timeout: 10000 });
  await releaseGateWhenReady(() => watchStateGate, 'watch state');
  await verifyClick;
  await page.getByText('已排入只读查证').waitFor({ timeout: 10000 });
  await page.getByText(/动作 action-watch-verify-1/).waitFor({
    timeout: 10000,
  });
  await page
    .getByText('OpenClaw 未配置或执行失败时以动作队列状态为准')
    .waitFor({ timeout: 10000 });
  await page.getByRole('link', { name: '查看动作队列' }).waitFor({
    timeout: 10000,
  });
  assert.deepEqual(watchStateRequests, [{ state: 'pending' }]);

  await page.locator('.evidence-chip').filter({ hasText: '动作 ·' }).waitFor({
    timeout: 10000,
  });
  await page.getByText('另有 1 条').waitFor({ timeout: 10000 });

  await page.getByRole('button', { name: '复制审核包' }).click();
  await page.getByText('已复制审核包').waitFor({ timeout: 10000 });
  const copiedText = await page.evaluate(
    () => window.__decisionCenterCopiedText,
  );
  assert.match(copiedText, /OpenClaw 继续查询生产部署状态/);
  assert.match(copiedText, /处理选项: 批准执行 \/ 拒绝执行 \/ 需要更多上下文/);
  assert.match(copiedText, /action:action-risky-deploy-approval-1/);

  await page.getByRole('button', { name: '稍后再决定' }).click();
  await page.getByText('已移到稍后决策').waitFor({ timeout: 10000 });
  await page
    .getByText('没有提交答案，也没有创建外部动作')
    .waitFor({ timeout: 10000 });
  await page.getByText('决策中心 (0)').waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: /稍后决策/ }).click();
  await page.getByText('稍后处理上下文').waitFor({ timeout: 10000 });
  await page
    .getByText('现在处理只恢复到主队列')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('不再追踪会把这条确认项设为 expired')
    .waitFor({ timeout: 10000 });
  await page
    .locator('.deferred-card .meta-row')
    .getByText(/回到主队列/)
    .waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: '现在处理' }).click();
  await page.getByText('已恢复到需你拍板').waitFor({ timeout: 10000 });
  await page.getByText('决策中心 (1)').waitFor({ timeout: 10000 });
  assert.deepEqual(stateRequests, [{ state: 'snoozed' }, { state: 'pending' }]);

  await page.getByRole('button', { name: '批准执行' }).click();
  await page.getByText('决策已提交').waitFor({ timeout: 10000 });
  await page.getByText('已提交「批准执行」').waitFor({ timeout: 10000 });
  await page.getByText('决策中心 (0)').waitFor({ timeout: 10000 });
  assert.deepEqual(answerRequests, [{ answer: 'approve' }]);

  retryDecisionState = 'pending';
  await page.getByRole('button', { name: '刷新', exact: true }).click();
  await page.getByText('决策中心 (1)').waitFor({ timeout: 10000 });
  await page
    .getByText('只有 retry / skip_once / stop 这类明确选项会续跑、跳过或停止绑定动作')
    .waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: '配置好了，请重试' }).click();
  await page.getByText('已提交并续跑动作').waitFor({ timeout: 10000 });
  await page.getByText(/动作 action-openclaw-retry-1/).waitFor({
    timeout: 10000,
  });
  const retryReceiptLink = page.getByRole('link', { name: '查看动作队列' });
  await retryReceiptLink.waitFor({ timeout: 10000 });
  assert.match(
    (await retryReceiptLink.getAttribute('href')) || '',
    /\/actions\?actionId=action-openclaw-retry-1/,
  );
  assert.deepEqual(answerRequests, [{ answer: 'approve' }, { answer: 'retry' }]);

  ruleImprovementState = 'pending';
  await page.getByRole('button', { name: '刷新', exact: true }).click();
  await page.getByText('决策中心 (1)').waitFor({ timeout: 10000 });
  await page.getByText('补充 Glip 状态写入前的只读查证边界').waitFor({
    timeout: 10000,
  });
  await page
    .getByText('处理选项：打开并预填建议 / 忽略建议')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('打开并预填建议只会把建议暂存到本机并打开记忆入口规则编辑器')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('在规则页保存后才会更新本机手动规则')
    .waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: '打开并预填建议' }).waitFor({
    timeout: 10000,
  });
  await page.getByRole('button', { name: '复制审核包' }).click();
  await page.getByText('已复制审核包').waitFor({ timeout: 10000 });
  const copiedRuleText = await page.evaluate(
    () => window.__decisionCenterCopiedText,
  );
  assert.match(copiedRuleText, /处理选项: 打开并预填建议 \/ 忽略建议/);
  assert.match(copiedRuleText, /保存前不会更新原规则或标记确认项/);
  assert.match(copiedRuleText, /message_rule:manual:pto-rule/);
  await page.getByRole('button', { name: '忽略' }).click();
  await page.getByText('已提交「忽略建议」').waitFor({ timeout: 10000 });
  assert.deepEqual(answerRequests, [
    { answer: 'approve' },
    { answer: 'retry' },
    { answer: 'dismissed' },
  ]);

  failConfirmRequests = true;
  const errorPage = await context.newPage();
  await errorPage.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/decisions`,
    { waitUntil: 'domcontentloaded' },
  );
  await errorPage.getByText('决策中心暂时不可用').waitFor({ timeout: 10000 });
  await errorPage.getByText(/memory service unavailable/).waitFor({
    timeout: 10000,
  });

  console.log('verify-decision-center-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
