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
const backupExportFileName = 'personal-ai-memory-verify-user-20260610T120000Z.zip';
const backupArchiveSha256 =
  '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const nowSeconds = Math.floor(Date.now() / 1000);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function expectControlBoundary(locator, fragments) {
  const title = await locator.getAttribute('title');
  const ariaLabel = await locator.getAttribute('aria-label');
  assert.ok(title, 'expected control title boundary');
  assert.equal(
    ariaLabel,
    title,
    'expected title and aria-label to share one boundary string',
  );
  for (const fragment of fragments) {
    assert.ok(
      title.includes(fragment),
      `expected control boundary to include "${fragment}", got "${title}"`,
    );
  }
}

function coverageMapReceipt(fixture) {
  const activeDerivedPlatformCount = fixture.platforms.filter(
    (platform) => platform.group === 'active' || platform.group === 'derived',
  ).length;
  const infoPlanningActionCount = fixture.repairActions.filter(
    (action) => action.severity === 'info',
  ).length;
  return {
    generatedAt: fixture.generatedAt,
    staleAfterDays: fixture.staleAfterDays,
    source:
      'messages_raw + chunks + entities + provider_sync_jobs + skill_platform_sync_settings + notification_records + proposed_actions + confirm_requests + reflection_threads + memory_import_batches',
    summary: {
      platformCount: fixture.platforms.length,
      activeDerivedPlatformCount,
      healthyPlatformCount: fixture.summary.healthyPlatforms,
      warningPlatformCount: fixture.summary.warningPlatforms,
      repairActionCount: fixture.repairActions.length,
      coverageGapCount: fixture.summary.coverageGaps,
      infoPlanningActionCount,
      pressureItemCount: fixture.summary.pressureItems,
      totalMessages: fixture.summary.totalMessages,
      totalChunks: fixture.summary.totalChunks,
      totalEntities: fixture.summary.totalEntities,
      timelineEventCount: fixture.timeline.length,
      latestAt: fixture.timeline[0]?.at ?? null,
      windowLabel: `Coverage Map 聚合快照 + 近 ${fixture.staleAfterDays} 天新鲜度窗口`,
      emptyState:
        fixture.summary.totalMessages +
          fixture.summary.totalChunks +
          fixture.summary.totalEntities >
        0
          ? '已聚合当前 Memory Service 覆盖快照；平台健康只代表本轮可读信号。'
          : '没有读到 messages/chunks/entities；这不代表连接器已经重扫、来源已经修复或外部平台为空。',
    },
    boundary:
      '只读覆盖聚合快照；不会写入记忆、重跑 provider sync、修复配置、标记已读或外发到任何平台。',
    note:
      '主聚合用于解释当前可读覆盖、质量分和修复队列；不是外部连接器同步结果、权限/ACL 完整验证或内容事实正确性证明。',
  };
}

