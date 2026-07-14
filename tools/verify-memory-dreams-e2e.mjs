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

## Grounding Receipt
- Recalled memories: 2
- Recall result types: message 1, entity 1
- Recall hit channels: fts, graph
- Recall checked channels: vector, fts, graph, time

## Grounding Snippets
- message:orbit-risk-1 — Design review created a dependency on finance approval.
- entity:finance-approval — Finance Approval is an unresolved launch dependency.
`;

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

async function expectNotVisible(page, text) {
  const locator = page.getByText(text);
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    assert.equal(await locator.nth(index).isVisible(), false, `${text} should be hidden`);
  }
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
            'newer-focus-2026-05-21.md',
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

    if (pathname.endsWith('/user-files/dreams/newer-focus-2026-05-21.md')) {
      await route.fulfill(
        jsonResponse({
          filename: 'newer-focus-2026-05-21.md',
          content:
            '# Dream: Newer Focus\n\n## Narrative\nA newer dream should not steal a notification deep link.\n\n## Insights\n- Keep deep links anchored.\n',
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
  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/dreams?file=project-orbit-2026-05-20.md`,
    {
      waitUntil: 'domcontentloaded',
    },
  );

  await page.getByText('梦境重放').first().waitFor({ timeout: 10000 });
  await page
    .getByText('长期记忆回放生成的联想入口')
    .waitFor({ timeout: 10000 });
  await page.getByText('本页范围').waitFor({ timeout: 10000 });
  await page
    .getByText('最近可读取的 2 个梦境文件')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('证据状态：1 个可带证据复核，1 个缺证据，1 个读取失败。')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('深链状态：已额外载入通知文件 project-orbit-2026-05-20.md。')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('读取窗口：最近 10 个 dreams/*.md；通知深链文件会额外尝试读取。')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('生成节奏：Dream Replay 每周离线生成；梦境报表只代表当前 digest 周期。')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('这里只读展示低置信线索，不会写用户画像、创建 Rehearsal、确认关系')
    .waitFor({ timeout: 10000 });
  await page.getByText('梦境主题', { exact: true }).waitFor({ timeout: 10000 });
  await page.getByText('洞察线索').waitFor({ timeout: 10000 });
  await page.getByText('待复核风险').waitFor({ timeout: 10000 });
  await page.getByText('新关系', { exact: true }).waitFor({ timeout: 10000 });
  await page
    .locator('.overview-metric.priority')
    .getByText('优先复核', { exact: true })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.overview-metric.ready')
    .getByText('可带证据复核', { exact: true })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.overview-metric.warning')
    .getByText('缺证据', { exact: true })
    .waitFor({ timeout: 10000 });
  const filterRegion = page.getByLabel('梦境复核视图筛选');
  await filterRegion.getByText('复核视图：全部').waitFor({ timeout: 10000 });
  await filterRegion
    .getByText(
      '当前显示 2/2 个梦境；按深链命中和生成日期展示当前读取窗口内的所有梦境。',
    )
    .waitFor({ timeout: 10000 });
  await filterRegion
    .getByText('本地筛选只改变本页可见列表，不重跑 Dream Replay')
    .waitFor({ timeout: 10000 });
  const priorityFilter = filterRegion.getByRole('button', {
    name: /优先复核：显示 1 个梦境/,
  });
  assert.equal(
    await priorityFilter.getAttribute('title'),
    await priorityFilter.getAttribute('aria-label'),
    'priority review filter should mirror title to aria-label',
  );
  await priorityFilter.click();
  await filterRegion
    .getByText('复核视图：优先复核')
    .waitFor({ timeout: 10000 });
  await filterRegion
    .getByText(
      '当前显示 1/2 个梦境；只看有证据且包含风险或新关系的梦境。',
    )
    .waitFor({ timeout: 10000 });
  await page
    .locator('.dream-card', { hasText: 'Project Orbit' })
    .waitFor({ timeout: 10000 });
  await expectNotVisible(page, 'Newer Focus');
  const missingFilter = filterRegion.getByRole('button', {
    name: /缺证据：显示 1 个梦境/,
  });
  await missingFilter.click();
  await filterRegion
    .getByText('复核视图：缺证据')
    .waitFor({ timeout: 10000 });
  await filterRegion
    .getByText('当前显示 1/2 个梦境；只看缺少证据回执或召回结果为 0 的梦境。')
    .waitFor({ timeout: 10000 });
  await page
    .locator('.dream-card', { hasText: 'Newer Focus' })
    .waitFor({ timeout: 10000 });
  await expectNotVisible(page, 'Project Orbit');
  await filterRegion.getByRole('button', { name: /全部：显示 2 个梦境/ }).click();
  await filterRegion.getByText('复核视图：全部').waitFor({ timeout: 10000 });
  await page
    .getByText('1 个梦境文件暂时无法读取')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('missing-dream-2026-05-19.md')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('1 个梦境缺少可核对证据或没有召回结果')
    .waitFor({ timeout: 10000 });

  const projectCard = page.locator('.dream-card', { hasText: 'Project Orbit' });
  assert.match(
    await page.locator('.dream-card').first().innerText(),
    /Project Orbit/,
    'notification deep-link target should be the first visible dream card',
  );
  await projectCard
    .getByText('通知命中', { exact: true })
    .waitFor({ timeout: 10000 });
  await projectCard.getByText('通知命中回执').waitFor({ timeout: 10000 });
  await projectCard
    .getByText('这条是通知指向的梦境')
    .waitFor({ timeout: 10000 });
  await projectCard
    .getByText(
      '来源：通知深链请求 dreams/project-orbit-2026-05-20.md，页面已展开并置顶这条梦境。',
    )
    .waitFor({ timeout: 10000 });
  await projectCard
    .getByText('证据：原始证据 2 条；可带证据进入反思筛选。')
    .waitFor({ timeout: 10000 });
  await projectCard
    .getByText('下一步：复核这个主题只会打开 Reflection 筛选，不会确认风险或新关系。')
    .waitFor({ timeout: 10000 });
  await projectCard
    .getByText('本回执只说明打开来源和复核范围，不写用户画像、不创建 Rehearsal')
    .waitFor({ timeout: 10000 });
  await projectCard.getByText('洞察 2').waitFor({ timeout: 10000 });
  await projectCard.getByText('风险 1', { exact: true }).waitFor({ timeout: 10000 });
  await projectCard.getByText('新关系 1', { exact: true }).waitFor({ timeout: 10000 });
  await projectCard.getByText('高优先复核').waitFor({ timeout: 10000 });
  await projectCard
    .getByText('来源 dreams/project-orbit-2026-05-20.md')
    .waitFor({ timeout: 10000 });
  await projectCard
    .getByText('低置信联想，需复核后使用')
    .waitFor({ timeout: 10000 });
  await projectCard
    .getByText('生成 2026-05-20')
    .waitFor({ timeout: 10000 });
  await projectCard.getByText('时间回执').waitFor({ timeout: 10000 });
  await projectCard
    .getByText('按生成时间阅读')
    .waitFor({ timeout: 10000 });
  await projectCard
    .getByText('生成日期：2026-05-20；文件名日期：2026-05-20。')
    .waitFor({ timeout: 10000 });
  await projectCard
    .getByText('这条梦境代表该生成周期的低置信回放，不代表当前状态已重新核对。')
    .waitFor({ timeout: 10000 });
  await projectCard
    .getByText('本回执只说明时间依据；不会重跑 Dream Replay')
    .waitFor({ timeout: 10000 });
  await projectCard
    .getByText('原始证据 2 条')
    .first()
    .waitFor({ timeout: 10000 });
  await projectCard.getByText('复核就绪').waitFor({ timeout: 10000 });
  await projectCard.getByText('处理回执').waitFor({ timeout: 10000 });
  await projectCard.getByText('先核证风险').waitFor({ timeout: 10000 });
  await projectCard
    .getByText('不会自动通知、派发任务、写外部系统或确认事实')
    .waitFor({ timeout: 10000 });
  const visibleHandoff = projectCard.getByLabel('梦境可见复核入口');
  await visibleHandoff.getByText('复核入口').waitFor({ timeout: 10000 });
  await visibleHandoff
    .getByText('带风险线索去 Reflection 核证')
    .waitFor({ timeout: 10000 });
  await visibleHandoff
    .getByText('跳转只携带筛选条件，不确认 dream 结论，不新增记忆或画像')
    .waitFor({ timeout: 10000 });
  const visibleReviewLink = visibleHandoff.getByRole('link', {
    name: '打开反思筛选',
  });
  const visibleReviewHref = await visibleReviewLink.getAttribute('href');
  assert.ok(
    visibleReviewHref?.includes('#/reflection-threads'),
    'visible dream review handoff should link to reflection threads',
  );
  assert.ok(
    visibleReviewHref?.includes('source=dream'),
    'visible dream review handoff should preserve dream source',
  );
  assert.ok(
    visibleReviewHref?.includes('search=Project+Orbit') ||
      visibleReviewHref?.includes('search=Project%20Orbit'),
    'visible dream review handoff should preserve topic search',
  );
  const reviewReceipt = projectCard.getByLabel('梦境复核交接回执');
  await reviewReceipt.getByText('复核交接回执').waitFor({ timeout: 10000 });
  await reviewReceipt
    .getByText('只打开复核筛选')
    .waitFor({ timeout: 10000 });
  await reviewReceipt
    .getByText('目标：Reflection 以“Project Orbit”筛选，来源标记为 dream。')
    .waitFor({ timeout: 10000 });
  await reviewReceipt
    .getByText('来源：dreams/project-orbit-2026-05-20.md；风险 1 条，新关系 1 条。')
    .waitFor({ timeout: 10000 });
  await reviewReceipt
    .getByText('证据：原始证据 2 条；可带证据复核。')
    .waitFor({ timeout: 10000 });
  await reviewReceipt
    .getByText('跳转只携带筛选条件，不确认 dream 结论，不新增记忆或画像')
    .waitFor({ timeout: 10000 });
  await projectCard
    .getByText('这是生成式回放产出的低置信度联想')
    .waitFor({ timeout: 10000 });
  await projectCard.getByText('证据回执').waitFor({ timeout: 10000 });
  await projectCard
    .getByText('命中通道 fts / graph')
    .waitFor({ timeout: 10000 });
  await projectCard
    .getByText('Design review created a dependency on finance approval.')
    .first()
    .waitFor({ timeout: 10000 });
  await projectCard
    .getByText('Orbit timeline changed after design review.')
    .first()
    .waitFor({ timeout: 10000 });
  await projectCard
    .getByText('Budget risk has no owner.')
    .waitFor({ timeout: 10000 });
  const newerCard = page.locator('.dream-card', { hasText: 'Newer Focus' });
  await newerCard
    .getByText('缺证据回执')
    .waitFor({ timeout: 10000 });
  await newerCard.getByText('文件日期 2026-05-21').waitFor({ timeout: 10000 });
  await newerCard
    .getByText('按文件名日期阅读')
    .waitFor({ timeout: 10000 });
  await newerCard
    .getByText('生成日期：未记录；文件名日期：2026-05-21。')
    .waitFor({ timeout: 10000 });
  await newerCard
    .getByText('Markdown 未记录 Generated 行，只能把文件名日期当作归档线索。')
    .waitFor({ timeout: 10000 });
  await newerCard
    .getByText('先补证据')
    .waitFor({ timeout: 10000 });
  await newerCard
    .getByText('不会写用户画像、创建 Rehearsal、确认新关系')
    .waitFor({ timeout: 10000 });
  const newerVisibleHandoff = newerCard.getByLabel('梦境可见复核入口');
  await newerVisibleHandoff.getByText('复核入口').waitFor({ timeout: 10000 });
  await newerVisibleHandoff
    .getByText('先带主题去 Reflection 找证据')
    .waitFor({ timeout: 10000 });
  await newerVisibleHandoff
    .getByRole('link', { name: '打开反思筛选' })
    .waitFor({ timeout: 10000 });
  await newerCard
    .locator('.dream-content')
    .waitFor({ state: 'hidden', timeout: 10000 });

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

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/dreams?file=${encodeURIComponent('../secret.md')}`,
    {
      waitUntil: 'domcontentloaded',
    },
  );
  await page.getByText('梦境重放').first().waitFor({ timeout: 10000 });
  await page
    .getByText(
      '深链状态：已忽略无效 dream 文件参数；只接受 dreams/文件名.md 或 文件名.md。',
    )
    .waitFor({ timeout: 10000 });
  await page
    .getByText('深链已忽略：通知文件参数无效')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('页面没有读取该参数，已按最近可用 dream 展示')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('不会重跑 Dream Replay、更新 digest、确认内容或写回记忆')
    .waitFor({ timeout: 10000 });

  console.log('verify-memory-dreams-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
