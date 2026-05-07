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

describe('Recall API', () => {
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
    db.prepare('DELETE FROM chunks').run();
    db.prepare(
      `INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`,
    ).run();
    db.prepare('DELETE FROM messages_raw').run();

    const currentTime = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'meeting-memory-1',
      'During the Q2 planning review, Alex said Esone should lead the Meeting Pilot technical review.',
      'meeting',
      'https://memory.example.com/meetings/meeting-memory-1',
      'Q2 Planning Review — Meeting Memory',
      'meeting-pilot',
      'meeting-memory-1',
      'Q2 Planning Review',
      currentTime - 120,
      0.95,
      'neutral',
      JSON.stringify({
        participants: ['Alex Chen', 'Esone Qiu'],
        pdfUrl: 'https://memory.example.com/meetings/meeting-memory-1.pdf',
      }),
      currentTime - 120,
    );
  });

  it('returns sourceUrl and sourceTitle for meeting recall items', async () => {
    const now = Math.floor(Date.now() / 1000);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/recall',
      payload: {
        query: 'recent meeting memories',
        topK: 5,
        channels: ['time'],
        timeRange: {
          start: now - 3600,
          end: now + 60,
        },
        sourceTypes: ['meeting'],
        includeMetadata: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.items[0].id).toBe('meeting-memory-1');
    expect(body.items[0].source).toBe('meeting');
    expect(body.items[0].sourceUrl).toBe(
      'https://memory.example.com/meetings/meeting-memory-1',
    );
    expect(body.items[0].sourceTitle).toBe(
      'Q2 Planning Review — Meeting Memory',
    );
    expect(body.items[0].displayTitle).toBe('Q2 Planning Review');
    expect(body.items[0].displayText).toContain('Esone should lead');
    expect(body.items[0].previewText.length).toBeGreaterThan(0);
  });

  it('includes meeting records in generic recall when no sourceTypes filter is provided', async () => {
    const now = Math.floor(Date.now() / 1000);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/recall',
      payload: {
        query: 'Q2 planning review',
        topK: 5,
        channels: ['time'],
        timeRange: {
          start: now - 3600,
          end: now + 60,
        },
        includeMetadata: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.items.some((item: any) => item.source === 'meeting')).toBe(
      true,
    );
  });

  it('defaults recall scope to work and excludes personal memories', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, scope, source_type, sender, group_name, timestamp, importance, sentiment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'personal-memory-1',
      'Personal note about private budget planning.',
      'personal',
      'manual',
      'self',
      'Personal',
      now - 30,
      0.8,
      'neutral',
      now - 30,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/recall',
      payload: {
        query: 'planning',
        topK: 10,
        channels: ['time'],
        timeRange: {
          start: now - 3600,
          end: now + 60,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.map((item: any) => item.id)).toContain(
      'meeting-memory-1',
    );
    expect(body.items.map((item: any) => item.id)).not.toContain(
      'personal-memory-1',
    );
  });

  it('treats all scope as both work and personal memories', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, scope, source_type, sender, group_name, timestamp, importance, sentiment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'personal-memory-1',
      'Personal note about private budget planning.',
      'personal',
      'manual',
      'self',
      'Personal',
      now - 30,
      0.8,
      'neutral',
      now - 30,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/recall',
      payload: {
        query: 'planning',
        topK: 10,
        channels: ['time'],
        timeRange: {
          start: now - 3600,
          end: now + 60,
        },
        scope: 'all',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.map((item: any) => item.id)).toContain(
      'meeting-memory-1',
    );
    expect(body.items.map((item: any) => item.id)).toContain(
      'personal-memory-1',
    );
  });

  it('applies scope filtering to chunk recall and returns both only when explicitly requested', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      101,
      'messages/work-memory',
      1,
      1,
      'Roadmap milestone for the work launch plan.',
      'hash-work-memory',
      'work',
      'sync-a',
      'manual',
      'Launch',
      now,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      102,
      'messages/personal-memory',
      1,
      1,
      'Roadmap milestone for the personal travel plan.',
      'hash-personal-memory',
      'personal',
      'sync-a',
      'manual',
      'Travel',
      now,
    );
    db.prepare(
      `INSERT INTO chunks_fts(rowid, content) VALUES (?, ?), (?, ?)`,
    ).run(
      101,
      'Roadmap milestone for the work launch plan.',
      102,
      'Roadmap milestone for the personal travel plan.',
    );

    const workOnlyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/recall',
      payload: {
        query: 'roadmap milestone',
        topK: 10,
        channels: ['fts'],
      },
    });

    expect(workOnlyRes.statusCode).toBe(200);
    const workOnlyBody = workOnlyRes.json();
    expect(workOnlyBody.items.map((item: any) => item.id)).toContain('101');
    expect(workOnlyBody.items.map((item: any) => item.id)).not.toContain('102');

    const bothRes = await app.inject({
      method: 'POST',
      url: '/api/v1/recall',
      payload: {
        query: 'roadmap milestone',
        topK: 10,
        channels: ['fts'],
        scope: 'both',
      },
    });

    expect(bothRes.statusCode).toBe(200);
    const bothBody = bothRes.json();
    expect(bothBody.items.map((item: any) => item.id)).toContain('101');
    expect(bothBody.items.map((item: any) => item.id)).toContain('102');

    const allRes = await app.inject({
      method: 'POST',
      url: '/api/v1/recall',
      payload: {
        query: 'roadmap milestone',
        topK: 10,
        channels: ['fts'],
        scope: 'all',
      },
    });

    expect(allRes.statusCode).toBe(200);
    const allBody = allRes.json();
    expect(allBody.items.map((item: any) => item.id)).toContain('101');
    expect(allBody.items.map((item: any) => item.id)).toContain('102');
  });

  it('returns compact preview text while preserving full cleaned display text', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare('DELETE FROM messages_raw').run();
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'meeting-memory-2',
      `<a class='at_mention_compose' rel='{"id":17215389699}'>@Esone Qiu</a> wrote:
> QA 资源排期曾延迟，Sarah 建议提前锁定。

__回复建议__：可以回复确认风险和 owner。

🔗 [点击查看原消息](https://app.ringcentral.com/example)
*以上是 Personal AI 监测到您可能关注的消息*`,
      'meeting',
      'https://memory.example.com/meetings/meeting-memory-2',
      'QA 风险复盘 — Meeting Memory',
      'meeting-pilot',
      'meeting-memory-2',
      'QA 风险复盘',
      now - 120,
      0.95,
      'neutral',
      JSON.stringify({ owner: 'Sarah Wang' }),
      now - 120,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/recall',
      payload: {
        query: 'QA 资源排期 提前锁定',
        topK: 5,
        channels: ['time'],
        timeRange: {
          start: now - 3600,
          end: now + 60,
        },
        sourceTypes: ['meeting'],
        presentationHint: 'meeting_pilot',
        previewMaxLength: 32,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items[0].content).toContain('__回复建议__');
    expect(body.items[0].displayText).toContain('QA 资源排期曾延迟');
    expect(body.items[0].displayText).not.toContain('__回复建议__');
    expect(body.items[0].displayText).not.toContain('点击查看原消息');
    expect(body.items[0].previewText.length).toBeLessThanOrEqual(35);
  });
});
