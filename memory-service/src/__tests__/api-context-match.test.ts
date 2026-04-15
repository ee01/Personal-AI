import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi.fn().mockResolvedValue({
      embed: vi.fn().mockResolvedValue(Array.from({ length: 384 }, () => 0)),
    }),
  },
}));

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

describe('Context Match API', () => {
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
    db.prepare('DELETE FROM chunks_vec').run();
    db.prepare('DELETE FROM chunks').run();
  });

  it('does not surface meeting chunks even when they match strongly', async () => {
    db.prepare(
      `INSERT INTO chunks (chunk_id, file_path, line_start, line_end, content, content_hash, source_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      1,
      'meetings/meeting-1.md',
      1,
      3,
      'Q2 预算会议总结：预算确认 200 万。',
      'hash-meeting-1',
      'meeting',
      Math.floor(Date.now() / 1000),
    );
    db.prepare(
      `INSERT INTO chunks_vec (chunk_id, embedding) VALUES (CAST(? AS INTEGER), ?)`,
    ).run(1, JSON.stringify(Array.from({ length: 384 }, () => 0)));

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-match',
      payload: {
        title: 'Q2 预算',
        snippet: '预算确认',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ match: null });
  });

  it('returns reflection-like matches when available and still ignores meeting chunks', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO chunks (chunk_id, file_path, line_start, line_end, content, content_hash, source_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      1,
      'meetings/meeting-1.md',
      1,
      3,
      'Q2 预算会议总结：预算确认 200 万。',
      'hash-meeting-1',
      'meeting',
      now,
      2,
      'reflection-threads/thread-1.md',
      1,
      4,
      '我在反思线程里记录：Q2 预算决策说明团队现在更适合保守排期。',
      'hash-reflection-1',
      'reflection_thread',
      now,
    );
    db.prepare(
      `INSERT INTO chunks_vec (chunk_id, embedding) VALUES (CAST(? AS INTEGER), ?), (CAST(? AS INTEGER), ?)`,
    ).run(
      1,
      JSON.stringify(Array.from({ length: 384 }, () => 0)),
      2,
      JSON.stringify(Array.from({ length: 384 }, () => 0)),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-match',
      payload: {
        title: 'Q2 预算',
        snippet: '预算确认',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.match).toBeTruthy();
    expect(body.match.source).toContain('reflection-threads/thread-1.md');
    expect(body.match.content).toContain('我在反思线程里记录');
    expect(body.match.displayText).toContain('我在反思线程里记录');
    expect(body.match.previewText.length).toBeGreaterThan(0);
  });
});
