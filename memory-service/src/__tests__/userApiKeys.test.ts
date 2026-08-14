/**
 * Tier-2 personal API keys: issuance, user binding, scope limits, revocation.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../server.js';
import { UserContextManager } from '../core/UserContextManager.js';
import { parseUserApiKey } from '../core/auth/userApiKeys.js';
import { resetConfigForTests } from '../config.js';

describe('Personal API keys', () => {
  let app: FastifyInstance;
  let userContextManager: UserContextManager;
  let tempDir: string;
  let prevApiKey: string | undefined;
  let prevBootstrap: string | undefined;

  const issueKey = async (
    userId: string,
    scopes?: string[],
  ): Promise<string> => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: { 'x-user-id': userId },
      payload: scopes ? { label: 'test', scopes } : { label: 'test' },
    });
    expect(res.statusCode).toBe(201);
    return res.json().token as string;
  };

  beforeAll(async () => {
    prevApiKey = process.env.API_KEY;
    prevBootstrap = process.env.BOOTSTRAP_API_KEY;
    delete process.env.API_KEY;
    delete process.env.BOOTSTRAP_API_KEY;
    resetConfigForTests();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'user-api-keys-'));
    userContextManager = new UserContextManager(tempDir);
    const result = await buildApp({ userContextManager });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    userContextManager.closeAll();
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (prevApiKey === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = prevApiKey;
    if (prevBootstrap === undefined) delete process.env.BOOTSTRAP_API_KEY;
    else process.env.BOOTSTRAP_API_KEY = prevBootstrap;
    resetConfigForTests();
  });

  it('mints a key that carries its owner and never returns plaintext again', async () => {
    const token = await issueKey('alice');
    expect(parseUserApiKey(token)?.userId).toBe('alice');

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/keys',
      headers: { 'x-user-id': 'alice' },
    });
    expect(listRes.statusCode).toBe(200);
    const keys = listRes.json().keys as Array<Record<string, unknown>>;
    expect(keys).toHaveLength(1);
    expect(keys[0].keyPrefix).toEqual(expect.stringContaining('pak.'));
    expect(JSON.stringify(keys[0])).not.toContain(token);
  });

  it('resolves identity from the key without X-User-Id', async () => {
    const token = await issueKey('bob');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/config',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/keys',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.json().userId).toBe('bob');
  });

  it('refuses to act for a different user than the key is bound to', async () => {
    const token = await issueKey('carol');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/config',
      headers: { authorization: `Bearer ${token}`, 'x-user-id': 'dave' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('user_key_user_mismatch');
  });

  it('rejects an unknown or revoked key', async () => {
    const token = await issueKey('erin');
    const keyId = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/users/me/keys',
        headers: { 'x-user-id': 'erin' },
      })
    ).json().keys[0].id as string;

    const revokeRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/users/me/keys/${keyId}`,
      headers: { 'x-user-id': 'erin' },
    });
    expect(revokeRes.statusCode).toBe(200);

    const afterRevoke = await app.inject({
      method: 'GET',
      url: '/api/v1/config',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(afterRevoke.statusCode).toBe(401);
    expect(afterRevoke.json().error).toBe('invalid_user_api_key');

    const forged = await app.inject({
      method: 'GET',
      url: '/api/v1/config',
      headers: {
        authorization: `Bearer ${token.slice(0, -4)}zzzz`,
      },
    });
    expect(forged.statusCode).toBe(401);
  });

  it('keeps a read-only key out of write routes but allows memory.write keys', async () => {
    const readToken = await issueKey('frank');
    const blocked = await app.inject({
      method: 'PUT',
      url: '/api/v1/config',
      headers: { authorization: `Bearer ${readToken}` },
      payload: { openClawEnabled: true },
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error).toBe('user_key_scope_insufficient');

    const writeToken = await issueKey('frank', ['memory.read', 'memory.write']);
    const allowed = await app.inject({
      method: 'PUT',
      url: '/api/v1/config',
      headers: { authorization: `Bearer ${writeToken}` },
      payload: { openClawEnabled: true },
    });
    expect(allowed.statusCode).toBe(200);
  });

  it('requires an explicit user before minting a key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      payload: { label: 'anonymous' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows multiple active keys per user (one per device)', async () => {
    const first = await issueKey('multi');
    const second = await issueKey('multi');
    expect(first).not.toBe(second);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/keys',
      headers: { 'x-user-id': 'multi' },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().keys).toHaveLength(2);

    const id = listRes.json().keys[0].id as string;
    await app.inject({
      method: 'DELETE',
      url: `/api/v1/users/me/keys/${id}`,
      headers: { 'x-user-id': 'multi' },
    });
    const after = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/keys',
      headers: { 'x-user-id': 'multi' },
    });
    expect(after.json().keys).toHaveLength(1);
  });
});

describe('Bootstrap API key (keys.issue only)', () => {
  let app: FastifyInstance;
  let userContextManager: UserContextManager;
  let tempDir: string;
  const BOOTSTRAP = 'test-bootstrap-key-not-for-prod';
  let prevApiKey: string | undefined;
  let prevBootstrap: string | undefined;

  beforeAll(async () => {
    prevApiKey = process.env.API_KEY;
    prevBootstrap = process.env.BOOTSTRAP_API_KEY;
    process.env.BOOTSTRAP_API_KEY = BOOTSTRAP;
    process.env.API_KEY = 'test-full-service-key';
    resetConfigForTests();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-keys-'));
    userContextManager = new UserContextManager(tempDir);
    const result = await buildApp({ userContextManager });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    userContextManager.closeAll();
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (prevApiKey === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = prevApiKey;
    if (prevBootstrap === undefined) delete process.env.BOOTSTRAP_API_KEY;
    else process.env.BOOTSTRAP_API_KEY = prevBootstrap;
    resetConfigForTests();
  });

  it('can mint a personal key but cannot read memory data', async () => {
    const issue = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: {
        authorization: `Bearer ${BOOTSTRAP}`,
        'x-user-id': 'bootstrap-user',
      },
      payload: {
        label: 'Chrome · test',
        scopes: ['memory.read', 'memory.write'],
      },
    });
    expect(issue.statusCode).toBe(201);
    expect(issue.json().token).toMatch(/^pak\./);
    expect(issue.json().key.issuedFromUa || issue.json().key.label).toBeTruthy();

    const blocked = await app.inject({
      method: 'GET',
      url: '/api/v1/stats',
      headers: {
        authorization: `Bearer ${BOOTSTRAP}`,
        'x-user-id': 'bootstrap-user',
      },
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error).toBe('bootstrap_key_scope_insufficient');

    const token = issue.json().token as string;
    const ok = await app.inject({
      method: 'GET',
      url: '/api/v1/config',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(ok.statusCode).toBe(200);
  });

  it('rejects anonymous issuance when bootstrap/service keys are configured', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/keys',
      headers: { 'x-user-id': 'bootstrap-user' },
      payload: { label: 'nope' },
    });
    expect(res.statusCode).toBe(401);
    // With API_KEY set, anonymous is rejected before the keys issuer guard.
    expect(res.json().error).toBe('authentication_required');
  });

  it('rejects anonymous memory reads when API_KEY is configured', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/config',
      headers: { 'x-user-id': 'bootstrap-user' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('authentication_required');
  });

  it('allows service key to act for any user when API_KEY is configured', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/config',
      headers: {
        authorization: 'Bearer test-full-service-key',
        'x-user-id': 'ops-user',
      },
    });
    expect(res.statusCode).toBe(200);
  });
});
