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

const quickUseListItem = {
  ...suggestionListItem,
  id: 'quick-promote',
  slug: 'quick-promote',
  title: 'Quick Promote Candidate',
  summary: 'A low-risk suggestion that can be promoted directly.',
  risk: 'low',
  sources: ['memory_outcome_loop'],
  suggestedFrom: 'memory_outcome_loop',
  repetition: 'Successful outcome cue repeated 3 times',
  reviewRequired: false,
  reviewReasons: [],
  bindings: [
    {
      id: 'quick-promote:personal_ai',
      skillId: 'quick-promote',
      platform: 'personal_ai',
      state: 'installed',
      installedVersion: 'v0.1',
      installedSha256: 'quick-promote-sha',
      metadata: {},
      createdAt: 1778231000,
      updatedAt: 1778231000,
    },
  ],
  createdAt: 1778231000,
  updatedAt: 1778231000,
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
    '技能包包含可执行脚本文件，需要确认命令和权限',
    '技能资源文件包含安装、下载或 MCP 连接指令，需要确认外部依赖',
    '本机 skill 包含脚本或外部依赖，但未发现测试、eval、fixture 或 verify 验证线索',
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

const validatedLocalAgentListItem = {
  ...localAgentListItem,
  id: 'validated-local-agent-import',
  slug: 'validated-local-agent-import',
  title: 'Validated Local Agent Import',
  summary: 'A Codex CLI skill discovered with a local test artifact.',
  reviewReasons: [
    '外部 agent 平台导入的技能需要先确认来源内容',
    '技能包包含可执行脚本文件，需要确认命令和权限',
    '技能说明包含安装、下载或 MCP 连接指令，需要确认外部依赖',
    '技能包包含额外脚本或资源文件',
  ],
  bindings: [
    {
      id: 'validated-local-agent-import:codex',
      skillId: 'validated-local-agent-import',
      platform: 'codex',
      state: 'installed',
      installedVersion: 'v0.3',
      installedSha256: 'validated-local-agent-sha',
      remoteMtime: 1778235100,
      metadata: {
        source: 'desktop_app_fs',
        sourceRoot: '/Users/skill-user/.codex/skills',
        sourceDirectory:
          '/Users/skill-user/.codex/skills/validated-local-agent-import',
        skillMdPath:
          '/Users/skill-user/.codex/skills/validated-local-agent-import/SKILL.md',
        fileCount: 2,
        totalByteSize: 2048,
        validationFileCount: 1,
        validationFilePaths: ['tests/helper.test.js'],
      },
      createdAt: 1778235100,
      updatedAt: 1778235100,
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

let activeShareToken = 'test-token';
let activeShareBlocked = false;

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
            urlPath: `/skills/${item.slug}%40${item.currentVersion}?token=${
              item.id === 'active-skill' ? activeShareToken : 'test-token'
            }`,
            token: item.id === 'active-skill' ? activeShareToken : 'test-token',
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
let suggestionDismissedVisible = false;
let quickUseVisible = true;
let quickUsePromoted = false;
let localAgentPromoted = false;
let snoozePosted = false;
let unsnoozePosted = false;
let dismissPosted = false;
let usePosted = false;
let quickUsePostCount = 0;
let holdQuickUseUse = false;
let releaseQuickUseUse;
let localUsePosted = false;
let desktopSyncPosted = false;
let suggestionScenario = 'mixed';
let desktopSyncGate = null;
let releaseDesktopSyncGate = null;
let openClawToggleGate = null;
let releaseOpenClawToggleGate = null;
let desktopHealthOk = true;

try {
  launched = await launchExtensionContext();
  const { context, extensionId } = launched;
  await context.addInitScript(() => {
    let skillFoundryClipboard = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          skillFoundryClipboard = String(text);
        },
        readText: async () => skillFoundryClipboard,
      },
    });
  });

  await context.route('http://mock-memory/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.replace('/api/v1', '') || '/';

    if (request.method() === 'GET' && endpoint === '/skills') {
      const filter = url.searchParams.get('filter') || 'active';
      const items =
        filter === 'dismissed'
          ? suggestionDismissedVisible
            ? [
                {
                  ...suggestionListItem,
                  status: 'dismissed',
                  dismissReason: 'dismissed_by_user',
                },
              ]
            : []
          : [
              activeListItem,
              ...(localAgentPromoted
                ? [{ ...localAgentListItem, status: 'active' }]
                : []),
              ...(quickUsePromoted
                ? [{ ...quickUseListItem, status: 'active' }]
                : []),
            ];
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
          : suggestionScenario === 'empty'
          ? []
          : suggestionScenario === 'local-only'
            ? [localAgentListItem]
            : suggestionScenario === 'local-validation'
              ? [validatedLocalAgentListItem]
            : [
                externalChangeListItem,
                ...(localAgentPromoted ? [] : [localAgentListItem]),
                ...(suggestionVisible && !suggestionDismissedVisible
                  ? [suggestionListItem]
                  : []),
                ...(quickUseVisible ? [quickUseListItem] : []),
              ];
      return jsonResponse(route, {
        items: visibleSuggestions,
        total: visibleSuggestions.length,
      });
    }

    if (request.method() === 'GET' && endpoint === '/skills/sync-settings') {
      return jsonResponse(route, { items: syncSettings });
    }

    if (
      request.method() === 'GET' &&
      endpoint.startsWith('/skills/') &&
      endpoint.endsWith('/health')
    ) {
      const encodedId = endpoint
        .replace(/^\/skills\//, '')
        .replace(/\/health$/, '');
      const skillId = decodeURIComponent(encodedId);
      if (skillId === 'active-skill') {
        return jsonResponse(route, {
          health: {
            skillId,
            gateState: 'degraded',
            successCount: 1,
            failureCount: 3,
            consecutiveFailures: 3,
            health: 0.28,
            pinned: false,
          },
        });
      }
      return jsonResponse(route, { health: null });
    }

    if (
      request.method() === 'PUT' &&
      endpoint.startsWith('/skills/sync-settings/')
    ) {
      const platform = decodeURIComponent(endpoint.split('/').pop() || '');
      const payload = request.postDataJSON();
      if (platform === 'claude_code') {
        return jsonResponse(
          route,
          { error: 'Permission denied saving sync setting' },
          500,
        );
      }
      if (platform === 'openclaw' && openClawToggleGate) {
        await openClawToggleGate;
      }
      const index = syncSettings.findIndex(
        (setting) => setting.platform === platform,
      );
      if (index < 0) {
        return jsonResponse(route, { error: `Unknown platform ${platform}` }, 404);
      }
      syncSettings[index] = {
        ...syncSettings[index],
        enabled: Boolean(payload.enabled),
        updatedAt: 1778239000,
      };
      return jsonResponse(route, { setting: syncSettings[index] });
    }

    if (request.method() === 'GET' && endpoint === '/skills/active-skill') {
      const skill = detailFor(activeListItem);
      if (activeShareBlocked) {
        delete skill.share;
        skill.shareError = 'secret pattern scan blocked test credential';
      }
      return jsonResponse(route, { skill });
    }

    if (request.method() === 'GET' && endpoint === '/skills/snooze-candidate') {
      return jsonResponse(route, {
        skill: {
          ...detailFor(suggestionListItem),
          snoozedUntil: suggestionSnoozedVisible ? 1893456000 : undefined,
        },
      });
    }

    if (request.method() === 'GET' && endpoint === '/skills/quick-promote') {
      return jsonResponse(route, {
        skill: detailFor(
          quickUsePromoted
            ? { ...quickUseListItem, status: 'active' }
            : quickUseListItem,
        ),
      });
    }

    if (request.method() === 'GET' && endpoint === '/skills/external-change') {
      return jsonResponse(route, { skill: detailFor(externalChangeListItem) });
    }

    if (
      request.method() === 'GET' &&
      endpoint === '/skills/local-agent-import'
    ) {
      return jsonResponse(route, {
        skill: detailFor({
          ...localAgentListItem,
          status: localAgentPromoted ? 'active' : 'suggestion',
        }),
      });
    }

    if (
      request.method() === 'GET' &&
      endpoint === '/skills/validated-local-agent-import'
    ) {
      return jsonResponse(route, {
        skill: detailFor(validatedLocalAgentListItem),
      });
    }

    if (
      request.method() === 'POST' &&
      endpoint === '/skills/suggestions/snooze-candidate/snooze'
    ) {
      snoozePosted = true;
      suggestionVisible = false;
      suggestionSnoozedVisible = true;
      suggestionDismissedVisible = false;
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
      suggestionDismissedVisible = false;
      return jsonResponse(route, {
        skill: detailFor(suggestionListItem),
      });
    }

    if (
      request.method() === 'POST' &&
      endpoint === '/skills/suggestions/snooze-candidate/dismiss'
    ) {
      dismissPosted = true;
      suggestionVisible = false;
      suggestionSnoozedVisible = false;
      suggestionDismissedVisible = true;
      return jsonResponse(route, {
        skill: {
          ...detailFor({
            ...suggestionListItem,
            status: 'dismissed',
          }),
          dismissReason: 'dismissed_by_user',
        },
      });
    }

    if (
      request.method() === 'POST' &&
      endpoint === '/skills/suggestions/quick-promote/use'
    ) {
      usePosted = true;
      quickUsePostCount += 1;
      if (holdQuickUseUse) {
        await new Promise((resolve) => {
          releaseQuickUseUse = resolve;
        });
      }
      quickUseVisible = false;
      quickUsePromoted = true;
      return jsonResponse(route, {
        skill: detailFor({ ...quickUseListItem, status: 'active' }),
      });
    }

    if (
      request.method() === 'POST' &&
      endpoint === '/skills/suggestions/local-agent-import/use'
    ) {
      localUsePosted = true;
      localAgentPromoted = true;
      return jsonResponse(route, {
        skill: detailFor({ ...localAgentListItem, status: 'active' }),
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
      if (!desktopHealthOk) {
        return jsonResponse(
          route,
          { error: 'Desktop App is not running' },
          503,
        );
      }
      return jsonResponse(route, {
        ok: true,
        status: 'running',
        version: 'e2e',
      });
    }
    if (request.method() === 'POST' && url.pathname === '/skills/sync/run') {
      desktopSyncPosted = true;
      if (desktopSyncGate) await desktopSyncGate;
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

  await context.route('http://mock-memory/skills/**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Mock Skill Preview</title><main>Read-only skill preview</main>',
    });
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
  const decisionOverview = page.locator('.suggestion-decision-overview');
  await decisionOverview
    .locator('.decision-overview-head', {
      hasText: '4 条可审 · 0 条稍后 · 3 条需审核',
    })
    .waitFor({ timeout: 15000 });
  await decisionOverview
    .locator('.decision-overview-row', {
      hasText:
        '4 条可审；1 条可直接处理；3 条需要先看证据或风险；1 条会覆盖 active 真源',
    })
    .waitFor({ timeout: 15000 });
  await decisionOverview
    .locator('.decision-overview-row', {
      hasText: '1 条来自本机 agent 目录；1 条涉及脚本、安装、下载或 MCP 依赖',
    })
    .waitFor({ timeout: 15000 });
  await decisionOverview
    .locator('.decision-overview-row', {
      hasText: '查看、搜索、展开详情和切换过滤只读',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.workspace-title h2', { hasText: 'Active Skill' })
    .waitFor({
      timeout: 15000,
    });
  const activeSkillCard = page.locator('.skill-card', {
    hasText: 'Active Skill',
  });
  assert.match(
    (await activeSkillCard.getAttribute('title')) || '',
    /查看在用 Active Skill：只会打开技能详情/,
  );
  assert.match(
    (await activeSkillCard.getAttribute('aria-label')) || '',
    /不会改变状态、生成或复制分享 token、触发平台同步、写外部平台或执行 skill/,
  );
  const healthReceipt = page.locator('.skill-health-receipt');
  await healthReceipt
    .locator('.skill-health-head', { hasText: '质量门控降级' })
    .waitFor({ timeout: 15000 });
  await healthReceipt
    .locator('.skill-health-row', {
      hasText: 'gate_state=degraded；健康分 0.28',
    })
    .waitFor({ timeout: 15000 });
  await healthReceipt
    .locator('.skill-health-row', {
      hasText: '已从自动推荐和注入面停用',
    })
    .waitFor({ timeout: 15000 });
  await healthReceipt
    .locator('.skill-health-row', {
      hasText: '这是只读健康回执；不会执行 skill',
    })
    .waitFor({ timeout: 15000 });
  await page.locator('.tab-btn', { hasText: '绑定' }).click();
  const shareReceipt = page.locator('.share-receipt');
  await shareReceipt
    .locator('.share-receipt-head', {
      hasText: '带 token 的只读安装入口',
    })
    .waitFor({ timeout: 15000 });
  await shareReceipt
    .locator('.share-receipt-row', {
      hasText: '持有 token 的 agent 可只读拉取 HTML 预览、SKILL.md、package.json',
    })
    .waitFor({ timeout: 15000 });
  await shareReceipt
    .locator('.share-receipt-row', {
      hasText: '复制可访问 URL 或安装指令会包含 token',
    })
    .waitFor({ timeout: 15000 });
  await shareReceipt
    .locator('.share-receipt-row', {
      hasText: 'v1 · sha256 active-skill · 0 个资源文件',
    })
    .waitFor({ timeout: 15000 });
  await shareReceipt
    .locator('.share-receipt-row', {
      hasText: 'Public Skill URL 不提供写入、覆盖、执行或平台同步权限',
    })
    .waitFor({ timeout: 15000 });
  await shareReceipt
    .locator('.share-receipt-row', {
      hasText: '旧 token 继续有效直到后台 revoke',
    })
    .waitFor({ timeout: 15000 });
  const enabledCopyUrlButton = page.locator('button', {
    hasText: '复制可访问 URL',
  });
  assert.match(
    (await enabledCopyUrlButton.getAttribute('title')) || '',
    /Active Skill · v1 · sha256 active-skill · token \.\.\.test-token/,
  );
  assert.match(
    (await enabledCopyUrlButton.getAttribute('aria-label')) || '',
    /只写本机剪贴板，不会打开链接、安装 skill、触发平台同步或执行脚本/,
  );
  const enabledPreviewButton = page.locator('button', { hasText: '打开预览' });
  assert.match(
    (await enabledPreviewButton.getAttribute('title')) || '',
    /打开带 token 的只读预览：Active Skill · v1 · sha256 active-skill · token \.\.\.test-token/,
  );
  assert.match(
    (await enabledPreviewButton.getAttribute('aria-label')) || '',
    /不会复制剪贴板、安装 skill、触发平台同步、写外部平台或执行脚本/,
  );
  await enabledCopyUrlButton.click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    'http://mock-memory/skills/active-skill%40v1?token=test-token',
  );
  const shareCopyReceipt = page.locator('.share-copy-receipt');
  await shareCopyReceipt
    .locator('.share-copy-head', {
      hasText: '已复制带 token 的可访问 URL',
    })
    .waitFor({ timeout: 15000 });
  await shareCopyReceipt
    .locator('.share-copy-row', {
      hasText: '已写入完整 token URL；展示短链没有复制',
    })
    .waitFor({ timeout: 15000 });
  await shareCopyReceipt
    .locator('.share-copy-row', {
      hasText: 'Active Skill · v1 · sha256 active-skill · token ...test-token',
    })
    .waitFor({ timeout: 15000 });
  await shareCopyReceipt
    .locator('.share-copy-row', {
      hasText: '这次复制只写本机剪贴板，不会打开链接、安装 skill、触发平台同步',
    })
    .waitFor({ timeout: 15000 });
  const previewPagePromise = context.waitForEvent('page', { timeout: 15000 });
  await page.locator('button', { hasText: '打开预览' }).click();
  const previewPage = await previewPagePromise;
  await previewPage.waitForURL(
    'http://mock-memory/skills/active-skill%40v1?token=test-token',
    { timeout: 15000 },
  );
  await previewPage
    .waitForLoadState('domcontentloaded', { timeout: 15000 })
    .catch(() => {});
  assert.equal(
    previewPage.url(),
    'http://mock-memory/skills/active-skill%40v1?token=test-token',
    'Preview should open the full tokenized skill URL, not the display URL',
  );
  await previewPage.close();
  await shareCopyReceipt
    .locator('.share-copy-head', {
      hasText: '已打开只读预览',
    })
    .waitFor({ timeout: 15000 });
  await shareCopyReceipt
    .locator('.share-copy-row', {
      hasText: '新标签页使用完整 token URL，只读拉取 HTML 预览',
    })
    .waitFor({ timeout: 15000 });
  await shareCopyReceipt
    .locator('.share-copy-row', {
      hasText: '不复制剪贴板、不安装 skill、不触发平台同步',
    })
    .waitFor({ timeout: 15000 });
  await page.evaluate(() => {
    window.__skillFoundryOriginalOpen = window.open;
    window.open = () => null;
  });
  await page.locator('button', { hasText: '打开预览' }).click();
  await shareCopyReceipt
    .locator('.share-copy-head', {
      hasText: '预览未打开',
    })
    .waitFor({ timeout: 15000 });
  await shareCopyReceipt
    .locator('.share-copy-row', {
      hasText: '浏览器没有返回新标签页；本页没有确认访问 token URL',
    })
    .waitFor({ timeout: 15000 });
  await shareCopyReceipt
    .locator('.share-copy-row', {
      hasText: '不会复制剪贴板、安装 skill、触发平台同步、写外部平台或执行脚本',
    })
    .waitFor({ timeout: 15000 });
  await page.evaluate(() => {
    if (window.__skillFoundryOriginalOpen) {
      window.open = window.__skillFoundryOriginalOpen;
      delete window.__skillFoundryOriginalOpen;
    }
  });
  activeShareBlocked = true;
  await page.locator('.skill-card', { hasText: 'Active Skill' }).click();
  await shareReceipt
    .locator('.share-receipt-head', {
      hasText: '已阻止生成可访问 URL',
    })
    .waitFor({ timeout: 15000 });
  await shareReceipt
    .locator('.share-receipt-row', {
      hasText: 'secret pattern scan blocked test credential',
    })
    .waitFor({ timeout: 15000 });
  await shareReceipt
    .locator('.share-receipt-row', {
      hasText: '复制可访问 URL、打开预览和平台安装指令保持不可用',
    })
    .waitFor({ timeout: 15000 });
  const copyUrlButton = page.locator('button', { hasText: '复制可访问 URL' });
  assert.equal(await copyUrlButton.isDisabled(), true);
  assert.match(
    (await copyUrlButton.getAttribute('title')) || '',
    /分享已被安全扫描阻断/,
  );
  assert.match(
    (await copyUrlButton.getAttribute('aria-label')) || '',
    /不会复制短链、打开无 token 地址/,
  );
  const previewButton = page.locator('button', { hasText: '打开预览' });
  assert.equal(await previewButton.isDisabled(), true);
  assert.match(
    (await previewButton.getAttribute('title')) || '',
    /打开预览不可用/,
  );
  const blockedChatGptBinding = page.locator('.binding-card', {
    hasText: 'ChatGPT / GPTs',
  });
  const blockedInstallButton = blockedChatGptBinding.locator(
    '.binding-instruction button',
  );
  assert.equal(await blockedInstallButton.isDisabled(), true);
  assert.match(
    (await blockedInstallButton.getAttribute('title')) || '',
    /复制 ChatGPT \/ GPTs 安装指令不可用/,
  );
  activeShareBlocked = false;
  await page.locator('.skill-card', { hasText: 'Active Skill' }).click();
  await shareReceipt
    .locator('.share-receipt-head', {
      hasText: '带 token 的只读安装入口',
    })
    .waitFor({ timeout: 15000 });
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
  const enabledInstallButton = chatGptBinding.locator(
    '.binding-instruction button',
  );
  assert.match(
    (await enabledInstallButton.getAttribute('title')) || '',
    /复制 ChatGPT \/ GPTs 安装指令：Active Skill · v1 · sha256 active-skill · token \.\.\.test-token/,
  );
  assert.match(
    (await enabledInstallButton.getAttribute('aria-label')) || '',
    /只写本机剪贴板，不会打开链接、安装 skill、触发平台同步或执行脚本/,
  );
  await enabledInstallButton.click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    '请按这份 SKILL spec 工作（按需 fetch 资源）：http://mock-memory/skills/active-skill%40v1?token=test-token',
  );
  await shareCopyReceipt
    .locator('.share-copy-head', {
      hasText: '已复制 ChatGPT / GPTs 安装指令',
    })
    .waitFor({ timeout: 15000 });
  await shareCopyReceipt
    .locator('.share-copy-row', {
      hasText: '已写入 ChatGPT / GPTs 安装指令；指令内包含完整 token URL',
    })
    .waitFor({ timeout: 15000 });
  await shareCopyReceipt
    .locator('.share-copy-row', {
      hasText: '不会打开链接、安装 skill、触发平台同步、写入外部平台或执行脚本',
    })
    .waitFor({ timeout: 15000 });
  await shareCopyReceipt
    .locator('.share-copy-row', {
      hasText: '如果详情刷新生成新 live token 或 active version 变化',
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
  const syncDialogEntryButton = page.locator('.section-head button', {
    hasText: '平台级自动同步',
  });
  assert.match(
    (await syncDialogEntryButton.getAttribute('title')) || '',
    /打开平台级自动同步设置/,
  );
  assert.match(
    (await syncDialogEntryButton.getAttribute('aria-label')) || '',
    /不会保存开关、立即同步、扫描或写入本机目录/,
  );
  await syncDialogEntryButton.click();
  const syncCloseButton = page.locator('.sync-dialog .dialog-actions button', {
    hasText: '关闭',
  });
  assert.match(
    (await syncCloseButton.getAttribute('title')) || '',
    /关闭平台级自动同步弹窗/,
  );
  assert.match(
    (await syncCloseButton.getAttribute('aria-label')) || '',
    /不会取消已发出的保存或同步请求/,
  );
  const syncOverview = page.locator('.sync-scope-overview');
  await syncOverview
    .locator('.sync-result-head', {
      hasText: '1 条 active · 1 个可同步平台 · 1 个有失败',
    })
    .waitFor({ timeout: 15000 });
  await syncOverview
    .locator('.sync-result-row', {
      hasText: '没有远端 API 平台开启；OpenClaw 不会自动推送 1 条 active 技能',
    })
    .waitFor({ timeout: 15000 });
  await syncOverview
    .locator('.sync-result-row', {
      hasText:
        'Codex CLI 已开启；由 Desktop App 扫描和写回本机 skill 目录',
    })
    .waitFor({ timeout: 15000 });
  await syncOverview
    .locator('.sync-result-row', {
      hasText: 'ChatGPT / GPTs、Claude.ai Skills 不参与自动同步',
    })
    .waitFor({ timeout: 15000 });
  await syncOverview
    .locator('.sync-result-row', {
      hasText: '1 个平台有最近失败：OpenClaw remote: OpenClaw is not configured',
    })
    .waitFor({ timeout: 15000 });
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
  const openClawSyncButton = openClawSyncRow.locator('button.sync-now-btn');
  assert.equal(await openClawSyncButton.isDisabled(), true);
  assert.match(
    (await openClawSyncButton.getAttribute('title')) || '',
    /平台级开关未开启/,
  );
  assert.match(
    (await openClawSyncButton.getAttribute('aria-label')) || '',
    /当前不会调用远端 API/,
  );
  const openClawSwitch = openClawSyncRow.locator('label.switch input');
  assert.match(
    (await openClawSwitch.getAttribute('title')) || '',
    /OpenClaw remote 开启自动同步/,
  );
  assert.match(
    (await openClawSwitch.getAttribute('aria-label')) || '',
    /只保存平台级 enabled=true/,
  );
  openClawToggleGate = new Promise((resolve) => {
    releaseOpenClawToggleGate = resolve;
  });
  await openClawSwitch.check({ force: true });
  const syncReceipt = page.locator('.sync-result-receipt');
  await syncReceipt
    .locator('.sync-result-head', {
      hasText: '开关保存中',
    })
    .waitFor({ timeout: 15000 });
  await syncReceipt
    .locator('.sync-result-head', {
      hasText: 'OpenClaw remote 开启请求已发出',
    })
    .waitFor({ timeout: 15000 });
  await syncReceipt
    .locator('.sync-result-row', {
      hasText: '正在保存 OpenClaw remote enabled=true',
    })
    .waitFor({ timeout: 15000 });
  await syncReceipt
    .locator('.sync-result-row', {
      hasText: '返回前不能确认开关已保存；页面会暂时锁定其它同步开关和立即同步按钮',
    })
    .waitFor({ timeout: 15000 });
  await syncReceipt
    .locator('.sync-result-row', {
      hasText: '保存处理中不会执行 skill、不会写 manual-only 平台',
    })
    .waitFor({ timeout: 15000 });
  await openClawSyncRow
    .locator('.switch span', { hasText: '保存开启中' })
    .waitFor({
      timeout: 15000,
    });
  assert.equal(await openClawSwitch.isDisabled(), true);
  assert.match(
    (await openClawSwitch.getAttribute('aria-label')) || '',
    /OpenClaw remote 开关保存中/,
  );
  assert.equal(
    await page
      .locator('.sync-row', { hasText: 'Codex CLI' })
      .locator('label.switch input')
      .isDisabled(),
    true,
  );
  releaseOpenClawToggleGate?.();
  await syncReceipt
    .locator('.sync-result-head', {
      hasText: '开关回执',
    })
    .waitFor({ timeout: 15000 });
  await syncReceipt
    .locator('.sync-result-head', {
      hasText: 'OpenClaw remote 已开启',
    })
    .waitFor({ timeout: 15000 });
  await syncReceipt
    .locator('.sync-result-row', {
      hasText: 'Memory Service 已确认 OpenClaw remote 的 enabled=true',
    })
    .waitFor({ timeout: 15000 });
  await syncReceipt
    .locator('.sync-result-row', {
      hasText: '后续平台级同步会把 1 条 active 技能纳入 OpenClaw remote 推送/回拉范围',
    })
    .waitFor({ timeout: 15000 });
  await syncReceipt
    .locator('.sync-result-row', {
      hasText: '保存开关不会立刻调用远端 API',
    })
    .waitFor({ timeout: 15000 });
  await syncOverview
    .locator('.sync-result-head', {
      hasText: '1 条 active · 2 个可同步平台 · 1 个有失败',
    })
    .waitFor({ timeout: 15000 });
  openClawToggleGate = null;
  releaseOpenClawToggleGate = null;
  await openClawSyncRow.locator('.switch span', { hasText: '已开启' }).waitFor({
    timeout: 15000,
  });
  assert.match(
    (await openClawSwitch.getAttribute('title')) || '',
    /OpenClaw remote 关闭自动同步/,
  );
  await openClawSwitch.uncheck({ force: true });
  await syncReceipt
    .locator('.sync-result-head', {
      hasText: 'OpenClaw remote 已关闭',
    })
    .waitFor({ timeout: 15000 });
  await syncReceipt
    .locator('.sync-result-row', {
      hasText: '后续自动同步不会再推送 1 条 active 技能到 OpenClaw remote',
    })
    .waitFor({ timeout: 15000 });
  await syncReceipt
    .locator('.sync-result-row', {
      hasText: '关闭开关不会删除远端已安装 skill',
    })
    .waitFor({ timeout: 15000 });
  await syncOverview
    .locator('.sync-result-head', {
      hasText: '1 条 active · 1 个可同步平台 · 1 个有失败',
    })
    .waitFor({ timeout: 15000 });
  const claudeCodeSyncRow = page.locator('.sync-row', {
    hasText: 'Claude Code',
  });
  await claudeCodeSyncRow.locator('label.switch input').check({ force: true });
  await syncReceipt
    .locator('.sync-result-head', {
      hasText: 'Claude Code 保存失败',
    })
    .waitFor({ timeout: 15000 });
  await syncReceipt
    .locator('.sync-result-row', {
      hasText: 'Memory Service 未确认 enabled=true；当前仍按原配置 enabled=false 显示',
    })
    .waitFor({ timeout: 15000 });
  await syncReceipt
    .locator('.sync-result-row', {
      hasText: 'Permission denied saving sync setting',
    })
    .waitFor({ timeout: 15000 });
  await syncReceipt
    .locator('.sync-result-row', {
      hasText: '没有触发同步、没有写远端平台、没有读写本机目录',
    })
    .waitFor({ timeout: 15000 });
  assert.equal(
    await claudeCodeSyncRow.locator('label.switch input').isChecked(),
    false,
  );
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
  const chatGptSwitch = chatGptSyncRow.locator('label.switch input');
  assert.match(
    (await chatGptSwitch.getAttribute('title')) || '',
    /仅支持手动安装指引/,
  );
  assert.match(
    (await chatGptSwitch.getAttribute('aria-label')) || '',
    /自动同步开关不可用/,
  );
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
  desktopSyncGate = new Promise((resolve) => {
    releaseDesktopSyncGate = resolve;
  });
  activeShareToken = 'rotated-token';
  const codexSyncButton = codexSyncRow.locator('button.sync-now-btn');
  assert.match(
    (await codexSyncButton.getAttribute('title')) || '',
    /立即同步 Codex CLI/,
  );
  assert.match(
    (await codexSyncButton.getAttribute('aria-label')) || '',
    /请求 Desktop App 扫描\/写回/,
  );
  await codexSyncButton.click();
  await syncReceipt
    .locator('.sync-result-head', {
      hasText: '同步处理中',
    })
    .waitFor({ timeout: 15000 });
  await syncReceipt
    .locator('.sync-result-head', {
      hasText: 'Codex CLI 同步请求已发出',
    })
    .waitFor({ timeout: 15000 });
  await syncReceipt
    .locator('.sync-result-row', {
      hasText: '正在通过本机 Desktop App 发起同步',
    })
    .waitFor({ timeout: 15000 });
  await syncReceipt
    .locator('.sync-result-row', {
      hasText: '请求返回前还没有确认新增 suggestion、更新 binding、推送、回拉、安装或外部写入',
    })
    .waitFor({ timeout: 15000 });
  await syncReceipt
    .locator('.sync-result-row', {
      hasText: '不会执行 skill、不会写 manual-only 平台，也不会自动覆盖 active 真源',
    })
    .waitFor({ timeout: 15000 });
  releaseDesktopSyncGate?.();
  await syncReceipt
    .locator('.sync-result-head', {
      hasText: 'Codex CLI 成功',
    })
    .waitFor({ timeout: 15000 });
  desktopSyncGate = null;
  releaseDesktopSyncGate = null;
  await page
    .locator('.sync-result-row', {
      hasText: '新增 suggestion 1 条；待审核变更 1 条',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.sync-result-row', {
      hasText: '顶部 Inbox 有 1 条外部变更待审核',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.sync-result-row', {
      hasText: 'manual-only 平台不会被自动写入',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.sync-result-row', {
      hasText: 'skill 不会被执行',
    })
    .waitFor({ timeout: 15000 });
  await page.locator('.secondary-btn', { hasText: '关闭' }).click();
  await shareCopyReceipt
    .locator('.share-copy-head', {
      hasText: '旧复制回执 · 当前详情已刷新',
    })
    .waitFor({ timeout: 15000 });
  await shareCopyReceipt
    .locator('.share-copy-row', {
      hasText: '复制时 Active Skill · v1 · sha256 active-skill · token ...test-token',
    })
    .waitFor({ timeout: 15000 });
  await shareCopyReceipt
    .locator('.share-copy-row', {
      hasText: 'v1 · sha256 active-skill · token ...ated-token',
    })
    .waitFor({ timeout: 15000 });
  await shareCopyReceipt
    .locator('.share-copy-row', {
      hasText: '重新点击复制可访问 URL 或安装指令后再粘贴',
    })
    .waitFor({ timeout: 15000 });
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

  const priorityStrip = page.locator('.inbox-priority');
  await priorityStrip
    .locator('.priority-kicker', { hasText: '优先审覆盖' })
    .waitFor({ timeout: 15000 });
  await priorityStrip
    .locator('strong', { hasText: 'Active Skill (openclaw change)' })
    .waitFor({ timeout: 15000 });
  await priorityStrip
    .locator('.priority-facts', {
      hasText: 'OpenClaw remote 变更会覆盖 active-skill',
    })
    .waitFor({ timeout: 15000 });
  await priorityStrip
    .locator(
      'button[aria-label*="查看变更 Active Skill (openclaw change)"][title*="不会覆盖 active 真源"]',
    )
    .waitFor({ timeout: 15000 });
  await page
    .locator('.suggestion-group')
    .first()
    .locator('.suggestion-group-head', { hasText: 'OpenClaw 导入' })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.suggestion-card')
    .first()
    .locator('.title', { hasText: 'Active Skill (openclaw change)' })
    .waitFor({ timeout: 15000 });

  const suggestionCard = page.locator('.suggestion-card', {
    hasText: 'Snooze Candidate',
  });
  assert.match(
    (await suggestionCard.getAttribute('title')) || '',
    /查看建议 Snooze Candidate：只会在右侧打开详情并显示证据\/风险/,
  );
  assert.match(
    (await suggestionCard.getAttribute('aria-label')) || '',
    /不会使用、丢弃、稍后审、覆盖 active 真源、触发同步或执行 skill/,
  );
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
  const suggestionCardReceipt = suggestionCard.locator(
    '.suggestion-card-receipt',
  );
  await suggestionCardReceipt
    .locator('.suggestion-card-receipt-head', {
      hasText: '先看证据风险',
    })
    .waitFor({ timeout: 15000 });
  await suggestionCardReceipt
    .locator('.suggestion-card-receipt-row', {
      hasText: '主按钮只会进入证据/风险页，不会直接入库或覆盖',
    })
    .waitFor({ timeout: 15000 });
  await suggestionCardReceipt
    .locator('.suggestion-card-receipt-row', {
      hasText: '不会即时触发 OpenClaw',
    })
    .waitFor({ timeout: 15000 });
  await suggestionCardReceipt
    .locator('.suggestion-card-receipt-row', {
      hasText: '只有使用/确认、丢弃、稍后审会写 suggestion 状态',
    })
    .waitFor({ timeout: 15000 });
  await suggestionCard
    .locator(
      'button[aria-label*="查看风险 Snooze Candidate"][title*="不会入库"]',
    )
    .waitFor({ timeout: 15000 });
  await suggestionCard
    .locator(
      'button[aria-label*="丢弃 Snooze Candidate"][title*="不会删除 active 技能"]',
    )
    .waitFor({ timeout: 15000 });
  await suggestionCard
    .locator(
      'button[aria-label*="稍后审 Snooze Candidate"][title*="仍是 suggestion"]',
    )
    .waitFor({ timeout: 15000 });
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
  const externalChangeCardReceipt = externalChangeCard.locator(
    '.suggestion-card-receipt',
  );
  await externalChangeCardReceipt
    .locator('.suggestion-card-receipt-head', {
      hasText: '先看变更证据',
    })
    .waitFor({ timeout: 15000 });
  await externalChangeCardReceipt
    .locator('.suggestion-card-receipt-row', {
      hasText: '确认后覆盖 active-skill 的 active 真源',
    })
    .waitFor({ timeout: 15000 });
  await externalChangeCard
    .locator(
      'button[aria-label*="查看变更 Active Skill (openclaw change)"][title*="不会覆盖 active 真源"]',
    )
    .waitFor({ timeout: 15000 });
  const quickUseReceiptCard = page.locator('.suggestion-card', {
    hasText: 'Quick Promote Candidate',
  });
  const quickUseCardReceipt = quickUseReceiptCard.locator(
    '.suggestion-card-receipt',
  );
  await quickUseCardReceipt
    .locator('.suggestion-card-receipt-head', { hasText: '可直接入库' })
    .waitFor({ timeout: 15000 });
  await quickUseCardReceipt
    .locator('.suggestion-card-receipt-row', {
      hasText: '确认后才提升为 active 真源',
    })
    .waitFor({ timeout: 15000 });
  await quickUseCardReceipt
    .locator('.suggestion-card-receipt-row', {
      hasText: '无需强审核',
    })
    .waitFor({ timeout: 15000 });
  await quickUseReceiptCard
    .locator(
      'button[aria-label*="确认使用 Quick Promote Candidate"][title*="提升为 active 真源"]',
    )
    .waitFor({ timeout: 15000 });
  await priorityStrip.locator('button', { hasText: '查看变更' }).click();
  await page
    .locator('.workspace-title h2', {
      hasText: 'Active Skill (openclaw change)',
    })
    .waitFor({ timeout: 15000 });
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
    .locator('.decision-receipt', {
      hasText: '确认覆盖才会改写 active 真源',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.decision-receipt', {
      hasText: 'OpenClaw remote 变更会覆盖 active-skill',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.decision-receipt', {
      hasText: 'Codex CLI 已开启时等待 Desktop App 同步',
    })
    .waitFor({ timeout: 15000 });
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
      hasText: '已忽略 1 个越界文件：../outside.js',
    })
    .waitFor({ timeout: 15000 });
  await localAgentCard
    .locator('.review-preview', {
      hasText: '未发现测试/eval/fixture/verify 线索',
    })
    .waitFor({ timeout: 15000 });
  await localAgentCard
    .locator('.review-preview', {
      hasText: '可执行脚本',
    })
    .waitFor({ timeout: 15000 });
  await localAgentCard
    .locator('.review-preview', {
      hasText: '资源文件包含安装、下载或 MCP',
    })
    .waitFor({ timeout: 15000 });
  const localAgentCardReceipt = localAgentCard.locator(
    '.suggestion-card-receipt',
  );
  await localAgentCardReceipt
    .locator('.suggestion-card-receipt-row', {
      hasText: '本机目录 ~/.codex/skills/local-agent-import',
    })
    .waitFor({ timeout: 15000 });
  await localAgentCardReceipt
    .locator('.suggestion-card-receipt-row', {
      hasText: '已忽略 1 个越界文件：../outside.js',
    })
    .waitFor({ timeout: 15000 });
  await localAgentCardReceipt
    .locator('.suggestion-card-receipt-row', {
      hasText: '来自 Desktop App 扫描快照；本页不会重新读取本机目录',
    })
    .waitFor({ timeout: 15000 });
  await localAgentCardReceipt
    .locator('.suggestion-card-receipt-row', {
      hasText: '未发现测试/eval/fixture/verify 线索；确认后仍不会被当成已验证',
    })
    .waitFor({ timeout: 15000 });
  await localAgentCardReceipt
    .locator('.suggestion-card-receipt-row', {
      hasText: '不会运行包内脚本、安装依赖、连接 MCP 或执行 skill',
    })
    .waitFor({ timeout: 15000 });
  await localAgentCard
    .locator(
      'button[aria-label*="查看风险 Local Agent Import"][title*="不会入库"]',
    )
    .waitFor({ timeout: 15000 });
  await localAgentCard.click();
  await page
    .locator('.workspace-title h2', { hasText: 'Local Agent Import' })
    .waitFor({
      timeout: 15000,
    });
  await page
    .locator(
      '.workspace-actions button[aria-label*="查看风险 Local Agent Import"][title*="不会入库"]',
      { hasText: '查看风险' },
    )
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
  await page
    .locator('.review-audit-summary', {
      hasText: '已忽略 1 个越界文件：../outside.js',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.review-audit-summary', {
      hasText: '未发现测试/eval/fixture/verify 线索',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.review-gate', {
      hasText: '可执行脚本',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.review-gate', {
      hasText: '未发现测试、eval、fixture 或 verify 验证线索',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.review-gate', {
      hasText: '资源文件包含安装、下载或 MCP',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.decision-receipt', {
      hasText: '确认使用才会进入 active 真源',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.decision-receipt', {
      hasText: '本机目录 ~/.codex/skills/local-agent-import',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.decision-receipt', {
      hasText: '已忽略 1 个越界文件：../outside.js',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.decision-receipt', {
      hasText: '未发现测试/eval/fixture/verify 线索',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.decision-receipt', {
      hasText: '证据页已打开；点击确认会立即执行入库或覆盖',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.decision-receipt', {
      hasText: '不会修改、删除、修复或反写原本机目录 ~/.codex/skills/local-agent-import',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.decision-receipt', {
      hasText: '不会运行包内脚本、安装依赖、连接 MCP，或执行该 skill',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.decision-receipt', {
      hasText: '确认后仍不会被当成已验证',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator(
      '.workspace-actions button[aria-label*="确认使用 Local Agent Import"][title*="提升为 active 真源"]',
      { hasText: '确认使用' },
    )
    .click();
  await page
    .locator('.workspace-title h2', { hasText: 'Local Agent Import' })
    .waitFor({ timeout: 15000 });
  const localActionReceipt = page.locator('.skill-action-receipt');
  await localActionReceipt
    .locator('.sync-result-head', {
      hasText: '已入库 Local Agent Import',
    })
    .waitFor({ timeout: 15000 });
  await localActionReceipt
    .locator('.sync-result-row', {
      hasText: '点击目标 Local Agent Import',
    })
    .waitFor({ timeout: 15000 });
  await localActionReceipt
    .locator('.sync-result-row', {
      hasText: '本机导入 ~/.codex/skills/local-agent-import',
    })
    .waitFor({ timeout: 15000 });
  await localActionReceipt
    .locator('.sync-result-row', {
      hasText: '不会修改、删除、修复或反写原本机目录 ~/.codex/skills/local-agent-import',
    })
    .waitFor({ timeout: 15000 });
  await localActionReceipt
    .locator('.sync-result-row', {
      hasText: '已忽略 1 个越界文件：../outside.js',
    })
    .waitFor({ timeout: 15000 });
  await localActionReceipt
    .locator('.sync-result-row', {
      hasText: '不会运行包内脚本、安装依赖、连接 MCP，或执行该 skill',
    })
    .waitFor({ timeout: 15000 });
  await localActionReceipt
    .locator('.sync-result-row', {
      hasText: '确认后仍不会被当成已验证',
    })
    .waitFor({ timeout: 15000 });

  await suggestionCard.click();
  await page
    .locator('.workspace-title h2', { hasText: 'Snooze Candidate' })
    .waitFor({
      timeout: 15000,
    });
  await page
    .locator(
      '.workspace-actions button[aria-label*="查看风险 Snooze Candidate"][title*="不会入库"]',
      { hasText: '查看风险' },
    )
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
  await page
    .locator('.decision-receipt', {
      hasText: '未确认前不会分发到其他平台',
    })
    .waitFor({ timeout: 15000 });
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

  const quickUseCard = page.locator('.suggestion-card', {
    hasText: 'Quick Promote Candidate',
  });
  const quickUseButton = quickUseCard.locator('button', { hasText: '✓ 使用' });
  holdQuickUseUse = true;
  await quickUseButton.click();
  const actionReceipt = page.locator('.skill-action-receipt');
  await actionReceipt
    .locator('.sync-result-head', {
      hasText: '决策处理中',
    })
    .waitFor({ timeout: 15000 });
  await actionReceipt
    .locator('.sync-result-head', {
      hasText: '正在确认使用 Quick Promote Candidate',
    })
    .waitFor({ timeout: 15000 });
  await actionReceipt
    .locator('.sync-result-row', {
      hasText: '点击目标 Quick Promote Candidate',
    })
    .waitFor({ timeout: 15000 });
  await actionReceipt
    .locator('.sync-result-row', {
      hasText: '原状态 suggestion / 当前 Inbox',
    })
    .waitFor({ timeout: 15000 });
  await actionReceipt
    .locator('.sync-result-row', {
      hasText: '本页不会重复发送使用、丢弃、稍后审或现在审请求',
    })
    .waitFor({ timeout: 15000 });
  assert.equal(
    await quickUseButton.isDisabled(),
    true,
    'Quick promote button should be disabled while the use request is pending',
  );
  for (let attempt = 0; attempt < 50 && quickUsePostCount === 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(
    quickUsePostCount,
    1,
    'Expected exactly one quick-promote use POST while pending',
  );
  releaseQuickUseUse?.();
  holdQuickUseUse = false;
  await page
    .locator('.workspace-title h2', { hasText: 'Quick Promote Candidate' })
    .waitFor({ timeout: 15000 });
  await actionReceipt
    .locator('.sync-result-head', {
      hasText: '已入库 Quick Promote Candidate',
    })
    .waitFor({ timeout: 15000 });
  await actionReceipt
    .locator('.sync-result-row', {
      hasText: '点击目标 Quick Promote Candidate',
    })
    .waitFor({ timeout: 15000 });
  await actionReceipt
    .locator('.sync-result-row', {
      hasText: 'Suggestion 已提升为 active 真源',
    })
    .waitFor({ timeout: 15000 });
  await actionReceipt
    .locator('.sync-result-row', {
      hasText: 'v0.1 · sha256 quick-promote-sh · 0 个资源文件',
    })
    .waitFor({ timeout: 15000 });
  await actionReceipt
    .locator('.sync-result-row', {
      hasText: '短链 /skills/quick-promote@v0.1 只作识别',
    })
    .waitFor({ timeout: 15000 });
  await actionReceipt
    .locator('.sync-result-row', {
      hasText: '没有触发 OpenClaw 即时同步',
    })
    .waitFor({ timeout: 15000 });
  await actionReceipt
    .locator('.sync-result-row', {
      hasText: 'Codex CLI 等待 Desktop App 下一次同步',
    })
    .waitFor({ timeout: 15000 });
  await actionReceipt
    .locator('.sync-result-row', {
      hasText: 'manual-only 平台不会自动写入',
    })
    .waitFor({ timeout: 15000 });
  assert.equal(
    quickUsePostCount,
    1,
    'Quick promote should not be submitted more than once',
  );
  await assert.doesNotReject(async () =>
    page
      .locator('.suggestion-card', { hasText: 'Quick Promote Candidate' })
      .waitFor({
        state: 'detached',
        timeout: 5000,
      }),
  );

  await page
    .locator('.suggestion-card', { hasText: 'Snooze Candidate' })
    .locator(
      'button[aria-label*="稍后审 Snooze Candidate"][title*="移出当前 Inbox"]',
      { hasText: '稍后审' },
    )
    .click();

  await page
    .locator('.skill-action-receipt', {
      hasText: '稍后审回执',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.skill-action-receipt', {
      hasText: '已暂缓 Snooze Candidate',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.skill-action-receipt', {
      hasText: '点击目标 Snooze Candidate',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.skill-action-receipt', {
      hasText: '审核 gate 已满足',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.skill-action-receipt', {
      hasText: '没有提升 active 真源',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.skill-action-receipt', {
      hasText: '没有触发 OpenClaw 或 Desktop App 同步',
    })
    .waitFor({ timeout: 15000 });
  await decisionOverview
    .locator('.decision-overview-head', {
      hasText: '1 条可审 · 1 条稍后 · 1 条需审核',
    })
    .waitFor({ timeout: 15000 });
  await decisionOverview
    .locator('.decision-overview-row', {
      hasText: '1 条仍是 suggestion；只能现在审或丢弃',
    })
    .waitFor({ timeout: 15000 });

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
  assert.match(
    (await snoozedCard.getAttribute('title')) || '',
    /查看稍后建议 Snooze Candidate：只会打开稍后详情和恢复路径/,
  );
  assert.match(
    (await snoozedCard.getAttribute('aria-label')) || '',
    /不会现在审、丢弃、使用、覆盖 active 真源、触发同步或执行 skill/,
  );
  await page.locator('.snoozed-inbox', { hasText: '稍后建议' }).waitFor({
    timeout: 15000,
  });
  await snoozedCard
    .locator('.snoozed-card-meta', { hasText: '回到 Inbox' })
    .waitFor({
      timeout: 15000,
    });
  await snoozedCard
    .locator(
      'button[aria-label*="现在审 Snooze Candidate"][title*="恢复到 Inbox"]',
      { hasText: '现在审' },
    )
    .waitFor({ timeout: 15000 });
  await snoozedCard
    .locator(
      'button[aria-label*="丢弃 Snooze Candidate"][title*="不会删除 active 技能"]',
      { hasText: '丢弃' },
    )
    .waitFor({ timeout: 15000 });
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
    .locator(
      '.workspace-actions button[aria-label*="现在审 Snooze Candidate"][title*="恢复到 Inbox"]',
      { hasText: '现在审' },
    )
    .click();
  await page
    .locator('.skill-action-receipt', {
      hasText: '恢复审阅回执',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.skill-action-receipt', {
      hasText: '原状态 suggestion / 稍后建议',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.skill-action-receipt', {
      hasText: '暂缓标记已清除',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.skill-action-receipt', {
      hasText: '不会提升 active 真源',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.suggestion-card', { hasText: 'Snooze Candidate' })
    .waitFor({
      timeout: 15000,
    });
  await decisionOverview
    .locator('.decision-overview-head', {
      hasText: '2 条可审 · 0 条稍后 · 2 条需审核',
    })
    .waitFor({ timeout: 15000 });
  await assert.doesNotReject(async () =>
    page
      .locator('.snoozed-suggestion-card', { hasText: 'Snooze Candidate' })
      .waitFor({
        state: 'detached',
        timeout: 5000,
      }),
  );

  await page
    .locator('.suggestion-card', { hasText: 'Snooze Candidate' })
    .locator(
      'button[aria-label*="丢弃 Snooze Candidate"][title*="不会删除 active 技能"]',
      { hasText: '丢弃' },
    )
    .click();
  await page
    .locator('.skill-action-receipt', {
      hasText: '丢弃回执',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.skill-action-receipt', {
      hasText: '已丢弃 Snooze Candidate',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.skill-action-receipt', {
      hasText: '点击目标 Snooze Candidate',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.skill-action-receipt', {
      hasText: '状态已变为 dismissed',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.skill-action-receipt', {
      hasText: '没有改写外部平台或本机目录',
    })
    .waitFor({ timeout: 15000 });
  await assert.doesNotReject(async () =>
    page.locator('.suggestion-card', { hasText: 'Snooze Candidate' }).waitFor({
      state: 'detached',
      timeout: 5000,
    }),
  );
  await decisionOverview
    .locator('.decision-overview-head', {
      hasText: '1 条可审 · 0 条稍后 · 1 条需审核',
    })
    .waitFor({ timeout: 15000 });

  assert.equal(snoozePosted, true, 'Expected the snooze API to be called');
  assert.equal(unsnoozePosted, true, 'Expected the unsnooze API to be called');
  assert.equal(dismissPosted, true, 'Expected the dismiss API to be called');
  assert.equal(usePosted, true, 'Expected the use API to be called');
  assert.equal(
    localUsePosted,
    true,
    'Expected the local agent import use API to be called',
  );
  assert.equal(
    desktopSyncPosted,
    true,
    'Expected the Desktop App skill sync API to be called',
  );

  suggestionScenario = 'local-only';
  localAgentPromoted = false;
  await page.reload({ waitUntil: 'load', timeout: 15000 });
  await page.locator('h1', { hasText: '个人技能炼金台' }).waitFor({
    timeout: 15000,
  });
  await page
    .locator('.inbox-bar-head .title', {
      hasText: '本地 agent 导入建议 · 1 条待决策',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.inbox-bar-head .meta', {
      hasText: '由 Desktop App 从本机 agent skill 目录扫描导入',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.inbox-push-hint', {
      hasText: 'Codex CLI skill 目录扫描',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.inbox-push-hint', {
      hasText:
        '这些建议来自 Codex / Claude Code / Cursor 的本机 skill 目录',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.suggestion-card', { hasText: 'Local Agent Import' })
    .waitFor({ timeout: 15000 });

  suggestionScenario = 'local-validation';
  await page.reload({ waitUntil: 'load', timeout: 15000 });
  await page.locator('h1', { hasText: '个人技能炼金台' }).waitFor({
    timeout: 15000,
  });
  const validatedLocalCard = page.locator('.suggestion-card', {
    hasText: 'Validated Local Agent Import',
  });
  await validatedLocalCard.waitFor({ timeout: 15000 });
  const validatedLocalCardReceipt = validatedLocalCard.locator(
    '.suggestion-card-receipt',
  );
  await validatedLocalCardReceipt
    .locator('.suggestion-card-receipt-row', {
      hasText: '本机目录 ~/.codex/skills/validated-local-agent-import',
    })
    .waitFor({ timeout: 15000 });
  await validatedLocalCardReceipt
    .locator('.suggestion-card-receipt-row', {
      hasText: '验证线索 1 个：tests/helper.test.js；只是包内线索，卡片不会运行验证',
    })
    .waitFor({ timeout: 15000 });
  await validatedLocalCardReceipt
    .locator('.suggestion-card-receipt-row', {
      hasText: '不会运行包内脚本、安装依赖、连接 MCP 或执行 skill',
    })
    .waitFor({ timeout: 15000 });

  desktopHealthOk = false;
  suggestionScenario = 'empty';
  quickUsePromoted = false;
  localAgentPromoted = false;
  await page.reload({ waitUntil: 'load', timeout: 15000 });
  await page.locator('h1', { hasText: '个人技能炼金台' }).waitFor({
    timeout: 15000,
  });
  await page
    .locator('.header-actions button', { hasText: '平台级自动同步' })
    .click();
  const blockedSyncOverview = page.locator('.sync-scope-overview');
  await blockedSyncOverview
    .locator('.sync-result-head', {
      hasText: '1 条 active · 0 个可同步平台 · 1 个等待 Desktop App · 1 个有失败',
    })
    .waitFor({ timeout: 15000 });
  await blockedSyncOverview
    .locator('.sync-result-row', {
      hasText:
        'Codex CLI 已开启但 Desktop App 未运行；页面不会直接读写本机目录',
    })
    .waitFor({ timeout: 15000 });
  const blockedCodexSyncRow = page.locator('.sync-row', {
    hasText: 'Codex CLI',
  });
  await blockedCodexSyncRow
    .locator('.sync-diagnostic.blocked', {
      hasText: 'Desktop App 未运行，无法读写本机目录',
    })
    .waitFor({ timeout: 15000 });
  await blockedCodexSyncRow
    .locator('.switch span', { hasText: '需 Desktop App' })
    .waitFor({ timeout: 15000 });
  const blockedCodexSyncButton =
    blockedCodexSyncRow.locator('button.sync-now-btn');
  assert.equal(
    await blockedCodexSyncButton.isDisabled(),
    true,
    'Desktop App-gated sync button should stay disabled while local bridge is unavailable',
  );
  assert.match(
    (await blockedCodexSyncButton.getAttribute('title')) || '',
    /Desktop App 未运行/,
  );
  assert.match(
    (await blockedCodexSyncButton.getAttribute('aria-label')) || '',
    /Chrome 页面不会直接读写本机 skill 目录/,
  );
  await page.locator('.secondary-btn', { hasText: '关闭' }).click();
  desktopHealthOk = true;

  suggestionScenario = 'empty';
  suggestionVisible = false;
  suggestionSnoozedVisible = false;
  suggestionDismissedVisible = false;
  quickUseVisible = false;
  quickUsePromoted = false;
  localAgentPromoted = false;
  await page.reload({ waitUntil: 'load', timeout: 15000 });
  await page.locator('h1', { hasText: '个人技能炼金台' }).waitFor({
    timeout: 15000,
  });
  const emptySuggestionReceipt = page.locator('.suggestion-empty-receipt');
  await emptySuggestionReceipt
    .locator('.empty-receipt-head', { hasText: '建议队列空回执' })
    .waitFor({ timeout: 15000 });
  await emptySuggestionReceipt
    .locator('.empty-receipt-head', { hasText: '当前没有待审 suggestion' })
    .waitFor({ timeout: 15000 });
  await emptySuggestionReceipt
    .locator('.empty-receipt-row', {
      hasText:
        'ready suggestion 与稍后 suggestion 都为空；1 条 active 真源技能仍可查看',
    })
    .waitFor({ timeout: 15000 });
  await emptySuggestionReceipt
    .locator('.empty-receipt-row', {
      hasText: '不是加载失败、过滤隐藏、质量门控降级或同步开关关闭',
    })
    .waitFor({ timeout: 15000 });
  await emptySuggestionReceipt
    .locator('.empty-receipt-row', {
      hasText:
        '新的 Flight Recorder、OpenClaw 或 Desktop App 本机扫描结果仍会先进入 suggestion',
    })
    .waitFor({ timeout: 15000 });
  await emptySuggestionReceipt
    .locator('.empty-receipt-row', {
      hasText: '不会创建 suggestion、提升 active、触发 OpenClaw / Desktop App 同步',
    })
    .waitFor({ timeout: 15000 });
  assert.equal(
    await page.locator('.inbox-bar').count(),
    0,
    'Empty suggestion state should not render the Inbox Bar',
  );
  assert.equal(
    await page.locator('.suggestion-decision-overview').count(),
    0,
    'Empty suggestion state should not render the decision overview',
  );
  await page
    .locator('.workspace-title h2', { hasText: 'Active Skill' })
    .waitFor({ timeout: 15000 });
  await assertNoPageErrors();

  console.log('verify-personal-skill-foundry-e2e: ok');
} finally {
  if (launched?.context) {
    await launched.context.close();
  }
}
