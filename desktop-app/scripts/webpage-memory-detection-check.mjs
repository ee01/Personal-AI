import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(appRoot, '..');
const extensionPath = path.join(repoRoot, 'dist');
const siteMuteStorageKey = 'pai-context-muted-sites-v1';
const siteBlockStorageKey = 'pai-context-blocked-sites-v1';
const pageBlockStorageKey = 'pai-context-blocked-page-prefixes-v1';
const siteAllowStorageKey = 'pai-context-allowed-sites-v1';
const siteAllowlistModeStorageKey = 'pai-context-site-allowlist-mode-v1';

function log(message) {
  console.log(`[webpage-memory-detection] ${message}`);
}

function attachPageDiagnostics(page, label) {
  const entries = [];
  page.on('console', (message) => {
    entries.push(`${label} console ${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => {
    entries.push(
      `${label} pageerror: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  return entries;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRequestCount(server, expectedCount, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.contextRecallRequests.length >= expectedCount) {
      return;
    }
    await delay(50);
  }
  throw new Error(
    `Timed out waiting for ${expectedCount} context-recall request(s); got ${server.contextRecallRequests.length}`,
  );
}

async function waitForCapturedSourceMemoryCount(server, expectedCount, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.sourceMemoryCreateRequests.length >= expectedCount) {
      return;
    }
    await delay(50);
  }
  throw new Error(
    `Timed out waiting for ${expectedCount} source-memory create request(s); got ${server.sourceMemoryCreateRequests.length}`,
  );
}

function parseFeedbackDetail(detail) {
  assert.equal(typeof detail, 'string', '反馈 detail 应以字符串发送');
  try {
    return JSON.parse(detail);
  } catch (error) {
    throw new Error(`反馈 detail 应为 JSON 字符串: ${detail}`);
  }
}

async function openContextMoreMenu(page) {
  await page.locator('.pai-context-more').click();
  await page.waitForSelector('.pai-context-more-menu:not([hidden])', {
    timeout: 5000,
  });
}

async function assertFeedbackDrawerLayout(page) {
  const layout = await page.locator('.pai-context-feedback-layer').evaluate((layer) => {
    const sheet = layer.querySelector('.pai-context-feedback-sheet');
    const card = document.querySelector('.pai-context-card');
    const layerRect = layer.getBoundingClientRect();
    const sheetRect = sheet?.getBoundingClientRect();
    const cardRect = card?.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    return {
      parentTag: layer.parentElement?.tagName,
      position: getComputedStyle(layer).position,
      cardContainsLayer: Boolean(card?.contains(layer)),
      layerRect: {
        x: layerRect.x,
        y: layerRect.y,
        width: layerRect.width,
        height: layerRect.height,
      },
      sheetRect: sheetRect
        ? {
            x: sheetRect.x,
            y: sheetRect.y,
            right: sheetRect.right,
            width: sheetRect.width,
            height: sheetRect.height,
          }
        : null,
      cardRect: cardRect
        ? {
            width: cardRect.width,
            height: cardRect.height,
          }
        : null,
      viewportWidth,
      viewportHeight,
    };
  });

  assert.equal(layout.parentTag, 'BODY', '反馈 drawer 应挂在页面 body 下');
  assert.equal(layout.position, 'fixed', '反馈 drawer overlay 应覆盖整个 viewport');
  assert.equal(layout.cardContainsLayer, false, '反馈 drawer 不应渲染在 Memory Lens 卡片内部');
  assert.equal(layout.layerRect.x, 0, '反馈 drawer overlay 应从 viewport 左侧开始');
  assert.equal(layout.layerRect.y, 0, '反馈 drawer overlay 应从 viewport 顶部开始');
  assert.ok(
    layout.layerRect.width >= layout.viewportWidth - 1 &&
      layout.layerRect.height >= layout.viewportHeight - 1,
    '反馈 drawer overlay 应覆盖整个 viewport',
  );
  assert.ok(layout.sheetRect, '反馈 drawer sheet 应存在');
  if (layout.viewportWidth <= 640) {
    assert.ok(
      layout.sheetRect.width >= layout.viewportWidth - 2,
      '移动端 bottom sheet 应接近占满 viewport 宽度',
    );
    assert.ok(
      layout.sheetRect.y + layout.sheetRect.height >= layout.viewportHeight - 2,
      '移动端 bottom sheet 应贴在 viewport 底部',
    );
    assert.ok(
      layout.sheetRect.height <= layout.viewportHeight * 0.82,
      '移动端 bottom sheet 高度不应超过约 80vh',
    );
  } else {
    assert.ok(
      layout.sheetRect.right >= layout.viewportWidth - 2,
      '桌面端 drawer 应贴在 viewport 右侧',
    );
    assert.ok(
      layout.sheetRect.height >= layout.viewportHeight - 2,
      '桌面端 drawer 应接近全高，而不是 Lens 卡片内的小弹窗',
    );
    assert.ok(
      !layout.cardRect || layout.sheetRect.height > layout.cardRect.height,
      '反馈 drawer 高度应大于 Memory Lens 卡片高度',
    );
  }
}

async function chooseNegativeFeedbackReason(page, reason = 'generic_topic_overlap') {
  await page.locator('.pai-context-recall-negative').click();
  await page.waitForSelector('.pai-context-feedback-sheet', {
    state: 'visible',
    timeout: 5000,
  });
  await assertFeedbackDrawerLayout(page);
  await page
    .locator(`.pai-context-feedback-reason[data-feedback-reason="${reason}"]`)
    .click();
}

