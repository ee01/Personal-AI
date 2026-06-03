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
  path.join(os.tmpdir(), 'personal-ai-memory-coverage-'),
);
const fixtureDir = await fs.mkdtemp(
  path.join(os.tmpdir(), 'personal-ai-memory-coverage-fixtures-'),
);
const ordinaryArchivePath = path.join(fixtureDir, 'ordinary-notes.zip');
const externalAiArchivePath = path.join(fixtureDir, 'chatgpt-export.zip');
const backupArchivePath = path.join(fixtureDir, 'personal-ai-memory.zip');
await fs.writeFile(ordinaryArchivePath, Buffer.from('ordinary archive fixture'));
await fs.writeFile(externalAiArchivePath, Buffer.from('external ai archive fixture'));
await fs.writeFile(backupArchivePath, Buffer.from('backup archive fixture'));
const nowSeconds = Math.floor(Date.now() / 1000);

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

function coverageMapFixture() {
  return {
    generatedAt: nowSeconds,
    staleAfterDays: 7,
    summary: {
      activePlatforms: 2,
      healthyPlatforms: 1,
      warningPlatforms: 1,
      pressureItems: 3,
      inactivePlatforms: 2,
      coverageGaps: 1,
      totalMessages: 128,
      totalChunks: 64,
      totalEntities: 12,
    },
    platforms: [
      {
        id: 'ringcentral',
        name: 'RingCentral',
        nameEn: 'Glip · Calendar · Video',
        icon: 'RC',
        group: 'active',
        state: 'partial',
        directions: ['ingest'],
        headline: '部分可用，仍有来源缺口或陈旧信号',
        description: '聊天、会议和日历是当前最主要的工作记忆来源。',
        lastSeenAt: nowSeconds,
        totalCount: 100,
        recentCount: 25,
        qualityScore: 58,
        qualityScoreBreakdown: {
          base: 64,
          healthyContributionBonus: 2,
          freshnessBonus: 2,
          failingPenalty: 10,
          recentRatio: 0.25,
          finalScore: 58,
          reasons: [
            '状态基准 partial：部分来源健康，但仍有缺口：64 分',
            '1 个健康贡献项：+2 分',
            '近 7 天信号占比 25%：+2 分',
            '存在失败贡献项：-10 分',
          ],
        },
        contributions: [
          {
            id: 'messages:glip',
            label: '聊天消息',
            direction: 'ingest',
            state: 'healthy',
            count: 90,
            recentCount: 25,
            latestAt: nowSeconds,
            detail: '90 条，近 7 天 25 条',
            evidence: "messages_raw.source_type='glip'",
          },
          {
            id: 'ringcentral:calendar',
            label: '日历事件',
            direction: 'ingest',
            state: 'failing',
            count: 10,
            recentCount: 0,
            latestAt: nowSeconds - 86400 * 12,
            detail: '10 条日历记录，同步失败',
            evidence: 'calendar_events.start_at / synced_at',
          },
        ],
        repairActions: [
          {
            id: 'ringcentral:calendar-failing',
            platformId: 'ringcentral',
            title: '检查 RingCentral 日历同步',
            description: '最近日历同步失败，覆盖分已扣除失败惩罚。',
            severity: 'warning',
            source: 'calendar_events.synced_at',
          },
        ],
      },
      {
        id: 'web',
        name: '网页记忆',
        nameEn: 'Memory Lens',
        icon: 'WEB',
        group: 'active',
        state: 'healthy',
        directions: ['ingest'],
        headline: '覆盖健康，近 7 天 18 条新信号',
        description: '网页上下文和划词召回。',
        lastSeenAt: nowSeconds - 300,
        totalCount: 28,
        recentCount: 18,
        qualityScore: 94,
        qualityScoreBreakdown: {
          base: 84,
          healthyContributionBonus: 2,
          freshnessBonus: 8,
          failingPenalty: 0,
          recentRatio: 0.64,
          finalScore: 94,
          reasons: [
            '状态基准 healthy：覆盖健康且近期有信号：84 分',
            '1 个健康贡献项：+2 分',
            '近 7 天信号占比 64%：+8 分',
          ],
        },
        contributions: [
          {
            id: 'messages:web',
            label: '网页上下文',
            direction: 'ingest',
            state: 'healthy',
            count: 28,
            recentCount: 18,
            latestAt: nowSeconds - 300,
            detail: '28 条，近 7 天 18 条',
            evidence: "messages_raw.source_type='web'",
          },
        ],
        repairActions: [],
      },
    ],
    repairActions: [
      {
        id: 'ringcentral:calendar-failing',
        platformId: 'ringcentral',
        title: '检查 RingCentral 日历同步',
        description: '最近日历同步失败，覆盖分已扣除失败惩罚。',
        severity: 'warning',
        source: 'calendar_events.synced_at',
      },
    ],
    timeline: [
      {
        id: 'latest:ringcentral',
        platformId: 'ringcentral',
        at: nowSeconds,
        title: 'RingCentral 最近一次覆盖信号',
        state: 'partial',
        source: "messages_raw.source_type='glip'",
      },
    ],
  };
}

