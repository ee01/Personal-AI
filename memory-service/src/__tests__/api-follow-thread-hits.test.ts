import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

describe('Follow Thread Hits API', () => {
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

  it('POST /api/v1/follow-thread-hits → creates a hit event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/follow-thread-hits',
      payload: {
        followItemId: 'follow-1',
        postId: 'post-1',
        sender: 'Ada',
        datetime: '2026-03-16T09:00:00.000Z',
        relationType: 'thread_reply',
        summary: 'RCV backend is done',
        teamId: 'team-1',
        createdAt: '2026-03-16T09:05:00.000Z',
        sourceDevice: 'device-b',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('created');
    expect(body.hit.followItemId).toBe('follow-1');
    expect(body.hit.postId).toBe('post-1');
    expect(body.hit.sourceDevice).toBe('device-b');
  });

  it('POST /api/v1/follow-thread-hits duplicate → returns duplicate without inserting twice', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/follow-thread-hits',
      payload: {
        followItemId: 'follow-1',
        postId: 'post-1',
        sender: 'Ada',
        datetime: '2026-03-16T09:00:00.000Z',
        relationType: 'thread_reply',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('duplicate');
    expect(body.hit.followItemId).toBe('follow-1');
    expect(body.hit.postId).toBe('post-1');
  });

  it('GET /api/v1/follow-thread-hits → returns filtered hit events in created order', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/follow-thread-hits',
      payload: {
        followItemId: 'follow-2',
        postId: 'post-2',
        sender: 'Bob',
        datetime: '2026-03-16T10:00:00.000Z',
        relationType: 'mention',
        createdAt: '2026-03-16T10:01:00.000Z',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/follow-thread-hits?followItemIds=follow-1,follow-2&since=2026-03-16T09:04:00.000Z',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(2);
    expect(body.items.map((item: { followItemId: string }) => item.followItemId)).toEqual([
      'follow-1',
      'follow-2',
    ]);
    expect(body.nextSince).toBe('2026-03-16T10:01:00.000Z');
  });
});