async function startHarnessServer() {
  const contextRecallRequests = [];
  const feedbackRequests = [];
  const rehearsalFeedbackRequests = [];
  const sourceMemoryCandidateRequests = [];
  const sourceMemoryCreateRequests = [];

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'POST' && req.url === '/api/v1/context-recall') {
        const rawBody = await readRequestBody(req);
        const body = rawBody ? JSON.parse(rawBody) : {};
        contextRecallRequests.push(body);
        if (typeof body.url === 'string' && body.url.includes('/empty-meeting')) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              matches: [],
              topMatch: null,
              queryTimeMs: 3,
            }),
          );
          return;
        }
        if (typeof body.url === 'string' && body.url.includes('/credential-selection')) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              matches: [],
              topMatch: null,
              queryTimeMs: 2,
            }),
          );
          return;
        }
        if (
          body.contextType === 'selected_text' &&
          typeof body.url === 'string' &&
          body.url.includes('/selected-no-match')
        ) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              matches: [],
              topMatch: null,
              queryTimeMs: 2,
            }),
          );
          return;
        }
        if (typeof body.url === 'string' && body.url.includes('/rehearsal-lens')) {
          const rehearsalMatch = {
            id: 'rehearsal-memory-1',
            type: 'rehearsal',
            score: 0.87,
            displayPriority: 'p1',
            title: 'Next Falcon customer review',
            uiSummary: 'Before the Falcon customer review, ask Priya to confirm the escalation owner.',
            snippet: 'Ask Priya to confirm the escalation owner before the customer review.',
            sourceLabel: 'rehearsal',
            sourceTitle: 'Rehearsal',
            exploreLink: '#/rehearsals?rehearsalId=rehearsal-memory-1',
            links: [],
            whyMatched: '预演线索命中当前场景',
            whyRelevant: ['人物：Priya Shah', '项目：Falcon', '线索：customer review'],
            matchedAnchors: {
              people: ['Priya Shah'],
              projects: ['Falcon'],
              topics: ['customer review'],
            },
            reasonType: 'prospective_cue',
            evidenceRole: 'rehearsal_cue',
            metadata: {
              rehearsal: {
                id: 'rehearsal-memory-1',
                activationId: 'activation-memory-lens-1',
                scenarioType: 'customer_review',
                status: 'active',
              },
              matchedCues: {
                people: ['Priya Shah'],
                projects: ['Falcon'],
                keywords: ['customer review'],
              },
            },
            timestamp: Math.floor(Date.now() / 1000),
          };
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              matches: [rehearsalMatch],
              topMatch: rehearsalMatch,
              queryTimeMs: 3,
            }),
          );
          return;
        }
        if (typeof body.url === 'string' && body.url.includes('/raw-title-summary')) {
          const rawTitleMatch = {
            id: 'web-memory-raw-title',
            type: 'message',
            score: 0.94,
            displayPriority: 'p1',
            title: '@Esone Qiu wrote:',
            uiSummary: '@Esone Qiu wrote:',
            snippet: '3. 行动指南 (Action Plan)',
            sourceLabel: 'glip',
            sourceTitle: 'Falcon Launch Room',
            exploreLink: '#/timeline?focus=web-memory-raw-title',
            links: [],
            whyMatched: '关键词命中 Falcon handoff',
            whyRelevant: ['项目：Falcon', '主题：owner handoff'],
            matchedAnchors: {
              projects: ['Falcon'],
              topics: ['owner handoff'],
            },
            reasonType: 'keyword_overlap',
            evidenceRole: 'action_item',
            metadata: {
              summary: 'Sophia confirmed Falcon launch ownership and asked Esone to review the handoff before Friday.',
              actions: [
                {
                  assignee: 'Esone Qiu',
                  description: 'Review Falcon handoff checklist',
                  deadline: 'Friday',
                },
              ],
              contextMessages: [
                {
                  content: '@Esone Qiu wrote: 3. 行动指南 (Action Plan)',
                },
              ],
            },
            timestamp: Math.floor(Date.now() / 1000),
          };
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              matches: [rawTitleMatch],
              topMatch: rawTitleMatch,
              queryTimeMs: 3,
            }),
          );
          return;
        }
        if (typeof body.url === 'string' && body.url.includes('/source-url-only')) {
          const sourceUrlOnlyMatch = {
            id: 'source-memory:web-memory-source-url-only',
            type: 'source_memory',
            score: 0.9,
            displayPriority: 'p1',
            title: 'Falcon source-only handoff note',
            uiSummary: 'The source URL is present even though links[] is empty.',
            snippet: 'Source-only Falcon note records the migration owner handoff.',
            sourceLabel: 'source_memory',
            sourceUrl: 'https://source-only.example.com/falcon/handoff?ticket=PAI-123',
            sourceTitle: 'Falcon source-only evidence',
            exploreLink: '#/timeline?focus=web-memory-source-url-only',
            links: [],
            whyMatched: '来源 URL 命中 Falcon handoff',
            whyRelevant: ['项目：Falcon', '主题：owner handoff'],
            matchedAnchors: {
              projects: ['Falcon'],
              topics: ['owner handoff'],
            },
            reasonType: 'source_match',
            evidenceRole: 'artifact',
            metadata: {
              sourceMemoryCapsuleId: 'web-memory-source-url-only',
              sourceKind: 'webpage',
              captureMode: 'manual',
              groupId: 'source-memory-feedback-group',
              sender: 'Source Memory Owner',
            },
            timestamp: Math.floor(Date.now() / 1000),
          };
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              matches: [sourceUrlOnlyMatch],
              topMatch: sourceUrlOnlyMatch,
              queryTimeMs: 3,
            }),
          );
          return;
        }
        if (typeof body.url === 'string' && body.url.includes('/feedback-failure')) {
          const feedbackFailureMatch = {
            id: 'web-memory-feedback-failure',
            type: 'message',
            score: 0.91,
            displayPriority: 'p1',
            title: 'Falcon feedback failure fixture',
            uiSummary: 'This card verifies failed feedback writes are disclosed to the user.',
            snippet: 'Feedback failures should not look like successfully stored learning signals.',
            sourceLabel: 'glip',
            sourceTitle: 'Falcon feedback room',
            sourceUrl: 'https://source.example.com/falcon/feedback-failure',
            exploreLink: '#/timeline?focus=web-memory-feedback-failure',
            links: [],
            whyMatched: '关键词命中 Falcon feedback',
            whyRelevant: ['项目：Falcon', '主题：feedback failure'],
            matchedAnchors: {
              projects: ['Falcon'],
              topics: ['feedback failure'],
            },
            reasonType: 'keyword_overlap',
            evidenceRole: 'supporting',
            timestamp: Math.floor(Date.now() / 1000),
          };
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              matches: [feedbackFailureMatch],
              topMatch: feedbackFailureMatch,
              queryTimeMs: 3,
            }),
          );
          return;
        }
        if (
          typeof body.url === 'string' &&
          (body.url.includes('/possible-related') || body.url.includes('/possible-no-why'))
        ) {
          const possibleMatch = {
            id: 'web-memory-possible',
            type: 'message',
            score: 0.72,
            displayPriority: 'p2',
            title: 'Falcon migration follow-up',
            uiSummary: 'Falcon migration has a related follow-up note, but the page only overlaps on the project context.',
            snippet: 'Falcon migration follow-up note from the release coordination channel.',
            sourceLabel: 'glip',
            sourceTitle: 'Falcon release room',
            exploreLink: '#/timeline?focus=web-memory-possible',
            links: [],
            whyMatched: '项目上下文弱匹配',
            whyRelevant: body.url.includes('/possible-no-why') ? [] : ['项目：Falcon'],
            matchedAnchors: {
              projects: ['Falcon'],
            },
            reasonType: 'semantic_match',
            evidenceRole: 'supporting',
            timestamp: Math.floor(Date.now() / 1000),
          };
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              matches: [possibleMatch],
              topMatch: possibleMatch,
              queryTimeMs: 3,
            }),
          );
          return;
        }
        if (
          typeof body.url === 'string' &&
          body.url.includes('/selection-delayed-sensitive')
        ) {
          if (body.contextType !== 'selected_text') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(
              JSON.stringify({
                matches: [],
                topMatch: null,
                queryTimeMs: 2,
              }),
            );
            return;
          }
          await delay(900);
        }
        if (typeof body.url === 'string' && body.url.includes('/dynamic-sensitive')) {
          await delay(900);
        }
        const unsafeRouteCase =
          typeof body.url === 'string' && body.url.includes('/unsafe-route');
        const selectedTextCase = body.contextType === 'selected_text';
        if (selectedTextCase && /codex/i.test(String(body.primaryText || ''))) {
          const codexNoiseMatch = {
            id: 'web-memory-codex-noise',
            type: 'message',
            score: 0.96,
            displayPriority: 'p1',
            title: 'Patricia Li asked whether to skip the period number change',
            uiSummary: 'This memory is about period numbering and should not match a Codex renewal selection.',
            snippet: 'Patricia Li replied about skipping period numbering edits.',
            sourceLabel: 'glip',
            links: [],
            whyMatched: '主题命中 Codex',
            whyRelevant: ['主题：Codex'],
            matchedAnchors: {
              topics: ['Codex'],
            },
            reasonType: 'keyword_overlap',
            evidenceRole: 'supporting',
            timestamp: Math.floor(Date.now() / 1000),
          };
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              matches: [codexNoiseMatch],
              topMatch: codexNoiseMatch,
              queryTimeMs: 3,
            }),
          );
          return;
        }
        const primaryMatch = {
          id: 'web-memory-1',
          type: 'message',
          score: 0.92,
          displayPriority: 'p1',
          title: unsafeRouteCase
            ? 'Falcon "unsafe" launch <review>'
            : selectedTextCase
              ? 'Selected text Falcon owner handoff'
              : 'Falcon launch readiness',
          uiSummary: selectedTextCase
            ? 'Selected text recall found the Falcon owner handoff checklist.'
            : 'Falcon launch readiness is linked to the owner handoff checklist.',
          snippet: 'Previously saved notes mention the Falcon launch checklist and owner handoff.',
          sourceLabel: 'Web memory',
          sourceUrl: 'https://source.example.com/falcon',
          sourceTitle: 'Falcon notes',
          exploreLink: unsafeRouteCase
            ? '#/timeline?focus=web-memory-1" onclick="window.__paiInjected=1'
            : '#/timeline?focus=web-memory-1',
          links: [
            { label: 'Open source', url: 'https://source.example.com/falcon' },
            {
              label: 'Quoted "label"',
              url: 'https://source.example.com/falcon?quote=%22',
            },
            { label: 'Unsafe source', url: 'javascript:alert(1)' },
          ],
          whyMatched: selectedTextCase
            ? '选中文本命中 owner handoff'
            : '关键词命中网页上下文',
          whyRelevant: ['项目：Falcon', '主题：owner handoff'],
          matchedAnchors: {
            projects: ['Falcon'],
            topics: ['owner handoff'],
          },
          reasonType: 'keyword_overlap',
          evidenceRole: 'supporting',
          metadata: { fixture: 'webpage-memory-detection' },
          mergedCount: 2,
          mergedIds: ['web-memory-1', 'web-memory-2'],
          sourceClusterKey: 'falcon-launch',
          sourceContext: 'Falcon launch readiness cluster',
          timestamp: Math.floor(Date.now() / 1000),
        };
        const hiddenMatch = {
          ...primaryMatch,
          id: 'web-memory-hidden',
          score: 0.99,
          displayPriority: 'hidden',
          title: 'Hidden Falcon match',
          uiSummary: 'Hidden memory should not be displayed.',
          snippet: 'Hidden memory should not be displayed.',
          exploreLink: '#/timeline?focus=web-memory-hidden',
        };
        const secondaryMatch = {
          ...primaryMatch,
          id: 'web-memory-secondary',
          score: 0.78,
          displayPriority: 'p1',
          title: 'Secondary Falcon match',
          uiSummary: 'Secondary memory should lose to p1 priority.',
          snippet: 'Secondary memory should lose to p1 priority.',
          exploreLink: '#/timeline?focus=web-memory-secondary',
        };
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            matches: [hiddenMatch, secondaryMatch, primaryMatch],
            topMatch: hiddenMatch,
            queryTimeMs: 4,
          }),
        );
        return;
      }

      if (
        req.method === 'POST' &&
        req.url === '/api/v1/rehearsals/rehearsal-memory-1/feedback'
      ) {
        const rawBody = await readRequestBody(req);
        const body = rawBody ? JSON.parse(rawBody) : {};
        rehearsalFeedbackRequests.push(body);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            rehearsal: {
              id: 'rehearsal-memory-1',
              status: body.outcome === 'irrelevant' ? 'dismissed' : 'active',
            },
            activation: {
              id: body.activationId,
              outcome: body.outcome,
            },
          }),
        );
        return;
      }

      if (req.method === 'POST' && req.url === '/api/v1/feedback') {
        const rawBody = await readRequestBody(req);
        const body = rawBody ? JSON.parse(rawBody) : {};
        feedbackRequests.push(body);
        if (body.targetId === 'web-memory-feedback-failure') {
          res.writeHead(503, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'fixture_feedback_write_failed',
            }),
          );
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'ok',
            targetType: body.targetType,
            appliedDelta: body.action === 'negative' ? -0.15 : 0.1,
          }),
        );
        return;
      }

      if (
        req.method === 'POST' &&
        (req.url === '/api/v1/source-memory/candidates/selection' ||
          req.url === '/api/v1/source-memory/candidates/score')
      ) {
        const rawBody = await readRequestBody(req);
        const body = rawBody ? JSON.parse(rawBody) : {};
        sourceMemoryCandidateRequests.push({ endpoint: req.url, body });
        const text = String(body.selectedText || body.text || '');
        const eligible =
          text.length >= 28 &&
          !/api[_\s-]?key|secret|password|token/i.test(text);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            eligible,
            score: eligible ? 0.64 : 0,
            suggestedAction: eligible ? 'suggest' : 'ignore',
            reasons: eligible ? ['用户选中了文本', '文本片段足够完整'] : ['文本信息量不足'],
            captureMode: 'suggested',
          }),
        );
        return;
      }

      if (req.method === 'POST' && req.url === '/api/v1/source-memory/capsules') {
        const rawBody = await readRequestBody(req);
        const body = rawBody ? JSON.parse(rawBody) : {};
        sourceMemoryCreateRequests.push(body);
        const id = `source-memory-capsule-${sourceMemoryCreateRequests.length}`;
        const sourceKind = body.sourceKind || (body.selectedText ? 'selection' : 'webpage');
        const preview = String(body.selectedText || body.text || '').slice(0, 240);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            capsule: {
              id,
              sourceKind,
              sourceUrl: body.sourceUrl,
              sourceTitle: body.sourceTitle || 'Source memory',
              sourceHost: '127.0.0.1',
              captureMode: body.captureMode || 'manual',
              captureReason: body.captureReason || '用户点击选区旁的 + 记住',
              status: 'saved',
              scope: body.scope || 'work',
              privacyLevel: body.privacyLevel || 'work',
              summary: body.note || preview,
              contentPreview: preview,
              messageId: `source-memory-message-${sourceMemoryCreateRequests.length}`,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              savedAt: Date.now(),
              duplicate: false,
              anchors: [
                {
                  id: `${id}-anchor`,
                  anchorKind: sourceKind === 'selection' ? 'text_selection' : 'page_excerpt',
                  locator: body.sourceUrl,
                  quoteOrPreview: preview,
                  sensitivity: 'normal',
                  confidence: 0.78,
                },
              ],
              takeaways: [],
              triggers: [],
            },
          }),
        );
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/rehearsal-lens')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Falcon customer review with Priya</title></head>
            <body>
              <main>
                Falcon customer review prep with Priya Shah covers escalation
                ownership, launch risk, support handoff, customer confidence,
                and the next review checkpoint.
              </main>
            </body>
          </html>`);
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/normal')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Falcon readiness notes</title></head>
            <body>
              <section>
                Falcon launch readiness notes cover alpha rollout dates, owner handoff,
                migration checkpoints, release confidence, dependency status, customer
                communication, and follow-up review material for the team.
              </section>
            </body>
          </html>`);
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/raw-title-summary')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Falcon handoff follow-up</title></head>
            <body>
              <section>
                Falcon launch owner handoff is ready for review. Sophia asked Esone
                to confirm the checklist, deadline, and ownership before Friday.
              </section>
            </body>
          </html>`);
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/source-url-only')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Falcon source URL provenance</title></head>
            <body>
              <section>
                Falcon source URL provenance should stay visible even when the
                recall payload only carries sourceUrl and does not repeat it in links.
              </section>
            </body>
          </html>`);
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/feedback-failure')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Falcon feedback failure disclosure</title></head>
            <body>
              <section>
                Falcon feedback failure disclosure should keep the user informed
                when a relevance vote only hides locally and cannot reach memory-service.
              </section>
            </body>
          </html>`);
        return;
      }

      if (
        req.method === 'GET' &&
        (req.url?.startsWith('/possible-related') || req.url?.startsWith('/possible-no-why'))
      ) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Falcon possible match context</title></head>
            <body>
              <section>
                Falcon project context mentions the migration release, but the current
                page does not include enough anchors for a strong memory interruption.
              </section>
            </body>
          </html>`);
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/credential-selection')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Credential selection guard</title></head>
            <body>
              <section id="credential-section">
                api_key = sk-proj-1234567890abcdefghijklmnop
              </section>
            </body>
          </html>`);
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/selected-no-match')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Selected text empty recall</title></head>
            <body>
              <section id="selected-empty-section">
                Unmatched launch phrase with enough words to be eligible but no related memories.
              </section>
            </body>
          </html>`);
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/selected-codex-noise')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Codex renewal rumor</title></head>
            <body>
              <section id="selected-codex-noise-section">
                听说codex续约好了，以后每人每个月300万，是这样吗？
              </section>
            </body>
          </html>`);
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/selection-delayed-sensitive')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Delayed selected text recall</title></head>
            <body>
              <section id="delayed-selection-section">
                Falcon launch readiness owner handoff depends on the migration
                checklist, release confidence, customer communication, and
                follow-up review material.
              </section>
            </body>
          </html>`);
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/empty-meeting')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>RingCentral Video</title></head>
            <body>
              <main>
                <h1>You're the only one here</h1>
                <button>Invite others</button>
                <nav>BRB Unmute Start video Share Invite Participants Chat React Raise hand Notes More Leave</nav>
              </main>
            </body>
          </html>`);
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/browse/PAI-123')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>PAI-123 Falcon Jira issue</title></head>
            <body>
              <main>
                <h1 id="summary-val">Falcon launch readiness follow-up</h1>
                <span id="key-val">PAI-123</span>
                <span id="status-val">In Review</span>
                <section id="description-val">
                  Jira issue description covers Falcon owner handoff, launch
                  dependencies, release confidence, customer communication,
                  QA verification, and follow-up review material.
                </section>
              </main>
            </body>
          </html>`);
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/unsafe-route')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Falcon unsafe route notes</title></head>
            <body>
              <main>
                Falcon launch readiness notes exercise unsafe memory route handling,
                quoted source labels, link sanitization, launch checklist ownership,
                migration checkpoints, customer communication, and follow-up review
                material for the team.
              </main>
            </body>
          </html>`);
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/post-bubble-sensitive')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Falcon sensitive after bubble</title></head>
            <body>
              <main>
                Falcon launch readiness notes cover alpha rollout dates, owner handoff,
                migration checkpoints, release confidence, dependency status, customer
                communication, and follow-up review material for the team.
              </main>
              <label>
                Search project notes
                <input id="sensitive-after-bubble" type="text" name="project-search" />
              </label>
            </body>
          </html>`);
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/dynamic-sensitive')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Falcon sensitive transition</title></head>
            <body>
              <main>
                Falcon launch readiness notes cover alpha rollout dates, owner handoff,
                migration checkpoints, release confidence, dependency status, customer
                communication, and follow-up review material for the team.
              </main>
            </body>
          </html>`);
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/login')) {
        if (req.url?.startsWith('/login-delayed')) {
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          res.end(`<!doctype html>
            <html>
              <head><title>Account login loading</title></head>
              <body>
                <section>
                  Account login is preparing a secure session before rendering the
                  password form. This page intentionally has enough visible text to
                  look like normal content until the sign in controls load.
                </section>
              </body>
            </html>`);
          return;
        }

        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Account login</title></head>
            <body>
              <form>
                <label>Password <input type="password" autocomplete="current-password" /></label>
                <button>Sign in</button>
              </form>
            </body>
          </html>`);
        return;
      }

      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(error instanceof Error ? error.message : String(error));
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    apiBaseUrl: `http://127.0.0.1:${port}/api/v1`,
    contextRecallRequests,
    feedbackRequests,
    rehearsalFeedbackRequests,
    sourceMemoryCandidateRequests,
    sourceMemoryCreateRequests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function launchExtensionContext(apiBaseUrl) {
  await fs.access(path.join(extensionPath, 'manifest.json'));
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'webpage-memory-extension-'),
  );
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', {
      timeout: 15000,
    });
  }
  const extensionId = new URL(serviceWorker.url()).host;

  const config = {
    MEMORY_SERVICE_BASE_URL: apiBaseUrl,
    MEMORY_SERVICE_API_KEY: '',
    MEMORY_SERVICE_TIMEOUT: 5000,
  };

  await serviceWorker.evaluate(
    async ({
      envConfig,
      muteStorageKey,
      blockStorageKey,
      pageBlockKey,
      allowStorageKey,
      allowlistModeKey,
    }) => {
      await chrome.storage.local.set({
        envConfig,
        userinfo: { username: 'webpage-memory-e2e' },
        [muteStorageKey]: {},
        [blockStorageKey]: {},
        [pageBlockKey]: {},
        [allowStorageKey]: {},
        [allowlistModeKey]: false,
      });
    },
    {
      envConfig: config,
      muteStorageKey: siteMuteStorageKey,
      blockStorageKey: siteBlockStorageKey,
      pageBlockKey: pageBlockStorageKey,
      allowStorageKey: siteAllowStorageKey,
      allowlistModeKey: siteAllowlistModeStorageKey,
    },
  );

  const configPage = await context.newPage();
  await configPage.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  const updateResponse = await configPage.evaluate(
    async (envConfig) =>
      new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'UPDATE_ENV_CONFIG', config: envConfig },
          (response) => resolve(response),
        );
      }),
    config,
  );
  log(`UPDATE_ENV_CONFIG response: ${JSON.stringify(updateResponse)}`);
  await configPage.close();

  return { context, extensionId, serviceWorker };
}

