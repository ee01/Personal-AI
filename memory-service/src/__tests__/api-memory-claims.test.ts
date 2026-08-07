import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type BetterSqlite3 from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../server.js';
import { MemoryClaimRepository } from '../repositories/MemoryClaimRepository.js';
import type { MemoryClaimEnvelope } from '../types/index.js';
import { getTestDb } from './setup.js';

const MESSAGE_ID = 'api-memory-claim-message';
const CLAIM_ID = 'api-memory-claim';
const PROFILE_ID = 'api-memory-claim-profile';
const ENTITY_ID = 'api-memory-claim-entity';
const ENTITY_PROPERTY_ID = 9_580_001;
const OPINION_ID = 'api-memory-claim-opinion';
const CHANGE_EVENT_ID = 'api-memory-claim-change-event';
const ACTION_ID = 'api-memory-claim-action';
const RAW_CONTENT =
  'Alice said: “I dislike long status meetings.” I am only quoting her; this is not my view.';
const SOURCE_TEXT = 'I dislike long status meetings.';
const TIMESTAMP = 1_780_100_000;

function originalClaim(): MemoryClaimEnvelope {
  const start = RAW_CONTENT.indexOf(SOURCE_TEXT);
  return {
    id: CLAIM_ID,
    sourceMessageId: MESSAGE_ID,
    sourceSpan: {
      start,
      end: start + SOURCE_TEXT.length,
      textHash: 'api-memory-claim-span-hash',
    },
    sourceText: SOURCE_TEXT,
    normalizedClaim: 'The user dislikes long status meetings.',
    owner: { kind: 'self' },
    speechMode: 'direct_assertion',
    polarity: 'affirmed',
    timeBasis: 'current',
    verification: 'unverified',
    commitment: 'none',
    confidence: 0.82,
    signals: ['message_role'],
    policy: {
      profileCandidate: false,
      currentTruthCandidate: true,
      actionCandidate: false,
      passiveRecall: 'allow',
    },
    revision: 1,
    status: 'active',
    corrected: false,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

describe('Memory claim correction API', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;
  let repository: MemoryClaimRepository;

  beforeAll(async () => {
    db = getTestDb();
    repository = new MemoryClaimRepository(db);
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    db.prepare('DELETE FROM memory_claim_links WHERE claim_id = ?').run(CLAIM_ID);
    db.prepare('DELETE FROM memory_claim_revisions WHERE claim_id = ?').run(
      CLAIM_ID,
    );
    db.prepare('DELETE FROM memory_claims WHERE id = ?').run(CLAIM_ID);
    db.prepare('DELETE FROM messages_raw WHERE id = ?').run(MESSAGE_ID);
    db.prepare('DELETE FROM user_profile_items WHERE id = ?').run(PROFILE_ID);
    db.prepare('DELETE FROM entity_properties WHERE id = ?').run(
      ENTITY_PROPERTY_ID,
    );
    db.prepare('DELETE FROM opinion_items WHERE id = ?').run(OPINION_ID);
    db.prepare('DELETE FROM memory_change_events WHERE id = ?').run(
      CHANGE_EVENT_ID,
    );
    db.prepare('DELETE FROM proposed_actions WHERE id = ?').run(ACTION_ID);
    db.prepare('DELETE FROM entities WHERE id = ?').run(ENTITY_ID);
    db.prepare(
      `UPDATE profile_sync_state
       SET profile_dirty = 0
       WHERE id = 'singleton'`,
    ).run();
  });

  function seedClaim(): MemoryClaimEnvelope {
    db.prepare(
      `INSERT INTO messages_raw
         (id, content, source_type, sender, timestamp, created_at)
       VALUES (?, ?, 'glip', 'alice', ?, ?)`,
    ).run(MESSAGE_ID, RAW_CONTENT, TIMESTAMP, TIMESTAMP);

    const claim = originalClaim();
    repository.replaceActiveClaims(MESSAGE_ID, [claim], 'test-resolver-v1');
    return claim;
  }

  function seedDerivedTargets(): void {
    db.prepare(
      `INSERT INTO user_profile_items (
         id, item_type, item_key, item_value, evidence_refs, source_kind,
         confidence, user_confirmed, status, salience_score, mention_count,
         last_seen, created_at, updated_at, fingerprint
       ) VALUES (?, 'preference', 'meeting_style', 'dislikes long status meetings',
         '[]', 'inferred', 0.82, 0, 'active', 0.7, 1, ?, ?, ?, ?)`,
    ).run(PROFILE_ID, TIMESTAMP, TIMESTAMP, TIMESTAMP, `${PROFILE_ID}-fingerprint`);

    db.prepare(
      `INSERT INTO entities
         (id, type, name, status, created_at)
       VALUES (?, 'Person', 'Alice', 'active', ?)`,
    ).run(ENTITY_ID, TIMESTAMP);

    db.prepare(
      `INSERT INTO entity_properties (
         id, entity_id, property_key, property_value, source_message_id,
         tx_start, status
       ) VALUES (?, ?, 'meeting_style', 'dislikes long status meetings', ?, ?, 'active')`,
    ).run(ENTITY_PROPERTY_ID, ENTITY_ID, MESSAGE_ID, TIMESTAMP);

    db.prepare(
      `INSERT INTO opinion_items (
         id, target_entity_id, dimension, valence, intensity, confidence,
         user_confirmed, status, created_at, updated_at
       ) VALUES (?, ?, 'collaboration', -0.6, 0.7, 0.82, 0, 'active', ?, ?)`,
    ).run(OPINION_ID, ENTITY_ID, TIMESTAMP, TIMESTAMP);

    db.prepare(
      `INSERT INTO memory_change_events (
         id, chain_key, subject_key, subject_label, subject_kind,
         property_key, property_label, new_value_json, event_kind,
         authority_role, confidence, source_ref_type, source_ref_id,
         observed_at, captured_at, active, is_reversal, input_hash,
         event_fingerprint, created_at, updated_at
       ) VALUES (?, 'chain:meeting-style', ?, 'Alice', 'person',
         'meeting_style', 'Meeting style', '"dislikes long status meetings"',
         'set', 'self', 0.82, 'message', ?, ?, ?, 1, 0,
         'api-memory-claim-input-hash', 'api-memory-claim-event-fingerprint', ?, ?)`,
    ).run(
      CHANGE_EVENT_ID,
      ENTITY_ID,
      MESSAGE_ID,
      TIMESTAMP,
      TIMESTAMP,
      TIMESTAMP,
      TIMESTAMP,
    );

    db.prepare(
      `INSERT INTO proposed_actions
         (id, type, title, state, created_at)
       VALUES (?, 'suggestion', 'Shorten the weekly status meeting', 'pending', ?)`,
    ).run(ACTION_ID, TIMESTAMP);

    repository.linkDerived(CLAIM_ID, 'profile_item', PROFILE_ID, 'evidence');
    repository.linkDerived(
      CLAIM_ID,
      'entity_property',
      ENTITY_PROPERTY_ID,
      'evidence',
    );
    repository.linkDerived(CLAIM_ID, 'opinion_item', OPINION_ID, 'evidence');
    repository.linkDerived(
      CLAIM_ID,
      'memory_change_event',
      CHANGE_EVENT_ID,
      'evidence',
    );
    repository.linkDerived(
      CLAIM_ID,
      'proposed_action',
      ACTION_ID,
      'evidence',
    );
  }

  async function correct(payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/memory-claims/${CLAIM_ID}/corrections`,
      payload,
    });
  }

  it('persists a correction revision, invalidates derived memories, and never mutates raw content', async () => {
    const before = seedClaim();
    seedDerivedTargets();

    const response = await correct({
      correction: 'not_my_view',
      expectedRevision: 1,
      source: 'memory_lens',
      idempotencyKey: 'not-my-view-0001',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      claimId: CLAIM_ID,
      previous: before,
      current: {
        id: CLAIM_ID,
        owner: { kind: 'unknown' },
        speechMode: 'reported_speech',
        commitment: 'none',
        confidence: 1,
        revision: 2,
        corrected: true,
        policy: {
          profileCandidate: false,
          currentTruthCandidate: false,
          actionCandidate: false,
          passiveRecall: 'block',
        },
      },
      revision: 2,
      invalidatedDerived: {
        profile_item: 1,
        entity_property: 1,
        opinion_item: 1,
        memory_change_event: 1,
        proposed_action: 1,
      },
      recomputeStatus: 'required',
      rawSourceChanged: false,
    });

    expect(repository.getClaim(CLAIM_ID)).toMatchObject({
      owner: { kind: 'unknown' },
      speechMode: 'reported_speech',
      revision: 2,
      corrected: true,
    });
    expect(
      db
        .prepare(
          `SELECT revision, correction, correction_source,
                  idempotency_key, invalidated_derived_json, undone_at
           FROM memory_claim_revisions
           WHERE claim_id = ?`,
        )
        .get(CLAIM_ID),
    ).toMatchObject({
      revision: 2,
      correction: 'not_my_view',
      correction_source: 'memory_lens',
      idempotency_key: 'not-my-view-0001',
      undone_at: null,
    });

    expect(
      db.prepare('SELECT status FROM user_profile_items WHERE id = ?').get(PROFILE_ID),
    ).toEqual({ status: 'retracted' });
    expect(
      db.prepare('SELECT status, tx_end FROM entity_properties WHERE id = ?').get(
        ENTITY_PROPERTY_ID,
      ),
    ).toMatchObject({ status: 'retracted', tx_end: expect.any(Number) });
    expect(
      db.prepare('SELECT status FROM opinion_items WHERE id = ?').get(OPINION_ID),
    ).toEqual({ status: 'retracted' });
    expect(
      db.prepare('SELECT active FROM memory_change_events WHERE id = ?').get(
        CHANGE_EVENT_ID,
      ),
    ).toEqual({ active: 0 });
    expect(
      db.prepare('SELECT state FROM proposed_actions WHERE id = ?').get(ACTION_ID),
    ).toEqual({ state: 'dismissed' });
    expect(
      db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM memory_claim_links
           WHERE claim_id = ? AND status = 'invalidated'`,
        )
        .get(CLAIM_ID),
    ).toEqual({ count: 5 });
    expect(
      db
        .prepare(
          `SELECT profile_dirty
           FROM profile_sync_state
           WHERE id = 'singleton'`,
        )
        .get(),
    ).toEqual({ profile_dirty: 1 });

    const rawMessage = db
      .prepare('SELECT content FROM messages_raw WHERE id = ?')
      .get(MESSAGE_ID) as { content: string };
    expect(rawMessage.content).toBe(RAW_CONTENT);
  });

  it('replays an idempotent correction and rejects a stale expected revision with 409', async () => {
    seedClaim();
    const request = {
      correction: 'not_my_view',
      expectedRevision: 1,
      source: 'api',
      idempotencyKey: 'idempotent-correction-0001',
    };

    const first = await correct(request);
    const replay = await correct(request);

    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(first.json());
    expect(
      db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM memory_claim_revisions
           WHERE claim_id = ?`,
        )
        .get(CLAIM_ID),
    ).toEqual({ count: 1 });

    const conflict = await correct({
      correction: 'hypothesis',
      expectedRevision: 1,
      source: 'api',
      idempotencyKey: 'stale-revision-correction-0001',
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({
      expectedRevision: 1,
      currentRevision: 2,
    });
    expect(repository.getClaim(CLAIM_ID)?.revision).toBe(2);

    const reusedKey = await correct({
      ...request,
      correction: 'my_decision',
    });
    expect(reusedKey.statusCode).toBe(400);
    expect(repository.getClaim(CLAIM_ID)?.revision).toBe(2);
  });

  it('undo_last restores the prior attribution as a new revision while preserving the raw message', async () => {
    const original = seedClaim();
    const correction = await correct({
      correction: 'hypothesis',
      expectedRevision: 1,
      source: 'ask_receipt',
      idempotencyKey: 'hypothesis-correction-0001',
    });
    expect(correction.statusCode).toBe(200);
    expect(correction.json().current).toMatchObject({
      speechMode: 'hypothesis',
      polarity: 'uncertain',
      timeBasis: 'hypothetical',
      revision: 2,
    });

    const undo = await correct({
      correction: 'undo_last',
      expectedRevision: 2,
      source: 'ask_receipt',
      idempotencyKey: 'undo-correction-0001',
    });

    expect(undo.statusCode).toBe(200);
    expect(undo.json()).toMatchObject({
      claimId: CLAIM_ID,
      current: {
        owner: original.owner,
        speechMode: original.speechMode,
        polarity: original.polarity,
        timeBasis: original.timeBasis,
        verification: original.verification,
        commitment: original.commitment,
        confidence: original.confidence,
        revision: 3,
        corrected: true,
      },
      revision: 3,
      invalidatedDerived: {},
      recomputeStatus: 'not_needed',
      rawSourceChanged: false,
    });
    expect(undo.json().current.signals).toEqual(
      expect.arrayContaining(['message_role', 'user_correction']),
    );
    expect(repository.getClaim(CLAIM_ID)).toMatchObject({
      owner: original.owner,
      speechMode: original.speechMode,
      polarity: original.polarity,
      timeBasis: original.timeBasis,
      revision: 3,
    });

    const revisions = db
      .prepare(
        `SELECT revision, correction, undone_at
         FROM memory_claim_revisions
         WHERE claim_id = ?
         ORDER BY revision`,
      )
      .all(CLAIM_ID) as Array<{
      revision: number;
      correction: string;
      undone_at: number | null;
    }>;
    expect(revisions).toHaveLength(2);
    expect(revisions[0]).toMatchObject({
      revision: 2,
      correction: 'hypothesis',
      undone_at: expect.any(Number),
    });
    expect(revisions[1]).toEqual({
      revision: 3,
      correction: 'undo_last',
      undone_at: null,
    });

    const rawMessage = db
      .prepare('SELECT content FROM messages_raw WHERE id = ?')
      .get(MESSAGE_ID) as { content: string };
    expect(rawMessage.content).toBe(RAW_CONTENT);
  });
});
