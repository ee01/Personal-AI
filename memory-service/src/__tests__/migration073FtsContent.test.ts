import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../storage/migrations',
);

describe('073_fix_fts_content_column', () => {
  it('does not ALTER ADD a STORED generated column (SQLite 500s that on live user DBs)', () => {
    const sql = fs.readFileSync(
      path.join(migrationsDir, '073_fix_fts_content_column.sql'),
      'utf8',
    );
    expect(sql).not.toMatch(/GENERATED ALWAYS/i);
    expect(sql).not.toMatch(/ADD COLUMN content/i);
    expect(sql).toMatch(/DROP TABLE IF EXISTS unit_views_fts_seg/);
    expect(sql).toMatch(/DROP TABLE IF EXISTS unit_views_fts_tri/);
  });
});
