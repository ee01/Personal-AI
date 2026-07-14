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
    window.__paiContextRecallFeedbacks = [];
    window.__paiContextRecallFeedbackMode = 'ok';
    window.__paiStorageState = storageState;
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
            const draftText = message.request?.draftText || '';
            const highRiskSourceCase = /High risk source/i.test(draftText);
            return respond(callback, {
              success: true,
              result: highRiskSourceCase
                ? {
                    available: true,
                    suggestionType: 'context_pack',
                    title: 'Sensitive context pack',
                    summary: 'Found matching private memory.',
                    insertText: '请先内部核对后再外发这段敏感上下文。',
                    evidence: [
                      {
                        id: 'private-message-1',
                        type: 'message',
                        snippet:
                          'Private compensation planning for Alice should stay internal.',
                        sourceLabel: 'Private DM with Alice',
                        sourceTitle: 'Alice salary planning thread',
                        whyRelevant: ['contains private compensation context'],
                        score: 0.86,
                        metadata: {
                          sourceType: 'ringcentral_dm',
                        },
                      },
                    ],
                    riskLevel: 'high',
                    previewRequired: false,
                    confidence: 0.9,
                    queryTimeMs: 1,
                  }
                : {
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
                        sourceLabel: 'jira',
                        sourceTitle: 'Factory AI rollout rehearsal',
                        sourceUrl: 'https://example.com/factory-ai-rollout',
                        exploreLink: '#/thread/factory-ai?focus=memory-1',
                        whyRelevant: ['已过期，仅弱提示', '线索：Factory AI', '同会话'],
                        evidenceRole: 'rehearsal_cue',
                        reasonType: 'prospective_cue',
                        displayPriority: 'p2',
                        metadata: {
                          rehearsal: {
                            id: 'rehearsal-1',
                            activationId: 'activation-1',
                            status: 'stale',
                            validUntil: 1700000000,
                            summary:
                              'Factory AI rollout has one remembered follow-up.',
                            content:
                              '下次讨论 Factory AI rollout 时，先提醒安全已通过，再确认 production 是否已拿到 RingCentral email login。',
                          },
                          matchedCues: {
                            conversationIds: ['factory-ai-room'],
                            topics: ['Factory AI rollout'],
                          },
                        },
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
                    riskLevel: 'low',
                    previewRequired: false,
                    confidence: 0.9,
                    queryTimeMs: 1,
                  },
            });
          }
          if (message?.type === 'CONTEXT_RECALL_FEEDBACK') {
            window.__paiContextRecallFeedbacks.push(message.feedback);
            if (window.__paiContextRecallFeedbackMode === 'fail') {
              return respond(callback, {
                success: false,
                error: 'context_recall_feedback_failed',
              });
            }
            return respond(callback, { success: true });
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
    assert.equal(requests[0].sourceTypes.includes('chatgpt'), false);
    assert.ok(requests[0].sourceTypes.includes('user_core'));
    assert.ok(requests[0].sourceTypes.includes('markdown'));
    assert.ok(requests[0].sourceTypes.includes('reflection'));
    assert.ok(requests[0].sourceTypes.includes('reflection_thread'));
    assert.ok(requests[0].sourceTypes.includes('source_memory'));
    assert.ok(requests[0].sourceTypes.includes('calendar'));

    const controlsBeforeClick = await page.evaluate(() => ({
      copyButtons: document.querySelectorAll('[data-action="copy"]').length,
      dismissButtons: document.querySelectorAll('[data-action="dismiss"]').length,
      confirmInsertButtons: document.querySelectorAll(
        '[data-action="confirm-insert"]',
      ).length,
      labelText:
        document.querySelector('.pai-composer-guard-label')?.textContent || '',
      cueLabels: document.querySelectorAll('.pai-composer-guard-cue').length,
      cueText:
        document.querySelector('.pai-composer-guard-cue')?.textContent || '',
      reviewNoteText:
        document.querySelector('.pai-composer-guard-review-note')?.textContent ||
        '',
      previewText:
        document
          .querySelector('.pai-composer-guard-text')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim() || '',
      provenanceBlocks: document.querySelectorAll(
        '.pai-composer-guard-provenance',
      ).length,
      reviewEvidenceBlocks: document.querySelectorAll(
        '.pai-composer-guard-review-evidence',
      ).length,
      sourceRouteBlocks: document.querySelectorAll(
        '.pai-composer-guard-source-route-receipt',
      ).length,
      sourceRouteText:
        document
          .querySelector('.pai-composer-guard-source-route-receipt')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim() || '',
      draftReceiptBlocks: document.querySelectorAll(
        '[aria-label="草稿回执"]',
      ).length,
      draftReceiptText:
        document
          .querySelector('[aria-label="草稿回执"]')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim() || '',
    }));
    assert.deepEqual(controlsBeforeClick, {
      copyButtons: 0,
      dismissButtons: 0,
      confirmInsertButtons: 0,
      labelText: 'Jira / 项目上下文',
      cueLabels: 0,
      cueText: '',
      reviewNoteText: '',
      previewText:
        '请结合下面上下文回答： 目标：Factory AI rollout status 相关记忆： 1. Factory AI passed security approval, but production still needs RingCentral email login. [M1]',
      provenanceBlocks: 0,
      reviewEvidenceBlocks: 0,
      sourceRouteBlocks: 0,
      sourceRouteText: '',
      draftReceiptBlocks: 0,
      draftReceiptText: '',
    });
    assert.equal(
      await page.evaluate(() => window.__paiContextRecallFeedbacks.length),
      0,
    );

    await page
      .locator('.pai-composer-guard-icon-button')
      .dispatchEvent('pointerdown', { bubbles: true, cancelable: true });
    await page.locator('[data-action="confirm-insert"]').waitFor({
      state: 'visible',
      timeout: 3000,
    });
    assert.equal(await page.locator('.pai-composer-guard-review-note').count(), 0);
    assert.equal(await page.locator('[aria-label="预演复核"]').count(), 0);
    assert.equal(
      await page.locator('.pai-composer-guard-review-evidence').count(),
      0,
    );
    assert.equal(
      await page.locator('.pai-composer-guard-source-route-receipt').count(),
      0,
    );
    assert.equal(await page.locator('[aria-label="草稿回执"]').count(), 0);
    const lockedPreviewText = await page
      .locator('.pai-composer-guard-text')
      .innerText();
    assert.match(lockedPreviewText, /请结合下面上下文回答/);
    assert.match(lockedPreviewText, /Factory AI passed security approval/);
    assert.doesNotMatch(lockedPreviewText, /来源路由/);
    assert.doesNotMatch(lockedPreviewText, /草稿回执/);
    assert.doesNotMatch(lockedPreviewText, /建议依据/);
    const composerTextBeforeConfirm = await page
      .locator('#prompt-textarea')
      .innerText();
    assert.equal(
      composerTextBeforeConfirm.trim(),
      '',
      'preview-required suggestions must not mutate the draft on the first click',
    );
    await page
      .locator('[data-action="confirm-insert"]')
      .dispatchEvent('pointerdown', { bubbles: true, cancelable: true });
    const composerText = await page.locator('#prompt-textarea').innerText();
    assert.match(composerText, /Factory AI passed security approval/);
    await page.locator('.pai-composer-guard-undo-button').waitFor({
      state: 'visible',
      timeout: 3000,
    });
    const undoReceiptText = await page
      .locator('.pai-composer-guard-undo-toast')
      .innerText();
    assert.match(undoReceiptText, /已插入草稿/);
    assert.match(undoReceiptText, /未发送，可继续编辑/);
    assert.match(undoReceiptText, /写入目标：外部 AI context pack/);
    assert.match(undoReceiptText, /没有提交 prompt、没有发送给外部 AI/);
    assert.match(
      undoReceiptText,
      /撤销窗口结束后才记录 accepted 和脱敏校准信号/,
    );
    assert.match(undoReceiptText, /约 10 秒内可撤销/);
    assert.match(undoReceiptText, /撤销/);
    await page.waitForFunction(
      () =>
        window.__paiContextRecallFeedbacks?.some(
          (feedback) =>
            feedback.targetId === 'rehearsal-1' &&
            feedback.targetType === 'rehearsal' &&
            feedback.action === 'positive' &&
            feedback.rehearsalActivationId === 'activation-1' &&
            feedback.detail?.includes('web_agent_prompt'),
        ),
      null,
      { timeout: 12000 },
    );
    await page
      .locator('.pai-composer-guard-feedback-toast', {
        hasText: '草稿保留已确认',
      })
      .waitFor({ state: 'visible', timeout: 3000 });
    const insertionCommitReceiptText = await page
      .locator('.pai-composer-guard-feedback-toast')
      .innerText();
    assert.match(insertionCommitReceiptText, /当前草稿未发送\/提交/);
    assert.match(insertionCommitReceiptText, /只保存脱敏摘要/);
    await page.waitForFunction(
      () =>
        document
          .querySelector('.pai-composer-guard-feedback-toast')
          ?.textContent?.includes('预演使用反馈已写入：1 条线索'),
      null,
      { timeout: 3000 },
    );
    const acceptedFeedbackReceiptText = await page
      .locator('.pai-composer-guard-feedback-toast')
      .innerText();
    assert.match(acceptedFeedbackReceiptText, /预演使用反馈已写入：1 条线索/);
    assert.match(acceptedFeedbackReceiptText, /相同场景后续会优先保留/);
    await page.evaluate(() => {
      delete window.__paiStorageState.envConfig
        .COMPOSER_GUARD_SURFACE_CONFIDENCE_THRESHOLDS;
    });

    await page.goto(fixtureUrl);
    await page.addScriptTag({ path: contentScriptPath });
    await page.locator('#prompt-textarea').click();
    await page.locator('#prompt-textarea').fill('High risk source prompt');
    await page.waitForFunction(
      () =>
        window.__paiComposeAssistRequests?.some(
          (request) => request.draftText === 'High risk source prompt',
        ),
      null,
      { timeout: 6000 },
    );
    await page.locator('.pai-composer-guard-icon-button').waitFor({
      state: 'visible',
      timeout: 6000,
    });
    await page
      .locator('.pai-composer-guard-icon-button')
      .dispatchEvent('pointerdown', { bubbles: true, cancelable: true });
    await page.locator('[data-action="confirm-insert"]').waitFor({
      state: 'visible',
      timeout: 3000,
    });
    assert.equal(
      await page.locator('[aria-label="预演复核"]').count(),
      0,
      'non-Rehearsal high-risk review must not show a Rehearsal receipt',
    );
    assert.equal(
      await page.locator('.pai-composer-guard-review-evidence').count(),
      0,
      'high-risk review must not expose evidence details in Compose Assist',
    );
    assert.equal(
      await page.locator('[aria-label="草稿回执"]').count(),
      0,
      'high-risk review must not show the old draft receipt panel',
    );
    const highRiskPreviewText = await page
      .locator('.pai-composer-guard-text')
      .innerText();
    assert.match(highRiskPreviewText, /请先内部核对后再外发这段敏感上下文/);
    assert.doesNotMatch(highRiskPreviewText, /Private DM with Alice/);
    assert.doesNotMatch(highRiskPreviewText, /Alice salary planning/);
    assert.doesNotMatch(highRiskPreviewText, /private compensation context/i);
    const highRiskComposerTextBeforeConfirm = await page
      .locator('#prompt-textarea')
      .innerText();
    assert.equal(
      highRiskComposerTextBeforeConfirm.trim(),
      'High risk source prompt',
      'high-risk suggestions must not mutate the draft before explicit insert',
    );
    await page
      .locator('[data-action="close-review"]')
      .dispatchEvent('pointerdown', { bubbles: true, cancelable: true });
    await page.waitForFunction(
      () =>
        document.querySelector('#pai-composer-guard-root')?.dataset.state ===
          'ready' &&
        !document.querySelector('[data-action="confirm-insert"]'),
      null,
      { timeout: 3000 },
    );
    assert.equal(
      await page.locator('.pai-composer-guard-icon-button').count(),
      1,
      'closing review should keep the suggestion available instead of suppressing it',
    );
    assert.equal(
      (await page.locator('#prompt-textarea').innerText()).trim(),
      'High risk source prompt',
      'closing review must not write to the draft',
    );
    await page
      .locator('.pai-composer-guard-icon-button')
      .dispatchEvent('pointerdown', { bubbles: true, cancelable: true });
    await page.locator('[data-action="confirm-insert"]').waitFor({
      state: 'visible',
      timeout: 3000,
    });
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () =>
        document.querySelector('#pai-composer-guard-root')?.dataset.state ===
          'ready' &&
        !document.querySelector('[data-action="confirm-insert"]'),
      null,
      { timeout: 3000 },
    );
    assert.equal(
      (await page.locator('#prompt-textarea').innerText()).trim(),
      'High risk source prompt',
      'Escape from review must not write or hide the suggestion',
    );

    await page.goto(fixtureUrl);
    await page.addScriptTag({ path: contentScriptPath });
    await page.locator('#prompt-textarea').click();
    await page
      .locator('#prompt-textarea')
      .fill('High risk source before replace this after');
    await page.waitForFunction(
      () =>
        window.__paiComposeAssistRequests?.some(
          (request) =>
            request.draftText ===
            'High risk source before replace this after',
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
    await page
      .locator('.pai-composer-guard-icon-button')
      .dispatchEvent('pointerdown', { bubbles: true, cancelable: true });
    await page.locator('[data-action="confirm-insert"]').waitFor({
      state: 'visible',
      timeout: 3000,
    });
    await page.locator('[data-action="confirm-insert"]').evaluate((button) => {
      button.focus();
      const range = document.createRange();
      range.selectNodeContents(button);
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    await page
      .locator('[data-action="confirm-insert"]')
      .dispatchEvent('pointerdown', { bubbles: true, cancelable: true });
    const restoredSelectionInsertText = await page
      .locator('#prompt-textarea')
      .innerText();
    assert.doesNotMatch(restoredSelectionInsertText, /replace this/);
    assert.match(restoredSelectionInsertText, /High risk source before/);
    assert.match(restoredSelectionInsertText, /请先内部核对后再外发这段敏感上下文/);
    assert.match(restoredSelectionInsertText, /after/);
    assert.ok(
      restoredSelectionInsertText.indexOf('High risk source before') <
        restoredSelectionInsertText.indexOf('请先内部核对后再外发这段敏感上下文'),
      'restored review selection should keep the inserted text at the original selected range',
    );
    assert.ok(
      restoredSelectionInsertText.indexOf('请先内部核对后再外发这段敏感上下文') <
        restoredSelectionInsertText.indexOf('after'),
      'restored review selection should preserve text after the selected range',
    );
    await page.locator('.pai-composer-guard-undo-button').click();
    await page.waitForFunction(
      () =>
        document.querySelector('#prompt-textarea')?.textContent ===
        'High risk source before replace this after',
      null,
      { timeout: 3000 },
    );

    await page.goto(fixtureUrl);
    await page.addScriptTag({ path: contentScriptPath });
    await page.locator('#prompt-textarea').click();
    await page.locator('#prompt-textarea').fill('Silent stale draft');
    await page.waitForFunction(
      () =>
        window.__paiComposeAssistRequests?.some(
          (request) => request.draftText === 'Silent stale draft',
        ),
      null,
      { timeout: 6000 },
    );
    await page.locator('.pai-composer-guard-icon-button').waitFor({
      state: 'visible',
      timeout: 6000,
    });
    await page
      .locator('.pai-composer-guard-icon-button')
      .dispatchEvent('pointerdown', { bubbles: true, cancelable: true });
    await page.locator('[data-action="confirm-insert"]').waitFor({
      state: 'visible',
      timeout: 3000,
    });
    const feedbackCountBeforeStaleInsert = await page.evaluate(
      () => window.__paiContextRecallFeedbacks.length,
    );
    await page.locator('#prompt-textarea').evaluate((element) => {
      element.textContent = 'Silent stale draft changed without input event';
    });
    await page
      .locator('[data-action="confirm-insert"]')
      .dispatchEvent('pointerdown', { bubbles: true, cancelable: true });
    await page.locator('.pai-composer-guard-feedback-toast').waitFor({
      state: 'visible',
      timeout: 3000,
    });
    const staleDraftReceiptText = await page
      .locator('.pai-composer-guard-feedback-toast')
      .innerText();
    assert.match(staleDraftReceiptText, /草稿已变化/);
    assert.match(staleDraftReceiptText, /未写入草稿/);
    assert.match(staleDraftReceiptText, /基于旧草稿/);
    assert.match(staleDraftReceiptText, /没有发送或提交/);
    assert.match(staleDraftReceiptText, /重新聚焦后重试/);
    const staleComposerText = await page.locator('#prompt-textarea').innerText();
    assert.equal(
      staleComposerText,
      'Silent stale draft changed without input event',
      'stale direct insert must keep the user-edited draft intact',
    );
    assert.doesNotMatch(staleComposerText, /Factory AI passed security approval/);
    assert.equal(
      await page.evaluate(() => window.__paiContextRecallFeedbacks.length),
      feedbackCountBeforeStaleInsert,
      'blocking a stale insert must not record accepted evidence feedback',
    );

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
    await page.locator('#prompt-textarea').fill('Readonly composer failure');
    await page.waitForFunction(
      () =>
        window.__paiComposeAssistRequests?.some(
          (request) => request.draftText === 'Readonly composer failure',
        ),
      null,
      { timeout: 6000 },
    );
    await page.locator('.pai-composer-guard-icon-button').waitFor({
      state: 'visible',
      timeout: 6000,
    });
    await page.locator('#prompt-textarea').evaluate((element) => {
      element.setAttribute('contenteditable', 'false');
    });
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
    await page.locator('.pai-composer-guard-feedback-toast').waitFor({
      state: 'visible',
      timeout: 3000,
    });
    const failedInsertReceiptText = await page
      .locator('.pai-composer-guard-feedback-toast')
      .innerText();
    assert.match(failedInsertReceiptText, /未写入草稿/);
    assert.match(failedInsertReceiptText, /没有发送或提交/);
    assert.match(failedInsertReceiptText, /重新聚焦输入框后重试/);
    assert.equal(
      await page.locator('#prompt-textarea').innerText(),
      'Readonly composer failure',
    );
    assert.equal(
      await page.evaluate(() =>
        window.__paiContextRecallFeedbacks.some(
          (feedback) =>
            feedback.action === 'positive' &&
            feedback.detail?.includes('Readonly composer failure'),
        ),
      ),
      false,
    );

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
    const feedbackReceiptText = await page
      .waitForFunction(
        () =>
          document.querySelector('.pai-composer-guard-feedback-toast')
            ?.textContent || '',
        null,
        { timeout: 3000 },
    )
      .then((handle) => handle.jsonValue());
    assert.match(feedbackReceiptText, /已隐藏预演建议/);
    assert.match(
      feedbackReceiptText,
      /命中线索：会话 factory-ai-room \/ 主题 Factory AI rollout/,
    );
    assert.match(feedbackReceiptText, /ChatGPT 场景也会更谨慎/);
    assert.match(feedbackReceiptText, /换个 prompt 仍会重新判断/);
    assert.match(feedbackReceiptText, /本次点击只隐藏当前建议/);
    assert.match(feedbackReceiptText, /不会发送\/提交草稿/);
    assert.match(feedbackReceiptText, /不会.*关闭其他输入框建议/);
    assert.match(feedbackReceiptText, /预演降权等后台写入以下方回执为准/);
    await page.waitForFunction(
      () =>
        window.__paiContextRecallFeedbacks?.some(
          (feedback) =>
            feedback.targetId === 'rehearsal-1' &&
            feedback.targetType === 'rehearsal' &&
            feedback.action === 'negative' &&
            feedback.rehearsalActivationId === 'activation-1' &&
            feedback.detail?.includes('web_agent_prompt'),
        ),
      null,
      { timeout: 3000 },
    );
    await page.waitForFunction(
      () =>
        document
          .querySelector('.pai-composer-guard-feedback-toast')
          ?.textContent?.includes('预演降权已写入：1 条线索'),
      null,
      { timeout: 3000 },
    );
    await page.waitForFunction(
      () =>
        window.__paiStorageState?.envConfig
          ?.COMPOSER_GUARD_SURFACE_CONFIDENCE_THRESHOLDS?.chatgpt > 0.78,
      null,
      { timeout: 3000 },
    );
    const updatedFeedbackReceiptText = await page
      .waitForFunction(
        () => {
          const text =
            document.querySelector('.pai-composer-guard-feedback-toast')
              ?.textContent || '';
          return text.includes('调阈已保存') ? text : false;
        },
        null,
        { timeout: 3000 },
      )
      .then((handle) => handle.jsonValue());
    assert.match(
      updatedFeedbackReceiptText,
      /调阈已保存：ChatGPT 场景阈值 0\.780 -> 0\.802/,
    );
    assert.match(updatedFeedbackReceiptText, /只影响这个 surface/);
    const thresholdState = await page.evaluate(
      () => window.__paiStorageState.envConfig,
    );
    assert.equal(thresholdState.COMPOSER_GUARD_CONFIDENCE_THRESHOLD, 0.78);
    assert.equal(
      thresholdState.COMPOSER_GUARD_SURFACE_CONFIDENCE_THRESHOLDS.chatgpt,
      0.802,
      'rejecting a Web AI suggestion should only raise the ChatGPT surface threshold',
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
    await page.evaluate(() => {
      window.__paiContextRecallFeedbackMode = 'fail';
    });
    await page.locator('.pai-composer-guard-icon-button').waitFor({
      state: 'visible',
      timeout: 6000,
    });
    await page.locator('.pai-composer-guard-icon-button').hover();
    await page.locator('.pai-composer-guard-feedback-button').click();
    await page
      .locator('.pai-composer-guard-feedback-detail', {
        hasText: '预演降权未写入：context_recall_feedback_failed',
      })
      .waitFor({ state: 'visible', timeout: 3000 });

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
