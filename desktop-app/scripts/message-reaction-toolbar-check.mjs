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
    </style>
  </head>
  <body>
    <main class="conversation">
      <article class="conversation-card">
        <div class="conversation-card-wrapper" data-id="msg-1" groupid="12345">
          <button data-name="avatar" data-uid="GLIP_PERSON.99999"></button>
          <span data-name="name">Alicia Chen</span>
          <div data-name="text">Please follow up with the release owner before tomorrow noon.</div>
          <span data-name="time" datetime="2026-05-15T09:30:00Z">09:30</span>
        </div>
      </article>
      <article class="conversation-card">
        <div class="conversation-card-wrapper" data-id="msg-own" groupid="12345">
          <button data-name="avatar" data-uid="GLIP_PERSON.${SELF_EXTENSION_ID}"></button>
          <span data-name="name">You</span>
          <div data-name="text">@Jordan Lee can you confirm the release date before Friday?</div>
          <span data-name="time" datetime="2026-05-15T10:30:00Z">10:30</span>
        </div>
      </article>
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
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          session: {
            id: 'session-from-message',
            originKind: 'message_reaction',
            status: 'waiting_reply',
            sentChatId: body.chatId,
            sentPostId: body.postId,
          },
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
          items: [],
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
    await page.waitForSelector('.message-reaction-toolbar', {
      state: 'attached',
      timeout: 12_000,
    });

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
      ['稍后处理', '关注后续', '自动答复', '联动操作'],
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
      actions.every((action) => action.title === action.label),
      true,
    );
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
      '关注后续',
      '跟进追问',
      '联动操作',
    ]);

    await ownMessage.locator('.followup-ask-btn').click();
    await page.waitForSelector('.followup-ask-dialog', { timeout: 3_000 });
    assert.equal(
      await page.locator('.followup-ask-target-value').textContent(),
      'Jordan Lee',
    );
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
    await page.locator('.followup-ask-submit').click();
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
    assert.equal(capturedFollowup.targetResolvedLabel, 'Jordan Lee');
    assert.equal(
      capturedFollowup.followupIntervalSeconds,
      720 * 60 * 60,
    );
    assert.equal(capturedFollowup.maxFollowup, 10);
    assert.equal(
      capturedFollowup.context,
      '确认最终发布日期和是否需要额外资源',
    );
    assert.equal(
      capturedFollowup.informationGoal,
      '确认最终发布日期和是否需要额外资源',
    );
    assert.equal(capturedFollowup.messageCreatedAt, 1_778_841_000);

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

    await snoozeButton.click();
    await page.waitForSelector('.snooze-menu', { timeout: 3_000 });
    assert.equal(
      await page.locator('.snooze-menu').isVisible(),
      true,
      'Clicking Snooze should open the quick menu instead of creating a default reminder',
    );
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
      quickLabels.length >= 6 && quickLabels.length <= 8,
      `Expected 6 to 8 quick options, got ${quickLabels.length}`,
    );
    assert.deepEqual(quickLabels.slice(0, 5), [
      '15 分钟后',
      '30 分钟后',
      '1 小时后',
      '2 小时后',
      '3 小时后',
    ]);
    const routineLabels = quickLabels.slice(5);
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
