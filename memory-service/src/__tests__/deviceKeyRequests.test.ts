/**
 * Claim-gate + Google mismatch + admin approval HTTP flows.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../server.js';
import { UserContextManager } from '../core/UserContextManager.js';
import { resetConfigForTests } from '../config.js';
import * as googleIdentity from '../core/auth/googleIdentity.js';

describe('Device key claim gate + approval', () => {
  let app: FastifyInstance;
  let userContextManager: UserContextManager;
  let tempDir: string;
  const BOOTSTRAP = 'claim-gate-bootstrap';
  const SERVICE = 'claim-gate-service';
  const ADMIN = 'claim-gate-admin-token';
  let prev: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const key of [
      'API_KEY',
      'BOOTSTRAP_API_KEY',
      'ADMIN_API_TOKEN',
      'ADMIN_CONTACT_EMAIL',
      'GOOGLE_OAUTH_CLIENT_IDS',
      'GOOGLE_ALLOWED_EMAIL_DOMAINS',
    ]) {
      prev[key] = process.env[key];
    }
    process.env.API_KEY = SERVICE;
    process.env.BOOTSTRAP_API_KEY = BOOTSTRAP;
    process.env.ADMIN_API_TOKEN = ADMIN;
    process.env.ADMIN_CONTACT_EMAIL = 'admin@example.com';
    process.env.GOOGLE_OAUTH_CLIENT_IDS = 'ext-client.apps.googleusercontent.com';
    process.env.GOOGLE_ALLOWED_EMAIL_DOMAINS = 'ringcentral.com';
    resetConfigForTests();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claim-gate-http-'));
    userContextManager = new UserContextManager(tempDir);
    const result = await buildApp({ userContextManager });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    userContextManager.closeAll();
    fs.rmSync(tempDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetConfigForTests();
  });

  it('lets bootstrap claim a brand-new user once, then rejects re-claim', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${BOOTSTRAP}`,
        'x-user-id': 'new.user',
      },
      payload: { label: 'first', scopes: ['memory.read', 'memory.write'] },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${BOOTSTRAP}`,
        'x-user-id': 'new.user',
      },
      payload: { label: 'second' },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe('user_already_claimed');
    expect(second.json().adminContact).toBe('admin@example.com');
    expect(second.json().requestId).toBeTruthy();
  });

  it('issues via Google when email localpart matches userId', async () => {
    const spy = vi.spyOn(googleIdentity, 'verifyGoogleAccessToken').mockResolvedValue({
      ok: true,
      identity: {
        email: 'claimed.user@ringcentral.com',
        emailVerified: true,
        aud: 'ext-client.apps.googleusercontent.com',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      },
    });

    // Prime the namespace as claimed with service key.
    const seed = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${SERVICE}`,
        'x-user-id': 'claimed.user',
      },
      payload: { label: 'seed', scopes: ['memory.read', 'memory.write'] },
    });
    expect(seed.statusCode).toBe(201);

    const verified = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${BOOTSTRAP}`,
        'x-user-id': 'claimed.user',
      },
      payload: {
        label: 'google-device',
        scopes: ['memory.read', 'memory.write'],
        verification: { provider: 'google', accessToken: 'fake' },
      },
    });
    expect(verified.statusCode).toBe(201);
    expect(verified.json().token).toMatch(/^pak\./);
    spy.mockRestore();
  });

  it('creates pending approval on google email mismatch, then issues after approve', async () => {
    const spy = vi.spyOn(googleIdentity, 'verifyGoogleAccessToken').mockResolvedValue({
      ok: true,
      identity: {
        email: 'other.person@ringcentral.com',
        emailVerified: true,
        aud: 'ext-client.apps.googleusercontent.com',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      },
    });

    const seed = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${SERVICE}`,
        'x-user-id': 'mismatch.user',
      },
      payload: { label: 'seed', scopes: ['memory.read', 'memory.write'] },
    });
    expect(seed.statusCode).toBe(201);

    const mismatch = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${BOOTSTRAP}`,
        'x-user-id': 'mismatch.user',
      },
      payload: {
        label: 'other-device',
        verification: { provider: 'google', accessToken: 'fake' },
      },
    });
    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json().error).toBe('google_email_mismatch');
    const requestId = mismatch.json().requestId as string;
    expect(requestId).toBeTruthy();

    const approve = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/key-requests/mismatch.user/${requestId}/approve?token=${ADMIN}`,
      headers: { accept: 'application/json' },
    });
    expect(approve.statusCode).toBe(200);
    expect(approve.json().request.status).toBe('approved');

    const issued = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${BOOTSTRAP}`,
        'x-user-id': 'mismatch.user',
      },
      payload: { label: 'after-approve', requestId },
    });
    expect(issued.statusCode).toBe(201);
    expect(issued.json().token).toMatch(/^pak\./);

    // Same requestId cannot be consumed twice.
    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${BOOTSTRAP}`,
        'x-user-id': 'mismatch.user',
      },
      payload: { label: 'replay', requestId },
    });
    expect(replay.statusCode).toBe(409);
    expect(replay.json().error).toBe('request_not_approved');

    spy.mockRestore();
  });
});
