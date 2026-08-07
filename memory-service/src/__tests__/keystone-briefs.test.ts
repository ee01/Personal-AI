import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi
      .fn()
      .mockRejectedValue(new Error('Embedding not available in tests')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

import {
  KeystoneBriefService,
  type UpsertKeystoneBriefInput,
} from '../core/KeystoneBriefService.js';
import { buildApp } from '../server.js';
import type {
  ContextRecallMatch,
  ContextRecallRequest,
} from '../types/index.js';
import { now } from '../utils/time.js';
import { getTestDb } from './setup.js';

function resetTables(db: BetterSqlite3.Database): void {
  db.prepare('DELETE FROM keystone_brief_events').run();
  db.prepare('DELETE FROM keystone_brief_candidate_runs').run();
  db.prepare('DELETE FROM keystone_brief_sources').run();
  db.prepare('DELETE FROM keystone_briefs').run();
}

function readyInput(
  overrides: Partial<UpsertKeystoneBriefInput> = {},
): UpsertKeystoneBriefInput {
  const timestamp = now();
  return {
    briefKey: 'workflow:ringcx-whatsapp-sms-reuse',
    title: 'WhatsApp 集成复用路径',
    subjectType: 'workflow',
    scope: 'work',
    status: 'ready',
    summary:
      '先调研 RingCX WhatsApp 与 SMS 基础设施。token=private，owner@example.com，电话 138 0013 8000，来源 https://internal.example/path',
    freshness: {
      state: 'fresh',
      reason: '最近 7 天有相关消息，未检测到冲突',
      expiresAt: timestamp + 7 * 86400,
    },
    slots: {
      whyItMatters: '当前正在讨论 WhatsApp 接入方式。',
      currentState: '先复用现有 SMS 基础设施，再决定新增设计。',
      stableFacts: [
        {
          text: 'RingCX 已有 SMS 基础设施可供复用调研。',
          sourceRefs: ['message:msg-1', 'source_memory:source-2'],
          confidence: 'high',
          authority: 'direct_message',
          validAsOf: timestamp,
          staleRisk: 'low',
          projection: 'summary_ok',
        },
      ],
      decisions: [],
      constraints: [
        {
          text: '不要在调研前直接设计第二套发送链路。',
          sourceRefs: ['message:msg-1'],
          projection: 'summary_ok',
        },
      ],
      traps: [],
      peopleAndSources: [],
      nextUseCases: ['RingCentral thread reading', 'Jira estimate'],
      openQuestions: ['WhatsApp provider 的最终能力边界是什么？'],
    },
    sourceMap: [
      {
        ref: 'message:msg-1',
        sourceType: 'message',
        sourceId: 'msg-1',
        role: 'authority',
        title: 'WhatsApp 讨论',
        timestamp,
        authority: 'direct_message',
        projection: 'summary_ok',
      },
      {
        ref: 'source_memory:source-2',
        sourceType: 'source_memory',
        sourceId: 'source-2',
        role: 'supporting',
        title: 'SMS architecture notes',
        timestamp: timestamp - 3600,
        authority: 'source_memory',
        projection: 'local_only',
      },
    ],
    sceneAnchors: {
      projects: ['RingCX'],
      jiraKeys: ['NOVA-22001'],
      people: [],
      topics: ['WhatsApp', 'SMS reuse'],
      surfaces: ['ringcentral_thread_reading'],
    },
    displayPolicy: {
      defaultMode: 'chip',
      maxLines: 6,
      canCopyToDraft: true,
      externalSummaryOnly: true,
    },
    ...overrides,
  };
}

function recallRequest(
  overrides: Partial<ContextRecallRequest> = {},
): ContextRecallRequest {
  return {
    surface: 'web_passive',
    contextType: 'message_thread',
    title: 'RingCX WhatsApp integration',
    primaryText: 'Should we reuse the SMS infrastructure?',
    interactionScene: {
      sceneType: 'ringcentral_thread_reading',
      surface: 'memory_lens',
      userMode: 'read',
      admission: { state: 'passive_ready' },
    },
    ...overrides,
  };
}

const rawMatches: ContextRecallMatch[] = [
  {
    id: 'msg-1',
    type: 'message',
    score: 0.91,
    title: 'WhatsApp thread',
    snippet: 'Reuse the SMS integration path first.',
    links: [],
  },
];

describe('KeystoneBriefService', () => {
  let db: BetterSqlite3.Database;
  let service: KeystoneBriefService;

  beforeAll(() => {
    db = getTestDb();
    service = new KeystoneBriefService(db);
  });

  beforeEach(() => resetTables(db));

  it('promotes grounded multi-source candidates and sanitizes external text', () => {
    const brief = service.upsertComposedCandidate(readyInput());

    expect(brief.status).toBe('ready');
    expect(brief.sourceMap).toHaveLength(2);
    expect(brief.displayPolicy.hiddenSourceCount).toBe(1);
    expect(brief.externalSummary).toContain('token=[已隐藏]');
    expect(brief.externalSummary).toContain('[邮箱已隐藏]');
    expect(brief.externalSummary).toContain('[电话已隐藏]');
    expect(brief.externalSummary).toContain('[链接已隐藏]');
    expect(brief.writeReceipt).toEqual({
      writesProfile: false,
      sendsExternal: false,
      createsTask: false,
      updatesFacts: false,
      writesOutcomeEvent: true,
    });
  });

  it('keeps weak or unresolved candidates out of passive matching', () => {
    const weak = service.upsertComposedCandidate(
      readyInput({
        briefKey: 'topic:weak-single-source',
        sourceMap: readyInput().sourceMap?.slice(0, 1),
      }),
    );

    expect(weak.status).toBe('candidate');
    expect(weak.blockedReason).toBe('unresolved_source_refs');
    expect(service.matchContext(recallRequest(), rawMatches)).toBeUndefined();
  });

  it('maps ready, conflict, stale, selection, and rehearsal states', () => {
    const ready = service.upsertComposedCandidate(readyInput());
    expect(service.matchContext(recallRequest(), rawMatches)).toMatchObject({
      brief: { id: ready.id, status: 'ready' },
      presentationMode: 'primary',
      evidenceMatchIds: ['msg-1'],
      relatedMemoryCount: 1,
    });

    service.upsertComposedCandidate(readyInput({ status: 'partial' }));
    expect(service.matchContext(recallRequest(), rawMatches)).toMatchObject({
      brief: {
        status: 'partial',
        displayPolicy: { canCopyToDraft: false },
      },
      presentationMode: 'conflict',
    });

    service.upsertComposedCandidate(
      readyInput({
        status: 'ready',
        freshness: {
          state: 'fresh',
          reason: '需要刷新',
          expiresAt: now() - 1,
        },
      }),
    );
    expect(service.matchContext(recallRequest(), rawMatches)).toMatchObject({
      brief: { status: 'stale' },
      presentationMode: 'stale_notice',
    });

    expect(
      service.matchContext(
        recallRequest({ contextType: 'selected_text' }),
        rawMatches,
      ),
    ).toBeUndefined();
    expect(
      service.matchContext(recallRequest(), [
        { ...rawMatches[0], id: 'rehearsal-1', type: 'rehearsal' },
      ]),
    ).toBeUndefined();
  });

  it('matches automatic briefs only in the requested Options language', () => {
    service.upsertComposedCandidate(
      readyInput({
        compositionVersion: 'auto-reflection-grounded-v2-en-US',
      }),
    );

    expect(
      service.matchContext(recallRequest(), rawMatches, {
        outputLanguage: 'zh-CN',
      }),
    ).toBeUndefined();
    expect(
      service.matchContext(recallRequest(), rawMatches, {
        outputLanguage: 'en-US',
      }),
    ).toMatchObject({
      presentationMode: 'primary',
      whyNow: 'Covers 1 original memories recalled this time',
    });
  });

  it('falls back after hide or inaccurate feedback without deleting sources', () => {
    const brief = service.upsertComposedCandidate(readyInput());
    const hidden = service.recordEvent(brief.id, {
      eventType: 'hidden',
      surface: 'memory_lens',
    });
    expect(hidden?.status).toBe('hidden');
    expect(hidden?.sourceMap).toHaveLength(2);
    expect(service.matchContext(recallRequest(), rawMatches)).toBeUndefined();

    const restored = service.upsertComposedCandidate(readyInput());
    const inaccurate = service.recordEvent(restored.id, {
      eventType: 'not_accurate',
      surface: 'memory_lens',
      reason: 'conflicting evidence',
    });
    expect(inaccurate).toMatchObject({
      status: 'blocked',
      repairState: 'needs_repair',
      blockedReason: 'conflicting evidence',
    });
    expect(service.getRepairPreview(restored.id)).toMatchObject({
      readOnly: true,
      brief: { id: restored.id },
    });
  });
});

describe('Keystone brief API', () => {
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

  beforeEach(() => resetTables(db));

  it('creates, matches, reads, and records dedicated brief events', async () => {
    const mine = await app.inject({
      method: 'POST',
      url: '/api/v1/keystone-briefs/mine',
      payload: readyInput({
        compositionVersion: 'auto-reflection-grounded-v2-zh-CN',
      }),
    });
    expect(mine.statusCode).toBe(200);
    expect(mine.json().item.status).toBe('ready');
    const id = mine.json().item.id as string;

    const match = await app.inject({
      method: 'GET',
      url: '/api/v1/keystone-briefs/match?scene=ringcentral_thread_reading&text=WhatsApp%20SMS%20reuse',
      headers: { 'x-personal-ai-language': 'zh-CN' },
    });
    expect(match.statusCode).toBe(200);
    expect(match.json().items[0]).toMatchObject({
      brief: { id },
      presentationMode: 'primary',
    });
    expect(match.json().scopeReceipt.note).toContain('不会写入');

    const mismatchedLanguage = await app.inject({
      method: 'GET',
      url: '/api/v1/keystone-briefs/match?scene=ringcentral_thread_reading&text=WhatsApp%20SMS%20reuse',
      headers: { 'x-personal-ai-language': 'en-US' },
    });
    expect(mismatchedLanguage.statusCode).toBe(200);
    expect(mismatchedLanguage.json().items).toEqual([]);

    const event = await app.inject({
      method: 'POST',
      url: `/api/v1/keystone-briefs/${id}/events`,
      payload: {
        eventType: 'not_accurate',
        surface: 'memory_lens',
        reason: 'old decision',
      },
    });
    expect(event.statusCode).toBe(200);
    expect(event.json().item).toMatchObject({
      status: 'blocked',
      repairState: 'needs_repair',
    });

    const repair = await app.inject({
      method: 'POST',
      url: `/api/v1/keystone-briefs/${id}/repair-preview`,
    });
    expect(repair.statusCode).toBe(200);
    expect(repair.json()).toMatchObject({ readOnly: true });
  });

  it('returns a ready brief anchor when ordinary passive search is disabled', async () => {
    const previousGuard =
      process.env.CONTEXT_RECALL_ROUTE_PASSIVE_FAST_FALLBACK_ENABLED;
    const previousSearch = process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED;
    process.env.CONTEXT_RECALL_ROUTE_PASSIVE_FAST_FALLBACK_ENABLED = 'true';
    process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED = 'false';
    try {
      const brief = new KeystoneBriefService(db).upsertComposedCandidate(
        readyInput(),
      );
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/context-recall',
        payload: recallRequest({
          title: 'Nova CA - Brandy WhatsApp integration',
          primaryText: 'WhatsApp SMS reuse',
        }),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        matches: [
          {
            id: `keystone:${brief.id}`,
            displayPriority: 'p1',
            metadata: { keystoneBriefFallback: true },
          },
        ],
        topMatch: { id: `keystone:${brief.id}` },
        keystoneBrief: {
          presentationMode: 'primary',
          brief: { id: brief.id, status: 'ready' },
        },
      });
    } finally {
      if (previousGuard === undefined) {
        delete process.env.CONTEXT_RECALL_ROUTE_PASSIVE_FAST_FALLBACK_ENABLED;
      } else {
        process.env.CONTEXT_RECALL_ROUTE_PASSIVE_FAST_FALLBACK_ENABLED =
          previousGuard;
      }
      if (previousSearch === undefined) {
        delete process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED;
      } else {
        process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED = previousSearch;
      }
    }
  });
});
