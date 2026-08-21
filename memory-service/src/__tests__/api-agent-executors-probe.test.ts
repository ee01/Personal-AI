import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../server.js';
import { UserContextManager } from '../core/UserContextManager.js';
import { resetConfigForTests } from '../config.js';

describe('agent executor probe API', () => {
  let tempDir: string;
  let userContextManager: UserContextManager;
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let prevApiKey: string | undefined;

  beforeEach(async () => {
    prevApiKey = process.env.API_KEY;
    delete process.env.API_KEY;
    resetConfigForTests();
    tempDir = mkdtempSync(join(tmpdir(), 'probe-api-'));
    userContextManager = new UserContextManager(tempDir);
    const built = await buildApp({ userContextManager });
    app = built.app;
    await app.inject({
      method: 'PUT',
      url: '/api/v1/config',
      headers: { 'x-user-id': 'esone.qiu' },
      payload: {
        agentExecutors: [
          {
            id: 'http-exec',
            label: 'HTTP',
            type: 'openclaw-responses',
            baseUrl: 'https://openclaw.example/v1/responses',
            enabled: true,
          },
        ],
        executorDefaults: {
          agent_task: 'http-exec',
          reflection_research: 'http-exec',
        },
      },
    });
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await app.close();
    userContextManager.closeAll();
    rmSync(tempDir, { recursive: true, force: true });
    if (prevApiKey === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = prevApiKey;
    resetConfigForTests();
  });

  it('probes openclaw-responses and caches the result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('ok', { status: 200 })),
    );
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/agent-executors/http-exec/probe',
      headers: { 'x-user-id': 'esone.qiu' },
      payload: {},
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ ok: true, stage: 'ready' });

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/agent-executors/http-exec/probe',
      headers: { 'x-user-id': 'esone.qiu' },
      payload: {},
    });
    expect(second.json()).toMatchObject({ ok: true, cached: true });
  });

  it('returns 404 with a save hint for unknown executors', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agent-executors/missing/probe',
      headers: { 'x-user-id': 'esone.qiu' },
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().nextAction).toMatch(/保存/);
  });
});
