/**
 * Integration tests for ingestion API endpoints.
 *
 * Uses Fastify's inject() method — no real HTTP server is started.
 * LLM and embedding clients are mocked so tests run fast without
 * external API keys or model downloads.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock the LLM client — fails immediately so the pipeline falls through gracefully
vi.mock('../llm/LLMClient.js', () => ({
  getLLMClient: () => ({
    generate: vi
      .fn()
      .mockRejectedValue(new Error('LLM not available in tests')),
    generateJSON: vi
      .fn()
      .mockRejectedValue(new Error('LLM not available in tests')),
  }),
  LLMClient: vi.fn(),
}));

// Mock the embedding client — fails immediately
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
import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';
import type BetterSqlite3 from 'better-sqlite3';

describe('Ingest API', () => {
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

  // -------------------------------------------------------------------
  // POST /api/v1/ingest — valid payload
  // -------------------------------------------------------------------
  it('POST /api/v1/ingest with valid payload → 200, status "created", returns id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest',
      payload: {
        content: `Integration test message ${Date.now()}`,
        sourceType: 'manual',
        sender: 'test-user',
        groupId: 'test-group',
        groupName: 'Test Group',
        timestamp: Math.floor(Date.now() / 1000),
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('id');
    expect(body.id).toBeTruthy();
    expect(body).toHaveProperty('status');
    expect(body.status).toBe('created');
  });

  it('defaults scope to work and keeps source separate from sourceType during ingest', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest',
      payload: {
        content: `Scoped ingest message ${Date.now()}`,
        sourceType: 'glip',
        source: 'chat-sync',
        sender: 'test-user',
        timestamp: Math.floor(Date.now() / 1000),
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('created');

    const stored = db
      .prepare(
        `SELECT scope, source, source_type
         FROM messages_raw
         WHERE id = ?`,
      )
      .get(body.id) as {
      scope: string;
      source: string | null;
      source_type: string;
    };

    expect(stored.scope).toBe('work');
    expect(stored.source).toBe('chat-sync');
    expect(stored.source_type).toBe('glip');
  });

  // -------------------------------------------------------------------
  // POST /api/v1/ingest — duplicate detection
  // -------------------------------------------------------------------
  it('POST /api/v1/ingest with same content again → 200, status "duplicate"', async () => {
    const payload = {
      content: 'Duplicate detection test message for api-ingest test',
      sourceType: 'manual' as const,
      sender: 'dup-sender',
      groupId: 'dup-group',
      groupName: 'Dup Group',
      timestamp: Math.floor(Date.now() / 1000),
    };

    // First ingestion
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest',
      payload,
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.json().status).toBe('created');

    // Second ingestion with identical content + sourceType + sender
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest',
      payload,
    });
    expect(res2.statusCode).toBe(200);
    const body2 = res2.json();
    expect(body2.status).toBe('duplicate');
    expect(body2).toHaveProperty('id');
  });

  // -------------------------------------------------------------------
  // POST /api/v1/ingest — post_id dedup (Glip 消息用 post_id 去重)
  // -------------------------------------------------------------------
  it('POST /api/v1/ingest with same post_id again → 200, status "duplicate"', async () => {
    const postId = '77650089877508';
    const payload1 = {
      content: '> First content with "quotes"',
      sourceType: 'glip' as const,
      sender: 'AI Service',
      groupId: 'test-group',
      groupName: 'Test Group',
      timestamp: Math.floor(Date.now() / 1000),
      metadata: { postId },
    };

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest',
      payload: payload1,
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.json().status).toBe('created');

    // 同一 post_id，不同 content（如 HTML 编码差异）也应视为重复
    const payload2 = {
      content: '&gt; Different content &quot;encoded&quot;',
      sourceType: 'glip' as const,
      sender: 'AI Service',
      groupId: 'test-group',
      groupName: 'Test Group',
      timestamp: Math.floor(Date.now() / 1000),
      metadata: { postId },
    };
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest',
      payload: payload2,
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().status).toBe('duplicate');
  });

  // -------------------------------------------------------------------
  // POST /api/v1/ingest — missing content → 400
  // -------------------------------------------------------------------
  it('POST /api/v1/ingest with missing content → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest',
      payload: {
        sourceType: 'manual',
        sender: 'test-user',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  // -------------------------------------------------------------------
  // POST /api/v1/ingest — missing sourceType → 400
  // -------------------------------------------------------------------
  it('POST /api/v1/ingest with missing sourceType → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest',
      payload: {
        content: 'Missing sourceType test',
        sender: 'test-user',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  // -------------------------------------------------------------------
  // POST /api/v1/ingest — empty content string → 400
  // -------------------------------------------------------------------
  it('POST /api/v1/ingest with empty content string → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest',
      payload: {
        content: '',
        sourceType: 'manual',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  // -------------------------------------------------------------------
  // POST /api/v1/ingest/batch — 3 items
  // -------------------------------------------------------------------
  it('POST /api/v1/ingest/batch with 3 items → 200, returns results array with 3 entries', async () => {
    const ts = Date.now();
    const items = [
      {
        content: `Batch item 1 - ${ts}`,
        sourceType: 'manual' as const,
        sender: 'batch-user',
        timestamp: Math.floor(ts / 1000),
      },
      {
        content: `Batch item 2 - ${ts}`,
        sourceType: 'manual' as const,
        sender: 'batch-user',
        timestamp: Math.floor(ts / 1000),
      },
      {
        content: `Batch item 3 - ${ts}`,
        sourceType: 'manual' as const,
        sender: 'batch-user',
        timestamp: Math.floor(ts / 1000),
      },
    ];

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest/batch',
      payload: { items },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('results');
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results).toHaveLength(3);
    expect(body).toHaveProperty('totalCreated');
    expect(body).toHaveProperty('totalDuplicate');
    expect(body).toHaveProperty('totalError');

    // Each result should have an id and status
    for (const result of body.results) {
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status');
      expect(['created', 'duplicate', 'error']).toContain(result.status);
    }
  });

  // -------------------------------------------------------------------
  // POST /api/v1/ingest/batch — empty items → 400
  // -------------------------------------------------------------------
  it('POST /api/v1/ingest/batch with empty items array → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest/batch',
      payload: { items: [] },
    });

    expect(res.statusCode).toBe(400);
  });
});
