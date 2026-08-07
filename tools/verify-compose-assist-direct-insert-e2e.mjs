import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const require = createRequire(import.meta.url);
const ts = require('typescript');
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const contentScriptPath = path.join(
  repoRoot,
  'dist/contentScriptWebIntelligence.js',
);
const siteContextAdaptersModule = ts.transpileModule(
  fs.readFileSync(
    path.join(repoRoot, 'src/composer-guard/siteContextAdapters.ts'),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
const contextRecallGuardsModule = ts.transpileModule(
  fs.readFileSync(
    path.join(repoRoot, 'src/web-intelligence/contextRecallGuards.ts'),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;

if (!fs.existsSync(contentScriptPath)) {
  throw new Error(
    'Missing dist/contentScriptWebIntelligence.js. Run npm start first.',
  );
}

const fixtureUrl = 'https://chatgpt.com/c/pai-compose-direct-insert';
const jiraFixtureUrl = 'https://jira.example.test/browse/MTR-148115';

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
      <button id="outside-focus" type="button">Outside composer</button>
      <div class="composer-shell">
        <div role="toolbar" aria-label="Formatting toolbar">
          <button id="format-bold" type="button" aria-label="Format bold">Bold</button>
        </div>
        <div
          id="prompt-textarea"
          contenteditable="true"
          role="textbox"
          data-testid="composer-textarea"
        ></div>
        <button id="send-prompt" type="button" aria-label="Send prompt">Send</button>
      </div>
    </main>
  </body>
</html>`;

const jiraRichFrameFixtureHtml = `<!doctype html>
<html>
  <head>
    <title>MTR-148115 - Rich editor blur</title>
    <style>
      body { font-family: sans-serif; padding: 24px; }
      iframe { width: 640px; height: 120px; border: 1px solid #cbd5e1; }
    </style>
  </head>
  <body>
    <main>
      <h1 id="summary-val">Verify rich iframe Compose Assist blur</h1>
      <div id="description-val">MTR-148115 needs a concise Jira comment.</div>
      <button id="outside-focus" type="button">Outside editor</button>
      <div id="addcomment">
        <iframe
          id="mce_1_ifr"
          srcdoc='<!doctype html><html><body contenteditable="true" style="min-height:90px">Rich iframe original</body></html>'
        ></iframe>
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
            const rewriteCase = /Rewrite complete prompt/i.test(draftText);
            const invalidRewriteModeCase = /Rewrite missing mode/i.test(
              draftText,
            );
            return respond(callback, {
              success: true,
              result: invalidRewriteModeCase
                ? {
                    available: true,
                    suggestionType: 'rewrite_prompt',
                    title: 'Invalid rewrite mode',
                    insertText: 'This full rewrite must never be appended.',
                    evidence: [],
                    riskLevel: 'medium',
                    previewRequired: true,
                    confidence: 0.9,
                    queryTimeMs: 1,
                  }
                : rewriteCase
                ? {
                    available: true,
                    suggestionType: 'rewrite_prompt',
                    insertMode: 'replace_draft',
                    title: 'Optimized complete prompt',
                    summary: 'Reframed the full task.',
                    insertText:
                      'Optimized complete prompt\n\nKeep every stated fact, compare the evidence, and separate general findings from the final decision.',
                    evidence: [],
                    riskLevel: 'medium',
                    previewRequired: true,
                    confidence: 0.9,
                    queryTimeMs: 1,
                  }
                : highRiskSourceCase
                ? {
                    available: true,
                    suggestionType: 'context_pack',
                    insertMode: 'append_patch',
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
                    insertMode: 'append_patch',
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

async function blurComposer(page) {
  await page.locator('#outside-focus').click();
}

async function verifyRichIframeBlur(context) {
  const page = await context.newPage();
  await page.route(jiraFixtureUrl, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: jiraRichFrameFixtureHtml,
    }),
  );
  await installChromeStub(page);
  await page.goto(jiraFixtureUrl);
  await page.addScriptTag({ path: contentScriptPath });
  const editor = page.frameLocator('#mce_1_ifr').locator('body');
  await editor.click();
  await editor.fill('Rich iframe blur prompt');
  await page.waitForTimeout(900);
  assert.equal(
    await page.evaluate(() => window.__paiComposeAssistRequests.length),
    0,
    'rich iframe focus/input with draft must not request Draft Refine before blur',
  );
  await page.locator('#outside-focus').click();
  await page.waitForFunction(
    () => window.__paiComposeAssistRequests.length === 1,
    null,
    { timeout: 6000 },
  );
  const request = await page.evaluate(() => window.__paiComposeAssistRequests[0]);
  assert.equal(request.contextType, 'jira_issue');
  assert.equal(request.draftText, 'Rich iframe blur prompt');
  await page.close();
}

async function verifyReplacementTargets(context) {
  const page = await context.newPage();
  const fixtureRoot = 'https://compose-targets.test';
  await page.route(`${fixtureRoot}/**`, (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/composer-guard/siteContextAdapters.js') {
      return route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: siteContextAdaptersModule,
      });
    }
    if (pathname === '/web-intelligence/contextRecallGuards.js') {
      return route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: contextRecallGuardsModule,
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html>
        <html><body>
          <textarea id="textarea">Textarea original</textarea>
          <input id="input" type="text" value="Input original" />
          <div id="editable" contenteditable="true"><strong>Editable</strong> original</div>
          <div id="comment-editor"><iframe id="mce_1_ifr"></iframe></div>
        </body></html>`,
    });
  });
  await page.goto(`${fixtureRoot}/index.html`);
  await page.locator('#mce_1_ifr').evaluate((frame) => {
    frame.srcdoc =
      '<!doctype html><html><body contenteditable="true"><em>Frame</em> original</body></html>';
  });
  await page.waitForFunction(
    () =>
      document.querySelector('#mce_1_ifr')?.contentDocument?.readyState ===
      'complete',
  );

  const results = await page.evaluate(async () => {
    const adapter = await import(
      '/composer-guard/siteContextAdapters.js'
    );
    const replacement = 'Replacement line one\n\nReplacement line two';
    const setTextSelection = (element, start, end, ownerDocument = document) => {
      const walker = ownerDocument.createTreeWalker(
        element,
        ownerDocument.defaultView.NodeFilter.SHOW_TEXT,
      );
      const nodes = [];
      let current = walker.nextNode();
      while (current) {
        nodes.push(current);
        current = walker.nextNode();
      }
      const resolve = (offset) => {
        let remaining = offset;
        for (const node of nodes) {
          if (remaining <= node.data.length) {
            return { node, offset: remaining };
          }
          remaining -= node.data.length;
        }
        const last = nodes.at(-1);
        return last
          ? { node: last, offset: last.data.length }
          : { node: element, offset: 0 };
      };
      const startBoundary = resolve(start);
      const endBoundary = resolve(end);
      const range = ownerDocument.createRange();
      range.setStart(startBoundary.node, startBoundary.offset);
      range.setEnd(endBoundary.node, endBoundary.offset);
      const selection = ownerDocument.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    };
    const readTextSelection = (element, ownerDocument = document) => {
      const selection = ownerDocument.getSelection();
      if (!selection || selection.rangeCount === 0) return null;
      const range = selection.getRangeAt(0);
      const beforeStart = ownerDocument.createRange();
      beforeStart.selectNodeContents(element);
      beforeStart.setEnd(range.startContainer, range.startOffset);
      const beforeEnd = ownerDocument.createRange();
      beforeEnd.selectNodeContents(element);
      beforeEnd.setEnd(range.endContainer, range.endOffset);
      return [beforeStart.toString().length, beforeEnd.toString().length];
    };
    const verifyTarget = (target, configureSelection, readValue) => {
      const events = [];
      const eventElement =
        target.kind === 'richiframe'
          ? target.element.contentDocument.body
          : target.element;
      eventElement.addEventListener('input', (event) => {
        events.push(`input:${event.inputType || ''}`);
      });
      eventElement.addEventListener('change', () => events.push('change'));
      configureSelection();
      const before = adapter.captureComposerTextSnapshot(target);
      const replaced = adapter.replaceComposerText(target, replacement);
      const afterReplace = readValue();
      const replaceSelection =
        target.kind === 'textarea' || target.kind === 'input'
          ? [target.element.selectionStart, target.element.selectionEnd]
          : target.kind === 'richiframe'
            ? readTextSelection(
                target.element.contentDocument.body,
                target.element.contentDocument,
              )
            : readTextSelection(target.element);
      const restored = adapter.restoreComposerTextSnapshot(target, before);
      const afterRestore = readValue();
      const restoredSelection =
        target.kind === 'textarea' || target.kind === 'input'
          ? [target.element.selectionStart, target.element.selectionEnd]
          : target.kind === 'richiframe'
            ? readTextSelection(
                target.element.contentDocument.body,
                target.element.contentDocument,
              )
            : readTextSelection(target.element);
      return {
        replaced,
        restored,
        afterReplace,
        afterRestore,
        replaceSelection,
        restoredSelection,
        events,
      };
    };

    const textarea = document.querySelector('#textarea');
    const input = document.querySelector('#input');
    const editable = document.querySelector('#editable');
    const frame = document.querySelector('#mce_1_ifr');
    const frameBody = frame.contentDocument.body;
    return {
      replacement,
      textarea: verifyTarget(
        { element: textarea, kind: 'textarea', mode: 'prompt' },
        () => textarea.setSelectionRange(2, 7),
        () => textarea.value,
      ),
      input: verifyTarget(
        { element: input, kind: 'input', mode: 'prompt' },
        () => input.setSelectionRange(1, 5),
        () => input.value,
      ),
      contenteditable: verifyTarget(
        { element: editable, kind: 'contenteditable', mode: 'prompt' },
        () => setTextSelection(editable, 2, 8),
        () => ({ html: editable.innerHTML, text: editable.textContent }),
      ),
      richiframe: verifyTarget(
        { element: frame, kind: 'richiframe', mode: 'comment' },
        () => setTextSelection(frameBody, 1, 4, frame.contentDocument),
        () => ({ html: frameBody.innerHTML, text: frameBody.textContent }),
      ),
    };
  });

  for (const key of ['textarea', 'input', 'contenteditable', 'richiframe']) {
    const result = results[key];
    const replacedText =
      typeof result.afterReplace === 'string'
        ? result.afterReplace
        : result.afterReplace.text;
    assert.equal(result.replaced, true, `${key} must accept full replacement`);
    assert.equal(result.restored, true, `${key} must restore its snapshot`);
    assert.deepEqual(
      result.replaceSelection,
      [replacedText.length, replacedText.length],
      `${key} replacement cursor must end at the new draft tail`,
    );
    assert.ok(
      result.events.includes('input:insertReplacementText'),
      `${key} must emit insertReplacementText`,
    );
    assert.ok(result.events.includes('change'), `${key} must emit change`);
  }
  assert.equal(results.textarea.afterReplace, results.replacement);
  assert.equal(results.textarea.afterRestore, 'Textarea original');
  assert.deepEqual(results.textarea.restoredSelection, [2, 7]);
  assert.equal(
    results.input.afterReplace,
    results.replacement.replace(/\n/g, ''),
  );
  assert.equal(results.input.afterRestore, 'Input original');
  assert.deepEqual(results.input.restoredSelection, [1, 5]);
  assert.deepEqual(results.contenteditable.afterReplace, {
    html: results.replacement,
    text: results.replacement,
  });
  assert.deepEqual(results.contenteditable.afterRestore, {
    html: '<strong>Editable</strong> original',
    text: 'Editable original',
  });
  assert.deepEqual(results.contenteditable.restoredSelection, [2, 8]);
  assert.deepEqual(results.richiframe.afterReplace, {
    html: results.replacement,
    text: results.replacement,
  });
  assert.deepEqual(results.richiframe.afterRestore, {
    html: '<em>Frame</em> original',
    text: 'Frame original',
  });
  assert.deepEqual(results.richiframe.restoredSelection, [1, 4]);
  await page.close();
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
    assert.equal(
      await page.evaluate(
        () => window.__paiComposeAssistRequests[0].assistIntent,
      ),
      'draft_compose',
      'Web AI empty focus should request Draft Compose',
    );
    await page
      .locator('#prompt-textarea')
      .fill('Factory AI rollout status prompt');
    await page.waitForTimeout(900);
    assert.equal(
      await page.evaluate(() => window.__paiComposeAssistRequests?.length || 0),
      1,
      'input changes must not request Draft Refine before blur',
    );
    await blurComposer(page);
    await page.waitForFunction(
      () => window.__paiComposeAssistRequests?.length >= 2,
      null,
      { timeout: 6000 },
    );
    const requests = await page.evaluate(
      () => window.__paiComposeAssistRequests,
    );
    assert.equal(requests[1].assistIntent, 'draft_refine');
    assert.equal(requests[1].contextType, 'web_agent_prompt');
    assert.equal(requests[1].draftText, 'Factory AI rollout status prompt');
    assert.equal(requests[1].sourceTypes.includes('chatgpt'), false);
    assert.ok(requests[1].sourceTypes.includes('markdown'));
    assert.ok(requests[1].sourceTypes.includes('reflection'));
    assert.ok(requests[1].sourceTypes.includes('reflection_thread'));
    assert.ok(requests[1].sourceTypes.includes('source_memory'));
    assert.ok(requests[1].sourceTypes.includes('calendar'));
    await page.locator('#prompt-textarea').click();
    await blurComposer(page);
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(() => window.__paiComposeAssistRequests.length),
      2,
      'the same contextKey + draftRevision + intent must only request once',
    );

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
      'Factory AI rollout status prompt',
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
    assert.match(undoReceiptText, /已追加上下文/);
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
    await page.locator('#prompt-textarea').fill('Toolbar focus boundary prompt');
    await page.locator('#format-bold').click();
    await page.waitForTimeout(900);
    assert.equal(
      await page.evaluate(() => window.__paiComposeAssistRequests.length),
      0,
      'moving focus into the formatting toolbar must not count as blur',
    );
    await page.locator('#prompt-textarea').click();
    await blurComposer(page);
    await page.waitForFunction(
      () => window.__paiComposeAssistRequests.length === 1,
      null,
      { timeout: 6000 },
    );

    await page.goto(fixtureUrl);
    await page.addScriptTag({ path: contentScriptPath });
    await page.locator('#prompt-textarea').fill('Send suppression prompt');
    await page.locator('#send-prompt').click();
    await page.waitForTimeout(900);
    assert.equal(
      await page.evaluate(() => window.__paiComposeAssistRequests.length),
      0,
      'pointerdown on Send must suppress the focusout request',
    );

    await page.goto(fixtureUrl);
    await page.addScriptTag({ path: contentScriptPath });
    const rewriteOriginal = 'Rewrite complete prompt with original facts';
    await page.locator('#prompt-textarea').click();
    await page.locator('#prompt-textarea').fill(rewriteOriginal);
    await page.waitForTimeout(900);
    assert.equal(
      await page.evaluate(() => window.__paiComposeAssistRequests.length),
      0,
      'rewrite Draft Refine requests must also wait for blur',
    );
    await blurComposer(page);
    await page.locator('.pai-composer-guard-icon-button').waitFor({
      state: 'visible',
      timeout: 6000,
    });
    assert.equal(
      await page.locator('.pai-composer-guard-label').innerText(),
      '优化后的完整提问',
    );
    await page
      .locator('.pai-composer-guard-icon-button')
      .dispatchEvent('pointerdown', { bubbles: true, cancelable: true });
    const rewriteConfirm = page.locator('[data-action="confirm-insert"]');
    await rewriteConfirm.waitFor({ state: 'visible', timeout: 3000 });
    assert.equal(await rewriteConfirm.innerText(), '替换原 prompt');
    assert.equal(
      (await page.locator('#prompt-textarea').innerText()).trim(),
      rewriteOriginal,
      'rewrite preview must not change the original draft',
    );
    await page.locator('#prompt-textarea').evaluate((element) => {
      window.__paiReplacementInputTypes = [];
      window.__paiReplacementChangeCount = 0;
      element.addEventListener('input', (event) => {
        window.__paiReplacementInputTypes.push(event.inputType || '');
      });
      element.addEventListener('change', () => {
        window.__paiReplacementChangeCount += 1;
      });
    });
    await rewriteConfirm.dispatchEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
    });
    const rewrittenComposerText = (
      await page.locator('#prompt-textarea').innerText()
    ).trim();
    assert.equal(
      rewrittenComposerText,
      'Optimized complete prompt\n\nKeep every stated fact, compare the evidence, and separate general findings from the final decision.',
    );
    assert.doesNotMatch(rewrittenComposerText, /Rewrite complete prompt/);
    assert.deepEqual(
      await page.evaluate(() => ({
        inputTypes: window.__paiReplacementInputTypes,
        changeCount: window.__paiReplacementChangeCount,
      })),
      {
        inputTypes: ['insertReplacementText'],
        changeCount: 1,
      },
    );
    const rewriteUndoReceipt = await page
      .locator('.pai-composer-guard-undo-toast')
      .innerText();
    assert.match(rewriteUndoReceipt, /已替换原 prompt/);
    assert.match(rewriteUndoReceipt, /没有提交 prompt、没有发送给外部 AI/);
    await page.locator('.pai-composer-guard-undo-button').click();
    await page.waitForFunction(
      (original) =>
        document.querySelector('#prompt-textarea')?.textContent === original,
      rewriteOriginal,
      { timeout: 3000 },
    );

    await page.goto(fixtureUrl);
    await page.addScriptTag({ path: contentScriptPath });
    await page.locator('#prompt-textarea').fill('Rewrite missing mode prompt');
    await blurComposer(page);
    await page.waitForFunction(
      () => window.__paiComposeAssistRequests.length === 1,
      null,
      { timeout: 6000 },
    );
    await page.waitForTimeout(300);
    assert.equal(
      await page.locator('.pai-composer-guard-icon-button').count(),
      0,
      'legacy rewrite responses without replace_draft must fail closed',
    );
    assert.equal(
      (await page.locator('#prompt-textarea').innerText()).trim(),
      'Rewrite missing mode prompt',
    );

    await page.goto(fixtureUrl);
    await page.addScriptTag({ path: contentScriptPath });
    await page.locator('#prompt-textarea').click();
    await page.locator('#prompt-textarea').fill('High risk source prompt');
    await blurComposer(page);
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
    await blurComposer(page);
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
    await blurComposer(page);
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
    await blurComposer(page);
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
    await blurComposer(page);
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
    await blurComposer(page);
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
          ?.COMPOSER_GUARD_SURFACE_CONFIDENCE_THRESHOLDS?.[
          'chatgpt:draft_refine'
        ] > 0.72,
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
      /调阈已保存：ChatGPT 场景阈值 0\.720 -> 0\.752/,
    );
    assert.match(updatedFeedbackReceiptText, /只影响这个 surface/);
    const thresholdState = await page.evaluate(
      () => window.__paiStorageState.envConfig,
    );
    assert.equal(thresholdState.COMPOSER_GUARD_CONFIDENCE_THRESHOLD, 0.78);
    assert.equal(
      thresholdState.COMPOSER_GUARD_SURFACE_CONFIDENCE_THRESHOLDS[
        'chatgpt:draft_refine'
      ],
      0.752,
      'rejecting a Web AI Draft Refine suggestion should only raise the ChatGPT refine threshold',
    );
    await page
      .locator('#prompt-textarea')
      .fill('Second unrelated prompt should still ask for assist');
    await blurComposer(page);
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

    await verifyRichIframeBlur(context);
    await verifyReplacementTargets(context);
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
