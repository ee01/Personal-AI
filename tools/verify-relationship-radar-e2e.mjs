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
const assistantDraftRequests = [];
const reviewActionRequests = [];
let failNextSensitiveContextCard = true;
let failNextReviewAction = true;
let delayNextAssistantDraft = true;

function jsonResponse(body) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function jsonErrorResponse(status, body) {
  return {
    status,
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

function buildMockContextReceipt(targetPerson, options = {}) {
  const hiddenCount = options.includeSensitive ? 0 : options.hiddenCount ?? 6;
  const boundary = options.includeSensitive
    ? `复制只包含当前 ${targetPerson.name} 的关系上下文，不会写入画像、发送消息或自动刷新其他场景。已显式包含敏感上下文，外发前先复核人物身份、事实和敏感范围。`
    : hiddenCount > 0
      ? `复制只包含当前 ${targetPerson.name} 的关系上下文，不会写入画像、发送消息或自动刷新其他场景。默认隐藏敏感项；如需完整上下文，临时包含后再复核。`
      : `复制只包含当前 ${targetPerson.name} 的关系上下文，不会写入画像、发送消息或自动刷新其他场景。外发前仍需复核人物身份和事实。`;
  return {
    title: '上下文卡回执',
    rows: [
      {
        label: '生成来源',
        value: '后台整理 · 后台生成',
        tone: 'muted',
      },
      {
        label: '适用场景',
        value: '人物详情页 · 1200 token 预算',
        tone: 'muted',
      },
      {
        label: '可引用内容',
        value: `证据 ${options.evidenceCount ?? 1} · 事实 ${options.factCount ?? 1} · 跟进 ${options.openLoopCount ?? 1} · 建议 ${options.suggestionCount ?? 1}`,
        tone: 'ok',
      },
      {
        label: '隐私范围',
        value: options.includeSensitive
          ? '已临时包含敏感上下文'
          : hiddenCount > 0
            ? `默认隐藏 ${hiddenCount} 条敏感上下文`
            : '未检测到默认隐藏项',
        tone: options.includeSensitive ? 'warn' : hiddenCount > 0 ? 'ok' : 'muted',
      },
    ],
    boundary,
    generatedAt: nowSeconds,
  };
}

function renderMockContextMarkdown(targetPerson, receipt, summary) {
  return [
    `# ${targetPerson.name} 关系上下文`,
    `- ${summary}`,
    '',
    `## ${receipt.title}`,
    ...receipt.rows.map((row) => `- ${row.label}: ${row.value}`),
    `- 边界: ${receipt.boundary}`,
  ].join('\n');
}

const aliceContextReceipt = buildMockContextReceipt(person);
const bobContextReceipt = buildMockContextReceipt(secondPerson, {
  hiddenCount: 0,
  evidenceCount: 0,
  factCount: 0,
  openLoopCount: 0,
});
const sensitiveContextReceipt = buildMockContextReceipt(person, {
  includeSensitive: true,
  evidenceCount: 2,
  factCount: 2,
  openLoopCount: 2,
});

const contextCard = {
  person: {
    ...person,
    aliases: ['Alice'],
  },
  surface: 'meeting_people_brief',
  tokenBudget: 1200,
  dataQuality: 'generated',
  projectionSource: 'background',
  contextMd: renderMockContextMarkdown(
    person,
    aliceContextReceipt,
    'Demo owner needs confirmation',
  ),
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
  actionSuggestions: [
    {
      title: '先确认 demo owner',
      body:
        '推进 Relationship Radar demo 前先确认 owner 与下一步；这条 follow-up 已经出现，适合在下次同步前先发一句澄清。',
      tone: 'hot',
      reason: '来自最近的未闭环消息',
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
  contextReceipt: aliceContextReceipt,
  generatedAt: nowSeconds,
};

const secondContextCard = {
  ...contextCard,
  person: secondPerson,
  contextMd: renderMockContextMarkdown(
    secondPerson,
    bobContextReceipt,
    'Research reviewer needs agenda confirmation',
  ),
  bullets: ['9 次可见交互，覆盖 4 个活跃日'],
  knownFacts: [],
  openLoops: [],
  actionSuggestions: [
    {
      title: '先确认研究评审议程',
      body: 'Bob 的上下文还比较薄，适合先确认这次 review 关注点，再决定是否写入人物画像。',
      tone: 'warn',
      reason: '缺少明确 open loop',
    },
  ],
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
  contextReceipt: bobContextReceipt,
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
  contextReceipt: sensitiveContextReceipt,
  contextMd: renderMockContextMarkdown(
    person,
    sensitiveContextReceipt,
    'Demo owner needs confirmation with sensitive details included',
  ),
};

const assistantDraftResponse = {
  generatedAt: nowSeconds,
  personId: person.id,
  personName: person.name,
  scenario: 'follow_up_message',
  draftText:
    'Alice Radar，\n我想跟进一下：确认关系雷达 demo 的 owner\n我看到上次还留下一个点：Confirm owner before the next demo.\n你方便确认一下当前状态、下一步 owner 和预计时间吗？\n谢谢。',
  draftReceipt: {
    title: '草稿生成回执',
    rows: [
      {
        label: '生成来源',
        value: '后台整理 · 后台生成',
        tone: 'muted',
      },
      {
        label: '草稿范围',
        value: '默认隐藏 6 条敏感上下文',
        tone: 'ok',
      },
      {
        label: '可引用材料',
        value: '证据 1 · Open loop 1 · 建议 1 · 确认事实 1',
        tone: 'ok',
      },
      {
        label: '外部动作',
        value: '未发送、未写回、未建任务',
        tone: 'ok',
      },
    ],
    boundary:
      '这版只生成可编辑草稿；不会发送消息、写入人物画像、创建跟进任务或临时放开敏感上下文。默认隐藏的 6 条敏感上下文没有进入草稿。1 条待确认关系事实没有被升级为确认事实。',
    generatedAt: nowSeconds,
  },
  contextPackage: {
    generatedAt: nowSeconds,
    packageType: 'relationship_context',
    cards: [contextCard],
    retrievalBoosts: [
      {
        entityId: person.id,
        name: person.name,
        score: person.score,
        terms: contextCard.retrievalHints.boostTerms,
      },
    ],
  },
  safetyReview: {
    status: 'review_first',
    summary: '复制前先扫一遍证据、敏感隐藏和待确认事实。',
    reasons: [
      '已默认排除 6 条可能敏感的人物上下文。',
      'Alice Radar 有 1 条关系事实待人工确认。',
    ],
    evidenceCount: 1,
    openLoopCount: 1,
    actionSuggestionCount: 1,
    pendingReviewCount: 1,
    hiddenSensitiveCount: 6,
    dataQuality: 'generated',
    sensitiveIncluded: false,
  },
  contextBasis: {
    primarySuggestion: contextCard.actionSuggestions[0],
    openLoops: contextCard.openLoops,
    knownFacts: contextCard.knownFacts,
    evidenceRefs: contextCard.evidenceRefs,
    privacySummary: contextCard.privacySummary,
  },
  suggestedChecks: [
    '确认第一条 open loop 是否仍然有效，避免跟进已经关闭的事项。',
    '确认草稿不需要那些默认隐藏的敏感上下文。',
  ],
  warnings: [
    '已默认排除 6 条可能敏感的人物上下文。',
    'Alice Radar 有 1 条关系事实待人工确认。',
  ],
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

function buildReviewActionReceipt(item, action, payload = {}) {
  const noteCaptured = Boolean(payload.userNote || item.userNote);
  const evidenceCount = item.evidenceRefs?.length || 0;
  if (action === 'confirm') {
    return {
      action,
      outcome: 'profile_updated',
      title: '已确认并写入人物画像',
      summary: `${item.personName} 的 ${item.proposedKey} 已升级为确认事实。`,
      personId: item.personId,
      personName: item.personName,
      proposedKey: item.proposedKey,
      evidenceCount,
      noteCaptured,
      statusAfter: item.status,
      nextActions: [
        `已写入 ${item.proposedKey}，后续 Context Card、Meeting Brief 和 Assistant Draft 会把它当作用户确认事实读取。`,
      ],
      generatedAt: nowSeconds,
    };
  }
  if (action === 'snooze') {
    return {
      action,
      outcome: 'queued_for_later',
      title: '已排到稍后复核',
      summary: `${item.personName} 的候选事实会在 ${new Date((item.snoozeUntil || nowSeconds) * 1000).toISOString().slice(0, 10)} 后回到待确认。`,
      personId: item.personId,
      personName: item.personName,
      proposedKey: item.proposedKey,
      evidenceCount,
      noteCaptured,
      statusAfter: item.status,
      availableAt: item.snoozeUntil,
      nextActions: [
        '当前不会写入人物画像，也不会计入待确认数量。',
        '证据、编辑草稿和复核备注会保留，到期后可以继续确认或驳回。',
      ],
      generatedAt: nowSeconds,
    };
  }
  return {
    action,
    outcome: 'dismissed',
    title: '已驳回候选关系事实',
    summary: `${item.personName} 的 ${item.proposedKey} 没有写入人物画像。`,
    personId: item.personId,
    personName: item.personName,
    proposedKey: item.proposedKey,
    evidenceCount,
    noteCaptured,
    statusAfter: item.status,
    nextActions: ['这条建议不会继续出现在默认待确认队列。'],
    generatedAt: nowSeconds,
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
      if (payload.includeSensitive && failNextSensitiveContextCard) {
        failNextSensitiveContextCard = false;
        await new Promise((resolve) => setTimeout(resolve, 180));
        await route.fulfill(
          jsonErrorResponse(503, {
            error: 'Context card refresh unavailable',
          }),
        );
        return;
      }
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

    if (pathname.endsWith('/relationships/assistant/draft')) {
      const payload = request.postDataJSON();
      assistantDraftRequests.push(payload);
      if (delayNextAssistantDraft) {
        delayNextAssistantDraft = false;
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
      await route.fulfill(jsonResponse(assistantDraftResponse));
      return;
    }

    if (pathname.includes('/relationships/review-items/')) {
      const parts = pathname.split('/');
      const action = parts.at(-1);
      const id = decodeURIComponent(parts.at(-2) || '');
      const payload = request.postDataJSON();
      reviewActionRequests.push({ id, action, payload });
      if (action === 'confirm' && failNextReviewAction) {
        failNextReviewAction = false;
        await route.fulfill(
          jsonErrorResponse(503, {
            error: 'Relationship review write unavailable',
          }),
        );
        return;
      }
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
      await route.fulfill(
        jsonResponse(
          updated
            ? {
                ...updated,
                actionReceipt: buildReviewActionReceipt(updated, action, payload),
              }
            : { error: 'not found' },
        ),
      );
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
      await new Promise((resolve) => setTimeout(resolve, 160));
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
            attendeesWithEvidence: 0,
            attendeesWithOpenLoops: 0,
            evidenceRefs: 0,
            coverageNote: '已分析前 2/3 位参会人，匹配 1 位；另有 1 位未展开，需要手动补充或分批生成；1 位为弱匹配，已暂缓展开历史上下文，使用前需核对身份。',
          },
          readiness: {
            status: 'attention',
            summary: '1 位参会人未展开，1 位参会人未匹配人物记忆',
            nextActions: [
              '大型会议先按核心参会人分批生成，确认未展开名单是否需要单独准备。',
              '为 External Reviewer 补充别名，或会中先确认角色和关注点。',
              '不要把匹配结果当事实外发；先在会议中确认身份和上下文来源。',
            ],
            successCriteria: [
              '把 open loop 转成继续推进、改 owner / deadline、或明确关闭。',
              '弱匹配参会人的姓名、邮箱或别名已经人工确认。',
              '会前确认 1/3 位参会人的身份匹配是否可信。',
              '会后把 owner、deadline 和变更结论写回记忆或行动队列。',
            ],
          },
          focus: {
            title: '会前焦点',
            summary: '先核对弱匹配身份，再决定是否使用历史关系上下文。',
            items: [
              {
                label: '先核对身份',
                body: 'Alice Radar 为弱匹配，先确认姓名、邮箱或别名，再使用历史关系记忆。',
                tone: 'verify',
                attendee: 'Alice Radar',
                boundary: '身份确认前不展开历史证据、open loop 或上下文摘要。',
              },
              {
                label: '补齐覆盖',
                body: '1 位未展开（Late Observer）；External Reviewer 未匹配人物记忆。会议中先确认角色和关注点，必要时分批重新生成简报。',
                tone: 'risk',
                attendee: 'External Reviewer',
                boundary: '未覆盖参会人不会被算作已准备好，也不会伪造关系事实。',
              },
              {
                label: '会后沉淀',
                body: '会议结束后再把 owner、deadline、变更结论或新别名写回记忆/行动队列。',
                tone: 'action',
                boundary: '本简报只读；生成、查看或复制都不会发送、写入或创建任务。',
              },
            ],
          },
          sourceReceipt: {
            title: '简报来源回执',
            rows: [
              {
                label: '输入来源',
                value: '手动输入',
                tone: 'muted',
              },
              {
                label: '参会范围',
                value: '已分析前 2/3 位参会人；1 位未展开',
                tone: 'warn',
              },
              {
                label: '匹配策略',
                value: '姓名、别名、邮箱优先；1 位弱匹配已隐藏历史上下文',
                tone: 'warn',
              },
              {
                label: '证据边界',
                value: '本次没有可引用证据，不能外发为已确认事实',
                tone: 'warn',
              },
            ],
            boundary: '默认使用不含敏感上下文的人物卡；复制、外发或行动前仍需人工复核身份、证据和 open loop。',
            generatedAt: nowSeconds,
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
              contextSuppressedReason: '身份待核对，已暂缓展开历史证据、open loop 和上下文摘要；先确认参会人与人物记录一致。',
              coverageState: 'thin',
              summary: '已弱匹配到 Alice Radar，但历史上下文暂不展开；先核对姓名、邮箱或别名后再使用。',
              openLoops: [],
              suggestedQuestions: ['先确认 Alice Radar 是否就是 Alice Radar，再使用历史关系上下文。'],
              evidenceRefs: [],
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
              recentContext: '已弱匹配到 Alice Radar，但历史上下文暂不展开；先核对姓名、邮箱或别名后再使用。',
              openLoop: '身份待核对，暂不展开 open loop',
              suggestedAsk: '先确认 Alice Radar 是否就是 Alice Radar，再使用历史关系上下文。',
              evidenceCount: 0,
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
  const routeReceipt = page.getByLabel('雷达路线回执');
  await routeReceipt.getByText('雷达路线回执', { exact: true }).waitFor({
    timeout: 15000,
  });
  await routeReceipt.getByText('先看 Alice Radar：关系事实确认').waitFor({
    timeout: 15000,
  });
  await routeReceipt.getByText('全部雷达人物 · 2/2 位候选').waitFor({
    timeout: 15000,
  });
  await routeReceipt.getByText('1 条待确认事实', { exact: true }).waitFor({
    timeout: 15000,
  });
  await routeReceipt
    .getByText('查看、搜索、筛选和复制准备都是只读')
    .waitFor({ timeout: 15000 });
  const spotlightActionReceipt = page.getByLabel('行动前回执');
  await spotlightActionReceipt.getByText('行动前回执', { exact: true }).waitFor({
    timeout: 15000,
  });
  await spotlightActionReceipt.getByText('Alice Radar · 关系事实确认').waitFor({
    timeout: 15000,
  });
  await spotlightActionReceipt
    .getByText('先进入完整 brief，再到 Review Queue 复核事实')
    .waitFor({ timeout: 15000 });
  await spotlightActionReceipt
    .getByText('1 条事实只能在 Review Queue 确认写入')
    .waitFor({ timeout: 15000 });
  await spotlightActionReceipt
    .getByText('已加载默认隐藏敏感项的上下文卡')
    .waitFor({ timeout: 15000 });
  await spotlightActionReceipt
    .getByText('这里不会确认关系事实、写入人物画像、发送消息、创建跟进或同步外部系统')
    .waitFor({ timeout: 15000 });
  const initialSpotlightTitle = await page.locator('.spotlight h2').innerText();
  assert.match(
    initialSpotlightTitle,
    /Alice/,
    'spotlight should be a fixed priority recommendation, not an empty or selected-person title',
  );
  await page.getByPlaceholder('搜索人物、别名或描述').fill('bobby@example.com');
  await page.getByPlaceholder('搜索人物、别名或描述').press('Enter');
  await page.getByText('搜索：bobby@example.com', { exact: true }).waitFor({
    timeout: 15000,
  });
  await routeReceipt.getByText('先看 Bob Radar：近期协作上下文').waitFor({
    timeout: 15000,
  });
  await routeReceipt.getByText('搜索：bobby@example.com · 1/1 位候选').waitFor({
    timeout: 15000,
  });
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
  let contextReceipt = page.locator('.context-receipt');
  await contextReceipt.getByText('上下文卡回执', { exact: true }).waitFor({
    timeout: 15000,
  });
  await contextReceipt.getByText('后台整理 · 后台生成').waitFor({ timeout: 15000 });
  await contextReceipt.getByText('证据 1 · 事实 1 · 跟进 1 · 建议 1').waitFor({
    timeout: 15000,
  });
  await contextReceipt.getByText('默认隐藏 6 条敏感上下文').waitFor({ timeout: 15000 });
  await contextReceipt
    .getByText('不会写入画像、发送消息或自动刷新其他场景')
    .waitFor({ timeout: 15000 });
  await page.getByText('现在建议').waitFor({ timeout: 15000 });
  await page.locator('.action-card').getByText('先确认 demo owner', { exact: true }).waitFor({
    timeout: 15000,
  });
  await page
    .locator('.action-card')
    .getByText('推进 Relationship Radar demo 前先确认 owner 与下一步')
    .waitFor({ timeout: 15000 });
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
  const contextRequestReceipt = page.getByLabel('上下文卡请求回执');
  await contextRequestReceipt.getByText('上下文卡请求回执').waitFor({
    timeout: 15000,
  });
  await contextRequestReceipt
    .getByText('Alice Radar 的含敏感上下文版本正在请求中，旧快照暂未替换。')
    .waitFor({ timeout: 15000 });
  await contextRequestReceipt
    .getByText('页面仍显示上次成功生成的上下文卡快照，新请求返回前不会替换当前内容。')
    .waitFor({ timeout: 15000 });
  await contextRequestReceipt
    .getByText('敏感上下文尚未纳入；复制按钮会保持禁用，直到新卡返回。')
    .waitFor({ timeout: 15000 });
  await contextRequestReceipt.getByText('请求范围').waitFor({ timeout: 15000 });
  await contextRequestReceipt.getByText('含敏感上下文', { exact: true }).waitFor({
    timeout: 15000,
  });
  await contextRequestReceipt
    .getByText('上次快照 · 默认隐藏敏感上下文')
    .waitFor({ timeout: 15000 });
  await contextRequestReceipt
    .getByText('等待 Memory Service 返回新卡')
    .waitFor({ timeout: 15000 });
  assert.equal(
    await page.getByRole('button', { name: '请求中' }).isDisabled(),
    true,
    'context copy should stay disabled while a new privacy scope is pending',
  );
  await page.getByText('6 条可能敏感的人物上下文默认未纳入').waitFor({
    timeout: 15000,
  });
  const contextRefreshReceipt = page.getByLabel('上下文卡刷新失败回执');
  await contextRefreshReceipt.getByText('上下文卡刷新失败回执').waitFor({
    timeout: 15000,
  });
  await contextRefreshReceipt
    .getByText('Alice Radar 的上下文刷新失败，已保留上次快照。')
    .waitFor({ timeout: 15000 });
  await contextRefreshReceipt
    .getByText('当前状态未确认；页面仍显示上次成功生成的上下文卡快照。')
    .waitFor({ timeout: 15000 });
  await contextRefreshReceipt
    .getByText('临时包含敏感上下文没有成功，当前仍是默认隐藏敏感上下文的快照。')
    .waitFor({ timeout: 15000 });
  await contextRefreshReceipt.getByText('Context card refresh unavailable').waitFor({
    timeout: 15000,
  });
  await contextRefreshReceipt.getByText('上次快照 · 默认隐藏敏感上下文').waitFor({
    timeout: 15000,
  });
  await contextRefreshReceipt.getByText('请求范围').waitFor({ timeout: 15000 });
  await contextRefreshReceipt.getByText('含敏感上下文', { exact: true }).waitFor({
    timeout: 15000,
  });
  await expectNotVisible(page, 'private_email');
  await page.getByRole('button', { name: '临时包含敏感上下文' }).waitFor({
    timeout: 15000,
  });
  await page.getByRole('button', { name: '复制当前上下文' }).click();
  await page.getByText('已复制上次上下文快照，外发前请复核').waitFor({
    timeout: 15000,
  });
  assert.deepEqual(
    await page.evaluate(() => window.__relationshipRadarClipboardWrites.at(-1)),
    contextCard.contextMd,
    'failed include-sensitive refresh should preserve and copy the last redacted context snapshot',
  );
  await page.getByRole('button', { name: '临时包含敏感上下文' }).click();
  await page.locator('.privacy-strip').getByText('已临时包含敏感上下文').waitFor({
    timeout: 15000,
  });
  await expectNotVisible(page, '上下文卡刷新失败回执');
  await contextReceipt.getByText('已显式包含敏感上下文').waitFor({ timeout: 15000 });
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
  assert.match(
    await page.evaluate(() => window.__relationshipRadarClipboardWrites.at(-1)),
    /## 上下文卡回执[\s\S]*隐私范围: 已临时包含敏感上下文/,
    'copied context card should preserve the context receipt',
  );
  await page.getByRole('button', { name: '恢复默认隐藏' }).click();
  await page.locator('.privacy-strip').getByText('已隐藏敏感上下文').waitFor({
    timeout: 15000,
  });
  await expectNotVisible(page, 'private_email');
  await page
    .getByLabel('关系雷达详情')
    .getByRole('button', { name: '回复助手' })
    .click();
  await page
    .getByPlaceholder('例如：礼貌跟进上次评审中未确认的 owner 和 deadline')
    .fill('确认关系雷达 demo 的 owner');
  await page.getByRole('button', { name: '生成关系感知回复' }).click();
  const draftRequestReceipt = page.locator('.draft-request-receipt');
  await draftRequestReceipt.getByText('草稿生成请求回执').waitFor({
    timeout: 15000,
  });
  await draftRequestReceipt
    .getByText('正在生成给 Alice Radar 的回复草稿')
    .waitFor({ timeout: 15000 });
  await draftRequestReceipt
    .getByText('当前没有上次草稿')
    .waitFor({ timeout: 15000 });
  await draftRequestReceipt
    .getByText('默认隐藏敏感上下文', { exact: true })
    .waitFor({ timeout: 15000 });
  await draftRequestReceipt
    .getByText('不会写入人物画像、发送消息、创建跟进')
    .waitFor({ timeout: 15000 });
  assert.equal(
    await page.getByRole('button', { name: '生成中' }).isDisabled(),
    true,
    'assistant draft request should lock the generate button while pending',
  );
  await page.getByText('草稿生成回执').waitFor({ timeout: 15000 });
  assert.equal(
    await draftRequestReceipt.count(),
    0,
    'assistant draft request receipt should clear after a successful response',
  );
  await page.getByText('后台整理 · 后台生成').waitFor({ timeout: 15000 });
  await page
    .getByText('默认隐藏 6 条敏感上下文', { exact: true })
    .waitFor({ timeout: 15000 });
  await page
    .getByText('证据 1 · Open loop 1 · 建议 1 · 确认事实 1')
    .waitFor({ timeout: 15000 });
  await page
    .getByText('这版只生成可编辑草稿', { exact: false })
    .waitFor({ timeout: 15000 });
  await page
    .getByText('默认隐藏的 6 条敏感上下文没有进入草稿', { exact: false })
    .waitFor({ timeout: 15000 });
  await page.getByText('先复核').waitFor({ timeout: 15000 });
  await page.getByText('证据 1', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByText('敏感隐藏 6').waitFor({ timeout: 15000 });
  await page
    .getByText('确认第一条 open loop 是否仍然有效')
    .waitFor({ timeout: 15000 });
  await page.getByText('本次依据').waitFor({ timeout: 15000 });
  await page.getByText('先确认 demo owner').waitFor({ timeout: 15000 });
  await page.getByText('Alice Radar 有 1 条关系事实待人工确认。').waitFor({
    timeout: 15000,
  });
  await page.getByRole('button', { name: '复制草稿' }).click();
  await page.getByText('已复制回复草稿').waitFor({ timeout: 15000 });
  await page.getByText('草稿复制回执').waitFor({ timeout: 15000 });
  await page
    .getByText('已复制草稿，发送前仍需复核边界')
    .waitFor({ timeout: 15000 });
  await page.getByText('仅草稿正文').waitFor({ timeout: 15000 });
  await page
    .locator('.draft-copy-receipt')
    .getByText('未发送、未写回、未建任务')
    .waitFor({ timeout: 15000 });
  await page.getByText('敏感隐藏 6 · 待确认 1').waitFor({ timeout: 15000 });
  await page
    .getByText('不会发送消息、不会写入人物画像，也不会创建跟进任务')
    .waitFor({ timeout: 15000 });
  assert.deepEqual(
    await page.evaluate(() => window.__relationshipRadarClipboardWrites.at(-1)),
    assistantDraftResponse.draftText,
    'assistant draft copy should copy only the generated draft text',
  );
  await page.getByPlaceholder('搜索人物、别名或描述').fill('bobby@example.com');
  await page.getByPlaceholder('搜索人物、别名或描述').press('Enter');
  await page.getByText('Bob 的沟通前 brief').waitFor({ timeout: 15000 });
  await page.getByText('人物切换回执').waitFor({ timeout: 15000 });
  await page.getByText('已切换到 Bob Radar').waitFor({ timeout: 15000 });
  await page
    .getByText('上一位人物的会议简报、回复草稿和复制回执已清空')
    .waitFor({ timeout: 15000 });
  await expectNotVisible(page, 'Alice Radar，');
  await expectNotVisible(page, '草稿复制回执');
  await page.getByRole('button', { name: '清空筛选' }).click();
  await page.locator('.person-card').filter({ hasText: 'Alice Radar' }).waitFor({
    timeout: 15000,
  });
  await page.locator('.person-card').filter({ hasText: 'Alice Radar' }).click();
  await page.getByText('Alice 的沟通前 brief').waitFor({ timeout: 15000 });
  const sideReview = page.locator('.side-review').filter({ hasText: 'Alice Radar' });
  await sideReview.getByText('18 次可见交互').waitFor({ timeout: 15000 });
  await page
    .getByText('侧栏只显示候选摘要；确认写入前先进入完整复核卡查看证据、字段和可编辑内容。')
    .waitFor({ timeout: 15000 });
  await sideReview.getByRole('button', { name: '进入复核' }).click();
  await page.getByText('校准影响预览').waitFor({ timeout: 15000 });
  await page.getByText('确认会把当前写入内容保存到 Alice Radar 的 relationship_context').waitFor({
    timeout: 15000,
  });
  await page.getByText('写入草稿待复核').waitFor({ timeout: 15000 });
  await page
    .getByText('点击确认、稍后或驳回前，不会自动保存到 Memory Service')
    .waitFor({ timeout: 15000 });
  assert.equal(
    reviewActionRequests.length,
    0,
    'opening the full review card from the sidebar should not write profile facts',
  );
  await page.getByText('1 条待确认', { exact: true }).waitFor({
    timeout: 15000,
  });
  await page.getByText('Alice Radar · relationship_context').waitFor({ timeout: 15000 });
  await page.getByText('高优先级').waitFor({ timeout: 15000 });
  await page.locator('.review-card').getByText('置信度 86%').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '消息证据' }).waitFor({ timeout: 15000 });
  await page.getByLabel('建议写入内容').fill('Alice Radar owns the review queue polish.');
  await page.getByLabel('复核备注').fill('Evidence checked before snoozing.');
  await page.getByText('本页草稿未写入').waitFor({ timeout: 15000 });
  await page.getByText('当前只改了本页草稿（写入内容、复核备注）').waitFor({
    timeout: 15000,
  });
  await page.getByText('尚未写入 Memory Service').waitFor({ timeout: 15000 });
  await page.locator('.review-card').getByRole('button', { name: '确认' }).click();
  const reviewFailureReceipt = page.locator('.detail-main .review-receipt.danger');
  await reviewFailureReceipt.getByText('校准失败回执').waitFor({ timeout: 15000 });
  await reviewFailureReceipt.getByText('确认未完成，人物画像未写入').waitFor({ timeout: 15000 });
  await reviewFailureReceipt.getByText('Relationship review write unavailable').waitFor({
    timeout: 15000,
  });
  await reviewFailureReceipt.getByText('本次没有写入 entity_properties，也没有把候选移出队列。').waitFor({
    timeout: 15000,
  });
  await reviewFailureReceipt
    .getByText('本页编辑的写入内容和备注仍保留在当前页面，修正后可以重试。')
    .waitFor({ timeout: 15000 });
  assert.equal(
    reviewItems.find((item) => item.id === 'relationship:person-alice-radar:relationship_context')
      ?.status,
    'pending',
    'failed confirm should leave the review item pending in the mocked backend state',
  );
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
  await page.getByText('校准回执').waitFor({ timeout: 15000 });
  await page.getByText('已排到稍后复核').first().waitFor({ timeout: 15000 });
  await page.getByText('证据 2').first().waitFor({ timeout: 15000 });
  await page.getByText('备注已保留').first().waitFor({ timeout: 15000 });
  await page
    .getByText('当前不会写入人物画像，也不会计入待确认数量。')
    .waitFor({ timeout: 15000 });
  const reviewReturnTicket = page.locator('.review-return-ticket');
  await reviewReturnTicket.getByText('稍后回队列凭证').waitFor({ timeout: 15000 });
  await reviewReturnTicket.getByText('已移出当前待确认').waitFor({ timeout: 15000 });
  await reviewReturnTicket.getByText('当前状态：稍后').waitFor({ timeout: 15000 });
  await reviewReturnTicket.getByText('写入内容：编辑草稿已随稍后项保留').waitFor({
    timeout: 15000,
  });
  await reviewReturnTicket.getByText('复核备注：备注已随稍后项保留').waitFor({
    timeout: 15000,
  });
  await reviewReturnTicket.getByText('证据：2 条证据保留').waitFor({ timeout: 15000 });
  await reviewReturnTicket
    .getByText('没有写入人物画像，没有确认或驳回候选事实')
    .waitFor({ timeout: 15000 });
  await page
    .locator('.detail-side .review-receipt.compact')
    .filter({ hasText: '已排到稍后复核' })
    .getByText('已移出当前待确认')
    .waitFor({ timeout: 15000 });
  await page.getByText('空筛选回执').waitFor({ timeout: 15000 });
  await page.getByText('待确认队列已读完').waitFor({ timeout: 15000 });
  await page
    .getByText('这次读取成功，当前没有待确认的关系事实')
    .waitFor({ timeout: 15000 });
  await page
    .getByText('确认写入仍只能从完整复核卡发起；当前空态不会写入人物画像。')
    .waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '查看全部状态' }).waitFor({
    timeout: 15000,
  });

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
  contextReceipt = page.locator('.context-receipt');
  await contextReceipt.getByText('未检测到默认隐藏项').waitFor({ timeout: 15000 });
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
  assert.match(
    await page.evaluate(() => window.__relationshipRadarClipboardWrites.at(-1)),
    /## 上下文卡回执[\s\S]*可引用内容: 证据 0 · 事实 0 · 跟进 0 · 建议 1/,
    'non-spotlight context copy should preserve its own receipt counts',
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

  const meetingRequestReceipt = page.getByLabel('会议简报请求回执');
  await meetingRequestReceipt
    .getByText('正在生成会前人物简报')
    .waitFor({ timeout: 15000 });
  await meetingRequestReceipt
    .getByText('正在基于「Relationship Radar review」和 3 位参会人重新生成')
    .waitFor({ timeout: 15000 });
  await meetingRequestReceipt
    .getByText('请求标题')
    .waitFor({ timeout: 15000 });
  await meetingRequestReceipt
    .getByText('3 位参会人', { exact: true })
    .waitFor({ timeout: 15000 });
  await meetingRequestReceipt
    .getByText('Alice Radar、External Reviewer、Late Observer')
    .waitFor({ timeout: 15000 });
  await meetingRequestReceipt
    .getByText('当前没有上次简报')
    .waitFor({ timeout: 15000 });
  await meetingRequestReceipt
    .getByText('不会写入人物画像、发送消息、创建跟进或同步外部系统')
    .waitFor({ timeout: 15000 });

  await page.getByText('已分析前 2/3 位参会人').first().waitFor({ timeout: 15000 });
  assert.equal(
    await meetingRequestReceipt.count(),
    0,
    'meeting request receipt should clear after a successful brief response',
  );
  await page.getByText('会前准备状态').waitFor({ timeout: 15000 });
  await page.getByText('需要补齐').waitFor({ timeout: 15000 });
  await page
    .getByText('为 External Reviewer 补充别名，或会中先确认角色和关注点。')
    .waitFor({ timeout: 15000 });
  await page
    .getByText('会后把 owner、deadline 和变更结论写回记忆或行动队列。')
    .waitFor({ timeout: 15000 });
  await page.getByText('进入会议前先看').waitFor({ timeout: 15000 });
  await page.getByText('会前焦点').waitFor({ timeout: 15000 });
  await page
    .getByText('先核对弱匹配身份，再决定是否使用历史关系上下文。')
    .waitFor({ timeout: 15000 });
  await page.getByText('先核对身份').waitFor({ timeout: 15000 });
  await page
    .getByText('身份确认前不展开历史证据、open loop 或上下文摘要。')
    .waitFor({ timeout: 15000 });
  await page.getByText('补齐覆盖').waitFor({ timeout: 15000 });
  await page
    .getByText('未覆盖参会人不会被算作已准备好，也不会伪造关系事实。')
    .waitFor({ timeout: 15000 });
  await page.getByText('未展开参会人').waitFor({ timeout: 15000 });
  await page
    .locator('.coverage-omitted')
    .getByText('Late Observer')
    .waitFor({ timeout: 15000 });
  await page.getByText('身份待核对').first().waitFor({ timeout: 15000 });
  await page
    .getByText('先确认 Alice Radar 确实对应 Alice Radar')
    .waitFor({ timeout: 15000 });
  await page
    .getByText('已暂缓展开历史证据、open loop 和上下文摘要')
    .waitFor({ timeout: 15000 });
  await page
    .getByText('历史上下文暂不展开；先核对姓名、邮箱或别名')
    .first()
    .waitFor({ timeout: 15000 });
  await page.getByText('简报来源回执').waitFor({ timeout: 15000 });
  await page.getByText('手动输入', { exact: true }).waitFor({ timeout: 15000 });
  await page
    .getByText('姓名、别名、邮箱优先；1 位弱匹配已隐藏历史上下文')
    .waitFor({ timeout: 15000 });
  await page
    .getByText('默认使用不含敏感上下文的人物卡')
    .waitFor({ timeout: 15000 });
  await page.getByText('未匹配').first().waitFor({ timeout: 15000 });
  await page.getByText('按邮箱前缀匹配，建议会中确认身份', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByText('没有找到与 external@example.com').waitFor({ timeout: 15000 });
  await expectNotVisible(page, '证据 message');
  await expectNotVisible(page, 'Confirm owner before the next demo.');
  await page.getByRole('button', { name: '复制简报' }).click();
  const copiedMeetingBrief = await page.evaluate(
    () => window.__relationshipRadarClipboardWrites.at(-1),
  );
  assert.match(
    copiedMeetingBrief,
    /上下文边界: 身份待核对，已暂缓展开历史证据/,
    'copied meeting brief should keep the identity boundary',
  );
  assert.match(
    copiedMeetingBrief,
    /简报来源回执:[\s\S]*输入来源: 手动输入[\s\S]*匹配策略: 姓名、别名、邮箱优先；1 位弱匹配已隐藏历史上下文/,
    'copied meeting brief should keep the source receipt',
  );
  assert.match(
    copiedMeetingBrief,
    /边界: 默认使用不含敏感上下文的人物卡/,
    'copied meeting brief should keep the privacy boundary',
  );
  assert.match(
    copiedMeetingBrief,
    /会前焦点:[\s\S]*先核对身份（Alice Radar）[\s\S]*身份确认前不展开历史证据/,
    'copied meeting brief should keep the pre-meeting focus identity boundary',
  );
  assert.match(
    copiedMeetingBrief,
    /补齐覆盖（External Reviewer）[\s\S]*不会伪造关系事实/,
    'copied meeting brief should keep coverage focus guidance',
  );
  assert.ok(
    !copiedMeetingBrief.includes('Confirm owner before the next demo.'),
    'copied meeting brief should not include weak-match open loops before identity is confirmed',
  );

  assert.equal(meetingBriefRequests.length, 1);
  assert.equal(
    contextCardRequests.some((payload) => payload.includeSensitive === true),
    true,
    'sensitive context card should require an explicit request',
  );
  assert.equal(assistantDraftRequests.length, 1);
  assert.deepEqual(assistantDraftRequests[0], {
    personId: person.id,
    scenario: 'follow_up_message',
    userGoal: '确认关系雷达 demo 的 owner',
  });
  assert.deepEqual(meetingBriefRequests[0].attendees, [
    { name: 'Alice Radar', email: 'alice@example.com' },
    { name: 'External Reviewer', email: 'external@example.com' },
    { name: 'Late Observer', email: 'late@example.com' },
  ]);
  assert.equal(reviewActionRequests.length, 2);
  assert.equal(reviewActionRequests[0].action, 'confirm');
  assert.equal(
    reviewActionRequests[0].payload.editedValue,
    'Alice Radar owns the review queue polish.',
  );
  assert.equal(
    reviewActionRequests[0].payload.userNote,
    'Evidence checked before snoozing.',
  );
  assert.equal(reviewActionRequests[1].action, 'snooze');
  assert.equal(
    reviewActionRequests[1].payload.editedValue,
    'Alice Radar owns the review queue polish.',
  );
  assert.equal(
    reviewActionRequests[1].payload.userNote,
    'Evidence checked before snoozing.',
  );
  assert.ok(
    reviewActionRequests[1].payload.snoozeUntil > nowSeconds,
    'snooze action should send a future due time',
  );
  assert.deepEqual(pageErrors, [], `Relationship radar page errors: ${pageErrors.join('; ')}`);

  console.log('verify-relationship-radar-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
