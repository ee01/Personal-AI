import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';
import { resolveEventStreamUserId } from '../routes/events.js';
import { buildApp } from '../server.js';
import { cleanupTestDb, getTestDb } from './setup.js';

describe('events stream user isolation', () => {
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

  it('prefers a validated EventSource query userId over auth fallback', () => {
    const resolved = resolveEventStreamUserId({
      requestUserId: 'default',
      queryUserId: 'alice.user',
    });

    expect(resolved).toEqual({ userId: 'alice.user' });
  });

  it('falls back to the middleware userId when no query userId is present', () => {
    const resolved = resolveEventStreamUserId({
      requestUserId: 'bob-user',
    });

    expect(resolved).toEqual({ userId: 'bob-user' });
  });

  it('rejects unsafe EventSource query userIds', () => {
    const resolved = resolveEventStreamUserId({
      requestUserId: 'default',
      queryUserId: '../alice',
    });

    expect(resolved.userId).toBeUndefined();
    expect(resolved.error).toContain('Invalid userId query parameter format');
  });

  it('rejects unsafe userId query parameters before opening the route stream', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/events?userId=..%2Falice',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('Invalid userId query parameter format');
  });
});
