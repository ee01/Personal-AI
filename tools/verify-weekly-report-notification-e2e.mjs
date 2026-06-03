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
  path.join(os.tmpdir(), 'personal-ai-weekly-report-'),
);

const reportMarkdown = `# Weekly Report — 2026-05-27

## Highlights
- Launch weekly summary: rollout is on track.
- Deployment notes need review before the next milestone.

## Action Items
- Review release notes.
- Confirm owner for support coverage.
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

    if (pathname.endsWith('/user-files/reports')) {
      await route.fulfill(
        jsonResponse({
          files: ['weekly-2026-05-27.md', 'weekly-2026-05-20.md'],
        }),
      );
      return;
    }

    if (pathname.endsWith('/user-files/reports/weekly-2026-05-27.md')) {
      await route.fulfill(
        jsonResponse({
          filename: 'weekly-2026-05-27.md',
          content: reportMarkdown,
        }),
      );
      return;
    }

    if (pathname.endsWith('/user-files/reports/weekly-2026-05-20.md')) {
      await route.fulfill(
        jsonResponse({
          filename: 'weekly-2026-05-20.md',
          content:
            '# Weekly Report — 2026-05-20\n\n## Highlights\n- Prior report.',
        }),
      );
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
  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/reports?file=weekly-2026-05-27.md`,
    { waitUntil: 'domcontentloaded' },
  );

  await page.getByText('周报报告').first().waitFor({ timeout: 10000 });
  await page
    .getByText('reports/weekly-2026-05-27.md')
    .first()
    .waitFor({ timeout: 10000 });
  await page
    .getByText('Weekly Report — 2026-05-27')
    .first()
    .waitFor({ timeout: 10000 });
  await page
    .getByText('Launch weekly summary: rollout is on track.')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('Confirm owner for support coverage.')
    .waitFor({ timeout: 10000 });
  assert.ok(
    page.url().includes('#/reports?file=weekly-2026-05-27.md'),
    'weekly report notification target should stay on the reports route',
  );

  await page
    .locator('.report-list-item', { hasText: 'weekly 2026 05 20' })
    .click();
  await page
    .getByText('Weekly Report — 2026-05-20')
    .first()
    .waitFor({ timeout: 10000 });
  assert.ok(
    page.url().includes('#/reports?file=weekly-2026-05-20.md'),
    'selecting another report should preserve report deep-link state',
  );

  console.log('verify-weekly-report-notification-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
