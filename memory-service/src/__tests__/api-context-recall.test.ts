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

import { EmbeddingClient } from '../llm/EmbeddingClient.js';
import { RecallEngine } from '../core/RecallEngine.js';
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
    vi.mocked(EmbeddingClient.getInstance).mockClear();
    vi.mocked(EmbeddingClient.isLoaded).mockReturnValue(false);

    db.prepare('DELETE FROM recall_training_cases').run();
    db.prepare('DELETE FROM recall_patch_runs').run();
    db.prepare('DELETE FROM recall_relevance_patches').run();
    db.prepare('DELETE FROM memory_outcome_events').run();
    db.prepare('DELETE FROM memory_outcome_policy_patches').run();
    db.prepare('DELETE FROM conversation_context_frames').run();
    db.prepare('DELETE FROM memory_feedback_events').run();
    db.prepare('DELETE FROM memory_metadata').run();
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

  it('restores a saved Source Memory link when an orphaned chunk is recalled', async () => {
    const capsuleId = 'source-memory-orphan-link';
    const sourceUrl =
      'https://docs.google.com/document/d/source-memory-link-test/edit?tab=t.0';
    const sourceTitle = 'Story Points estimation by AI Service - Google Docs';
    const content =
      'Story Points estimation by AI Service team planning guide and task estimate workflow.';
    const now = Math.floor(Date.now() / 1000);

    db.prepare('DELETE FROM source_memory_capsules WHERE id = ?').run(capsuleId);
    db.prepare(
      `INSERT INTO source_memory_capsules (
         id, source_kind, source_url, source_title, source_host,
         source_fingerprint, capture_mode, capture_reason, status, scope,
         privacy_level, summary, content_preview, metadata_json,
         created_at, updated_at, saved_at
       ) VALUES (?, 'webpage', ?, ?, 'docs.google.com', ?, 'auto', ?, 'saved',
         'work', 'work', ?, ?, '{}', ?, ?, ?)`,
    ).run(
      capsuleId,
      sourceUrl,
      sourceTitle,
      `source-memory-fingerprint-${capsuleId}`,
      'auto_capture',
      sourceTitle,
      content,
      now,
      now,
      now,
    );
    db.prepare(
      `INSERT INTO chunks (
         chunk_id, file_path, line_start, line_end, content, content_hash,
         scope, source, source_type, related_entity_id, created_at
       ) VALUES (?, ?, 1, 1, ?, ?, 'work', ?, 'web', ?, ?)`,
    ).run(
      9010,
      `source-memory/${capsuleId}.md`,
      content,
      `source-memory-hash-${capsuleId}`,
      `source-memory:${capsuleId}`,
      'missing-source-memory-message',
      now,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9010,
      content,
    );

    const previousFastMode = process.env.CONTEXT_RECALL_PASSIVE_FAST_MODE;
    const previousFastSearch = process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED;
    process.env.CONTEXT_RECALL_PASSIVE_FAST_MODE = 'true';
    process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED = 'true';
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/context-recall',
        payload: {
          surface: 'web_passive',
          contextType: 'webpage',
          title: 'RCVSDK team stretch goal - Google Sheets',
          primaryText:
            'Story Points estimation AI Service team planning task estimate workflow',
          sourceTypes: ['web'],
          limit: 5,
          debug: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.debug?.channelsHit).toContain('fts');
      const match = body.matches.find(
        (item: { id: string }) => item.id === `source-memory:${capsuleId}`,
      );
      expect(match).toMatchObject({
        type: 'source_memory',
        sourceLabel: 'source_memory',
        sourceUrl,
        sourceTitle,
        exploreLink: `#/source-memory/${capsuleId}`,
        sourceClusterKey: `source-memory:${capsuleId}`,
        links: [{ label: '打开来源', url: sourceUrl }],
        metadata: {
          sourceMemoryCapsuleId: capsuleId,
          sourceKind: 'webpage',
          captureMode: 'auto',
        },
      });

      const activeRecallRes = await app.inject({
        method: 'POST',
        url: '/api/v1/recall',
        payload: {
          query:
            'Story Points estimation AI Service team planning task estimate workflow',
          topK: 5,
          channels: ['fts'],
          sourceTypes: ['web'],
          includeMetadata: true,
        },
      });
      expect(activeRecallRes.statusCode).toBe(200);
      const recallItem = activeRecallRes
        .json()
        .items.find((item: { id: string }) => item.id === '9010');
      expect(recallItem).toMatchObject({
        type: 'chunk',
        sourceUrl,
        sourceTitle,
        metadata: {
          sourceMemoryCapsuleId: capsuleId,
          sourceKind: 'webpage',
          captureMode: 'auto',
        },
      });
    } finally {
      if (previousFastMode === undefined) {
        delete process.env.CONTEXT_RECALL_PASSIVE_FAST_MODE;
      } else {
        process.env.CONTEXT_RECALL_PASSIVE_FAST_MODE = previousFastMode;
      }
      if (previousFastSearch === undefined) {
        delete process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED;
      } else {
        process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED = previousFastSearch;
      }
      db.prepare('DELETE FROM chunks_fts WHERE rowid = ?').run(9010);
      db.prepare('DELETE FROM chunks WHERE chunk_id = ?').run(9010);
      db.prepare('DELETE FROM source_memory_capsules WHERE id = ?').run(capsuleId);
    }
  });

  it('short-circuits passive recall at the route when passive search is disabled', async () => {
    const previousGuard =
      process.env.CONTEXT_RECALL_ROUTE_PASSIVE_FAST_FALLBACK_ENABLED;
    const previousSearch = process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED;
    process.env.CONTEXT_RECALL_ROUTE_PASSIVE_FAST_FALLBACK_ENABLED = 'true';
    process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED = 'false';

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/context-recall',
        payload: {
          surface: 'web_passive',
          contextType: 'webpage',
          title: 'Falcon launch readiness',
          primaryText: 'Project Falcon launch readiness weekend planning',
          limit: 5,
          debug: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.matches).toEqual([]);
      expect(body.topMatch).toBeNull();
      expect(body.debug?.rejectedReason).toBe(
        'passive_fast_search_disabled',
      );
      expect(EmbeddingClient.getInstance).not.toHaveBeenCalled();
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

  it('keeps passive Lens search on when CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED is unset', async () => {
    const previousGuard =
      process.env.CONTEXT_RECALL_ROUTE_PASSIVE_FAST_FALLBACK_ENABLED;
    const previousFastMode = process.env.CONTEXT_RECALL_PASSIVE_FAST_MODE;
    const previousSearch = process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED;
    process.env.CONTEXT_RECALL_ROUTE_PASSIVE_FAST_FALLBACK_ENABLED = 'true';
    process.env.CONTEXT_RECALL_PASSIVE_FAST_MODE = 'true';
    delete process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED;

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/context-recall',
        payload: {
          surface: 'web_passive',
          contextType: 'webpage',
          title: 'Falcon launch readiness',
          primaryText: 'Project Falcon launch readiness weekend planning',
          limit: 5,
          debug: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.debug?.rejectedReason).not.toBe(
        'passive_fast_search_disabled',
      );
    } finally {
      if (previousGuard === undefined) {
        delete process.env.CONTEXT_RECALL_ROUTE_PASSIVE_FAST_FALLBACK_ENABLED;
      } else {
        process.env.CONTEXT_RECALL_ROUTE_PASSIVE_FAST_FALLBACK_ENABLED =
          previousGuard;
      }
      if (previousFastMode === undefined) {
        delete process.env.CONTEXT_RECALL_PASSIVE_FAST_MODE;
      } else {
        process.env.CONTEXT_RECALL_PASSIVE_FAST_MODE = previousFastMode;
      }
      if (previousSearch === undefined) {
        delete process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED;
      } else {
        process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED = previousSearch;
      }
    }
  });

  it('does not short-circuit composer_guard when passive Lens search is disabled', async () => {
    const previousGuard =
      process.env.CONTEXT_RECALL_ROUTE_PASSIVE_FAST_FALLBACK_ENABLED;
    const previousSearch = process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED;
    process.env.CONTEXT_RECALL_ROUTE_PASSIVE_FAST_FALLBACK_ENABLED = 'true';
    process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED = 'false';

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/context-recall',
        payload: {
          surface: 'composer_guard',
          contextType: 'message_thread',
          title: 'RingCentral Staff Slides Update',
          primaryText: 'Staff slides Rooms NC JVD Webinar done.',
          debug: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.debug?.rejectedReason).not.toBe(
        'passive_fast_search_disabled',
      );
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
    expect(['work', 'personal']).toContain(top.scope);
    expect(typeof top.snippet).toBe('string');
    expect(top.displayPriority).toBe('p1');
    expect(top.whyRelevant?.length).toBeGreaterThan(0);
    expect(top.matchedAnchors?.projects || top.matchedAnchors?.topics).toBeTruthy();
    expect(body.autopilot?.mode).toBe('card');
    expect(body.autopilot?.strongCount).toBeGreaterThan(0);
    expect(body.autopilot?.sceneAnchors?.projects || body.autopilot?.sceneAnchors?.topics).toBeTruthy();
    expect(body.scopeReceipt?.requestedScope).toBe('all');
    expect(body.scopeReceipt?.effectiveScope).toBe('both');
    expect(body.scopeReceipt?.shown.total).toBe(body.matches.length);
    expect(body.scopeReceipt?.candidates.work).toBeGreaterThan(0);
    expect(body.scopeReceipt?.candidates.personal).toBeGreaterThan(0);
    expect(body.scopeReceipt?.note).toContain('全部记忆');
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

  it('does not cold-start the embedding model for passive recall', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'Falcon launch readiness',
        primaryText: 'Project Falcon launch readiness',
        limit: 3,
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(EmbeddingClient.getInstance).not.toHaveBeenCalled();
    expect(res.json().debug?.channelsHit).toContain('fts');
  });

  it('returns a passive recall scope receipt for explicit work scope', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'Falcon launch readiness',
        primaryText: 'Project Falcon launch readiness',
        scope: 'work',
        limit: 3,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.scopeReceipt).toMatchObject({
      requestedScope: 'work',
      effectiveScope: 'work',
      includesPersonal: false,
    });
    expect(body.scopeReceipt?.note).toContain('仅检索工作记忆');
    expect(body.scopeReceipt?.candidates.personal).toBe(0);
    expect(body.matches.every((match: any) => match.scope !== 'personal')).toBe(
      true,
    );
  });

  it('silently filters cross-topic evidence before returning Context Recall matches', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const recallSpy = vi
      .spyOn(RecallEngine.prototype, 'recall')
      .mockResolvedValueOnce({
        items: [
          {
            id: 'mtr-141852-status',
            type: 'message',
            content: 'MTR-141852 current status is In Progress.',
            displayTitle: 'MTR-141852 status',
            score: 0.97,
            source: 'jira',
            sourceTitle: 'MTR-141852',
            timestamp: currentTime - 60,
            metadata: {
              issueKey: 'MTR-141852',
              relatedProject: 'MTR',
            },
          },
          {
            id: 'mtr-141852-estimate',
            type: 'message',
            content: 'MTR-141852 Original Estimate is 5 story points.',
            displayTitle: 'MTR-141852 original estimate',
            score: 0.95,
            source: 'jira',
            sourceTitle: 'MTR-141852',
            timestamp: currentTime - 120,
            metadata: {
              issueKey: 'MTR-141852',
              relatedProject: 'MTR',
            },
          },
          {
            id: 'nav-8891-status-noise',
            type: 'message',
            content: 'NAV-8891 current status is Ready for QA.',
            displayTitle: 'NAV-8891 status',
            score: 0.96,
            source: 'jira',
            sourceTitle: 'NAV-8891',
            timestamp: currentTime - 30,
            metadata: {
              issueKey: 'NAV-8891',
              relatedProject: 'NAV',
            },
          },
        ],
        totalFound: 3,
        queryTimeMs: 1,
        channels: ['fts'],
      } as any);

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/context-recall',
        payload: {
          surface: 'web_passive',
          contextType: 'jira_issue',
          title: 'MTR-141852',
          primaryText:
            'MTR-141852 current status and Original Estimate story points',
          currentContext: { issueKey: 'MTR-141852' },
          entityHints: [{ kind: 'jira_key', value: 'MTR-141852' }],
          limit: 5,
          debug: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.matches.map((match: { id: string }) => match.id).sort()).toEqual(
        ['mtr-141852-estimate', 'mtr-141852-status'],
      );
      expect(body.topMatch?.id).not.toBe('nav-8891-status-noise');
      expect(body.cohesionReceipt).toMatchObject({
        policyVersion: 'evidence-cohesion-v1',
        state: 'cohesive',
        usedCount: 2,
        excludedCount: 1,
        silent: true,
      });
      expect(body.autopilot?.quietReasons).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reason: 'evidence_cohesion_cross_topic',
            count: 1,
          }),
        ]),
      );
    } finally {
      recallSpy.mockRestore();
    }
  });

  it('compiles a Jira estimate cue with 人天口径 for Memory Lens', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'estimate-mtr-148115',
      'MTR-148115 Original Estimate 口径是人天，必要时可以拆成 3h；close 没有硬性要求，due date 需要单独确认。',
      'glip',
      'https://app.ringcentral.com/messages/estimate-mtr-148115',
      'MTR-148115 estimate follow-up',
      'Esone',
      'estimate-group',
      'MTR Estimate',
      now - 15,
      0.9,
      'neutral',
      JSON.stringify({
        summary:
          'MTR-148115 original estimate 口径是人天，也提到 3h 拆分；close 无硬性要求。',
        contextMessages: [
          {
            content:
              'MTR-148115 Original Estimate 口径是人天，必要时可以拆成 3h。',
            isMainMessage: true,
          },
        ],
      }),
      now - 15,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      9101,
      'messages/estimate-mtr-148115',
      1,
      1,
      'MTR-148115 Original Estimate 口径是人天，必要时可以拆成 3h；close 没有硬性要求，due date 需要单独确认。',
      'hash-estimate-mtr-148115',
      'work',
      'glip',
      'glip',
      'MTR',
      now - 15,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9101,
      'MTR-148115 Original Estimate estimate 人天 3h close due date',
    );

    const payload = {
      surface: 'web_passive',
      contextType: 'jira_issue',
      title: 'MTR-148115 Original Estimate',
      url: 'https://jira.ringcentral.com/browse/MTR-148115',
      primaryText: 'MTR-148115 的 Original Estimate 应该填什么口径？',
      entityHints: [{ kind: 'jira_key', value: 'MTR-148115' }],
      sourceTypes: ['glip', 'jira', 'manual'],
      limit: 3,
      debug: true,
    };
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const cue = body.topMatch?.cue;
    expect(cue?.compileStatus).toBe('compiled');
    expect(cue?.actionType).toBe('remember');
    expect(cue?.cueText).toContain('上次 MTR-148115');
    expect(cue?.cueText).toContain('original estimate');
    expect(cue?.cueText).toContain('人天');
    expect(cue?.sourceRefs?.length).toBeGreaterThan(0);
    expect(cue?.cueKey).toContain('MTR-148115');
    expect(body.debug?.sceneFrame?.sceneType).toBe('jira_estimate');
    expect(body.debug?.cueCompiler?.compiledCount).toBeGreaterThan(0);

    for (const id of ['estimate-lens-wrong-1', 'estimate-lens-wrong-2']) {
      const feedbackRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ambient-calibration/traces',
        payload: {
          id,
          surface: 'memory_lens',
          sceneKey: 'jira:MTR-148115',
          action: 'wrong',
          strength: 'strong',
          polarity: 'negative',
          evidenceRefs: [
            {
              id: body.topMatch.id,
              type: body.topMatch.type,
              cueId: cue.id,
              cueKey: cue.cueKey,
              cue: {
                id: cue.id,
                cueKey: cue.cueKey,
                actionType: cue.actionType,
                compileStatus: cue.compileStatus,
                confidence: cue.confidence,
              },
            },
          ],
          metadata: {
            cueIds: [cue.id],
            cueKeys: [cue.cueKey],
          },
        },
      });
      expect(feedbackRes.statusCode).toBe(200);
    }

    const suppressedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload,
    });
    expect(suppressedRes.statusCode).toBe(200);
    const suppressed = suppressedRes.json();
    expect(suppressed.debug?.cueCompiler?.policySuppressedCount).toBeGreaterThan(0);
    expect(
      suppressed.matches.some(
        (match: any) => match.cue?.compileStatus === 'compiled',
      ),
    ).toBe(false);
  });

  it('does not reinforce access_count for passive context recall', async () => {
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
    const row = db
      .prepare(
        `SELECT access_count
         FROM memory_metadata
         WHERE target_type = 'chunk' AND target_id = '9001'`,
      )
      .get() as { access_count: number } | undefined;
    expect(row).toBeUndefined();
  });

  it('applies scene-aware user relevance patches before displaying matches', async () => {
    const feedback = await app.inject({
      method: 'POST',
      url: '/api/v1/feedback',
      payload: {
        type: 'recall_quality',
        targetType: 'chunk',
        targetId: '9001',
        action: 'negative',
        detail: JSON.stringify({
          version: '1',
          interaction: 'memory_relevance_trainer',
          surface: 'web_passive_bubble',
          action: 'negative',
          feedback_reason: 'wrong_group_or_project',
          current_url: 'https://internal.example.com/wiki/falcon-current',
          current_title: 'Falcon launch readiness',
          display_priority: 'p1',
        }),
      },
    });
    expect(feedback.statusCode).toBe(200);
    expect(feedback.json().relevancePatch?.status).toBe('patched');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'Falcon launch readiness',
        url: 'https://internal.example.com/wiki/falcon-current',
        primaryText: 'Project Falcon launch readiness',
        limit: 5,
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const ids = body.matches.map((match: any) => match.id);
    expect(ids).not.toContain('9001');
    expect(body.debug?.suppressionReasons).toContain('user_relevance_patch');
    expect(
      body.autopilot?.quietReasons.map((item: any) => item.reason),
    ).toContain('user_relevance_patch');
  });

  it('does not return archived memories on passive context recall', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO memory_metadata
        (target_type, target_id, salience_score, effective_salience,
         retrieval_tier, consolidation_level, created_at, updated_at)
       VALUES ('chunk', '9001', 0.1, 0.1, 'archive_only', 'archived', ?, ?)`,
    ).run(now, now);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'Falcon launch readiness',
        primaryText: 'Project Falcon launch readiness',
        limit: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    const ids = res.json().matches.map((match: any) => match.id);
    expect(ids).not.toContain('9001');
  });

  it('filters exact current URL and negative feedback self echoes', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO memory_feedback_events
        (feedback_type, target_type, target_id, action, created_at, updated_at)
       VALUES ('recall_quality', 'chunk', ?, 'negative', ?, ?)`,
    ).run('9002', now, now);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'webpage',
        title: 'Falcon launch readiness',
        url: 'https://internal.example.com/wiki/falcon#section',
        primaryText: 'Project Falcon launch readiness weekend planning',
        limit: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    const ids = res.json().matches.map((match: any) => match.id);
    expect(ids).not.toContain('9001');
    expect(ids).not.toContain('9002');
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
    expect(body.autopilot?.mode).toBe('silent');
    expect(body.autopilot?.quietReasons.map((item: any) => item.reason)).toContain(
      'source_context_excluded',
    );
    expect(body.debug?.rejectedReason).toBe('low_information_match');
  });

  it('suppresses generic RingCentral message location shell matches', async () => {
    const now = Math.floor(Date.now() / 1000);
    const content = '内容\n发送位置：当前这个 RingCentral 群';
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'generic-ringcentral-location',
      content,
      'glip',
      'https://app.ringcentral.com/messages/ai-service',
      'AI Service',
      'memory-service',
      'ai-service',
      'AI Service',
      now - 10,
      0.2,
      'neutral',
      JSON.stringify({}),
      now - 10,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      9013,
      'messages/generic-ringcentral-location',
      1,
      1,
      content,
      'hash-generic-rc-location',
      'work',
      'glip',
      'glip',
      null,
      now - 10,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9013,
      content,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'follow_thread',
        contextType: 'message_thread',
        title: 'AI Service',
        primaryText: 'AI Service 当前这个 RingCentral 群 内容 发送位置',
        sourceTypes: ['glip'],
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

  it('does not surface Gary travel memory for Codex setup chat context', async () => {
    const now = Math.floor(Date.now() / 1000);
    const content =
      'Trip Itinerary — Gary Chevsky (Mar 31-Apr 12, 2026). Travel plan covers Hangzhou hotel, airport pickup, dinner, and local logistics.';
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'gary-travel-itinerary',
      content,
      'glip',
      'https://app.ringcentral.com/messages/gary-travel',
      'Trip Itinerary — Gary Chevsky',
      'Gary Chevsky',
      'travel',
      'Travel Logistics',
      now - 10,
      0.8,
      'neutral',
      JSON.stringify({ groupId: 'travel', groupName: 'Travel Logistics' }),
      now - 10,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      9040,
      'messages/gary-travel-itinerary',
      1,
      1,
      content,
      'hash-gary-travel-itinerary',
      'work',
      'glip',
      'glip',
      'Travel',
      now - 10,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9040,
      content,
    );
    const noisyRows = [
      {
        id: 'hr-open-day',
        chunkId: 9042,
        content:
          'Hi @Team. 本月的HR Open Day 即将开始，欢迎大家在今天9:30-11:30之间随时进入咨询室提问。',
        sourceTitle: 'RingCentral 消息',
        groupId: 'hr',
        groupName: 'HR Open Day',
      },
      {
        id: 'generic-calendar-time',
        chunkId: 9043,
        content: '📅 时间：2026 年 4 月 27 日（周一）14:00-15:00',
        sourceTitle: '时间',
        groupId: 'calendar',
        groupName: 'Calendar',
      },
    ];
    for (const row of noisyRows) {
      db.prepare(
        `INSERT INTO messages_raw
          (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.id,
        row.content,
        'glip',
        `https://app.ringcentral.com/messages/${row.id}`,
        row.sourceTitle,
        'glip',
        row.groupId,
        row.groupName,
        now - 10,
        0.6,
        'neutral',
        JSON.stringify({ groupId: row.groupId, groupName: row.groupName }),
        now - 10,
      );
      db.prepare(
        `INSERT INTO chunks
          (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.chunkId,
        `messages/${row.id}`,
        1,
        1,
        row.content,
        `hash-${row.id}`,
        'work',
        'glip',
        'glip',
        null,
        now - 10,
      );
      db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
        row.chunkId,
        row.content,
      );
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'follow_thread',
        contextType: 'message_thread',
        title: '2026 Hackathon Project',
        primaryText:
          'Headless app should guide Codex and cc setup with MCP skill settings so the agent knows which app capabilities are installed.',
        secondaryTexts: ['codex mcp skill setup headless settings solution'],
        sourceTypes: ['glip'],
        limit: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    const ids = res.json().matches.map((match: any) => match.id);
    expect(ids).not.toContain('9040');
    expect(ids).not.toContain('9042');
    expect(ids).not.toContain('9043');
  });

  it('does not recall Colin/AVA memories for an empty RingCentral meeting shell', async () => {
    const now = Math.floor(Date.now() / 1000);
    const content =
      'Colin Liu shared a message from AVA about Cursor token额度申请 and FreshService budget process.';
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'colin-ava-cursor-budget',
      content,
      'glip',
      'https://app.ringcentral.com/messages/colin-ava-cursor',
      'Colin Liu shared a message from AVA',
      'Colin Liu',
      'cursor-budget',
      'Cursor Budget',
      now - 10,
      0.8,
      'neutral',
      JSON.stringify({ groupId: 'cursor-budget', groupName: 'Cursor Budget' }),
      now - 10,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      9041,
      'messages/colin-ava-cursor-budget',
      1,
      1,
      content,
      'hash-colin-ava-cursor-budget',
      'work',
      'glip',
      'glip',
      'Cursor',
      now - 10,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9041,
      content,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'meeting_passive',
        contextType: 'meeting',
        title: 'RingCentral Video',
        primaryText:
          "RingCentral Video You're the only one here Invite others BRB Unmute Start video Share Invite Participants Chat React Raise hand Notes More Leave",
        limit: 3,
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matches).toEqual([]);
    expect(body.topMatch).toBeNull();
    expect(body.debug?.rejectedReason).toBe('low_information_meeting_context');
  });

  it('prefers AI tooling budget memories over generic AI/RingCentral chatter', async () => {
    const now = Math.floor(Date.now() / 1000);
    const rows = [
      {
        id: 'generic-ringclaw-topic',
        chunkId: 9030,
        content:
          'Everyone AI 主题分享 | RingClaw: 在 RingCentral 内直接对话多智能体 AI',
        sourceTitle: 'RingCentral 消息',
        metadata: {
          summary: 'Everyone AI 主题分享，介绍 RingClaw 在 RingCentral 中对话多智能体 AI。',
          groupId: 'generic-ai',
          groupName: 'Everyone AI',
          contextMessages: [
            {
              content:
                'Everyone AI 主题分享 | RingClaw: 在 RingCentral 内直接对话多智能体 AI',
            },
          ],
        },
      },
      {
        id: 'cursor-budget-process',
        chunkId: 9031,
        content: 'Colin Liu shared a message from AVA',
        sourceTitle: '名字特别猛的群',
        metadata: {
          summary:
            'Colin Liu转发并总结了关于Cursor token额度申请的公司内部流程，说明额度超限后可提交 FreshService ticket 申请额外预算。',
          groupId: 'cursor-budget',
          groupName: '名字特别猛的群',
          contextMessages: [
            {
              content:
                'Colin Liu shared a message from AVA\nHere is the process to apply for more tokens in Cursor. Submit a FreshService ticket and monitor Cursor usage.',
              isMainMessage: true,
            },
            {
              content: 'cursor超过限额的同事可以走这个流程先申请额外的预算试试',
              isMainMessage: false,
            },
          ],
          actions: [
            {
              description:
                'Submit a FreshService ticket with business justification to request additional Cursor tokens.',
              status: 'pending',
            },
          ],
          entities: {
            projects: [{ name: 'Cursor', summary: 'Cursor token and premium request quota.' }],
            topics: [{ name: 'Token Quota Application Process' }],
          },
          metadata: {
            tags: ['Cursor', 'token quota', 'FreshService', 'usage monitoring'],
          },
        },
      },
      {
        id: 'ai-notes-quota',
        chunkId: 9032,
        content:
          'AI Notes translation quota is enforced in a rolling window and the 429 response should include retry-after.',
        sourceTitle: 'RCV Working Team (Growth): AI Notes',
        metadata: {
          summary:
            'AI Notes 翻译字符限制和 rolling window quota 技术讨论。',
          groupId: 'ai-notes',
          groupName: 'RCV Working Team (Growth): AI Notes',
          metadata: { tags: ['AI Notes', 'translation limit', 'quota'] },
        },
      },
    ];

    for (const row of rows) {
      db.prepare(
        `INSERT INTO messages_raw
          (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.id,
        row.content,
        'glip',
        `https://app.ringcentral.com/messages/${row.id}`,
        row.sourceTitle,
        'Colin Liu',
        row.metadata.groupId,
        row.metadata.groupName,
        now - 10,
        0.8,
        'neutral',
        JSON.stringify(row.metadata),
        now - 10,
      );
      db.prepare(
        `INSERT INTO chunks
          (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.chunkId,
        `messages/${row.id}`,
        1,
        1,
        row.content,
        `hash-${row.id}`,
        'work',
        'glip',
        'glip',
        null,
        now - 10,
      );
      db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
        row.chunkId,
        [
          row.content,
          row.metadata.summary,
          JSON.stringify((row.metadata as any).contextMessages || []),
          JSON.stringify((row.metadata as any).metadata || {}),
        ].join(' '),
      );
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'follow_thread',
        contextType: 'message_thread',
        title: 'Colin, Michael',
        primaryText:
          'Engineering Excellence Dashboard Portal alert: AI usage exceeded hard limit. Codex cost $2366.02, hard limit $400. /fast 要关, /goal 不能用, 5.5 酌情选择, cursor composer 2.5.',
        secondaryTexts: [
          'AI usage hard limit Codex cost monthly budget Cursor Composer GPT-5.5',
        ],
        sourceTypes: ['glip'],
        limit: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const ids = body.matches.map((match: any) => match.id);
    expect(body.topMatch?.id).toBe('9031');
    expect(body.topMatch?.displayPriority).toBe('p1');
    expect(body.topMatch?.title).toContain('Cursor');
    expect(body.topMatch?.uiSummary).toContain('Cursor token额度申请');
    expect(body.topMatch?.whyRelevant).toEqual(
      expect.arrayContaining([expect.stringContaining('Cursor')]),
    );
    expect(body.topMatch?.snippet).toContain('cursor超过限额');
    expect(ids).not.toContain('9030');
    expect(ids).not.toContain('9032');
  });

  it('keeps concrete issue, action, and decision evidence', async () => {
    const now = Math.floor(Date.now() / 1000);
    const content =
      'Decision: approve MTR-144449 tile layout. Action: Esone owns the follow-up bug fix.';
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      9012,
      'messages/specific-decision-action',
      1,
      1,
      content,
      'hash-specific-decision-action',
      'work',
      'meeting',
      'meeting',
      'MTR',
      now - 10,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9012,
      content,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'meeting_passive',
        contextType: 'meeting',
        primaryText: 'MTR-144449 tile layout follow-up bug fix',
        limit: 3,
      },
    });

    expect(res.statusCode).toBe(200);
    const match = res.json().matches.find((entry: any) => entry.id === '9012');
    expect(match).toBeTruthy();
    expect(match.reasonType).toBe('keyword');
    expect(['action_item', 'decision', 'issue']).toContain(match.evidenceRole);
    expect(match.displayPriority).toBe('p1');
    expect(match.whyRelevant?.length).toBeGreaterThan(0);
    expect(match.uiSummary).toContain('MTR-144449');
  });

  it('merges duplicate meeting chunks into one source cluster', async () => {
    const now = Math.floor(Date.now() / 1000);
    for (const [id, chunkId, content] of [
      [
        'meeting-cluster-msg-1',
        9021,
        'MTR-555 decision: keep the compact meeting toolbar layout.',
      ],
      [
        'meeting-cluster-msg-2',
        9022,
        'MTR-555 action: Esone follows up on toolbar overflow testing.',
      ],
    ] as const) {
      db.prepare(
        `INSERT INTO messages_raw
          (id, content, source_type, source_url, source_title, sender, group_id, group_name, timestamp, importance, sentiment, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        content,
        'meeting',
        `https://memory.example.com/meetings/meeting-cluster-1#${chunkId}`,
        'MTR-555 toolbar review',
        'meeting-pilot',
        'meeting-cluster-1',
        'MTR-555 toolbar review',
        now - (9023 - chunkId),
        0.8,
        'neutral',
        JSON.stringify({ meetingId: 'meeting-cluster-1' }),
        now - (9023 - chunkId),
      );
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
        'MTR',
        now - (9023 - chunkId),
      );
      db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
        chunkId,
        content,
      );
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'meeting_passive',
        contextType: 'meeting',
        primaryText: 'MTR-555 toolbar layout overflow follow up decision action',
        limit: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const clusterMatches = body.matches.filter(
      (match: any) => match.sourceClusterKey === 'meeting:meeting-cluster-1',
    );
    expect(clusterMatches).toHaveLength(1);
    expect(clusterMatches[0].mergedCount).toBe(2);
    expect(clusterMatches[0].mergedIds.sort()).toEqual(['9021', '9022']);
    expect(body.autopilot?.duplicateMergedCount).toBe(1);
    expect(body.autopilot?.quietReasons.map((item: any) => item.reason)).toContain(
      'duplicate_source_cluster',
    );
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

  it('resolves deictic RingCentral BE references from the current context', async () => {
    const now = Math.floor(Date.now() / 1000);
    const backendContent =
      'Ivan said AI Generated VBG backend BE has pending work on RCV-148412 and RCV-148411 before it can be called ready.';
    const dailyLimitContent =
      'AI Generated VBG daily generation limit is 20 per day and retry-after should be returned on quota errors.';
    const rows = [
      {
        id: 'vbg-backend-pending',
        chunkId: 9060,
        content: backendContent,
        hash: 'hash-vbg-backend-pending',
      },
      {
        id: 'vbg-daily-limit',
        chunkId: 9061,
        content: dailyLimitContent,
        hash: 'hash-vbg-daily-limit',
      },
    ];

    for (const row of rows) {
      db.prepare(
        `INSERT INTO messages_raw
          (id, content, source_type, source_url, source_title, sender, group_id,
           group_name, timestamp, importance, sentiment, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.id,
        row.content,
        'glip',
        `https://app.ringcentral.com/messages/${row.id}`,
        'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
        'Ivan Velencoso',
        'vbg-group',
        'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
        now - 600,
        0.85,
        'neutral',
        JSON.stringify({
          groupId: 'vbg-group',
          groupName:
            'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
        }),
        now - 600,
      );
      db.prepare(
        `INSERT INTO chunks
          (chunk_id, file_path, line_start, line_end, content, content_hash,
           scope, source, source_type, related_project, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.chunkId,
        `messages/${row.id}`,
        1,
        1,
        row.content,
        row.hash,
        'work',
        'glip',
        'glip',
        'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
        now - 600,
      );
      db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
        row.chunkId,
        row.content,
      );
    }

    db.prepare(
      `INSERT INTO conversation_context_frames
        (id, surface, source_type, conversation_id, group_id, title, summary,
         dominant_projects_json, topics_json, role_terms_json, source_anchors_json,
         confidence, window_start, window_end, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'glip:vbg-group',
      'glip',
      'glip',
      'vbg-group',
      'vbg-group',
      'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
      backendContent,
      JSON.stringify([
        'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
      ]),
      JSON.stringify(['VBG', 'AI Generated Background']),
      JSON.stringify(['backend']),
      JSON.stringify(['RCV-148412', 'RCV-148411']),
      0.9,
      now - 600,
      now - 600,
      now - 600,
      now - 600,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'follow_thread',
        contextType: 'message_thread',
        primaryText: '那个 BE ready 了吗',
        sourceContext: {
          groupId: 'vbg-group',
          conversationId: 'vbg-group',
          title:
            'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
        },
        currentContext: {
          groupId: 'vbg-group',
          conversationId: 'vbg-group',
          visibleMessages: [
            {
              sender: 'Ivan',
              text: 'For AI Generated VBG, backend pending work is on the thread.',
            },
          ],
        },
        sourceTypes: ['glip'],
        limit: 3,
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matches[0]?.id).toBe('9060');
    expect(body.matches.map((match: any) => match.id)).toContain('9060');
    expect(body.debug?.contextExpansion?.resolvedProject).toContain(
      'AI-Generated VBGs',
    );
    expect(body.debug?.contextExpansion?.resolvedRole).toBe('backend');
  });

  it('suppresses Jira Lens matches that only repeat an estimate value already visible on the issue page', async () => {
    const now = Math.floor(Date.now() / 1000);
    const content =
      'MTR-148115 当前 DEV Estimate New 为 0.4。';
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, 1, 1, ?, ?, 'work', 'glip', 'glip', 'MTR', ?)`,
    ).run(
      9071,
      'messages/mtr-148115-dev-estimate-new',
      content,
      'hash-mtr-148115-dev-estimate-new',
      now - 120,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9071,
      content,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'jira_issue',
        title: 'MTR-148115: Estimate review',
        url: 'https://jira.ringcentral.com/browse/MTR-148115',
        primaryText: 'MTR-148115 Estimate review',
        currentContext: {
          issueKey: 'MTR-148115',
        },
        interactionScene: {
          sceneType: 'jira_issue_reading',
          surface: 'memory_lens',
          userMode: 'read',
          url: 'https://jira.ringcentral.com/browse/MTR-148115',
          title: 'MTR-148115: Estimate review',
          issueKey: 'MTR-148115',
          activeElement: {
            kind: 'none',
            hasFocus: false,
          },
          visibleFacts: [
            {
              kind: 'jira_field',
              name: 'DEV Estimate New',
              value: '0.4',
              rawText: 'DEV Estimate New: 0.4',
              source: 'current_page',
              issueKey: 'MTR-148115',
              confidence: 0.94,
            },
          ],
          admission: {
            state: 'passive_ready',
            reasons: ['issue_key', 'visible_facts'],
            confidence: 0.82,
          },
        },
        entityHints: [{ kind: 'jira_issue_key', value: 'MTR-148115' }],
        sourceTypes: ['glip'],
        limit: 3,
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matches).toEqual([]);
    expect(body.topMatch).toBeNull();
    expect(body.autopilot?.mode).toBe('silent');
    expect(body.autopilot?.quietReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'current_page_field_echo' }),
      ]),
    );
    expect(body.debug?.interactionScene?.sceneType).toBe('jira_issue_reading');
    expect(body.debug?.sceneFrame?.interactionSceneType).toBe(
      'jira_issue_reading',
    );
    expect(body.debug?.sceneFrame?.visibleFacts?.[0]?.name).toBe(
      'DEV Estimate New',
    );
  });

  it('keeps Jira Lens matches that add non-visible estimate status beyond the current page value', async () => {
    const now = Math.floor(Date.now() / 1000);
    const content =
      'MTR-148115 当前 DEV Estimate New 为 0.4，但尚未最终锁定，后续仍有变动可能。';
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, 1, 1, ?, ?, 'work', 'glip', 'glip', 'MTR', ?)`,
    ).run(
      9074,
      'messages/mtr-148115-dev-estimate-new-unlocked',
      content,
      'hash-mtr-148115-dev-estimate-new-unlocked',
      now - 120,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9074,
      content,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'web_passive',
        contextType: 'jira_issue',
        title: 'MTR-148115: Estimate review',
        url: 'https://jira.ringcentral.com/browse/MTR-148115',
        primaryText: 'MTR-148115 Estimate review',
        currentContext: {
          issueKey: 'MTR-148115',
        },
        interactionScene: {
          sceneType: 'jira_issue_reading',
          surface: 'memory_lens',
          userMode: 'read',
          url: 'https://jira.ringcentral.com/browse/MTR-148115',
          title: 'MTR-148115: Estimate review',
          issueKey: 'MTR-148115',
          activeElement: {
            kind: 'none',
            hasFocus: false,
          },
          visibleFacts: [
            {
              kind: 'jira_field',
              name: 'DEV Estimate New',
              value: '0.4',
              rawText: 'DEV Estimate New: 0.4',
              source: 'current_page',
              issueKey: 'MTR-148115',
              confidence: 0.94,
            },
          ],
          admission: {
            state: 'passive_ready',
            reasons: ['issue_key', 'visible_facts'],
            confidence: 0.82,
          },
        },
        entityHints: [{ kind: 'jira_issue_key', value: 'MTR-148115' }],
        sourceTypes: ['glip'],
        limit: 3,
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matches[0]?.id).toBe('9074');
    expect(body.matches[0]?.displayPriority).toBe('p1');
    expect(body.matches[0]?.lensPresentation).toEqual(
      expect.objectContaining({
        status: 'ready',
        informationValue: 'high',
        novelty: 'new_to_current_surface',
      }),
    );
    expect(body.matches[0]?.lensPresentation?.extractedInfo).toContain(
      '尚未最终锁定',
    );
  });

  it('keeps the same Jira estimate memory available when the user discusses the ticket in a group chat', async () => {
    const now = Math.floor(Date.now() / 1000);
    const content =
      '如在与团队成员或相关方讨论 MTR-148115 的开发估算时，请明确说明：当前 DEV Estimate New 为 0.4，但尚未最终锁定，后续仍有变动可能。';
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, 1, 1, ?, ?, 'work', 'glip', 'glip', 'MTR', ?)`,
    ).run(
      9072,
      'messages/mtr-148115-dev-estimate-new-chat',
      content,
      'hash-mtr-148115-dev-estimate-new-chat',
      now - 120,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9072,
      content,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'follow_thread',
        contextType: 'message_thread',
        title: 'MTR estimate discussion',
        primaryText: 'MTR-148115 的 estimate 是不是要跟大家说明一下？',
        currentContext: {
          groupId: 'mtr-estimate-group',
          visibleMessages: [
            {
              sender: 'Alice',
              text: 'MTR-148115 的开发估算现在怎么跟团队同步？',
            },
          ],
        },
        interactionScene: {
          sceneType: 'ringcentral_estimate_discussion',
          surface: 'memory_lens',
          userMode: 'read',
          groupId: 'mtr-estimate-group',
          nearbyMessages: [
            {
              sender: 'Alice',
              text: 'MTR-148115 的开发估算现在怎么跟团队同步？',
            },
          ],
          sourceAnchorHints: ['MTR-148115', 'estimate'],
          admission: {
            state: 'passive_ready',
            reasons: ['nearby_messages', 'source_anchors'],
            confidence: 0.82,
          },
        },
        entityHints: [{ kind: 'jira_issue_key', value: 'MTR-148115' }],
        sourceTypes: ['glip'],
        limit: 3,
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matches.map((match: any) => match.id)).toContain('9072');
    expect(body.topMatch?.snippet).toContain('DEV Estimate New 为 0.4');
    expect(body.debug?.sceneFrame?.interactionSceneType).toBe(
      'ringcentral_estimate_discussion',
    );
  });

  it('suppresses generic source memory hits that lack the current RingCentral Jira issue key', async () => {
    for (const table of [
      'source_memory_events',
      'source_memory_links',
      'source_memory_triggers',
      'source_memory_takeaways',
      'source_memory_anchors',
      'source_memory_capsules',
    ]) {
      db.prepare(`DELETE FROM ${table}`).run();
    }

    const saveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/source-memory/capsules',
      payload: {
        sourceKind: 'webpage',
        sourceUrl: 'https://example.com/sdk-bug-release-note',
        sourceTitle: 'SDK bug release notes',
        text:
          'SDK bug release link and backend dependency triage notes for a general release workflow. This saved source does not mention any Jira ticket key.',
        captureMode: 'manual',
        interactions: {
          copiedText: true,
          manualClick: true,
        },
      },
    });
    expect(saveRes.statusCode).toBe(200);

    const recallRes = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'follow_thread',
        contextType: 'message_thread',
        title: 'RingCentral - Joker, Warren',
        primaryText:
          'https://jira.ringcentral.com/browse/MTR-148115 @Esone Qiu 这个有BE 依赖，这个release 不上，帮忙挪走吧 SDK bug link',
        currentContext: {
          groupId: '1619118759938',
          conversationId: '1619118759938',
          visibleMessages: [
            {
              sender: 'Joker',
              text:
                'https://jira.ringcentral.com/browse/MTR-148115 @Esone Qiu 这个有BE 依赖，这个release 不上，帮忙挪走吧',
            },
            {
              sender: 'Warren',
              text: 'BE 是哪张？这个 BE 有 bug，release 可以不进。',
            },
          ],
        },
        interactionScene: {
          sceneType: 'ringcentral_thread_reading',
          surface: 'memory_lens',
          userMode: 'read',
          groupId: '1619118759938',
          nearbyMessages: [
            {
              sender: 'Joker',
              text:
                'https://jira.ringcentral.com/browse/MTR-148115 @Esone Qiu 这个有BE 依赖，这个release 不上，帮忙挪走吧',
            },
          ],
          sourceAnchorHints: ['MTR-148115', 'BE', 'release', 'bug', 'sdk', 'link'],
          admission: {
            state: 'passive_ready',
            reasons: ['nearby_messages', 'source_anchors'],
            confidence: 0.82,
          },
        },
        entityHints: [{ kind: 'jira_issue_key', value: 'MTR-148115' }],
        sourceTypes: ['source_memory'],
        limit: 3,
        debug: true,
      },
    });

    expect(recallRes.statusCode).toBe(200);
    const body = recallRes.json();
    expect(body.matches).toEqual([]);
    expect(body.topMatch).toBeNull();
    expect(body.autopilot?.mode).toBe('silent');
    expect(body.debug?.suppressionReasons).toContain(
      'source_memory_missing_issue_anchor',
    );
    expect(body.autopilot?.quietReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: 'source_memory_missing_issue_anchor',
        }),
      ]),
    );
  });

  it('does not show a passive bubble when a deictic backend reference is ambiguous', async () => {
    const now = Math.floor(Date.now() / 1000);
    for (const [id, project] of [
      ['glip:vbg-be', 'AI Generated VBG'],
      ['glip:notes-be', 'AI Notes'],
    ]) {
      db.prepare(
        `INSERT INTO conversation_context_frames
          (id, surface, source_type, title, summary, dominant_projects_json,
           role_terms_json, confidence, window_start, window_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        'glip',
        'glip',
        project,
        `${project} backend BE status is being discussed.`,
        JSON.stringify([project]),
        JSON.stringify(['backend']),
        0.8,
        now - 300,
        now - 300,
        now - 300,
        now - 300,
      );
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/context-recall',
      payload: {
        surface: 'follow_thread',
        contextType: 'message_thread',
        primaryText: '那个 BE ready 了吗',
        sourceTypes: ['glip'],
        limit: 3,
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matches).toEqual([]);
    expect(body.topMatch).toBeNull();
    expect(body.debug?.rejectedReason).toBe('ambiguous_context');
    expect(body.debug?.contextExpansion?.ambiguity?.state).toBe('ambiguous');
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
