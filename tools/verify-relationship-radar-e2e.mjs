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

const secondPerson = {
  ...person,
  id: 'person-bob-radar',
  name: 'Bob Radar',
  aliases: ['Bob', 'bobby@example.com'],
  description: 'Research reviewer for Relationship Radar validation',
  score: 0.64,
  radarState: 'active',
  interactionCount: 9,
  activeDays: 4,
  mentionCount: 9,
  reason: '近期活跃关系，9 次交互，4 个活跃日',
  contextBullets: ['9 次可见交互，覆盖 4 个活跃日'],
  evidenceCount: 1,
  reviewPendingCount: 0,
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

const unsafeEvidenceRef = {
  sourceKind: 'relationship',
  sourceId: 'relationship-unsafe-link',
  title: 'Unsafe imported source',
  snippet: 'This evidence carries an unsafe source URL from imported data.',
  timestamp: nowSeconds - 900,
  sourceUrl: 'javascript:alert("relationship-radar")',
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

const secondContextCard = {
  ...contextCard,
  person: secondPerson,
  contextMd: '# Bob Radar 关系上下文\n- Research reviewer needs agenda confirmation',
  bullets: ['9 次可见交互，覆盖 4 个活跃日'],
  knownFacts: [],
  openLoops: [],
  evidenceRefs: [],
  retrievalHints: {
    entityIds: [secondPerson.id],
    names: ['Bob Radar', 'Bob'],
    boostTerms: ['Bob Radar', 'Relationship Radar'],
    sourceTypes: ['glip'],
  },
  privacySummary: {
    sensitiveIncluded: false,
    redactedAliases: 0,
    redactedFacts: 0,
    redactedRelationshipHints: 0,
    redactedEvidenceRefs: 0,
    redactedOpenLoops: 0,
    redactedRetrievalHints: 0,
  },
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
    evidenceRefs: [evidenceRef, unsafeEvidenceRef],
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
      const search = new URL(url).searchParams.get('search')?.trim().toLowerCase();
      const allPeople = [
        {
          ...person,
          reviewPendingCount: reviewItems.filter((item) => item.status === 'pending')
            .length,
        },
        secondPerson,
      ];
      const items = search
        ? allPeople.filter((item) =>
            [item.name, item.description, ...(item.aliases || [])]
              .filter(Boolean)
              .some((value) => value.toLowerCase().includes(search)),
          )
        : allPeople;
      await route.fulfill(
        jsonResponse({
          items,
          totalCandidates: items.length,
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
        jsonResponse(
          payload.personId === secondPerson.id
            ? secondContextCard
            : payload.includeSensitive
              ? sensitiveContextCard
              : contextCard,
        ),
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
          nodes: [
            { id: person.id, label: person.name, type: 'Person', radarState: 'core' },
            {
              id: secondPerson.id,
              label: secondPerson.name,
              type: 'Person',
              radarState: 'active',
            },
          ],
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
            totalAttendees: 3,
            processedAttendees: 2,
            matchedAttendees: 1,
            unmatchedAttendees: 1,
            omittedAttendees: 1,
            identityCheckAttendees: 1,
            attendeesWithEvidence: 1,
            attendeesWithOpenLoops: 1,
            evidenceRefs: 1,
            coverageNote: '已分析前 2/3 位参会人，匹配 1 位；另有 1 位未展开，需要手动补充或分批生成；1 位为弱匹配，使用上下文前需核对身份。',
          },
          readiness: {
            status: 'attention',
            summary: '1 位参会人未展开，1 位参会人未匹配人物记忆',
            nextActions: [
              '大型会议先按核心参会人分批生成，确认未展开名单是否需要单独准备。',
              '为 External Reviewer 补充别名，或会中先确认角色和关注点。',
              '优先确认 Alice Radar 的未闭环事项是否仍然有效。',
            ],
            successCriteria: [
              '把 open loop 转成继续推进、改 owner / deadline、或明确关闭。',
              '弱匹配参会人的姓名、邮箱或别名已经人工确认。',
              '会前确认 1/3 位参会人的身份匹配是否可信。',
              '会后把 owner、deadline 和变更结论写回记忆或行动队列。',
            ],
          },
          attendees: [
            {
              displayName: 'Alice Radar',
              email: 'alice@example.com',
              personId: person.id,
              personName: person.name,
              radarState: 'core',
              dataQuality: 'generated',
              matchedBy: 'email_local_part',
              matchConfidence: 0.72,
              matchReason: '按邮箱前缀匹配，建议会中确认身份',
              identityCheckRequired: true,
              identityCheckReason: '按邮箱前缀匹配，建议会中确认身份；先确认 Alice Radar 确实对应 Alice Radar，再使用历史上下文。',
              coverageState: 'thin',
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
              matchStatus: '按邮箱前缀匹配，建议会中确认身份 · 72%',
              coverageState: 'thin',
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
          omittedAttendees: [
            {
              displayName: 'Late Observer',
              email: 'late@example.com',
              reason: '超过前 16 位分析上限，暂未展开人物上下文。',
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
  await page.addInitScript(() => {
    window.__relationshipRadarOpenCalls = [];
    window.__relationshipRadarClipboardWrites = [];
    window.open = (url, target, features) => {
      window.__relationshipRadarOpenCalls.push({ url, target, features });
      return null;
    };
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__relationshipRadarClipboardWrites.push(text);
        },
      },
    });
  });

  await page.goto(`chrome-extension://${extensionId}/memory-exploring.html#/entity/Person`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByText('Relationship Memory Radar').waitFor({ timeout: 15000 });
  await page.getByText('现在最该关注').waitFor({ timeout: 15000 });
  const initialSpotlightTitle = await page.locator('.spotlight h2').innerText();
  assert.match(
    initialSpotlightTitle,
    /Alice/,
    'spotlight should be a fixed priority recommendation, not an empty or selected-person title',
  );
  await page.getByPlaceholder('搜索人物、别名或描述').fill('bobby@example.com');
  await page.getByPlaceholder('搜索人物、别名或描述').press('Enter');
  await page.getByText('搜索：bobby@example.com').waitFor({ timeout: 15000 });
  await page.locator('.person-card').filter({ hasText: 'Bob Radar' }).waitFor({
    timeout: 15000,
  });
  await expectNotVisible(page, 'Alice Radar · 后台整理');
  await page.getByRole('button', { name: '清空筛选' }).click();
  await page.locator('.person-card').filter({ hasText: 'Alice Radar' }).waitFor({
    timeout: 15000,
  });
  await page.locator('.person-card').filter({ hasText: 'Alice Radar' }).click();
  await page.getByText('Alice 的沟通前 brief').waitFor({ timeout: 15000 });
  await page.getByText('已隐藏敏感上下文').waitFor({ timeout: 15000 });
  await page.getByText('6 条可能敏感的人物上下文默认未纳入').waitFor({
    timeout: 15000,
  });
  await page.getByLabel('隐藏敏感上下文类型').getByText('别名 1').waitFor({
    timeout: 15000,
  });
  await page.getByLabel('隐藏敏感上下文类型').getByText('事实 1').waitFor({
    timeout: 15000,
  });
  await page.getByLabel('隐藏敏感上下文类型').getByText('证据 1').waitFor({
    timeout: 15000,
  });
  await page.getByLabel('隐藏敏感上下文类型').getByText('跟进 1').waitFor({
    timeout: 15000,
  });
  await page.getByLabel('隐藏敏感上下文类型').getByText('检索 2').waitFor({
    timeout: 15000,
  });
  await page.getByRole('button', { name: '临时包含敏感上下文' }).click();
  await page.getByText('已临时包含敏感上下文').waitFor({ timeout: 15000 });
  await page.getByText('private_email').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '复制含敏感上下文' }).click();
  await page.getByText('已复制含敏感上下文，外发前请复核').waitFor({
    timeout: 15000,
  });
  assert.deepEqual(
    await page.evaluate(() => window.__relationshipRadarClipboardWrites.at(-1)),
    sensitiveContextCard.contextMd,
    'sensitive context copy should keep a visible warning path',
  );
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
  await page.locator('.review-card').getByRole('button', { name: '关系边' }).click();
  await page
    .getByText('证据链接不可打开或已被安全策略拦截')
    .waitFor({ timeout: 15000 });
  assert.deepEqual(
    await page.evaluate(() => window.__relationshipRadarOpenCalls),
    [],
    'unsafe evidence source URLs should not open a new window',
  );
  await page.locator('.review-card').getByRole('button', { name: '稍后 7 天' }).click();
  await page
    .getByText('当前筛选下没有关系事实需要处理。')
    .waitFor({ timeout: 15000 });

  await page
    .getByLabel('关系雷达详情')
    .getByRole('button', { name: '会议简报' })
    .click();
  assert.equal(
    await page.getByLabel('参会人（每行一个）').inputValue(),
    'Alice Radar',
    'meeting brief attendees should seed from the selected person',
  );
  const spotlightTitleBeforeBobClick = await page.locator('.spotlight h2').innerText();
  await page.locator('.person-card').filter({ hasText: 'Bob Radar' }).click();
  await page.getByText('Bob 的沟通前 brief').waitFor({ timeout: 15000 });
  await page.waitForFunction(() => {
    const anchor = document.querySelector('.detail-anchor');
    const container = document.querySelector('.main-content');
    if (!anchor || !container) return false;
    const anchorRect = anchor.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offset = anchorRect.top - containerRect.top;
    return offset >= 0 && offset < 220;
  });
  assert.equal(
    await page.locator('.spotlight h2').innerText(),
    spotlightTitleBeforeBobClick,
    'selecting another person should not rewrite the first-viewport spotlight',
  );
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === '复制当前上下文',
    );
    return Boolean(button && !button.disabled);
  });
  await page.getByRole('button', { name: '复制当前上下文' }).click();
  assert.deepEqual(
    await page.evaluate(() => window.__relationshipRadarClipboardWrites.at(-1)),
    secondContextCard.contextMd,
    'selected non-spotlight person should have a direct copy path for their context card',
  );
  await page
    .getByLabel('关系雷达详情')
    .getByRole('button', { name: '会议简报' })
    .click();
  assert.equal(
    await page.getByLabel('参会人（每行一个）').inputValue(),
    'Bob Radar',
    'auto-seeded meeting attendees should follow the newly selected person',
  );
  await page.getByLabel('会议标题').fill('Relationship Radar review');
  await page
    .getByLabel('参会人（每行一个）')
    .fill(
      'Alice Radar <alice@example.com>\nExternal Reviewer <external@example.com>\nLate Observer <late@example.com>',
    );
  await page.getByRole('button', { name: '生成会议人物简报' }).click();

  await page.getByText('已分析前 2/3 位参会人').waitFor({ timeout: 15000 });
  await page.getByText('会前准备状态').waitFor({ timeout: 15000 });
  await page.getByText('需要补齐').waitFor({ timeout: 15000 });
  await page
    .getByText('为 External Reviewer 补充别名，或会中先确认角色和关注点。')
    .waitFor({ timeout: 15000 });
  await page
    .getByText('会后把 owner、deadline 和变更结论写回记忆或行动队列。')
    .waitFor({ timeout: 15000 });
  await page.getByText('未展开参会人').waitFor({ timeout: 15000 });
  await page.getByText('Late Observer').waitFor({ timeout: 15000 });
  await page.getByText('身份待核对').first().waitFor({ timeout: 15000 });
  await page
    .getByText('先确认 Alice Radar 确实对应 Alice Radar')
    .waitFor({ timeout: 15000 });
  await page.getByText('未匹配').first().waitFor({ timeout: 15000 });
  await page.getByText('按邮箱前缀匹配，建议会中确认身份', { exact: true }).waitFor({ timeout: 15000 });
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
    { name: 'Late Observer', email: 'late@example.com' },
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
