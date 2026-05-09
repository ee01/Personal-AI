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

describe('Context Assist API (POST /context-assist)', () => {
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
    db.prepare('DELETE FROM messages_raw').run();
    db.prepare('DELETE FROM chunks').run();
    db.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`).run();

    const now = Math.floor(Date.now() / 1000);
    insertChunk({
      id: 9301,
      content:
        'Nova weekly sync should cover leads handoff progress and unresolved Rooms dependency.',
      sourceType: 'glip',
      source: 'glip',
      createdAt: now - 80,
    });
    insertChunk({
      id: 9302,
      content:
        'Calendar event: Nova leads internal weekly sync up with Sophia and Fred.',
      sourceType: 'calendar',
      source: 'ringcentral_indexeddb',
      createdAt: now - 30,
    });
  });

  function insertChunk(args: {
    id: number;
    content: string;
    sourceType: string;
    source: string;
    createdAt: number;
  }): void {
    const messageId = `context-assist-${args.id}`;
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source, source_url, source_title, sender, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      messageId,
      args.content,
      args.sourceType,
      args.source,
      `https://internal.example.com/context-assist/${args.id}`,
      `Context assist source ${args.id}`,
      'memory-service-test',
      'Context Assist',
      args.createdAt,
      0.8,
      'neutral',
      JSON.stringify({}),
      args.createdAt,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, related_entity_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'work', ?, ?, ?, ?, ?)`,
    ).run(
      args.id,
      `messages/${messageId}`,
      1,
      1,
      args.content,
      `hash-${args.id}`,
      args.source,
      args.sourceType,
      'Nova',
      messageId,
      args.createdAt,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      args.id,
      args.content,
    );
  }

  it('returns a meeting prep brief with cue cards and evidence', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-assist',
      payload: {
        surface: 'meeting_prep',
        contextType: 'meeting',
        title: 'Nova weekly sync',
        userGoal: 'sync leads handoff dependency progress',
        event: {
          externalId: 'rc-event-1',
          title: 'Nova leads internal weekly sync up',
          startTime: Date.now() + 15 * 60 * 1000,
          organizer: { name: 'Sophia' },
          attendees: [{ name: 'Fred' }, { name: 'Esone' }],
          cancelled: false,
          lastModifiedTime: Date.now(),
          metadata: {
            provider: 'ringcentral_indexeddb',
            responseStatus: 'accepted',
          },
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.surface).toBe('meeting_prep');
    expect(body.suggestionType).toBe('meeting_brief');
    expect(body.cueCards.length).toBeGreaterThan(0);
    expect(body.evidence.length).toBeGreaterThan(0);
    expect(body.evidence[0].links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '打开来源',
          url: expect.stringMatching(/^https:\/\/internal\.example\.com\/context-assist\//),
        }),
      ]),
    );
    expect(body.insertText).toContain('Personal AI meeting prep');
  });

  it('supports composer_guard through the unified route', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-assist',
      payload: {
        surface: 'composer_guard',
        contextType: 'message_thread',
        composer: {
          surface: 'ringcentral_message',
          contextType: 'message_thread',
          title: 'Nova weekly sync',
          primaryText:
            'Nova weekly sync should cover leads handoff progress and unresolved Rooms dependency',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.surface).toBe('composer_guard');
    expect(body.suggestionType).toBe('reply_context');
    expect(body.evidence.length).toBeGreaterThan(0);
  });
});
