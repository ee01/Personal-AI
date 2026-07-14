import type { FastifyInstance } from 'fastify';

import {
  EvidenceWatchContractService,
  type EvidenceWatchState,
  type EvidenceWatchRunState,
} from '../core/EvidenceWatchContractService.js';

const EVIDENCE_WATCH_STATES: EvidenceWatchState[] = [
  'active',
  'quiet_no_change',
  'due',
  'authority_changed',
  'source_blocked',
  'paused',
  'archived',
];

function normalizeState(value?: string): {
  state: EvidenceWatchState | 'all';
  invalidState?: string;
} {
  if (!value || value === 'all') return { state: 'all' };
  if (
    EVIDENCE_WATCH_STATES.includes(value as EvidenceWatchState)
  ) {
    return { state: value as EvidenceWatchState };
  }
  return { state: 'all', invalidState: value };
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

function parseBoundedLimit(value?: string): number {
  const parsed = Number.parseInt(value ?? '20', 10);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(parsed, 100));
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
    const { state, invalidState } = normalizeState(request.query.state);
    if (invalidState) {
      return reply.status(400).send({
        error: 'Invalid evidence watch state filter',
        receipt: {
          label: '证据守望筛选已阻断',
          detail:
            `state=${invalidState} 不是支持的证据守望状态；` +
            '本次未读取列表、未复核权威来源、未创建 action，也未修改 contract 状态。',
          invalidState,
          allowedStates: ['all', ...EVIDENCE_WATCH_STATES],
          readOnly: true,
        },
      });
    }
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
      readReceipt: service.buildDetailReadReceipt(contract),
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
    const limit = parseBoundedLimit(request.query.limit);
    const items = service.listRuns(contract.id, limit);
    return reply.status(200).send({
      contractId: contract.id,
      items,
      limit,
      receipt: service.buildRunHistoryReadReceipt({
        contract,
        returnedCount: items.length,
        limit,
      }),
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
