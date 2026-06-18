/**
 * Weave provenance route contract (P0-5): /context-recall attaches `weave` only
 * when the matches stitch ≥2 sources or ≥7 days, and omits it otherwise.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi.fn().mockRejectedValue(new Error('no embeddings in tests')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

const DAY = 86_400;

describe('Context Recall weave provenance (P0-5)', () => {
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

  function seedChunk(
    rowid: number,
    msgId: string,
    content: string,
    sourceType: string,
    ts: number,
  ): void {
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source, scope, sender, group_name, timestamp, importance, sentiment, created_at)
       VALUES (?, ?, ?, ?, 'work', 'tester', 'Grp', ?, 0.8, 'neutral', ?)`,
    ).run(msgId, content, sourceType, sourceType, ts, ts);
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, 1, 1, ?, ?, 'work', ?, ?, 'Falcon', ?)`,
    ).run(rowid, `messages/${msgId}`, content, `hash-${rowid}`, sourceType, sourceType, ts);
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(rowid, content);
  }

  beforeEach(() => {
    db.prepare('DELETE FROM messages_raw').run();
    db.prepare('DELETE FROM chunks').run();
    db.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`).run();
  });

  it('attaches weave when matches stitch ≥2 sources across ≥7 days', async () => {
    const now = Math.floor(Date.now() / 1000);
    seedChunk(7101, 'falcon-web', 'Project Falcon launch readiness review notes', 'web', now - 9 * DAY);
    seedChunk(7102, 'falcon-jira', 'Project Falcon launch readiness Jira ticket update', 'jira', now);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'Falcon launch readiness',
        primaryText: 'Project Falcon launch readiness',
        scope: 'work',
        limit: 5,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matches.length).toBeGreaterThanOrEqual(2);
    expect(body.weave).toBeDefined();
    expect(body.weave.crossSource).toBe(true);
    expect(body.weave.sourceCount).toBeGreaterThanOrEqual(2);
    expect(body.weave.daySpanDays).toBeGreaterThanOrEqual(7);
  });

  it('omits weave for a single-source same-day result (anti-inflation)', async () => {
    const now = Math.floor(Date.now() / 1000);
    seedChunk(7201, 'solo-web', 'Project Falcon launch readiness review notes', 'web', now - 60);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'Falcon launch readiness',
        primaryText: 'Project Falcon launch readiness',
        scope: 'work',
        limit: 5,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matches.length).toBeGreaterThanOrEqual(1);
    expect(body.weave).toBeUndefined();
  });
});
