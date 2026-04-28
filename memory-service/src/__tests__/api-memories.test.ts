import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

describe('Memories API', () => {
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
    db.prepare('DELETE FROM memory_metadata').run();
    db.prepare('DELETE FROM chunks').run();
    db.prepare('DELETE FROM messages_raw').run();
  });

  it('deletes only the matching source within the requested scope and defaults scope to work', async () => {
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO messages_raw
        (id, content, scope, source, source_type, timestamp, importance, sentiment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'work-alpha',
      'Work alpha memory',
      'work',
      'alpha',
      'manual',
      now,
      0.7,
      'neutral',
      now,
      'personal-alpha',
      'Personal alpha memory',
      'personal',
      'alpha',
      'manual',
      now,
      0.7,
      'neutral',
      now,
      'work-beta',
      'Work beta memory',
      'work',
      'beta',
      'manual',
      now,
      0.7,
      'neutral',
      now,
    );

    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_entity_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      201,
      'messages/work-alpha',
      1,
      1,
      'Work alpha chunk',
      'hash-work-alpha',
      'work',
      'alpha',
      'manual',
      'work-alpha',
      now,
      202,
      'messages/personal-alpha',
      1,
      1,
      'Personal alpha chunk',
      'hash-personal-alpha',
      'personal',
      'alpha',
      'manual',
      'personal-alpha',
      now,
      203,
      'messages/work-beta',
      1,
      1,
      'Work beta chunk',
      'hash-work-beta',
      'work',
      'beta',
      'manual',
      'work-beta',
      now,
    );

    db.prepare(
      `INSERT INTO memory_metadata (target_type, target_id, salience_score, created_at)
       VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)`,
    ).run(
      'message',
      'work-alpha',
      0.6,
      now,
      'message',
      'personal-alpha',
      0.6,
      now,
      'message',
      'work-beta',
      0.6,
      now,
      'chunk',
      '201',
      0.6,
      now,
      'chunk',
      '202',
      0.6,
      now,
      'chunk',
      '203',
      0.6,
      now,
    );

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/memories?source=alpha',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      source: 'alpha',
      scope: 'work',
      deletedMessages: 1,
      deletedChunks: 1,
    });

    const remainingMessageIds = db
      .prepare('SELECT id FROM messages_raw ORDER BY id')
      .all() as Array<{ id: string }>;
    expect(remainingMessageIds.map((row) => row.id)).toEqual([
      'personal-alpha',
      'work-beta',
    ]);

    const remainingChunkIds = db
      .prepare('SELECT chunk_id FROM chunks ORDER BY chunk_id')
      .all() as Array<{ chunk_id: number }>;
    expect(remainingChunkIds.map((row) => row.chunk_id)).toEqual([202, 203]);

    const remainingMetadata = db
      .prepare(
        'SELECT target_type, target_id FROM memory_metadata ORDER BY target_type, target_id',
      )
      .all() as Array<{ target_type: string; target_id: string }>;
    expect(remainingMetadata).toEqual([
      { target_type: 'chunk', target_id: '202' },
      { target_type: 'chunk', target_id: '203' },
      { target_type: 'message', target_id: 'personal-alpha' },
      { target_type: 'message', target_id: 'work-beta' },
    ]);
  });
});
