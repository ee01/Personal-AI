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
  path.join(os.tmpdir(), 'personal-ai-ask-clarification-'),
);
const askRequests = [];
const nowSeconds = Math.floor(Date.now() / 1000);

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

      if (payload.query === '那个 API status 呢？') {
        await route.fulfill(
          jsonResponse({
            answer:
              'AI Notes API status 仍在等待 backend owner 复核，当前证据显示还没有 ready。',
            contextMatch: {
              state: 'locked',
              selectedTopic: {
                label: 'AI Notes',
                reasons: ['当前会话锚点', '近期高频'],
                anchors: ['ai-notes-api-checks'],
                roleTerms: ['backend', 'api'],
                sourceIds: ['ai-notes-thread', 'ai-notes-status-message'],
              },
            },
            answerMemory: {
              state: 'observed',
              receipt: {
                label: '活答案观察中',
                detail:
                  '首次命中这个持续状态问题，只记录 observation；不会立刻写活答案 thread。',
                tone: 'info',
                currentEvidenceCount: 1,
                priorEvidenceCount: 0,
              },
            },
            evidence: [
              {
                id: 'ask-direct-lock-ai-notes',
                type: 'message',
                content:
                  'AI Notes API status is still waiting for backend owner review and is not ready.',
                displayTitle: 'AI Notes API status',
                displayText:
                  'AI Notes API status is still waiting for backend owner review and is not ready.',
                score: 0.94,
                source: 'glip',
                sourceTitle: 'AI Notes',
                channels: ['fts'],
                timestamp: nowSeconds,
                scope: 'work',
                metadata: {
                  channels: ['fts'],
                  contextAnchorReason: 'locked_memory_context_match',
                },
              },
            ],
            resolutionState: 'complete',
            queryTimeMs: 8,
            blocks: [],
          }),
        );
        return;
      }

      if (payload.query === '2') {
        await route.fulfill(
          jsonResponse({
            answer:
              'Memory service 先把这个问题锁定到：AI Notes。原因：用户选择候选、近期高频。\n\nAI Notes 的 BE 还没有 ready，仍在等待 API checks。',
            contextMatch: {
              state: 'locked',
              selectedTopic: {
                label: 'AI Notes',
                reasons: ['用户选择候选', '近期高频'],
              },
            },
            answerMemory: {
              state: 'priorHit',
              receipt: {
                label: '活答案已复核',
                detail:
                  '命中过往活答案，但旧答案只用于聚焦召回；本轮用 1 条当前证据复核。',
                tone: 'info',
                currentEvidenceCount: 1,
                priorEvidenceCount: 1,
                lastVerifiedAt: nowSeconds - 86400,
                staleAfter: nowSeconds + 86400 * 29,
              },
              authority: {
                decision: 'same_meaning_no_change',
                summary:
                  '同一组权威证据下答案语义没有变化，只记录本轮复核，不写新版本。',
                evidenceRoles: [
                  {
                    role: 'authority',
                    count: 1,
                    reason: '当前消息证据。',
                  },
                  {
                    role: 'prior',
                    count: 1,
                    reason: '旧活答案只用于对比。',
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
                id: 'ask-clarification-ai-notes',
                type: 'message',
                content:
                  'AI Notes backend BE is still pending API checks and is not ready yet.',
                displayTitle: 'AI Notes backend status',
                displayText:
                  'AI Notes backend BE is still pending API checks and is not ready yet.',
                score: 0.92,
                source: 'glip',
                sourceTitle: 'AI Notes',
                channels: ['fts'],
                timestamp: nowSeconds,
                scope: 'work',
                metadata: { channels: ['fts'] },
              },
            ],
            resolutionState: 'partial',
            missingInfo: ['需要确认 API checks 的 owner 和下一次更新时间。'],
            followUpActions: [
              {
                id: 'ask-followup-ai-notes-api-checks',
                actionType: 'delegate_openclaw',
                title: '查证 AI Notes API checks owner',
                queueStatus: 'queued',
                executionMode: 'manual',
                sourceKind: 'ask',
                sourceRefId: 'ask-clarification-ai-notes',
              },
            ],
            evidenceWatch: {
              contractId: 'watch-ai-notes-api-checks',
              state: 'active',
              label: '证据守望已建立',
              detail:
                '已命中证据守望契约，并复用队列中的外部查证；本轮没有创建重复动作。',
              subjectKey: 'ai-notes::api-checks',
              nextCheckAt: nowSeconds + 86400,
              confirmRequestId: 'confirm-ai-notes-api-checks',
              duplicateSuppressedCount: 2,
              runId: 'watch-run-ai-notes-api-checks',
              lastRunState: 'skipped_duplicate',
              lastRunSummary:
                'Ask 已复用现有 delegate_openclaw 动作，未重复创建外部查证。',
              created: false,
            },
            queryTimeMs: 9,
            blocks: [],
          }),
        );
        return;
      }

      await route.fulfill(
        jsonResponse({
          answer: [
            '这个问题可能指向多个近期话题。',
            '',
            '候选话题：',
            '1. AI Generated VBG (匹配角色词、近期高频)',
            '2. AI Notes (匹配角色词、近期高频)',
            '',
            '你可以直接回复候选序号，或补上项目 / 群组 / issue key；确认后我再继续查证状态和证据。',
          ].join('\n'),
          contextMatch: {
            state: 'ambiguous',
            userFacingSummary: '这个问题可能指向多个近期话题。',
            candidates: [
              {
                label: 'AI Generated VBG',
                reasons: ['匹配角色词', '近期高频'],
              },
              {
                label: 'AI Notes',
                reasons: ['匹配角色词', '近期高频'],
              },
            ],
          },
          answerMemory: {
            state: 'skipped',
            skipReason: 'context_ambiguous',
            receipt: {
              label: '等待话题确认',
              detail:
                '候选接近，先确认话题；本轮不写活答案 observation/thread。',
              tone: 'warning',
            },
          },
          resolutionState: 'insufficient',
          missingInfo: ['需要确认“那个 BE ready 了吗？”指的是哪个近期话题。'],
          queryTimeMs: 7,
          blocks: [],
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

  const page = await context.newPage();
  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/search?q=${encodeURIComponent(
      '那个 BE ready 了吗？',
    )}&scope=work`,
    { waitUntil: 'domcontentloaded' },
  );

  await page.getByText('Ask 话题待确认').waitFor({ timeout: 10000 });
  const candidateReceipt = page.getByLabel('Ask 候选选择回执');
  await candidateReceipt
    .getByText('选择候选只是把本轮短问句绑定到对应话题后继续 Ask')
    .waitFor({ timeout: 10000 });
  await candidateReceipt.getByText('候选 2').waitFor({ timeout: 10000 });
  await candidateReceipt.getByText('无外部动作').waitFor({ timeout: 10000 });
  const candidateReceiptBox = await candidateReceipt.boundingBox();
  const candidateButtonBox = await page
    .getByRole('button', { name: /2\s+AI Notes/ })
    .boundingBox();
  assert.ok(candidateReceiptBox, 'Ask candidate receipt should be visible');
  assert.ok(candidateButtonBox, 'Ask candidate button should be visible');
  assert.ok(
    candidateReceiptBox.y < candidateButtonBox.y,
    'Ask candidate receipt should render before candidate actions',
  );
  await page
    .getByRole('button', { name: /2\s+AI Notes/ })
    .click();
  await page.getByText('AI Notes 的 BE 还没有 ready').waitFor({
    timeout: 10000,
  });
  const statusRail = page.getByLabel('Ask 本轮状态');
  await statusRail.getByText('状态 部分回答').waitFor({ timeout: 10000 });
  await statusRail
    .getByText('同一组当前权威证据下答案语义未变化')
    .waitFor({ timeout: 10000 });
  await statusRail
    .getByText('不写新版本')
    .waitFor({ timeout: 10000 });
  await statusRail.getByText('上次复核').waitFor({ timeout: 10000 });
  await statusRail.getByText('下次复核').waitFor({ timeout: 10000 });
  await statusRail
    .getByText('不会自动确认结论、代表你发消息或执行外部写入')
    .waitFor({ timeout: 10000 });
  await statusRail.getByText('守望复用队列').waitFor({ timeout: 10000 });
  await statusRail.getByText('守望确认项').waitFor({ timeout: 10000 });
  const continuationReceipt = page.getByLabel('Ask 承接候选回执');
  await continuationReceipt
    .getByText('承接上一轮短问句“那个 BE ready 了吗？”')
    .waitFor({ timeout: 10000 });
  await continuationReceipt
    .getByText('按你选择的“AI Notes”继续检索')
    .waitFor({ timeout: 10000 });
  await continuationReceipt.getByText('候选 2').waitFor({ timeout: 10000 });
  await continuationReceipt
    .getByText('已带上轮上下文')
    .waitFor({ timeout: 10000 });
  await continuationReceipt
    .getByText('仍按本轮证据回答')
    .waitFor({ timeout: 10000 });
  const evidenceWatchReceipt = page.getByLabel('Ask 证据守望回执');
  await evidenceWatchReceipt
    .getByText('证据守望已建立')
    .waitFor({ timeout: 10000 });
  await evidenceWatchReceipt
    .getByText('不会自动确认事实、代表你发消息、执行外部写入')
    .waitFor({ timeout: 10000 });
  await evidenceWatchReceipt.getByText('命中已有守望').waitFor({
    timeout: 10000,
  });
  await evidenceWatchReceipt.getByText('本轮未复核来源').waitFor({
    timeout: 10000,
  });
  await evidenceWatchReceipt.getByText('run 复用队列').waitFor({
    timeout: 10000,
  });
  await evidenceWatchReceipt
    .getByText('没有重新触达权威来源')
    .waitFor({ timeout: 10000 });
  await evidenceWatchReceipt.getByText('有确认项').waitFor({
    timeout: 10000,
  });
  await evidenceWatchReceipt.getByText('已抑制重复 2').waitFor({
    timeout: 10000,
  });
  const evidenceBasisReceipt = page.getByLabel('Ask 证据来源回执');
  await evidenceBasisReceipt
    .getByText('Ask 证据来源回执')
    .waitFor({ timeout: 10000 });
  await evidenceBasisReceipt.getByText('证据 1').waitFor({ timeout: 10000 });
  await evidenceBasisReceipt.getByText('类型 1').waitFor({ timeout: 10000 });
  await evidenceBasisReceipt.getByText('来源 1').waitFor({ timeout: 10000 });
  await evidenceBasisReceipt.getByText('通道 1').waitFor({ timeout: 10000 });
  await evidenceBasisReceipt
    .getByText('Top 来源 AI Notes', { exact: true })
    .waitFor({ timeout: 10000 });
  await evidenceBasisReceipt
    .getByText('Top 通道 关键词', { exact: true })
    .waitFor({ timeout: 10000 });
  await evidenceBasisReceipt
    .getByText('不代表全库或全部连接器覆盖')
    .waitFor({ timeout: 10000 });
  await page.getByText('活答案已复核').waitFor({ timeout: 10000 });
  await page
    .getByLabel('活答案权威证据门控')
    .getByText('同证据同义复核')
    .waitFor({ timeout: 10000 });
  const activeAnswerMemoryReceipt = page.getByLabel(
    /活答案回执：活答案已复核/,
  );
  await activeAnswerMemoryReceipt.waitFor({ timeout: 10000 });
  const activeAnswerMemoryTitle =
    (await activeAnswerMemoryReceipt.getAttribute('title')) || '';
  assert.match(
    activeAnswerMemoryTitle,
    /旧 prior 1/,
    'active answer receipt title should expose prior evidence count',
  );
  assert.match(
    activeAnswerMemoryTitle,
    /下次复核/,
    'active answer receipt title should expose review time basis',
  );
  assert.match(
    activeAnswerMemoryTitle,
    /门控 同证据同义复核/,
    'active answer receipt title should expose AuthorityGate result',
  );
  assert.match(
    activeAnswerMemoryTitle,
    /不会重新确认当前事实、再次写新版本、创建外部查证动作、代表你发消息或执行外部写入/,
    'active answer receipt title should state non-effects',
  );
  await activeAnswerMemoryReceipt
    .getByText('上次复核')
    .waitFor({ timeout: 10000 });
  await activeAnswerMemoryReceipt
    .getByText('下次复核')
    .waitFor({ timeout: 10000 });
  const statusBox = await statusRail.boundingBox();
  const continuationBox = await continuationReceipt.boundingBox();
  const evidenceWatchBox = await evidenceWatchReceipt.boundingBox();
  const evidenceBasisBox = await evidenceBasisReceipt.boundingBox();
  const answerBox = await page
    .getByText('AI Notes 的 BE 还没有 ready')
    .first()
    .boundingBox();
  assert.ok(statusBox, 'Ask status rail should be visible');
  assert.ok(continuationBox, 'Ask continuation receipt should be visible');
  assert.ok(evidenceWatchBox, 'Ask evidence watch receipt should be visible');
  assert.ok(evidenceBasisBox, 'Ask evidence basis receipt should be visible');
  assert.ok(answerBox, 'Ask answer text should be visible');
  assert.ok(
    statusBox.y < answerBox.y,
    'Ask status rail should render before the answer body',
  );
  assert.ok(
    statusBox.y < continuationBox.y && continuationBox.y < answerBox.y,
    'Ask continuation receipt should render between status rail and answer body',
  );
  assert.ok(
    continuationBox.y < evidenceWatchBox.y && evidenceWatchBox.y < answerBox.y,
    'Ask evidence watch receipt should render before the answer body',
  );
  assert.ok(
    evidenceWatchBox.y < evidenceBasisBox.y && evidenceBasisBox.y < answerBox.y,
    'Ask evidence source receipt should render after watch receipt and before the answer body',
  );

  assert.equal(
    askRequests.length,
    2,
    'candidate click should issue one follow-up Ask',
  );
  assert.equal(askRequests[0].query, '那个 BE ready 了吗？');
  assert.equal(askRequests[0].scope, 'work');
  assert.equal(askRequests[1].query, '2');
  assert.equal(askRequests[1].scope, 'work');
  assert.match(
    askRequests[1].context,
    /User: 那个 BE ready 了吗？/,
    'follow-up Ask should keep the original user question',
  );
  assert.match(
    askRequests[1].context,
    /候选话题：[\s\S]*2\. AI Notes/,
    'follow-up Ask should include the previous candidate list',
  );
  assert.equal(
    await page.getByText('Ask 话题待确认').count(),
    0,
    'clarification panel should disappear after the topic is locked',
  );

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/search?q=${encodeURIComponent(
      '那个 API status 呢？',
    )}&scope=work`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.getByText('AI Notes API status 仍在等待 backend owner').waitFor({
    timeout: 10000,
  });
  const topicLockReceipt = page.getByLabel('Ask 话题锁定回执');
  await topicLockReceipt.getByText('Ask 话题锁定回执').waitFor({
    timeout: 10000,
  });
  await topicLockReceipt
    .getByText('锁定到“AI Notes”')
    .waitFor({ timeout: 10000 });
  await topicLockReceipt
    .getByText('这只是检索锚点补全，不确认事实、不写活答案')
    .waitFor({ timeout: 10000 });
  await topicLockReceipt.getByText('依据 当前会话锚点').waitFor({
    timeout: 10000,
  });
  await topicLockReceipt.getByText('锚点 ai-notes-api-checks').waitFor({
    timeout: 10000,
  });
  await topicLockReceipt.getByText('角色词 backend/api').waitFor({
    timeout: 10000,
  });
  await topicLockReceipt.getByText('来源 2').waitFor({ timeout: 10000 });
  const directEvidenceBasisReceipt = page.getByLabel('Ask 证据来源回执');
  await directEvidenceBasisReceipt
    .getByText('Top 来源 AI Notes', { exact: true })
    .waitFor({ timeout: 10000 });
  await directEvidenceBasisReceipt
    .getByText('Top 通道 关键词', { exact: true })
    .waitFor({ timeout: 10000 });
  const directStatusBox = await page.getByLabel('Ask 本轮状态').boundingBox();
  const topicLockBox = await topicLockReceipt.boundingBox();
  const directEvidenceBasisBox =
    await directEvidenceBasisReceipt.boundingBox();
  const directAnswerBox = await page
    .getByText('AI Notes API status 仍在等待 backend owner')
    .first()
    .boundingBox();
  assert.ok(
    directStatusBox,
    'direct locked Ask status rail should be visible',
  );
  assert.ok(topicLockBox, 'direct locked Ask topic receipt should be visible');
  assert.ok(
    directEvidenceBasisBox,
    'direct locked Ask evidence basis receipt should be visible',
  );
  assert.ok(directAnswerBox, 'direct locked Ask answer should be visible');
  assert.ok(
    directStatusBox.y < topicLockBox.y && topicLockBox.y < directAnswerBox.y,
    'Ask topic lock receipt should render between status rail and answer body',
  );
  assert.ok(
    topicLockBox.y < directEvidenceBasisBox.y &&
      directEvidenceBasisBox.y < directAnswerBox.y,
    'Ask evidence source receipt should render between topic lock and answer body',
  );
  assert.equal(
    askRequests.length,
    3,
    'direct locked Ask should issue one more request',
  );
  assert.equal(askRequests[2].query, '那个 API status 呢？');
  assert.equal(askRequests[2].scope, 'work');

  console.log('verify-ask-clarification-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
