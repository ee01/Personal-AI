/**
 * Signed usage-dashboard links must survive the global auth middleware:
 * the browser opens them with no Authorization header, only ?token=.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../server.js';
import { UserContextManager } from '../core/UserContextManager.js';
import { resetConfigForTests } from '../config.js';
import { signUsageToken } from '../analytics/usageToken.js';

const SECRET = 'test-analytics-secret';

describe('Usage dashboard auth', () => {
  let app: FastifyInstance;
  let userContextManager: UserContextManager;
  let tempDir: string;
  let token: string;
  const prevEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const key of ['API_KEY', 'BOOTSTRAP_API_KEY', 'ANALYTICS_TOKEN_SECRET']) {
      prevEnv[key] = process.env[key];
    }
    process.env.API_KEY = 'test-full-service-key';
    delete process.env.BOOTSTRAP_API_KEY;
    process.env.ANALYTICS_TOKEN_SECRET = SECRET;
    resetConfigForTests();

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-dashboard-auth-'));
    userContextManager = new UserContextManager(tempDir);
    const result = await buildApp({ userContextManager });
    app = result.app;
    await app.ready();

    token = signUsageToken({ userId: 'esone.qiu', scope: 'self', secret: SECRET })
      .token;
  });

  afterAll(async () => {
    await app.close();
    userContextManager.closeAll();
    fs.rmSync(tempDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(prevEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetConfigForTests();
  });

  it('serves the dashboard for a signed token without Authorization', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/usage/dashboard?token=${encodeURIComponent(token)}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });

  it('accepts the signed token from the X-Analytics-Token header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/usage/report?range=24h',
      headers: { 'x-analytics-token': token },
    });
    expect(res.statusCode).not.toBe(401);
  });

  it('rejects a tampered token at the route, not the middleware', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/usage/dashboard?token=${encodeURIComponent(token)}x`,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toContain('invalid analytics token');
  });

  it('does not require a Bearer key for browser chrome probes', async () => {
    const favicon = await app.inject({ method: 'GET', url: '/favicon.ico' });
    expect(favicon.statusCode).toBe(404);

    const robots = await app.inject({ method: 'GET', url: '/robots.txt' });
    expect(robots.statusCode).toBe(404);
  });

  it('still requires a Bearer key when no analytics token is present', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/usage/dashboard',
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('authentication_required');
  });

  it('does not open write endpoints to analytics tokens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/usage/my-link?token=${encodeURIComponent(token)}`,
      headers: { 'x-user-id': 'esone.qiu' },
      payload: { scope: 'self' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('authentication_required');
  });
});