async function verifyRehearsalLensPresentation(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'rehearsal-lens');
  const startCount = server.contextRecallRequests.length;
  const startFeedbackCount = server.feedbackRequests.length;
  const startRehearsalFeedbackCount = server.rehearsalFeedbackRequests.length;
  await page.goto(`${server.origin}/rehearsal-lens`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  try {
    await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  } catch (error) {
    log(
      `rehearsal lens bubble wait failed; context-recall requests=${server.contextRecallRequests.length - startCount}`,
    );
    for (const entry of diagnostics.slice(-20)) {
      log(entry);
    }
    throw error;
  }

  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    'Rehearsal Lens 页面应触发一次被动召回',
  );
  assert.ok(
    server.contextRecallRequests[startCount].sourceTypes?.includes('rehearsal'),
    'Memory Lens 请求应允许 rehearsal source type',
  );

  await page.locator('.pai-context-bubble').hover();
  await page.waitForSelector('.pai-context-peek.pai-context-peek--visible', {
    timeout: 5000,
  });
  const peekText = await page.locator('.pai-context-peek').innerText();
  assert.match(peekText, /Memory Lens/);
  assert.match(peekText, /预演提醒/);
  assert.match(peekText, /线索：customer review/);
  assert.match(peekText, /Next Falcon customer review/);

  await page.locator('.pai-context-bubble').click();
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  const cardText = await page.locator('.pai-context-card').innerText();
  assert.match(cardText, /为什么此刻相关/);
  assert.match(cardText, /预演内容/);
  assert.match(cardText, /我能做什么/);
  assert.match(cardText, /线索/);
  assert.match(cardText, /Before the Falcon customer review/);
  assert.doesNotMatch(
    cardText,
    /它说了什么/,
    'Rehearsal 卡片不应继续使用普通事实记忆标题',
  );
  assert.equal(
    await page.locator('.pai-context-recall-positive').getAttribute('aria-label'),
    '标记这条预演提醒有用',
    'Rehearsal 正向反馈应有专门的可访问名称',
  );

  const exploreHref = await page.locator('.pai-context-open-memory').getAttribute('href');
  assert.ok(
    exploreHref?.includes('memory-exploring.html#/rehearsals?rehearsalId=rehearsal-memory-1'),
    `Rehearsal 记忆跳转应指向 Rehearsal 管理页: ${exploreHref}`,
  );

  await page.locator('.pai-context-recall-positive').click();
  const feedbackDeadline = Date.now() + 5000;
  while (
    server.rehearsalFeedbackRequests.length < startRehearsalFeedbackCount + 1 &&
    Date.now() < feedbackDeadline
  ) {
    await delay(50);
  }
  assert.equal(
    server.rehearsalFeedbackRequests.length,
    startRehearsalFeedbackCount + 1,
    'Rehearsal 正向反馈应调用 /rehearsals/:id/feedback',
  );
  const rehearsalFeedback = server.rehearsalFeedbackRequests.at(-1);
  assert.equal(rehearsalFeedback.outcome, 'accepted');
  assert.equal(rehearsalFeedback.activationId, 'activation-memory-lens-1');
  const rehearsalFeedbackDetail = parseFeedbackDetail(rehearsalFeedback.note);
  assert.equal(rehearsalFeedbackDetail.surface, 'web_passive_bubble');
  assert.equal(rehearsalFeedbackDetail.host, '127.0.0.1');
  assert.equal(rehearsalFeedbackDetail.target_type, 'rehearsal');
  assert.equal(
    server.feedbackRequests.length,
    startFeedbackCount,
    'Rehearsal 反馈不应误写普通 recall_quality /feedback',
  );

  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('Rehearsal Lens 页面出现脚本异常');
  }
  await page.close();
}

