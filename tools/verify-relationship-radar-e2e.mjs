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
  path.join(os.tmpdir(), 'personal-ai-relationship-radar-'),
);
const nowSeconds = Math.floor(Date.now() / 1000);
const meetingBriefRequests = [];
const contextCardRequests = [];
const reviewActionRequests = [];

function jsonResponse(body) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

async function expectNotVisible(page, text) {
  const locator = page.getByText(text);
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    assert.equal(await locator.nth(index).isVisible(), false, `${text} should be hidden`);
  }
}

const person = {
  id: 'person-alice-radar',
  name: 'Alice Radar',
  aliases: ['Alice', 'alice@example.com'],
  description: 'Product partner for Relationship Radar validation',
  tags: ['product'],
  score: 0.82,
  radarState: 'core',
  interactionCount: 18,
  activeDays: 7,
  firstSeen: nowSeconds - 30 * 86400,
  lastSeen: nowSeconds - 3600,
  lastInteractionAt: nowSeconds - 3600,
  mentionCount: 18,
  confidence: 0.9,
  dataQuality: 'generated',
  projectionSource: 'background',
  generatedAt: nowSeconds,
  reason: '长期高频关系，18 次交互，7 个活跃日，最近一次今天',
  signals: {
    recent: 0.98,
    frequency: 0.45,
    breadth: 0.5,
    confirmedFacts: 1,
  },
  contextBullets: [
    '18 次可见交互，覆盖 7 个活跃日',
    '最近一次相关记忆在今天',
  ],
  evidenceCount: 4,
  reviewPendingCount: 1,
};

const evidenceRef = {
  sourceKind: 'message',
  sourceId: 'message-alice-follow-up',
  title: 'Radar Team',
  snippet: 'Alice asked to confirm the owner before the next demo.',
  timestamp: nowSeconds - 3600,
  exploreLink: '#/timeline?type=message&focus=message-alice-follow-up',
};

const sensitiveEvidenceRef = {
  sourceKind: 'message',
  sourceId: 'message-alice-private-email',
  title: 'Private note',
  snippet: 'Alice private email is alice.private@example.com.',
  timestamp: nowSeconds - 1200,
  exploreLink: '#/timeline?type=message&focus=message-alice-private-email',
};

const contextCard = {
  person: {
    ...person,
    aliases: ['Alice'],
  },
  surface: 'meeting_people_brief',
  tokenBudget: 700,
  dataQuality: 'generated',
  projectionSource: 'background',
  contextMd: '# Alice Radar 关系上下文\n- Demo owner needs confirmation',
  bullets: [
    '18 次可见交互，覆盖 7 个活跃日',
    '检索时可同时 boost：Relationship Radar',
  ],
  knownFacts: [
    {
      key: 'relationship_context',
      value: 'Product partner for Relationship Radar',
      confidence: 0.9,
      confirmed: true,
    },
  ],
  relationshipHints: [],
  openLoops: [
    {
      id: 'loop-alice-owner',
      title: 'Follow up owner',
      snippet: 'Confirm owner before the next demo.',
      timestamp: nowSeconds - 3600,
      evidenceRef,
    },
  ],
  doNotAssume: [],
  evidenceRefs: [evidenceRef],
  retrievalHints: {
    entityIds: [person.id],
    names: ['Alice Radar', 'Alice'],
    boostTerms: ['Alice Radar', 'Relationship Radar'],
    sourceTypes: ['glip'],
  },
  privacySummary: {
    sensitiveIncluded: false,
    redactedAliases: 1,
    redactedFacts: 1,
    redactedRelationshipHints: 0,
    redactedEvidenceRefs: 1,
    redactedOpenLoops: 1,
    redactedRetrievalHints: 2,
    redactionNote:
      '6 条可能敏感的人物上下文默认未纳入；只有显式 includeSensitive 才会返回。',
  },
  generatedAt: nowSeconds,
};

const sensitiveContextCard = {
  ...contextCard,
  person,
  knownFacts: [
    ...contextCard.knownFacts,
    {
      key: 'private_email',
      value: 'alice.private@example.com',
      confidence: 0.96,
      confirmed: true,
    },
  ],
  openLoops: [
    ...contextCard.openLoops,
    {
      id: 'loop-alice-private-email',
      title: 'Private email follow-up',
      snippet: 'Confirm private email before the next demo.',
      timestamp: nowSeconds - 1200,
      evidenceRef: sensitiveEvidenceRef,
    },
  ],
  evidenceRefs: [...contextCard.evidenceRefs, sensitiveEvidenceRef],
  retrievalHints: {
    entityIds: [person.id],
    names: ['Alice Radar', 'Alice', 'alice@example.com'],
    boostTerms: ['Alice Radar', 'Relationship Radar', 'alice.private@example.com'],
    sourceTypes: ['glip', 'private'],
  },
  privacySummary: {
    sensitiveIncluded: true,
    redactedAliases: 0,
    redactedFacts: 0,
    redactedRelationshipHints: 0,
    redactedEvidenceRefs: 0,
    redactedOpenLoops: 0,
    redactedRetrievalHints: 0,
  },
};

