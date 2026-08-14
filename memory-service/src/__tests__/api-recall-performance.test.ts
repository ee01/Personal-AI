import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

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

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

/**
 * Performance comparison between the two new recall surfaces:
 *  - POST /context-recall (passive, latency-sensitive bubble)
 *  - POST /recall         (active, structured research surface)
 *
 * Targets validated by these tests (in-memory FTS-only harness):
 *   - Passive context-recall: < 100ms median across 5 runs.
 *   - Active recall (evidence-only, no blockTypes): < 250ms median.
 *   - Active recall (with blockTypes, no `summary` → no LLM): < 350ms median.
 *
 * The tests print summaries to stdout so the report can pull numbers without
 * scraping a separate benchmark harness.
 */
describe('Recall API performance comparison', () => {
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
    db.prepare('DELETE FROM messages_raw').run();
    db.prepare('DELETE FROM chunks').run();
    db.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`).run();

    const now = Math.floor(Date.now() / 1000);
    const seed = (id: string, content: string, project: string) => {
      db.prepare(
        `INSERT INTO messages_raw
          (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        content,
        'meeting',
        `https://memory.example.com/m/${id}`,
        `Meeting ${id}`,
        'meeting-pilot',
        id,
        `Group ${id}`,
        now - 60,
        0.8,
        'neutral',
        JSON.stringify({ project }),
        now - 60,
      );

      const chunkId = parseInt(id.replace(/[^0-9]/g, ''), 10) || 1;
      db.prepare(
        `INSERT INTO chunks
          (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        chunkId,
        `messages/${id}`,
        1,
        1,
        content,
        `hash-${id}`,
        'work',
        'meeting',
        'meeting',
        project,
        now - 60,
      );
      db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
        chunkId,
        content,
      );
    };

    seed('m100', 'Falcon launch readiness review with the platform team.', 'Falcon');
    seed('m101', 'Falcon platform Q3 milestone alignment and risks.', 'Falcon');
    seed('m102', 'Eagle migration playbook draft for production cutover.', 'Eagle');
    seed('m103', 'Hawk dashboard analytics roadmap and tech selection.', 'Hawk');
    seed('m104', 'Falcon platform OKR review with quarterly metrics.', 'Falcon');
  });

  function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  it('passive /context-recall stays well under 100ms median', async () => {
    const samples: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const t0 = Date.now();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/context-recall',
        payload: {
          surface: 'web_passive',
          contextType: 'webpage',
          title: 'Falcon launch',
          primaryText: 'Falcon platform launch readiness',
          limit: 3,
        },
      });
      samples.push(Date.now() - t0);
      expect(res.statusCode).toBe(200);
    }
    const med = median(samples);
    console.log(
      `[perf] /context-recall samples=${samples.join(',')}ms median=${med}ms`,
    );
    expect(med).toBeLessThan(100);
  });

  it('active /recall (no blockTypes) stays under 250ms median', async () => {
    const samples: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const t0 = Date.now();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/recall',
        payload: {
          query: 'Falcon platform launch readiness',
          topK: 5,
          channels: ['fts', 'time'],
        },
      });
      samples.push(Date.now() - t0);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.blocks).toBeUndefined();
      expect(body.analysis).toBeUndefined();
    }
    const med = median(samples);
    console.log(
      `[perf] /recall evidence-only samples=${samples.join(',')}ms median=${med}ms`,
    );
    expect(med).toBeLessThan(250);
  });

  it('active /recall (blockTypes without summary, no LLM) stays under 350ms median', async () => {
    const samples: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const t0 = Date.now();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/recall',
        payload: {
          query: 'Falcon platform launch readiness',
          topK: 5,
          channels: ['fts', 'time'],
          retrievalMode: 'deep',
          presentationBlocks: ['evidence_list', 'timeline'],
        },
      });
      samples.push(Date.now() - t0);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.blocks)).toBe(true);
      expect(body.analysis).toBeUndefined();
    }
    const med = median(samples);
    console.log(
      `[perf] /recall blocks (no summary) samples=${samples.join(',')}ms median=${med}ms`,
    );
    expect(med).toBeLessThan(350);
  });
});
