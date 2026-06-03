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

const activeListItem = {
  id: 'active-skill',
  slug: 'active-skill',
  title: 'Active Skill',
  summary: 'A promoted Personal AI skill.',
  scope: 'work',
  risk: 'low',
  trigger: 'Use for stable workflows.',
  status: 'active',
  sources: ['personal_ai'],
  currentVersion: 'v1',
  bindings: [
    {
      id: 'active-skill:personal_ai',
      skillId: 'active-skill',
      platform: 'personal_ai',
      state: 'installed',
      installedVersion: 'v1',
      installedSha256: 'active-sha',
      metadata: {},
      createdAt: 1778230000,
      updatedAt: 1778230000,
    },
  ],
  createdAt: 1778230000,
  updatedAt: 1778230000,
};

const suggestionListItem = {
  id: 'snooze-candidate',
  slug: 'snooze-candidate',
  title: 'Snooze Candidate',
  summary: 'A suggestion that should leave the Inbox when snoozed.',
  scope: 'work',
  risk: 'medium',
  trigger: 'Repeated skill-worthy workflow.',
  status: 'suggestion',
  sources: ['flight_recorder'],
  suggestedFrom: 'flight_recorder',
  repetition: '近 7 天 3 次相似任务',
  currentVersion: 'v0.1',
  reviewRequired: true,
  reviewReasons: [
    '外部 agent 平台导入的技能需要先确认来源内容',
    '证据链还不是完整确认状态',
  ],
  bindings: [
    {
      id: 'snooze-candidate:personal_ai',
      skillId: 'snooze-candidate',
      platform: 'personal_ai',
      state: 'installed',
      installedVersion: 'v0.1',
      installedSha256: 'suggestion-sha',
      metadata: {},
      createdAt: 1778230000,
      updatedAt: 1778230000,
    },
  ],
  createdAt: 1778230000,
  updatedAt: 1778230000,
};

const externalChangeListItem = {
  ...suggestionListItem,
  id: 'external-change',
  slug: 'active-skill-openclaw-change',
  title: 'Active Skill (openclaw change)',
  summary: 'A remote OpenClaw version differs from the Personal AI source.',
  sources: ['openclaw'],
  suggestedFrom: 'openclaw',
  repetition: 'External platform import',
  reviewReasons: [
    '外部 agent 平台导入的技能需要先确认来源内容',
    '证据链还不是完整确认状态',
  ],
  bindings: [
    {
      id: 'external-change:openclaw',
      skillId: 'external-change',
      platform: 'openclaw',
      state: 'installed',
      installedVersion: 'v2',
      installedSha256: 'external-change-sha',
      remoteMtime: 1778234000,
      metadata: {
        externalChangeFor: 'active-skill',
        originalSlug: 'active-skill',
      },
      createdAt: 1778234000,
      updatedAt: 1778234000,
    },
  ],
};

const localAgentListItem = {
  ...suggestionListItem,
  id: 'local-agent-import',
  slug: 'local-agent-import',
  title: 'Local Agent Import',
  summary: 'A Codex CLI skill discovered from a local skill directory.',
  sources: ['codex'],
  suggestedFrom: 'codex',
  repetition: 'External platform import',
  currentVersion: 'v0.2',
  reviewReasons: [
    '外部 agent 平台导入的技能需要先确认来源内容',
    '技能包包含额外脚本或资源文件',
  ],
  bindings: [
    {
      id: 'local-agent-import:codex',
      skillId: 'local-agent-import',
      platform: 'codex',
      state: 'installed',
      installedVersion: 'v0.2',
      installedSha256: 'local-agent-sha',
      remoteMtime: 1778235000,
      metadata: {
        source: 'desktop_app_fs',
        sourceRoot: '/Users/skill-user/.codex/skills',
        sourceDirectory: '/Users/skill-user/.codex/skills/local-agent-import',
        skillMdPath:
          '/Users/skill-user/.codex/skills/local-agent-import/SKILL.md',
        fileCount: 2,
        totalByteSize: 2048,
        rejectedFileCount: 1,
        rejectedFilePaths: ['../outside.js'],
      },
      createdAt: 1778235000,
      updatedAt: 1778235000,
    },
  ],
};

