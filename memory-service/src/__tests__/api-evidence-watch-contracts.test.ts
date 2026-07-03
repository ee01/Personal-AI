import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi
      .fn()
      .mockRejectedValue(new Error('Embedding not available in tests')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

import { buildApp } from '../server.js';
import { EvidenceWatchContractService } from '../core/EvidenceWatchContractService.js';
import { getTestDb } from './setup.js';

function resetEvidenceWatchTables(db: BetterSqlite3.Database): void {
  db.prepare('DELETE FROM evidence_watch_links').run();
  db.prepare('DELETE FROM evidence_watch_runs').run();
  db.prepare('DELETE FROM evidence_watch_contracts').run();
}

describe('Evidence watch contracts API', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    resetEvidenceWatchTables(db);
  });

  it('lists contract detail and appends run receipts', async () => {
    const service = new EvidenceWatchContractService(db);
    const created = service.createOrReuse({
      subjectKey: 'source:jira:mtr-148115|gap:future_monitoring',
      title: 'MTR-148115 DEV Estimate Original',
      question: 'MTR-148115 的 DEV Estimate Original 是否变化？',
      authoritySources: [
        {
          sourceId: 'jira:MTR-148115:DEV Estimate Original',
          sourceKind: 'jira_field',
          title: 'Jira field',
          evidenceRole: 'authority',
          accessPolicy: 'read_only',
        },
      ],
      verifier: {
        kind: 'openclaw_read',
        actionType: 'delegate_openclaw',
        mode: 'read',
        reasonCode: 'future_monitoring',
        gapType: 'future_monitoring',
      },
      cadence: 'on_revisit',
      createdFrom: { kind: 'reflection', refId: 'thread-148115' },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/evidence-watch-contracts?state=all',
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toHaveLength(1);
    expect(list.json().items[0].id).toBe(created.contract.id);

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/evidence-watch-contracts/${created.contract.id}`,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().receipt).toMatchObject({
      contractId: created.contract.id,
      label: '证据守望已建立',
    });
    expect(detail.json().receipt.detail).toContain(
      '不代表权威来源已完成复核',
    );

    const receipt = await app.inject({
      method: 'POST',
      url: `/api/v1/evidence-watch-contracts/${created.contract.id}/runs`,
      payload: {
        runState: 'blocked',
        summary: 'Jira session unavailable; keep old estimate as historical.',
        checkedSources: [
          {
            sourceId: 'jira:MTR-148115:DEV Estimate Original',
            status: 'blocked',
          },
        ],
        userVisible: true,
      },
    });
    expect(receipt.statusCode).toBe(201);
    expect(receipt.json().contract.state).toBe('source_blocked');
    expect(receipt.json().uiReceipt.label).toBe('证据守望来源阻塞');

    const runs = await app.inject({
      method: 'GET',
      url: `/api/v1/evidence-watch-contracts/${created.contract.id}/runs`,
    });
    expect(runs.statusCode).toBe(200);
    expect(
      runs
        .json()
        .items.map((item: { runState: string }) => item.runState),
    ).toContain('blocked');
  });
});
