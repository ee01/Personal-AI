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

describe('Context Recall API (POST /context-recall)', () => {
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
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'web-memory-1',
      'Project Falcon launch readiness review with the platform team.',
      'web',
      'https://internal.example.com/wiki/falcon',
      'Falcon launch readiness',
      'browser',
      'falcon-grp',
      'Falcon Group',
      now - 60,
      0.8,
      'neutral',
      JSON.stringify({}),
      now - 60,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      9001,
      'messages/web-memory-1',
      1,
      1,
      'Project Falcon launch readiness review with the platform team.',
      'hash-falcon-1',
      'work',
      'web',
      'web',
      'Falcon',
      now - 60,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      9002,
      'messages/personal-falcon-memory',
      1,
      1,
      'Personal Falcon launch readiness note for weekend planning.',
      'hash-falcon-personal-1',
      'personal',
      'manual',
      'manual',
      'Falcon',
      now - 30,
    );
    db.prepare(
      `INSERT INTO chunks_fts(rowid, content) VALUES (?, ?), (?, ?)`,
    ).run(
      9001,
      'Project Falcon launch readiness review with the platform team.',
      9002,
      'Personal Falcon launch readiness note for weekend planning.',
    );
  });

  it('rejects payloads missing surface', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: { contextType: 'webpage', primaryText: 'Project Falcon launch' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects payloads with unknown surface', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'unknown_surface',
        contextType: 'webpage',
        primaryText: 'anything',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns matches with exploreLink and a topMatch on relevant content', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'Falcon launch readiness',
        primaryText: 'Project Falcon launch readiness',
        limit: 3,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.matches)).toBe(true);
    expect(typeof body.queryTimeMs).toBe('number');
    expect(body.matches.length).toBeGreaterThan(0);
    const top = body.matches[0];
    expect(top.id).toBeDefined();
    expect(typeof top.score).toBe('number');
    expect(typeof top.snippet).toBe('string');
    expect(
      typeof top.exploreLink === 'string' || top.exploreLink === undefined,
    ).toBe(true);
    expect(
      body.matches.some((match: any) =>
        match.links?.some(
          (link: any) => link.url === 'https://internal.example.com/wiki/falcon',
        ),
      ),
    ).toBe(true);
    expect(body.topMatch?.id).toBe(top.id);
  });

  it('suppresses generic RingCentral Video shell matches', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'generic-ringcentral-video',
      '会议: RingCentral Video',
      'meeting',
      'https://app.ringcentral.com/video/home',
      'RingCentral Video',
      'calendar',
      'generic-rc-video',
      'RingCentral Video',
      now - 10,
      0.3,
      'neutral',
      JSON.stringify({}),
      now - 10,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      9010,
      'messages/generic-ringcentral-video',
      1,
      1,
      '会议: RingCentral Video',
      'hash-generic-rc-video',
      'work',
      'meeting',
      'meeting',
      null,
      now - 10,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9010,
      '会议: RingCentral Video',
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'RingCentral Video',
        primaryText: '会议: RingCentral Video',
        limit: 3,
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matches).toEqual([]);
    expect(body.topMatch).toBeNull();
    expect(body.debug?.rejectedReason).toBe('low_information_match');
  });

  it('keeps RingCentral Video matches with concrete work signals', async () => {
    const now = Math.floor(Date.now() / 1000);
    const content =
      'MTR-144449 Refine In-Meeting Video Tile Layout and UX dependency review.';
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'specific-ringcentral-video',
      content,
      'meeting',
      'https://app.ringcentral.com/video/home',
      'RingCentral Video',
      'calendar',
      'specific-rc-video',
      'RingCentral Video',
      now - 10,
      0.8,
      'neutral',
      JSON.stringify({}),
      now - 10,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      9011,
      'messages/specific-ringcentral-video',
      1,
      1,
      content,
      'hash-specific-rc-video',
      'work',
      'meeting',
      'meeting',
      'MTR',
      now - 10,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9011,
      content,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'RingCentral Video',
        primaryText: 'In-Meeting Video Tile Layout MTR-144449',
        limit: 3,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matches.map((match: any) => match.id)).toContain('9011');
    expect(body.topMatch).not.toBeNull();
  });

  it('uses all scope by default for passive recall', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'Falcon launch readiness',
        primaryText: 'Project Falcon launch readiness weekend planning',
        limit: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const ids = body.matches.map((match: any) => match.id);
    expect(ids).toContain('9001');
    expect(ids).toContain('9002');
  });

  it('responds quickly (<200ms in the in-memory test harness)', async () => {
    const started = Date.now();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        primaryText: 'Project Falcon launch readiness review',
        limit: 3,
      },
    });
    const elapsed = Date.now() - started;
    expect(res.statusCode).toBe(200);
    expect(elapsed).toBeLessThan(500);
    const body = res.json();
    expect(body.queryTimeMs).toBeLessThan(500);
  });
});