async function verifyNormalPage(server, context, serviceWorker, extensionId) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 340, height: 720 });
  const diagnostics = attachPageDiagnostics(page, 'normal');
  const startCount = server.contextRecallRequests.length;
  const startFeedbackCount = server.feedbackRequests.length;
  await page.goto(
    `${server.origin}/normal?utm_source=newsletter&b=2&a=1&fbclid=tracker#private-anchor`,
    {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    },
  );

  try {
    await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  } catch (error) {
    log(
      `normal bubble wait failed; context-recall requests=${server.contextRecallRequests.length - startCount}`,
    );
    for (const entry of diagnostics.slice(-20)) {
      log(entry);
    }
    throw error;
  }
  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    '普通网页应触发一次被动召回',
  );
  assert.equal(
    server.contextRecallRequests[startCount].surface,
    'web_passive',
    '召回 surface 不正确',
  );
  assert.equal(
    server.contextRecallRequests[startCount].contextType,
    'webpage',
    '普通网页应以 webpage contextType 召回',
  );
  assert.equal(
    server.contextRecallRequests[startCount].limit,
    3,
    '网页 ambient bubble 应请求 3 条候选供前端按优先级选择',
  );
  assert.ok(
    server.contextRecallRequests[startCount].sourceTypes?.includes('web'),
    '普通网页应透传 sourceTypes 以约束召回来源',
  );
  assert.equal(
    server.contextRecallRequests[startCount].url,
    `${server.origin}/normal?a=1&b=2`,
    '被动召回请求应剔除追踪参数和 hash，并稳定排序保留参数',
  );

  const bubble = page.locator('.pai-context-bubble');
  await bubble.hover();
  await page.waitForSelector('.pai-context-peek.pai-context-peek--visible', {
    timeout: 5000,
  });
  const peekText = await page.locator('.pai-context-peek').innerText();
  assert.match(peekText, /Memory Lens/);
  assert.match(peekText, /强相关/);
  assert.match(peekText, /因为/);
  assert.match(peekText, /Falcon launch readiness/);
  assert.match(peekText, /Falcon launch readiness is linked to the owner handoff checklist\./);
  assert.match(peekText, /关键词匹配/);
  assert.doesNotMatch(peekText, /\b\d{1,3}%\b/);
  assert.doesNotMatch(peekText, /这条有用/);
  await page.mouse.move(4, 4);
  await page.waitForFunction(
    () => !document.querySelector('.pai-context-peek--visible'),
    { timeout: 5000 },
  );
  await bubble.focus();
  await page.waitForSelector('.pai-context-peek.pai-context-peek--visible', {
    timeout: 5000,
  });
  await page.keyboard.press('Enter');
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  const cardBox = await page.locator('.pai-context-card').boundingBox();
  assert.ok(cardBox, '记忆卡片应该有可见布局盒');
  assert.ok(cardBox.x >= 0, '窄屏下记忆卡片不应超出左边界');
  assert.ok(
    cardBox.x + cardBox.width <= 340,
    '窄屏下记忆卡片不应超出右边界',
  );
  const controlledCardId = await bubble.getAttribute('aria-controls');
  assert.ok(controlledCardId, 'bubble 应声明 aria-controls');
  assert.equal(
    await page.locator(`#${controlledCardId}`).count(),
    1,
    'aria-controls 应指向记忆卡片',
  );
  await page.keyboard.press('Tab');
  assert.equal(
    await page.evaluate(() =>
      Boolean(document.activeElement?.closest('.pai-context-card')),
    ),
    true,
    '打开记忆卡片后 Tab 应进入卡片操作区',
  );
  await page.keyboard.press('Escape');
  await page.waitForSelector('.pai-context-card', {
    state: 'hidden',
    timeout: 5000,
  });

  await bubble.click();
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });

  const cardText = await page.locator('.pai-context-card').innerText();
  assert.match(cardText, /Memory Lens/);
  assert.match(cardText, /为什么相关/);
  assert.match(cardText, /它说了什么/);
  assert.match(cardText, /我应该做什么/);
  assert.match(cardText, /Falcon launch readiness is linked to the owner handoff checklist\./);
  assert.match(cardText, /证据/);
  assert.match(cardText, /Previously saved notes mention the Falcon launch checklist and owner handoff\./);
  assert.doesNotMatch(cardText, /Hidden memory should not be displayed/);
  assert.doesNotMatch(cardText, /Secondary memory should lose to p1 priority/);
  assert.match(cardText, /Falcon notes/);
  assert.match(cardText, /关键词匹配/);
  assert.doesNotMatch(cardText, /记忆类型：/);
  assert.doesNotMatch(cardText, /匹配原因：/);
  assert.doesNotMatch(cardText, /证据角色：/);
  assert.doesNotMatch(cardText, /来源上下文：/);
  assert.doesNotMatch(cardText, /keyword_overlap/);
  assert.doesNotMatch(cardText, /supporting/);
  assert.doesNotMatch(cardText, /允许此站点/);
  assert.doesNotMatch(cardText, /此网站今天不提示/);
  assert.doesNotMatch(cardText, /此页面永久不提示/);
  assert.doesNotMatch(cardText, /\b\d{1,3}%\b/);
  assert.equal(
    await page.evaluate(() => {
      const scroll = document.querySelector('.pai-context-card-scroll');
      const footer = document.querySelector('.pai-context-footer');
      const pager = document.querySelector('.pai-context-pager');
      return Boolean(scroll && footer && pager && !scroll.contains(footer) && !scroll.contains(pager));
    }),
    true,
    '翻页和反馈 footer 应固定在滚动正文外，避免长文本时需要滚到底部才能翻页',
  );
  assert.equal(await page.locator('.pai-context-pager').isVisible(), true);
  const evidenceMetrics = await page.evaluate(() => {
    const block = document.querySelector('.pai-context-evidence-block');
    const label = document.querySelector('.pai-context-evidence-label');
    const text = document.querySelector('.pai-context-evidence-text');
    if (!block || !label || !text) return null;
    const blockRect = block.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const textRect = text.getBoundingClientRect();
    return {
      height: blockRect.height,
      labelToTextGap: textRect.top - labelRect.bottom,
    };
  });
  assert.ok(evidenceMetrics, '证据区域应渲染为紧凑的 block');
  assert.ok(
    evidenceMetrics.height < 120,
    `证据区域不应因为模板空白变成大面板，当前高度 ${evidenceMetrics.height}`,
  );
  assert.ok(
    evidenceMetrics.labelToTextGap < 12,
    `证据标题和正文之间不应有大块空白，当前间距 ${evidenceMetrics.labelToTextGap}`,
  );
  assert.equal(
    await page.locator('.pai-context-recall-positive').getAttribute('aria-label'),
    '标记这条记忆提示有用',
    '正向反馈应保留为轻量图标按钮并提供可访问名称',
  );
  await page.locator('.pai-context-next').click();
  assert.match(
    await page.locator('.pai-context-card').innerText(),
    /Secondary Falcon match/,
    '固定底部翻页按钮应能切换到下一条记忆',
  );
  await page.locator('.pai-context-prev').click();
  const visibleLinks = await page.$$eval('.pai-context-card a', (anchors) =>
    anchors.map((anchor) => ({
      text: anchor.textContent || '',
      href: anchor.href,
    })),
  );
  const visibleHrefs = visibleLinks.map((link) => link.href);
  const visibleExploreLink = visibleLinks.find((link) => link.text.includes('在记忆中查看'));
  assert.ok(visibleExploreLink, `缺少记忆探索跳转: ${JSON.stringify(visibleLinks)}`);
  assert.ok(
    visibleExploreLink.href.includes('memory-exploring.html'),
    `记忆探索跳转应指向扩展内 memory-exploring 页面: ${visibleExploreLink.href}`,
  );
  assert.ok(
    visibleHrefs.includes('https://source.example.com/falcon'),
    '缺少安全来源链接',
  );
  assert.equal(
    visibleHrefs.some((href) => href.startsWith('javascript:')),
    false,
    '不应渲染 javascript: 来源链接',
  );

  await openContextMoreMenu(page);
  const menuText = await page.locator('.pai-context-more-menu:not([hidden])').innerText();
  assert.match(menuText, /开启白名单并允许此站点/);
  assert.match(menuText, /此网站今天不提示/);
  assert.match(menuText, /此页面永久不提示/);
  assert.match(menuText, /永久不提示此站点/);
  await page.locator('.pai-context-site-allow').click();
  await page.waitForSelector('.pai-context-toast', {
    state: 'visible',
    timeout: 5000,
  });
  assert.match(
    await page.locator('.pai-context-toast').innerText(),
    /已开启白名单并允许此网站/,
  );
  const storedAllowShortcut = await serviceWorker.evaluate(
    async ({ allowStorageKey, allowlistModeKey }) =>
      chrome.storage.local.get([allowStorageKey, allowlistModeKey]),
    {
      allowStorageKey: siteAllowStorageKey,
      allowlistModeKey: siteAllowlistModeStorageKey,
    },
  );
  assert.equal(
    storedAllowShortcut[siteAllowlistModeStorageKey],
    true,
    '卡片快捷允许站点应开启白名单模式',
  );
  assert.equal(
    typeof storedAllowShortcut[siteAllowStorageKey]?.['127.0.0.1'],
    'number',
    '卡片快捷允许站点应写入当前 host',
  );
  await page
    .getByRole('button', { name: '撤销此站点白名单快捷设置' })
    .click();
  await page.waitForSelector('.pai-context-toast', {
    state: 'visible',
    timeout: 5000,
  });
  assert.match(
    await page.locator('.pai-context-toast').innerText(),
    /已恢复白名单设置/,
  );
  const restoredAllowShortcut = await serviceWorker.evaluate(
    async ({ allowStorageKey, allowlistModeKey }) =>
      chrome.storage.local.get([allowStorageKey, allowlistModeKey]),
    {
      allowStorageKey: siteAllowStorageKey,
      allowlistModeKey: siteAllowlistModeStorageKey,
    },
  );
  assert.equal(
    restoredAllowShortcut[siteAllowlistModeStorageKey],
    false,
    '撤销卡片快捷允许站点后应恢复白名单模式开关',
  );
  assert.equal(
    restoredAllowShortcut[siteAllowStorageKey]?.['127.0.0.1'],
    undefined,
    '撤销卡片快捷允许站点后应移除当前 host',
  );
  await page.waitForSelector('.pai-context-bubble', { timeout: 5000 });
  if ((await page.locator('.pai-context-card:visible').count()) === 0) {
    await page.locator('.pai-context-bubble').click();
    await page.waitForSelector('.pai-context-card', {
      state: 'visible',
      timeout: 5000,
    });
  }

  await page.locator('.pai-context-recall-positive').click();
  await waitForRequestCount(
    { contextRecallRequests: server.feedbackRequests },
    startFeedbackCount + 1,
    5000,
  );
  assert.deepEqual(
    {
      type: server.feedbackRequests[startFeedbackCount].type,
      targetId: server.feedbackRequests[startFeedbackCount].targetId,
      targetType: server.feedbackRequests[startFeedbackCount].targetType,
      action: server.feedbackRequests[startFeedbackCount].action,
    },
    {
      type: 'recall_quality',
      targetId: 'web-memory-1',
      targetType: 'message',
      action: 'positive',
    },
  );
  const positiveFeedbackDetail = parseFeedbackDetail(
    server.feedbackRequests[startFeedbackCount].detail,
  );
  assert.equal(positiveFeedbackDetail.surface, 'web_passive_bubble');
  assert.equal(positiveFeedbackDetail.host, '127.0.0.1');
  assert.equal(positiveFeedbackDetail.target_type, 'message');
  assert.equal(
    await page.locator('.pai-context-recall-positive').getAttribute('aria-label'),
    '已标记有用',
    '标记有用后应立即给出按钮状态反馈',
  );
  assert.equal(
    await page.locator('.pai-context-recall-positive').isDisabled(),
    true,
    '标记有用后应锁定正向反馈按钮，避免重复提交',
  );
  assert.equal(
    await page.locator('.pai-context-recall-negative').isDisabled(),
    true,
    '标记有用后应锁定反向反馈按钮，避免提交矛盾反馈',
  );
  await page
    .locator('.pai-context-recall-negative')
    .evaluate((button) => button.click());
  await page.waitForTimeout(300);
  assert.equal(
    server.feedbackRequests.length,
    startFeedbackCount + 1,
    '锁定后的反向反馈按钮不应再提交第二条反馈',
  );

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(1200);
  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    'Personal AI 浮层不应污染 body-only 网页的下一次上下文 key',
  );

  await openContextMoreMenu(page);
  await page.locator('.pai-context-site-mute').click();
  await page.waitForSelector('.pai-context-toast', {
    state: 'visible',
    timeout: 5000,
  });
  const toastText = await page.locator('.pai-context-toast').innerText();
  assert.match(toastText, /已暂停此网站记忆提示 24 小时/);
  await page.waitForFunction(
    () => !document.querySelector('.pai-context-bubble'),
    { timeout: 5000 },
  );
  const storedMutes = await serviceWorker.evaluate(
    async (storageKey) => chrome.storage.local.get(storageKey),
    siteMuteStorageKey,
  );
  assert.equal(
    typeof storedMutes[siteMuteStorageKey]?.['127.0.0.1'],
    'number',
    '站点静默状态未写入 extension storage',
  );

  const mutedPage = await context.newPage();
  const mutedDiagnostics = attachPageDiagnostics(mutedPage, 'muted');
  const mutedStartCount = server.contextRecallRequests.length;
  await mutedPage.goto(`${server.origin}/normal?muted=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await mutedPage.waitForTimeout(3500);
  assert.equal(
    server.contextRecallRequests.length,
    mutedStartCount,
    '已静默站点重载后不应在 storage 加载前触发被动召回',
  );
  assert.equal(
    await mutedPage.locator('.pai-context-bubble').count(),
    0,
    '已静默站点重载后不应显示记忆提示',
  );
  if (mutedDiagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of mutedDiagnostics) {
      log(entry);
    }
    throw new Error('已静默站点页面出现脚本异常');
  }

  await mutedPage.close();

  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await optionsPage.waitForFunction(
    () => {
      const text = document.body?.innerText || '';
      return text.includes('网页记忆提示控制') || text.includes('管理被动网页记忆提示');
    },
    { timeout: 5000 },
  );
  await optionsPage.waitForSelector('text=127.0.0.1', { timeout: 5000 });
  await optionsPage.getByRole('button', { name: '恢复', exact: true }).click();
  await optionsPage.waitForSelector('text=当前没有被临时静默的网站', {
    timeout: 5000,
  });
  await optionsPage.close();

  const unmutedPage = await context.newPage();
  const unmutedStartCount = server.contextRecallRequests.length;
  await unmutedPage.goto(`${server.origin}/normal?unmuted=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await waitForRequestCount(server, unmutedStartCount + 1, 12000);
  assert.equal(
    server.contextRecallRequests.length,
    unmutedStartCount + 1,
    '从设置页恢复站点后应重新触发被动召回',
  );
  await unmutedPage.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  await unmutedPage.locator('.pai-context-bubble').click();
  await unmutedPage.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  assert.match(
    await unmutedPage.locator('.pai-context-card').innerText(),
    /我应该做什么/,
  );
  await openContextMoreMenu(unmutedPage);
  assert.match(
    await unmutedPage.locator('.pai-context-more-menu:not([hidden])').innerText(),
    /永久不提示此站点/,
  );
  await unmutedPage.locator('.pai-context-site-block').click();
  await unmutedPage.waitForSelector('.pai-context-toast', {
    state: 'visible',
    timeout: 5000,
  });
  assert.match(
    await unmutedPage.locator('.pai-context-toast').innerText(),
    /已永久关闭此网站记忆提示/,
  );
  await unmutedPage.waitForFunction(
    () => !document.querySelector('.pai-context-bubble'),
    { timeout: 5000 },
  );
  const storedBlocks = await serviceWorker.evaluate(
    async (storageKey) => chrome.storage.local.get(storageKey),
    siteBlockStorageKey,
  );
  assert.equal(
    typeof storedBlocks[siteBlockStorageKey]?.['127.0.0.1'],
    'number',
    '永久屏蔽状态未写入 extension storage',
  );
  await unmutedPage.close();

  const blockedPage = await context.newPage();
  const blockedStartCount = server.contextRecallRequests.length;
  await blockedPage.goto(`${server.origin}/normal?blocked=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await blockedPage.waitForTimeout(3500);
  assert.equal(
    server.contextRecallRequests.length,
    blockedStartCount,
    '永久屏蔽站点不应触发被动召回',
  );
  assert.equal(
    await blockedPage.locator('.pai-context-bubble').count(),
    0,
    '永久屏蔽站点不应显示记忆提示',
  );
  await blockedPage.close();

  const blockedOptionsPage = await context.newPage();
  await blockedOptionsPage.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await blockedOptionsPage.waitForSelector('text=永久屏蔽', { timeout: 5000 });
  await blockedOptionsPage.waitForSelector('text=127.0.0.1', { timeout: 5000 });
  await blockedOptionsPage.getByRole('button', { name: '恢复', exact: true }).click();
  await blockedOptionsPage.waitForSelector('text=当前没有被永久屏蔽的网站', {
    timeout: 5000,
  });
  await blockedOptionsPage.close();

  const restoredPage = await context.newPage();
  const restoredStartCount = server.contextRecallRequests.length;
  await restoredPage.goto(`${server.origin}/normal?restored=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await waitForRequestCount(server, restoredStartCount + 1, 12000);
  assert.equal(
    server.contextRecallRequests.length,
    restoredStartCount + 1,
    '从设置页恢复永久屏蔽后应重新触发被动召回',
  );
  await restoredPage.close();
  await page.close();
}

async function verifyPossibleHoverPeek(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'possible-related');
  const startCount = server.contextRecallRequests.length;
  await page.goto(`${server.origin}/possible-related`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  try {
    await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  } catch (error) {
    log(
      `possible-related bubble wait failed; context-recall requests=${server.contextRecallRequests.length - startCount}`,
    );
    for (const entry of diagnostics.slice(-20)) {
      log(entry);
    }
    throw error;
  }

  const bubble = page.locator('.pai-context-bubble');
  assert.equal(
    await bubble.evaluate((element) => element.classList.contains('pai-context-bubble--fresh')),
    false,
    '可能相关 p2 不应使用强相关 fresh 动效',
  );
  await bubble.hover();
  await page.waitForSelector('.pai-context-peek.pai-context-peek--visible', {
    timeout: 5000,
  });
  const peekText = await page.locator('.pai-context-peek').innerText();
  assert.match(peekText, /Memory Lens/);
  assert.match(peekText, /可能相关/);
  assert.match(peekText, /项目：Falcon/);
  assert.match(peekText, /Falcon migration follow-up/);
  assert.doesNotMatch(peekText, /\b\d{1,3}%\b/);

  await bubble.click();
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  const cardText = await page.locator('.pai-context-card').innerText();
  assert.match(cardText, /可能相关/);
  assert.match(cardText, /为什么相关/);
  assert.match(cardText, /Falcon migration has a related follow-up note/);

  const requestsBeforeHashRefresh = server.contextRecallRequests.length;
  await page.evaluate(() => {
    window.location.hash = '#same-page-refresh';
  });
  await page.waitForFunction(
    () => !document.querySelector('.pai-context-bubble'),
    { timeout: 5000 },
  );
  await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  assert.equal(
    server.contextRecallRequests.length,
    requestsBeforeHashRefresh,
    '同页 hash 刷新后应复用缓存的可能相关结果，不应重新请求召回',
  );
  assert.equal(
    await page.locator('.pai-context-bubble').evaluate((element) =>
      element.classList.contains('pai-context-bubble--fresh'),
    ),
    false,
    '缓存恢复的 p2 可能相关不应升级成强相关 fresh 动效',
  );
  await page.close();

  const noWhyPage = await context.newPage();
  const noWhyDiagnostics = attachPageDiagnostics(noWhyPage, 'possible-no-why');
  const noWhyStartCount = server.contextRecallRequests.length;
  await noWhyPage.goto(`${server.origin}/possible-no-why`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await noWhyPage.waitForTimeout(3500);
  assert.equal(
    server.contextRecallRequests.length,
    noWhyStartCount + 1,
    '缺少 whyRelevant 的 p2 仍应完成召回请求以供前端过滤',
  );
  assert.equal(
    await noWhyPage.locator('.pai-context-bubble').count(),
    0,
    '缺少可解释锚点的 p2 不应展示 Hover Peek 入口',
  );
  if (noWhyDiagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of noWhyDiagnostics) {
      log(entry);
    }
    throw new Error('possible-no-why 页面出现脚本异常');
  }
  await noWhyPage.close();

  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('possible-related 页面出现脚本异常');
  }
}

