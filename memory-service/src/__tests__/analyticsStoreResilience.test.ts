/**
 * Analytics DB resilience: retention pruning, best-effort writes, and a
 * readable 503 (instead of a raw SQLITE_CORRUPT 500) when usage.db is damaged.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../server.js';
import { UserContextManager } from '../core/UserContextManager.js';
import { getConfig, resetConfigForTests } from '../config.js';
import {
  AnalyticsStore,
  closeAnalyticsStore,
  getAnalyticsStore,
  isAnalyticsCorruptionError,
} from '../analytics/AnalyticsStore.js';
import { signUsageToken } from '../analytics/usageToken.js';

const SECRET = 'test-analytics-secret';
const DAY_MS = 86_400_000;

describe('Analytics store resilience', () => {
  let tempDir: string;
  const prevEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const key of [
      'DATA_DIR',
      'ANALYTICS_RETENTION_DAYS',
      'ANALYTICS_API_RETENTION_DAYS',
      'ANALYTICS_TOKEN_SECRET',
      'API_KEY',
    ]) {
      prevEnv[key] = process.env[key];
    }
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analytics-resilience-'));
    process.env.DATA_DIR = tempDir;
    process.env.ANALYTICS_RETENTION_DAYS = '60';
    process.env.ANALYTICS_API_RETENTION_DAYS = '30';
    process.env.ANALYTICS_TOKEN_SECRET = SECRET;
    delete process.env.API_KEY;
    resetConfigForTests();
  });

  afterAll(() => {
    closeAnalyticsStore();
    fs.rmSync(tempDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(prevEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetConfigForTests();
  });

  it('classifies only file-level damage as corruption', () => {
    expect(
      isAnalyticsCorruptionError(
        Object.assign(new Error('boom'), { code: 'SQLITE_CORRUPT' }),
      ),
    ).toBe(true);
    expect(
      isAnalyticsCorruptionError(new Error('database disk image is malformed')),
    ).toBe(true);
    expect(
      isAnalyticsCorruptionError(
        Object.assign(new Error('busy'), { code: 'SQLITE_BUSY' }),
      ),
    ).toBe(false);
  });

  it('honors the configured journal mode instead of forcing WAL', () => {
    const journalModeAt = (dir: string): string => {
      const store = new AnalyticsStore(path.join(tempDir, dir, 'usage.db'));
      const mode = store.raw.pragma('journal_mode', { simple: true });
      store.close();
      return String(mode).toLowerCase();
    };

    process.env.SQLITE_JOURNAL_MODE = 'DELETE';
    resetConfigForTests();
    expect(journalModeAt('journal-global')).toBe('delete');

    // The analytics-specific override wins over the service-wide setting.
    process.env.SQLITE_JOURNAL_MODE = 'WAL';
    process.env.ANALYTICS_SQLITE_JOURNAL_MODE = 'DELETE';
    resetConfigForTests();
    expect(journalModeAt('journal-override')).toBe('delete');

    delete process.env.SQLITE_JOURNAL_MODE;
    delete process.env.ANALYTICS_SQLITE_JOURNAL_MODE;
    resetConfigForTests();
  });

  it('prunes each raw table on its own retention window', () => {
    const dbPath = path.join(tempDir, 'prune', 'usage.db');
    const store = new AnalyticsStore(dbPath);
    const now = Date.now();
    const apiCall = (ts: number) =>
      store.recordApiCall({
        ts,
        route: '/api/v1/recall',
        method: 'POST',
        status: 200,
      });

    store.recordUsageEvent({ side: 'backend', ts: now - 45 * DAY_MS });
    store.recordUsageEvent({ side: 'backend', ts: now });
    // Older than the 30d api window but inside the 60d usage window.
    apiCall(now - 45 * DAY_MS);
    apiCall(now);

    const pruned = store.pruneOldEvents(now);
    expect(pruned).toEqual({ usageEvents: 0, apiCallEvents: 1 });
    expect(store.pruneOldEvents(now + 20 * DAY_MS)).toEqual({
      usageEvents: 1,
      apiCallEvents: 0,
    });

    const remaining = store.raw
      .prepare('SELECT COUNT(*) AS n FROM usage_events')
      .get() as { n: number };
    expect(remaining.n).toBe(1);
    expect(getConfig().analyticsRetentionDays).toBe(60);
    expect(getConfig().analyticsApiRetentionDays).toBe(30);
    store.close();
  });

  it('never throws out of the telemetry write path', () => {
    const dbPath = path.join(tempDir, 'writes', 'usage.db');
    const store = new AnalyticsStore(dbPath);
    store.raw.exec('DROP TABLE api_call_events');
    expect(() =>
      store.recordApiCall({
        route: '/api/v1/recall',
        method: 'POST',
        status: 200,
      }),
    ).not.toThrow();
    store.close();
  });

  describe('report route', () => {
    let app: FastifyInstance;
    let userContextManager: UserContextManager;
    let token: string;

    beforeAll(async () => {
      userContextManager = new UserContextManager(
        path.join(tempDir, 'users-root'),
      );
      const result = await buildApp({ userContextManager });
      app = result.app;
      await app.ready();
      token = signUsageToken({
        userId: 'esone.qiu',
        scope: 'self',
        secret: SECRET,
      }).token;
    });

    afterAll(async () => {
      await app.close();
      userContextManager.closeAll();
    });

    it('answers 503 with repair guidance when the DB is corrupt', async () => {
      const store = getAnalyticsStore();
      expect(store).not.toBeNull();
      const spy = vi
        .spyOn(store!, 'getUsageAggregate')
        .mockImplementation(() => {
          throw Object.assign(new Error('database disk image is malformed'), {
            code: 'SQLITE_CORRUPT',
          });
        });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/usage/report?range=7d&token=${encodeURIComponent(token)}`,
      });
      spy.mockRestore();

      expect(res.statusCode).toBe(503);
      expect(res.json().error).toBe('analytics_store_corrupt');
      expect(res.json().message).toContain('repair:analytics');
      expect(store!.isCorrupt).toBe(true);
    });
  });
});
