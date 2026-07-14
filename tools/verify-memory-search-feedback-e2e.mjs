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
  path.join(os.tmpdir(), 'personal-ai-memory-search-feedback-'),
);
const askRequests = [];
const feedbackRequests = [];
const nowSeconds = Math.floor(Date.now() / 1000);
let failNextFeedback = false;
let persistedRecallFeedback = 'negative';

function assertFeedbackRequest(index, expected, expectedDetail = {}) {
  const request = feedbackRequests[index];
  const { detail, ...base } = request;
  assert.deepEqual(base, expected);
  assert.equal(typeof detail, 'string', 'feedback detail should be serialized');
  const parsedDetail = JSON.parse(detail);
  if (parsedDetail.source_url) {
    assert.match(
      parsedDetail.source_url,
      /^https?:\/\//,
      'feedback detail should include only safe http(s) source urls',
    );
  }
  assert.notEqual(
    parsedDetail.source_url,
    'javascript:alert(1)',
    'feedback detail should not serialize unsafe source urls hidden by the UI',
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(expectedDetail).map(([key, value]) => [
        key,
        parsedDetail[key],
      ]),
    ),
    expectedDetail,
  );
  assert.equal(
    typeof parsedDetail.scene_anchor_signature,
    'string',
    'feedback detail should include scene signature',
  );
}

async function assertClass(locator, className, message) {
  const classes = (await locator.getAttribute('class')) || '';
  assert.match(classes, new RegExp(`\\b${className}\\b`), message);
}

async function assertNoClass(locator, className, message) {
  const classes = (await locator.getAttribute('class')) || '';
  assert.doesNotMatch(classes, new RegExp(`\\b${className}\\b`), message);
}

