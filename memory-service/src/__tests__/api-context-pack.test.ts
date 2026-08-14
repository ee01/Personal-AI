import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../server.js';
import { UserContextManager } from '../core/UserContextManager.js';
import { issueUserApiKey } from '../core/auth/userApiKeys.js';

describe('Context Pack API', () => {
  let app: FastifyInstance;
  let userContextManager: UserContextManager;
  let tempDir: string;
  let userToken = '';

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-pack-'));
    userContextManager = new UserContextManager(tempDir);
    const result = await buildApp({ userContextManager });
    app = result.app;
    await app.ready();

    const ctx = userContextManager.getContext('pack-user');
    const ts = Math.floor(Date.now() / 1000);
    ctx.db
      .prepare(
        `INSERT INTO user_profile_items
         (id, item_type, item_key, item_value, source_kind, confidence,
          user_confirmed, status, salience_score, mention_count, last_seen,
          created_at, updated_at, fingerprint)
         VALUES (?, 'preference', 'language_preference', '回复使用中文', 'explicit',
                 0.9, 1, 'active', 0.8, 1, ?, ?, ?, ?)`,
      )
      .run('pref-lang', ts, ts, ts, 'language_preference:回复使用中文');
    ctx.db
      .prepare(
        `INSERT INTO user_profile_items
         (id, item_type, item_key, item_value, source_kind, confidence,
          user_confirmed, status, salience_score, mention_count, last_seen,
          created_at, updated_at, fingerprint)
         VALUES (?, 'fact', 'role', 'scrum master', 'explicit',
                 0.9, 1, 'active', 0.9, 1, ?, ?, ?, ?)`,
      )
      .run('fact-role', ts, ts, ts, 'role:scrum master');

    userToken = issueUserApiKey(ctx.db, 'pack-user').token;
  });

  afterAll(async () => {
    await app.close();
    userContextManager.closeAll();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns identity_preferences without raw USER_CORE heading', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/context-pack?scope=identity_preferences',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.scope).toBe('identity_preferences');
    expect(body.prompt).toContain('Persona Context');
    expect(body.prompt).not.toContain('# USER_CORE');
    expect(body.redactionReceipt).toBeTruthy();
    expect(Array.isArray(body.sources)).toBe(true);
  });

  it('returns recent_focus / today / projects scopes', async () => {
    for (const scope of ['recent_focus', 'today', 'projects']) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/context-pack?scope=${scope}`,
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().scope).toBe(scope);
      expect(typeof res.json().prompt).toBe('string');
    }
  });

  it('requires q for custom scope and accepts a query', async () => {
    const missing = await app.inject({
      method: 'GET',
      url: '/api/v1/context-pack?scope=custom',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(missing.statusCode).toBe(400);

    const ok = await app.inject({
      method: 'GET',
      url: '/api/v1/context-pack?scope=custom&q=Personal%20AI',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().experimental).toBe(true);
    expect(ok.json().query).toBe('Personal AI');
  });

  it('rejects an unknown scope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/context-pack?scope=nope',
      headers: { 'x-user-id': 'pack-user' },
    });
    expect(res.statusCode).toBe(400);
  });
});
