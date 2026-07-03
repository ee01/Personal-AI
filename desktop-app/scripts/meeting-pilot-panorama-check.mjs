import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(appRoot, '..');
const screenshotDir = await fs.mkdtemp(
  path.join(os.tmpdir(), 'meeting-pilot-panorama-check-'),
);

function log(message) {
  console.log(`[meeting-pilot-panorama] ${message}`);
}

async function saveScreenshot(page, filename) {
  const fullPath = path.join(screenshotDir, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  return fullPath;
}

async function launchExtensionContext() {
  const extensionPath = path.join(repoRoot, 'dist');
  await fs.access(extensionPath);
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'meeting-pilot-panorama-browser-'),
  );
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    timeout: 300000,
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
  return {
    context,
    extensionId: new URL(serviceWorker.url()).host,
  };
}

let launched;

try {
  launched = await launchExtensionContext();
  const { context, extensionId } = launched;
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error instanceof Error ? error.stack || error.message : String(error));
  });

  log('打开 Panorama demo 页');
  await page.goto(`chrome-extension://${extensionId}/meeting-panorama.html?demo=1`, {
    waitUntil: 'load',
    timeout: 30000,
  });
  await page.waitForSelector('[data-panorama-output-receipt="true"]', {
    timeout: 15000,
  });
  await page.waitForSelector('.followup-readiness', { timeout: 15000 });
  await page.waitForSelector('.action-list .action-item', { timeout: 15000 });

  const state = await page.evaluate(() => {
    const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
    return {
      followupState:
        document
          .querySelector('.followup-readiness')
          ?.getAttribute('data-followup-state') || '',
      followupText: normalize(
        document.querySelector('.followup-readiness')?.textContent,
      ),
      actionStat: normalize(
        Array.from(document.querySelectorAll('.stat-card')).find((node) =>
          /行动项/.test(node.textContent || ''),
        )?.textContent,
      ),
      actionCount: document.querySelectorAll('.action-list .action-item').length,
      outputReceipt: normalize(
        document.querySelector('[data-panorama-output-receipt="true"]')?.textContent,
      ),
    };
  });

  assert.match(state.outputReceipt, /输出范围回执/);
  assert.match(state.outputReceipt, /Markdown 跟进清单 4 项/);
  assert.match(state.outputReceipt, /不会发送纪要/);
  assert.match(state.outputReceipt, /不会.*写回 Memory Service/);
  assert.equal(state.followupState, 'needs-review');
  assert.match(state.followupText, /会后跟进状态|跟进清单可交付度/);
  assert.match(state.followupText, /3\s*待复核/);
  assert.match(state.followupText, /复制跟进清单/);
  assert.match(state.actionStat, /3\s*待复核\s*·\s*0\s*已确认\s*·\s*1\s*已完成/);
  assert.equal(state.actionCount, 4);

  log('验证页面链接复制反馈');
  await page.locator('.header-btn', { hasText: '复制页面链接' }).click();
  await page.waitForFunction(
    () => /页面链接已复制/.test(document.querySelector('.header-copy-state')?.textContent || ''),
    { timeout: 5000 },
  );

  log('验证跟进清单复制反馈');
  await page.locator('.followup-copy').click();
  await page.waitForFunction(
    () => /已复制/.test(document.querySelector('.followup-copy-state')?.textContent || ''),
    { timeout: 5000 },
  );
  log('验证 footer 反馈按钮不再静默无响应');
  await page.locator('.feedback-btn.reject').click();
  await page.waitForFunction(
    () => /反馈未写入/.test(document.querySelector('.feedback-status')?.textContent || ''),
    { timeout: 5000 },
  );
  await saveScreenshot(page, 'panorama-followup-readiness.png');

  log('验证 PDF-only 归档不会把 PDF 当成录制回放');
  const archivedPage = await context.newPage();
  archivedPage.on('pageerror', (error) => {
    pageErrors.push(error instanceof Error ? error.stack || error.message : String(error));
  });
  const archivedParams = new URLSearchParams({
    history: '1',
    meetingId: 'archive-pdf-only',
    title: 'PDF only recap',
    date: String(Date.now()),
    digestStatus: 'completed',
    pdfUrl: 'https://example.com/meeting-pilot/minutes.pdf',
  });
  await archivedPage.goto(
    `chrome-extension://${extensionId}/meeting-panorama.html?${archivedParams.toString()}`,
    { waitUntil: 'load', timeout: 30000 },
  );
  await archivedPage.waitForSelector('.page-header', { timeout: 15000 });
  await archivedPage.waitForSelector('[data-panorama-output-receipt="true"]', {
    timeout: 15000,
  });
  const pdfOnlyReplayState = await archivedPage.evaluate(() => {
    const replayButton = Array.from(document.querySelectorAll('.header-btn.primary')).find((button) =>
      /回放录制/.test(button.textContent || ''),
    );
    return {
      disabled: replayButton?.hasAttribute('disabled') || false,
      title: replayButton?.getAttribute('title') || '',
      outputReceipt: (document.querySelector('[data-panorama-output-receipt="true"]')?.textContent || '')
        .replace(/\s+/g, ' ')
        .trim(),
    };
  });
  assert.equal(pdfOnlyReplayState.disabled, true);
  assert.match(pdfOnlyReplayState.title, /没有可回放的录制素材/);
  assert.match(pdfOnlyReplayState.outputReceipt, /PDF 可打开\/下载\/复制链接/);
  assert.match(pdfOnlyReplayState.outputReceipt, /没有录制素材/);
  await archivedPage.close();

  log('验证 Panorama 会隐藏不安全的 PDF / 录制素材链接');
  const unsafePage = await context.newPage();
  unsafePage.on('pageerror', (error) => {
    pageErrors.push(error instanceof Error ? error.stack || error.message : String(error));
  });
  const unsafeParams = new URLSearchParams({
    history: '1',
    meetingId: 'archive-unsafe-assets',
    title: 'Unsafe asset recap',
    date: String(Date.now()),
    digestStatus: 'completed',
    pdfUrl: 'javascript:alert(1)',
    videoUrl: 'https://user:pass@example.com/meeting-pilot/recording.webm',
  });
  await unsafePage.goto(
    `chrome-extension://${extensionId}/meeting-panorama.html?${unsafeParams.toString()}`,
    { waitUntil: 'load', timeout: 30000 },
  );
  await unsafePage.waitForSelector('[data-panorama-output-receipt="true"]', {
    timeout: 15000,
  });
  const unsafeAssetState = await unsafePage.evaluate(() => {
    const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
    const replayButton = Array.from(document.querySelectorAll('.header-btn.primary')).find((button) =>
      /回放录制/.test(button.textContent || ''),
    );
    return {
      replayDisabled: replayButton?.hasAttribute('disabled') || false,
      replayTitle: replayButton?.getAttribute('title') || '',
      outputReceipt: normalize(
        document.querySelector('[data-panorama-output-receipt="true"]')?.textContent,
      ),
      pdfPlaceholder: normalize(
        document.querySelector('.pdf-digest-placeholder')?.textContent,
      ),
      pdfFrameCount: document.querySelectorAll('.pdf-digest-preview-frame').length,
      pdfLinks: Array.from(
        document.querySelectorAll('#pdfPreviewSection .digest-link'),
      ).map((node) => node.getAttribute('href') || ''),
      recordingText: normalize(
        Array.from(document.querySelectorAll('.digest-item')).find((node) =>
          /录制与原始素材/.test(node.textContent || ''),
        )?.textContent,
      ),
    };
  });
  assert.equal(unsafeAssetState.replayDisabled, true);
  assert.match(unsafeAssetState.replayTitle, /录制素材已隐藏/);
  assert.match(unsafeAssetState.replayTitle, /包含账号信息/);
  assert.match(unsafeAssetState.outputReceipt, /部分素材链接已隐藏/);
  assert.match(unsafeAssetState.outputReceipt, /PDF 已隐藏 · 非 http\/https/);
  assert.match(unsafeAssetState.outputReceipt, /录制素材已隐藏 · 包含账号信息/);
  assert.match(unsafeAssetState.outputReceipt, /被隐藏素材不会进入预览、打开、下载或剪贴板/);
  assert.match(unsafeAssetState.pdfPlaceholder, /PDF 链接已隐藏/);
  assert.match(unsafeAssetState.pdfPlaceholder, /PDF 已隐藏 · 非 http\/https/);
  assert.equal(unsafeAssetState.pdfFrameCount, 0);
  assert.ok(
    unsafeAssetState.pdfLinks.every((href) => href === '#' || href === ''),
    `不安全 PDF 链接不应进入 href: ${JSON.stringify(unsafeAssetState.pdfLinks)}`,
  );
  assert.match(unsafeAssetState.recordingText, /录制素材已隐藏 · 包含账号信息/);
  await unsafePage
    .locator('.digest-item', { hasText: '录制与原始素材' })
    .locator('.digest-link', { hasText: '回放录制' })
    .click();
  await unsafePage.waitForFunction(
    () => /录制素材已隐藏/.test(document.querySelector('.header-copy-state')?.textContent || ''),
    { timeout: 5000 },
  );
  await unsafePage.close();

  log('验证历史详情加载失败时显示归档来源回执');
  await context.route('**/api/v1/meetings/archive-fallback', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'detail_unavailable' }),
    });
  });
  const fallbackPage = await context.newPage();
  fallbackPage.on('pageerror', (error) => {
    pageErrors.push(
      error instanceof Error ? error.stack || error.message : String(error),
    );
  });
  const fallbackParams = new URLSearchParams({
    history: '1',
    meetingId: 'archive-fallback',
    title: 'Fallback archive recap',
    date: String(Date.now()),
    digestStatus: 'completed',
    participants: JSON.stringify(['Esone', 'Morgan']),
  });
  await fallbackPage.goto(
    `chrome-extension://${extensionId}/meeting-panorama.html?${fallbackParams.toString()}`,
    { waitUntil: 'load', timeout: 30000 },
  );
  await fallbackPage.waitForSelector(
    '.archive-source-receipt[data-archive-source-state="fallback"]',
    { timeout: 15000 },
  );
  const fallbackReceipt = await fallbackPage.evaluate(() =>
    (document.querySelector('.archive-source-receipt')?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
  assert.match(fallbackReceipt, /归档来源回执/);
  assert.match(fallbackReceipt, /基础历史视图/);
  assert.match(fallbackReceipt, /不等于会议没有这些内容/);
  assert.match(fallbackReceipt, /不会自动重新生成 PDF/);
  await fallbackPage.close();

  log('验证历史归档会从 memory-service detail API 补齐行动项元数据');
  await context.route('**/api/v1/meetings/archive-hydrated', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        meetingId: 'archive-hydrated',
        title: 'Hydrated archive recap',
        date: Date.now(),
        lastEventAt: Date.now(),
        participants: ['Esone', 'Morgan'],
        digestStatus: 'completed',
        summary: '完整归档详情已载入。',
        chapters: [
          {
            id: 'chapter-1',
            title: 'Follow-up review',
            summary: '复核会后任务是否可交付。',
            startLabel: '00:02',
          },
        ],
        actionItems: [
          {
            id: 'manual-1',
            title: '整理客户 follow-up',
            owner: 'Morgan',
            deadline: '周五',
            status: 'pending',
            reviewState: 'confirmed',
            source: 'manual',
            evidence: 'Morgan 会后手动补录：需要整理客户 follow-up。',
            timestamp: '42:00',
            chapterId: 'chapter-1',
          },
          {
            id: 'ai-1',
            title: '补齐上线 owner',
            owner: 'Unknown',
            status: 'pending',
            reviewState: 'suggested',
            source: 'llm',
            evidence: '需要有人补齐上线 owner。',
            timestamp: '08:10',
            chapterId: 'chapter-1',
          },
          {
            id: 'dismissed-1',
            title: '误判的泛泛承诺',
            owner: 'Esone',
            deadline: '下周',
            status: 'pending',
            reviewState: 'dismissed',
            source: 'heuristic',
            evidence: '我们下周看看。',
            timestamp: '10:10',
          },
        ],
        decisions: [
          {
            id: 'decision-1',
            text: '先复核再外发行动项。',
            timestamp: '12:00',
          },
        ],
        timelineEvents: [
          {
            id: 'timeline-manual-1',
            type: 'action',
            title: '整理客户 follow-up',
            description: '手动补录项保留同章时间线锚点。',
            timestamp: '42:00',
            actionItemId: 'manual-1',
            chapterId: 'chapter-1',
          },
        ],
        participantStances: [
          {
            participant: 'Morgan',
            topic: 'Follow-up review',
            stance: '支持',
            keyQuote: '先把可外发的清单整理出来。',
            timeRange: '40:00-43:00',
          },
        ],
      }),
    });
  });
  const hydratedPage = await context.newPage();
  hydratedPage.on('pageerror', (error) => {
    pageErrors.push(
      error instanceof Error ? error.stack || error.message : String(error),
    );
  });
  const hydratedParams = new URLSearchParams({
    history: '1',
    meetingId: 'archive-hydrated',
    title: 'Hydrated archive recap',
    date: String(Date.now()),
    digestStatus: 'completed',
    participants: JSON.stringify(['Esone', 'Morgan']),
  });
  await hydratedPage.goto(
    `chrome-extension://${extensionId}/meeting-panorama.html?${hydratedParams.toString()}`,
    { waitUntil: 'load', timeout: 30000 },
  );
  await hydratedPage.waitForSelector(
    '.archive-detail-pill[data-archive-detail-state="loaded"]',
    { timeout: 15000 },
  );
  await hydratedPage.waitForSelector('[data-action-source="manual"]', {
    timeout: 15000,
  });
  const hydratedState = await hydratedPage.evaluate(() => {
    const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
    return {
      archiveStatus: normalize(
        document.querySelector('.archive-detail-pill')?.textContent,
      ),
      followupText: normalize(
        document.querySelector('.followup-readiness')?.textContent,
      ),
      manualSource: normalize(
        document.querySelector('[data-action-source="manual"]')?.textContent,
      ),
      aiGaps:
        document
          .querySelector('[data-action-source="llm"]')
          ?.getAttribute('data-readiness-gaps') || '',
      dismissedReviewState:
        document
          .querySelector('[data-action-source="heuristic"]')
          ?.getAttribute('data-review-state') || '',
      timelineAnchor: Boolean(
        document.querySelector('[data-action-item-id="manual-1"]'),
      ),
      archiveReceipt: normalize(
        document.querySelector('.archive-source-receipt')?.textContent,
      ),
      outputReceipt: normalize(
        document.querySelector('[data-panorama-output-receipt="true"]')?.textContent,
      ),
    };
  });
  assert.equal(hydratedState.archiveStatus, '已载入完整归档');
  assert.match(hydratedState.archiveReceipt, /memory-service 完整归档/);
  assert.match(hydratedState.archiveReceipt, /已载入 1 个章节、3 个行动项、1 个决议、1 个时间线事件/);
  assert.match(hydratedState.archiveReceipt, /只读取归档明细/);
  assert.match(hydratedState.outputReceipt, /memory-service 完整归档/);
  assert.match(hydratedState.outputReceipt, /Markdown 跟进清单 2 项/);
  assert.match(hydratedState.outputReceipt, /不会发送纪要/);
  assert.match(hydratedState.followupText, /1\s*可直接跟进/);
  assert.match(hydratedState.followupText, /1\s*待复核/);
  assert.match(hydratedState.followupText, /1\s*需补信息/);
  assert.match(hydratedState.manualSource, /手动补录/);
  assert.match(hydratedState.aiGaps, /补负责人/);
  assert.match(hydratedState.aiGaps, /补截止/);
  assert.equal(hydratedState.dismissedReviewState, 'dismissed');
  assert.equal(hydratedState.timelineAnchor, true);
  await hydratedPage.close();

  assert.deepEqual(pageErrors, [], `页面脚本异常: ${pageErrors.join('\n\n')}`);
  log(`Panorama 跟进状态 E2E 验证通过，截图目录: ${screenshotDir}`);
  await page.close();
} finally {
  await launched?.context?.close().catch(() => undefined);
}