function smartImportInspectFixture() {
  return {
    detectedKind: 'text',
    inputKind: 'paste',
    sourceHash: 'fixture-high-risk',
    status: 'ready',
    summary: {
      files: 1,
      readyFiles: 1,
      chunks: 1,
      profileCandidates: 0,
      skillSignals: 0,
      highRisk: 2,
      unsupported: 0,
      backup: false,
      externalAiConversations: 0,
      promotionCandidates: 0,
    },
    entries: [
      {
        id: 'fixture-entry',
        path: 'pasted-text.md',
        title: 'Secret rotation note',
        kind: 'markdown',
        status: 'ready',
        sizeBytes: 64,
        hash: 'entry-hash',
        chunkCount: 1,
        preview: 'api_key and token rotation note',
      },
    ],
    warnings: ['PDF text extraction is best-effort in this fixture.'],
  };
}

function ordinaryArchiveInspectFixture() {
  return {
    detectedKind: 'document_zip',
    inputKind: 'file',
    fileName: 'ordinary-notes.zip',
    sourceHash: 'fixture-ordinary-archive',
    status: 'ready',
    summary: {
      files: 1,
      readyFiles: 1,
      chunks: 2,
      profileCandidates: 0,
      skillSignals: 0,
      highRisk: 0,
      unsupported: 0,
      backup: false,
      externalAiConversations: 0,
      promotionCandidates: 0,
    },
    entries: [
      {
        id: 'ordinary-entry',
        path: 'notes/project.md',
        title: 'Project archive note',
        kind: 'markdown',
        status: 'ready',
        sizeBytes: 128,
        hash: 'ordinary-entry-hash',
        chunkCount: 2,
        preview: 'An ordinary imported note.',
      },
    ],
    warnings: [],
  };
}

function externalAiInspectFixture() {
  return {
    detectedKind: 'external_ai_history',
    inputKind: 'file',
    fileName: 'chatgpt-export.zip',
    sourceHash: 'fixture-external-ai-archive',
    status: 'ready',
    summary: {
      files: 2,
      readyFiles: 2,
      chunks: 5,
      profileCandidates: 1,
      skillSignals: 0,
      highRisk: 0,
      unsupported: 0,
      backup: false,
      externalAiConversations: 2,
      externalAiImportedMessages: 85,
      externalAiTotalMessages: 90,
      externalAiTruncatedConversations: 1,
      externalAiTruncatedMessages: 5,
      promotionCandidates: 1,
    },
    entries: [
      {
        id: 'external-entry-1',
        path: 'chatgpt/1-memory-import.md',
        title: 'Memory import',
        kind: 'markdown',
        status: 'ready',
        sizeBytes: 384,
        hash: 'external-entry-1-hash',
        chunkCount: 3,
        preview: 'Source: chatgpt\n\n## user\n\nI prefer visible provenance.',
      },
      {
        id: 'external-entry-2',
        path: 'chatgpt/2-project-context.md',
        title: 'Project context',
        kind: 'markdown',
        status: 'ready',
        sizeBytes: 256,
        hash: 'external-entry-2-hash',
        chunkCount: 2,
        preview: 'Source: chatgpt\n\n## assistant\n\nUse dry-run before import.',
      },
    ],
    warnings: [
      'Conversation "Project context" includes 85 messages; only the first 80 were included in this import preview.',
      'Detected external AI history from exports/conversations.json; other archive files were ignored.',
    ],
  };
}

