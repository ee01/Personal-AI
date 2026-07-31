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

async function waitForAmbientTrace(server, predicate, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = server.ambientCalibrationRequests.find(predicate);
    if (match) {
      return match;
    }
    await delay(50);
  }
  throw new Error('Timed out waiting for matching ambient calibration trace');
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

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function buildKeystoneHarnessResponse(status = 'ready', language = 'zh-CN') {
  const ts = nowSeconds();
  const isPartial = status === 'partial';
  const isStale = status === 'stale';
  const english = language === 'en-US';
  const match = {
    id: 'keystone-msg-1',
    type: 'message',
    score: 0.94,
    displayPriority: 'p1',
    title: 'WhatsApp integration thread',
    uiSummary: '先复用现有 SMS 基础设施，再决定是否新增发送链路。',
    snippet: 'Research the RingCX WhatsApp and SMS infrastructure before a new design.',
    sourceLabel: 'glip',
    sourceTitle: 'RingCX integration room',
    sourceUrl: 'https://source.example.com/ringcx-whatsapp-thread',
    exploreLink: '#/timeline?focus=keystone-msg-1',
    links: [],
    whyMatched: '当前页面命中 WhatsApp 与 SMS reuse',
    whyRelevant: ['项目：RingCX', '主题：WhatsApp', '主题：SMS reuse'],
    matchedAnchors: {
      projects: ['RingCX'],
      topics: ['WhatsApp', 'SMS reuse'],
    },
    reasonType: 'keyword_overlap',
    evidenceRole: 'decision',
    timestamp: ts - 3600,
  };
  const sourceAsOf = isStale ? ts - 20 * 86400 : ts - 3600;
  return {
    matches: [match],
    topMatch: match,
    queryTimeMs: 3,
    changeProjections: [
      {
        chainKey: 'ringcx-whatsapp:delivery-path',
        subjectKey: 'workflow:ringcx-whatsapp',
        subjectLabel: 'WhatsApp 集成复用路径',
        subjectKind: 'workflow',
        propertyKey: 'delivery_path',
        propertyLabel: '发送链路',
        currentValue: {
          kind: 'text',
          display: '优先复用 SMS 基础设施',
          normalized: 'reuse_sms',
        },
        previousValue: {
          kind: 'text',
          display: '设计独立发送链路',
          normalized: 'new_path',
        },
        status: 'confirmed_current',
        summary: '发送链路已从独立设计调整为优先复用 SMS 基础设施。',
        boundary: '只读变化证据，不会修改项目状态。',
        eventCount: 2,
        reversalCount: 0,
        conflictCount: 0,
        lastObservedAt: ts - 3600,
        currentEvent: {
          id: 'change-event-2',
          previousValue: {
            kind: 'text',
            display: '设计独立发送链路',
            normalized: 'new_path',
          },
          nextValue: {
            kind: 'text',
            display: '优先复用 SMS 基础设施',
            normalized: 'reuse_sms',
          },
          authorityRole: 'direct_message',
          sourceRef: {
            type: 'message',
            id: 'keystone-msg-1',
            title: 'WhatsApp integration thread',
          },
          reason: '先确认可复用能力',
          observedAt: ts - 3600,
          isReversal: false,
        },
        history: [],
      },
    ],
    keystoneBrief: {
      brief: {
        id: `kb-harness-${status}`,
        briefKey: `workflow:ringcx-whatsapp-${status}`,
        title: english ? 'WhatsApp Integration Reuse Path' : 'WhatsApp 集成复用路径',
        status,
        summary: english
          ? 'Research the RingCX WhatsApp and SMS infrastructure before designing a second delivery path.'
          : '先调研 RingCX WhatsApp 与 SMS 基础设施，避免直接设计第二套发送链路。',
        externalSummary: '先调研 WhatsApp 与 SMS 基础设施，再决定新增设计。',
        sourceAsOf,
        freshness: {
          state: isStale ? 'stale_risk' : 'fresh',
          reason: isStale
            ? '来源有效期已过，需要刷新'
            : isPartial
              ? '新消息与旧决策存在冲突'
              : '最近 7 天有相关消息，未检测到冲突',
          expiresAt: isStale ? ts - 1 : ts + 7 * 86400,
        },
        slots: {
          whyItMatters: english
            ? 'The current page discusses the WhatsApp integration approach.'
            : '当前页面正在讨论 WhatsApp 接入方式。',
          currentState: english
            ? 'Reuse the existing SMS infrastructure first, then decide whether a new design is needed.'
            : '先复用现有 SMS 基础设施，再决定是否新增设计。',
          stableFacts: [
            {
              text: english
                ? 'RingCX has existing SMS infrastructure that can be evaluated for reuse.'
                : 'RingCX 已有 SMS 基础设施可供复用调研。',
              sourceRefs: ['message:keystone-msg-1', 'source_memory:keystone-source-2'],
              confidence: 'high',
              authority: 'direct_message',
              validAsOf: sourceAsOf,
              staleRisk: isStale ? 'high' : 'low',
              projection: 'summary_ok',
            },
          ],
          decisions: [],
          constraints: [
            {
              text: english
                ? 'Do not design a second delivery path before completing the research.'
                : '不要在调研前直接设计第二套发送链路。',
              sourceRefs: ['message:keystone-msg-1'],
              authority: 'direct_message',
              projection: 'summary_ok',
            },
          ],
          traps: [],
          nextUseCases: ['RingCentral thread reading'],
          openQuestions: [english
            ? 'What is the final capability boundary of the WhatsApp provider?'
            : 'WhatsApp provider 的最终能力边界是什么？'],
        },
        sourceMap: [
          {
            ref: 'message:keystone-msg-1',
            sourceType: 'message',
            sourceId: 'keystone-msg-1',
            role: 'authority',
            title: 'WhatsApp integration thread',
            url: 'https://source.example.com/ringcx-whatsapp-thread',
            timestamp: ts - 3600,
            authority: 'direct_message',
            projection: 'summary_ok',
          },
          {
            ref: 'source_memory:keystone-source-2',
            sourceType: 'source_memory',
            sourceId: 'keystone-source-2',
            role: 'supporting',
            title: 'SMS architecture notes',
            timestamp: ts - 7200,
            authority: 'source_memory',
            projection: 'local_only',
          },
        ],
        displayPolicy: {
          defaultMode: 'chip',
          maxLines: 6,
          canCopyToDraft: !isPartial && !isStale,
          externalSummaryOnly: true,
          hiddenSourceCount: 1,
        },
        writeReceipt: {
          writesProfile: false,
          sendsExternal: false,
          createsTask: false,
          updatesFacts: false,
          writesOutcomeEvent: true,
        },
        repairState: 'clean',
        compositionVersion: english
          ? 'auto-reflection-grounded-v2-en-US'
          : 'auto-reflection-grounded-v2-zh-CN',
      },
      presentationMode: isStale ? 'stale_notice' : isPartial ? 'conflict' : 'primary',
      whyNow: english
        ? 'Matches the current RingCX WhatsApp discussion'
        : '命中当前 RingCX WhatsApp 讨论',
      evidenceMatchIds: ['keystone-msg-1'],
      relatedMemoryCount: 1,
    },
  };
}

async function waitForKeystoneEvent(server, eventType, briefId, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const event = server.keystoneBriefEvents.find(
      (item) => item.briefId === briefId && item.body.eventType === eventType,
    );
    if (event) return event;
    await delay(50);
  }
  throw new Error(`Timed out waiting for Keystone event ${eventType} on ${briefId}`);
}

function sourceMemoryKindLabel(sourceKind) {
  if (sourceKind === 'selection') return '选区资料';
  if (sourceKind === 'visual_memory') return '视觉证据';
  return '整页资料';
}

function buildHarnessDistillation(capsule, note) {
  const ts = nowSeconds();
  const summary = note || capsule.summary || capsule.contentPreview;
  return {
    status: 'ready',
    schemaVersion: 1,
    oneLineCue: `已保存资料 · ${capsule.sourceTitle}：${summary}`,
    compactMemo: `摘要：${summary}\n- ${capsule.contentPreview}`,
    policyReceipt: {
      state: 'ready',
      label: '资料蒸馏已就绪',
      detail:
        '已生成一行提示、compact memo、ready takeaways 和安静触发 matcher；只作为证据提示，不自动写用户画像、创建任务或外部写入。',
      evidence: ['证据锚点：1', '要点：1', '触发线索：1', '低副作用链接：1'],
      nextStep:
        '后续 Ask、Memory Lens、Reflection 和 Dream 可把它作为带来源的上下文单元引用。',
    },
    sourceReliability: {
      level: 'source_grounded',
      reason: '来源来自用户保存的网页或选区，需要按外部资料证据处理。',
    },
    downstreamUse: {
      allowed: [
        'source_memory_detail',
        'context_recall_source_card',
        'reflection_seed',
        'dream_seed',
      ],
      blocked: [
        'auto_profile_write',
        'auto_task_creation',
        'external_write_or_sync',
      ],
    },
    generatedAt: ts,
    sourceAsOf: ts,
    inputHash: `harness-${capsule.id}-${summary.length}`,
    evidenceAnchorIds: [`${capsule.id}-anchor`],
    takeawayCount: 1,
    triggerCount: 1,
  };
}

