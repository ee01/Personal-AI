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

describe('Storyline draft API', () => {
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

  function buildPrepResponse() {
    return {
      summaryMd: '## Meeting prep\n- Explain AI Notes retry ownership.',
      cueCards: [
        {
          id: 'background',
          kind: 'brief',
          title: 'Background',
          body: 'GeneratedNotes consumption spiked and needs owner clarity.',
          evidenceIds: ['calendar:event-ai-notes'],
        },
        {
          id: 'risk',
          kind: 'memory',
          title: 'Risk',
          body: 'Retry/ack handling may still repeat messages.',
          evidenceIds: ['msg-ai-notes-prep'],
        },
        {
          id: 'next-step',
          kind: 'action',
          title: 'Next step',
          body: 'Confirm owner and deadline.',
          evidenceIds: ['msg-ai-notes-prep'],
        },
      ],
      suggestedQuestions: ['Who owns retry/ack?'],
      risksOrOpenLoops: ['Repeated consumption could continue.'],
      contextPackMd:
        '# Today Pilot meeting prep\n\nExplain owner, risk, and next step.',
      redactionPreview: [],
      storylineOpportunity: {
        available: true,
        confidence: 0.82,
        storyType: 'status_report',
        oneLineReason:
          '这场会有背景、风险和 owner 三段材料，适合整理成项目汇报。',
        audienceHint: 'AI Notes 项目组',
        evidenceClusters: [
          {
            label: 'GeneratedNotes retry',
            sourceKinds: ['calendar', 'meeting'],
            evidenceCount: 3,
          },
        ],
        suggestedArtifact: 'speaker_notes',
      },
      usage: { promptTokens: 12, completionTokens: 24 },
    };
  }

  function buildDraftResponse() {
    return {
      title: 'AI Notes retry owner storyline',
      audience: 'AI Notes 项目组',
      targetArtifact: 'speaker_notes',
      segments: [
        {
          title: '先说明背景',
          intent: '让听众知道为什么现在要谈 owner。',
          narrative: 'GeneratedNotes 消费异常已经影响到 retry/ack 判断。',
          evidenceIds: ['E1'],
        },
        {
          title: '再说明风险',
          intent: '解释为什么不能只当作普通噪音。',
          narrative: '重复消费可能继续放大，导致会议记录或队列状态失真。',
          evidenceIds: ['E2', 'made-up-id'],
        },
        {
          title: '最后收敛行动',
          intent: '把讨论落到 owner 和时间点。',
          narrative: '会议应确认 retry/ack owner、验证方式和下一次检查时间。',
          evidenceIds: ['msg-ai-notes-prep'],
        },
      ],
      gaps: ['确认当前 retry patch 是否已经上线。'],
      riskNotes: ['复制给外部前去掉内部链接。'],
      artifactText:
        '# Speaker Notes\n\n1. 背景\n2. 风险\n3. Owner 和 deadline',
    };
  }

  function seedCalendarEvent() {
    const current = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO calendar_events
        (id, source_system, external_id, series_key, title, description_preview,
         start_at, end_at, organizer_json, attendees_json, cancelled, content_hash,
         metadata_json, synced_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    ).run(
      'cal-ai-notes',
      'ringcentral_indexeddb',
      'event-ai-notes',
      'series-ai-notes',
      'AI Notes owner review',
      'Explain GeneratedNotes retry/ack owner and repeated consumption risk.',
      current + 3600,
      current + 5400,
      JSON.stringify({ name: 'Elina' }),
      JSON.stringify([{ name: 'Esone' }, { name: 'AI Notes owner' }]),
      'hash-ai-notes-event',
      '{}',
      current,
      current,
      current,
    );
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source, source_url, source_title, sender,
         group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'msg-ai-notes-prep',
      'AI Notes GeneratedNotes retry/ack owner remains open after repeated consumption.',
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
      9801,
      'messages/msg-ai-notes-prep',
      'AI Notes GeneratedNotes retry ack owner repeated consumption',
      'hash-ai-notes-prep',
      'msg-ai-notes-prep',
      current - 120,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9801,
      'AI Notes GeneratedNotes retry ack owner repeated consumption',
    );
    return current;
  }

  async function createMeetingPrep(): Promise<string> {
    const current = seedCalendarEvent();
    const localDate = new Date((current + 3600) * 1000)
      .toISOString()
      .slice(0, 10);
    mockGenerateJSON.mockResolvedValueOnce(buildPrepResponse());
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/today-pilot/meeting-prep/prepare',
      payload: {
        date: localDate,
        timezone: 'Asia/Shanghai',
        horizonHours: 36,
        maxMeetings: 5,
      },
    });
    expect(res.statusCode).toBe(200);
    return res.json().items[0].id;
  }

  it('generates a draft from a Today Pilot meeting prep', async () => {
    const prepId = await createMeetingPrep();
    mockGenerateJSON.mockResolvedValueOnce(buildDraftResponse());

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/storylines/draft',
      payload: {
        sourceKind: 'today_meeting_prep',
        prepId,
        targetArtifact: 'speaker_notes',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.sourceId).toBe(prepId);
    expect(body.segments).toHaveLength(3);
    expect(body.segments[0].evidenceIds).toContain('calendar:event-ai-notes');
    expect(body.segments[1].evidenceIds).not.toContain('made-up-id');
    expect(body.artifactText).toContain('Speaker Notes');
  });

  it('returns 404 when the source prep does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/storylines/draft',
      payload: {
        sourceKind: 'today_meeting_prep',
        prepId: 'missing-prep',
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain('not found');
    expect(mockGenerateJSON).not.toHaveBeenCalled();
  });

  it('returns a clear error when draft generation fails', async () => {
    const prepId = await createMeetingPrep();
    mockGenerateJSON.mockRejectedValueOnce(new Error('llm unavailable'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/storylines/draft',
      payload: {
        sourceKind: 'today_meeting_prep',
        prepId,
      },
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().error).toBe('storyline_draft_generation_failed');
    expect(res.json().detail).toContain('llm unavailable');
  });
});
