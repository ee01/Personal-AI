import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const extensionPath = path.join(repoRoot, 'dist');
const SELF_EXTENSION_ID = '20367368195';
const WATCH_BOUNDARY_LABEL =
  '关注后续：只为这条消息打开 Watch 配置草稿；此点击不会开始监听、保存规则、回扫历史消息、索引原消息、发送通知、创建自动答复或联动操作。';
const EN_WATCH_BOUNDARY_LABEL =
  'Watch: opens a Watch configuration draft for this message; it does not start monitoring, save a rule, scan past messages, index the original message, send notifications, or create Reply/Openclaw actions yet.';
const LINKED_ACTION_BOUNDARY_LABEL =
  '联动操作：只为这条消息打开 Openclaw 配置草稿；此点击不会创建 RuntimeAction、调用 OpenClaw、回扫历史消息、保存规则或发送任何内容。';
const EN_LINKED_ACTION_BOUNDARY_LABEL =
  'Openclaw: opens an Openclaw configuration draft for this message; it does not create a RuntimeAction, call OpenClaw, scan past messages, save a rule, or send anything yet.';
const markerFixtureItems = [
  {
    id: 'outreach:session-from-message:12345:msg-1',
    type: 'outreach_initial_ask',
    label: '跟进中',
    chatId: '12345',
    postId: 'msg-1',
    source: 'memory_service',
    sourceId: 'session-from-message',
    sessionId: 'session-from-message',
    updatedAt: 1778841000,
    tooltip: '等待 Jordan Lee 确认最终发布日期',
  },
  {
    id: 'snooze-pending:snooze-row-1:12345:msg-1',
    type: 'snooze_pending',
    label: '稍后 5/18 09:00',
    chatId: '12345',
    postId: 'msg-1',
    source: 'sheet',
    sourceId: 'snooze-row-1',
    updatedAt: 1778840900,
    tooltip: '提醒时间：2026-05-18 09:00',
  },
];

const fixtureHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>RingCentral message reaction fixture</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .conversation { width: 720px; margin: 48px auto; }
      .conversation-card { padding: 8px 0; }
      .conversation-card-wrapper {
        position: relative;
        min-height: 96px;
        padding: 16px 20px;
        border: 1px solid #d7dce2;
        border-radius: 8px;
        background: white;
      }
      [data-name="name"] { display: block; font-weight: 600; margin-bottom: 8px; }
      [data-name="text"] { line-height: 1.5; }
      [data-name="time"] { display: block; margin-top: 8px; color: #64748b; font-size: 12px; }
      [data-name="avatar"] { display: none; }
      [data-name="conversationTitle"] { display: block; margin-bottom: 16px; font-size: 18px; font-weight: 700; }
      .topBarAvatar {
        position: fixed;
        top: 10px;
        right: 10px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        overflow: hidden;
      }
      .topBarAvatar img {
        width: 100%;
        height: 100%;
        display: block;
      }
      .composer-shell { margin-top: 24px; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px 8px; }
      .ql-editor { min-height: 72px; outline: none; }
      .composer-toolbar {
        display: flex;
        align-items: center;
        gap: 4px;
        min-height: 30px;
        border-top: 1px solid #e2e8f0;
        padding-top: 8px;
      }
      .composer-toolbar button {
        height: 28px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: #334155;
        padding: 0 8px;
        font: inherit;
      }
      .composer-toolbar button:hover { background: #f1f5f9; }
      .composer-leading,
      .composer-tail {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .composer-tail { margin-left: auto; }
      .inline-reply-shell {
        width: 420px;
        margin: 18px 0 0 auto;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 8px;
      }
      .inline-reply-shell .ql-editor { min-height: 36px; }
      .message-action-bar-inline-reply {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 6px;
      }
    </style>
    <script>
      const glipDbRequest = indexedDB.open('Glip', 1);
      glipDbRequest.onupgradeneeded = () => {
        const db = glipDbRequest.result;
        if (!db.objectStoreNames.contains('group')) db.createObjectStore('group', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('person')) db.createObjectStore('person', { keyPath: 'id' });
      };
      glipDbRequest.onsuccess = () => {
        const db = glipDbRequest.result;
        const tx = db.transaction(['group', 'person'], 'readwrite');
        tx.objectStore('group').put({ id: 12345, is_team: true, set_abbreviation: 'Release Team' });
        tx.objectStore('person').put({ id: 20367368195, first_name: 'Esone', last_name: 'Qiu' });
      };
    </script>
  </head>
  <body>
    <div class="topBarAvatar">
      <img alt="Esone Qiu" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='16' fill='%230b6bcb'/%3E%3Ctext x='16' y='21' text-anchor='middle' font-size='13' font-family='Arial' fill='white'%3EEQ%3C/text%3E%3C/svg%3E" />
    </div>
    <main class="conversation">
      <span data-name="conversationTitle">Release Team</span>
      <div class="conversation-list-item">Sidebar-like class should not receive pending message</div>
      <section id="message-chat-stream-wrapper">
        <div role="listbox">
          <article class="conversation-card" role="document">
            <div class="conversation-card-wrapper" data-id="msg-1" groupid="12345">
              <button data-name="avatar" data-uid="GLIP_PERSON.99999"></button>
              <span data-name="name">Alicia Chen</span>
              <div data-name="text">Please follow up with the release owner before tomorrow noon.</div>
              <span data-name="time" datetime="2026-05-15T09:30:00Z">09:30</span>
            </div>
          </article>
          <article class="conversation-card" role="document">
            <div class="conversation-card-wrapper" data-id="msg-own" groupid="12345">
              <button data-name="avatar" data-uid="GLIP_PERSON.${SELF_EXTENSION_ID}"></button>
              <span data-name="name">You</span>
              <div data-name="text">@Jordan Lee can you confirm the release date before Friday?</div>
              <span data-name="time" datetime="2026-05-15T10:30:00Z">10:30</span>
            </div>
            <div class="inline-reply-shell" data-test-automation-id="reply-inline-input">
              <div class="ql-editor" contenteditable="true" role="textbox"></div>
              <div class="message-action-bar-inline-reply">
                <button type="button" aria-label="Attach file">Attach</button>
                <button type="button" class="inline-more" aria-label="More">More</button>
              </div>
            </div>
          </article>
          </div>
      </section>
      <footer class="composer-shell" data-test-automation-id="message-compose">
        <div class="ql-editor" contenteditable="true" role="textbox">
          <p>Hi <span role="link" data-id="20367368195">@Esone Qiu</span> and @team, please check this later.</p>
        </div>
        <div class="composer-toolbar" role="toolbar" aria-label="Composer actions">
          <div class="composer-leading">
            <button type="button" aria-label="Attach">Attach</button>
            <button type="button" aria-label="Emoji">Emoji</button>
          </div>
          <div class="composer-tail">
            <button type="button" class="composer-more" aria-label="More">More</button>
          </div>
        </div>
      </footer>
    </main>
  </body>
</html>`;

async function readJsonBody(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
  }
  return raw ? JSON.parse(raw) : null;
}

async function startMemoryServiceFixture() {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    if (
      request.method === 'POST' &&
      request.url === '/api/v1/outreach/sessions/from-message'
    ) {
      const body = await readJsonBody(request);
      requests.push(body);
      await delay(300);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const followupReadyAt = nowSeconds + 86_400;
      const duplicate = requests.filter(
        (item) => item.chatId === body.chatId && item.postId === body.postId,
      ).length > 1;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          session: {
            id: 'session-from-message',
            originKind: 'message_reaction',
            status: 'waiting_reply',
            sentChatId: body.chatId,
            sentPostId: body.postId,
            renderedContext: duplicate
              ? '确认最终发布日期和是否需要额外资源'
              : body.informationGoal,
            nextCheckAt: nowSeconds,
            waitUntil: followupReadyAt,
          },
          created: !duplicate,
          reason: duplicate ? 'existing_message_reaction_session' : undefined,
        }),
      );
      return;
    }

    if (request.method === 'POST' && request.url === '/api/v1/ingest') {
      await readJsonBody(request);
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          memoryId: 'follow-thread-original-memory',
          status: 'created',
          decision: 'created',
        }),
      );
      return;
    }

    if (
      request.method === 'GET' &&
      request.url?.startsWith('/api/v1/glip-message-markers')
    ) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          items: markerFixtureItems,
          generatedAt: Math.floor(Date.now() / 1000),
        }),
      );
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'not_found' }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.equal(typeof address, 'object');
  return {
    requests,
    baseUrl: `http://127.0.0.1:${address.port}/api/v1`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function waitForRequest(requests, label) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (requests.length > 0) return requests[0];
    await delay(100);
  }
  assert.fail(`Timed out waiting for ${label}`);
}

async function getVisibleToolbarItemBoxes(page) {
  return page.$$eval(
    '.message-reaction-toolbar.visible .message-reaction-action-btn, .message-reaction-toolbar.visible .snooze-icon',
    (items) =>
      items.map((item) => ({
        className: item.className,
        left: item.getBoundingClientRect().left,
        right: item.getBoundingClientRect().right,
        width: item.getBoundingClientRect().width,
      })),
  );
}

function assertToolbarItemsDoNotOverlap(boxes, label) {
  for (let index = 1; index < boxes.length; index += 1) {
    const previous = boxes[index - 1];
    const current = boxes[index];
    assert.ok(
      current.left >= previous.right - 0.75,
      `${label}: toolbar items should push siblings instead of overlapping: ${JSON.stringify(
        boxes,
      )}`,
    );
  }
}

async function main() {
  await fs.access(path.join(extensionPath, 'manifest.json'));
  const memoryFixture = await startMemoryServiceFixture();

  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'message-reaction-toolbar-'),
  );

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker', {
        timeout: 15_000,
      });
    }
    const extensionId = new URL(serviceWorker.url()).host;
    await serviceWorker.evaluate(
      async ({ baseUrl, extensionId }) => {
        await chrome.storage.local.set({
          envConfig: {
            MEMORY_SERVICE_BASE_URL: baseUrl,
            MEMORY_SERVICE_TIMEOUT: 5000,
          },
          userinfo: {
            fullName: 'Esone Qiu',
            username: 'esone.qiu',
            userEmail: 'esone.qiu@example.com',
            extensionId,
          },
        });
      },
      { baseUrl: memoryFixture.baseUrl, extensionId: SELF_EXTENSION_ID },
    );
    const configPage = await context.newPage();
    await configPage.goto(`chrome-extension://${extensionId}/options.html`, {
      waitUntil: 'domcontentloaded',
    });
    await configPage.evaluate(async ({ baseUrl }) => {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_ENV_CONFIG',
        config: {
          MEMORY_SERVICE_BASE_URL: baseUrl,
          MEMORY_SERVICE_TIMEOUT: 5000,
        },
      });
    }, { baseUrl: memoryFixture.baseUrl });
    await configPage.close();

    await serviceWorker.evaluate(async () => {
      const result = await chrome.storage.local.get(['envConfig']);
      await chrome.storage.local.set({
        envConfig: {
          ...(result.envConfig || {}),
          OPENCLAW_ENABLED: false,
          OPENCLAW_BASE_URL: '',
        },
        pendingLinkedActionConfig: {
          sender: 'Alicia Chen',
          groupId: '12345',
          groupName: 'Release Room',
          content:
            'Please follow up with the release owner before tomorrow noon.',
          messageId: 'msg-1',
          messageTimestamp: Date.parse('2026-05-15T09:30:00Z'),
          timestamp: Date.now(),
          messageLink: 'https://app.ringcentral.com/messages/12345/msg-1',
        },
      });
    });
    const linkedActionPage = await context.newPage();
    await linkedActionPage.goto(
      `chrome-extension://${extensionId}/topic-modal.html`,
      { waitUntil: 'domcontentloaded' },
    );
    await linkedActionPage.waitForSelector('.add-topic-form', {
      timeout: 10_000,
    });
    assert.match(
      await linkedActionPage.locator('.add-topic-form .text-input').inputValue(),
      /Please follow up with the release owner/,
    );
    const linkedActionTextarea = linkedActionPage
      .locator('.add-topic-form .automation-config textarea')
      .first();
    const linkedActionTextareaState = await linkedActionTextarea.evaluate(
      (textarea) => ({
        readOnly: textarea.readOnly,
        ariaDisabled: textarea.getAttribute('aria-disabled'),
        pointerEvents: window.getComputedStyle(textarea).pointerEvents,
      }),
    );
    assert.deepEqual(linkedActionTextareaState, {
      readOnly: false,
      ariaDisabled: null,
      pointerEvents: 'auto',
    });
    await linkedActionTextarea.fill(
      '把当前消息整理成待激活的联动操作草稿，连接 OpenClaw 后再执行。',
    );
    assert.match(
      (await linkedActionPage
        .locator('.automation-offline-note')
        .first()
        .textContent()) || '',
      /仍可先保存联动操作描述/,
    );
    linkedActionPage.on('dialog', async (dialog) => {
      await dialog.dismiss();
    });
    await linkedActionPage
      .locator('.add-topic-form .form-buttons button')
      .first()
      .click();
    const linkedActionSaveToast =
      (await linkedActionPage
        .locator('.rule-operation-toast.success')
        .textContent()) || '';
    assert.match(linkedActionSaveToast, /已保存联动操作草稿/);
    assert.match(linkedActionSaveToast, /没有回扫历史消息/);
    assert.match(linkedActionSaveToast, /没有创建 RuntimeAction/);
    assert.match(linkedActionSaveToast, /没有调用 OpenClaw/);
    assert.match(linkedActionSaveToast, /待激活/);
    await linkedActionPage.close();
    await serviceWorker.evaluate(async () => {
      await chrome.storage.local.set({ concernedItems: [] });
    });

    await serviceWorker.evaluate(async () => {
      const result = await chrome.storage.local.get(['envConfig']);
      await chrome.storage.local.set({
        envConfig: {
          ...(result.envConfig || {}),
          ENABLE_SNOOZE: false,
          ENABLE_FOLLOW_THREAD: false,
          ENABLE_AUTO_REPLY: false,
          ENABLE_LINKED_ACTION: false,
        },
      });
    });

    await context.route('https://app.ringcentral.com/messages/12345', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: fixtureHtml,
      }),
    );

    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') {
        console.log(`[browser:${message.type()}] ${message.text()}`);
      }
    });

    await page.goto('https://app.ringcentral.com/messages/12345', {
      waitUntil: 'domcontentloaded',
    });

    const message = page.locator('.conversation-card-wrapper[data-id="msg-1"]');
    await message.waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll('style')).some((style) =>
          style.textContent?.includes('.glip-ai-marker-badge'),
        ),
      null,
      { timeout: 12_000 },
    );

    await serviceWorker.evaluate(async () => {
      await chrome.storage.local.set({
        glipMessageMarkers: {
          version: 1,
          updatedAt: Math.floor(Date.now() / 1000),
          markersByChatId: {
            '12345': {
              'msg-1': [
                {
                  id: 'outreach:session-from-message:12345:msg-1',
                  type: 'outreach_initial_ask',
                  label: '跟进中',
                  chatId: '12345',
                  postId: 'msg-1',
                  source: 'memory_service',
                  sourceId: 'session-from-message',
                  sessionId: 'session-from-message',
                  updatedAt: 1778841000,
                  tooltip: '等待 Jordan Lee 确认最终发布日期',
                },
                {
                  id: 'snooze-pending:snooze-row-1:12345:msg-1',
                  type: 'snooze_pending',
                  label: '稍后 5/18 09:00',
                  chatId: '12345',
                  postId: 'msg-1',
                  source: 'sheet',
                  sourceId: 'snooze-row-1',
                  updatedAt: 1778840900,
                  tooltip: '提醒时间：2026-05-18 09:00',
                },
              ],
            },
          },
        },
      });
    });
    const markerBadge = message.locator('.glip-ai-marker-badge');
    await markerBadge.waitFor({ state: 'visible', timeout: 5_000 });
    const markerBadgeState = await markerBadge.evaluate((badge) => ({
      tagName: badge.tagName,
      text: badge.textContent?.replace(/\s+/g, '').trim(),
      ariaLabel: badge.getAttribute('aria-label'),
      title: badge.getAttribute('title'),
      tabIndex: badge.tabIndex,
      countText: badge
        .querySelector('.glip-ai-marker-count')
        ?.textContent?.trim(),
      cacheFlagText: badge
        .querySelector('.glip-ai-marker-cache-flag')
        ?.textContent?.trim(),
      className: badge.className,
    }));
    assert.equal(markerBadgeState.tagName, 'BUTTON');
    assert.equal(markerBadgeState.text, '跟进中+1');
    assert.equal(markerBadgeState.tabIndex, 0);
    assert.equal(markerBadgeState.countText, '+1');
    assert.equal(markerBadgeState.cacheFlagText, undefined);
    assert.match(markerBadgeState.className, /cache-fresh/);
    assert.match(
      markerBadgeState.ariaLabel || '',
      /AI 标注，共 2 项：跟进中：等待 Jordan Lee 确认最终发布日期；稍后 5\/18 09:00：提醒时间：2026-05-18 09:00/,
    );
    assert.match(
      markerBadgeState.ariaLabel || '',
      /标注来源：Memory Service 跟进 \/ Sheet 排期\/执行日志/,
    );
    assert.match(
      markerBadgeState.ariaLabel || '',
      /状态口径：跟进中表示正在等待原消息线程或下一次检查，不代表已经发送新追问。；稍后表示仍在 Snooze 队列/,
    );
    assert.match(
      markerBadgeState.ariaLabel || '',
      /下一步：到主动询问会话确认原线程是否已满足目标，或等待下一次检查。；到 Scheduled Messages 的 Snooze 列表完成、改期或删除这条提醒。/,
    );
    assert.match(markerBadgeState.ariaLabel || '', /缓存刷新：/);
    assert.doesNotMatch(markerBadgeState.ariaLabel || '', /1970|可能过旧|尚未刷新/);
    assert.equal(markerBadgeState.title, markerBadgeState.ariaLabel);
    await markerBadge.focus();
    const markerMessageHandle = await message.elementHandle();
    assert.ok(markerMessageHandle, 'Expected a message element for marker tooltip');
    await page.waitForFunction(
      (messageElement) => {
        const tooltip = messageElement.querySelector('.glip-ai-marker-tooltip');
        return tooltip && Number(getComputedStyle(tooltip).opacity) > 0.9;
      },
      markerMessageHandle,
      { timeout: 3_000 },
    );
    const markerTooltipText = await message
      .locator('.glip-ai-marker-tooltip')
      .textContent();
    assert.match(markerTooltipText || '', /跟进中/);
    assert.match(
      markerTooltipText || '',
      /标注来源：Memory Service 跟进 \/ Sheet 排期\/执行日志/,
    );
    assert.match(
      markerTooltipText || '',
      /状态口径：跟进中表示正在等待原消息线程或下一次检查，不代表已经发送新追问。；稍后表示仍在 Snooze 队列/,
    );
    assert.match(
      markerTooltipText || '',
      /下一步：到主动询问会话确认原线程是否已满足目标，或等待下一次检查。；到 Scheduled Messages 的 Snooze 列表完成、改期或删除这条提醒。/,
    );
    assert.match(markerTooltipText || '', /缓存刷新：/);
    assert.doesNotMatch(markerTooltipText || '', /1970|可能过旧|尚未刷新/);
    assert.match(markerTooltipText || '', /稍后 5\/18 09:00/);

    await serviceWorker.evaluate(async () => {
      const staleUpdatedAt = Math.floor((Date.now() - 31 * 60 * 1000) / 1000);
      const result = await chrome.storage.local.get(['glipMessageMarkers']);
      await chrome.storage.local.set({
        glipMessageMarkers: {
          ...(result.glipMessageMarkers || {
            version: 1,
            markersByChatId: {},
          }),
          updatedAt: staleUpdatedAt,
        },
      });
    });
    await page.waitForFunction(
      () => {
        const badgeElement = document.querySelector(
          '.conversation-card-wrapper[data-id="msg-1"] .glip-ai-marker-badge',
        );
        return (
          badgeElement?.textContent?.includes('旧') &&
          badgeElement?.className.includes('cache-stale')
        );
      },
      null,
      { timeout: 3_000 },
    );
    const staleMarkerBadgeState = await markerBadge.evaluate((badge) => ({
      text: badge.textContent?.replace(/\s+/g, '').trim(),
      ariaLabel: badge.getAttribute('aria-label'),
      cacheFlagText: badge
        .querySelector('.glip-ai-marker-cache-flag')
        ?.textContent?.trim(),
      className: badge.className,
    }));
    assert.equal(staleMarkerBadgeState.text, '跟进中+1旧');
    assert.equal(staleMarkerBadgeState.cacheFlagText, '旧');
    assert.match(staleMarkerBadgeState.className, /cache-stale/);
    assert.match(
      staleMarkerBadgeState.ariaLabel || '',
      /状态边界：本地标注快照可能过旧/,
    );
    const staleMarkerTooltipText = await message
      .locator('.glip-ai-marker-tooltip')
      .textContent();
    assert.match(staleMarkerTooltipText || '', /状态边界：本地标注快照可能过旧/);

    await serviceWorker.evaluate(async () => {
      const result = await chrome.storage.local.get(['glipMessageMarkers']);
      await chrome.storage.local.set({
        glipMessageMarkers: {
          ...(result.glipMessageMarkers || {
            version: 1,
            markersByChatId: {},
          }),
          updatedAt: Date.now(),
          pendingScheduledByChatId: {
            '12345': [
              {
                id: 'compose-scheduled:row-1',
                chatId: '12345',
                messageId: 'row-1',
                topic: '定时发送: release note',
                content: 'Hi @esone.qiu，请晚点看一下 release note 的最终措辞。',
                scheduledAt: '2026-06-03T10:30:00.000Z',
                targetType: 'group',
                targetLabel: '12345',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          },
        },
      });
    });
    const pendingScheduledBubble = page.locator(
      '.pai-glip-pending-scheduled-item',
    );
    await pendingScheduledBubble.waitFor({ state: 'visible', timeout: 5_000 });
    const pendingScheduledState = await page.evaluate(() => {
      const pending = document.querySelector('.pai-glip-pending-scheduled-list');
      const pendingItem = document.querySelector('.pai-glip-pending-scheduled-item');
      const lastMessage = document.querySelector(
        '.conversation-card-wrapper[data-id="msg-own"]',
      );
      const composer = document.querySelector('.composer-shell');
      const icon = document.querySelector('.pai-glip-pending-scheduled-avatar img');
      const manage = document.querySelector('.pai-glip-pending-scheduled-manage');
      const bubble = document.querySelector('.pai-glip-pending-scheduled-bubble');
      const listbox = document.querySelector('#message-chat-stream-wrapper [role="listbox"]');
      const sidebarLike = document.querySelector('.conversation-list-item');
      const pendingRect = pending?.getBoundingClientRect();
      const bubbleRect = bubble?.getBoundingClientRect();
      const lastMessageRect = lastMessage?.getBoundingClientRect();
      const composerRect = composer?.getBoundingClientRect();
      return {
        text: pendingItem?.textContent?.replace(/\s+/g, ' ').trim() || '',
        ariaLabel: pending?.getAttribute('aria-label') || '',
        iconSrc: icon?.getAttribute('src') || '',
        manageText: manage?.textContent?.trim() || '',
        bubbleWidth: bubbleRect?.width || 0,
        bubbleHeight: bubbleRect?.height || 0,
        listWidth: pendingRect?.width || 0,
        inMessageList: Boolean(pending && listbox?.contains(pending)),
        inSidebarLike: Boolean(pending && sidebarLike?.contains(pending)),
        afterLastMessage: Boolean(
          pendingRect && lastMessageRect && pendingRect.top >= lastMessageRect.bottom - 1,
        ),
        beforeComposer: Boolean(
          pendingRect && composerRect && pendingRect.bottom <= composerRect.top + 1,
        ),
      };
    });
    assert.match(pendingScheduledState.ariaLabel, /待发送/);
    assert.match(pendingScheduledState.text, /定时/);
    assert.match(pendingScheduledState.text, /Esone Qiu/);
    assert.match(pendingScheduledState.text, /release note/);
    assert.match(pendingScheduledState.iconSrc, /^data:image\/svg\+xml/);
    assert.equal(pendingScheduledState.manageText, '管理');
    assert.ok(
      pendingScheduledState.bubbleWidth > 0 &&
        pendingScheduledState.bubbleWidth < pendingScheduledState.listWidth &&
        pendingScheduledState.bubbleWidth <= 380 &&
        pendingScheduledState.bubbleHeight > 0 &&
        pendingScheduledState.bubbleHeight <= 120,
      JSON.stringify(pendingScheduledState),
    );
    assert.equal(pendingScheduledState.inMessageList, true);
    assert.equal(pendingScheduledState.inSidebarLike, false);
    assert.equal(
      pendingScheduledState.afterLastMessage,
      true,
      JSON.stringify(pendingScheduledState),
    );
    assert.equal(
      pendingScheduledState.beforeComposer,
      true,
      JSON.stringify(pendingScheduledState),
    );
    const pendingNodeStability = await page.evaluate(async () => {
      const before = document.querySelector('.pai-glip-pending-scheduled-list');
      const listbox = document.querySelector('#message-chat-stream-wrapper [role="listbox"]');
      const beforeScrollTop = listbox?.scrollTop || 0;
      window.dispatchEvent(new CustomEvent('pai-glip-compose-scheduled-created'));
      await new Promise((resolve) => setTimeout(resolve, 900));
      const after = document.querySelector('.pai-glip-pending-scheduled-list');
      return {
        sameNode: before === after,
        count: document.querySelectorAll('.pai-glip-pending-scheduled-list').length,
        scrollTopPreserved: (listbox?.scrollTop || 0) === beforeScrollTop,
      };
    });
    assert.deepEqual(
      pendingNodeStability,
      {
        sameNode: true,
        count: 1,
        scrollTopPreserved: true,
      },
      JSON.stringify(pendingNodeStability),
    );
    const pendingVirtualListPosition = await page.evaluate(async () => {
      const stream = document.querySelector('#message-chat-stream-wrapper');
      const listbox = document.querySelector('#message-chat-stream-wrapper [role="listbox"]');
      const pending = document.querySelector('.pai-glip-pending-scheduled-list');
      if (!(stream instanceof HTMLElement) || !(listbox instanceof HTMLElement) || !(pending instanceof HTMLElement)) {
        return { ready: false };
      }

      const spacer = document.createElement('div');
      spacer.className = 'virtualized-newer-message-placeholder';
      spacer.style.height = '420px';
      listbox.appendChild(spacer);
      stream.style.height = '140px';
      stream.style.overflowY = 'auto';
      listbox.style.minHeight = '720px';

      stream.scrollTop = 0;
      stream.dispatchEvent(new Event('scroll'));
      await new Promise((resolve) => setTimeout(resolve, 80));
      const hiddenAwayFromBottom = pending.hidden || getComputedStyle(pending).display === 'none';

      stream.scrollTop = stream.scrollHeight;
      stream.dispatchEvent(new Event('scroll'));
      await new Promise((resolve) => setTimeout(resolve, 80));
      const visibleAtBottom = !pending.hidden && getComputedStyle(pending).display !== 'none';
      const movedAfterVirtualNodes = listbox.lastElementChild === pending;

      spacer.remove();
      stream.style.height = '';
      stream.style.overflowY = '';
      listbox.style.minHeight = '';

      return {
        ready: true,
        hiddenAwayFromBottom,
        visibleAtBottom,
        movedAfterVirtualNodes,
      };
    });
    assert.deepEqual(
      pendingVirtualListPosition,
      {
        ready: true,
        hiddenAwayFromBottom: true,
        visibleAtBottom: true,
        movedAfterVirtualNodes: true,
      },
      JSON.stringify(pendingVirtualListPosition),
    );
    const refreshPage = await context.newPage();
    await refreshPage.goto('https://app.ringcentral.com/messages/12345', {
      waitUntil: 'domcontentloaded',
    });
    await refreshPage
      .locator('.conversation-card-wrapper[data-id="msg-own"]')
      .waitFor({ state: 'visible', timeout: 10_000 });
    const refreshedPendingBubble = refreshPage.locator(
      '.pai-glip-pending-scheduled-item',
    );
    await refreshedPendingBubble.waitFor({ state: 'visible', timeout: 8_000 });
    const refreshedPendingState = await refreshPage.evaluate(() => {
      const pending = document.querySelector('.pai-glip-pending-scheduled-list');
      const listbox = document.querySelector('#message-chat-stream-wrapper [role="listbox"]');
      return {
        text:
          document
            .querySelector('.pai-glip-pending-scheduled-item')
            ?.textContent?.replace(/\s+/g, ' ')
            .trim() || '',
        inMessageList: Boolean(pending && listbox?.contains(pending)),
      };
    });
    assert.match(refreshedPendingState.text, /release note/);
    assert.equal(refreshedPendingState.inMessageList, true);
    await refreshPage.close();

    await message.hover();
    await delay(4_300);
    assert.equal(
      await message.locator('.message-reaction-toolbar.visible').count(),
      0,
      'Toolbar should stay hidden when all message-reaction features start disabled',
    );
    await serviceWorker.evaluate(async () => {
      const result = await chrome.storage.local.get(['envConfig']);
      await chrome.storage.local.set({
        envConfig: {
          ...(result.envConfig || {}),
          ENABLE_SNOOZE: true,
          ENABLE_FOLLOW_THREAD: true,
          ENABLE_AUTO_REPLY: true,
          ENABLE_LINKED_ACTION: true,
        },
      });
    });
    await page.waitForSelector('.message-reaction-toolbar', {
      state: 'attached',
      timeout: 12_000,
    });
    await page.mouse.move(5, 5);
    await message.hover();
    const toolbar = page.locator('.message-reaction-toolbar.visible');
    await delay(1800);
    assert.equal(
      await message.locator('.message-reaction-toolbar.visible').count(),
      0,
      'Toolbar should wait for the deliberate 4s hover intent delay',
    );
    await toolbar.waitFor({ state: 'visible', timeout: 8_000 });
    const visibleToolbarA11y = await toolbar.evaluate((toolbarElement) => ({
      ariaHidden: toolbarElement.getAttribute('aria-hidden'),
      actionTabIndexes: Array.from(
        toolbarElement.querySelectorAll('.message-reaction-action-btn'),
      ).map((button) => button.tabIndex),
      settingsTabIndex:
        toolbarElement.querySelector('.reaction-settings-btn')?.tabIndex,
      settingsAriaHidden: toolbarElement
        .querySelector('.reaction-settings-btn')
        ?.getAttribute('aria-hidden'),
    }));
    assert.equal(visibleToolbarA11y.ariaHidden, 'false');
    assert.equal(
      visibleToolbarA11y.actionTabIndexes.every((tabIndex) => tabIndex === 0),
      true,
      `Visible toolbar actions should be keyboard reachable: ${JSON.stringify(
        visibleToolbarA11y,
      )}`,
    );
    assert.equal(visibleToolbarA11y.settingsTabIndex, -1);
    assert.equal(visibleToolbarA11y.settingsAriaHidden, 'true');

    const actions = await page.$$eval(
      '.message-reaction-toolbar .message-reaction-action-btn',
      (buttons) =>
        buttons.map((button) => ({
          tagName: button.tagName,
          label: button.getAttribute('aria-label'),
          compactLabel: button.getAttribute('data-compact-label'),
          compactAlign: button.getAttribute('data-compact-align') || 'start',
          title: button.getAttribute('title'),
          text: button.textContent?.trim(),
        })),
    );

    assert.deepEqual(
      actions.map((action) => action.label),
      [
        '稍后处理',
        WATCH_BOUNDARY_LABEL,
        '自动答复',
        LINKED_ACTION_BOUNDARY_LABEL,
      ],
    );
    assert.deepEqual(
      actions.map((action) => action.compactLabel),
      ['稍后', '关注', '答复', '联动'],
    );
    assert.deepEqual(
      actions.map((action) => action.compactAlign),
      ['start', 'start', 'end', 'start'],
    );
    assert.deepEqual(
      actions.map((action) => action.text),
      ['稍后处理', '关注后续', '自动答复', '联动操作'],
    );
    assert.equal(
      actions.every((action) => action.tagName === 'BUTTON'),
      true,
    );
    assert.equal(
      [actions[0], actions[2]].every((action) => action?.title === action?.label),
      true,
    );
    assert.equal(actions[1]?.title, WATCH_BOUNDARY_LABEL);
    assert.match(actions[1]?.title || '', /打开 Watch 配置草稿/);
    assert.match(actions[1]?.title || '', /不会开始监听/);
    assert.match(actions[1]?.title || '', /保存规则/);
    assert.match(actions[1]?.title || '', /索引原消息/);
    assert.match(actions[1]?.title || '', /发送通知/);
    assert.match(actions[1]?.title || '', /自动答复或联动操作/);
    assert.match(actions[3]?.title || '', /打开 Openclaw 配置草稿/);
    assert.match(actions[3]?.title || '', /不会创建 RuntimeAction/);
    assert.match(actions[3]?.title || '', /调用 OpenClaw/);
    assert.match(actions[3]?.title || '', /回扫历史消息/);
    assert.match(actions[3]?.title || '', /保存规则或发送任何内容/);
    const actionRadii = await page.$$eval(
      '.message-reaction-toolbar .message-reaction-action-btn',
      (buttons) =>
        buttons.map((button) => {
          const style = window.getComputedStyle(button);
          return {
            borderTopLeftRadius: style.borderTopLeftRadius,
            borderBottomLeftRadius: style.borderBottomLeftRadius,
          };
        }),
    );
    assert.deepEqual(actionRadii[0], {
      borderTopLeftRadius: '4px',
      borderBottomLeftRadius: '4px',
    });
    assert.equal(
      actionRadii
        .slice(1)
        .every(
          (radii) =>
            radii.borderTopLeftRadius === '0px' &&
            radii.borderBottomLeftRadius === '0px',
        ),
      true,
      'Only the first action should own the segmented toolbar left radius',
    );

    const followThreadConfigPagePromise = context.waitForEvent('page', {
      timeout: 10_000,
    });
    await toolbar.locator('.follow-thread-btn').click();
    const followThreadConfigPage = await followThreadConfigPagePromise;
    await page.waitForFunction(
      () =>
        document.body.textContent?.includes('已打开关注后续配置') &&
        document.body.textContent?.includes('当前消息尚未开始关注') &&
        document.body.textContent?.includes('保存规则后才会监听同会话后续讨论'),
      null,
      { timeout: 5_000 },
    );
    await followThreadConfigPage.waitForLoadState('domcontentloaded');
    assert.match(
      followThreadConfigPage.url(),
      /memory-exploring\.html#\/memory-entry-rules\?surface=task&intent=follow-thread$/,
      'Watch should open the canonical task-surface route rather than the legacy standalone form',
    );
    const followThreadConfigFrame = followThreadConfigPage.frameLocator(
      'iframe.rules-frame',
    );
    await followThreadConfigFrame.locator('.add-topic-form').waitFor({
      timeout: 10_000,
    });
    assert.match(
      await followThreadConfigFrame
        .locator('.add-topic-form .text-input')
        .inputValue(),
      /Please follow up with the release owner/,
    );
    assert.equal(
      await followThreadConfigFrame.locator('#new-follow-thread').isChecked(),
      true,
      'Watch prefill should enable the follow-thread rule toggle',
    );
    assert.equal(
      await followThreadConfigFrame.locator('#new-filter-sender').inputValue(),
      '',
      'Watch prefill should observe the conversation instead of only the original sender',
    );
    assert.equal(
      await followThreadConfigFrame.locator('#new-filter-group').inputValue(),
      'Release Team',
    );
    const expectedOriginalDateText = await followThreadConfigPage.evaluate(() =>
      new Date('2026-05-15T09:30:00Z').toLocaleString(),
    );
    assert.equal(
      (
        (await followThreadConfigFrame
          .locator('.original-message-collapse .datetime')
          .first()
          .textContent()) || ''
      ).trim(),
      expectedOriginalDateText,
      'Watch prefill should show the original message time, not the config click time',
    );
    const followThreadBoundaryText =
      (await followThreadConfigFrame
        .locator('.follow-thread-boundary-receipt')
        .textContent()) || '';
    assert.match(followThreadBoundaryText, /关注后续创建边界/);
    assert.match(
      followThreadBoundaryText,
      /默认监听「Release Team」内所有人的后续讨论/,
    );
    assert.match(followThreadBoundaryText, /不只看原发送人/);
    assert.match(followThreadBoundaryText, /监听期限：30 天后自动过期/);
    assert.match(
      followThreadBoundaryText,
      /reply\/thread\/@提及\/引用\/关键词/,
    );
    assert.match(followThreadBoundaryText, /语义匹配/);
    assert.match(followThreadBoundaryText, /只有点击保存后/);
    assert.match(followThreadBoundaryText, /不会启用 Watch/);
    assert.match(followThreadBoundaryText, /通知口径：Bot，即时提醒/);
    assert.match(followThreadBoundaryText, /不会回扫历史消息/);
    assert.match(followThreadBoundaryText, /不会立刻发送通知/);
    assert.match(followThreadBoundaryText, /不会立即写入长期记忆/);
    assert.match(
      followThreadBoundaryText,
      /不会创建自动答复或联动操作/,
    );
    followThreadConfigPage.on('dialog', async (dialog) => {
      await dialog.dismiss();
    });
    await followThreadConfigFrame
      .locator('.add-topic-form .form-buttons button')
      .first()
      .click();
    const followThreadSaveToast =
      (await followThreadConfigFrame
        .locator('.rule-operation-toast.success')
        .textContent()) || '';
    assert.match(followThreadSaveToast, /已保存关注后续/);
    assert.match(followThreadSaveToast, /原消息索引已写入/);
    assert.match(followThreadSaveToast, /语义匹配都可用/);
    assert.match(followThreadSaveToast, /通知口径：Bot，即时提醒/);
    assert.match(followThreadSaveToast, /监听期限：30 天后自动过期/);
    assert.match(followThreadSaveToast, /没有回扫历史消息/);
    assert.match(followThreadSaveToast, /没有立刻发送通知/);
    await followThreadConfigPage.close();
    await serviceWorker.evaluate(async () => {
      await chrome.storage.local.set({ concernedItems: [] });
    });

    await page.mouse.move(5, 5);
    await message.hover();
    await toolbar.waitFor({ state: 'visible', timeout: 8_000 });
    const linkedActionConfigPagePromise = context.waitForEvent('page', {
      timeout: 10_000,
    });
    await toolbar.locator('.linked-action-btn').click();
    const linkedActionConfigPage = await linkedActionConfigPagePromise;
    await page.waitForFunction(
      () =>
        document.body.textContent?.includes('已打开联动操作配置') &&
        document.body.textContent?.includes('当前只是草稿入口') &&
        document.body.textContent?.includes('尚未创建 RuntimeAction') &&
        document.body.textContent?.includes('未调用 OpenClaw') &&
        document.body.textContent?.includes('不会回扫历史消息') &&
        document.body.textContent?.includes('后续新消息命中后') &&
        document.body.textContent?.includes('动作队列'),
      null,
      { timeout: 5_000 },
    );
    await linkedActionConfigPage.waitForLoadState('domcontentloaded');
    assert.match(
      linkedActionConfigPage.url(),
      /memory-exploring\.html#\/memory-entry-rules\?surface=task&intent=linked-action$/,
      'Openclaw should open the canonical task-surface route rather than the legacy standalone form',
    );
    const linkedActionConfigFrame = linkedActionConfigPage.frameLocator(
      'iframe.rules-frame',
    );
    await linkedActionConfigFrame.locator('.add-topic-form').waitFor({
      timeout: 10_000,
    });
    assert.match(
      await linkedActionConfigFrame
        .locator('.add-topic-form .text-input')
        .inputValue(),
      /Please follow up with the release owner/,
    );
    const linkedActionTriggerText =
      (await linkedActionConfigFrame
        .locator('.linked-action-trigger-panel')
        .textContent()) || '';
    assert.match(
      linkedActionTriggerText,
      /Please follow up with the release owner/,
    );
    assert.match(linkedActionTriggerText, /Alicia Chen/);
    assert.match(linkedActionTriggerText, /Release Team/);
    assert.match(
      (await linkedActionConfigFrame
        .locator('.automation-offline-note')
        .first()
        .textContent()) || '',
      /连接前不会执行外部写操作/,
    );
    await linkedActionConfigPage.close();

    await page.mouse.move(5, 5);
    await message.hover();
    await toolbar.waitFor({ state: 'visible', timeout: 8_000 });

    const compactButtonMetrics = await page.$$eval(
      '.message-reaction-toolbar .message-reaction-action-btn',
      (buttons) =>
        buttons.map((button) => {
          const label = button.querySelector('.message-reaction-action-label');
          const labelText = button.querySelector(
            '.message-reaction-action-label-text',
          );
          const buttonRect = button.getBoundingClientRect();
          const labelRect = label?.getBoundingClientRect();
          const textRect = labelText?.getBoundingClientRect();
          return {
            className: button.className,
            compactAlign: button.getAttribute('data-compact-align') || 'start',
            buttonWidth: buttonRect.width,
            left: buttonRect.left,
            right: buttonRect.right,
            labelLeft: labelRect?.left ?? 0,
            labelRight: labelRect?.right ?? 0,
            labelWidth: labelRect?.width ?? 0,
            labelScrollWidth: label?.scrollWidth ?? 0,
            textLeft: textRect?.left ?? 0,
            textRight: textRect?.right ?? 0,
            textWidth: textRect?.width ?? 0,
            svgCount: button.querySelectorAll('svg').length,
          };
        }),
    );
    assert.equal(
      compactButtonMetrics.every(
        (metric) =>
          metric.labelScrollWidth > metric.labelWidth &&
          metric.buttonWidth < 48,
      ),
      true,
      `Toolbar buttons should render full labels clipped to two characters: ${JSON.stringify(
        compactButtonMetrics,
      )}`,
    );
    assert.equal(
      compactButtonMetrics[0]?.svgCount,
      0,
      'Snooze should be a compact text button instead of an icon button',
    );
    const autoReplyCompactTextMetric = compactButtonMetrics[2];
    assert.equal(autoReplyCompactTextMetric?.compactAlign, 'end');
    assert.ok(
      autoReplyCompactTextMetric &&
        autoReplyCompactTextMetric.textLeft <
          autoReplyCompactTextMetric.labelLeft - 10 &&
        Math.abs(
          autoReplyCompactTextMetric.textRight -
            autoReplyCompactTextMetric.labelRight,
        ) <= 1.5,
      `Auto reply should clip the full label from the right edge so compact text shows 答复: ${JSON.stringify(
        autoReplyCompactTextMetric,
      )}`,
    );
    const compactIconMetric = await toolbar.locator('.snooze-icon').evaluate(
      (icon) => {
        const rect = icon.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
        };
      },
    );
    const followThreadCompactMetric = compactButtonMetrics[1];
    assert.ok(followThreadCompactMetric);
    await toolbar.locator('.follow-thread-btn').hover();
    await delay(240);
    const followThreadExpandedMetric = await toolbar
      .locator('.follow-thread-btn')
      .evaluate((button) => {
        const label = button.querySelector('.message-reaction-action-label');
        const rect = button.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          labelWidth: label?.getBoundingClientRect().width ?? 0,
          labelScrollWidth: label?.scrollWidth ?? 0,
        };
      });
    assert.ok(
      followThreadExpandedMetric.width >
        followThreadCompactMetric.buttonWidth + 12,
      `Hovered button should expand to reveal the full label: ${JSON.stringify(
        { followThreadCompactMetric, followThreadExpandedMetric },
      )}`,
    );
    assert.ok(
      Math.abs(
        followThreadExpandedMetric.right - followThreadCompactMetric.right,
      ) <= 1 &&
        followThreadExpandedMetric.left < followThreadCompactMetric.left - 12,
      `Toolbar-right anchored expansion should keep the hovered button right edge stable and push left siblings: ${JSON.stringify(
        { followThreadCompactMetric, followThreadExpandedMetric },
      )}`,
    );
    assert.ok(
      followThreadExpandedMetric.labelWidth >=
        followThreadExpandedMetric.labelScrollWidth - 1,
      `Hovered label should reveal its full text: ${JSON.stringify(
        followThreadExpandedMetric,
      )}`,
    );
    assertToolbarItemsDoNotOverlap(
      await getVisibleToolbarItemBoxes(page),
      'Follow-thread hover',
    );
    const iconAfterFollowHover = await toolbar.locator('.snooze-icon').evaluate(
      (icon) => {
        const rect = icon.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
        };
      },
    );
    assert.ok(
      Math.abs(iconAfterFollowHover.right - compactIconMetric.right) <= 1 &&
        Math.abs(iconAfterFollowHover.left - compactIconMetric.left) <= 1,
      `Personal AI icon should stay fixed while buttons expand: ${JSON.stringify(
        { compactIconMetric, iconAfterFollowHover },
      )}`,
    );
    await toolbar.locator('.snooze-icon').hover();
    await delay(240);

    const autoReplyCompactWidth = compactButtonMetrics[2]?.buttonWidth ?? 0;
    const autoReplyCompactMetric = compactButtonMetrics[2];
    assert.ok(autoReplyCompactMetric);
    await toolbar.locator('.auto-reply-btn').hover();
    await delay(240);
    const autoReplyExpandedMetric = await toolbar
      .locator('.auto-reply-btn')
      .evaluate((button) => {
        const label = button.querySelector('.message-reaction-action-label');
        const rect = button.getBoundingClientRect();
        return {
          buttonWidth: button.getBoundingClientRect().width,
          left: rect.left,
          right: rect.right,
          labelWidth: label?.getBoundingClientRect().width ?? 0,
          labelScrollWidth: label?.scrollWidth ?? 0,
        };
      });
    assert.ok(
      autoReplyExpandedMetric.buttonWidth > autoReplyCompactWidth + 12,
      `Hovered button should expand to reveal the full label: ${JSON.stringify(
        autoReplyExpandedMetric,
      )}`,
    );
    assert.ok(
      Math.abs(autoReplyExpandedMetric.right - autoReplyCompactMetric.right) <=
        1 &&
        autoReplyExpandedMetric.left < autoReplyCompactMetric.left - 12,
      `Auto reply should keep its right edge stable and push left siblings: ${JSON.stringify(
        { autoReplyCompactMetric, autoReplyExpandedMetric },
      )}`,
    );
    assert.ok(
      autoReplyExpandedMetric.labelWidth >=
        autoReplyExpandedMetric.labelScrollWidth - 1,
      `Hovered label should reveal its full text: ${JSON.stringify(
        autoReplyExpandedMetric,
      )}`,
    );
    assertToolbarItemsDoNotOverlap(
      await getVisibleToolbarItemBoxes(page),
      'Auto-reply hover',
    );
    const iconAfterAutoReplyHover = await toolbar.locator('.snooze-icon').evaluate(
      (icon) => {
        const rect = icon.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
        };
      },
    );
    assert.ok(
      Math.abs(iconAfterAutoReplyHover.right - compactIconMetric.right) <= 1 &&
        Math.abs(iconAfterAutoReplyHover.left - compactIconMetric.left) <= 1,
      `Personal AI icon should stay fixed while auto reply expands: ${JSON.stringify(
        { compactIconMetric, iconAfterAutoReplyHover },
      )}`,
    );
    const hiddenSettingsLayout = await toolbar.evaluate((toolbarElement) => {
      const firstAction = toolbarElement.querySelector(
        '.message-reaction-action-btn',
      );
      const settingsButton = toolbarElement.querySelector(
        '.reaction-settings-btn',
      );
      if (!firstAction || !settingsButton) return null;
      const toolbarRect = toolbarElement.getBoundingClientRect();
      const firstActionRect = firstAction.getBoundingClientRect();
      const settingsRect = settingsButton.getBoundingClientRect();
      return {
        toolbarLeft: toolbarRect.left,
        firstActionLeft: firstActionRect.left,
        settingsRight: settingsRect.right,
        settingsPointerEvents: window.getComputedStyle(settingsButton)
          .pointerEvents,
        settingsTabIndex: settingsButton.tabIndex,
        settingsAriaHidden: settingsButton.getAttribute('aria-hidden'),
      };
    });
    assert.ok(hiddenSettingsLayout);
    assert.ok(
      Math.abs(
        hiddenSettingsLayout.toolbarLeft -
          hiddenSettingsLayout.firstActionLeft,
      ) <= 0.5,
      `Hidden settings button must not reserve toolbar space: ${JSON.stringify(
        hiddenSettingsLayout,
      )}`,
    );
    assert.equal(hiddenSettingsLayout.settingsPointerEvents, 'none');
    assert.equal(hiddenSettingsLayout.settingsTabIndex, -1);
    assert.equal(hiddenSettingsLayout.settingsAriaHidden, 'true');
    const toolbarItemBoxes = await page.$$eval(
      '.message-reaction-toolbar .message-reaction-action-btn, .message-reaction-toolbar .snooze-icon',
      (items) =>
        items.map((item) => ({
          className: item.className,
          top: item.getBoundingClientRect().top,
          bottom: item.getBoundingClientRect().bottom,
          height: item.getBoundingClientRect().height,
        })),
    );
    const firstBox = toolbarItemBoxes[0];
    assert.ok(firstBox, 'Expected toolbar item boxes to be measurable');
    assert.equal(
      toolbarItemBoxes.every(
        (box) =>
          Math.abs(box.top - firstBox.top) <= 0.5 &&
          Math.abs(box.bottom - firstBox.bottom) <= 0.5 &&
          Math.abs(box.height - firstBox.height) <= 0.5,
      ),
      true,
      `Toolbar items should share one vertical baseline: ${JSON.stringify(
        toolbarItemBoxes,
      )}`,
    );

    await page.mouse.move(5, 5);
    await page.waitForFunction(
      () =>
        document.querySelector('.message-reaction-toolbar')?.getAttribute(
          'aria-hidden',
        ) === 'true' &&
        !document.querySelector('.message-reaction-toolbar.visible'),
      null,
      { timeout: 3_000 },
    );
    const hiddenToolbarA11y = await message
      .locator('.message-reaction-toolbar')
      .evaluate((toolbarElement) => ({
        ariaHidden: toolbarElement.getAttribute('aria-hidden'),
        buttonStates: Array.from(toolbarElement.querySelectorAll('button')).map(
          (button) => ({
            className: button.className,
            tabIndex: button.tabIndex,
            ariaHidden: button.getAttribute('aria-hidden'),
          }),
        ),
      }));
    assert.equal(hiddenToolbarA11y.ariaHidden, 'true');
    assert.equal(
      hiddenToolbarA11y.buttonStates.every((button) => button.tabIndex === -1),
      true,
      `Hidden toolbar controls should leave the tab order: ${JSON.stringify(
        hiddenToolbarA11y,
      )}`,
    );

    await message.click();
    await delay(500);
    assert.equal(
      await message.locator('.message-reaction-toolbar.visible').count(),
      0,
      'Clicking the message should not reveal the toolbar before the 4s hover delay',
    );
    const clickRevealState = await message.evaluate((messageElement) => {
      const toolbarElement = messageElement.querySelector(
        '.message-reaction-toolbar',
      );
      return {
        focusAnchor: messageElement.getAttribute(
          'data-pai-message-reaction-focus-anchor',
        ),
        tabIndex: messageElement.tabIndex,
        activeIsMessage: document.activeElement === messageElement,
        ariaHidden: toolbarElement?.getAttribute('aria-hidden'),
        visible: toolbarElement?.classList.contains('visible') || false,
      };
    });
    assert.deepEqual(
      clickRevealState,
      {
        focusAnchor: null,
        tabIndex: -1,
        activeIsMessage: false,
        ariaHidden: 'true',
        visible: false,
      },
      `Message click should not create a focus reveal path: ${JSON.stringify(
        clickRevealState,
      )}`,
    );
    await message.evaluate((messageElement) => messageElement.focus());
    await delay(500);
    assert.equal(
      await message.locator('.message-reaction-toolbar.visible').count(),
      0,
      'Focusing the message should not reveal the toolbar without the hover delay',
    );
    await page.mouse.move(5, 5);
    await page.waitForFunction(
      () => {
        const messageElement = document.querySelector(
          '.conversation-card-wrapper[data-id="msg-1"]',
        );
        const toolbarElement = messageElement?.querySelector(
          '.message-reaction-toolbar',
        );
        return (
          toolbarElement?.getAttribute('aria-hidden') === 'true' &&
          !toolbarElement?.classList.contains('visible')
        );
      },
      null,
      { timeout: 3_000 },
    );

    const ownMessage = page.locator(
      '.conversation-card-wrapper[data-id="msg-own"]',
    );
    await ownMessage.hover();
    const ownToolbar = ownMessage.locator('.message-reaction-toolbar.visible');
    await ownToolbar.waitFor({ state: 'visible', timeout: 8_000 });
    const ownActions = await ownMessage
      .locator('.message-reaction-toolbar .message-reaction-action-btn')
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute('aria-label')),
      );
    assert.deepEqual(ownActions, [
      '稍后处理',
      WATCH_BOUNDARY_LABEL,
      '跟进追问',
      LINKED_ACTION_BOUNDARY_LABEL,
    ]);

    await ownMessage.locator('.followup-ask-btn').click();
    await page.waitForSelector('.followup-ask-dialog', { timeout: 3_000 });
    assert.equal(
      await page.locator('.followup-ask-target-value').textContent(),
      'Release Team（提及 Jordan Lee）',
    );
    assert.match(
      (await page.locator('.followup-ask-run-summary').textContent()) || '',
      /立即检查/,
    );
    assert.match(
      (await page.locator('.followup-ask-run-summary').textContent()) || '',
      /最多自动追问 1 次/,
    );
    assert.equal(
      (await page.locator('.followup-ask-submit').textContent())?.trim(),
      '创建跟进',
    );
    const initialFollowupSubmitTitle =
      (await page.locator('.followup-ask-submit').getAttribute('title')) || '';
    const initialFollowupSubmitAria =
      (await page.locator('.followup-ask-submit').getAttribute('aria-label')) ||
      '';
    assert.match(initialFollowupSubmitTitle, /创建跟进/);
    assert.match(
      initialFollowupSubmitTitle,
      /锚定 Release Team（提及 Jordan Lee）和这条原消息/,
    );
    assert.match(initialFollowupSubmitTitle, /先检查|立即检查/);
    assert.match(initialFollowupSubmitTitle, /最多自动追问 1 次/);
    assert.match(initialFollowupSubmitTitle, /不会立刻发送新消息/);
    assert.match(initialFollowupSubmitTitle, /不写 Google Sheet/);
    assert.match(initialFollowupSubmitTitle, /不创建可复用 Outreach template/);
    assert.equal(initialFollowupSubmitAria, initialFollowupSubmitTitle);
    const followupBoundaryReceipt = page.locator('.followup-ask-boundary');
    await followupBoundaryReceipt.waitFor({ state: 'visible', timeout: 3_000 });
    const followupBoundaryText =
      (await followupBoundaryReceipt.textContent()) || '';
    assert.match(followupBoundaryText, /创建边界/);
    assert.match(
      followupBoundaryText,
      /只锚定 Release Team（提及 Jordan Lee）和这条原消息/,
    );
    assert.match(followupBoundaryText, /先检查原消息线程/);
    assert.match(followupBoundaryText, /最多追问次数设为 0/);
    assert.match(followupBoundaryText, /不自动发送 AI 追问/);
    assert.match(followupBoundaryText, /不会立刻发送新消息/);
    assert.match(followupBoundaryText, /不写 Google Sheet/);
    assert.match(followupBoundaryText, /不创建可复用 Outreach template/);
    assert.match(followupBoundaryText, /复用旧 session/);
    await page.locator('.followup-ask-submit').click();
    await page.waitForSelector('.followup-ask-textarea.input-error', {
      timeout: 3_000,
    });
    assert.match(
      (await page.locator('.followup-ask-error').textContent()) || '',
      /请先填写追问要拿到的信息/,
    );
    await page
      .locator('#followup-ask-objective')
      .fill('确认最终发布日期和是否需要额外资源');
    await page
      .locator('.followup-ask-details')
      .nth(1)
      .locator('summary')
      .click();
    await page.locator('#followup-ask-interval').fill('9999');
    await page.locator('#followup-ask-max').fill('99');
    const clampedFollowupSummary =
      (await page.locator('.followup-ask-run-summary').textContent()) || '';
    assert.match(clampedFollowupSummary, /原消息已超过 720 小时/);
    assert.match(clampedFollowupSummary, /最多自动追问 10 次/);
    await page.locator('#followup-ask-max').fill('0');
    const zeroFollowupSummary =
      (await page.locator('.followup-ask-run-summary').textContent()) || '';
    assert.match(zeroFollowupSummary, /最多追问次数为 0/);
    assert.match(zeroFollowupSummary, /不自动发送 AI 追问/);
    assert.doesNotMatch(zeroFollowupSummary, /后追问/);
    const zeroFollowupSubmitBoundary =
      (await page.locator('.followup-ask-submit').getAttribute('aria-label')) ||
      '';
    assert.match(zeroFollowupSubmitBoundary, /原消息已超过 720 小时/);
    assert.match(zeroFollowupSubmitBoundary, /最多追问次数为 0/);
    assert.match(zeroFollowupSubmitBoundary, /不自动发送 AI 追问/);
    assert.match(zeroFollowupSubmitBoundary, /不会立刻发送新消息/);
    assert.doesNotMatch(zeroFollowupSubmitBoundary, /后追问/);
    await page.locator('.followup-ask-submit').click();
    await page.waitForFunction(
      () =>
        document.querySelector('.followup-ask-run-summary')?.textContent?.includes(
          '正在创建或复用跟进会话',
        ) &&
        document.querySelector('.followup-ask-run-summary')?.textContent?.includes(
          '不会发送追问',
        ) &&
        document.querySelector('.followup-ask-run-summary')?.textContent?.includes(
          '刷新本地跟进标注',
        ) &&
        document.querySelector('.followup-ask-run-summary')?.textContent?.includes(
          '不会自动发送 AI 追问',
        ),
      null,
      { timeout: 3_000 },
    );
    await page.waitForSelector('.followup-ask-overlay', {
      state: 'detached',
      timeout: 5_000,
    });
    const capturedFollowup = await waitForRequest(
      memoryFixture.requests,
      'follow-up ask payload',
    );
    assert.equal(capturedFollowup.chatId, '12345');
    assert.equal(capturedFollowup.postId, 'msg-own');
    assert.equal(
      capturedFollowup.targetResolvedLabel,
      'Release Team（提及 Jordan Lee）',
    );
    assert.equal(
      capturedFollowup.followupIntervalSeconds,
      720 * 60 * 60,
    );
    assert.equal(capturedFollowup.maxFollowup, 0);
    assert.equal(
      capturedFollowup.context,
      '确认最终发布日期和是否需要额外资源',
    );
    assert.equal(
      capturedFollowup.informationGoal,
      '确认最终发布日期和是否需要额外资源',
    );
    assert.equal(capturedFollowup.messageCreatedAt, 1_778_841_000);
    const reviewAction = page.locator('.snooze-toast-action', {
      hasText: '查看追问',
    });
    await reviewAction.waitFor({ state: 'visible', timeout: 3_000 });
    await page.waitForFunction(
      () =>
        document.body.textContent?.includes('已创建跟进会话') &&
        document.body.textContent?.includes('未立刻发送追问') &&
        document.body.textContent?.includes('最早') &&
        document.body.textContent?.includes('再次检查') &&
        document.body.textContent?.includes('不会自动发送 AI 追问'),
      null,
      { timeout: 5_000 },
    );
    const followupSuccessToastText =
      (await page.locator('.snooze-toast-success').last().textContent()) || '';
    assert.match(followupSuccessToastText, /已创建跟进会话/);
    assert.match(followupSuccessToastText, /再次检查/);
    assert.match(followupSuccessToastText, /不会自动发送 AI 追问/);
    assert.doesNotMatch(followupSuccessToastText, /后追问/);
    const reviewPagePromise = context.waitForEvent('page', {
      timeout: 10_000,
    });
    await reviewAction.click();
    const reviewPage = await reviewPagePromise;
    await reviewPage.waitForLoadState('domcontentloaded');
    assert.match(
      reviewPage.url(),
      /memory-exploring\.html#\/outreach\/session-from-message$/,
      'Follow-up success toast should link to the created Outreach session',
    );
    await reviewPage.close();

    await page.mouse.move(5, 5);
    await ownMessage.hover();
    await ownMessage
      .locator('.message-reaction-toolbar.visible')
      .waitFor({ state: 'visible', timeout: 8_000 });
    await ownMessage.locator('.followup-ask-btn').click();
    await page.waitForSelector('.followup-ask-dialog', { timeout: 3_000 });
    await page
      .locator('#followup-ask-objective')
      .fill('再次确认最终发布日期');
    await page.locator('.followup-ask-submit').click();
    await page.waitForFunction(
      () => document.querySelectorAll('.followup-ask-overlay').length === 0,
      null,
      { timeout: 5_000 },
    );
    await page.waitForFunction(
      () =>
        document.body.textContent?.includes(
          '这条消息已有跟进，未覆盖原目标：确认最终发布日期和是否需要额外资源',
        ),
      null,
      { timeout: 5_000 },
    );
    assert.equal(
      await page.locator('.snooze-toast-action', { hasText: '查看追问' }).count(),
      1,
      'Duplicate follow-up toast should still offer a path to the existing session',
    );
    assert.equal(memoryFixture.requests.length, 2);
    assert.equal(
      memoryFixture.requests[1].informationGoal,
      '再次确认最终发布日期',
    );

    await page.mouse.move(5, 5);
    await message.hover();
    await toolbar.waitFor({ state: 'visible', timeout: 8_000 });

    await toolbar.hover();
    await page.waitForFunction(
      () =>
        document.querySelector('.reaction-settings-btn.visible')?.tagName ===
        'BUTTON',
      null,
      { timeout: 7_000 },
    );
    const visibleSettingsLayout = await toolbar.evaluate((toolbarElement) => {
      const firstAction = toolbarElement.querySelector(
        '.message-reaction-action-btn',
      );
      const settingsButton = toolbarElement.querySelector(
        '.reaction-settings-btn',
      );
      if (!firstAction || !settingsButton) return null;
      const firstActionRect = firstAction.getBoundingClientRect();
      const settingsRect = settingsButton.getBoundingClientRect();
      return {
        firstActionLeft: firstActionRect.left,
        settingsRight: settingsRect.right,
        settingsPointerEvents: window.getComputedStyle(settingsButton)
          .pointerEvents,
        settingsTabIndex: settingsButton.tabIndex,
        settingsAriaHidden: settingsButton.getAttribute('aria-hidden'),
      };
    });
    assert.ok(visibleSettingsLayout);
    assert.ok(
      visibleSettingsLayout.settingsRight <=
        visibleSettingsLayout.firstActionLeft - 2,
      `Visible settings button should appear beside the toolbar, not inside it: ${JSON.stringify(
        visibleSettingsLayout,
      )}`,
    );
    assert.equal(visibleSettingsLayout.settingsPointerEvents, 'auto');
    assert.equal(visibleSettingsLayout.settingsTabIndex, 0);
    assert.equal(visibleSettingsLayout.settingsAriaHidden, 'false');

    await toolbar.locator('.reaction-settings-btn.visible').click();
    await page.waitForSelector('.reaction-settings-popup', { timeout: 3_000 });
    assert.equal(
      (
        (await page
          .locator('.reaction-settings-popup .reaction-settings-header')
          .textContent()) || ''
      ).trim(),
      '消息交互功能设置',
    );
    const settingsLabels = await page.$$eval(
      '.reaction-settings-popup .reaction-settings-label',
      (labels) => labels.map((label) => label.textContent?.trim()),
    );
    assert.deepEqual(settingsLabels, [
      '稍后处理',
      '关注后续',
      '自动答复 / 跟进追问',
      '联动操作',
    ]);
    const settingsScopeText =
      (await page.locator('.reaction-settings-scope').textContent()) || '';
    assert.match(settingsScopeText, /本地显示开关/);
    assert.match(settingsScopeText, /只改变此浏览器消息旁工具栏按钮显示/);
    assert.match(settingsScopeText, /不会取消已创建提醒、关注、追问、自动答复规则或联动操作/);
    assert.match(settingsScopeText, /已排队或已保存的任务仍从各自管理页处理/);
    assert.match(settingsScopeText, /保存后/);
    assert.match(
      settingsScopeText,
      /将显示：稍后处理、关注后续、自动答复 \/ 跟进追问、联动操作/,
    );
    await page.locator('.reaction-settings-checkbox[data-feature="snooze"]').uncheck();
    await page.locator('.reaction-settings-checkbox[data-feature="followThread"]').uncheck();
    await page.locator('.reaction-settings-checkbox[data-feature="autoReply"]').uncheck();
    await page.locator('.reaction-settings-checkbox[data-feature="linkedAction"]').uncheck();
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-settings-preview-value]')
          ?.textContent?.includes('将隐藏本地消息工具栏'),
      null,
      { timeout: 2_000 },
    );
    const hiddenSettingsPreview =
      (await page.locator('[data-settings-preview-value]').textContent()) || '';
    assert.match(hiddenSettingsPreview, /已创建事项仍不受影响/);
    assert.equal(
      (
        (await page
          .locator('.reaction-settings-popup .reaction-settings-hint')
          .textContent()) || ''
      ).trim(),
      '关闭后，对应按钮将不再显示',
    );
    await delay(150);
    await page.mouse.click(5, 5);
    await page.waitForSelector('.reaction-settings-popup', {
      state: 'detached',
      timeout: 3_000,
    });
    await message.hover();
    await toolbar.waitFor({ state: 'visible', timeout: 8_000 });

    const snoozeButton = message.locator('.snooze-icon-btn');
    assert.equal(await snoozeButton.getAttribute('aria-haspopup'), 'menu');
    assert.equal(await snoozeButton.getAttribute('aria-expanded'), 'false');

    await serviceWorker.evaluate(async () => {
      const result = await chrome.storage.local.get(['glipMessageMarkers']);
      await chrome.storage.local.set({
        glipMessageMarkers: {
          ...(result.glipMessageMarkers || {
            version: 1,
            markersByChatId: {},
          }),
          updatedAt: Date.now(),
          markersByChatId: {},
        },
      });
    });
    await snoozeButton.click();
    await page.waitForSelector('.snooze-menu', { timeout: 3_000 });
    const newSnoozeReceiptText =
      (await page.locator('.snooze-menu-receipt').textContent()) || '';
    assert.doesNotMatch(newSnoozeReceiptText, /提醒路径/);
    assert.match(newSnoozeReceiptText, /提醒时间口径/);
    assert.match(newSnoozeReceiptText, /会创建提醒到/);
    assert.match(newSnoozeReceiptText, /15 分钟后/);
    assert.match(newSnoozeReceiptText, /点击具体时间后才写入 Scheduled Messages/);
    assert.match(newSnoozeReceiptText, /不会发送消息、标记已读或完成原消息/);
    assert.match(newSnoozeReceiptText, /成功后原消息标注仍等后台同步/);
    const newFirstOption = page.locator('.snooze-quick-option').first();
    const newFirstOptionAria = (await newFirstOption.getAttribute('aria-label')) || '';
    const newFirstOptionTitle = (await newFirstOption.getAttribute('title')) || '';
    assert.match(newFirstOptionAria, /提醒时间口径/);
    assert.match(newFirstOptionAria, /会创建提醒到/);
    assert.match(newFirstOptionAria, /点击具体时间后才写入 Scheduled Messages/);
    assert.match(newFirstOptionAria, /不会发送消息、标记已读或完成原消息/);
    assert.equal(
      newFirstOptionTitle,
      newFirstOptionAria,
      'Snooze quick option title should mirror the control boundary aria label',
    );
    await page.mouse.click(5, 5);
    await page.waitForSelector('.snooze-menu', {
      state: 'detached',
      timeout: 3_000,
    });
    await serviceWorker.evaluate(async () => {
      const result = await chrome.storage.local.get(['glipMessageMarkers']);
      await chrome.storage.local.set({
        glipMessageMarkers: {
          ...(result.glipMessageMarkers || {
            version: 1,
            markersByChatId: {},
          }),
          updatedAt: Date.now(),
          markersByChatId: {
            12345: {
              'msg-1': [
                {
                  id: 'snooze-pending:snooze-row-1:12345:msg-1',
                  type: 'snooze_pending',
                  label: '稍后 5/18 09:00',
                  chatId: '12345',
                  postId: 'msg-1',
                  source: 'sheet',
                  sourceId: 'snooze-row-1',
                  updatedAt: 1778840900,
                  tooltip: '提醒时间：2026-05-18 09:00',
                },
              ],
            },
          },
        },
      });
    });
    await message.hover();
    await toolbar.waitFor({ state: 'visible', timeout: 8_000 });

    await serviceWorker.evaluate(async () => {
      const staleUpdatedAt = Math.floor((Date.now() - 31 * 60 * 1000) / 1000);
      const result = await chrome.storage.local.get(['glipMessageMarkers']);
      await chrome.storage.local.set({
        glipMessageMarkers: {
          ...(result.glipMessageMarkers || {
            version: 1,
            markersByChatId: {},
          }),
          updatedAt: staleUpdatedAt,
        },
      });
    });
    await snoozeButton.click();
    await page.waitForSelector('.snooze-menu', { timeout: 3_000 });
    const staleSnoozeReceiptText =
      (await page.locator('.snooze-menu-receipt').textContent()) || '';
    assert.match(staleSnoozeReceiptText, /已在本地标注为 稍后 5\/18 09:00/);
    assert.match(staleSnoozeReceiptText, /会改到/);
    assert.match(staleSnoozeReceiptText, /可能过旧/);
    assert.match(staleSnoozeReceiptText, /刷新会话或等待后台同步后再确认/);
    await page.mouse.click(5, 5);
    await page.waitForSelector('.snooze-menu', {
      state: 'detached',
      timeout: 3_000,
    });
    await serviceWorker.evaluate(async () => {
      const result = await chrome.storage.local.get(['glipMessageMarkers']);
      await chrome.storage.local.set({
        glipMessageMarkers: {
          ...(result.glipMessageMarkers || {
            version: 1,
            markersByChatId: {},
          }),
          updatedAt: Date.now(),
        },
      });
    });
    await message.hover();
    await toolbar.waitFor({ state: 'visible', timeout: 8_000 });

    await snoozeButton.click();
    await page.waitForSelector('.snooze-menu', { timeout: 3_000 });
    assert.equal(
      await page.locator('.snooze-menu').isVisible(),
      true,
      'Clicking Snooze should open the quick menu instead of creating a default reminder',
    );
    const snoozeReceiptText =
      (await page.locator('.snooze-menu-receipt').textContent()) || '';
    assert.doesNotMatch(snoozeReceiptText, /提醒路径/);
    assert.match(snoozeReceiptText, /改期预览/);
    assert.match(
      snoozeReceiptText,
      /已在本地标注为 稍后 5\/18 09:00/,
    );
    assert.match(snoozeReceiptText, /会改到/);
    assert.match(snoozeReceiptText, /15 分钟后/);
    assert.match(snoozeReceiptText, /仍是同源 Snooze，不新增第二条/);
    assert.match(snoozeReceiptText, /来自本地 marker 快照/);
    assert.match(snoozeReceiptText, /不是实时远端查询/);
    const rescheduleFirstOptionAria =
      (await page.locator('.snooze-quick-option').first().getAttribute('aria-label')) || '';
    assert.match(rescheduleFirstOptionAria, /改期预览/);
    assert.match(rescheduleFirstOptionAria, /会改到/);
    assert.match(rescheduleFirstOptionAria, /仍是同源 Snooze，不新增第二条/);
    assert.match(rescheduleFirstOptionAria, /来自本地 marker 快照/);
    await page.mouse.click(5, 5);
    await page.waitForSelector('.snooze-menu', {
      state: 'detached',
      timeout: 3_000,
    });
    assert.equal(await snoozeButton.getAttribute('aria-expanded'), 'false');

    await snoozeButton.focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForSelector('.snooze-menu', { timeout: 3_000 });
    assert.equal(await snoozeButton.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('.snooze-menu').getAttribute('role'), 'menu');
    assert.equal(
      await page.locator('.snooze-menu').getAttribute('aria-busy'),
      'false',
    );
    assert.equal(
      await page.locator('.snooze-menu button[role="menuitem"]').count(),
      await page.locator('.snooze-menu button').count(),
    );
    assert.equal(
      await page.evaluate(() =>
        document.activeElement?.classList.contains('snooze-quick-option'),
      ),
      true,
    );
    await page.keyboard.press('End');
    assert.equal(
      await page.evaluate(() =>
        document.activeElement?.classList.contains('snooze-manage-option'),
      ),
      true,
    );
    await page.keyboard.press('Escape');
    await page.waitForSelector('.snooze-menu', {
      state: 'detached',
      timeout: 3_000,
    });
    assert.equal(await snoozeButton.getAttribute('aria-expanded'), 'false');

    await page.mouse.move(5, 5);
    await message.hover();
    await toolbar.waitFor({ state: 'visible', timeout: 8_000 });
    await snoozeButton.hover();
    await page.waitForSelector('.snooze-menu', { timeout: 3_000 });
    const snoozeMenuBox = await page.locator('.snooze-menu').boundingBox();
    assert.ok(snoozeMenuBox, 'Expected Snooze menu to be measurable');
    await page.mouse.move(
      snoozeMenuBox.x + snoozeMenuBox.width / 2,
      snoozeMenuBox.y + Math.min(18, snoozeMenuBox.height / 2),
      { steps: 8 },
    );
    await delay(320);
    assert.equal(
      await page.locator('.snooze-menu').isVisible(),
      true,
      'Snooze menu should stay open while moving from the text button into the menu',
    );
    const quickLabels = await page.$$eval('.snooze-quick-option-label', (els) =>
      els.map((el) => el.textContent?.trim()),
    );
    assert.ok(
      quickLabels.length >= 6 && quickLabels.length <= 9,
      `Expected 6 to 9 quick options, got ${quickLabels.length}`,
    );
    assert.deepEqual(quickLabels.slice(0, 5), [
      '15 分钟后',
      '30 分钟后',
      '1 小时后',
      '2 小时后',
      '3 小时后',
    ]);
    const routineLabels = quickLabels.slice(5);
    assert.ok(
      routineLabels.filter((label) => label === '下个整点').length <= 1,
      `Expected at most one next-full-hour option in ${routineLabels.join(', ')}`,
    );
    const workdayEndLabel = routineLabels.find((label) =>
      label?.endsWith('下班前'),
    );
    if (workdayEndLabel) {
      assert.match(workdayEndLabel, /^(今天|明天|周[一二三四五] )下班前$/);
    }
    assert.ok(
      routineLabels.some((label) => /^(明天|周[一二三四五]) 9 点$/.test(label)),
      `Expected next workday morning option in ${routineLabels.join(', ')}`,
    );
    if (routineLabels.includes('下周一 9 点')) {
      assert.equal(routineLabels.at(-1), '下周一 9 点');
    }

    const quickTimes = await page.$$eval('.snooze-quick-option-time', (els) =>
      els.map((el) => el.textContent?.trim()),
    );
    assert.equal(quickTimes.length, quickLabels.length);
    assert.equal(quickTimes.every(Boolean), true);
    assert.equal(new Set(quickTimes).size, quickTimes.length);
    const customOptionAria =
      (await page.locator('.snooze-custom-option').getAttribute('aria-label')) || '';
    const manageOptionAria =
      (await page.locator('.snooze-manage-option').getAttribute('aria-label')) || '';
    assert.match(customOptionAria, /打开自定义时间选择器/);
    assert.match(customOptionAria, /只有确认未来时间后才创建或改期 Snooze/);
    assert.match(manageOptionAria, /只打开 Scheduled Messages 的 Snooze 视图/);
    assert.match(manageOptionAria, /不会创建、改期、完成或删除提醒/);

    const snoozeManagePagePromise = context.waitForEvent('page', {
      timeout: 10_000,
    });
    await page.locator('.snooze-manage-option').click();
    const snoozeManagePage = await snoozeManagePagePromise;
    await snoozeManagePage.waitForLoadState('domcontentloaded');
    assert.match(
      snoozeManagePage.url(),
      /scheduled-messages\.html\?category=Snooze$/,
      'Snooze manage entry should open the filtered Scheduled Messages view',
    );
    await snoozeManagePage.close();

    await page.mouse.move(5, 5);
    await message.hover();
    await toolbar.waitFor({ state: 'visible', timeout: 8_000 });
    await snoozeButton.hover();
    await page.waitForSelector('.snooze-menu', { timeout: 3_000 });

    await page.locator('.snooze-custom-option').click();
    await page.waitForSelector('.snooze-picker', { timeout: 3_000 });
    assert.equal(
      await page.locator('.snooze-picker-back').evaluate((element) => element.tagName),
      'BUTTON',
    );
    assert.equal(
      await page
        .locator('label[for="personal-ai-snooze-datetime"]')
        .textContent(),
      '选择日期和时间',
    );
    assert.equal(
      await page.evaluate(
        () => document.activeElement?.id === 'personal-ai-snooze-datetime',
      ),
      true,
      'Custom Snooze picker should move focus to the datetime input',
    );
    await page.locator('.snooze-picker-back').click();
    await page.waitForSelector('.snooze-menu', { timeout: 3_000 });
    assert.equal(
      await page.evaluate(() =>
        document.activeElement?.classList.contains('snooze-quick-option'),
      ),
      true,
      'Returning from custom Snooze should restore keyboard focus to the quick menu',
    );
    await page.locator('.snooze-custom-option').click();
    await page.waitForSelector('.snooze-picker', { timeout: 3_000 });
    const pickerDefaultValue = await page
      .locator('.snooze-datetime-input')
      .inputValue();
    const pickerDefaultDay = new Date(pickerDefaultValue).getDay();
    assert.notEqual(pickerDefaultDay, 0);
    assert.notEqual(pickerDefaultDay, 6);
    await page.locator('.snooze-datetime-input').fill('2000-01-01T09:00');
    await page.waitForSelector('.snooze-preview-time.invalid', {
      timeout: 3_000,
    });
    assert.equal(
      await page.locator('.snooze-preview-time.invalid').textContent(),
      '请选择未来时间',
    );
    assert.equal(await page.locator('.snooze-btn-confirm').isDisabled(), true);
    await page.locator('.snooze-btn-cancel').click();
    await page.waitForSelector('.snooze-picker', {
      state: 'detached',
      timeout: 3_000,
    });

    const composeScheduleButton = page.locator('.pai-glip-compose-schedule-btn');
    await composeScheduleButton.waitFor({ state: 'visible', timeout: 8_000 });
    const composeSchedulePlacement = await composeScheduleButton.evaluate(
      (button) => {
        const toolbar = document.querySelector('.composer-toolbar');
        const more = toolbar?.querySelector('.composer-more');
        const inlineReply = button.closest('[data-test-automation-id="reply-inline-input"]');
        const buttonStyle = window.getComputedStyle(button);
        const brand = button.querySelector('.pai-glip-compose-schedule-brand');
        const brandStyle = brand ? window.getComputedStyle(brand) : null;
        const buttonRect = button.getBoundingClientRect();
        const moreRect = more?.getBoundingClientRect();
        const brandRect = brand?.getBoundingClientRect();
        const svgRect = button.querySelector('svg')?.getBoundingClientRect();
        return {
          placement: button.getAttribute('data-pai-placement'),
          pin: button.getAttribute('data-pai-toolbar-pin'),
          toolbarPresent: Boolean(toolbar),
          parentTag: button.parentElement?.tagName,
          inInlineReply: Boolean(inlineReply),
          sameLineAsMore: Boolean(
            moreRect &&
              Math.abs(
                buttonRect.top +
                  buttonRect.height / 2 -
                  (moreRect.top + moreRect.height / 2),
              ) <= 4,
          ),
          clampedToViewportBottom: Boolean(
            moreRect &&
              moreRect.bottom > window.innerHeight &&
              Math.abs(buttonRect.top - (window.innerHeight - buttonRect.height - 8)) <= 1,
          ),
          lineCenterDelta: moreRect
            ? Math.abs(
                buttonRect.top +
                  buttonRect.height / 2 -
                  (moreRect.top + moreRect.height / 2),
              )
            : null,
          rightOfMore: Boolean(moreRect && buttonRect.left >= moreRect.right - 0.5),
          brandBadgeTopRight: Boolean(
            brandRect &&
              brandRect.right <= buttonRect.right + 0.5 &&
              buttonRect.right - brandRect.right <= 4 &&
              brandRect.top >= buttonRect.top - 0.5 &&
              brandRect.top - buttonRect.top <= 4,
          ),
          buttonLeft: buttonRect.left,
          buttonRight: buttonRect.right,
          buttonTop: buttonRect.top,
          buttonCenterY: buttonRect.top + buttonRect.height / 2,
          moreLeft: moreRect?.left ?? 0,
          moreRight: moreRect?.right ?? 0,
          moreTop: moreRect?.top ?? 0,
          moreCenterY: moreRect ? moreRect.top + moreRect.height / 2 : 0,
          moreLabel: more
            ? [
                more.getAttribute('aria-label'),
                more.getAttribute('title'),
                more.textContent,
              ]
                .filter(Boolean)
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim()
            : '',
          svgWidth: svgRect?.width ?? 0,
          svgHeight: svgRect?.height ?? 0,
          brandWidth: brandRect?.width ?? 0,
          brandHeight: brandRect?.height ?? 0,
          brandOpacity: Number.parseFloat(brandStyle?.opacity || '0'),
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          visibleInViewport:
            buttonRect.left >= 0 &&
            buttonRect.right <= window.innerWidth &&
            buttonRect.top >= 0 &&
            buttonRect.bottom <= window.innerHeight,
          position: buttonStyle.position,
          borderRadius: buttonStyle.borderRadius,
          brandImage: brandStyle?.backgroundImage || '',
        };
      },
    );
    assert.equal(composeSchedulePlacement.placement, 'toolbar');
    assert.equal(composeSchedulePlacement.toolbarPresent, true);
    assert.equal(composeSchedulePlacement.parentTag, 'BODY');
    assert.equal(composeSchedulePlacement.inInlineReply, false);
    assert.equal(
      await page.locator('[data-test-automation-id="reply-inline-input"] .pai-glip-compose-schedule-btn').count(),
      0,
      'Compose schedule button should not attach to inline reply editors',
    );
    assert.equal(composeSchedulePlacement.pin, 'more');
    assert.equal(
      composeSchedulePlacement.sameLineAsMore ||
        composeSchedulePlacement.clampedToViewportBottom,
      true,
      JSON.stringify(composeSchedulePlacement),
    );
    assert.equal(
      composeSchedulePlacement.rightOfMore,
      true,
      JSON.stringify(composeSchedulePlacement),
    );
    assert.equal(
      composeSchedulePlacement.visibleInViewport,
      true,
      JSON.stringify(composeSchedulePlacement),
    );
    assert.equal(
      composeSchedulePlacement.brandBadgeTopRight,
      true,
      JSON.stringify(composeSchedulePlacement),
    );
    assert.equal(composeSchedulePlacement.position, 'fixed');
    assert.equal(composeSchedulePlacement.borderRadius, '6px');
    assert.ok(
      composeSchedulePlacement.svgWidth >= 20 &&
        composeSchedulePlacement.svgHeight >= 20,
      `Compose schedule clock icon should be visibly sized: ${JSON.stringify(
        composeSchedulePlacement,
      )}`,
    );
    assert.ok(
      composeSchedulePlacement.brandWidth >= 8 &&
        composeSchedulePlacement.brandWidth <= 11 &&
        composeSchedulePlacement.brandHeight >= 8 &&
        composeSchedulePlacement.brandHeight <= 11 &&
        composeSchedulePlacement.brandOpacity >= 0.95,
      `Compose schedule icon48 badge should be visible in the clock corner: ${JSON.stringify(
        composeSchedulePlacement,
      )}`,
    );
    assert.match(composeSchedulePlacement.brandImage, /icon48\.png/);
    await composeScheduleButton.click();
    await page.waitForSelector('.pai-glip-compose-schedule-popover', {
      timeout: 3_000,
    });
    assert.match(
      (await page.locator('.pai-glip-compose-schedule-popover').textContent()) ||
        '',
      /定时发送/,
    );
    assert.match(
      (await page.locator('.pai-glip-compose-schedule-warning').textContent()) ||
        '',
      /群体提及/,
    );
    await page.keyboard.press('Escape');

    await serviceWorker.evaluate(async () => {
      await chrome.storage.local.set({
        personalAiUiPreferences: {
          language: 'en-US',
          updatedAt: Date.now(),
        },
      });
    });
    const englishPage = await context.newPage();
    await englishPage.goto('https://app.ringcentral.com/messages/12345', {
      waitUntil: 'domcontentloaded',
    });
    const englishMessage = englishPage.locator(
      '.conversation-card-wrapper[data-id="msg-1"]',
    );
    await englishMessage.waitFor({ state: 'visible', timeout: 10_000 });
    await englishMessage
      .locator('.message-reaction-toolbar')
      .waitFor({ state: 'attached', timeout: 12_000 });
    await englishPage.mouse.move(5, 5);
    await englishMessage.hover();
    const englishToolbar = englishMessage.locator(
      '.message-reaction-toolbar.visible',
    );
    await englishToolbar.waitFor({ state: 'visible', timeout: 8_000 });
    const englishActions = await englishMessage
      .locator('.message-reaction-toolbar .message-reaction-action-btn')
      .evaluateAll((buttons) =>
        buttons.map((button) => ({
          label: button.getAttribute('aria-label'),
          compactLabel: button.getAttribute('data-compact-label'),
          title: button.getAttribute('title'),
          text: button.textContent?.trim(),
          labelWidth:
            button
              .querySelector('.message-reaction-action-label')
              ?.getBoundingClientRect().width ?? 0,
          labelScrollWidth:
            button.querySelector('.message-reaction-action-label')?.scrollWidth ??
            0,
        })),
      );
    assert.deepEqual(
      englishActions.map((action) => action.label),
      ['Remind', EN_WATCH_BOUNDARY_LABEL, 'Reply', EN_LINKED_ACTION_BOUNDARY_LABEL],
    );
    assert.deepEqual(
      englishActions.map((action) => action.compactLabel),
      ['Remind', 'Watch', 'Reply', 'Openclaw'],
    );
    assert.deepEqual(
      englishActions.map((action) => action.text),
      ['Remind', 'Watch', 'Reply', 'Openclaw'],
    );
    assert.equal(
      [englishActions[0], englishActions[2]].every(
        (action) =>
          action.title === action.label &&
          action.labelWidth >= action.labelScrollWidth - 1,
      ),
      true,
      `English toolbar labels should be visible without clipping: ${JSON.stringify(
        englishActions,
      )}`,
    );
    assert.equal(englishActions[1]?.title, EN_WATCH_BOUNDARY_LABEL);
    assert.match(englishActions[1]?.title || '', /opens a Watch configuration draft/);
    assert.match(englishActions[1]?.title || '', /does not start monitoring/);
    assert.match(englishActions[1]?.title || '', /save a rule/);
    assert.match(englishActions[1]?.title || '', /index the original message/);
    assert.match(englishActions[1]?.title || '', /send notifications/);
    assert.match(englishActions[1]?.title || '', /Reply\/Openclaw actions/);
    assert.equal(
      (englishActions[1]?.labelWidth || 0) >=
        (englishActions[1]?.labelScrollWidth || 0) - 1,
      true,
      `English Watch visible text should stay unclipped: ${JSON.stringify(
        englishActions[1],
      )}`,
    );
    assert.equal(englishActions[3]?.title, EN_LINKED_ACTION_BOUNDARY_LABEL);
    assert.equal(
      (englishActions[3]?.labelWidth || 0) >=
        (englishActions[3]?.labelScrollWidth || 0) - 1,
      true,
      `English Openclaw visible text should stay unclipped: ${JSON.stringify(
        englishActions[3],
      )}`,
    );

    await englishToolbar.hover();
    await englishPage.waitForFunction(
      () =>
        document.querySelector('.reaction-settings-btn.visible')?.tagName ===
        'BUTTON',
      null,
      { timeout: 7_000 },
    );
    await englishToolbar.locator('.reaction-settings-btn.visible').click();
    await englishPage.waitForSelector('.reaction-settings-popup', {
      timeout: 3_000,
    });
    assert.equal(
      (
        (await englishPage
          .locator('.reaction-settings-popup .reaction-settings-header')
          .textContent()) || ''
      ).trim(),
      'Message action settings',
    );
    const englishSettingsLabels = await englishPage.$$eval(
      '.reaction-settings-popup .reaction-settings-label',
      (labels) => labels.map((label) => label.textContent?.trim()),
    );
    assert.deepEqual(englishSettingsLabels, [
      'Remind',
      'Watch',
      'Reply / Followup',
      'Openclaw',
    ]);
    const englishSettingsScopeText =
      (await englishPage.locator('.reaction-settings-scope').textContent()) ||
      '';
    assert.match(englishSettingsScopeText, /Local display switches/);
    assert.match(
      englishSettingsScopeText,
      /Only changes which buttons appear beside messages in this browser/,
    );
    assert.match(
      englishSettingsScopeText,
      /Does not cancel existing reminders, watches, followups, reply rules, or Openclaw actions/,
    );
    assert.match(
      englishSettingsScopeText,
      /Queued or saved items still stay in their own management pages/,
    );
    assert.match(englishSettingsScopeText, /After save/);
    assert.match(
      englishSettingsScopeText,
      /Will show: Remind, Watch, Reply \/ Followup, Openclaw/,
    );
    await englishPage
      .locator('.reaction-settings-checkbox[data-feature="snooze"]')
      .uncheck();
    await englishPage
      .locator('.reaction-settings-checkbox[data-feature="followThread"]')
      .uncheck();
    await englishPage
      .locator('.reaction-settings-checkbox[data-feature="autoReply"]')
      .uncheck();
    await englishPage
      .locator('.reaction-settings-checkbox[data-feature="linkedAction"]')
      .uncheck();
    await englishPage.waitForFunction(
      () =>
        document
          .querySelector('[data-settings-preview-value]')
          ?.textContent?.includes('Will hide the local message toolbar'),
      null,
      { timeout: 2_000 },
    );
    const englishHiddenSettingsPreview =
      (await englishPage.locator('[data-settings-preview-value]').textContent()) ||
      '';
    assert.match(englishHiddenSettingsPreview, /existing items are not affected/);
    assert.equal(
      (
        (await englishPage
          .locator('.reaction-settings-popup .reaction-settings-hint')
          .textContent()) || ''
      ).trim(),
      'Turning a switch off hides that entry from this local toolbar.',
    );
    await delay(150);
    await englishPage.mouse.click(5, 5);
    await englishPage.waitForSelector('.reaction-settings-popup', {
      state: 'detached',
      timeout: 3_000,
    });
    await englishPage.mouse.move(5, 5);
    await englishMessage.hover();
    await englishToolbar.waitFor({ state: 'visible', timeout: 8_000 });

    await englishToolbar.locator('.snooze-icon-btn').click();
    await englishPage.waitForSelector('.snooze-menu', { timeout: 3_000 });
    assert.equal(
      await englishPage.locator('.snooze-menu').getAttribute('aria-label'),
      'Remind quick options',
    );
    const englishSnoozeReceiptText =
      (await englishPage.locator('.snooze-menu-receipt').textContent()) || '';
    assert.doesNotMatch(englishSnoozeReceiptText, /Reminder path/);
    assert.match(englishSnoozeReceiptText, /Reschedule preview/);
    assert.match(
      englishSnoozeReceiptText,
      /Already marked locally as Remind 5\/18 09:00/,
    );
    assert.match(
      englishSnoozeReceiptText,
      /Will reschedule to/,
    );
    assert.match(englishSnoozeReceiptText, /In 15 minutes/);
    assert.match(
      englishSnoozeReceiptText,
      /same-source Remind; no second reminder is added/,
    );
    assert.match(englishSnoozeReceiptText, /local marker snapshot/);
    assert.match(englishSnoozeReceiptText, /not a live remote status check/);

    await englishPage.mouse.click(5, 5);
    await englishPage.waitForSelector('.snooze-menu', {
      state: 'detached',
      timeout: 3_000,
    });
    await serviceWorker.evaluate(async () => {
      const result = await chrome.storage.local.get(['glipMessageMarkers']);
      await chrome.storage.local.set({
        glipMessageMarkers: {
          ...(result.glipMessageMarkers || {
            version: 1,
            markersByChatId: {},
          }),
          updatedAt: Date.now(),
          markersByChatId: {},
        },
      });
    });
    await englishMessage.hover();
    await englishToolbar.waitFor({ state: 'visible', timeout: 8_000 });
    await englishToolbar.locator('.snooze-icon-btn').click();
    await englishPage.waitForSelector('.snooze-menu', { timeout: 3_000 });
    const englishNewSnoozeReceiptText =
      (await englishPage.locator('.snooze-menu-receipt').textContent()) || '';
    assert.doesNotMatch(englishNewSnoozeReceiptText, /Reminder path/);
    assert.match(englishNewSnoozeReceiptText, /Reminder timing basis/);
    assert.match(englishNewSnoozeReceiptText, /Will create a reminder for/);
    assert.match(englishNewSnoozeReceiptText, /In 15 minutes/);
    assert.match(
      englishNewSnoozeReceiptText,
      /Writes to Scheduled Messages only after you pick a time/,
    );
    assert.match(englishNewSnoozeReceiptText, /does not send a message/);
    assert.match(englishNewSnoozeReceiptText, /Message marker/);
    const englishNewFirstOptionAria =
      (await englishPage.locator('.snooze-quick-option').first().getAttribute('aria-label')) || '';
    assert.match(englishNewFirstOptionAria, /Reminder timing basis/);
    assert.match(englishNewFirstOptionAria, /Will create a reminder for/);
    assert.match(englishNewFirstOptionAria, /Writes to Scheduled Messages only after you pick a time/);

    await englishPage.mouse.click(5, 5);
    await englishPage.waitForSelector('.snooze-menu', {
      state: 'detached',
      timeout: 3_000,
    });
    await serviceWorker.evaluate(async () => {
      const result = await chrome.storage.local.get(['glipMessageMarkers']);
      await chrome.storage.local.set({
        glipMessageMarkers: {
          ...(result.glipMessageMarkers || {
            version: 1,
            markersByChatId: {},
          }),
          updatedAt: Date.now(),
          markersByChatId: {
            12345: {
              'msg-1': [
                {
                  id: 'snooze-pending:snooze-row-1:12345:msg-1',
                  type: 'snooze_pending',
                  label: '稍后 5/18 09:00',
                  chatId: '12345',
                  postId: 'msg-1',
                  source: 'sheet',
                  sourceId: 'snooze-row-1',
                  updatedAt: 1778840900,
                  tooltip: '提醒时间：2026-05-18 09:00',
                },
              ],
            },
          },
        },
      });
    });
    await englishMessage.hover();
    await englishToolbar.waitFor({ state: 'visible', timeout: 8_000 });
    await englishToolbar.locator('.snooze-icon-btn').click();
    await englishPage.waitForSelector('.snooze-menu', { timeout: 3_000 });

    const englishSnoozeReceiptRows = await englishPage.$$eval(
      '.snooze-menu-receipt-line',
      (rows) =>
        rows.map((row) => {
          const label = row.querySelector('.snooze-menu-receipt-label');
          const value = row.querySelector('.snooze-menu-receipt-value');
          const labelRect = label?.getBoundingClientRect();
          const valueRect = value?.getBoundingClientRect();
          return {
            label: label?.textContent?.trim() || '',
            value: value?.textContent?.trim() || '',
            labelRight: labelRect?.right || 0,
            valueLeft: valueRect?.left || 0,
          };
        }),
    );
    assert.equal(
      englishSnoozeReceiptRows.every(
        (row) => row.label && row.value && row.labelRight <= row.valueLeft - 2,
      ),
      true,
      `English Snooze receipt labels should not overlap values: ${JSON.stringify(
        englishSnoozeReceiptRows,
      )}`,
    );
    const englishQuickLabels = await englishPage.$$eval(
      '.snooze-quick-option-label',
      (els) => els.map((el) => el.textContent?.trim()),
    );
    assert.deepEqual(englishQuickLabels.slice(0, 5), [
      'In 15 minutes',
      'In 30 minutes',
      'In 1 hour',
      'In 2 hours',
      'In 3 hours',
    ]);
    assert.equal(
      englishQuickLabels
        .slice(5)
        .every(
          (label) =>
            /^(Today|Tomorrow|Mon|Tue|Wed|Thu|Fri) (by EOD|9 AM)$/.test(
              label || '',
            ) ||
            label === 'Next Mon 9 AM' ||
            label === 'Next full hour',
        ),
      true,
      `English routine Remind labels should be localized: ${englishQuickLabels.join(
        ', ',
      )}`,
    );
    const englishQuickTimes = await englishPage.$$eval(
      '.snooze-quick-option-time',
      (els) => els.map((el) => el.textContent?.trim()),
    );
    assert.equal(
      englishQuickTimes.every(
        (label) => Boolean(label) && !/[分钟后小时周明天今天点]/.test(label || ''),
      ),
      true,
      `English Remind preview times should not contain Chinese labels: ${englishQuickTimes.join(
        ', ',
      )}`,
    );
    assert.equal(
      ((await englishPage.locator('.snooze-custom-option').textContent()) || '')
        .replace(/\s+/g, '')
        .trim(),
      '📅Custom...',
    );
    const englishCustomOptionAria =
      (await englishPage.locator('.snooze-custom-option').getAttribute('aria-label')) || '';
    assert.match(englishCustomOptionAria, /Custom time: Opens the custom reminder time picker/);
    assert.match(englishCustomOptionAria, /only confirming a future time creates or reschedules Remind/);
    assert.equal(
      ((await englishPage.locator('.snooze-manage-option').textContent()) || '')
        .replace(/\s+/g, ' ')
        .trim(),
      '↗ Manage Remind',
    );
    const englishManageOptionAria =
      (await englishPage.locator('.snooze-manage-option').getAttribute('aria-label')) || '';
    assert.match(englishManageOptionAria, /Manage Remind: Only opens the Scheduled Messages Remind view/);
    assert.match(englishManageOptionAria, /does not create, reschedule, complete, or delete reminders/);

    await englishPage.locator('.snooze-custom-option').click();
    await englishPage.waitForSelector('.snooze-picker', { timeout: 3_000 });
    assert.equal(
      await englishPage.locator('.snooze-picker-title').textContent(),
      'Custom time',
    );
    assert.equal(
      ((await englishPage.locator('.snooze-picker-back').textContent()) || '')
        .replace(/\s+/g, ' ')
        .trim(),
      '← Back',
    );
    assert.equal(
      await englishPage
        .locator('label[for="personal-ai-snooze-datetime"]')
        .textContent(),
      'Choose date and time',
    );
    assert.equal(
      await englishPage.locator('.snooze-preview-label').textContent(),
      'Reminder time:',
    );
    assert.equal(
      await englishPage.locator('.snooze-btn-cancel').textContent(),
      'Cancel',
    );
    assert.equal(
      await englishPage.locator('.snooze-btn-confirm').textContent(),
      'Confirm',
    );
    await englishPage.locator('.snooze-datetime-input').fill('2000-01-01T09:00');
    await englishPage.waitForSelector('.snooze-preview-time.invalid', {
      timeout: 3_000,
    });
    assert.equal(
      await englishPage.locator('.snooze-preview-time.invalid').textContent(),
      'Choose a future time',
    );
    await englishPage.locator('.snooze-btn-cancel').click();

    await englishPage.mouse.move(5, 5);
    await englishMessage.hover();
    await englishToolbar.waitFor({ state: 'visible', timeout: 8_000 });
    await englishToolbar.locator('.snooze-icon-btn').click();
    await englishPage.waitForSelector('.snooze-menu', { timeout: 3_000 });
    const scheduledPagesBeforeManage = context.pages().filter((page) =>
      page.url().includes('scheduled-messages.html?category=Snooze'),
    );
    const scheduledManagerPagePromise = context.waitForEvent('page');
    const manageBusyState = await englishPage
      .locator('.snooze-manage-option')
      .evaluate((button) => {
        if (!(button instanceof HTMLButtonElement)) {
          throw new Error('Manage Remind entry is not a button');
        }
        button.click();
        const menu = document.querySelector('.snooze-menu');
        const disabledItems = Array.from(
          document.querySelectorAll('.snooze-menu button[role="menuitem"]'),
        ).filter(
          (item) => item instanceof HTMLButtonElement && item.disabled,
        ).length;
        const label = button
          .querySelector('.snooze-manage-option-label')
          ?.textContent?.trim();
        button.click();
        return {
          busy: menu?.getAttribute('aria-busy') || '',
          disabledItems,
          label,
        };
      });
    assert.equal(manageBusyState.busy, 'true');
    assert.equal(manageBusyState.label, 'Opening...');
    assert.ok(
      manageBusyState.disabledItems >= 3,
      `Manage Remind should disable the quick menu while opening: ${JSON.stringify(
        manageBusyState,
      )}`,
    );
    const scheduledManagerPage = await scheduledManagerPagePromise;
    await scheduledManagerPage
      .waitForURL(/scheduled-messages\.html\?category=Snooze/, {
        timeout: 3_000,
      })
      .catch(() => undefined);
    await delay(250);
    const scheduledPagesAfterManage = context.pages().filter((page) =>
      page.url().includes('scheduled-messages.html?category=Snooze'),
    );
    assert.equal(
      scheduledPagesAfterManage.length,
      scheduledPagesBeforeManage.length + 1,
      'Manage Remind should open exactly one Scheduled Messages Snooze tab',
    );
    assert.match(
      scheduledManagerPage.url(),
      /scheduled-messages\.html\?category=Snooze/,
    );
    await scheduledManagerPage.close();

    await englishPage.mouse.move(5, 5);
    const englishOwnMessage = englishPage.locator(
      '.conversation-card-wrapper[data-id="msg-own"]',
    );
    await englishOwnMessage
      .locator('.message-reaction-toolbar')
      .waitFor({ state: 'attached', timeout: 12_000 });
    await englishOwnMessage.hover();
    await englishOwnMessage
      .locator('.message-reaction-toolbar.visible')
      .waitFor({ state: 'visible', timeout: 8_000 });
    const englishOwnActions = await englishOwnMessage
      .locator('.message-reaction-toolbar .message-reaction-action-btn')
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute('aria-label')),
      );
    assert.deepEqual(englishOwnActions, [
      'Remind',
      EN_WATCH_BOUNDARY_LABEL,
      'Followup',
      EN_LINKED_ACTION_BOUNDARY_LABEL,
    ]);
    await englishPage.close();

    console.log('message reaction toolbar e2e passed');
  } finally {
    await context.close();
    await memoryFixture.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
