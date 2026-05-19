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

const fixtureUrl = 'https://chatgpt.com/c/pai-compose-preview';

const fixtureHtml = `<!doctype html>
<html>
  <head>
    <title>ChatGPT - Factory AI prompt</title>
    <style>
      body { font-family: sans-serif; margin: 0; padding: 32px; }
      main { width: 760px; }
      article { border-bottom: 1px solid #e5e7eb; padding: 12px 0; }
      .composer-shell { margin-top: 24px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
      #prompt-textarea { min-height: 96px; outline: none; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <main>
      <article data-message-author-role="user">Help me ask for the Factory AI rollout status.</article>
      <div class="composer-shell">
        <div
          id="prompt-textarea"
          contenteditable="true"
          role="textbox"
          data-testid="composer-textarea"
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
    window.__paiCopiedText = '';

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__paiCopiedText = text;
        },
      },
    });

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
            window.__paiComposeAssistRequests.push(message.request);
            return respond(callback, {
              success: true,
              result: {
                available: true,
                suggestionType: 'context_pack',
                title: 'AI context pack',
                summary: 'Found matching memory.',
                insertText:
                  '请结合下面上下文回答：\n\n目标：Factory AI rollout status\n\n相关记忆：\n1. Factory AI passed security approval, but production still needs RingCentral email login. [M1]',
                evidence: [
                  {
                    id: 'memory-1',
                    type: 'chunk',
                    snippet:
                      'Factory AI passed security approval, but production still needs RingCentral email login.',
                    sourceTitle: 'Factory AI rollout',
                    score: 0.9,
                  },
                ],
                riskLevel: 'medium',
                previewRequired: true,
                confidence: 0.9,
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

async function main() {
  const userDataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'pai-compose-preview-'),
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
    await page.goto(fixtureUrl);
    await page.addScriptTag({ path: contentScriptPath });

    await page.locator('#prompt-textarea').click();
    await page.waitForFunction(
      () => window.__paiComposeAssistRequests?.length >= 1,
      null,
      { timeout: 6000 },
    );
    const requests = await page.evaluate(
      () => window.__paiComposeAssistRequests,
    );
    assert.equal(requests[0].contextType, 'web_agent_prompt');
    assert.ok(requests[0].sourceTypes.includes('user_core'));
    assert.ok(requests[0].sourceTypes.includes('markdown'));
    assert.ok(requests[0].sourceTypes.includes('reflection'));

    await page.locator('.pai-composer-guard-icon-button').click();
    await page.waitForSelector('.pai-composer-guard--preview-open');
    await page.locator('.pai-composer-guard-copy-button').click();
    await page.waitForFunction(
      () => document.documentElement.innerText.includes('已复制'),
      null,
      { timeout: 3000 },
    );

    const afterCopy = await page.evaluate(() => ({
      copiedText: window.__paiCopiedText,
      composerText: document.querySelector('#prompt-textarea')?.textContent || '',
    }));
    assert.match(afterCopy.copiedText, /Factory AI passed security approval/);
    assert.equal(afterCopy.composerText.trim(), '');

    await page.locator('.pai-composer-guard-insert-button').click();
    const composerText = await page.locator('#prompt-textarea').innerText();
    assert.match(composerText, /Factory AI passed security approval/);

    console.log('Compose Assist preview actions E2E passed.');
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
