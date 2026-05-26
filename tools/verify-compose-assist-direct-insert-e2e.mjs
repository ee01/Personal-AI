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

const fixtureUrl = 'https://chatgpt.com/c/pai-compose-direct-insert';

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
                    id: 'rehearsal-1',
                    type: 'rehearsal',
                    snippet:
                      'Factory AI passed security approval, but production still needs RingCentral email login.',
                    sourceTitle: 'Factory AI rollout rehearsal',
                    sourceUrl: 'https://example.com/factory-ai-rollout',
                    exploreLink: '#/thread/factory-ai?focus=memory-1',
                    whyRelevant: ['线索：Factory AI', '同会话'],
                    evidenceRole: 'rehearsal_cue',
                    reasonType: 'prospective_cue',
                    displayPriority: 'p1',
                    links: [
                      {
                        label: '打开来源',
                        url: 'https://example.com/factory-ai-rollout',
                      },
                      {
                        label: 'unsafe',
                        url: 'javascript:alert(1)',
                      },
                    ],
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
    path.join(os.tmpdir(), 'pai-compose-direct-insert-'),
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

    const controlsBeforeClick = await page.evaluate(() => ({
      copyButtons: document.querySelectorAll('[data-action="copy"]').length,
      dismissButtons: document.querySelectorAll('[data-action="dismiss"]').length,
      confirmInsertButtons: document.querySelectorAll(
        '[data-action="confirm-insert"]',
      ).length,
      cueLabels: document.querySelectorAll('.pai-composer-guard-cue').length,
      cueText:
        document.querySelector('.pai-composer-guard-cue')?.textContent || '',
      provenanceBlocks: document.querySelectorAll(
        '.pai-composer-guard-provenance',
      ).length,
    }));
    assert.deepEqual(controlsBeforeClick, {
      copyButtons: 0,
      dismissButtons: 0,
      confirmInsertButtons: 0,
      cueLabels: 1,
      cueText: '预演提醒 · 线索：Factory AI / 同会话',
      provenanceBlocks: 0,
    });

    await page.locator('.pai-composer-guard-icon-button').click();
    const composerText = await page.locator('#prompt-textarea').innerText();
    assert.match(composerText, /Factory AI passed security approval/);
    await page.locator('.pai-composer-guard-undo-button').waitFor({
      state: 'visible',
      timeout: 3000,
    });

    await page.goto(fixtureUrl);
    await page.addScriptTag({ path: contentScriptPath });
    await page.locator('#prompt-textarea').click();
    await page.locator('#prompt-textarea').fill('Before replace this after');
    await page.waitForFunction(
      () =>
        window.__paiComposeAssistRequests?.some(
          (request) => request.draftText === 'Before replace this after',
        ),
      null,
      { timeout: 6000 },
    );
    await page.locator('.pai-composer-guard-icon-button').waitFor({
      state: 'visible',
      timeout: 6000,
    });
    await page.locator('#prompt-textarea').evaluate((element) => {
      element.focus();
      const textNode = element.firstChild;
      if (!textNode) throw new Error('missing composer text node');
      const text = textNode.textContent || '';
      const start = text.indexOf('replace this');
      if (start < 0) throw new Error('missing selection marker');
      const range = document.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, start + 'replace this'.length);
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    await page.locator('.pai-composer-guard-icon-button').click();
    const replacedComposerText = await page
      .locator('#prompt-textarea')
      .innerText();
    assert.doesNotMatch(replacedComposerText, /replace this/);
    assert.match(replacedComposerText, /Before/);
    assert.match(replacedComposerText, /Factory AI passed security approval/);
    assert.match(replacedComposerText, /after/);
    assert.ok(
      replacedComposerText.indexOf('Before') <
        replacedComposerText.indexOf('Factory AI passed security approval'),
      'inserted context should replace the selected draft range in place',
    );
    assert.ok(
      replacedComposerText.indexOf('Factory AI passed security approval') <
        replacedComposerText.indexOf('after'),
      'draft text after the selection should be preserved after insertion',
    );
    await page.locator('.pai-composer-guard-undo-button').click();
    await page.waitForFunction(
      () =>
        document.querySelector('#prompt-textarea')?.textContent ===
        'Before replace this after',
      null,
      { timeout: 3000 },
    );
    assert.equal(await page.locator('#pai-composer-guard-root').count(), 0);

    await page.goto(fixtureUrl);
    await page.addScriptTag({ path: contentScriptPath });
    await page.locator('#prompt-textarea').click();
    await page.locator('#prompt-textarea').fill('First rejected prompt');
    await page.waitForFunction(
      () =>
        window.__paiComposeAssistRequests?.some(
          (request) => request.draftText === 'First rejected prompt',
        ),
      null,
      { timeout: 6000 },
    );
    await page.locator('.pai-composer-guard-icon-button').waitFor({
      state: 'visible',
      timeout: 6000,
    });
    await page.locator('.pai-composer-guard-icon-button').hover();
    await page.locator('.pai-composer-guard-feedback-button').click();
    await page.waitForFunction(
      () => !document.querySelector('#pai-composer-guard-root'),
      null,
      { timeout: 3000 },
    );
    await page
      .locator('#prompt-textarea')
      .fill('Second unrelated prompt should still ask for assist');
    await page.waitForFunction(
      () =>
        window.__paiComposeAssistRequests?.some(
          (request) =>
            request.draftText ===
            'Second unrelated prompt should still ask for assist',
        ),
      null,
      { timeout: 6000 },
    );

    console.log('Compose Assist direct insert E2E passed.');
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
