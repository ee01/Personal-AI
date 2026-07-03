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
  path.join(os.tmpdir(), 'personal-ai-source-memory-'),
);
const nowSeconds = Math.floor(Date.now() / 1000);
let dismissCount = 0;
let openSourceCount = 0;

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function emptyList() {
  return { items: [], total: 0, limit: 50, offset: 0 };
}

function capsuleFixture(status = 'saved') {
  return {
    capsule: {
      id: 'capsule-falcon-source',
      sourceKind: 'webpage',
      sourceUrl: 'https://source.example.com/falcon/handoff',
      sourceTitle: 'Falcon handoff source packet',
      sourceHost: 'source.example.com',
      captureMode: 'manual',
      captureReason: '用户点击右侧半露出 + 入库当前页面',
      status,
      scope: 'work',
      privacyLevel: 'work',
      summary: 'Falcon handoff owner, launch risk, and review checklist.',
      contentPreview:
        'Falcon launch handoff notes preserve the owner checklist, customer communication, release risk, and the next readiness review.',
      ...(status === 'saved'
        ? { messageId: 'source-memory-message-falcon' }
        : {}),
      metadata: {
        distillation: {
          status: 'ready',
          schemaVersion: 1,
          oneLineCue:
            '已保存资料 · Falcon handoff source packet：Falcon handoff owner, launch risk, and review checklist.',
          compactMemo:
            '摘要：Falcon handoff owner, launch risk, and review checklist.\n- The source packet names the owner checklist and launch review risk.',
          policyReceipt: {
            state: 'ready',
            label: '资料蒸馏已就绪',
            detail:
              '已生成一行提示、compact memo、ready takeaways 和安静触发 matcher；只作为证据提示，不自动写用户画像、创建任务或外部写入。',
            evidence: [
              '证据锚点：1',
              '要点：1',
              '触发线索：1',
              '低副作用链接：2',
            ],
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
          generatedAt: nowSeconds - 1700,
          sourceAsOf: nowSeconds - 1800,
          inputHash: 'verify-distillation-input-hash',
          evidenceAnchorIds: ['anchor-1'],
          takeawayCount: 1,
          triggerCount: 1,
        },
      },
      actionReceipt:
        status === 'dismissed'
          ? {
              state: 'dismissed',
              label: '最近操作：资料已撤销',
              detail:
                '最近一次操作关闭了这条资料的关联检索信号；capsule 只保留为复核记录，不再进入 Ask、Memory Lens 或时间轴召回。',
              evidence: [
                '资料类型：整页资料',
                '保存方式：主动保存',
                '范围：工作记忆',
                '撤销原因：用户在资料记忆详情页撤销',
              ],
              nextStep:
                '如需再次使用这份资料，需要重新保存；撤销不会删除原网页或外部系统内容。',
              occurredAt: nowSeconds - 30,
            }
          : {
              state: 'duplicate_no_change',
              label: '最近操作：已有资料保持可用',
              detail:
                '最近一次保存命中了已有资料；本次没有新建第二条 capsule，也没有更新备注或正文，只保留已有资料和关联检索信号。',
              evidence: [
                '资料类型：整页资料',
                '保存方式：主动保存',
                '范围：工作记忆',
                '原因：用户点击右侧半露出 + 入库当前页面',
              ],
              nextStep: '可打开详情核对已有资料；如需改变用途，请补备注后重新保存。',
              occurredAt: nowSeconds - 60,
            },
      createdAt: nowSeconds - 3600,
      updatedAt: nowSeconds - 1800,
      savedAt: nowSeconds - 3500,
      anchors: [
        {
          id: 'anchor-1',
          anchorKind: 'page_excerpt',
          locator: 'https://source.example.com/falcon/handoff',
          quoteOrPreview:
            'Falcon launch handoff notes preserve the owner checklist and next readiness review.',
          sensitivity: 'normal',
          confidence: 0.78,
        },
      ],
      takeaways: [
        {
          id: 'takeaway-1',
          kind: 'summary',
          title: 'Falcon handoff owner',
          body: 'The source packet names the owner checklist and launch review risk.',
          evidenceAnchorIds: ['anchor-1'],
          confidence: 0.72,
          status: 'draft',
        },
      ],
      triggers: [
        {
          id: 'trigger-1',
          triggerKind: 'title',
          description:
            'Use this source when Falcon handoff or readiness review appears.',
          matcher: { title: 'Falcon handoff source packet' },
          defaultBehavior: 'surface',
        },
      ],
    },
  };
}

function svgCapsuleFixture() {
  return {
    capsule: {
      id: 'capsule-svg-source',
      sourceKind: 'visual_memory',
      sourceUrl: 'https://source.example.com/slides/biweekly',
      sourceTitle: 'Video mobile biweekly updates - Google Slides',
      sourceHost: 'docs.google.com',
      captureMode: 'manual',
      captureReason: '用户点击网页 + 入库保存视觉证据',
      status: 'saved',
      scope: 'work',
      privacyLevel: 'work',
      summary: '视觉证据：Video mobile biweekly updates 类型：图表 · svg',
      contentPreview: '视觉证据：Video mobile biweekly updates',
      messageId: 'source-memory-message-svg',
      createdAt: nowSeconds - 900,
      updatedAt: nowSeconds - 900,
      savedAt: nowSeconds - 900,
      metadata: {
        visualMemory: {
          kind: 'chart',
          tagName: 'svg',
          label: 'Video mobile biweekly updates',
          selectorHint: 'svg.punch-filmstrip-thumbnails',
          rect: { x: 12, y: 24, width: 320, height: 180 },
          score: 0.96,
          svg: {
            width: 320,
            height: 180,
            markup:
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180" style="position:absolute;left:0;bottom:0"><rect width="320" height="180" fill="#eff6ff"/><circle cx="96" cy="92" r="44" fill="#2563eb"/><text x="160" y="98" style="fill:#111827;font-size:24px;position:absolute;left:0">SVG OK</text></svg>',
          },
        },
      },
      anchors: [],
      takeaways: [],
      triggers: [],
    },
  };
}

function sensitiveSourceCapsuleFixture() {
  return {
    capsule: {
      id: 'capsule-sensitive-source',
      sourceKind: 'webpage',
      sourceUrl:
        'https://source-only.example.com/falcon/handoff?ticket=PAI-123&token=secret-token',
      sourceTitle: 'Falcon sensitive source handoff note',
      sourceHost: 'source-only.example.com',
      captureMode: 'manual',
      captureReason: '用户点击右侧半露出 + 记住当前页面',
      status: 'saved',
      scope: 'work',
      privacyLevel: 'work',
      summary:
        'The saved source exists, but its original URL carries a sensitive query token.',
      contentPreview:
        'Sensitive source URL fixtures should keep the capsule detail checkable without exposing the token.',
      messageId: 'source-memory-message-sensitive',
      createdAt: nowSeconds - 1200,
      updatedAt: nowSeconds - 600,
      savedAt: nowSeconds - 1100,
      anchors: [
        {
          id: 'anchor-sensitive-1',
          anchorKind: 'page_excerpt',
          locator: 'Falcon sensitive source URL provenance',
          quoteOrPreview:
            'Saved source detail remains reviewable without rendering the raw tokenized URL.',
          sensitivity: 'internal',
          confidence: 0.74,
        },
      ],
      takeaways: [],
      triggers: [],
    },
  };
}

function apiFallback(url) {
  const pathname = new URL(url).pathname;
  if (pathname.endsWith('/stats')) {
    return {
      entities: { total: 0, byType: {} },
      messages: { today: 0, thisWeek: 0 },
      relationships: { total: 0 },
      currentUser: {
        id: 'verify-user',
        fallbackToDefault: false,
      },
    };
  }
  if (pathname.endsWith('/meetings')) {
    return { items: [], total: 0, limit: 50, offset: 0 };
  }
  if (pathname.endsWith('/confirm-requests')) return emptyList();
  if (pathname.endsWith('/actions')) return emptyList();
  if (pathname.endsWith('/outreach/sessions')) return emptyList();
  if (pathname.endsWith('/outreach/templates/runtime-status'))
    return emptyList();
  if (pathname.endsWith('/skills')) return emptyList();
  if (pathname.endsWith('/skills/suggestions')) return emptyList();
  return {};
}

const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1240, height: 860 },
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

