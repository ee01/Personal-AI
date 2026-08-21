import type Database from 'better-sqlite3';

import { ActionExecutor } from '../../core/actions/ActionExecutor.js';
import type { AgentResultEnvelope } from '../executors/AgentExecutor.js';
import {
  findEnabledExecutor,
  type AgentExecutorInstance,
} from '../executors/executorRegistry.js';
import { ActionRepository } from '../../repositories/ActionRepository.js';
import { AgentWorkerRepository } from '../../repositories/AgentWorkerRepository.js';
import { getUserRuntimeConfig } from '../../runtimeConfig.js';
import type { UserDataManager } from '../../storage/UserDataManager.js';
import { now } from '../../utils/time.js';
import {
  WORKER_LEASE_SECONDS,
  WORKER_MIN_PROTOCOL_VERSION,
  WORKER_PAIRING_TTL_SECONDS,
  WORKER_PROTOCOL_VERSION,
  hashWorkerSecret,
  issueWorkerCredential,
  newPairingToken,
  newWorkerId,
  protocolCompatible,
  type WorkerCapabilities,
  type WorkerHostKind,
} from './workerProtocol.js';

export class AgentWorkerProtocolError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'AgentWorkerProtocolError';
  }
}

export class AgentWorkerService {
  private readonly workers: AgentWorkerRepository;
  private readonly actions: ActionRepository;

  constructor(
    private readonly db: Database.Database,
    private readonly userDataManager?: UserDataManager,
    private readonly userId: string = 'default',
  ) {
    this.workers = new AgentWorkerRepository(db);
    this.actions = new ActionRepository(db);
  }

  listWorkers() {
    return this.workers.listActive().map((worker) => ({
      id: worker.id,
      label: worker.label || worker.hostname || worker.id,
      hostname: worker.hostname,
      hostKind: worker.hostKind,
      status: worker.status,
      protocolVersion: worker.protocolVersion,
      capabilities: worker.capabilities,
      lastHeartbeatAt: worker.lastHeartbeatAt,
      currentTaskCount: worker.currentTaskCount,
    }));
  }

  createPairingToken(): {
    token: string;
    expiresAt: number;
    protocolVersion: number;
  } {
    const token = newPairingToken(this.userId);
    const expiresAt = now() + WORKER_PAIRING_TTL_SECONDS;
    this.workers.createPairingToken(hashWorkerSecret(token), expiresAt);
    return {
      token,
      expiresAt,
      protocolVersion: WORKER_PROTOCOL_VERSION,
    };
  }

  pair(input: {
    pairingToken: string;
    protocolVersion?: number;
    hostname?: string;
    hostKind?: WorkerHostKind;
    capabilities?: WorkerCapabilities;
    label?: string;
  }): {
    workerId: string;
    credential: string;
    protocolVersion: number;
    minProtocolVersion: number;
  } {
    if (!protocolCompatible(input.protocolVersion)) {
      throw new AgentWorkerProtocolError(
        `Worker protocol ${input.protocolVersion ?? 'missing'} is below minimum ${WORKER_MIN_PROTOCOL_VERSION}. Upgrade the worker or Desktop App.`,
        'protocol_incompatible',
        409,
      );
    }
    const consumed = this.workers.consumePairingToken(
      hashWorkerSecret(input.pairingToken),
    );
    if (!consumed) {
      throw new AgentWorkerProtocolError(
        'Pairing token is invalid, used, or expired.',
        'invalid_pairing_token',
        401,
      );
    }
    const workerId = newWorkerId();
    const issued = issueWorkerCredential(this.userId, workerId);
    this.workers.insert({
      id: workerId,
      label: input.label,
      hostname: input.hostname,
      hostKind: input.hostKind === 'desktop' ? 'desktop' : 'headless',
      protocolVersion: input.protocolVersion || WORKER_PROTOCOL_VERSION,
      capabilities: { echo: true, ...(input.capabilities || {}) },
      credentialHash: issued.hash,
      credentialPrefix: issued.prefix,
    });
    return {
      workerId,
      credential: issued.token,
      protocolVersion: WORKER_PROTOCOL_VERSION,
      minProtocolVersion: WORKER_MIN_PROTOCOL_VERSION,
    };
  }

  heartbeat(
    workerId: string,
    body: {
      protocolVersion?: number;
      currentTaskCount?: number;
      capabilities?: WorkerCapabilities;
      hostname?: string;
    },
  ) {
    if (!protocolCompatible(body.protocolVersion)) {
      throw new AgentWorkerProtocolError(
        `Worker protocol ${body.protocolVersion ?? 'missing'} is below minimum ${WORKER_MIN_PROTOCOL_VERSION}.`,
        'protocol_incompatible',
        409,
      );
    }
    const worker = this.workers.heartbeat(workerId, body);
    if (!worker) {
      throw new AgentWorkerProtocolError('Worker not found', 'not_found', 404);
    }
    return {
      ok: true,
      protocolVersion: WORKER_PROTOCOL_VERSION,
      commands: this.workers.listPendingCommands(workerId).map((item) => ({
        id: item.id,
        kind: item.kind,
        payload: item.payload,
      })),
    };
  }

  lookupHeartbeat(workerId: string) {
    const worker = this.workers.getById(workerId);
    if (!worker || worker.revokedAt) return null;
    const listed = this.workers.listActive().find((item) => item.id === workerId);
    return listed
      ? {
          lastHeartbeatAt: listed.lastHeartbeatAt ?? null,
          status: listed.status,
          label: listed.label,
        }
      : {
          lastHeartbeatAt: worker.lastHeartbeatAt ?? null,
          status: worker.status,
          label: worker.label,
        };
  }