function backupInspectFixture() {
  return {
    detectedKind: 'backup_zip',
    inputKind: 'file',
    fileName: 'personal-ai-memory.zip',
    sourceHash: 'fixture-backup-archive',
    status: 'backup',
    summary: {
      files: 0,
      readyFiles: 0,
      chunks: 0,
      profileCandidates: 0,
      skillSignals: 0,
      highRisk: 0,
      unsupported: 0,
      backup: true,
      externalAiConversations: 0,
      promotionCandidates: 0,
    },
    entries: [],
    backup: {
      reason: '检测到 manifest.json 和 user/memory.db。',
      suggestedMode: 'merge',
      replaceRequiresConfirm: true,
    },
    warnings: [],
  };
}

function backupPreviewFixture() {
  return {
    mode: 'merge',
    dryRun: true,
    inspectedAt: '2026-05-24T16:30:00.000Z',
    restoredLayers: ['A', 'B'],
    backup: {
      userId: 'backup-user',
      exportedAt: '2026-05-24T15:45:00.000Z',
      formatVersion: 1,
      includeCount: 12,
      layers: {
        A: 2,
        B: 6,
        C: {
          generated: 4,
          failed: 0,
          skipped: 0,
        },
      },
    },
    database: {
      action: 'would_merge',
      importedRows: 42,
      tableRows: {
        messages_raw: 20,
        chunks: 22,
      },
      skippedTables: ['messages_vec'],
    },
    files: {
      written: 5,
      overwritten: 2,
      preserved: 3,
      deleted: 0,
      writtenPaths: ['projects/project-alpha.md'],
      overwrittenPaths: ['USER_CORE.md'],
      preservedPaths: ['daily/current.md'],
      deletedPaths: [],
    },
    warnings: [
      'Backup was exported for user backup-user; import target is verify-user.',
    ],
  };
}

function backupImportFixture() {
  return {
    mode: 'merge',
    importedAt: '2026-05-24T16:35:00.000Z',
    restoredLayers: ['A', 'B'],
    database: {
      action: 'merged',
      changedRows: 42,
      tableChanges: {
        messages_raw: 20,
        chunks: 22,
      },
      skippedTables: ['messages_vec'],
    },
    files: {
      written: 5,
      overwritten: 2,
      preserved: 3,
      deleted: 0,
      writtenPaths: ['projects/project-alpha.md'],
      overwrittenPaths: ['USER_CORE.md'],
      preservedPaths: ['daily/current.md'],
      deletedPaths: [],
    },
    warnings: [
      'Backup was exported for user backup-user; import target is verify-user.',
    ],
  };
}

function apiFallback(url) {
  const pathname = new URL(url).pathname;
  if (pathname.endsWith('/coverage/map')) return coverageMapFixture();
  if (pathname.endsWith('/stats')) {
    return {
      entities: { total: 0, byType: {} },
      relationships: { total: 0 },
      messages: { today: 0, thisWeek: 0 },
    };
  }
  if (pathname.endsWith('/meetings')) return emptyList();
  if (pathname.endsWith('/confirm-requests')) return emptyList();
  if (pathname.endsWith('/reflection-threads')) return emptyList();
  if (pathname.endsWith('/actions')) return emptyList();
  if (pathname.endsWith('/config/runtime')) return { outreachEnabled: false };
  if (pathname.endsWith('/outreach/summary')) {
    return { upcomingCount: 0, waitingReplyCount: 0, escalatedCount: 0 };
  }
  if (pathname.endsWith('/outreach/templates/runtime-status')) return emptyList();
  if (pathname.endsWith('/skills')) return emptyList();
  if (pathname.endsWith('/skills/suggestions')) return emptyList();
  return {};
}

