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
              state: 'observed',
              receipt: {
                label: '已记录活答案候选',
                detail:
                  '本轮用当前证据复核；候选选择只是检索锚点，不是事实确认。',
                tone: 'info',
                currentEvidenceCount: 1,
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
    .getByText('不会自动确认结论、代表你发消息、执行外部写入')
    .waitFor({ timeout: 10000 });
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
  await page.getByText('已记录活答案候选').waitFor({ timeout: 10000 });
  const statusBox = await statusRail.boundingBox();
  const continuationBox = await continuationReceipt.boundingBox();
  const answerBox = await page
    .getByText('AI Notes 的 BE 还没有 ready')
    .first()
    .boundingBox();
  assert.ok(statusBox, 'Ask status rail should be visible');
  assert.ok(continuationBox, 'Ask continuation receipt should be visible');
  assert.ok(answerBox, 'Ask answer text should be visible');
  assert.ok(
    statusBox.y < answerBox.y,
    'Ask status rail should render before the answer body',
  );
  assert.ok(
    statusBox.y < continuationBox.y && continuationBox.y < answerBox.y,
    'Ask continuation receipt should render between status rail and answer body',
  );

  assert.equal(askRequests.length, 2, 'candidate click should issue one follow-up Ask');
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

  console.log('verify-ask-clarification-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
