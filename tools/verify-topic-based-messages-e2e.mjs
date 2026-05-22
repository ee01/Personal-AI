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
      conversations: 2,
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

    if (
      pathname.endsWith('/entities') &&
      new URL(url).searchParams.get('type') === 'Topic'
    ) {
      await route.fulfill(jsonResponse({ items: [createMuteReasonTopic()] }));
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
    .getByText('Historical note without read state')
    .waitFor({ timeout: 10000 });

  const contextItem = page.locator('.context-item', {
    hasText: 'Historical note without read state',
  });
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

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/topic/topic-unread-sticky?readFilter=unread`,
    { waitUntil: 'domcontentloaded', timeout: 15000 },
  );

  await page.getByText('Unread Sticky Topic').waitFor({ timeout: 10000 });
  await page
    .getByText('Unread parent with context')
    .waitFor({ timeout: 10000 });

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

  const muteReasonCard = page.locator('[data-topic-id="topic-mute-reason"]');
  await muteReasonCard.getByText('Mute Reason Topic').waitFor({ timeout: 10000 });
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

  assert.deepEqual(pageErrors, [], `Topic detail page errors: ${pageErrors.join('; ')}`);
  console.log('verify-topic-based-messages-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