async function verifyMetadataSummaryPresentation(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'metadata-summary');
  const startCount = server.contextRecallRequests.length;
  await page.goto(`${server.origin}/raw-title-summary`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  try {
    await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  } catch (error) {
    log(
      `metadata summary bubble wait failed; context-recall requests=${server.contextRecallRequests.length - startCount}`,
    );
    for (const entry of diagnostics.slice(-20)) {
      log(entry);
    }
    throw error;
  }

  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    'metadata summary 页面应触发一次被动召回',
  );

  const bubble = page.locator('.pai-context-bubble');
  await bubble.hover();
  await page.waitForSelector('.pai-context-peek.pai-context-peek--visible', {
    timeout: 5000,
  });
  const peekText = await page.locator('.pai-context-peek').innerText();
  assert.match(
    peekText,
    /Sophia confirmed Falcon launch ownership/,
    'Hover Peek 标题应优先使用 metadata.summary 的语义化描述',
  );
  assert.doesNotMatch(
    peekText,
    /@Esone Qiu wrote|3\. 行动指南/,
    'Hover Peek 不应把 raw message 前缀或结构编号当作首屏内容',
  );

  await bubble.click();
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  const cardText = await page.locator('.pai-context-card').innerText();
  assert.match(
    cardText,
    /Sophia confirmed Falcon launch ownership and asked Esone to review the handoff before Friday\./,
    'Expanded Card 应展示 metadata.summary 的完整摘要',
  );
  assert.match(
    cardText,
    /Esone Qiu · Review Falcon handoff checklist · Friday/,
    'Expanded Card 应优先把 metadata.actions 渲染为可执行证据',
  );
  assert.doesNotMatch(
    cardText,
    /@Esone Qiu wrote|3\. 行动指南/,
    'Expanded Card 标题和证据不应退回 raw snippet',
  );

  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('metadata summary 展示页面出现脚本异常');
  }
  await page.close();
}

async function verifySourceUrlOnlyProvenance(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'source-url-only');
  const startCount = server.contextRecallRequests.length;
  const startFeedbackCount = server.feedbackRequests.length;
  await page.goto(`${server.origin}/source-url-only`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  try {
    await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  } catch (error) {
    log(
      `source URL only bubble wait failed; context-recall requests=${server.contextRecallRequests.length - startCount}`,
    );
    for (const entry of diagnostics.slice(-20)) {
      log(entry);
    }
    throw error;
  }

  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    'sourceUrl-only 页面应触发一次被动召回',
  );
  await page.locator('.pai-context-bubble').click();
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });

  const visibleLinks = await page.$$eval('.pai-context-card a', (anchors) =>
    anchors.map((anchor) => ({
      text: anchor.textContent || '',
      href: anchor.href,
    })),
  );
  assert.ok(
    visibleLinks.some(
      (link) =>
        link.text.includes('Falcon source-only evidence') &&
        link.href === 'https://source-only.example.com/falcon/handoff?ticket=PAI-123',
    ),
    `sourceUrl 应在 Expanded Card 中作为可点击来源展示: ${JSON.stringify(visibleLinks)}`,
  );
  assert.equal(
    visibleLinks.filter((link) => link.href.includes('source-only.example.com')).length,
    1,
    'sourceUrl-only 来源链接不应重复渲染',
  );

  await page.locator('.pai-context-recall-positive').click();
  await waitForRequestCount(
    { contextRecallRequests: server.feedbackRequests },
    startFeedbackCount + 1,
    5000,
  );
  const feedback = server.feedbackRequests[startFeedbackCount];
  assert.equal(feedback.type, 'recall_quality');
  assert.equal(feedback.targetType, 'source_memory');
  assert.equal(feedback.targetId, 'web-memory-source-url-only');
  assert.equal(feedback.action, 'positive');
  const feedbackDetail = parseFeedbackDetail(feedback.detail);
  assert.equal(feedbackDetail.surface, 'web_passive_bubble');
  assert.equal(feedbackDetail.host, '127.0.0.1');
  assert.equal(feedbackDetail.target_type, 'source_memory');
  assert.equal(feedbackDetail.source_memory_capsule_id, 'web-memory-source-url-only');
  assert.equal(feedbackDetail.group_id, 'source-memory-feedback-group');
  assert.equal(feedbackDetail.sender, 'Source Memory Owner');
  assert.match(
    feedbackDetail.scene_anchor_signature,
    /web_passive|source-url-only/,
    'source memory 反馈应携带当前场景锚点，便于后续降权',
  );

  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('sourceUrl-only 来源展示页面出现脚本异常');
  }
  await page.close();
}

async function verifyAllowlistMode(server, context, serviceWorker, extensionId) {
  await serviceWorker.evaluate(
    async ({ allowStorageKey, allowlistModeKey }) => {
      await chrome.storage.local.set({
        [allowStorageKey]: {},
        [allowlistModeKey]: true,
      });
    },
    {
      allowStorageKey: siteAllowStorageKey,
      allowlistModeKey: siteAllowlistModeStorageKey,
    },
  );

  const blockedPage = await context.newPage();
  const blockedStartCount = server.contextRecallRequests.length;
  await blockedPage.goto(`${server.origin}/normal?allowlist=blocked`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await blockedPage.waitForTimeout(3500);
  assert.equal(
    server.contextRecallRequests.length,
    blockedStartCount,
    '白名单模式开启且站点未允许时不应触发被动召回',
  );
  assert.equal(
    await blockedPage.locator('.pai-context-bubble').count(),
    0,
    '白名单模式开启且站点未允许时不应显示记忆提示',
  );
  await blockedPage.close();

  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await optionsPage.waitForSelector('text=允许站点白名单', {
    timeout: 5000,
  });
  await optionsPage.getByLabel('添加允许站点').fill('127.0.0.1');
  await optionsPage.getByRole('button', { name: '允许', exact: true }).click();
  await optionsPage.waitForSelector('text=已允许 127.0.0.1 显示网页记忆提示', {
    timeout: 5000,
  });
  await optionsPage.waitForSelector('text=允许站点 · 添加于', {
    timeout: 5000,
  });

  const storedAllowedSites = await serviceWorker.evaluate(
    async (storageKey) => chrome.storage.local.get(storageKey),
    siteAllowStorageKey,
  );
  assert.equal(
    typeof storedAllowedSites[siteAllowStorageKey]?.['127.0.0.1'],
    'number',
    '允许站点未写入 extension storage',
  );

  const allowedPage = await context.newPage();
  const allowedStartCount = server.contextRecallRequests.length;
  await allowedPage.goto(`${server.origin}/normal?allowlist=allowed`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await waitForRequestCount(server, allowedStartCount + 1, 12000);
  assert.equal(
    server.contextRecallRequests.length,
    allowedStartCount + 1,
    '白名单模式下已允许站点应触发被动召回',
  );
  await allowedPage.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  await allowedPage.close();

  await optionsPage
    .getByRole('button', { name: '移除允许站点 127.0.0.1' })
    .click();
  await optionsPage.waitForSelector('text=当前没有允许站点', {
    timeout: 5000,
  });
  await optionsPage.close();

  const removedPage = await context.newPage();
  const removedStartCount = server.contextRecallRequests.length;
  await removedPage.goto(`${server.origin}/normal?allowlist=removed`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await removedPage.waitForTimeout(3500);
  assert.equal(
    server.contextRecallRequests.length,
    removedStartCount,
    '允许站点移除后白名单模式应再次阻止被动召回',
  );
  await removedPage.close();

  await serviceWorker.evaluate(
    async ({ allowStorageKey, allowlistModeKey }) => {
      await chrome.storage.local.set({
        [allowStorageKey]: {},
        [allowlistModeKey]: false,
      });
    },
    {
      allowStorageKey: siteAllowStorageKey,
      allowlistModeKey: siteAllowlistModeStorageKey,
    },
  );
}

async function verifyAllowSiteClearsCoveredControls(
  server,
  context,
  serviceWorker,
  extensionId,
) {
  await serviceWorker.evaluate(
    async ({
      muteStorageKey,
      blockStorageKey,
      allowStorageKey,
      allowlistModeKey,
    }) => {
      await chrome.storage.local.set({
        [muteStorageKey]: { 'lvh.me': Date.now() },
        [blockStorageKey]: { 'lvh.me': Date.now() },
        [allowStorageKey]: {},
        [allowlistModeKey]: true,
      });
    },
    {
      muteStorageKey: siteMuteStorageKey,
      blockStorageKey: siteBlockStorageKey,
      allowStorageKey: siteAllowStorageKey,
      allowlistModeKey: siteAllowlistModeStorageKey,
    },
  );

  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await optionsPage.waitForSelector('text=lvh.me', { timeout: 5000 });
  await optionsPage.getByLabel('添加允许站点').fill('docs.lvh.me');
  await optionsPage.getByRole('button', { name: '允许', exact: true }).click();
  await optionsPage.waitForSelector(
    'text=已允许 docs.lvh.me 显示网页记忆提示，并移除 2 条覆盖它的静默/屏蔽规则',
    { timeout: 5000 },
  );
  await optionsPage.close();

  const stored = await serviceWorker.evaluate(
    async ({ muteStorageKey, blockStorageKey, allowStorageKey }) =>
      chrome.storage.local.get([muteStorageKey, blockStorageKey, allowStorageKey]),
    {
      muteStorageKey: siteMuteStorageKey,
      blockStorageKey: siteBlockStorageKey,
      allowStorageKey: siteAllowStorageKey,
    },
  );
  assert.equal(
    stored[siteMuteStorageKey]?.['lvh.me'],
    undefined,
    '允许子域名时应移除覆盖它的父域临时静默',
  );
  assert.equal(
    stored[siteBlockStorageKey]?.['lvh.me'],
    undefined,
    '允许子域名时应移除覆盖它的父域永久屏蔽',
  );
  assert.equal(
    typeof stored[siteAllowStorageKey]?.['docs.lvh.me'],
    'number',
    '允许子域名应写入 allowlist storage',
  );

  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'allow-conflict-resolution');
  const startCount = server.contextRecallRequests.length;
  await page.goto(
    `${server.origin.replace('127.0.0.1', 'docs.lvh.me')}/normal?allow-conflict=resolved`,
    {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    },
  );
  await waitForRequestCount(server, startCount + 1, 12000);
  await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    '允许子域名后不应继续被父域静默/屏蔽规则压住',
  );
  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('允许站点冲突消解页面出现脚本异常');
  }
  await page.close();

  await serviceWorker.evaluate(
    async ({ muteStorageKey, blockStorageKey, allowStorageKey, allowlistModeKey }) => {
      await chrome.storage.local.set({
        [muteStorageKey]: {},
        [blockStorageKey]: {},
        [allowStorageKey]: {},
        [allowlistModeKey]: false,
      });
    },
    {
      muteStorageKey: siteMuteStorageKey,
      blockStorageKey: siteBlockStorageKey,
      allowStorageKey: siteAllowStorageKey,
      allowlistModeKey: siteAllowlistModeStorageKey,
    },
  );
}

