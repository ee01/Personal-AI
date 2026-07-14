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
    expect(list.json().receipt).toMatchObject({
      label: '证据守望列表快照',
      state: 'all',
      returnedCount: 1,
      total: 1,
      readOnly: true,
    });
    expect(list.json().receipt.detail).toContain(
      '本次只读列表不会复核权威来源',
    );

    const invalidStateList = await app.inject({
      method: 'GET',
      url: '/api/v1/evidence-watch-contracts?state=quiet',
    });
    expect(invalidStateList.statusCode).toBe(400);
    expect(invalidStateList.json().receipt).toMatchObject({
      label: '证据守望筛选已阻断',
      invalidState: 'quiet',
      readOnly: true,
    });
    expect(invalidStateList.json().receipt.detail).toContain('本次未读取列表');

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/evidence-watch-contracts/${created.contract.id}`,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().receipt).toMatchObject({
      contractId: created.contract.id,
      label: '证据守望已建立',
      lastRunState: 'created',
    });
    expect(detail.json().receipt.detail).toContain(
      '不代表权威来源已完成复核',
    );
    expect(detail.json().readReceipt).toMatchObject({
      label: '证据守望详情快照',
      contractId: created.contract.id,
      state: 'active',
      lastRunState: 'created',
      nextCheckAt: created.contract.nextCheckAt,
      nextCheckDue: false,
      readOnly: true,
    });
    expect(detail.json().readReceipt.lastCheckedAt).toBeUndefined();
    expect(detail.json().readReceipt.detail).toContain(
      '本次只读详情不会复核权威来源',
    );
    expect(detail.json().readReceipt.detail).toContain('复核时间基准');
    expect(detail.json().readReceipt.detail).toContain('lastCheckedAt=none');

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
    expect(receipt.json().contract.lastCheckedAt).toEqual(expect.any(Number));
    expect(receipt.json().contract.nextCheckAt).toBeUndefined();
    expect(receipt.json().uiReceipt.label).toBe('证据守望来源阻塞');
    expect(receipt.json().uiReceipt.lastRunState).toBe('blocked');
    expect(receipt.json().uiReceipt.lastCheckedAt).toEqual(expect.any(Number));

    const runs = await app.inject({
      method: 'GET',
      url: `/api/v1/evidence-watch-contracts/${created.contract.id}/runs?limit=5`,
    });
    expect(runs.statusCode).toBe(200);
    expect(
      runs
        .json()
        .items.map((item: { runState: string }) => item.runState),
    ).toContain('blocked');
    expect(runs.json().receipt).toMatchObject({
      label: '证据守望运行快照',
      contractId: created.contract.id,
      state: 'source_blocked',
      lastRunState: 'blocked',
      lastCheckedAt: receipt.json().contract.lastCheckedAt,
      nextCheckDue: false,
      returnedCount: 2,
      limit: 5,
      readOnly: true,
    });
    expect(runs.json().receipt.nextCheckAt).toBeUndefined();
    expect(runs.json().receipt.detail).toContain(
      '本次只读历史不会复核权威来源',
    );
    expect(runs.json().receipt.detail).toContain('复核时间基准');
    expect(runs.json().receipt.detail).toContain('nextCheckAt=none');
  });
});
