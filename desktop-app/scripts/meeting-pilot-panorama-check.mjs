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
  await page.waitForSelector('[data-meeting-outcome-result="true"]', {
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
      outcomeStatus:
        document
          .querySelector('[data-meeting-outcome-result="true"]')
          ?.getAttribute('data-outcome-binder-status') || '',
      outcomeText: normalize(
        document.querySelector('[data-meeting-outcome-result="true"]')?.textContent,
      ),
      outcomeSlotStatuses: Array.from(
        document.querySelectorAll('[data-outcome-slot-status]'),
      ).map((node) => node.getAttribute('data-outcome-slot-status') || ''),
    };
  });
  const controlBoundaries = await page.evaluate(() => {
    const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
    const attrs = (node) => ({
      title: normalize(node?.getAttribute('title') || ''),
      aria: normalize(node?.getAttribute('aria-label') || ''),
      text: normalize(node?.textContent || ''),
    });
    const findButton = (pattern) =>
      Array.from(document.querySelectorAll('button')).find((node) =>
        pattern.test(node.textContent || ''),
      );
    const findDigestLink = (pattern, root = document) =>
      Array.from(root.querySelectorAll('.digest-link')).find((node) =>
        pattern.test(node.textContent || ''),
      );
    const pdfSection = document.querySelector('#pdfPreviewSection');
    return {
      pdfSection: attrs(findButton(/会议纪要 PDF/)),
      pageLink: attrs(findButton(/复制页面链接/)),
      jsonExport: attrs(findButton(/导出/)),
      recordingReplay: attrs(findButton(/回放录制/)),
      followupCopy: attrs(document.querySelector('.followup-copy')),
      feedbackAccurate: attrs(document.querySelector('.feedback-btn.confirm')),
      feedbackNeedsCorrection: attrs(document.querySelector('.feedback-btn.reject')),
      pdfOpen: attrs(findDigestLink(/新窗口打开|在线预览/, pdfSection || document)),
      pdfDownload: attrs(findDigestLink(/下载 PDF/, pdfSection || document)),
      pdfCopy: attrs(findDigestLink(/^复制链接$/, pdfSection || document)),
      recordingCopy: attrs(
        Array.from(document.querySelectorAll('.digest-item')).find((node) =>
          /录制与原始素材/.test(node.textContent || ''),
        )?.querySelector('.digest-link:nth-child(2)'),
      ),
    };
  });

  assert.match(state.outputReceipt, /输出范围回执/);
  assert.match(state.outputReceipt, /Markdown 跟进清单 4 项/);
  assert.match(state.outputReceipt, /不会发送纪要/);
  assert.match(state.outputReceipt, /不会.*写回 Memory Service/);
  assert.equal(state.outcomeStatus, 'partial');
  assert.match(state.outcomeText, /会后结果装订/);
  assert.match(state.outcomeText, /1 项已闭环，2 项仍需继续/);
  assert.match(state.outcomeText, /Dev \/ QA 估时口径已统一/);
  assert.match(state.outcomeText, /QA 按 5 人天进入排期/);
  assert.match(state.outcomeText, /owner 已明确/);
  assert.match(state.outcomeText, /不会写回 Calendar/);
  assert.deepEqual(state.outcomeSlotStatuses, [
    'resolved',
    'partially_resolved',
    'carried_over',
  ]);
  assert.equal(state.followupState, 'needs-review');
  assert.match(state.followupText, /会后跟进状态|跟进清单可交付度/);
  assert.match(state.followupText, /3\s*待复核/);
  assert.match(state.followupText, /复制跟进清单/);
  assert.match(state.actionStat, /3\s*待复核\s*·\s*0\s*已确认\s*·\s*1\s*已完成/);
  assert.equal(state.actionCount, 4);
  assert.match(controlBoundaries.pdfSection.title, /只滚动到本页 PDF 状态/);
  assert.match(controlBoundaries.pdfSection.aria, /不会打开外部链接/);
  assert.match(controlBoundaries.pageLink.title, /只把当前 extension 页面 URL 写入本机剪贴板/);
  assert.match(controlBoundaries.pageLink.aria, /不会发送纪要/);
  assert.match(controlBoundaries.jsonExport.title, /只把当前页面已有会议结构化快照下载到本机/);
  assert.match(controlBoundaries.jsonExport.aria, /不会上传、同步或外发/);
  assert.match(controlBoundaries.recordingReplay.title, /只在新标签打开已通过安全检查的录制 http\(s\) 链接/);
  assert.match(controlBoundaries.recordingReplay.aria, /不会下载、发送纪要/);
  assert.match(controlBoundaries.followupCopy.title, /4 个未驳回行动项/);
  assert.match(controlBoundaries.followupCopy.aria, /不会发送给团队/);
  assert.match(controlBoundaries.feedbackAccurate.title, /反馈未写入/);
  assert.match(controlBoundaries.feedbackAccurate.aria, /不会写入校准/);
  assert.match(controlBoundaries.feedbackNeedsCorrection.title, /不会重跑会议分析/);
  assert.match(controlBoundaries.feedbackNeedsCorrection.aria, /不会.*发送纪要/);
  assert.match(controlBoundaries.pdfOpen.title, /只在新标签打开已通过安全检查的 http\(s\) PDF 链接/);
  assert.match(controlBoundaries.pdfDownload.title, /只请求浏览器把已通过安全检查的 PDF 链接保存到本机/);
  assert.match(controlBoundaries.pdfCopy.title, /只把已通过安全检查的 PDF http\(s\) 链接写入本机剪贴板/);
  assert.match(controlBoundaries.recordingCopy.title, /只把已通过安全检查的录制 http\(s\) 链接写入本机剪贴板/);

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
    summary: '列表卡片显示：这场会确认了 fallback owner 和材料范围。',
    topicCount: '2',
    actionItemCount: '4',
    decisionCount: '1',
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
  assert.match(fallbackReceipt, /列表快照带入/);
  assert.match(fallbackReceipt, /fallback owner 和材料范围/);
  assert.match(fallbackReceipt, /卡片结构数量：话题 2、行动项 4、决议 1/);
  assert.match(fallbackReceipt, /不等于会议没有这些内容/);
  assert.match(fallbackReceipt, /不会自动重新生成 PDF/);
  const fallbackOutputReceipt = await fallbackPage.evaluate(() =>
    (document.querySelector('[data-panorama-output-receipt="true"]')?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
  assert.match(fallbackOutputReceipt, /卡片快照/);
  assert.match(fallbackOutputReceipt, /完整明细未载入/);
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
        outcomeBinder: {
          id: 'archive-hydrated-outcome-binder',
          userId: 'scene1',
          prepId: 'archive-hydrated-prep',
          eventExternalId: 'archive-hydrated-event',
          eventTitle: 'Hydrated archive recap',
          eventStartAt: Math.floor(Date.now() / 1000) - 3600,
          meetingId: 'archive-hydrated',
          status: 'bound',
          slots: [
            {
              id: 'archive-hydrated-followup-slot',
              title: '确认客户 follow-up owner',
              type: 'action',
              status: 'resolved',
              mentionState: 'supported',
              sourceEvidenceIds: ['archive-hydrated-agenda'],
              evidence: [
                {
                  id: 'archive-hydrated-action-evidence',
                  kind: 'action',
                  refId: 'manual-1',
                  label: '行动项',
                  snippet: 'Morgan 在周五前整理客户 follow-up。',
                },
              ],
              resultSummary: 'Morgan 已接下客户 follow-up，截止周五。',
              confidence: 0.94,
            },
          ],
          sourceEvidence: [],
          sourceHash: 'archive-hydrated-outcome-source',
          bindingMode: 'deterministic_fallback',
          generatedAt: Math.floor(Date.now() / 1000) - 7200,
          boundAt: Math.floor(Date.now() / 1000) - 120,
          createdAt: Math.floor(Date.now() / 1000) - 7200,
          updatedAt: Math.floor(Date.now() / 1000) - 120,
          receipt: {
            source: 'Meeting Pilot 会后装订',
            coverage: '1 项已闭环。',
            freshness: '刚刚装订',
            boundary: '只读派生结果；不会写回 Calendar 或外部任务。',
          },
        },
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
      outcomeReceipt: normalize(
        document.querySelector('[data-meeting-outcome-result="true"]')?.textContent,
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
  assert.match(hydratedState.outcomeReceipt, /会后结果装订/);
  assert.match(hydratedState.outcomeReceipt, /Morgan 已接下客户 follow-up/);
  assert.match(hydratedState.outcomeReceipt, /不会写回 Calendar/);
  await hydratedPage.close();

  assert.deepEqual(pageErrors, [], `页面脚本异常: ${pageErrors.join('\n\n')}`);
  log(`Panorama 跟进状态 E2E 验证通过，截图目录: ${screenshotDir}`);
  await page.close();
} finally {
  await launched?.context?.close().catch(() => undefined);
}