async function assertBoundaryAttribute(locator, expectedParts, message) {
  const title = (await locator.getAttribute('title')) || '';
  const ariaLabel = (await locator.getAttribute('aria-label')) || '';
  for (const part of expectedParts) {
    assert.ok(
      title.includes(part),
      `${message}: title should include "${part}", got "${title}"`,
    );
    assert.ok(
      ariaLabel.includes(part),
      `${message}: aria-label should include "${part}", got "${ariaLabel}"`,
    );
  }
}

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
      askRequests.push(payload);
      if (payload.query === 'unverified prior query') {
        await route.fulfill(
          jsonResponse({
            answer:
              '本轮没有找到当前证据；不能把旧活答案当作当前事实复述。',
            resolutionState: 'insufficient',
            missingInfo: ['需要重新召回当前权威证据。'],
            answerMemory: {
              state: 'skipped',
              threadId: 'answer-thread-unverified-prior',
              canonicalKey: 'topic:unverified prior|intent:status',
              skipReason: 'no_evidence',
              receipt: {
                label: '活答案未复核',
                detail:
                  '命中过往活答案，但本轮没有当前证据；不会把旧答案当作事实复述。',
                tone: 'warning',
                currentEvidenceCount: 0,
                priorEvidenceCount: 2,
              },
            },
            evidence: [],
            queryTimeMs: 5,
            blocks: [],
          }),
        );
        return;
      }
      await route.fulfill(
        jsonResponse({
          answer: 'Search feedback answer',
          resolutionState: 'partial',
          missingInfo: ['需要确认最新 Jira 状态。'],
          followUpActions: [
            {
              id: 'ask-openclaw-check-feedback',
              actionType: 'delegate_openclaw',
              title: '外部查证: feedback query',
              queueStatus: 'completed',
              executionMode: 'auto',
              sourceKind: 'ask_request',
              sourceRefId: 'ask-request-feedback',
              result: {},
            },
            {
              id: 'ask-confirm-feedback',
              actionType: 'create_confirm_request',
              title: '跟进处理: feedback query',
              queueStatus: 'queued',
              executionMode: 'manual',
              sourceKind: 'ask_request',
              sourceRefId: 'ask-request-feedback',
            },
          ],
          externalEvidence: [
            {
              kind: 'note',
              title: 'OpenClaw status snapshot',
              content: 'External verification returned one status note.',
            },
          ],
          answerMemory: {
            state: 'priorHit',
            threadId: 'answer-thread-search-feedback',
            canonicalKey: 'topic:search feedback|intent:status',
            receipt: {
              label: '活答案已复核',
              detail:
                '命中过往活答案，但旧答案只用于聚焦召回；本轮用 1 条当前证据复核。',
              tone: 'info',
              currentEvidenceCount: 1,
              priorEvidenceCount: 2,
            },
            authority: {
              decision: 'same_meaning_no_change',
              summary:
                '同一组权威证据下答案语义没有变化，只记录本轮复核，不写新版本。',
              evidenceRoles: [
                {
                  role: 'authority',
                  count: 1,
                  reason:
                    '原始消息、chunk、文档或日历等当前召回证据，可以驱动长期答案更新。',
                },
                {
                  role: 'prior',
                  count: 2,
                  reason: '旧活答案只用于对比和聚焦召回，不是本轮事实来源。',
                },
              ],
              currentStance: 'negative_or_pending',
              priorStance: 'negative_or_pending',
              sameEvidence: true,
              suppressedUpdate: true,
            },
          },
          evidence: [
            {
              id: 'search-feedback-message',
              type: 'message',
              content: 'Search feedback memory content.',
              displayTitle: 'Search feedback memory',
              displayText: 'This result restores and updates recall feedback.',
              score: 0.93,
              source: 'manual',
              sourceUrl: 'javascript:alert(1)',
              exploreLink: '#/settings',
              timestamp: nowSeconds,
              scope: 'work',
              metadata: {
                channels: ['fts'],
                ...(persistedRecallFeedback
                  ? { recallFeedback: persistedRecallFeedback }
                  : {}),
              },
            },
          ],
          queryTimeMs: 8,
          blocks: [],
        }),
      );
      return;
    }

    if (pathname.endsWith('/feedback')) {
      const payload = request.postDataJSON();
      feedbackRequests.push(payload);
      if (failNextFeedback) {
        failNextFeedback = false;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'feedback_service_unavailable' }),
        });
        return;
      }
      persistedRecallFeedback =
        payload.action === 'clear' ? undefined : payload.action;
      let feedbackBody = { status: 'ok', targetType: 'message' };
      if (payload.action === 'positive') {
        feedbackBody = {
          ...feedbackBody,
          appliedDelta: 0.1,
        };
      } else if (payload.action === 'negative') {
        feedbackBody = {
          ...feedbackBody,
          previousAction: 'positive',
          appliedDelta: -0.1,
          relevancePatch: {
            status: 'patched',
            patch: {
              id: 'patch-search-feedback-message',
              action: 'hide_for_scene',
              scope: 'scene_only',
            },
            replay: { changed: true },
            trainingCaseId: 'training-search-feedback-message',
          },
        };
      } else if (payload.action === 'clear') {
        feedbackBody = {
          ...feedbackBody,
          previousAction: 'negative',
          appliedDelta: 0,
          relevancePatch: {
            status: 'cleared',
            clearedPatchIds: ['patch-search-feedback-message'],
          },
        };
      }
      await route.fulfill(jsonResponse(feedbackBody));
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
    `chrome-extension://${extensionId}/memory-exploring.html#/search?q=feedback%20query&scope=work`,
    { waitUntil: 'domcontentloaded' },
  );

  await page.getByText('Search feedback memory').waitFor({ timeout: 10000 });
  assert.equal(askRequests.at(-1)?.scope, 'work');
  await page.getByText('活答案已复核').waitFor({ timeout: 10000 });
  await page
    .getByText('旧答案只用于聚焦召回')
    .waitFor({ timeout: 10000 });
  const askStatusRail = page.getByLabel('Ask 本轮状态');
  await askStatusRail.getByText('本轮证据 1').waitFor({ timeout: 10000 });
  await page.getByText('旧证据 2').waitFor({ timeout: 10000 });
  await askStatusRail.getByText('同证据同义复核').waitFor({ timeout: 10000 });
  await page
    .getByText('只记录本轮复核，不写新版本')
    .waitFor({ timeout: 10000 });
  const authorityGate = page.getByLabel('活答案权威证据门控');
  await authorityGate.getByText('当前权威 1').waitFor({ timeout: 10000 });
  await authorityGate.getByText('旧 prior 2').waitFor({ timeout: 10000 });
  await authorityGate.getByText('未写新版本').waitFor({ timeout: 10000 });
  await page.getByText('Ask 查证回执').waitFor({ timeout: 10000 });
  await page
    .getByText('不会自动确认结论、代表你发消息，或把缺口写成长期事实')
    .waitFor({ timeout: 10000 });
  const followUpReceipt = page.getByLabel('Ask 查证与缺口回执');
  await followUpReceipt.getByText('查证动作 2').waitFor({ timeout: 10000 });
  await followUpReceipt.getByText('已完成 1').waitFor({ timeout: 10000 });
  await followUpReceipt.getByText('队列中 1').waitFor({ timeout: 10000 });
  await followUpReceipt.getByText('需人工 1').waitFor({ timeout: 10000 });
  await followUpReceipt.getByText('外部证据 1').waitFor({ timeout: 10000 });
  await followUpReceipt.getByText('缺口 1').waitFor({ timeout: 10000 });

  const priorPage = await context.newPage();
  await priorPage.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/search?q=unverified%20prior%20query&scope=work`,
    { waitUntil: 'domcontentloaded' },
  );
  await priorPage
    .getByText('本轮没有找到当前证据')
    .waitFor({ timeout: 10000 });
  const unverifiedPriorRail = priorPage.getByLabel('Ask 本轮状态');
  await unverifiedPriorRail
    .getByText('命中过往活答案，但本轮没有当前证据')
    .waitFor({ timeout: 10000 });
  await unverifiedPriorRail
    .getByText('旧答案只作召回提示，不确认当前事实')
    .waitFor({ timeout: 10000 });
  await unverifiedPriorRail.getByText('本轮证据 0').waitFor({
    timeout: 10000,
  });
  await unverifiedPriorRail.getByText('旧 prior 2').waitFor({
    timeout: 10000,
  });
  await unverifiedPriorRail.getByText('旧答案未复核').waitFor({
    timeout: 10000,
  });
  await priorPage.getByText('活答案未复核').waitFor({ timeout: 10000 });
  const unverifiedPriorReceipt = priorPage.getByLabel(
    /活答案回执：活答案未复核/,
  );
  await unverifiedPriorReceipt.waitFor({ timeout: 10000 });
  const unverifiedPriorReceiptTitle =
    (await unverifiedPriorReceipt.getAttribute('title')) || '';
  assert.match(
    unverifiedPriorReceiptTitle,
    /本轮证据 0/,
    'unverified prior receipt title should expose zero current evidence',
  );
  assert.match(
    unverifiedPriorReceiptTitle,
    /旧 prior 2/,
    'unverified prior receipt title should expose prior evidence count',
  );
  assert.match(
    unverifiedPriorReceiptTitle,
    /旧 prior 如有仅作召回和对比提示/,
    'unverified prior receipt title should preserve prior-only boundary',
  );
  assert.match(
    unverifiedPriorReceiptTitle,
    /不会重新确认当前事实、再次写新版本、创建外部查证动作、代表你发消息或执行外部写入/,
    'unverified prior receipt title should state non-effects',
  );
  await priorPage.close();

  const resultCard = page.locator('.search-result-card', {
    hasText: 'Search feedback memory',
  });
  await resultCard
    .locator('mark.search-highlight', { hasText: 'feedback' })
    .first()
    .waitFor({ timeout: 10000 });
  await resultCard
    .locator('.link-safety-note', {
      hasText: '来源链接已隐藏：仅支持 http/https',
    })
    .waitFor({ timeout: 10000 });
  await resultCard
    .locator('.link-safety-note', {
      hasText: '记忆内跳转已隐藏：不支持的目标',
    })
    .waitFor({ timeout: 10000 });
  assert.equal(
    await resultCard.getByRole('button', { name: /打开来源/ }).count(),
    0,
    'unsafe search result source should not expose an open-source button',
  );
  assert.equal(
    await resultCard.getByRole('button', { name: '在记忆中查看' }).count(),
    0,
    'unsupported search result route should not expose an internal jump button',
  );
  const openResultButton = resultCard.getByRole('button', {
    name: /打开结果：Search feedback memory；显示链接安全拦截回执/,
  });
  await openResultButton.focus();
  await openResultButton.press('Enter');
  const blockedOpenReceipt = page.locator('.search-navigation-receipt-warning');
  await blockedOpenReceipt.getByText('打开动作回执').waitFor({
    timeout: 10000,
  });
  await blockedOpenReceipt
    .getByText('来源链接已隐藏：仅支持 http/https')
    .waitFor({ timeout: 10000 });
  await blockedOpenReceipt
    .getByText('记忆内跳转已隐藏：不支持的目标')
    .waitFor({ timeout: 10000 });
  await blockedOpenReceipt
    .getByText('等待上游写入安全 http/https 来源或安全记忆内路由')
    .waitFor({ timeout: 10000 });
  await page.evaluate(() => {
    window.__searchCopiedDiagnostic = '';
    const clipboard = {
      writeText: async (text) => {
        window.__searchCopiedDiagnostic = text;
      },
    };
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: clipboard,
      });
    } catch (_error) {
      navigator.clipboard = clipboard;
    }
  });
  const copyDiagnosticButton = resultCard.getByRole('button', {
    name: /复制安全诊断/,
  });
  const copyDiagnosticTitle =
    (await copyDiagnosticButton.getAttribute('title')) || '';
  assert.ok(
    copyDiagnosticTitle.includes('2 项拦截原因') &&
      copyDiagnosticTitle.includes('不复制被拦截原始 URL') &&
      copyDiagnosticTitle.includes('不会写入、同步、确认或重新读取来源'),
    'search diagnostic copy button should expose block reasons and no-raw-url boundary before click',
  );
  await copyDiagnosticButton.click();
  await page
    .locator('.search-navigation-receipt-info')
    .getByText('安全诊断复制回执')
    .waitFor({ timeout: 10000 });
  await page
    .locator('.search-navigation-receipt-info')
    .getByText('不包含被拦截的原始 URL')
    .waitFor({ timeout: 10000 });
  const copiedDiagnostic = await page.evaluate(
    () => window.__searchCopiedDiagnostic,
  );
  assert.ok(
    copiedDiagnostic.includes('Personal AI 搜索结果链接安全诊断'),
    'copied search diagnostic should include a recognizable header',
  );
  assert.ok(
    copiedDiagnostic.includes('目标：Search feedback memory'),
    'copied search diagnostic should include the visible result title',
  );
  assert.ok(
    copiedDiagnostic.includes('查询：feedback query'),
    'copied search diagnostic should include the current query',
  );
  assert.ok(
    copiedDiagnostic.includes('来源链接已隐藏：仅支持 http/https'),
    'copied search diagnostic should include the source block reason',
  );
  assert.ok(
    !copiedDiagnostic.includes('javascript:alert') &&
      !copiedDiagnostic.includes('#/settings'),
    'copied search diagnostic should not leak blocked raw targets',
  );
  await resultCard.getByText('已记录为不相关').waitFor({ timeout: 10000 });
  await resultCard.getByText('不相关修正范围').waitFor({ timeout: 10000 });
  await resultCard
    .getByText('Ask 证据 / 工作记忆 / 消息记忆；只降低相近场景排序，不删除这条记忆。')
    .waitFor({ timeout: 10000 });
  await resultCard
    .getByText('本次查询：“feedback query”，第 1/1 条')
    .waitFor({ timeout: 10000 });
  await resultCard
    .getByText('点“撤销”会移除这次修正；原记忆仍可从搜索、时间轴或来源打开。')
    .waitFor({ timeout: 10000 });
  await assertClass(
    resultCard.locator('.feedback-status'),
    'feedback-status-negative',
    'restored negative feedback status should use negative tone',
  );
  const usefulButton = resultCard.getByRole('button', {
    name: /有用反馈：把「Search feedback memory」/,
  });
  const negativeButton = resultCard.getByRole('button', {
    name: /不相关反馈：把「Search feedback memory」/,
  });
  await assertBoundaryAttribute(
    usefulButton,
    [
      '有用反馈',
      'Search feedback memory',
      '本次查询：“feedback query”，第 1/1 条',
      '后续相近召回会提高优先级',
      '不会确认答案',
      '不会删除记忆',
    ],
    'useful feedback button should expose pre-click boundary',
  );
  await assertBoundaryAttribute(
    negativeButton,
    [
      '不相关反馈',
      'Search feedback memory',
      '本次查询：“feedback query”，第 1/1 条',
      '不做全局排除',
      '不会删除或隐藏当前记忆',
      '不会同步来源系统',
    ],
    'negative feedback button should expose pre-click boundary',
  );
  await assertClass(
    negativeButton,
    'feedback-btn-negative',
    'negative feedback button should carry negative role class',
  );
  await assertClass(
    negativeButton,
    'active',
    'restored negative feedback button should be active',
  );
  assert.equal(
    await negativeButton.getAttribute('aria-pressed'),
    'true',
    'search result should restore persisted negative feedback',
  );

  await usefulButton.click();
  await resultCard.getByText('已记录为有用').waitFor({ timeout: 10000 });
  await resultCard.getByText('有用信号范围').waitFor({ timeout: 10000 });
  await resultCard
    .getByText('Ask 证据 / 工作记忆 / 消息记忆；会提高这条证据在相近召回里的优先级。')
    .waitFor({ timeout: 10000 });
  await resultCard
    .getByText('排序信号已提高显著性 10%，只影响后续召回排序。')
    .waitFor({ timeout: 10000 });
  await resultCard
    .getByText('当前页不会即时重排；重新取证会用同一 query 和范围重新请求 Memory Service。')
    .waitFor({ timeout: 10000 });
  const refreshEvidenceButton = resultCard.getByRole('button', {
    name: /用同一条件重新取证：重新请求 Memory Service/,
  });
  await refreshEvidenceButton.waitFor({ timeout: 10000 });
  await assertBoundaryAttribute(
    refreshEvidenceButton,
    [
      '用同一条件重新取证',
      'query 为「feedback query」',
      '范围为工作记忆',
      '不会再写一条反馈',
      '不会确认答案',
    ],
    'feedback refresh button should expose rerun boundary',
  );
  await assertClass(
    resultCard.locator('.feedback-status'),
    'feedback-status-positive',
    'positive feedback status should use positive tone',
  );
  await assertClass(
    usefulButton,
    'feedback-btn-positive',
    'positive feedback button should carry positive role class',
  );
  await assertClass(
    usefulButton,
    'active',
    'positive feedback button should become active',
  );
  await assertNoClass(
    negativeButton,
    'active',
    'negative feedback button should no longer be active after positive feedback',
  );
  assertFeedbackRequest(
    0,
    {
      type: 'recall_quality',
      targetId: 'search-feedback-message',
      targetType: 'message',
      action: 'positive',
    },
    {
      interaction: 'context_recall_feedback',
      surface: 'ask_evidence',
      action: 'positive',
      query: 'feedback query',
      scope: 'work',
      mode: 'overview',
      result_position: '1',
      visible_result_count: '1',
      total_result_count: '1',
      target_type: 'message',
      source_url_included: 'false',
      source_url_boundary: 'hidden_non_http_source',
    },
  );

  const conditionChangeResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/ask') &&
      response.request().method() === 'POST',
  );
  await page.evaluate(() => {
    window.location.hash =
      '#/search?q=changed%20feedback%20query&scope=personal';
  });
  await conditionChangeResponse;
  await resultCard.getByText('Search feedback memory').waitFor({
    timeout: 10000,
  });
  assert.equal(
    askRequests.at(-1)?.query,
    'changed feedback query',
    'route change should first rerun the page with the changed query',
  );
  assert.equal(
    askRequests.at(-1)?.scope,
    'personal',
    'route change should first rerun the page with the changed scope',
  );
  await resultCard
    .getByText('反馈时条件；当前页条件已变化')
    .waitFor({ timeout: 10000 });
  await resultCard
    .getByText('当前条件已变化，重新取证仍会按反馈时 query 和范围重新请求 Memory Service。')
    .waitFor({ timeout: 10000 });
  await assertBoundaryAttribute(
    negativeButton,
    [
      '不相关反馈',
      '本次查询：“changed feedback query”，第 1/1 条',
      '不做全局排除',
    ],
    'feedback button should describe the current click conditions after route changes',
  );
  await assertBoundaryAttribute(
    refreshEvidenceButton,
    [
      '用同一条件重新取证',
      'query 为「feedback query」',
      '范围为工作记忆',
    ],
    'feedback refresh button should keep the feedback-time rerun conditions',
  );

  const askCountBeforeRefresh = askRequests.length;
  const refreshResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/ask') &&
      response.request().method() === 'POST',
  );
  await refreshEvidenceButton.click();
  await refreshResponse;
  assert.equal(
    askRequests.length,
    askCountBeforeRefresh + 1,
    'feedback refresh action should rerun the current search once',
  );
  assert.equal(
    askRequests.at(-1)?.query,
    'feedback query',
    'feedback refresh action should preserve the current query',
  );
  assert.equal(
    askRequests.at(-1)?.scope,
    'work',
    'feedback refresh action should preserve the current scope',
  );
  await resultCard.getByText('已记录为有用').waitFor({ timeout: 10000 });

  await negativeButton.click();
  await resultCard.getByText('已记录为不相关').waitFor({ timeout: 10000 });
  await resultCard.getByText('不相关修正范围').waitFor({ timeout: 10000 });
  await resultCard
    .getByText('只降低相近场景排序，不删除这条记忆。')
    .waitFor({ timeout: 10000 });
  await resultCard
    .getByText('服务端已创建相近场景修正：同类场景会隐藏或降权这条结果。')
    .waitFor({ timeout: 10000 });
  await resultCard
    .getByText('当前页不会即时重排；重新取证会用同一 query 和范围重新请求 Memory Service。')
    .waitFor({ timeout: 10000 });
  await resultCard
    .getByText('排序信号已降低显著性 10%，只影响后续召回排序。')
    .waitFor({ timeout: 10000 });
  await assertClass(
    resultCard.locator('.feedback-status'),
    'feedback-status-negative',
    'negative feedback status should use negative tone after change',
  );
  await assertClass(
    negativeButton,
    'active',
    'negative feedback button should become active after change',
  );
  assertFeedbackRequest(
    1,
    {
      type: 'recall_quality',
      targetId: 'search-feedback-message',
      targetType: 'message',
      action: 'negative',
    },
    {
      interaction: 'memory_relevance_trainer',
      surface: 'ask_evidence',
      action: 'negative',
      feedback_reason: 'ask_evidence_mismatch',
      auto_applied: 'true',
      target_type: 'message',
    },
  );

  const clearFeedbackButton = resultCard.getByRole('button', {
    name: /撤销反馈：移除「Search feedback memory」/,
  });
  await assertBoundaryAttribute(
    clearFeedbackButton,
    [
      '撤销反馈',
      'Search feedback memory',
      '普通召回信号',
      '不会删除记忆',
      '不会确认答案',
    ],
    'clear feedback button should expose undo boundary',
  );
  await clearFeedbackButton.click();
  await resultCard
    .locator('.feedback-status', { hasText: '已撤销反馈' })
    .waitFor({ timeout: 10000 });
  await resultCard.getByText('反馈已撤销').waitFor({ timeout: 10000 });
  await resultCard
    .getByText('后续排序回到向量、全文、图谱和时间等召回信号。')
    .waitFor({ timeout: 10000 });
  await resultCard
    .getByText('服务端已清除 1 条相近场景修正。')
    .waitFor({ timeout: 10000 });
  await resultCard
    .getByText('当前页不会即时重排；重新取证会用同一 query 和范围重新请求 Memory Service。')
    .waitFor({ timeout: 10000 });
  await assertClass(
    resultCard.locator('.feedback-status'),
    'feedback-status-cleared',
    'clear feedback status should use cleared tone',
  );
  assertFeedbackRequest(
    2,
    {
      type: 'recall_quality',
      targetId: 'search-feedback-message',
      targetType: 'message',
      action: 'clear',
    },
    {
      interaction: 'context_recall_feedback',
      surface: 'ask_evidence',
      action: 'clear',
      target_type: 'message',
    },
  );
  assert.equal(
    await resultCard
      .getByRole('button', {
        name: /撤销反馈：移除「Search feedback memory」/,
      })
      .count(),
    0,
    'clear action should return the search result to a neutral feedback state',
  );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Search feedback memory').waitFor({ timeout: 10000 });
  await resultCard.getByText('反馈范围').waitFor({ timeout: 10000 });
  await resultCard
    .getByText('Ask 证据 / 工作记忆 / 消息记忆；点击会写入 Memory Service 召回质量信号，不会删除记忆或立即重排当前页。')
    .waitFor({ timeout: 10000 });
  await resultCard
    .getByText('本次查询：“feedback query”，第 1/1 条')
    .waitFor({ timeout: 10000 });
  await resultCard
    .getByText('有用：提高这条证据在相近召回里的优先级。')
    .waitFor({ timeout: 10000 });
  await resultCard
    .getByText('不相关：可能创建相近场景修正；只降低同类场景排序，不做全局排除。')
    .waitFor({ timeout: 10000 });
  await resultCard
    .getByText('反馈不会外发、同步来源系统或确认答案；写错后可用“撤销”移除这次修正。')
    .waitFor({ timeout: 10000 });
  await assertBoundaryAttribute(
    negativeButton,
    [
      '不相关反馈',
      '本次查询：“feedback query”，第 1/1 条',
      '不做全局排除',
      '不会删除或隐藏当前记忆',
    ],
    'neutral negative feedback button should expose failure-safe pre-click boundary',
  );

  failNextFeedback = true;
  await negativeButton.click();
  await resultCard.getByText('反馈未提交').waitFor({ timeout: 10000 });
  await resultCard
    .getByText('不相关反馈没有写入服务端；没有写入新的反馈标记。')
    .waitFor({ timeout: 10000 });
  await resultCard
    .getByText('没有创建相近场景修正、没有改变显著性，也没有删除这条记忆。')
    .waitFor({ timeout: 10000 });
  await resultCard
    .getByText('请稍后重试；需要继续查证时，可先打开来源或调整搜索条件。')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await resultCard
      .getByRole('button', {
        name: /用同一条件重新取证：重新请求 Memory Service/,
      })
      .count(),
    0,
    'failed feedback should not show the post-feedback refresh action',
  );
  await assertNoClass(
    negativeButton,
    'active',
    'failed negative feedback should not leave the negative button active',
  );
  assertFeedbackRequest(
    3,
    {
      type: 'recall_quality',
      targetId: 'search-feedback-message',
      targetType: 'message',
      action: 'negative',
    },
    {
      interaction: 'memory_relevance_trainer',
      surface: 'ask_evidence',
      action: 'negative',
      feedback_reason: 'ask_evidence_mismatch',
      target_type: 'message',
    },
  );

  console.log('verify-memory-search-feedback-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
