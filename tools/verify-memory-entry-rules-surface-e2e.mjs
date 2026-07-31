/**
 * Verifies the Memory Entry Rules surface contract.
 *
 * `task` surface (message toolbar entry) must render only the task header plus a
 * single prefilled rule form: no explorer sidebar, no global search header, no
 * list-management toolbar, no existing rule cards. `hub` surface (sidebar entry)
 * must keep all of them.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const extensionPath = path.join(repoRoot, 'dist');

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'memory-entry-rules-surface-e2e-'),
  );
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', {
      timeout: 15000,
    });
  }

  return {
    context,
    extensionId: new URL(serviceWorker.url()).host,
    serviceWorker,
    userDataDir,
  };
}

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error instanceof Error ? error.message : String(error));
  });
  return () => {
    assert.deepEqual(
      errors,
      [],
      `Memory entry rules surface page errors: ${errors.join('; ')}`,
    );
  };
}

async function seedStorage(serviceWorker, { withPendingFollowThread }) {
  await serviceWorker.evaluate(async (options) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      envConfig: {
        MEMORY_SERVICE_BASE_URL: 'http://127.0.0.1:49213/api/v1',
        OPENCLAW_ENABLED: false,
      },
      taskSchedulerStates: {
        message_analysis: { enabled: true },
      },
      userinfo: {
        username: 'surface.verify',
        fullName: 'Surface Verify',
      },
      concernedItems: [
        {
          id: 'existing-hub-rule',
          text: 'Existing hub rule stays in the hub list',
          expiredAt: 0,
          filterSender: 'Morgan Lee',
        },
      ],
      ...(options.withPendingFollowThread
        ? {
            pendingFollowThreadConfig: {
              postId: 'post-surface-1',
              sender: 'Dana Chen',
              groupId: 'group-surface-1',
              groupName: 'Release War Room',
              content: 'We still need the rollback owner before Friday.',
              messageLink: 'https://example.invalid/message/post-surface-1',
              messageTimestamp: Date.now() - 60_000,
              requestedAt: Date.now(),
            },
          }
        : {}),
    });
  }, { withPendingFollowThread });
}

let launched;

try {
  launched = await launchExtensionContext();
  const { context, extensionId, serviceWorker } = launched;

  // ---------- task surface ----------
  await seedStorage(serviceWorker, { withPendingFollowThread: true });

  const taskPage = await context.newPage();
  const assertNoTaskPageErrors = collectPageErrors(taskPage);
  await taskPage.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/memory-entry-rules?surface=task&intent=follow-thread`,
    { waitUntil: 'load', timeout: 20000 },
  );

  const taskHeader = taskPage.locator('.task-header');
  await taskHeader.waitFor({ timeout: 15000 });
  await taskHeader
    .locator('text=为这条消息配置关注后续')
    .waitFor({ timeout: 5000 });
  await taskHeader
    .locator('text=只有保存后才会创建本地关注规则并索引原消息')
    .waitFor({ timeout: 5000 });
  await taskHeader
    .locator('button', { hasText: '在完整记忆探索中打开' })
    .waitFor({ timeout: 5000 });
  await taskHeader
    .locator('button', { hasText: '关闭' })
    .waitFor({ timeout: 5000 });

  assert.equal(
    await taskPage.locator('.sidebar').count(),
    0,
    'task surface must not render the memory explorer sidebar',
  );
  assert.equal(
    await taskPage.locator('.search-header').count(),
    0,
    'task surface must not render the global search header',
  );
  assert.equal(
    await taskPage.locator('.scope-intent-receipt').count(),
    0,
    'task surface must not render the search scope receipt',
  );

  const taskFrameSrc = await taskPage
    .locator('iframe.rules-frame')
    .getAttribute('src');
  assert.match(
    taskFrameSrc ?? '',
    /topic-modal\.html\?.*surface=task/,
    'task surface must forward surface=task into the rules iframe',
  );
  assert.match(
    taskFrameSrc ?? '',
    /intent=follow-thread/,
    'task surface must forward the launching intent into the rules iframe',
  );

  const taskFrame = taskPage.frameLocator('iframe.rules-frame');
  await taskFrame
    .locator('.add-topic-form h4', { hasText: '关注后续配置' })
    .waitFor({ timeout: 15000 });
  assert.equal(
    await taskFrame.locator('.page-header').count(),
    0,
    'task surface must not duplicate the rules page header inside the iframe',
  );
  assert.equal(
    await taskFrame.locator('.toolbar').count(),
    0,
    'task surface must not expose list-management actions',
  );
  assert.equal(
    await taskFrame.locator('.status-strip').count(),
    0,
    'task surface must not render the hub status strip',
  );
  assert.equal(
    await taskFrame.locator('.section-head').count(),
    0,
    'task surface must not render the rules list section head',
  );
  assert.equal(
    await taskFrame.locator('.topic-item').count(),
    0,
    'task surface must not render existing rule cards next to the prefilled form',
  );
  assert.equal(
    await taskFrame.locator('#new-filter-group').inputValue(),
    'Release War Room',
    'task surface must keep the follow-thread group prefill',
  );
  await taskFrame
    .locator('.original-message-collapse .collapse-sender', {
      hasText: 'Dana Chen',
    })
    .waitFor({ timeout: 5000 });
  await taskFrame
    .locator('.follow-thread-boundary-receipt')
    .waitFor({ timeout: 5000 });

  // 任务态不自动滚动：表单标题和原消息预览必须一进来就在视口里
  const taskFormTopOffset = await taskPage.evaluate(() => {
    const frame = document.querySelector('iframe.rules-frame');
    const doc = frame?.contentDocument;
    const heading = doc?.querySelector('.add-topic-form h4');
    if (!doc || !heading) return null;
    const scroller = doc.scrollingElement ?? doc.documentElement;
    return {
      scrollTop: scroller.scrollTop,
      headingTop: heading.getBoundingClientRect().top,
    };
  });
  assert.ok(taskFormTopOffset, 'task surface rules iframe must be same-origin');
  assert.equal(
    taskFormTopOffset.scrollTop,
    0,
    'task surface must not auto-scroll the single-form page',
  );
  assert.ok(
    taskFormTopOffset.headingTop >= 0,
    `task surface form heading must stay in view (top=${taskFormTopOffset.headingTop})`,
  );

  assertNoTaskPageErrors();

  // ---------- hub surface ----------
  await seedStorage(serviceWorker, { withPendingFollowThread: false });

  const hubPage = await context.newPage();
  const assertNoHubPageErrors = collectPageErrors(hubPage);
  await hubPage.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/memory-entry-rules`,
    { waitUntil: 'load', timeout: 20000 },
  );

  await hubPage.locator('.sidebar').waitFor({ timeout: 15000 });
  await hubPage.locator('.search-header').waitFor({ timeout: 5000 });
  assert.equal(
    await hubPage.locator('.task-header').count(),
    0,
    'hub surface must not render the task header',
  );

  const hubFrameSrc = await hubPage
    .locator('iframe.rules-frame')
    .getAttribute('src');
  assert.doesNotMatch(
    hubFrameSrc ?? '',
    /surface=task/,
    'hub surface must not forward surface=task',
  );

  const hubFrame = hubPage.frameLocator('iframe.rules-frame');
  await hubFrame
    .locator('.page-header h2', { hasText: '记忆入口规则' })
    .waitFor({ timeout: 15000 });
  await hubFrame.locator('.toolbar').waitFor({ timeout: 5000 });
  await hubFrame.locator('.status-strip').waitFor({ timeout: 5000 });
  await hubFrame
    .locator('.topic-item', { hasText: 'Existing hub rule stays in the hub list' })
    .waitFor({ timeout: 10000 });
  assert.equal(
    await hubFrame.locator('.add-topic-form').count(),
    0,
    'hub surface must not open the add form without an explicit user action',
  );

  assertNoHubPageErrors();

  console.log('verify-memory-entry-rules-surface-e2e: ok');
} finally {
  if (launched?.context) {
    await launched.context.close();
  }
  if (launched?.userDataDir) {
    await fs.rm(launched.userDataDir, { recursive: true, force: true });
  }
}
