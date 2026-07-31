import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const extensionPath = path.join(repoRoot, 'dist');
const storageKey = 'projectDashboardFishboneProjects';

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'project-dashboard-e2e-browser-'),
  );
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    acceptDownloads: true,
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
    userDataDir,
  };
}

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error instanceof Error ? error.message : String(error));
  });
  return () => {
    assert.deepEqual(errors, [], `Project dashboard page errors: ${errors.join('; ')}`);
  };
}

function dataSourceCard(page, label, status = 'not_configured') {
  return page.locator(`.data-source-card.${status}`).filter({
    has: page.locator('.data-source-card-top strong', {
      hasText: new RegExp(`^${label}$`),
    }),
  });
}

let launched;

try {
  launched = await launchExtensionContext();
  const { context, extensionId, serviceWorker } = launched;

  await serviceWorker.evaluate(async ({ key }) => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      [key]: {
        version: 1,
        savedAt: Date.now(),
        projects: [
          {
            id: 'risk-demo',
            name: 'Risk Demo Project',
            description: 'Project with a blocked high-risk activity',
            lastStatusReviewAt: new Date().toISOString(),
            milestones: [{ id: 'ga', label: 'GA', date: '2099-05-30' }],
            tasks: [
              {
                id: 'blocked-risk-task',
                type: 'dep',
                title: 'Resolve release blocker',
                status: 'blocked',
                eta: yesterday,
              },
            ],
            platformConfig: ['sdk', 'qa'],
          },
          {
            id: 'stale-demo',
            name: 'Stale Demo Project',
            description: 'Completed project with an old local plan',
            lastStatusReviewAt: '2024-01-20T08:00:00+08:00',
            milestones: [{ id: 'ga', label: 'GA', date: '2024-01-15' }],
            tasks: [
              {
                id: 'closed-task',
                type: 'task',
                title: 'Closed work',
                status: 'closed',
                eta: '2024-01-10',
              },
            ],
            platformConfig: ['sdk', 'qa'],
          },
          {
            id: 'fresh-demo',
            name: 'Fresh Demo Project',
            description: 'Project with a future milestone',
            lastStatusReviewAt: new Date().toISOString(),
            milestones: [{ id: 'ga', label: 'GA', date: '2099-06-10' }],
            tasks: [
              {
                id: 'foundation-task',
                type: 'task',
                title: 'Foundation work',
                status: 'closed',
                eta: '2099-05-20',
                jira: [{ key: 'FRESH-0', title: 'Foundation work' }],
              },
              {
                id: 'active-task',
                type: 'task',
                title: 'Future work',
                status: 'progress',
                eta: '2099-06-01',
                dependencies: ['foundation-task', 'ga'],
                jira: [{ key: 'FRESH-1', title: 'Future work' }],
              },
            ],
            platformConfig: ['sdk', 'qa'],
          },
          {
            id: 'evidence-gap-demo',
            name: 'Evidence Gap Project',
            description: 'Project with active work missing ETA and source',
            lastStatusReviewAt: new Date().toISOString(),
            milestones: [{ id: 'ga', label: 'GA', date: '2099-07-01' }],
            tasks: [
              {
                id: 'missing-evidence-task',
                type: 'task',
                title: 'Clarify launch readiness',
                status: 'progress',
              },
            ],
            platformConfig: ['sdk', 'qa'],
          },
        ],
      },
    });
  }, { key: storageKey });

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);

  await page.goto(`chrome-extension://${extensionId}/project-dashboard.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await page.locator('h1', { hasText: '项目进度仪表盘' }).waitFor({
    timeout: 15000,
  });
  await page.locator('.data-source-action', {
    hasText: '同步/检查数据源',
  }).waitFor({ timeout: 15000 });
  const syncButtons = page.locator('button', {
    hasText: '同步/检查数据源',
  });
  assert.equal(await syncButtons.count(), 2);
  for (let index = 0; index < 2; index += 1) {
    const button = syncButtons.nth(index);
    assert.match(
      await button.getAttribute('title') || '',
      /只读取 Memory Service active watched projects/,
    );
    assert.match(
      await button.getAttribute('aria-label') || '',
      /不反写 Memory Service、外部项目源或发送通知/,
    );
  }
  await page.locator('.snapshot-receipt.fresh', {
    hasText: '已读取 4 个项目',
  }).waitFor({ timeout: 15000 });
  await page.locator('.snapshot-receipt.fresh', {
    hasText: '外部来源状态仍以“同步/检查数据源”为准',
  }).waitFor({ timeout: 15000 });
  await page.locator('.snapshot-receipt.fresh', {
    hasText: '不会同步、清空、覆盖或写回 Memory Service、Jira、GitHub、Confluence',
  }).waitFor({ timeout: 15000 });
  const decisionBriefAction = page.locator('.decision-brief-action').first();
  await decisionBriefAction.waitFor({ timeout: 15000 });
  assert.match(
    await decisionBriefAction.getAttribute('title') || '',
    /首屏决策摘要入口：打开 Risk Demo Project · Resolve release blocker 的本地任务详情/,
  );
  assert.match(
    await decisionBriefAction.getAttribute('aria-label') || '',
    /不读取或写回 Memory Service、Jira、GitHub、Confluence/,
  );
  await page.evaluate(() => {
    globalThis.__projectDashboardOriginalSendMessage =
      globalThis.__projectDashboardOriginalSendMessage || chrome.runtime.sendMessage.bind(chrome.runtime);
    const originalSendMessage = globalThis.__projectDashboardOriginalSendMessage;
    chrome.runtime.sendMessage = async (request, ...args) => {
      if (request?.type === 'GET_PROJECT_DATA') {
        return {
          success: false,
          error: 'e2e local snapshot unavailable',
        };
      }
      return originalSendMessage(request, ...args);
    };
  });
  await page.locator('.dashboard-controls .control-button', {
    hasText: '刷新数据',
  }).click();
  await page.locator('.snapshot-receipt.stale', {
    hasText: '刷新失败，仍显示',
  }).waitFor({ timeout: 15000 });
  await page.locator('.snapshot-receipt.stale', {
    hasText: 'e2e local snapshot unavailable；失败 1 次',
  }).waitFor({ timeout: 15000 });
  await page.locator('.snapshot-receipt.stale', {
    hasText: '已保留现有页面数据；不会清空、覆盖或同步外部系统',
  }).waitFor({ timeout: 15000 });
  await page.locator('.dashboard-status.error', {
    hasText: 'e2e local snapshot unavailable',
  }).waitFor({ timeout: 15000 });
  await page.evaluate(() => {
    if (globalThis.__projectDashboardOriginalSendMessage) {
      chrome.runtime.sendMessage = globalThis.__projectDashboardOriginalSendMessage;
    }
  });
  await serviceWorker.evaluate(() => {
    globalThis.__projectDashboardOriginalFetch =
      globalThis.__projectDashboardOriginalFetch || globalThis.fetch.bind(globalThis);
    const originalFetch = globalThis.__projectDashboardOriginalFetch;
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input?.url || String(input);
      if (url.includes('/projects/watched')) {
        throw new Error('e2e memory offline');
      }
      return originalFetch(input, init);
    };
  });
  await page.locator('.data-source-action', {
    hasText: '同步/检查数据源',
  }).click();
  await page.locator('.dashboard-status.warning', {
    hasText: 'Memory Service 关注项目暂不可用',
  }).waitFor({ timeout: 15000 });
  await page.locator('.dashboard-status.warning', {
    hasText: '本次未读到 Memory Service',
  }).waitFor({ timeout: 15000 });
  await page.locator('.data-source-panel', {
    hasText: 'Memory Service 关注项目暂不可用',
  }).waitFor({ timeout: 15000 });
  await page.locator('.data-source-scope.attention', {
    hasText: '本次未读到 Memory Service',
  }).waitFor({ timeout: 15000 });
  await page.locator('.data-source-scope.attention', {
    hasText: '未接入跳过：Jira、GitHub、Confluence',
  }).waitFor({ timeout: 15000 });
  await page.locator('.data-source-scope.attention', {
    hasText: '不代表 Jira/GitHub/Confluence 已同步',
  }).waitFor({ timeout: 15000 });
  await page.locator('.data-source-evidence.attention', {
    hasText: '本地证据不完整：ETA 67%，来源 33%',
  }).waitFor({ timeout: 15000 });
  await page.locator('.data-source-evidence.attention', {
    hasText: '缺来源：Resolve release blocker、Clarify launch readiness',
  }).waitFor({ timeout: 15000 });
  await page.locator('.data-source-evidence.attention', {
    hasText: '先补 1 个缺 ETA、2 个缺来源，避免把本地工作台误当外部权威状态',
  }).waitFor({ timeout: 15000 });
  await page.locator('.data-source-card.unavailable', {
    hasText: 'Memory Service',
  }).locator('.data-source-card-top span', {
    hasText: '暂不可用',
  }).waitFor({ timeout: 15000 });
  await page.locator('.data-source-card.unavailable', {
    hasText: '不会清空或覆盖项目',
  }).waitFor({ timeout: 15000 });
  await page.locator('.data-source-card.unavailable', {
    hasText: 'ETA 覆盖 67%，来源覆盖 33%',
  }).waitFor({ timeout: 15000 });
  await dataSourceCard(page, 'Jira').locator('.data-source-card-top span', {
    hasText: '未接入',
  }).waitFor({ timeout: 15000 });
  await dataSourceCard(page, 'Jira').filter({
    hasText: '不会读取 Jira 任务、状态、负责人或评论',
  }).waitFor({ timeout: 15000 });
  await dataSourceCard(page, 'Jira').filter({
    hasText: '1/3 个活动任务有 Jira key',
  }).waitFor({ timeout: 15000 });
  await dataSourceCard(page, 'Jira').filter({
    hasText: '缺来源任务：Resolve release blocker、Clarify launch readiness',
  }).waitFor({ timeout: 15000 });
  const dataSourceFixSourceButton = page.locator('.data-source-evidence-action.fix-source', {
    hasText: '补来源：Resolve release blocker',
  });
  assert.match(
    await dataSourceFixSourceButton.getAttribute('title') || '',
    /数据源检查修复入口：打开 Risk Demo Project · Resolve release blocker 的本地来源修复位置/,
  );
  assert.match(
    await dataSourceFixSourceButton.getAttribute('aria-label') || '',
    /不读取或写回 Memory Service、Jira、GitHub、Confluence/,
  );
  await dataSourceFixSourceButton.click();
  await page.locator('.zoom-title', {
    hasText: 'Resolve release blocker',
  }).waitFor({ timeout: 15000 });
  await page.locator('.local-repair-receipt', {
    hasText: '本地修复入口',
  }).locator('strong', {
    hasText: '已打开 Resolve release blocker 的来源补齐位置',
  }).waitFor({ timeout: 15000 });
  await page.locator('.local-repair-receipt', {
    hasText: '不会读取或写回 Jira/GitHub/Confluence/Memory Service',
  }).waitFor({ timeout: 15000 });
  await page.waitForFunction(() => document.activeElement?.matches('[data-evidence-control="platform-status"]'));
  await page.locator('.zoom-overlay.active .close-btn').click();
  await page.locator('.zoom-title', {
    hasText: 'Resolve release blocker',
  }).waitFor({ state: 'detached', timeout: 15000 });

  const launchReadinessGap = page.locator('.evidence-gap-item', {
    hasText: 'Clarify launch readiness',
  }).first();
  await launchReadinessGap.waitFor({ timeout: 15000 });
  assert.match(
    await launchReadinessGap.getAttribute('title') || '',
    /证据补全队列入口：打开 Evidence Gap Project · Clarify launch readiness 的本地 ETA 修复位置/,
  );
  assert.match(
    await launchReadinessGap.getAttribute('aria-label') || '',
    /保存前只是本页草稿/,
  );
  await launchReadinessGap.click();
  await page.locator('.zoom-title', {
    hasText: 'Clarify launch readiness',
  }).waitFor({ timeout: 15000 });
  const etaRepairButton = page.locator('.evidence-repair-card', {
    hasText: 'ETA',
  }).locator('.evidence-repair-card-action', {
    hasText: '补 ETA',
  });
  assert.match(
    await etaRepairButton.getAttribute('title') || '',
    /任务详情证据修复按钮：打开 Evidence Gap Project · Clarify launch readiness 的本地 ETA 修复位置/,
  );
  assert.match(
    await etaRepairButton.getAttribute('aria-label') || '',
    /预计完成时间输入/,
  );
  const sourceRepairButton = page.locator('.evidence-repair-card', {
    hasText: '来源',
  }).locator('.evidence-repair-card-action', {
    hasText: '补来源',
  });
  assert.match(
    await sourceRepairButton.getAttribute('title') || '',
    /任务详情证据修复按钮：打开 Evidence Gap Project · Clarify launch readiness 的本地来源修复位置/,
  );
  assert.match(
    await sourceRepairButton.getAttribute('aria-label') || '',
    /Jira key、平台状态、负责人或平台 Jira/,
  );
  await page.locator('.zoom-overlay.active .close-btn').click();
  await page.locator('.zoom-title', {
    hasText: 'Clarify launch readiness',
  }).waitFor({ state: 'detached', timeout: 15000 });

  const exportDownloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await page.locator('.control-button.success', {
    hasText: '导出全部',
  }).click();
  const exportDownload = await exportDownloadPromise;
  assert.match(exportDownload.suggestedFilename(), /^project-report-all-/);
  await page.locator('.export-receipt', {
    hasText: '全部项目报告已导出：4 项目 / 5 任务',
  }).waitFor({ timeout: 15000 });
  await page.locator('.export-receipt-metrics', {
    hasText: '活动任务 3',
  }).waitFor({ timeout: 15000 });
  await page.locator('.export-receipt-metrics', {
    hasText: 'Jira 来源 2',
  }).waitFor({ timeout: 15000 });
  await page.locator('.export-receipt-gaps', {
    hasText: '缺 ETA 1',
  }).waitFor({ timeout: 15000 });
  await page.locator('.export-receipt-gaps', {
    hasText: '缺来源 2',
  }).waitFor({ timeout: 15000 });
  await page.locator('.export-receipt-projects', {
    hasText: 'Risk Demo Project',
  }).waitFor({ timeout: 15000 });
  await page.locator('.export-receipt', {
    hasText: '不会同步、删除、恢复或写回 Memory Service、Jira、GitHub、Confluence',
  }).waitFor({ timeout: 15000 });

  await page.locator('.decision-brief.critical', {
    hasText: '先处理阻塞',
  }).locator('.decision-brief-action', {
    hasText: '打开任务',
  }).click();
  await page.locator('.zoom-title', {
    hasText: 'Resolve release blocker',
  }).waitFor({ timeout: 15000 });
  await page.locator('.zoom-overlay.active .close-btn').click();
  await page.locator('.zoom-title', {
    hasText: 'Resolve release blocker',
  }).waitFor({ state: 'detached', timeout: 15000 });

  await page.locator('.overview-metrics span', { hasText: '1 计划陈旧' }).waitFor({
    timeout: 15000,
  });
  await page.locator('.overview-metrics span', { hasText: '1 待复核' }).waitFor({
    timeout: 15000,
  });
  await page.locator('.overview-metrics span', { hasText: '2 证据待补' }).waitFor({
    timeout: 15000,
  });
  await page.locator('.project-filter-button', {
    hasText: '需关注',
  }).locator('strong', { hasText: '2' }).waitFor({ timeout: 15000 });
  await page.locator('.project-filter-button', {
    hasText: '需处理',
  }).locator('strong', { hasText: '1' }).waitFor({ timeout: 15000 });
  await page.locator('.project-filter-button', {
    hasText: '正常',
  }).locator('strong', { hasText: '1' }).waitFor({ timeout: 15000 });
  const projectSearchInput = page.locator('.project-local-search input');
  assert.match(
    await projectSearchInput.getAttribute('title') || '',
    /当前浏览器本地项目快照/,
  );
  assert.match(
    await projectSearchInput.getAttribute('aria-label') || '',
    /继续受“全部”项目视图限制/,
  );
  assert.match(
    await projectSearchInput.getAttribute('aria-label') || '',
    /不会读取、同步或写回 Memory Service、Jira、GitHub、Confluence/,
  );
  await projectSearchInput.fill('FRESH Future');
  await page.locator('.project-search-receipt', {
    hasText: '1/4 命中',
  }).locator('.project-search-mode', {
    hasText: '已按 2 个关键词同时收窄同一项目',
  }).waitFor({ timeout: 15000 });
  await page.locator('.project-search-hints span', {
    hasText: '任务 1',
  }).waitFor({ timeout: 15000 });
  await page.locator('.project-card', {
    hasText: 'Fresh Demo Project',
  }).waitFor({ timeout: 15000 });
  const projectSearchClear = page.locator('.project-local-search-clear', { hasText: '清除' });
  assert.match(
    await projectSearchClear.getAttribute('title') || '',
    /清除本页查找词，保留“全部”项目视图/,
  );
  assert.match(
    await projectSearchClear.getAttribute('aria-label') || '',
    /不会清空项目、读取外部系统或写回/,
  );
  await projectSearchInput.fill('FRESH-1');
  await page.locator('.project-search-receipt', {
    hasText: '1/4 命中',
  }).locator('em', {
    hasText: '不会读取、同步或写回 Memory Service、Jira、GitHub、Confluence',
  }).waitFor({ timeout: 15000 });
  await page.locator('.project-search-receipt .project-search-view-basis', {
    hasText: '这是当前本地快照的全部项目视图',
  }).waitFor({ timeout: 15000 });
  await page.locator('.project-search-hints span', {
    hasText: 'Jira 1',
  }).waitFor({ timeout: 15000 });
  await page.locator('.project-card', {
    hasText: 'Fresh Demo Project',
  }).waitFor({ timeout: 15000 });
  assert.equal(await page.locator('.project-card', { hasText: 'Risk Demo Project' }).count(), 0);
  await page.locator('.project-filter-button', {
    hasText: '需处理',
  }).click();
  assert.match(
    await projectSearchInput.getAttribute('title') || '',
    /继续受“需处理”项目视图限制/,
  );
  await page.locator('.project-search-receipt', {
    hasText: '当前“需处理”视图显示 0/1 个本地命中',
  }).waitFor({ timeout: 15000 });
  await page.locator('.project-search-receipt .project-search-view-basis', {
    hasText: '本地查找命中还会受“需处理”视图限制',
  }).waitFor({ timeout: 15000 });
  await page.locator('.project-search-receipt small', {
    hasText: '还有 1 个命中被项目视图筛选隐藏',
  }).waitFor({ timeout: 15000 });
  const receiptViewAllMatches = page.locator('.project-search-receipt .project-search-view-all', {
    hasText: '查看全部命中',
  });
  assert.match(
    await receiptViewAllMatches.getAttribute('title') || '',
    /切到“全部”项目视图查看 1 个本地查找命中/,
  );
  assert.match(
    await receiptViewAllMatches.getAttribute('aria-label') || '',
    /只改变本页视图筛选，保留查找词/,
  );
  await receiptViewAllMatches.click();
  await page.locator('.dashboard-status.success', {
    hasText: '已切到全部项目查看本地查找命中',
  }).waitFor({ timeout: 15000 });
  await page.locator('.project-card', {
    hasText: 'Fresh Demo Project',
  }).waitFor({ timeout: 15000 });
  await page.locator('.project-filter-button', {
    hasText: '需处理',
  }).click();
  await page.locator('.empty-projects.filter-empty', {
    hasText: '本地快照有 1 个命中',
  }).waitFor({ timeout: 15000 });
  const emptyViewAllMatches = page.locator('.empty-projects.filter-empty .control-button.primary', {
    hasText: '查看全部命中',
  });
  assert.match(
    await emptyViewAllMatches.getAttribute('title') || '',
    /切到“全部”项目视图查看 1 个本地查找命中/,
  );
  assert.match(
    await emptyViewAllMatches.getAttribute('aria-label') || '',
    /不读取、同步或写回 Memory Service、Jira、GitHub、Confluence/,
  );
  await emptyViewAllMatches.click();
  await page.locator('.project-card', {
    hasText: 'Fresh Demo Project',
  }).waitFor({ timeout: 15000 });
  await page.locator('.project-local-search-clear', { hasText: '清除' }).click();
  await page.locator('.project-card', {
    hasText: 'Risk Demo Project',
  }).waitFor({ timeout: 15000 });
  await projectSearchInput.fill('NO-SUCH-LOCAL-PROJECT');
  await page.locator('.empty-projects.filter-empty', {
    hasText: '当前浏览器本地项目快照没有命中',
  }).waitFor({ timeout: 15000 });
  const emptyViewAllProjects = page.locator('.empty-projects.filter-empty .control-button.primary', {
    hasText: '查看全部项目',
  });
  assert.match(
    await emptyViewAllProjects.getAttribute('title') || '',
    /清除本页无命中的查找词并切到“全部”项目视图/,
  );
  assert.match(
    await emptyViewAllProjects.getAttribute('aria-label') || '',
    /只恢复当前浏览器本地快照列表/,
  );
  await emptyViewAllProjects.click();
  await page.locator('.dashboard-status.success', {
    hasText: '已清除无命中的本地查找并切到全部项目',
  }).waitFor({ timeout: 15000 });
  assert.equal(await projectSearchInput.inputValue(), '');
  await page.locator('.project-card', {
    hasText: 'Risk Demo Project',
  }).waitFor({ timeout: 15000 });
  await page.locator('.review-queue', {
    hasText: '1 个项目待复核',
  }).waitFor({ timeout: 15000 });
  await page.locator('.review-queue-item.overdue', {
    hasText: 'Stale Demo Project',
  }).locator('.review-queue-action', {
    hasText: '预览草稿',
  }).waitFor({ timeout: 15000 });
  await page.locator('.review-queue-item.overdue', {
    hasText: 'Stale Demo Project',
  }).locator('.review-queue-action.primary', {
    hasText: '复核草稿',
  }).click();
  await page.locator('.status-review-gate.active', {
    hasText: '确认前先检查证据',
  }).waitFor({ timeout: 15000 });
  await page.locator('.status-draft-actions button', {
    hasText: '确认已复核',
  }).waitFor({ timeout: 15000 });
  await page.locator('.zoom-overlay.active .close-btn').click();
  await page.locator('.status-draft-modal').waitFor({ state: 'detached', timeout: 15000 });
  await page.locator('.evidence-gap-queue', {
    hasText: '2 个活动任务缺少 ETA 或来源',
  }).waitFor({ timeout: 15000 });
  await page.locator('.evidence-gap-breakdown', {
    hasText: 'ETA+来源 1',
  }).locator('.missing-source', {
    hasText: '来源 1',
  }).waitFor({ timeout: 15000 });
  await page.locator('.evidence-gap-item.missing-both', {
    hasText: 'Clarify launch readiness',
  }).locator('.evidence-gap-next', {
    hasText: '补 ETA 后关联 Jira 或平台状态',
  }).waitFor({ timeout: 15000 });
  await page.locator('.evidence-gap-item.missing-both', {
    hasText: 'Clarify launch readiness',
  }).click();
  await page.locator('.zoom-title', {
    hasText: 'Clarify launch readiness',
  }).waitFor({ timeout: 15000 });
  await page.locator('.local-repair-receipt', {
    hasText: '证据队列入口',
  }).locator('strong', {
    hasText: '已打开 Clarify launch readiness 的 ETA 补齐位置',
  }).waitFor({ timeout: 15000 });
  await page.locator('.local-repair-receipt', {
    hasText: '来自证据补全队列第 1/2 项',
  }).waitFor({ timeout: 15000 });
  await page.locator('.local-repair-receipt', {
    hasText: '排序只使用本地任务缺口、风险分和 ETA',
  }).waitFor({ timeout: 15000 });
  await page.locator('.local-repair-receipt', {
    hasText: '不会读取或写回 Memory Service、Jira/GitHub/Confluence',
  }).waitFor({ timeout: 15000 });
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-evidence-field') === 'eta');
  await page.locator('.evidence-repair-section', {
    hasText: '证据修复',
  }).locator('.evidence-repair-card.missing', {
    hasText: 'ETA',
  }).waitFor({ timeout: 15000 });
  await page.locator('.evidence-repair-section').locator('.evidence-repair-card.missing', {
    hasText: '来源',
  }).waitFor({ timeout: 15000 });
  await page.locator('.evidence-repair-next', {
    hasText: '先补 ETA，再关联 Jira 或填写平台来源',
  }).waitFor({ timeout: 15000 });
  await page.locator('.evidence-repair-card.missing', {
    hasText: 'ETA',
  }).locator('.evidence-repair-card-action', {
    hasText: '补 ETA',
  }).click();
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-evidence-field') === 'eta');
  await page.locator('.evidence-repair-card.missing', {
    hasText: '来源',
  }).locator('.evidence-repair-card-action', {
    hasText: '补来源',
  }).click();
  await page.waitForFunction(() => document.activeElement?.matches('[data-evidence-control="platform-status"]'));
  const qaPlatform = page.locator('.platform-item', {
    hasText: 'QA',
  });
  await qaPlatform.locator('.platform-source-state.missing', {
    hasText: '未填写来源',
  }).waitFor({ timeout: 15000 });
  assert.equal(await qaPlatform.locator('select[aria-label="QA 平台状态"]').inputValue(), '');
  await qaPlatform.locator('select[aria-label="QA 平台状态"]').selectOption('blocked');
  await qaPlatform.locator('.platform-source-state.complete', {
    hasText: '来源已记录',
  }).waitFor({ timeout: 15000 });
  await page.locator('.evidence-repair-section').locator('.evidence-repair-card.complete', {
    hasText: '来源',
  }).waitFor({ timeout: 15000 });
  await page.locator('.evidence-repair-next', {
    hasText: '补上可复核 ETA',
  }).waitFor({ timeout: 15000 });
  await page.locator('.zoom-overlay.active .close-btn').click();
  await page.locator('.zoom-title', {
    hasText: 'Clarify launch readiness',
  }).waitFor({ state: 'detached', timeout: 15000 });

  const riskCard = page.locator('.project-card', {
    hasText: 'Risk Demo Project',
  });
  await riskCard.locator('.chart-insight-strip', {
    hasText: '图表概览',
  }).waitFor({ timeout: 15000 });
  await riskCard.locator('.chart-scope-receipt.attention', {
    hasText: '1/3 就绪，2 个需处理',
  }).locator('em', {
    hasText: '依据本地任务 ETA、依赖任务',
  }).waitFor({ timeout: 15000 });
  await riskCard.locator('.chart-scope-receipt.attention', {
    hasText: '本地轻量图表，不代表 Jira/GitHub/Confluence 权威同步',
  }).waitFor({ timeout: 15000 });
  await riskCard.locator('.chart-insight-card.ready', {
    hasText: '甘特就绪度',
  }).locator('.chart-timeline-track').waitFor({ timeout: 15000 });
  await riskCard.locator('.chart-insight-card.ready', {
    hasText: '甘特就绪度',
  }).locator('.chart-driver-item.critical', {
    hasText: 'Resolve release blocker',
  }).waitFor({ timeout: 15000 });
  await riskCard.locator('.chart-insight-card.attention', {
    hasText: '依赖图',
  }).locator('.chart-driver-item.critical', {
    hasText: 'Resolve release blocker',
  }).locator('em', {
    hasText: '缺 Jira 或平台来源',
  }).waitFor({ timeout: 15000 });
  const dependencyPanelAction = riskCard.locator('.chart-insight-card.attention', {
    hasText: '依赖图',
  }).locator('.chart-insight-action', {
    hasText: '打开阻塞依赖',
  });
  assert.match(
    await dependencyPanelAction.getAttribute('title') || '',
    /图表下一步入口：打开 Risk Demo Project · Resolve release blocker 的本地来源修复位置/,
  );
  assert.match(
    await dependencyPanelAction.getAttribute('aria-label') || '',
    /不会确认项目状态或发送通知/,
  );
  const dependencyRepairDriver = riskCard.locator('.chart-insight-card.attention', {
    hasText: '依赖图',
  }).locator('.chart-driver-item.critical', {
    hasText: 'Resolve release blocker',
  });
  assert.match(
    await dependencyRepairDriver.getAttribute('title') || '',
    /图表关键任务入口：打开 Risk Demo Project · Resolve release blocker 的本地来源修复位置/,
  );
  assert.match(
    await dependencyRepairDriver.getAttribute('aria-label') || '',
    /Jira key、平台状态、负责人或平台 Jira/,
  );
  await dependencyRepairDriver.click();
  await page.locator('.zoom-title', {
    hasText: 'Resolve release blocker',
  }).waitFor({ timeout: 15000 });
  await page.locator('.evidence-repair-card.missing', {
    hasText: '来源',
  }).waitFor({ timeout: 15000 });
  await page.locator('.jira-source-boundary', {
    hasText: '不会读取或写回 Jira',
  }).waitFor({ timeout: 15000 });
  const chartSourceRepairButton = page.locator('.evidence-repair-card', {
    hasText: '来源',
  }).locator('.evidence-repair-card-action', {
    hasText: '补来源',
  });
  assert.match(
    await chartSourceRepairButton.getAttribute('title') || '',
    /任务详情证据修复按钮：打开 Risk Demo Project · Resolve release blocker 的本地来源修复位置/,
  );
  await page.locator('.zoom-overlay.active .close-btn').click();
  await page.locator('.zoom-title', {
    hasText: 'Resolve release blocker',
  }).waitFor({ state: 'detached', timeout: 15000 });
  await riskCard.locator('.chart-insight-card.attention', {
    hasText: '燃尽/完成',
  }).locator('.chart-progress').waitFor({ timeout: 15000 });
  await riskCard.locator('.chart-insight-card.attention', {
    hasText: '燃尽/完成',
  }).locator('.chart-insight-metrics', {
    hasText: '任务数口径',
  }).waitFor({ timeout: 15000 });
  await riskCard.locator('.chart-insight-card.attention', {
    hasText: '燃尽/完成',
  }).locator('p', {
    hasText: '不含工时、故事点或范围变化',
  }).waitFor({ timeout: 15000 });
  const crossProjectFocusItem = page.locator('.focus-item.blocked', {
    hasText: 'Resolve release blocker',
  });
  await crossProjectFocusItem.locator('.focus-risk.risk-high', {
    hasText: '高风险',
  }).waitFor({ timeout: 15000 });
  assert.match(
    await crossProjectFocusItem.getAttribute('title') || '',
    /跨项目优先处理入口：打开 Risk Demo Project \/ Resolve release blocker 的本地任务详情/,
  );
  assert.match(
    await crossProjectFocusItem.getAttribute('aria-label') || '',
    /不会读取或写回 Memory Service、Jira、GitHub、Confluence/,
  );
  const projectPriorityItem = riskCard.locator('.project-alert.blocked', {
    hasText: 'Resolve release blocker',
  });
  await projectPriorityItem.locator('.project-alert-risk.risk-high').waitFor({ timeout: 15000 });
  assert.match(
    await projectPriorityItem.getAttribute('title') || '',
    /项目内优先处理入口：打开 Risk Demo Project \/ Resolve release blocker 的本地任务详情/,
  );
  assert.match(
    await projectPriorityItem.getAttribute('aria-label') || '',
    /不会确认项目状态、创建外部任务或发送通知/,
  );

  const staleCard = page.locator('.project-card', {
    hasText: 'Stale Demo Project',
  });
  await staleCard.locator('.freshness-chip.stale', { hasText: '计划陈旧' }).waitFor({
    timeout: 15000,
  });
  await staleCard.locator('.freshness-strip.stale', {
    hasText: '最近计划日期 2024-01-15 已过',
  }).waitFor({ timeout: 15000 });
  await staleCard.locator('.decision-signal.warning', {
    hasText: '计划陈旧',
  }).waitFor({ timeout: 15000 });
  await staleCard.locator('.view-reason-strip.warning', {
    hasText: '最近计划日期 2024-01-15 已过',
  }).waitFor({ timeout: 15000 });
  await staleCard.locator('.review-strip.overdue', {
    hasText: '复核过期',
  }).waitFor({ timeout: 15000 });
  await staleCard.locator('.chart-scope-receipt.partial', {
    hasText: '计划陈旧',
  }).locator('small', {
    hasText: '对外同步或承诺前先复核状态',
  }).waitFor({ timeout: 15000 });
  await staleCard.locator('.chart-insight-card.ready', {
    hasText: '甘特就绪度',
  }).locator('.chart-driver-item.complete', {
    hasText: 'Closed work',
  }).locator('span', {
    hasText: '完成 ETA 2024-01-10',
  }).waitFor({ timeout: 15000 });
  const staleGanttChart = staleCard.locator('.chart-insight-card.ready', {
    hasText: '甘特就绪度',
  });
  assert.match(
    await staleGanttChart.getAttribute('title') || '',
    /甘特就绪度只读取本地任务 ETA、里程碑日期和已完成 ETA 历史锚点/,
  );
  assert.match(
    await staleGanttChart.getAttribute('aria-label') || '',
    /不会确认项目状态、发送通知、预测完成时间或自动改期/,
  );
  const staleHistoricalMarker = staleGanttChart.locator('.chart-marker.complete').first();
  assert.match(
    await staleHistoricalMarker.getAttribute('title') || '',
    /点位来自本地 ETA、里程碑日期或已完成 ETA 历史锚点/,
  );
  assert.match(
    await staleHistoricalMarker.getAttribute('aria-label') || '',
    /不代表 Jira\/GitHub\/Confluence 权威同步/,
  );
  await staleGanttChart.locator('p', {
    hasText: '历史范围 2024-01-10 至 2024-01-15',
  }).waitFor({ timeout: 15000 });

  const firstProjectTitle = (await page.locator('.project-card .project-title').first().textContent())?.trim();
  assert.equal(firstProjectTitle, 'Risk Demo Project');

  await page.locator('.project-filter-button', { hasText: '需关注' }).click();
  await staleCard.waitFor({ timeout: 15000 });
  await page.locator('.project-card', { hasText: 'Evidence Gap Project' }).waitFor({
    timeout: 15000,
  });
  assert.equal(await page.locator('.project-card', { hasText: 'Fresh Demo Project' }).count(), 0);

  await page.locator('.project-filter-button', { hasText: '正常' }).click();
  const freshCard = page.locator('.project-card', { hasText: 'Fresh Demo Project' });
  await freshCard.waitFor({
    timeout: 15000,
  });
  const freshDependencyChart = freshCard.locator('.chart-insight-card.ready', {
    hasText: '依赖图',
  });
  assert.match(
    await freshDependencyChart.getAttribute('title') || '',
    /依赖图只读取本地 dep 任务和 dependencies 链接/,
  );
  assert.match(
    await freshDependencyChart.getAttribute('aria-label') || '',
    /关键链候选不是完整关键路径计算/,
  );
  await freshDependencyChart.locator('.chart-insight-metrics', {
    hasText: '2/2 依赖目标有效',
  }).waitFor({ timeout: 15000 });
  await freshDependencyChart.locator('.chart-insight-metrics', {
    hasText: '最长链 2 个任务',
  }).waitFor({ timeout: 15000 });
  await freshDependencyChart.locator('.chart-insight-metrics', {
    hasText: '链上已完成 1',
  }).waitFor({ timeout: 15000 });
  await freshDependencyChart.locator('p', {
    hasText: '链上 1 项已完成只作历史前置',
  }).waitFor({ timeout: 15000 });
  await freshDependencyChart.locator('.chart-driver-item.neutral', {
    hasText: '关键链候选',
  }).locator('em', {
    hasText: 'Foundation work -> Future work',
  }).waitFor({ timeout: 15000 });
  await freshDependencyChart.locator('.chart-driver-item.neutral', {
    hasText: 'Future work',
  }).locator('em', {
    hasText: '依赖 foundation-task、ga',
  }).waitFor({ timeout: 15000 });
  const freshBurndownChart = freshCard.locator('.chart-insight-card.ready', {
    hasText: '燃尽/完成',
  });
  const freshBurndownProgress = freshBurndownChart.locator('.chart-progress');
  assert.match(
    await freshBurndownProgress.getAttribute('title') || '',
    /只表示本地任务数完成率/,
  );
  assert.match(
    await freshBurndownProgress.getAttribute('aria-label') || '',
    /不含工时、故事点、范围变化或 velocity/,
  );
  await freshBurndownChart.locator('.chart-insight-metrics', {
    hasText: '任务数口径',
  }).waitFor({ timeout: 15000 });
  await freshBurndownChart.locator('p', {
    hasText: '不是 effort/velocity 预测',
  }).waitFor({ timeout: 15000 });
  assert.equal(await page.locator('.project-card', { hasText: 'Stale Demo Project' }).count(), 0);
  assert.equal(await page.locator('.project-card', { hasText: 'Evidence Gap Project' }).count(), 0);

  await page.locator('.project-filter-button', { hasText: '全部' }).click();
  await staleCard.waitFor({ timeout: 15000 });

  const evidenceGapCard = page.locator('.project-card', {
    hasText: 'Evidence Gap Project',
  });
  await evidenceGapCard.locator('.data-quality-chip.poor', {
    hasText: '证据不足',
  }).waitFor({ timeout: 15000 });
  await evidenceGapCard.locator('.data-quality-strip.poor', {
    hasText: '证据覆盖 50%',
  }).waitFor({ timeout: 15000 });
  await evidenceGapCard.locator('.view-reason-strip.warning', {
    hasText: '证据覆盖 50%',
  }).waitFor({ timeout: 15000 });

  await staleCard.locator('button', { hasText: '预览状态草稿' }).click();
  await page.locator('.status-draft-modal', {
    hasText: '数据新鲜度：计划陈旧',
  }).waitFor({ timeout: 15000 });
  await page.locator('.status-review-gate', {
    hasText: '复核记录会写入本地工作台',
  }).waitFor({ timeout: 15000 });
  await page.locator('.status-evidence-label.freshness', {
    hasText: '计划陈旧',
  }).waitFor({ timeout: 15000 });
  await page.locator('.status-evidence-label.review', {
    hasText: '复核过期',
  }).waitFor({ timeout: 15000 });

  await page.locator('.zoom-overlay.active .close-btn').click();
  await page.locator('.status-draft-modal').waitFor({ state: 'detached', timeout: 15000 });

  await page.evaluate(async () => {
    async function send(request) {
      const response = await chrome.runtime.sendMessage(request);
      if (!response?.success) {
        throw new Error(response?.error || `Request failed: ${request.type}`);
      }
      return response;
    }

    async function createProject(project) {
      const response = await send({
        type: 'ADD_PROJECT',
        name: project.name,
        description: project.description || '',
        milestones: project.milestones,
        platformConfig: project.platformConfig || ['sdk', 'qa'],
      });
      const projectId = response.project.id;

      if (project.lastStatusReviewAt !== undefined) {
        await send({
          type: 'UPDATE_PROJECT_ITEM',
          projectId,
          itemType: 'project',
          itemId: projectId,
          changes: { lastStatusReviewAt: project.lastStatusReviewAt },
        });
      }

      for (const task of project.tasks || []) {
        await send({
          type: 'ADD_PROJECT_ITEM',
          projectId,
          itemType: 'task',
          itemData: task,
        });
      }
    }

    await createProject({
      name: 'Queue Depth Audit',
      description: 'Project with several hidden evidence gaps',
      milestones: [{ id: 'ga', label: 'GA', date: '2099-08-01' }],
      tasks: [
        {
          id: 'gap-a',
          type: 'task',
          title: 'Add ETA to rollout notes',
          status: 'progress',
        },
        {
          id: 'gap-b',
          type: 'task',
          title: 'Link Jira for dependency review',
          status: 'testing',
          eta: '2099-07-15',
        },
        {
          id: 'gap-c',
          type: 'dep',
          title: 'Confirm owner for release gate',
          status: 'blocked',
        },
        {
          id: 'gap-d',
          type: 'design',
          title: 'Attach design review source',
          status: 'review',
          eta: '2099-07-20',
        },
      ],
      platformConfig: ['sdk', 'qa'],
    });

    await createProject({
      name: 'Review Overdue One',
      lastStatusReviewAt: '2026-04-02T08:00:00+08:00',
      milestones: [{ id: 'ga', label: 'GA', date: '2099-09-01' }],
      tasks: [{ id: 'active', type: 'task', title: 'Track review one', status: 'progress', eta: '2099-08-01', jira: [{ key: 'REV-1', title: 'Track review one' }] }],
    });

    await createProject({
      name: 'Review Overdue Two',
      lastStatusReviewAt: '2026-04-03T08:00:00+08:00',
      milestones: [{ id: 'ga', label: 'GA', date: '2099-09-02' }],
      tasks: [{ id: 'active', type: 'task', title: 'Track review two', status: 'progress', eta: '2099-08-02', jira: [{ key: 'REV-2', title: 'Track review two' }] }],
    });

    await createProject({
      name: 'Review Unreviewed',
      lastStatusReviewAt: null,
      milestones: [{ id: 'ga', label: 'GA', date: '2099-09-03' }],
      tasks: [{ id: 'active', type: 'task', title: 'Track unreviewed', status: 'progress', eta: '2099-08-03', jira: [{ key: 'REV-3', title: 'Track unreviewed' }] }],
    });

    await createProject({
      name: 'Review Due One',
      lastStatusReviewAt: '2026-04-20T08:00:00+08:00',
      milestones: [{ id: 'ga', label: 'GA', date: '2099-09-04' }],
      tasks: [{ id: 'active', type: 'task', title: 'Track due review', status: 'progress', eta: '2099-08-04', jira: [{ key: 'REV-4', title: 'Track due review' }] }],
    });
  });

  await page.reload({ waitUntil: 'load', timeout: 15000 });
  await page.locator('h1', { hasText: '项目进度仪表盘' }).waitFor({
    timeout: 15000,
  });

  await page.locator('.evidence-gap-header', {
    hasText: '6 个活动任务缺少 ETA 或来源',
  }).locator('.queue-toggle', {
    hasText: '展开全部 6 项',
  }).click();
  await page.locator('.evidence-gap-breakdown', {
    hasText: 'ETA+来源 2',
  }).locator('.missing-eta', {
    hasText: 'ETA 1',
  }).waitFor({ timeout: 15000 });
  await page.locator('.evidence-gap-breakdown .missing-source', {
    hasText: '来源 3',
  }).waitFor({ timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('.evidence-gap-item').length === 6);
  await page.locator('.evidence-gap-header .queue-toggle', {
    hasText: '收起证据队列',
  }).click();
  await page.waitForFunction(() => document.querySelectorAll('.evidence-gap-item').length === 4);

  await page.locator('.review-queue-header', {
    hasText: '5 个项目待复核',
  }).locator('.queue-toggle', {
    hasText: '展开全部 5 项目',
  }).click();
  await page.waitForFunction(() => document.querySelectorAll('.review-queue-item').length === 5);
  await page.locator('.review-queue-header .queue-toggle', {
    hasText: '收起复核队列',
  }).click();
  await page.waitForFunction(() => document.querySelectorAll('.review-queue-item').length === 3);

  await riskCard.locator('.chart-insight-card.attention', {
    hasText: '依赖图',
  }).locator('.chart-driver-item.critical', {
    hasText: 'Resolve release blocker',
  }).click();
  await page.locator('.zoom-title', {
    hasText: 'Resolve release blocker',
  }).waitFor({ timeout: 15000 });
  await page.locator('[data-evidence-control="jira-key"]').fill('not-a-key');
  await page.locator('.jira-source-form .add-jira-btn', {
    hasText: '添加来源',
  }).click();
  await page.locator('.jira-source-error', {
    hasText: '请输入类似 MTR-148115 的 Jira key',
  }).waitFor({ timeout: 15000 });
  await page.locator('[data-evidence-control="jira-key"]').fill('mtr-148115');
  await page.locator('[data-evidence-control="jira-title"]').fill('Release blocker Jira source');
  await page.locator('.jira-source-form .add-jira-btn', {
    hasText: '添加来源',
  }).click();
  await page.locator('.dashboard-status.success', {
    hasText: '已把 MTR-148115 作为本地 Jira 来源记录到 Resolve release blocker',
  }).waitFor({ timeout: 15000 });
  await page.locator('.jira-item-editable', {
    hasText: 'MTR-148115',
  }).waitFor({ timeout: 15000 });
  await page.locator('.evidence-repair-card.complete', {
    hasText: '来源',
  }).waitFor({ timeout: 15000 });
  await page.locator('.zoom-overlay.active .close-btn').click();
  await page.locator('.zoom-title', {
    hasText: 'Resolve release blocker',
  }).waitFor({ state: 'detached', timeout: 15000 });

  const reviewOnlyProject = {
    id: 'decision-review-only',
    name: 'Decision Review Only',
    description: 'No focus or evidence gaps; decision brief should open review gate',
    lastStatusReviewAt: '2026-04-01T08:00:00+08:00',
    milestones: [{ id: 'ga', label: 'GA', date: '2099-09-30' }],
    tasks: [
      {
        id: 'review-ready-task',
        type: 'task',
        title: 'Prepare review-ready release note',
        status: 'progress',
        eta: '2099-09-01',
        jira: [{ key: 'REV-42', title: 'Prepare review-ready release note' }],
      },
    ],
    platformConfig: ['sdk', 'qa'],
  };
  const reviewOnlyReport = {
    metadata: {
      version: '1.0.0',
      exportType: 'project_dashboard_report',
      scope: 'single_project',
      exportedAt: new Date().toISOString(),
      exportedTimestamp: Date.now(),
      source: 'dashboard_memory',
    },
    summary: {
      totalProjects: 1,
      totalMilestones: 1,
      totalTasks: 1,
    },
    projects: [
      {
        project: reviewOnlyProject,
        summary: {
          projectId: reviewOnlyProject.id,
          projectName: reviewOnlyProject.name,
          description: reviewOnlyProject.description,
          totalMilestones: 1,
          totalTasks: 1,
          taskStatusCounts: { progress: 1 },
          taskTypeCounts: { task: 1 },
          platformStatusCounts: {},
          jiraIssueCount: 1,
        },
      },
    ],
  };

  await page.setInputFiles('input[type="file"]', {
    name: 'project-review-only.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(reviewOnlyReport)),
  });
  await page.locator('.import-review-modal', {
    hasText: '导入报告复核',
  }).locator('.import-review-summary', {
    hasText: 'project-review-only.json',
  }).waitFor({ timeout: 15000 });
  await page.locator('.import-project-preview', {
    hasText: 'Decision Review Only',
  }).waitFor({ timeout: 15000 });
  await page.locator('.import-impact-card', {
    hasText: '合并导入',
  }).locator('.import-impact-metrics', {
    hasText: '保留',
  }).waitFor({ timeout: 15000 });
  await page.locator('.import-impact-card.destructive', {
    hasText: '替换当前项目',
  }).locator('.import-impact-metrics', {
    hasText: '移除',
  }).waitFor({ timeout: 15000 });
  await page.locator('.import-impact-card.destructive', {
    hasText: '替换当前项目',
  }).locator('.delete-btn', {
    hasText: '替换当前项目',
  }).click();
  await page.locator('.dashboard-status.success', {
    hasText: '替换导入完成',
  }).waitFor({ timeout: 15000 });
  await page.locator('.import-review-modal').waitFor({ state: 'detached', timeout: 15000 });

  await page.reload({ waitUntil: 'load', timeout: 15000 });
  await page.locator('.decision-brief', {
    hasText: '先复核状态',
  }).locator('.decision-brief-action', {
    hasText: '复核草稿',
  }).click();
  await page.locator('.status-review-gate.active', {
    hasText: '确认前先检查证据',
  }).waitFor({ timeout: 15000 });

  await page.locator('.zoom-overlay.active .close-btn').click();
  await page.locator('.status-draft-modal').waitFor({ state: 'detached', timeout: 15000 });

  await serviceWorker.evaluate(() => {
    const originalFetch =
      globalThis.__projectDashboardOriginalFetch || globalThis.fetch.bind(globalThis);
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input?.url || String(input);
      if (url.includes('/projects/watched')) {
        return new Response(JSON.stringify([
          {
            id: 'decision-review-only',
            name: 'Decision Review Only',
            description: 'Already tracked as a local dashboard',
            isActive: true,
            priority: 5,
            createdAt: 1,
          },
          {
            id: 'memory-import-project',
            name: 'Memory Import Project',
            description: 'Imported from watched projects',
            isActive: true,
            priority: 9,
            createdAt: 2,
          },
          {
            id: 'memory-import-followup',
            name: 'Memory Import Followup',
            description: 'Second imported watched project',
            isActive: true,
            priority: 8,
            createdAt: 3,
          },
        ]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(input, init);
    };
  });

  await page.locator('.data-source-action', {
    hasText: '同步/检查数据源',
  }).click();
  await page.locator('.dashboard-status.warning', {
    hasText: '已从 Memory Service 关注项目新增 2 个本地工作台',
  }).waitFor({ timeout: 15000 });
  await page.locator('.dashboard-status.warning', {
    hasText: 'Memory Service 项目：新增：Memory Import Project、Memory Import Followup；已匹配：Decision Review Only',
  }).waitFor({ timeout: 15000 });
  await page.locator('.dashboard-status.warning', {
    hasText: '本地证据待补：2 个项目待规划',
  }).waitFor({ timeout: 15000 });
  await page.locator('.data-source-panel', {
    hasText: '新增：Memory Import Project、Memory Import Followup',
  }).waitFor({ timeout: 15000 });
  await page.locator('.data-source-scope.ready', {
    hasText: '本次读取 Memory Service',
  }).waitFor({ timeout: 15000 });
  await page.locator('.data-source-scope.ready', {
    hasText: '已读取 1',
  }).locator('span', {
    hasText: '未接入 3',
  }).waitFor({ timeout: 15000 });
  await page.locator('.data-source-evidence.attention', {
    hasText: '本地证据待补：2 个项目待规划，ETA 100%，来源 100%',
  }).waitFor({ timeout: 15000 });
  await page.locator('.data-source-evidence.attention', {
    hasText: '活动任务 1',
  }).locator('span', {
    hasText: '来源 100%',
  }).waitFor({ timeout: 15000 });
  await page.locator('.data-source-evidence.attention', {
    hasText: '待规划项目：Memory Import Project、Memory Import Followup',
  }).waitFor({ timeout: 15000 });
  await page.locator('.data-source-card.ready', {
    hasText: 'Memory Service',
  }).locator('.data-source-card-top span', {
    hasText: '可读取',
  }).waitFor({ timeout: 15000 });
  await page.locator('.data-source-card.ready', {
    hasText: '本地工作台：3 个项目，1 个活动任务',
  }).waitFor({ timeout: 15000 });
  await dataSourceCard(page, 'GitHub').locator('.data-source-diagnostics', {
    hasText: '尚未配置项目仓库映射',
  }).waitFor({ timeout: 15000 });
  await dataSourceCard(page, 'GitHub').locator('.data-source-diagnostics', {
    hasText: '本地映射种子：0/1 个活动任务有平台来源，1/1 个有 Jira key',
  }).waitFor({ timeout: 15000 });
  await dataSourceCard(page, 'Confluence').locator('.data-source-diagnostics', {
    hasText: '本地页面映射种子：3/3 个项目有描述，1/3 个项目有里程碑（共 1 个）',
  }).waitFor({ timeout: 15000 });
  await dataSourceCard(page, 'Confluence').locator('.data-source-diagnostics', {
    hasText: '待规划项目暂不适合作为状态报告依据：Memory Import Project、Memory Import Followup',
  }).waitFor({ timeout: 15000 });
  await page.locator('.project-card', {
    hasText: 'Memory Import Project',
  }).locator('.review-strip.unreviewed', {
    hasText: '未复核',
  }).waitFor({ timeout: 15000 });
  await page.locator('.project-card', {
    hasText: 'Memory Import Followup',
  }).locator('.review-strip.unreviewed', {
    hasText: '未复核',
  }).waitFor({ timeout: 15000 });
  await page.locator('.data-source-evidence-action.plan-project', {
    hasText: '规划 Memory Import Followup',
  }).waitFor({ timeout: 15000 });
  const dataSourceCloseButton = page.locator('.data-source-close', {
    hasText: '收起',
  });
  assert.match(
    await dataSourceCloseButton.getAttribute('title') || '',
    /只隐藏当前面板，保留本轮新增\/匹配项目、本地证据回执和页面状态/,
  );
  assert.match(
    await dataSourceCloseButton.getAttribute('aria-label') || '',
    /不会取消正在进行的同步、清空检查结果、删除本地项目、重新读取或写回 Memory Service、Jira、GitHub、Confluence/,
  );
  const planProjectButton = page.locator('.data-source-evidence-action.plan-project', {
    hasText: '规划 Memory Import Project',
  });
  assert.match(
    await planProjectButton.getAttribute('title') || '',
    /数据源检查修复入口：打开 Memory Import Project 的本地首个任务填写入口/,
  );
  assert.match(
    await planProjectButton.getAttribute('aria-label') || '',
    /不会创建 Jira\/GitHub\/Confluence 任务、反写 Memory Service 或发送通知/,
  );
  await planProjectButton.click();
  await page.locator('.zoom-overlay.active .zoom-title', {
    hasText: '添加新任务',
  }).waitFor({ timeout: 15000 });
  await page.locator('.local-repair-receipt', {
    hasText: '已打开 Memory Import Project 的首个任务填写入口',
  }).waitFor({ timeout: 15000 });
  await page.locator('.local-repair-receipt', {
    hasText: '不会创建 Jira/GitHub/Confluence 任务，也不会反写 Memory Service',
  }).waitFor({ timeout: 15000 });
  await page.locator('.timeline-context', {
    hasText: '50%',
  }).waitFor({ timeout: 15000 });
  await page.locator('.zoom-overlay.active .close-btn').click();
  await page.locator('.zoom-overlay.active .zoom-title', {
    hasText: '添加新任务',
  }).waitFor({ state: 'detached', timeout: 15000 });
  await dataSourceCloseButton.click();
  await page.locator('.data-source-panel').waitFor({ state: 'detached', timeout: 15000 });
  await page.locator('.project-card', {
    hasText: 'Memory Import Project',
  }).waitFor({ timeout: 15000 });

  assertNoPageErrors();
  await context.close();
  await fs.rm(launched.userDataDir, { recursive: true, force: true });
  console.log('verify-project-dashboard-e2e: ok');
} catch (error) {
  if (launched?.context) await launched.context.close().catch(() => undefined);
  if (launched?.userDataDir) {
    await fs.rm(launched.userDataDir, { recursive: true, force: true }).catch(
      () => undefined,
    );
  }
  throw error;
}
