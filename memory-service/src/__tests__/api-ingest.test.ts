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
    expect(body.decision).toMatchObject({
      storage: 'indexed',
      reason: 'salience_indexed',
      extractionStatus: 'unavailable',
      shouldIndex: true,
      indexed: true,
    });
    expect(typeof body.decision.salienceScore).toBe('number');
    expect(body.decision.salienceComponents).toMatchObject({
      importance: expect.any(Number),
      frequency: expect.any(Number),
      recency: expect.any(Number),
      surprise: expect.any(Number),
      redundancy: expect.any(Number),
    });

    const indexedChunk = db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM chunks
         WHERE related_entity_id = ?`,
      )
      .get(body.id) as { count: number };
    expect(indexedChunk.count).toBeGreaterThan(0);

    const metadata = db
      .prepare(
        `SELECT salience_score
         FROM memory_metadata
         WHERE target_type = 'message' AND target_id = ?`,
      )
      .get(body.id) as { salience_score: number } | undefined;
    expect(metadata?.salience_score).toBeCloseTo(
      body.decision.salienceScore,
    );
  });

  it('defaults scope to work and keeps source separate from sourceType during ingest', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest',
      payload: {
        content: `Scoped ingest message ${Date.now()}`,
        sourceType: 'glip',
        source: 'chat-sync',
        sourceUrl: 'https://example.test/rooms/123/posts/456',
        sourceTitle: 'Release readiness thread',
        sender: 'test-user',
        groupId: 'release-room',
        groupName: 'Release Room',
        timestamp: Math.floor(Date.now() / 1000),
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('created');

    const stored = db
      .prepare(
        `SELECT scope, source, source_type, source_url, source_title,
                sender, group_id, group_name
         FROM messages_raw
         WHERE id = ?`,
      )
      .get(body.id) as {
      scope: string;
      source: string | null;
      source_type: string;
      source_url: string | null;
      source_title: string | null;
      sender: string | null;
      group_id: string | null;
      group_name: string | null;
    };

    expect(stored.scope).toBe('work');
    expect(stored.source).toBe('chat-sync');
    expect(stored.source_type).toBe('glip');
    expect(stored.source_url).toBe('https://example.test/rooms/123/posts/456');
    expect(stored.source_title).toBe('Release readiness thread');
    expect(stored.sender).toBe('test-user');
    expect(stored.group_id).toBe('release-room');
    expect(stored.group_name).toBe('Release Room');
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
    expect(body2.decision).toMatchObject({
      storage: 'duplicate',
      reason: 'duplicate_content_source_sender',
      duplicateOf: body2.id,
      dedupeReason: 'content_source_sender',
      indexed: false,
    });
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
    const body2 = res2.json();
    expect(body2.status).toBe('duplicate');
    expect(body2.decision).toMatchObject({
      storage: 'duplicate',
      reason: 'duplicate_post_id',
      duplicateOf: body2.id,
      dedupeReason: 'post_id',
      indexed: false,
    });
  });

  it('POST /api/v1/ingest accepts ai_chat source type for external AI memory sources', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest',
      payload: {
        content: `AI chat ingest source type parity ${Date.now()}`,
        sourceType: 'ai_chat',
        sender: 'test-user',
        timestamp: Math.floor(Date.now() / 1000),
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('created');
  });

  it('POST /api/v1/ingest accepts external AI and local agent source types', async () => {
    const sourceTypes = [
      'chatgpt',
      'doubao_chat',
      'codex_cli',
      'claude_code_cli',
      'cursor_agent_cli',
    ];

    for (const sourceType of sourceTypes) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/ingest',
        payload: {
          content: `Source type parity ${sourceType} ${Date.now()}`,
          sourceType,
          sender: 'test-user',
          timestamp: Math.floor(Date.now() / 1000),
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('created');
    }
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
      expect(result).toHaveProperty('decision');
    }
  });

  it('POST /api/v1/ingest/batch accepts the same source types as single ingest', async () => {
    const ts = Date.now();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest/batch',
      payload: {
        items: [
          {
            content: `Batch calendar source parity ${ts}`,
            sourceType: 'calendar',
            sender: 'batch-user',
            timestamp: Math.floor(ts / 1000),
          },
          {
            content: `Batch Doubao source parity ${ts}`,
            sourceType: 'doubao',
            sender: 'batch-user',
            timestamp: Math.floor(ts / 1000),
          },
          {
            content: `Batch local agent source parity ${ts}`,
            sourceType: 'codex_cli',
            sender: 'batch-user',
            timestamp: Math.floor(ts / 1000),
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalCreated).toBe(3);
    expect(body.results.map((result: any) => result.status)).toEqual([
      'created',
      'created',
      'created',
    ]);
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
