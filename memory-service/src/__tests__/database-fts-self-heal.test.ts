import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../storage/Database.js';

/**
 * chunks_fts is an external-content FTS5 index over `chunks`. When the shadow
 * tables get damaged, recall silently returns nothing instead of failing loudly,
 * so the service repairs the index on user-context load.
 */
describe('Database.verifyAndRepairFtsIndex', () => {
  let tempDir: string;
  let database: Database;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fts-self-heal-'));
    database = new Database({ dataDir: tempDir });
    database.migrate();
    const insert = database.raw.prepare(
      `INSERT INTO chunks (file_path, line_start, line_end, content, content_hash, created_at)
       VALUES (?, 1, 1, ?, ?, ?)`,
    );
    for (let i = 0; i < 20; i += 1) {
      insert.run(`notes/${i}.md`, `nova brandy mailing group ${i}`, `hash-${i}`, 1);
    }
  });

  afterEach(() => {
    database.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.SQLITE_FTS_AUTO_REPAIR_ENABLED;
  });

  function matchCount(): number {
    const row = database.raw
      .prepare('SELECT count(*) AS c FROM chunks_fts WHERE chunks_fts MATCH ?')
      .get('brandy') as { c: number };
    return row.c;
  }

  /**
   * Punch a hole in the FTS5 shadow table the way a bad filesystem would. The
   * shadow tables are write-protected by SQLite's defensive mode, which
   * better-sqlite3 turns on by default, so drop it for the duration of the write.
   */
  function corruptFtsIndex(): void {
    database.raw.unsafeMode(true);
    try {
      database.raw.prepare('DELETE FROM chunks_fts_data WHERE id > 1').run();
    } finally {
      database.raw.unsafeMode(false);
    }
  }

  it('reports a healthy index as clean and leaves it searchable', () => {
    expect(database.verifyAndRepairFtsIndex()).toBe('clean');
    expect(matchCount()).toBe(20);
  });

  it('rebuilds a corrupt index so keyword recall works again', () => {
    corruptFtsIndex();
    expect(() =>
      database.raw
        .prepare("INSERT INTO chunks_fts(chunks_fts) VALUES('integrity-check')")
        .run(),
    ).toThrow(/malformed/i);

    expect(database.verifyAndRepairFtsIndex()).toBe('repaired');
    expect(database.verifyAndRepairFtsIndex()).toBe('clean');
    expect(matchCount()).toBe(20);
  });

  it('leaves the index untouched when the kill switch is off', () => {
    process.env.SQLITE_FTS_AUTO_REPAIR_ENABLED = 'false';
    corruptFtsIndex();
    expect(database.verifyAndRepairFtsIndex()).toBe('skipped');
    expect(() =>
      database.raw
        .prepare("INSERT INTO chunks_fts(chunks_fts) VALUES('integrity-check')")
        .run(),
    ).toThrow(/malformed/i);
  });
});
