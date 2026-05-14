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
                id: 'active-task',
                type: 'task',
                title: 'Future work',
                status: 'progress',
                eta: '2099-06-01',
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
  await page.locator('.review-queue', {
    hasText: '1 个项目待复核',
  }).waitFor({ timeout: 15000 });
  await page.locator('.review-queue-item.overdue', {
    hasText: 'Stale Demo Project',
  }).locator('.review-queue-action', {
    hasText: '预览草稿',
  }).waitFor({ timeout: 15000 });

  const riskCard = page.locator('.project-card', {
    hasText: 'Risk Demo Project',
  });
  await page.locator('.focus-item.blocked', {
    hasText: 'Resolve release blocker',
  }).locator('.focus-risk.risk-high', {
    hasText: '高风险',
  }).waitFor({ timeout: 15000 });
  await riskCard.locator('.project-alert-risk.risk-high').waitFor({ timeout: 15000 });

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

  const firstProjectTitle = (await page.locator('.project-card .project-title').first().textContent())?.trim();
  assert.equal(firstProjectTitle, 'Risk Demo Project');

  await page.locator('.project-filter-button', { hasText: '需关注' }).click();
  await staleCard.waitFor({ timeout: 15000 });
  await page.locator('.project-card', { hasText: 'Evidence Gap Project' }).waitFor({
    timeout: 15000,
  });
  assert.equal(await page.locator('.project-card', { hasText: 'Fresh Demo Project' }).count(), 0);

  await page.locator('.project-filter-button', { hasText: '正常' }).click();
  await page.locator('.project-card', { hasText: 'Fresh Demo Project' }).waitFor({
    timeout: 15000,
  });
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
    hasText: '证据覆盖 0%',
  }).waitFor({ timeout: 15000 });
  await evidenceGapCard.locator('.view-reason-strip.warning', {
    hasText: '证据覆盖 0%',
  }).waitFor({ timeout: 15000 });

  await staleCard.locator('button', { hasText: '预览状态草稿' }).click();
  await page.locator('.status-draft-modal', {
    hasText: '数据新鲜度：计划陈旧',
  }).waitFor({ timeout: 15000 });
  await page.locator('.status-evidence-label.freshness', {
    hasText: '计划陈旧',
  }).waitFor({ timeout: 15000 });
  await page.locator('.status-evidence-label.review', {
    hasText: '复核过期',
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