let reviewItems = [
  {
    id: 'relationship:person-alice-radar:relationship_context',
    personId: person.id,
    personName: person.name,
    itemType: 'person_context',
    proposedKey: 'relationship_context',
    title: '确认与 Alice Radar 的协作上下文',
    proposedValue:
      'Alice Radar 是高频关系对象：18 次可见交互，7 个活跃日，关系状态为 core。',
    reason:
      '达到关系雷达阈值，建议确认这个上下文是否应该进入人物画像并反哺检索。',
    confidence: 0.86,
    priority: 'high',
    evidenceRefs: [evidenceRef],
    status: 'pending',
    createdAt: nowSeconds - 300,
    updatedAt: nowSeconds - 300,
  },
];

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
  viewport: { width: 1280, height: 960 },
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

    if (pathname.endsWith('/relationships/people')) {
      await route.fulfill(
        jsonResponse({
          items: [
            {
              ...person,
              reviewPendingCount: reviewItems.filter((item) => item.status === 'pending')
                .length,
            },
          ],
          totalCandidates: 1,
          threshold: {
            minimumInteractionCount: 6,
            minimumActiveDays: 3,
            minimumScore: 0.45,
            minimumKeepCount: 8,
            strategy: 'hybrid_threshold_top_n',
          },
          generatedAt: nowSeconds,
          coverageNote: 'Mocked one-person relationship radar.',
        }),
      );
      return;
    }

    if (pathname.endsWith('/relationships/context-card')) {
      const payload = request.postDataJSON();
      contextCardRequests.push(payload);
      await route.fulfill(
        jsonResponse(payload.includeSensitive ? sensitiveContextCard : contextCard),
      );
      return;
    }

    if (pathname.includes('/relationships/review-items/')) {
      const parts = pathname.split('/');
      const action = parts.at(-1);
      const id = decodeURIComponent(parts.at(-2) || '');
      const payload = request.postDataJSON();
      reviewActionRequests.push({ id, action, payload });
      reviewItems = reviewItems.map((item) =>
        item.id === id
          ? {
              ...item,
              proposedValue: payload.editedValue || item.proposedValue,
              userNote: payload.userNote,
              snoozeUntil: action === 'snooze' ? payload.snoozeUntil : undefined,
              confirmedAt: action === 'confirm' ? nowSeconds : undefined,
              rejectedAt: action === 'reject' ? nowSeconds : undefined,
              status:
                action === 'confirm'
                  ? 'confirmed'
                  : action === 'reject'
                    ? 'rejected'
                    : 'snoozed',
              updatedAt: nowSeconds,
            }
          : item,
      );
      const updated = reviewItems.find((item) => item.id === id);
      await route.fulfill(jsonResponse(updated || { error: 'not found' }));
      return;
    }

    if (pathname.endsWith('/relationships/review-items')) {
      const status = new URL(url).searchParams.get('status') || 'pending';
      const items =
        status === 'all'
          ? reviewItems
          : reviewItems.filter((item) => item.status === status);
      await route.fulfill(
        jsonResponse({ items, total: items.length, generatedAt: nowSeconds }),
      );
      return;
    }

    if (pathname.endsWith('/relationships/graph')) {
      await route.fulfill(
        jsonResponse({
          generatedAt: nowSeconds,
          nodes: [{ id: person.id, label: person.name, type: 'Person', radarState: 'core' }],
          edges: [],
          dynamics: [],
        }),
      );
      return;
    }

    if (pathname.endsWith('/relationships/meeting-brief')) {
      const payload = request.postDataJSON();
      meetingBriefRequests.push(payload);
      await route.fulfill(
        jsonResponse({
          generatedAt: nowSeconds,
          title: payload.title || 'Meeting',
          coverage: {
            totalAttendees: 2,
            matchedAttendees: 1,
            unmatchedAttendees: 1,
            attendeesWithEvidence: 1,
            attendeesWithOpenLoops: 1,
            evidenceRefs: 1,
            coverageNote: '已匹配 1/2 位参会人；1 位需要会中确认角色或补充人物别名。',
          },
          attendees: [
            {
              displayName: 'Alice Radar',
              email: 'alice@example.com',
              personId: person.id,
              personName: person.name,
              radarState: 'core',
              dataQuality: 'generated',
              matchedBy: 'email',
              matchConfidence: 0.98,
              matchReason: '按邮箱或邮箱别名匹配',
              coverageState: 'ready',
              summary: '18 次可见交互，覆盖 7 个活跃日',
              openLoops: contextCard.openLoops,
              suggestedQuestions: ['上次提到的 owner 现在进展怎样？'],
              evidenceRefs: [evidenceRef],
            },
            {
              displayName: 'External Reviewer',
              email: 'external@example.com',
              matchedBy: 'none',
              matchConfidence: 0,
              matchReason: '没有找到与 external@example.com 或显示名匹配的 Person 记录',
              coverageState: 'missing',
              summary: '暂无已沉淀的人物上下文，会议中可先确认角色和关注点。',
              openLoops: [],
              suggestedQuestions: [
                '先确认 External Reviewer 这次会议最关心的问题是什么。',
              ],
              evidenceRefs: [],
            },
          ],
          matrix: [
            {
              person: 'Alice Radar',
              recentContext: '18 次可见交互，覆盖 7 个活跃日',
              openLoop: 'Confirm owner before the next demo.',
              suggestedAsk: '上次提到的 owner 现在进展怎样？',
              evidenceCount: 1,
              matchStatus: '按邮箱或邮箱别名匹配 · 98%',
              coverageState: 'ready',
            },
            {
              person: 'External Reviewer',
              recentContext: '暂无已沉淀的人物上下文，会议中可先确认角色和关注点。',
              openLoop: '无明确 open loop',
              suggestedAsk: '先确认 External Reviewer 这次会议最关心的问题是什么。',
              evidenceCount: 0,
              matchStatus: '未匹配',
              coverageState: 'missing',
            },
          ],
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
  const pageErrors = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error instanceof Error ? error.message : String(error));
  });

  await page.goto(`chrome-extension://${extensionId}/memory-exploring.html#/entity/Person`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByText('Relationship Memory Radar').waitFor({ timeout: 15000 });
  await page.getByText('已隐藏敏感上下文').waitFor({ timeout: 15000 });
  await page.getByText('6 条可能敏感的人物上下文默认未纳入').waitFor({
    timeout: 15000,
  });
  await page.getByRole('button', { name: '临时包含敏感上下文' }).click();
  await page.getByText('已临时包含敏感上下文').waitFor({ timeout: 15000 });
  await page.getByText('private_email').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '恢复默认隐藏' }).click();
  await page.getByText('已隐藏敏感上下文').waitFor({ timeout: 15000 });
  await expectNotVisible(page, 'private_email');
  await page
    .getByLabel('关系雷达详情')
    .getByRole('button', { name: /人工确认/ })
    .click();
  await page.getByText('1 条待确认').waitFor({ timeout: 15000 });
  await page.getByText('Alice Radar · relationship_context').waitFor({ timeout: 15000 });
  await page.getByText('高优先级').waitFor({ timeout: 15000 });
  await page.locator('.review-card').getByText('置信度 86%').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '消息证据' }).waitFor({ timeout: 15000 });
  await page.getByLabel('建议写入内容').fill('Alice Radar owns the review queue polish.');
  await page.getByLabel('复核备注').fill('Evidence checked before snoozing.');
  await page.locator('.review-card').getByRole('button', { name: '稍后 7 天' }).click();
  await page
    .getByText('当前筛选下没有关系事实需要处理。')
    .waitFor({ timeout: 15000 });

  await page
    .getByLabel('关系雷达详情')
    .getByRole('button', { name: '会议简报' })
    .click();
  await page.getByLabel('会议标题').fill('Relationship Radar review');
  await page
    .getByLabel('参会人（每行一个）')
    .fill('Alice Radar <alice@example.com>\nExternal Reviewer <external@example.com>');
  await page.getByRole('button', { name: '生成会议人物简报' }).click();

  await page.getByText('已匹配 1/2 位参会人').waitFor({ timeout: 15000 });
  await page.getByText('证据就绪').waitFor({ timeout: 15000 });
  await page.getByText('未匹配').first().waitFor({ timeout: 15000 });
  await page.getByText('按邮箱或邮箱别名匹配', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByText('没有找到与 external@example.com').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '证据 message' }).waitFor({ timeout: 15000 });

  assert.equal(meetingBriefRequests.length, 1);
  assert.equal(
    contextCardRequests.some((payload) => payload.includeSensitive === true),
    true,
    'sensitive context card should require an explicit request',
  );
  assert.deepEqual(meetingBriefRequests[0].attendees, [
    { name: 'Alice Radar', email: 'alice@example.com' },
    { name: 'External Reviewer', email: 'external@example.com' },
  ]);
  assert.equal(reviewActionRequests.length, 1);
  assert.equal(reviewActionRequests[0].action, 'snooze');
  assert.equal(
    reviewActionRequests[0].payload.editedValue,
    'Alice Radar owns the review queue polish.',
  );
  assert.equal(
    reviewActionRequests[0].payload.userNote,
    'Evidence checked before snoozing.',
  );
  assert.ok(
    reviewActionRequests[0].payload.snoozeUntil > nowSeconds,
    'snooze action should send a future due time',
  );
  assert.deepEqual(pageErrors, [], `Relationship radar page errors: ${pageErrors.join('; ')}`);

  console.log('verify-relationship-radar-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
