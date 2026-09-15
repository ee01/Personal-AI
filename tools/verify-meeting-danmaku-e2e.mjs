#!/usr/bin/env node
/**
 * Meeting danmaku E2E check (Tier 2).
 *
 * Loads the built `dist/` extension into a fresh persistent Chromium context,
 * serves a deterministic RingCentral meeting fixture, pushes a real
 * `MEETING_PILOT_SESSION_SNAPSHOT` into the meeting tab, and asserts the danmaku
 * behaviour the product cares about:
 *
 *   1. the rolling pill shows the compressed one-sentence gist (not the title)
 *   2. hovering expands the original memory text plus its real information time
 *   3. hovering pauses the roll and hover-out resumes from the same offset
 *      instead of restarting from the right edge
 *
 * Run: node tools/verify-meeting-danmaku-e2e.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;

const OVERLAY_ID = 'meeting-pilot-overlay-root';
const MEETING_ID = 'e2e-danmaku-001';
const MEETING_URL = `https://v.ringcentral.com/conf/on/${MEETING_ID}`;
const FIXTURE_HTML = `<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>Fixture RingCentral Meeting</title></head>
  <body>
    <main id="meeting-root">
      <h1>Fixture RingCentral Meeting</h1>
      <p>Deterministic meeting page for the danmaku E2E check.</p>
    </main>
  </body>
</html>`;

function log(step) {
  console.log(`[meeting-danmaku-e2e] ${step}`);
}

function transformTx(transform) {
  const match = /matrix\(([^)]+)\)/.exec(transform || '');
  if (!match) return 0;
  const parts = match[1].split(',').map((value) => Number(value.trim()));
  return Number.isFinite(parts[4]) ? parts[4] : 0;
}

function buildSnapshot({ memoryRefs, alerts = [] }) {
  const now = Date.now();
  return {
    meetingId: MEETING_ID,
    tabId: 1,
    url: MEETING_URL,
    title: 'Fixture RingCentral Meeting',
    status: 'active',
    inMeeting: true,
    shareState: 'unknown',
    selfSharing: false,
    participantCount: 2,
    capture: { kind: 'idle', chunkCount: 0 },
    digest: { status: 'idle' },
    readiness: {
      status: 'ready',
      summary: 'Ready for local capture.',
      canStartCapture: true,
      checkedAt: now,
      blockers: [],
      degradations: [],
      dependencies: {},
    },
    alerts,
    chapters: [],
    currentTopic: 'Danmaku verification',
    actionItems: [],
    decisions: [],
    timelineEvents: [],
    participants: [],
    transcript: [],
    transcriptTurns: [],
    memoryRefs,
    summary: 'Danmaku verification fixture.',
    timelineProgress: 0,
    sidePanelPinned: false,
    detectedAt: now,
    updatedAt: now,
    tier: { activeTier: null, badge: 'Probing', mode: 'auto' },
  };
}

const E2E_MEMORY_REF = {
  id: 'e2e-memory-1',
  type: 'message',
  title: 'E2E 记忆标题',
  cueTitle: 'E2E 记忆标题',
  cueLine: 'E2E 一句话压缩摘要。',
  cueBody: 'E2E 一句话压缩摘要。',
  snippet: 'E2E 一句话压缩摘要。',
  fullSnippet: 'E2E 关联记忆原文，用于验证 hover 展开内容与时间。',
  score: 0.82,
  sourceLabel: 'glip',
  relationLabel: '同一项目',
  whyRelevant: ['同一项目'],
  displayPriority: 'p2',
  timestamp: new Date(2026, 4, 12, 14, 3).getTime(),
};

let launched;

try {
  const extensionPath = path.resolve('dist');
  await fs.access(extensionPath);
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'personal-ai-meeting-danmaku-'),
  );

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    timeout: 300000,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  launched = context;

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', {
      timeout: 20000,
    });
  }
  const extensionId = new URL(serviceWorker.url()).host;

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) =>
    pageErrors.push(error instanceof Error ? error.message : String(error)),
  );

  log('打开 RingCentral 会议 fixture 并等待 Meeting Pilot overlay');
  await page.route('https://v.ringcentral.com/conf/on/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: FIXTURE_HTML }),
  );
  await page.goto(MEETING_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector(`#${OVERLAY_ID}`, {
    state: 'attached',
    timeout: 20000,
  });
  const overlayDisplay = await page.evaluate((overlayId) => {
    const host = document.getElementById(overlayId);
    return {
      display: host ? getComputedStyle(host).display : 'missing',
      hasShadow: Boolean(host?.shadowRoot),
    };
  }, OVERLAY_ID);
  assert.equal(
    overlayDisplay.display === 'none',
    false,
    `Meeting Pilot overlay 被禁用: ${JSON.stringify(overlayDisplay)}`,
  );

  async function sendSnapshot(snapshot) {
    const result = await serviceWorker.evaluate(async (payload) => {
      const tabs = await chrome.tabs.query({});
      const target = tabs.find((tab) =>
        String(tab.url || '').includes('/conf/on/'),
      );
      if (!target?.id) return { ok: false, reason: 'meeting_tab_not_found' };
      try {
        const response = await chrome.tabs.sendMessage(target.id, {
          type: 'MEETING_PILOT_SESSION_SNAPSHOT',
          snapshot: payload,
        });
        return { ok: true, response };
      } catch (error) {
        return { ok: false, reason: String(error?.message || error) };
      }
    }, snapshot);
    assert.equal(
      result.ok,
      true,
      `快照下发失败: ${JSON.stringify(result)}`,
    );
  }

  log('先下发空快照建立会议基线，再下发关联记忆快照');
  await sendSnapshot(buildSnapshot({ memoryRefs: [] }));
  await sendSnapshot(buildSnapshot({ memoryRefs: [E2E_MEMORY_REF] }));

  const pill = page.locator('.danmaku-item.memory-danmaku');
  await pill.waitFor({ state: 'attached', timeout: 15000 });
  await pill.waitFor({ state: 'visible', timeout: 15000 });

  const oneLine = (
    await pill.locator('.danmaku-summary-text').innerText()
  ).trim();
  assert.equal(
    oneLine,
    'E2E 一句话压缩摘要。',
    `弹幕一句话文案不正确: ${oneLine}`,
  );
  const badge = (await pill.locator('.danmaku-badge').innerText()).trim();
  assert.equal(badge, '同一项目', `弹幕关系标签不正确: ${badge}`);
  log(`一句话文案与关系标签正确: ${badge} · ${oneLine}`);

  log('等待弹幕进入可 hover 区域并读取滚动偏移');
  await page.waitForFunction(
    () => {
      const root = document.getElementById('meeting-pilot-overlay-root');
      const item = root?.shadowRoot?.querySelector('.danmaku-item.memory-danmaku');
      if (!item) return false;
      const box = item.getBoundingClientRect();
      return box.width > 120 && box.x > 40 && box.x < window.innerWidth - 120;
    },
    undefined,
    { timeout: 30000 },
  );

  const beforeHoverTx = transformTx(
    await pill.evaluate((el) => getComputedStyle(el).transform),
  );

  log('hover 弹幕，校验展开原文与时间，并确认滚动暂停在当前位置');
  let hovered = false;
  for (let attempt = 0; attempt < 12 && !hovered; attempt += 1) {
    await pill.hover({ force: true, timeout: 3000 }).catch(() => {});
    hovered = await pill
      .evaluate((el) => el.classList.contains('paused'))
      .catch(() => false);
    if (!hovered) await page.waitForTimeout(150);
  }
  assert.equal(hovered, true, 'hover 未命中移动中的弹幕');
  await pill.waitFor({ state: 'visible', timeout: 5000 });

  const detail = await pill.locator('.danmaku-detail').innerText();
  assert.match(detail, /E2E 关联记忆原文/, `hover 未展开原文: ${detail}`);
  assert.match(detail, /消息时间 2026-05-12 14:03/, `hover 未显示来源时间: ${detail}`);
  const playState = await pill.evaluate(
    (el) => getComputedStyle(el).animationPlayState,
  );
  assert.equal(playState, 'paused', `hover 未暂停动画: ${playState}`);

  const pausedTx = transformTx(
    await pill.evaluate((el) => getComputedStyle(el).transform),
  );
  await page.waitForTimeout(700);
  const stillPausedTx = transformTx(
    await pill.evaluate((el) => getComputedStyle(el).transform),
  );
  assert.ok(
    Math.abs(stillPausedTx - pausedTx) < 1,
    `hover 静止期间弹幕仍在移动: ${pausedTx} -> ${stillPausedTx}`,
  );
  assert.ok(
    pausedTx < beforeHoverTx,
    `弹幕没有向左滚动: ${beforeHoverTx} -> ${pausedTx}`,
  );
  log(`hover 展开并暂停成功: tx=${pausedTx.toFixed(1)}`);

  log('移开鼠标，校验从暂停位置继续滚动而不是从右边重置');
  await page.mouse.move(20, 20);
  await page.waitForFunction(
    () => {
      const root = document.getElementById('meeting-pilot-overlay-root');
      const item = root?.shadowRoot?.querySelector('.danmaku-item.memory-danmaku');
      return Boolean(item) && !item.classList.contains('paused');
    },
    undefined,
    { timeout: 5000 },
  );
  const resumedTx = transformTx(
    await pill.evaluate((el) => getComputedStyle(el).transform),
  );
  assert.ok(
    Math.abs(resumedTx - pausedTx) < 40,
    `移开鼠标后弹幕被重置: paused=${pausedTx} resumed=${resumedTx}`,
  );
  await page.waitForTimeout(700);
  const laterTx = transformTx(
    await pill.evaluate((el) => getComputedStyle(el).transform),
  );
  assert.ok(
    laterTx < resumedTx - 1,
    `移开鼠标后弹幕没有继续滚动: ${resumedTx} -> ${laterTx}`,
  );
  log(`从暂停位置继续滚动成功: ${pausedTx.toFixed(1)} -> ${laterTx.toFixed(1)}`);

  assert.deepEqual(pageErrors, [], `页面报错: ${pageErrors.join('\n')}`);
  log('全部通过');
  await launched.close();
  launched = undefined;
} catch (error) {
  console.error(`[meeting-danmaku-e2e] 失败: ${error?.stack || error}`);
  process.exitCode = 1;
} finally {
  if (launched) {
    await launched.close().catch(() => {});
  }
}
