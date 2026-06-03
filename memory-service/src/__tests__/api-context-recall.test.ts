import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi
      .fn()
      .mockRejectedValue(new Error('Embedding not available in tests')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

describe('Context Recall API (POST /context-recall)', () => {
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
  });

  beforeEach(() => {
    db.prepare('DELETE FROM recall_training_cases').run();
    db.prepare('DELETE FROM recall_patch_runs').run();
    db.prepare('DELETE FROM recall_relevance_patches').run();
    db.prepare('DELETE FROM conversation_context_frames').run();
    db.prepare('DELETE FROM memory_feedback_events').run();
    db.prepare('DELETE FROM memory_metadata').run();
    db.prepare('DELETE FROM messages_raw').run();
    db.prepare('DELETE FROM chunks').run();
    db.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`).run();

    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'web-memory-1',
      'Project Falcon launch readiness review with the platform team.',
      'web',
      'https://internal.example.com/wiki/falcon',
      'Falcon launch readiness',
      'browser',
      'falcon-grp',
      'Falcon Group',
      now - 60,
      0.8,
      'neutral',
      JSON.stringify({}),
      now - 60,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      9001,
      'messages/web-memory-1',
      1,
      1,
      'Project Falcon launch readiness review with the platform team.',
      'hash-falcon-1',
      'work',
      'web',
      'web',
      'Falcon',
      now - 60,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      9002,
      'messages/personal-falcon-memory',
      1,
      1,
      'Personal Falcon launch readiness note for weekend planning.',
      'hash-falcon-personal-1',
      'personal',
      'manual',
      'manual',
      'Falcon',
      now - 30,
    );
    db.prepare(
      `INSERT INTO chunks_fts(rowid, content) VALUES (?, ?), (?, ?)`,
    ).run(
      9001,
      'Project Falcon launch readiness review with the platform team.',
      9002,
      'Personal Falcon launch readiness note for weekend planning.',
    );
  });

  it('rejects payloads missing surface', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: { contextType: 'webpage', primaryText: 'Project Falcon launch' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects payloads with unknown surface', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'unknown_surface',
        contextType: 'webpage',
        primaryText: 'anything',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns matches with exploreLink and a topMatch on relevant content', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'Falcon launch readiness',
        primaryText: 'Project Falcon launch readiness',
        limit: 3,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.matches)).toBe(true);
    expect(typeof body.queryTimeMs).toBe('number');
    expect(body.matches.length).toBeGreaterThan(0);
    const top = body.matches[0];
    expect(top.id).toBeDefined();
    expect(typeof top.score).toBe('number');
    expect(typeof top.snippet).toBe('string');
    expect(top.displayPriority).toBe('p1');
    expect(top.whyRelevant?.length).toBeGreaterThan(0);
    expect(top.matchedAnchors?.projects || top.matchedAnchors?.topics).toBeTruthy();
    expect(body.autopilot?.mode).toBe('card');
    expect(body.autopilot?.strongCount).toBeGreaterThan(0);
    expect(body.autopilot?.sceneAnchors?.projects || body.autopilot?.sceneAnchors?.topics).toBeTruthy();
    expect(
      typeof top.exploreLink === 'string' || top.exploreLink === undefined,
    ).toBe(true);
    expect(
      body.matches.some((match: any) =>
        match.links?.some(
          (link: any) => link.url === 'https://internal.example.com/wiki/falcon',
        ),
      ),
    ).toBe(true);
    expect(body.topMatch?.id).toBe(top.id);
  });

  it('does not reinforce access_count for passive context recall', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'Falcon launch readiness',
        primaryText: 'Project Falcon launch readiness',
        limit: 3,
      },
    });

    expect(res.statusCode).toBe(200);
    const row = db
      .prepare(
        `SELECT access_count
         FROM memory_metadata
         WHERE target_type = 'chunk' AND target_id = '9001'`,
      )
      .get() as { access_count: number } | undefined;
    expect(row).toBeUndefined();
  });

  it('applies scene-aware user relevance patches before displaying matches', async () => {
    const feedback = await app.inject({
      method: 'POST',
      url: '/api/v1/feedback',
      payload: {
        type: 'recall_quality',
        targetType: 'chunk',
        targetId: '9001',
        action: 'negative',
        detail: JSON.stringify({
          version: '1',
          interaction: 'memory_relevance_trainer',
          surface: 'web_passive_bubble',
          action: 'negative',
          feedback_reason: 'wrong_group_or_project',
          current_url: 'https://internal.example.com/wiki/falcon-current',
          current_title: 'Falcon launch readiness',
          display_priority: 'p1',
        }),
      },
    });
    expect(feedback.statusCode).toBe(200);
    expect(feedback.json().relevancePatch?.status).toBe('patched');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'Falcon launch readiness',
        url: 'https://internal.example.com/wiki/falcon-current',
        primaryText: 'Project Falcon launch readiness',
        limit: 5,
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const ids = body.matches.map((match: any) => match.id);
    expect(ids).not.toContain('9001');
    expect(body.debug?.suppressionReasons).toContain('user_relevance_patch');
    expect(
      body.autopilot?.quietReasons.map((item: any) => item.reason),
    ).toContain('user_relevance_patch');
  });

  it('does not return archived memories on passive context recall', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO memory_metadata
        (target_type, target_id, salience_score, effective_salience,
         retrieval_tier, consolidation_level, created_at, updated_at)
       VALUES ('chunk', '9001', 0.1, 0.1, 'archive_only', 'archived', ?, ?)`,
    ).run(now, now);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'Falcon launch readiness',
        primaryText: 'Project Falcon launch readiness',
        limit: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    const ids = res.json().matches.map((match: any) => match.id);
    expect(ids).not.toContain('9001');
  });

  it('filters exact current URL and negative feedback self echoes', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO memory_feedback_events
        (feedback_type, target_type, target_id, action, created_at, updated_at)
       VALUES ('recall_quality', 'chunk', ?, 'negative', ?, ?)`,
    ).run('9002', now, now);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'Falcon launch readiness',
        url: 'https://internal.example.com/wiki/falcon#section',
        primaryText: 'Project Falcon launch readiness weekend planning',
        limit: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    const ids = res.json().matches.map((match: any) => match.id);
    expect(ids).not.toContain('9001');
    expect(ids).not.toContain('9002');
  });

  it('suppresses generic RingCentral Video shell matches', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'generic-ringcentral-video',
      '会议: RingCentral Video',
      'meeting',
      'https://app.ringcentral.com/video/home',
      'RingCentral Video',
      'calendar',
      'generic-rc-video',
      'RingCentral Video',
      now - 10,
      0.3,
      'neutral',
      JSON.stringify({}),
      now - 10,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      9010,
      'messages/generic-ringcentral-video',
      1,
      1,
      '会议: RingCentral Video',
      'hash-generic-rc-video',
      'work',
      'meeting',
      'meeting',
      null,
      now - 10,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9010,
      '会议: RingCentral Video',
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'RingCentral Video',
        primaryText: '会议: RingCentral Video',
        limit: 3,
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matches).toEqual([]);
    expect(body.topMatch).toBeNull();
    expect(body.autopilot?.mode).toBe('silent');
    expect(body.autopilot?.quietReasons.map((item: any) => item.reason)).toContain(
      'source_context_excluded',
    );
    expect(body.debug?.rejectedReason).toBe('low_information_match');
  });

  it('suppresses generic RingCentral message location shell matches', async () => {
    const now = Math.floor(Date.now() / 1000);
    const content = '内容\n发送位置：当前这个 RingCentral 群';
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'generic-ringcentral-location',
      content,
      'glip',
      'https://app.ringcentral.com/messages/ai-service',
      'AI Service',
      'memory-service',
      'ai-service',
      'AI Service',
      now - 10,
      0.2,
      'neutral',
      JSON.stringify({}),
      now - 10,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      9013,
      'messages/generic-ringcentral-location',
      1,
      1,
      content,
      'hash-generic-rc-location',
      'work',
      'glip',
      'glip',
      null,
      now - 10,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9013,
      content,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'follow_thread',
        contextType: 'message_thread',
        title: 'AI Service',
        primaryText: 'AI Service 当前这个 RingCentral 群 内容 发送位置',
        sourceTypes: ['glip'],
        limit: 3,
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matches).toEqual([]);
    expect(body.topMatch).toBeNull();
    expect(body.debug?.rejectedReason).toBe('low_information_match');
  });

  it('keeps RingCentral Video matches with concrete work signals', async () => {
    const now = Math.floor(Date.now() / 1000);
    const content =
      'MTR-144449 Refine In-Meeting Video Tile Layout and UX dependency review.';
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'specific-ringcentral-video',
      content,
      'meeting',
      'https://app.ringcentral.com/video/home',
      'RingCentral Video',
      'calendar',
      'specific-rc-video',
      'RingCentral Video',
      now - 10,
      0.8,
      'neutral',
      JSON.stringify({}),
      now - 10,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      9011,
      'messages/specific-ringcentral-video',
      1,
      1,
      content,
      'hash-specific-rc-video',
      'work',
      'meeting',
      'meeting',
      'MTR',
      now - 10,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9011,
      content,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'RingCentral Video',
        primaryText: 'In-Meeting Video Tile Layout MTR-144449',
        limit: 3,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matches.map((match: any) => match.id)).toContain('9011');
    expect(body.topMatch).not.toBeNull();
  });

  it('does not surface Gary travel memory for Codex setup chat context', async () => {
    const now = Math.floor(Date.now() / 1000);
    const content =
      'Trip Itinerary — Gary Chevsky (Mar 31-Apr 12, 2026). Travel plan covers Hangzhou hotel, airport pickup, dinner, and local logistics.';
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'gary-travel-itinerary',
      content,
      'glip',
      'https://app.ringcentral.com/messages/gary-travel',
      'Trip Itinerary — Gary Chevsky',
      'Gary Chevsky',
      'travel',
      'Travel Logistics',
      now - 10,
      0.8,
      'neutral',
      JSON.stringify({ groupId: 'travel', groupName: 'Travel Logistics' }),
      now - 10,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      9040,
      'messages/gary-travel-itinerary',
      1,
      1,
      content,
      'hash-gary-travel-itinerary',
      'work',
      'glip',
      'glip',
      'Travel',
      now - 10,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9040,
      content,
    );
    const noisyRows = [
      {
        id: 'hr-open-day',
        chunkId: 9042,
        content:
          'Hi @Team. 本月的HR Open Day 即将开始，欢迎大家在今天9:30-11:30之间随时进入咨询室提问。',
        sourceTitle: 'RingCentral 消息',
        groupId: 'hr',
        groupName: 'HR Open Day',
      },
      {
        id: 'generic-calendar-time',
        chunkId: 9043,
        content: '📅 时间：2026 年 4 月 27 日（周一）14:00-15:00',
        sourceTitle: '时间',
        groupId: 'calendar',
        groupName: 'Calendar',
      },
    ];
    for (const row of noisyRows) {
      db.prepare(
        `INSERT INTO messages_raw
          (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.id,
        row.content,
        'glip',
        `https://app.ringcentral.com/messages/${row.id}`,
        row.sourceTitle,
        'glip',
        row.groupId,
        row.groupName,
        now - 10,
        0.6,
        'neutral',
        JSON.stringify({ groupId: row.groupId, groupName: row.groupName }),
        now - 10,
      );
      db.prepare(
        `INSERT INTO chunks
          (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.chunkId,
        `messages/${row.id}`,
        1,
        1,
        row.content,
        `hash-${row.id}`,
        'work',
        'glip',
        'glip',
        null,
        now - 10,
      );
      db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
        row.chunkId,
        row.content,
      );
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'follow_thread',
        contextType: 'message_thread',
        title: '2026 Hackathon Project',
        primaryText:
          'Headless app should guide Codex and cc setup with MCP skill settings so the agent knows which app capabilities are installed.',
        secondaryTexts: ['codex mcp skill setup headless settings solution'],
        sourceTypes: ['glip'],
        limit: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    const ids = res.json().matches.map((match: any) => match.id);
    expect(ids).not.toContain('9040');
    expect(ids).not.toContain('9042');
    expect(ids).not.toContain('9043');
  });

  it('does not recall Colin/AVA memories for an empty RingCentral meeting shell', async () => {
    const now = Math.floor(Date.now() / 1000);
    const content =
      'Colin Liu shared a message from AVA about Cursor token额度申请 and FreshService budget process.';
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'colin-ava-cursor-budget',
      content,
      'glip',
      'https://app.ringcentral.com/messages/colin-ava-cursor',
      'Colin Liu shared a message from AVA',
      'Colin Liu',
      'cursor-budget',
      'Cursor Budget',
      now - 10,
      0.8,
      'neutral',
      JSON.stringify({ groupId: 'cursor-budget', groupName: 'Cursor Budget' }),
      now - 10,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      9041,
      'messages/colin-ava-cursor-budget',
      1,
      1,
      content,
      'hash-colin-ava-cursor-budget',
      'work',
      'glip',
      'glip',
      'Cursor',
      now - 10,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9041,
      content,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'meeting_passive',
        contextType: 'meeting',
        title: 'RingCentral Video',
        primaryText:
          "RingCentral Video You're the only one here Invite others BRB Unmute Start video Share Invite Participants Chat React Raise hand Notes More Leave",
        limit: 3,
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matches).toEqual([]);
    expect(body.topMatch).toBeNull();
    expect(body.debug?.rejectedReason).toBe('low_information_meeting_context');
  });

  it('prefers AI tooling budget memories over generic AI/RingCentral chatter', async () => {
    const now = Math.floor(Date.now() / 1000);
    const rows = [
      {
        id: 'generic-ringclaw-topic',
        chunkId: 9030,
        content:
          'Everyone AI 主题分享 | RingClaw: 在 RingCentral 内直接对话多智能体 AI',
        sourceTitle: 'RingCentral 消息',
        metadata: {
          summary: 'Everyone AI 主题分享，介绍 RingClaw 在 RingCentral 中对话多智能体 AI。',
          groupId: 'generic-ai',
          groupName: 'Everyone AI',
          contextMessages: [
            {
              content:
                'Everyone AI 主题分享 | RingClaw: 在 RingCentral 内直接对话多智能体 AI',
            },
          ],
        },
      },
      {
        id: 'cursor-budget-process',
        chunkId: 9031,
        content: 'Colin Liu shared a message from AVA',
        sourceTitle: '名字特别猛的群',
        metadata: {
          summary:
            'Colin Liu转发并总结了关于Cursor token额度申请的公司内部流程，说明额度超限后可提交 FreshService ticket 申请额外预算。',
          groupId: 'cursor-budget',
          groupName: '名字特别猛的群',
          contextMessages: [
            {
              content:
                'Colin Liu shared a message from AVA\nHere is the process to apply for more tokens in Cursor. Submit a FreshService ticket and monitor Cursor usage.',
              isMainMessage: true,
            },
            {
              content: 'cursor超过限额的同事可以走这个流程先申请额外的预算试试',
              isMainMessage: false,
            },
          ],
          actions: [
            {
              description:
                'Submit a FreshService ticket with business justification to request additional Cursor tokens.',
              status: 'pending',
            },
          ],
          entities: {
            projects: [{ name: 'Cursor', summary: 'Cursor token and premium request quota.' }],
            topics: [{ name: 'Token Quota Application Process' }],
          },
          metadata: {
            tags: ['Cursor', 'token quota', 'FreshService', 'usage monitoring'],
          },
        },
      },
      {
        id: 'ai-notes-quota',
        chunkId: 9032,
        content:
          'AI Notes translation quota is enforced in a rolling window and the 429 response should include retry-after.',
        sourceTitle: 'RCV Working Team (Growth): AI Notes',
        metadata: {
          summary:
            'AI Notes 翻译字符限制和 rolling window quota 技术讨论。',
          groupId: 'ai-notes',
          groupName: 'RCV Working Team (Growth): AI Notes',
          metadata: { tags: ['AI Notes', 'translation limit', 'quota'] },
        },
      },
    ];

    for (const row of rows) {
      db.prepare(
        `INSERT INTO messages_raw
          (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.id,
        row.content,
        'glip',
        `https://app.ringcentral.com/messages/${row.id}`,
        row.sourceTitle,
        'Colin Liu',
        row.metadata.groupId,
        row.metadata.groupName,
        now - 10,
        0.8,
        'neutral',
        JSON.stringify(row.metadata),
        now - 10,
      );
      db.prepare(
        `INSERT INTO chunks
          (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.chunkId,
        `messages/${row.id}`,
        1,
        1,
        row.content,
        `hash-${row.id}`,
        'work',
        'glip',
        'glip',
        null,
        now - 10,
      );
      db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
        row.chunkId,
        [
          row.content,
          row.metadata.summary,
          JSON.stringify((row.metadata as any).contextMessages || []),
          JSON.stringify((row.metadata as any).metadata || {}),
        ].join(' '),
      );
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'follow_thread',
        contextType: 'message_thread',
        title: 'Colin, Michael',
        primaryText:
          'Engineering Excellence Dashboard Portal alert: AI usage exceeded hard limit. Codex cost $2366.02, hard limit $400. /fast 要关, /goal 不能用, 5.5 酌情选择, cursor composer 2.5.',
        secondaryTexts: [
          'AI usage hard limit Codex cost monthly budget Cursor Composer GPT-5.5',
        ],
        sourceTypes: ['glip'],
        limit: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const ids = body.matches.map((match: any) => match.id);
    expect(body.topMatch?.id).toBe('9031');
    expect(body.topMatch?.displayPriority).toBe('p1');
    expect(body.topMatch?.title).toContain('Cursor');
    expect(body.topMatch?.uiSummary).toContain('Cursor token额度申请');
    expect(body.topMatch?.whyRelevant).toEqual(
      expect.arrayContaining([expect.stringContaining('Cursor')]),
    );
    expect(body.topMatch?.snippet).toContain('cursor超过限额');
    expect(ids).not.toContain('9030');
    expect(ids).not.toContain('9032');
  });

  it('keeps concrete issue, action, and decision evidence', async () => {
    const now = Math.floor(Date.now() / 1000);
    const content =
      'Decision: approve MTR-144449 tile layout. Action: Esone owns the follow-up bug fix.';
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      9012,
      'messages/specific-decision-action',
      1,
      1,
      content,
      'hash-specific-decision-action',
      'work',
      'meeting',
      'meeting',
      'MTR',
      now - 10,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9012,
      content,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'meeting_passive',
        contextType: 'meeting',
        primaryText: 'MTR-144449 tile layout follow-up bug fix',
        limit: 3,
      },
    });

    expect(res.statusCode).toBe(200);
    const match = res.json().matches.find((entry: any) => entry.id === '9012');
    expect(match).toBeTruthy();
    expect(match.reasonType).toBe('keyword');
    expect(['action_item', 'decision', 'issue']).toContain(match.evidenceRole);
    expect(match.displayPriority).toBe('p1');
    expect(match.whyRelevant?.length).toBeGreaterThan(0);
    expect(match.uiSummary).toContain('MTR-144449');
  });

  it('merges duplicate meeting chunks into one source cluster', async () => {
    const now = Math.floor(Date.now() / 1000);
    for (const [id, chunkId, content] of [
      [
        'meeting-cluster-msg-1',
        9021,
        'MTR-555 decision: keep the compact meeting toolbar layout.',
      ],
      [
        'meeting-cluster-msg-2',
        9022,
        'MTR-555 action: Esone follows up on toolbar overflow testing.',
      ],
    ] as const) {
      db.prepare(
        `INSERT INTO messages_raw
          (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        content,
        'meeting',
        `https://memory.example.com/meetings/meeting-cluster-1#${chunkId}`,
        'MTR-555 toolbar review',
        'meeting-pilot',
        'meeting-cluster-1',
        'MTR-555 toolbar review',
        now - (9023 - chunkId),
        0.8,
        'neutral',
        JSON.stringify({ meetingId: 'meeting-cluster-1' }),
        now - (9023 - chunkId),
      );
      db.prepare(
        `INSERT INTO chunks
          (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        chunkId,
        `messages/${id}`,
        1,
        1,
        content,
        `hash-${id}`,
        'work',
        'meeting',
        'meeting',
        'MTR',
        now - (9023 - chunkId),
      );
      db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
        chunkId,
        content,
      );
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'meeting_passive',
        contextType: 'meeting',
        primaryText: 'MTR-555 toolbar layout overflow follow up decision action',
        limit: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const clusterMatches = body.matches.filter(
      (match: any) => match.sourceClusterKey === 'meeting:meeting-cluster-1',
    );
    expect(clusterMatches).toHaveLength(1);
    expect(clusterMatches[0].mergedCount).toBe(2);
    expect(clusterMatches[0].mergedIds.sort()).toEqual(['9021', '9022']);
    expect(body.autopilot?.duplicateMergedCount).toBe(1);
    expect(body.autopilot?.quietReasons.map((item: any) => item.reason)).toContain(
      'duplicate_source_cluster',
    );
  });

  it('uses all scope by default for passive recall', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'Falcon launch readiness',
        primaryText: 'Project Falcon launch readiness weekend planning',
        limit: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const ids = body.matches.map((match: any) => match.id);
    expect(ids).toContain('9001');
    expect(ids).toContain('9002');
  });

  it('resolves deictic RingCentral BE references from the current context', async () => {
    const now = Math.floor(Date.now() / 1000);
    const backendContent =
      'Ivan said AI Generated VBG backend BE has pending work on RCV-148412 and RCV-148411 before it can be called ready.';
    const dailyLimitContent =
      'AI Generated VBG daily generation limit is 20 per day and retry-after should be returned on quota errors.';
    const rows = [
      {
        id: 'vbg-backend-pending',
        chunkId: 9060,
        content: backendContent,
        hash: 'hash-vbg-backend-pending',
      },
      {
        id: 'vbg-daily-limit',
        chunkId: 9061,
        content: dailyLimitContent,
        hash: 'hash-vbg-daily-limit',
      },
    ];

    for (const row of rows) {
      db.prepare(
        `INSERT INTO messages_raw
          (id, content, source_type, source_url, source_title, sender, group_id,
           group_name, timestamp, importance, sentiment, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.id,
        row.content,
        'glip',
        `https://app.ringcentral.com/messages/${row.id}`,
        'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
        'Ivan Velencoso',
        'vbg-group',
        'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
        now - 600,
        0.85,
        'neutral',
        JSON.stringify({
          groupId: 'vbg-group',
          groupName:
            'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
        }),
        now - 600,
      );
      db.prepare(
        `INSERT INTO chunks
          (chunk_id, file_path, line_start, line_end, content, content_hash,
           scope, source, source_type, related_project, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.chunkId,
        `messages/${row.id}`,
        1,
        1,
        row.content,
        row.hash,
        'work',
        'glip',
        'glip',
        'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
        now - 600,
      );
      db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
        row.chunkId,
        row.content,
      );
    }

    db.prepare(
      `INSERT INTO conversation_context_frames
        (id, surface, source_type, conversation_id, group_id, title, summary,
         dominant_projects_json, topics_json, role_terms_json, source_anchors_json,
         confidence, window_start, window_end, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'glip:vbg-group',
      'glip',
      'glip',
      'vbg-group',
      'vbg-group',
      'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
      backendContent,
      JSON.stringify([
        'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
      ]),
      JSON.stringify(['VBG', 'AI Generated Background']),
      JSON.stringify(['backend']),
      JSON.stringify(['RCV-148412', 'RCV-148411']),
      0.9,
      now - 600,
      now - 600,
      now - 600,
      now - 600,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'follow_thread',
        contextType: 'message_thread',
        primaryText: '那个 BE ready 了吗',
        sourceContext: {
          groupId: 'vbg-group',
          conversationId: 'vbg-group',
          title:
            'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
        },
        currentContext: {
          groupId: 'vbg-group',
          conversationId: 'vbg-group',
          visibleMessages: [
            {
              sender: 'Ivan',
              text: 'For AI Generated VBG, backend pending work is on the thread.',
            },
          ],
        },
        sourceTypes: ['glip'],
        limit: 3,
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matches[0]?.id).toBe('9060');
    expect(body.matches.map((match: any) => match.id)).toContain('9060');
    expect(body.debug?.contextExpansion?.resolvedProject).toContain(
      'AI-Generated VBGs',
    );
    expect(body.debug?.contextExpansion?.resolvedRole).toBe('backend');
  });

  it('does not show a passive bubble when a deictic backend reference is ambiguous', async () => {
    const now = Math.floor(Date.now() / 1000);
    for (const [id, project] of [
      ['glip:vbg-be', 'AI Generated VBG'],
      ['glip:notes-be', 'AI Notes'],
    ]) {
      db.prepare(
        `INSERT INTO conversation_context_frames
          (id, surface, source_type, title, summary, dominant_projects_json,
           role_terms_json, confidence, window_start, window_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        'glip',
        'glip',
        project,
        `${project} backend BE status is being discussed.`,
        JSON.stringify([project]),
        JSON.stringify(['backend']),
        0.8,
        now - 300,
        now - 300,
        now - 300,
        now - 300,
      );
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'follow_thread',
        contextType: 'message_thread',
        primaryText: '那个 BE ready 了吗',
        sourceTypes: ['glip'],
        limit: 3,
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matches).toEqual([]);
    expect(body.topMatch).toBeNull();
    expect(body.debug?.rejectedReason).toBe('ambiguous_context');
    expect(body.debug?.contextExpansion?.ambiguity?.state).toBe('ambiguous');
  });

  it('responds quickly (<200ms in the in-memory test harness)', async () => {
    const started = Date.now();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        primaryText: 'Project Falcon launch readiness review',
        limit: 3,
      },
    });
    const elapsed = Date.now() - started;
    expect(res.statusCode).toBe(200);
    expect(elapsed).toBeLessThan(500);
    const body = res.json();
    expect(body.queryTimeMs).toBeLessThan(500);
  });
});
