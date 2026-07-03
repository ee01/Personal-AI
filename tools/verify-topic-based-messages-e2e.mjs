import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const extensionPath = path.join(repoRoot, 'dist');
const userDataDir = await fs.mkdtemp(
  path.join(os.tmpdir(), 'personal-ai-topic-messages-'),
);
const now = Date.now();

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
      entities: { total: 1, byType: { Topic: 1 } },
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

function createTopicDetail() {
  return {
    id: 'topic-context-neutral',
    type: 'Topic',
    name: 'Context Neutral Topic',
    description: 'Topic with archived context messages that lack read state.',
    importance: 0.7,
    accessCount: 0,
    mentionCount: 1,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    properties: [],
    statistic: {
      conversations: 3,
      projects: 0,
      participants: 2,
      resources: 2,
    },
    readStatus: {
      isRead: true,
      unreadCount: 0,
      lastReadTime: now - 60_000,
      lastUpdateTime: now - 30_000,
    },
    unreadDiscussions: [],
    recentDataDetails: {
      conversations: [
        {
          id: 'conv-read-unknown',
          isRead: true,
          sender: 'Ada',
          groupName: 'Product Team',
          datetime: now - 30_000,
          summary: 'Read parent with archived context',
          teamUrl: '#',
          sourceUrl: 'javascript:alert(1)',
          permalink: 'https://example.com/messages/read-parent',
          contextMessages: [
            {
              id: 'ctx-unknown',
              sender: 'Ben',
              content: 'Historical note without read state',
              datetime: now - 45_000,
            },
          ],
        },
        {
          id: 'conv-context-source',
          isRead: true,
          sender: 'Chen',
          groupName: 'Product Team',
          datetime: now - 25_000,
          summary: 'Parent without direct safe source',
          teamUrl: '#',
          sourceUrl: 'file:///tmp/local-note',
          contextMessages: [
            {
              id: 'ctx-source',
              sender: 'Dana',
              content: 'Context carries the original message URL',
              sourceUrl: 'https://example.com/messages/context-source',
              datetime: now - 26_000,
            },
          ],
        },
        {
          id: 'conv-unsafe-only',
          isRead: true,
          sender: 'Eli',
          groupName: 'Security Review',
          datetime: now - 20_000,
          summary: 'Unsafe source should explain why it is hidden',
          sourceUrl: 'javascript:alert(1)',
          permalink: 'file:///tmp/topic-source',
          url: 'https://trusted.example.com:secret@evil.example/path',
          contextMessages: [],
        },
      ],
      webpages: [
        {
          id: 'web-safe-source',
          type: 'docs',
          title: 'Release source page',
          url: 'https://wiki.example.com/pages/release-source',
          visitTime: '2026-06-10 10:15',
          relevanceScore: 0.91,
          summary: 'Source page that should keep a visible destination host.',
          tags: ['release', 'source'],
        },
        {
          id: 'web-credentialed-source',
          type: 'blog',
          title: 'Credentialed archive link',
          url: 'https://workspace.example:secret@evil.example/phish',
          visitTime: '2026-06-10 10:25',
          relevanceScore: 0.44,
          summary:
            'Credentialed URLs should be hidden instead of rendered raw.',
          tags: ['unsafe'],
        },
      ],
      resources: [
        {
          id: 'resource-safe-source',
          name: 'Release runbook source',
          type: 'runbook',
          url: 'https://docs.example.com/runbook/release',
        },
        {
          id: 'resource-unsafe-source',
          name: 'Local raw note source',
          type: 'local',
          url: 'file:///tmp/raw-note.md',
        },
      ],
      projects: [],
      people: [],
      topics: [],
      jiraTickets: [],
      cooccurringEntities: [],
    },
  };
}

function createUnreadStickyTopicDetail() {
  return {
    id: 'topic-unread-sticky',
    type: 'Topic',
    name: 'Unread Sticky Topic',
    description: 'Unread filter should keep the opened discussion visible.',
    importance: 0.82,
    accessCount: 0,
    mentionCount: 1,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    properties: [],
    statistic: {
      conversations: 1,
      projects: 0,
      participants: 2,
      resources: 0,
    },
    readStatus: {
      isRead: false,
      unreadCount: 1,
      lastReadTime: null,
      lastUpdateTime: now - 30_000,
    },
    unreadDiscussions: [
      {
        id: 'unread-sticky-conv',
        text: 'Unread parent with context',
      },
    ],
    recentDataDetails: {
      conversations: [
        {
          id: 'unread-sticky-conv',
          isRead: false,
          sender: 'Ada',
          groupName: 'Product Team',
          datetime: now - 30_000,
          summary: 'Unread parent with context',
          contextMessages: [
            {
              id: 'unread-sticky-context',
              isRead: false,
              sender: 'Ben',
              content: 'Context stays visible after read sync',
              datetime: now - 45_000,
            },
          ],
        },
      ],
      webpages: [],
      resources: [],
      projects: [],
      people: [],
      topics: [],
      jiraTickets: [],
      cooccurringEntities: [],
    },
  };
}

function createLegacyContextDeepLinkTopic() {
  return {
    id: 'topic-legacy-context-link',
    type: 'Topic',
    name: 'Legacy Context Deep Link Topic',
    description: 'Imported context message can be targeted without a parent id.',
    importance: 0.78,
    accessCount: 0,
    mentionCount: 1,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    properties: [],
    statistic: {
      conversations: 1,
      projects: 0,
      participants: 2,
      resources: 0,
    },
    readStatus: {
      isRead: false,
      unreadCount: 1,
      lastReadTime: null,
      lastUpdateTime: now - 30_000,
    },
    unreadDiscussions: [
      {
        message_id: 'legacy-context-snake',
        text: 'Legacy snake case context needs review',
      },
    ],
    recentDataDetails: {
      conversations: [
        {
          isRead: true,
          sender: 'Ada',
          groupName: 'Imported Archive',
          datetime: now - 30_000,
          summary: 'Parent discussion has no stable id',
          contextMessages: [
            {
              message_id: 'legacy-context-snake',
              sourceUrl:
                'https://chat.example.com/messages/context?message_id=legacy-context-snake',
              isRead: false,
              sender: 'Ben',
              content: 'Legacy snake case context needs review',
              datetime: now - 45_000,
            },
          ],
        },
      ],
      webpages: [],
      resources: [],
      projects: [],
      people: [],
      topics: [],
      jiraTickets: [],
      cooccurringEntities: [],
    },
  };
}

