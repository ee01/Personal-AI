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

  function buildLlmPrepResponse(overrides: Record<string, unknown> = {}) {
    return {
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
      storylineOpportunity: {
        available: true,
        confidence: 0.84,
        storyType: 'status_report',
        buttonLabel: '生成项目汇报故事线',
        oneLineReason:
          '这场会有 retry owner、消费异常和后续风险三类材料，可以整理成项目汇报。',
        audienceHint: 'AI Notes 项目组',
        estimatedLengthMinutes: 8,
        evidenceClusters: [
          {
            label: 'GeneratedNotes retry/ack',
            sourceKinds: ['calendar', 'meeting'],
            evidenceCount: 2,
          },
          {
            label: 'owner 风险',
            sourceKinds: ['meeting'],
            evidenceCount: 1,
          },
        ],
        suggestedArtifact: 'speaker_notes',
      },
      usage: { promptTokens: 10, completionTokens: 20 },
      ...overrides,
    };
  }

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
    mockGenerateJSON.mockResolvedValue(buildLlmPrepResponse());
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

  function formatLocalDate(timestampSeconds: number, timezone: string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(timestampSeconds * 1000));
  }

  function seedCalendarEvent(
    overrides: Record<string, unknown> = {},
    options: { withMemoryChunk?: boolean; memoryChunkCount?: number } = {},
  ) {
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
    const memoryChunkCount =
      options.withMemoryChunk === false ? 0 : (options.memoryChunkCount ?? 2);
    for (let index = 0; index < memoryChunkCount; index += 1) {
      insertMemoryChunk(current, index);
    }
    return event;
  }

  function insertMemoryChunk(current: number, index: number): void {
    const suffix = index + 1;
    const messageId = `msg-ai-notes-prep-${suffix}`;
    const chunkId = 9701 + index;
    const hash = `hash-ai-notes-prep-${suffix}`;
    const content =
      index === 0
        ? 'AI Notes GeneratedNotes message was consumed hundreds of times; retry/ack owner needs confirmation.'
        : 'AI Notes GeneratedNotes project review should explain the retry impact, owner decision, and rollout risk to stakeholders.';
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source, source_url, source_title, sender,
         group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      messageId,
      content,
      'meeting',
      'meeting',
      `https://internal.example.com/ai-notes/generatednotes/${suffix}`,
      index === 0 ? 'AI Notes investigation' : 'AI Notes stakeholder review',
      'Elina',
      'AI Notes',
      current - 120 - index,
      0.88,
      'neutral',
      '{}',
      current - 120 - index,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash,
         scope, source, source_type, related_project, related_entity_id, created_at)
       VALUES (?, ?, 1, 1, ?, ?, 'work', 'meeting', 'meeting', 'AI Notes', ?, ?)`,
    ).run(
      chunkId,
      `messages/${messageId}`,
      content,
      hash,
      messageId,
      current - 120 - index,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      chunkId,
      content,
    );
  }

  it('prepares offline LLM meeting prep for calendar events', async () => {
    const event = seedCalendarEvent();
    const localDate = formatLocalDate(Number(event.startAt), 'Asia/Shanghai');

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
    expect(body.items[0].storylineOpportunity.available).toBe(true);
    expect(body.items[0].storylineOpportunity.buttonLabel).toBe(
      '生成项目汇报故事线',
    );
  });

  it('resolves a pre-generated prep without another LLM call', async () => {
    const event = seedCalendarEvent();
    const localDate = formatLocalDate(Number(event.startAt), 'Asia/Shanghai');
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
    expect(body.prep.storylineOpportunity.available).toBe(true);
    expect(body.assist.storylineOpportunity.available).toBe(true);
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

  it('downgrades invalid storyline opportunities instead of showing them', async () => {
    const event = seedCalendarEvent();
    mockGenerateJSON.mockResolvedValueOnce(
      buildLlmPrepResponse({
        storylineOpportunity: {
          available: true,
          confidence: 0.95,
          oneLineReason: '',
          evidenceClusters: [],
          suggestedArtifact: 'slides_outline',
        },
      }),
    );

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
    expect(body.prep.storylineOpportunity.available).toBe(false);
    expect(body.assist.storylineOpportunity.available).toBe(false);
  });

  it('downgrades storyline opportunities without enough story material', async () => {
    const event = seedCalendarEvent();
    mockGenerateJSON.mockResolvedValueOnce(
      buildLlmPrepResponse({
        storylineOpportunity: {
          available: true,
          confidence: 0.9,
          oneLineReason:
            '这场会可能可以整理成项目更新，但素材还不够完整。',
          evidenceClusters: [
            {
              label: 'AI Notes owner',
              sourceKinds: ['calendar', 'meeting'],
              evidenceCount: 2,
            },
          ],
          suggestedArtifact: 'speaker_notes',
        },
      }),
    );

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
    expect(body.prep.storylineOpportunity.available).toBe(false);
    expect(body.prep.storylineOpportunity.blockedReasons).toContain(
      '素材不足：至少需要 3 条可讲述证据。',
    );
    expect(body.assist.storylineOpportunity.available).toBe(false);
  });

  it('downgrades storyline opportunities when actual evidence refs are under the story threshold', async () => {
    const event = seedCalendarEvent({}, { memoryChunkCount: 1 });
    mockGenerateJSON.mockResolvedValueOnce(
      buildLlmPrepResponse({
        storylineOpportunity: {
          available: true,
          confidence: 0.9,
          oneLineReason:
            '这场会声称有三类素材，但实际可追溯证据还不够。',
          evidenceClusters: [
            {
              label: 'AI Notes owner',
              sourceKinds: ['calendar', 'meeting'],
              evidenceCount: 3,
            },
          ],
          suggestedArtifact: 'speaker_notes',
        },
      }),
    );

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
    expect(body.prep.evidenceRefs.length).toBeLessThan(3);
    expect(body.prep.storylineOpportunity.available).toBe(false);
    expect(body.prep.storylineOpportunity.blockedReasons).toContain(
      '素材不足：至少需要 3 条可讲述证据。',
    );
    expect(body.assist.storylineOpportunity.available).toBe(false);
  });

  it('downgrades calendar-only storyline opportunities', async () => {
    const event = seedCalendarEvent({}, { withMemoryChunk: false });
    mockGenerateJSON.mockResolvedValueOnce(
      buildLlmPrepResponse({
        storylineOpportunity: {
          available: true,
          confidence: 0.88,
          oneLineReason:
            '这场会看起来适合做分享，但目前只有日历描述作为素材。',
          evidenceClusters: [
            {
              label: '日历会议描述',
              sourceKinds: ['calendar'],
              evidenceCount: 3,
            },
          ],
          suggestedArtifact: 'slides_outline',
        },
      }),
    );

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
    expect(body.prep.storylineOpportunity.available).toBe(false);
    expect(body.prep.storylineOpportunity.blockedReasons).toContain(
      '素材不足：不能只基于日历标题或会议描述生成故事线。',
    );
    expect(body.assist.storylineOpportunity.available).toBe(false);
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
    expect(body.prep.storylineOpportunity).toBeUndefined();
    expect(body.assist.storylineOpportunity).toBeUndefined();
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
