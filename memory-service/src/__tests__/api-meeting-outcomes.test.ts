import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const { mockGenerate, mockGenerateJSON } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockGenerateJSON: vi.fn(),
}));

vi.mock('../llm/LLMClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../llm/LLMClient.js')>();
  return {
    ...actual,
    LLMClient: vi.fn().mockImplementation(() => ({
      generate: mockGenerate,
    })),
    getLLMClient: () => ({ generateJSON: mockGenerateJSON }),
  };
});

import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { MeetingOutcomeBinderRepository } from '../repositories/MeetingOutcomeBinderRepository.js';
import { buildApp } from '../server.js';
import type { MeetingOutcomeSlot } from '../types/index.js';
import { getTestDb } from './setup.js';

describe('Meeting outcome binder API', () => {
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
    mockGenerate.mockReset();
    mockGenerateJSON.mockReset();
    db.prepare('DELETE FROM meeting_outcome_binders').run();
    db.prepare('DELETE FROM messages_raw').run();
  });

  function seedBinder(slots: MeetingOutcomeSlot[]) {
    const timestamp = Math.floor(Date.now() / 1000);
    return new MeetingOutcomeBinderRepository(db).upsertPreview({
      userId: 'test',
      prepId: 'prep-q3-mobile',
      eventExternalId: 'event-q3-mobile',
      eventSeriesKey: 'series-q3-mobile',
      eventTitle: '2026 Q3 planning for video mobile',
      eventStartAt: timestamp,
      slots,
      sourceEvidence: [
        {
          id: 'calendar:event-q3-mobile',
          kind: 'calendar',
          refId: 'event-q3-mobile',
          label: 'Q3 planning',
          snippet: 'Dev/QA estimates, team capacity, risk and issue.',
        },
      ],
      sourceHash: 'source-q3-mobile',
      generatedAt: timestamp,
    });
  }

  function plannedSlot(id: string, title: string): MeetingOutcomeSlot {
    return {
      id,
      title,
      type: 'decision',
      status: 'planned',
      mentionState: 'not_seen',
      sourceEvidenceIds: ['calendar:event-q3-mobile'],
      evidence: [],
      confidence: 0.82,
    };
  }

  it('binds decisions, pending actions, and transcript mentions without overclaiming', async () => {
    const binder = seedBinder([
      plannedSlot('slot-estimate', '确认 mobile QA estimate 估时口径'),
      plannedSlot('slot-capacity', '确认 team capacity owner'),
      plannedSlot('slot-risk', '确认 rollout risk 风险'),
    ]);
    mockGenerateJSON.mockResolvedValue({
      slots: [
        {
          slotId: 'slot-estimate',
          status: 'resolved',
          resultSummary: 'QA estimate 已敲定为 5 人天。',
          confidence: 0.94,
          evidenceRefs: ['D1'],
        },
        {
          slotId: 'slot-capacity',
          status: 'resolved',
          resultSummary: 'capacity owner 已完成。',
          confidence: 0.9,
          evidenceRefs: ['A1'],
        },
        {
          slotId: 'slot-risk',
          status: 'resolved',
          resultSummary: 'rollout risk 已完全解决。',
          confidence: 0.88,
          evidenceRefs: ['T1'],
        },
      ],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/meeting-outcomes/bind',
      payload: {
        binderId: binder.id,
        meetingId: 'meeting-q3-mobile',
        decisions: [
          {
            id: 'decision-estimate',
            text: 'mobile QA estimate 估时口径采用 5 人天。',
          },
        ],
        actionItems: [
          {
            id: 'action-capacity',
            title: 'team capacity owner 由 Alex 补齐',
            owner: 'Alex',
            status: 'pending',
          },
        ],
        transcript: [
          {
            id: 'transcript-risk',
            speaker: 'Esone',
            text: 'rollout risk 风险需要继续观察。',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const outcome = response.json().binder;
    expect(outcome.status).toBe('partial');
    expect(outcome.bindingMode).toBe('llm');
    expect(outcome.slots.map((slot: MeetingOutcomeSlot) => slot.status)).toEqual([
      'resolved',
      'partially_resolved',
      'unresolved',
    ]);
    expect(outcome.slots[1].resultSummary).toBe(
      '已有相关行动或结论，但仍需补齐或完成。',
    );
    expect(outcome.slots[2].resultSummary).toBe(
      '会议中提到了该目标，但没有形成可核验结论。',
    );
    expect(outcome.receipt.coverage).toBe('1 项已闭环，2 项仍需继续。');
  });

  it('blocks a model claim whose cited evidence does not match the slot', async () => {
    const binder = seedBinder([
      plannedSlot('slot-budget', '确认 mobile launch budget'),
    ]);
    mockGenerateJSON.mockResolvedValue({
      slots: [
        {
          slotId: 'slot-budget',
          status: 'resolved',
          resultSummary: '预算已通过。',
          confidence: 0.99,
          evidenceRefs: ['D1'],
        },
      ],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/meeting-outcomes/bind',
      payload: {
        binderId: binder.id,
        meetingId: 'meeting-unrelated',
        decisions: [
          {
            id: 'decision-unrelated',
            text: 'team lunch location 选择了三楼。',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().binder.slots[0]).toMatchObject({
      status: 'blocked_by_missing_evidence',
      mentionState: 'not_seen',
      resultSummary: '当前没有足够证据判断结果。',
    });
  });

  it('records a blocked result without calling the model when no meeting evidence exists', async () => {
    const binder = seedBinder([
      plannedSlot('slot-estimate', '确认 mobile QA estimate 估时口径'),
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/meeting-outcomes/bind',
      payload: {
        binderId: binder.id,
        meetingId: 'meeting-empty',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockGenerateJSON).not.toHaveBeenCalled();
    expect(response.json().binder).toMatchObject({
      status: 'blocked',
      bindingMode: 'deterministic_fallback',
      bindingError: 'missing_meeting_evidence',
    });
  });

  it('returns the same binder from its read API and archived meeting detail', async () => {
    const binder = seedBinder([
      plannedSlot('slot-estimate', '确认 mobile QA estimate 估时口径'),
    ]);
    mockGenerateJSON.mockResolvedValue({
      slots: [
        {
          slotId: 'slot-estimate',
          status: 'resolved',
          resultSummary: 'QA estimate 定为 5 人天。',
          confidence: 0.9,
          evidenceRefs: ['D1'],
        },
      ],
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/meeting-outcomes/bind',
      payload: {
        binderId: binder.id,
        meetingId: 'meeting-q3-archive',
        decisions: [
          {
            id: 'decision-estimate',
            text: 'mobile QA estimate 估时口径定为 5 人天。',
          },
        ],
      },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_title, group_id, group_name,
         timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, 'meeting', ?, ?, ?, ?, 0.9, 'neutral', ?, ?)`,
    ).run(
      'meeting-q3-archive-summary',
      'Q3 mobile planning archive',
      'Meeting Pilot',
      'meeting-q3-archive',
      '2026 Q3 planning for video mobile',
      timestamp,
      JSON.stringify({ summary: 'QA estimate 定为 5 人天。' }),
      timestamp,
    );

    const readResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/meeting-outcomes/${binder.id}`,
    });
    const meetingResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/meetings/meeting-q3-archive',
    });

    expect(readResponse.statusCode).toBe(200);
    expect(readResponse.json().binder.meetingId).toBe('meeting-q3-archive');
    expect(meetingResponse.statusCode).toBe(200);
    expect(meetingResponse.json().outcomeBinder).toMatchObject({
      id: binder.id,
      meetingId: 'meeting-q3-archive',
      status: 'bound',
    });
  });

  it('lets Ask consume a matching binder as a read-only structured source', async () => {
    const planned = plannedSlot(
      'slot-estimate',
      '确认 mobile QA estimate 估时口径',
    );
    const binder = seedBinder([planned]);
    new MeetingOutcomeBinderRepository(db).saveBinding({
      binderId: binder.id,
      userId: 'test',
      meetingId: 'meeting-q3-ask',
      status: 'bound',
      bindingMode: 'deterministic_fallback',
      slots: [
        {
          ...planned,
          status: 'resolved',
          mentionState: 'supported',
          resultSummary: 'QA estimate 估时口径定为 5 人天。',
          evidence: [
            {
              id: 'D1',
              kind: 'decision',
              refId: 'decision-estimate',
              label: '决议',
              snippet: 'mobile QA estimate 估时口径定为 5 人天。',
            },
          ],
          confidence: 0.9,
        },
      ],
    });
    mockGenerateJSON.mockRejectedValue(new Error('planner mock unavailable'));
    mockGenerate.mockResolvedValue({
      content: JSON.stringify({
        answer: '昨天的 Q3 planning 已将 QA 估时口径定为 5 人天。',
      }),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: {
        query: '昨天 planning 估时口径定了吗？',
        evaluationMode: 'read_only',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.meetingOutcomeSources).toHaveLength(1);
    expect(body.meetingOutcomeSources[0]).toMatchObject({
      id: binder.id,
      meetingId: 'meeting-q3-ask',
      status: 'bound',
    });
    expect(body.meetingOutcomeSources[0].receipt.boundary).toContain(
      '不会写回 Calendar、Jira、RingCentral',
    );
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(String(mockGenerate.mock.calls[0][0])).toContain(
      'Structured meeting outcomes (read-only)',
    );
    expect(String(mockGenerate.mock.calls[0][0])).toContain(
      'QA estimate 估时口径定为 5 人天',
    );
  });
});
