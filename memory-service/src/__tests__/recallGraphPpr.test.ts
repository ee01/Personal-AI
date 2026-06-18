import BetterSqlite3 from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { RecallEngine } from '../core/RecallEngine.js';

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

function addEntity(db: BetterSqlite3.Database, id: string, name: string): void {
  db.prepare(
    `INSERT INTO entities (id, type, name, importance, mention_count, last_seen, status, created_at)
     VALUES (?, 'Project', ?, 0.6, 3, ?, 'active', ?)`,
  ).run(id, name, NOW, NOW);
}

function addRel(db: BetterSqlite3.Database, from: string, to: string): void {
  db.prepare(
    `INSERT INTO relationships (from_entity_id, to_entity_id, relation_type, strength, co_occurrence_count, created_at, updated_at)
     VALUES (?, ?, 'related_to', 0.9, 5, ?, ?)`,
  ).run(from, to, NOW, NOW);
}

describe('RecallEngine graphSearchPpr (P0-3)', () => {
  let db: BetterSqlite3.Database | null = null;
  afterEach(() => {
    db?.close();
    db = null;
  });

  it('surfaces a 3-hop entity that the 2-hop walk cannot reach', async () => {
    db = freshDb();
    // Chain: Zephyrnaut(seed) - Borealis - Cinder - Dynamo (3 hops to Dynamo).
    addEntity(db, 'e-z', 'Zephyrnaut');
    addEntity(db, 'e-b', 'Borealis');
    addEntity(db, 'e-c', 'Cinder');
    addEntity(db, 'e-d', 'Dynamo');
    addRel(db, 'e-z', 'e-b');
    addRel(db, 'e-b', 'e-c');
    addRel(db, 'e-c', 'e-d');

    const engine = new RecallEngine(db);
    const cands = await (engine as any).graphSearchPpr('Zephyrnaut', 20, { scope: 'all' });
    expect(cands).not.toBeNull();
    const ids = cands.map((c: any) => c.id);
    // Seed plus the full chain, including the 3-hop Dynamo.
    expect(ids).toContain('e-z');
    expect(ids).toContain('e-d');
    // PPR activation decays with distance: Borealis (1-hop) > Dynamo (3-hop).
    const score = (id: string) => cands.find((c: any) => c.id === id)?.score ?? 0;
    expect(score('e-b')).toBeGreaterThan(score('e-d'));
    // Non-seed entities are tagged with the ppr algorithm + a pprScore.
    const dynamo = cands.find((c: any) => c.id === 'e-d');
    expect(dynamo.metadata.graphAlgorithm).toBe('ppr');
    expect(typeof dynamo.metadata.pprScore).toBe('number');
  });

  it('returns null (defers to hops) when there is no graph structure', async () => {
    db = freshDb();
    addEntity(db, 'e-lonely', 'Solitaire');
    const engine = new RecallEngine(db);
    const cands = await (engine as any).graphSearchPpr('Solitaire', 20, { scope: 'all' });
    expect(cands).toBeNull();
  });

  it('returns null when the query matches no seed entity', async () => {
    db = freshDb();
    addEntity(db, 'e-z', 'Zephyrnaut');
    addEntity(db, 'e-b', 'Borealis');
    addRel(db, 'e-z', 'e-b');
    const engine = new RecallEngine(db);
    const cands = await (engine as any).graphSearchPpr('NothingMatchesThis', 20, { scope: 'all' });
    expect(cands).toBeNull();
  });
});
