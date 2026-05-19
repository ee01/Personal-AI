import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentScriptPath = path.join(repoRoot, 'dist/contentScriptWebIntelligence.js');

if (!fs.existsSync(contentScriptPath)) {
  throw new Error('Missing dist/contentScriptWebIntelligence.js. Run npm start first.');
}

const fixtureUrl = 'https://app.ringcentral.com/messages/1280503250946';

const fixtureHtml = `<!doctype html>
<html>
  <head>
    <title>AI tools selection</title>
    <style>
      body { font-family: sans-serif; margin: 0; padding: 32px; }
      main { width: 720px; }
      .conversation-card-wrapper { border-bottom: 1px solid #e5e7eb; padding: 12px 0; }
      .composer-shell { margin-top: 24px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
      .ql-editor { min-height: 96px; outline: none; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <main>
      <h1>AI tools selection</h1>
      <section id="message-chat-stream-wrapper">
        <div class="conversation-card-wrapper" data-id="post-1" groupid="1280503250946">
          <span data-name="name">Alice</span>
          <span data-name="text">Can you share the latest Factory AI security approval status?</span>
          <span data-name="time">10:01 AM</span>
        </div>
      </section>
      <div class="composer-shell" data-test-automation-id="message-compose">
        <div
          id="composer"
          class="ql-editor"
          contenteditable="true"
          role="textbox"
          data-placeholder="Message"
        ></div>
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
          if (message?.type === 'COMPOSER_ASSIST_REQUEST') {
            const requestIndex = window.__paiComposeAssistRequests.length;
            window.__paiComposeAssistRequests.push(message.request);
            const insertText =
              requestIndex === 0
                ? 'STALE RESPONSE SHOULD NOT RENDER'
                : `FRESH RESPONSE: ${message.request.draftText}`;
            return respond(
              callback,
              {
                success: true,
                result: {
                  available: true,
                  suggestionType: 'reply_context',
                  title: 'Message reply context',
                  summary: 'Found one matching memory.',
                  insertText,
                  evidence: [
                    {
                      id: `memory-${requestIndex}`,
                      type: 'chunk',
                      snippet: 'Factory AI passed security approval.',
                      sourceTitle: 'AI tools selection',
                      score: 0.9,
                    },
                  ],
                  riskLevel: 'low',
                  previewRequired: false,
                  confidence: 0.9,
                  queryTimeMs: 1,
                },
              },
              requestIndex === 0 ? 250 : 50,
            );
          }

          if (message?.type === 'CONTEXT_RECALL_REQUEST') {
            return respond(callback, { topMatch: null }, 0);
          }

          return respond(callback, { success: true }, 0);
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

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pai-compose-assist-'));
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
    await page.goto(fixtureUrl);
    await page.addScriptTag({ path: contentScriptPath });

    await page.locator('#composer').click();
    await page.waitForFunction(
      () => window.__paiComposeAssistRequests?.length >= 1,
      null,
      { timeout: 6000 },
    );

    await page.locator('#composer').fill('Please make this concise.');
    await page.waitForTimeout(400);

    const staleRendered = await page
      .locator('text=STALE RESPONSE SHOULD NOT RENDER')
      .count();
    assert.equal(staleRendered, 0, 'stale assist response should not render');

    await page.waitForFunction(
      () => window.__paiComposeAssistRequests?.length >= 2,
      null,
      { timeout: 6000 },
    );
    await page.waitForFunction(
      () =>
        document.documentElement.innerText.includes(
          'FRESH RESPONSE: Please make this concise.',
        ),
      null,
      { timeout: 3000 },
    );

    const requests = await page.evaluate(() => window.__paiComposeAssistRequests);
    assert.equal(requests[0].draftText, '');
    assert.equal(requests[1].draftText, 'Please make this concise.');

    await page.locator('.pai-composer-guard-icon-button').click();
    const composerText = await page.locator('#composer').innerText();
    assert.match(composerText, /FRESH RESPONSE: Please make this concise\./);
    assert.doesNotMatch(composerText, /STALE RESPONSE/);

    console.log('Compose Assist draft staleness E2E passed.');
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
