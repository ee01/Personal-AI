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
  path.join(os.tmpdir(), 'meeting-pilot-history-check-'),
);
const memoryBaseUrl = 'https://memory.example.test';

function log(message) {
  console.log(`[meeting-pilot-history] ${message}`);
}

async function saveScreenshot(page, filename) {
  const fullPath = path.join(screenshotDir, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  return fullPath;
}

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'meeting-pilot-history-browser-'),
  );
  const extensionPath = path.join(repoRoot, 'dist');
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
    serviceWorker,
  };
}

let launched;

try {
  launched = await launchExtensionContext();
  const { context, extensionId, serviceWorker } = launched;

  await serviceWorker.evaluate(
    (configuredBaseUrl) =>
      chrome.storage.local.set({
        envConfig: {
          MEMORY_SERVICE_BASE_URL: configuredBaseUrl,
          MEMORY_SERVICE_API_KEY: 'history-check-key',
        },
      }),
    memoryBaseUrl,
  );

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/memory-exploring.html`, {
    waitUntil: 'load',
    timeout: 30000,
  });
  await page.evaluate(async () => {
    const olderMeetings = Array.from({ length: 50 }, (_, index) => ({
      meetingId: `meeting-archive-older-${String(index + 1).padStart(2, '0')}`,
      title: `Older Retrospective ${index + 1}`,
      date: 1712332800000 - index * 3600000,
      lastEventAt: 1712334600000 - index * 3600000,
      participants: ['Esone Qiu'],
      pdfUrl: `https://memory.example.test/files/older-${index + 1}.pdf`,
      digestStatus: 'completed',
      summary: `第 ${index + 1} 条更早会议记录。`,
      topicCount: 1,
      actionItemCount: 0,
      decisionCount: 0,
    }));
    await chrome.runtime.sendMessage({
      type: 'SET_TEST_MEETINGS_FIXTURE',
      fixture: {
        items: [
          {
            meetingId: 'meeting-archive-001',
            title: 'Q2 Planning Review',
            date: 1712505600000,
            lastEventAt: 1712509200000,
            participants: [
              'Alex Chen',
              'Esone Qiu',
              'Sarah Wang',
              'Morgan Lee',
              'Priya Nair',
              'Jordan Kim',
            ],
            pdfUrl: 'https://memory.example.test/files/q2-planning.pdf',
            digestId: 'digest-q2-planning',
            digestStatus: 'completed',
            summary: '确认了 Q2 预算、技术评审 owner 与下一步行动。',
            archiveSearchText:
              'Transcript-only note: Morgan flagged procurement blockers.',
            topicCount: 3,
            actionItemCount: 2,
            decisionCount: 2,
          },
          {
            meetingId: 'meeting-archive-failed',
            title: 'Incident Review',
            date: 1712419200000,
            lastEventAt: 1712422800000,
            participants: ['Alex Chen', 'Esone Qiu'],
            pdfUrl: 'javascript:alert(1)',
            digestId: 'digest-incident',
            digestStatus: 'failed',
            digestErrorCode: 'minutes_api_timeout',
            summary: '事故复盘结构化记录已保留，但 PDF 生成失败。',
            topicCount: 2,
            actionItemCount: 1,
            decisionCount: 1,
          },
          {
            meetingId: 'meeting-archive-unsafe-pdf',
            title: 'Security Review',
            date: 1712415600000,
            lastEventAt: 1712417400000,
            participants: ['Jordan Kim', 'Esone Qiu'],
            pdfUrl: 'javascript:alert(2)',
            digestId: 'digest-security',
            summary:
              '结构化会议记录可用，但 PDF URL 使用了不安全协议。',
            topicCount: 1,
            actionItemCount: 1,
            decisionCount: 0,
          },
          {
            meetingId: 'meeting-archive-processing',
            title: 'Roadmap Sync',
            date: 1712412000000,
            lastEventAt: 1712413800000,
            participants: ['Alex Chen', 'Esone Qiu'],
            digestId: 'digest-roadmap-sync',
            digestStatus: 'processing',
            summary: '结构化归档已写入，PDF 仍在生成。',
            topicCount: 2,
            actionItemCount: 1,
            decisionCount: 0,
          },
          {
            meetingId: 'meeting-archive-basic-only',
            title: 'Coffee Chat',
            date: 1712408400000,
            lastEventAt: 1712410200000,
            participants: ['Esone Qiu'],
            summary: '只保留基础归档记录，尚无 Digest/PDF。',
            topicCount: 0,
            actionItemCount: 0,
            decisionCount: 0,
          },
          ...olderMeetings,
        ],
        total: 55,
        limit: 50,
        offset: 0,
        detail: {
          meetingId: 'meeting-archive-001',
          title: 'Q2 Planning Review',
          date: 1712505600000,
          lastEventAt: 1712509200000,
          participants: ['Alex Chen', 'Esone Qiu', 'Sarah Wang'],
          pdfUrl: 'https://memory.example.test/files/q2-planning.pdf',
          digestId: 'digest-q2-planning',
          summary: '确认了 Q2 预算、技术评审 owner 与下一步行动。',
          latestObservationText: '共享画面显示预算表和 Sprint 甘特图。',
          topicCount: 3,
          actionItemCount: 2,
          decisionCount: 2,
          chapters: [
            {
              id: 'chapter-1',
              title: 'Q2 预算讨论',
              summary: '预算与 owner 被确认。',
              startLabel: '10:05',
              actionCount: 1,
              decisionCount: 1,
            },
          ],
          actionItems: [
            {
              id: 'action-1',
              title: '准备技术评审文档',
              owner: 'Esone',
              deadline: '04-08',
              status: 'pending',
            },
          ],
          decisions: [
            {
              id: 'decision-1',
              text: 'Q2 预算确认为 200 万。',
              timestamp: '10:15',
            },
          ],
          timelineEvents: [
            {
              id: 'timeline-1',
              type: 'decision',
              title: 'Q2 预算确认为 200 万',
              description: '云服务 40%，人力 45%，弹性 15%。',
              timestamp: '10:15',
            },
          ],
          participantStances: [
            {
              participant: 'Sarah Wang',
              topic: 'Q2 预算',
              stance: '支持',
              keyQuote: '预算分配合理，建议保留弹性预算。',
              timeRange: '10:12',
            },
          ],
        },
      },
    });
  });

  log('打开 memory-exploring 会议记录页');
  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/meetings`,
    {
      waitUntil: 'load',
      timeout: 30000,
    },
  );

  await page.waitForFunction(
    () => {
      return Array.from(document.querySelectorAll('.meeting-card')).length >= 1;
    },
    { timeout: 15000 },
  );

  const cardText = await page.locator('.meeting-card').first().textContent();
  assert.match(cardText || '', /Q2 Planning Review/);
  assert.match(cardText || '', /Digest 完成/);
  assert.match(cardText || '', /PDF 已就绪/);
  assert.match(cardText || '', /还有 1 人/);
  assert.match(cardText || '', /确认了 Q2 预算/);
  assert.match(cardText || '', /话题 3/);
  assert.match(cardText || '', /行动项 2/);
  assert.match(cardText || '', /决议 2/);
  assert.match(cardText || '', /打开范围/);
  assert.match(cardText || '', /Panorama 复核 \+ 安全 PDF 可打开/);
  assert.match(
    cardText || '',
    /不重新分析会议、发送纪要、写入 Memory Service 或修改行动项/,
  );
  assert.match(
    await page.locator('.meeting-list-toolbar').textContent(),
    /已显示 50 \/ 55/,
  );
  const initialReceipt = await page
    .locator('[data-meeting-archive-receipt="true"]')
    .textContent();
  assert.match(initialReceipt || '', /会议归档读取回执/);
  assert.match(initialReceipt || '', /已读取最新会议归档/);
  assert.match(initialReceipt || '', /已显示 50 \/ 55 条/);
  assert.match(
    initialReceipt || '',
    /没有重新分析会议、生成 PDF、写入 Memory Service/,
  );
  const initialCompletionReceipt = await page
    .locator('[data-meeting-completion-receipt="true"]')
    .textContent();
  assert.match(initialCompletionReceipt || '', /归档完整度回执/);
  assert.match(
    initialCompletionReceipt || '',
    /有 4 条会议还不能当成完整纪要交付/,
  );
  assert.match(initialCompletionReceipt || '', /当前页已加载 50 \/ 55 条会议/);
  assert.match(initialCompletionReceipt || '', /当前页快照/);
  assert.match(initialCompletionReceipt || '', /完整可交付\s*46 条/);
  assert.match(initialCompletionReceipt || '', /需复核\s*2 条/);
  assert.match(initialCompletionReceipt || '', /生成中\s*1 条/);
  assert.match(initialCompletionReceipt || '', /仅基础归档\s*1 条/);
  assert.match(initialCompletionReceipt || '', /先用“需处理 \/ 生成中 \/ 仅归档”筛选定位会议/);
  assert.match(initialCompletionReceipt || '', /不会重新分析会议、催跑 Minutes API、生成 PDF/);
  assert.equal(
    await page
      .locator('.meeting-card', { hasText: 'Older Retrospective 50' })
      .count(),
    0,
  );
  const failedCardText = await page
    .locator('.meeting-card', { hasText: 'Incident Review' })
    .textContent();
  assert.match(failedCardText || '', /Digest 失败/);
  assert.match(failedCardText || '', /PDF 链接不可用/);
  assert.match(failedCardText || '', /minutes_api_timeout/);
  assert.match(failedCardText || '', /处理建议/);
  assert.match(failedCardText || '', /PDF 链接被拦截/);
  assert.match(
    failedCardText || '',
    /PDF 链接未通过安全检查，按钮保持禁用/,
  );
  await saveScreenshot(page, 'history-list.png');

  log('验证会议归档搜索与状态筛选');
  await page
    .getByPlaceholder('搜索标题、摘要、参会者、会议 ID 或转写片段')
    .fill('Incident');
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.meeting-card').length === 1 &&
      document.body.textContent.includes('Incident Review'),
    { timeout: 15000 },
  );
  assert.match(
    await page.locator('.meeting-list-toolbar').textContent(),
    /已显示 1 \/ 1/,
  );

  await page
    .getByPlaceholder('搜索标题、摘要、参会者、会议 ID 或转写片段')
    .fill('procurement blockers');
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.meeting-card').length === 1 &&
      document.body.textContent.includes('Q2 Planning Review'),
    { timeout: 15000 },
  );
  assert.match(
    await page.locator('.meeting-list-toolbar').textContent(),
    /关键词“procurement blockers”/,
  );
  const searchReceipt = await page
    .locator('[data-meeting-archive-receipt="true"]')
    .textContent();
  assert.match(searchReceipt || '', /已按筛选读取会议归档/);
  assert.match(searchReceipt || '', /关键词“procurement blockers”/);
  assert.match(searchReceipt || '', /服务端筛选后分页/);
  const searchCompletionReceipt = await page
    .locator('[data-meeting-completion-receipt="true"]')
    .textContent();
  assert.match(searchCompletionReceipt || '', /当前已加载会议都有可复核的完整交付物/);
  assert.match(searchCompletionReceipt || '', /当前筛选：关键词“procurement blockers”/);
  assert.match(searchCompletionReceipt || '', /完整可交付\s*1 条/);
  assert.match(searchCompletionReceipt || '', /需复核\s*0 条/);

  await page
    .getByPlaceholder('搜索标题、摘要、参会者、会议 ID 或转写片段')
    .fill('Incident');
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.meeting-card').length === 1 &&
      document.body.textContent.includes('Incident Review'),
    { timeout: 15000 },
  );

  await page.locator('.meeting-status-filter select').selectOption('ready');
  await page.getByText('没有匹配的会议记录').waitFor({ timeout: 15000 });
  assert.match(
    await page.locator('.meeting-feedback-card').textContent(),
    /关键词“Incident”.*状态 可打开/s,
  );
  const emptyReceipt = await page
    .locator('[data-meeting-empty-receipt="true"]')
    .textContent();
  assert.match(emptyReceipt || '', /筛选已成功读取，但没有匹配会议/);
  assert.match(emptyReceipt || '', /服务端按同一条件返回 0 条/);
  assert.match(
    emptyReceipt || '',
    /标题、摘要、参会者、会议 ID、错误码，以及归档转写\/观察文本/,
  );
  assert.match(emptyReceipt || '', /不是读取失败/);
  assert.match(emptyReceipt || '', /没有重新分析会议、生成 PDF、写入 Memory Service/);
  assert.match(emptyReceipt || '', /清除筛选回到完整归档/);
  assert.equal(
    await page.getByRole('button', { name: '回到完整归档' }).isVisible(),
    true,
  );

  await page.locator('.meeting-status-filter select').selectOption('attention');
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.meeting-card').length === 1 &&
      document.body.textContent.includes('Incident Review') &&
      document.body.textContent.includes('PDF 链接不可用'),
    { timeout: 15000 },
  );

  await page.getByRole('button', { name: '清除筛选' }).click();
  await page.waitForFunction(
    () => document.querySelectorAll('.meeting-card').length >= 50,
    { timeout: 15000 },
  );
  assert.match(
    await page.locator('.meeting-list-toolbar').textContent(),
    /已显示 50 \/ 55/,
  );
  const clearedReceipt = await page
    .locator('[data-meeting-archive-receipt="true"]')
    .textContent();
  assert.match(clearedReceipt || '', /已回到完整会议归档/);
  assert.match(clearedReceipt || '', /全部会议；按最近会议时间分页/);

  await page
    .getByPlaceholder('搜索标题、摘要、参会者、会议 ID 或转写片段')
    .fill('Security');
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await page.locator('.meeting-status-filter select').selectOption('attention');
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.meeting-card').length === 1 &&
      document.body.textContent.includes('Security Review') &&
      document.body.textContent.includes('PDF 链接被拦截'),
    { timeout: 15000 },
  );
  assert.match(
    await page.locator('.meeting-list-toolbar').textContent(),
    /已显示 1 \/ 1/,
  );
  assert.match(
    await page.locator('.meeting-list-toolbar').textContent(),
    /关键词“Security”.*状态 需处理/s,
  );
  const unsafeCardText = await page
    .locator('.meeting-card', { hasText: 'Security Review' })
    .textContent();
  assert.match(unsafeCardText || '', /PDF 链接不可用/);
  assert.match(unsafeCardText || '', /处理建议/);
  assert.match(unsafeCardText || '', /Minutes API 返回的 pdfUrl/);
  assert.match(unsafeCardText || '', /优先 Panorama 复核，PDF 暂不打开/);

  await page.getByRole('button', { name: '清除筛选' }).click();
  await page.waitForFunction(
    () => document.querySelectorAll('.meeting-card').length >= 50,
    { timeout: 15000 },
  );
  assert.match(
    await page.locator('.meeting-list-toolbar').textContent(),
    /已显示 50 \/ 55/,
  );

  log('验证加载更早会议');
  await page.getByRole('button', { name: '加载更早会议' }).click();
  await page.waitForFunction(
    () => {
      return (
        Array.from(document.querySelectorAll('.meeting-card')).length >= 55
      );
    },
    { timeout: 15000 },
  );
  assert.match(
    await page.locator('.meeting-list-toolbar').textContent(),
    /已显示 55 \/ 55/,
  );
  assert.ok(
    await page
      .locator('.meeting-card', { hasText: 'Older Retrospective 50' })
      .isVisible(),
    '加载更多后应显示第二页更早会议',
  );
  assert.equal(
    await page.getByRole('button', { name: '已加载全部会议' }).isDisabled(),
    true,
  );
  const loadMoreReceipt = await page
    .locator('[data-meeting-archive-receipt="true"]')
    .textContent();
  assert.match(loadMoreReceipt || '', /已追加更早会议/);
  assert.match(loadMoreReceipt || '', /已显示 55 \/ 55 条/);
  assert.match(loadMoreReceipt || '', /当前筛选范围已加载完/);
  const loadMoreCompletionReceipt = await page
    .locator('[data-meeting-completion-receipt="true"]')
    .textContent();
  assert.match(loadMoreCompletionReceipt || '', /当前显示范围/);
  assert.match(loadMoreCompletionReceipt || '', /完整可交付\s*51 条/);
  assert.match(loadMoreCompletionReceipt || '', /需复核\s*2 条/);
  assert.match(loadMoreCompletionReceipt || '', /生成中\s*1 条/);
  assert.match(loadMoreCompletionReceipt || '', /仅基础归档\s*1 条/);

  await page.evaluate(() => {
    const opened = [];
    window.__meetingHistoryOpenedUrls = opened;
    window.open = (url) => {
      opened.push(String(url || ''));
      return null;
    };
  });

  log('验证打开 Panorama 与 PDF 动作');
  const q2Card = page.locator('.meeting-card', {
    hasText: 'Q2 Planning Review',
  });
  const failedCard = page.locator('.meeting-card', {
    hasText: 'Incident Review',
  });
  await q2Card.locator('.meeting-primary-action').click();
  const q2OpenReceipt = page.locator(
    '[data-meeting-open-receipt="true"][data-meeting-id="meeting-archive-001"]',
  );
  await q2OpenReceipt.waitFor({ timeout: 10000 });
  assert.match(await q2OpenReceipt.textContent(), /已打开 Panorama/);
  assert.match(
    await q2OpenReceipt.textContent(),
    /只打开现有归档页面/,
  );
  await q2Card.locator('.meeting-secondary-action').click();
  assert.match(await q2OpenReceipt.textContent(), /已打开安全 PDF/);
  assert.match(
    await q2OpenReceipt.textContent(),
    /只打开已通过安全检查的 PDF/,
  );
  await failedCard.locator('.meeting-primary-action').click();
  const failedOpenReceipt = page.locator(
    '[data-meeting-open-receipt="true"][data-meeting-id="meeting-archive-failed"]',
  );
  await failedOpenReceipt.waitFor({ timeout: 10000 });
  assert.match(await failedOpenReceipt.textContent(), /已打开 Panorama/);
  assert.match(
    await failedOpenReceipt.textContent(),
    /没有重新分析会议、生成 PDF、发送纪要/,
  );
  assert.equal(
    await failedCard.locator('.meeting-secondary-action').isDisabled(),
    true,
  );
  const openedUrls = await page.evaluate(
    () => window.__meetingHistoryOpenedUrls || [],
  );
  assert.ok(
    openedUrls.some((url) =>
      /meeting-panorama\.html\?.*meetingId=meeting-archive-001/.test(url),
    ),
    `打开 Panorama 未请求预期 URL: ${JSON.stringify(openedUrls)}`,
  );
  assert.ok(
    openedUrls.includes('https://memory.example.test/files/q2-planning.pdf'),
    `打开 PDF 未请求预期 URL: ${JSON.stringify(openedUrls)}`,
  );
  assert.ok(
    openedUrls.some((url) =>
      /meeting-panorama\.html\?.*meetingId=meeting-archive-failed/.test(url),
    ),
    `失败会议未打开 Panorama: ${JSON.stringify(openedUrls)}`,
  );
  assert.ok(
    openedUrls.some((url) => /digestStatus=failed/.test(url)),
    `失败会议没有保留 digestStatus=failed: ${JSON.stringify(openedUrls)}`,
  );
  assert.ok(
    openedUrls.every((url) => !url.includes('javascript:alert')),
    `不安全 PDF 链接不应被打开或带入 Panorama: ${JSON.stringify(openedUrls)}`,
  );

  log(`会议历史 UI 验证通过，截图目录: ${screenshotDir}`);
  await page.close();
} finally {
  await launched?.context?.close().catch(() => undefined);
}
