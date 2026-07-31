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

const fixtureUrl = 'https://app.ringcentral.com/messages/persona-projection';
const reviewBoundary =
  '已按当前场景省略未确认或敏感身份信息；仅插入草稿，不会发送。';

const fixtureHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>Compose Assist persona projection</title>
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
      <section id="message-chat-stream-wrapper">
        <div class="conversation-card-wrapper" data-id="post-1" groupid="persona-projection">
          <span data-name="name">Alice</span>
          <span data-name="text">Can you share the latest rollout status?</span>
          <span data-name="time">10:01 AM</span>
        </div>
      </section>
      <button id="outside-focus" type="button">Outside composer</button>
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

    function respond(callback, response) {
      if (typeof callback === 'function') {
        window.setTimeout(() => callback(response), 0);
        return undefined;
      }
      return Promise.resolve(response);
    }

    const projection = (overrides) => ({
      version: 1,
      scene: 'ringcentral_message',
      audienceType: 'peer',
      audienceSource: 'confirmed_social_edge',
      audienceConfidence: 1,
      representationMode: 'draft_only',
      voiceMode: 'write_as_user',
      usedSlotKinds: ['writing_style'],
      usedCount: 1,
      blockedCount: 0,
      reasonCodes: ['confirmed_style_control'],
      requiresPreview: false,
      ...overrides,
    });

    window.chrome = {
      extension: { inIncognitoContext: false },
      runtime: {
        lastError: null,
        getURL: (assetPath) => `chrome-extension://pai-test/${assetPath}`,
        sendMessage(message, callback) {
          window.chrome.runtime.lastError = null;
          if (message?.type === 'COMPOSER_ASSIST_REQUEST') {
            window.__paiComposeAssistRequests.push(message.request);
            const draftText = message.request?.draftText || '';
            let result;

            if (/manager/i.test(draftText)) {
              result = {
                available: true,
                suggestionType: 'reply_context',
                title: 'Message reply context',
                summary: 'Manager-safe reply.',
                insertText:
                  '当前状态：安全审批已完成。风险：生产登录仍待确认。下一步：今天下班前更新。',
                evidence: [],
                riskLevel: 'low',
                previewRequired: true,
                confidence: 0.94,
                queryTimeMs: 1,
                personaProjection: projection({
                  audienceType: 'manager',
                  representationMode: 'draft_preview_required',
                  blockedCount: 2,
                  reasonCodes: [
                    'confirmed_style_control',
                    'pending_profile_blocked',
                    'sensitive_profile_blocked',
                    'accountable_audience_preview',
                  ],
                  requiresPreview: true,
                }),
              };
            } else if (/blocked/i.test(draftText)) {
              result = {
                available: true,
                suggestionType: 'reply_context',
                title: 'Blocked reply',
                summary: 'Projection blocked.',
                insertText: 'This text must never be exposed.',
                evidence: [],
                riskLevel: 'high',
                previewRequired: true,
                confidence: 0.94,
                queryTimeMs: 1,
                personaProjection: projection({
                  audienceType: 'external',
                  audienceSource: 'surface_default',
                  representationMode: 'blocked',
                  voiceMode: 'never_speak_as_user',
                  usedSlotKinds: [],
                  usedCount: 0,
                  blockedCount: 1,
                  reasonCodes: ['blocked_value_leak'],
                  requiresPreview: true,
                }),
              };
            } else {
              result = {
                available: true,
                suggestionType: 'reply_context',
                title: 'Message reply context',
                summary: 'Peer reply.',
                insertText:
                  '安全审批已经完成，我再确认一下生产登录，下午同步。',
                evidence: [],
                riskLevel: 'low',
                previewRequired: false,
                confidence: 0.94,
                queryTimeMs: 1,
                personaProjection: projection({}),
              };
            }

            return respond(callback, { success: true, result });
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

async function loadSuggestion(page, draftText) {
  await page.goto(fixtureUrl);
  await page.addScriptTag({ path: contentScriptPath });
  await page.locator('#composer').fill(draftText);
  await page.locator('#outside-focus').click();
  await page.waitForFunction(
    (expectedDraft) =>
      window.__paiComposeAssistRequests?.some(
        (request) => request.draftText === expectedDraft,
      ),
    draftText,
    { timeout: 6000 },
  );
}

async function main() {
  const userDataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'pai-compose-persona-projection-'),
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

    await loadSuggestion(page, 'peer status update');
    const peerIcon = page.locator('.pai-composer-guard-icon-button');
    await peerIcon.waitFor({ state: 'visible', timeout: 6000 });
    assert.equal(
      await page.locator('.pai-composer-guard-review-note').count(),
      0,
      'peer hover must stay lightweight',
    );
    await peerIcon.dispatchEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector('#composer')
          ?.textContent?.includes('安全审批已经完成'),
      null,
      { timeout: 3000 },
    );
    assert.equal(
      await page.locator('[data-action="confirm-insert"]').count(),
      0,
      'low-risk peer suggestion must insert without a review step',
    );

    await loadSuggestion(page, 'manager status update');
    const managerIcon = page.locator('.pai-composer-guard-icon-button');
    await managerIcon.waitFor({ state: 'visible', timeout: 6000 });
    assert.equal(
      await page.locator('.pai-composer-guard-review-note').count(),
      0,
      'projection boundary must not be shown in the default hover',
    );
    await managerIcon.dispatchEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
    });
    await page.locator('[data-action="confirm-insert"]').waitFor({
      state: 'visible',
      timeout: 3000,
    });
    assert.equal(
      (
        await page.locator('.pai-composer-guard-review-note').innerText()
      ).trim(),
      reviewBoundary,
    );
    assert.equal(
      (await page.locator('#composer').innerText()).trim(),
      'manager status update',
      'manager projection must not write before explicit confirmation',
    );
    assert.doesNotMatch(
      await page.locator('#pai-composer-guard-root').innerText(),
      /pending_profile_blocked|sensitive_profile_blocked|confirmed_style_control/,
      'review UI must not expose internal reason codes',
    );
    await page
      .locator('[data-action="confirm-insert"]')
      .dispatchEvent('pointerdown', { bubbles: true, cancelable: true });
    await page.waitForFunction(
      () =>
        document
          .querySelector('#composer')
          ?.textContent?.includes('风险：生产登录仍待确认'),
      null,
      { timeout: 3000 },
    );

    await loadSuggestion(page, 'blocked status update');
    await page.waitForTimeout(300);
    assert.equal(
      await page.locator('.pai-composer-guard-icon-button').count(),
      0,
      'blocked projection must not expose a Compose Assist icon',
    );
    assert.doesNotMatch(
      await page.locator('body').innerText(),
      /This text must never be exposed/,
      'blocked projection text must remain hidden',
    );

    console.log('Compose Assist persona projection E2E passed.');
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

await main();
