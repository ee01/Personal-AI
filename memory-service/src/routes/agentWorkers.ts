import type { FastifyInstance } from 'fastify';

import {
  AgentWorkerProtocolError,
  AgentWorkerService,
} from '../integrations/workers/AgentWorkerService.js';
import {
  WORKER_PROTOCOL_VERSION,
  hashWorkerSecret,
} from '../integrations/workers/workerProtocol.js';

function workerInstallCommand(input: {
  serverUrl: string;
  token: string;
}): string {
  const installUrl =
    process.env.WORKER_INSTALL_SH_URL ||
    'https://raw.githubusercontent.com/ee01/Personal-AI/develop/worker/install.sh';
  return `curl -fsSL ${installUrl} | bash -s -- --server ${input.serverUrl} --token ${input.token}`;
}

function publicServerUrl(request: { headers: Record<string, unknown>; protocol?: string }): string {
  const proto =
    String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim() ||
    'http';
  const host =
    String(request.headers['x-forwarded-host'] || request.headers.host || '')
      .split(',')[0]
      .trim() || '127.0.0.1:3210';
  return `${proto}://${host}`;
}

function sendWorkerError(error: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) {
  if (error instanceof AgentWorkerProtocolError) {
    return reply.code(error.statusCode).send({
      error: error.code,
      message: error.message,
    });
  }
  throw error;
}

export async function agentWorkerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/agent-workers', async (request) => {
    const { db, userDataManager } = request.userContext;
    const service = new AgentWorkerService(
      db,
      userDataManager,
      request.userId || 'default',
    );
    return { workers: service.listWorkers() };
  });

  app.post('/agent-workers/pairing-tokens', async (request) => {
    const { db, userDataManager } = request.userContext;
    const userId = request.userId || 'default';
    const service = new AgentWorkerService(db, userDataManager, userId);
    const issued = service.createPairingToken();
    const serverUrl = publicServerUrl(request);
    return {
      ...issued,
      serverUrl,
      installCommand: workerInstallCommand({
        serverUrl,
        token: issued.token,
      }),
    };
  });

  app.post<{
    Body: {
      pairingToken?: string;
      protocolVersion?: number;
      hostname?: string;
      hostKind?: 'desktop' | 'headless';
      capabilities?: Record<string, unknown>;
      label?: string;
    };
  }>('/agent-workers/pair', async (request, reply) => {
    const headerAuth =
      typeof request.headers.authorization === 'string'
        ? request.headers.authorization.replace(/^Bearer\s+/i, '').trim()
        : '';
    const pairingToken =
      String(request.body?.pairingToken || headerAuth || '').trim();
    if (!pairingToken) {
      return reply.code(400).send({ error: 'pairingToken required' });
    }
    const userId = request.userId || 'default';
    const service = new AgentWorkerService(
      request.userContext.db,
      request.userContext.userDataManager,
      userId,
    );
    try {
      return service.pair({
        pairingToken,
        protocolVersion: request.body?.protocolVersion ?? WORKER_PROTOCOL_VERSION,
        hostname: request.body?.hostname,
        hostKind: request.body?.hostKind,
        capabilities: request.body?.capabilities as never,
        label: request.body?.label,
      });
    } catch (error) {
      return sendWorkerError(error, reply);
    }
  });

  app.post<{
    Params: { id: string };
    Body: {
      protocolVersion?: number;
      currentTaskCount?: number;
      capabilities?: Record<string, unknown>;
      hostname?: string;
    };
  }>('/agent-workers/:id/heartbeat', async (request, reply) => {
    if (request.workerId && request.workerId !== request.params.id) {
      return reply.code(403).send({ error: 'worker_mismatch' });
    }
    const service = new AgentWorkerService(
      request.userContext.db,
      request.userContext.userDataManager,
      request.userId || 'default',
    );
    try {
      return service.heartbeat(request.params.id, {
        protocolVersion: request.body?.protocolVersion,
        currentTaskCount: request.body?.currentTaskCount,
        capabilities: request.body?.capabilities as never,
        hostname: request.body?.hostname,
      });
    } catch (error) {
      return sendWorkerError(error, reply);
    }
  });

  app.post<{
    Params: { id: string };
    Body: { maxItems?: number };
  }>('/agent-workers/:id/claim', async (request, reply) => {
    if (request.workerId && request.workerId !== request.params.id) {
      return reply.code(403).send({ error: 'worker_mismatch' });
    }
    const service = new AgentWorkerService(
      request.userContext.db,
      request.userContext.userDataManager,
      request.userId || 'default',
    );
    try {
      return service.claim(request.params.id, request.body?.maxItems ?? 1);
    } catch (error) {
      return sendWorkerError(error, reply);
    }
  });

  app.post<{
    Params: { id: string };
    Body: {
      actionId?: string;
      commandId?: string;
      leaseId?: string;
      fenceToken?: number;
      envelope?: Record<string, unknown>;
      result?: Record<string, unknown>;
    };
  }>('/agent-workers/:id/report', async (request, reply) => {
    if (request.workerId && request.workerId !== request.params.id) {
      return reply.code(403).send({ error: 'worker_mismatch' });
    }
    const service = new AgentWorkerService(
      request.userContext.db,
      request.userContext.userDataManager,
      request.userId || 'default',
    );
    try {
      return await service.report(request.params.id, request.body as never);
    } catch (error) {
      return sendWorkerError(error, reply);
    }
  });

  app.get<{
    Params: { id: string };
  }>('/agent-workers/:id/commands', async (request, reply) => {
    if (request.workerId && request.workerId !== request.params.id) {
      return reply.code(403).send({ error: 'worker_mismatch' });
    }
    const service = new AgentWorkerService(
      request.userContext.db,
      request.userContext.userDataManager,
      request.userId || 'default',
    );
    return { commands: service.listCommands(request.params.id) };
  });

  app.delete<{
    Params: { id: string };
  }>('/agent-workers/:id', async (request, reply) => {
    const service = new AgentWorkerService(
      request.userContext.db,
      request.userContext.userDataManager,
      request.userId || 'default',
    );
    const ok = service.revoke(request.params.id);
    if (!ok) return reply.code(404).send({ error: 'not_found' });
    return { ok: true };
  });
}

export { hashWorkerSecret };
