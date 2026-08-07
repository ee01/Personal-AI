import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi.fn().mockRejectedValue(new Error('Embedding not available in tests')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

const TABLES_TO_CLEAR = [
  'memory_change_events',
  'memory_change_chains',
  'memory_change_extractions',
  'source_memory_events',
  'source_memory_links',
  'source_memory_triggers',
  'source_memory_takeaways',
  'source_memory_anchors',
  'source_memory_capsules',
  'memory_feedback_events',
  'memory_metadata',
  'chunks',
  'messages_raw',
];

function clearTables(db: BetterSqlite3.Database): void {
  for (const table of TABLES_TO_CLEAR) {
    try {
      db.prepare(`DELETE FROM ${table}`).run();
    } catch {
      // Optional tables can be absent in partial migration snapshots.
    }
  }
  try {
    db.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`).run();
  } catch {
    // FTS is optional in stripped test environments.
  }
}

describe('Change Memory Ledger API integration', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  beforeEach(() => clearTables(db));

  afterAll(async () => {
    await app.close();
  });

  it('returns source receipts, recalls the same stable subject, and excludes dismissed evidence', async () => {
    const saveResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/source-memory/capsules',
      payload: {
        sourceKind: 'webpage',
        sourceUrl: 'https://release.example.com/desktop-8-4',
        sourceTitle: 'Desktop 8.4 release plan',
        text:
          'Desktop 8.4 release planning notes. The release date moved after the final regression window, and the saved page remains the reviewable source.',
        captureMode: 'manual',
        captureReason: '用户保存发布计划',
        interactions: { manualClick: true, copiedText: true },
        metadata: {
          releaseId: 'desktop-8.4',
          releaseTitle: 'Desktop 8.4',
          authoritative: true,
          connectorReceipt: true,
          changeEvents: [{
            field: 'Release Date',
            oldValue: '2026-08-01',
            newValue: '2026-08-08',
            authorityRole: 'owner_authored',
            reason: 'Final regression window moved by one week.',
            observedAt: 1_784_483_200,
          }],
        },
      },
    });

    expect(saveResponse.statusCode).toBe(200);
    const savedCapsule = saveResponse.json().capsule;
    expect(savedCapsule.changeLedger).toMatchObject({
      status: 'ready',
      active: true,
      extractedCount: 1,
    });
    expect(savedCapsule.changeLedger.projections).toHaveLength(1);
    expect(savedCapsule.changeLedger.projections[0]).toMatchObject({
      subjectKey: 'release:desktop-8.4',
      propertyKey: 'release.date',
      status: 'last_observed',
      currentValue: { normalized: '2026-08-08' },
    });

    const recallResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        primaryText: 'Desktop 8.4 release plan',
        entityHints: [{ kind: 'release_id', value: 'desktop-8.4' }],
        currentContext: {
          title: 'Desktop 8.4 release',
          url: 'https://release.example.com/desktop-8-4',
        },
        limit: 3,
      },
    });

    expect(recallResponse.statusCode).toBe(200);
    expect(recallResponse.json().changeProjections).toHaveLength(1);
    expect(recallResponse.json().changeProjections[0]).toMatchObject({
      subjectKey: 'release:desktop-8.4',
      propertyKey: 'release.date',
      currentValue: { normalized: '2026-08-08' },
    });

    const dismissResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/source-memory/capsules/${savedCapsule.id}/dismiss`,
      payload: { reason: '用户撤销发布计划资料' },
    });

    expect(dismissResponse.statusCode).toBe(200);
    expect(dismissResponse.json().capsule.changeLedger).toMatchObject({
      active: false,
    });
    expect(dismissResponse.json().capsule.changeLedger.projections[0]).toMatchObject({
      status: 'historical_only',
      boundary: expect.stringContaining('不参与当前状态投影'),
    });

    const recallAfterDismiss = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        primaryText: 'Desktop 8.4 release plan',
        entityHints: [{ kind: 'release_id', value: 'desktop-8.4' }],
        limit: 3,
      },
    });

    expect(recallAfterDismiss.statusCode).toBe(200);
    expect(recallAfterDismiss.json().changeProjections || []).toEqual([]);
  });

  it('accepts an explicit empty Jira REST field as current-source evidence', async () => {
    const saveResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/source-memory/capsules',
      payload: {
        sourceKind: 'jira_comment',
        sourceUrl: 'https://jira.example.com/browse/MTR-148115#comment-1',
        sourceTitle: 'MTR-148115 owner comment',
        text: 'Summary: QA Estimate Original: 1.01 New: 1.02',
        captureMode: 'auto',
        captureReason: 'owner comment',
        interactions: { ownerAuthored: true },
        metadata: { issueKey: 'MTR-148115', ownerAuthored: true },
      },
    });
    expect(saveResponse.statusCode).toBe(200);

    const recallResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'jira_issue',
        currentContext: {
          issueKey: 'MTR-148115',
          verifiedSourceFields: [{
            propertyKey: 'estimate.qa',
            name: 'QA Estimate',
            value: null,
            source: 'jira_rest',
            checkedAt: 1_784_541_500,
          }],
        },
        entityHints: [{ kind: 'jira_issue_key', value: 'MTR-148115' }],
      },
    });
    expect(recallResponse.statusCode).toBe(200);
    expect(recallResponse.json().changeProjections).toEqual([
      expect.objectContaining({
        propertyKey: 'estimate.qa',
        status: 'superseded_at_source',
        currentValue: expect.objectContaining({ normalized: null }),
        boundary: expect.stringContaining('确认当前为空'),
      }),
    ]);
  });
});
