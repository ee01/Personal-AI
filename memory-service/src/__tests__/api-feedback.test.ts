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
    db.prepare('DELETE FROM memory_feedback_events').run();
    db.prepare('DELETE FROM memory_metadata').run();
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
