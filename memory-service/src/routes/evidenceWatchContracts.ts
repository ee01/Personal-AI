import type { FastifyInstance } from 'fastify';

import {
  EvidenceWatchContractService,
  type EvidenceWatchState,
  type EvidenceWatchRunState,
} from '../core/EvidenceWatchContractService.js';

function normalizeState(value?: string): EvidenceWatchState | 'all' | undefined {
  if (!value || value === 'all') return value === 'all' ? 'all' : undefined;
  if (
    value === 'active' ||
    value === 'quiet_no_change' ||
    value === 'due' ||
    value === 'authority_changed' ||
    value === 'source_blocked' ||
    value === 'paused' ||
    value === 'archived'
  ) {
    return value;
  }
  return undefined;
}

function normalizeRunState(value?: string): EvidenceWatchRunState | undefined {
  if (
    value === 'created' ||
    value === 'checked_no_change' ||
    value === 'checked_changed' ||
    value === 'blocked' ||
    value === 'skipped_budget' ||
    value === 'skipped_duplicate' ||
    value === 'needs_user_decision'
  ) {
    return value;
  }
  return undefined;
}

export async function evidenceWatchContractRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get<{
    Querystring: {
      state?: string;
      subjectKey?: string;
      limit?: string;
      offset?: string;
    };
  }>('/evidence-watch-contracts', async (request, reply) => {
    const service = new EvidenceWatchContractService(request.userContext.db);
    const state = normalizeState(request.query.state) ?? 'all';
    const result = service.list({
      state,
      subjectKey: request.query.subjectKey,
      limit: parseInt(request.query.limit ?? '20', 10) || 20,
      offset: parseInt(request.query.offset ?? '0', 10) || 0,
    });
    return reply.status(200).send(result);
  });

  app.get<{
    Params: { id: string };
  }>('/evidence-watch-contracts/:id', async (request, reply) => {
    const service = new EvidenceWatchContractService(request.userContext.db);
    const contract = service.getById(request.params.id);
    if (!contract) {
      return reply.status(404).send({ error: 'Evidence watch contract not found' });
    }
    return reply.status(200).send({
      contract,
      receipt: service.toUiReceipt(contract),
    });
  });

  app.get<{
    Params: { id: string };
    Querystring: { limit?: string };
  }>('/evidence-watch-contracts/:id/runs', async (request, reply) => {
    const service = new EvidenceWatchContractService(request.userContext.db);
    const contract = service.getById(request.params.id);
    if (!contract) {
      return reply.status(404).send({ error: 'Evidence watch contract not found' });
    }
    return reply.status(200).send({
      contractId: contract.id,
      items: service.listRuns(
        contract.id,
        parseInt(request.query.limit ?? '20', 10) || 20,
      ),
    });
  });

  app.post<{
    Params: { id: string };
    Body: {
      runState: string;
      summary?: string;
      checkedSources?: Array<{
        sourceId: string;
        status: 'ok' | 'blocked' | 'not_configured' | 'rate_limited' | 'no_new_signal';
        observedValue?: string;
        observedAt?: number;
      }>;
      suppressedActionIds?: string[];
      createdPatchIds?: string[];
      userVisible?: boolean;
    };
  }>('/evidence-watch-contracts/:id/runs', async (request, reply) => {
    const service = new EvidenceWatchContractService(request.userContext.db);
    const contract = service.getById(request.params.id);
    if (!contract) {
      return reply.status(404).send({ error: 'Evidence watch contract not found' });
    }
    const runState = normalizeRunState(request.body.runState);
    if (!runState) {
      return reply.status(400).send({ error: 'Invalid evidence watch runState' });
    }
    const receipt = service.appendRunReceipt({
      contractId: contract.id,
      runState,
      summary: request.body.summary ?? 'Evidence watch run recorded.',
      checkedSources: request.body.checkedSources,
      suppressedActionIds: request.body.suppressedActionIds,
      createdPatchIds: request.body.createdPatchIds,
      userVisible: request.body.userVisible,
    });
    const updated = service.getById(contract.id)!;
    return reply.status(201).send({
      receipt,
      contract: updated,
      uiReceipt: service.toUiReceipt(updated, { runId: receipt.id }),
    });
  });
}
