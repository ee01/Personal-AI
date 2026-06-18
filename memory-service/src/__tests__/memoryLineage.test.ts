/**
 * Tests for P2-10 MemoryLineageService: cascade cleanup of derived provenance
 * (entity_properties, relationship evidence, profile items, reflections) on
 * explicit deletion — the Agentic Unlearning re-pollution defense.
 */

import { getTestDb, cleanupTestDb } from './setup.js';
import { MemoryLineageService } from '../core/MemoryLineageService.js';
import { now } from '../utils/time.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeAll(() => {
  db = getTestDb();
});
afterAll(() => {
  cleanupTestDb();
});
beforeEach(() => {
  for (const t of [
    'messages_raw',
    'entities',
    'entity_properties',
    'relationships',
    'user_profile_items',
    'reflection_artifacts',
  ]) {
    try {
      db.prepare(`DELETE FROM ${t}`).run();
    } catch {
      /* ignore */
    }
  }
});

describe('MemoryLineageService.applyCascade', () => {
  it('cleans orphan properties, trims/deletes relationship evidence, archives orphan entity', () => {
    const ts = now();
    db.prepare(`INSERT INTO messages_raw (id, content, source_type, timestamp, created_at) VALUES ('m1','x','web',?,?)`).run(ts, ts);
    db.prepare(`INSERT INTO entities (id, type, name, mention_count, status, created_at) VALUES ('e1','Person','X',1,'active',?)`).run(ts);
    db.prepare(
      `INSERT INTO entity_properties (entity_id, property_key, property_value, source_message_id, tx_start, status)
       VALUES ('e1','role','lead','m1',?,'active')`,
    ).run(ts);
    db.prepare(
      `INSERT INTO relationships (from_entity_id, to_entity_id, relation_type, evidence_message_ids_json, created_at)
       VALUES ('e1','e1','mentions', ?, ?)`,
    ).run(JSON.stringify(['m1']), ts);

    const receipt = new MemoryLineageService(db).applyCascade(['m1']);
    expect(receipt.entityProperties).toBe(1);
    expect(receipt.orphansArchived.relationships).toBe(1); // evidence emptied -> deleted
    expect(receipt.orphansArchived.entities).toBe(1); // no props/rels left -> archived

    expect(db.prepare(`SELECT COUNT(*) AS c FROM entity_properties`).get()).toMatchObject({ c: 0 });
    expect(db.prepare(`SELECT status FROM entities WHERE id='e1'`).get()).toMatchObject({ status: 'archived' });
  });

  it('retracts a reflection whose entire evidence set was deleted (re-pollution defense)', () => {
    const ts = now();
    db.prepare(`INSERT INTO messages_raw (id, content, source_type, timestamp, created_at) VALUES ('mp','人事变动','web',?,?)`).run(ts, ts);
    db.prepare(
      `INSERT INTO reflection_artifacts (id, scope, summary, source_message_ids_json, created_at)
       VALUES ('r1','daily','…私人对话中提到 X 决定离职…', ?, ?)`,
    ).run(JSON.stringify(['mp']), ts);

    const receipt = new MemoryLineageService(db).applyCascade(['mp']);
    expect(receipt.recompute.reflectionsRetracted).toBe(1);
    const art = db.prepare(`SELECT evidence_redacted, retracted FROM reflection_artifacts WHERE id='r1'`).get() as {
      evidence_redacted: number;
      retracted: number;
    };
    expect(art.retracted).toBe(1);
  });

  it('demotes an inferred profile item below the evidence floor', () => {
    const ts = now();
    db.prepare(`INSERT INTO messages_raw (id, content, source_type, timestamp, created_at) VALUES ('pm','x','web',?,?)`).run(ts, ts);
    db.prepare(
      `INSERT INTO user_profile_items
         (id, item_type, item_key, item_value, evidence_refs, source_kind, confidence, user_confirmed,
          status, salience_score, mention_count, last_seen, created_at, updated_at, fingerprint)
       VALUES ('p1','preference','focus','x', ?, 'inferred', 0.7, 0, 'active', 0.5, 1, ?, ?, ?, 'fp1')`,
    ).run(JSON.stringify([{ message_id: 'pm' }]), ts, ts, ts);

    const receipt = new MemoryLineageService(db).applyCascade(['pm']);
    expect(receipt.recompute.profileDemoted).toBe(1);
    const item = db.prepare(`SELECT status, evidence_refs FROM user_profile_items WHERE id='p1'`).get() as {
      status: string;
      evidence_refs: string;
    };
    expect(item.status).toBe('archived'); // evidence emptied
  });

  it('integrityScan finds orphan entity_properties left by a non-cascading delete', () => {
    const ts = now();
    db.prepare(`INSERT INTO entities (id, type, name, status, created_at) VALUES ('e9','Person','Y','active',?)`).run(ts);
    db.prepare(
      `INSERT INTO entity_properties (entity_id, property_key, property_value, source_message_id, tx_start, status)
       VALUES ('e9','role','x','deleted-msg',?,'active')`,
    ).run(ts);
    const scan = new MemoryLineageService(db).integrityScan();
    expect(scan.orphanEntityProperties).toBeGreaterThanOrEqual(1);
  });
});
