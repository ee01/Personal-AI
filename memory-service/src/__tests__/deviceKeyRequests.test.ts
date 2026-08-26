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

  it('auto-issues a key on the next bootstrap retry (no requestId) once the device is approved', async () => {
    const DEVICE_LABEL = 'Chrome · MacIntel · f00d42';

    const seed = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${SERVICE}`,
        'x-user-id': 'sw-restart.user',
      },
      payload: { label: 'seed', scopes: ['memory.read', 'memory.write'] },
    });
    expect(seed.statusCode).toBe(201);

    // First attempt: no requestId yet, gets a pending approval.
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${BOOTSTRAP}`,
        'x-user-id': 'sw-restart.user',
      },
      payload: { label: DEVICE_LABEL },
    });
    expect(first.statusCode).toBe(409);
    const requestId = first.json().requestId as string;

    const approve = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/key-requests/sw-restart.user/${requestId}/approve?token=${ADMIN}`,
      headers: { accept: 'application/json' },
    });
    expect(approve.statusCode).toBe(200);

    // Simulate an MV3 service-worker restart: the client retries the exact
    // same bootstrap call, still with no requestId (it never got to poll or
    // consume the approval before it was evicted). It should now succeed
    // instead of opening yet another pending request.
    const retryWithoutRequestId = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${BOOTSTRAP}`,
        'x-user-id': 'sw-restart.user',
      },
      payload: { label: DEVICE_LABEL },
    });
    expect(retryWithoutRequestId.statusCode).toBe(201);
    expect(retryWithoutRequestId.json().token).toMatch(/^pak\./);

    // The approved request is now consumed, not left dangling.
    const requestAfter = await app.inject({
      method: 'GET',
      url: `/api/v1/users/me/key-requests/${requestId}`,
      headers: {
        authorization: `Bearer ${BOOTSTRAP}`,
        'x-user-id': 'sw-restart.user',
      },
    });
    expect(requestAfter.json().request.status).toBe('consumed');
  });

  it('approving one duplicate does not turn the others into extra redeemable grants', async () => {
    const DEVICE_LABEL = 'Chrome · MacIntel · aaaa11';

    const seed = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${SERVICE}`,
        'x-user-id': 'no-storm.user',
      },
      payload: { label: 'seed', scopes: ['memory.read', 'memory.write'] },
    });
    expect(seed.statusCode).toBe(201);

    const requestIds: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const attempt = await app.inject({
        method: 'POST',
        url: '/api/v1/users/me/keys',
        headers: {
          authorization: `Bearer ${BOOTSTRAP}`,
          'x-user-id': 'no-storm.user',
        },
        payload: { label: DEVICE_LABEL },
      });
      expect(attempt.statusCode).toBe(409);
      requestIds.push(attempt.json().requestId as string);
    }

    const approve = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/key-requests/no-storm.user/${requestIds[requestIds.length - 1]}/approve?token=${ADMIN}`,
      headers: { accept: 'application/json' },
    });
    expect(approve.statusCode).toBe(200);

    // The two superseded duplicates must be denied, not fanned out to
    // 'approved' — only the one the admin actually decided on should be
    // redeemable. (Regression: an earlier version of this cascade mirrored
    // the primary's decision, which meant approving one duplicate turned
    // every other pending duplicate into an independently-redeemable
    // 'approved' grant — each of which would mint a brand-new key on the
    // device's next retry.)
    const dashboard = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/key-requests?token=${ADMIN}`,
      headers: { accept: 'application/json' },
    });
    const forDevice = dashboard
      .json()
      .requests.filter(
        (r: { userId: string; deviceLabel: string | null }) =>
          r.userId === 'no-storm.user' && r.deviceLabel === DEVICE_LABEL,
      );
    expect(forDevice).toHaveLength(3);
    const approvedCount = forDevice.filter(
      (r: { status: string }) => r.status === 'approved',
    ).length;
    expect(approvedCount).toBe(1);
    const deniedCount = forDevice.filter(
      (r: { status: string }) => r.status === 'denied',
    ).length;
    expect(deniedCount).toBe(2);

    // First retry (no requestId) redeems the one approved grant...
    const firstRetry = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${BOOTSTRAP}`,
        'x-user-id': 'no-storm.user',
      },
      payload: { label: DEVICE_LABEL },
    });
    expect(firstRetry.statusCode).toBe(201);

    // ...and the next retry must NOT mint yet another key — there's nothing
    // left to redeem, so it goes back to a fresh pending request.
    const secondRetry = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${BOOTSTRAP}`,
        'x-user-id': 'no-storm.user',
      },
      payload: { label: DEVICE_LABEL },
    });
    expect(secondRetry.statusCode).toBe(409);
  });

  it('lets an admin revoke an approved-but-unredeemed grant before it is consumed', async () => {
    const seed = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${SERVICE}`,
        'x-user-id': 'revoke-approval.user',
      },
      payload: { label: 'seed', scopes: ['memory.read', 'memory.write'] },
    });
    expect(seed.statusCode).toBe(201);

    const attempt = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${BOOTSTRAP}`,
        'x-user-id': 'revoke-approval.user',
      },
      payload: { label: 'Chrome · MacIntel · bbbb22' },
    });
    expect(attempt.statusCode).toBe(409);
    const requestId = attempt.json().requestId as string;

    const approve = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/key-requests/revoke-approval.user/${requestId}/approve?token=${ADMIN}`,
      headers: { accept: 'application/json' },
    });
    expect(approve.statusCode).toBe(200);

    const revoke = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/key-requests/revoke-approval.user/${requestId}/revoke?token=${ADMIN}`,
      headers: { accept: 'application/json' },
    });
    expect(revoke.statusCode).toBe(200);
    expect(revoke.json().request.status).toBe('denied');

    // Revoking twice is a no-op (already denied, not 'approved' anymore).
    const revokeAgain = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/key-requests/revoke-approval.user/${requestId}/revoke?token=${ADMIN}`,
      headers: { accept: 'application/json' },
    });
    expect(revokeAgain.statusCode).toBe(404);

    // The device gets nothing for it — no key issued, back to pending.
    const retry = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${BOOTSTRAP}`,
        'x-user-id': 'revoke-approval.user',
      },
      payload: { label: 'Chrome · MacIntel · bbbb22' },
    });
    expect(retry.statusCode).toBe(409);
  });
});
