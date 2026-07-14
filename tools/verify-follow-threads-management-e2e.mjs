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
  path.join(os.tmpdir(), 'personal-ai-follow-threads-'),
);

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
  if (pathname.endsWith('/reports')) return { items: [], total: 0 };
  if (pathname.endsWith('/outreach/summary')) {
    return { upcomingCount: 0, waitingReplyCount: 0, escalatedCount: 0 };
  }
  if (pathname.endsWith('/outreach/templates/runtime-status')) {
    return { items: [], total: 0 };
  }
  if (pathname.endsWith('/skills')) return { items: [], total: 0 };
  if (pathname.endsWith('/skills/suggestions')) return { items: [], total: 0 };
  if (pathname.endsWith('/config/runtime')) return { outreachEnabled: false };
  return {};
}

const now = Date.now();
const concernedItems = [
  {
    id: 'watch-manual-end',
    source: 'manual',
    text: '关于 Release owner 的后续讨论',
    expiredAt: 0,
    notifyMethod: 'bot,chrome',
    notifyFrequency: 'merged',
    followThread: true,
    followConfig: {
      originalMessage: {
        postId: 'post-release-owner',
        teamId: 'team-release',
        teamName: 'Release Room',
        sender: 'Alicia Chen',
        content: 'Please confirm the release owner before tomorrow noon.',
        datetime: new Date(now - 60 * 60 * 1000).toISOString(),
        messageUrl:
          'https://app.ringcentral.com/messages/team-release/post-release-owner',
      },
      createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      keywordFilter: [],
      relatedMessages: [
        {
          postId: 'post-release-owner-reply',
          sender: 'Morgan Lee',
          datetime: new Date(now - 15 * 60 * 1000).toISOString(),
          relationType: 'thread_reply',
          notifiedAt: new Date(now - 14 * 60 * 1000).toISOString(),
          summary: 'Morgan confirmed the release owner is Alicia.',
        },
      ],
    },
  },
  {
    id: 'outreach:system-watch',
    source: 'system',
    text: 'System watch item should stay hidden',
    expiredAt: now + 24 * 60 * 60 * 1000,
    followThread: true,
    followConfig: {
      originalMessage: {
        postId: 'system-post',
        teamId: 'team-release',
        teamName: 'Release Room',
        sender: 'System',
        content: 'Hidden system watch item.',
        datetime: new Date(now).toISOString(),
        messageUrl: 'https://app.ringcentral.com/messages/system/system-post',
      },
      createdAt: new Date(now).toISOString(),
      relatedMessages: [],
    },
  },
];

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
    await route.fulfill(jsonResponse(apiFallback(route.request().url())));
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', {
      timeout: 10000,
    });
  }
  const extensionId = serviceWorker.url().split('/')[2];
  assert.ok(extensionId, 'extension id should be available');

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/memory-exploring.html`);
  await page.evaluate((items) => {
    return chrome.storage.local.set({ concernedItems: items });
  }, concernedItems);

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/follow-threads`,
  );
  await page.locator('.follow-threads-container').waitFor({ timeout: 10000 });

  await page.getByText('手动规则 1').waitFor({ timeout: 10000 });
  await page.getByText('进行中 1').waitFor({ timeout: 10000 });
  await page.getByText('已过期 0').waitFor({ timeout: 10000 });
  await page.getByText('列表快照回执').waitFor({ timeout: 10000 });
  await page
    .getByText(/chrome\.storage\.local\.concernedItems/)
    .waitFor({ timeout: 10000 });
  await page
    .getByText(/当前可见 1 条，手动 Watch 规则总数 1 条/)
    .waitFor({ timeout: 10000 });
  await page
    .getByText(/系统 \/ Outreach 内部 Watch 隐藏 1 条/)
    .waitFor({ timeout: 10000 });
  await page
    .getByText(/当前筛选：全部；排序：创建时间/)
    .waitFor({ timeout: 10000 });
  await page
    .getByText(/本次列表读取不会取消、延长、补发通知/)
    .waitFor({ timeout: 10000 });
  await page
    .locator('.stat-value')
    .filter({ hasText: /^手动结束$/ })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.stat-value')
    .filter({ hasText: /^Bot \+ Chrome 通知$/ })
    .waitFor({ timeout: 10000 });
  await page.getByText('监听状态回执').waitFor({ timeout: 10000 });
  await page.getByText(/已记录 1 条关联消息/).waitFor({ timeout: 10000 });
  await page
    .getByText(/展开时间线不会补发或重发通知/)
    .waitFor({ timeout: 10000 });
  await page
    .getByText(/不会把关联记录改写成长期记忆/)
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('.follow-item.expired').count(),
    0,
    'manual-end follow rule should not render as expired',
  );

  await page.locator('.filter-select').first().selectOption('expired');
  await page
    .getByText(/当前可见 0 条，手动 Watch 规则总数 1 条/)
    .waitFor({ timeout: 10000 });
  await page
    .getByText(/当前筛选：已过期；排序：创建时间/)
    .waitFor({ timeout: 10000 });
  await page.getByText('当前筛选没有已过期 Watch').waitFor({
    timeout: 10000,
  });
  await page
    .getByText(/已有 1 条手动 Watch 规则；已有 1 条进行中规则被当前筛选隐藏/)
    .waitFor({ timeout: 10000 });
  await page
    .getByText(/这是筛选结果为空，不是规则丢失或读取失败/)
    .waitFor({ timeout: 10000 });
  await page
    .getByText(/不会取消、延长、补发通知或重新读取远端/)
    .waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: '查看全部' }).click();
  await page
    .getByText('关于 Release owner 的后续讨论')
    .waitFor({ timeout: 10000 });

  await page.getByText(/命中时间线/).click();
  await page
    .getByText('Morgan confirmed the release owner is Alicia.')
    .waitFor({ timeout: 10000 });
  await page.getByText(/通知状态：已记录通知时间/).waitFor({
    timeout: 10000,
  });
  await page.getByText(/展开这条命中不会重新发送通知/).waitFor({
    timeout: 10000,
  });

  await page.getByRole('button', { name: /延长/ }).click();
  await page.getByText('已延长关注后续').waitFor({ timeout: 10000 });
  await page.getByText(/只更新本地手动规则/).waitFor({ timeout: 10000 });
  await page.getByText(/不回扫历史消息/).waitFor({ timeout: 10000 });

  const afterExtend = await page.evaluate(async () => {
    const result = await chrome.storage.local.get('concernedItems');
    return result.concernedItems.find(
      (item) => item.id === 'watch-manual-end',
    );
  });
  assert.ok(
    afterExtend.expiredAt > now + 6 * 24 * 60 * 60 * 1000,
    'manual-end follow rule should extend from current time',
  );

  let nativeDialogSeen = false;
  page.on('dialog', async (dialog) => {
    nativeDialogSeen = true;
    await dialog.dismiss();
  });
  await page
    .getByRole('button', { name: /^取消关注 关于 Release owner 的后续讨论$/ })
    .click();
  assert.equal(
    nativeDialogSeen,
    false,
    'cancel should use inline confirmation instead of a native dialog',
  );
  await page.getByText('取消关注待确认').waitFor({ timeout: 10000 });
  await page
    .getByText(/确认前不会修改本地列表/)
    .waitFor({ timeout: 10000 });
  await page
    .getByText(/不会删除 RingCentral 原消息/)
    .waitFor({ timeout: 10000 });
  await page
    .getByText(/不会补发或撤回通知/)
    .waitFor({ timeout: 10000 });
  await page
    .getByText(/点「确认取消」才会写入本机存储/)
    .waitFor({ timeout: 10000 });

  const beforeCancelConfirm = await page.evaluate(async () => {
    const result = await chrome.storage.local.get('concernedItems');
    return result.concernedItems;
  });
  assert.equal(
    beforeCancelConfirm.some((item) => item.id === 'watch-manual-end'),
    true,
    'first cancel click should not remove the local manual follow-thread rule',
  );

  await page
    .getByRole('button', { name: /^返回并保留关注 关于 Release owner 的后续讨论$/ })
    .click();
  assert.equal(
    await page.getByText('取消关注待确认').count(),
    0,
    'return should hide the inline cancel confirmation',
  );

  await page
    .getByRole('button', { name: /^取消关注 关于 Release owner 的后续讨论$/ })
    .click();
  await page
    .getByRole('button', { name: /^确认取消关注 关于 Release owner 的后续讨论$/ })
    .click();
  await page.getByText('已取消关注后续').waitFor({ timeout: 10000 });
  await page
    .getByText(/不会立刻清理已写入 Memory Service 的历史索引/)
    .waitFor({ timeout: 10000 });
  await page.getByText('暂无手动关注项').waitFor({ timeout: 10000 });

  const afterCancel = await page.evaluate(async () => {
    const result = await chrome.storage.local.get('concernedItems');
    return result.concernedItems;
  });
  assert.equal(
    afterCancel.some((item) => item.id === 'watch-manual-end'),
    false,
    'cancel should remove the local manual follow-thread rule',
  );
  assert.equal(
    afterCancel.some((item) => item.id === 'outreach:system-watch'),
    true,
    'cancel should preserve unrelated system watch items',
  );

  console.log('verify-follow-threads-management-e2e: passed');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
