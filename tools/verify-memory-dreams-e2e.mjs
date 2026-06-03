import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const require = createRequire(path.join(repoRoot, 'desktop-app/package.json'));
const { chromium } = require('playwright');

const extensionPath = path.join(repoRoot, 'dist');
const userDataDir = await fs.mkdtemp(
  path.join(os.tmpdir(), 'personal-ai-memory-dreams-'),
);

const dreamMarkdown = `# Dream: Project Orbit

_Generated: 2026-05-20_

## Narrative
Orbit timeline changed after design review. The account owner is waiting for a concise launch-risk summary before the next milestone.

## Insights
- Design review created a dependency on finance approval.
- Launch readiness depends on support coverage.

## Risks
- Budget risk has no owner.

## Discovered Relationships
- **Project Orbit** --[blocked_by]--> **Finance Approval**: repeated planning notes mention unresolved budget approval.
`;

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function apiFallback(url) {
  const pathname = new URL(url).pathname;
  if (pathname.endsWith('/stats')) {
    return {
      entities: { total: 0, byType: {} },
      relationships: { total: 0 },
      messages: { today: 0, thisWeek: 0 },
    };
  }
  if (pathname.endsWith('/meetings')) return { items: [], total: 0 };
  if (pathname.endsWith('/confirm-requests')) return { items: [], total: 0 };
  if (pathname.endsWith('/reflection-threads')) return { items: [], total: 0 };
  if (pathname.endsWith('/actions')) return { items: [], total: 0 };
  if (pathname.endsWith('/config/runtime')) return { outreachEnabled: false };
  if (pathname.endsWith('/outreach/summary')) {
    return { upcomingCount: 0, waitingReplyCount: 0, escalatedCount: 0 };
  }
  if (pathname.endsWith('/outreach/templates/runtime-status')) {
    return { items: [], total: 0 };
  }
  if (pathname.endsWith('/skills')) return { items: [], total: 0 };
  if (pathname.endsWith('/skills/suggestions')) return { items: [], total: 0 };
  return {};
}

const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

try {
  await context.route('http://localhost:3210/api/v1/**', async (route) => {
    const requestUrl = route.request().url();
    const url = new URL(requestUrl);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname.endsWith('/user-files/dreams')) {
      await route.fulfill(
        jsonResponse({
          files: [
            'project-orbit-2026-05-20.md',
            'missing-dream-2026-05-19.md',
          ],
        }),
      );
      return;
    }

    if (pathname.endsWith('/user-files/dreams/project-orbit-2026-05-20.md')) {
      await route.fulfill(
        jsonResponse({
          filename: 'project-orbit-2026-05-20.md',
          content: dreamMarkdown,
        }),
      );
      return;
    }

    if (pathname.endsWith('/user-files/dreams/missing-dream-2026-05-19.md')) {
      await route.fulfill(jsonResponse({ error: 'File not found' }, 404));
      return;
    }

    await route.fulfill(jsonResponse(apiFallback(requestUrl)));
  });

  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }
  const extensionId = new URL(worker.url()).host;
  assert.ok(extensionId, 'extension id should be available');

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/memory-exploring.html#/dreams`, {
    waitUntil: 'domcontentloaded',
  });

  await page.getByText('梦境重放').first().waitFor({ timeout: 10000 });
  await page
    .getByText('长期记忆回放生成的联想入口')
    .waitFor({ timeout: 10000 });
  await page.getByText('梦境主题').waitFor({ timeout: 10000 });
  await page.getByText('洞察线索').waitFor({ timeout: 10000 });
  await page.getByText('待复核风险').waitFor({ timeout: 10000 });
  await page.getByText('新关系', { exact: true }).waitFor({ timeout: 10000 });
  await page
    .getByText('1 个梦境文件暂时无法读取')
    .waitFor({ timeout: 10000 });

  const projectCard = page.locator('.dream-card', { hasText: 'Project Orbit' });
  await projectCard.getByText('洞察 2').waitFor({ timeout: 10000 });
  await projectCard.getByText('风险 1').waitFor({ timeout: 10000 });
  await projectCard.getByText('新关系 1').waitFor({ timeout: 10000 });
  await projectCard
    .getByText('来源 dreams/project-orbit-2026-05-20.md')
    .waitFor({ timeout: 10000 });
  await projectCard
    .getByText('低置信联想，需复核后使用')
    .waitFor({ timeout: 10000 });
  await projectCard
    .getByText('Budget risk has no owner.')
    .waitFor({ timeout: 10000 });
  await projectCard
    .getByText('低置信度新关系')
    .waitFor({ timeout: 10000 });

  await projectCard.getByRole('button', { name: /Project Orbit/ }).click();
  await projectCard
    .getByText('这是生成式回放产出的低置信度联想')
    .waitFor({ timeout: 10000 });
  await projectCard
    .getByText('Orbit timeline changed after design review.')
    .waitFor({ timeout: 10000 });

  const reviewLink = page.getByRole('link', { name: '去自我反思复核' });
  assert.ok(
    (await reviewLink.getAttribute('href'))?.endsWith('#/reflection-threads'),
    'dream replay page should offer a reflection review path',
  );

  const topicReviewLink = projectCard.getByRole('link', {
    name: '复核这个主题',
  });
  const topicReviewHref = await topicReviewLink.getAttribute('href');
  assert.ok(
    topicReviewHref?.includes('#/reflection-threads'),
    'dream replay card should link to reflection threads',
  );
  assert.ok(
    topicReviewHref?.includes('source=dream'),
    'dream replay card should preserve dream source in review handoff',
  );
  assert.ok(
    topicReviewHref?.includes('search=Project+Orbit') ||
      topicReviewHref?.includes('search=Project%20Orbit'),
    'dream replay card should preserve topic search in review handoff',
  );

  await topicReviewLink.click();
  await page.getByText('来自梦境重放').waitFor({ timeout: 10000 });
  await page.getByPlaceholder('搜索标题 / topic key').inputValue().then((value) => {
    assert.equal(value, 'Project Orbit');
  });
  await page
    .getByText('没有找到与“Project Orbit”对应的自我反思线程')
    .waitFor({ timeout: 10000 });

  console.log('verify-memory-dreams-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
