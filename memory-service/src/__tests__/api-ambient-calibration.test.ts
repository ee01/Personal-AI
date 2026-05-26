import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

describe('Ambient Calibration API', () => {
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
    db.prepare('DELETE FROM ambient_calibration_traces').run();
  });

  it('stores redacted compose assist calibration traces', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ambient-calibration/traces',
      payload: {
        id: 'ambient-compose-1',
        surface: 'compose_assist',
        sceneKey: 'ringcentral:group-1',
        sourceRequestId: 'composer:req-1',
        action: 'edited_before_send',
        strength: 'strong',
        polarity: 'correction',
        evidenceRefs: [
          {
            id: 'memory-1',
            type: 'message',
            title: 'Factory AI rollout',
            role: 'corrected',
            score: 0.88,
          },
        ],
        redactedDiff: {
          rawTextStored: false,
          suggestionHash: 's1',
          finalHash: 'f1',
          editDistanceBand: 'material',
        },
        privacyClass: 'sensitive_redacted',
        metadata: {
          contextType: 'message_thread',
          scenario: 'instant_message_reply',
        },
        createdAt: 1779235279812,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'ok',
      traceId: 'ambient-compose-1',
      stored: true,
    });

    const row = db
      .prepare(
        `SELECT surface, scene_key, action, strength, polarity,
                evidence_refs_json, redacted_diff_json, privacy_class
         FROM ambient_calibration_traces
         WHERE id = ?`,
      )
      .get('ambient-compose-1') as {
      surface: string;
      scene_key: string;
      action: string;
      strength: string;
      polarity: string;
      evidence_refs_json: string;
      redacted_diff_json: string;
      privacy_class: string;
    };

    expect(row.surface).toBe('compose_assist');
    expect(row.scene_key).toBe('ringcentral:group-1');
    expect(row.action).toBe('edited_before_send');
    expect(row.strength).toBe('strong');
    expect(row.polarity).toBe('correction');
    expect(row.privacy_class).toBe('sensitive_redacted');
    expect(JSON.parse(row.evidence_refs_json)).toEqual([
      {
        id: 'memory-1',
        type: 'message',
        title: 'Factory AI rollout',
        role: 'corrected',
        score: 0.88,
      },
    ]);
    expect(JSON.parse(row.redacted_diff_json)).toMatchObject({
      rawTextStored: false,
      suggestionHash: 's1',
      finalHash: 'f1',
    });
  });

  it('rejects top-level raw text fields so traces stay redacted', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ambient-calibration/traces',
      payload: {
        surface: 'compose_assist',
        sceneKey: 'ringcentral:group-1',
        action: 'sent_after_insert',
        strength: 'strong',
        polarity: 'positive',
        rawFinalText: '完整发送文本不应该进入校准 trace',
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
