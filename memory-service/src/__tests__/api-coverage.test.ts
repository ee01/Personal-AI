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

    expect(messagesRes.json().items.find((item: any) => item.sourceType === 'glip').count).toBe(2);
    expect(pressureRes.json().totalPressureItems).toBe(4);
    expect(jobsRes.json().items[0]).toMatchObject({
      provider: 'doubao',
      scenario: 'stable_memory',
      failed: 1,
      latestStatus: 'failed',
    });
    expect(skillsRes.json().items.find((item: any) => item.platform === 'openclaw')).toMatchObject({
      enabled: true,
      capability: 'api',
    });
  });
});
