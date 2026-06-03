import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

describe('Feedback API', () => {
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
    db.prepare('DELETE FROM recall_training_cases').run();
    db.prepare('DELETE FROM recall_patch_runs').run();
    db.prepare('DELETE FROM recall_relevance_patches').run();
    db.prepare('DELETE FROM memory_feedback_events').run();
    db.prepare('DELETE FROM memory_metadata').run();
    db.prepare(
      `DELETE FROM source_memory_capsules
       WHERE id LIKE 'feedback-source-%'`,
    ).run();
    db.prepare(
      `DELETE FROM messages_raw
       WHERE id LIKE 'feedback-%' OR id IN ('7001', '8001')`,
    ).run();
    db.prepare(
      `DELETE FROM chunks
       WHERE chunk_id IN (7001, 8001, 9001, 9002)`,
    ).run();
  });

  function insertMessage(id: string) {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, timestamp, created_at, scope)
       VALUES (?, ?, 'manual', ?, ?, 'work')`,
    ).run(id, `Feedback test message ${id}`, now, now);
  }

  function insertChunk(id: number) {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, created_at, scope)
       VALUES (?, ?, 1, 1, ?, ?, ?, 'work')`,
    ).run(
      id,
      `feedback/${id}.md`,
      `Feedback test chunk ${id}`,
      `feedback-hash-${id}`,
      now,
    );
  }

  function insertSourceMemoryCapsule(id: string) {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO source_memory_capsules
        (
          id, source_kind, source_url, source_title, source_host,
          source_fingerprint, capture_mode, capture_reason, status,
          scope, privacy_level, summary, content_preview,
          metadata_json, created_at, updated_at, saved_at
        )
       VALUES (?, 'webpage', ?, ?, 'example.com', ?, 'manual', 'manual_click',
         'saved', 'work', 'work', ?, ?, '{}', ?, ?, ?)`,
    ).run(
      id,
      `https://example.com/${id}`,
      `Feedback source memory ${id}`,
      `fingerprint-${id}`,
      `Feedback source memory summary ${id}`,
      `Feedback source memory preview ${id}`,
      now,
      now,
      now,
    );
  }

  it('applies recall feedback to the explicit memory target type only', async () => {
    const now = Math.floor(Date.now() / 1000);
    insertMessage('7001');
    insertChunk(7001);
    db.prepare(
      `INSERT INTO memory_metadata
        (target_type, target_id, salience_score, created_at)
       VALUES (?, ?, ?, ?), (?, ?, ?, ?)`,
    ).run(
      'message',
      '7001',
      0.5,
      now,
      'chunk',
      '7001',
      0.5,
      now,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/feedback',
      payload: {
        type: 'recall_quality',
        targetType: 'chunk',
        targetId: '7001',
        action: 'negative',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'ok',
      targetType: 'chunk',
    });

    const rows = db
      .prepare(
        `SELECT target_type, salience_score
         FROM memory_metadata
         WHERE target_id = ?
         ORDER BY target_type`,
      )
      .all('7001') as Array<{
      target_type: string;
      salience_score: number;
    }>;

    expect(rows.map((row) => row.target_type)).toEqual(['chunk', 'message']);
    expect(rows[0].salience_score).toBeCloseTo(0.35);
    expect(rows[1].salience_score).toBeCloseTo(0.5);
  });

  it('requires targetType when a feedback target id is ambiguous', async () => {
    const now = Math.floor(Date.now() / 1000);
    insertMessage('8001');
    insertChunk(8001);
    db.prepare(
      `INSERT INTO memory_metadata
        (target_type, target_id, salience_score, created_at)
       VALUES (?, ?, ?, ?), (?, ?, ?, ?)`,
    ).run(
      'message',
      '8001',
      0.5,
      now,
      'chunk',
      '8001',
      0.5,
      now,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/feedback',
      payload: {
        type: 'recall_quality',
        targetId: '8001',
        action: 'positive',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/targetType is required/);
  });

  it('keeps legacy recall feedback working for unambiguous targets', async () => {
    const now = Math.floor(Date.now() / 1000);
    insertMessage('feedback-message-only');
    db.prepare(
      `INSERT INTO memory_metadata
        (target_type, target_id, salience_score, created_at)
       VALUES (?, ?, ?, ?)`,
    ).run('message', 'feedback-message-only', 0.5, now);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/feedback',
      payload: {
        type: 'recall_quality',
        targetId: 'feedback-message-only',
        action: 'positive',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'ok',
      targetType: 'message',
    });

    const row = db
      .prepare(
        `SELECT salience_score
         FROM memory_metadata
         WHERE target_type = 'message' AND target_id = ?`,
      )
      .get('feedback-message-only') as { salience_score: number };

    expect(row.salience_score).toBeCloseTo(0.6);
  });

  it('accepts recall feedback for source memory capsules', async () => {
    insertSourceMemoryCapsule('feedback-source-capsule');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/feedback',
      payload: {
        type: 'recall_quality',
        targetType: 'source_memory',
        targetId: 'source-memory:feedback-source-capsule',
        action: 'negative',
        detail: JSON.stringify({
          surface: 'web_passive_bubble',
          scene_anchor_signature: 'selection:https://example.com/page',
        }),
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'ok',
      targetType: 'source_memory',
      appliedDelta: -0.15,
    });

    const feedback = db
      .prepare(
        `SELECT target_type, target_id, action, detail
         FROM memory_feedback_events
         WHERE target_type = 'source_memory' AND target_id = ?`,
      )
      .get('feedback-source-capsule') as
      | {
          target_type: string;
          target_id: string;
          action: string;
          detail: string;
        }
      | undefined;

    expect(feedback).toMatchObject({
      target_type: 'source_memory',
      target_id: 'feedback-source-capsule',
      action: 'negative',
    });
    expect(JSON.parse(feedback?.detail || '{}')).toMatchObject({
      surface: 'web_passive_bubble',
      scene_anchor_signature: 'selection:https://example.com/page',
    });

    const metadata = db
      .prepare(
        `SELECT salience_score
         FROM memory_metadata
         WHERE target_type = 'source_memory' AND target_id = ?`,
      )
      .get('feedback-source-capsule') as { salience_score: number };
    expect(metadata.salience_score).toBeCloseTo(0.35);
  });

  it('creates a scene-aware relevance patch and replay from negative recall feedback', async () => {
    insertChunk(9001);

    const res = await app.inject({
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
          scene_anchor_signature: 'web:https://example.com/project-falcon',
          current_url: 'https://example.com/project-falcon',
          current_title: 'Project Falcon',
          display_priority: 'p1',
          source_label: 'manual',
        }),
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.relevancePatch).toMatchObject({
      status: 'patched',
      patch: {
        status: 'active',
        targetType: 'chunk',
        targetId: '9001',
        reason: 'wrong_group_or_project',
        action: 'hide_for_scene',
        autoApplied: true,
      },
      replay: {
        changed: true,
      },
    });
    expect(body.relevancePatch.replay.after[0]).toMatchObject({
      targetType: 'chunk',
      targetId: '9001',
      displayPriority: 'hidden',
      suppressionReason: 'user_relevance_patch',
    });

    const patchCount = db
      .prepare('SELECT COUNT(*) AS count FROM recall_relevance_patches')
      .get() as { count: number };
    const replayCount = db
      .prepare('SELECT COUNT(*) AS count FROM recall_patch_runs')
      .get() as { count: number };
    const trainingCaseCount = db
      .prepare('SELECT COUNT(*) AS count FROM recall_training_cases')
      .get() as { count: number };
    expect(patchCount.count).toBe(1);
    expect(replayCount.count).toBe(1);
    expect(trainingCaseCount.count).toBe(1);
  });

  it('supports direct recall relevance patch listing and status updates', async () => {
    const feedback = await app.inject({
      method: 'POST',
      url: '/api/v1/recall/relevance-feedback',
      payload: {
        targetType: 'chunk',
        targetId: '9001',
        action: 'negative',
        reason: 'search_context_mismatch',
        scene: {
          surface: 'memory_search',
          query: 'Falcon launch',
        },
      },
    });

    expect(feedback.statusCode).toBe(200);
    const feedbackBody = feedback.json();
    expect(feedbackBody).toMatchObject({
      ok: true,
      result: {
        status: 'patched',
        patch: {
          status: 'active',
          targetType: 'chunk',
          targetId: '9001',
        },
      },
    });
    const patchId = feedbackBody.result.patch.id;

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/recall/relevance-patches?status=active',
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().items.map((item: any) => item.id)).toContain(patchId);

    const paused = await app.inject({
      method: 'PATCH',
      url: `/api/v1/recall/relevance-patches/${patchId}`,
      payload: { status: 'paused' },
    });
    expect(paused.statusCode).toBe(200);
    expect(paused.json()).toMatchObject({
      status: 'ok',
      patch: {
        id: patchId,
        status: 'paused',
      },
    });
  });

  it('does not amplify salience when the same recall feedback is submitted twice', async () => {
    const now = Math.floor(Date.now() / 1000);
    insertMessage('feedback-idempotent');
    db.prepare(
      `INSERT INTO memory_metadata
        (target_type, target_id, salience_score, created_at)
       VALUES ('message', ?, 0.5, ?)`,
    ).run('feedback-idempotent', now);

    for (let index = 0; index < 2; index += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/feedback',
        payload: {
          type: 'recall_quality',
          targetType: 'message',
          targetId: 'feedback-idempotent',
          action: 'positive',
        },
      });
      expect(res.statusCode).toBe(200);
    }

    const row = db
      .prepare(
        `SELECT salience_score
         FROM memory_metadata
         WHERE target_type = 'message' AND target_id = ?`,
      )
      .get('feedback-idempotent') as { salience_score: number };
    const events = db
      .prepare(
        `SELECT action
         FROM memory_feedback_events
         WHERE target_type = 'message' AND target_id = ?`,
      )
      .all('feedback-idempotent') as Array<{ action: string }>;

    expect(row.salience_score).toBeCloseTo(0.6);
    expect(events).toEqual([{ action: 'positive' }]);
  });

  it('applies only the net salience delta when recall feedback is changed', async () => {
    const now = Math.floor(Date.now() / 1000);
    insertMessage('feedback-change');
    db.prepare(
      `INSERT INTO memory_metadata
        (target_type, target_id, salience_score, created_at)
       VALUES ('message', ?, 0.5, ?)`,
    ).run('feedback-change', now);

    await app.inject({
      method: 'POST',
      url: '/api/v1/feedback',
      payload: {
        type: 'recall_quality',
        targetType: 'message',
        targetId: 'feedback-change',
        action: 'positive',
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/feedback',
      payload: {
        type: 'recall_quality',
        targetType: 'message',
        targetId: 'feedback-change',
        action: 'negative',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'ok',
      targetType: 'message',
      previousAction: 'positive',
      appliedDelta: -0.25,
    });

    const row = db
      .prepare(
        `SELECT salience_score
         FROM memory_metadata
         WHERE target_type = 'message' AND target_id = ?`,
      )
      .get('feedback-change') as { salience_score: number };
    expect(row.salience_score).toBeCloseTo(0.35);
  });

  it('clears recall feedback and rolls back the previous salience delta', async () => {
    const now = Math.floor(Date.now() / 1000);
    insertMessage('feedback-clear');
    db.prepare(
      `INSERT INTO memory_metadata
        (target_type, target_id, salience_score, created_at)
       VALUES ('message', ?, 0.5, ?)`,
    ).run('feedback-clear', now);

    await app.inject({
      method: 'POST',
      url: '/api/v1/feedback',
      payload: {
        type: 'recall_quality',
        targetType: 'message',
        targetId: 'feedback-clear',
        action: 'positive',
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/feedback',
      payload: {
        type: 'recall_quality',
        targetType: 'message',
        targetId: 'feedback-clear',
        action: 'clear',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'ok',
      targetType: 'message',
      previousAction: 'positive',
      appliedDelta: -0.1,
    });

    const row = db
      .prepare(
        `SELECT salience_score
         FROM memory_metadata
         WHERE target_type = 'message' AND target_id = ?`,
      )
      .get('feedback-clear') as { salience_score: number };
    const events = db
      .prepare(
        `SELECT action
         FROM memory_feedback_events
         WHERE target_type = 'message' AND target_id = ?`,
      )
      .all('feedback-clear') as Array<{ action: string }>;

    expect(row.salience_score).toBeCloseTo(0.5);
    expect(events).toEqual([]);
  });

  it('rejects recall feedback for missing memory targets', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/feedback',
      payload: {
        type: 'recall_quality',
        targetType: 'message',
        targetId: 'feedback-missing',
        action: 'positive',
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/not found/);
  });
});
