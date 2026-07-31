import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The other half of the migration contract: a brand-new deployment gets its
// columns straight from schema.sql, and the migration runner must still record
// every id so a later boot does not try to re-apply them.
process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'roadmap-fresh-'));
const { getDb } = await import('../storage/Database.js');

describe('a database created from schema.sql', () => {
  it('already has the manual-item columns and a complete migration ledger', () => {
    const db = getDb();
    const columns = (
      db.pragma('table_info(items)') as Array<{ name: string }>
    ).map((row) => row.name);
    expect(columns).toEqual(
      expect.arrayContaining(['source', 'jira_key', 'project_key']),
    );
    expect(
      (db.prepare(`SELECT id FROM _migrations`).all() as Array<{ id: string }>)
        .map((row) => row.id)
        .sort(),
    ).toEqual([
      '001_initial',
      '002_items_manual_source',
      '003_items_jira_key_index',
      '004_items_backfill_jira_key',
    ]);
    expect(
      db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_items_jira_key'`,
        )
        .get(),
    ).toEqual({ name: 'idx_items_jira_key' });
  });
});
