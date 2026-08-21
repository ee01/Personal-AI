import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../server.js';
import { UserContextManager } from '../core/UserContextManager.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { WORKER_PROTOCOL_VERSION } from '../integrations/workers/workerProtocol.js';
import { resetConfigForTests } from '../config.js';

describe('agent worker API', () => {
  let tempDir: string;
  let userContextManager: UserContextManager;
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let prevApiKey: string | undefined;

  beforeEach(async () => {
    prevApiKey = process.env.API_KEY;
    delete process.env.API_KEY;
    resetConfigForTests();
    tempDir = mkdtempSync(join(tmpdir(), 'worker-api-'));
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
            id: 'codex-remote',
            label: 'Remote Codex',
            type: 'acp-codex',
            runtime: 'remote',
            cwd: '/tmp',
            enabled: true,
          },
        ],
        executorDefaults: {
          agent_task: 'codex-remote',
          reflection_research: 'codex-remote',
        },
      },
    });
  });

  afterEach(async () => {
    await app.close();
    userContextManager.closeAll();
    rmSync(tempDir, { recursive: true, force: true });
    if (prevApiKey === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = prevApiKey;
    resetConfigForTests();
  });

  async function pairWorker() {
    const issued = await app.inject({
      method: 'POST',
      url: '/api/v1/agent-workers/pairing-tokens',
      headers: { 'x-user-id': 'esone.qiu' },
    });
    expect(issued.statusCode).toBe(200);
    const tokenBody = issued.json() as {
      token: string;
      installCommand: string;
    };
    expect(tokenBody.installCommand).toContain('--token');
    const paired = await app.inject({
      method: 'POST',
      url: '/api/v1/agent-workers/pair',
      headers: {
        authorization: `Bearer ${tokenBody.token}`,
      },
      payload: {
        pairingToken: tokenBody.token,
        protocolVersion: WORKER_PROTOCOL_VERSION,
        hostKind: 'headless',
        hostname: 'test-box',
      },
    });
    expect(paired.statusCode).toBe(200);
    return paired.json() as {
      workerId: string;
      credential: string;
    };
  }

  it('pairs a worker, heartbeats, and lists it online', async () => {
    const { workerId, credential } = await pairWorker();
    const beat = await app.inject({
      method: 'POST',
      url: `/api/v1/agent-workers/${workerId}/heartbeat`,
      headers: { authorization: `Bearer ${credential}` },
      payload: { protocolVersion: WORKER_PROTOCOL_VERSION, currentTaskCount: 0 },
    });
    expect(beat.statusCode).toBe(200);
    expect(beat.json()).toMatchObject({ ok: true });

    const listed = await app.inject({
      method: 'GET',
      url: '/api/v1/agent-workers',
      headers: { 'x-user-id': 'esone.qiu' },
    });
    const body = listed.json() as { workers: Array<{ id: string; status: string }> };
    expect(body.workers.some((item) => item.id === workerId && item.status === 'online')).toBe(
      true,
    );
  });

  it('rejects an incompatible protocol at handshake', async () => {
    const issued = await app.inject({
      method: 'POST',
      url: '/api/v1/agent-workers/pairing-tokens',
      headers: { 'x-user-id': 'esone.qiu' },
    });
    const token = (issued.json() as { token: string }).token;
    const paired = await app.inject({
      method: 'POST',
      url: '/api/v1/agent-workers/pair',
      headers: { authorization: `Bearer ${token}` },
      payload: { pairingToken: token, protocolVersion: 0, hostKind: 'headless' },
    });
    expect(paired.statusCode).toBe(409);
    expect(paired.json()).toMatchObject({ error: 'protocol_incompatible' });
  });

  it('parks remote ACP tasks, claims with fencing, and rejects stale reports', async () => {
    const { workerId, credential } = await pairWorker();
    await app.inject({
      method: 'PUT',
      url: '/api/v1/config',
      headers: { 'x-user-id': 'esone.qiu' },
      payload: {
        agentExecutors: [
          {
            id: 'codex-remote',
            label: 'Remote Codex',
            type: 'acp-codex',
            runtime: 'remote',
            workerId,
            cwd: '/tmp',
            enabled: true,
          },
        ],
        executorDefaults: {
          agent_task: 'codex-remote',
          reflection_research: 'codex-remote',
        },
      },
    });

    const queued = await app.inject({
      method: 'POST',
      url: '/api/v1/agent-tasks/execute',
      headers: { 'x-user-id': 'esone.qiu' },
      payload: {
        taskId: 'remote-1',
        title: 'remote task',
        task: 'echo hello',
        executor: 'codex-remote',
        notify: false,
        idempotencyKey: 'remote-worker-claim-1',
      },
    });
    expect(queued.statusCode).toBe(202);

    const db = userContextManager.getContext('esone.qiu').db;
    const repo = new ActionRepository(db);
    const action = repo.findReusableByIdempotencyKey('remote-worker-claim-1');
    expect(action).toBeTruthy();
    const executed = await (
      await import('../core/actions/ActionExecutor.js')
    ).ActionExecutor.prototype.executeAction.call(
      new (await import('../core/actions/ActionExecutor.js')).ActionExecutor(
        db,
        userContextManager.getContext('esone.qiu').userDataManager,
        'esone.qiu',
      ),
      action!.id,
    );
    expect(executed.queueStatus).toBe('awaiting_claim');

    const claimed = await app.inject({
      method: 'POST',
      url: `/api/v1/agent-workers/${workerId}/claim`,
      headers: { authorization: `Bearer ${credential}` },
      payload: { maxItems: 1 },
    });
    expect(claimed.statusCode).toBe(200);
    const claimBody = claimed.json() as {
      tasks: Array<{ actionId: string; fenceToken: number }>;
    };
    expect(claimBody.tasks).toHaveLength(1);
    expect(claimBody.tasks[0]).toMatchObject({
      request: { task: 'echo hello' },
      memory: { userId: 'esone.qiu' },
    });
    expect(String((claimBody.tasks[0] as { memory?: { mcpUrl?: string } }).memory?.mcpUrl)).toContain('/mcp');
    const fence = claimBody.tasks[0].fenceToken;
    const actionId = claimBody.tasks[0].actionId;

    const stale = await app.inject({
      method: 'POST',
      url: `/api/v1/agent-workers/${workerId}/report`,
      headers: { authorization: `Bearer ${credential}` },
      payload: {
        actionId,
        fenceToken: fence - 1,
        envelope: { status: 'succeeded', summary: 'old', artifacts: [] },
      },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ error: 'stale_fence' });

    const ok = await app.inject({
      method: 'POST',
      url: `/api/v1/agent-workers/${workerId}/report`,
      headers: { authorization: `Bearer ${credential}` },
      payload: {
        actionId,
        fenceToken: fence,
        envelope: {
          status: 'succeeded',
          summary: 'done',
          artifacts: [
            {
              kind: 'note',
              content: 'ok',
              metadata: {
                sourceSystem: 'git',
                entityId: 'HEAD',
                verification: 'read',
                observedFields: ['commit'],
              },
            },
          ],
        },
      },
    });
    expect(ok.statusCode).toBe(200);
    expect(repo.getById(actionId)?.queueStatus).toBe('succeeded');
  });

  it('requeues a task after lease expiry and rejects the old fence', async () => {
    const { workerId, credential } = await pairWorker();
    await app.inject({
      method: 'PUT',
      url: '/api/v1/config',
      headers: { 'x-user-id': 'esone.qiu' },
      payload: {
        agentExecutors: [
          {
            id: 'codex-remote',
            label: 'Remote Codex',
            type: 'acp-codex',
            runtime: 'remote',
            workerId,
            enabled: true,
          },
        ],
        executorDefaults: { agent_task: 'codex-remote', reflection_research: 'codex-remote' },
      },
    });
    const queued = await app.inject({
      method: 'POST',
      url: '/api/v1/agent-tasks/execute',
      headers: { 'x-user-id': 'esone.qiu' },
      payload: {
        taskId: 'lease-expire-1',
        task: 'lease expire',
        executor: 'codex-remote',
        notify: false,
        idempotencyKey: 'remote-lease-expire-1',
      },
    });
    expect(queued.statusCode).toBe(202);
    const db = userContextManager.getContext('esone.qiu').db;
    const { ActionExecutor } = await import('../core/actions/ActionExecutor.js');
    const { AgentWorkerRepository } = await import(
      '../repositories/AgentWorkerRepository.js'
    );
    const repo = new ActionRepository(db);
    const action = repo.findReusableByIdempotencyKey('remote-lease-expire-1');
    expect(action).toBeTruthy();
    await new ActionExecutor(
      db,
      userContextManager.getContext('esone.qiu').userDataManager,
      'esone.qiu',
    ).executeAction(action!.id);

    const claimed = await app.inject({
      method: 'POST',
      url: `/api/v1/agent-workers/${workerId}/claim`,
      headers: { authorization: `Bearer ${credential}` },
      payload: { maxItems: 1 },
    });
    const task = (
      claimed.json() as { tasks: Array<{ actionId: string; fenceToken: number }> }
    ).tasks[0];
    const workerRepo = new AgentWorkerRepository(db);
    workerRepo.putLease({
      actionId: task.actionId,
      workerId,
      fenceToken: task.fenceToken,
      leaseUntil: 1,
    });
    await new ActionExecutor(
      db,
      userContextManager.getContext('esone.qiu').userDataManager,
      'esone.qiu',
    ).runDueActions(1);
    expect(repo.getById(task.actionId)?.queueStatus).toBe('awaiting_claim');

    const stale = await app.inject({
      method: 'POST',
      url: `/api/v1/agent-workers/${workerId}/report`,
      headers: { authorization: `Bearer ${credential}` },
      payload: {
        actionId: task.actionId,
        fenceToken: task.fenceToken,
        envelope: { status: 'succeeded', summary: 'late', artifacts: [] },
      },
    });
    expect(stale.statusCode).toBe(409);
  });
});
