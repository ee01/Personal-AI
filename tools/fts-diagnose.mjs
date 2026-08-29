#!/usr/bin/env node
/**
 * Read-only FTS diagnosis for a per-user memory.db.
 *
 * Reports whether the content table is readable, whether the FTS5 shadow tables
 * are intact, and how far the FTS row coverage has drifted from `chunks`.
 * Makes no writes, so it is safe to run against a live database.
 *
 * Usage: node tools/fts-diagnose.mjs <path-to-memory.db> [probe-term]
 */
import Database from 'better-sqlite3';

const dbPath = process.argv[2];
const probeTerm = process.argv[3] || 'Switcher';
if (!dbPath) {
  console.error('usage: node fts-diagnose.mjs <db> [probe-term]');
  process.exit(2);
}

const db = new Database(dbPath, { readonly: true });

function attempt(label, fn) {
  const started = Date.now();
  try {
    const value = fn();
    console.log(`${label} = ${value}  (${Date.now() - started}ms)`);
    return { ok: true, value };
  } catch (error) {
    console.log(`${label} FAILED: ${error.message}  (${Date.now() - started}ms)`);
    return { ok: false, error };
  }
}

console.log('db =', dbPath);
attempt('page_count', () => db.pragma('page_count', { simple: true }));
attempt('freelist_count', () => db.pragma('freelist_count', { simple: true }));

const ftsTables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_fts%' ORDER BY name",
  )
  .all()
  .map((row) => row.name);
console.log('fts_tables =', JSON.stringify(ftsTables));

attempt('chunks.count', () => db.prepare('SELECT count(*) c FROM chunks').get().c);
attempt('chunks.max_rowid', () => db.prepare('SELECT max(rowid) m FROM chunks').get().m);
attempt(
  `chunks LIKE %${probeTerm}%`,
  () =>
    db
      .prepare('SELECT count(*) c FROM chunks WHERE content LIKE ?')
      .get(`%${probeTerm}%`).c,
);

attempt('chunks_fts.count', () => db.prepare('SELECT count(*) c FROM chunks_fts').get().c);
attempt('chunks_fts_data.count', () =>
  db.prepare('SELECT count(*) c FROM chunks_fts_data').get().c,
);
attempt('chunks_fts_docsize.count', () =>
  db.prepare('SELECT count(*) c FROM chunks_fts_docsize').get().c,
);
attempt(
  `chunks_fts MATCH ${probeTerm}`,
  () =>
    db
      .prepare('SELECT count(*) c FROM chunks_fts WHERE chunks_fts MATCH ?')
      .get(probeTerm).c,
);

// The FTS5 self-test walks the full index and is the authoritative signal.
attempt('chunks_fts integrity-check', () => {
  db.prepare("INSERT INTO chunks_fts(chunks_fts) VALUES('integrity-check')").run();
  return 'clean';
});

db.close();
