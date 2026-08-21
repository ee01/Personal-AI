/**
 * Rebuild corrupted SQLite virtual tables (chunks_fts, chunks_vec, messages_vec).
 *
 * Use when writes fail with SQLITE_CORRUPT_VTAB while base tables still read OK.
 * Stop memory-service before running. Creates *.repair-bak-<ts> copies first.
 *
 * Usage:
 *   tsx tools/repair-sqlite-vtab.ts /path/to/users/esone.qiu
 *   tsx tools/repair-sqlite-vtab.ts /path/to/memory.db --dry-run
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import BetterSqlite3 from 'better-sqlite3';

const require = createRequire(import.meta.url);

const CHUNK_FTS_DDL = `
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  content,
  content='chunks',
  content_rowid='chunk_id',
  tokenize='porter unicode61'
);
`;

const CHUNK_FTS_TRIGGER_STATEMENTS = [
  `CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, content) VALUES (new.chunk_id, new.content);
END`,
  `CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.chunk_id, old.content);
END`,
  `CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.chunk_id, old.content);
  INSERT INTO chunks_fts(rowid, content) VALUES (new.chunk_id, new.content);
END`,
] as const;

const CHUNKS_VEC_DDL = `
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
  chunk_id INTEGER PRIMARY KEY,
  embedding float[384]
);
`;

const MESSAGES_VEC_DDL = `
CREATE VIRTUAL TABLE IF NOT EXISTS messages_vec USING vec0(
  message_id TEXT PRIMARY KEY,
  embedding float[384]
);
`;

export interface RepairSqliteVtabOptions {
  dryRun?: boolean;
  skipBackup?: boolean;
}

export interface RepairSqliteVtabResult {
  dbPath: string;
  backupStamp?: number;
  integrityBefore: string[];
  integrityAfter: string[];
  chunkCount: number;
  ftsRowCount: number;
  vecSupport: boolean;
  dryRun: boolean;
}

function resolveDbPath(input: string): string {
  const normalized = path.resolve(input);
  if (normalized.endsWith('.db')) {
    return normalized;
  }
  return path.join(normalized, 'memory.db');
}

function loadVecExtension(db: BetterSqlite3.Database): boolean {
  try {
    const sqliteVec = require('sqlite-vec');
    db.loadExtension(sqliteVec.getLoadablePath());
    return true;
  } catch {
    return false;
  }
}

function backupDatabaseFiles(dbPath: string): number {
  const stamp = Date.now();
  for (const suffix of ['', '-wal', '-shm'] as const) {
    const src = `${dbPath}${suffix}`;
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, `${dbPath}.repair-bak-${stamp}${suffix}`);
  }
  return stamp;
}

function runIntegrityCheck(db: BetterSqlite3.Database): string[] {
  return (db.pragma('integrity_check') as Array<{ integrity_check: string }>).map(
    (row) => row.integrity_check,
  );
}

export function dropChunkVirtualTables(db: BetterSqlite3.Database): void {
  db.exec(`
    DROP TRIGGER IF EXISTS chunks_ai;
    DROP TRIGGER IF EXISTS chunks_ad;
    DROP TRIGGER IF EXISTS chunks_au;
    DROP TABLE IF EXISTS chunks_fts;
    DROP TABLE IF EXISTS chunks_vec;
    DROP TABLE IF EXISTS messages_vec;
  `);
}

export function recreateChunkVirtualTables(
  db: BetterSqlite3.Database,
  withVec: boolean,
): void {
  db.exec(CHUNK_FTS_DDL);
  for (const statement of CHUNK_FTS_TRIGGER_STATEMENTS) {
    db.exec(statement);
  }
  if (withVec) {
    db.exec(CHUNKS_VEC_DDL);
    db.exec(MESSAGES_VEC_DDL);
  }
  db.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('rebuild')`).run();
}

export function smokeTestChunkWrite(db: BetterSqlite3.Database): void {
  const ts = Math.floor(Date.now() / 1000);
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO chunks (
         file_path, line_start, line_end, content, content_hash, created_at, updated_at
       ) VALUES (?, 1, 1, ?, ?, ?, ?)`,
    ).run('__repair_smoke__.md', 'repair smoke test', 'repair-smoke', ts, ts);
    const row = db
      .prepare(`SELECT chunk_id FROM chunks WHERE file_path = ?`)
      .get('__repair_smoke__.md') as { chunk_id: number };
    db.prepare(`DELETE FROM chunks WHERE chunk_id = ?`).run(row.chunk_id);
  });
  tx();
}

export function repairSqliteVtab(
  inputPath: string,
  options: RepairSqliteVtabOptions = {},
): RepairSqliteVtabResult {
  const dbPath = resolveDbPath(inputPath);
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database not found: ${dbPath}`);
  }

  let backupStamp: number | undefined;
  if (!options.skipBackup && !options.dryRun) {
    backupStamp = backupDatabaseFiles(dbPath);
  }

  const db = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const vecSupport = loadVecExtension(db);

  const integrityBefore = runIntegrityCheck(db);
  const chunkCount = (
    db.prepare(`SELECT COUNT(*) AS count FROM chunks`).get() as { count: number }
  ).count;

  if (options.dryRun) {
    db.close();
    return {
      dbPath,
      backupStamp,
      integrityBefore,
      integrityAfter: integrityBefore,
      chunkCount,
      ftsRowCount: 0,
      vecSupport,
      dryRun: true,
    };
  }

  const repairTx = db.transaction(() => {
    dropChunkVirtualTables(db);
    recreateChunkVirtualTables(db, vecSupport);
  });
  repairTx();
  smokeTestChunkWrite(db);

  const ftsRowCount = (
    db.prepare(`SELECT COUNT(*) AS count FROM chunks_fts`).get() as { count: number }
  ).count;
  const integrityAfter = runIntegrityCheck(db);
  db.close();

  return {
    dbPath,
    backupStamp,
    integrityBefore,
    integrityAfter,
    chunkCount,
    ftsRowCount,
    vecSupport,
    dryRun: false,
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const input = args.find((arg) => !arg.startsWith('--'));
  if (!input) {
    console.error('usage: repair-sqlite-vtab <user-dir-or-memory.db> [--dry-run]');
    process.exit(2);
  }

  const result = repairSqliteVtab(input, { dryRun });
  console.log('repair-sqlite-vtab');
  console.log(`  dbPath           : ${result.dbPath}`);
  console.log(`  dryRun           : ${result.dryRun}`);
  console.log(`  backupStamp      : ${result.backupStamp ?? '(skipped)'}`);
  console.log(`  chunkCount       : ${result.chunkCount}`);
  console.log(`  ftsRowCount      : ${result.ftsRowCount}`);
  console.log(`  vecSupport       : ${result.vecSupport}`);
  console.log(`  integrityBefore  : ${result.integrityBefore.join(', ')}`);
  console.log(`  integrityAfter   : ${result.integrityAfter.join(', ')}`);

  if (!result.dryRun && result.integrityAfter.some((line) => line !== 'ok')) {
    process.exit(1);
  }
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entryPath.endsWith('repair-sqlite-vtab.ts')) {
  main();
}