const syncSettings = [
  {
    platform: 'personal_ai',
    enabled: true,
    capability: 'internal',
    mode: 'internal',
    config: {},
    updatedAt: 1778230000,
  },
  {
    platform: 'openclaw',
    enabled: false,
    capability: 'api',
    mode: 'API direct',
    config: {},
    lastProbeAt: 1778230500,
    lastError: 'OpenClaw is not configured',
    updatedAt: 1778230000,
  },
  {
    platform: 'codex',
    enabled: true,
    capability: 'fs_via_desktop_app',
    mode: 'Desktop App fs watcher',
    config: {},
    updatedAt: 1778230000,
  },
  {
    platform: 'claude_code',
    enabled: false,
    capability: 'fs_via_desktop_app',
    mode: 'Desktop App fs watcher',
    config: {},
    updatedAt: 1778230000,
  },
  {
    platform: 'cursor',
    enabled: false,
    capability: 'fs_via_desktop_app',
    mode: 'Desktop App fs watcher',
    config: {},
    updatedAt: 1778230000,
  },
  {
    platform: 'chatgpt_gpts',
    enabled: false,
    capability: 'manual_only',
    mode: 'Manual install only',
    config: {},
    updatedAt: 1778230000,
  },
  {
    platform: 'claude_skills_web',
    enabled: false,
    capability: 'manual_only',
    mode: 'Manual install only',
    config: {},
    updatedAt: 1778230000,
  },
];

function detailFor(item) {
  const version = {
    id: `${item.id}:v1`,
    skillId: item.id,
    version: item.currentVersion,
    isActive: true,
    skillMd: `# ${item.title}\n\n${item.summary}`,
    packageJson: {},
    workflow: [
      {
        title: 'Review evidence',
        desc: 'Check the suggested workflow before using it.',
        tools: [],
      },
    ],
    evidence: [
      {
        title: 'Mock evidence',
        desc: 'Deterministic E2E fixture.',
        kind: 'fixture',
        evidenceState: 'partial',
      },
    ],
    sourceEpisodes: [],
    files: [],
    sha256: item.currentSha256 || `${item.id}-sha`,
    changelog: 'Fixture version',
    createdFrom: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };

  return {
    ...item,
    versions: [version],
    activeVersion: version,
    workflow: version.workflow,
    evidence: version.evidence,
    sourceEpisodes: version.sourceEpisodes,
    share:
      item.status === 'active'
        ? {
            displayUrl: `/skills/${item.slug}@${item.currentVersion}`,
            urlPath: `/skills/${item.slug}%40${item.currentVersion}?token=test-token`,
            token: 'test-token',
            etag: `"${version.sha256}"`,
          }
        : undefined,
  };
}

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'personal-skill-foundry-browser-'),
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
  };
}

function jsonResponse(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error instanceof Error ? error.message : String(error));
  });
  return () => {
    assert.deepEqual(
      errors,
      [],
      `Skill Foundry page errors: ${errors.join('; ')}`,
    );
  };
}

let launched;
let suggestionVisible = true;
let suggestionSnoozedVisible = false;
let snoozePosted = false;
let unsnoozePosted = false;
let desktopSyncPosted = false;