let smartImportCommitCount = 0;
let backupPreviewCount = 0;
let backupImportCount = 0;
let smartImportInspectMode = 'high-risk';

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
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/import/inspect')) {
      const response =
        smartImportInspectMode === 'backup'
          ? backupInspectFixture()
          : smartImportInspectMode === 'external-ai'
            ? externalAiInspectFixture()
          : smartImportInspectMode === 'ordinary'
            ? ordinaryArchiveInspectFixture()
            : smartImportInspectFixture();
      await route.fulfill(jsonResponse(response));
      return;
    }
    if (pathname.endsWith('/import/commit')) {
      smartImportCommitCount += 1;
      await route.fulfill(
        jsonResponse({
          status: 'committed',
          batchId: 'fixture-batch',
          detectedKind: 'text',
          importedMessages: 1,
          importedChunks: 1,
          skippedEntries: 0,
          warnings: [],
        }),
      );
      return;
    }
    if (pathname.endsWith('/import')) {
      const postData = request.postData() || '';
      if (postData.includes('name="dryRun"')) {
        backupPreviewCount += 1;
        await route.fulfill(jsonResponse(backupPreviewFixture()));
        return;
      }
      backupImportCount += 1;
      await route.fulfill(jsonResponse(backupImportFixture()));
      return;
    }
    await route.fulfill(jsonResponse(apiFallback(route.request().url())));
  });

  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }
  const extensionId = new URL(worker.url()).host;
  assert.ok(extensionId, 'extension id should be available');

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/memory-exploring.html#/coverage`, {
    waitUntil: 'domcontentloaded',
  });

  await page.getByRole('heading', { name: '记忆覆盖地图' }).waitFor({
    timeout: 10000,
  });
  await page.getByText('需主动处理的修复项').waitFor({ timeout: 10000 });
  const ringCentralCard = page.locator('.platform-card', {
    hasText: 'RingCentral',
  });
  await ringCentralCard.getByText('质量分').waitFor({ timeout: 10000 });
  await ringCentralCard.getByText('58/100').waitFor({ timeout: 10000 });
  await ringCentralCard.getByText('近 7 天 25% · 失败 -10').waitFor({
    timeout: 10000,
  });
  await ringCentralCard.click();

  const scorePanel = page.locator('[aria-label="质量分解释"]');
  await scorePanel.waitFor({ timeout: 10000 });
  await scorePanel.getByText('58/100').waitFor({ timeout: 10000 });
  await scorePanel.getByText('状态基准 partial').waitFor({ timeout: 10000 });
  await scorePanel.getByText('近 7 天信号占比 25%').waitFor({ timeout: 10000 });
  await scorePanel.getByText('存在失败贡献项：-10 分').waitFor({
    timeout: 10000,
  });
  await scorePanel.getByText('优先处理').waitFor({ timeout: 10000 });
  await scorePanel.getByText('日历事件 · 失败').waitFor({ timeout: 10000 });
  await scorePanel
    .getByText('先检查最近一次同步或读取错误，再重跑该来源的采集链路。')
    .waitFor({ timeout: 10000 });
  await page.getByText('检查 RingCentral 日历同步').waitFor({ timeout: 10000 });
  await page
    .locator('.platform-card', {
      hasText: '网页记忆',
    })
    .click();
  await page
    .locator('.repair-panel .empty-state', {
      hasText: '当前平台没有修复项，但全局仍有覆盖缺口。',
    })
    .waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: '查看全部修复项' }).click();
  await page
    .locator('.repair-panel', {
      hasText: '全部可解释的下一步，不自动改同步设置。',
    })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.repair-panel .repair-platform', { hasText: 'RingCentral' })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.repair-panel', { hasText: '检查 RingCentral 日历同步' })
    .waitFor({ timeout: 10000 });

  await page.getByRole('button', { name: '录入' }).click();
  await page.locator('textarea.paste-box').fill('api_key=secret token=abc');
  await page.getByRole('button', { name: '查看 dry-run' }).click();
  await page.getByText('预检提醒').waitFor({ timeout: 10000 });
  await page.getByText('发现 2 个高风险词').waitFor({ timeout: 10000 });
  const submitImport = page.getByRole('button', { name: '提交录入' });
  assert.equal(
    await submitImport.isDisabled(),
    true,
    'high-risk smart import should require explicit confirmation',
  );
  await page.getByLabel('确认仍以低权重 shadow memory 导入').check();
  assert.equal(await submitImport.isDisabled(), false);
  await submitImport.click();
  await page
    .locator('.import-status', {
      hasText: '录入完成：1 条记忆，1 个 chunks。',
    })
    .waitFor({ timeout: 10000 });
  assert.equal(smartImportCommitCount, 1);

  smartImportInspectMode = 'ordinary';
  const ordinaryChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '备份 zip' }).click();
  const ordinaryChooser = await ordinaryChooserPromise;
  await ordinaryChooser.setFiles(ordinaryArchivePath);
  await page
    .locator('.import-status', {
      hasText: '未检测到 Personal AI 备份 manifest，已按普通资料预检。',
    })
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('.backup-restore-box').count(),
    0,
    'ordinary zip selected from backup mode should not show restore controls',
  );
  await page.getByRole('button', { name: '提交录入' }).waitFor({ timeout: 10000 });

  smartImportInspectMode = 'external-ai';
  const externalAiChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '外部 AI' }).click();
  const externalAiChooser = await externalAiChooserPromise;
  await externalAiChooser.setFiles(externalAiArchivePath);
  await page
    .locator('.import-status', {
      hasText: 'dry-run 完成：2 个 AI 会话可录入，约 5 个 chunks。',
    })
    .waitFor({ timeout: 10000 });
  await page.getByText('外部 AI 对话').waitFor({ timeout: 10000 });
  await page.getByText('纳入消息').waitFor({ timeout: 10000 });
  await page
    .locator('.analysis-summary strong', { hasText: '85/90' })
    .waitFor({ timeout: 10000 });
  await page.getByText('截断会话').waitFor({ timeout: 10000 });
  await page.getByText('1 个长会话超过上限，后续 5 条消息不会写入。').waitFor({
    timeout: 10000,
  });
  await page.getByText('已识别为外部 AI 历史').waitFor({ timeout: 10000 });
  await page
    .getByText(
      'Conversation "Project context" includes 85 messages; only the first 80 were included in this import preview.',
    )
    .waitFor({ timeout: 10000 });
  await page
    .getByText(
      'Detected external AI history from exports/conversations.json; other archive files were ignored.',
    )
    .waitFor({ timeout: 10000 });
  await page.getByText('Source: chatgpt').first().waitFor({ timeout: 10000 });

  smartImportInspectMode = 'backup';
  const backupChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '备份 zip' }).click();
  const backupChooser = await backupChooserPromise;
  await backupChooser.setFiles(backupArchivePath);
  await page.getByText('检测到 Personal AI 备份 zip').waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: '继续恢复' }).click();
  await page.getByText('merge：合并备份内容').waitFor({ timeout: 10000 });
  await page.getByText('备份用户').waitFor({ timeout: 10000 });
  await page
    .locator('.preview-box')
    .getByText('backup-user', { exact: true })
    .waitFor({ timeout: 10000 });
  await page.getByText('DB 行数').waitFor({ timeout: 10000 });
  await page.getByText('42 行').waitFor({ timeout: 10000 });
  await page.getByText('影响路径预览').waitFor({ timeout: 10000 });
  await page.getByText('projects/project-alpha.md').waitFor({ timeout: 10000 });
  await page.getByText('USER_CORE.md').waitFor({ timeout: 10000 });
  await page
    .getByText('Backup was exported for user backup-user; import target is verify-user.')
    .waitFor({ timeout: 10000 });
  assert.equal(backupPreviewCount, 1);

  const confirmRestore = page.getByRole('button', { name: '确认恢复' });
  assert.equal(
    await confirmRestore.isDisabled(),
    true,
    'backup restore with warnings or overwritten paths should require impact review confirmation',
  );
  await page.getByLabel('已复核恢复影响路径、恢复模式和提醒').check();
  assert.equal(await confirmRestore.isDisabled(), false);
  await confirmRestore.click();
  await page.getByText('恢复已写入').waitFor({ timeout: 10000 });
  await page.getByText('merged · 42 行').waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: '已恢复' }).waitFor({ timeout: 10000 });
  assert.equal(backupImportCount, 1);

  console.log('verify-memory-coverage-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
  await fs.rm(fixtureDir, { recursive: true, force: true });
}
