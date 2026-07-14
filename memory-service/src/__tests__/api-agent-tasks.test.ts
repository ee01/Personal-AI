import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { getTestDb } from './setup.js';

describe('AgentTask API', () => {
  const fetchMock = vi.fn();
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => '{}',
    });
    db.prepare('DELETE FROM action_results').run();
    db.prepare('DELETE FROM proposed_actions').run();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates AgentTask OpenClaw actions with a 10 minute timeout floor', async () => {
    const idempotencyKey = 'agent-task-timeout-floor-test';
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agent-tasks/execute',
      payload: {
        taskId: 'agent-task-timeout-test',
        title: 'AgentTask timeout test',
        task: 'Check Jira and return a concise result.',
        executor: 'openclaw',
        timeoutMs: 1000,
        notify: false,
        idempotencyKey,
      },
    });

    expect(res.statusCode).toBe(200);

    const repo = new ActionRepository(db);
    const action = repo.findReusableByIdempotencyKey(idempotencyKey);
    expect(action).toBeTruthy();
    expect(action?.actionType).toBe('delegate_openclaw');
    expect(action?.params.timeoutMs).toBe(600000);
  });
});
