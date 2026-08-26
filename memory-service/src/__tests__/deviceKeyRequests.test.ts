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

  it('accepts the admin dashboard "Approve keep keys" <form> POST (x-www-form-urlencoded)', async () => {
    const spy = vi.spyOn(googleIdentity, 'verifyGoogleAccessToken').mockResolvedValue({
      ok: true,
      identity: {
        email: 'other.person2@ringcentral.com',
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
        'x-user-id': 'formpost.user',
      },
      payload: { label: 'seed', scopes: ['memory.read', 'memory.write'] },
    });
    expect(seed.statusCode).toBe(201);

    const mismatch = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${BOOTSTRAP}`,
        'x-user-id': 'formpost.user',
      },
      payload: {
        label: 'other-device',
        verification: { provider: 'google', accessToken: 'fake' },
      },
    });
    expect(mismatch.statusCode).toBe(409);
    const requestId = mismatch.json().requestId as string;
    expect(requestId).toBeTruthy();

    // This is what a browser actually sends when the admin dashboard's
    // plain HTML <form method="POST"> button is clicked: no `accept:
    // application/json`, and a browser-default urlencoded content type.
    // Before registering the urlencoded content-type parser, this 415'd.
    const approve = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/key-requests/formpost.user/${requestId}/approve?token=${ADMIN}`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: '',
    });
    expect(approve.statusCode).not.toBe(415);
    expect(approve.statusCode).toBe(302);

    spy.mockRestore();
  });

  it('collapses repeated pending requests from the same device into one dashboard row, and approving it resolves the rest', async () => {
    const DEVICE_LABEL = 'Chrome · MacIntel · d6fad5';

    const seed = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${SERVICE}`,
        'x-user-id': 'retrying.device.user',
      },
      payload: { label: 'seed', scopes: ['memory.read', 'memory.write'] },
    });
    expect(seed.statusCode).toBe(201);

    // Same device retries the bootstrap-on-claimed-namespace path several
    // times (e.g. the extension polling before it has an approved
    // requestId) — each attempt creates its own pending row server-side.
    const requestIds: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const attempt = await app.inject({
        method: 'POST',
        url: '/api/v1/users/me/keys',
        headers: {
          authorization: `Bearer ${BOOTSTRAP}`,
          'x-user-id': 'retrying.device.user',
        },
        payload: { label: DEVICE_LABEL },
      });
      expect(attempt.statusCode).toBe(409);
      requestIds.push(attempt.json().requestId as string);
    }
    expect(new Set(requestIds).size).toBe(5);

    const dashboard = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/key-requests?token=${ADMIN}`,
      headers: { accept: 'application/json' },
    });
    expect(dashboard.statusCode).toBe(200);
    const pendingForDevice = dashboard
      .json()
      .requests.filter(
        (r: { userId: string; deviceLabel: string | null; status: string }) =>
          r.userId === 'retrying.device.user' &&
          r.deviceLabel === DEVICE_LABEL &&
          r.status === 'pending',
      );
    // Only the most recent attempt is surfaced; the other 4 are collapsed into it.
    expect(pendingForDevice).toHaveLength(1);
    expect(pendingForDevice[0].id).toBe(requestIds[requestIds.length - 1]);
    expect(pendingForDevice[0].duplicatePendingCount).toBe(5);

    const approve = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/key-requests/retrying.device.user/${pendingForDevice[0].id}/approve?token=${ADMIN}`,
      headers: { accept: 'application/json' },
    });
    expect(approve.statusCode).toBe(200);

    // Approving the collapsed row also resolves the other pending duplicates
    // for that device, so none of them are left stuck in "pending" forever.
    const after = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/key-requests?token=${ADMIN}`,
      headers: { accept: 'application/json' },
    });
    const stillPendingForDevice = after
      .json()
      .requests.filter(
        (r: { userId: string; deviceLabel: string | null; status: string }) =>
          r.userId === 'retrying.device.user' &&
          r.deviceLabel === DEVICE_LABEL &&
          r.status === 'pending',
      );
    expect(stillPendingForDevice).toHaveLength(0);
  });
});