function createSlackPermalinkDeepLinkTopic() {
  return {
    id: 'topic-slack-permalink-link',
    type: 'Topic',
    name: 'Slack Permalink Deep Link Topic',
    description: 'Slack timestamp query can target a permalink-only message.',
    importance: 0.81,
    accessCount: 0,
    mentionCount: 1,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    properties: [],
    statistic: {
      conversations: 1,
      projects: 0,
      participants: 2,
      resources: 0,
    },
    readStatus: {
      isRead: false,
      unreadCount: 1,
      lastReadTime: null,
      lastUpdateTime: now - 30_000,
    },
    unreadDiscussions: [
      {
        messageId: '1358546515.000008',
        text: 'Slack permalink-only context needs review',
      },
    ],
    recentDataDetails: {
      conversations: [
        {
          isRead: false,
          sender: 'Ada',
          groupName: 'Slack Archive',
          datetime: now - 30_000,
          summary: 'Slack permalink-only context needs review',
          sourceMessageId: 'p135854651500008',
          sourceUrl:
            'https://ghostbusters.slack.com/archives/C1H9RESGA/p135854651500008',
          contextMessages: [],
        },
      ],
      webpages: [],
      resources: [],
      projects: [],
      people: [],
      topics: [],
      jiraTickets: [],
      cooccurringEntities: [],
    },
  };
}

function createMuteReasonTopic() {
  return {
    id: 'topic-mute-reason',
    type: 'Topic',
    name: 'Mute Reason Topic',
    description: 'Topic with noisy unread discussions.',
    importance: 0.72,
    accessCount: 0,
    mentionCount: 1,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    properties: [],
    statistic: {
      conversations: 2,
      projects: 0,
      participants: 2,
      resources: 0,
    },
    readStatus: {
      isRead: false,
      unreadCount: 1,
      lastReadTime: null,
      lastUpdateTime: now - 30_000,
    },
    unreadDiscussions: [
      {
        messageId: 'mute-reason-msg',
        text: 'Noisy duplicate discussion',
      },
    ],
    recentDataDetails: {
      conversations: [
        {
          id: 'mute-reason-msg',
          isRead: false,
          sender: 'Ada',
          groupName: 'Product Team',
          datetime: now - 30_000,
          summary: 'Noisy duplicate discussion',
        },
      ],
      webpages: [],
      resources: [],
      projects: [],
      people: [],
      topics: [],
      jiraTickets: [],
      cooccurringEntities: [],
    },
  };
}

function createDeferUndoTopic() {
  return {
    id: 'topic-defer-undo',
    type: 'Topic',
    name: 'Defer Undo Topic',
    description: 'Topic should offer an immediate restore path after defer.',
    importance: 0.76,
    accessCount: 0,
    mentionCount: 1,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    properties: [],
    statistic: {
      conversations: 1,
      projects: 0,
      participants: 2,
      resources: 0,
    },
    readStatus: {
      isRead: false,
      unreadCount: 1,
      lastReadTime: null,
      lastUpdateTime: now - 30_000,
    },
    unreadDiscussions: [
      {
        messageId: 'defer-undo-msg',
        text: 'Need to revisit later',
      },
    ],
    recentDataDetails: {
      conversations: [
        {
          id: 'defer-undo-msg',
          isRead: false,
          sender: 'Ada',
          groupName: 'Product Team',
          datetime: now - 30_000,
          summary: 'Need to revisit later',
        },
      ],
      webpages: [],
      resources: [],
      projects: [],
      people: [],
      topics: [],
      jiraTickets: [],
      cooccurringEntities: [],
    },
  };
}

function createAutoReleaseTopic() {
  return {
    id: 'topic-auto-release',
    type: 'Topic',
    name: 'Auto Release Topic',
    description: 'Topic should return when its local defer time passes.',
    importance: 0.74,
    accessCount: 0,
    mentionCount: 1,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    properties: [],
    statistic: {
      conversations: 1,
      projects: 0,
      participants: 2,
      resources: 0,
    },
    readStatus: {
      isRead: false,
      unreadCount: 1,
      lastReadTime: null,
      lastUpdateTime: now - 30_000,
    },
    unreadDiscussions: [
      {
        messageId: 'auto-release-msg',
        text: 'Return to unread after defer expires',
      },
    ],
    recentDataDetails: {
      conversations: [
        {
          id: 'auto-release-msg',
          isRead: false,
          sender: 'Ada',
          groupName: 'Product Team',
          datetime: now - 30_000,
          summary: 'Return to unread after defer expires',
        },
      ],
      webpages: [],
      resources: [],
      projects: [],
      people: [],
      topics: [],
      jiraTickets: [],
      cooccurringEntities: [],
    },
  };
}

function createSearchOnlyTopic() {
  return {
    id: 'topic-search-only',
    type: 'Topic',
    name: 'Quiet Planning Topic',
    description: 'Name does not include the operator query.',
    importance: 0.71,
    accessCount: 0,
    mentionCount: 1,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    properties: [],
    statistic: {
      conversations: 1,
      projects: 0,
      participants: 2,
      resources: 0,
    },
    readStatus: {
      isRead: false,
      unreadCount: 1,
      lastReadTime: null,
      lastUpdateTime: now - 30_000,
    },
    unreadDiscussions: [
      {
        messageId: 'search-only-msg',
        text: 'Escalation owner is missing before ship room.',
      },
    ],
    recentDataDetails: {
      conversations: [
        {
          id: 'search-only-msg',
          isRead: false,
          sender: 'Ada',
          groupName: 'Ops Review',
          datetime: now - 30_000,
          summary: 'Pager blocker needs one more owner.',
          contextMessages: [
            {
              id: 'search-only-context',
              isRead: false,
              sender: 'Ben',
              content: 'Runbook update is needed for the rollout.',
              datetime: now - 45_000,
            },
          ],
        },
      ],
      webpages: [],
      resources: [
        {
          id: 'search-only-resource',
          name: 'Release checklist',
          url: 'https://example.com/release-checklist',
        },
      ],
      projects: [],
      people: [
        {
          id: 'person-mira',
          name: 'Mira Chen',
          role: 'Incident reviewer',
        },
      ],
      topics: [],
      jiraTickets: [],
      cooccurringEntities: [
        {
          type: 'Person',
          name: 'Casey Ops',
        },
      ],
    },
  };
}

function createRecentActionTopic() {
  return {
    id: 'topic-recent-action',
    type: 'Topic',
    name: 'Recent Action Topic',
    description: 'Recent low-volume unread should stay ahead of stale backlog.',
    importance: 0.45,
    accessCount: 0,
    mentionCount: 1,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    properties: [],
    statistic: {
      conversations: 2,
      projects: 0,
      participants: 2,
      resources: 0,
    },
    readStatus: {
      isRead: false,
      unreadCount: 1,
      lastReadTime: null,
      lastUpdateTime: now - 5 * 60_000,
    },
    unreadDiscussions: [
      {
        messageId: 'recent-action-msg',
        text: 'One recent unread needs a quick scan.',
      },
    ],
    recentDataDetails: {
      conversations: [
        {
          id: 'recent-action-msg',
          isRead: false,
          sender: 'Ada',
          groupName: 'Ops Review',
          datetime: now - 5 * 60_000,
          summary: 'One recent unread needs a quick scan.',
        },
      ],
      webpages: [],
      resources: [],
      projects: [],
      people: [],
      topics: [],
      jiraTickets: [],
      cooccurringEntities: [],
    },
  };
}