async function verifyLiveSiteControlStorageSync(server, context, serviceWorker) {
  await serviceWorker.evaluate(
    async ({
      muteStorageKey,
      blockStorageKey,
      pageBlockKey,
      allowStorageKey,
      allowlistModeKey,
    }) => {
      await chrome.storage.local.set({
        [muteStorageKey]: {},
        [blockStorageKey]: {},
        [pageBlockKey]: {},
        [allowStorageKey]: {},
        [allowlistModeKey]: false,
      });
    },
    {
      muteStorageKey: siteMuteStorageKey,
      blockStorageKey: siteBlockStorageKey,
      pageBlockKey: pageBlockStorageKey,
      allowStorageKey: siteAllowStorageKey,
      allowlistModeKey: siteAllowlistModeStorageKey,
    },
  );

  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'live-site-controls');
  const startCount = server.contextRecallRequests.length;
  await page.goto(`${server.origin}/normal?live-controls=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await waitForRequestCount(server, startCount + 1, 12000);
  await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });

  await serviceWorker.evaluate(
    async ({ blockStorageKey }) => {
      await chrome.storage.local.set({
        [blockStorageKey]: { '127.0.0.1': Date.now() },
      });
    },
    { blockStorageKey: siteBlockStorageKey },
  );
  await page.waitForFunction(
    () =>
      !document.querySelector('.pai-context-bubble') &&
      !document.querySelector('.pai-context-card'),
    { timeout: 5000 },
  );

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(900);
  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    '已打开页面收到站点屏蔽 storage 更新后不应继续被动召回',
  );

  await serviceWorker.evaluate(
    async ({ blockStorageKey }) => {
      await chrome.storage.local.set({ [blockStorageKey]: {} });
    },
    { blockStorageKey: siteBlockStorageKey },
  );
  await page.waitForSelector('.pai-context-bubble', { timeout: 5000 });

  await serviceWorker.evaluate(
    async ({ allowStorageKey, allowlistModeKey }) => {
      await chrome.storage.local.set({
        [allowStorageKey]: {},
        [allowlistModeKey]: true,
      });
    },
    {
      allowStorageKey: siteAllowStorageKey,
      allowlistModeKey: siteAllowlistModeStorageKey,
    },
  );
  await page.waitForFunction(
    () =>
      !document.querySelector('.pai-context-bubble') &&
      !document.querySelector('.pai-context-card'),
    { timeout: 5000 },
  );

  await serviceWorker.evaluate(
    async ({ allowStorageKey }) => {
      await chrome.storage.local.set({
        [allowStorageKey]: { '127.0.0.1': Date.now() },
      });
    },
    { allowStorageKey: siteAllowStorageKey },
  );
  await page.waitForSelector('.pai-context-bubble', { timeout: 5000 });

  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('实时站点控制同步页面出现脚本异常');
  }
  await page.close();

  await serviceWorker.evaluate(
    async ({ allowStorageKey, allowlistModeKey }) => {
      await chrome.storage.local.set({
        [allowStorageKey]: {},
        [allowlistModeKey]: false,
      });
    },
    {
      allowStorageKey: siteAllowStorageKey,
      allowlistModeKey: siteAllowlistModeStorageKey,
    },
  );
}

async function verifyPagePathBlock(server, context, serviceWorker, extensionId) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'page-path-block');
  const startCount = server.contextRecallRequests.length;
  const targetUrl = `${server.origin}/normal/path-block?source=first`;
  await page.goto(targetUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  try {
    await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  } catch (error) {
    log(
      `page path block bubble wait failed; context-recall requests=${server.contextRecallRequests.length - startCount}`,
    );
    for (const entry of diagnostics.slice(-20)) {
      log(entry);
    }
    throw error;
  }

  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    '路径屏蔽前应先触发一次被动召回',
  );
  await page.locator('.pai-context-bubble').click();
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  await openContextMoreMenu(page);
  await page.locator('.pai-context-page-block').click();
  await page.waitForSelector('.pai-context-toast', {
    state: 'visible',
    timeout: 5000,
  });
  assert.match(
    await page.locator('.pai-context-toast').innerText(),
    /已永久关闭此页面路径记忆提示/,
  );
  const blockedPrefix = `${server.origin}/normal/path-block`;
  const storedPageBlocks = await serviceWorker.evaluate(
    async (storageKey) => chrome.storage.local.get(storageKey),
    pageBlockStorageKey,
  );
  assert.equal(
    typeof storedPageBlocks[pageBlockStorageKey]?.[blockedPrefix],
    'number',
    '页面路径屏蔽状态未写入 extension storage',
  );
  await page
    .getByRole('button', { name: '撤销此页面路径不提示' })
    .click();
  await page.waitForSelector('.pai-context-toast', {
    state: 'visible',
    timeout: 5000,
  });
  assert.match(
    await page.locator('.pai-context-toast').innerText(),
    /已恢复此页面路径记忆提示/,
  );
  await page.waitForSelector('.pai-context-bubble', { timeout: 5000 });
  const restoredPageBlocks = await serviceWorker.evaluate(
    async (storageKey) => chrome.storage.local.get(storageKey),
    pageBlockStorageKey,
  );
  assert.equal(
    restoredPageBlocks[pageBlockStorageKey]?.[blockedPrefix],
    undefined,
    '撤销后页面路径屏蔽状态应从 extension storage 移除',
  );

  await page.locator('.pai-context-bubble').click();
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  await openContextMoreMenu(page);
  await page.locator('.pai-context-page-block').click();
  await page.waitForSelector('.pai-context-toast', {
    state: 'visible',
    timeout: 5000,
  });
  assert.match(
    await page.locator('.pai-context-toast').innerText(),
    /已永久关闭此页面路径记忆提示/,
  );
  await page.close();

  const blockedChildPage = await context.newPage();
  const blockedStartCount = server.contextRecallRequests.length;
  await blockedChildPage.goto(`${blockedPrefix}/child?source=blocked`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await blockedChildPage.waitForTimeout(3500);
  assert.equal(
    server.contextRecallRequests.length,
    blockedStartCount,
    '已屏蔽页面路径及其子路径不应触发被动召回',
  );
  assert.equal(
    await blockedChildPage.locator('.pai-context-bubble').count(),
    0,
    '已屏蔽页面路径及其子路径不应显示记忆提示',
  );
  await blockedChildPage.close();

  const siblingPage = await context.newPage();
  const siblingStartCount = server.contextRecallRequests.length;
  await siblingPage.goto(`${server.origin}/normal-other?source=sibling`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await waitForRequestCount(server, siblingStartCount + 1, 12000);
  assert.equal(
    server.contextRecallRequests.length,
    siblingStartCount + 1,
    '同域其他路径不应被页面路径屏蔽误伤',
  );
  await siblingPage.close();

  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await optionsPage.waitForSelector('text=永久屏蔽页面/路径', {
    timeout: 5000,
  });
  await optionsPage.waitForSelector(`text=${blockedPrefix}`, { timeout: 5000 });
  await optionsPage
    .getByRole('button', { name: `恢复页面路径 ${blockedPrefix}` })
    .click();
  await optionsPage.waitForSelector('text=当前没有被永久屏蔽的页面路径', {
    timeout: 5000,
  });
  await optionsPage.close();

  const restoredPage = await context.newPage();
  const restoredStartCount = server.contextRecallRequests.length;
  await restoredPage.goto(`${blockedPrefix}/child?source=restored`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await waitForRequestCount(server, restoredStartCount + 1, 12000);
  assert.equal(
    server.contextRecallRequests.length,
    restoredStartCount + 1,
    '从设置页恢复页面路径后应重新触发被动召回',
  );
  await restoredPage.close();
}

async function verifyIrrelevantFeedback(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'irrelevant-feedback');
  const startRecallCount = server.contextRecallRequests.length;
  const startFeedbackCount = server.feedbackRequests.length;
  await page.goto(`${server.origin}/normal?feedback=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  try {
    await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  } catch (error) {
    log(
      `irrelevant feedback bubble wait failed; context-recall requests=${server.contextRecallRequests.length - startRecallCount}`,
    );
    for (const entry of diagnostics.slice(-20)) {
      log(entry);
    }
    throw error;
  }

  await page.locator('.pai-context-bubble').click();
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  await chooseNegativeFeedbackReason(page, 'wrong_group_or_project');
  await page.waitForSelector('.pai-context-toast', {
    state: 'visible',
    timeout: 5000,
  });
  assert.match(
    await page.locator('.pai-context-toast').innerText(),
    /已记录为不相关/,
  );
  await page.waitForFunction(
    () =>
      !document.querySelector('.pai-context-bubble') &&
      !document.querySelector('.pai-context-card'),
    { timeout: 5000 },
  );
  await waitForRequestCount(
    { contextRecallRequests: server.feedbackRequests },
    startFeedbackCount + 1,
    5000,
  );
  assert.deepEqual(
    {
      type: server.feedbackRequests[startFeedbackCount].type,
      targetId: server.feedbackRequests[startFeedbackCount].targetId,
      targetType: server.feedbackRequests[startFeedbackCount].targetType,
      action: server.feedbackRequests[startFeedbackCount].action,
    },
    {
      type: 'recall_quality',
      targetId: 'web-memory-1',
      targetType: 'message',
      action: 'negative',
    },
  );
  const negativeFeedbackDetail = parseFeedbackDetail(
    server.feedbackRequests[startFeedbackCount].detail,
  );
  assert.equal(negativeFeedbackDetail.surface, 'web_passive_bubble');
  assert.equal(negativeFeedbackDetail.host, '127.0.0.1');
  assert.equal(negativeFeedbackDetail.target_type, 'message');
  assert.equal(negativeFeedbackDetail.interaction, 'memory_relevance_trainer');
  assert.equal(negativeFeedbackDetail.feedback_reason, 'wrong_group_or_project');
  assert.equal(negativeFeedbackDetail.auto_applied, 'true');

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(1200);
  assert.equal(
    server.contextRecallRequests.length,
    startRecallCount + 1,
    '标记不相关后，同一上下文不应立刻重复触发召回',
  );
  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('不相关反馈页面出现脚本异常');
  }
  await page.close();
}

async function verifyFeedbackDrawerMobileSheet(server, context) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 720 });
  const diagnostics = attachPageDiagnostics(page, 'feedback-mobile-sheet');
  const startFeedbackCount = server.feedbackRequests.length;
  await page.goto(`${server.origin}/normal?feedback=mobile`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  await page.locator('.pai-context-bubble').click();
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  await chooseNegativeFeedbackReason(page, 'empty_meeting_shell');
  await waitForRequestCount(
    { contextRecallRequests: server.feedbackRequests },
    startFeedbackCount + 1,
    5000,
  );

  const feedbackDetail = parseFeedbackDetail(
    server.feedbackRequests[startFeedbackCount].detail,
  );
  assert.equal(feedbackDetail.interaction, 'memory_relevance_trainer');
  assert.equal(feedbackDetail.feedback_reason, 'empty_meeting_shell');
  assert.equal(feedbackDetail.auto_applied, 'true');

  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('移动端反馈 bottom sheet 页面出现脚本异常');
  }
  await page.close();
}

async function verifyFeedbackFailureDisclosure(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'feedback-failure');
  const startRecallCount = server.contextRecallRequests.length;
  const startFeedbackCount = server.feedbackRequests.length;
  await page.goto(`${server.origin}/feedback-failure`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  try {
    await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  } catch (error) {
    log(
      `feedback failure bubble wait failed; context-recall requests=${server.contextRecallRequests.length - startRecallCount}`,
    );
    for (const entry of diagnostics.slice(-20)) {
      log(entry);
    }
    throw error;
  }

  await page.locator('.pai-context-bubble').click();
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  await chooseNegativeFeedbackReason(page, 'generic_topic_overlap');
  await waitForRequestCount(
    { contextRecallRequests: server.feedbackRequests },
    startFeedbackCount + 1,
    5000,
  );
  assert.equal(
    server.feedbackRequests[startFeedbackCount].targetId,
    'web-memory-feedback-failure',
    '失败夹具应先尝试写入真实 feedback endpoint',
  );
  const feedbackFailureDetail = parseFeedbackDetail(
    server.feedbackRequests[startFeedbackCount].detail,
  );
  assert.equal(feedbackFailureDetail.interaction, 'memory_relevance_trainer');
  assert.equal(feedbackFailureDetail.feedback_reason, 'generic_topic_overlap');
  assert.equal(feedbackFailureDetail.auto_applied, 'true');
  await page.waitForFunction(
    () =>
      /反馈记录失败，已仅在本页隐藏 30 分钟/.test(
        document.querySelector('.pai-context-toast')?.textContent || '',
      ),
    { timeout: 5000 },
  );
  assert.equal(
    await page.locator('.pai-context-bubble').count(),
    0,
    '反馈写入失败后仍应保持本地隐藏，避免继续打扰当前页面',
  );
  assert.equal(
    await page.locator('.pai-context-card').count(),
    0,
    '反馈写入失败后卡片应保持关闭，直到用户主动恢复',
  );

  await page
    .getByRole('button', { name: '重新显示这条记忆提示' })
    .click();
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  assert.match(
    await page.locator('.pai-context-card').innerText(),
    /Falcon feedback failure fixture/,
    '失败 toast 的恢复操作应重新打开刚才被本地隐藏的卡片',
  );
  assert.equal(
    await page.locator('.pai-context-recall-negative').isDisabled(),
    false,
    '恢复后的卡片反馈按钮不应被永久锁死',
  );

  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('反馈失败披露页面出现脚本异常');
  }
  await page.close();
}

async function verifySensitiveQueryPage(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'sensitive-query');
  const startCount = server.contextRecallRequests.length;
  await page.goto(`${server.origin}/normal?access_token=secret-token`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await page.waitForTimeout(3500);
  assert.equal(
    server.contextRecallRequests.length,
    startCount,
    '包含敏感查询参数的页面不应触发被动召回',
  );
  assert.equal(
    await page.locator('.pai-context-bubble').count(),
    0,
    '包含敏感查询参数的页面不应显示记忆提示',
  );
  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('敏感查询参数页面出现脚本异常');
  }
  await page.close();
}

async function verifyJiraIssueContext(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'jira-issue');
  const startCount = server.contextRecallRequests.length;
  await page.goto(`${server.origin}/browse/PAI-123?utm_source=tracker`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  try {
    await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  } catch (error) {
    log(
      `jira issue bubble wait failed; context-recall requests=${server.contextRecallRequests.length - startCount}`,
    );
    for (const entry of diagnostics.slice(-20)) {
      log(entry);
    }
    throw error;
  }

  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    'Jira issue 页面应触发一次被动召回',
  );
  const request = server.contextRecallRequests[startCount];
  assert.equal(request.surface, 'web_passive');
  assert.equal(
    request.contextType,
    'jira_issue',
    'Jira issue 页面应透传 jira_issue contextType',
  );
  assert.ok(
    request.sourceTypes?.includes('jira'),
    'Jira issue 页面应透传 Jira sourceTypes',
  );
  assert.ok(
    request.entityHints?.some(
      (hint) => hint.kind === 'jira_issue_key' && hint.value === 'PAI-123',
    ),
    'Jira issue 页面应透传 issue key entity hint',
  );
  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('Jira issue 页面出现脚本异常');
  }
  await page.close();
}