try {
  launched = await launchExtensionContext();
  const { context, extensionId } = launched;

  await context.route('http://mock-memory/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.replace('/api/v1', '') || '/';

    if (request.method() === 'GET' && endpoint === '/skills') {
      const filter = url.searchParams.get('filter') || 'active';
      const items = filter === 'dismissed' ? [] : [activeListItem];
      return jsonResponse(route, {
        items,
        total: items.length,
      });
    }

    if (request.method() === 'GET' && endpoint === '/skills/suggestions') {
      const view = url.searchParams.get('view') || 'ready';
      const visibleSuggestions =
        view === 'snoozed'
          ? [
              ...(suggestionSnoozedVisible
                ? [
                    {
                      ...suggestionListItem,
                      snoozedUntil: 1893456000,
                    },
                  ]
                : []),
            ]
          : [
              externalChangeListItem,
              localAgentListItem,
              ...(suggestionVisible ? [suggestionListItem] : []),
            ];
      return jsonResponse(route, {
        items: visibleSuggestions,
        total: visibleSuggestions.length,
      });
    }

    if (request.method() === 'GET' && endpoint === '/skills/sync-settings') {
      return jsonResponse(route, { items: syncSettings });
    }

    if (request.method() === 'GET' && endpoint === '/skills/active-skill') {
      return jsonResponse(route, { skill: detailFor(activeListItem) });
    }

    if (request.method() === 'GET' && endpoint === '/skills/snooze-candidate') {
      return jsonResponse(route, {
        skill: {
          ...detailFor(suggestionListItem),
          snoozedUntil: suggestionSnoozedVisible ? 1893456000 : undefined,
        },
      });
    }

    if (request.method() === 'GET' && endpoint === '/skills/external-change') {
      return jsonResponse(route, { skill: detailFor(externalChangeListItem) });
    }

    if (
      request.method() === 'GET' &&
      endpoint === '/skills/local-agent-import'
    ) {
      return jsonResponse(route, { skill: detailFor(localAgentListItem) });
    }

    if (
      request.method() === 'POST' &&
      endpoint === '/skills/suggestions/snooze-candidate/snooze'
    ) {
      snoozePosted = true;
      suggestionVisible = false;
      suggestionSnoozedVisible = true;
      return jsonResponse(route, {
        skill: {
          ...detailFor(suggestionListItem),
          snoozedUntil: 1893456000,
        },
      });
    }

    if (
      request.method() === 'POST' &&
      endpoint === '/skills/suggestions/snooze-candidate/unsnooze'
    ) {
      unsnoozePosted = true;
      suggestionVisible = true;
      suggestionSnoozedVisible = false;
      return jsonResponse(route, {
        skill: detailFor(suggestionListItem),
      });
    }

    return jsonResponse(
      route,
      { error: `Unexpected ${request.method()} ${endpoint}` },
      500,
    );
  });

  await context.route('http://mock-desktop/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname === '/health') {
      return jsonResponse(route, {
        ok: true,
        status: 'running',
        version: 'e2e',
      });
    }
    if (request.method() === 'POST' && url.pathname === '/skills/sync/run') {
      desktopSyncPosted = true;
      return jsonResponse(route, {
        status: 'succeeded',
        platforms: [
          {
            platform: 'codex',
            root: '/tmp/e2e-codex-skills',
            status: 'succeeded',
            scanned: 3,
            imported: 1,
            pulled: 0,
            pushed: 1,
            externalChanges: 1,
            skipped: 1,
            errors: [],
          },
        ],
      });
    }
    return jsonResponse(
      route,
      { error: `Unexpected desktop ${request.method()} ${url.pathname}` },
      500,
    );
  });

  const setupPage = await context.newPage();
  await setupPage.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await setupPage.evaluate(async () => {
    await chrome.storage.local.set({
      envConfig: {
        MEMORY_SERVICE_BASE_URL: 'http://mock-memory/api/v1',
      },
      desktopAppConfig: {
        baseUrl: 'http://mock-desktop',
      },
      userinfo: {
        username: 'skill-user',
      },
    });
  });
  await setupPage.close();

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);
  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/skills`,
    {
      waitUntil: 'load',
      timeout: 15000,
    },
  );

  await page.locator('h1', { hasText: '个人技能炼金台' }).waitFor({
    timeout: 15000,
  });
  await page
    .locator('.suggestion-card', { hasText: 'Snooze Candidate' })
    .waitFor({
      timeout: 15000,
    });
  await page
    .locator('.workspace-title h2', { hasText: 'Active Skill' })
    .waitFor({
      timeout: 15000,
    });
  await page.locator('.tab-btn', { hasText: '绑定' }).click();
  const chatGptBinding = page.locator('.binding-card', {
    hasText: 'ChatGPT / GPTs',
  });
  await chatGptBinding
    .locator('.binding-state.manual', { hasText: '手动安装' })
    .waitFor({
      timeout: 15000,
    });
  await chatGptBinding
    .locator('.binding-hint', {
      hasText: '仅提供手动安装指引',
    })
    .waitFor({ timeout: 15000 });
  await chatGptBinding
    .locator('.binding-hint', {
      hasText: '暂不能由 Personal AI 自动写入或探测安装状态',
    })
    .waitFor({ timeout: 15000 });
  const claudeWebBinding = page.locator('.binding-card', {
    hasText: 'Claude.ai Skills',
  });
  await claudeWebBinding
    .locator('.binding-state.manual', { hasText: '手动安装' })
    .waitFor({
      timeout: 15000,
    });
  await page
    .locator('.section-head button', { hasText: '平台级自动同步' })
    .click();
  const chatGptSyncRow = page.locator('.sync-row', {
    hasText: 'ChatGPT / GPTs',
  });
  const openClawSyncRow = page.locator('.sync-row', {
    hasText: 'OpenClaw remote',
  });
  await openClawSyncRow
    .locator('.sync-diagnostic.info', {
      hasText: '同步未开启，启用后覆盖所有 active 技能',
    })
    .waitFor({
      timeout: 15000,
    });
  await openClawSyncRow
    .locator('.sync-diagnostic.warn', {
      hasText: '最近失败 2026-05-08 08:55: OpenClaw is not configured',
    })
    .waitFor({
      timeout: 15000,
    });
  await chatGptSyncRow
    .locator('.scope', { hasText: '不参与自动同步' })
    .waitFor({
      timeout: 15000,
    });
  await chatGptSyncRow
    .locator('.sync-diagnostic.info', {
      hasText: '仅手动安装，不参与自动写入',
    })
    .waitFor({
      timeout: 15000,
    });
  await chatGptSyncRow.locator('.switch span', { hasText: '仅手动' }).waitFor({
    timeout: 15000,
  });
  const codexSyncRow = page.locator('.sync-row', { hasText: 'Codex CLI' });
  await codexSyncRow.locator('.switch span', { hasText: '已开启' }).waitFor({
    timeout: 15000,
  });
  await codexSyncRow
    .locator('.sync-diagnostic.ready', {
      hasText: 'Desktop App 同步已开启',
    })
    .waitFor({
      timeout: 15000,
    });
  await codexSyncRow.locator('button[aria-label="立即同步 Codex CLI"]').click();
  await page
    .locator('.sync-dialog .status-box', {
      hasText: '待审核变更 1 条',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.sync-dialog .status-box', {
      hasText: '请到顶部 Inbox 审核本机目录变更',
    })
    .waitFor({ timeout: 15000 });
  await page.locator('.secondary-btn', { hasText: '关闭' }).click();
  await page.locator('.rail-segmented button', { hasText: '已丢弃' }).click();
  await page
    .locator('.empty-card', { hasText: '目前没有已丢弃的技能' })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.header-actions button', { hasText: '平台级自动同步' })
    .click();
  await page
    .locator('.sync-row', { hasText: 'OpenClaw remote' })
    .locator('.sync-scope', {
      hasText: '开启后将自动推送 1 条 active 技能',
    })
    .waitFor({ timeout: 15000 });
  await page.locator('.secondary-btn', { hasText: '关闭' }).click();

  const suggestionCard = page.locator('.suggestion-card', {
    hasText: 'Snooze Candidate',
  });
  await suggestionCard.locator('.review-chip', { hasText: '需审核' }).waitFor({
    timeout: 15000,
  });
  await suggestionCard
    .locator('.review-preview', { hasText: '待审核摘要' })
    .waitFor({
      timeout: 15000,
    });
  await suggestionCard
    .locator('.review-preview', { hasText: '2 项原因' })
    .waitFor({
      timeout: 15000,
    });
  await suggestionCard
    .locator('.review-preview', { hasText: '风险 medium' })
    .waitFor({
      timeout: 15000,
    });
  const externalChangeCard = page.locator('.suggestion-card', {
    hasText: 'Active Skill (openclaw change)',
  });
  await externalChangeCard
    .locator('.change-chip', { hasText: '变更' })
    .waitFor({
      timeout: 15000,
    });
  await externalChangeCard
    .locator('.review-preview', { hasText: '覆盖 active-skill' })
    .waitFor({ timeout: 15000 });
  await externalChangeCard.click();
  await page
    .locator('.workspace-title h2', {
      hasText: 'Active Skill (openclaw change)',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.workspace-actions button', { hasText: '查看变更' })
    .click();
  await page.locator('.review-gate', { hasText: '外部变更需要审核' }).waitFor({
    timeout: 15000,
  });
  await page
    .locator('.review-gate', { hasText: 'active-skill 的新版本' })
    .waitFor({
      timeout: 15000,
    });
  await page
    .locator('.review-audit-summary', { hasText: '证据已查看，可以确认' })
    .waitFor({
      timeout: 15000,
    });
  await page
    .locator('.review-audit-summary', {
      hasText: 'OpenClaw remote -> active-skill',
    })
    .waitFor({
      timeout: 15000,
    });
  await page
    .locator('.workspace-actions button', { hasText: '确认覆盖' })
    .waitFor({ timeout: 15000 });

  const localAgentCard = page.locator('.suggestion-card', {
    hasText: 'Local Agent Import',
  });
  await page
    .locator('.suggestion-group', { hasText: '本地 agent 导入' })
    .waitFor({
      timeout: 15000,
    });
  await localAgentCard
    .locator('.source-link', {
      hasText: '本机目录 ~/.codex/skills/local-agent-import',
    })
    .waitFor({ timeout: 15000 });
  await localAgentCard
    .locator('.review-preview', {
      hasText: '2 个资源文件 · 2 KB · 已忽略 1 个越界文件',
    })
    .waitFor({ timeout: 15000 });
  await localAgentCard
    .locator('.review-preview', {
      hasText: '已忽略',
    })
    .waitFor({ timeout: 15000 });
  await localAgentCard.click();
  await page
    .locator('.workspace-title h2', { hasText: 'Local Agent Import' })
    .waitFor({
      timeout: 15000,
    });
  await page
    .locator('.workspace-actions button', { hasText: '查看风险' })
    .click();
  await page
    .locator('.review-audit-summary', {
      hasText: '目录 ~/.codex/skills/local-agent-import',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.review-audit-summary', {
      hasText: '2 个资源文件 · 2 KB · 已忽略 1 个越界文件',
    })
    .waitFor({ timeout: 15000 });

  await suggestionCard.click();
  await page
    .locator('.workspace-title h2', { hasText: 'Snooze Candidate' })
    .waitFor({
      timeout: 15000,
    });
  await page
    .locator('.workspace-actions button', { hasText: '查看风险' })
    .click();
  await page.locator('.review-gate', { hasText: '使用前需要审核' }).waitFor({
    timeout: 15000,
  });
  await page
    .locator('.review-audit-summary', { hasText: '证据已查看，可以确认' })
    .waitFor({
      timeout: 15000,
    });
  await page.locator('.review-audit-summary', { hasText: '1 条证据' }).waitFor({
    timeout: 15000,
  });
  await page.locator('.tab-btn.active', { hasText: '证据' }).waitFor({
    timeout: 15000,
  });
  await suggestionCard
    .locator('.review-preview', { hasText: '已查看证据' })
    .waitFor({
      timeout: 15000,
    });
  await page
    .locator('.workspace-actions button', { hasText: '确认使用' })
    .waitFor({ timeout: 15000 });

  await page
    .locator('.suggestion-card', { hasText: 'Snooze Candidate' })
    .locator('button', { hasText: '稍后审' })
    .click();

  await page
    .locator('.workspace-title h2', { hasText: 'Active Skill' })
    .waitFor({
      timeout: 15000,
    });
  await assert.doesNotReject(async () =>
    page.locator('.suggestion-card', { hasText: 'Snooze Candidate' }).waitFor({
      state: 'detached',
      timeout: 5000,
    }),
  );
  const snoozedCard = page.locator('.snoozed-suggestion-card', {
    hasText: 'Snooze Candidate',
  });
  await page.locator('.snoozed-inbox', { hasText: '稍后建议' }).waitFor({
    timeout: 15000,
  });
  await snoozedCard
    .locator('.snoozed-card-meta', { hasText: '回到 Inbox' })
    .waitFor({
      timeout: 15000,
    });
  await snoozedCard.click();
  await page
    .locator('.workspace-eyebrow', { hasText: '稍后审' })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.snoozed-review-gate', { hasText: '已放入稍后建议' })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.snoozed-review-gate', { hasText: '恢复到 Inbox 后再确认使用' })
    .waitFor({ timeout: 15000 });
  assert.equal(
    await page
      .locator('.workspace-actions button', { hasText: '确认使用' })
      .count(),
    0,
    'Snoozed suggestions should not be confirmable before restore',
  );
  await page
    .locator('.workspace-actions button', { hasText: '现在审' })
    .click();
  await page
    .locator('.suggestion-card', { hasText: 'Snooze Candidate' })
    .waitFor({
      timeout: 15000,
    });
  await assert.doesNotReject(async () =>
    page
      .locator('.snoozed-suggestion-card', { hasText: 'Snooze Candidate' })
      .waitFor({
        state: 'detached',
        timeout: 5000,
      }),
  );

  assert.equal(snoozePosted, true, 'Expected the snooze API to be called');
  assert.equal(unsnoozePosted, true, 'Expected the unsnooze API to be called');
  assert.equal(
    desktopSyncPosted,
    true,
    'Expected the Desktop App skill sync API to be called',
  );
  await assertNoPageErrors();

  console.log('verify-personal-skill-foundry-e2e: ok');
} finally {
  if (launched?.context) {
    await launched.context.close();
  }
}
