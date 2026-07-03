import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';
import { now } from '../utils/time.js';

const TABLES_TO_CLEAR = [
  'skill_platform_bindings',
  'skill_share_links',
  'skill_versions',
  'skill_platform_sync_settings',
  'personal_skills',
  'provider_sync_jobs',
  'calendar_events',
  'notification_records',
  'confirm_requests',
  'proposed_actions',
  'reflection_threads',
  'user_profile_items',
  'memory_import_batches',
  'chunks',
  'messages_raw',
];

function clearCoverageTables(db: BetterSqlite3.Database): void {
  for (const table of TABLES_TO_CLEAR) {
    try {
      db.prepare(`DELETE FROM ${table}`).run();
    } catch {
      // Some optional tables can be absent if a migration was skipped locally.
    }
  }
}

function insertMessage(
  db: BetterSqlite3.Database,
  input: {
    id: string;
    sourceType: string;
    timestamp: number;
    groupId?: string;
    groupName?: string;
  },
): void {
  db.prepare(
    `INSERT INTO messages_raw (
       id, content, source_type, sender, group_id, group_name, timestamp, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    `${input.sourceType} coverage fixture`,
    input.sourceType,
    'coverage-test',
    input.groupId ?? null,
    input.groupName ?? null,
    input.timestamp,
    input.timestamp,
    input.timestamp,
  );
}

function seedCoverageData(db: BetterSqlite3.Database): void {
  clearCoverageTables(db);
  const ts = now();
  const old = ts - 12 * 86400;

  insertMessage(db, { id: 'cov-glip-1', sourceType: 'glip', timestamp: ts });
  insertMessage(db, { id: 'cov-glip-2', sourceType: 'glip', timestamp: old });
  insertMessage(db, {
    id: 'cov-meeting-1',
    sourceType: 'meeting',
    timestamp: ts,
    groupId: 'meeting-a',
    groupName: 'Coverage Review',
  });
  insertMessage(db, {
    id: 'cov-meeting-2',
    sourceType: 'meeting',
    timestamp: ts - 120,
    groupId: 'meeting-a',
    groupName: 'Coverage Review',
  });
  insertMessage(db, { id: 'cov-jira-1', sourceType: 'jira', timestamp: ts });
  insertMessage(db, { id: 'cov-web-1', sourceType: 'web', timestamp: ts });

  db.prepare(
    `INSERT INTO chunks (
       file_path, line_start, line_end, content, content_hash, source_type, related_entity_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run('/coverage.md', 1, 4, 'coverage chunk', 'coverage-hash', 'manual', null, ts, ts);

  db.prepare(
    `INSERT INTO calendar_events (
       id, source_system, external_id, title, start_at, end_at, content_hash, synced_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    'calendar-coverage-1',
    'ringcentral_indexeddb',
    'calendar-external-1',
    'Coverage Sync',
    ts + 86400,
    ts + 90000,
    'calendar-hash',
    ts,
    ts,
    ts,
  );

  db.prepare(
    `INSERT INTO personal_skills (
       id, slug, title, summary, scope, risk, status, source_kinds_json, suggested_from, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    'skill-coverage-1',
    'coverage-skill',
    'Coverage Skill',
    'Skill imported from OpenClaw',
    'work',
    'low',
    'active',
    JSON.stringify(['openclaw']),
    'openclaw',
    ts,
    ts,
  );

  db.prepare(
    `INSERT INTO skill_platform_sync_settings (
       platform, enabled, capability, mode, config_json, last_probe_at, last_error, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run('openclaw', 1, 'api', 'pull_push', '{}', ts, null, ts);
  db.prepare(
    `INSERT INTO skill_platform_sync_settings (
       platform, enabled, capability, mode, config_json, last_probe_at, last_error, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run('codex', 0, 'fs_via_desktop_app', 'push', '{}', null, null, ts);
  db.prepare(
    `INSERT INTO skill_platform_sync_settings (
       platform, enabled, capability, mode, config_json, last_probe_at, last_error, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    'claude_code',
    1,
    'fs_via_desktop_app',
    'push',
    '{}',
    ts,
    'probe failed',
    ts,
  );

  db.prepare(
    `INSERT INTO provider_sync_jobs (
       id, provider, scenario, binding_type, status, request_json, error_message, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    'provider-coverage-1',
    'doubao',
    'stable_memory',
    'memory_sync_thread',
    'failed',
    '{}',
    'fixture failure',
    ts,
    ts,
  );

  db.prepare(
    `INSERT INTO user_profile_items (
       id, item_type, item_key, item_value, evidence_refs, source_kind, confidence,
       user_confirmed, status, salience_score, mention_count, last_seen,
       created_at, updated_at, fingerprint
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    'profile-coverage-1',
    'preference',
    'coverage.pref',
    'likes explicit provenance',
    '[]',
    'explicit',
    0.9,
    1,
    'active',
    0.8,
    1,
    ts,
    ts,
    ts,
    'profile-coverage-fingerprint-1',
  );
  db.prepare(
    `INSERT INTO user_profile_items (
       id, item_type, item_key, item_value, evidence_refs, source_kind, confidence,
       user_confirmed, status, salience_score, mention_count, last_seen,
       created_at, updated_at, fingerprint
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    'profile-coverage-2',
    'fact',
    'coverage.pending',
    'pending import fact',
    '[]',
    'inferred',
    0.7,
    0,
    'pending_confirm',
    0.4,
    1,
    ts,
    ts,
    ts,
    'profile-coverage-fingerprint-2',
  );

  db.prepare(
    `INSERT INTO reflection_threads (
       id, topic_key, title, status, source_type, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run('reflection-coverage-1', 'coverage-reflection', 'Coverage Reflection', 'active', 'jira', ts, ts);

  db.prepare(
    `INSERT INTO proposed_actions (
       id, type, title, state, action_type, source_kind, queue_status, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    'action-coverage-1',
    'suggestion',
    'Delegate coverage',
    'pending',
    'delegate_openclaw',
    'openclaw',
    'queued',
    ts,
  );

  db.prepare(
    `INSERT INTO confirm_requests (
       id, question, state, routing, created_at
     ) VALUES (?, ?, ?, ?, ?)`,
  ).run('confirm-coverage-1', 'Confirm coverage?', 'pending', 'decision', ts);

  db.prepare(
    `INSERT INTO notification_records (
       id, channel, type, title, created_at
     ) VALUES (?, ?, ?, ?, ?)`,
  ).run(
    'notification-coverage-1',
    'chrome_notification',
    'coverage',
    'Coverage pending',
    ts,
  );

  db.prepare(
    `INSERT INTO memory_import_batches (
       id, input_kind, detected_kind, source_name, source_hash, source_count,
       status, summary_json, warnings_json, created_at, committed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    'external-ai-import-coverage-1',
    'file',
    'external_ai_history',
    'chatgpt-export.zip',
    'external-ai-import-hash',
    2,
    'committed',
    JSON.stringify({
      externalAiConversations: 2,
      externalAiImportedMessages: 12,
      externalAiTotalMessages: 14,
      externalAiSkippedParts: 3,
      externalAiSourcePath: 'exports/conversations.json',
      externalAiIgnoredFiles: 4,
    }),
    '[]',
    ts,
    ts,
  );
}

describe('Coverage API', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  beforeEach(() => {
    seedCoverageData(db);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/coverage/map returns platform coverage from database aggregates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/coverage/map',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.summary.totalMessages).toBe(6);
    expect(body.summary.totalChunks).toBe(1);
    expect(body.summary.pressureItems).toBe(4);
    expect(body.receipt).toMatchObject({
      generatedAt: body.generatedAt,
      staleAfterDays: 7,
      summary: {
        platformCount: body.platforms.length,
        activeDerivedPlatformCount: body.summary.activePlatforms,
        healthyPlatformCount: body.summary.healthyPlatforms,
        warningPlatformCount: body.summary.warningPlatforms,
        coverageGapCount: body.summary.coverageGaps,
        pressureItemCount: body.summary.pressureItems,
        totalMessages: body.summary.totalMessages,
        totalChunks: body.summary.totalChunks,
        totalEntities: body.summary.totalEntities,
        windowLabel: 'Coverage Map 聚合快照 + 近 7 天新鲜度窗口',
      },
    });
    expect(body.receipt.source).toContain('messages_raw');
    expect(body.receipt.source).toContain('provider_sync_jobs');
    expect(body.receipt.summary.repairActionCount).toBe(body.repairActions.length);
    expect(body.receipt.summary.infoPlanningActionCount).toBe(
      body.repairActions.filter((item: any) => item.severity === 'info').length,
    );
    expect(body.receipt.summary.timelineEventCount).toBe(body.timeline.length);
    expect(body.receipt.summary.latestAt).toBe(body.timeline[0].at);
    expect(body.receipt.summary.emptyState).toContain('本轮可读信号');
    expect(body.receipt.boundary).toContain('只读覆盖聚合快照');
    expect(body.receipt.boundary).toContain('不会写入记忆');
    expect(body.receipt.note).toContain('不是外部连接器同步结果');

    const ringCentral = body.platforms.find((item: any) => item.id === 'ringcentral');
    expect(ringCentral).toBeTruthy();
    expect(ringCentral.qualityScoreBreakdown.finalScore).toBe(ringCentral.qualityScore);
    expect(ringCentral.qualityScoreBreakdown.reasons.join('\n')).toContain('状态基准');
    expect(ringCentral.qualityScoreBreakdown.reasons.join('\n')).toContain('近 7 天信号占比');
    expect(ringCentral.contributions.find((item: any) => item.id === 'messages:glip').count).toBe(2);
    expect(ringCentral.contributions.find((item: any) => item.id === 'ringcentral:meeting').count).toBe(1);
    expect(ringCentral.contributions.find((item: any) => item.id === 'ringcentral:calendar').recentCount).toBe(1);
    expect(ringCentral.repairActions[0]).toMatchObject({
      id: 'ringcentral:quality-score:messages:glip',
      severity: 'warning',
      source: "messages_raw.source_type='glip'",
    });
    expect(ringCentral.repairActions[0].description).toContain('质量分');
    expect(ringCentral.repairActions[0].description).toContain('聊天消息');

    const doubao = body.platforms.find((item: any) => item.id === 'doubao');
    expect(doubao.state).toBe('failing');
    expect(doubao.qualityScoreBreakdown.failingPenalty).toBe(10);
    expect(doubao.qualityScoreBreakdown.reasons.join('\n')).toContain('存在失败贡献项');
    expect(doubao.repairActions[0].description).toContain('fixture failure');
    expect(body.priorityFocus).toMatchObject({
      platformId: 'doubao',
      platformName: '豆包 Doubao',
      state: 'failing',
      contributionId: 'doubao:provider-sync',
      contributionLabel: '长期记忆推送',
      contributionState: 'failing',
      actionId: 'doubao:provider-sync',
      actionSeverity: 'critical',
      source: "provider_sync_jobs.provider='doubao'",
    });
    expect(body.priorityFocus.reason).toContain('先检查最近一次同步或读取错误');
    expect(body.priorityFocus.selectionBasis).toContain(
      'critical / warning 修复项',
    );
    expect(body.priorityFocus.selectionBasis).toContain('info 规划项');
    expect(body.priorityFocus.comparedPlatformCount).toBeGreaterThan(0);
    expect(body.priorityFocus.ignoredInfoActionCount).toBeGreaterThan(0);
    expect(body.priorityFocus.boundary).toContain('只读诊断路线');
    expect(body.priorityFocus.boundary).toContain('不会重跑同步');

    const codex = body.platforms.find((item: any) => item.id === 'codex');
    expect(codex.state).toBe('blocked');
    expect(codex.repairActions[0]).toMatchObject({
      id: 'codex:enable',
      severity: 'info',
    });
    expect(codex.repairActions[0].description).toContain('不算当前覆盖故障');

    const claudeCode = body.platforms.find((item: any) => item.id === 'claude_code');
    expect(claudeCode.state).toBe('failing');
    expect(claudeCode.repairActions[0]).toMatchObject({
      id: 'claude_code:enable',
      severity: 'warning',
    });
    expect(claudeCode.repairActions[0].description).toContain('probe failed');

    const externalAiHistory = body.platforms.find(
      (item: any) => item.id === 'external_ai_history',
    );
    expect(externalAiHistory).toMatchObject({
      group: 'active',
      state: 'healthy',
      totalCount: 12,
      recentCount: 12,
    });
    expect(externalAiHistory.contributions[0]).toMatchObject({
      id: 'external-ai:import-batches',
      count: 12,
      recentCount: 12,
    });
    expect(externalAiHistory.contributions[0].detail).toContain('1 个导入批次');
    expect(externalAiHistory.contributions[0].detail).toContain('2 个会话');
    expect(externalAiHistory.contributions[0].detail).toContain('12/14 条文本消息');
    expect(externalAiHistory.contributions[0].detail).toContain('跳过 3 个非文本');
    expect(externalAiHistory.contributions[0].detail).toContain('忽略 4 个归档文件');
    expect(externalAiHistory.contributions[0].detail).toContain('来源 exports/conversations.json');
    expect(externalAiHistory.repairActions[0]).toMatchObject({
      id: 'external-ai-history:manual-refresh',
      severity: 'info',
    });

    const nonInfoRepairActions = body.repairActions.filter(
      (item: any) => item.severity !== 'info',
    );
    expect(body.summary.coverageGaps).toBe(nonInfoRepairActions.length);
    expect(
      nonInfoRepairActions.some((item: any) => item.platformId === 'codex'),
    ).toBe(false);
  });

  it('GET /api/v1/coverage/* exposes P0 aggregate slices', async () => {
    const [messagesRes, pressureRes, jobsRes, skillsRes] = await Promise.all([
      app.inject({ method: 'GET', url: '/api/v1/coverage/messages-by-source' }),
      app.inject({ method: 'GET', url: '/api/v1/coverage/pressure' }),
      app.inject({ method: 'GET', url: '/api/v1/coverage/provider-jobs/recent' }),
      app.inject({ method: 'GET', url: '/api/v1/coverage/skills-sync' }),
    ]);

    expect(messagesRes.statusCode).toBe(200);
    expect(pressureRes.statusCode).toBe(200);
    expect(jobsRes.statusCode).toBe(200);
    expect(skillsRes.statusCode).toBe(200);

    const messagesBody = messagesRes.json();
    const pressureBody = pressureRes.json();
    const jobsBody = jobsRes.json();
    const skillsBody = skillsRes.json();

    expect(messagesBody).toMatchObject({
      staleAfterDays: 7,
      receipt: {
        slice: 'messages-by-source',
        staleAfterDays: 7,
        source: "messages_raw GROUP BY source_type",
        summary: {
          itemCount: 4,
          totalCount: 6,
          recentCount: 5,
          windowLabel: '全量 source_type 聚合 + 近 7 天新鲜度',
        },
      },
    });
    expect(messagesBody.receipt.generatedAt).toBe(messagesBody.generatedAt);
    expect(messagesBody.receipt.summary.latestAt).toBeGreaterThan(0);
    expect(messagesBody.receipt.summary.emptyState).toContain('source_type 聚合');
    expect(messagesBody.receipt.boundary).toContain('只读覆盖诊断切片');
    expect(messagesBody.receipt.boundary).toContain('不会写入记忆');
    expect(messagesBody.receipt.note).toContain('不读取消息正文');
    expect(messagesBody.items.find((item: any) => item.sourceType === 'glip').count).toBe(2);

    expect(pressureBody).toMatchObject({
      totalPressureItems: 4,
      staleAfterDays: 7,
      receipt: {
        slice: 'pressure',
        source:
          'notification_records + proposed_actions + confirm_requests + reflection_threads',
        summary: {
          itemCount: 5,
          totalCount: 4,
          windowLabel: '当前未完成压力队列快照',
        },
      },
    });
    expect(pressureBody.receipt.summary.emptyState).toContain('待处理压力');
    expect(pressureBody.receipt.note).toContain('不发送通知');
    expect(pressureBody.receipt.note).toContain('不执行动作');

    expect(jobsBody).toMatchObject({
      receipt: {
        slice: 'provider-jobs-recent',
        source: 'provider_sync_jobs from the last 30 days',
        summary: {
          itemCount: 1,
          totalCount: 1,
          failureCount: 1,
          windowLabel: '最近 30 天 provider_sync_jobs 聚合',
        },
      },
    });
    expect(jobsBody.receipt.summary.latestAt).toBeGreaterThan(0);
    expect(jobsBody.receipt.summary.emptyState).toContain('provider/scenario');
    expect(jobsBody.receipt.note).toContain('不重跑 provider sync');
    expect(jobsBody.items[0]).toMatchObject({
      provider: 'doubao',
      scenario: 'stable_memory',
      failed: 1,
      latestStatus: 'failed',
    });

    expect(skillsBody).toMatchObject({
      receipt: {
        slice: 'skills-sync',
        source: 'skill_platform_sync_settings + skill_platform_bindings',
        summary: {
          itemCount: 3,
          enabledCount: 2,
          failureCount: 1,
          windowLabel: '当前技能同步设置 + 最近探测状态',
        },
      },
    });
    expect(skillsBody.receipt.summary.latestAt).toBeGreaterThan(0);
    expect(skillsBody.receipt.summary.emptyState).toContain('技能平台设置');
    expect(skillsBody.receipt.note).toContain('不写入 active skill truth');
    expect(skillsBody.items.find((item: any) => item.platform === 'openclaw')).toMatchObject({
      enabled: true,
      capability: 'api',
    });
  });

  it('marks imported external AI history stale when the last commit is old', async () => {
    const old = now() - 12 * 86400;
    db.prepare(
      `UPDATE memory_import_batches
       SET created_at = ?, committed_at = ?
       WHERE id = ?`,
    ).run(old, old, 'external-ai-import-coverage-1');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/coverage/map',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const externalAiHistory = body.platforms.find(
      (item: any) => item.id === 'external_ai_history',
    );

    expect(externalAiHistory).toMatchObject({
      group: 'active',
      state: 'stale',
      totalCount: 12,
      recentCount: 0,
    });
    expect(externalAiHistory.contributions[0]).toMatchObject({
      id: 'external-ai:import-batches',
      state: 'stale',
      recentCount: 0,
    });
    expect(externalAiHistory.qualityScore).toBeLessThan(80);
    expect(externalAiHistory.repairActions[0]).toMatchObject({
      id: 'external-ai-history:manual-refresh',
      severity: 'warning',
    });
    expect(externalAiHistory.repairActions[0].description).toContain(
      '不会自动同步',
    );
    expect(
      body.repairActions.some(
        (item: any) =>
          item.id === 'external-ai-history:manual-refresh' &&
          item.severity === 'warning',
      ),
    ).toBe(true);
  });
});
