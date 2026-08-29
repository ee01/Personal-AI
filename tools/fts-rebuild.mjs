#!/usr/bin/env node
/**
 * Rebuild a corrupt `chunks_fts` index from its content table.
 *
 * `chunks_fts` is an external-content FTS5 table (`content='chunks'`), so the
 * index is fully derivable from `chunks` and a rebuild loses nothing as long as
 * `chunks` itself reads cleanly. The script refuses to run if it does not.
 *
 * Run against a stopped service so the rebuild holds an uncontended write lock.
 *
 * Usage: node tools/fts-rebuild.mjs <path-to-memory.db> [probe-term]
 */
import { copyFileSync, statSync } from 'node:fs';
import Database from 'better-sqlite3';

const dbPath = process.argv[2];
const probeTerm = process.argv[3] || 'meeting';
if (!dbPath) {
  console.error('usage: node fts-rebuild.mjs <db> [probe-term]');
  process.exit(2);
}

const stamp = new Date()
  .toISOString()
  .replace(/[-:]/g, '')
  .replace(/\..+$/, '');
const backupPath = `${dbPath}.pre-fts-rebuild-${stamp}`;

function step(label, fn) {
  const started = Date.now();
  try {
    const value = fn();
    console.log(`ok   ${label}${value === undefined ? '' : ` -> ${value}`}  (${Date.now() - started}ms)`);
    return value;
  } catch (error) {
    console.log(`FAIL ${label}: ${error.message}  (${Date.now() - started}ms)`);
    throw error;
  }
}

// The content table is the only irreplaceable input, so verify it before
// touching anything.
const probe = new Database(dbPath, { readonly: true });
const chunkCount = step('read chunks', () =>
  probe.prepare('SELECT count(*) c FROM chunks').get().c,
);
step('read chunks content sample', () => {
  const row = probe.prepare('SELECT content FROM chunks LIMIT 1').get();
  return row ? `${String(row.content).length} chars` : 'empty table';
});
probe.close();

if (!chunkCount) {
  console.error('refusing to rebuild: chunks table is empty');
  process.exit(1);
}

step(`backup -> ${backupPath}`, () => {
  copyFileSync(dbPath, backupPath);
  return `${(statSync(backupPath).size / 1024 / 1024).toFixed(0)} MB`;
});

const db = new Database(dbPath);
db.pragma('busy_timeout = 30000');

step('drop stale fts shadow rows', () =>
  db.prepare("INSERT INTO chunks_fts(chunks_fts) VALUES('delete-all')").run().changes,
);
step('rebuild chunks_fts', () =>
  db.prepare("INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild')").run().changes,
);
step('integrity-check', () => {
  db.prepare("INSERT INTO chunks_fts(chunks_fts) VALUES('integrity-check')").run();
  return 'clean';
});
step('fts row count', () => db.prepare('SELECT count(*) c FROM chunks_fts').get().c);
step('docsize row count', () =>
  db.prepare('SELECT count(*) c FROM chunks_fts_docsize').get().c,
);
step(`MATCH ${probeTerm}`, () =>
  db
    .prepare('SELECT count(*) c FROM chunks_fts WHERE chunks_fts MATCH ?')
    .get(probeTerm).c,
);

db.close();
console.log('\nrebuild complete; backup retained at', backupPath);
