/**
 * Tests for SynonymEdgeService (P0-3 P1): deterministic alias/normalized-name
 * synonym edges feeding PPR associative recall. Embeddings disabled to keep the
 * test deterministic and offline.
 */

import { getTestDb, cleanupTestDb } from './setup.js';
import { SynonymEdgeService } from '../core/SynonymEdgeService.js';
import { now } from '../utils/time.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

function insertEntity(
  id: string,
  name: string,
  aliases: string[],
  type = 'Project',
): void {
  db.prepare(
    `INSERT INTO entities (id, type, name, aliases_json, importance, mention_count,
       status, created_at)
     VALUES (?, ?, ?, ?, 0.5, 3, 'active', ?)`,
  ).run(id, type, name, JSON.stringify(aliases), now());
}

beforeAll(() => {
  db = getTestDb();
});

afterAll(() => {
  cleanupTestDb();
});

beforeEach(() => {
  db.prepare('DELETE FROM relationships').run();
  db.prepare('DELETE FROM entities').run();
});

describe('SynonymEdgeService', () => {
  it('links entities that collide on a normalized alias', async () => {
    insertEntity('e-canonical', 'MTR-148115', ['MTR 项目']);
    insertEntity('e-drift', 'MTR项目', []); // normalizes to same form as the alias
    const result = await new SynonymEdgeService(db).generate({ useEmbeddings: false });
    expect(result.usedEmbeddings).toBe(false);
    expect(result.edgesAdded).toBe(1);

    const edge = db
      .prepare(
        `SELECT relation_type, strength, context FROM relationships
          WHERE relation_type = 'synonym_of'`,
      )
      .get() as { relation_type: string; strength: number; context: string };
    expect(edge.relation_type).toBe('synonym_of');
    expect(edge.strength).toBe(0.5);
    expect(edge.context).toBe('consolidation_synonym');
  });

  it('is idempotent — a second run adds no duplicate edge', async () => {
    insertEntity('a', 'Export Format Change', ['导出格式变更']);
    insertEntity('b', 'export-format-change', []);
    const svc = new SynonymEdgeService(db);
    const first = await svc.generate({ useEmbeddings: false });
    expect(first.edgesAdded).toBe(1);
    const second = await svc.generate({ useEmbeddings: false });
    expect(second.edgesAdded).toBe(0);
    const count = db
      .prepare(`SELECT COUNT(*) AS c FROM relationships WHERE relation_type = 'synonym_of'`)
      .get() as { c: number };
    expect(count.c).toBe(1);
  });

  it('does not link unrelated entities', async () => {
    insertEntity('x', 'Harpreet', ['harp']);
    insertEntity('y', 'Quarterly Planning', ['Q3 planning']);
    const result = await new SynonymEdgeService(db).generate({ useEmbeddings: false });
    expect(result.edgesAdded).toBe(0);
  });
});
