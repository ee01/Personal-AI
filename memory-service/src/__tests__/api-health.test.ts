/**
 * Integration tests for health and stats API endpoints.
 *
 * Uses Fastify's inject() method — no real HTTP server is started.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../server.js';
import { getTestDb, cleanupTestDb } from './setup.js';
import type BetterSqlite3 from 'better-sqlite3';
import { UserContextManager } from '../core/UserContextManager.js';
import { resolveUserIdHeader } from '../utils/userIdentity.js';

describe('Health & Stats API', () => {
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

  // -------------------------------------------------------------------
  // GET /api/v1/health
  // -------------------------------------------------------------------
  it('GET /api/v1/health → 200 with status, database, embedding fields', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toHaveProperty('status');
    expect(['ok', 'degraded', 'error']).toContain(body.status);
    expect(body).toHaveProperty('database');
    expect(body.database).toHaveProperty('connected');
    expect(body.database).toHaveProperty('messageCount');
    expect(body.database).toHaveProperty('entityCount');
    expect(body.database).toHaveProperty('chunkCount');
    expect(body).toHaveProperty('embedding');
    expect(body.embedding).toHaveProperty('loaded');
    expect(body.embedding).toHaveProperty('model');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('uptime');
  });

  // -------------------------------------------------------------------
  // GET /api/v1/stats
  // -------------------------------------------------------------------
  it('GET /api/v1/stats → 200 with messages, entities, chunks fields', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/stats' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toHaveProperty('messages');
    expect(body.messages).toHaveProperty('total');
    expect(body.messages).toHaveProperty('today');
    expect(body.messages).toHaveProperty('thisWeek');
    expect(body.messages).toHaveProperty('last90Days');
    expect(body).toHaveProperty('entities');
    expect(body.entities).toHaveProperty('total');
    expect(body.entities).toHaveProperty('byType');
    expect(body).toHaveProperty('chunks');
    expect(body.chunks).toHaveProperty('total');
    expect(body).toHaveProperty('relationships');
    expect(body).toHaveProperty('watchedProjects');
    expect(body).toHaveProperty('notifications');
    expect(body).toHaveProperty('confirmRequests');
    expect(body).toHaveProperty('memory');
  });

  it('GET /api/v1/stats reports memory lifecycle counts from memory_metadata', async () => {
    const ts = Math.floor(Date.now() / 1000);
    db.prepare('DELETE FROM memory_metadata').run();
    db.prepare(
      `INSERT INTO memory_metadata
        (target_type, target_id, salience_score, effective_salience,
         retrieval_tier, consolidation_level, created_at, updated_at)
       VALUES
        ('message', 'stats-archived-memory', 0.1, 0.1, 'archive_only', 'archived', ?, ?),
        ('message', 'stats-forgotten-memory', 0.01, 0.01, 'forgotten', 'forgotten', ?, ?)`,
    ).run(ts, ts, ts, ts);

    const res = await app.inject({ method: 'GET', url: '/api/v1/stats' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.memory.archived).toBe(1);
    expect(body.memory.forgotten).toBe(1);
    expect(body.memory.retrievalTiers.archive_only).toBe(1);
    expect(body.memory.retrievalTiers.forgotten).toBe(1);
  });

  // -------------------------------------------------------------------
  // GET /health (top-level, no /api/v1 prefix)
  // -------------------------------------------------------------------
  it('GET /health (top-level) → 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('database');
    expect(body).toHaveProperty('embedding');
  });
});

describe('Stats user isolation metadata', () => {
  let app: FastifyInstance;
  let userContextManager: UserContextManager;
  let dataDir: string;

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-stats-user-'));
    userContextManager = new UserContextManager(dataDir);
    const result = await buildApp({ userContextManager });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    userContextManager.closeAll();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('GET /api/v1/stats reports the explicit per-user storage boundary', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/stats',
      headers: { 'X-User-Id': 'owner.alpha' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user).toEqual({
      id: 'owner.alpha',
      isolation: 'per_user_sqlite',
      storageKey: 'data/users/owner.alpha/memory.db',
      fallbackToDefault: false,
    });
    expect(
      fs.existsSync(path.join(dataDir, 'users', 'owner.alpha', 'memory.db')),
    ).toBe(true);
  });

  it('GET /api/v1/stats marks missing identity as default fallback', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/stats',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().user).toEqual({
      id: 'default',
      isolation: 'per_user_sqlite',
      storageKey: 'data/users/default/memory.db',
      fallbackToDefault: true,
    });
  });

  it('GET /api/v1/stats rejects duplicate user identity headers without fallback', async () => {
    expect(resolveUserIdHeader(['owner.alpha', 'other.user']).error).toContain(
      'Provide exactly one X-User-Id',
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/stats',
      headers: {
        'x-user-id': ['owner.alpha', 'other.user'] as any,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('Invalid X-User-Id format');
  });

  it('write routes require an explicit non-ambiguous user identity', async () => {
    const missing = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest',
      payload: {
        content: 'write guard should stop this before validation',
        sourceType: 'manual',
      },
    });
    expect(missing.statusCode).toBe(403);
    expect(missing.json().error).toContain('X-User-Id header is required');

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest',
      headers: {
        'x-user-id': ['owner.alpha', 'other.user'] as any,
      },
      payload: {
        content: 'duplicate identity should stop this before mutation',
        sourceType: 'manual',
      },
    });
    expect(duplicate.statusCode).toBe(400);
    expect(duplicate.json().error).toContain('Invalid X-User-Id format');
  });

  it('UserContextManager rejects unsafe direct user ids before creating storage', () => {
    expect(() => userContextManager.getContext('../owner')).toThrow(
      /Invalid userId format/,
    );
    expect(fs.existsSync(path.join(dataDir, 'owner'))).toBe(false);
  });

  it('public skill share tokens cannot select unsafe user directories', async () => {
    const unsafeToken = `${Buffer.from('../shared-owner').toString(
      'base64url',
    )}.not-a-real-token`;
    const res = await app.inject({
      method: 'GET',
      url: `/skills/demo@1.0.0?token=${encodeURIComponent(unsafeToken)}`,
    });

    expect(res.statusCode).toBe(404);
    expect(fs.existsSync(path.join(dataDir, 'shared-owner'))).toBe(false);
  });
});
