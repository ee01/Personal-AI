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
    db.prepare('DELETE FROM memory_metadata').run();
    db.prepare('DELETE FROM reflection_artifacts').run();
    db.prepare('DELETE FROM concerned_items_state').run();
    db.prepare('DELETE FROM notification_records').run();
    db.prepare('DELETE FROM proposed_actions').run();
    db.prepare('DELETE FROM channel_delivery_records').run();

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
    expect(body.supportedScenarios).toContain('todo_sync');
    expect(body.supportedScenarios).toContain('notice_sync');
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

  it('keeps unconfirmed active profile items out of provider context packages', async () => {
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO user_profile_items
        (id, item_type, item_key, item_value, source_kind, confidence, user_confirmed, status,
         salience_score, mention_count, last_seen, created_at, updated_at, fingerprint)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'profile-unconfirmed-voice',
      'preference',
      'response_length',
      'always write long speculative updates before the user confirms this',
      'inferred',
      0.99,
      0,
      'active',
      0.99,
      4,
      now,
      now,
      now,
      'fp-unconfirmed-voice',
    );

    db.prepare(
      `INSERT INTO user_profile_items
        (id, item_type, item_key, item_value, source_kind, confidence, user_confirmed, status,
         salience_score, mention_count, last_seen, created_at, updated_at, fingerprint)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'profile-unconfirmed-focus',
      'interest',
      'focus_project',
      'Unconfirmed stealth launch plan',
      'inferred',
      0.99,
      0,
      'active',
      0.99,
      4,
      now,
      now,
      now,
      'fp-unconfirmed-focus',
    );

    const stableRes = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/context-packages/render',
      payload: {
        provider: 'doubao',
        scenario: 'stable_memory',
        includeKinds: ['voice_mode'],
      },
    });

    expect(stableRes.statusCode).toBe(200);
    const stableBody = stableRes.json();
    expect(stableBody.packages).toHaveLength(1);
    expect(stableBody.packages[0].bodyMd).toContain('concise but not terse');
    expect(stableBody.packages[0].bodyMd).not.toContain('long speculative updates');
    expect(stableBody.packages[0].sourceRefs).toContain('profile_item:response_length');

    const briefingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/context-packages/render',
      payload: {
        provider: 'doubao',
        scenario: 'mobile_briefing',
        includeKinds: ['active_focus_digest'],
      },
    });

    expect(briefingRes.statusCode).toBe(200);
    const briefingBody = briefingRes.json();
    expect(briefingBody.packages).toHaveLength(1);
    expect(briefingBody.packages[0].bodyMd).toContain('response_length');
    expect(briefingBody.packages[0].bodyMd).not.toContain('Unconfirmed stealth launch plan');
    expect(briefingBody.packages[0].sourceRefs).not.toContain('profile_item:focus_project');
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

  it('renders mobile briefing from real memory highlights instead of concerned items', async () => {
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

    db.prepare(
      `INSERT INTO memory_metadata
        (target_type, target_id, salience_score, importance, frequency, consolidation_level, created_at, updated_at)
       VALUES ('message', ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'provider-message-1',
      0.96,
      0.91,
      3,
      'working',
      now,
      now,
    );

    db.prepare(
      `INSERT INTO reflection_artifacts
        (id, scope, scope_ref, summary, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      'reflection-provider-1',
      'project',
      'doubao-bridge',
      '需要把近期重点限定为真实记忆信号，关注规则只能作为触发配置。',
      now,
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
    expect(body.packages[0].itemCount).toBe(4);
    expect(body.packages[0].bodyMd).toContain('Recent Memory Highlights');
    expect(body.packages[0].bodyMd).toContain('下一个版本优先级聚焦 onboarding 和 Doubao bridge 会话绑定');
    expect(body.packages[0].bodyMd).toContain('score 0.96');
    expect(body.packages[0].bodyMd).toContain('response_length');
    expect(body.packages[0].bodyMd).toContain('近期重点限定为真实记忆信号');
    expect(body.packages[0].bodyMd).not.toContain('Concerned Items');
    expect(body.packages[0].bodyMd).not.toContain('关注 Doubao Bridge 线程绑定异常');
    expect(body.packages[0].bodyMd).not.toContain('豆包最近没有把近期重点正确记到随手记里');
    expect(body.packages[0].sourceRefs).toContain('message:provider-message-1');
    expect(body.packages[0].sourceRefs).toContain('profile_item:response_length');
    expect(body.packages[0].sourceRefs).toContain('reflection:reflection-provider-1');
    expect(body.packages[0].sourceRefs).not.toContain('concerned_items:1');
  });

  it('renders todo_sync and notice_sync with the new split while keeping reminder_sync as todo alias', async () => {
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, payload_json, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'weekly_report', ?, ?, ?, ?, ?)`,
    ).run(
      'notif-weekly-1',
      'Weekly Report Ready',
      'Your weekly report is ready',
      JSON.stringify({
        reportSummary: 'Weekly launch summary: project remains on track.',
        reportExcerpt:
          'Highlights\n- Weekly launch summary: project remains on track.\n\nAction Items\n- Review the rollout notes.',
      }),
      now,
      now,
    );

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'new_conflict', ?, ?, ?, ?)`,
    ).run(
      'notif-conflict-1',
      'Need a decision',
      'There is a new conflict to confirm',
      now,
      now,
    );

    db.prepare(
      `INSERT INTO proposed_actions
        (id, type, title, description, state, created_at, action_type, queue_status, priority)
       VALUES (?, 'notify_user', ?, ?, 'pending', ?, 'notify_user', 'queued', 9)`,
    ).run(
      'action-1',
      'Review the rollout notes',
      'Check the notes before tomorrow morning',
      now,
    );

    const todoRes = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/context-packages/render',
      payload: {
        provider: 'doubao',
        scenario: 'todo_sync',
      },
    });

    expect(todoRes.statusCode).toBe(200);
    const todoBody = todoRes.json();
    expect(todoBody.packages).toHaveLength(1);
    expect(todoBody.packages[0].kind).toBe('todo_digest');
    expect(todoBody.packages[0].itemCount).toBe(2);
    expect(todoBody.packages[0].bodyMd).toContain('Need a decision');
    expect(todoBody.packages[0].bodyMd).toContain('Review the rollout notes');
    expect(todoBody.packages[0].bodyMd).not.toContain('Weekly Report Ready');

    const noticeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/context-packages/render',
      payload: {
        provider: 'doubao',
        scenario: 'notice_sync',
      },
    });

    expect(noticeRes.statusCode).toBe(200);
    const noticeBody = noticeRes.json();
    expect(noticeBody.packages).toHaveLength(1);
    expect(noticeBody.packages[0].kind).toBe('notice_digest');
    expect(noticeBody.packages[0].itemCount).toBe(1);
    expect(noticeBody.packages[0].bodyMd).toContain('Weekly Report Ready');
    expect(noticeBody.packages[0].bodyMd).toContain(
      'Weekly launch summary',
    );
    expect(noticeBody.packages[0].bodyMd).toContain('Review the rollout notes');
    expect(noticeBody.packages[0].bodyMd).not.toContain('Need a decision');

    const reminderAliasRes = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/context-packages/render',
      payload: {
        provider: 'doubao',
        scenario: 'reminder_sync',
      },
    });

    expect(reminderAliasRes.statusCode).toBe(200);
    const reminderAliasBody = reminderAliasRes.json();
    expect(reminderAliasBody.packages).toHaveLength(1);
    expect(reminderAliasBody.packages[0].kind).toBe('reminder_digest');
    expect(reminderAliasBody.packages[0].itemCount).toBe(2);
    expect(reminderAliasBody.packages[0].bodyMd).toContain('Need a decision');
    expect(reminderAliasBody.packages[0].bodyMd).not.toContain('Weekly Report Ready');
  });

  it('returns itemCount 0 for empty todo and notice digests', async () => {
    const todoRes = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/context-packages/render',
      payload: {
        provider: 'doubao',
        scenario: 'todo_sync',
      },
    });

    expect(todoRes.statusCode).toBe(200);
    const todoBody = todoRes.json();
    expect(todoBody.packages).toHaveLength(1);
    expect(todoBody.packages[0].itemCount).toBe(0);
    expect(todoBody.packages[0].sourceRefs).toEqual([]);
    expect(todoBody.packages[0].bodyMd).toContain('暂无待处理事项。');

    const noticeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/context-packages/render',
      payload: {
        provider: 'doubao',
        scenario: 'notice_sync',
      },
    });

    expect(noticeRes.statusCode).toBe(200);
    const noticeBody = noticeRes.json();
    expect(noticeBody.packages).toHaveLength(1);
    expect(noticeBody.packages[0].itemCount).toBe(0);
    expect(noticeBody.packages[0].sourceRefs).toEqual([]);
    expect(noticeBody.packages[0].bodyMd).toContain('暂无新通知。');
  });
});
