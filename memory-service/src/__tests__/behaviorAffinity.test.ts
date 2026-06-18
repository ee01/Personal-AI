import BetterSqlite3 from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { BehaviorAffinityService } from '../core/BehaviorAffinityService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function freshDb(): BetterSqlite3.Database {
  const db = new BetterSqlite3(':memory:');
  db.pragma('journal_mode = WAL');
  const dir = path.resolve(__dirname, '..', 'storage', 'migrations');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      try {
        db.exec(stmt);
      } catch {
        /* tolerate */
      }
    }
  }
  return db;
}

const NOW = 1_700_000_000;
let evSeq = 0;

function addEvent(
  db: BetterSqlite3.Database,
  action: string,
  refs: unknown[],
  ageDays = 0,
): void {
  db.prepare(
    `INSERT INTO memory_outcome_events
       (id, surface, scene_key, action, polarity, strength, evidence_refs_json, created_at)
     VALUES (?, 'test', 'scene', ?, 'positive', 'medium', ?, ?)`,
  ).run(`ev-${evSeq++}`, action, JSON.stringify(refs), NOW - Math.round(ageDays * 86400));
}

function addMessage(db: BetterSqlite3.Database, id: string, sourceType: string, entityIds: string[]): void {
  db.prepare(
    `INSERT INTO messages_raw (id, content, source_type, scope, timestamp, importance, entities_json, created_at)
     VALUES (?, 'c', ?, 'work', ?, 0.5, ?, ?)`,
  ).run(id, sourceType, NOW, JSON.stringify(entityIds), NOW);
}

describe('BehaviorAffinityService (P0-4)', () => {
  let db: BetterSqlite3.Database | null = null;
  afterEach(() => {
    db?.close();
    db = null;
  });

  it('produces positive affinity for repeated strong engagement, via entity refs', () => {
    db = freshDb();
    for (let i = 0; i < 5; i++) addEvent(db, 'sent_after_insert', ['entity:e-harpreet']);
    const svc = new BehaviorAffinityService(db);
    const res = svc.recompute({ nowTs: NOW });
    expect(res.events).toBe(5);
    const map = svc.getAffinityMap();
    const a = map.get('entity:e-harpreet')!;
    expect(a).toBeGreaterThan(0.5); // tanh(5*1.0/5)=tanh(1)=0.76
    expect(a).toBeLessThanOrEqual(1);
  });

  it('produces negative affinity but floors it at -0.5', () => {
    db = freshDb();
    for (let i = 0; i < 12; i++) addEvent(db, 'marked_irrelevant', ['entity:e-botspam']);
    const svc = new BehaviorAffinityService(db);
    svc.recompute({ nowTs: NOW });
    const a = svc.getAffinityMap().get('entity:e-botspam')!;
    expect(a).toBeLessThan(0);
    expect(a).toBeGreaterThanOrEqual(-0.5); // floored
  });

  it('resolves message refs to both source and mentioned entities', () => {
    db = freshDb();
    addMessage(db, 'm1', 'ringcentral', ['e-proj']);
    addEvent(db, 'clicked', ['message:m1']);
    addEvent(db, 'clicked', ['message:m1']);
    const svc = new BehaviorAffinityService(db);
    svc.recompute({ nowTs: NOW });
    const map = svc.getAffinityMap();
    expect(map.get('source:ringcentral')!).toBeGreaterThan(0);
    expect(map.get('entity:e-proj')!).toBeGreaterThan(0);
  });

  it('applies time decay — older events contribute less', () => {
    db = freshDb();
    addEvent(db, 'sent_after_insert', ['entity:e-recent'], 0);
    addEvent(db, 'sent_after_insert', ['entity:e-old'], 60); // 2 half-lives old
    const svc = new BehaviorAffinityService(db);
    svc.recompute({ nowTs: NOW });
    const map = svc.getAffinityMap();
    expect(map.get('entity:e-recent')!).toBeGreaterThan(map.get('entity:e-old')!);
  });

  it('ignores unknown actions and is a full recompute', () => {
    db = freshDb();
    addEvent(db, 'sent_after_insert', ['entity:e1']);
    let svc = new BehaviorAffinityService(db);
    svc.recompute({ nowTs: NOW });
    expect(svc.getAffinityMap().size).toBe(1);
    // Replace data and recompute — table is rebuilt, not appended.
    db.prepare('DELETE FROM memory_outcome_events').run();
    addEvent(db, 'noop_unknown_action', ['entity:e2']);
    svc = new BehaviorAffinityService(db);
    svc.recompute({ nowTs: NOW });
    expect(svc.getAffinityMap().size).toBe(0);
  });
});
