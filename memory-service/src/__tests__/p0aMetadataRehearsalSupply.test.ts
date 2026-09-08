/**
 * P0a-2/4/5/6 tests (memory-foundation plan §11.2):
 * - metadata contract decoder (schema v2 flat + legacy nested + priority map)
 * - rehearsal activation hour-bucket upsert (write-amplification stop)
 * - /diagnostics/supply telemetry route
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../llm/LLMClient.js', () => ({
  getLLMClient: () => ({
    generate: vi.fn().mockRejectedValue(new Error('LLM not available in tests')),
    generateJSON: vi
      .fn()
      .mockRejectedValue(new Error('LLM not available in tests')),
  }),
  LLMClient: vi.fn(),
}));

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi
      .fn()
      .mockRejectedValue(new Error('Embedding not available in tests')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import {
  normalizeIngestMetadata,
  PRIORITY_TO_IMPORTANCE,
  INGEST_PRIORITY_IMPORTANCE_MAP_VERSION,
} from '../core/IngestionPipeline.js';
import { RehearsalService } from '../core/RehearsalService.js';
import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

// ---------------------------------------------------------------------------
// P0a-2 — ingest metadata contract
// ---------------------------------------------------------------------------

describe('normalizeIngestMetadata (P0a-2 schema-v2 + legacy decoder)', () => {
  it('schema v2 flat: metadata.sentiment + metadata.importance win', () => {
    expect(
      normalizeIngestMetadata({ sentiment: 'positive', importance: 0.8 }),
    ).toEqual({ sentiment: 'positive', importance: 0.8 });
  });

  it('legacy nested metadata.metadata envelope is tolerated', () => {
    expect(
      normalizeIngestMetadata({
        sentiment: null,
        metadata: { sentiment: 'negative', priority: 'high' },
      } as Record<string, any>),
    ).toEqual({ sentiment: 'negative', importance: 0.75 });
  });

  it('string priority maps through the server-side versioned table', () => {
    expect(normalizeIngestMetadata({ priority: 'LOW' })).toMatchObject({
      importance: PRIORITY_TO_IMPORTANCE.low,
    });
    expect(normalizeIngestMetadata({ priority: 'critical' })).toMatchObject({
      importance: PRIORITY_TO_IMPORTANCE.critical,
    });
    // unknown labels fall back to neutral default, never NaN
    expect(normalizeIngestMetadata({ priority: 'urgent!!!' })).toMatchObject({
      importance: 0.5,
    });
    expect(Number.isFinite(INGEST_PRIORITY_IMPORTANCE_MAP_VERSION)).toBe(true);
  });

  it('clamps out-of-range numeric importance and defaults cleanly', () => {
    expect(normalizeIngestMetadata({ importance: 7 })).toMatchObject({
      importance: 1,
    });
    expect(normalizeIngestMetadata({ importance: -3 })).toMatchObject({
      importance: 0,
    });
    expect(normalizeIngestMetadata(undefined)).toEqual({
      sentiment: 'neutral',
      importance: 0.5,
    });
    expect(normalizeIngestMetadata({ sentiment: '   ' })).toMatchObject({
      sentiment: 'neutral',
    });
  });
});

// ---------------------------------------------------------------------------
// P0a-4 — rehearsal activation hour-bucket upsert
// ---------------------------------------------------------------------------

describe('RehearsalActivation hour-bucket upsert (P0a-4)', () => {
  let db: BetterSqlite3.Database;

  const createRehearsal = (): { id: string } => {
    const svc = new RehearsalService(db);
    const rehearsal = svc.create({
      title: 'Bucket test rehearsal',
      scenarioType: 'writing',
      content: 'Say the thing at the future moment.',
      activationCues: { people: ['Colin Liu'], surfaces: ['jira_issue'] },
      confidence: 0.9,
    });
    return { id: rehearsal.id };
  };

  const record = (svc: RehearsalService, rehearsalId: string, sceneKey: string) =>
    svc.recordMatchedActivation({
      rehearsalId,
      surface: 'web_passive',
      contextType: 'jira_issue',
      sceneKey,
      score: 0.8,
      displayPriority: 'p1',
      matchedCues: { people: ['Colin Liu'] },
    });

  it('same scene within the same hour → one aggregated row, repeat_count grows', () => {
    db = getTestDb();
    db.prepare('DELETE FROM rehearsal_activations').run();
    const { id } = createRehearsal();
    const svc = new RehearsalService(db);

    const sceneKey = 'web_passive|jira_issue|group-1||||Colin Liu';
    const first = record(svc, id, sceneKey);
    for (let i = 0; i < 99; i += 1) {
      record(svc, id, sceneKey);
    }

    const rows = db
      .prepare('SELECT * FROM rehearsal_activations WHERE rehearsal_id = ?')
      .all(id) as Array<{ repeat_count: number; window_start: number }>;
    // Hard gate: 100 hits on the same scene/hour → exactly ONE row with
    // repeat_count = 100.
    expect(rows).toHaveLength(1);
    expect(rows[0].repeat_count).toBe(100);
    expect(rows[0].window_start).toBe(first.windowStart);
    // The service re-reads the aggregated row after upsert, so a fresh fetch
    // reflects the final repeat_count.
    const fresh = record(svc, id, sceneKey);
    expect(fresh.repeatCount).toBe(101);
  });

  it('different scene or different hour → separate rows', () => {
    db = getTestDb();
    db.prepare('DELETE FROM rehearsal_activations').run();
    const { id } = createRehearsal();
    const svc = new RehearsalService(db);

    const a = record(svc, id, 'web_passive|jira_issue|group-A');
    const b = record(svc, id, 'web_passive|jira_issue|group-B');

    expect(a.id).not.toBe(b.id);
    const rows = db
      .prepare('SELECT COUNT(*) AS c FROM rehearsal_activations WHERE rehearsal_id = ?')
      .get(id) as { c: number };
    expect(rows.c).toBe(2);

    // Bucket rows carry the scene key hash, not raw scene text equality alone.
    const hashed = db
      .prepare('SELECT scene_key_hash FROM rehearsal_activations WHERE id = ?')
      .get(a.id) as { scene_key_hash: string };
    expect(hashed.scene_key_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// P0a-6 — /diagnostics/supply telemetry route
// ---------------------------------------------------------------------------

describe('GET /api/v1/diagnostics/supply (P0a-6)', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  it('reports supply gaps and runtime gate readout', async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/diagnostics/supply',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.flags).toHaveProperty('memorySupplyDecoupled');
    expect(typeof body.supply.messages.total).toBe('number');
    expect(typeof body.supply.lexical.eligibleMissingChunks).toBe('number');
    expect(typeof body.supply.lexical.messageChunks).toBe('number');
    expect(body).toHaveProperty('amplification.rehearsalActivations');

    await app.close();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });
});
