import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

describe('Concerned Items API', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;
  const initialContentUpdatedAt = '2026-03-17T10:30:00.000Z';

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/concerned-items → returns empty snapshot by default', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/concerned-items',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toEqual([]);
    expect(body.version).toBe(0);
    expect(body.updatedAt).toBeNull();
  });

  it('PUT /api/v1/concerned-items → persists snapshot and increments version', async () => {
    const payload = [
      { id: 'topic-1', text: 'Track RCV updates', notifyMethod: 'bot' },
      { id: 'topic-2', text: 'Watch follow thread', followThread: true },
    ];

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/concerned-items',
      payload: {
        items: payload,
        baseVersion: 0,
        contentUpdatedAt: initialContentUpdatedAt,
        updatedByDevice: 'device-a',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toEqual(payload);
    expect(body.version).toBe(1);
    expect(body.updatedByDevice).toBe('device-a');
    expect(typeof body.updatedAt).toBe('string');
    expect(body.contentUpdatedAt).toBe(initialContentUpdatedAt);
  });

  it('GET /api/v1/concerned-items after update → returns stored snapshot', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/concerned-items',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.version).toBe(1);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].id).toBe('topic-1');
    expect(body.contentUpdatedAt).toBe(initialContentUpdatedAt);
  });

  it('PUT /api/v1/concerned-items with stale version and older contentUpdatedAt → 409', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/concerned-items',
      payload: {
        items: [{ id: 'topic-3', text: 'stale write' }],
        baseVersion: 0,
        contentUpdatedAt: '2026-03-17T10:29:00.000Z',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error).toContain('version conflict');
    expect(body.current.version).toBe(1);
    expect(body.current.items).toHaveLength(2);
    expect(body.current.contentUpdatedAt).toBe(initialContentUpdatedAt);
  });

  it('PUT /api/v1/concerned-items with stale version but newer contentUpdatedAt → overwrites current snapshot', async () => {
    const payload = [{ id: 'topic-5', text: 'latest edit wins' }];
    const contentUpdatedAt = '2026-03-17T10:32:00.000Z';
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/concerned-items',
      payload: {
        items: payload,
        baseVersion: 0,
        contentUpdatedAt,
        updatedByDevice: 'device-b',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.version).toBe(2);
    expect(body.items).toEqual(payload);
    expect(body.updatedByDevice).toBe('device-b');
    expect(body.contentUpdatedAt).toBe(contentUpdatedAt);
  });

  it('GET /api/v1/concerned-items after newer stale write → returns latest snapshot', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/concerned-items',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.version).toBe(2);
    expect(body.items).toEqual([{ id: 'topic-5', text: 'latest edit wins' }]);
    expect(body.contentUpdatedAt).toBe('2026-03-17T10:32:00.000Z');
  });
});