function coverageMapFixture() {
  const fixture = {
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
    priorityFocus: {
      platformId: 'ringcentral',
      platformName: 'RingCentral',
      state: 'partial',
      qualityScore: 58,
      contributionId: 'ringcentral:calendar',
      contributionLabel: '日历事件',
      contributionState: 'failing',
      actionId: 'ringcentral:calendar-failing',
      actionTitle: '检查 RingCentral 日历同步',
      actionSeverity: 'warning',
      reason: '先检查最近一次同步或读取错误，再重跑该来源的采集链路。',
      source: 'calendar_events.synced_at',
      selectionBasis:
        '先比较 active / derived 平台里的 critical / warning 修复项，再按质量分、状态严重度和平台名排序；info 规划项只进入修复队列，不参与当前故障焦点。',
      comparedPlatformCount: 1,
      ignoredInfoActionCount: 2,
      boundary:
        '这是只读诊断路线；查看平台不会重跑同步、改配置、写入记忆、标记已读或外发。',
    },
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
  fixture.receipt = coverageMapReceipt(fixture);
  fixture.platforms.reverse();
  return fixture;
}

function coverageSliceResponse({ slice, source, summary, note, payload }) {
  return {
    generatedAt: nowSeconds,
    staleAfterDays: 7,
    receipt: {
      slice,
      generatedAt: nowSeconds,
      staleAfterDays: 7,
      source,
      summary,
      boundary:
        '只读覆盖诊断切片；不会写入记忆、重跑 provider sync、修复配置、标记已读或外发到任何平台。',
      note,
    },
    ...payload,
  };
}

function messagesBySourceSliceFixture() {
  return coverageSliceResponse({
    slice: 'messages-by-source',
    source: "messages_raw GROUP BY source_type",
    summary: {
      itemCount: 2,
      totalCount: 128,
      recentCount: 43,
      latestAt: nowSeconds - 60,
      windowLabel: '全量 source_type 聚合 + 近 7 天新鲜度',
      emptyState:
        '已读取 source_type 聚合；空 source_type 会归为 unknown。',
    },
    note:
      '按 source_type 聚合消息覆盖和近 7 天新鲜度；不读取消息正文、不补写 missing source，也不触发召回。',
    payload: {
      items: [
        { sourceType: 'glip', count: 100, recentCount: 25, latestAt: nowSeconds },
        { sourceType: 'web', count: 28, recentCount: 18, latestAt: nowSeconds - 300 },
      ],
    },
  });
}

function pressureSliceFixture() {
  return coverageSliceResponse({
    slice: 'pressure',
    source:
      'notification_records + proposed_actions + confirm_requests + reflection_threads',
    summary: {
      itemCount: 5,
      totalCount: 3,
      windowLabel: '当前未完成压力队列快照',
      emptyState:
        '已读取当前待处理压力；这些数字不是执行结果，也不会自动清队列。',
    },
    note:
      '只统计待通知、动作队列、待确认决策和 active 反思压力；不发送通知、不执行动作、不确认决策，也不关闭反思线程。',
    payload: {
      notificationsPending: 1,
      actionsQueued: 1,
      actionsRunning: 0,
      confirmRequestsPending: 1,
      reflectionThreadsActive: 0,
      totalPressureItems: 3,
    },
  });
}

function providerJobsSliceFixture() {
  return coverageSliceResponse({
    slice: 'provider-jobs-recent',
    source: 'provider_sync_jobs from the last 30 days',
    summary: {
      itemCount: 1,
      totalCount: 1,
      failureCount: 1,
      latestAt: nowSeconds - 120,
      windowLabel: '最近 30 天 provider_sync_jobs 聚合',
      emptyState:
        '已按 provider/scenario 汇总最近任务；latestStatus 只描述该组合的最新一条任务。',
    },
    note:
      '展示 provider job 最近状态、失败数和最新错误；不重跑 provider sync、不清空错误，也不修改同步设置。',
    payload: {
      items: [
        {
          provider: 'doubao',
          scenario: 'stable_memory',
          total: 1,
          succeeded: 0,
          failed: 1,
          skipped: 0,
          latestAt: nowSeconds - 120,
          latestStatus: 'failed',
          latestError: 'fixture failure',
        },
      ],
    },
  });
}

function skillsSyncSliceFixture() {
  return coverageSliceResponse({
    slice: 'skills-sync',
    source: 'skill_platform_sync_settings + skill_platform_bindings',
    summary: {
      itemCount: 2,
      totalCount: 3,
      enabledCount: 1,
      failureCount: 1,
      latestAt: nowSeconds - 180,
      windowLabel: '当前技能同步设置 + 最近探测状态',
      emptyState:
        '已读取技能平台设置和绑定计数；未启用平台仍只是规划项。',
    },
    note:
      '展示技能平台同步设置、探测状态和绑定状态计数；不启用平台、不拉取外部技能，也不写入 active skill truth。',
    payload: {
      items: [
        {
          platform: 'openclaw',
          enabled: true,
          capability: 'api',
          mode: 'auto',
          lastProbeAt: nowSeconds - 180,
          lastProbeAgeDays: 0,
          lastError: null,
          bindingsByState: { active: 2 },
        },
        {
          platform: 'claude_code',
          enabled: false,
          capability: 'fs_via_desktop_app',
          mode: 'manual',
          lastProbeAt: null,
          lastProbeAgeDays: null,
          lastError: 'fixture probe failed',
          bindingsByState: { blocked: 1 },
        },
      ],
    },
  });
}

function coverageInfoOnlyFixture() {
  return {
    generatedAt: nowSeconds,
    staleAfterDays: 7,
    summary: {
      activePlatforms: 1,
      healthyPlatforms: 1,
      warningPlatforms: 0,
      pressureItems: 0,
      inactivePlatforms: 1,
      coverageGaps: 0,
      totalMessages: 28,
      totalChunks: 12,
      totalEntities: 4,
    },
    platforms: [
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
      {
        id: 'codex',
        name: 'Codex',
        nameEn: 'Codex',
        icon: '⌘',
        group: 'inactive',
        state: 'blocked',
        directions: ['sync'],
        headline: '可选覆盖通道，尚未启用',
        description: '本地 agent skill 同步需要用户主动启用。',
        lastSeenAt: null,
        totalCount: 0,
        recentCount: 0,
        qualityScore: 12,
        qualityScoreBreakdown: {
          base: 12,
          healthyContributionBonus: 0,
          freshnessBonus: 0,
          failingPenalty: 0,
          recentRatio: 0,
          finalScore: 12,
          reasons: [
            '状态基准 blocked：通道关闭或缺少绑定：12 分',
            '没有健康贡献项加分',
            '没有可计数信号，新鲜度不加分',
          ],
        },
        contributions: [
          {
            id: 'skill-sync:codex',
            label: 'Codex 技能同步',
            direction: 'sync',
            state: 'blocked',
            count: 0,
            recentCount: 0,
            latestAt: null,
            detail: '未显式启用；只作为规划项展示',
            evidence: "skill_platform_sync_settings.platform='codex'",
          },
        ],
        repairActions: [
          {
            id: 'codex:enable',
            platformId: 'codex',
            title: '按需启用 Codex 技能同步',
            description:
              'Codex 是 P1+ 可选覆盖通道；未显式启用时只作为规划项，不算当前覆盖故障。',
            severity: 'info',
            source: "skill_platform_sync_settings.platform='codex'",
          },
        ],
      },
    ],
    repairActions: [
      {
        id: 'codex:enable',
        platformId: 'codex',
        title: '按需启用 Codex 技能同步',
        description:
          'Codex 是 P1+ 可选覆盖通道；未显式启用时只作为规划项，不算当前覆盖故障。',
        severity: 'info',
        source: "skill_platform_sync_settings.platform='codex'",
      },
    ],
    priorityFocus: null,
    timeline: [
      {
        id: 'latest:web',
        platformId: 'web',
        at: nowSeconds - 300,
        title: '网页记忆 最近一次覆盖信号',
        state: 'healthy',
        source: "messages_raw.source_type='web'",
      },
    ],
  };
  fixture.receipt = coverageMapReceipt(fixture);
  return fixture;
}

function coverageNoTimelineFixture() {
  const fixture = {
    ...coverageInfoOnlyFixture(),
    timeline: [],
  };
  fixture.receipt = coverageMapReceipt(fixture);
  return fixture;
}

function coverageCappedTimelineFixture() {
  const fixture = coverageInfoOnlyFixture();
  fixture.timeline = Array.from({ length: 8 }, (_, index) => ({
    id: `latest:web:${index + 1}`,
    platformId: 'web',
    at: nowSeconds - 60 * (index + 1),
    title: `网页记忆 最近一次覆盖信号 ${index + 1}`,
    state: 'healthy',
    source: "messages_raw.source_type='web'",
  }));
  fixture.receipt = coverageMapReceipt(fixture);
  return fixture;
}

function coverageStaleSnapshotFixture() {
  const fixture = coverageInfoOnlyFixture();
  const staleGeneratedAt = nowSeconds - 9 * 86400;
  fixture.generatedAt = staleGeneratedAt;
  fixture.platforms = fixture.platforms.map((platform) => ({
    ...platform,
    lastSeenAt: platform.lastSeenAt ? staleGeneratedAt - 300 : null,
  }));
  fixture.timeline = [
    {
      id: 'latest:web',
      platformId: 'web',
      at: staleGeneratedAt - 300,
      title: '网页记忆 最近一次覆盖信号',
      state: 'healthy',
      source: "messages_raw.source_type='web'",
    },
  ];
  fixture.receipt = coverageMapReceipt(fixture);
  return fixture;
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

function duplicateSmartImportInspectFixture() {
  return {
    detectedKind: 'text',
    inputKind: 'paste',
    sourceHash: 'fixture-high-risk',
    status: 'duplicate',
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
    existingBatchId: 'fixture-batch',
    warnings: ['This source was already imported.'],
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
      files: 5,
      readyFiles: 2,
      chunks: 3,
      profileCandidates: 0,
      skillSignals: 0,
      highRisk: 0,
      unsupported: 2,
      zipTotalFiles: 10,
      zipInspectedFiles: 5,
      zipSkippedFiles: 5,
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
      {
        id: 'ordinary-entry-2',
        path: 'notes/decision.txt',
        title: 'Decision archive note',
        kind: 'text',
        status: 'ready',
        sizeBytes: 96,
        hash: 'ordinary-entry-2-hash',
        chunkCount: 1,
        preview: 'A second ordinary imported note.',
      },
      {
        id: 'ordinary-blocked-1',
        path: 'assets/photo.png',
        title: 'photo.png',
        kind: 'unsupported',
        status: 'blocked',
        sizeBytes: 2048,
        chunkCount: 0,
        preview: '',
        blockedReason: 'Unsupported file type: .png',
      },
    ],
    warnings: ['Only inspected the first 5 entries in this fixture.'],
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
      externalAiSkippedParts: 3,
      externalAiSourcePath: 'exports/conversations.json',
      externalAiIgnoredFiles: 4,
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
      'Conversation "Project context" skipped 3 non-text message parts or attachments.',
      'Detected external AI history from exports/conversations.json; ignored 4 other archive files.',
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

function backupPreviewFixture(mode = 'merge') {
  return {
    mode,
    dryRun: true,
    inspectedAt: '2026-05-24T16:30:00.000Z',
    restoredLayers: ['A', 'B'],
    backup: {
      userId: 'backup-user',
      targetUserId: 'verify-user',
      exportedAt: '2026-05-24T15:45:00.000Z',
      formatVersion: 1,
      includeCount: 12,
      archiveSha256: backupArchiveSha256,
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
      action: mode === 'replace' ? 'would_replace' : 'would_merge',
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

function backupImportFixture(mode = 'merge') {
  return {
    mode,
    importedAt: '2026-05-24T16:35:00.000Z',
    restoredLayers: ['A', 'B'],
    backup: {
      userId: 'backup-user',
      targetUserId: 'verify-user',
      exportedAt: '2026-05-24T15:45:00.000Z',
      formatVersion: 1,
      includeCount: 12,
      archiveSha256: backupArchiveSha256,
    },
    database: {
      action: mode === 'replace' ? 'replaced' : 'merged',
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
  if (pathname.endsWith('/coverage/map')) {
    return coverageFixtureMode === 'no-timeline'
      ? coverageNoTimelineFixture()
      : coverageFixtureMode === 'capped-timeline'
      ? coverageCappedTimelineFixture()
      : coverageFixtureMode === 'info-only'
      ? coverageInfoOnlyFixture()
      : coverageFixtureMode === 'stale-snapshot'
      ? coverageStaleSnapshotFixture()
      : coverageMapFixture();
  }
  if (pathname.endsWith('/coverage/messages-by-source')) {
    return messagesBySourceSliceFixture();
  }
  if (pathname.endsWith('/coverage/pressure')) {
    return pressureSliceFixture();
  }
  if (pathname.endsWith('/coverage/provider-jobs/recent')) {
    return providerJobsSliceFixture();
  }
  if (pathname.endsWith('/coverage/skills-sync')) {
    return skillsSyncSliceFixture();
  }
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
let backupExportCount = 0;
let backupExportFailureCount = 0;
let backupPreviewCount = 0;
let backupImportCount = 0;
let backupImportFailureCount = 0;
let smartImportInspectMode = 'high-risk';
let smartImportCommitDelayMs = 0;
let coverageFixtureMode = 'default';
let failNextBackupExport = false;
let backupExportDelayMs = 0;
let failNextCoverageRefresh = false;
let failNextBackupImport = false;

function restoreModeFromPostData(postData) {
  return postData.includes('name="mode"\r\n\r\nreplace') ? 'replace' : 'merge';
}

const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: true,
  acceptDownloads: true,
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
    if (pathname.endsWith('/coverage/map') && failNextCoverageRefresh) {
      failNextCoverageRefresh = false;
      await route.fulfill(
        jsonResponse(
          {
            error: 'fixture coverage refresh failed',
          },
          503,
        ),
      );
      return;
    }
    if (pathname.endsWith('/export')) {
      const exportDelayMs = backupExportDelayMs;
      backupExportDelayMs = 0;
      if (exportDelayMs > 0) {
        await delay(exportDelayMs);
      }
      if (failNextBackupExport) {
        failNextBackupExport = false;
        backupExportFailureCount += 1;
        await route.fulfill(
          jsonResponse(
            {
              error: 'fixture backup export failed',
            },
            503,
          ),
        );
        return;
      }
      backupExportCount += 1;
      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'application/zip',
          'content-disposition': `attachment; filename="${backupExportFileName}"`,
          'cache-control': 'no-store',
          'x-personal-ai-backup-user-id': 'verify-user',
          'x-personal-ai-backup-exported-at': '2026-05-24T15:45:00.000Z',
          'x-personal-ai-backup-archive-sha256': backupArchiveSha256,
          'x-personal-ai-backup-format-version': '1',
          'x-personal-ai-backup-include-count': '12',
          'x-personal-ai-backup-layer-a-count': '2',
          'x-personal-ai-backup-layer-b-count': '6',
          'x-personal-ai-backup-layer-c-generated-count': '4',
          'x-personal-ai-backup-layer-c-failed-count': '0',
          'x-personal-ai-backup-layer-c-skipped-count': '0',
        },
        body: Buffer.from('fixture personal ai backup zip'),
      });
      return;
    }
    if (pathname.endsWith('/import/inspect')) {
      const response =
        smartImportInspectMode === 'backup'
          ? backupInspectFixture()
          : smartImportInspectMode === 'external-ai'
            ? externalAiInspectFixture()
          : smartImportInspectMode === 'duplicate'
            ? duplicateSmartImportInspectFixture()
          : smartImportInspectMode === 'ordinary'
            ? ordinaryArchiveInspectFixture()
            : smartImportInspectFixture();
      await route.fulfill(jsonResponse(response));
      return;
    }
    if (pathname.endsWith('/import/commit')) {
      const commitDelayMs = smartImportCommitDelayMs;
      smartImportCommitDelayMs = 0;
      if (commitDelayMs > 0) {
        await delay(commitDelayMs);
      }
      if (smartImportCommitCount === 0) {
        assert.match(
          request.postData() || '',
          /"confirmHighRisk":true/,
          'high-risk smart import commit should include explicit server confirmation',
        );
      }
      smartImportCommitCount += 1;
      if (smartImportInspectMode === 'external-ai') {
        await route.fulfill(
          jsonResponse({
            status: 'committed',
            batchId: 'fixture-external-ai-batch',
            detectedKind: 'external_ai_history',
            importedMessages: 85,
            importedChunks: 5,
            skippedEntries: 12,
            warnings: ['External AI import kept fixture omissions visible.'],
          }),
        );
        return;
      }
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
      const restoreMode = restoreModeFromPostData(postData);
      if (postData.includes('name="dryRun"')) {
        backupPreviewCount += 1;
        await route.fulfill(jsonResponse(backupPreviewFixture(restoreMode)));
        return;
      }
      if (failNextBackupImport) {
        failNextBackupImport = false;
        backupImportFailureCount += 1;
        await route.fulfill(
          jsonResponse(
            {
              error: 'fixture restore write failed',
            },
            503,
          ),
        );
        return;
      }
      backupImportCount += 1;
      await route.fulfill(jsonResponse(backupImportFixture(restoreMode)));
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
  let unexpectedDialogMessage = '';
  page.on('dialog', async (dialog) => {
    unexpectedDialogMessage = dialog.message();
    await dialog.dismiss();
  });
  await page.goto(`chrome-extension://${extensionId}/memory-exploring.html#/coverage`, {
    waitUntil: 'domcontentloaded',
  });

  await page.getByRole('heading', { name: '记忆覆盖地图' }).waitFor({
    timeout: 10000,
  });
  const snapshotReceipt = page.locator('[aria-label="覆盖快照回执"]');
  const manualRefreshReceipt = page.locator('[aria-label="重扫覆盖回执"]');
  await snapshotReceipt.getByText('覆盖快照').waitFor({ timeout: 10000 });
  await snapshotReceipt.getByText('当前快照可用').waitFor({ timeout: 10000 });
  await snapshotReceipt
    .getByText('重扫只刷新覆盖状态，不会自动改同步设置或写入外部平台')
    .waitFor({ timeout: 10000 });
  await snapshotReceipt
    .getByText('只读覆盖聚合快照')
    .waitFor({ timeout: 10000 });
  await snapshotReceipt
    .getByText('本轮聚合 2 个 active / derived 平台、1 个覆盖缺口、0 个可选规划项')
    .waitFor({ timeout: 10000 });
  const coverageDiagnostics = page.locator('[aria-label="P0 只读诊断切片"]');
  await coverageDiagnostics
    .getByText('P0 只读诊断切片', { exact: true })
    .waitFor({ timeout: 10000 });
  await coverageDiagnostics
    .getByText('切片已读取', { exact: true })
    .waitFor({ timeout: 10000 });
  await coverageDiagnostics
    .getByText('已读取 4 个 P0 诊断切片')
    .waitFor({ timeout: 10000 });
  await coverageDiagnostics
    .getByText('不会写入记忆、重跑 provider sync、修复配置、标记已读或外发')
    .first()
    .waitFor({ timeout: 10000 });
  await coverageDiagnostics
    .getByText('消息来源', { exact: true })
    .waitFor({ timeout: 10000 });
  await coverageDiagnostics
    .getByText('2 行 · 128 总量 · 43 近 7 天', { exact: true })
    .waitFor({ timeout: 10000 });
  await coverageDiagnostics
    .getByText("messages_raw GROUP BY source_type")
    .waitFor({ timeout: 10000 });
  await coverageDiagnostics
    .getByText('压力队列', { exact: true })
    .waitFor({ timeout: 10000 });
  await coverageDiagnostics
    .getByText('5 行 · 3 总量', { exact: true })
    .waitFor({ timeout: 10000 });
  await coverageDiagnostics
    .getByText('Provider jobs', { exact: true })
    .waitFor({ timeout: 10000 });
  await coverageDiagnostics
    .getByText('1 行 · 1 总量 · 1 失败', { exact: true })
    .waitFor({ timeout: 10000 });
  await coverageDiagnostics
    .getByText('技能同步', { exact: true })
    .waitFor({ timeout: 10000 });
  await coverageDiagnostics
    .getByText('2 行 · 3 总量 · 1 失败 · 1 启用', { exact: true })
    .waitFor({ timeout: 10000 });
  const refreshSlicesButton = coverageDiagnostics.getByRole('button', {
    name: /刷新切片/,
  });
  await expectControlBoundary(refreshSlicesButton, [
    '刷新切片',
    '四个 P0 诊断切片',
    '不会重扫 /coverage/map',
    '替换质量分',
    '不会重跑 provider sync',
  ]);
  await refreshSlicesButton.click();
  await coverageDiagnostics
    .getByText('切片已读取', { exact: true })
    .waitFor({ timeout: 10000 });
  const backupPreActionReceipt = page.locator('[aria-label="备份操作前回执"]');
  await backupPreActionReceipt
    .getByText('备份操作前回执', { exact: true })
    .waitFor({ timeout: 10000 });
  await backupPreActionReceipt
    .getByText('只会向当前 Memory Service 请求 backup zip 并保存到本机')
    .waitFor({ timeout: 10000 });
  await backupPreActionReceipt
    .getByText('不会恢复、删除、替换、同步或外发任何记忆')
    .waitFor({ timeout: 10000 });
  await backupPreActionReceipt
    .getByText('先 dry-run，再按 merge/replace 影响预览确认')
    .waitFor({ timeout: 10000 });
  const backupDownloadButton = page.getByRole('button', { name: /记忆备份/ });
  assert.match(
    (await backupDownloadButton.getAttribute('title')) || '',
    /只会向当前 Memory Service 请求 backup zip/,
    'backup download button should expose export-only boundary in title',
  );
  assert.match(
    (await backupDownloadButton.getAttribute('aria-label')) || '',
    /不会恢复、删除、替换、同步或外发任何记忆/,
    'backup download button should expose no-restore boundary to screen readers',
  );
  const timelineReceipt = page.locator('[aria-label="最近覆盖信号回执"]');
  await timelineReceipt.getByText('1 条平台信号').waitFor({ timeout: 10000 });
  await timelineReceipt
    .getByText('所有展示事件都在 7 天新鲜度窗口内')
    .waitFor({ timeout: 10000 });
  const timelineSliceReceipt = timelineReceipt.locator(
    '[aria-label="最近覆盖信号切片说明"]',
  );
  await timelineSliceReceipt
    .getByText('可见切片', { exact: true })
    .waitFor({ timeout: 10000 });
  await timelineSliceReceipt
    .getByText('当前显示 1 条按 lastSeenAt 排序的平台事件')
    .waitFor({ timeout: 10000 });
  await timelineSliceReceipt
    .getByText('Coverage API 最多返回 8 条')
    .waitFor({ timeout: 10000 });
  await timelineSliceReceipt
    .getByText('未达到 8 条上限，但仍只是当前返回的可见切片')
    .waitFor({ timeout: 10000 });
  await timelineSliceReceipt
    .getByText('不能证明', { exact: true })
    .waitFor({ timeout: 10000 });
  await timelineSliceReceipt
    .getByText('权限 / ACL 已校验')
    .waitFor({ timeout: 10000 });
  await timelineReceipt
    .getByText('不会重跑 provider sync、写库、标记已读、修复配置或外发')
    .waitFor({ timeout: 10000 });
  const backupDownloadPendingReceipt = page.locator(
    '[aria-label="备份下载提交中回执"]',
  );
  failNextBackupExport = true;
  backupExportDelayMs = 1000;
  const failedExportClick = backupDownloadButton.click();
  await backupDownloadPendingReceipt
    .getByText('备份下载提交中回执', { exact: true })
    .waitFor({ timeout: 10000 });
  await backupDownloadPendingReceipt
    .getByText('正在请求 backup zip', { exact: true })
    .waitFor({ timeout: 10000 });
  await backupDownloadPendingReceipt
    .getByText('已向当前 Memory Service 发起 POST /export')
    .waitFor({ timeout: 10000 });
  await backupDownloadPendingReceipt
    .getByText('完成前还没有新文件名、大小或 manifest 摘要')
    .waitFor({ timeout: 10000 });
  await backupDownloadPendingReceipt
    .getByText('等待导出期间不会恢复、删除、替换、同步或外发任何记忆')
    .waitFor({ timeout: 10000 });
  await backupDownloadPendingReceipt
    .getByText('恢复仍需从「录入 > 备份 zip」重新 dry-run')
    .waitFor({ timeout: 10000 });
  await failedExportClick;
  const backupDownloadFailureReceipt = page.locator(
    '[aria-label="备份下载失败回执"]',
  );
  await backupDownloadFailureReceipt
    .getByText('备份下载失败回执', { exact: true })
    .waitFor({ timeout: 10000 });
  await backupDownloadFailureReceipt
    .getByText('未保存备份 zip')
    .waitFor({ timeout: 10000 });
  await backupDownloadFailureReceipt
    .getByText('本次没有生成或保存 Personal AI backup zip')
    .waitFor({ timeout: 10000 });
  await backupDownloadFailureReceipt
    .getByText('没有恢复、删除、同步或外发任何记忆')
    .waitFor({ timeout: 10000 });
  await backupDownloadFailureReceipt
    .getByText('fixture backup export failed')
    .waitFor({ timeout: 10000 });
  assert.equal(backupExportFailureCount, 1);
  assert.equal(
    await page.locator('[aria-label="备份下载回执"]').count(),
    0,
    'failed backup export should not show the success download receipt',
  );
  assert.equal(
    await page.locator('[aria-label="备份操作前回执"]').count(),
    0,
    'failed backup export should replace the pre-action receipt with a concrete failure receipt',
  );
  assert.equal(backupExportCount, 0);

  const backupDownloadPromise = page.waitForEvent('download');
  backupExportDelayMs = 1000;
  const successfulExportClick = backupDownloadButton.click();
  await backupDownloadPendingReceipt
    .getByText('下方失败回执仍然只是上一次错误；本次请求还没有返回成功或失败')
    .waitFor({ timeout: 10000 });
  await successfulExportClick;
  const backupDownload = await backupDownloadPromise;
  assert.equal(
    backupDownload.suggestedFilename(),
    backupExportFileName,
    'backup download should use the service-provided backup zip filename',
  );
  const backupDownloadReceipt = page.locator('[aria-label="备份下载回执"]');
  await backupDownloadReceipt
    .getByText('备份下载回执', { exact: true })
    .waitFor({ timeout: 10000 });
  await backupDownloadReceipt
    .getByText(backupExportFileName)
    .waitFor({ timeout: 10000 });
  await backupDownloadReceipt
    .getByText('Personal AI backup zip')
    .waitFor({ timeout: 10000 });
  await backupDownloadReceipt
    .getByText('Manifest 摘要已随响应头返回：12 个清单路径，用户空间 verify-user，指纹 sha256:1234567890ab')
    .waitFor({ timeout: 10000 });
  await backupDownloadReceipt
    .getByText('备份用户', { exact: true })
    .waitFor({ timeout: 10000 });
  await backupDownloadReceipt
    .getByText('verify-user', { exact: true })
    .waitFor({ timeout: 10000 });
  await backupDownloadReceipt
    .getByText('备份清单', { exact: true })
    .waitFor({ timeout: 10000 });
  await backupDownloadReceipt
    .getByText('备份指纹', { exact: true })
    .waitFor({ timeout: 10000 });
  await backupDownloadReceipt
    .getByText('sha256:1234567890ab', { exact: true })
    .waitFor({ timeout: 10000 });
  await backupDownloadReceipt
    .getByText('12 个路径 · format v1')
    .waitFor({ timeout: 10000 });
  await backupDownloadReceipt
    .getByText('A 2 · B 6 · C 4 生成 / 0 失败 / 0 跳过')
    .waitFor({ timeout: 10000 });
  await backupDownloadReceipt
    .getByText('不会自动恢复、删除、同步或外发')
    .waitFor({ timeout: 10000 });
  await backupDownloadReceipt
    .getByText('恢复必须从「录入 > 备份 zip」重新选择文件并先 dry-run')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('[aria-label="备份下载失败回执"]').count(),
    0,
    'successful backup export should clear the previous failure receipt',
  );
  assert.equal(
    await page.locator('[aria-label="备份操作前回执"]').count(),
    0,
    'successful backup export should keep the concrete download receipt instead of the pre-action receipt',
  );
  assert.equal(backupExportCount, 1);
  assert.match(
    (await backupDownloadButton.getAttribute('title')) || '',
    /只是上一次下载结果/,
    'backup download button should explain a prior success is not the next backup',
  );

  failNextBackupExport = true;
  backupExportDelayMs = 1000;
  const failedExportAfterSuccessClick = backupDownloadButton.click();
  await backupDownloadPendingReceipt
    .getByText(`下方旧下载回执仍然只是 ${backupExportFileName} 的上一次结果`)
    .waitFor({ timeout: 10000 });
  await backupDownloadPendingReceipt
    .getByText('不代表本次已经保存新 zip')
    .waitFor({ timeout: 10000 });
  await failedExportAfterSuccessClick;
  await backupDownloadFailureReceipt
    .getByText('备份下载失败回执', { exact: true })
    .waitFor({ timeout: 10000 });
  await backupDownloadFailureReceipt
    .getByText('本次没有生成或保存 Personal AI backup zip')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('[aria-label="备份下载回执"]').count(),
    0,
    'failed backup export after a previous success should clear the stale success receipt',
  );
  assert.equal(backupExportFailureCount, 2);
  assert.equal(backupExportCount, 1);
  await page.getByText('需主动处理的修复项').waitFor({ timeout: 10000 });
  const activeSection = page.locator('.platform-section', {
    has: page.locator('h2', { hasText: '已激活平台' }),
  });
  await activeSection
    .locator('.platform-card')
    .first()
    .getByText('网页记忆')
    .waitFor({ timeout: 10000 });
  const lowScoreSortButton = page.getByRole('button', { name: /低分优先/ });
  await expectControlBoundary(lowScoreSortButton, [
    '低分优先',
    '当前前端快照',
    'qualityScore',
    '不参与低分故障排序',
    '不会重扫 Coverage API',
  ]);
  await lowScoreSortButton.click();
  await activeSection
    .locator('.platform-card')
    .first()
    .getByText('RingCentral')
    .waitFor({ timeout: 10000 });
  const lowScoreSortReceipt = page.locator('[aria-label="质量分排序回执"]');
  await lowScoreSortReceipt.getByText('质量分排序回执').waitFor({
    timeout: 10000,
  });
  await lowScoreSortReceipt.getByText('排序范围').waitFor({ timeout: 10000 });
  await lowScoreSortReceipt
    .getByText('2 个已激活 / 派生平台在各自分组内按质量分升序排列')
    .waitFor({ timeout: 10000 });
  await lowScoreSortReceipt
    .getByText('0 个未启用通道 / 系统入口保持原分组口径')
    .waitFor({ timeout: 10000 });
  await lowScoreSortReceipt
    .getByText('info 规划项不算当前覆盖故障')
    .waitFor({ timeout: 10000 });
  await lowScoreSortReceipt
    .getByText('不判断内容事实正确性或是否足够进入回复/画像')
    .waitFor({ timeout: 10000 });
  await lowScoreSortReceipt
    .getByText('不重扫 Coverage API、不重跑 provider sync、不写库、不标记已读，也不外发')
    .waitFor({ timeout: 10000 });
  const defaultSortButton = page.getByRole('button', { name: /默认排序/ });
  await expectControlBoundary(defaultSortButton, [
    '默认排序',
    '恢复为 Coverage API 返回顺序',
    '不会重扫 Coverage API',
    '重算质量分',
  ]);
  await defaultSortButton.click();
  await page.waitForFunction(
    () => !document.querySelector('[aria-label="质量分排序回执"]'),
    null,
    { timeout: 10000 },
  );
  const qualityFocus = page.locator('[aria-label="质量分焦点"]');
  await qualityFocus.getByText('优先处理').waitFor({ timeout: 10000 });
  await qualityFocus.getByText('RingCentral · 58/100').waitFor({
    timeout: 10000,
  });
  await qualityFocus
    .locator('p')
    .getByText('日历事件 · 失败')
    .waitFor({ timeout: 10000 });
  const qualityFocusReceipt = qualityFocus.locator('[aria-label="质量分焦点回执"]');
  await qualityFocusReceipt.getByText('焦点来源').waitFor({ timeout: 10000 });
  await qualityFocusReceipt.getByText('服务端 priorityFocus').waitFor({
    timeout: 10000,
  });
  await qualityFocusReceipt.getByText('诊断依据').waitFor({ timeout: 10000 });
  await qualityFocusReceipt.getByText('source calendar_events.synced_at').waitFor({
    timeout: 10000,
  });
  await qualityFocusReceipt.getByText('筛选路线').waitFor({ timeout: 10000 });
  await qualityFocusReceipt
    .getByText(/本轮比较 1 个候选，排除 2 个 info 规划项/)
    .waitFor({ timeout: 10000 });
  await qualityFocusReceipt
    .getByText('不会重跑同步、改配置、写入记忆、标记已读或外发')
    .waitFor({ timeout: 10000 });
  const qualityFocusButton = qualityFocus.getByRole('button', {
    name: /查看平台/,
  });
  await expectControlBoundary(qualityFocusButton, [
    '查看平台',
    'RingCentral',
    '服务端 priorityFocus',
    '刷新诊断切片',
    '不会重扫 Coverage API',
  ]);
  await qualityFocusButton.click();
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
  await scorePanel.getByText('近 7 天信号占比 25%：+2 分').waitFor({
    timeout: 10000,
  });
  await scorePanel.getByText('存在失败贡献项：-10 分').waitFor({
    timeout: 10000,
  });
  const scoreSnapshotReceipt = scorePanel.locator('[aria-label="质量分快照口径"]');
  await scoreSnapshotReceipt.getByText('质量分快照口径').waitFor({
    timeout: 10000,
  });
  await scoreSnapshotReceipt.getByText('当前 Coverage 快照').waitFor({
    timeout: 10000,
  });
  await scoreSnapshotReceipt
    .getByText('近 7 天信号占比 25%')
    .waitFor({ timeout: 10000 });
  await scoreSnapshotReceipt
    .getByText('切换平台、排序或查看修复路线只读当前快照')
    .waitFor({ timeout: 10000 });
  await scoreSnapshotReceipt
    .getByText('新的 /coverage/map 响应后')
    .waitFor({ timeout: 10000 });
  const scoreBoundary = scorePanel.locator('[aria-label="质量分边界"]');
  await scoreBoundary.getByText('衡量范围').waitFor({ timeout: 10000 });
  await scoreBoundary
    .getByText('只看 部分 状态、贡献项健康、新鲜度和失败/积压惩罚')
    .waitFor({ timeout: 10000 });
  await scoreBoundary
    .getByText('未启用的可选通道不会混进当前平台低分。')
    .waitFor({ timeout: 10000 });
  await scoreBoundary
    .getByText('不判断内容事实是否正确、是否足够完整')
    .waitFor({ timeout: 10000 });
  await scoreBoundary
    .getByText('修复仍需要用户检查来源或执行显式录入/同步动作。')
    .waitFor({ timeout: 10000 });
  const scoreRouteReceipt = scorePanel.locator('[aria-label="质量分修复路线"]');
  await scoreRouteReceipt.getByText('质量分修复路线').waitFor({
    timeout: 10000,
  });
  await scoreRouteReceipt.getByText('筛选路线').waitFor({ timeout: 10000 });
  await scoreRouteReceipt
    .getByText('critical / warning 修复项')
    .waitFor({ timeout: 10000 });
  await scoreRouteReceipt.getByText('比较范围').waitFor({ timeout: 10000 });
  await scoreRouteReceipt
    .getByText('本轮比较 1 个候选平台，排除 2 个 info 规划项')
    .waitFor({ timeout: 10000 });
  await scoreRouteReceipt
    .getByText('未启用可选通道不会被当成当前故障')
    .waitFor({ timeout: 10000 });
  await scoreRouteReceipt.getByText('路线边界').waitFor({ timeout: 10000 });
  await scoreRouteReceipt
    .getByText('查看平台不会重跑同步、改配置、写入记忆、标记已读或外发')
    .waitFor({ timeout: 10000 });
  await scorePanel.getByText('优先处理', { exact: true }).waitFor({ timeout: 10000 });
  const scorePriorityHint = scorePanel.locator('.score-priority-hint');
  await scorePriorityHint.getByText('日历事件 · 失败').waitFor({
    timeout: 10000,
  });
  await scorePriorityHint
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
      hasText: '当前平台没有修复项，但全局仍有需处理的覆盖缺口。',
    })
    .waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: '查看全部修复项' }).click();
  await page
    .locator('.repair-panel', {
      hasText: '全部 1 个需处理缺口；不会自动改同步设置。',
    })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.repair-panel .repair-platform', { hasText: 'RingCentral' })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.repair-panel', { hasText: '检查 RingCentral 日历同步' })
    .waitFor({ timeout: 10000 });

  const refreshCoverageButton = page.getByRole('button', { name: /重扫覆盖/ });
  await expectControlBoundary(refreshCoverageButton, [
    '重扫覆盖',
    '只重新读取 /coverage/map',
    '成功后才替换平台卡片',
    '质量分焦点',
    '不会重跑 provider sync',
  ]);

  failNextCoverageRefresh = true;
  await refreshCoverageButton.click();
  await page
    .locator('.status-box.error')
    .getByText('fixture coverage refresh failed')
    .waitFor({
      timeout: 10000,
    });
  await snapshotReceipt
    .getByText('显示上次成功快照')
    .waitFor({ timeout: 10000 });
  await snapshotReceipt
    .getByText('当前仍显示服务端', { exact: false })
    .waitFor({ timeout: 10000 });
  await snapshotReceipt
    .getByText('不会用失败结果覆盖平台卡片')
    .waitFor({ timeout: 10000 });
  await manualRefreshReceipt
    .getByText('重扫失败，旧快照仍保留')
    .waitFor({ timeout: 10000 });
  await manualRefreshReceipt
    .getByText('失败结果不会覆盖平台卡片')
    .waitFor({ timeout: 10000 });
  await manualRefreshReceipt
    .getByText('没有重跑 provider sync')
    .waitFor({ timeout: 10000 });
  await ringCentralCard.getByText('58/100').waitFor({ timeout: 10000 });

  coverageFixtureMode = 'info-only';
  await refreshCoverageButton.click();
  await snapshotReceipt.getByText('当前快照可用').waitFor({ timeout: 10000 });
  await manualRefreshReceipt
    .getByText('重扫完成，平台卡片已更新')
    .waitFor({ timeout: 10000 });
  await manualRefreshReceipt
    .getByText('本次 Coverage API 响应已经替换平台卡片')
    .waitFor({ timeout: 10000 });
  await manualRefreshReceipt
    .getByText('28 messages · 12 chunks · 4 entities')
    .waitFor({ timeout: 10000 });
  await manualRefreshReceipt
    .getByText('覆盖缺口 0 个')
    .waitFor({ timeout: 10000 });
  await page
    .locator('.summary-card.gap', {
      hasText: '覆盖缺口',
    })
    .getByText('0')
    .waitFor({ timeout: 10000 });
  await page.locator('.repair-scope-controls').getByRole('button', { name: /当前平台/ }).click();
  await page
    .locator('.repair-panel .empty-state', {
      hasText: '当前平台没有修复项；全局只有可选规划项，不算当前覆盖故障。',
    })
    .waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: '查看全部规划项' }).click();
  await page
    .locator('.repair-panel', {
      hasText: '当前只有 1 个可选规划项；不算覆盖缺口，也不会自动改同步设置。',
    })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.repair-panel', { hasText: '按需启用 Codex 技能同步' })
    .waitFor({ timeout: 10000 });

  coverageFixtureMode = 'capped-timeline';
  await refreshCoverageButton.click();
  await timelineReceipt
    .getByText('8 条平台信号')
    .waitFor({ timeout: 10000 });
  await timelineSliceReceipt
    .getByText('当前显示 8 条按 lastSeenAt 排序的平台事件')
    .waitFor({ timeout: 10000 });
  await timelineSliceReceipt
    .getByText('已达到 8 条上限，后面可能还有更早的平台事件未显示')
    .waitFor({ timeout: 10000 });
  await timelineSliceReceipt
    .getByText('这不是完整同步日志')
    .waitFor({ timeout: 10000 });

  coverageFixtureMode = 'no-timeline';
  await refreshCoverageButton.click();
  await timelineReceipt
    .getByText('没有可显示的 lastSeenAt')
    .waitFor({ timeout: 10000 });
  await timelineReceipt
    .getByText('当前快照没有可排序事件，不代表来源全部健康或全部失联')
    .waitFor({ timeout: 10000 });
  await timelineReceipt
    .getByText('下方回执说明空切片边界')
    .waitFor({ timeout: 10000 });
  await timelineSliceReceipt
    .getByText('当前显示 0 条按 lastSeenAt 排序的平台事件')
    .waitFor({ timeout: 10000 });
  await timelineSliceReceipt
    .getByText('没有事件可与 7 天窗口比较')
    .waitFor({ timeout: 10000 });
  const timelineEmptyState = page.locator('[aria-label="最近覆盖信号空态"]');
  await timelineEmptyState
    .getByText('暂无可排序的最近信号')
    .waitFor({ timeout: 10000 });
  await timelineEmptyState
    .getByText('不能据此判断所有来源健康')
    .waitFor({ timeout: 10000 });

  coverageFixtureMode = 'stale-snapshot';
  await refreshCoverageButton.click();
  await snapshotReceipt
    .getByText('覆盖快照已过期')
    .waitFor({ timeout: 10000 });
  await snapshotReceipt
    .getByText('快照年龄约 9 天')
    .waitFor({ timeout: 10000 });
  await snapshotReceipt
    .getByText('质量分和平台卡片仍来自旧快照')
    .waitFor({ timeout: 10000 });
  await snapshotReceipt
    .getByText('先点击重扫覆盖确认当前状态')
    .waitFor({ timeout: 10000 });
  await timelineSliceReceipt
    .getByText('新鲜度按服务端快照 generatedAt 和 7 天窗口判断')
    .waitFor({ timeout: 10000 });

  await page.getByRole('button', { name: '录入' }).click();
  const primaryImportButton = page.locator('.drawer-footer .btn.primary');
  const smartImportScopeReceipt = page.locator('[aria-label="智能录入范围回执"]');
  await smartImportScopeReceipt
    .getByText('智能录入范围回执', { exact: true })
    .waitFor({ timeout: 10000 });
  assert.match(
    (await primaryImportButton.getAttribute('title')) || '',
    /查看 dry-run：只读取当前粘贴文本/,
    'smart import primary button should expose inspect boundary before dry-run',
  );
  assert.match(
    (await primaryImportButton.getAttribute('aria-label')) || '',
    /不会创建 import batch、messages、chunks/,
    'smart import primary button should expose no-write inspect boundary to screen readers',
  );
  await smartImportScopeReceipt
    .getByText('尚未 dry-run')
    .waitFor({ timeout: 10000 });
  await smartImportScopeReceipt
    .getByText('不会创建 import batch、messages、chunks')
    .waitFor({ timeout: 10000 });
  await smartImportScopeReceipt
    .getByText('只有 dry-run ready 且你点击「提交录入」后，才写入 manual shadow memory')
    .waitFor({ timeout: 10000 });
  await page.locator('textarea.paste-box').fill('api_key=secret token=abc');
  await primaryImportButton.click();
  await page.getByText('预检提醒').waitFor({ timeout: 10000 });
  await page.getByText('发现 2 个高风险词').waitFor({ timeout: 10000 });
  await smartImportScopeReceipt
    .getByText('当前 dry-run 状态是 ready')
    .waitFor({ timeout: 10000 });
  const submitImport = primaryImportButton;
  assert.match(
    (await submitImport.getAttribute('title')) || '',
    /必须先勾选确认/,
    'high-risk smart import submit button should explain why it is disabled',
  );
  assert.equal(
    await submitImport.isDisabled(),
    true,
    'high-risk smart import should require explicit confirmation',
  );
  await page.getByLabel('确认仍以低权重 shadow memory 导入').check();
  assert.equal(await submitImport.isDisabled(), false);
  assert.match(
    (await submitImport.getAttribute('aria-label')) || '',
    /写入 work manual shadow memory/,
    'confirmed smart import submit button should expose target write scope',
  );
  smartImportCommitDelayMs = 1000;
  await submitImport.click();
  const smartImportPendingReceipt = page.locator(
    '[aria-label="资料写入提交中回执"]',
  );
  await smartImportPendingReceipt
    .getByText('资料写入提交中回执', { exact: true })
    .waitFor({ timeout: 10000 });
  await smartImportPendingReceipt
    .getByText('已提交 1 个粘贴来源、约 1 个 chunks 到 work 范围')
    .waitFor({ timeout: 10000 });
  await smartImportPendingReceipt
    .getByText('提交中不代表已经写入成功')
    .waitFor({ timeout: 10000 });
  await smartImportPendingReceipt
    .getByText('本次包含 2 个高风险词，提交请求已带上用户确认')
    .waitFor({ timeout: 10000 });
  await smartImportPendingReceipt
    .getByText('不会自动同步外部平台、覆盖旧 batch、确认画像/skill/项目事实、发送消息或外发导入内容')
    .waitFor({ timeout: 10000 });
  const pasteBox = page.locator('textarea.paste-box');
  const scopeSelect = page.locator('.scope-row select');
  const documentSourceChip = page.locator('.source-chip', { hasText: '文档' });
  const chooseFileButton = page.locator('.compact-dropzone .button-row .btn').first();
  assert.equal(
    await pasteBox.isDisabled(),
    true,
    'paste text should be locked while smart import commit is pending',
  );
  assert.match(
    (await pasteBox.getAttribute('title')) || '',
    /当前录入请求处理中/,
    'paste box should explain the in-flight input lock',
  );
  assert.equal(
    await scopeSelect.isDisabled(),
    true,
    'scope selector should be locked while smart import commit is pending',
  );
  assert.match(
    (await scopeSelect.getAttribute('aria-label')) || '',
    /本次请求仍使用点击时的 work 范围/,
    'scope selector should expose the committed scope boundary',
  );
  assert.equal(
    await documentSourceChip.isDisabled(),
    true,
    'source switching should be locked while smart import commit is pending',
  );
  assert.match(
    (await documentSourceChip.getAttribute('title')) || '',
    /完成前不能切换来源/,
    'source chip should expose the source-switch lock boundary',
  );
  assert.equal(
    await chooseFileButton.isDisabled(),
    true,
    'file picker should be locked while smart import commit is pending',
  );
  assert.match(
    (await chooseFileButton.getAttribute('aria-label')) || '',
    /完成前不能选择新文件/,
    'file picker should expose the file-selection lock boundary',
  );
  assert.match(
    (await submitImport.getAttribute('aria-label')) || '',
    /正在提交 1 个粘贴来源/,
    'busy smart import button should expose in-flight commit boundary',
  );
  await page
    .locator('.import-status', {
      hasText: '录入完成：1 条记忆，1 个 chunks。',
    })
    .waitFor({ timeout: 10000 });
  const smartImportReceipt = page.locator('.smart-import-receipt');
  await smartImportReceipt
    .getByText('录入完成回执', { exact: true })
    .waitFor({ timeout: 10000 });
  await smartImportReceipt
    .getByText('1 条记忆 / 1 个 chunks；跳过 0 个条目。')
    .waitFor({ timeout: 10000 });
  await smartImportReceipt
    .getByText('work · manual shadow memory · low salience / temporary consolidation')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await pasteBox.isDisabled(),
    false,
    'paste text should unlock after smart import commit finishes',
  );
  await smartImportReceipt
    .getByText('source import:fixture-batch')
    .waitFor({ timeout: 10000 });
  await smartImportReceipt
    .getByText('source hash fixture-high')
    .waitFor({ timeout: 10000 });
  await smartImportReceipt
    .getByText('未预检、阻塞或重复内容不会自动补写')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await smartImportScopeReceipt.count(),
    0,
    'completed smart import should replace the pre-action scope receipt',
  );
  assert.equal(
    await smartImportPendingReceipt.count(),
    0,
    'ordinary smart import pending receipt should be replaced by the committed receipt',
  );
  assert.equal(smartImportCommitCount, 1);

  smartImportInspectMode = 'duplicate';
  await page.locator('textarea.paste-box').fill('api_key=secret token=abc');
  await primaryImportButton.click();
  await page
    .locator('.import-status', {
      hasText: '这份资料已经录入过，本次不会重复写入；请查看重复录入回执。',
    })
    .waitFor({ timeout: 10000 });
  const duplicateImportReceipt = page.locator('[aria-label="重复录入回执"]');
  await duplicateImportReceipt
    .getByText('重复录入回执', { exact: true })
    .waitFor({ timeout: 10000 });
  await duplicateImportReceipt
    .getByText('source hash fixture-high 已匹配既有 batch fixture-batch')
    .waitFor({ timeout: 10000 });
  await duplicateImportReceipt
    .getByText('本次 dry-run 未新增 messages 或 chunks')
    .waitFor({ timeout: 10000 });
  await duplicateImportReceipt
    .getByText('不会覆盖、删除、降权或重新同步已录入内容')
    .waitFor({ timeout: 10000 });
  await duplicateImportReceipt
    .getByText('source import:fixture-batch')
    .waitFor({ timeout: 10000 });
  await duplicateImportReceipt
    .getByText('重复命中不会改变既有记录的范围、权重或审计路径')
    .waitFor({ timeout: 10000 });
  const duplicateImportButton = primaryImportButton;
  assert.equal(
    await duplicateImportButton.isDisabled(),
    true,
    'duplicate smart import should remain read-only after dry-run receipt',
  );
  assert.match(
    (await duplicateImportButton.getAttribute('title')) || '',
    /本次不会提交、覆盖、删除、降权、重新同步或写回外部平台/,
    'duplicate smart import primary button should expose duplicate no-write boundary',
  );
  assert.equal(
    smartImportCommitCount,
    1,
    'duplicate dry-run receipt should not call commit',
  );

  smartImportInspectMode = 'ordinary';
  const backupZipModeButton = page.locator('.source-toggle .source-chip', {
    hasText: '备份 zip',
  });
  assert.match(
    (await backupZipModeButton.getAttribute('title')) || '',
    /切换到备份恢复文件选择/,
    'backup zip mode button should expose restore-file-selection boundary before click',
  );
  assert.match(
    (await backupZipModeButton.getAttribute('aria-label')) || '',
    /不会直接恢复或写入/,
    'backup zip mode button should expose no-write boundary to screen readers',
  );
  assert.equal(
    await backupZipModeButton.isDisabled(),
    false,
    'backup zip mode button should be available after duplicate dry-run finishes',
  );
  const [ordinaryChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    backupZipModeButton.click(),
  ]);
  await ordinaryChooser.setFiles(ordinaryArchivePath);
  await page
    .locator('.import-status', {
      hasText:
        '未检测到 Personal AI 备份 manifest，已按普通资料预检。dry-run 完成：2 个文件可录入，约 3 个 chunks。',
    })
    .waitFor({ timeout: 10000 });
  await page.getByText('资料预检回执').waitFor({ timeout: 10000 });
  await page
    .locator('.scope-row', { hasText: '写入范围' })
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('[aria-label="备份恢复目标回执"]').count(),
    0,
    'ordinary zip selected from backup mode should not keep the backup restore target receipt',
  );
  await page
    .getByText(
      '普通 zip 里预检 5/10 个文件；2 个可录入，2 个阻塞，5 个未预检，约 3 个 chunks。',
    )
    .waitFor({ timeout: 10000 });
  const documentImportRecoveryReceipt = page.locator(
    '[aria-label="资料录入恢复回执"]',
  );
  await documentImportRecoveryReceipt
    .getByText('资料录入恢复回执', { exact: true })
    .waitFor({ timeout: 10000 });
  await documentImportRecoveryReceipt
    .getByText('现在提交只会写入 dry-run 标记为 ready 的 2 个条目')
    .waitFor({ timeout: 10000 });
  await documentImportRecoveryReceipt
    .getByText('2 个阻塞/不支持条目、5 个 zip 内未预检文件不会在本次提交里写入')
    .waitFor({ timeout: 10000 });
  await documentImportRecoveryReceipt
    .getByText('请把大型 zip 拆成更小的归档或只保留目标文件后重新 dry-run')
    .waitFor({ timeout: 10000 });
  await documentImportRecoveryReceipt
    .getByText('不会覆盖旧 batch、自动同步外部平台、确认画像/skill/项目事实或外发导入内容')
    .waitFor({ timeout: 10000 });
  await page.getByText('阻塞文件', { exact: true }).waitFor({ timeout: 10000 });
  await page.getByText('未预检', { exact: true }).waitFor({ timeout: 10000 });
  await page.getByText('Unsupported file type: .png').waitFor({ timeout: 10000 });
  await page
    .getByText('Only inspected the first 5 entries in this fixture.')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('.backup-restore-box').count(),
    0,
    'ordinary zip selected from backup mode should not show restore controls',
  );
  await primaryImportButton.waitFor({ timeout: 10000 });
  assert.match(
    (await primaryImportButton.getAttribute('aria-label')) || '',
    /会把 2 个资料条目、约 3 个 chunks 写入 work manual shadow memory/,
    'ordinary archive submit button should expose inspected write slice',
  );

  smartImportInspectMode = 'external-ai';
  const externalAiModeButton = page.locator('.source-toggle .source-chip', {
    hasText: '外部 AI',
  });
  const [externalAiChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    externalAiModeButton.click(),
  ]);
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
  await page.getByText('跳过非文本').waitFor({ timeout: 10000 });
  await page.getByText('忽略文件').waitFor({ timeout: 10000 });
  await page
    .locator('.analysis-summary strong', { hasText: '3' })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.analysis-summary strong', { hasText: '4' })
    .waitFor({ timeout: 10000 });
  await page.getByText('外部 AI 导入范围').waitFor({ timeout: 10000 });
  await page
    .getByText('读取 exports/conversations.json；2 个会话，纳入 85/90 条消息')
    .waitFor({ timeout: 10000 });
  await page.getByText('1 个长会话超过上限，后续 5 条消息不会写入。').waitFor({
    timeout: 10000,
  });
  await page.getByText('跳过 3 个非文本附件或消息部件。').waitFor({
    timeout: 10000,
  });
  await page.getByText('忽略 4 个非 conversations.json 归档文件。').waitFor({
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
      'Conversation "Project context" skipped 3 non-text message parts or attachments.',
    )
    .waitFor({ timeout: 10000 });
  await page
    .getByText(
      'Detected external AI history from exports/conversations.json; ignored 4 other archive files.',
    )
    .waitFor({ timeout: 10000 });
  await page.getByText('Source: chatgpt').first().waitFor({ timeout: 10000 });
  const externalAiDecisionReceipt = page.locator('.external-ai-decision-box');
  await externalAiDecisionReceipt
    .getByText('提交前会发生什么', { exact: true })
    .waitFor({ timeout: 10000 });
  await externalAiDecisionReceipt
    .getByText('2 个会话、85/90 条文本消息会写入 work 范围')
    .waitFor({ timeout: 10000 });
  await externalAiDecisionReceipt
    .getByText('manual shadow memory，低 salience、temporary consolidation')
    .waitFor({ timeout: 10000 });
  await externalAiDecisionReceipt
    .getByText('只读取用户上传 zip 里的 exports/conversations.json')
    .waitFor({ timeout: 10000 });
  await externalAiDecisionReceipt
    .getByText('旧 assistant 回答不等于事实确认')
    .waitFor({ timeout: 10000 });
  await externalAiDecisionReceipt
    .getByText('Ask / Profile / Skill / Project 仍需后续证据门控')
    .waitFor({ timeout: 10000 });
  await externalAiDecisionReceipt
    .getByText('source hash 去重')
    .waitFor({ timeout: 10000 });
  smartImportCommitDelayMs = 1000;
  const externalAiSubmit = primaryImportButton;
  assert.equal(await externalAiSubmit.isDisabled(), false);
  assert.match(
    (await externalAiSubmit.getAttribute('title')) || '',
    /2 个会话、85\/90 条文本消息写入 work manual shadow memory/,
    'external AI submit button should expose conversation and message scope',
  );
  await externalAiSubmit.click();
  const externalAiPendingReceipt = page.locator(
    '[aria-label="外部 AI 写入提交中回执"]',
  );
  await externalAiPendingReceipt
    .getByText('外部 AI 写入提交中回执', { exact: true })
    .waitFor({ timeout: 10000 });
  await externalAiPendingReceipt
    .getByText('2 个会话、85/90 条文本消息到 work 范围')
    .waitFor({ timeout: 10000 });
  await externalAiPendingReceipt
    .getByText('服务端尚未返回写入确认')
    .waitFor({ timeout: 10000 });
  await externalAiPendingReceipt
    .getByText('12 个截断/非文本/非对话归档项仍不会写入')
    .waitFor({ timeout: 10000 });
  await externalAiPendingReceipt
    .getByText('提交中不代表已经写入成功')
    .waitFor({ timeout: 10000 });
  await externalAiPendingReceipt
    .getByText('不会继续抓取 ChatGPT / Claude / Gemini')
    .waitFor({ timeout: 10000 });
  await externalAiPendingReceipt
    .getByText('旧 assistant 回答不会在服务端确认后直接变成事实')
    .waitFor({ timeout: 10000 });
  await externalAiPendingReceipt
    .getByText('不会直接升级为 confirmed 画像、skill、项目事实')
    .waitFor({ timeout: 10000 });
  await page
    .locator('.import-status', {
      hasText: '外部 AI 历史录入完成：85 条记忆，5 个 chunks。',
    })
    .waitFor({ timeout: 10000 });
  const externalAiCompleteReceipt = page.locator('[aria-label="录入完成回执"]');
  await externalAiCompleteReceipt
    .getByText('录入完成回执 · 外部 AI 历史')
    .waitFor({ timeout: 10000 });
  await externalAiCompleteReceipt
    .getByText('85 条记忆 / 5 个 chunks；跳过 12 个条目。')
    .waitFor({ timeout: 10000 });
  await externalAiCompleteReceipt
    .getByText('只读取用户上传归档里的 exports/conversations.json')
    .waitFor({ timeout: 10000 });
  await externalAiCompleteReceipt
    .getByText('用户原话和旧 assistant 回答仍只是可追溯对话证据')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await externalAiPendingReceipt.count(),
    0,
    'external AI pending receipt should be replaced by the committed receipt',
  );
  assert.equal(smartImportCommitCount, 2);

  smartImportInspectMode = 'backup';
  assert.match(
    (await backupZipModeButton.getAttribute('title')) || '',
    /切换到备份恢复文件选择|打开文件选择器/,
    'backup zip mode button should keep a file-picker boundary after other import modes',
  );
  const [backupChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    backupZipModeButton.click(),
  ]);
  await backupChooser.setFiles(backupArchivePath);
  await page.getByText('检测到 Personal AI 备份 zip').waitFor({ timeout: 10000 });
  assert.match(
    (await backupZipModeButton.getAttribute('title')) || '',
    /已识别 personal-ai-memory\.zip 为 Personal AI 备份/,
    'backup zip mode button should expose recognized backup boundary after selection',
  );
  assert.match(
    (await backupZipModeButton.getAttribute('aria-label')) || '',
    /选择后仍先做 schema 识别和 restore dry-run/,
    'backup zip mode button should expose dry-run-before-write boundary after selection',
  );
  assert.equal(
    await page.locator('.scope-row', { hasText: '写入范围' }).count(),
    0,
    'backup restore mode should not expose the ordinary import work/personal scope selector',
  );
  const backupRestoreTargetReceipt = page.locator(
    '[aria-label="备份恢复目标回执"]',
  );
  await backupRestoreTargetReceipt
    .getByText('备份恢复目标回执', { exact: true })
    .waitFor({ timeout: 10000 });
  await backupRestoreTargetReceipt
    .getByText('不会使用普通资料导入的 work/personal 范围')
    .waitFor({ timeout: 10000 });
  await backupRestoreTargetReceipt
    .getByText('当前选择 merge；真正写入前仍需要 dry-run 影响预览')
    .waitFor({ timeout: 10000 });
  const backupRestorePreviewGate = page.locator(
    '[aria-label="备份恢复预览门禁"]',
  );
  await backupRestorePreviewGate
    .getByText('备份恢复预览门禁', { exact: true })
    .waitFor({ timeout: 10000 });
  await backupRestorePreviewGate
    .getByText('personal-ai-memory.zip 已被识别为 Personal AI backup schema')
    .waitFor({ timeout: 10000 });
  await backupRestorePreviewGate
    .getByText('当前还没有恢复 dry-run 影响预览')
    .waitFor({ timeout: 10000 });
  await backupRestorePreviewGate
    .getByText('点击「继续恢复」只会按 merge 请求 restore dry-run')
    .waitFor({ timeout: 10000 });
  await backupRestorePreviewGate
    .getByText('读取 manifest、archive 指纹、DB 行数和文件影响')
    .waitFor({ timeout: 10000 });
  await backupRestorePreviewGate
    .getByText('不会写入 Memory Service')
    .waitFor({ timeout: 10000 });
  await backupRestorePreviewGate
    .getByText('不会恢复、删除、替换、同步外部平台')
    .waitFor({ timeout: 10000 });
  await page.getByLabel('覆盖替换现有记忆').check();
  await backupRestoreTargetReceipt
    .getByText('当前选择 replace；真正写入前仍需要 dry-run 影响预览和 replace 确认')
    .waitFor({ timeout: 10000 });
  await backupRestorePreviewGate
    .getByText('点击「继续恢复」只会按 replace 请求 restore dry-run')
    .waitFor({ timeout: 10000 });
  await backupRestorePreviewGate
    .getByText('replace 只是当前预览模式')
    .waitFor({ timeout: 10000 });
  await primaryImportButton.click();
  assert.equal(
    unexpectedDialogMessage,
    '',
    `replace preview should not use a browser dialog: ${unexpectedDialogMessage}`,
  );
  await page.getByText('replace：替换当前记忆').waitFor({ timeout: 10000 });
  assert.equal(
    await backupRestorePreviewGate.count(),
    0,
    'backup restore dry-run gate should disappear after preview is loaded',
  );
  await page.getByText('备份用户').waitFor({ timeout: 10000 });
  await page
    .locator('.preview-box')
    .getByText('backup-user', { exact: true })
    .waitFor({ timeout: 10000 });
  await page.getByText('备份指纹').waitFor({ timeout: 10000 });
  await page
    .locator('.preview-box')
    .getByText('sha256:1234567890ab', { exact: true })
    .waitFor({ timeout: 10000 });
  await backupRestoreTargetReceipt
    .getByText('恢复目标是当前 Memory Service 用户空间 verify-user')
    .waitFor({ timeout: 10000 });
  await backupRestoreTargetReceipt
    .getByText('不是普通资料导入的 work/personal 范围')
    .waitFor({ timeout: 10000 });
  await page.getByText('DB 行数').waitFor({ timeout: 10000 });
  await page.getByText('42 行').waitFor({ timeout: 10000 });
  await page.getByText('影响路径预览').waitFor({ timeout: 10000 });
  await page.getByText('projects/project-alpha.md').waitFor({ timeout: 10000 });
  await page.getByText('USER_CORE.md').waitFor({ timeout: 10000 });
  await page
    .getByText('Backup was exported for user backup-user; import target is verify-user.')
    .waitFor({ timeout: 10000 });
  await page.getByText('当前恢复目标是 verify-user').waitFor({ timeout: 10000 });
  const replaceConfirmBox = page.locator('[aria-label="replace 写入确认"]');
  await replaceConfirmBox.getByText('replace 写入确认', { exact: true }).waitFor({
    timeout: 10000,
  });
  await replaceConfirmBox
    .getByText('真正恢复会用备份内容替换当前记忆数据库')
    .waitFor({ timeout: 10000 });
  assert.equal(backupPreviewCount, 1);

  const confirmRestore = primaryImportButton;
  assert.match(
    (await confirmRestore.getAttribute('title')) || '',
    /按已复核的 replace 预览请求备份恢复写入/,
    'backup restore primary button should expose write boundary after preview',
  );
  assert.equal(
    await confirmRestore.isDisabled(),
    true,
    'backup restore with warnings or overwritten paths should require impact review confirmation',
  );
  await page.getByLabel('已复核恢复影响路径、恢复模式和提醒').check();
  assert.equal(
    await confirmRestore.isDisabled(),
    true,
    'replace restore should still require the explicit replace confirmation after impact review',
  );
  await page.getByLabel('确认按 replace 替换当前记忆数据库').check();
  assert.equal(await confirmRestore.isDisabled(), false);
  failNextBackupImport = true;
  await confirmRestore.click();
  assert.equal(
    unexpectedDialogMessage,
    '',
    `failed replace commit should not use a browser dialog: ${unexpectedDialogMessage}`,
  );
  const restoreFailureReceipt = page.locator('[aria-label="恢复失败回执"]');
  await restoreFailureReceipt
    .getByText('恢复未写入', { exact: true })
    .waitFor({ timeout: 10000 });
  await restoreFailureReceipt
    .getByText('按 replace 写入时失败，服务端没有返回确认写入回执')
    .waitFor({ timeout: 10000 });
  await restoreFailureReceipt
    .getByText('当前 Memory Service 数据仍是权威状态')
    .waitFor({ timeout: 10000 });
  await restoreFailureReceipt
    .getByText('保留本次 dry-run 预览：12 个备份条目')
    .waitFor({ timeout: 10000 });
  await restoreFailureReceipt
    .getByText('指纹 sha256:1234567890ab')
    .waitFor({ timeout: 10000 });
  await restoreFailureReceipt
    .getByText('fixture restore write failed')
    .waitFor({ timeout: 10000 });
  await restoreFailureReceipt
    .getByText('再次点击前不会自动切换 merge/replace、删除文件或同步外部平台')
    .waitFor({ timeout: 10000 });
  assert.equal(backupImportFailureCount, 1);
  assert.equal(
    await confirmRestore.isDisabled(),
    false,
    'backup restore should remain retryable after a failed write receipt',
  );

  failNextCoverageRefresh = true;
  await confirmRestore.click();
  assert.equal(
    unexpectedDialogMessage,
    '',
    `retry replace commit should not use a browser dialog: ${unexpectedDialogMessage}`,
  );
  await page.getByText('恢复已写入').waitFor({ timeout: 10000 });
  await page.getByText('备份快照').waitFor({ timeout: 10000 });
  await page.getByText('backup-user -> verify-user · sha256:1234567890ab').waitFor({
    timeout: 10000,
  });
  await page.getByText('replaced · 42 行').waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('[aria-label="恢复失败回执"]').count(),
    0,
    'successful retry should clear the previous failed-write receipt',
  );
  const restoreNextStepReceipt = page.locator('[aria-label="恢复后续回执"]');
  await restoreNextStepReceipt
    .getByText('恢复后续回执', { exact: true })
    .waitFor({ timeout: 10000 });
  await restoreNextStepReceipt
    .getByText('已按 replace 写入 Layer A/B')
    .waitFor({ timeout: 10000 });
  await restoreNextStepReceipt
    .getByText('本次写入备份指纹 sha256:1234567890ab')
    .waitFor({ timeout: 10000 });
  await restoreNextStepReceipt
    .getByText('恢复写入已确认，但自动刷新 Coverage Map 失败')
    .waitFor({ timeout: 10000 });
  await restoreNextStepReceipt
    .getByText('当前主视图可能仍是旧快照')
    .waitFor({ timeout: 10000 });
  await restoreNextStepReceipt
    .getByText('fixture coverage refresh failed')
    .waitFor({ timeout: 10000 });
  await restoreNextStepReceipt
    .getByText('再次恢复需要重新选择备份 zip 并重新 dry-run')
    .waitFor({ timeout: 10000 });
  await restoreNextStepReceipt
    .getByText('不会自动同步到外部平台、启用未配置通道或替用户发送内容')
    .waitFor({ timeout: 10000 });
  await snapshotReceipt
    .getByText('显示上次成功快照')
    .waitFor({ timeout: 10000 });
  await primaryImportButton.waitFor({ timeout: 10000 });
  assert.match(
    (await primaryImportButton.getAttribute('title')) || '',
    /本次备份恢复已完成，按钮保持禁用/,
    'completed restore primary button should expose disabled repeat boundary',
  );
  assert.equal(backupImportCount, 1);

  console.log('verify-memory-coverage-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
  await fs.rm(fixtureDir, { recursive: true, force: true });
}
