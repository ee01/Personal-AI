import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const contentScriptPath = path.join(
  repoRoot,
  'dist/contentScriptWebIntelligence.js',
);

if (!fs.existsSync(contentScriptPath)) {
  throw new Error(
    'Missing dist/contentScriptWebIntelligence.js. Run npm start first.',
  );
}

const fixtureUrl = 'https://chatgpt.com/c/pai-compose-ambient-calibration';

const fixtureHtml = `<!doctype html>
<html>
  <head>
    <title>ChatGPT - Compose ambient calibration</title>
    <style>
      body { font-family: sans-serif; margin: 0; padding: 32px; }
      main { width: 760px; }
      .composer-shell { margin-top: 24px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
      #prompt-textarea { min-height: 96px; outline: none; white-space: pre-wrap; }
      #send-button { margin-top: 12px; }
    </style>
  </head>
  <body>
    <main>
      <article data-message-author-role="user">Help me reply about Factory AI rollout status.</article>
      <div class="composer-shell">
        <div
          id="prompt-textarea"
          contenteditable="true"
          role="textbox"
          data-testid="composer-textarea"
        ></div>
        <button id="send-button" type="button" aria-label="Send message">Send</button>
      </div>
    </main>
  </body>
</html>`;

function installChromeStub(page) {
  return page.addInitScript(() => {
    const storageState = {
      envConfig: {
        CONTEXT_ASSIST_ENABLED: true,
        COMPOSE_ASSIST_ENABLED: true,
        COMPOSER_GUARD_CONFIDENCE_THRESHOLD: 0.78,
      },
    };
    const storageListeners = [];
    window.__paiComposeAssistRequests = [];
    window.__paiAmbientCalibrationTraces = [];

    function normalizeKeys(keys) {
      if (Array.isArray(keys)) return keys;
      if (typeof keys === 'string') return [keys];
      if (keys && typeof keys === 'object') return Object.keys(keys);
      return Object.keys(storageState);
    }

    function buildStorageResult(keys) {
      const result = {};
      for (const key of normalizeKeys(keys)) {
        if (key in storageState) result[key] = storageState[key];
      }
      return result;
    }

    function respond(callback, response, delayMs = 0) {
      if (typeof callback === 'function') {
        window.setTimeout(() => callback(response), delayMs);
        return undefined;
      }
      return new Promise((resolve) => {
        window.setTimeout(() => resolve(response), delayMs);
      });
    }

    window.chrome = {
      extension: {
        inIncognitoContext: false,
      },
      runtime: {
        lastError: null,
        getURL: (assetPath) => `chrome-extension://pai-test/${assetPath}`,
        sendMessage(message, callback) {
          window.chrome.runtime.lastError = null;
          if (message?.type === 'AMBIENT_CALIBRATION_TRACE') {
            window.__paiAmbientCalibrationTraces.push(message.trace);
            if (window.__paiAmbientCalibrationMode === 'fail') {
              return respond(callback, {
                success: false,
                error: 'privacy_gate_rejected',
              });
            }
            return respond(callback, {
              success: true,
              result: {
                status: 'ok',
                traceId: `trace-${window.__paiAmbientCalibrationTraces.length}`,
                stored: true,
                calibrationReceipt: {
                  stored: true,
                  duplicate: false,
                  privacyClass: 'sensitive_redacted',
                  rawTextStored: false,
                  evidenceRefCount: message.trace?.evidenceRefs?.length || 0,
                  cueRefCount: 0,
                  styleSignalCount: 0,
                  redactedDiffKeys: Object.keys(
                    message.trace?.redactedDiff || {},
                  ),
                  writingStyleProcessed: false,
                  outcomeCueEventCount: 0,
                  boundary: 'hashes_lengths_tags_and_evidence_refs_only',
                },
              },
            });
          }
          if (message?.type === 'COMPOSER_ASSIST_REQUEST') {
            window.__paiComposeAssistRequests.push(message.request);
            return respond(callback, {
              success: true,
              result: {
                available: true,
                suggestionType: 'context_pack',
                title: 'AI context pack',
                summary: 'Found matching memory.',
                insertText:
                  'Factory AI 已通过 security approval，但 production 还需要确认 RingCentral email login。',
                evidence: [
                  {
                    id: 'memory-factory-ai',
                    type: 'rehearsal',
                    snippet:
                      'Factory AI passed security approval, but production still needs RingCentral email login.',
                    sourceTitle: 'Factory AI rollout rehearsal',
                    whyRelevant: ['线索：Factory AI'],
                    evidenceRole: 'rehearsal_cue',
                    score: 0.91,
                  },
                ],
                riskLevel: 'medium',
                previewRequired: true,
                confidence: 0.91,
                queryTimeMs: 1,
              },
            });
          }

          return respond(callback, { success: true });
        },
      },
      storage: {
        local: {
          get(keys, callback) {
            const result = buildStorageResult(keys);
            if (typeof callback === 'function') {
              callback(result);
              return undefined;
            }
            return Promise.resolve(result);
          },
          set(items, callback) {
            Object.assign(storageState, items || {});
            const changes = {};
            for (const [key, value] of Object.entries(items || {})) {
              changes[key] = { oldValue: undefined, newValue: value };
            }
            for (const listener of storageListeners) {
              listener(changes, 'local');
            }
            if (typeof callback === 'function') callback();
            return Promise.resolve();
          },
        },
        onChanged: {
          addListener(listener) {
            storageListeners.push(listener);
          },
        },
      },
    };
  });
}