try {
  await context.route('https://source.example.com/**', async (route) => {
    openSourceCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Falcon source</title><main>Falcon source opened.</main>',
    });
  });

  await context.route('http://localhost:3210/api/v1/**', async (route) => {
    const request = route.request();
    const url = request.url();
    const pathname = new URL(url).pathname;
    if (
      request.method() === 'GET' &&
      pathname.endsWith('/source-memory/capsules/capsule-read-error')
    ) {
      await route.fulfill(
        jsonResponse({ error: 'Source memory backend unavailable.' }, 503),
      );
      return;
    }
    if (
      request.method() === 'GET' &&
      pathname.endsWith('/source-memory/capsules/capsule-falcon-source')
    ) {
      await route.fulfill(jsonResponse(capsuleFixture()));
      return;
    }
    if (
      request.method() === 'GET' &&
      pathname.endsWith('/source-memory/capsules/capsule-svg-source')
    ) {
      await route.fulfill(jsonResponse(svgCapsuleFixture()));
      return;
    }
    if (
      request.method() === 'GET' &&
      pathname.endsWith('/source-memory/capsules/capsule-sensitive-source')
    ) {
      await route.fulfill(jsonResponse(sensitiveSourceCapsuleFixture()));
      return;
    }
    if (
      request.method() === 'POST' &&
      pathname.endsWith('/source-memory/capsules/capsule-falcon-source/dismiss')
    ) {
      dismissCount += 1;
      const payload = JSON.parse(request.postData() || '{}');
      assert.equal(payload.reason, '用户在资料记忆详情页撤销');
      await route.fulfill(jsonResponse(capsuleFixture('dismissed')));
      return;
    }
    await route.fulfill(jsonResponse(apiFallback(url)));
  });

  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }
  const extensionId = new URL(worker.url()).host;
  assert.ok(extensionId, 'extension id should be available');

  const page = await context.newPage();
  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/source-memory/capsule-read-error`,
    { waitUntil: 'domcontentloaded' },
  );
  await page
    .getByRole('heading', { name: '资料记忆不可用' })
    .waitFor({ timeout: 10000 });
  await page.getByText('Source memory backend unavailable.').waitFor({
    timeout: 10000,
  });
  await page.getByText('详情读取失败回执').waitFor({ timeout: 10000 });
  await page
    .getByText('没有创建、撤销、更新备注、写入 web 检索信号或同步外部系统')
    .waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: '重试' }).waitFor({
    timeout: 10000,
  });
  await page.getByRole('button', { name: '返回时间轴' }).waitFor({
    timeout: 10000,
  });
  assert.equal(
    await page.getByRole('button', { name: '打开来源' }).count(),
    0,
    'failed source memory detail should not expose source-opening actions',
  );
  assert.equal(
    await page.getByRole('link', { name: '查看关联记忆' }).count(),
    0,
    'failed source memory detail should not link to a recall signal',
  );
  assert.equal(
    await page.getByRole('button', { name: '撤销资料记忆' }).count(),
    0,
    'failed source memory detail should not expose destructive actions',
  );

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/source-memory/capsule-falcon-source`,
    { waitUntil: 'domcontentloaded' },
  );

  await page
    .getByRole('heading', { name: 'Falcon handoff source packet' })
    .waitFor({
      timeout: 10000,
    });
  await page.locator('.eyebrow', { hasText: '资料记忆' }).waitFor({
    timeout: 10000,
  });
  await page.locator('.status-chip.saved', { hasText: '已保存' }).waitFor({
    timeout: 10000,
  });
  await page
    .locator('.status-chip', { hasText: /^整页资料$/ })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.status-chip', { hasText: /^主动保存$/ })
    .waitFor({ timeout: 10000 });
  await page.getByText('资料召回已启用').waitFor({ timeout: 10000 });
  await page
    .getByText('关联 web 记忆信号仍在，后续 Ask、Memory Lens 和时间轴可以召回这条资料')
    .waitFor({ timeout: 10000 });
  const actionPanel = page.locator('.source-action-panel');
  await actionPanel.getByText('最近操作回执').waitFor({ timeout: 10000 });
  await actionPanel
    .getByRole('heading', { name: '最近操作：已有资料保持可用' })
    .waitFor({ timeout: 10000 });
  await actionPanel
    .getByText('本次没有新建第二条 capsule，也没有更新备注或正文')
    .waitFor({ timeout: 10000 });
  await actionPanel.getByText('资料类型：整页资料').waitFor({ timeout: 10000 });
  await actionPanel
    .getByText('如需改变用途，请补备注后重新保存。')
    .waitFor({ timeout: 10000 });
  const distillationPanel = page.locator('.distillation-panel');
  await distillationPanel.getByText('资料蒸馏回执').waitFor({
    timeout: 10000,
  });
  await distillationPanel.getByText('资料蒸馏已就绪').waitFor({
    timeout: 10000,
  });
  await distillationPanel
    .locator('.distillation-badge', { hasText: /^Ready$/ })
    .waitFor({ timeout: 10000 });
  await distillationPanel
    .getByText('已生成一行提示、compact memo、ready takeaways')
    .waitFor({ timeout: 10000 });
  await distillationPanel
    .getByText('已保存资料 · Falcon handoff source packet')
    .waitFor({ timeout: 10000 });
  await distillationPanel.getByText('低副作用链接：2').waitFor({
    timeout: 10000,
  });
  await distillationPanel
    .getByText('来源来自用户保存的网页或选区，需要按外部资料证据处理。')
    .waitFor({ timeout: 10000 });
  await distillationPanel.getByText('来源快照').waitFor({
    timeout: 10000,
  });
  await distillationPanel.getByText('输入指纹').waitFor({
    timeout: 10000,
  });
  await distillationPanel.getByText('verify-disti').waitFor({
    timeout: 10000,
  });
  await distillationPanel.getByText('Context Recall 资料卡').waitFor({
    timeout: 10000,
  });
  await distillationPanel
    .locator('.distillation-downstream')
    .getByText('自动写用户画像、自动创建任务、外部写入或同步')
    .waitFor({ timeout: 10000 });
  await page
    .locator('.subtitle')
    .getByText('Falcon handoff owner, launch risk')
    .waitFor({ timeout: 10000 });
  await page.getByRole('heading', { name: '证据锚点' }).waitFor({
    timeout: 10000,
  });
  await page
    .locator('.evidence-card')
    .getByText('Falcon launch handoff notes preserve')
    .waitFor({ timeout: 10000 });
  await page.getByRole('heading', { name: '草稿要点' }).waitFor({
    timeout: 10000,
  });
  await page.getByRole('heading', { name: 'Falcon handoff owner' }).waitFor({
    timeout: 10000,
  });
  await page.getByRole('heading', { name: '未来触发线索' }).waitFor({
    timeout: 10000,
  });
  await page.getByText('Use this source when Falcon handoff').waitFor({
    timeout: 10000,
  });

  const timelineHref = await page
    .getByRole('link', { name: '查看关联记忆' })
    .getAttribute('href');
  assert.ok(
    timelineHref?.includes('#/timeline?focus=source-memory-message-falcon'),
    `timeline link should target the linked web memory signal: ${timelineHref}`,
  );

  const sourcePagePromise = context.waitForEvent('page');
  await page.getByRole('button', { name: '打开来源' }).click();
  const sourcePage = await sourcePagePromise;
  await sourcePage.waitForLoadState('domcontentloaded');
  assert.equal(
    sourcePage.url(),
    'https://source.example.com/falcon/handoff',
  );
  assert.equal(openSourceCount, 1);
  await sourcePage.close();

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/source-memory/capsule-sensitive-source`,
    { waitUntil: 'domcontentloaded' },
  );
  await page
    .getByRole('heading', { name: 'Falcon sensitive source handoff note' })
    .waitFor({ timeout: 10000 });
  await page.getByText('source-only.example.com').waitFor({ timeout: 10000 });
  await page.getByText('原始来源已隐藏').waitFor({ timeout: 10000 });
  await page
    .getByText('来源链接已隐藏：包含敏感参数；资料详情仍可复核已保存内容。')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page.getByRole('button', { name: '打开来源' }).count(),
    0,
    'tokenized source URLs should not expose an open-source action',
  );
  const sensitivePageText = await page.locator('body').innerText();
  assert.ok(
    !sensitivePageText.includes('secret-token') &&
      !sensitivePageText.includes('token='),
    'source memory detail should not render raw sensitive source URL tokens',
  );

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/source-memory/capsule-falcon-source`,
    { waitUntil: 'domcontentloaded' },
  );
  await page
    .getByRole('heading', { name: 'Falcon handoff source packet' })
    .waitFor({
      timeout: 10000,
    });

  await page.getByRole('button', { name: '撤销资料记忆' }).click();
  await page
    .locator('.status-chip.dismissed', { hasText: /^已撤销$/ })
    .waitFor({ timeout: 10000 });
  await page.getByText('资料召回已关闭').waitFor({ timeout: 10000 });
  await page
    .getByText('撤销已移除关联的 web 记忆信号，后续 Ask、Memory Lens 和时间轴召回不再使用这条 capsule')
    .waitFor({ timeout: 10000 });
  await page
    .locator('.source-action-panel')
    .getByRole('heading', { name: '最近操作：资料已撤销' })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.source-action-panel')
    .getByText('关闭了这条资料的关联检索信号')
    .waitFor({ timeout: 10000 });
  assert.equal(dismissCount, 1);
  assert.equal(
    await page.getByRole('button', { name: '撤销资料记忆' }).count(),
    0,
    'dismissed source memory should not keep the destructive action visible',
  );
  assert.equal(
    await page.getByRole('link', { name: '查看关联记忆' }).count(),
    0,
    'dismissed source memory should not link to a removed web memory signal',
  );

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/source-memory/capsule-svg-source`,
    { waitUntil: 'domcontentloaded' },
  );
  await page
    .getByRole('heading', {
      name: 'Video mobile biweekly updates - Google Slides',
    })
    .waitFor({ timeout: 10000 });
  await page.locator('.visual-svg-stage svg').waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('.visual-svg-stage svg').textContent(),
    'SVG OK',
  );
  assert.equal(
    await page.locator('.visual-svg-stage svg').getAttribute('style'),
    null,
    'stored SVG preview should strip page-level positioning styles',
  );
  assert.equal(
    await page.locator('.visual-svg-stage svg').evaluate((node) => getComputedStyle(node).position),
    'static',
    'stored SVG preview should stay in the preview stage flow',
  );
  assert.equal(
    await page.locator('.visual-svg-stage svg').evaluate((node) => Math.round(node.getBoundingClientRect().width)),
    await page.locator('.visual-svg-stage').evaluate((node) => {
      const style = getComputedStyle(node);
      return Math.round(
        node.clientWidth -
          Number.parseFloat(style.paddingLeft || '0') -
          Number.parseFloat(style.paddingRight || '0'),
      );
    }),
    'stored SVG preview should fill the preview stage width',
  );
  assert.equal(
    await page.locator('.visual-svg-stage svg text').getAttribute('style'),
    'fill:#111827; font-size:24px',
    'stored SVG preview should keep safe visual text styles',
  );
  await page
    .getByText('已保存 SVG 图形快照，原始尺寸 320 × 180 px。')
    .waitFor({ timeout: 10000 });

  console.log('verify-source-memory-capsule-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