function createStaleBacklogTopic() {
  return {
    id: 'topic-stale-backlog',
    type: 'Topic',
    name: 'Stale Backlog Topic',
    description: 'Old low-importance backlog should not crowd out current work.',
    importance: 0.35,
    accessCount: 0,
    mentionCount: 1,
    status: 'active',
    createdAt: now - 14 * 86400000,
    updatedAt: now - 14 * 86400000,
    properties: [],
    statistic: {
      conversations: 18,
      projects: 0,
      participants: 4,
      resources: 0,
    },
    readStatus: {
      isRead: false,
      unreadCount: 12,
      lastReadTime: null,
      lastUpdateTime: now - 14 * 86400000,
    },
    unreadDiscussions: [
      {
        messageId: 'stale-backlog-msg',
        text: 'Old backlog item from two weeks ago.',
      },
    ],
    recentDataDetails: {
      conversations: [
        {
          id: 'stale-backlog-msg',
          isRead: false,
          sender: 'Ada',
          groupName: 'Archive Review',
          datetime: now - 14 * 86400000,
          summary: 'Old backlog item from two weeks ago.',
        },
      ],
      webpages: [],
      resources: [],
      projects: [],
      people: [],
      topics: [],
      jiraTickets: [],
      cooccurringEntities: [],
    },
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
  let topicListMode = 'success';

  await context.route('http://localhost:3210/api/v1/**', async (route) => {
    const request = route.request();
    const url = request.url();
    const pathname = new URL(url).pathname;

    if (pathname.endsWith('/entities/topic-context-neutral')) {
      await route.fulfill(jsonResponse(createTopicDetail()));
      return;
    }

    if (pathname.endsWith('/entities/topic-unread-sticky')) {
      await route.fulfill(jsonResponse(createUnreadStickyTopicDetail()));
      return;
    }

    if (pathname.endsWith('/entities/topic-legacy-context-link')) {
      await route.fulfill(jsonResponse(createLegacyContextDeepLinkTopic()));
      return;
    }

    if (pathname.endsWith('/entities/topic-slack-permalink-link')) {
      await route.fulfill(jsonResponse(createSlackPermalinkDeepLinkTopic()));
      return;
    }

    if (
      pathname.endsWith('/entities') &&
      new URL(url).searchParams.get('type') === 'Topic'
    ) {
      if (topicListMode === 'fail') {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'topic list offline' }),
        });
        return;
      }

      await route.fulfill(
        jsonResponse({
          items: [
            createDeferUndoTopic(),
            createAutoReleaseTopic(),
            createMuteReasonTopic(),
            createSearchOnlyTopic(),
            createRecentActionTopic(),
            createStaleBacklogTopic(),
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

  topicListMode = 'fail';
  await page.goto(`chrome-extension://${extensionId}/memory-exploring.html#/entity/Topic`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  const initialLoadFailure = page.locator('.topic-load-failure-empty');
  await initialLoadFailure
    .getByText('主题列表加载失败，未确认未读状态')
    .waitFor({ timeout: 10000 });
  await initialLoadFailure
    .getByText('未展示示例主题')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page.getByText('AI 工作流自动化').count(),
    0,
    'initial Topic list failure should not render generated mock topics',
  );
  topicListMode = 'success';
  await initialLoadFailure.getByRole('button', { name: /重新加载主题/ }).click({
    timeout: 10000,
  });
  await page
    .locator('[data-topic-id="topic-defer-undo"]', {
      hasText: 'Defer Undo Topic',
    })
    .waitFor({ timeout: 10000 });

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/topic/topic-context-neutral?messageId=ctx-unknown`,
    { waitUntil: 'domcontentloaded', timeout: 15000 },
  );

  await page.getByText('Context Neutral Topic').waitFor({ timeout: 10000 });
  await page
    .getByText('Read parent with archived context')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('Unsafe source should explain why it is hidden')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('Historical note without read state')
    .waitFor({ timeout: 10000 });

  const contextItem = page.locator('.context-item', {
    hasText: 'Historical note without read state',
  });
  await contextItem
    .locator('.targeted-message-badge', {
      hasText: '链接定位',
    })
    .waitFor({ timeout: 10000 });
  const neutralFocusReceipt = page.locator('.message-focus-notice.info');
  await neutralFocusReceipt.getByText('消息定位回执').waitFor({
    timeout: 10000,
  });
  await neutralFocusReceipt
    .locator('.message-focus-target-chip', { hasText: '上下文消息' })
    .waitFor({ timeout: 10000 });
  await neutralFocusReceipt
    .getByText('当前没有明确未读状态需要同步')
    .waitFor({ timeout: 10000 });
  await neutralFocusReceipt
    .getByText('定位请求：ctx-unknown；命中依据：ctx-unknown。')
    .waitFor({ timeout: 10000 });
  await neutralFocusReceipt
    .getByText('已临时切到聊天记录，并清空搜索、状态和群组筛选。')
    .waitFor({ timeout: 10000 });
  await neutralFocusReceipt
    .getByText('定位回执会保留到收起或打开新的深链')
    .waitFor({ timeout: 10000 });
  await neutralFocusReceipt.getByText('未改写已读计数').waitFor({
    timeout: 10000,
  });
  assert.equal(
    await contextItem.evaluate((node) => node.classList.contains('targeted')),
    true,
    'messageId deep links should highlight the exact context message, not only the parent discussion',
  );
  assert.equal(
    await contextItem.evaluate((node) => node.classList.contains('unread')),
    false,
    'context messages without explicit isRead=false should render neutral',
  );
  assert.equal(
    await contextItem.locator('.unread-indicator').count(),
    0,
    'neutral context messages should not show an unread dot',
  );
  await page.waitForTimeout(6500);
  assert.equal(
    await contextItem.evaluate((node) => node.classList.contains('targeted')),
    false,
    'messageId deep link highlight should fade after the timed focus window',
  );
  await neutralFocusReceipt.getByText('消息定位回执').waitFor({
    timeout: 10000,
  });
  await neutralFocusReceipt
    .getByRole('button', { name: /收起定位回执/ })
    .click({ timeout: 10000 });
  assert.equal(
    await page.locator('.message-focus-notice.info').count(),
    0,
    'success focus receipt should persist after highlight fade but remain dismissible',
  );

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/topic/topic-context-neutral?messageId=ctx-missing`,
    { waitUntil: 'domcontentloaded', timeout: 15000 },
  );
  const missingFocusReceipt = page.locator('.message-focus-notice.warning');
  await missingFocusReceipt.getByText('消息定位未完成').waitFor({
    timeout: 10000,
  });
  await missingFocusReceipt
    .getByText('当前主题详情没有返回链接里的消息')
    .waitFor({ timeout: 10000 });
  await missingFocusReceipt
    .getByText('没有标记任何消息已读，也没有改写未读计数。')
    .waitFor({ timeout: 10000 });
  await missingFocusReceipt
    .getByRole('button', { name: /查看全部聊天记录/ })
    .click({ timeout: 10000 });

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/topic/topic-context-neutral`,
    { waitUntil: 'domcontentloaded', timeout: 15000 },
  );
  await page.evaluate(() => {
    localStorage.setItem(
      'personal-ai-muted-topics-v1',
      JSON.stringify({
        'topic-context-neutral': {
          until: null,
          createdAt: Date.now(),
          reason: 'low-relevance',
        },
      }),
    );
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.getByText('Context Neutral Topic').waitFor({ timeout: 10000 });
  await page
    .locator('.muted-meta', { hasText: '已静音：低相关度' })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.topic-detail-mute-restore', { hasText: '取消静音' })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.topic-detail-action-note', {
      hasText: '本机静音仍会隐藏未来未读',
    })
    .waitFor({ timeout: 10000 });
  await page.locator('.topic-detail-mute-restore').click({ timeout: 10000 });
  const readTopicMutedStateAfterRestore = await page.evaluate(() => {
    const raw = localStorage.getItem('personal-ai-muted-topics-v1');
    return raw ? JSON.parse(raw)['topic-context-neutral'] || null : null;
  });
  assert.equal(
    readTopicMutedStateAfterRestore,
    null,
    'muted read topics should expose an in-context restore action before future unread is hidden',
  );
  assert.equal(
    await page.locator('.muted-meta').count(),
    0,
    'restoring a muted read topic should remove the muted header state',
  );

  const parentSourceLink = page.locator(
    '[data-conversation-id="conv-read-unknown"] .conversation-source-link',
  );
  await parentSourceLink.waitFor({ timeout: 10000 });
  assert.equal(
    await parentSourceLink.getAttribute('href'),
    'https://example.com/messages/read-parent',
    'placeholder or unsafe source candidates should not hide a later safe parent source',
  );
  assert.match(
    (await parentSourceLink.getAttribute('title')) || '',
    /example\.com/,
    'source link title should expose the destination host',
  );
  assert.equal(
    (
      await parentSourceLink.locator('.conversation-source-host').textContent()
    )?.trim(),
    'example.com',
    'source link should make the destination host visible without relying on hover',
  );
  const parentFilteredCandidateBadge = page.locator(
    '[data-conversation-id="conv-read-unknown"] .conversation-source-filtered',
  );
  await parentFilteredCandidateBadge.waitFor({ timeout: 10000 });
  assert.match(
    ((await parentFilteredCandidateBadge.textContent()) || '').trim(),
    /候选已过滤 · 非 http\/https/,
    'safe fallback links should still reveal that an earlier unsafe candidate was filtered',
  );
  assert.match(
    (await parentFilteredCandidateBadge.getAttribute('title')) || '',
    /来源候选.*非 http\/https/,
    'filtered-candidate badge should explain the blocked reason without exposing the raw URL',
  );

  const contextSourceLink = page.locator(
    '[data-conversation-id="conv-context-source"] .conversation-source-link',
  );
  await contextSourceLink.waitFor({ timeout: 10000 });
  assert.equal(
    await contextSourceLink.getAttribute('href'),
    'https://example.com/messages/context-source',
    'context message source should backfill the conversation source link',
  );
  assert.equal(
    (
      await contextSourceLink.locator('.conversation-source-label').textContent()
    )?.trim(),
    '上下文来源',
    'source link label should explain when the click target comes from context',
  );
  assert.equal(
    (
      await contextSourceLink.locator('.conversation-source-host').textContent()
    )?.trim(),
    'example.com',
    'context fallback source should also expose the destination host visibly',
  );
  const contextFilteredCandidateBadge = page.locator(
    '[data-conversation-id="conv-context-source"] .conversation-source-filtered',
  );
  await contextFilteredCandidateBadge.waitFor({ timeout: 10000 });
  assert.match(
    ((await contextFilteredCandidateBadge.textContent()) || '').trim(),
    /候选已过滤 · 非 http\/https/,
    'context fallback source should not swallow the blocked direct source candidate',
  );

  const hiddenSourceBadge = page.locator(
    '[data-conversation-id="conv-unsafe-only"] .conversation-source-hidden',
  );
  await hiddenSourceBadge.waitFor({ timeout: 10000 });
  assert.equal(
    ((await hiddenSourceBadge.textContent()) || '').trim(),
    '来源已隐藏 · 3 个不可信：非 http/https/包含账号信息',
    'unsafe-only candidates should render an explicit hidden-source badge with a visible count',
  );
  assert.match(
    (await hiddenSourceBadge.getAttribute('title')) || '',
    /包含账号信息/,
    'hidden-source badge should explain credentialed URL blocking',
  );
  assert.match(
    (await hiddenSourceBadge.getAttribute('title')) || '',
    /3 个不可信来源链接/,
    'hidden-source badge should expose the blocked candidate count',
  );
  assert.equal(
    await page
      .locator(
        '[data-conversation-id="conv-unsafe-only"] .conversation-source-link',
      )
      .count(),
    0,
    'unsafe-only candidates should never render a clickable source link',
  );

  await parentSourceLink.evaluate((node) => {
    node.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      }),
    );
  });
  const sourceOpenReceipt = page.locator('.source-open-receipt');
  await sourceOpenReceipt.getByText('来源打开回执').waitFor({
    timeout: 10000,
  });
  await sourceOpenReceipt
    .locator('.source-open-host', { hasText: 'example.com' })
    .waitFor({ timeout: 10000 });
  await sourceOpenReceipt
    .getByText('已请求浏览器打开消息来源：example.com。')
    .waitFor({ timeout: 10000 });
  await sourceOpenReceipt
    .getByText('只打开外部标签页，不会重新读取原始消息、网页或资源。')
    .waitFor({ timeout: 10000 });
  await sourceOpenReceipt
    .getByText(
      '不会同步 Memory Service、标记已读、确认结论或写回原始平台。',
    )
    .waitFor({ timeout: 10000 });

  await page.locator('.tab-btn', { hasText: '相关资源' }).click();
  const safeResourceCard = page.locator('.item-card', {
    hasText: 'Release runbook source',
  });
  const safeResourceLink = safeResourceCard.locator('.topic-source-link');
  await safeResourceLink.waitFor({ timeout: 10000 });
  assert.equal(
    await safeResourceLink.getAttribute('href'),
    'https://docs.example.com/runbook/release',
    'safe resource links should remain directly openable',
  );
  assert.equal(
    (await safeResourceLink.locator('.topic-source-host').textContent())?.trim(),
    'docs.example.com',
    'resource links should show the destination host without relying on hover',
  );
  const unsafeResourceCard = page.locator('.item-card', {
    hasText: 'Local raw note source',
  });
  const hiddenResourceSource = unsafeResourceCard.locator(
    '.topic-source-hidden',
  );
  await hiddenResourceSource.waitFor({ timeout: 10000 });
  assert.match(
    ((await hiddenResourceSource.textContent()) || '').trim(),
    /来源已隐藏 · 非 http\/https/,
    'unsafe resource links should explain the blocking reason',
  );
  assert.equal(
    await unsafeResourceCard.locator('.topic-source-link').count(),
    0,
    'unsafe resource links should not render as clickable',
  );

  await page.locator('.tab-btn', { hasText: '网页记录' }).click();
  const safeWebpageItem = page.locator('.webpage-item', {
    hasText: 'Release source page',
  });
  const safeWebpageLink = safeWebpageItem.locator('.topic-source-link');
  await safeWebpageLink.waitFor({ timeout: 10000 });
  assert.equal(
    await safeWebpageLink.getAttribute('href'),
    'https://wiki.example.com/pages/release-source',
    'safe webpage links should stay openable from the webpage panel',
  );
  assert.equal(
    (await safeWebpageLink.locator('.topic-source-host').textContent())?.trim(),
    'wiki.example.com',
    'webpage links should expose the destination host beside the action',
  );
  const unsafeWebpageItem = page.locator('.webpage-item', {
    hasText: 'Credentialed archive link',
  });
  const hiddenWebpageSource = unsafeWebpageItem.locator(
    '.webpage-source-hidden',
  );
  await hiddenWebpageSource.waitFor({ timeout: 10000 });
  assert.match(
    ((await hiddenWebpageSource.textContent()) || '').trim(),
    /来源已隐藏 · 包含账号信息/,
    'credentialed webpage links should explain why they are hidden',
  );
  assert.equal(
    await unsafeWebpageItem.locator('.topic-source-link').count(),
    0,
    'credentialed webpage links should not render as clickable',
  );
  assert.doesNotMatch(
    (await unsafeWebpageItem.textContent()) || '',
    /workspace\.example:secret/,
    'credentialed webpage URLs should not be rendered in clear text',
  );

  const encodedLegacyMessageLink = encodeURIComponent(
    'https://chat.example.com/messages/context?message_id=legacy-context-snake',
  );
  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/topic/topic-legacy-context-link?readFilter=unread&messageId=${encodedLegacyMessageLink}`,
    { waitUntil: 'domcontentloaded', timeout: 15000 },
  );

  await page
    .getByText('Legacy Context Deep Link Topic')
    .waitFor({ timeout: 10000 });
  await page
    .locator('.conversation-summary', {
      hasText: 'Parent discussion has no stable id',
    })
    .waitFor({ timeout: 10000 });
  const legacyContextItem = page.locator(
    '[data-conversation-id="legacy-context-snake"] .context-item',
    {
      hasText: 'Legacy snake case context needs review',
    },
  );
  await legacyContextItem
    .locator('.targeted-message-badge', {
      hasText: '链接定位',
    })
    .waitFor({ timeout: 10000 });
  assert.equal(
    await legacyContextItem.evaluate((node) =>
      node.classList.contains('targeted'),
    ),
    true,
    'messageId deep links should use a stable context id when the parent discussion has no id',
  );
  await page
    .locator('.message-focus-notice', {
      hasText: '已定位到链接里的上下文消息，并同步为已读。',
    })
    .waitFor({ timeout: 10000 });
  const legacyFocusReceipt = page.locator('.message-focus-notice.info');
  await legacyFocusReceipt.getByText('消息定位回执').waitFor({
    timeout: 10000,
  });
  await legacyFocusReceipt.getByText('已读同步走当前实体缓存路径').waitFor({
    timeout: 10000,
  });
  await legacyFocusReceipt
    .getByText(
      '定位请求：chat.example.com?message_id=legacy-context-snake；命中依据：legacy-context-snake（含 URL 参数、编码值或 Slack 别名归一化）。',
    )
    .waitFor({ timeout: 10000 });
  await legacyFocusReceipt
    .getByRole('button', { name: /撤销这次已读/ })
    .waitFor({ timeout: 10000 });
  await legacyFocusReceipt
    .getByRole('button', { name: /收起定位回执/ })
    .waitFor({ timeout: 10000 });
  await page.waitForFunction(
    () =>
      !document
        .querySelector(
          '[data-conversation-id="legacy-context-snake"] .context-item',
        )
        ?.classList.contains('unread'),
    null,
    { timeout: 10000 },
  );
  await legacyFocusReceipt
    .getByRole('button', { name: /撤销这次已读/ })
    .click({ timeout: 10000 });
  await page.waitForFunction(
    () =>
      document
        .querySelector(
          '[data-conversation-id="legacy-context-snake"] .context-item',
        )
        ?.classList.contains('unread'),
    null,
    { timeout: 10000 },
  );
  assert.equal(
    await page.locator('.message-focus-notice').count(),
    0,
    'undoing the deep-link read sync should close the focus receipt after restoring unread state',
  );

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/topic/topic-slack-permalink-link?messageId=1358546515.000008`,
    { waitUntil: 'domcontentloaded', timeout: 15000 },
  );

  await page
    .getByText('Slack Permalink Deep Link Topic')
    .waitFor({ timeout: 10000 });
  const slackPermalinkConversation = page.locator(
    '[data-conversation-id="p135854651500008"]',
    {
      hasText: 'Slack permalink-only context needs review',
    },
  );
  await slackPermalinkConversation.waitFor({ timeout: 10000 });
  assert.equal(
    await slackPermalinkConversation.evaluate((node) =>
      node.classList.contains('targeted'),
    ),
    true,
    'Slack timestamp deep links should target permalink-only conversations',
  );
  const slackPermalinkReceipt = page.locator('.message-focus-notice.info');
  await slackPermalinkReceipt
    .getByText('Slack timestamp 口径')
    .waitFor({ timeout: 10000 });
  await slackPermalinkReceipt
    .getByText('已定位到链接里的聊天记录，并同步为已读。')
    .waitFor({ timeout: 10000 });
  await slackPermalinkReceipt
    .getByText(
      '定位请求：1358546515.000008；命中依据：1358546515.000008（含 URL 参数、编码值或 Slack 别名归一化）。',
    )
    .waitFor({ timeout: 10000 });
  await page.waitForFunction(
    () =>
      !document
        .querySelector('[data-conversation-id="p135854651500008"]')
        ?.classList.contains('unread'),
    null,
    { timeout: 10000 },
  );

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/topic/topic-unread-sticky?readFilter=unread`,
    { waitUntil: 'domcontentloaded', timeout: 15000 },
  );

  await page.getByText('Unread Sticky Topic').waitFor({ timeout: 10000 });
  await page
    .getByText('Unread parent with context')
    .waitFor({ timeout: 10000 });
  const readBatchReceipt = page.locator('.topic-read-batch-receipt');
  await readBatchReceipt.getByText('阅读批次回执').waitFor({
    timeout: 10000,
  });
  await readBatchReceipt
    .locator('.topic-read-batch-mode', { hasText: '仅未读视图' })
    .waitFor({ timeout: 10000 });
  await readBatchReceipt
    .getByText('当前批次显示 1/1 条聊天；其中 1 条聊天、1 个主题未读信号仍需处理。')
    .waitFor({ timeout: 10000 });
  await readBatchReceipt
    .locator('.topic-read-batch-metrics', { hasText: '已加载 1' })
    .waitFor({ timeout: 10000 });
  await readBatchReceipt
    .locator('.topic-read-batch-metrics', { hasText: '当前显示 1' })
    .waitFor({ timeout: 10000 });
  await readBatchReceipt
    .locator('.topic-read-batch-metrics', { hasText: '明确未读聊天 1' })
    .waitFor({ timeout: 10000 });
  await readBatchReceipt
    .locator('.topic-read-batch-metrics', { hasText: '排序：未读优先' })
    .waitFor({ timeout: 10000 });
  await readBatchReceipt
    .getByText('筛选口径：仅未读视图 / 全部群组；本页搜索和群组筛选只影响当前已加载详情。')
    .waitFor({ timeout: 10000 });
  await readBatchReceipt
    .getByText('排序依据：先把明确未读聊天排在前面，同一状态保留详情返回顺序；本页不会补拉历史消息或重排后端主题。')
    .waitFor({ timeout: 10000 });
  await readBatchReceipt
    .getByText('展开上下文才会把对应消息走当前实体缓存路径标记已读；不会改写原始聊天平台。')
    .waitFor({ timeout: 10000 });
  await readBatchReceipt
    .getByText('全部已阅只更新当前主题的已知未读信号')
    .waitFor({ timeout: 10000 });

  const detailConversationSearch = page
    .locator('.tab-content.active .search-input')
    .first();
  await detailConversationSearch.fill('no matching unread batch');
  const emptyBatchRecovery = page.locator('.conversation-empty-recovery');
  await emptyBatchRecovery.getByText('空批次恢复回执').waitFor({
    timeout: 10000,
  });
  await emptyBatchRecovery
    .getByText('当前本页筛选隐藏了 1 条已加载聊天；主题仍有 1 个未读信号没有因此被标记已读。')
    .waitFor({ timeout: 10000 });
  await emptyBatchRecovery
    .getByText('本页搜索「no matching unread batch」没有命中当前已加载聊天。')
    .waitFor({ timeout: 10000 });
  await emptyBatchRecovery
    .getByText('这些操作只恢复本页阅读视图，不刷新后端、不同步 Memory Service、不改写原始聊天平台。')
    .waitFor({ timeout: 10000 });
  await emptyBatchRecovery
    .getByRole('button', { name: /恢复未读批次/ })
    .click({ timeout: 10000 });
  await page
    .getByText('Unread parent with context')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('.conversation-empty-recovery').count(),
    0,
    'restoring the unread batch should clear the empty-batch recovery receipt',
  );

  await page
    .locator('.topic-detail-action-btn', { hasText: '稍后处理' })
    .click({
      timeout: 10000,
    });
  const detailDeferBoundary = page.locator('.topic-detail-defer-boundary');
  await detailDeferBoundary.getByText('稍后处理边界').waitFor({
    timeout: 10000,
  });
  await detailDeferBoundary.getByText('不会标记已读').waitFor({
    timeout: 10000,
  });
  await detailDeferBoundary.getByText('Memory Service').waitFor({
    timeout: 10000,
  });
  await page.getByRole('menuitem', { name: /1小时后/ }).click({
    timeout: 10000,
  });
  const detailDeferUndoToast = page.locator('.topic-defer-undo-toast');
  await detailDeferUndoToast
    .getByText('已将「Unread Sticky Topic」稍后到')
    .waitFor({ timeout: 10000 });
  const detailDeferredState = await page.evaluate(() => {
    const raw = localStorage.getItem('personal-ai-deferred-topics-v1');
    return raw ? JSON.parse(raw)['topic-unread-sticky'] || null : null;
  });
  assert.ok(
    Number.isFinite(detailDeferredState?.until),
    'detail defer action should persist the current topic in local deferred state',
  );
  await page.locator('.deferred-meta', { hasText: '已稍后到' }).waitFor({
    timeout: 10000,
  });
  await page
    .locator('.topic-detail-defer-restore', { hasText: '恢复未读' })
    .waitFor({
      timeout: 10000,
    });
  await page.locator('.topic-detail-defer-restore').click({
    timeout: 10000,
  });
  const detailDeferredStateAfterRestore = await page.evaluate(() => {
    const raw = localStorage.getItem('personal-ai-deferred-topics-v1');
    return raw ? JSON.parse(raw)['topic-unread-sticky'] || null : null;
  });
  assert.equal(
    detailDeferredStateAfterRestore,
    null,
    'detail defer undo should restore the topic without leaving stale local state',
  );

  await page.locator('.topic-detail-action-btn.mute').click({
    timeout: 10000,
  });
  const detailMuteBoundary = page.locator('.topic-detail-mute-boundary');
  await detailMuteBoundary.getByText('静音边界').waitFor({
    timeout: 10000,
  });
  await detailMuteBoundary.getByText('只调整本机注意力过滤').waitFor({
    timeout: 10000,
  });
  await detailMuteBoundary.getByText('原始聊天平台').waitFor({
    timeout: 10000,
  });
  await page.getByRole('button', { name: /重复讨论/ }).click({
    timeout: 10000,
  });
  await page.getByRole('menuitem', { name: /静音1天/ }).click({
    timeout: 10000,
  });
  const detailMuteUndoToast = page.locator('.topic-mute-undo-toast');
  await detailMuteUndoToast
    .getByText('已将「Unread Sticky Topic」静音')
    .waitFor({ timeout: 10000 });
  await detailMuteUndoToast.getByText('未同步或标记已读').waitFor({
    timeout: 10000,
  });
  const detailMutedState = await page.evaluate(() => {
    const raw = localStorage.getItem('personal-ai-muted-topics-v1');
    return raw ? JSON.parse(raw)['topic-unread-sticky'] || null : null;
  });
  assert.ok(
    Number.isFinite(detailMutedState?.until),
    'detail mute action should persist the current topic in local muted state',
  );
  assert.equal(
    detailMutedState.reason,
    'duplicate-discussion',
    'detail mute action should preserve the selected mute reason',
  );
  await page
    .locator('.muted-meta', { hasText: '已静音：重复讨论' })
    .waitFor({ timeout: 10000 });
  await detailMuteUndoToast.getByRole('button', { name: /取消静音/ }).click({
    timeout: 10000,
  });
  const detailMutedStateAfterRestore = await page.evaluate(() => {
    const raw = localStorage.getItem('personal-ai-muted-topics-v1');
    return raw ? JSON.parse(raw)['topic-unread-sticky'] || null : null;
  });
  assert.equal(
    detailMutedStateAfterRestore,
    null,
    'detail mute undo should restore the topic without leaving stale local muted state',
  );

  const stickyConversation = page.locator(
    '[data-conversation-id="unread-sticky-conv"]',
  );
  await stickyConversation
    .locator('.context-indicator')
    .click({ timeout: 10000 });
  await page
    .getByText('Context stays visible after read sync')
    .waitFor({ timeout: 10000 });
  await readBatchReceipt
    .getByText('有 1 条刚展开的未读讨论被临时留在当前批次')
    .waitFor({ timeout: 10000 });
  await readBatchReceipt
    .locator('.topic-read-batch-metrics', { hasText: '暂留 1' })
    .waitFor({ timeout: 10000 });

  assert.equal(
    await stickyConversation.count(),
    1,
    'opened unread discussion should stay visible in the unread filter after read sync',
  );
  assert.equal(
    await stickyConversation.evaluate((node) =>
      node.classList.contains('unread'),
    ),
    false,
    'opened discussion should still sync to read state while staying visible',
  );

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/entity/Topic`,
    { waitUntil: 'domcontentloaded', timeout: 15000 },
  );

  const deferUndoCard = page.locator('[data-topic-id="topic-defer-undo"]');
  await deferUndoCard.getByText('Defer Undo Topic').waitFor({
    timeout: 10000,
  });
  const unreadQueueReceipt = page.locator('.topic-unread-queue-receipt');
  await unreadQueueReceipt.getByText('未读队列口径').waitFor({
    timeout: 10000,
  });
  await unreadQueueReceipt
    .getByText(/仅未读显示 \d+ 个可处理未读主题/)
    .waitFor({ timeout: 10000 });
  await unreadQueueReceipt.getByText('没有未读主题被稍后/静音隐藏').waitFor({
    timeout: 10000,
  });
  await unreadQueueReceipt
    .getByText('稍后/静音只改变本机未读流')
    .waitFor({ timeout: 10000 });

  const recentActionCard = page.locator('[data-topic-id="topic-recent-action"]');
  const staleBacklogCard = page.locator('[data-topic-id="topic-stale-backlog"]');
  await recentActionCard
    .locator('.topic-priority-reasons', { hasText: '近期更新' })
    .waitFor({ timeout: 10000 });
  await staleBacklogCard
    .locator('.topic-priority-pill', { hasText: '积压待整理' })
    .waitFor({ timeout: 10000 });
  await staleBacklogCard
    .locator('.topic-priority-reasons', { hasText: '积压超过7天' })
    .waitFor({ timeout: 10000 });
  const topicOrder = await page.locator('.topic-card').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-topic-id')),
  );
  assert.ok(
    topicOrder.indexOf('topic-recent-action') <
      topicOrder.indexOf('topic-stale-backlog'),
    'recent low-volume unread topics should rank ahead of stale low-importance backlog',
  );

  const topicSearchInput = page.locator('.search-input').first();
  await topicSearchInput.fill('pager owner');
  const searchScopeReceipt = page.locator('.topic-search-scope-receipt');
  await searchScopeReceipt.getByText('本页过滤').waitFor({
    timeout: 10000,
  });
  await searchScopeReceipt.getByText(/只查当前已加载的 \d+ 个主题/).waitFor({
    timeout: 10000,
  });
  await searchScopeReceipt.getByText('仅未读视图').waitFor({
    timeout: 10000,
  });
  const searchOnlyCard = page.locator('[data-topic-id="topic-search-only"]');
  await searchOnlyCard.getByText('Quiet Planning Topic').waitFor({
    timeout: 10000,
  });
  await searchOnlyCard.getByText('Escalation owner is missing').waitFor({
    timeout: 10000,
  });
  await searchOnlyCard.locator('.topic-participant-row').getByText('Mira Chen').waitFor({
    timeout: 10000,
  });
  await searchOnlyCard.locator('.topic-participant-row').getByText('Casey Ops').waitFor({
    timeout: 10000,
  });
  await page.waitForFunction(
    () => !document.querySelector('[data-topic-id="topic-defer-undo"]'),
    null,
    { timeout: 10000 },
  );
  assert.equal(
    await page.locator('[data-topic-id="topic-defer-undo"]').count(),
    0,
    'typing in the topic list search should hide topics that only match container names',
  );
  await topicSearchInput.fill('finance blocker');
  await page
    .locator('.empty-state', {
      hasText: '当前仅未读视图没有匹配项',
    })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.empty-state .view-toggle-btn', {
      hasText: '在全部主题里查找',
    })
    .waitFor({ timeout: 10000 });
  await topicSearchInput.fill('release-checklist');
  await searchOnlyCard.getByText('Quiet Planning Topic').waitFor({
    timeout: 10000,
  });
  await page.evaluate(() => {
    window.__topicListOpenCalls = [];
    window.open = (url, target, features) => {
      window.__topicListOpenCalls.push({
        url: String(url),
        target: String(target || ''),
        features: String(features || ''),
      });
      return null;
    };
  });
  await searchOnlyCard
    .locator('.resource-item', { hasText: 'Release checklist' })
    .click({ timeout: 10000 });
  const listSourceOpenReceipt = page.locator('.topic-list-source-open-receipt');
  await listSourceOpenReceipt.getByText('来源打开回执').waitFor({
    timeout: 10000,
  });
  await listSourceOpenReceipt
    .locator('.source-open-host', { hasText: 'example.com' })
    .waitFor({ timeout: 10000 });
  await listSourceOpenReceipt
    .getByText('已请求浏览器打开资源来源：example.com。')
    .waitFor({ timeout: 10000 });
  await listSourceOpenReceipt
    .getByText('不会同步 Memory Service、标记已读、确认结论或写回原始平台。')
    .waitFor({ timeout: 10000 });
  assert.deepEqual(
    await page.evaluate(() => window.__topicListOpenCalls),
    [
      {
        url: 'https://example.com/release-checklist',
        target: '_blank',
        features: 'noopener,noreferrer',
      },
    ],
    'list resource preview should open only the safe external URL and leave a visible no-sync receipt',
  );
  await topicSearchInput.fill('Mira Chen');
  await searchOnlyCard.getByText('Quiet Planning Topic').waitFor({
    timeout: 10000,
  });
  await page.waitForFunction(
    () => !document.querySelector('[data-topic-id="topic-recent-action"]'),
    null,
    { timeout: 10000 },
  );
  assert.equal(
    await page.locator('[data-topic-id="topic-recent-action"]').count(),
    0,
    'participant search should narrow the loaded topic list to matching people/source senders',
  );
  await topicSearchInput.fill('');

  await deferUndoCard.getByText('Defer Undo Topic').waitFor({
    timeout: 10000,
  });
  await deferUndoCard.locator('.topic-action-btn.later').click({
    timeout: 10000,
  });
  const deferBoundary = deferUndoCard.locator('.topic-defer-boundary-receipt');
  await deferBoundary.getByText('稍后处理边界').waitFor({
    timeout: 10000,
  });
  await deferBoundary.getByText('不会标记已读').waitFor({
    timeout: 10000,
  });
  await deferBoundary.getByText('Memory Service').waitFor({
    timeout: 10000,
  });
  await deferUndoCard.getByRole('menuitem', { name: /1小时后/ }).click({
    timeout: 10000,
  });
  const deferUndoToast = page.locator('.topic-defer-undo-toast');
  await deferUndoToast.getByText('已将「Defer Undo Topic」稍后到').waitFor({
    timeout: 10000,
  });
  await deferUndoToast.getByRole('button', { name: /恢复/ }).click({
    timeout: 10000,
  });
  await deferUndoCard.getByText('Defer Undo Topic').waitFor({
    timeout: 10000,
  });
  assert.equal(
    await deferUndoCard.locator('.topic-deferred-note').count(),
    0,
    'defer undo should restore the topic to the unread view without a later badge',
  );

  const autoReleaseUntil = Date.now() + 900;
  await page.evaluate((until) => {
    localStorage.setItem(
      'personal-ai-deferred-topics-v1',
      JSON.stringify({
        'topic-auto-release': {
          until,
          createdAt: Date.now(),
        },
      }),
    );
  }, autoReleaseUntil);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.locator('.view-toggle-btn', { hasText: '稍后 1' }).waitFor({
    timeout: 10000,
  });
  assert.equal(
    await page.locator('[data-topic-id="topic-auto-release"]').count(),
    0,
    'future deferred topics should be hidden from the unread view before release',
  );
  await page
    .locator('[data-topic-id="topic-auto-release"]', {
      hasText: 'Auto Release Topic',
    })
    .waitFor({ timeout: 5000 });
  const laterButtonText = (
    (await page
      .locator('.view-toggle-btn', { hasText: '稍后' })
      .textContent()) || ''
  ).replace(/\s+/g, ' ');
  assert.match(
    laterButtonText,
    /稍后\s*$/,
    'expired deferred topics should be pruned from the Later count without another user interaction',
  );

  const muteReasonCard = page.locator('[data-topic-id="topic-mute-reason"]');
  await muteReasonCard
    .getByText('Mute Reason Topic')
    .waitFor({ timeout: 10000 });
  await muteReasonCard.locator('.topic-action-btn.mute').click({
    timeout: 10000,
  });
  await muteReasonCard
    .locator('.topic-mute-boundary-receipt')
    .getByText('静音边界')
    .waitFor({ timeout: 10000 });
  await muteReasonCard
    .locator('.topic-mute-boundary-receipt')
    .getByText('只调整本机未读流和降噪过滤')
    .waitFor({ timeout: 10000 });
  await muteReasonCard.getByRole('button', { name: /低相关度/ }).click({
    timeout: 10000,
  });
  await muteReasonCard.getByRole('menuitem', { name: /静音1天/ }).click({
    timeout: 10000,
  });
  const muteUndoToast = page.locator('.topic-mute-undo-toast');
  await muteUndoToast.getByText('已将「Mute Reason Topic」静音').waitFor({
    timeout: 10000,
  });
  await muteUndoToast.getByText('未同步或标记已读').waitFor({
    timeout: 10000,
  });
  await muteUndoToast.getByRole('button', { name: /取消静音/ }).click({
    timeout: 10000,
  });
  await muteReasonCard.getByText('Mute Reason Topic').waitFor({
    timeout: 10000,
  });
  assert.equal(
    await muteReasonCard.locator('.topic-muted-note').count(),
    0,
    'mute undo should restore the topic to the unread view without switching to the muted filter',
  );

  await muteReasonCard.locator('.topic-action-btn.mute').click({
    timeout: 10000,
  });
  await muteReasonCard.getByRole('button', { name: /低相关度/ }).click({
    timeout: 10000,
  });
  await muteReasonCard.getByRole('menuitem', { name: /静音1天/ }).click({
    timeout: 10000,
  });
  await page.waitForTimeout(450);
  await page.locator('.view-toggle-btn', { hasText: '静音' }).click({
    timeout: 10000,
  });
  await page
    .locator('[data-topic-id="topic-mute-reason"] .topic-muted-note', {
      hasText: '已静音：低相关度',
    })
    .waitFor({ timeout: 10000 });
  await page
    .locator('[data-topic-id="topic-mute-reason"] .topic-muted-note-detail', {
      hasText: '未读保留在本机静音视图',
    })
    .waitFor({ timeout: 10000 });
  await page
    .locator('[data-topic-id="topic-mute-reason"] .topic-muted-note-detail', {
      hasText: '点「取消静音」回到未读流',
    })
    .waitFor({ timeout: 10000 });

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.locator('.view-toggle-btn', { hasText: '静音' }).click({
    timeout: 10000,
  });
  await page
    .locator('[data-topic-id="topic-mute-reason"] .topic-muted-note', {
      hasText: '已静音：低相关度',
    })
    .waitFor({ timeout: 10000 });
  await page
    .locator('[data-topic-id="topic-mute-reason"] .topic-muted-note-detail', {
      hasText: '未同步、未标记已读',
    })
    .waitFor({ timeout: 10000 });

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/entity/Topic`,
    { waitUntil: 'domcontentloaded', timeout: 15000 },
  );
  const hiddenUntil = Date.now() + 60 * 60 * 1000;
  await page.evaluate((until) => {
    const createdAt = Date.now();
    localStorage.setItem(
      'personal-ai-deferred-topics-v1',
      JSON.stringify({
        'topic-defer-undo': {
          until,
          createdAt,
        },
      }),
    );
    localStorage.setItem(
      'personal-ai-muted-topics-v1',
      JSON.stringify({
        'topic-auto-release': {
          until,
          createdAt,
          reason: 'not-now',
        },
        'topic-mute-reason': {
          until,
          createdAt,
          reason: 'low-relevance',
        },
        'topic-search-only': {
          until,
          createdAt,
          reason: 'not-now',
        },
        'topic-recent-action': {
          until,
          createdAt,
          reason: 'duplicate',
        },
        'topic-stale-backlog': {
          until,
          createdAt,
          reason: 'not-now',
        },
      }),
    );
  }, hiddenUntil);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  const hiddenUnreadReceipt = page.locator('.topic-unread-queue-receipt');
  await hiddenUnreadReceipt
    .getByText('仅未读显示 0 个可处理未读主题')
    .waitFor({ timeout: 10000 });
  await hiddenUnreadReceipt.getByText('稍后隐藏 1').waitFor({
    timeout: 10000,
  });
  await hiddenUnreadReceipt.getByText('静音隐藏 5').waitFor({
    timeout: 10000,
  });
  await hiddenUnreadReceipt
    .getByText('不标记已读，不同步后端或原始聊天平台')
    .waitFor({ timeout: 10000 });
  const hiddenUnreadEmptyState = page.locator('.topic-empty-recovery');
  await hiddenUnreadEmptyState
    .getByText('当前没有可处理的未读主题')
    .waitFor({ timeout: 10000 });
  await hiddenUnreadEmptyState.getByText('稍后/静音不等于已读').waitFor({
    timeout: 10000,
  });
  await hiddenUnreadEmptyState
    .getByRole('button', { name: /查看稍后 1/ })
    .waitFor({ timeout: 10000 });
  await hiddenUnreadEmptyState
    .getByRole('button', { name: /查看静音 5/ })
    .waitFor({ timeout: 10000 });
  await hiddenUnreadEmptyState
    .getByRole('button', { name: /查看所有主题/ })
    .waitFor({ timeout: 10000 });
  await hiddenUnreadEmptyState.getByRole('button', { name: /查看稍后 1/ }).click({
    timeout: 10000,
  });
  await page
    .locator('[data-topic-id="topic-defer-undo"] .topic-deferred-note', {
      hasText: '稍后到',
    })
    .waitFor({ timeout: 10000 });

  assert.deepEqual(
    pageErrors,
    [],
    `Topic detail page errors: ${pageErrors.join('; ')}`,
  );
  console.log('verify-topic-based-messages-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
