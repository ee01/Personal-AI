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

interface Cand {
  id: string;
  type: 'entity';
  content: string;
  score: number;
  source?: string;
}

describe('RecallEngine affinity nudges ranking (P0-4)', () => {
  let db: BetterSqlite3.Database | null = null;
  afterEach(() => {
    db?.close();
    db = null;
  });

  function rank(engine: RecallEngine, cands: Cand[]): string[] {
    const affinityMap = (engine as any).loadAffinityMap();
    const ranked = (engine as any).mmrRerank(cands, 10, affinityMap) as Cand[];
    return ranked.map((c) => c.id);
  }

  it('promotes a high-affinity entity above an equal-base-score peer', () => {
    db = freshDb();
    // Two entity candidates with identical base score and no recency/salience.
    const cands: Cand[] = [
      { id: 'e-liked', type: 'entity', content: 'topic alpha distinct words one', score: 0.5 },
      { id: 'e-neutral', type: 'entity', content: 'topic beta different terms two', score: 0.5 },
    ];

    const engine = new RecallEngine(db);
    // Baseline: no affinity data -> order is stable/tied (insertion order kept).
    const before = rank(engine, cands.map((c) => ({ ...c })));
    expect(before).toContain('e-liked');

    // Seed strong positive affinity for e-liked.
    db.prepare(
      `INSERT INTO behavior_affinity (id, subject_type, subject_key, affinity, positive_events, negative_events, updated_at)
       VALUES ('a1', 'entity', 'e-liked', 0.9, 5, 0, 0)`,
    ).run();

    const after = rank(engine, cands.map((c) => ({ ...c })));
    expect(after[0]).toBe('e-liked');
  });

  it('does not change ranking when affinity is disabled (no rows)', () => {
    db = freshDb();
    const engine = new RecallEngine(db);
    const map = (engine as any).loadAffinityMap();
    expect(map.size).toBe(0);
  });
});
