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
    db.prepare('DELETE FROM memory_feedback_events').run();
    db.prepare('DELETE FROM memory_metadata').run();
    db.prepare('DELETE FROM relationships').run();
    db.prepare('DELETE FROM entities').run();
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

  it('includes persisted recall feedback when metadata is requested', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO memory_feedback_events
        (feedback_type, target_type, target_id, action, created_at, updated_at)
       VALUES ('recall_quality', 'message', ?, 'negative', ?, ?)`,
    ).run('meeting-memory-1', now, now);

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
        includeMetadata: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const item = body.items.find((entry: any) => entry.id === 'meeting-memory-1');
    expect(item?.metadata?.recallFeedback).toBe('negative');
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

  it('keeps graph entity recall inside the requested memory scope', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO entities
        (id, type, name, description, importance, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'entity-private-trip',
      'Project',
      'Private Trip Plan',
      'A personal travel planning topic.',
      0.9,
      'active',
      now,
    );
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, scope, source_type, sender, group_name, timestamp, importance, sentiment, entities_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'personal-trip-message',
      'Private Trip Plan has a hotel shortlist and family budget notes.',
      'personal',
      'manual',
      'self',
      'Personal',
      now - 30,
      0.8,
      'neutral',
      JSON.stringify([{ id: 'entity-private-trip', name: 'Private Trip Plan' }]),
      now - 30,
    );

    const workRes = await app.inject({
      method: 'POST',
      url: '/api/v1/recall',
      payload: {
        query: 'Private Trip Plan',
        topK: 5,
        channels: ['graph'],
        includeMetadata: true,
      },
    });

    expect(workRes.statusCode).toBe(200);
    expect(workRes.json().items.map((item: any) => item.id)).not.toContain(
      'entity-private-trip',
    );

    const personalRes = await app.inject({
      method: 'POST',
      url: '/api/v1/recall',
      payload: {
        query: 'Private Trip Plan',
        topK: 5,
        channels: ['graph'],
        scope: 'personal',
        includeMetadata: true,
      },
    });

    expect(personalRes.statusCode).toBe(200);
    const personalBody = personalRes.json();
    const personalEntity = personalBody.items.find(
      (item: any) => item.id === 'entity-private-trip',
    );
    expect(personalEntity).toMatchObject({
      id: 'entity-private-trip',
      type: 'entity',
      scope: 'personal',
    });
    expect(personalEntity.metadata.scopeEvidenceCount).toBe(1);

    const allRes = await app.inject({
      method: 'POST',
      url: '/api/v1/recall',
      payload: {
        query: 'Private Trip Plan',
        topK: 5,
        channels: ['graph'],
        scope: 'all',
      },
    });

    expect(allRes.statusCode).toBe(200);
    expect(allRes.json().items.map((item: any) => item.id)).toContain(
      'entity-private-trip',
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

  it('keeps message and chunk recall results separate when their ids collide', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare('DELETE FROM chunks').run();
    db.prepare(
      `INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`,
    ).run();
    db.prepare('DELETE FROM messages_raw').run();

    db.prepare(
      `INSERT INTO messages_raw
        (id, content, scope, source_type, sender, group_name, timestamp, importance, sentiment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      '101',
      'Collision planning message evidence from the raw timeline.',
      'work',
      'manual',
      'Alice',
      'Planning',
      now - 30,
      0.8,
      'neutral',
      now - 30,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      101,
      'notes/collision-planning.md',
      1,
      1,
      'Collision planning chunk evidence from a markdown note.',
      'hash-collision-planning',
      'work',
      'notes',
      'manual',
      'Planning',
      now - 20,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      101,
      'Collision planning chunk evidence from a markdown note.',
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/recall',
      payload: {
        query: 'collision planning evidence',
        topK: 10,
        channels: ['fts', 'time'],
        timeRange: {
          start: now - 120,
          end: now + 10,
        },
        includeMetadata: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const resultKeys = body.items.map((item: any) => `${item.type}:${item.id}`);

    expect(resultKeys).toContain('message:101');
    expect(resultKeys).toContain('chunk:101');
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

  it('uses text similarity to diversify time-window recall results', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare('DELETE FROM messages_raw').run();
    const insertMessage = db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, sender, group_name, timestamp, importance, sentiment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    insertMessage.run(
      'mmr-dup-new',
      'Alpha launch risk owner Sarah confirmed migration blocker.',
      'manual',
      'Sarah',
      'Launch',
      now - 10,
      0.8,
      'neutral',
      now - 10,
    );
    insertMessage.run(
      'mmr-dup-old',
      'Alpha launch risk owner Sarah confirmed migration blocker.',
      'manual',
      'Sarah',
      'Launch',
      now - 20,
      0.8,
      'neutral',
      now - 20,
    );
    insertMessage.run(
      'mmr-diverse',
      'Beta onboarding risk owner Nina flagged analytics blocker.',
      'manual',
      'Nina',
      'Onboarding',
      now - 30,
      0.8,
      'neutral',
      now - 30,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/recall',
      payload: {
        query: 'recent project risk owner blocker',
        topK: 2,
        channels: ['time'],
        timeRange: {
          start: now - 120,
          end: now + 10,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const ids = body.items.map((item: any) => item.id);

    expect(ids).toContain('mmr-dup-new');
    expect(ids).toContain('mmr-diverse');
    expect(ids).not.toContain('mmr-dup-old');
  });

  it('reinforces graph entity recall using the entity target type', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO entities
        (id, type, name, description, importance, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'entity-orion-launch',
      'Project',
      'Orion Launch',
      'Release coordination project for Orion.',
      0.9,
      'active',
      now,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/recall',
      payload: {
        query: 'Orion Launch',
        topK: 1,
        channels: ['graph'],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items[0].id).toBe('entity-orion-launch');

    const entityMeta = db
      .prepare(
        `SELECT access_count
         FROM memory_metadata
         WHERE target_type = 'entity' AND target_id = ?`,
      )
      .get('entity-orion-launch') as { access_count: number } | undefined;
    const messageMeta = db
      .prepare(
        `SELECT access_count
         FROM memory_metadata
         WHERE target_type = 'message' AND target_id = ?`,
      )
      .get('entity-orion-launch') as { access_count: number } | undefined;

    expect(entityMeta?.access_count).toBe(1);
    expect(messageMeta).toBeUndefined();
  });
});
