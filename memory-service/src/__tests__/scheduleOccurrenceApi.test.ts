import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
describe('Schedule exact run receipt', () => {
  let app: FastifyInstance;
  const db = getTestDb();
  beforeAll(async () => { app = (await buildApp({ db })).app; await app.ready(); });
  afterAll(async () => { await app.close(); });
  it('reads one run without consuming another occurrence latest result', async () => {
    const repo = new ActionRepository(db);
    const create = (slot: string) => repo.create({ actionType: 'delegate_openclaw', title: slot, description: slot, params: {metadata: {scheduleSpec: slot}}, riskLevel: 'low', confidence: 1, requiresApproval: false, executionMode: 'auto', priority: 1, sourceKind: 'agent_task', sourceRefId: 'same-task', queueStatus: 'queued', scheduledAt: 1 });
    const first = create('slot-one'); const second = create('slot-two');
    const response = await app.inject({method: 'GET', url: `/api/v1/agent-tasks/runs/${first.id}/result`});
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({runId: first.id, taskId: 'same-task', scheduleSpec: 'slot-one', status: 'queued'});
    expect(response.json().runId).not.toBe(second.id);
    expect(response.json().finalOutput).toBeUndefined();
    expect((await app.inject({method:'GET', url:'/api/v1/agent-tasks/runs/missing/result'})).statusCode).toBe(404);
  });
  it('rejects missing occurrence identity before writing', async () => {
    const response = await app.inject({method:'POST',url:'/api/v1/outreach/templates/invalid/trigger-occurrence',payload:{sourceSystem:'other',occurrenceKey:'',scheduledFor:0}});
    expect(response.statusCode).toBe(400);
  });
});
