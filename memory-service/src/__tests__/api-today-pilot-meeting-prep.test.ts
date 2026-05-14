import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const { mockGenerateJSON } = vi.hoisted(() => ({
  mockGenerateJSON: vi.fn(),
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

vi.mock('../llm/LLMClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../llm/LLMClient.js')>();
  return {
    ...actual,
    getLLMClient: () => ({
      generateJSON: mockGenerateJSON,
    }),
  };
});

import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

describe('Today Pilot meeting prep API', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    mockGenerateJSON.mockReset();
    mockGenerateJSON.mockResolvedValue({
      summaryMd: '## Meeting prep\n- Review AI Notes owner and retry risk.',
      cueCards: [
        {
          id: 'owner-check',
          kind: 'question',
          title: 'Owner check',
          body: 'Confirm who owns the retry/ack investigation.',
          evidenceIds: ['calendar:event-ai-notes'],
        },
      ],
      suggestedQuestions: ['Who owns the retry/ack investigation?'],
      risksOrOpenLoops: ['GeneratedNotes retry loop may still be open.'],
      contextPackMd:
        '# Today Pilot meeting prep\n\nConfirm owner and next step.',
      redactionPreview: [],
      usage: { promptTokens: 10, completionTokens: 20 },
    });
    for (const table of [
      'today_meeting_preps',
      'calendar_events',
      'messages_raw',
      'chunks',
    ]) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
    db.prepare(
      `INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`,
    ).run();
  });

  function seedCalendarEvent(overrides: Record<string, unknown> = {}) {
    const current = Math.floor(Date.now() / 1000);
    const event = {
      id: 'cal-ai-notes',
      sourceSystem: 'ringcentral_indexeddb',
      externalId: 'event-ai-notes',
      seriesKey: 'series-ai-notes',
      title: 'AI Notes GeneratedNotes owner sync',
      descriptionPreview:
        'Discuss GeneratedNotes repeated consumption and RIO retry/ack owner.',
      startAt: current + 3600,
      endAt: current + 5400,
      organizer: { name: 'Elina' },
      attendees: [{ name: 'Esone' }, { name: 'RIO owner' }],
      contentHash: 'hash-ai-notes-event',
      ...overrides,
    };
    db.prepare(
      `INSERT INTO calendar_events
        (id, source_system, external_id, series_key, title, description_preview,
         start_at, end_at, organizer_json, attendees_json, cancelled, content_hash,
         metadata_json, synced_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    ).run(
      event.id,
      event.sourceSystem,
      event.externalId,
      event.seriesKey,
      event.title,
      event.descriptionPreview,
      event.startAt,
      event.endAt,
      JSON.stringify(event.organizer),
      JSON.stringify(event.attendees),
      event.contentHash,
      '{}',
      current,
      current,
      current,
    );
    insertMemoryChunk(current);
    return event;
  }

  function insertMemoryChunk(current: number): void {
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source, source_url, source_title, sender,
         group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'msg-ai-notes-prep',
      'AI Notes GeneratedNotes message was consumed hundreds of times; retry/ack owner needs confirmation.',
      'meeting',
      'meeting',
      'https://internal.example.com/ai-notes/generatednotes',
      'AI Notes investigation',
      'Elina',
      'AI Notes',
      current - 120,
      0.88,
      'neutral',
      '{}',
      current - 120,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash,
         scope, source, source_type, related_project, related_entity_id, created_at)
       VALUES (?, ?, 1, 1, ?, ?, 'work', 'meeting', 'meeting', 'AI Notes', ?, ?)`,
    ).run(
      9701,
      'messages/msg-ai-notes-prep',
      'AI Notes GeneratedNotes retry/ack owner remains open after repeated consumption.',
      'hash-ai-notes-prep',
      'msg-ai-notes-prep',
      current - 120,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9701,
      'AI Notes GeneratedNotes retry ack owner repeated consumption',
    );
  }

  it('prepares offline LLM meeting prep for calendar events', async () => {
    const event = seedCalendarEvent();
    const localDate = new Date(Number(event.startAt) * 1000)
      .toISOString()
      .slice(0, 10);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/today-pilot/meeting-prep/prepare',
      payload: {
        date: localDate,
        timezone: 'Asia/Shanghai',
        horizonHours: 36,
        maxMeetings: 5,
        mode: 'nightly_llm',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.prepared).toBe(1);
    expect(body.items[0].status).toBe('ready');
    expect(body.items[0].generatedMode).toBe('nightly_llm');
    expect(body.items[0].contextPackMd).toContain('Today Pilot meeting prep');
    expect(body.items[0].evidenceRefs.length).toBeGreaterThan(0);
  });

  it('resolves a pre-generated prep without another LLM call', async () => {
    const event = seedCalendarEvent();
    const localDate = new Date(Number(event.startAt) * 1000)
      .toISOString()
      .slice(0, 10);
    await app.inject({
      method: 'POST',
      url: '/api/v1/today-pilot/meeting-prep/prepare',
      payload: { date: localDate, timezone: 'Asia/Shanghai' },
    });
    expect(mockGenerateJSON).toHaveBeenCalledTimes(1);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/today-pilot/meeting-prep/resolve',
      payload: {
        event: {
          externalId: event.externalId,
          seriesKey: event.seriesKey,
          title: event.title,
          startTime: event.startAt,
        },
        timezone: 'Asia/Shanghai',
        autoGenerate: false,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.generated).toBe(false);
    expect(body.source).toBe('cached');
    expect(body.prep.id).toBeTruthy();
    expect(body.assist.debug.prepId).toBe(body.prep.id);
    expect(mockGenerateJSON).toHaveBeenCalledTimes(1);
  });

  it('generates a goal-specific on-demand prep with a different goal hash', async () => {
    const event = seedCalendarEvent();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/today-pilot/meeting-prep/resolve',
      payload: {
        event: {
          externalId: event.externalId,
          seriesKey: event.seriesKey,
          title: event.title,
          descriptionPreview: event.descriptionPreview,
          startTime: event.startAt,
        },
        timezone: 'Asia/Shanghai',
        userGoal: 'confirm if RIO owns the ack retry fix',
        autoGenerate: true,
        forceGenerate: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.generated).toBe(true);
    expect(body.source).toBe('generated');
    expect(body.prep.goalHash).not.toBe('');
    expect(body.prep.generatedMode).toBe('on_demand_llm');
  });

  it('stores deterministic fallback when LLM generation fails', async () => {
    const event = seedCalendarEvent();
    mockGenerateJSON.mockRejectedValueOnce(new Error('llm unavailable'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/today-pilot/meeting-prep/resolve',
      payload: {
        event: {
          externalId: event.externalId,
          title: event.title,
          startTime: event.startAt,
        },
        timezone: 'Asia/Shanghai',
        autoGenerate: true,
        forceGenerate: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.source).toBe('fallback');
    expect(body.prep.status).toBe('fallback');
    expect(body.prep.generatedMode).toBe('deterministic_fallback');
    expect(body.assist.available).toBe(true);
    expect(body.prep.error).toContain('llm unavailable');
  });

  it('skips recurring daily noise without fresh prep signal', async () => {
    seedCalendarEvent({
      id: 'cal-daily',
      externalId: 'event-daily',
      seriesKey: 'daily-series',
      title: 'Daily Sync',
      descriptionPreview: 'regular recurring meeting',
      organizer: { name: 'Team' },
      attendees: [{ name: 'Esone' }],
      contentHash: 'hash-daily',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/today-pilot/meeting-prep/prepare',
      payload: {
        timezone: 'Asia/Shanghai',
        horizonHours: 36,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().prepared).toBe(0);
    expect(res.json().skipped).toBe(1);
    expect(mockGenerateJSON).not.toHaveBeenCalled();
  });
});
