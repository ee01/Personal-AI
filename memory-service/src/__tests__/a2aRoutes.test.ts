/**
 * A2A Agent Card + JSON-RPC smoke tests (pure helpers / lightweight app).
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../server.js';
import { UserContextManager } from '../core/UserContextManager.js';

describe('A2A routes', () => {
  let tempDir: string;
  let userContextManager: UserContextManager;
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'a2a-'));
    userContextManager = new UserContextManager(tempDir);
    const built = await buildApp({ userContextManager });
    app = built.app;
    await app.inject({
      method: 'PUT',
      url: '/api/v1/config',
      headers: { 'x-user-id': 'esone.qiu' },
      payload: {
        openClawEnabled: true,
        openClawBaseUrl: 'http://127.0.0.1:18789',
        agentExecutors: [
          {
            id: 'openclaw',
            label: 'OpenClaw',
            type: 'openclaw-responses',
            baseUrl: 'http://127.0.0.1:18789',
            enabled: true,
          },
        ],
        executorDefaults: {
          agent_task: 'openclaw',
          reflection_research: 'openclaw',
        },
      },
    });
  });

  afterEach(async () => {
    await app.close();
    userContextManager.closeAll();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('serves Agent Card at well-known paths', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/.well-known/agent-card.json',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toContain('Personal AI');
    expect(body.url).toContain('/a2a');
    expect(body.skills?.length).toBeGreaterThan(0);

    const legacy = await app.inject({
      method: 'GET',
      url: '/.well-known/agent.json',
    });
    expect(legacy.statusCode).toBe(200);
  });

  it('message/send creates a task mapped to action id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'esone.qiu',
      },
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'message/send',
        params: {
          contextId: 'ctx-1',
          message: {
            role: 'user',
            parts: [{ type: 'text', text: 'recall what I said about Nova' }],
          },
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.result?.id).toBeTruthy();
    expect(body.result?.contextId).toBe('ctx-1');
    expect(body.result?.metadata?.agentRunId).toBe(body.result.id);

    const got = await app.inject({
      method: 'POST',
      url: '/a2a',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'esone.qiu',
      },
      payload: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tasks/get',
        params: { id: body.result.id },
      },
    });
    expect(got.statusCode).toBe(200);
    expect(got.json().result.id).toBe(body.result.id);
  });
});
