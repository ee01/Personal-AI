import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../server.js';
import { UserContextManager } from '../core/UserContextManager.js';
import { getConfig } from '../config.js';

describe('Config API', () => {
  let app: FastifyInstance;
  let userContextManager: UserContextManager;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-config-'));
    userContextManager = new UserContextManager(tempDir);
    const result = await buildApp({ userContextManager });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    userContextManager.closeAll();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('stores and sanitizes per-user OpenClaw runtime config', async () => {
    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/config',
      headers: {
        'x-user-id': 'config-test-user',
      },
      payload: {
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'secret-key',
        openClawTimeoutMs: 300000,
      },
    });

    expect(putRes.statusCode).toBe(200);
    const putBody = putRes.json();
    expect(putBody.openClawEnabled).toBe(true);
    expect(putBody.openClawBaseUrl).toBe('https://openclaw.example.com');
    expect(putBody.openClawTimeoutMs).toBe(600000);
    expect(putBody.openClawApiKeyConfigured).toBe(true);
    expect(putBody.openClawApiKey).toBeUndefined();

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/config',
      headers: {
        'x-user-id': 'config-test-user',
      },
    });

    expect(getRes.statusCode).toBe(200);
    const getBody = getRes.json();
    expect(getBody.openClawApiKeyConfigured).toBe(true);
    expect(getBody.openClawApiKey).toBeUndefined();

    const clearRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/config',
      headers: {
        'x-user-id': 'config-test-user',
      },
      payload: {
        clearOpenClawApiKey: true,
      },
    });

    expect(clearRes.statusCode).toBe(200);
    const clearBody = clearRes.json();
    expect(clearBody.openClawApiKeyConfigured).toBe(Boolean(getConfig().openClawApiKey));
  });
});
