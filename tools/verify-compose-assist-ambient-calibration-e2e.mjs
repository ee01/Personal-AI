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
            return respond(callback, {
              success: true,
              result: {
                status: 'ok',
                traceId: `trace-${window.__paiAmbientCalibrationTraces.length}`,
                stored: true,
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

async function loadFixture(page) {
  await page.goto(fixtureUrl);
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

    await loadFixture(page);
    await page.locator('.pai-composer-guard-icon-button').click();
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
    await page.locator('.pai-composer-guard-icon-button').hover();
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
