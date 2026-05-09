import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const extensionPath = path.join(repoRoot, 'dist');

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
    </style>
  </head>
  <body>
    <main class="conversation">
      <article class="conversation-card">
        <div class="conversation-card-wrapper" data-id="msg-1" groupid="12345">
          <span data-name="name">Alicia Chen</span>
          <div data-name="text">Please follow up with the release owner before tomorrow noon.</div>
          <span data-name="time">09:30</span>
        </div>
      </article>
    </main>
  </body>
</html>`;

async function main() {
  await fs.access(path.join(extensionPath, 'manifest.json'));

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
    await toolbar.waitFor({ state: 'visible', timeout: 5_000 });

    const actions = await page.$$eval(
      '.message-reaction-toolbar .message-reaction-action-btn',
      (buttons) =>
        buttons.map((button) => ({
          tagName: button.tagName,
          label: button.getAttribute('aria-label'),
          title: button.getAttribute('title'),
        })),
    );

    assert.deepEqual(
      actions.map((action) => action.label),
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

    await toolbar.hover();
    await page.waitForFunction(
      () =>
        document.querySelector('.reaction-settings-btn.visible')?.tagName ===
        'BUTTON',
      null,
      { timeout: 4_000 },
    );

    await page.locator('.snooze-icon-btn').hover();
    await page.waitForSelector('.snooze-menu', { timeout: 3_000 });
    const quickLabels = await page.$$eval('.snooze-quick-option-label', (els) =>
      els.map((el) => el.textContent?.trim()),
    );
    assert.ok(
      quickLabels.length >= 5 && quickLabels.length <= 7,
      `Expected 5 to 7 quick options, got ${quickLabels.length}`,
    );
    assert.deepEqual(quickLabels.slice(0, 4), [
      '30 分钟后',
      '1 小时后',
      '2 小时后',
      '3 小时后',
    ]);
    const routineLabels = quickLabels.slice(4);
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
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
