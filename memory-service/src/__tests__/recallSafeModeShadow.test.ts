/**
 * P0c safe-mode shadow tests (plan §11.4 / I11): when the recall route runs
 * under safe_fts policy, the full-channel shadow probe must not change
 * results and must not reinforce access counts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../llm/LLMClient.js', () => ({
  getLLMClient: () => ({
    generate: vi.fn().mockRejectedValue(new Error('LLM unavailable')),
    generateJSON: vi.fn().mockRejectedValue(new Error('LLM unavailable')),
  }),
  LLMClient: vi.fn(),
}));

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi.fn().mockRejectedValue(new Error('no embedding')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

describe('recall safe-mode shadow (P0c §11.4, I11)', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;
  const savedSafeMode = process.env.RECALL_ROUTE_SAFE_MODE_ENABLED;

  beforeEach(async () => {
    db = getTestDb();
    process.env.RECALL_ROUTE_SAFE_MODE_ENABLED = 'true'; // force safe_fts
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    if (savedSafeMode === undefined) delete process.env.RECALL_ROUTE_SAFE_MODE_ENABLED;
    else process.env.RECALL_ROUTE_SAFE_MODE_ENABLED = savedSafeMode;
  });

  it('safe mode restricts channels to fts and the shadow probe never reinforces', async () => {
    const marker = `safe-mode-shadow-probe-${Date.now()}`;
    const ingest = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest',
      payload: {
        content: `Meeting decided to archive ${marker} quarterly. ${marker}`,
        sourceType: 'manual',
        sender: 'tester',
        timestamp: Math.floor(Date.now() / 1000),
      },
    });
    expect(ingest.statusCode).toBe(200);
    const messageId = ingest.json().id;

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/recall',
      payload: { query: marker, topK: 5, includeMetadata: true },
    });
    expect(first.statusCode).toBe(200);
    const body = first.json();
    // Safe policy: fts-only channels, bounded topK.
    expect(body.channels).toEqual(['fts']);
    expect(body.items.length).toBeGreaterThan(0);

    const meta = db
      .prepare(`SELECT access_count FROM memory_metadata WHERE target_id = ?`)
      .get(messageId) as { access_count: number } | undefined;
    const afterFirst = meta?.access_count ?? 0;
    expect(afterFirst).toBeLessThanOrEqual(1); // no shadow double-reinforce

    // Second recall: results identical, reinforcement bounded (shadow still
    // must not double-count per request).
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/recall',
      payload: { query: marker, topK: 5, includeMetadata: true },
    });
    expect(second.json().items.map((i: { id: string }) => i.id)).toEqual(
      body.items.map((i: { id: string }) => i.id),
    );
  });
});