function buildHarnessSourceMemoryCapsule(body, requestIndex) {
  const duplicateSourceMemory = String(body.sourceUrl || '').includes('duplicate-page-capture');
  const id = duplicateSourceMemory
    ? 'source-memory-capsule-existing'
    : `source-memory-capsule-${requestIndex}`;
  const sourceKind = body.sourceKind || (body.selectedText ? 'selection' : 'webpage');
  const preview = String(body.selectedText || body.text || '').slice(0, 240);
  const ts = nowSeconds();
  const note = String(body.note || '').trim();
  const capsule = {
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
    summary: note || preview,
    contentPreview: preview,
    messageId: `source-memory-message-${requestIndex}`,
    metadata: {
      userNote: note || undefined,
    },
    writeReceipt: {
      state: 'saved_with_recall_signal',
      label: '资料记忆已写入',
      detail:
        sourceKind === 'visual_memory'
          ? '已创建或更新 source-memory capsule，并写入关联视觉证据检索信号；后续 Ask、Memory Lens 和时间轴可按证据召回。'
          : '已创建或更新 source-memory capsule，并写入关联网页检索信号；后续 Ask、Memory Lens 和时间轴可按证据召回。',
      evidence: [
        `资料类型：${sourceMemoryKindLabel(sourceKind)}`,
        `保存方式：${body.captureMode === 'auto' ? '自动保存' : '主动保存'}`,
        '范围：工作记忆',
        '检索信号：已启用',
      ],
      nextStep:
        '可在资料详情复核、补备注或撤销；不会自动外发、插入输入框或同步到其他平台。',
    },
    actionReceipt: {
      state: duplicateSourceMemory ? 'duplicate_no_change' : 'saved',
      label: duplicateSourceMemory
        ? '最近操作：已有资料保持可用'
        : '最近操作：资料已保存',
      detail: duplicateSourceMemory
        ? '这次命中已有 source-memory capsule，没有新建第二条 capsule，也没有更新备注或正文。'
        : '这次创建了 source-memory capsule，并写入关联网页检索信号。',
      evidence: [
        `资料类型：${sourceMemoryKindLabel(sourceKind)}`,
        `保存方式：${body.captureMode === 'auto' ? '自动保存' : '主动保存'}`,
      ],
      nextStep: '可在资料详情复核、补备注或撤销。',
      occurredAt: ts,
    },
    createdAt: ts,
    updatedAt: ts,
    savedAt: ts,
    duplicate: duplicateSourceMemory,
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
    takeaways: [
      {
        id: `${id}-takeaway`,
        kind: 'source_note',
        title: (note || preview).slice(0, 64),
        body: note || preview,
        evidenceAnchorIds: [`${id}-anchor`],
        confidence: 0.62,
        status: 'ready',
      },
    ],
    triggers: [
      {
        id: `${id}-trigger`,
        triggerKind: 'source',
        description: '再次遇到 127.0.0.1 相关资料时安静匹配',
        matcher: { host: '127.0.0.1' },
        defaultBehavior: 'quiet_match',
      },
    ],
  };
  capsule.metadata.distillation = buildHarnessDistillation(capsule, note);
  return capsule;
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
  const ambientCalibrationRequests = [];
  const sourceMemoryCandidateRequests = [];
  const sourceMemoryCreateRequests = [];
  const sourceMemoryCapsules = new Map();
  const keystoneBriefEvents = [];

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
        if (typeof body.url === 'string' && body.url.includes('/keystone-ready')) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(buildKeystoneHarnessResponse('ready')));
          return;
        }
        if (typeof body.url === 'string' && body.url.includes('/keystone-partial')) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(buildKeystoneHarnessResponse('partial')));
          return;
        }
        if (typeof body.url === 'string' && body.url.includes('/keystone-stale')) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(buildKeystoneHarnessResponse('stale')));
          return;
        }
        if (typeof body.url === 'string' && body.url.includes('/keystone-english')) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(buildKeystoneHarnessResponse('ready', 'en-US')));
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
        if (
          body.contextType === 'selected_text' &&
          typeof body.url === 'string' &&
          body.url.includes('/selected-background-only')
        ) {
          const backgroundOnlyMatch = {
            id: 'web-memory-background-only',
            type: 'message',
            score: 0.94,
            displayPriority: 'p1',
            title: 'Falcon launch readiness background',
            uiSummary: 'Background paragraph mentions Falcon owner handoff but not the selected phrase.',
            snippet: 'Previously saved notes mention Falcon owner handoff and launch readiness.',
            sourceLabel: 'Web memory',
            sourceUrl: 'https://source.example.com/falcon-background',
            sourceTitle: 'Falcon launch notes',
            exploreLink: '#/timeline?focus=web-memory-background-only',
            links: [],
            whyMatched: '附近段落命中 Falcon owner handoff',
            whyRelevant: ['项目：Falcon', '主题：owner handoff'],
            matchedAnchors: {
              projects: ['Falcon'],
              topics: ['owner handoff'],
            },
            reasonType: 'keyword_overlap',
            evidenceRole: 'supporting',
            timestamp: Math.floor(Date.now() / 1000),
          };
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              matches: [backgroundOnlyMatch],
              topMatch: backgroundOnlyMatch,
              queryTimeMs: 3,
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
            uiSummary: 'Falcon customer review reminder summary: confirm the owner before Friday.',
            snippet: 'Short fallback snippet should not hide the full rehearsal script.',
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
                summary: 'Falcon customer review reminder summary: confirm the owner before Friday.',
                content:
                  'Before the Falcon customer review, ask Priya to confirm the escalation owner and bring the handoff checklist.',
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
              keystoneBrief: buildKeystoneHarnessResponse('ready').keystoneBrief,
              autopilot: {
                mode: 'chip',
                summary: '低打扰提示：3 条可能相关，7 条静默。',
                candidateCount: 10,
                shownCount: 3,
                strongCount: 0,
                possibleCount: 3,
                quietedCount: 7,
                hiddenCount: 1,
                lowInformationCount: 0,
                sourceExcludedCount: 0,
                duplicateMergedCount: 2,
                quietReasons: [
                  {
                    reason: 'missing_issue_anchor',
                    label: '资料记忆缺少当前 Jira 票号锚点',
                    count: 4,
                  },
                ],
                sceneAnchors: {
                  people: ['Priya Shah'],
                  projects: ['Falcon'],
                  topics: ['customer review'],
                },
                gates: ['attention_budget', 'scene_anchor_gate'],
              },
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
            exploreLink: '#/source-memory/web-memory-source-url-only',
            links: [],
            whyMatched: '来源 URL 命中 Falcon handoff',
            whyRelevant: [
              '已保存资料：整页资料 / 主动保存',
              '项目：Falcon',
              '主题：owner handoff',
            ],
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
              sourceMemoryDistillationStatus: 'ready',
              sourceMemoryCue: 'Falcon source-only handoff note should be checked before launch.',
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
        if (typeof body.url === 'string' && body.url.includes('/source-url-sensitive')) {
          const sourceUrlSensitiveMatch = {
            id: 'source-memory:web-memory-source-url-sensitive',
            type: 'source_memory',
            score: 0.9,
            displayPriority: 'p1',
            title: 'Falcon sensitive source handoff note',
            uiSummary: 'The saved source exists but its raw URL carries a sensitive query token.',
            snippet: 'Sensitive source URL fixtures should keep the capsule detail checkable without exposing the token.',
            sourceLabel: 'source_memory',
            sourceUrl: 'https://source-only.example.com/falcon/handoff?ticket=PAI-123&token=secret-token',
            sourceTitle: 'Falcon sensitive source evidence',
            exploreLink: '#/source-memory/web-memory-source-url-sensitive',
            links: [],
            whyMatched: '来源 URL 命中 Falcon sensitive handoff',
            whyRelevant: [
              '已保存资料：整页资料 / 主动保存',
              '项目：Falcon',
              '主题：owner handoff',
            ],
            matchedAnchors: {
              projects: ['Falcon'],
              topics: ['owner handoff'],
            },
            reasonType: 'source_match',
            evidenceRole: 'artifact',
            metadata: {
              sourceMemoryCapsuleId: 'web-memory-source-url-sensitive',
              sourceKind: 'webpage',
              captureMode: 'manual',
              sourceMemoryDistillationStatus: 'ready',
              sourceMemoryCue: 'Falcon sensitive source note is available only through capsule detail.',
            },
            timestamp: Math.floor(Date.now() / 1000),
          };
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              matches: [sourceUrlSensitiveMatch],
              topMatch: sourceUrlSensitiveMatch,
              queryTimeMs: 3,
            }),
          );
          return;
        }
        if (
          typeof body.url === 'string' &&
          (body.url.includes('/source-status-current') || body.url.includes('/source-status-stale'))
        ) {
          const staleCase = body.url.includes('/source-status-stale');
          const sourceStatusMatch = {
            id: staleCase ? 'web-memory-source-status-stale' : 'web-memory-source-status-current',
            type: 'message',
            score: 0.9,
            scope: 'personal',
            displayPriority: 'p1',
            title: staleCase ? 'Falcon source status stale note' : 'Falcon current source status note',
            uiSummary: staleCase
              ? 'This memory has an external source, but the note is old enough to require re-checking.'
              : 'This memory points back to the current page source.',
            snippet: 'Source status receipts explain how the card can be checked before action.',
            sourceLabel: 'web',
            sourceUrl: staleCase
              ? 'https://source.example.com/falcon/stale-source'
              : body.url,
            sourceTitle: staleCase ? 'Falcon stale external source' : 'Falcon current page source',
            exploreLink: staleCase
              ? '#/timeline?focus=web-memory-source-status-stale'
              : '#/timeline?focus=web-memory-source-status-current',
            links: [],
            whyMatched: '来源状态命中 Falcon',
            whyRelevant: ['项目：Falcon', '主题：source status'],
            matchedAnchors: {
              projects: ['Falcon'],
              topics: ['source status'],
            },
            reasonType: 'source_match',
            evidenceRole: 'supporting',
            timestamp: staleCase
              ? Math.floor((Date.now() - 120 * 24 * 60 * 60 * 1000) / 1000)
              : Math.floor(Date.now() / 1000),
          };
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              matches: [sourceStatusMatch],
              topMatch: sourceStatusMatch,
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
        if (
          selectedTextCase &&
          Array.isArray(body.secondaryTexts) &&
          body.secondaryTexts.some((item) => /Orion renewal/i.test(String(item || '')))
        ) {
          const orionMatch = {
            id: 'web-memory-orion-selection',
            type: 'message',
            score: 0.94,
            displayPriority: 'p1',
            title: 'Selected text Orion owner handoff',
            uiSummary: 'Selected text recall found the Orion renewal owner handoff checklist.',
            snippet: 'Previously saved notes mention the Orion renewal checklist and owner handoff.',
            sourceLabel: 'Web memory',
            sourceUrl: 'https://source.example.com/orion',
            sourceTitle: 'Orion renewal notes',
            exploreLink: '#/timeline?focus=web-memory-orion-selection',
            links: [{ label: 'Open source', url: 'https://source.example.com/orion' }],
            whyMatched: '选中文本命中 owner handoff checklist',
            whyRelevant: ['项目：Orion', '主题：owner handoff checklist'],
            matchedAnchors: {
              projects: ['Orion'],
              topics: ['owner handoff checklist'],
            },
            reasonType: 'keyword_overlap',
            evidenceRole: 'supporting',
            metadata: { fixture: 'webpage-memory-detection' },
            timestamp: Math.floor(Date.now() / 1000),
          };
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              matches: [orionMatch],
              topMatch: orionMatch,
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
          scope: 'work',
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
            autopilot: {
              mode: 'card',
              summary: '展示强相关卡片：2 条强相关，3 条弱关联静默。',
              candidateCount: 5,
              shownCount: 2,
              strongCount: 2,
              possibleCount: 0,
              quietedCount: 3,
              hiddenCount: 1,
              lowInformationCount: 1,
              sourceExcludedCount: 1,
              duplicateMergedCount: 0,
              quietReasons: [
                {
                  reason: 'weak_semantic_only',
                  label: '弱语义相似',
                  count: 1,
                },
              ],
              sceneAnchors: {
                projects: ['Falcon'],
                topics: ['owner handoff'],
              },
              gates: ['attention_budget', 'scene_anchor_gate', 'explainability_required'],
            },
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
        if (body.targetId === 'web-memory-1' && body.action === 'positive') {
          await delay(260);
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

      const keystoneEventMatch = req.url?.match(
        /^\/api\/v1\/keystone-briefs\/([^/]+)\/events$/,
      );
      if (req.method === 'POST' && keystoneEventMatch) {
        const rawBody = await readRequestBody(req);
        const body = rawBody ? JSON.parse(rawBody) : {};
        const briefId = decodeURIComponent(keystoneEventMatch[1]);
        keystoneBriefEvents.push({ briefId, body });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            item: {
              id: briefId,
              status:
                body.eventType === 'hidden'
                  ? 'hidden'
                  : body.eventType === 'not_accurate'
                    ? 'blocked'
                    : 'ready',
            },
          }),
        );
        return;
      }

      if (req.method === 'POST' && req.url === '/api/v1/ambient-calibration/traces') {
        const rawBody = await readRequestBody(req);
        const body = rawBody ? JSON.parse(rawBody) : {};
        ambientCalibrationRequests.push(body);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            stored: true,
            traceId: `ambient-trace-${ambientCalibrationRequests.length}`,
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
        const isSelectionCandidate = req.url.endsWith('/selection');
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            eligible,
            score: eligible ? 0.64 : 0,
            suggestedAction: eligible ? 'suggest' : 'ignore',
            reasons: eligible
              ? isSelectionCandidate
                ? ['用户选中了文本', '文本片段足够完整']
                : ['阅读深度较高', '文本片段足够完整']
              : ['文本信息量不足'],
            captureMode: 'suggested',
          }),
        );
        return;
      }

      if (req.method === 'POST' && req.url === '/api/v1/source-memory/capsules') {
        const rawBody = await readRequestBody(req);
        const body = rawBody ? JSON.parse(rawBody) : {};
        if (String(body.note || '').includes('触发失败')) {
          res.writeHead(503, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'Memory Service 暂时不可用',
            }),
          );
          return;
        }
        sourceMemoryCreateRequests.push(body);
        const capsule = buildHarnessSourceMemoryCapsule(
          body,
          sourceMemoryCreateRequests.length,
        );
        sourceMemoryCapsules.set(capsule.id, capsule);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ capsule }));
        return;
      }

      const sourceMemoryNoteMatch = req.url?.match(
        /^\/api\/v1\/source-memory\/capsules\/([^/]+)\/note$/,
      );
      if (req.method === 'POST' && sourceMemoryNoteMatch) {
        const rawBody = await readRequestBody(req);
        const body = rawBody ? JSON.parse(rawBody) : {};
        const id = decodeURIComponent(sourceMemoryNoteMatch[1]);
        const existing = sourceMemoryCapsules.get(id);
        if (!existing) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'Source memory capsule not found.' }));
          return;
        }
        await delay(350);
        if (String(body.note || '').includes('触发失败')) {
          res.writeHead(503, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'Memory Service 暂时不可用' }));
          return;
        }
        const note = String(body.note || '').trim();
        const ts = nowSeconds();
        const capsule = {
          ...existing,
          summary: note || existing.contentPreview,
          updatedAt: ts,
          metadata: {
            ...(existing.metadata || {}),
            userNote: note || undefined,
          },
          actionReceipt: {
            state: 'note_updated',
            label: '最近操作：备注已更新',
            detail:
              '这次更新了资料备注、summary、关联 web 检索信号和资料蒸馏回执；没有新建第二条 capsule。',
            evidence: ['资料类型：选区资料', '检索信号：已刷新'],
            nextStep:
              '继续在详情页复核蒸馏提示；这不会自动写用户画像、创建任务或同步外部系统。',
            occurredAt: ts,
          },
        };
        capsule.metadata.distillation = buildHarnessDistillation(capsule, note);
        sourceMemoryCapsules.set(id, capsule);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ capsule }));
        return;
      }

      const sourceMemoryDetailMatch = req.url?.match(
        /^\/api\/v1\/source-memory\/capsules\/([^/?#]+)$/,
      );
      if (req.method === 'GET' && sourceMemoryDetailMatch) {
        const id = decodeURIComponent(sourceMemoryDetailMatch[1]);
        const capsule = sourceMemoryCapsules.get(id);
        if (!capsule) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'Source memory capsule not found.' }));
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ capsule }));
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

      if (req.method === 'GET' && req.url?.startsWith('/keystone-')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>RingCX WhatsApp SMS integration</title></head>
            <body>
              <main>
                <h1>RingCX WhatsApp integration</h1>
                <p>
                  The team is deciding whether WhatsApp should reuse the current SMS
                  infrastructure before estimating a second delivery path. Review the
                  provider boundary, current routing constraints, prior decision, and
                  source evidence before proposing implementation work.
                </p>
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

      if (req.method === 'GET' && req.url?.startsWith('/page-capture-review')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head>
              <title>Falcon page capture review packet</title>
              <style>
                body { margin: 0; font: 16px/1.6 system-ui, sans-serif; }
                main { max-width: 760px; margin: 0 auto; padding: 48px 24px 900px; }
                p { margin: 0 0 20px; }
              </style>
            </head>
            <body>
              <main>
                <h1>Falcon page capture review packet</h1>
                <p>
                  Falcon webpage capture review notes preserve the source owner,
                  migration checklist, customer communication plan, release
                  confidence signals, dependency status, and follow-up readiness
                  material for later planning workflows.
                </p>
                <p>
                  The page includes enough narrative evidence to be useful as a
                  source memory capsule. It should not require a native browser
                  prompt because the user needs to see the source title, content
                  preview, capture reasons, and optional note before saving.
                </p>
                <p>
                  A lightweight inline review keeps the user inside the page,
                  supports cancel without writing data, and still gives a direct
                  receipt after the confirmed save has created a capsule with a
                  linked web memory signal.
                </p>
                <p>
                  Additional Falcon context mentions Priya Shah, QBR readiness,
                  owner handoff, migration checkpoints, launch risk, release
                  review, customer-facing summary, and evidence anchors for a
                  later AI planning workflow.
                </p>
              </main>
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

      if (req.method === 'GET' && req.url?.startsWith('/source-url-sensitive')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Falcon sensitive source URL provenance</title></head>
            <body>
              <section>
                Falcon sensitive source URL provenance should keep the saved
                capsule checkable without rendering credentialed or token-bearing
                source links in the Memory Lens card.
              </section>
            </body>
          </html>`);
        return;
      }

      if (
        req.method === 'GET' &&
        (req.url?.startsWith('/source-status-current') ||
          req.url?.startsWith('/source-status-stale'))
      ) {
        const staleCase = req.url.startsWith('/source-status-stale');
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>${staleCase ? 'Falcon stale source status' : 'Falcon current source status'}</title></head>
            <body>
              <section>
                Falcon source status receipts should tell users whether the card
                points back to the current page, an external source, or a stale
                memory that needs re-checking before action.
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

      if (req.method === 'GET' && req.url?.startsWith('/selected-background-only')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Selected text background-only recall</title></head>
            <body>
              <section id="selected-background-only-section">
                Falcon owner handoff and launch readiness are nearby context.
                The selected customer communication follow-up wording is useful
                enough to save, but should not open Selection Memory Search when
                only the surrounding paragraph matched the old memory.
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

      if (req.method === 'GET' && req.url?.startsWith('/selected-same-text-context')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Repeated owner handoff selections</title></head>
            <body>
              <main>
                <section id="falcon-repeat">
                  Falcon launch notes mention the owner handoff checklist,
                  migration checkpoints, customer communication, and release confidence.
                </section>
                <section id="orion-repeat">
                  Orion renewal notes mention the owner handoff checklist,
                  procurement risk, finance approval, and support follow-up.
                </section>
              </main>
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
            <head>
              <title>PAI-123 Falcon Jira issue</title>
              <style>
                #pai-composer-guard-root { position: fixed; right: 24px; bottom: 24px; }
                .pai-composer-guard-icon-button { display: block; width: 36px; height: 36px; }
              </style>
            </head>
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
              <div id="pai-composer-guard-root" class="pai-composer-guard">
                <button class="pai-composer-guard-icon-button" type="button">AI</button>
              </div>
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
    ambientCalibrationRequests,
    sourceMemoryCandidateRequests,
    sourceMemoryCreateRequests,
    keystoneBriefEvents,
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
  assert.match(cardText, /预演回执/);
  assert.match(cardText, /触发线索/);
  assert.match(cardText, /人物：Priya Shah/);
  assert.match(cardText, /项目：Falcon/);
  assert.match(cardText, /提示资格/);
  assert.match(cardText, /Active · 强相关/);
  assert.match(cardText, /复核入口/);
  assert.match(cardText, /可打开 Rehearsal 管理页复核脚本、来源和激活历史/);
  assert.match(cardText, /反馈影响/);
  assert.match(cardText, /有用\/不相关只调整这条预演后续命中/);
  assert.match(cardText, /我能做什么/);
  assert.match(cardText, /3 条可能相关，7 条静默/);
  assert.doesNotMatch(
    cardText,
    /展示判断/,
    'Rehearsal Autopilot 明细不应占用卡片首屏正文',
  );
  assert.match(
    cardText,
    /只读预演，不生成\/插入\/发送\/执行/,
    'Rehearsal 操作边界应在预演回执中直接可见',
  );
  assert.match(cardText, /线索/);
  assert.match(cardText, /Before the Falcon customer review/);
  assert.match(cardText, /bring the handoff checklist/);
  assert.match(cardText, /摘要/);
  assert.match(cardText, /confirm the owner before Friday/);
  const rehearsalBoundaryButton = page.locator('.pai-context-action-boundary-button');
  await rehearsalBoundaryButton.click();
  await page.waitForSelector('.pai-context-action-boundary-detail', {
    state: 'visible',
    timeout: 5000,
  });
  assert.equal(
    await rehearsalBoundaryButton.getAttribute('aria-expanded'),
    'true',
    '点击左下角摘要后应展开 Autopilot 明细',
  );
  const rehearsalBoundaryDetailText = await page
    .locator('.pai-context-action-boundary-detail')
    .innerText();
  assert.match(rehearsalBoundaryDetailText, /展示判断/);
  assert.match(rehearsalBoundaryDetailText, /低打扰提示：3 条可能相关，7 条静默。/);
  assert.match(rehearsalBoundaryDetailText, /资料记忆缺少当前 Jira 票号锚点/);
  assert.match(rehearsalBoundaryDetailText, /操作边界/);
  assert.match(rehearsalBoundaryDetailText, /只读预演，不生成\/插入\/发送\/执行/);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const button = document.querySelector('.pai-context-action-boundary-button');
    return button?.getAttribute('aria-expanded') === 'false';
  });
  assert.doesNotMatch(
    cardText,
    /Short fallback snippet should not hide/,
    'Rehearsal 卡片应优先展示 metadata.rehearsal.content，而不是 fallback snippet',
  );
  assert.doesNotMatch(
    cardText,
    /它说了什么/,
    'Rehearsal 卡片不应继续使用普通事实记忆标题',
  );
  assert.match(
    (await page.locator('.pai-context-recall-positive').getAttribute('aria-label')) || '',
    /标记这条预演提醒有用[\s\S]*提交 recall-quality 有用反馈[\s\S]*不会插入输入框、发送内容或确认事实/,
    'Rehearsal 正向反馈应在可访问名称里说明写入和无插入/发送/事实确认边界',
  );
  assert.match(
    (await page.locator('.pai-context-recall-negative').getAttribute('aria-label')) || '',
    /标记这条预演提醒不相关[\s\S]*打开原因面板[\s\S]*写入失败时只保留本页 30 分钟隐藏[\s\S]*不会删除原始记忆/,
    'Rehearsal 负向反馈应在可访问名称里说明原因面板、写入和本页隐藏边界',
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

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  await page.locator('.pai-context-bubble').click();
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  await page.locator('.pai-context-recall-negative').click();
  await page.waitForSelector('.pai-context-feedback-sheet', {
    state: 'visible',
    timeout: 5000,
  });
  const negativeDrawerText = await page.locator('.pai-context-feedback-sheet').innerText();
  assert.match(negativeDrawerText, /这条预演提醒不适合当前场景/);
  assert.match(negativeDrawerText, /误触发的预演提醒/);
  assert.doesNotMatch(
    negativeDrawerText,
    /这条记忆不是这个意思/,
    'Rehearsal 负反馈 drawer 不应使用普通记忆标题',
  );
  await page
    .locator('.pai-context-feedback-reason[data-feedback-reason="generic_topic_overlap"]')
    .click();
  const negativeFeedbackDeadline = Date.now() + 5000;
  while (
    server.rehearsalFeedbackRequests.length < startRehearsalFeedbackCount + 2 &&
    Date.now() < negativeFeedbackDeadline
  ) {
    await delay(50);
  }
  assert.equal(
    server.rehearsalFeedbackRequests.length,
    startRehearsalFeedbackCount + 2,
    'Rehearsal 负向反馈也应调用 /rehearsals/:id/feedback',
  );
  const rehearsalNegativeFeedback = server.rehearsalFeedbackRequests.at(-1);
  assert.equal(rehearsalNegativeFeedback.outcome, 'irrelevant');
  assert.equal(rehearsalNegativeFeedback.activationId, 'activation-memory-lens-1');
  const rehearsalNegativeFeedbackDetail = parseFeedbackDetail(rehearsalNegativeFeedback.note);
  assert.equal(rehearsalNegativeFeedbackDetail.feedback_reason, 'generic_topic_overlap');
  assert.equal(rehearsalNegativeFeedbackDetail.target_type, 'rehearsal');

  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('Rehearsal Lens 页面出现脚本异常');
  }
  await page.close();
}

async function verifyKeystoneBriefMemoryLens(server, context) {
  const readyPage = await context.newPage();
  const readyDiagnostics = attachPageDiagnostics(readyPage, 'keystone-ready');
  const readyStartCount = server.contextRecallRequests.length;
  await readyPage.goto(`${server.origin}/keystone-ready`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await readyPage.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  assert.equal(
    server.contextRecallRequests.length,
    readyStartCount + 1,
    'ready 简报页面应只触发一次现有 context-recall',
  );
  assert.equal(
    await readyPage.locator('.pai-context-bubble').count(),
    1,
    '关键简报应复用唯一 Memory Lens 浮标',
  );
  assert.equal(
    await readyPage.locator('.pai-keystone-bubble, .pai-keystone-floating-icon, .pai-keystone-panel').count(),
    0,
    '关键简报不应创建第二个浮标或并列 panel',
  );

  await readyPage.locator('.pai-context-bubble').hover();
  await readyPage.waitForSelector('.pai-context-peek.pai-context-peek--visible', {
    timeout: 5000,
  });
  const readyPeekText = await readyPage.locator('.pai-context-peek').innerText();
  assert.match(readyPeekText, /关键简报/);
  assert.match(readyPeekText, /WhatsApp 集成复用路径/);
  assert.match(readyPeekText, /2 条来源/);
  await waitForKeystoneEvent(server, 'shown', 'kb-harness-ready');

  await readyPage.locator('.pai-context-bubble').click();
  await readyPage.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  await waitForKeystoneEvent(server, 'opened', 'kb-harness-ready');
  let readyCardText = await readyPage.locator('.pai-context-card').innerText();
  assert.match(readyCardText, /关键简报/);
  assert.match(readyCardText, /先调研 RingCX WhatsApp 与 SMS 基础设施/);
  assert.match(readyCardText, /约束与边界/);
  assert.match(readyCardText, /不要在调研前直接设计第二套发送链路/);
  assert.match(readyCardText, /查看证据与相关记忆/);
  assert.doesNotMatch(
    readyCardText,
    /变化脉络/,
    '同轮命中简报与变化脉络时，简报必须独占 Lens 首屏',
  );
  assert.doesNotMatch(
    readyCardText,
    /WhatsApp integration thread/,
    'ready 首屏不应与原始记忆卡并列展示',
  );
  assert.match(readyCardText, /1 条只用于本机/);
  assert.match(readyCardText, /反馈只写简报事件/);

  await readyPage.locator('.pai-keystone-evidence-toggle').click();
  await waitForKeystoneEvent(server, 'evidence_opened', 'kb-harness-ready');
  readyCardText = await readyPage.locator('.pai-context-card').innerText();
  assert.match(readyCardText, /来源图/);
  assert.match(readyCardText, /SMS architecture notes/);
  assert.match(readyCardText, /本轮相关记忆/);
  assert.match(readyCardText, /WhatsApp 集成复用路径 · 变化脉络/);
  assert.match(readyCardText, /WhatsApp integration thread/);

  await readyPage.locator('.pai-keystone-evidence-item').first().click();
  let rawCardText = await readyPage.locator('.pai-context-card').innerText();
  assert.match(rawCardText, /返回关键简报/);
  assert.match(rawCardText, /变化脉络/);
  assert.match(rawCardText, /优先复用 SMS 基础设施/);
  await readyPage.locator('.pai-keystone-back').click();

  await readyPage.locator('.pai-keystone-evidence-item').nth(1).click();
  rawCardText = await readyPage.locator('.pai-context-card').innerText();
  assert.match(rawCardText, /返回关键简报/);
  assert.match(rawCardText, /WhatsApp integration thread/);
  assert.match(rawCardText, /为什么相关/);
  await readyPage.locator('.pai-keystone-back').click();
  assert.match(
    await readyPage.locator('.pai-context-card').innerText(),
    /关键简报/,
    '复核原始记忆后应返回同一个 Lens 简报主视图',
  );

  await readyPage.locator('.pai-keystone-useful').click();
  await waitForKeystoneEvent(server, 'useful', 'kb-harness-ready');
  await readyPage.waitForFunction(() =>
    document.querySelector('.pai-context-card')?.textContent?.includes('简报有用反馈已确认写入'),
  );
  await openContextMoreMenu(readyPage);
  await readyPage.locator('.pai-keystone-hide').click();
  await waitForKeystoneEvent(server, 'hidden', 'kb-harness-ready');
  const fallbackCardText = await readyPage.locator('.pai-context-card').innerText();
  assert.match(fallbackCardText, /WhatsApp integration thread/);
  assert.equal(
    await readyPage.locator('.pai-keystone-evidence-toggle').count(),
    0,
    '隐藏简报后应立即回退普通原始记忆卡',
  );
  if (readyDiagnostics.some((entry) => entry.includes('pageerror'))) {
    throw new Error(readyDiagnostics.join('\n'));
  }
  await readyPage.close();

  const partialPage = await context.newPage();
  const partialDiagnostics = attachPageDiagnostics(partialPage, 'keystone-partial');
  await partialPage.goto(`${server.origin}/keystone-partial`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await partialPage.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  await partialPage.locator('.pai-context-bubble').click();
  await partialPage.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  const partialCardText = await partialPage.locator('.pai-context-card').innerText();
  assert.match(partialCardText, /有证据冲突/);
  assert.match(partialCardText, /请先查看证据/);
  assert.equal(
    await partialPage.locator('.pai-keystone-copy').isDisabled(),
    true,
    'partial 简报必须禁用外发摘要复制',
  );
  assert.equal(
    await partialPage.locator('.pai-keystone-evidence-toggle').count(),
    1,
    'partial 简报仍应以冲突警告主视图引导证据复核',
  );
  if (partialDiagnostics.some((entry) => entry.includes('pageerror'))) {
    throw new Error(partialDiagnostics.join('\n'));
  }
  await partialPage.close();

  const stalePage = await context.newPage();
  const staleDiagnostics = attachPageDiagnostics(stalePage, 'keystone-stale');
  await stalePage.goto(`${server.origin}/keystone-stale`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await stalePage.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  await stalePage.locator('.pai-context-bubble').click();
  await stalePage.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  const staleCardText = await stalePage.locator('.pai-context-card').innerText();
  assert.match(staleCardText, /有旧简报/);
  assert.match(staleCardText, /当前先展示原始记忆/);
  assert.match(staleCardText, /WhatsApp integration thread/);
  assert.equal(
    await stalePage.locator('.pai-keystone-evidence-toggle').count(),
    0,
    'stale 简报不应作为当前简报主视图展示',
  );
  if (staleDiagnostics.some((entry) => entry.includes('pageerror'))) {
    throw new Error(staleDiagnostics.join('\n'));
  }
  await stalePage.close();
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
  const bubbleTitle = await bubble.getAttribute('title');
  const bubbleAriaLabel = await bubble.getAttribute('aria-label');
  assert.match(
    bubbleTitle || '',
    /Memory Lens。强相关。因为项目：Falcon/,
    'Rest icon tooltip should disclose the first match reason before hover',
  );
  assert.match(
    bubbleTitle || '',
    /Falcon launch readiness/,
    'Rest icon tooltip should name the top memory before hover',
  );
  assert.match(
    bubbleTitle || '',
    /只读提示，不写入\/插入\/发送/,
    'Rest icon tooltip should state the no-write/no-insert/no-send boundary',
  );
  assert.match(
    bubbleTitle || '',
    /本轮召回 · 页面稳定后重新请求/,
    'Rest icon tooltip should disclose that this hint came from the current recall request',
  );
  assert.doesNotMatch(
    bubbleTitle || '',
    /\b\d{1,3}%\b/,
    'Rest icon tooltip should not expose a confidence percentage',
  );
  assert.match(
    bubbleAriaLabel || '',
    /打开相关记忆提示：Memory Lens。强相关。因为项目：Falcon/,
    'Rest icon accessible name should explain why the bubble appeared',
  );
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
  assert.match(peekText, /工作记忆/);
  assert.match(peekText, /关键词匹配/);
  assert.match(peekText, /本轮召回 · 页面稳定后重新请求/);
  assert.match(peekText, /只读提示/);
  assert.match(peekText, /不写入\/插入\/发送/);
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
  assert.doesNotMatch(
    cardText,
    /页面召回回执/,
    '页面召回口径已在 Rest / Hover Peek 交代，不能再占用 Expanded Card 首屏',
  );
  assert.doesNotMatch(cardText, /网页被动提示/);
  assert.doesNotMatch(cardText, /Falcon readiness notes/);
  assert.doesNotMatch(cardText, /127\.0\.0\.1/);
  assert.doesNotMatch(cardText, /本轮召回 · 页面稳定后重新请求/);
  assert.match(cardText, /2 条强相关，3 条静默/);
  assert.doesNotMatch(
    cardText,
    /展示判断/,
    'Autopilot 明细不应占用卡片首屏正文',
  );
  assert.match(cardText, /为什么相关/);
  assert.match(cardText, /可提取信息/);
  assert.match(cardText, /建议动作/);
  assert.match(cardText, /Falcon launch readiness is linked to the owner handoff checklist\./);
  assert.match(cardText, /证据/);
  const actionBoundaryButton = page.locator('.pai-context-action-boundary-button');
  await actionBoundaryButton.hover();
  await page.waitForSelector('.pai-context-action-boundary-detail', {
    state: 'visible',
    timeout: 5000,
  });
  const actionBoundaryDetailText = await page
    .locator('.pai-context-action-boundary-detail')
    .innerText();
  assert.match(actionBoundaryDetailText, /展示判断/);
  assert.match(actionBoundaryDetailText, /展示强相关卡片：2 条强相关，3 条弱关联静默。/);
  assert.match(actionBoundaryDetailText, /过滤/);
  assert.match(actionBoundaryDetailText, /静默 3 条弱候选/);
  assert.match(actionBoundaryDetailText, /弱语义相似/);
  assert.match(actionBoundaryDetailText, /场景锚点/);
  assert.match(actionBoundaryDetailText, /项目 Falcon/);
  assert.match(actionBoundaryDetailText, /主题 owner handoff/);
  assert.match(actionBoundaryDetailText, /不强化访问计数/);
  await page.mouse.move(10, 10);
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
  assert.match(
    (await page.locator('.pai-context-recall-positive').getAttribute('aria-label')) || '',
    /标记这条记忆提示有用[\s\S]*提交 recall-quality 有用反馈[\s\S]*不会插入输入框、发送内容或确认事实/,
    '正向反馈应保留为轻量图标按钮并提前说明写入边界',
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
  assert.match(menuText, /站点控制回执/);
  assert.match(menuText, /当前站点/);
  assert.match(menuText, /当前状态/);
  assert.match(menuText, /当前未被静默\/屏蔽；被动提示可继续评估/);
  assert.match(menuText, /控制范围/);
  assert.match(menuText, /只影响右下角 Lens、页面召回、整页\/视觉入库候选/);
  assert.match(menuText, /允许操作/);
  assert.match(menuText, /会开启白名单并允许此站点；只影响被动网页处理/);
  assert.match(menuText, /今天不提示/);
  assert.match(menuText, /会保存 24 小时临时静默/);
  assert.match(menuText, /页面屏蔽/);
  assert.match(menuText, /会保存当前路径屏蔽/);
  assert.match(menuText, /屏蔽操作/);
  assert.match(menuText, /会保存当前站点屏蔽设置；只停止被动网页处理/);
  assert.match(menuText, /主动划词(?:检索)?仍可用/);
  assert.match(menuText, /不删除、不同步、不外发已有记忆/);
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
  assert.match(
    await page.locator('.pai-context-toast').innerText(),
    /白名单只控制被动网页处理/,
  );
  assert.match(
    await page.locator('.pai-context-toast').innerText(),
    /主动划词仍可用/,
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
  assert.match(
    await page.locator('.pai-context-toast').innerText(),
    /仅恢复被动网页提示规则/,
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
  await page.waitForFunction(
    () =>
      /正在记录有用反馈/.test(
        document.querySelector('.pai-context-toast')?.textContent || '',
      ),
    { timeout: 5000 },
  );
  assert.match(
    await page.locator('.pai-context-card').innerText(),
    /正在记录有用反馈；确认前不会当作已学习/,
    '正向反馈确认前应在卡片内显示 pending 回执',
  );
  assert.match(
    (await page.locator('.pai-context-recall-positive').getAttribute('aria-label')) || '',
    /正在记录这条记忆提示有用反馈[\s\S]*服务确认前不会当作已学习/,
    '正向反馈写入中应更新按钮可访问名称并保留确认前边界',
  );
  await waitForRequestCount(
    { contextRecallRequests: server.feedbackRequests },
    startFeedbackCount + 1,
    5000,
  );
  await page.waitForFunction(
    () =>
      /已记录为有用，后续会优先保留类似提示/.test(
        document.querySelector('.pai-context-toast')?.textContent || '',
      ),
    { timeout: 5000 },
  );
  assert.match(
    await page.locator('.pai-context-card').innerText(),
    /有用反馈已确认写入；后续类似提示会优先保留/,
    '正向反馈成功后应在卡片内显示服务确认回执',
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
  assert.match(
    (await page.locator('.pai-context-recall-positive').getAttribute('aria-label')) || '',
    /这条记忆提示有用反馈已确认写入[\s\S]*后续类似提示会优先保留/,
    '标记有用后应立即给出按钮状态反馈并保留服务确认边界',
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
  assert.match(toastText, /只暂停右下角 Lens、页面召回和被动入库候选/);
  assert.match(toastText, /主动划词仍可用/);
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
  const unmuteButton = optionsPage.getByRole('button', {
    name: /恢复 127\.0\.0\.1 的 24 小时临时静默/,
  });
  const unmuteBoundary = await unmuteButton.getAttribute('title');
  assert.match(
    unmuteBoundary || '',
    /只移除临时静默规则/,
    '临时静默恢复按钮 title 应说明只移除临时规则',
  );
  await unmuteButton.click();
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
    /建议动作/,
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
  assert.match(
    await unmutedPage.locator('.pai-context-toast').innerText(),
    /只关闭被动网页处理/,
  );
  assert.match(
    await unmutedPage.locator('.pai-context-toast').innerText(),
    /不删除已有记忆/,
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
  const unblockSiteButton = blockedOptionsPage.getByRole('button', {
    name: /移除 127\.0\.0\.1 的永久屏蔽/,
  });
  const unblockSiteBoundary = await unblockSiteButton.getAttribute('title');
  assert.match(
    unblockSiteBoundary || '',
    /只移除整站屏蔽规则/,
    '永久屏蔽恢复按钮 title 应说明只移除整站规则',
  );
  await unblockSiteButton.click();
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

async function verifyContextBubbleDrag(server, context) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 900, height: 720 });
  const diagnostics = attachPageDiagnostics(page, 'bubble-drag');
  const startCount = server.contextRecallRequests.length;
  await page.goto(`${server.origin}/normal?bubble-drag=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    '拖拽用例应先显示普通被动 Memory Lens',
  );

  const bubble = page.locator('.pai-context-bubble');
  const initialBox = await bubble.boundingBox();
  assert.ok(initialBox, '拖拽前 bubble 应有布局盒');

  await page.mouse.move(
    initialBox.x + initialBox.width / 2,
    initialBox.y + initialBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(172, 188, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(350);

  assert.equal(
    await page.locator('.pai-context-card:visible').count(),
    0,
    '拖拽结束不应误触发点击展开卡片',
  );

  const draggedBox = await bubble.boundingBox();
  assert.ok(draggedBox, '拖拽后 bubble 应仍有布局盒');
  assert.ok(
    draggedBox.x < initialBox.x - 300,
    `bubble 应移动到远离默认右下角的位置，拖拽前 x=${initialBox.x}，拖拽后 x=${draggedBox.x}`,
  );
  assert.ok(
    draggedBox.y < initialBox.y - 250,
    `bubble 应移动到远离默认右下角的位置，拖拽前 y=${initialBox.y}，拖拽后 y=${draggedBox.y}`,
  );

  await page.mouse.move(4, 4);
  await page.waitForTimeout(80);
  await bubble.dispatchEvent('pointerenter');
  await page.waitForSelector('.pai-context-peek.pai-context-peek--visible', {
    timeout: 5000,
  });
  const peekBox = await page.locator('.pai-context-peek').boundingBox();
  assert.ok(peekBox, '拖拽后 Hover Peek 应有布局盒');
  assert.ok(
    peekBox.x < initialBox.x - 250,
    `Hover Peek 应跟随拖拽后的 bubble 锚点，而不是停在默认右下角，peek x=${peekBox.x}`,
  );

  await bubble.click();
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  const cardBox = await page.locator('.pai-context-card').boundingBox();
  assert.ok(cardBox, '拖拽后 Expanded Card 应有布局盒');
  assert.ok(cardBox.x >= 0, '拖拽后 Expanded Card 不应超出左边界');
  assert.ok(
    cardBox.x + cardBox.width <= 900,
    '拖拽后 Expanded Card 不应超出右边界',
  );
  assert.ok(
    cardBox.x < initialBox.x - 250,
    `Expanded Card 应跟随拖拽后的 bubble 锚点，而不是停在默认右下角，card x=${cardBox.x}`,
  );

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  const resetBox = await page.locator('.pai-context-bubble').boundingBox();
  assert.ok(resetBox, '刷新后 bubble 应重新显示');
  assert.ok(
    resetBox.x > 900 - 100,
    `刷新后不应记住拖拽位置，应回到默认右下角，刷新后 x=${resetBox.x}`,
  );
  assert.ok(
    resetBox.y > 720 - 100,
    `刷新后不应记住拖拽位置，应回到默认右下角，刷新后 y=${resetBox.y}`,
  );

  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('Memory Lens 拖拽页面出现脚本异常');
  }
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
  assert.match(peekText, /只读提示/);
  assert.match(peekText, /不写入\/插入\/发送/);
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
  const cachedBubble = page.locator('.pai-context-bubble');
  await cachedBubble.hover();
  await page.waitForSelector('.pai-context-peek.pai-context-peek--visible', {
    timeout: 5000,
  });
  const cachedPeekText = await page.locator('.pai-context-peek').innerText();
  assert.match(
    cachedPeekText,
    /本地缓存 · .*召回；未重新请求/,
    '缓存恢复的 Hover Peek 应说明本次复用本地缓存而不是重新请求召回',
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
  const cardText = await page.locator('.pai-context-card').textContent();
  assert.match(
    cardText || '',
    /已保存资料：整页资料 \/ 主动保存/,
    'source memory card should explain that this is a saved source artifact',
  );
  assert.match(
    cardText || '',
    /主动保存/,
    'source memory compact metadata should expose capture mode',
  );
  assert.match(
    cardText || '',
    /整页资料/,
    'source memory compact metadata should expose source kind',
  );
  assert.match(
    cardText || '',
    /已保存资料来源可复核/,
    'source memory card should state that the saved source link is checkable',
  );
  assert.match(
    cardText || '',
    /资料详情可复核/,
    'source memory card should state that the capsule detail is checkable',
  );
  assert.match(
    cardText || '',
    /资料回执[\s\S]*已保存的 整页资料 \/ 主动保存/,
    'source memory card should expose a dedicated source-memory receipt',
  );
  assert.match(
    cardText || '',
    /蒸馏[\s\S]*已生成蒸馏提示/,
    'source memory receipt should expose distillation state',
  );
  assert.match(
    cardText || '',
    /复核[\s\S]*打开资料详情可核对保存原因、证据锚点、补备注或撤销/,
    'source memory receipt should explain the detail review path before action',
  );
  assert.match(
    cardText || '',
    /边界[\s\S]*本卡只读，不新增\/撤销资料记忆/,
    'source memory receipt should keep the no-write boundary visible',
  );

  const exploreHref = await page
    .locator('.pai-context-open-memory')
    .getAttribute('href');
  const exploreTitle = await page
    .locator('.pai-context-open-memory')
    .getAttribute('title');
  const exploreAriaLabel = await page
    .locator('.pai-context-open-memory')
    .getAttribute('aria-label');
  assert.ok(
    exploreHref?.includes('memory-exploring.html#/source-memory/web-memory-source-url-only'),
    `source memory explore link should open capsule detail: ${exploreHref}`,
  );
  assert.match(
    exploreTitle || '',
    /打开资料详情复核[\s\S]*不会新增或撤销资料记忆/,
    'source memory detail action should expose the no-write review boundary in title',
  );
  assert.equal(
    exploreAriaLabel,
    exploreTitle,
    'source memory detail action should expose the same review boundary to screen readers',
  );

  const visibleLinks = await page.$$eval('.pai-context-card a', (anchors) =>
    anchors.map((anchor) => ({
      text: anchor.textContent || '',
      href: anchor.href,
      title: anchor.getAttribute('title') || '',
      ariaLabel: anchor.getAttribute('aria-label') || '',
    })),
  );
  const sourceOnlyLink = visibleLinks.find(
    (link) =>
      link.text.includes('Falcon source-only evidence') &&
      link.href === 'https://source-only.example.com/falcon/handoff?ticket=PAI-123',
  );
  assert.ok(sourceOnlyLink, `sourceUrl 应在 Expanded Card 中作为可点击来源展示: ${JSON.stringify(visibleLinks)}`);
  assert.match(
    sourceOnlyLink.title,
    /打开已保存资料的原始来源[\s\S]*source-only\.example\.com[\s\S]*不确认事实/,
    'source memory original-source link should expose click consequences in title',
  );
  assert.equal(
    sourceOnlyLink.ariaLabel,
    sourceOnlyLink.title,
    'source memory original-source link should expose the same boundary to screen readers',
  );
  assert.equal(
    visibleLinks.filter((link) => link.href.includes('source-only.example.com')).length,
    1,
    'sourceUrl-only 来源链接不应重复渲染',
  );

  const sourceRoutePattern = 'https://source-only.example.com/**';
  await context.route(sourceRoutePattern, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><title>Falcon source-only evidence</title><main>Falcon source-only evidence</main>',
    });
  });
  try {
    const sourcePopupPromise = context.waitForEvent('page');
    await page
      .locator('.pai-context-source-link', {
        hasText: 'Falcon source-only evidence',
      })
      .click();
    const sourcePopup = await sourcePopupPromise;
    await sourcePopup.waitForURL(
      'https://source-only.example.com/falcon/handoff?ticket=PAI-123',
      { timeout: 5000 },
    );
    assert.equal(
      sourcePopup.url(),
      'https://source-only.example.com/falcon/handoff?ticket=PAI-123',
      '点击原始来源应打开安全净化后的来源 URL',
    );
    await sourcePopup.close();
  } finally {
    await context.unroute(sourceRoutePattern);
  }
  await page.waitForSelector('.pai-context-source-open-receipt', {
    state: 'visible',
    timeout: 5000,
  });
  const sourceOpenReceipt = await page
    .locator('.pai-context-source-open-receipt')
    .innerText();
  assert.match(sourceOpenReceipt, /来源打开回执/);
  assert.match(sourceOpenReceipt, /Falcon source-only evidence/);
  assert.match(sourceOpenReceipt, /打开原始来源/);
  assert.match(sourceOpenReceipt, /已保存资料来源可复核/);
  assert.match(sourceOpenReceipt, /不写入记忆/);
  assert.match(sourceOpenReceipt, /不确认事实/);
  const sourceOpenTrace = await waitForAmbientTrace(
    server,
    (trace) =>
      trace.action === 'opened_source' &&
      trace.evidenceRefs?.some((ref) => ref.id === 'web-memory-source-url-only'),
  );
  assert.equal(sourceOpenTrace.metadata?.contextSurface, 'web_passive_bubble');

  const detailPopupPromise = context.waitForEvent('page');
  await page.locator('.pai-context-open-memory').click();
  const detailPopup = await detailPopupPromise;
  assert.match(
    detailPopup.url(),
    /memory-exploring\.html#\/source-memory\/web-memory-source-url-only/,
    '点击记忆详情应打开资料详情路由',
  );
  await detailPopup.close();
  await page.waitForFunction(() => {
    const receipt = document.querySelector('.pai-context-source-open-receipt');
    return /资料详情/.test(receipt?.textContent || '');
  });
  const detailOpenReceipt = await page
    .locator('.pai-context-source-open-receipt')
    .innerText();
  assert.match(detailOpenReceipt, /资料详情/);
  assert.match(detailOpenReceipt, /资料详情可复核/);
  assert.match(detailOpenReceipt, /不插入输入框/);
  await waitForAmbientTrace(
    server,
    (trace) =>
      trace.action === 'opened_source' &&
      trace.evidenceRefs?.some((ref) => ref.id === 'web-memory-source-url-only') &&
      server.ambientCalibrationRequests.indexOf(trace) >
        server.ambientCalibrationRequests.indexOf(sourceOpenTrace),
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

async function verifySourceMemorySensitiveSourceHidden(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'source-url-sensitive');
  const startCount = server.contextRecallRequests.length;
  await page.goto(`${server.origin}/source-url-sensitive`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  try {
    await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  } catch (error) {
    log(
      `source URL sensitive bubble wait failed; context-recall requests=${server.contextRecallRequests.length - startCount}`,
    );
    for (const entry of diagnostics.slice(-20)) {
      log(entry);
    }
    throw error;
  }

  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    'sensitive source URL 页面应触发一次被动召回',
  );
  await page.locator('.pai-context-bubble').click();
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  const cardText = await page.locator('.pai-context-card').textContent();
  assert.match(
    cardText || '',
    /原始来源已隐藏/,
    'source memory card should disclose hidden sensitive source URLs',
  );
  assert.match(
    cardText || '',
    /资料详情可复核/,
    'source memory card should keep the capsule detail receipt when the raw source URL is hidden',
  );
  assert.match(
    cardText || '',
    /资料回执[\s\S]*原始来源未展示或已隐藏；仍保留资料详情复核入口/,
    'source memory receipt should explain hidden source while keeping detail review',
  );
  assert.match(
    cardText || '',
    /本卡只读，不新增\/撤销资料记忆/,
    'sensitive source memory receipt should retain the no-write boundary',
  );
  assert.doesNotMatch(
    cardText || '',
    /已保存资料来源可复核/,
    'source memory card should not claim the raw saved source is checkable when it was hidden',
  );

  const exploreHref = await page
    .locator('.pai-context-open-memory')
    .getAttribute('href');
  const exploreTitle = await page
    .locator('.pai-context-open-memory')
    .getAttribute('title');
  const exploreAriaLabel = await page
    .locator('.pai-context-open-memory')
    .getAttribute('aria-label');
  assert.ok(
    exploreHref?.includes('memory-exploring.html#/source-memory/web-memory-source-url-sensitive'),
    `sensitive source memory explore link should still open capsule detail: ${exploreHref}`,
  );
  assert.match(
    exploreTitle || '',
    /打开资料详情复核[\s\S]*不会新增或撤销资料记忆/,
    'hidden-source source memory detail action should still expose the no-write review boundary',
  );
  assert.equal(
    exploreAriaLabel,
    exploreTitle,
    'hidden-source source memory detail action should expose the same boundary to screen readers',
  );

  const visibleLinks = await page.$$eval('.pai-context-card a', (anchors) =>
    anchors.map((anchor) => ({
      text: anchor.textContent || '',
      href: anchor.href,
      title: anchor.getAttribute('title') || '',
      ariaLabel: anchor.getAttribute('aria-label') || '',
    })),
  );
  assert.equal(
    visibleLinks.some(
      (link) =>
        link.href.includes('token=') ||
        link.text.includes('Falcon sensitive source evidence'),
    ),
    false,
    `sensitive sourceUrl should not render as a visible card link: ${JSON.stringify(visibleLinks)}`,
  );

  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('敏感来源 URL 隐藏页面出现脚本异常');
  }
  await page.close();
}