  enqueueEcho(workerId: string): { commandId: string } {
    const command = this.workers.enqueueCommand({
      workerId,
      kind: 'echo',
      payload: { at: now() },
      expiresAt: now() + 30,
    });
    return { commandId: command.id };
  }

  async waitEcho(commandId: string, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const command = this.workers.getCommand(commandId);
      if (command?.status === 'done') return true;
      if (!command || command.status === 'expired') return false;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return this.workers.getCommand(commandId)?.status === 'done';
  }

  listCommands(workerId: string) {
    return this.workers.listPendingCommands(workerId);
  }

  completeCommand(workerId: string, commandId: string, result: Record<string, unknown>) {
    const command = this.workers.getCommand(commandId);
    if (!command || command.workerId !== workerId) {
      throw new AgentWorkerProtocolError('Command not found', 'not_found', 404);
    }
    return this.workers.completeCommand(commandId, result);
  }

  claim(workerId: string, maxItems = 1) {
    this.reclaimExpiredLeases();
    const worker = this.workers.getById(workerId);
    if (!worker || worker.revokedAt) {
      throw new AgentWorkerProtocolError('Worker not found', 'not_found', 404);
    }
    const due = this.actions.listAwaitingClaim(workerId, Math.max(1, maxItems));
    const tasks = [];
    for (const action of due) {
      const fenceToken = this.workers.nextLeaseEpoch(workerId);
      const leaseUntil = now() + WORKER_LEASE_SECONDS;
      this.workers.putLease({
        actionId: action.id,
        workerId,
        fenceToken,
        leaseUntil,
      });
      this.actions.markClaimedByWorker(action.id, workerId, fenceToken, leaseUntil);
      const executor = this.resolveExecutor(action.params);
      tasks.push({
        actionId: action.id,
        leaseId: `${action.id}:${fenceToken}`,
        fenceToken,
        leaseUntil,
        executor,
        request: this.buildSubmitRequest(action, executor),
        memory: this.buildMemoryHint(),
      });
    }
    return { tasks };
  }

  async report(
    workerId: string,
    body: {
      actionId?: string;
      commandId?: string;
      leaseId?: string;
      fenceToken?: number;
      envelope?: AgentResultEnvelope;
      result?: Record<string, unknown>;
    },
  ) {
    if (body.commandId) {
      this.completeCommand(workerId, body.commandId, body.result || { ok: true });
      return { ok: true, kind: 'command' };
    }
    const actionId = body.actionId?.trim();
    if (!actionId) {
      throw new AgentWorkerProtocolError('actionId required', 'invalid_report');
    }
    const lease = this.workers.getLease(actionId);
    if (!lease || lease.workerId !== workerId) {
      throw new AgentWorkerProtocolError(
        'No active lease for this action',
        'lease_mismatch',
        409,
      );
    }
    if (body.fenceToken !== lease.fenceToken) {
      throw new AgentWorkerProtocolError(
        'Stale fence token; this worker no longer owns the lease',
        'stale_fence',
        409,
      );
    }
    if (lease.leaseUntil <= now()) {
      throw new AgentWorkerProtocolError('Lease expired', 'lease_expired', 409);
    }
    if (!body.envelope) {
      throw new AgentWorkerProtocolError('envelope required', 'invalid_report');
    }
    const executor = new ActionExecutor(
      this.db,
      this.userDataManager,
      this.userId,
    );
    const applied = await executor.applyWorkerEnvelope(actionId, body.envelope);
    this.workers.deleteLease(actionId);
    return { ok: true, kind: 'task', ...applied };
  }

  revoke(workerId: string): boolean {
    return this.workers.revoke(workerId);
  }

  reclaimExpiredLeases(): number {
    const expired = this.workers.listExpiredLeases();
    for (const lease of expired) {
      this.actions.requeueExpiredWorkerLease(lease.actionId);
      this.workers.deleteLease(lease.actionId);
    }
    return expired.length;
  }

  private buildMemoryHint() {
    const port = Number(process.env.PORT || 3210);
    const base = (
      process.env.MEMORY_SERVICE_PUBLIC_URL ||
      process.env.MEMORY_SERVICE_URL ||
      `http://127.0.0.1:${port}`
    ).replace(/\/$/, '');
    return {
      mcpUrl: `${base}/mcp`,
      userId: this.userId,
    };
  }

  private resolveExecutor(
    params: Record<string, unknown>,
  ): AgentExecutorInstance | null {
    const config = getUserRuntimeConfig(this.userDataManager);
    const metadata =
      params.metadata && typeof params.metadata === 'object'
        ? (params.metadata as Record<string, unknown>)
        : {};
    const requested =
      (typeof params.executor === 'string' && params.executor) ||
      (typeof metadata.executorId === 'string' && metadata.executorId) ||
      undefined;
    return findEnabledExecutor(config, requested);
  }

  private buildSubmitRequest(
    action: {
      id: string;
      title: string;
      description?: string;
      threadId?: string;
      runId?: string;
      retryCount: number;
      params: Record<string, unknown>;
    },
    executor: AgentExecutorInstance | null,
  ) {
    const params = action.params;
    return {
      task:
        typeof params.task === 'string' && params.task.trim()
          ? params.task.trim()
          : [action.title, action.description].filter(Boolean).join('\n\n'),
      mode: params.mode === 'write' ? 'write' : 'read',
      targetSystem:
        typeof params.targetSystem === 'string' ? params.targetSystem : undefined,
      threadId: action.threadId ?? action.id,
      runId: action.runId,
      actionId: action.id,
      idempotencyKey: `pai:${action.id}:attempt-${action.retryCount}`,
      timeoutMs:
        typeof params.timeoutMs === 'number' ? params.timeoutMs : undefined,
      executor,
      metadata:
        params.metadata && typeof params.metadata === 'object'
          ? params.metadata
          : {},
    };
  }
}
