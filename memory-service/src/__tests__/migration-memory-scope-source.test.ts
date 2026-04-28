import BetterSqlite3 from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { Database } from '../storage/Database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function applySqlLenient(db: BetterSqlite3.Database, sql: string): void {
  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    try {
      db.exec(statement);
    } catch {
      // Ignore unsupported vec/trigger fragments in tests.
    }
  }
}

describe('017_memory_scope_source migration', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    while (tempRoots.length > 0) {
      const tempRoot = tempRoots.pop();
      if (tempRoot) {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    }
  });

  it('backfills existing message and chunk rows to work scope', () => {
    const tempRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'memory-scope-migration-'),
    );
    tempRoots.push(tempRoot);
    const dbPath = path.join(tempRoot, 'memory.db');
    const rawDb = new BetterSqlite3(dbPath);
    const migrationsDir = path.resolve(
      __dirname,
      '..',
      'storage',
      'migrations',
    );

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter(
        (file) => file.endsWith('.sql') && file < '017_memory_scope_source.sql',
      )
      .sort();

    for (const file of migrationFiles) {
      applySqlLenient(
        rawDb,
        fs.readFileSync(path.join(migrationsDir, file), 'utf8'),
      );
    }

    rawDb
      .prepare('INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)')
      .run('001_initial.sql', Date.now());
    for (const file of migrationFiles.filter(
      (file) => file !== '001_initial.sql',
    )) {
      rawDb
        .prepare('INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)')
        .run(file, Date.now());
    }

    rawDb
      .prepare(
        `INSERT INTO messages_raw
        (id, content, source_type, timestamp, importance, sentiment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'legacy-message',
        'Legacy glip message',
        'glip',
        1_700_000_000,
        0.7,
        'neutral',
        1_700_000_000,
      );
    rawDb
      .prepare(
        `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, source_type, related_entity_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        301,
        'messages/legacy-message',
        1,
        1,
        'Legacy glip message chunk',
        'legacy-hash',
        'glip',
        'legacy-message',
        1_700_000_000,
      );
    rawDb.close();

    const database = new Database({ dbPath, dataDir: tempRoot });
    const applied = database.migrate();

    expect(applied).toContain('017_memory_scope_source.sql');
    expect(
      database.get<{ scope: string; source_type: string }>(
        'SELECT scope, source_type FROM messages_raw WHERE id = ?',
        'legacy-message',
      ),
    ).toEqual({ scope: 'work', source_type: 'glip' });
    expect(
      database.get<{ scope: string; source_type: string }>(
        'SELECT scope, source_type FROM chunks WHERE chunk_id = ?',
        301,
      ),
    ).toEqual({ scope: 'work', source_type: 'glip' });

    database.close();
  });
});
