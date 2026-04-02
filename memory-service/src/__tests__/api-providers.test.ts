import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { cleanupTestDb, getTestDb } from './setup.js';

describe('Provider API', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    cleanupTestDb();
  });

  beforeEach(() => {
    db.prepare('DELETE FROM provider_sync_jobs').run();
    db.prepare('DELETE FROM provider_bindings').run();
    db.prepare('DELETE FROM user_profile_items').run();
    db.prepare('DELETE FROM messages_raw').run();
    db.prepare('DELETE FROM concerned_items_state').run();

    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO user_profile_items
        (id, item_type, item_key, item_value, source_kind, confidence, user_confirmed, status,
         salience_score, mention_count, last_seen, created_at, updated_at, fingerprint)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'profile-voice-length',
      'preference',
      'response_length',
      'concise but not terse',
      'explicit',
      0.98,
      1,
      'active',
      0.92,
      3,
      now,
      now,
      now,
      'fp-response-length',
    );

    db.prepare(
      `INSERT INTO user_profile_items
        (id, item_type, item_key, item_value, source_kind, confidence, user_confirmed, status,
         salience_score, mention_count, last_seen, created_at, updated_at, fingerprint)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'profile-commute-mode',
      'habit',
      'commute_mode',
      'often chats through mobile and earbuds after work',
      'explicit',
      0.93,
      1,
      'active',
      0.84,
      2,
      now,
      now,
      now,
      'fp-commute-mode',
    );

    db.prepare(
      `INSERT INTO messages_raw
        (id, content, summary, source_type, sender, group_name, timestamp, importance, sentiment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'provider-message-1',
      '下一个版本会优先处理 onboarding 和 Doubao bridge 会话绑定。',
      '下一个版本优先级聚焦 onboarding 和 Doubao bridge 会话绑定。',
      'manual',
      'user',
      'planning',
      now - 600,
      0.91,
      'neutral',
      now - 600,
    );
  });

  it('returns provider capabilities for doubao', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/providers/doubao/capabilities',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.provider).toBe('doubao');
    expect(body.supportedBindingTypes).toContain('memory_sync_thread');
    expect(body.supportedScenarios).toContain('mobile_briefing');
    expect(body.syncModel).toBe('local_bridge');
  });

  it('upserts a provider binding and lists it back', async () => {
    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/providers/doubao/bindings/mobile_context_thread',
      payload: {
        externalThreadId: 'thread-mobile-1',
        title: '手机版对话',
        deviceId: 'extension-popup',
        metadata: { threadUrl: 'https://www.doubao.com/thread/mobile-1' },
        isActive: true,
      },
    });

    expect(putRes.statusCode).toBe(200);
    const putBody = putRes.json();
    expect(putBody.binding.bindingType).toBe('mobile_context_thread');
    expect(putBody.binding.externalThreadId).toBe('thread-mobile-1');

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/providers/doubao/bindings',
    });

    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json();
    expect(listBody.total).toBe(1);
    expect(listBody.items[0].title).toBe('手机版对话');
  });

  it('renders stable-memory context packages and creates a queued sync job', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/context-packages/render',
      payload: {
        provider: 'doubao',
        scenario: 'stable_memory',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.provider).toBe('doubao');
    expect(body.packages.length).toBeGreaterThanOrEqual(2);
    expect(body.packages.some((pkg: any) => pkg.kind === 'persona_core')).toBe(true);
    expect(body.packages.some((pkg: any) => pkg.kind === 'voice_mode')).toBe(true);
    expect(body.syncJob).toBeDefined();
    expect(body.syncJob.status).toBe('queued');

    const jobsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/providers/doubao/sync-jobs',
    });

    expect(jobsRes.statusCode).toBe(200);
    const jobsBody = jobsRes.json();
    expect(jobsBody.total).toBe(1);
    expect(jobsBody.items[0].scenario).toBe('stable_memory');
  });

  it('reports provider sync job status after rendering a query answer card', async () => {
    const renderRes = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/context-packages/render',
      payload: {
        provider: 'doubao',
        scenario: 'query_answer',
        query: '最近关于下一个版本需求有什么结论？',
      },
    });

    expect(renderRes.statusCode).toBe(200);
    const renderBody = renderRes.json();
    expect(renderBody.packages).toHaveLength(1);
    expect(renderBody.packages[0].kind).toBe('query_answer_card');
    expect(renderBody.syncJob).toBeDefined();

    const reportRes = await app.inject({
      method: 'POST',
      url: `/api/v1/providers/doubao/sync-jobs/${renderBody.syncJob.id}/report`,
      payload: {
        status: 'succeeded',
        result: {
          bridgeKind: 'query_inject',
        },
        externalThreadId: 'thread-mobile-1',
        startedAt: Date.now() - 1000,
        completedAt: Date.now(),
      },
    });

    expect(reportRes.statusCode).toBe(200);
    const reportBody = reportRes.json();
    expect(reportBody.job.status).toBe('succeeded');
    expect(reportBody.job.externalThreadId).toBe('thread-mobile-1');
  });

  it('renders mobile briefing concerned items with readable labels and expanded details', async () => {
    const now = Math.floor(Date.now() / 1000);
    const contentUpdatedAt = Date.now();
    const concernedItems = [
      {
        id: 'tp3ppwxlu',
        text: '关注 Doubao Bridge 线程绑定异常',
        filterGroup: 'mobile-ops',
        notifyMethod: 'bot,chrome',
        notifyFrequency: 'merged',
        digestConfig: {
          enabled: true,
          frequency: 'daily',
          preferredHour: 9,
        },
      },
      {
        id: 'x2c7o07b0',
        followThread: true,
        followConfig: {
          originalMessage: {
            postId: 'post-1',
            teamId: 'team-1',
            teamName: '手机版对话',
            sender: 'Esone',
            content: '豆包最近没有把近期重点正确记到随手记里',
            datetime: '2026-03-30T08:30:00.000Z',
            messageUrl: 'https://example.com/post-1',
          },
          createdAt: '2026-03-30T08:30:00.000Z',
          keywordFilter: ['随手记', '近期重点'],
          relatedMessages: [],
        },
        notifyMethod: 'bot',
      },
    ];

    db.prepare(
      `INSERT INTO concerned_items_state
        (singleton_id, items_json, version, updated_at, content_updated_at, updated_by_device)
       VALUES (1, ?, 1, ?, ?, ?)`,
    ).run(
      JSON.stringify(concernedItems),
      now,
      contentUpdatedAt,
      'provider-test-device',
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/context-packages/render',
      payload: {
        provider: 'doubao',
        scenario: 'mobile_briefing',
        includeKinds: ['active_focus_digest'],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.packages).toHaveLength(1);
    expect(body.packages[0].kind).toBe('active_focus_digest');
    expect(body.packages[0].bodyMd).toContain('关注 Doubao Bridge 线程绑定异常');
    expect(body.packages[0].bodyMd).toContain('group mobile-ops');
    expect(body.packages[0].bodyMd).toContain('notify bot + chrome');
    expect(body.packages[0].bodyMd).toContain('digest daily @ 09:00');
    expect(body.packages[0].bodyMd).toContain('track replies to "豆包最近没有把近期重点正确记到随手记里"');
    expect(body.packages[0].bodyMd).toContain('keywords 随手记, 近期重点');
    expect(body.packages[0].bodyMd).not.toContain('- tp3ppwxlu');
    expect(body.packages[0].bodyMd).not.toContain('- x2c7o07b0');
  });
});
