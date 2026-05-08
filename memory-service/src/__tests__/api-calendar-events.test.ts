import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

describe('Calendar Events API (POST /calendar-events/sync)', () => {
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
    db.prepare('DELETE FROM calendar_events').run();
    db.prepare(`DELETE FROM chunks WHERE source_type = 'calendar'`).run();
    db.prepare(`DELETE FROM messages_raw WHERE source_type = 'calendar'`).run();
    db.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`).run();
  });

  it('creates calendar rows and searchable calendar chunks', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/calendar-events/sync',
      payload: {
        sourceSystem: 'ringcentral_indexeddb',
        events: [
          {
            externalId: 'event-1',
            title: 'Nova leads internal weekly sync up',
            descriptionPreview: 'align leads handoff progress',
            startTime: Date.now() + 30 * 60 * 1000,
            endTime: Date.now() + 90 * 60 * 1000,
            organizer: { name: 'Sophia' },
            attendees: [{ name: 'Esone', responseStatus: 'Accepted' }],
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      created: 1,
      updated: 0,
      unchanged: 0,
      total: 1,
    });

    const row = db
      .prepare(`SELECT title, source_system FROM calendar_events WHERE external_id = ?`)
      .get('event-1') as any;
    expect(row.title).toBe('Nova leads internal weekly sync up');
    expect(row.source_system).toBe('ringcentral_indexeddb');

    const chunk = db
      .prepare(`SELECT content FROM chunks WHERE source_type = 'calendar'`)
      .get() as any;
    expect(chunk.content).toContain('Nova leads internal weekly sync up');
  });

  it('uses hash diff for unchanged and updated events', async () => {
    const payload = {
      sourceSystem: 'outlook',
      events: [
        {
          externalId: 'event-2',
          title: 'AI tools vote follow-up',
          startTime: Date.now() + 60 * 60 * 1000,
        },
      ],
    };

    await app.inject({
      method: 'POST',
      url: '/api/v1/calendar-events/sync',
      payload,
    });
    const unchanged = await app.inject({
      method: 'POST',
      url: '/api/v1/calendar-events/sync',
      payload,
    });
    expect(unchanged.json()).toMatchObject({ unchanged: 1 });

    const updated = await app.inject({
      method: 'POST',
      url: '/api/v1/calendar-events/sync',
      payload: {
        ...payload,
        events: [
          {
            ...payload.events[0],
            descriptionPreview: 'confirm Codex vs Claude Code decision',
          },
        ],
      },
    });

    expect(updated.json()).toMatchObject({ updated: 1 });
  });

  it('marks cancelled events and removes calendar chunks', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/calendar-events/sync',
      payload: {
        sourceSystem: 'outlook',
        events: [
          {
            externalId: 'event-3',
            title: 'Cancelled planning meeting',
            startTime: Date.now() + 60 * 60 * 1000,
          },
        ],
      },
    });

    const cancelled = await app.inject({
      method: 'POST',
      url: '/api/v1/calendar-events/sync',
      payload: {
        sourceSystem: 'outlook',
        events: [
          {
            externalId: 'event-3',
            title: 'Cancelled planning meeting',
            startTime: Date.now() + 60 * 60 * 1000,
            cancelled: true,
          },
        ],
      },
    });

    expect(cancelled.json()).toMatchObject({ cancelled: 1 });
    const row = db
      .prepare(`SELECT cancelled FROM calendar_events WHERE external_id = ?`)
      .get('event-3') as any;
    expect(row.cancelled).toBe(1);
    const chunkCount = db
      .prepare(`SELECT COUNT(*) as count FROM chunks WHERE source_type = 'calendar'`)
      .get() as any;
    expect(chunkCount.count).toBe(0);
  });
});