async function loadFixture(page, initialText = '') {
  await page.goto(fixtureUrl);
  if (initialText) {
    await page.locator('#prompt-textarea').fill(initialText);
  }
  await page.addScriptTag({ path: contentScriptPath });
  await page.locator('#prompt-textarea').click();
  await page.waitForFunction(
    () => window.__paiComposeAssistRequests?.length >= 1,
    null,
    { timeout: 6000 },
  );
  await page.locator('.pai-composer-guard-icon-button').waitFor({
    state: 'visible',
    timeout: 6000,
  });
}

async function fireComposerGuardFocusHandler(page, type) {
  await page.evaluate((eventType) => {
    const root = document.querySelector('#pai-composer-guard-root');
    if (!root) throw new Error('missing compose guard root');
    const event = new FocusEvent(eventType, {
      bubbles: true,
      cancelable: true,
    });
    if (eventType === 'focusin') {
      root.onfocusin?.(event);
      return;
    }
    root.onfocusout?.(event);
  }, type);
}

async function main() {
  const userDataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'pai-compose-ambient-calibration-'),
  );
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
  });
  const page = await context.newPage();

  try {
    await page.route(fixtureUrl, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: fixtureHtml,
      }),
    );
    await installChromeStub(page);

    await loadFixture(page, '只插入不发送，验证撤销窗口后的校准回执');
    await page
      .locator('.pai-composer-guard-icon-button')
      .dispatchEvent('pointerdown', { bubbles: true, cancelable: true });
    await page.locator('[data-action="confirm-insert"]').waitFor({
      state: 'visible',
      timeout: 3000,
    });
    await page
      .locator('[data-action="confirm-insert"]')
      .dispatchEvent('pointerdown', { bubbles: true, cancelable: true });
    await page
      .locator('.pai-composer-guard-feedback-toast', {
        hasText: '草稿保留已确认',
      })
      .waitFor({ state: 'visible', timeout: 13000 });
    await page
      .locator('.pai-composer-guard-feedback-detail', {
        hasText: '已记录 inserted 校准信号',
      })
      .waitFor({ state: 'visible', timeout: 3000 });
    const insertCommitReceiptText = await page
      .locator('.pai-composer-guard-feedback-toast')
      .innerText();
    assert.match(insertCommitReceiptText, /当前草稿未发送\/提交/);
    assert.match(insertCommitReceiptText, /只保存脱敏摘要/);

    const insertedTrace = await page.evaluate(() =>
      window.__paiAmbientCalibrationTraces.find(
        (trace) => trace.action === 'inserted',
      ),
    );
    assert.equal(insertedTrace.surface, 'compose_assist');
    assert.equal(insertedTrace.redactedDiff.interaction, 'insert_undo_expired');
    assert.equal(insertedTrace.redactedDiff.rawTextStored, false);
    assert.equal(insertedTrace.evidenceRefs[0].role, 'used');
    assert.equal(
      JSON.stringify(insertedTrace).includes('production 还需要确认'),
      false,
      'inserted trace must not contain the raw inserted composer text',
    );

    await loadFixture(page);
    await page
      .locator('.pai-composer-guard-icon-button')
      .dispatchEvent('pointerdown', { bubbles: true, cancelable: true });
    await page.locator('[data-action="confirm-insert"]').waitFor({
      state: 'visible',
      timeout: 3000,
    });
    await page
      .locator('[data-action="confirm-insert"]')
      .dispatchEvent('pointerdown', { bubbles: true, cancelable: true });
    await page.locator('#prompt-textarea').fill(
      'Factory AI security 已过；我这里先只追 RingCentral email login 的 production blocker。',
    );
    await page.locator('#send-button').click();
    await page.waitForFunction(
      () =>
        window.__paiAmbientCalibrationTraces?.some(
          (trace) => trace.action === 'edited_before_send',
        ),
      null,
      { timeout: 3000 },
    );

    const editedTrace = await page.evaluate(() =>
      window.__paiAmbientCalibrationTraces.find(
        (trace) => trace.action === 'edited_before_send',
      ),
    );
    assert.equal(editedTrace.surface, 'compose_assist');
    assert.equal(editedTrace.polarity, 'correction');
    assert.equal(editedTrace.privacyClass, 'sensitive_redacted');
    assert.equal(editedTrace.redactedDiff.rawTextStored, false);
    assert.equal(editedTrace.evidenceRefs[0].id, 'memory-factory-ai');
    assert.equal(editedTrace.evidenceRefs[0].role, 'corrected');
    assert.equal(
      JSON.stringify(editedTrace).includes('production blocker'),
      false,
      'ambient trace must not contain the raw final composer text',
    );

    await loadFixture(page);
    await page.evaluate(() => {
      window.__paiAmbientCalibrationTraces = [];
    });
    await page
      .locator('#pai-composer-guard-root')
      .dispatchEvent('pointerover', { bubbles: true, cancelable: true });
    await page
      .locator('#pai-composer-guard-root')
      .dispatchEvent('pointerout', { bubbles: true, cancelable: true });
    await page.locator('#prompt-textarea').fill(
      '我只是扫过 Personal AI icon，直接自己回复当前 thread。',
    );
    await page.locator('#send-button').click();
    await page.waitForTimeout(1200);
    const skimHoverTraces = await page.evaluate(
      () => window.__paiAmbientCalibrationTraces,
    );
    assert.equal(
      skimHoverTraces.some((trace) => trace.action === 'sent_without_insert'),
      false,
      'brief icon skim should not count as passive no-insert calibration',
    );

    await loadFixture(page);
    await page.evaluate(() => {
      window.__paiAmbientCalibrationTraces = [];
    });
    await fireComposerGuardFocusHandler(page, 'focusin');
    await fireComposerGuardFocusHandler(page, 'focusout');
    await page.locator('#prompt-textarea').fill(
      '我只是 Tab 到 Personal AI icon 又马上回到输入框，直接自己回复。',
    );
    await page.locator('#send-button').click();
    await page.waitForTimeout(700);
    const skimKeyboardFocusTraces = await page.evaluate(
      () => window.__paiAmbientCalibrationTraces,
    );
    assert.equal(
      skimKeyboardFocusTraces.some(
        (trace) => trace.action === 'sent_without_insert',
      ),
      false,
      'brief keyboard focus should not count as passive no-insert calibration',
    );

    await loadFixture(page);
    await page.evaluate(() => {
      window.__paiAmbientCalibrationTraces = [];
    });
    await fireComposerGuardFocusHandler(page, 'focusin');
    await page.waitForTimeout(700);
    await page.locator('#prompt-textarea').fill(
      '我键盘聚焦看过建议后，改成自己的一句简短回复。',
    );
    await page.locator('#send-button').click();
    await page.waitForFunction(
      () =>
        window.__paiAmbientCalibrationTraces?.some(
          (trace) => trace.action === 'sent_without_insert',
        ),
      null,
      { timeout: 3000 },
    );
    const keyboardFocusTrace = await page.evaluate(() =>
      window.__paiAmbientCalibrationTraces.find(
        (trace) => trace.action === 'sent_without_insert',
      ),
    );
    assert.equal(keyboardFocusTrace.surface, 'compose_assist');
    assert.equal(keyboardFocusTrace.redactedDiff.interaction, 'hover_no_insert');
    assert.equal(keyboardFocusTrace.evidenceRefs[0].role, 'ignored');

    await loadFixture(page);
    await page.evaluate(() => {
      window.__paiAmbientCalibrationTraces = [];
    });
    await page
      .locator('#pai-composer-guard-root')
      .dispatchEvent('pointerover', { bubbles: true, cancelable: true });
    await page.waitForTimeout(1200);
    await page.locator('#prompt-textarea').fill(
      '我先回复当前 thread 的 review owner，确认今天只看 BE readiness 和 blockers。',
    );
    await page.locator('#send-button').click();
    await page.waitForFunction(
      () =>
        window.__paiAmbientCalibrationTraces?.some(
          (trace) => trace.action === 'sent_without_insert',
        ),
      null,
      { timeout: 3000 },
    );

    const hoverTrace = await page.evaluate(() =>
      window.__paiAmbientCalibrationTraces.find(
        (trace) => trace.action === 'sent_without_insert',
      ),
    );
    assert.equal(hoverTrace.surface, 'compose_assist');
    assert.equal(hoverTrace.redactedDiff.interaction, 'hover_no_insert');
    assert.equal(hoverTrace.evidenceRefs[0].role, 'ignored');

    await loadFixture(page);
    await page.evaluate(() => {
      window.__paiAmbientCalibrationTraces = [];
    });
    await page
      .locator('#pai-composer-guard-root')
      .dispatchEvent('pointerover', { bubbles: true, cancelable: true });
    await page
      .locator('[data-action="reject"]')
      .dispatchEvent('pointerdown', { bubbles: true, cancelable: true });
    await page.waitForFunction(
      () =>
        window.__paiAmbientCalibrationTraces?.some(
          (trace) => trace.action === 'wrong',
        ),
      null,
      { timeout: 3000 },
    );
    await page
      .locator('.pai-composer-guard-feedback-detail', {
        hasText: '校准已写入，只保存脱敏校准信号',
      })
      .waitFor({ state: 'visible', timeout: 3000 });
    await page.locator('#prompt-textarea').fill(
      '我先自己回：当前只确认 production blocker，不引用这条建议。',
    );
    await page.locator('#send-button').click();
    await page.waitForTimeout(250);

    const rejectionTraces = await page.evaluate(
      () => window.__paiAmbientCalibrationTraces,
    );
    assert.ok(
      rejectionTraces.some((trace) => trace.action === 'wrong'),
      'explicit thumb-down should still write the strong wrong trace',
    );
    assert.equal(
      rejectionTraces.some((trace) => trace.action === 'sent_without_insert'),
      false,
      'explicit thumb-down should not be double-counted as passive hover no-insert feedback',
    );

    await loadFixture(page, '换一个 prompt 来验证校准失败回执');
    await page.evaluate(() => {
      window.__paiAmbientCalibrationMode = 'fail';
      window.__paiAmbientCalibrationTraces = [];
    });
    await page
      .locator('#pai-composer-guard-root')
      .dispatchEvent('pointerover', { bubbles: true, cancelable: true });
    await page
      .locator('[data-action="reject"]')
      .dispatchEvent('pointerdown', { bubbles: true, cancelable: true });
    await page
      .locator('.pai-composer-guard-feedback-detail', {
        hasText: '校准未写入：privacy_gate_rejected',
      })
      .waitFor({ state: 'visible', timeout: 3000 });
    const failedTraceAttempts = await page.evaluate(
      () => window.__paiAmbientCalibrationTraces,
    );
    assert.ok(
      failedTraceAttempts.some((trace) => trace.action === 'wrong'),
      'failed backend receipt should still preserve the attempted wrong trace in the browser harness',
    );

    console.log('Compose Assist ambient calibration E2E passed.');
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
