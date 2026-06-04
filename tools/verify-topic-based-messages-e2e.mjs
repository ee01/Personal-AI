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
      resources: 0,
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

    if (
      pathname.endsWith('/entities') &&
      new URL(url).searchParams.get('type') === 'Topic'
    ) {
      await route.fulfill(
        jsonResponse({
          items: [
            createDeferUndoTopic(),
            createAutoReleaseTopic(),
            createMuteReasonTopic(),
            createSearchOnlyTopic(),
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
    ((await contextSourceLink.textContent()) || '').trim(),
    '上下文来源',
    'source link label should explain when the click target comes from context',
  );

  const hiddenSourceBadge = page.locator(
    '[data-conversation-id="conv-unsafe-only"] .conversation-source-hidden',
  );
  await hiddenSourceBadge.waitFor({ timeout: 10000 });
  assert.equal(
    ((await hiddenSourceBadge.textContent()) || '').trim(),
    '来源已隐藏 · 3 个不可信链接',
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

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/topic/topic-legacy-context-link?readFilter=unread&messageId=legacy-context-snake`,
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
    '[data-conversation-id="conversation-0"] .context-item',
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
    'messageId deep links should use a render-id fallback when the parent discussion has no id',
  );
  await page
    .locator('.message-focus-notice', {
      hasText: '已定位到链接里的上下文消息，并同步为已读。',
    })
    .waitFor({ timeout: 10000 });
  await page.waitForFunction(
    () =>
      !document
        .querySelector('[data-conversation-id="conversation-0"] .context-item')
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

  await page
    .locator('.topic-detail-action-btn', { hasText: '稍后处理' })
    .click({
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
  await detailDeferUndoToast.getByRole('button', { name: /恢复/ }).click({
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

  const topicSearchInput = page.locator('.search-input').first();
  await topicSearchInput.fill('pager owner');
  const searchOnlyCard = page.locator('[data-topic-id="topic-search-only"]');
  await searchOnlyCard.getByText('Quiet Planning Topic').waitFor({
    timeout: 10000,
  });
  await searchOnlyCard.getByText('Escalation owner is missing').waitFor({
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
  await topicSearchInput.fill('release-checklist');
  await searchOnlyCard.getByText('Quiet Planning Topic').waitFor({
    timeout: 10000,
  });
  await topicSearchInput.fill('');

  await deferUndoCard.getByText('Defer Undo Topic').waitFor({
    timeout: 10000,
  });
  await deferUndoCard.locator('.topic-action-btn.later').click({
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

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.locator('.view-toggle-btn', { hasText: '静音' }).click({
    timeout: 10000,
  });
  await page
    .locator('[data-topic-id="topic-mute-reason"] .topic-muted-note', {
      hasText: '已静音：低相关度',
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