async function verifySelectedTextTrigger(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'selected-text');
  const startCount = server.contextRecallRequests.length;
  await page.goto(`${server.origin}/normal?selected-text=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  try {
    await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  } catch (error) {
    log(
      `selected text initial bubble wait failed; context-recall requests=${server.contextRecallRequests.length - startCount}`,
    );
    for (const entry of diagnostics.slice(-20)) {
      log(entry);
    }
    throw error;
  }

  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    '划词页面初始只应触发一次普通被动召回',
  );

  await page.evaluate(() => {
    const section = document.querySelector('section');
    if (!section?.firstChild) throw new Error('missing selectable section');
    const text = section.firstChild.textContent || '';
    const range = document.createRange();
    range.setStart(section.firstChild, text.indexOf('Falcon'));
    range.setEnd(
      section.firstChild,
      text.indexOf('owner handoff') + 'owner handoff'.length,
    );
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });

  await page.waitForSelector('.pai-context-selection-trigger', {
    timeout: 5000,
  });
  await waitForRequestCount(server, startCount + 2, 5000);
  assert.equal(
    server.contextRecallRequests.length,
    startCount + 2,
    '划词后应先静默触发 selected_text 召回，命中后才显示轻量 icon',
  );
  const selectedRequest = server.contextRecallRequests[startCount + 1];
  assert.equal(selectedRequest.contextType, 'selected_text');
  assert.match(selectedRequest.primaryText, /Falcon launch readiness/);
  assert.match(selectedRequest.primaryText, /owner handoff/);
  assert.doesNotMatch(
    selectedRequest.primaryText,
    /migration checkpoints/,
    'selected_text primaryText 只应包含用户选中文本，不应混入选区外背景',
  );
  assert.ok(
    Array.isArray(selectedRequest.secondaryTexts),
    'selected_text 请求应把页面标题和附近段落放入 secondaryTexts',
  );
  assert.ok(
    selectedRequest.secondaryTexts.some((item) => /Falcon readiness notes/.test(String(item))),
    'selected_text secondaryTexts 应包含页面标题作为 background context',
  );
  assert.ok(
    selectedRequest.secondaryTexts.some((item) => /migration checkpoints/.test(String(item))),
    'selected_text secondaryTexts 应包含选区附近文本作为 background context',
  );

  await page.evaluate(() => {
    const section = document.querySelector('section');
    if (!section?.firstChild) throw new Error('missing selectable section');
    const text = section.firstChild.textContent || '';
    const range = document.createRange();
    range.setStart(section.firstChild, text.indexOf('customer'));
    range.setEnd(
      section.firstChild,
      text.indexOf('communication') + 'communication'.length,
    );
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await page.waitForFunction(
    () => !document.querySelector('.pai-context-selection-trigger'),
    { timeout: 1000 },
  );
  await waitForRequestCount(server, startCount + 3, 5000);
  await page.waitForTimeout(240);
  assert.equal(
    await page.locator('.pai-context-selection-trigger').count(),
    0,
    '选中新文本时应立即清掉上一条划词 icon，并重新请求后只在新选区强命中时显示',
  );

  await page.evaluate(() => {
    const section = document.querySelector('section');
    if (!section?.firstChild) throw new Error('missing selectable section');
    const text = section.firstChild.textContent || '';
    const range = document.createRange();
    range.setStart(section.firstChild, text.indexOf('Falcon'));
    range.setEnd(
      section.firstChild,
      text.indexOf('owner handoff') + 'owner handoff'.length,
    );
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await page.waitForSelector('.pai-context-selection-trigger', {
    timeout: 5000,
  });
  await waitForRequestCount(server, startCount + 4, 5000);
  assert.equal(
    server.contextRecallRequests.length,
    startCount + 4,
    '重新选择同一段文本也应重新发起 selected_text 召回，而不是复用上次划词缓存',
  );

  await page.locator('.pai-context-selection-recall').click();
  await page.waitForTimeout(200);
  assert.equal(
    server.contextRecallRequests.length,
    startCount + 4,
    '点击划词 icon 应打开已命中的卡片，不应二次召回',
  );
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  assert.equal(
    await page.locator('.pai-context-bubble').count(),
    0,
    'Selection Memory Search 结果打开后不应再渲染右下角 Rest icon',
  );
  assert.equal(
    await page.locator('.pai-context-peek').count(),
    0,
    'Selection Memory Search 不应渲染 Hover Peek',
  );
  const selectionCardText = await page.locator('.pai-context-card').innerText();
  assert.match(selectionCardText, /划词记忆检索/);
  assert.doesNotMatch(
    selectionCardText,
    /Memory Lens/,
    '划词检索卡片不应继续使用页面级 Memory Lens 文案',
  );
  assert.match(selectionCardText, /选中的内容/);
  assert.match(selectionCardText, /找到的相关记忆/);
  assert.match(selectionCardText, /为什么匹配/);
  assert.match(selectionCardText, /匹配到/);
  assert.match(selectionCardText, /选中文本命中/);
  assert.match(
    selectionCardText,
    /Selected text Falcon owner handoff/,
    '点击划词入口后应展示 selected_text 命中的卡片',
  );
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
  });
  await page.waitForTimeout(700);
  assert.match(
    await page.locator('.pai-context-card').innerText(),
    /Selected text Falcon owner handoff/,
    '划词卡片打开后不应被页面 passive recall 立刻替换或清除',
  );
  assert.equal(
    await page.locator('.pai-context-selection-trigger').count(),
    0,
    '点击划词入口后轻量 icon 应消失',
  );
  await openContextMoreMenu(page);
  const selectionMenuText = await page.locator('.pai-context-more-menu').innerText();
  assert.match(
    selectionMenuText,
    /关闭本次划词结果/,
    '划词结果卡片应提供关闭本次主动查询的控制',
  );
  assert.doesNotMatch(
    selectionMenuText,
    /此网站今天不提示|永久不提示此站点|开启白名单|允许此站点|此页面永久不提示/,
    '划词结果卡片不应展示被动站点静默/屏蔽/白名单控制',
  );
  await page.locator('.pai-context-selection-close').click();
  await page.waitForSelector('.pai-context-card', { state: 'detached', timeout: 5000 });
  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('划词入口页面出现脚本异常');
  }
  await page.close();

  const emptyPage = await context.newPage();
  const emptyDiagnostics = attachPageDiagnostics(emptyPage, 'selected-text-empty');
  const emptyStartCount = server.contextRecallRequests.length;
  await emptyPage.goto(`${server.origin}/selected-no-match`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await emptyPage.waitForTimeout(2600);
  const emptyAfterInitialCount = server.contextRecallRequests.length;
  assert.ok(
    emptyAfterInitialCount <= emptyStartCount + 1,
    '无命中划词页面最多允许普通被动召回尝试',
  );
  await emptyPage.evaluate(() => {
    const section = document.querySelector('#selected-empty-section');
    if (!section?.firstChild) throw new Error('missing selected empty section');
    const range = document.createRange();
    range.selectNodeContents(section.firstChild);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await waitForRequestCount(server, emptyAfterInitialCount + 1, 5000);
  assert.equal(
    server.contextRecallRequests.at(-1)?.contextType,
    'selected_text',
    '无命中划词也应先完成 selected_text 匹配',
  );
  await emptyPage.waitForSelector('.pai-memory-capture-selection-dock', {
    timeout: 5000,
  });
  assert.equal(
    await emptyPage.locator('.pai-context-selection-recall').count(),
    0,
    'selected_text 没有高相关记忆时不应显示查记忆按钮',
  );
  assert.equal(
    await emptyPage.locator('.pai-memory-capture-selection-dock').count(),
    1,
    'selected_text 没有高相关记忆但有保存候选时应显示只保存的 + 入口',
  );
  const createStartCount = server.sourceMemoryCreateRequests.length;
  await emptyPage.locator('.pai-memory-capture-selection-dock').click();
  await emptyPage.waitForSelector('.pai-memory-capture-note-panel', {
    timeout: 5000,
  });
  assert.match(
    await emptyPage.locator('.pai-memory-capture-note-preview').innerText(),
    /Unmatched launch phrase/,
    '入库确认面板应显示选中文本预览',
  );
  await emptyPage.getByRole('button', { name: '取消' }).click();
  await emptyPage.waitForSelector('.pai-memory-capture-note-panel', {
    state: 'detached',
    timeout: 5000,
  });
  assert.equal(
    await emptyPage.locator('.pai-memory-capture-note-panel').count(),
    0,
    '取消后应关闭入库确认面板',
  );
  assert.equal(
    server.sourceMemoryCreateRequests.length,
    createStartCount,
    '用户取消入库确认面板时不应保存 source memory capsule',
  );
  assert.equal(
    await emptyPage.locator('.pai-memory-capture-selection-dock').count(),
    1,
    '取消保存后应保留 + 入口，方便用户再次确认',
  );

  await emptyPage.locator('.pai-memory-capture-selection-dock').click();
  await emptyPage.locator('.pai-memory-capture-note-input').fill('用于后续整理');
  await emptyPage.getByRole('button', { name: '保存' }).click();
  await waitForCapturedSourceMemoryCount(server, createStartCount + 1, 5000);
  const savedSourceMemory = server.sourceMemoryCreateRequests.at(-1);
  assert.equal(savedSourceMemory.sourceKind, 'selection');
  assert.equal(savedSourceMemory.note, '用于后续整理');
  assert.match(savedSourceMemory.selectedText, /Unmatched launch phrase/);
  assert.equal(savedSourceMemory.interactions?.manualClick, true);
  assert.equal(
    await emptyPage.locator('.pai-context-selection-trigger').count(),
    0,
    '确认保存后应清掉划词 + 入口',
  );
  await emptyPage.waitForFunction(
    () => /已保存为资料记忆/.test(document.querySelector('.pai-context-toast')?.textContent || ''),
    { timeout: 5000 },
  );
  assert.match(
    await emptyPage.locator('.pai-context-toast').innerText(),
    /已保存为资料记忆/,
    '确认保存后应给出保存成功回执',
  );
  const viewSavedSourceMemory = emptyPage.getByRole('button', {
    name: '查看资料记忆详情',
  });
  await viewSavedSourceMemory.waitFor({ timeout: 5000 });
  const [detailPage] = await Promise.all([
    context.waitForEvent('page', { timeout: 5000 }),
    viewSavedSourceMemory.click(),
  ]);
  await detailPage.waitForURL(/memory-exploring\.html#\/source-memory\/source-memory-capsule-\d+/, {
    timeout: 5000,
  });
  assert.match(
    detailPage.url(),
    /memory-exploring\.html#\/source-memory\/source-memory-capsule-\d+/,
    '保存成功 toast 应能直接打开资料记忆详情页',
  );
  await detailPage.close();
  if (emptyDiagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of emptyDiagnostics) {
      log(entry);
    }
    throw new Error('无命中划词页面出现脚本异常');
  }
  await emptyPage.close();

  const codexNoisePage = await context.newPage();
  const codexNoiseDiagnostics = attachPageDiagnostics(codexNoisePage, 'selected-text-codex-noise');
  const codexNoiseStartCount = server.contextRecallRequests.length;
  await codexNoisePage.goto(`${server.origin}/selected-codex-noise`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await codexNoisePage.waitForTimeout(2600);
  const codexNoiseAfterInitialCount = server.contextRecallRequests.length;
  assert.ok(
    codexNoiseAfterInitialCount <= codexNoiseStartCount + 1,
    'Codex 噪声划词页面最多允许普通被动召回尝试',
  );
  await codexNoisePage.evaluate(() => {
    const section = document.querySelector('#selected-codex-noise-section');
    if (!section?.firstChild) throw new Error('missing selected codex noise section');
    const text = section.firstChild.textContent || '';
    const range = document.createRange();
    range.setStart(section.firstChild, text.indexOf('听说codex续约好了'));
    range.setEnd(
      section.firstChild,
      text.indexOf('听说codex续约好了') + '听说codex续约好了'.length,
    );
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await waitForRequestCount(server, codexNoiseAfterInitialCount + 1, 5000);
  assert.equal(
    server.contextRecallRequests.at(-1)?.contextType,
    'selected_text',
    'Codex 噪声划词也应先完成 selected_text 匹配',
  );
  await codexNoisePage.waitForTimeout(800);
  assert.equal(
    await codexNoisePage.locator('.pai-context-selection-trigger').count(),
    0,
    '只有 Codex 泛主题命中的 p1 结果不应显示划词 icon',
  );
  if (codexNoiseDiagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of codexNoiseDiagnostics) {
      log(entry);
    }
    throw new Error('Codex 噪声划词页面出现脚本异常');
  }
  await codexNoisePage.close();
}

async function verifySelectedTextPrivacyAndUiBoundaries(server, context) {
  const cardPage = await context.newPage();
  const cardDiagnostics = attachPageDiagnostics(cardPage, 'selected-text-card-boundary');
  const cardStartCount = server.contextRecallRequests.length;
  await cardPage.goto(`${server.origin}/normal?selected-card-boundary=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await cardPage.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  await cardPage.locator('.pai-context-bubble').click();
  await cardPage.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  await cardPage.evaluate(() => {
    const card = document.querySelector('.pai-context-card');
    if (!card?.firstChild) throw new Error('missing Memory Lens card text');
    const range = document.createRange();
    range.selectNodeContents(card);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await cardPage.waitForTimeout(800);
  assert.equal(
    await cardPage.locator('.pai-context-selection-trigger').count(),
    0,
    '选中 Memory Lens 自己卡片里的文字不应再显示划词入口',
  );
  assert.equal(
    server.contextRecallRequests.length,
    cardStartCount + 1,
    '选中 Memory Lens 自己的 UI 不应额外触发 selected_text 召回',
  );
  if (cardDiagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of cardDiagnostics) {
      log(entry);
    }
    throw new Error('Memory Lens 卡片选区边界页面出现脚本异常');
  }
  await cardPage.close();

  const credentialPage = await context.newPage();
  const credentialDiagnostics = attachPageDiagnostics(credentialPage, 'selected-text-credential');
  const credentialStartCount = server.contextRecallRequests.length;
  await credentialPage.goto(`${server.origin}/credential-selection`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await credentialPage.waitForTimeout(2600);
  const credentialAfterInitialCount = server.contextRecallRequests.length;
  assert.ok(
    credentialAfterInitialCount <= credentialStartCount + 1,
    '凭据选区页面最多允许普通被动召回尝试',
  );
  await credentialPage.evaluate(() => {
    const section = document.querySelector('#credential-section');
    if (!section?.firstChild) throw new Error('missing credential section');
    const range = document.createRange();
    range.selectNodeContents(section.firstChild);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await credentialPage.waitForTimeout(800);
  assert.equal(
    await credentialPage.locator('.pai-context-selection-trigger').count(),
    0,
    '明显像 API key 的选区不应显示划词入口',
  );
  assert.equal(
    server.contextRecallRequests.length,
    credentialAfterInitialCount,
    '明显像 API key 的选区不应触发 selected_text 召回',
  );
  if (credentialDiagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of credentialDiagnostics) {
      log(entry);
    }
    throw new Error('凭据选区页面出现脚本异常');
  }
  await credentialPage.close();

  const sensitivePage = await context.newPage();
  const sensitiveDiagnostics = attachPageDiagnostics(sensitivePage, 'selected-text-sensitive-response');
  const sensitiveStartCount = server.contextRecallRequests.length;
  await sensitivePage.goto(`${server.origin}/selection-delayed-sensitive`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await sensitivePage.waitForTimeout(2600);
  const sensitiveAfterInitialCount = server.contextRecallRequests.length;
  assert.ok(
    sensitiveAfterInitialCount <= sensitiveStartCount + 1,
    '延迟响应页面最多允许普通被动召回尝试',
  );
  await sensitivePage.evaluate(() => {
    const section = document.querySelector('#delayed-selection-section');
    if (!section?.firstChild) throw new Error('missing delayed selection section');
    const text = section.firstChild.textContent || '';
    const range = document.createRange();
    range.setStart(section.firstChild, text.indexOf('Falcon'));
    range.setEnd(
      section.firstChild,
      text.indexOf('owner handoff') + 'owner handoff'.length,
    );
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await waitForRequestCount(server, sensitiveAfterInitialCount + 1, 5000);
  await sensitivePage.evaluate(() => {
    const input = document.createElement('input');
    input.type = 'password';
    input.autocomplete = 'current-password';
    document.body.appendChild(input);
  });
  await sensitivePage.waitForTimeout(1200);
  assert.equal(
    server.contextRecallRequests.at(-1)?.contextType,
    'selected_text',
    '延迟响应用例应在显示划词 icon 前真实发出 selected_text 请求',
  );
  assert.equal(
    await sensitivePage.locator('.pai-context-selection-trigger').count(),
    0,
    'selected_text 响应回来前页面变成敏感表单时不应显示划词 icon',
  );
  assert.equal(
    await sensitivePage.locator('.pai-context-card:visible').count(),
    0,
    'selected_text 响应回来前页面变成敏感表单时不应显示记忆卡片',
  );
  if (sensitiveDiagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of sensitiveDiagnostics) {
      log(entry);
    }
    throw new Error('selected_text 敏感响应拦截页面出现脚本异常');
  }
  await sensitivePage.close();
}

async function verifyEmptyMeetingDoesNotShowGenericLens(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'empty-meeting');
  const startCount = server.contextRecallRequests.length;
  await page.goto(`${server.origin}/empty-meeting`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await waitForRequestCount(server, startCount + 1, 12000);
  await page.waitForTimeout(800);
  assert.equal(
    await page.locator('.pai-context-bubble').count(),
    0,
    '空会议 shell 即使完成召回请求也不应显示泛用 Memory Lens',
  );
  assert.equal(
    await page.locator('.pai-context-peek').count(),
    0,
    '空会议 shell 不应显示 hover peek',
  );
  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('空会议页面出现脚本异常');
  }
  await page.close();
}

async function verifyRingCentralLensSuppressedByComposeAssist(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'ringcentral-compose-assist');
  const startCount = server.contextRecallRequests.length;
  await page.route(
    'https://app.ringcentral.com/l/messages/161955921926**',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html>
          <html>
            <head>
              <title>2026 Hackathon Project</title>
              <style>
                body { margin: 0; font-family: sans-serif; }
                main { padding: 32px; }
                .conversation-card-wrapper {
                  display: block;
                  width: 760px;
                  margin: 0 0 24px;
                  padding: 12px;
                }
                #message-chat-stream-wrapper { min-height: 420px; }
                #pai-composer-guard-root {
                  position: fixed;
                  right: 96px;
                  bottom: 34px;
                  width: 36px;
                  height: 36px;
                  z-index: 2147483646;
                }
                .pai-composer-guard-icon-button {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  width: 36px;
                  height: 36px;
                  border: 0;
                  border-radius: 999px;
                  background: #fff;
                }
              </style>
            </head>
            <body>
              <main>
                <h1>2026 Hackathon Project</h1>
                <div id="message-chat-stream-wrapper">
                  <article class="conversation-card-wrapper" data-id="msg-1" groupid="161955921926">
                    <strong>Esone Qiu</strong>
                    <p>Michael Lin 用自己的仿 cc 壳包一层，做个订阅式付费的产品。我们要报这个新的么</p>
                  </article>
                  <article class="conversation-card-wrapper" data-id="msg-2" groupid="161955921926">
                    <strong>Michael Lin</strong>
                    <p>你说上次做的 auto-code 吗？这个项目需要确认报名时间和后续计划。</p>
                  </article>
                  <article class="conversation-card-wrapper" data-id="msg-3" groupid="161955921926">
                    <strong>Esone Qiu</strong>
                    <p>我下午找你碰下，确认 hackathon registration 和 subscription product 的方案。</p>
                  </article>
                </div>
                <div class="ql-editor" contenteditable="true" data-placeholder="Message">时间</div>
              </main>
              <div id="pai-composer-guard-root" class="pai-composer-guard" role="group" aria-label="Personal AI composer guard">
                <button class="pai-composer-guard-icon-button" type="button" title="插入建议内容">
                  <span aria-hidden="true">AI</span>
                </button>
              </div>
            </body>
          </html>`,
      });
    },
  );

  await page.goto('https://app.ringcentral.com/l/messages/161955921926', {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await page.waitForTimeout(3800);
  assert.equal(
    server.contextRecallRequests.length,
    startCount,
    'RingCentral Glip 中 Compose Assist icon 可见时不应触发 Lens 被动召回',
  );
  assert.equal(
    await page.locator('.pai-context-bubble').count(),
    0,
    'RingCentral Glip 中 Compose Assist icon 可见时不应显示 Memory Lens 右下角 icon',
  );

  await page.evaluate(() => {
    document.getElementById('pai-composer-guard-root')?.remove();
  });
  await waitForRequestCount(server, startCount + 1, 12000);
  const request = server.contextRecallRequests[startCount];
  assert.equal(request.surface, 'follow_thread');
  assert.equal(request.contextType, 'message_thread');
  assert.equal(request.sourceContext?.groupId, '161955921926');
  assert.equal(request.exclude?.groupIds?.[0], '161955921926');
  await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('RingCentral Compose Assist 互斥页面出现脚本异常');
  }
  await page.close();
}

async function verifyUnsafeExploreRoute(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'unsafe-route');
  const startCount = server.contextRecallRequests.length;
  await page.goto(`${server.origin}/unsafe-route`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  try {
    await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  } catch (error) {
    log(
      `unsafe route bubble wait failed; context-recall requests=${server.contextRecallRequests.length - startCount}`,
    );
    for (const entry of diagnostics.slice(-20)) {
      log(entry);
    }
    throw error;
  }
  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    '带不安全 exploreLink 的网页仍应完成一次被动召回',
  );

  await page.locator('.pai-context-bubble').click();
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  const hrefs = await page.$$eval('.pai-context-card a', (anchors) =>
    anchors.map((anchor) => anchor.href),
  );
  assert.equal(
    hrefs.some((href) => href.includes('memory-exploring.html')),
    false,
    '不安全的 exploreLink 不应渲染为记忆探索链接',
  );
  assert.equal(
    await page.locator('.pai-context-card [onclick]').count(),
    0,
    '提示卡片不应被带引号的链接或路由注入 onclick 属性',
  );
  assert.ok(
    hrefs.includes('https://source.example.com/falcon?quote=%22'),
    '带引号查询值的安全来源链接应保留为 URL 编码形式',
  );
  assert.equal(
    await page.evaluate(() => window.__paiInjected),
    undefined,
    '不安全 exploreLink 不应执行注入脚本',
  );
  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('不安全 exploreLink 页面出现脚本异常');
  }
  await page.close();
}

async function verifyDisplayedBubbleClearsOnSensitiveAttributeChange(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'post-bubble-sensitive');
  const startCount = server.contextRecallRequests.length;
  await page.goto(`${server.origin}/post-bubble-sensitive`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  try {
    await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  } catch (error) {
    log(
      `post-bubble-sensitive bubble wait failed; context-recall requests=${server.contextRecallRequests.length - startCount}`,
    );
    for (const entry of diagnostics.slice(-20)) {
      log(entry);
    }
    throw error;
  }

  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    '敏感化前应先显示一次正常的被动召回提示',
  );

  await page.evaluate(() => {
    const input = document.querySelector('#sensitive-after-bubble');
    input?.setAttribute('type', 'password');
    input?.setAttribute('autocomplete', 'current-password');
  });

  await page.waitForFunction(
    () =>
      !document.querySelector('.pai-context-bubble') &&
      !document.querySelector('.pai-context-card'),
    { timeout: 5000 },
  );
  await page.waitForTimeout(800);
  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    '已显示提示的页面变成敏感表单后不应再追加被动召回',
  );
  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('提示后敏感化页面出现脚本异常');
  }
  await page.close();
}

async function verifySensitiveTransitionRace(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'sensitive-transition');
  const startCount = server.contextRecallRequests.length;
  await page.goto(`${server.origin}/dynamic-sensitive`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await waitForRequestCount(server, startCount + 1);
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.type = 'password';
    input.autocomplete = 'current-password';
    input.value = 'secret';
    document.body.appendChild(input);
  });

  let bubbleAppeared = false;
  try {
    await page.waitForSelector('.pai-context-bubble', { timeout: 1800 });
    bubbleAppeared = true;
  } catch (_error) {
    // Expected: the pending recall response is ignored after the page becomes sensitive.
  }
  assert.equal(
    bubbleAppeared,
    false,
    '页面在召回响应前变成敏感表单时不应显示记忆提示',
  );
  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    '敏感切换用例应先发出一次召回请求再被响应期隐私检查拦截',
  );
  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('敏感切换页面出现脚本异常');
  }
  await page.close();
}

async function verifySensitivePage(server, context) {
  const delayedPage = await context.newPage();
  const delayedDiagnostics = attachPageDiagnostics(delayedPage, 'sensitive-delayed');
  const delayedStartCount = server.contextRecallRequests.length;
  await delayedPage.goto(`${server.origin.replace('127.0.0.1', 'localhost')}/login-delayed`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await delayedPage.waitForTimeout(3500);
  assert.equal(
    server.contextRecallRequests.length,
    delayedStartCount,
    '敏感 URL 即使尚未渲染密码输入，也不应触发被动召回',
  );
  assert.equal(
    await delayedPage.locator('.pai-context-bubble').count(),
    0,
    '敏感 URL 尚未渲染表单时也不应显示记忆提示',
  );
  if (delayedDiagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of delayedDiagnostics) {
      log(entry);
    }
    throw new Error('延迟渲染敏感页面出现脚本异常');
  }
  await delayedPage.close();

  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'sensitive');
  const startCount = server.contextRecallRequests.length;
  await page.goto(`${server.origin.replace('127.0.0.1', 'localhost')}/login`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await page.waitForTimeout(3500);
  assert.equal(
    server.contextRecallRequests.length,
    startCount,
    '含密码输入的页面不应触发被动召回',
  );
  assert.equal(
    await page.locator('.pai-context-bubble').count(),
    0,
    '敏感页面不应显示记忆提示',
  );
  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('敏感页面出现脚本异常');
  }
  await page.close();
}

let server;
let context;

try {
  server = await startHarnessServer();
  log(`本地假 memory-service: ${server.apiBaseUrl}`);
  const launch = await launchExtensionContext(server.apiBaseUrl);
  context = launch.context;

  await verifySensitiveTransitionRace(server, context);
  await verifySensitiveQueryPage(server, context);
  await verifyEmptyMeetingDoesNotShowGenericLens(server, context);
  await verifyRingCentralLensSuppressedByComposeAssist(server, context);
  await verifyRehearsalLensPresentation(server, context);
  await verifyJiraIssueContext(server, context);
  await verifySelectedTextTrigger(server, context);
  await verifySelectedTextPrivacyAndUiBoundaries(server, context);
  await verifyUnsafeExploreRoute(server, context);
  await verifyDisplayedBubbleClearsOnSensitiveAttributeChange(server, context);
  await verifyIrrelevantFeedback(server, context);
  await verifyFeedbackDrawerMobileSheet(server, context);
  await verifyFeedbackFailureDisclosure(server, context);
  await verifyAllowlistMode(server, context, launch.serviceWorker, launch.extensionId);
  await verifyAllowSiteClearsCoveredControls(
    server,
    context,
    launch.serviceWorker,
    launch.extensionId,
  );
  await verifyLiveSiteControlStorageSync(server, context, launch.serviceWorker);
  await verifyNormalPage(server, context, launch.serviceWorker, launch.extensionId);
  await verifyPossibleHoverPeek(server, context);
  await verifyMetadataSummaryPresentation(server, context);
  await verifySourceUrlOnlyProvenance(server, context);
  await verifyPagePathBlock(server, context, launch.serviceWorker, launch.extensionId);
  await verifySensitivePage(server, context);
  log('browser checks passed');
} finally {
  if (context) {
    await context.close();
  }
  if (server) {
    await server.close();
  }
}
