import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import BetterSqlite3 from 'better-sqlite3';

import {
  dropChunkVirtualTables,
  recreateChunkVirtualTables,
  repairSqliteVtab,
  smokeTestChunkWrite,
} from '../../tools/repair-sqlite-vtab.js';
import { isSqliteCorruptError } from '../utils/sqliteErrors.js';

function seedDatabase(dbPath: string): void {
  const migrationsDir = path.resolve(
    fileURLToPath(new URL('.', import.meta.url)),
    '..',
    'storage',
    'migrations',
  );
  const db = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    for (const statement of sql
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)) {
      try {
        db.exec(`${statement};`);
      } catch {
        // tolerate vec statements when extension is unavailable
      }
    }
  }

  const ts = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO chunks (
       file_path, line_start, line_end, content, content_hash, created_at, updated_at
     ) VALUES (?, 1, 1, ?, ?, ?, ?)`,
  ).run('seed/demo.md', 'seed chunk content for repair test', 'seed-hash', ts, ts);
  db.close();
}

describe('repairSqliteVtab', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('matches SQLITE_CORRUPT_VTAB in isSqliteCorruptError', () => {
    expect(
      isSqliteCorruptError(
        Object.assign(new Error('database disk image is malformed'), {
          code: 'SQLITE_CORRUPT_VTAB',
        }),
      ),
    ).toBe(true);
  });

  it('rebuilds FTS and restores chunk writes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repair-vtab-'));
    dirs.push(dir);
    const dbPath = path.join(dir, 'memory.db');
    seedDatabase(dbPath);

    const db = new BetterSqlite3(dbPath);
    dropChunkVirtualTables(db);
    recreateChunkVirtualTables(db, false);
    smokeTestChunkWrite(db);
    db.close();

    const result = repairSqliteVtab(dir);
    expect(result.chunkCount).toBeGreaterThan(0);
    expect(result.ftsRowCount).toBe(result.chunkCount);
    expect(result.integrityAfter).toEqual(['ok']);
  });
});