async function verifySourceStatusReceipts(server, context) {
  const currentPage = await context.newPage();
  const currentDiagnostics = attachPageDiagnostics(currentPage, 'source-status-current');
  const startCurrentCount = server.contextRecallRequests.length;
  await currentPage.goto(
    `${server.origin}/source-status-current?utm_source=newsletter&b=2&a=1&fbclid=tracker#receipt-anchor`,
    {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    },
  );
  try {
    await currentPage.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  } catch (error) {
    log(
      `current source status bubble wait failed; context-recall requests=${server.contextRecallRequests.length - startCurrentCount}`,
    );
    for (const entry of currentDiagnostics.slice(-20)) {
      log(entry);
    }
    throw error;
  }
  await currentPage.locator('.pai-context-bubble').hover();
  await currentPage.waitForSelector('.pai-context-peek.pai-context-peek--visible', {
    timeout: 5000,
  });
  const currentPeekText = await currentPage.locator('.pai-context-peek').innerText();
  assert.match(
    currentPeekText,
    /个人记忆/,
    'Hover Peek should expose personal-scope evidence before opening the card',
  );
  await currentPage.locator('.pai-context-bubble').click();
  await currentPage.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  const currentCardText = await currentPage.locator('.pai-context-card').innerText();
  assert.match(
    currentCardText,
    /当前页面来源可复核/,
    'source status should call out when the card source is the current page',
  );
  assert.match(
    currentCardText,
    /个人记忆已进入本次提示/,
    'source status should call out personal-scope passive recall evidence',
  );
  assert.match(
    currentCardText,
    /个人记忆/,
    'compact metadata should show the recalled memory scope',
  );
  assert.match(
    currentCardText,
    /记忆详情可复核/,
    'source status should keep the memory detail route explicit',
  );
  if (currentDiagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of currentDiagnostics) {
      log(entry);
    }
    throw new Error('当前页来源状态回执页面出现脚本异常');
  }
  await currentPage.close();

  const stalePage = await context.newPage();
  const staleDiagnostics = attachPageDiagnostics(stalePage, 'source-status-stale');
  const startStaleCount = server.contextRecallRequests.length;
  await stalePage.goto(`${server.origin}/source-status-stale`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  try {
    await stalePage.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  } catch (error) {
    log(
      `stale source status bubble wait failed; context-recall requests=${server.contextRecallRequests.length - startStaleCount}`,
    );
    for (const entry of staleDiagnostics.slice(-20)) {
      log(entry);
    }
    throw error;
  }
  await stalePage.locator('.pai-context-bubble').hover();
  await stalePage.waitForSelector('.pai-context-peek.pai-context-peek--visible', {
    timeout: 5000,
  });
  const stalePeekText = await stalePage.locator('.pai-context-peek').innerText();
  assert.match(
    stalePeekText,
    /个人记忆/,
    'Hover Peek should keep scope visible for stale personal memories',
  );
  assert.match(
    stalePeekText,
    /120天前记录，行动前复核/,
    'Hover Peek should warn about stale evidence before opening the card',
  );
  await stalePage.locator('.pai-context-bubble').click();
  await stalePage.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  const staleCardText = await stalePage.locator('.pai-context-card').innerText();
  assert.match(
    staleCardText,
    /外部来源可复核/,
    'source status should call out external source provenance',
  );
  assert.match(
    staleCardText,
    /120天前记录，行动前复核/,
    'stale source status should warn users to re-check before acting',
  );
  if (staleDiagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of staleDiagnostics) {
      log(entry);
    }
    throw new Error('陈旧来源状态回执页面出现脚本异常');
  }
  await stalePage.close();
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
  const emptyAllowlistStatus = await optionsPage
    .locator('.context-site-control-status')
    .innerText();
  assert.match(emptyAllowlistStatus, /站点控制状态/);
  assert.match(emptyAllowlistStatus, /白名单模式：只允许 0 个站点及其子域名被动提示/);
  assert.match(
    emptyAllowlistStatus,
    /白名单已开启但没有允许站点：普通网页被动提示全部保持静默/,
  );
  assert.match(
    emptyAllowlistStatus,
    /右下角 Lens、页面召回、整页\/视觉入库候选/,
  );
  assert.match(emptyAllowlistStatus, /主动划词检索仍可用/);
  assert.match(emptyAllowlistStatus, /不删除、不同步、不外发已有记忆，也不反写当前网站/);
  const allowlistToggleBoundary = await optionsPage
    .getByRole('checkbox', { name: /关闭白名单模式，恢复默认站点规则/ })
    .getAttribute('title');
  assert.match(
    allowlistToggleBoundary || '',
    /主动划词仍可用；不会写入、删除、同步或外发已有记忆/,
    '白名单开关 hover 边界应说明主动划词和无写入外发',
  );
  await optionsPage.getByLabel('添加允许站点').fill('127.0.0.1');
  const allowButton = optionsPage.getByRole('button', {
    name: /把 127\.0\.0\.1 加入允许站点列表/,
  });
  const allowButtonBoundary = await allowButton.getAttribute('title');
  assert.match(
    allowButtonBoundary || '',
    /移除覆盖它的静默\/屏蔽冲突/,
    '允许站点按钮 title 应在点击前说明冲突清理',
  );
  assert.match(
    allowButtonBoundary || '',
    /主动划词仍可用；不会写入、删除、同步或外发已有记忆/,
    '允许站点按钮 title 应在点击前说明主动划词和无写入外发',
  );
  await allowButton.click();
  await optionsPage.waitForSelector('text=已允许 127.0.0.1 显示网页记忆提示', {
    timeout: 5000,
  });
  await optionsPage.waitForSelector(
    'text=此站点在允许列表内，已打开页面会实时重新评估右下角 Lens、页面召回和被动入库候选',
    { timeout: 5000 },
  );
  await optionsPage.waitForSelector('text=允许站点 · 添加于', {
    timeout: 5000,
  });
  const allowedStatus = await optionsPage
    .locator('.context-site-control-status')
    .innerText();
  assert.match(allowedStatus, /白名单模式：只允许 1 个站点及其子域名被动提示/);
  assert.match(allowedStatus, /1 个允许站点外会保持静默/);

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
  await allowedPage.locator('.pai-context-bubble').click();
  await allowedPage.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  await openContextMoreMenu(allowedPage);
  const allowedMenuText = await allowedPage
    .locator('.pai-context-more-menu:not([hidden])')
    .innerText();
  assert.match(allowedMenuText, /白名单已包含此站点：127\.0\.0\.1/);
  assert.match(allowedMenuText, /此站点已经允许；不会重复改写规则/);
  assert.match(
    allowedMenuText,
    /会保存当前站点屏蔽设置，并移除 1 条允许\/静默\/旧屏蔽覆盖规则/,
  );
  await allowedPage.close();

  const removeAllowedButton = optionsPage.getByRole('button', {
    name: /从允许站点列表移除 127\.0\.0\.1/,
  });
  const removeAllowedBoundary = await removeAllowedButton.getAttribute('title');
  assert.match(
    removeAllowedBoundary || '',
    /白名单模式会让此站点被动提示保持静默/,
    '移除允许站点按钮 title 应说明白名单模式下的后果',
  );
  await removeAllowedButton.click();
  await optionsPage.waitForSelector(
    'text=白名单模式仍会让此站点的被动提示保持静默，除非重新加入允许列表',
    { timeout: 5000 },
  );
  await optionsPage.waitForSelector('text=主动划词仍可用', {
    timeout: 5000,
  });
  await optionsPage.waitForSelector('text=不会写入、删除、同步或外发已有记忆', {
    timeout: 5000,
  });
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
  await optionsPage
    .getByRole('button', { name: /把 docs\.lvh\.me 加入允许站点列表/ })
    .click();
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
  const blockedToast = page.locator('.pai-context-toast', {
    hasText: '站点控制已生效',
  });
  await blockedToast.waitFor({ timeout: 5000 });
  const blockedToastText = (await blockedToast.textContent()) || '';
  assert.match(blockedToastText, /站点已永久屏蔽：127\.0\.0\.1/);
  assert.match(blockedToastText, /已清除右下角 Lens、页面召回和被动入库候选/);
  assert.match(blockedToastText, /主动划词仍可用/);
  assert.match(blockedToastText, /不会删除、同步或外发已有记忆/);

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
  const restoredToast = page.locator('.pai-context-toast', {
    hasText: '站点控制已恢复',
  });
  await restoredToast.waitFor({ timeout: 5000 });
  const restoredToastText = (await restoredToast.textContent()) || '';
  assert.match(restoredToastText, /重新评估右下角 Lens、页面召回和被动入库候选/);
  assert.match(restoredToastText, /主动划词仍受敏感页保护/);
  assert.match(restoredToastText, /不会写入、删除或外发记忆/);
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
  assert.match(
    await page.locator('.pai-context-toast').innerText(),
    /只关闭此路径下的被动 Lens、页面召回和整页\/视觉入库候选/,
  );
  assert.match(
    await page.locator('.pai-context-toast').innerText(),
    /主动划词仍可用/,
  );
  assert.match(
    await page.locator('.pai-context-toast').innerText(),
    /不会删除、同步或外发已有记忆/,
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
  assert.match(
    await page.locator('.pai-context-toast').innerText(),
    /主动划词仍受敏感页保护/,
  );
  assert.match(
    await page.locator('.pai-context-toast').innerText(),
    /不会写入、删除或外发记忆/,
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
  assert.match(
    await page.locator('.pai-context-toast').innerText(),
    /主动划词仍可用/,
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
  const escapedBlockedPrefix = blockedPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const restorePathButton = optionsPage.getByRole('button', {
    name: new RegExp(`移除 ${escapedBlockedPrefix} 的页面路径屏蔽`),
  });
  const restorePathBoundary = await restorePathButton.getAttribute('title');
  assert.match(
    restorePathBoundary || '',
    /只恢复该路径被动候选资格/,
    '页面路径恢复按钮 title 应说明只恢复路径被动候选资格',
  );
  await restorePathButton.click();
  await optionsPage.waitForSelector('text=不会写入、删除、同步或外发已有记忆', {
    timeout: 5000,
  });
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
  await page.locator('.pai-context-recall-positive').click();
  await waitForRequestCount(
    { contextRecallRequests: server.feedbackRequests },
    startFeedbackCount + 1,
    5000,
  );
  assert.deepEqual(
    {
      targetId: server.feedbackRequests[startFeedbackCount].targetId,
      action: server.feedbackRequests[startFeedbackCount].action,
    },
    {
      targetId: 'web-memory-feedback-failure',
      action: 'positive',
    },
    '失败夹具的正向反馈应先尝试写入真实 feedback endpoint',
  );
  await page.waitForFunction(
    () =>
      /反馈记录失败/.test(
        document.querySelector('.pai-context-toast')?.textContent || '',
      ),
    { timeout: 5000 },
  );
  assert.match(
    await page.locator('.pai-context-card').innerText(),
    /反馈写入失败：.*本次没有学习成功/,
    '正向反馈失败后应在卡片内显示未学习成功回执',
  );
  assert.equal(
    await page.locator('.pai-context-recall-positive').isDisabled(),
    false,
    '正向反馈失败后应解锁有用按钮，允许用户重试',
  );
  assert.equal(
    await page.locator('.pai-context-recall-negative').isDisabled(),
    false,
    '正向反馈失败后不应锁住不相关反馈',
  );
  await chooseNegativeFeedbackReason(page, 'generic_topic_overlap');
  await waitForRequestCount(
    { contextRecallRequests: server.feedbackRequests },
    startFeedbackCount + 2,
    5000,
  );
  assert.equal(
    server.feedbackRequests[startFeedbackCount + 1].targetId,
    'web-memory-feedback-failure',
    '失败夹具应先尝试写入真实 feedback endpoint',
  );
  const feedbackFailureDetail = parseFeedbackDetail(
    server.feedbackRequests[startFeedbackCount + 1].detail,
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
    await page.locator('.pai-composer-guard-icon-button').isVisible(),
    true,
    'Jira 阅读态 fixture 应保留可见的 Compose Assist 预渲染图标',
  );
  assert.equal(
    await page.evaluate(() => document.activeElement?.tagName),
    'BODY',
    'Jira 阅读态 fixture 不应把焦点放进评论编辑器',
  );

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
  await page.evaluate(() => {
    const lateField = document.createElement('div');
    lateField.textContent = 'DEV Estimate: 3';
    document.querySelector('main')?.appendChild(lateField);
  });
  await page.waitForTimeout(2200);
  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    'Jira 延迟字段重绘不应把同一 issue 当作新页面再次召回',
  );
  assert.equal(
    await page.locator('.pai-context-bubble').count(),
    1,
    'Jira 延迟字段重绘不应移除已有 Lens 图标',
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
  assert.equal(
    await page.locator('.pai-context-selection-trigger .pai-context-selection-recall').count(),
    1,
    '强相关划词命中时选区 toolbar 应显示查关联记忆按钮',
  );
  assert.equal(
    await page.locator('.pai-context-selection-trigger .pai-memory-capture-selection-dock').count(),
    0,
    '记住入口不再塞进划词 toolbar，应与查关联记忆 icon 分离',
  );
  await page.waitForSelector('.pai-memory-capture-selection-dock', {
    timeout: 5000,
  });
  assert.equal(
    await page.locator('.pai-memory-capture-selection-dock').count(),
    1,
    '强相关划词命中且选区可记住时应在页面最右侧半露出独立的 记住 +',
  );
  assert.equal(
    await page.locator('.pai-memory-capture-selection-dock').getAttribute('aria-label'),
    '记住这段选中资料，尚未写入；点击后先复核',
    '划词记住入口应在可访问名称里说明点击前尚未写入',
  );
  assert.match(
    await page.locator('.pai-memory-capture-selection-dock').getAttribute('title'),
    /这段选中资料尚未写入；点击后先复核，不会因点击直接保存、外发或同步/,
    '划词记住入口 title 应说明点击只打开复核，不会直接保存',
  );
  await page.locator('.pai-memory-capture-selection-dock').hover();
  await page.waitForFunction(
    () => /未写入 · 先复核/.test(document.querySelector('.pai-memory-capture-selection-dock')?.textContent || ''),
    { timeout: 5000 },
  );
  assert.match(
    await page.locator('.pai-memory-capture-selection-dock').innerText(),
    /未写入 · 先复核/,
    '划词记住入口 hover 展开后应前置未写入和先复核状态',
  );
  assert.match(
    await page.locator('.pai-context-selection-trigger').getAttribute('aria-label'),
    /查找关联记忆/,
    '选区 toolbar 现在只负责查找关联记忆',
  );
  assert.match(
    await page.locator('.pai-context-selection-recall').getAttribute('aria-label'),
    /查找已有记忆，不保存、不插入、不发送、不调用外部 AI/,
    '划词查记忆 icon 应在无 hover 时也有明确的可访问边界',
  );
  await page.locator('.pai-context-selection-recall').hover();
  await page.waitForSelector('.pai-context-selection-tooltip', {
    state: 'visible',
    timeout: 5000,
  });
  const selectionTooltipText = await page.locator('.pai-context-selection-tooltip').innerText();
  assert.match(
    selectionTooltipText,
    /查已有记忆/,
    '划词查记忆 hover tooltip 应命名当前动作',
  );
  assert.match(
    selectionTooltipText,
    /不保存、不插入、不发送、不调用外部 AI/,
    '划词查记忆 hover tooltip 应说明它不是保存、插入、发送或外部 AI 调用',
  );
  assert.equal(
    await page.locator('.pai-context-selection-trigger').getAttribute('data-tooltip-placement'),
    'bottom',
    '靠近视口顶部的划词 icon 应把 tooltip 放到下方，避免边界说明被裁切',
  );
  const selectionTriggerBox = await page.locator('.pai-context-selection-trigger').boundingBox();
  const selectionTooltipBox = await page.locator('.pai-context-selection-tooltip').boundingBox();
  assert.ok(selectionTriggerBox, '应能读取划词 icon 位置');
  assert.ok(selectionTooltipBox, '应能读取划词 tooltip 位置');
  assert.ok(
    selectionTooltipBox.y >= 0,
    '划词 tooltip 不应被视口顶部裁切',
  );
  assert.ok(
    selectionTooltipBox.y >= selectionTriggerBox.y + selectionTriggerBox.height - 1,
    '顶部选区的划词 tooltip 应显示在 icon 下方',
  );
  const captureDockGeom = await page
    .locator('.pai-memory-capture-selection-dock')
    .evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        centerX: rect.x + rect.width / 2,
        viewportWidth: window.innerWidth,
      };
    });
  assert.ok(
    Math.abs(captureDockGeom.centerX - captureDockGeom.viewportWidth) <= 4,
    '记住 + 应吸附在视口最右侧边缘半露出，而不是跟随选区展示',
  );
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
    () =>
      !document.querySelector('.pai-context-selection-trigger') &&
      !document.querySelector('.pai-memory-capture-selection-dock'),
    { timeout: 1000 },
  );
  await waitForRequestCount(server, startCount + 3, 5000);
  await page.waitForTimeout(240);
  assert.equal(
    await page.locator('.pai-context-selection-trigger').count(),
    0,
    '选中新文本时应立即清掉上一条划词 icon，并重新请求后只在新选区强命中时显示',
  );
  assert.equal(
    await page.locator('.pai-memory-capture-selection-dock').count(),
    0,
    '选中新文本时应同时清掉上一条记住 +',
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
  assert.match(selectionCardText, /打开/);
  assert.match(
    selectionCardText,
    /点击只打开已命中的本轮划词结果/,
    '划词卡片应说明点击 icon 只是打开已命中的结果',
  );
  assert.match(
    selectionCardText,
    /不二次召回、不保存、不插入、不发送、不调用外部 AI/,
    '划词卡片应说明打开不会重新召回或产生写入/外发副作用',
  );
  assert.match(selectionCardText, /候选/);
  assert.match(
    selectionCardText,
    /本轮 \d+ 条强相关候选；当前第 \d+ 条/,
    '划词卡片应说明本轮已命中候选数量',
  );
  assert.match(
    selectionCardText,
    /选中文本锚点：falcon/i,
    '划词卡片应显示当前候选回到选中文字的锚点',
  );
  assert.match(selectionCardText, /查询/);
  assert.match(selectionCardText, /只用选中文字作为主检索文本/);
  assert.match(selectionCardText, /背景/);
  assert.match(selectionCardText, /页面标题\/附近段落只作辅助上下文/);
  assert.match(selectionCardText, /命中门槛/);
  assert.match(selectionCardText, /只有选中文字本身有具体锚点才显示入口/);
  assert.match(selectionCardText, /背景命中不会单独弹出/);
  assert.match(selectionCardText, /边界/);
  assert.match(selectionCardText, /主动划词，不受被动站点静默或屏蔽控制影响/);
  assert.match(selectionCardText, /安全/);
  assert.match(selectionCardText, /敏感页\/密钥类选区仍拦截/);
  assert.match(selectionCardText, /不自动入库、插入或发给外部 AI/);
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
    await emptyPage.locator('.pai-context-selection-trigger').count(),
    0,
    'selected_text 没有高相关记忆时不应显示查记忆 toolbar',
  );
  assert.equal(
    await emptyPage.locator('.pai-memory-capture-selection-dock').count(),
    1,
    'selected_text 没有高相关记忆但有保存候选时应在右侧半露出独立的 记住 +',
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
  const selectionReviewText = await emptyPage.locator('.pai-memory-capture-note-panel').innerText();
  assert.match(
    selectionReviewText,
    /保存范围：选区资料/,
    '选区入库复核面板应说明保存对象是选区资料',
  );
  assert.match(
    selectionReviewText,
    /工作记忆/,
    '选区入库复核面板应说明当前写入的记忆范围',
  );
  assert.match(
    selectionReviewText,
    /来源 127\.0\.0\.1:\d+/,
    '选区入库复核面板应显示当前来源 host',
  );
  assert.match(
    selectionReviewText,
    /资料记忆和网页检索信号/,
    '选区入库复核面板应说明会写入资料记忆和网页检索信号',
  );
  assert.match(
    selectionReviewText,
    /选区快照/,
    '选区入库复核面板应命名将被保存的选区快照',
  );
  assert.match(
    selectionReviewText,
    /将保存下方约 \d+ 字的选中文字/,
    '选区入库复核面板应说明正文预览就是将写入的选中文字快照',
  );
  assert.match(
    selectionReviewText,
    /备注只补充保存原因，不会重新抓取页面或改成当前新的选区/,
    '选区入库复核面板应说明备注不会重扫页面或改用新选区',
  );
  assert.match(
    selectionReviewText,
    /若页面或选区已变化，请取消后重新选择再点 \+ 记住/,
    '选区入库复核面板应给出选区变化后的恢复路径',
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
    '取消保存后应保留右侧 记住 + 入口，方便用户再次确认',
  );

  await emptyPage.locator('.pai-memory-capture-selection-dock').click();
  await emptyPage.locator('.pai-memory-capture-note-input').fill('触发失败');
  await emptyPage.locator('.pai-memory-capture-note-save').click();
  await emptyPage.waitForFunction(
    () => /选区资料未写入/.test(document.querySelector('.pai-memory-capture-note-error')?.textContent || ''),
    { timeout: 5000 },
  );
  const selectionFailureText = await emptyPage.locator('.pai-memory-capture-note-error').innerText();
  assert.match(
    selectionFailureText,
    /选区资料未写入/,
    '选区保存失败应说明选区资料没有写入',
  );
  assert.match(
    selectionFailureText,
    /没有创建资料记忆或网页检索信号/,
    '选区保存失败应说明没有创建 capsule 或 web 检索信号',
  );
  assert.match(
    selectionFailureText,
    /入口仍保留，可重试/,
    '选区保存失败应给出可恢复路径',
  );
  assert.equal(
    server.sourceMemoryCreateRequests.length,
    createStartCount,
    '选区保存失败时不应记录成功创建的 source memory capsule',
  );
  assert.equal(
    await emptyPage.locator('.pai-memory-capture-selection-dock').count(),
    1,
    '选区保存失败后应保留右侧 记住 + 入口',
  );
  await emptyPage.locator('.pai-memory-capture-note-input').fill('用于后续整理');
  await emptyPage.locator('.pai-memory-capture-note-save').click();
  await waitForCapturedSourceMemoryCount(server, createStartCount + 1, 5000);
  const savedSourceMemory = server.sourceMemoryCreateRequests.at(-1);
  assert.equal(savedSourceMemory.sourceKind, 'selection');
  assert.equal(savedSourceMemory.note, '用于后续整理');
  assert.match(savedSourceMemory.selectedText, /Unmatched launch phrase/);
  assert.equal(savedSourceMemory.interactions?.manualClick, true);
  await emptyPage.waitForSelector('.pai-memory-capture-selection-dock', {
    state: 'detached',
    timeout: 5000,
  });
  assert.equal(
    await emptyPage.locator('.pai-memory-capture-selection-dock').count(),
    0,
    '确认保存后应清掉右侧 记住 +',
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
  assert.match(
    await emptyPage.locator('.pai-context-toast').innerText(),
    /资料记忆已写入[\s\S]*不会自动外发/,
    '确认保存后应展示后端写入回执和非外发边界',
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
  await detailPage.waitForSelector('.source-memory-detail-note-panel', {
    timeout: 5000,
  });
  const sourceMemoryNotePanel = detailPage.locator('.source-memory-detail-note-panel');
  const sourceMemoryNotePanelText = await sourceMemoryNotePanel.innerText();
  assert.match(
    sourceMemoryNotePanelText,
    /补备注并刷新蒸馏/,
    'source-memory 详情页应提供补备注并刷新蒸馏入口',
  );
  assert.match(
    sourceMemoryNotePanelText,
    /不会自动写画像、创建任务或同步外部系统/,
    '补备注入口应说明不会自动升级为画像、任务或外部同步',
  );
  await sourceMemoryNotePanel
    .locator('.source-memory-detail-note-input')
    .fill('用于后续整理 source pack 复核');
  await sourceMemoryNotePanel.locator('.primary-action').click();
  await sourceMemoryNotePanel
    .locator('.note-update-receipt.pending')
    .waitFor({ timeout: 5000 });
  const pendingNoteReceipt = await sourceMemoryNotePanel
    .locator('.note-update-receipt.pending')
    .innerText();
  assert.match(
    pendingNoteReceipt,
    /备注刷新提交中/,
    '提交后应先显示备注刷新 pending 回执',
  );
  assert.match(
    pendingNoteReceipt,
    /尚未确认刷新/,
    'pending 回执应说明备注、web 信号和蒸馏尚未确认',
  );
  assert.match(
    pendingNoteReceipt,
    /不会自动写用户画像、创建任务、确认新事实或同步外部系统/,
    'pending 回执应保留非画像/非任务/非外部同步边界',
  );
  await sourceMemoryNotePanel
    .locator('.note-update-receipt.success')
    .waitFor({ timeout: 5000 });
  const successNoteReceipt = await sourceMemoryNotePanel
    .locator('.note-update-receipt.success')
    .innerText();
  assert.match(
    successNoteReceipt,
    /最近操作：备注已更新/,
    '成功后应展示后端 actionReceipt 的备注更新状态',
  );
  assert.match(
    successNoteReceipt,
    /资料蒸馏：Ready/,
    '成功后应展示刷新后的资料蒸馏状态',
  );
  assert.match(
    await detailPage.locator('.distillation-panel').innerText(),
    /用于后续整理 source pack 复核/,
    '备注更新成功后首屏资料蒸馏回执应刷新一行提示',
  );
  await sourceMemoryNotePanel
    .locator('.source-memory-detail-note-input')
    .fill('触发失败');
  await sourceMemoryNotePanel.locator('.primary-action').click();
  await sourceMemoryNotePanel
    .locator('.note-update-receipt.error')
    .waitFor({ timeout: 5000 });
  const failedNoteReceipt = await sourceMemoryNotePanel
    .locator('.note-update-receipt.error')
    .innerText();
  assert.match(
    failedNoteReceipt,
    /备注刷新未确认/,
    '备注刷新失败时应显示未确认回执',
  );
  assert.match(
    failedNoteReceipt,
    /没有确认更新备注、刷新 web 检索信号或重新生成资料蒸馏/,
    '失败回执应说明没有确认任何资料或蒸馏刷新',
  );
  await detailPage.close();
  if (emptyDiagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of emptyDiagnostics) {
      log(entry);
    }
    throw new Error('无命中划词页面出现脚本异常');
  }
  await emptyPage.close();

  const backgroundOnlyPage = await context.newPage();
  const backgroundOnlyDiagnostics = attachPageDiagnostics(backgroundOnlyPage, 'selected-text-background-only');
  const backgroundOnlyStartCount = server.contextRecallRequests.length;
  await backgroundOnlyPage.goto(`${server.origin}/selected-background-only`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await backgroundOnlyPage.waitForTimeout(2600);
  const backgroundOnlyAfterInitialCount = server.contextRecallRequests.length;
  assert.ok(
    backgroundOnlyAfterInitialCount <= backgroundOnlyStartCount + 1,
    '背景命中划词页面最多允许普通被动召回尝试',
  );
  await backgroundOnlyPage.evaluate(() => {
    const section = document.querySelector('#selected-background-only-section');
    if (!section?.firstChild) throw new Error('missing selected background-only section');
    const text = section.firstChild.textContent || '';
    const phrase = 'customer communication follow-up wording';
    const range = document.createRange();
    range.setStart(section.firstChild, text.indexOf(phrase));
    range.setEnd(section.firstChild, text.indexOf(phrase) + phrase.length);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await waitForRequestCount(server, backgroundOnlyAfterInitialCount + 1, 5000);
  assert.equal(
    server.contextRecallRequests.at(-1)?.contextType,
    'selected_text',
    '背景命中划词也应先完成 selected_text 匹配',
  );
  assert.match(
    String(server.contextRecallRequests.at(-1)?.primaryText || ''),
    /customer communication follow-up wording/,
    '背景命中用例仍应只把选中文字作为 primaryText',
  );
  assert.ok(
    server.contextRecallRequests.at(-1)?.secondaryTexts?.some((item) =>
      /Falcon owner handoff/.test(String(item || '')),
    ),
    '背景命中用例应把附近 Falcon 段落作为 background context',
  );
  await backgroundOnlyPage.waitForSelector('.pai-memory-capture-selection-dock', {
    timeout: 5000,
  });
  assert.equal(
    await backgroundOnlyPage.locator('.pai-context-selection-trigger').count(),
    0,
    '只有 secondaryTexts 背景命中的 p1 结果不应显示划词查记忆入口',
  );
  assert.equal(
    await backgroundOnlyPage.locator('.pai-context-selection-recall').count(),
    0,
    '背景命中不能退化成可点击的 Selection Memory Search 按钮',
  );
  assert.equal(
    await backgroundOnlyPage.locator('.pai-memory-capture-selection-dock').count(),
    1,
    '背景命中但选区可保存时仍应保留右侧独立 记住 + 入口',
  );
  if (backgroundOnlyDiagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of backgroundOnlyDiagnostics) {
      log(entry);
    }
    throw new Error('背景命中划词页面出现脚本异常');
  }
  await backgroundOnlyPage.close();

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

  const repeatedPage = await context.newPage();
  const repeatedDiagnostics = attachPageDiagnostics(repeatedPage, 'selected-text-repeated-context');
  const repeatedStartCount = server.contextRecallRequests.length;
  await repeatedPage.goto(`${server.origin}/selected-same-text-context`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await repeatedPage.waitForTimeout(2600);
  const repeatedAfterInitialCount = server.contextRecallRequests.length;
  assert.ok(
    repeatedAfterInitialCount <= repeatedStartCount + 1,
    '同词不同段落页面最多允许一次普通被动召回尝试',
  );

  await repeatedPage.evaluate(() => {
    const section = document.querySelector('#falcon-repeat');
    if (!section?.firstChild) throw new Error('missing first repeated section');
    const text = section.firstChild.textContent || '';
    const phrase = 'owner handoff checklist';
    const range = document.createRange();
    range.setStart(section.firstChild, text.indexOf(phrase));
    range.setEnd(section.firstChild, text.indexOf(phrase) + phrase.length);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await repeatedPage.waitForSelector('.pai-context-selection-trigger', {
    timeout: 5000,
  });
  await waitForRequestCount(server, repeatedAfterInitialCount + 1, 5000);
  const firstRepeatedSelectionRequest = server.contextRecallRequests.at(-1);
  assert.equal(firstRepeatedSelectionRequest?.contextType, 'selected_text');
  assert.match(
    String(firstRepeatedSelectionRequest?.primaryText || ''),
    /owner handoff checklist/,
    '第一次重复短语选择应以选中文字作为 primaryText',
  );
  assert.ok(
    firstRepeatedSelectionRequest?.secondaryTexts?.some((item) =>
      /Falcon launch notes/.test(String(item || '')),
    ),
    '第一次重复短语选择应把 Falcon 段落作为 background context',
  );

  await repeatedPage.evaluate(() => {
    const section = document.querySelector('#orion-repeat');
    if (!section?.firstChild) throw new Error('missing second repeated section');
    const text = section.firstChild.textContent || '';
    const phrase = 'owner handoff checklist';
    const range = document.createRange();
    range.setStart(section.firstChild, text.indexOf(phrase));
    range.setEnd(section.firstChild, text.indexOf(phrase) + phrase.length);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await waitForRequestCount(server, repeatedAfterInitialCount + 2, 5000);
  const secondRepeatedSelectionRequest = server.contextRecallRequests.at(-1);
  assert.equal(secondRepeatedSelectionRequest?.contextType, 'selected_text');
  assert.match(
    String(secondRepeatedSelectionRequest?.primaryText || ''),
    /owner handoff checklist/,
    '第二次重复短语选择仍应只把选中文字作为 primaryText',
  );
  assert.ok(
    secondRepeatedSelectionRequest?.secondaryTexts?.some((item) =>
      /Orion renewal notes/.test(String(item || '')),
    ),
    '同页相同选中文字切到不同段落时应重新召回并携带新的 background context',
  );
  await repeatedPage.waitForSelector('.pai-context-selection-trigger', {
    timeout: 5000,
  });
  await repeatedPage.locator('.pai-context-selection-recall').click();
  await repeatedPage.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  assert.match(
    await repeatedPage.locator('.pai-context-card').innerText(),
    /Selected text Orion owner handoff/,
    '同页相同选中文字切换到第二个段落时不应复用第一段的划词结果',
  );
  if (repeatedDiagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of repeatedDiagnostics) {
      log(entry);
    }
    throw new Error('同词不同段落划词页面出现脚本异常');
  }
  await repeatedPage.close();
}

async function verifyPageCaptureInlineReview(server, context, serviceWorker) {
  await serviceWorker.evaluate(
    async ({ blockStorageKey }) => {
      await chrome.storage.local.set({ [blockStorageKey]: {} });
    },
    { blockStorageKey: siteBlockStorageKey },
  );

  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'page-capture-review');
  const createStartCount = server.sourceMemoryCreateRequests.length;
  await page.goto(`${server.origin}/page-capture-review`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
    document.dispatchEvent(new Event('copy'));
  });
  await page.waitForSelector('.pai-memory-capture-page-chip', {
    timeout: 7000,
  });
  const pageCaptureChip = page.locator('.pai-memory-capture-page-chip');
  assert.equal(
    await pageCaptureChip.getAttribute('aria-label'),
    '建议记住当前页面资料，尚未写入，点击后先复核',
    '整页入库建议入口应在读屏文案里说明尚未写入且会先复核',
  );
  assert.match(
    await pageCaptureChip.getAttribute('title'),
    /当前页面资料尚未写入[\s\S]*不会因点击直接保存、外发或同步/,
    '整页入库建议入口 hover title 应说明点击前没有写入和外发',
  );
  assert.match(
    await pageCaptureChip.getAttribute('title'),
    /页面快照：将保存[\s\S]*Falcon page capture review packet/,
    '整页入库建议入口 hover title 应说明将保存哪一个页面快照',
  );
  assert.match(
    await pageCaptureChip.getAttribute('title'),
    /触发依据：[\s\S]*复制过页面内容[\s\S]*阅读深度/,
    '整页入库建议入口 hover title 应说明本机触发依据',
  );
  assert.equal(
    server.sourceMemoryCreateRequests.length,
    createStartCount,
    '整页入库建议入口出现时不应立即保存 source memory capsule',
  );
  await pageCaptureChip.hover();
  await page.waitForFunction(
    () => {
      const receipt = document.querySelector('.pai-memory-capture-page-chip-receipt');
      if (!receipt || receipt.textContent?.trim() !== '未写入 · 先复核') return false;
      const style = window.getComputedStyle(receipt);
      return style.opacity !== '0' && Number.parseFloat(style.width) > 0;
    },
    { timeout: 5000 },
  );

  await pageCaptureChip.click();
  await page.waitForSelector('.pai-page-memory-capture-review-panel', {
    timeout: 5000,
  });
  const reviewText = await page.locator('.pai-page-memory-capture-review-panel').innerText();
  assert.match(reviewText, /保存当前页面资料/);
  assert.match(reviewText, /Falcon page capture review packet/);
  assert.match(
    reviewText,
    /保存范围：当前页面资料/,
    '整页入库复核面板应说明保存对象是当前页面资料',
  );
  assert.match(
    reviewText,
    /工作记忆/,
    '整页入库复核面板应说明当前写入的记忆范围',
  );
  assert.match(
    reviewText,
    /来源 127\.0\.0\.1:\d+/,
    '整页入库复核面板应显示当前来源 host',
  );
  assert.match(
    reviewText,
    /资料记忆和网页检索信号/,
    '整页入库复核面板应说明会写入资料记忆和网页检索信号',
  );
  assert.match(
    reviewText,
    /页面快照：将保存[\s\S]*Falcon page capture review packet/,
    '整页入库复核面板应显示保存使用的页面快照基准',
  );
  assert.match(
    reviewText,
    /不会重新抓取页面或改成之后滚动、跳转后的内容/,
    '整页入库复核面板应说明备注不会把保存目标改成后续页面状态',
  );
  assert.match(
    reviewText,
    /触发依据：[\s\S]*当前浏览器本地行为信号[\s\S]*不代表系统确认页面事实/,
    '整页入库复核面板应说明触发依据来自本地行为信号且不确认页面事实',
  );
  assert.match(
    await page.locator('.pai-memory-capture-note-preview').innerText(),
    /Falcon webpage capture review notes/,
    '整页入库复核面板应展示当前页面内容预览',
  );
  assert.equal(
    server.sourceMemoryCreateRequests.length,
    createStartCount,
    '打开整页入库复核面板不应立即保存 source memory capsule',
  );

  await page.getByRole('button', { name: '取消' }).click();
  await page.waitForSelector('.pai-page-memory-capture-review-panel', {
    state: 'detached',
    timeout: 5000,
  });
  assert.equal(
    server.sourceMemoryCreateRequests.length,
    createStartCount,
    '取消整页入库复核面板时不应保存 source memory capsule',
  );
  assert.equal(
    await page.locator('.pai-memory-capture-page-chip').count(),
    1,
    '取消整页保存后应保留页面 + 入口',
  );

  const candidateCountAfterChip = server.sourceMemoryCandidateRequests.length;
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
      !document.querySelector('.pai-memory-capture-page-chip') &&
      !document.querySelector('.pai-page-memory-capture-review-panel') &&
      !document.querySelector('.pai-visual-memory-preview-panel'),
    { timeout: 5000 },
  );
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('copy'));
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(1600);
  assert.equal(
    server.sourceMemoryCandidateRequests.length,
    candidateCountAfterChip,
    '已屏蔽站点收到 storage 更新后不应继续评估被动整页入库',
  );

  await serviceWorker.evaluate(
    async ({ blockStorageKey }) => {
      await chrome.storage.local.set({ [blockStorageKey]: {} });
    },
    { blockStorageKey: siteBlockStorageKey },
  );
  await page.waitForSelector('.pai-memory-capture-page-chip', {
    timeout: 7000,
  });

  await page.locator('.pai-memory-capture-page-chip').click();
  await page.locator('.pai-page-memory-capture-review-panel .pai-memory-capture-note-input').fill(
    '触发失败',
  );
  await page.locator('.pai-page-memory-capture-review-panel .pai-memory-capture-note-save').click();
  await page.waitForFunction(
    () => /页面资料未写入/.test(document.querySelector('.pai-page-memory-capture-review-panel .pai-memory-capture-note-error')?.textContent || ''),
    { timeout: 5000 },
  );
  const pageFailureText = await page.locator('.pai-page-memory-capture-review-panel .pai-memory-capture-note-error').innerText();
  assert.match(
    pageFailureText,
    /页面资料未写入/,
    '整页保存失败应说明页面资料没有写入',
  );
  assert.match(
    pageFailureText,
    /没有创建资料记忆或网页检索信号/,
    '整页保存失败应说明没有创建 capsule 或 web 检索信号',
  );
  assert.match(
    pageFailureText,
    /入口仍保留，可重试/,
    '整页保存失败应给出可恢复路径',
  );
  assert.match(
    pageFailureText,
    /页面快照：将保存[\s\S]*Falcon page capture review packet/,
    '整页保存失败回执应保留本次未写入所对应的页面快照',
  );
  assert.equal(
    server.sourceMemoryCreateRequests.length,
    createStartCount,
    '整页保存失败时不应记录成功创建的 source memory capsule',
  );
  await page.locator('.pai-page-memory-capture-review-panel .pai-memory-capture-note-input').fill(
    '用于 Falcon QBR 资料包',
  );
  await page.locator('.pai-page-memory-capture-review-panel .pai-memory-capture-note-save').click();
  await waitForCapturedSourceMemoryCount(server, createStartCount + 1, 5000);

  const savedSourceMemory = server.sourceMemoryCreateRequests.at(-1);
  assert.equal(savedSourceMemory.sourceKind, 'webpage');
  assert.equal(savedSourceMemory.captureMode, 'manual');
  assert.equal(savedSourceMemory.captureReason, '用户点击右侧半露出 + 记住当前页面');
  assert.equal(savedSourceMemory.note, '用于 Falcon QBR 资料包');
  assert.equal(savedSourceMemory.interactions?.manualClick, true);
  assert.match(savedSourceMemory.text, /Falcon webpage capture review notes/);
  await page.waitForSelector('.pai-page-memory-capture-review-panel', {
    state: 'detached',
    timeout: 5000,
  });
  assert.equal(
    await page.locator('.pai-memory-capture-page-chip').count(),
    0,
    '确认保存后应清掉页面 + 入口',
  );
  await page.waitForFunction(
    () => /已保存当前页面资料/.test(document.querySelector('.pai-context-toast')?.textContent || ''),
    { timeout: 5000 },
  );
  assert.match(
    await page.locator('.pai-context-toast').innerText(),
    /资料记忆已写入[\s\S]*网页检索信号[\s\S]*不会自动外发/,
    '整页保存成功后应展示后端写入回执和网页检索信号边界',
  );
  assert.match(
    await page.locator('.pai-context-toast').innerText(),
    /页面快照：将保存[\s\S]*Falcon page capture review packet/,
    '整页保存成功 toast 应保留这次保存的页面快照基准',
  );
  const viewSavedSourceMemory = page.getByRole('button', {
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
  await detailPage.close();

  const duplicatePage = await context.newPage();
  const duplicateDiagnostics = attachPageDiagnostics(duplicatePage, 'page-capture-duplicate-no-note');
  const duplicateStartCount = server.sourceMemoryCreateRequests.length;
  await duplicatePage.goto(`${server.origin}/page-capture-review?duplicate-page-capture=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await duplicatePage.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
    document.dispatchEvent(new Event('copy'));
  });
  await duplicatePage.waitForSelector('.pai-memory-capture-page-chip', {
    timeout: 7000,
  });
  await duplicatePage.locator('.pai-memory-capture-page-chip').click();
  await duplicatePage.waitForSelector('.pai-page-memory-capture-review-panel', {
    timeout: 5000,
  });
  await duplicatePage.locator('.pai-page-memory-capture-review-panel .pai-memory-capture-note-save').click();
  await waitForCapturedSourceMemoryCount(server, duplicateStartCount + 1, 5000);
  await duplicatePage.waitForFunction(
    () => /当前页面已在记忆中/.test(document.querySelector('.pai-context-toast')?.textContent || ''),
    { timeout: 5000 },
  );
  const duplicateToastText = await duplicatePage.locator('.pai-context-toast').innerText();
  assert.match(
    duplicateToastText,
    /本次没有新建第二条资料/,
    '重复整页保存无备注时应说明没有新建第二条资料',
  );
  assert.match(
    duplicateToastText,
    /没有更新备注或正文/,
    '重复整页保存无备注时应说明没有更新已有内容',
  );
  assert.match(
    duplicateToastText,
    /已有资料和关联网页检索信号保持启用/,
    '重复整页保存无备注时应说明只是保留已有检索信号',
  );
  assert.doesNotMatch(
    duplicateToastText,
    /已创建或更新 source-memory capsule/,
    '重复整页保存无备注时不应沿用新建或更新式写入回执',
  );
  await duplicatePage.close();

  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('整页入库复核页面出现脚本异常');
  }
  if (duplicateDiagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of duplicateDiagnostics) {
      log(entry);
    }
    throw new Error('重复整页入库复核页面出现脚本异常');
  }
  await page.close();
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
    await cardPage.locator('.pai-memory-capture-selection-dock').count(),
    0,
    '选中 Memory Lens 自己卡片里的文字不应显示记住 +',
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
    await credentialPage.locator('.pai-memory-capture-selection-dock').count(),
    0,
    '明显像 API key 的选区不应显示记住 +',
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
    await sensitivePage.locator('.pai-memory-capture-selection-dock').count(),
    0,
    'selected_text 响应回来前页面变成敏感表单时不应显示记住 +',
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
  const cardText = await page.locator('.pai-context-card').innerText();
  assert.match(
    cardText,
    /记忆入口已隐藏/,
    '不安全的 exploreLink 被过滤时应在卡片里显示来源回执',
  );
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
  await verifyKeystoneBriefMemoryLens(server, context);
  await verifyJiraIssueContext(server, context);
  await verifySelectedTextTrigger(server, context);
  await verifyPageCaptureInlineReview(server, context, launch.serviceWorker);
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
  await verifyContextBubbleDrag(server, context);
  await verifyPossibleHoverPeek(server, context);
  await verifyMetadataSummaryPresentation(server, context);
  await verifySourceUrlOnlyProvenance(server, context);
  await verifySourceMemorySensitiveSourceHidden(server, context);
  await verifySourceStatusReceipts(server, context);
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
