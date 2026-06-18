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

describe('Rehearsal API and context activation', () => {
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
    db.prepare('DELETE FROM rehearsal_activations').run();
    db.prepare('DELETE FROM rehearsals').run();
  });

  it('rejects rehearsals without a future scene cue', async () => {
    const rejected = await app.inject({
      method: 'POST',
      url: '/api/v1/rehearsals',
      payload: {
        title: 'Generic reminder without a trigger',
        content: 'Remember to ask about the review later.',
        confidence: 0.9,
      },
    });

    expect(rejected.statusCode).toBe(400);
    expect(rejected.json()).toMatchObject({
      code: 'REHEARSAL_FUTURE_CUE_REQUIRED',
    });
    expect(rejected.json().requiredCueFields).toContain('people');
    expect(rejected.json().requiredCueFields).toContain('surfaces');

    const keywordOnly = await app.inject({
      method: 'POST',
      url: '/api/v1/rehearsals',
      payload: {
        title: 'Estimate answer script',
        scenarioType: 'writing',
        content: 'When the Original Estimate topic appears, answer with story points and person-day context.',
        activationCues: {
          topics: ['Original Estimate'],
          surfaces: ['jira_issue'],
        },
        confidence: 0.9,
      },
    });

    expect(keywordOnly.statusCode).toBe(201);
    expect(keywordOnly.json().rehearsal.status).toBe('candidate');
    expect(keywordOnly.json().rehearsal.activationCues.topics).toEqual([
      'Original Estimate',
    ]);
  });

  it('blocks clearing future scene cues from prompt-eligible rehearsals', async () => {
    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/rehearsals',
        payload: {
          title: 'Colin handoff cue',
          content: 'Ask Colin whether the handoff blocker is back.',
          activationCues: { people: ['Colin Liu'] },
          confidence: 0.9,
        },
      })
    ).json().rehearsal;

    const cleared = await app.inject({
      method: 'PATCH',
      url: `/api/v1/rehearsals/${created.id}`,
      payload: {
        activationCues: {},
      },
    });

    expect(cleared.statusCode).toBe(400);
    expect(cleared.json()).toMatchObject({
      code: 'REHEARSAL_FUTURE_CUE_REQUIRED',
    });
  });

  it('creates high-confidence rehearsals as active and supports lifecycle feedback', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/rehearsals',
      payload: {
        title: 'Talk to Colin about RingClaw follow-up',
        scenarioType: 'person_chat',
        content: 'When speaking with Colin Liu, remember to ask about RingClaw review ownership.',
        activationCues: {
          people: ['Colin Liu'],
          groupIds: ['colin-group'],
          keywords: ['RingClaw'],
        },
        confidence: 0.9,
        priority: 8,
      },
    });

    expect(create.statusCode).toBe(201);
    const created = create.json().rehearsal;
    expect(created.status).toBe('active');
    expect(created.activationCues.people).toEqual(['Colin Liu']);

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/rehearsals?status=active',
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toHaveLength(1);

    const pause = await app.inject({
      method: 'PATCH',
      url: `/api/v1/rehearsals/${created.id}`,
      payload: { status: 'paused' },
    });
    expect(pause.statusCode).toBe(200);
    expect(pause.json().rehearsal.status).toBe('paused');

    const feedback = await app.inject({
      method: 'POST',
      url: `/api/v1/rehearsals/${created.id}/feedback`,
      payload: { outcome: 'used' },
    });
    expect(feedback.statusCode).toBe(200);
    expect(feedback.json().rehearsal.status).toBe('used');
    expect(feedback.json().rehearsal.usedCount).toBe(1);
  });

  it('returns rehearsal matches through context-recall when sourceTypes allow it', async () => {
    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/rehearsals',
        payload: {
          title: 'Next Colin Liu conversation',
          scenarioType: 'person_chat',
          content: 'Ask Colin Liu whether the RingClaw review needs a concrete owner.',
          activationCues: {
            people: ['Colin Liu'],
            groupIds: ['colin-group'],
            keywords: ['RingClaw'],
          },
          confidence: 0.92,
          priority: 9,
        },
      })
    ).json().rehearsal;

    const recall = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'composer_guard',
        contextType: 'message_thread',
        title: 'Chat with Colin Liu about RingClaw',
        primaryText: 'Colin Liu asked about RingClaw review',
        sourceContext: {
          groupId: 'colin-group',
          participants: ['Colin Liu'],
        },
        entityHints: [{ kind: 'person', value: 'Colin Liu' }],
        sourceTypes: ['rehearsal'],
        limit: 3,
      },
    });

    expect(recall.statusCode).toBe(200);
    const body = recall.json();
    expect(body.topMatch.type).toBe('rehearsal');
    expect(body.topMatch.id).toBe(created.id);
    expect(body.topMatch.displayPriority).toBe('p1');
    expect(body.topMatch.reasonType).toBe('prospective_cue');
    expect(body.topMatch.evidenceRole).toBe('rehearsal_cue');
    expect(body.topMatch.metadata.rehearsal.content).toBe(
      'Ask Colin Liu whether the RingClaw review needs a concrete owner.',
    );
    expect(body.topMatch.exploreLink).toBe(
      `#/rehearsals?rehearsalId=${encodeURIComponent(created.id)}`,
    );
    expect(body.topMatch.metadata.rehearsal.activationId).toBeTruthy();

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/rehearsals/${created.id}`,
    });
    expect(detail.json().rehearsal.activationCount).toBe(1);
    expect(detail.json().activations).toHaveLength(1);
  });

  it('does not activate rehearsal when the caller excludes the source type', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/rehearsals',
      payload: {
        title: 'Colin excluded source',
        content: 'Remember the Colin follow-up.',
        activationCues: { people: ['Colin Liu'], groupIds: ['colin-group'] },
        confidence: 0.9,
      },
    });

    const recall = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'composer_guard',
        contextType: 'message_thread',
        title: 'Colin Liu',
        primaryText: 'Colin Liu asks for review',
        sourceContext: { groupId: 'colin-group' },
        sourceTypes: ['glip'],
      },
    });

    expect(recall.statusCode).toBe(200);
    expect(recall.json().matches.some((match: any) => match.type === 'rehearsal')).toBe(false);
  });

  it('keeps expired rehearsals as stale weak prompts instead of deleting them', async () => {
    const now = Math.floor(Date.now() / 1000);
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/rehearsals',
      payload: {
        title: 'Expired Colin cue',
        content: 'Ask Colin about an old review point.',
        activationCues: { people: ['Colin Liu'], groupIds: ['colin-group'] },
        confidence: 0.9,
        validUntil: now - 3600,
      },
    });
    const id = create.json().rehearsal.id;

    const recall = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'composer_guard',
        contextType: 'message_thread',
        title: 'Colin Liu old review',
        primaryText: 'Colin Liu old review',
        sourceContext: { groupId: 'colin-group', participants: ['Colin Liu'] },
        sourceTypes: ['rehearsal'],
      },
    });

    expect(recall.statusCode).toBe(200);
    expect(recall.json().topMatch.type).toBe('rehearsal');
    expect(recall.json().topMatch.displayPriority).toBe('p2');

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/rehearsals/${id}`,
    });
    expect(detail.json().rehearsal.status).toBe('stale');
    expect(detail.json().rehearsal.staleReason).toBe('validity_expired');
  });

  it('caps stale rehearsals to weak prompts even when exact cues score strongly', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/rehearsals',
      payload: {
        title: 'Old launch review script',
        scenarioType: 'meeting_prep',
        status: 'stale',
        content: 'Ask Colin whether RingClaw launch ownership is still blocked.',
        activationCues: {
          people: ['Colin Liu'],
          projects: ['RingClaw'],
          groupIds: ['colin-group'],
          conversationIds: ['colin-conversation'],
          meetingIds: ['ringclaw-launch'],
          issueKeys: ['RC-42'],
          urls: ['https://jira.example.com/browse/RC-42'],
        },
        confidence: 0.99,
        priority: 10,
      },
    });
    expect(create.statusCode).toBe(201);
    const id = create.json().rehearsal.id;

    const recall = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'meeting_prep',
        contextType: 'meeting',
        title: 'RingClaw launch with Colin Liu',
        primaryText: 'Colin Liu is reviewing RC-42 for RingClaw launch.',
        url: 'https://jira.example.com/browse/RC-42?focusedCommentId=1',
        sourceContext: {
          groupId: 'colin-group',
          conversationId: 'colin-conversation',
          meetingId: 'ringclaw-launch',
          issueKey: 'RC-42',
          participants: ['Colin Liu'],
        },
        entityHints: [
          { kind: 'person', value: 'Colin Liu' },
          { kind: 'project', value: 'RingClaw' },
        ],
        sourceTypes: ['rehearsal'],
        limit: 3,
      },
    });

    expect(recall.statusCode).toBe(200);
    const match = recall.json().topMatch;
    expect(match.id).toBe(id);
    expect(match.score).toBeGreaterThan(0.72);
    expect(match.displayPriority).toBe('p2');
    expect(match.whyRelevant).toContain('已降权，仅弱提示');

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/rehearsals/${id}`,
    });
    expect(detail.json().activations[0]).toMatchObject({
      displayPriority: 'p2',
    });
  });

  it('lets a manually reviewed stale rehearsal reactivate without immediate aging rollback', async () => {
    const now = Math.floor(Date.now() / 1000);
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/rehearsals',
      payload: {
        title: 'Review Colin handoff again',
        content: 'Ask Colin whether the handoff blocker came back.',
        activationCues: { people: ['Colin Liu'], groupIds: ['colin-group'] },
        confidence: 0.9,
        validUntil: now - 3600,
      },
    });
    const id = create.json().rehearsal.id;

    const stale = await app.inject({
      method: 'GET',
      url: `/api/v1/rehearsals/${id}`,
    });
    expect(stale.json().rehearsal.status).toBe('stale');

    const restored = await app.inject({
      method: 'PATCH',
      url: `/api/v1/rehearsals/${id}`,
      payload: {
        status: 'active',
        staleReason: null,
        validUntil: null,
      },
    });

    expect(restored.statusCode).toBe(200);
    const rehearsal = restored.json().rehearsal;
    expect(rehearsal.status).toBe('active');
    expect(rehearsal.staleReason).toBeUndefined();
    expect(rehearsal.validUntil).toBeUndefined();
    expect(rehearsal.lastActivatedAt).toBeGreaterThanOrEqual(now);
  });
});
